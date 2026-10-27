# reverbed.exe backend for Cloud Run
FROM python:3.12-slim

# ffmpeg converts imports and uploads to mp3
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Cloud Run's disk lives in memory, so tracks go to /tmp and get deleted quickly
ENV DOWNLOADS_DIR=/tmp/reverbed-downloads

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
