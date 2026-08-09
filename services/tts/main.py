from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
# docs/specs/2026-08-08-learning-module-design.md, which specifically names
# this model as the one with a verified-real near-perfect Sanskrit score
# (99.79% NSS). Unlike WhisperModel's size tiers, there is no smaller/larger
# variant to make configurable, so unlike WHISPER_MODEL, this is not an
# env var.
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


@app.get("/health")
async def health_check():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "healthy", "model": MODEL_NAME}


@app.post("/synthesize")
async def synthesize(request: SynthesizeRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text must be non-empty")

    voice = request.voice or DEFAULT_VOICE
    prosody = request.prosody or "clear and measured"
    # Parler-TTS's voice control is a natural-language description of the
    # SPEAKER AND RECORDING, not a set of parameters — this is not a
    # simplification, it is the actual interface the model was trained
    # against. `prosody` here is already a natural-language description
    # (see SpeechClient.ts's DEFAULT_PROSODY), so it slots directly in
    # rather than needing translation into some other format.
    description = f"{voice}'s voice is {prosody}, in a close-up recording."

    try:
        description_inputs = description_tokenizer(description, return_tensors="pt").to(DEVICE)
        prompt_inputs = tokenizer(text, return_tensors="pt").to(DEVICE)

        generation = model.generate(
            input_ids=description_inputs.input_ids,
            attention_mask=description_inputs.attention_mask,
            prompt_input_ids=prompt_inputs.input_ids,
            prompt_attention_mask=prompt_inputs.attention_mask,
        )
        audio_arr = generation.cpu().numpy().squeeze()

        import soundfile as sf

        buffer = io.BytesIO()
        # The model's own sampling rate, read at request time rather than
        # hardcoded — nothing here assumes a specific number.
        sf.write(buffer, audio_arr, model.config.sampling_rate, format="WAV")
        buffer.seek(0)
        return Response(content=buffer.read(), media_type="audio/wav")
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
