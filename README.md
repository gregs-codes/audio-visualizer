# Audio Visualizer

## Server‑side rendering service

This repo includes a minimal render server that launches a headless browser, loads the app, and records a WebM export. It exposes a single endpoint:

- POST `/render` (multipart/form-data)
	- `file`: required, the audio file
	- optional fields: `aspect` (`16:9`|`9:16`), `res` (`360`|`480`|`720`|`1080`), `fps` (`24`|`30`|`60`), `codec` (`vp9`|`vp8`), `vBitrate` (kbps), `aBitrate` (kbps)

### Run locally

In one terminal, run the app (Vite dev server):

```bash
npm run dev
```

In another terminal, start the render server (optionally point to your app URL with `APP_URL`):

```bash
APP_URL=http://localhost:5174/ npm run server
```

Then POST an audio file (example with curl):

```bash
curl -fS -X POST \
	-F "file=@/path/to/song.mp3" \
	-F aspect=16:9 -F res=720 -F fps=30 -F codec=vp9 -F vBitrate=8000 -F aBitrate=192 \
	http://localhost:9090/render -o visualizer.webm
```

The server encodes the posted audio as a data URL and navigates the app with `?autoExport=1&audio=<dataurl>&…`. The app records the export canvas and returns the resulting WebM.

Notes:
- By default, it targets `http://localhost:5173`. If Vite chose another port, set `APP_URL` to that URL.
- For production, host the built app and set `APP_URL` to the public URL (e.g., `APP_URL=https://your-host/app/`).

# Audio Visualizer (React + Vite)

Interactive audio visualizer that accepts WAV/MP3 files and renders 1/2/4-section layouts. Supports recording the canvas with audio to a WebM video you can download on demand.

## Features

- Upload local audio files (WAV/MP3)
- Layouts: 1, 2-horizontal, 2-vertical, 4 panels
- Modes: Bars, Wave, Circle (per panel currently shared)
- Themes: Dark, Light, Neon with accent color picker
- Play/Pause controls
- Record canvas + audio as WebM (VP8/VP9 + Opus) and download

## How to run

Requires Node.js 20.19+ (or 22.12+). If you're on an older Node, use `nvm` to upgrade.

```bash
# macOS with zsh
brew install nvm # if you don't have it
nvm install 20
nvm use 20

npm install
npm run dev
```

Open the local server URL printed by Vite, upload an audio file, and hit Play. Use Start Recording to capture the visualization with audio, then Stop & Download to save a `.webm`.

## Browser support

- Recording relies on `MediaRecorder` and `HTMLCanvasElement.captureStream`. These are supported in Chromium-based browsers. Safari may not support WebM/MediaRecorder.
- If recording is unsupported, you can still preview visuals.

## Notes

- Audio autoplay may be blocked until you press Play.
- The recording includes the raw audio from your file (not system audio).
- Per-panel mode/color configuration can be added as a next step.

## Tech

- React 18 + TypeScript
- Vite 7
- Web Audio API (AnalyserNode)
- MediaRecorder API for exporting video
