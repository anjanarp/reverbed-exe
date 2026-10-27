from collections import defaultdict, deque
from pathlib import Path
from urllib.parse import urlparse
import hmac
import json
import os
import shutil
import subprocess
import threading
import time
import uuid

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import yt_dlp


# --- settings (all overridable with environment variables on Cloud Run) ---

# the friends-only passcode; the server refuses all work until it's set
ACCESS_CODE = os.environ.get("REVERBED_ACCESS_CODE", "")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

IMPORTS_PER_HOUR = int(os.environ.get("IMPORTS_PER_HOUR", "50"))
FAILED_CODES_PER_HOUR = int(os.environ.get("FAILED_CODES_PER_HOUR", "20"))
MAX_TRACK_SECONDS = int(os.environ.get("MAX_TRACK_MINUTES", "15")) * 60
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "50")) * 1024 * 1024

# backstop for tabs that close without saying goodbye; normally files are deleted on refresh
TRACK_TTL_SECONDS = int(os.environ.get("TRACK_TTL_MINUTES", "120")) * 60

YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


BASE_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = Path(os.environ.get("DOWNLOADS_DIR", BASE_DIR / "downloads"))

DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/downloads",
    StaticFiles(directory=DOWNLOADS_DIR),
    name="downloads"
)


# --- access + rate limits (in memory; fine with Cloud Run max instances = 1) ---

rate_lock = threading.Lock()
import_times = defaultdict(deque)
failed_code_times = defaultdict(deque)


def client_ip(request: Request):
    # Cloud Run puts the real client first in X-Forwarded-For
    forwarded = request.headers.get("x-forwarded-for")

    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.client.host if request.client else "unknown"


def hit_limit(log, key, limit):
    now = time.time()

    with rate_lock:
        times = log[key]

        while times and now - times[0] > 3600:
            times.popleft()

        if len(times) >= limit:
            return True

        times.append(now)
        return False


def code_matches(code):
    return bool(ACCESS_CODE) and hmac.compare_digest(
        (code or "").encode(), ACCESS_CODE.encode()
    )


def require_access(request: Request, code):
    if code_matches(code):
        return

    # count wrong guesses so the code can't be brute forced
    if hit_limit(failed_code_times, client_ip(request), FAILED_CODES_PER_HOUR):
        raise HTTPException(status_code=429, detail="too many wrong codes, try again later")

    raise HTTPException(status_code=401, detail="access code required")


def count_import(request: Request):
    if hit_limit(import_times, client_ip(request), IMPORTS_PER_HOUR):
        raise HTTPException(status_code=429, detail=f"{IMPORTS_PER_HOUR} imports per hour max")


# --- temporary track storage ---

# only files this server created are ever deleted, so anything else in the folder is safe
tracks_lock = threading.Lock()
track_created = {}


def register_track(track_id):
    with tracks_lock:
        track_created[track_id] = time.time()


def delete_track(track_id):
    with tracks_lock:
        if track_created.pop(track_id, None) is None:
            return

    for path in DOWNLOADS_DIR.glob(f"{track_id}*"):
        path.unlink(missing_ok=True)


def sweep_expired_tracks():
    while True:
        time.sleep(300)

        now = time.time()

        with tracks_lock:
            expired = [
                track_id
                for track_id, created in track_created.items()
                if now - created > TRACK_TTL_SECONDS
            ]

        for track_id in expired:
            delete_track(track_id)


threading.Thread(target=sweep_expired_tracks, daemon=True).start()


def convert_to_mp3(source_path, mp3_path):
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-vn",
            "-b:a",
            "192k",
            str(mp3_path),
        ],
        check=True,
        capture_output=True,
    )


def audio_seconds(path):
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
    )

    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


# --- routes ---

class DownloadRequest(BaseModel):
    url: str


@app.get("/")
def read_root():
    return {
        "message": "reverbed.exe backend is running"
    }


@app.post("/verify")
def verify_code(request: Request, x_access_code: str = Header(default="")):
    require_access(request, x_access_code)

    return {"ok": True}


@app.post("/download")
def download_audio(request: Request, body: DownloadRequest, x_access_code: str = Header(default="")):
    require_access(request, x_access_code)

    # only youtube, so the server can't be pointed at arbitrary sites or huge files
    if (urlparse(body.url).hostname or "").lower() not in YOUTUBE_HOSTS:
        raise HTTPException(status_code=400, detail="only youtube links are supported")

    count_import(request)

    track_id = str(uuid.uuid4())

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(DOWNLOADS_DIR / f"{track_id}-source.%(ext)s"),
        "quiet": True,
        "noplaylist": True,
        "max_filesize": MAX_UPLOAD_BYTES * 2,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # check the length before downloading anything
            info = ydl.extract_info(body.url, download=False)

            if info.get("is_live"):
                raise HTTPException(status_code=422, detail="live streams aren't supported")

            duration = info.get("duration")

            if not duration or duration > MAX_TRACK_SECONDS:
                raise HTTPException(status_code=422, detail=f"{MAX_TRACK_SECONDS // 60} minute max")

            register_track(track_id)
            ydl.download([body.url])
    except yt_dlp.utils.DownloadError:
        delete_track(track_id)
        raise HTTPException(status_code=502, detail="youtube download failed")

    downloaded_files = list(DOWNLOADS_DIR.glob(f"{track_id}-source.*"))

    if not downloaded_files:
        delete_track(track_id)
        raise HTTPException(status_code=502, detail="youtube download failed")

    source_path = downloaded_files[0]
    mp3_path = DOWNLOADS_DIR / f"{track_id}.mp3"

    convert_to_mp3(source_path, mp3_path)
    source_path.unlink(missing_ok=True)

    return {
        "track_id": track_id,
        "status": "downloaded",
        "title": info.get("title") or "untitled",
        "audio_url": f"/downloads/{mp3_path.name}",
    }


@app.post("/upload")
def upload_audio(request: Request, file: UploadFile = File(...), x_access_code: str = Header(default="")):
    require_access(request, x_access_code)
    count_import(request)

    track_id = str(uuid.uuid4())
    register_track(track_id)

    suffix = Path(file.filename or "").suffix[:10]
    # keep the original under its own name so ffmpeg never reads and writes the same file
    source_path = DOWNLOADS_DIR / f"{track_id}-source{suffix}"
    mp3_path = DOWNLOADS_DIR / f"{track_id}.mp3"

    written = 0

    with source_path.open("wb") as buffer:
        while chunk := file.file.read(1024 * 1024):
            written += len(chunk)

            if written > MAX_UPLOAD_BYTES:
                buffer.close()
                delete_track(track_id)
                raise HTTPException(status_code=413, detail=f"{MAX_UPLOAD_BYTES // (1024 * 1024)}MB max")

            buffer.write(chunk)

    duration = audio_seconds(source_path)

    if not duration or duration > MAX_TRACK_SECONDS:
        delete_track(track_id)
        raise HTTPException(status_code=422, detail=f"{MAX_TRACK_SECONDS // 60} minute max")

    try:
        convert_to_mp3(source_path, mp3_path)
    except subprocess.CalledProcessError:
        delete_track(track_id)
        raise HTTPException(status_code=422, detail="couldn't read that file")

    source_path.unlink(missing_ok=True)

    return {
        "track_id": track_id,
        "status": "uploaded",
        "title": Path(file.filename or "untitled").stem,
        "audio_url": f"/downloads/{mp3_path.name}",
    }


@app.post("/cleanup")
async def cleanup_tracks(request: Request):
    # sent with navigator.sendBeacon when a tab refreshes or closes, so the body is
    # plain text JSON and the code travels inside it instead of in a header
    try:
        payload = json.loads(await request.body())
    except ValueError:
        raise HTTPException(status_code=400, detail="bad cleanup request")

    require_access(request, payload.get("code"))

    for track_id in payload.get("track_ids", [])[:100]:
        try:
            delete_track(str(uuid.UUID(str(track_id))))
        except ValueError:
            continue

    return {"ok": True}
