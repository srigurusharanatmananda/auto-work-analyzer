from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import ctypes
import gc
import io
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Indic Parler-TTS Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# There is exactly one model this service exists to serve — see
# docs/specs/2026-08-08-learning-module-design.md, which names this model for
# its reported 99.79% NSS Sanskrit score. That figure is the model card's own
# claim, not something the design doc verified independently ("a reported
# metric, not something verified here" — its own Risks section). Unlike
# WhisperModel's size tiers, there is no smaller/larger variant to make
# configurable, so unlike WHISPER_MODEL, this is not an env var.
MODEL_NAME = "ai4bharat/indic-parler-tts"
DEVICE = os.getenv("DEVICE", "cpu")

# The model card's own recommended speaker for Sanskrit, of the 69 named
# speakers across the model's 18 officially-covered languages. Used when a
# caller does not name a voice.
DEFAULT_VOICE = "Aryan"

model = None
tokenizer = None
description_tokenizer = None

# Loaded once at import time, not re-opened on every `/synthesize` call —
# the dynamic linker already caches a shared library's mapping process-wide,
# but there is still no reason to repeat a symbol lookup on every request
# for a handle that never changes. `None` on anything but glibc/Linux (e.g.
# macOS during local iteration on this file outside its Docker image) — see
# `_release_native_memory`'s own use of it.
try:
    _libc = ctypes.CDLL("libc.so.6")
except OSError:
    _libc = None

logger.info(f"Loading {MODEL_NAME} on {DEVICE} — first run also downloads the model, which can take a while")

try:
    import torch
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer

    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL_NAME).to(DEVICE)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    # A SEPARATE tokenizer for the voice/prosody description, not the same
    # one used for the text to speak — this is not a simplification of the
    # model card's example, it is what the example itself does.
    # `model.config.text_encoder._name_or_path` names whatever encoder the
    # checkpoint actually ships with, rather than hardcoding a guess at it.
    description_tokenizer = AutoTokenizer.from_pretrained(
        model.config.text_encoder._name_or_path
    )
    logger.info("✅ Indic Parler-TTS model loaded successfully")
except Exception as e:
    logger.error(f"❌ Failed to load Indic Parler-TTS model: {e}")
    model = None


class SynthesizeRequest(BaseModel):
    text: str
    voice: str | None = None
    prosody: str | None = None


# The model's own generation_config.json ships max_length=2610 (fetched
# directly from the gated repo, not guessed), which already bounds
# model.generate() even when a caller passes nothing — so generation was
# never actually unbounded. Passed explicitly anyway: an implicit default
# inherited from whatever generation_config.json happens to ship in a given
# transformers/parler-tts version is not a bound anyone reading this code can
# see, and a future upgrade could change or drop it silently.
MAX_NEW_TOKENS = 2610


@app.get("/health")
async def health_check():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "healthy", "model": MODEL_NAME}


def _release_native_memory() -> None:
    """Runs the C allocator's own equivalent of returning freed memory to
    the OS, after every synthesis call (success or failure — see the
    `finally` in `_synthesize_sync` below).

    Root cause this works around: `model.generate()` is already correctly
    wrapped in `torch.no_grad()` (it's a decorator on the base
    `ParlerTTSForConditionalGeneration.generate` itself, confirmed by
    reading the installed library's source directly — not a gradient/
    autograd-graph leak). What was actually observed instead (2026-08-13):
    `docker stats`-reported RSS climbing steadily across consecutive
    requests (40% → 82%+ of the 4g limit over 3-4 calls) with no crash and
    no error, but retried requests failing outright once memory got high
    enough — and a plain container restart, with no code change, fully
    resets it back to baseline every time. That specific signature — freed
    Python objects, climbing native RSS anyway, clean reset on restart —
    is the standard glibc/OpenMP/MKL behavior of NOT returning freed heap
    arenas and per-thread scratch buffers back to the OS after a large
    CPU tensor workload, not a Python-level object leak `gc.collect()`
    alone would catch (called anyway, since it is a real but incomplete
    part of the picture — CPython's own reference cycles, if any, need it,
    even though the bulk of the growth is native-heap-side).
    `ctypes` + `malloc_trim(0)` is the standard, safe way to force glibc to
    hand unused arenas back to the OS; it is a no-op (returns 0) on
    non-glibc/non-Linux systems, so this stays harmless in dev tooling that
    might run this file outside the Linux container it actually ships in.

    Called from a `finally` block in `_synthesize_sync` — an exception
    escaping THIS function would override whatever that block was already
    returning or propagating (Python's own `finally` semantics), turning a
    successful synthesis into a spurious 500, or replacing the real error
    from a failed one with an unrelated cleanup failure. Every exception
    this function could plausibly raise is therefore caught and logged
    here, never re-raised.
    """
    gc.collect()
    if _libc is None:
        return
    try:
        _libc.malloc_trim(0)
    except Exception:
        # Not just OSError: an alternate libc (musl, a stripped/minimal
        # image) could expose the symbol lookup fine but still fail in a
        # way ctypes surfaces as AttributeError or something else entirely
        # — logged so a silently-reverted leak fix leaves a trace, but
        # never allowed to affect the actual synthesis result either way.
        logger.warning("malloc_trim(0) failed — native memory may not be released this call", exc_info=True)


def _synthesize_sync(text: str, voice: str, prosody: str) -> bytes:
    """The actual blocking work — tokenize, generate, encode to WAV. Runs off
    the event loop; see `synthesize()`'s executor call for why."""
    try:
        # Parler-TTS's voice control is a natural-language description of
        # the SPEAKER AND RECORDING, not a set of parameters — this is not
        # a simplification, it is the actual interface the model was
        # trained against. `prosody` here is already a natural-language
        # description (see SpeechClient.ts's DEFAULT_PROSODY), so it slots
        # directly in rather than needing translation into some other
        # format.
        description = f"{voice}'s voice is {prosody}, in a close-up recording."

        description_inputs = description_tokenizer(description, return_tensors="pt").to(DEVICE)
        prompt_inputs = tokenizer(text, return_tensors="pt").to(DEVICE)

        generation = model.generate(
            input_ids=description_inputs.input_ids,
            attention_mask=description_inputs.attention_mask,
            prompt_input_ids=prompt_inputs.input_ids,
            prompt_attention_mask=prompt_inputs.attention_mask,
            max_new_tokens=MAX_NEW_TOKENS,
        )
        # do_sample=True (the model's own default) means generation length is
        # stochastic — observed directly (2026-08-10, synthesizing 'वन'): a
        # generation that terminates almost immediately squeezes all the way
        # down to a 0-d scalar array (ndim 0, shape ()), and soundfile.write
        # indexes into that shape to decide the channel count, failing with
        # "tuple index out of range" on an empty shape tuple. `atleast_1d`
        # guarantees at least one dimension survives regardless of how short
        # the generation was, so this fails loudly and clearly (if the audio is
        # genuinely empty) rather than crashing on an unrelated-looking error.
        import numpy as np

        audio_arr = np.atleast_1d(generation.cpu().numpy().squeeze())

        import soundfile as sf

        buffer = io.BytesIO()
        # The model's own sampling rate, read at request time rather than
        # hardcoded — nothing here assumes a specific number.
        sf.write(buffer, audio_arr, model.config.sampling_rate, format="WAV")
        buffer.seek(0)
        return buffer.read()
    finally:
        # Runs on every path out of this function, including a raised
        # exception — the memory growth this addresses was observed to
        # accumulate even across a run that included a failed attempt, so
        # gating this on the success path only would have left the exact
        # failure case this exists for unaddressed.
        _release_native_memory()


@app.post("/synthesize")
async def synthesize(request: SynthesizeRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text must be non-empty")

    voice = request.voice or DEFAULT_VOICE
    prosody = request.prosody or "clear and measured"

    try:
        # model.generate() is synchronous, CPU-bound, and measured at several
        # minutes per call on this hardware — run directly on the event loop,
        # it would starve /health for the whole call. SpeechClient.ts's
        # waitUntilReady() polls /health while waiting for a synthesis
        # already in flight to finish, and a starved /health makes it give up
        # with "did you run docker compose up tts?" while the container is
        # actually fine, just busy — worse than a slow response, a wrong
        # diagnosis. Whisper's own /transcribe-stream uses the same pattern
        # for the same reason (services/whisper/main.py).
        loop = asyncio.get_running_loop()
        audio_bytes = await loop.run_in_executor(None, _synthesize_sync, text, voice, prosody)
        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        logger.error(f"❌ Synthesis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


@app.get("/")
async def root():
    return {"service": "Indic Parler-TTS Service", "model": MODEL_NAME, "status": "running"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
