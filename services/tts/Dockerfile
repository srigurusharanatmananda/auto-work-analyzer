# No --platform pin, same reasoning as services/whisper/Dockerfile: on
# Apple Silicon that pin forces emulated x86, and this is pure compute.
# torch ships arm64 wheels, so native works.
FROM python:3.11-slim

WORKDIR /app

# git: requirements.txt installs parler-tts from a pinned GitHub commit, not
# a PyPI release — there isn't one. gcc: some transformers/torch transitive
# deps still build a C extension on install. libsndfile1: the actual native
# library `soundfile` (both this file's own use of it, and audiotools'
# transitively) is a ctypes wrapper around — python:3.11-slim has neither it
# nor a C compiler by default, and failed at import time with "libsndfile.so:
# cannot open shared object file" without it.
RUN apt-get update && apt-get install -y \
    git \
    gcc \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# torch AND torchaudio installed FIRST, from PyTorch's own CPU-only index
# rather than PyPI's default: the default Linux wheels bundle/link against
# CUDA runtime libraries and try to load them even on a CPU-only container
# with no GPU. torch alone was not enough — torchaudio is a TRANSITIVE
# dependency (parler-tts -> descript-audiotools -> dac -> torchaudio, none
# of them in requirements.txt directly), so pip installs whatever wheel the
# default index resolves for it in the next step unless it is already
# satisfied here first. Found by the container actually failing at import
# time with "libcudart.so.13: cannot open shared object file" from inside
# torchaudio's own compiled extension, not assumed in advance.
RUN pip install --no-cache-dir torch==2.3.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

RUN mkdir -p /app/models

EXPOSE 8001

ENV PYTHONUNBUFFERED=1
ENV DEVICE=cpu
# Hugging Face's own cache, redirected onto the mounted volume — otherwise
# every container recreation re-downloads the model from scratch.
ENV HF_HOME=/app/models

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
