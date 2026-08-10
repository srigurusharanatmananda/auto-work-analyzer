from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
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


def _synthesize_sync(text: str, voice: str, prosody: str) -> bytes:
    """The actual blocking work — tokenize, generate, encode to WAV. Runs off
    the event loop; see `synthesize()`'s executor call for why."""
    # Parler-TTS's voice control is a natural-language description of the
    # SPEAKER AND RECORDING, not a set of parameters — this is not a
    # simplification, it is the actual interface the model was trained
    # against. `prosody` here is already a natural-language description
    # (see SpeechClient.ts's DEFAULT_PROSODY), so it slots directly in
    # rather than needing translation into some other format.
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
    audio_arr = generation.cpu().numpy().squeeze()

    import soundfile as sf

    buffer = io.BytesIO()
    # The model's own sampling rate, read at request time rather than
    # hardcoded — nothing here assumes a specific number.
    sf.write(buffer, audio_arr, model.config.sampling_rate, format="WAV")
    buffer.seek(0)
    return buffer.read()


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
