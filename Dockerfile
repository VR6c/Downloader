FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies: FFmpeg, curl, and SSL certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies using JSON syntax for paths with spaces
COPY ["TVR Library Organizer/python/requirements.txt", "./requirements.txt"]
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python backend code and engine
COPY ["TVR Library Organizer/python", "./python"]

WORKDIR /app/python

ENV PORT=8000
EXPOSE 8000

# Start FastAPI server on dynamic $PORT
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
