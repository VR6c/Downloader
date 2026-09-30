FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered streaming
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies: FFmpeg, curl, and SSL certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY "TVR Library Organizer/python/requirements.txt" ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python backend and engine
COPY "TVR Library Organizer/python" ./python

WORKDIR /app/python

ENV PORT=8000
EXPOSE 8000

# Run FastAPI backend via Uvicorn on dynamic Railway $PORT
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
