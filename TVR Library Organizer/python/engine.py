#!/usr/bin/env python3
"""
TVR Downloader - Python Core Engine
Integrates yt-dlp and FFmpeg to provide:
1. URL metadata extraction (title, author, duration, thumbnail, formats)
2. High-quality media conversion (MP3 with ID3 tags & MP4 video muxing)
3. Real-time JSON IPC streaming over STDOUT
4. Safe cancellation with cleanup of temporary/part files
5. Dynamic yt-dlp update mechanism
"""

import sys
import os
import json
import re
import time
import signal
import shutil
import threading
import subprocess
import traceback
from typing import Optional, Dict, Any

# Ensure stdout uses UTF-8 and is line-buffered
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)

import ssl
try:
    _create_unverified_https_context = ssl._create_unverified_context
    ssl._create_default_https_context = _create_unverified_https_context
except Exception:
    pass

try:
    import certifi
    ca_bundle = certifi.where()
    os.environ['SSL_CERT_FILE'] = ca_bundle
    os.environ['REQUESTS_CA_BUNDLE'] = ca_bundle
except ImportError:
    pass

try:
    import yt_dlp
    from yt_dlp.utils import DownloadError, ExtractorError
    YTDLP_AVAILABLE = True
    YTDLP_VERSION = getattr(yt_dlp, 'version', None)
    if YTDLP_VERSION:
        YTDLP_VERSION_STR = getattr(YTDLP_VERSION, '__version__', 'unknown')
    else:
        YTDLP_VERSION_STR = 'unknown'
except ImportError as e:
    YTDLP_AVAILABLE = False
    YTDLP_VERSION_STR = 'not-installed'

# Global state for abort and cleanup
_abort_requested = False
_active_ydl = None
_download_dir = None
_tracked_filenames = set()
_lock = threading.Lock()
_aborted_download_ids = set()
_abort_lock = threading.Lock()
_thread_callbacks = threading.local()


def set_thread_callback(cb: Optional[Any]) -> None:
    _thread_callbacks.cb = cb


def get_thread_callback() -> Optional[Any]:
    return getattr(_thread_callbacks, "cb", None)


def abort_download_by_id(download_id: str) -> None:
    with _abort_lock:
        _aborted_download_ids.add(download_id)


def is_download_aborted(download_id: Optional[str] = None) -> bool:
    global _abort_requested
    if _abort_requested:
        return True
    if download_id:
        with _abort_lock:
            return download_id in _aborted_download_ids
    return False


class SilentLogger:
    """Discards default yt-dlp console logs so stdout contains strictly valid JSON lines."""
    def debug(self, msg):
        pass
    def info(self, msg):
        pass
    def warning(self, msg):
        pass
    def error(self, msg):
        pass

def emit(data: Dict[str, Any]) -> None:
    """Send structured JSON line to stdout for Electron IPC consumption and/or thread callback."""
    cb = get_thread_callback()
    if cb:
        try:
            cb(data)
        except Exception:
            pass
    try:
        line = json.dumps(data, ensure_ascii=False)
        sys.stdout.write(line + "\n")
        sys.stdout.flush()
    except Exception:
        pass


def emit_error(code: str, details: str, fatal: bool = False) -> None:
    """Emit a standardized error payload."""
    payload = {
        "type": "error",
        "error_code": code,
        "details": str(details),
        "fatal": fatal
    }
    emit(payload)


def emit_status(phase: str, message: str = "") -> None:
    """Emit phase/lifecycle status update."""
    emit({
        "type": "status",
        "phase": phase,
        "message": message
    })


def format_bytes(size: Optional[float]) -> str:
    """Convert bytes to human-readable string (KiB, MiB, GiB)."""
    if not size or size <= 0:
        return "0 B"
    units = ["B", "KiB", "MiB", "GiB", "TiB"]
    idx = 0
    val = float(size)
    while val >= 1024.0 and idx < len(units) - 1:
        val /= 1024.0
        idx += 1
    return f"{val:.1f} {units[idx]}"


def format_seconds(seconds: Optional[float]) -> str:
    """Convert seconds to MM:SS or HH:MM:SS format."""
    if seconds is None or seconds < 0:
        return "--:--"
    sec = int(round(seconds))
    hrs = sec // 3600
    mins = (sec % 3600) // 60
    secs = sec % 60
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


def cleanup_temp_files(target_dir: Optional[str] = None) -> None:
    """Safely cleans up any temporary or unfinished partial download files."""
    global _tracked_filenames, _download_dir
    folder = target_dir or _download_dir
    if not folder or not os.path.exists(folder):
        return

    # Look for files associated with current download and remove .part, .ytdl, etc.
    try:
        for fname in list(_tracked_filenames):
            base, _ = os.path.splitext(fname)
            for pattern in [fname, f"{fname}.part", f"{fname}.ytdl", f"{base}.part", f"{base}.ytdl", f"{base}.temp.*"]:
                if "*" in pattern:
                    import glob
                    for match in glob.glob(os.path.join(folder, pattern)):
                        try:
                            if os.path.isfile(match):
                                os.remove(match)
                        except Exception:
                            pass
                else:
                    path = os.path.join(folder, pattern)
                    if os.path.isfile(path):
                        try:
                            os.remove(path)
                        except Exception:
                            pass
        
        # Also clean orphaned .part files in the destination folder if created recently
        for f in os.listdir(folder):
            if f.endswith(".part") or f.endswith(".ytdl"):
                p = os.path.join(folder, f)
                try:
                    if os.path.isfile(p):
                        os.remove(p)
                except Exception:
                    pass
    except Exception:
        pass


def handle_abort_signal(sig=None, frame=None) -> None:
    """Handle process termination signal."""
    global _abort_requested, _active_ydl
    _abort_requested = True
    emit({"type": "aborted", "reason": "Process cancelled by signal"})
    cleanup_temp_files()
    sys.exit(0)


signal.signal(signal.SIGINT, handle_abort_signal)
signal.signal(signal.SIGTERM, handle_abort_signal)


class AbortDownloadException(Exception):
    """Raised when a download is aborted by user."""
    pass


def find_ffmpeg(custom_path: Optional[str] = None) -> Optional[str]:
    """Locate ffmpeg binary in custom path, workspace bin, or system PATH."""
    candidates = []
    if custom_path:
        candidates.append(custom_path)
        candidates.append(os.path.join(custom_path, "ffmpeg"))
        candidates.append(os.path.join(custom_path, "ffmpeg.exe"))

    # Check relative bin folder (e.g. bin/<os>)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(script_dir, ".."))
    
    plat = sys.platform
    plat_dir = "mac" if plat == "darwin" else ("win" if plat.startswith("win") else "linux")
    bundled = os.path.join(root_dir, "bin", plat_dir)
    bundled_res = os.path.join(root_dir, "bin")

    candidates.extend([
        bundled,
        bundled_res,
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/usr/bin"
    ])

    for c in candidates:
        if not c:
            continue
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return os.path.dirname(c)
        if os.path.isdir(c):
            exe = os.path.join(c, "ffmpeg.exe" if sys.platform.startswith("win") else "ffmpeg")
            if os.path.isfile(exe) and (sys.platform.startswith("win") or os.access(exe, os.X_OK)):
                return c

    # System PATH lookup
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return os.path.dirname(system_ffmpeg)

    return None


def fetch_info(url: str, ffmpeg_dir: Optional[str] = None, callback: Optional[Any] = None) -> None:
    """Fetch video metadata without downloading media."""
    if callback:
        set_thread_callback(callback)
    if not YTDLP_AVAILABLE:
        emit_error("ERR_YTDLP_MISSING", "yt-dlp library is not installed in the environment.", fatal=True)
        if callback:
            set_thread_callback(None)
        return

    # Basic regex validation for YouTube and SoundCloud
    media_regex = re.compile(
        r'^(https?://)?(www\.|m\.|music\.|on\.)?(youtube\.com|youtu\.be|soundcloud\.com)/.+$',
        re.IGNORECASE
    )
    if not media_regex.match(url):
        emit_error("ERR_INVALID_URL", "The provided URL is not a recognized YouTube or SoundCloud link.")
        return

    is_soundcloud = bool(re.search(r'soundcloud\.com', url, re.IGNORECASE))
    platform = "soundcloud" if is_soundcloud else "youtube"

    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'no_color': True,
        'logger': SilentLogger(),
        'noprogress': True,
        'nocheckcertificate': True,
    }

    ff_loc = find_ffmpeg(ffmpeg_dir)
    if ff_loc:
        ydl_opts['ffmpeg_location'] = ff_loc

    server_label = "SoundCloud" if is_soundcloud else "YouTube"
    emit_status("fetching_metadata", f"Extracting {server_label} media metadata...")

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                emit_error("ERR_EXTRACTOR", "Failed to retrieve media information.")
                return

            # Extract highest quality thumbnail
            thumbnail_url = info.get("thumbnail")
            thumbnails = info.get("thumbnails", [])
            if thumbnails:
                # Sort by preference or width
                valid_thumbs = [t for t in thumbnails if t.get("url")]
                if valid_thumbs:
                    # Prefer max resolution or preference
                    best_thumb = max(
                        valid_thumbs,
                        key=lambda t: ((t.get("preference") or 0) * 100000) + ((t.get("height") or 0) * (t.get("width") or 0))
                    )
                    thumbnail_url = best_thumb.get("url") or thumbnail_url

            # Extract available resolutions for video
            formats = info.get("formats", [])
            available_resolutions = set()
            for f in formats:
                h = f.get("height")
                vcodec = f.get("vcodec")
                if h and vcodec and vcodec != 'none':
                    available_resolutions.add(int(h))

            is_audio_only = is_soundcloud or (len(available_resolutions) == 0)

            detected_resolutions = []
            if not is_audio_only:
                # Standard resolution ladder
                standard_ladders = [2160, 1440, 1080, 720, 480, 360]
                for res in standard_ladders:
                    if any(r >= res for r in available_resolutions):
                        label = f"{res}p"
                        if res == 2160:
                            label = "4K (2160p)"
                        elif res == 1440:
                            label = "2K (1440p)"
                        elif res == 1080:
                            label = "Full HD (1080p)"
                        elif res == 720:
                            label = "HD (720p)"
                        detected_resolutions.append({
                            "height": res,
                            "label": label,
                            "available": True
                        })

                # If no standard resolution matched or fallback
                if not detected_resolutions:
                    detected_resolutions = [
                        {"height": 1080, "label": "Full HD (1080p)", "available": True},
                        {"height": 720, "label": "HD (720p)", "available": True},
                        {"height": 480, "label": "SD (480p)", "available": True}
                    ]

            duration = info.get("duration") or 0
            duration_str = format_seconds(duration)

            payload = {
                "type": "info",
                "data": {
                    "id": info.get("id"),
                    "title": info.get("title") or "Unknown Title",
                    "channel": info.get("uploader") or info.get("artist") or info.get("channel") or "Unknown Channel",
                    "channel_url": info.get("uploader_url") or info.get("channel_url"),
                    "duration": duration,
                    "duration_formatted": duration_str,
                    "thumbnail": thumbnail_url,
                    "view_count": info.get("view_count") or info.get("playback_count"),
                    "upload_date": info.get("upload_date"),
                    "description": (info.get("description") or "")[:250],
                    "webpage_url": info.get("webpage_url") or url,
                    "resolutions": detected_resolutions,
                    "has_subtitles": bool(info.get("subtitles") or info.get("automatic_captions")),
                    "platform": platform,
                    "is_audio_only": is_audio_only
                }
            }
            emit(payload)

    except DownloadError as e:
        msg = str(e)
        code = "ERR_DOWNLOAD"
        if "Private video" in msg:
            code = "ERR_PRIVATE_VIDEO"
        elif "Sign in to confirm your age" in msg or "age" in msg.lower():
            code = "ERR_AGE_RESTRICTED"
        elif "Geo-restricted" in msg or "country" in msg.lower():
            code = "ERR_GEO_BLOCKED"
        elif "Video unavailable" in msg:
            code = "ERR_VIDEO_UNAVAILABLE"
        emit_error(code, msg)
    except Exception as e:
        emit_error("ERR_UNKNOWN", str(e))
    finally:
        if callback:
            set_thread_callback(None)


def execute_download(config: Dict[str, Any], callback: Optional[Any] = None) -> None:
    """Download and convert media according to configuration."""
    if callback:
        set_thread_callback(callback)
    global _abort_requested, _active_ydl, _download_dir, _tracked_filenames

    if not YTDLP_AVAILABLE:
        emit_error("ERR_YTDLP_MISSING", "yt-dlp is not available.", fatal=True)
        if callback:
            set_thread_callback(None)
        return

    url = config.get("url")
    media_format = (config.get("format") or "mp4").lower()
    quality = str(config.get("quality") or "best").lower()
    output_dir = config.get("output_dir") or os.path.expanduser("~/Downloads")
    ffmpeg_dir = config.get("ffmpeg_path")
    embed_thumbnail = config.get("embed_thumbnail", True)
    embed_metadata = config.get("embed_metadata", True)
    dl_id = config.get("id")

    is_soundcloud = bool(re.search(r'soundcloud\.com', url or '', re.IGNORECASE))
    if is_soundcloud and media_format not in ("mp3", "m4a", "wav", "flac"):
        media_format = "mp3"

    if not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir, exist_ok=True)
        except Exception as e:
            emit_error("ERR_FS", f"Cannot create output directory: {e}")
            if callback:
                set_thread_callback(None)
            return

    _download_dir = output_dir
    _abort_requested = False
    _tracked_filenames.clear()

    # Progress hook callback
    last_emit_time = 0

    def progress_hook(d: Dict[str, Any]) -> None:
        nonlocal last_emit_time
        if is_download_aborted(dl_id):
            raise AbortDownloadException("Download aborted by user request.")

        status = d.get("status")
        filename = d.get("filename")
        if filename:
            with _lock:
                _tracked_filenames.add(os.path.basename(filename))

        if status == "downloading":
            now = time.time()
            # Throttle emission to max ~10 per second to keep Electron UI silky smooth at 60 FPS
            if now - last_emit_time < 0.1:
                return
            last_emit_time = now

            downloaded = d.get("downloaded_bytes") or 0
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            percent = 0.0
            if total > 0:
                percent = round((downloaded / total) * 100.0, 1)

            speed = d.get("speed")
            eta = d.get("eta")

            speed_str = f"{format_bytes(speed)}/s" if speed else "-- KiB/s"
            eta_str = format_seconds(eta) if eta is not None else "--:--"

            emit({
                "type": "progress",
                "percentage": percent,
                "downloaded_bytes": downloaded,
                "downloaded_str": format_bytes(downloaded),
                "total_bytes": total,
                "total_str": format_bytes(total),
                "speed": speed or 0,
                "speed_str": speed_str,
                "eta": eta if eta is not None else -1,
                "eta_str": eta_str,
                "filename": os.path.basename(filename) if filename else ""
            })

        elif status == "finished":
            emit_status("converting", "Download complete. Processing media with FFmpeg...")

    # Postprocessor hook callback
    def postprocessor_hook(d: Dict[str, Any]) -> None:
        if is_download_aborted(dl_id):
            raise AbortDownloadException("Aborted during postprocessing.")

        pp = d.get("postprocessor")
        status = d.get("status")
        if status == "started":
            if pp == "ExtractAudio":
                emit_status("transcoding", "Extracting and encoding audio stream to MP3...")
            elif pp == "FFmpegVideoConvertor" or pp == "FFmpegMerger":
                emit_status("muxing", "Multiplexing video and audio streams into MP4...")
            elif pp == "EmbedThumbnail":
                emit_status("embedding_cover", "Embedding album artwork...")
            elif pp == "FFmpegMetadata":
                emit_status("embedding_metadata", "Writing ID3 metadata tags...")

    ff_loc = find_ffmpeg(ffmpeg_dir)
    if not ff_loc:
        emit_error("ERR_FFMPEG_MISSING", "FFmpeg could not be located. High-quality conversion requires FFmpeg.")
        return

    # Build format string and postprocessors based on format selection
    # IEEE & SRS Requirement FR-BE-02
    postprocessors = []

    if media_format == "mp3":
        # Target bitrate
        bitrate_map = {
            "best": "320",
            "320": "320",
            "320k": "320",
            "320 kbps": "320",
            "256": "256",
            "256k": "256",
            "256 kbps": "256",
            "192": "192",
            "192k": "192",
            "192 kbps": "192",
            "128": "128",
            "128k": "128",
            "128 kbps": "128",
        }
        audio_quality = bitrate_map.get(quality, "320")

        # Select highest quality audio stream available
        format_spec = "bestaudio/best"

        postprocessors.append({
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': audio_quality,
            'nopostoverwrites': False,
        })

        if embed_metadata:
            postprocessors.append({'key': 'FFmpegMetadata'})

        if embed_thumbnail:
            # Convert thumbnail to JPEG so mutagen/FFmpeg embeds it cleanly into ID3 tags
            postprocessors.append({'key': 'FFmpegThumbnailsConvertor', 'format': 'jpg'})
            postprocessors.append({'key': 'EmbedThumbnail', 'already_have_thumbnail': False})

    elif media_format == "mov":
        # Apple QuickTime MOV video (H.264 + AAC in .mov container)
        res_height = None
        digits = re.findall(r'\d+', quality)
        if digits:
            res_height = int(digits[0])

        if res_height:
            format_spec = (
                f"bestvideo[height<={res_height}][ext=mp4]+bestaudio[ext=m4a]/"
                f"bestvideo[height<={res_height}]+bestaudio/"
                f"best[height<={res_height}]/best"
            )
        else:
            format_spec = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best"

        postprocessors.append({
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mov',
        })

        if embed_metadata:
            postprocessors.append({'key': 'FFmpegMetadata'})

    else:
        # MP4 video
        # Target resolution filter
        res_height = None
        digits = re.findall(r'\d+', quality)
        if digits:
            res_height = int(digits[0])

        if res_height:
            format_spec = (
                f"bestvideo[height<={res_height}][ext=mp4]+bestaudio[ext=m4a]/"
                f"bestvideo[height<={res_height}]+bestaudio/"
                f"best[height<={res_height}]/best"
            )
        else:
            format_spec = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best"

        if embed_metadata:
            postprocessors.append({'key': 'FFmpegMetadata'})

    include_id = config.get("include_id", False)
    if include_id:
        outtmpl = os.path.join(output_dir, "%(title)s [%(id)s].%(ext)s")
    else:
        outtmpl = os.path.join(output_dir, "%(title)s.%(ext)s")

    ydl_opts = {
        'format': format_spec,
        'outtmpl': outtmpl,
        'ffmpeg_location': ff_loc,
        'progress_hooks': [progress_hook],
        'postprocessor_hooks': [postprocessor_hook],
        'postprocessors': postprocessors,
        'writethumbnail': embed_thumbnail if media_format == "mp3" else False,
        'retries': 5,
        'fragment_retries': 5,
        'quiet': True,
        'no_warnings': True,
        'no_color': True,
        'overwrites': True,
        'logger': SilentLogger(),
        'noprogress': True,
        'nocheckcertificate': True,
    }

    if media_format == "mp4":
        ydl_opts['merge_output_format'] = 'mp4'

    server_label = "SoundCloud" if is_soundcloud else "YouTube"
    emit_status("starting", f"Connecting to {server_label} media server...")

    final_file = None
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            _active_ydl = ydl
            info = ydl.extract_info(url, download=True)
            
            # Locate output filepath
            if info:
                title = info.get("title") or "media"
                ext = "mp3" if media_format == "mp3" else ("mov" if media_format == "mov" else "mp4")
                
                # Check requested_downloads or prepare_filename
                expected = ydl.prepare_filename(info)
                base, _ = os.path.splitext(expected)
                if base.lower().endswith(f".{ext}"):
                    base = base[:-(len(ext) + 1)]
                target_final = f"{base}.{ext}"

                if os.path.isfile(target_final):
                    final_file = target_final
                elif os.path.isfile(expected):
                    final_file = expected
                else:
                    # Scan output directory for matching file
                    clean_title = re.sub(r'[\\/*?:"<>|]', '', title).strip() if title else "media"
                    for candidate in os.listdir(output_dir):
                        if candidate.endswith(f".{ext}"):
                            cand_base, _ = os.path.splitext(candidate)
                            if cand_base == clean_title or clean_title[:20] in cand_base or (info.get("id") and info.get("id") in cand_base):
                                final_file = os.path.join(output_dir, candidate)
                                break

        if final_file and os.path.isfile(final_file):
            size = os.path.getsize(final_file)
            abs_path = os.path.abspath(final_file)
            emit({
                "type": "complete",
                "output_path": abs_path,
                "file_path": abs_path,
                "filePath": abs_path,
                "filename": os.path.basename(final_file),
                "filesize": size,
                "filesize_str": format_bytes(size),
                "format": media_format.upper(),
                "title": info.get("title") if info else os.path.basename(final_file)
            })
        else:
            emit_error("ERR_OUTPUT_NOT_FOUND", "Conversion finished but output file could not be verified.")

    except AbortDownloadException:
        cleanup_temp_files(output_dir)
        emit({"type": "aborted", "reason": "User cancelled the download."})
    except DownloadError as e:
        cleanup_temp_files(output_dir)
        emit_error("ERR_DOWNLOAD", str(e))
    except Exception as e:
        cleanup_temp_files(output_dir)
        emit_error("ERR_PROCESSING", str(e))
    finally:
        _active_ydl = None
        if callback:
            set_thread_callback(None)


def check_and_update_ytdlp() -> None:
    """Check and update the yt-dlp package dynamically (FR-PK-02)."""
    emit_status("updating", "Checking for yt-dlp engine updates...")
    try:
        # Run pip upgrade on yt-dlp
        py_exe = sys.executable
        res = subprocess.run(
            [py_exe, "-m", "pip", "install", "--upgrade", "yt-dlp"],
            capture_output=True,
            text=True,
            timeout=60
        )
        if res.returncode == 0:
            # Re-read version
            ver_res = subprocess.run(
                [py_exe, "-c", "import yt_dlp; print(yt_dlp.version.__version__)"],
                capture_output=True,
                text=True,
                timeout=10
            )
            new_version = ver_res.stdout.strip() or YTDLP_VERSION_STR
            emit({
                "type": "update",
                "status": "success",
                "previous_version": YTDLP_VERSION_STR,
                "new_version": new_version,
                "message": f"Successfully updated yt-dlp engine to version {new_version}"
            })
        else:
            emit({
                "type": "update",
                "status": "error",
                "message": res.stderr.strip() or "Failed to run pip update"
            })
    except Exception as e:
        emit_error("ERR_UPDATE_FAILED", f"Engine update failed: {e}")


def stdin_reader_loop() -> None:
    """Background listener for commands pushed to STDIN during daemon/interactive mode."""
    global _abort_requested, _active_ydl
    for line in sys.stdin:
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
            action = cmd.get("action") or cmd.get("command")
            if action == "abort" or action == "cancel":
                _abort_requested = True
                emit({"type": "aborting", "message": "Abort request received"})
            elif action == "ping":
                emit({"type": "pong", "time": time.time()})
        except Exception:
            pass


def main():
    # Setup stdin background listener
    t = threading.Thread(target=stdin_reader_loop, daemon=True)
    t.start()

    # Emit initial handshake
    emit({
        "type": "init",
        "status": "ready",
        "ytdlp_version": YTDLP_VERSION_STR,
        "python_version": sys.version.split()[0],
        "ffmpeg_available": find_ffmpeg() is not None,
        "ffmpeg_path": find_ffmpeg()
    })

    if len(sys.argv) < 2:
        # Daemon / Stdin mode or simple exit
        # Wait for stdin input or keep running if piped
        if not sys.stdin.isatty():
            try:
                for line in sys.stdin:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        cmd = json.loads(line)
                        act = cmd.get("action")
                        if act == "info":
                            fetch_info(cmd.get("url"), cmd.get("ffmpeg_path"))
                        elif act == "download":
                            execute_download(cmd)
                        elif act == "update":
                            check_and_update_ytdlp()
                    except Exception as ex:
                        emit_error("ERR_STDIN_PARSE", str(ex))
            except (KeyboardInterrupt, SystemExit):
                pass
        return

    cmd = sys.argv[1].lower()

    if cmd in ("--version", "-v", "version"):
        # Handshake already sent
        return

    elif cmd == "info":
        if len(sys.argv) < 3:
            emit_error("ERR_ARG", "Usage: engine.py info <url> [ffmpeg_path]")
            return
        url = sys.argv[2]
        ff = sys.argv[3] if len(sys.argv) > 3 else None
        fetch_info(url, ff)

    elif cmd == "download":
        if len(sys.argv) < 3:
            emit_error("ERR_ARG", "Usage: engine.py download '<json_config>'")
            return
        try:
            cfg = json.loads(sys.argv[2])
            execute_download(cfg)
        except json.JSONDecodeError:
            emit_error("ERR_INVALID_JSON", "Argument to download must be a valid JSON string.")

    elif cmd == "update":
        check_and_update_ytdlp()

    else:
        emit_error("ERR_UNKNOWN_COMMAND", f"Unrecognized engine command: {cmd}")


if __name__ == "__main__":
    main()
