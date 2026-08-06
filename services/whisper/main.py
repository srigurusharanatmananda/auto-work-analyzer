from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from faster_whisper import WhisperModel
import asyncio
import json
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Whisper Transcription Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Whisper model
MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
DEVICE = os.getenv("DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("COMPUTE_TYPE", "int8")

logger.info(f"Loading Whisper model: {MODEL_SIZE} on {DEVICE} with {COMPUTE_TYPE}")

try:
    model = WhisperModel(
        MODEL_SIZE,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        download_root="./models"
    )
    logger.info("✅ Whisper model loaded successfully")
except Exception as e:
    logger.error(f"❌ Failed to load Whisper model: {e}")
    model = None


class TranscriptionRequest(BaseModel):
    audio_path: str
    call_id: int
    language: str | None = None


class StreamingTranscriptionRequest(BaseModel):
    audio_path: str
    call_id: int
    language: str | None = None
    start_time_offset: float = 0.0


class SegmentResponse(BaseModel):
    text: str
    start: float
    end: float
    speaker: str | None = None


class TranscriptionResponse(BaseModel):
    callId: int
    fullText: str
    segments: list[SegmentResponse]
    language: str | None = None
    confidence: int | None = None


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "healthy", "model": MODEL_SIZE}


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(request: TranscriptionRequest):
    """
    Transcribe audio file using Whisper
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    logger.info(f"🎯 Starting transcription for call {request.call_id}")
    logger.info(f"Audio path: {request.audio_path}")

    # Check if file exists
    if not os.path.exists(request.audio_path):
        logger.error(f"❌ Audio file not found: {request.audio_path}")
        raise HTTPException(status_code=404, detail=f"Audio file not found: {request.audio_path}")

    try:
        # Transcribe audio
        segments_list, info = model.transcribe(
            request.audio_path,
            language=request.language,
            beam_size=5,
            vad_filter=True,  # Voice activity detection
            vad_parameters=dict(
                min_silence_duration_ms=500
            )
        )

        # Process segments
        full_text_parts = []
        processed_segments = []

        for segment in segments_list:
            full_text_parts.append(segment.text.strip())
            processed_segments.append(
                SegmentResponse(
                    text=segment.text.strip(),
                    start=segment.start,
                    end=segment.end,
                    speaker=None  # Will add speaker diarization later
                )
            )

        full_text = " ".join(full_text_parts)

        # Calculate average confidence (0-100)
        avg_confidence = None
        if hasattr(info, 'language_probability'):
            avg_confidence = int(info.language_probability * 100)

        logger.info(f"✅ Transcription completed for call {request.call_id}")
        logger.info(f"Language: {info.language}, Segments: {len(processed_segments)}")

        return TranscriptionResponse(
            callId=request.call_id,
            fullText=full_text,
            segments=processed_segments,
            language=info.language,
            confidence=avg_confidence
        )

    except Exception as e:
        logger.error(f"❌ Transcription failed for call {request.call_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/transcribe-stream")
async def transcribe_stream(request: StreamingTranscriptionRequest):
    """Transcribe audio, yielding NDJSON segments lazily as they are produced."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    if not os.path.exists(request.audio_path):
        logger.error(f"❌ Audio file not found: {request.audio_path}")
        raise HTTPException(status_code=404, detail=f"Audio file not found: {request.audio_path}")

    logger.info(f"🎯 Starting streaming transcription for call {request.call_id}")

    async def generate():
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        def run_transcription():
            try:
                segments_gen, info = model.transcribe(
                    request.audio_path,
                    language=request.language,
                    beam_size=5,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500),
                )
                for segment in segments_gen:
                    data = {
                        "text": segment.text.strip(),
                        "start": round(segment.start + request.start_time_offset, 3),
                        "end": round(segment.end + request.start_time_offset, 3),
                    }
                    loop.call_soon_threadsafe(queue.put_nowait, json.dumps(data) + "\n")

                lp = getattr(info, "language_probability", None)
                confidence = int(lp * 100) if lp is not None else None
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    json.dumps({"_done": True, "language": info.language, "confidence": confidence}) + "\n",
                )
                logger.info(f"✅ Streaming transcription complete for call {request.call_id}")
            except Exception as e:
                logger.error(f"❌ Streaming transcription error for call {request.call_id}: {e}")
                loop.call_soon_threadsafe(queue.put_nowait, json.dumps({"_error": str(e)}) + "\n")
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        future = loop.run_in_executor(None, run_transcription)

        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        except GeneratorExit:
            # Client disconnected — let the executor thread drain naturally
            logger.info(f"Client disconnected mid-stream for call {request.call_id}")
        finally:
            # Always await the future so the thread result is retrieved and no
            # "exception was never retrieved" warning leaks into stderr
            try:
                await asyncio.shield(future)
            except Exception:
                pass

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Whisper Transcription Service",
        "model": MODEL_SIZE,
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
