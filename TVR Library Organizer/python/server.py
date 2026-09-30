#!/usr/bin/env python3
"""
TVR Studio - FastAPI Backend Server
Provides full REST and SSE APIs for:
1. Media info extraction (YouTube & SoundCloud)
2. High-quality media downloads with real-time SSE progress streaming
3. Audio tag reading, editing, and Rekordbox metadata management (ID3v2.3)
4. Completed media file serving and streaming
5. Static SPA serving of the React frontend
"""

import os
import sys
import json
import time
import uuid
import shutil
import asyncio
import tempfile
from typing import Optional, Dict, Any, List
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response, BackgroundTasks, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Ensure current python directory is on path
CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Import engine functions (supports direct script run, package import, and IDE root)
try:
    from engine import (
        fetch_info,
        execute_download,
        find_ffmpeg,
        check_and_update_ytdlp,
        abort_download_by_id,
        YTDLP_AVAILABLE,
        YTDLP_VERSION_STR,
        format_bytes,
        format_seconds,
    )
except ImportError:
    try:
        from .engine import (  # type: ignore
            fetch_info,
            execute_download,
            find_ffmpeg,
            check_and_update_ytdlp,
            abort_download_by_id,
            YTDLP_AVAILABLE,
            YTDLP_VERSION_STR,
            format_bytes,
            format_seconds,
        )
    except (ImportError, ValueError):
        from python.engine import (  # type: ignore
            fetch_info,
            execute_download,
            find_ffmpeg,
            check_and_update_ytdlp,
            abort_download_by_id,
            YTDLP_AVAILABLE,
            YTDLP_VERSION_STR,
            format_bytes,
            format_seconds,
        )

# Mutagen for ID3 tagging
try:
    import mutagen
    from mutagen.easyid3 import EasyID3
    from mutagen.id3 import ID3, ID3NoHeaderError, TIT2, TPE1, TALB, TCON, TYER, TBPM, TKEY, COMM, APIC
    from mutagen.mp3 import MP3
    from mutagen.flac import FLAC
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False


app = FastAPI(
    title="TVR Studio API",
    description="High-performance Media Downloader & Rekordbox DJ Library Organizer API",
    version="2.0.0",
)

# Enable CORS for web development (Vite dev server, localhost, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage directories
DEFAULT_STORAGE_DIR = Path.home() / "Downloads" / "TVR Studio"
try:
    DEFAULT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    DEFAULT_STORAGE_DIR = Path(tempfile.gettempdir()) / "tvr_downloads"
    DEFAULT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# In-memory state tracking
active_downloads: Dict[str, Dict[str, Any]] = {}
download_history: List[Dict[str, Any]] = []
history_lock = asyncio.Lock()


# ─── Pydantic Request Models ──────────────────────────────────────────────────

class MediaInfoRequest(BaseModel):
    url: str
    ffmpeg_path: Optional[str] = None


class DownloadRequest(BaseModel):
    id: Optional[str] = None
    url: str
    format: str = "mp3"
    quality: str = "320"
    output_dir: Optional[str] = None
    ffmpeg_path: Optional[str] = None
    embed_thumbnail: bool = True
    embed_metadata: bool = True
    include_id: bool = False


class TagUpdateRequest(BaseModel):
    filePath: Optional[str] = None
    cleanArtist: Optional[str] = ""
    cleanTitle: Optional[str] = ""
    album: Optional[str] = ""
    genre: Optional[str] = ""
    year: Optional[str] = ""
    bpm: Optional[float] = None
    camelotKey: Optional[str] = None
    standardKey: Optional[str] = None
    comments: Optional[str] = ""


class BatchTagRequest(BaseModel):
    tracks: List[Dict[str, Any]]


class ExportPlaylistRequest(BaseModel):
    content: str
    defaultName: str
    extension: str


# ─── Helper Functions ─────────────────────────────────────────────────────────

def clean_old_downloads():
    """Optional housekeeping: keep memory list bounded."""
    global download_history
    if len(download_history) > 200:
        download_history = download_history[:200]


# ─── Diagnostic & Engine Endpoints ────────────────────────────────────────────

@app.get("/")
@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "app": "TVR Studio API",
        "version": "2.0.0",
        "timestamp": time.time(),
    }


@app.get("/api/engine/status")
@app.get("/api/downloader/status")
async def engine_status():
    ffmpeg_dir = find_ffmpeg()
    return {
        "ready": YTDLP_AVAILABLE,
        "ytdlp_available": YTDLP_AVAILABLE,
        "ytdlp_version": YTDLP_VERSION_STR,
        "ffmpeg_available": ffmpeg_dir is not None,
        "ffmpeg_path": ffmpeg_dir,
        "default_download_dir": str(DEFAULT_STORAGE_DIR),
        "mutagen_available": MUTAGEN_AVAILABLE,
    }


@app.post("/api/engine/update")
async def engine_update():
    """Run dynamic yt-dlp update."""
    loop = asyncio.get_running_loop()
    result = {}

    def cb(event):
        nonlocal result
        if event.get("type") in ("update", "error"):
            result = event

    await loop.run_in_executor(None, check_and_update_ytdlp)
    return result or {"status": "ok", "message": "Update process completed"}


# ─── Media Downloader Endpoints ───────────────────────────────────────────────

@app.post("/api/media/info")
@app.post("/api/downloader/info")
async def get_media_info(req: MediaInfoRequest):
    """Extract metadata (title, artist, duration, resolutions, thumbnail) from URL."""
    if not YTDLP_AVAILABLE:
        raise HTTPException(status_code=500, detail="yt-dlp is not available on this server.")

    loop = asyncio.get_running_loop()
    captured_result = {}

    def cb(event: Dict[str, Any]):
        nonlocal captured_result
        if event.get("type") in ("info", "error"):
            captured_result = event

    await loop.run_in_executor(None, lambda: fetch_info(req.url, req.ffmpeg_path, callback=cb))

    if captured_result.get("type") == "info":
        return {
            "success": True,
            "data": captured_result.get("data")
        }
    else:
        err_msg = captured_result.get("details") or "Failed to fetch media details."
        err_code = captured_result.get("error_code") or "ERR_INFO"
        return {
            "success": False,
            "error_code": err_code,
            "message": err_msg
        }


@app.post("/api/download/start")
@app.post("/api/downloader/start")
async def start_download_task(req: DownloadRequest, background_tasks: BackgroundTasks):
    """Start background download task and prepare real-time SSE stream."""
    download_id = req.id or f"dl_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
    out_dir = req.output_dir or str(DEFAULT_STORAGE_DIR)
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    config = {
        "id": download_id,
        "url": req.url,
        "format": req.format,
        "quality": req.quality,
        "output_dir": out_dir,
        "ffmpeg_path": req.ffmpeg_path,
        "embed_thumbnail": req.embed_thumbnail,
        "embed_metadata": req.embed_metadata,
        "include_id": req.include_id,
    }

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    active_downloads[download_id] = {
        "id": download_id,
        "config": config,
        "status": "starting",
        "queue": queue,
        "file_path": None,
        "filename": None,
        "created_at": time.time(),
    }

    def run_worker():
        def event_callback(ev: Dict[str, Any]):
            # Append download ID if not present
            if "id" not in ev:
                ev["id"] = download_id
            
            # Put event into async queue for SSE listeners
            loop.call_soon_threadsafe(queue.put_nowait, ev)

            # Update session state on key milestones
            if ev.get("type") == "complete":
                f_path = ev.get("file_path") or ev.get("output_path") or ev.get("filePath")
                f_name = ev.get("filename")
                if download_id in active_downloads:
                    active_downloads[download_id]["status"] = "completed"
                    active_downloads[download_id]["file_path"] = f_path
                    active_downloads[download_id]["filename"] = f_name
                
                # Add to history
                item = {
                    "id": download_id,
                    "url": req.url,
                    "title": ev.get("title") or f_name or "Downloaded Media",
                    "filename": f_name,
                    "filePath": f_path,
                    "file_path": f_path,
                    "downloadUrl": f"/api/download/file/{download_id}",
                    "format": req.format.upper(),
                    "quality": req.quality,
                    "fileSize": ev.get("filesize") or 0,
                    "timestamp": int(time.time() * 1000),
                }
                download_history.insert(0, item)
                clean_old_downloads()

            elif ev.get("type") in ("error", "aborted"):
                if download_id in active_downloads:
                    active_downloads[download_id]["status"] = ev.get("type")

        try:
            execute_download(config, callback=event_callback)
        except Exception as ex:
            err_ev = {
                "type": "error",
                "id": download_id,
                "error_code": "ERR_WORKER",
                "details": str(ex)
            }
            loop.call_soon_threadsafe(queue.put_nowait, err_ev)

    background_tasks.add_task(run_worker)

    return {
        "success": True,
        "downloadId": download_id,
        "streamUrl": f"/api/download/events/{download_id}",
        "message": "Download task queued"
    }


@app.get("/api/download/events/{download_id}")
@app.get("/api/downloader/events/{download_id}")
async def download_events_sse(download_id: str, request: Request):
    """Server-Sent Events (SSE) endpoint providing live 60 FPS progress updates."""
    if download_id not in active_downloads:
        raise HTTPException(status_code=404, detail="Download session not found")

    session = active_downloads[download_id]
    queue: asyncio.Queue = session["queue"]

    async def sse_stream():
        # Send initial status
        yield f"data: {json.dumps({'type': 'connected', 'id': download_id})}\n\n"
        
        while True:
            if await request.is_disconnected():
                break

            try:
                ev = await asyncio.wait_for(queue.get(), timeout=15.0)
                data_line = json.dumps(ev, ensure_ascii=False)
                yield f"data: {data_line}\n\n"

                # Terminal states: close SSE stream
                if ev.get("type") in ("complete", "error", "aborted"):
                    break
            except asyncio.TimeoutError:
                # Keep-alive heartbeat comment
                yield ": heartbeat\n\n"

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/api/download/cancel/{download_id}")
@app.post("/api/downloader/cancel/{download_id}")
async def cancel_download_task(download_id: str):
    """Cancel an ongoing download by ID."""
    abort_download_by_id(download_id)
    if download_id in active_downloads:
        active_downloads[download_id]["status"] = "aborted"
    return {"success": True, "downloadId": download_id, "message": "Cancellation signal dispatched"}


@app.get("/api/download/file/{download_id}")
@app.get("/api/downloader/file/{download_id}")
async def get_downloaded_file(download_id: str):
    """Download the completed media file to the user's browser."""
    try:
        # Check active downloads
        session = active_downloads.get(download_id)
        file_path = session.get("file_path") if session else None

        # Check history fallback
        if not file_path:
            for item in download_history:
                if item.get("id") == download_id:
                    file_path = item.get("filePath") or item.get("file_path")
                    break

        if not file_path or not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Requested media file not found or still processing.")

        filename = os.path.basename(file_path)
        ext = filename.split(".")[-1].lower() if "." in filename else "mp3"
        media_type = "audio/mpeg" if ext == "mp3" else ("video/mp4" if ext == "mp4" else "application/octet-stream")

        # Starlette FileResponse automatically formats RFC 5987 / RFC 6266 filename*=utf-8'' safely
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=filename,
        )
    except HTTPException:
        raise
    except Exception as ex:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(ex))


@app.get("/api/download/stream/{download_id}")
async def stream_media_preview(download_id: str):
    """Stream audio or video directly to browser audio elements for preview."""
    session = active_downloads.get(download_id)
    file_path = session.get("file_path") if session else None
    if not file_path:
        for item in download_history:
            if item.get("id") == download_id:
                file_path = item.get("filePath")
                break

    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Media file not found")

    ext = Path(file_path).suffix.lower()
    media_type = "audio/mpeg" if ext == ".mp3" else ("video/mp4" if ext == ".mp4" else "audio/wav")
    return FileResponse(file_path, media_type=media_type)


@app.get("/api/download/history")
async def get_history():
    """Return past download history."""
    return {"history": download_history}


@app.delete("/api/download/history")
async def clear_history():
    global download_history
    download_history.clear()
    return {"success": True}


# ─── Tag Editor & Metadata Management Endpoints ───────────────────────────────

@app.post("/api/tags/read")
async def read_audio_tags(
    file: Optional[UploadFile] = File(None),
    filePath: Optional[str] = Form(None)
):
    """Read ID3v2.3 tags and audio properties from uploaded file or local path."""
    if not MUTAGEN_AVAILABLE:
        raise HTTPException(status_code=500, detail="Mutagen library not installed for ID3 tagging")

    target_path = None
    temp_file = None

    try:
        if file:
            suffix = Path(file.filename or "track.mp3").suffix
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            shutil.copyfileobj(file.file, temp_file)
            temp_file.close()
            target_path = temp_file.name
            original_filename = file.filename or "track.mp3"
        elif filePath and os.path.isfile(filePath):
            target_path = filePath
            original_filename = os.path.basename(filePath)
        else:
            raise HTTPException(status_code=400, detail="Either an audio file upload or valid filePath is required")

        # Extract audio info
        audio = mutagen.File(target_path)
        meta = {
            "title": "",
            "artist": "",
            "album": "",
            "genre": "",
            "year": "",
            "bpm": None,
            "key": None,
            "bitrate": 320,
            "sampleRate": 44100,
            "duration": 0,
            "originalFileName": original_filename,
        }

        if audio is not None:
            if hasattr(audio, "info"):
                meta["duration"] = round(getattr(audio.info, "length", 0))
                meta["bitrate"] = int(round(getattr(audio.info, "bitrate", 320000) / 1000)) if getattr(audio.info, "bitrate", None) else 320
                meta["sampleRate"] = getattr(audio.info, "sample_rate", 44100)

            # MP3 ID3 Tags
            if isinstance(audio, MP3) or hasattr(audio, "tags"):
                tags = audio.tags or {}
                meta["title"] = str(tags.get("TIT2") or "")
                meta["artist"] = str(tags.get("TPE1") or "")
                meta["album"] = str(tags.get("TALB") or "")
                meta["genre"] = str(tags.get("TCON") or "")
                meta["year"] = str(tags.get("TYER") or tags.get("TDRC") or "")
                if "TBPM" in tags:
                    try:
                        meta["bpm"] = float(str(tags["TBPM"]))
                    except Exception:
                        pass
                if "TKEY" in tags:
                    meta["key"] = str(tags["TKEY"])

        return {"success": True, "metadata": meta}

    finally:
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.remove(temp_file.name)
            except Exception:
                pass


@app.post("/api/tags/save")
async def save_audio_tags(
    filePath: Optional[str] = Form(None),
    title: Optional[str] = Form(""),
    artist: Optional[str] = Form(""),
    album: Optional[str] = Form(""),
    genre: Optional[str] = Form(""),
    year: Optional[str] = Form(""),
    bpm: Optional[str] = Form(None),
    key: Optional[str] = Form(None),
    comments: Optional[str] = Form(""),
):
    """Write Pioneer Rekordbox compliant ID3v2.3 tags directly to audio file."""
    if not MUTAGEN_AVAILABLE:
        raise HTTPException(status_code=500, detail="Mutagen library not installed")

    if not filePath or not os.path.isfile(filePath):
        raise HTTPException(status_code=400, detail="Valid target filePath required")

    try:
        try:
            tags = ID3(filePath)
        except ID3NoHeaderError:
            tags = ID3()

        # Pioneer CDJ/Rekordbox ID3v2.3 compliant UTF-16 encoding
        if title:
            tags["TIT2"] = TIT2(encoding=1, text=title)
        if artist:
            tags["TPE1"] = TPE1(encoding=1, text=artist)
        if album:
            tags["TALB"] = TALB(encoding=1, text=album)
        if genre:
            tags["TCON"] = TCON(encoding=1, text=genre)
        if year:
            tags["TYER"] = TYER(encoding=1, text=year)
        if bpm:
            tags["TBPM"] = TBPM(encoding=1, text=str(bpm))
        if key:
            tags["TKEY"] = TKEY(encoding=1, text=str(key))
        if comments:
            tags["COMM"] = COMM(encoding=1, lang="eng", desc="", text=comments)

        tags.save(filePath, v2_version=3)
        return {"success": True, "filePath": filePath}

    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Failed to write ID3 tags: {ex}")


@app.post("/api/playlist/export")
async def export_playlist(req: ExportPlaylistRequest):
    """Generate downloadable Rekordbox XML or M3U8 playlist file."""
    filename = f"{req.defaultName}.{req.extension}"
    return Response(
        content=req.content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ─── Static Frontend Serving (Single Server Web Mode) ─────────────────────────

DIST_DIR = ROOT_DIR / "dist"
if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    if (DIST_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow API routes to pass through
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")

        target_file = DIST_DIR / full_path
        if target_file.is_file():
            return FileResponse(target_file)
        # Fallback to index.html for React SPA client routing
        return FileResponse(DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"⚡ Starting TVR Studio FastAPI Server on http://0.0.0.0:{port}")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
