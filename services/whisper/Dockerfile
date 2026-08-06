# No --platform pin, unlike the reference Dockerfile, which pinned
# linux/amd64. On an Apple Silicon host that pin forces the whole container to
# run under QEMU x86 emulation, and Whisper is pure compute — emulated it is
# several times slower than native, which on a job already measured in minutes
# is the single largest avoidable cost in the pipeline. ctranslate2 (what
# faster-whisper runs on) ships arm64 wheels, so native works.
#
# Re-add a pin only if you need a reproducible x86 image for deployment, and
# then build it on an x86 machine rather than emulating here.
FROM python:3.11-slim

WORKDIR /app

# ffmpeg does the decoding; the dev headers are what PyAV needs to build.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    pkg-config \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Create directory for models
RUN mkdir -p /app/models

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV WHISPER_MODEL=base
ENV DEVICE=cpu
ENV COMPUTE_TYPE=int8

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
