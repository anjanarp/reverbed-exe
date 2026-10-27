# reverbed.exe

*itch your brain again.*

A Y2K-style music player that turns any song into its slowed + reverb (or nightcore) version, right in your browser. Built as a love letter to undergrad.

## What it does

- **Import** a YouTube link or upload an audio/video file
- **Transform** it with one slider from slowed + reverb to nightcore, plus fine controls for speed, pitch, reverb, bass boost, EQ and stereo width
- **Loop** any section by dragging on the waveform
- **Ambience**: layer light rain, ocean waves or distant thunder underneath
- **Presets** and **history** for the session (nothing is saved once you close the tab)
- **Export** the full track or just the loop as MP3 or WAV, with the effects baked in
- **Save to Spotify**: on Chrome/Edge, save straight into a folder Spotify watches so it shows up in Local Files (and syncs to your phone)
- A spinning now-playing disc, live visualizer, retro taskbar and optional film grain

## How it's built

| part | tech |
|---|---|
| frontend | React + Vite, Tone.js (audio effects), wavesurfer.js (waveform), lamejs (in-browser MP3) |
| backend | FastAPI + yt-dlp + ffmpeg, on Cloud Run |
| hosting | Firebase Hosting (frontend), Cloud Run (backend) |

All the audio processing and exporting happens in the browser. The backend only fetches and converts tracks, and deletes them when the tab closes.

## Access

The live site is friends-only and locked behind an access code. Want to try it? Email me.

## Running it locally

```bash
# backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
REVERBED_ACCESS_CODE=pick-any-code .venv/bin/python -m uvicorn main:app --reload --port 8000

# frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and enter the code you picked. Requires `ffmpeg` on your machine.

## Deploying

See [DEPLOY-NOTES.md](DEPLOY-NOTES.md) for the backend settings and the cost caps.
