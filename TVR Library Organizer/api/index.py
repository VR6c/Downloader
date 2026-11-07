"""
TVR Studio - web download server (Vercel Python function)

Wraps python/engine.py over HTTP for the PWA:
  GET  /api/status    engine / yt-dlp / FFmpeg availability
  POST /api/info      {url} -> media metadata (same shape as the desktop app's fetch-media-info)
  POST /api/download  DownloadConfig -> NDJSON stream of engine events, then the finished file as
                      base64 "chunk" lines, then the "complete" event. One request does the whole job
                      because Vercel instances don't share /tmp between requests.
"""

import base64
import functools
import json
import os
import queue
import re
import shutil
import sys
import tempfile
import threading
import time
import uuid
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))
import engine  # noqa: E402

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("TVR_ALLOWED_ORIGINS", "*").split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Downloads per client IP per hour. Kept in memory, so it is per warm instance, not global.
RATE_LIMIT_PER_HOUR = int(os.environ.get("TVR_RATE_LIMIT_PER_HOUR", "30"))
CHUNK_BYTES = 512 * 1024
HEARTBEAT_SECONDS = 10

MEDIA_URL = re.compile(
    r"^(https?://)?(www\.|m\.|music\.|on\.)?(youtube\.com|youtu\.be|soundcloud\.com)/.+$",
    re.IGNORECASE,
)

MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
}

_hits = defaultdict(deque)
_hits_lock = threading.Lock()


def rate_limited(request: Request) -> bool:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    now = time.time()
    with _hits_lock:
        hits = _hits[ip]
        while hits and now - hits[0] > 3600:
            hits.popleft()
        if len(hits) >= RATE_LIMIT_PER_HOUR:
            return True
        hits.append(now)
        return False


@functools.lru_cache(maxsize=1)
def ffmpeg_dir() -> str:
    """yt-dlp looks for a binary named "ffmpeg", so expose imageio-ffmpeg's bundled build under that name in /tmp."""
    import imageio_ffmpeg

    exe = imageio_ffmpeg.get_ffmpeg_exe()
    target_dir = os.path.join(tempfile.gettempdir(), "tvr-ffmpeg")
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, "ffmpeg")
    if not os.path.exists(target):
        if os.access(exe, os.X_OK):
            os.symlink(exe, target)
        else:
            # The function bundle can lose the executable bit; /tmp is the only writable place to restore it
            shutil.copyfile(exe, target)
            os.chmod(target, 0o755)
    return target_dir


def run_engine(fn, *args) -> "queue.Queue[dict]":
    """Runs an engine function on a worker thread and returns the queue its events arrive on (None = done)."""
    events: "queue.Queue[dict]" = queue.Queue()

    def worker():
        try:
            fn(*args, callback=events.put)
        except Exception as e:  # engine functions report their own errors; this is a last resort
            events.put({"type": "error", "error_code": "ERR_SERVER", "details": str(e)})
        finally:
            events.put(None)

    threading.Thread(target=worker, daemon=True).start()
    return events


def line(data: dict) -> bytes:
    return (json.dumps(data, ensure_ascii=False) + "\n").encode("utf-8")


@app.get("/api/status")
def status():
    try:
        ff = ffmpeg_dir()
    except Exception:
        ff = None
    return {
        "ready": engine.YTDLP_AVAILABLE,
        "ytdlp_version": engine.YTDLP_VERSION_STR,
        "python_version": sys.version.split()[0],
        "ffmpeg_available": bool(ff),
        "ffmpeg_path": "server",
    }


@app.post("/api/info")
async def info(request: Request):
    body = await request.json()
    url = str(body.get("url") or "").strip()
    if not MEDIA_URL.match(url):
        return {"success": False, "error_code": "ERR_INVALID_URL", "message": "Invalid YouTube or SoundCloud URL provided."}

    return await run_in_threadpool(fetch_info, url)


def fetch_info(url: str) -> dict:
    events = run_engine(engine.fetch_info, url, ffmpeg_dir())
    while (msg := events.get()) is not None:
        if msg.get("type") == "info":
            return {"success": True, "data": msg["data"]}
        if msg.get("type") == "error":
            return {"success": False, "error_code": msg.get("error_code"), "message": msg.get("details")}
    return {"success": False, "error_code": "ERR_FETCH_FAILED", "message": "Failed to fetch video details."}


@app.post("/api/download")
async def download(request: Request):
    body = await request.json()
    url = str(body.get("url") or "").strip()
    if not MEDIA_URL.match(url):
        return JSONResponse(
            {"error_code": "ERR_INVALID_URL", "message": "Invalid YouTube or SoundCloud URL."}, status_code=400
        )
    if rate_limited(request):
        return JSONResponse(
            {"error_code": "ERR_RATE_LIMIT", "message": "Too many downloads. Please try again later."}, status_code=429
        )

    download_id = str(body.get("id") or uuid.uuid4())
    work_dir = tempfile.mkdtemp(prefix="tvr-dl-")
    # Only media options come from the client; paths are always the server's own
    config = {
        "id": download_id,
        "url": url,
        "format": body.get("format") or "mp3",
        "quality": body.get("quality") or "320",
        "embed_thumbnail": body.get("embed_thumbnail") is not False,
        "embed_metadata": body.get("embed_metadata") is not False,
        "include_id": bool(body.get("include_id")),
        "filename": body.get("filename") if isinstance(body.get("filename"), str) else "",
        "output_dir": work_dir,
        "ffmpeg_path": ffmpeg_dir(),
    }

    def stream():
        events = run_engine(engine.execute_download, config)
        finished = False
        try:
            while True:
                try:
                    msg = events.get(timeout=HEARTBEAT_SECONDS)
                except queue.Empty:
                    yield line({"type": "ping"})
                    continue
                if msg is None:
                    break
                if msg.get("type") != "complete":
                    yield line(msg)
                    continue

                path = msg.get("file_path") or ""
                filename = os.path.basename(path)
                yield line({
                    "type": "file",
                    "filename": filename,
                    "filesize": os.path.getsize(path),
                    "mime": MIME_TYPES.get(os.path.splitext(filename)[1].lower(), "application/octet-stream"),
                })
                with open(path, "rb") as f:
                    while chunk := f.read(CHUNK_BYTES):
                        yield line({"type": "chunk", "data": base64.b64encode(chunk).decode("ascii")})
                # The browser saves the file under this name; the server copy is deleted below
                yield line({**msg, "file_path": filename, "output_path": filename, "filePath": filename})
            finished = True
        finally:
            if not finished:
                # Client disconnected (cancel, closed tab): stop yt-dlp at its next progress tick
                engine.abort_download_by_id(download_id)
            shutil.rmtree(work_dir, ignore_errors=True)

    return StreamingResponse(stream(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})
