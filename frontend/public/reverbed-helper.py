#!/usr/bin/env python3
"""
reverbed helper

YouTube blocks cloud servers, so reverbed.exe imports YouTube links through
your own computer instead. This script is that bridge. It:

  - only listens on your own computer (127.0.0.1), nothing else can reach it
  - only answers the reverbed.exe website
  - only downloads the audio of YouTube links you paste into reverbed
    (15 minutes max), hands it to your browser, then deletes it
  - uses no YouTube account, no cookies, no passwords
  - stops when you close this window (or press Ctrl+C)

The first run sets itself up in ~/.reverbed-helper (about a minute).
To remove it completely, delete that folder and this file.

Run it with:   python3 reverbed-helper.py      (Windows: py reverbed-helper.py)
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import venv
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlparse

PORT = 47321
VERSION = 1

ALLOWED_ORIGINS = {
    "https://reverbed-exe.web.app",
    "https://reverbed-exe.firebaseapp.com",
    "https://reverbed-exe.com",
    "https://www.reverbed-exe.com",
    "http://localhost:5173",
}

YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}
MAX_SECONDS = 15 * 60

HOME = Path(os.environ.get("REVERBED_HELPER_HOME", Path.home() / ".reverbed-helper"))
VENV_DIR = HOME / "venv"
YT_DLP = "yt-dlp[default,deno]==2026.8.19"


def venv_python():
    return VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


# written after a successful setup, so a half-finished first run gets redone
READY_MARKER = HOME / "ready-v2"


def build_environment():
    shutil.rmtree(VENV_DIR, ignore_errors=True)
    HOME.mkdir(parents=True, exist_ok=True)

    pip_quiet = ["--quiet", "--disable-pip-version-check"]

    if sys.version_info >= (3, 10):
        venv.create(VENV_DIR, with_pip=True)
        subprocess.run([str(venv_python()), "-m", "pip", "install", *pip_quiet, YT_DLP], check=True)
        return

    # this python is too old for current yt-dlp (common on Macs: Apple's 3.9),
    # so fetch a private modern python with uv instead of asking anyone to install one
    print("your python is a bit old, so the helper is grabbing its own newer one...")
    tools = HOME / "tools"
    venv.create(tools, with_pip=True)
    tools_python = tools / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    subprocess.run([str(tools_python), "-m", "pip", "install", *pip_quiet, "uv"], check=True)

    uv = [str(tools_python), "-m", "uv"]
    uv_env = dict(os.environ, UV_PYTHON_INSTALL_DIR=str(HOME / "python"))
    subprocess.run([*uv, "venv", "--quiet", "--python", "3.12", str(VENV_DIR)], check=True, env=uv_env)
    subprocess.run([*uv, "pip", "install", "--quiet", "--python", str(venv_python()), YT_DLP], check=True, env=uv_env)


def ensure_environment():
    """Install yt-dlp into a private folder once, then rerun this script inside it."""
    if os.environ.get("REVERBED_HELPER_CHILD") == "1":
        return

    if not (READY_MARKER.exists() and venv_python().exists()):
        print("first run: setting up the helper (about a minute)...")

        try:
            build_environment()
        except subprocess.CalledProcessError:
            print()
            print("  setup didn't finish (usually a wifi hiccup). run the same command again ♡")
            sys.exit(1)

        READY_MARKER.write_text(YT_DLP)

    env = dict(os.environ, REVERBED_HELPER_CHILD="1")

    try:
        sys.exit(subprocess.call([str(venv_python()), str(Path(__file__).resolve())], env=env))
    except KeyboardInterrupt:
        sys.exit(0)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # keep the window quiet; downloads print their own line
        pass

    def origin_allowed(self):
        return self.headers.get("Origin", "") in ALLOWED_ORIGINS

    def host_allowed(self):
        # blocks DNS rebinding tricks; only direct local requests get through
        host = self.headers.get("Host", "").split(":")[0]
        return host in {"127.0.0.1", "localhost"}

    def send_cors(self):
        if self.origin_allowed():
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Access-Control-Expose-Headers", "X-Title")
            self.send_header("Vary", "Origin")

    def reply_json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_GET(self):
        if not self.host_allowed():
            return self.reply_json(403, {"detail": "not allowed"})

        if self.path != "/health":
            return self.reply_json(404, {"detail": "not found"})

        self.reply_json(200, {"ok": True, "app": "reverbed-helper", "version": VERSION})

    def do_POST(self):
        if not (self.host_allowed() and self.origin_allowed()):
            return self.reply_json(403, {"detail": "not allowed"})

        if self.path != "/download":
            return self.reply_json(404, {"detail": "not found"})

        try:
            length = min(int(self.headers.get("Content-Length", "0")), 4096)
            url = json.loads(self.rfile.read(length))["url"]
        except (ValueError, KeyError, TypeError):
            return self.reply_json(400, {"detail": "that link didn't work"})

        if (urlparse(url).hostname or "").lower() not in YOUTUBE_HOSTS:
            return self.reply_json(400, {"detail": "only youtube links are supported"})

        import yt_dlp

        work_dir = Path(tempfile.mkdtemp(prefix="reverbed-"))

        options = {
            # m4a plays in every browser and needs no conversion
            "format": "bestaudio[ext=m4a]/bestaudio",
            "outtmpl": str(work_dir / "audio.%(ext)s"),
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
        }

        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                # check the length before downloading anything
                info = ydl.extract_info(url, download=False)

                if info.get("is_live"):
                    return self.reply_json(422, {"detail": "live streams aren't supported"})

                duration = info.get("duration")

                if not duration or duration > MAX_SECONDS:
                    return self.reply_json(422, {"detail": f"{MAX_SECONDS // 60} minute max"})

                title = info.get("title") or "untitled"
                print(f"  ↓ {title}")
                ydl.process_ie_result(info, download=True)

            audio = next(work_dir.glob("audio.*"))
            data = audio.read_bytes()

            self.send_response(200)
            self.send_cors()
            self.send_header("Content-Type", "audio/mp4" if audio.suffix == ".m4a" else "audio/webm")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-Title", quote(title))
            self.end_headers()
            self.wfile.write(data)
        except (yt_dlp.utils.DownloadError, StopIteration):
            self.reply_json(502, {"detail": "youtube didn't cooperate. try again or upload the file"})
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)


def main():
    ensure_environment()

    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        print("the helper is already running in another window ♡")
        return

    print()
    print("  reverbed helper is running ♡")
    print("  keep this window open while you import youtube links.")
    print("  close it (or press Ctrl+C) when you're done.")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  helper stopped. bye ♡")


if __name__ == "__main__":
    main()
