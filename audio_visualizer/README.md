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
