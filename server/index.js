import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { createJob, updateJob, getJob, listJobs, countJobs } from './db.js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 9090;
const TMP_DIR = path.join(os.tmpdir(), 'av-uploads');

const app = express();
app.use(express.json());
app.use(cors());

// --- Active render tracking (singleton: only one render at a time) ---
let activeBrowser = null;
let activeRenderAborted = false;
let activeJobId = null;

async function killActiveBrowser() {
  if (activeBrowser) {
    console.log('Killing previous render browser...');
    activeRenderAborted = true;
    if (activeJobId) { try { updateJob(activeJobId, { status: 'aborted' }); } catch {} }
    activeJobId = null;
    try { await activeBrowser.close(); } catch {}
    activeBrowser = null;
  }
}

// --- Live log broadcasting ---
const logClients = new Set();
const MAX_LOG_HISTORY = 500;
const logHistory = [];

function broadcastLog(level, ...args) {
  const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  const entry = { ts: Date.now(), level, text };
  logHistory.push(entry);
  if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();
  const data = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of logClients) {
    try { client.write(data); } catch { logClients.delete(client); }
  }
}

// Intercept console to broadcast
const origLog = console.log.bind(console);
const origErr = console.error.bind(console);
console.log = (...args) => { origLog(...args); broadcastLog('info', ...args); };
console.error = (...args) => { origErr(...args); broadcastLog('error', ...args); };

// SSE endpoint for live logs
app.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  // Send history
  for (const entry of logHistory) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }
  logClients.add(res);
  req.on('close', () => logClients.delete(res));
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, appUrl: process.env.APP_URL || 'http://localhost:5173/' });
});

// Serve uploaded files from tmp dir under /uploads
app.use('/uploads', async (req, res, next) => {
  try { await fs.mkdir(TMP_DIR, { recursive: true }); } catch {}
  next();
}, express.static(TMP_DIR));

// Simple health endpoint to verify server is reachable and configured
app.get('/health', (req, res) => {
  res.json({ ok: true, appUrl: process.env.APP_URL || 'http://localhost:5173/' });
});

function dataUrlFromBuffer(buf, mime){
  const base64 = Buffer.from(buf).toString('base64');
  return `data:${mime};base64,${base64}`;
}

// GET /rendered/list – return files in public/rendered/ sorted newest first
app.get('/rendered/list', async (req, res) => {
  try {
    const renderedDir = path.join(__dirname, '..', 'public', 'rendered');
    await fs.mkdir(renderedDir, { recursive: true });
    const entries = await fs.readdir(renderedDir);
    const files = [];
    for (const name of entries) {
      if (!name.endsWith('.webm') && !name.endsWith('.mp4')) continue;
      const stat = await fs.stat(path.join(renderedDir, name));
      files.push({ name, size: stat.size, date: stat.mtime.toISOString() });
    }
    files.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(files);
  } catch (e) {
    console.error(e);
    res.json([]);
  }
});

// Map of jobToken -> { resolve, reject, writeStream, filePath } for chunked uploads
const pendingUploads = new Map();

// POST /upload-render/:token/chunk — receive one raw MediaRecorder chunk, append to disk
app.post('/upload-render/:token/chunk', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  const token = req.params.token;
  const pending = pendingUploads.get(token);
  if (!pending) return res.status(404).json({ error: 'unknown token' });
  // Lazy-init write stream on first chunk
  if (!pending.writeStream) {
    await fs.mkdir(TMP_DIR, { recursive: true });
    pending.filePath = path.join(TMP_DIR, `render_${token}.webm`);
    pending.writeStream = fsSync.createWriteStream(pending.filePath);
    console.log(`[chunk] Opened write stream: ${pending.filePath}`);
  }
  await new Promise((resolve, reject) => {
    pending.writeStream.write(req.body, (err) => err ? reject(err) : resolve());
  });
  res.json({ ok: true });
});

// POST /upload-render/:token/finalize — all chunks received; close stream and unblock render handler
app.post('/upload-render/:token/finalize', express.json(), async (req, res) => {
  const token = req.params.token;
  const pending = pendingUploads.get(token);
  if (!pending) return res.status(404).json({ error: 'unknown token' });
  pendingUploads.delete(token);
  const trimStart = parseFloat(req.body?.trimStart || '0');
  if (pending.writeStream) {
    await new Promise((resolve) => pending.writeStream.end(resolve));
    console.log(`[chunk] Write stream closed: ${pending.filePath}`);
  }
  // Respond to browser before advancing server processing so the response arrives before browser.close()
  res.json({ ok: true });
  pending.resolve({ filePath: pending.filePath, trimStart });
});

// POST /render accepts multipart form: file (audio), bgImage (optional image), and other params
app.post('/render', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'bgImage', maxCount: 1 }
]), async (req, res) => {
  let jobId = null;
  try {
    if (!req.files || !req.files['file']) return res.status(400).json({ error: 'file is required' });

    // Kill any previous render before starting a new one
    await killActiveBrowser();
    activeRenderAborted = false;

    const {
      aspect = '16:9', res: resolution = '720', fps = '30', codec = 'vp9',
      // Default server output to MP4 for maximum compatibility
      vBitrate = '8000', aBitrate = '192', format = 'mp4', mode, theme, layout, panels,
      character, animations, dancerSize, dancerPos, showDancer,
      cameraMode, cameraElevationPct, cameraTiltDeg, cameraSpeed, cameraDistance,
      title, titlePos, titleColor, titleFloat, titleBounce, titlePulse,
      desc, descPos, descColor, descFloat, descBounce, descPulse,
      showCountdown, countPos, countColor, countFloat, countBounce, countPulse,
      bgMode, bgColor, bgImageUrl: bgImageUrlBody, bgFit, bgOpacity,
      color, showVU,
      introSecs, outroSecs,
      subtitleEnabled, subtitleCues, subtitlePos, subtitleColor, subtitleOffset, subtitleFontSize,
    } = req.body || {};

    // Record job in database and track as active
    jobId = createJob({
      audioName:  req.files['file'][0].originalname,
      format,
      resolution,
      fps,
      codec,
      mode,
      theme,
      layout,
      params: req.body,
    });
    console.log(`[db] Created render job #${jobId}`);
    activeJobId = jobId;

    // Create a one-time upload token so the headless browser can POST the video back directly
    const jobToken = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const uploadPromise = new Promise((resolve, reject) => {
      pendingUploads.set(jobToken, { resolve, reject, writeStream: null, filePath: null });
      // Auto-reject after 12 minutes to prevent memory leaks on hung renders
      setTimeout(() => {
        if (pendingUploads.has(jobToken)) {
          pendingUploads.delete(jobToken);
          reject(new Error('Upload from headless browser timed out after 12 minutes'));
        }
      }, 720_000);
    });

    // Launch headless browser with generous protocol timeout to avoid premature failures
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        // Use system GPU instead of SwiftShader to avoid WebGL context failures
        '--use-gl=angle',
        '--use-angle=metal',           // macOS: use Metal backend for ANGLE
        '--enable-gpu',
        '--ignore-gpu-blocklist',      // allow GPU even if it's on Chrome's blocklist
        '--disable-gpu-sandbox',
        '--enable-webgl',
        '--enable-webgl2',
        '--disable-software-rasterizer',
      ],
      protocolTimeout: 0,
    });
    const page = await browser.newPage();
    activeBrowser = browser; // Track for cleanup
    // Disable default timeouts to allow long renders
    page.setDefaultTimeout(0);
    page.setDefaultNavigationTimeout(0);

    // Pipe app logs to server stdout to aid debugging
    page.on('console', (msg) => {
      try { console.log('[page]', msg.type(), msg.text()); } catch {}
    });
    page.on('pageerror', (err) => {
      try { console.error('[pageerror]', err); } catch {}
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        try { console.log(`[page] HTTP ${response.status()} ${response.url()}`); } catch {}
      }
    });

    // Save subtitle cues to a temp file so Puppeteer can fetch them,
    // and also keep a JSON inline copy for robustness.
    let subtitleUrl = null;
    const subtitleCuesJson = subtitleCues ? (typeof subtitleCues === 'string' ? subtitleCues : JSON.stringify(subtitleCues)) : null;
    if (subtitleEnabled && subtitleCuesJson) {
      try {
        const subId = `${Date.now()}_${Math.random().toString(36).slice(2)}.json`;
        const subDir = path.join(os.tmpdir(), 'av-uploads');
        const subPath = path.join(subDir, subId);
        await fs.mkdir(subDir, { recursive: true });
        await fs.writeFile(subPath, subtitleCuesJson);
        const serverBase2 = process.env.SERVER_PUBLIC_URL || `http://localhost:${PORT}`;
        subtitleUrl = `${serverBase2}/uploads/${subId}`;
      } catch (e) { console.warn('[subtitle] Failed to save cues file:', e); }
    }

    // Build URL with autoExport and params; write upload to a short URL to avoid huge query strings
    const audioFile = req.files['file'][0];
    const audioMime = audioFile.mimetype || 'audio/mpeg';
    const ext = (audioMime.split('/')[1] || 'bin').split(';')[0];
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    await fs.mkdir(TMP_DIR, { recursive: true });
    const filePath = path.join(TMP_DIR, fileId);
    await fs.writeFile(filePath, audioFile.buffer);

    // Handle optional background image upload
    let bgImageUrl = bgImageUrlBody;
    if (req.files['bgImage'] && req.files['bgImage'][0]) {
      const imgFile = req.files['bgImage'][0];
      const imgExt = (imgFile.mimetype.split('/')[1] || 'png').split(';')[0];
      const imgId = `${Date.now()}_${Math.random().toString(36).slice(2)}.${imgExt}`;
      const imgPath = path.join(TMP_DIR, imgId);
      await fs.writeFile(imgPath, imgFile.buffer);
      const serverBase = process.env.SERVER_PUBLIC_URL || `http://localhost:${PORT}`;
      bgImageUrl = `${serverBase}/uploads/${imgId}`;
    }

    const base = process.env.APP_URL || 'http://localhost:5173/';
    const url = new URL(base);
    url.searchParams.set('autoExport', '1');
    const serverBase = process.env.SERVER_PUBLIC_URL || `http://localhost:${PORT}`;
    url.searchParams.set('audio', `${serverBase}/uploads/${fileId}`);
    url.searchParams.set('aspect', aspect);
    url.searchParams.set('res', resolution);
    url.searchParams.set('fps', String(fps));
    url.searchParams.set('codec', codec);
    url.searchParams.set('vBitrate', String(vBitrate));
    url.searchParams.set('aBitrate', String(aBitrate));
    if (mode) url.searchParams.set('mode', String(mode));
    if (layout) url.searchParams.set('layout', String(layout));
    if (panels) url.searchParams.set('panels', String(panels));
    if (theme) url.searchParams.set('theme', String(theme));
    if (character) url.searchParams.set('character', String(character));
    if (animations) url.searchParams.set('animations', String(animations));
    if (dancerSize) url.searchParams.set('dancerSize', String(dancerSize));
    if (dancerPos) url.searchParams.set('dancerPos', String(dancerPos));
    if (showDancer) url.searchParams.set('showDancer', '1');
    // Forward camera parameters if present
    if (cameraMode) url.searchParams.set('cameraMode', String(cameraMode));
    if (cameraElevationPct !== undefined) url.searchParams.set('cameraElevationPct', String(cameraElevationPct));
    if (cameraTiltDeg !== undefined) url.searchParams.set('cameraTiltDeg', String(cameraTiltDeg));
    if (cameraSpeed !== undefined) url.searchParams.set('cameraSpeed', String(cameraSpeed));
    if (cameraDistance !== undefined) url.searchParams.set('cameraDistance', String(cameraDistance));
    // Text overlays
    if (title) url.searchParams.set('title', String(title));
    if (titlePos) url.searchParams.set('titlePos', String(titlePos));
    if (titleColor) url.searchParams.set('titleColor', String(titleColor));
    if (titleFloat) url.searchParams.set('titleFloat', '1');
    if (titleBounce) url.searchParams.set('titleBounce', '1');
    if (titlePulse) url.searchParams.set('titlePulse', '1');
    if (desc) url.searchParams.set('desc', String(desc));
    if (descPos) url.searchParams.set('descPos', String(descPos));
    if (descColor) url.searchParams.set('descColor', String(descColor));
    if (descFloat) url.searchParams.set('descFloat', '1');
    if (descBounce) url.searchParams.set('descBounce', '1');
    if (descPulse) url.searchParams.set('descPulse', '1');
    // Countdown timer
    if (showCountdown) {
      url.searchParams.set('showCountdown', '1');
      if (countPos) url.searchParams.set('countPos', String(countPos));
      if (countColor) url.searchParams.set('countColor', String(countColor));
      if (countFloat) url.searchParams.set('countFloat', '1');
      if (countBounce) url.searchParams.set('countBounce', '1');
      if (countPulse) url.searchParams.set('countPulse', '1');
    }
    // Background
    if (bgMode) url.searchParams.set('bgMode', String(bgMode));
    if (bgColor) url.searchParams.set('bgColor', String(bgColor));
    if (bgImageUrl) url.searchParams.set('bgImageUrl', String(bgImageUrl));
    if (bgFit) url.searchParams.set('bgFit', String(bgFit));
    if (bgOpacity) url.searchParams.set('bgOpacity', String(bgOpacity));
    // Intro/outro durations
    if (introSecs) url.searchParams.set('introSecs', String(introSecs));
    if (outroSecs) url.searchParams.set('outroSecs', String(outroSecs));
    // VU meter accent color
    if (color) url.searchParams.set('color', String(color));
    if (showVU) url.searchParams.set('showVU', '1');
    // Subtitle / lyrics
    if (subtitleEnabled) {
      url.searchParams.set('subtitleEnabled', '1');
      if (subtitleUrl) url.searchParams.set('subtitleUrl', subtitleUrl);
      if (subtitleCuesJson) url.searchParams.set('subtitleCuesJson', subtitleCuesJson);
      if (subtitlePos) url.searchParams.set('subtitlePos', String(subtitlePos));
      if (subtitleColor) url.searchParams.set('subtitleColor', String(subtitleColor));
      if (subtitleOffset) url.searchParams.set('subtitleOffset', String(subtitleOffset));
      if (subtitleFontSize) url.searchParams.set('subtitleFontSize', String(subtitleFontSize));
    }
    // Tell the headless browser where to POST the finished recording
    url.searchParams.set('uploadUrl', `${serverBase}/upload-render/${jobToken}`);

    // Stream progress via SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (jobId && data.status) updateJob(jobId, { status: data.status });
    };
    sendEvent({ status: 'loading', progress: 0 });

    try {
      await page.goto(url.toString(), { waitUntil: 'networkidle0' });
    } catch (navErr) {
      await browser.close().catch(() => {}); activeBrowser = null;
      console.error('Navigation failed:', url.toString(), navErr);
      sendEvent({ status: 'error', error: 'app_unreachable', detail: String(navErr) });
      return res.end();
    }

    sendEvent({ status: 'buffering', progress: 0 });

    // Poll progress from the page while rendering — single evaluate per tick for speed
    let lastProgress = -1;
    let lastStatus = 'buffering';
    let pollStopped = false;
    let pollRunning = false;
    let pollCount = 0;
    const progressInterval = setInterval(async () => {
      if (pollStopped || pollRunning) return;
      pollRunning = true;
      try {
        // Single page.evaluate to read all state at once (avoids 3× round-trip latency)
        const state = await page.evaluate(() => ({
          done: (window).__exportDone,
          prebuffering: (window).__exportPrebuffering,
          progress: (window).__exportProgress ?? 0,
        }));
        pollCount++;
        if (pollCount <= 5 || pollCount % 20 === 0) {
          console.log(`[poll #${pollCount}] done=${state.done}, prebuffering=${state.prebuffering}, progress=${state.progress}`);
        }
        if (state.done !== undefined) { pollStopped = true; pollRunning = false; console.log('[poll] Export done detected, stopping poll'); return; }
        if (state.prebuffering) {
          if (lastStatus !== 'buffering') {
            lastStatus = 'buffering';
            sendEvent({ status: 'buffering', progress: 0 });
          }
        } else {
          if (lastStatus === 'buffering') {
            lastStatus = 'recording';
            console.log('[poll] Switched to recording status');
            sendEvent({ status: 'recording', progress: 0 });
          }
          const pct = Math.round(state.progress * 1000) / 10;
          if (pct !== lastProgress && pct < 100) {
            lastProgress = pct;
            sendEvent({ status: 'recording', progress: pct });
          }
        }
      } catch (e) {
        const msg = e.message || String(e);
        // Fatal frame errors mean the page/browser is gone — stop polling immediately
        if (
          msg.includes('detached Frame') ||
          msg.includes('Target closed') ||
          msg.includes('Session closed') ||
          msg.includes('Protocol error')
        ) {
          pollStopped = true;
          console.log('[poll] Frame detached or target closed, stopping poll.');
        } else {
          console.error('[poll] Error:', msg);
        }
      }
      pollRunning = false;
    }, 250);

    // Wait for the headless browser to POST the recording directly to /upload-render/:token
    // This avoids page.evaluate buffer extraction which hangs for large video files
    let uploadResult;
    try {
      sendEvent({ status: 'encoding', progress: 0 });
      console.log('[render] Waiting for headless browser to upload recording...');
      uploadResult = await uploadPromise;
      console.log(`[render] Upload complete — file: ${uploadResult.filePath}, trim: ${uploadResult.trimStart}s`);
    } catch (uploadErr) {
      clearInterval(progressInterval);
      pollStopped = true;
      await browser.close().catch(() => {}); activeBrowser = null;
      console.error('Upload failed:', uploadErr.message);
      if (jobId) updateJob(jobId, { status: 'error', error: `upload_failed: ${uploadErr.message}` });
      sendEvent({ status: 'error', error: 'upload_failed', detail: uploadErr.message });
      return res.end();
    }

    clearInterval(progressInterval);
    pollStopped = true;

    await browser.close();
    activeBrowser = null;
    activeJobId = null;
    console.log('Browser closed, saving file...');
    sendEvent({ status: 'saving', progress: 0 });

    const trimStart = uploadResult.trimStart;
    const srcWebm = uploadResult.filePath; // written chunk-by-chunk to disk during recording
    console.log(`Trim offset: ${trimStart}s, source: ${srcWebm}`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const renderedDir = path.join(__dirname, '..', 'public', 'rendered');
    await fs.mkdir(renderedDir, { recursive: true });

    if (format === 'mp4') {
      // Transcode WebM → MP4 (H.264 + AAC) with ffmpeg, trimming prebuffer
      sendEvent({ status: 'transcoding', progress: 99 });
      console.log('Starting ffmpeg transcode WebM → MP4...');
      // srcWebm is already on disk — no buffer re-write needed
      const outName = `visualizer_${timestamp}.mp4`;
      const outPath = path.join(renderedDir, outName);

      async function runMp4Transcode(applyTrim) {
        await new Promise((resolve, reject) => {
          const cmd = ffmpeg(srcWebm);
          if (applyTrim && trimStart > 0) {
            cmd.setStartTime(trimStart);
            console.log(`Trimming first ${trimStart}s of prebuffer from output`);
          }
          cmd
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
              '-preset', 'ultrafast',
              '-crf', '23',
              '-pix_fmt', 'yuv420p',
              '-movflags', '+faststart',
              '-b:a', `${aBitrate}k`,
            ])
            .on('stderr', (line) => {
              try { console.log('[ffmpeg mp4]', line); } catch {}
            })
            .on('progress', (p) => {
              if (p.percent) console.log(`ffmpeg transcode: ${Math.round(p.percent)}%`);
            })
            .on('end', () => { console.log('ffmpeg transcode complete'); resolve(); })
            .on('error', (err) => { console.error('ffmpeg error:', err); reject(err); })
            .save(outPath);
        });
      }

      try {
        try {
          // First attempt: with trim (if any)
          await runMp4Transcode(true);
        } catch (e) {
          console.warn('MP4 transcode with trim failed, retrying without trim...', e.message || e);
          // Second attempt: without trim, in case setStartTime is the culprit
          await runMp4Transcode(false);
        }

        const stat = await fs.stat(outPath);
        console.log(`Rendered MP4 saved to ${outPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
        if (jobId) updateJob(jobId, { status: 'done', filename: outName, fileSize: stat.size });
        sendEvent({ status: 'done', progress: 100, url: `/rendered/${outName}`, filename: outName });
      } catch (transcodeErr) {
        console.error('ffmpeg transcode failed after retries:', transcodeErr);
        if (jobId) updateJob(jobId, { status: 'error', error: `transcode_failed: ${transcodeErr.message}` });
        sendEvent({ status: 'error', error: 'transcode_failed', detail: transcodeErr.message });
        try { await fs.unlink(srcWebm); } catch {}
        console.log('MP4 transcode failed, aborting render.');
        // Small delay to flush the error event before closing the stream
        await new Promise(r => setTimeout(r, 1000));
        return res.end();
      }
      try { await fs.unlink(srcWebm); } catch {}
    } else {
      // Save WebM — trim prebuffer with ffmpeg if needed
      const outName = `visualizer_${timestamp}.webm`;
      const outPath = path.join(renderedDir, outName);
      if (trimStart > 0) {
        // srcWebm already on disk — use directly as ffmpeg input, no re-write needed
        sendEvent({ status: 'transcoding', progress: 99 });
        console.log(`Trimming first ${trimStart}s of prebuffer from WebM (re-encode)...`);
        try {
          await new Promise((resolve, reject) => {
            ffmpeg(srcWebm)
              .setStartTime(trimStart)
              .videoCodec('libvpx-vp9')
              .audioCodec('libopus')
              .outputOptions(['-b:v', '4000k', '-b:a', `${aBitrate}k`])
              .on('progress', (p) => {
                if (p.percent) console.log(`ffmpeg WebM trim: ${Math.round(p.percent)}%`);
              })
              .on('end', () => { console.log('WebM trim complete'); resolve(); })
              .on('error', (err) => { console.error('ffmpeg trim error:', err); reject(err); })
              .save(outPath);
          });
        } catch (trimErr) {
          console.error('ffmpeg trim failed, saving untrimmed WebM instead:', trimErr.message);
          try { await fs.rename(srcWebm, outPath); } catch { await fs.copyFile(srcWebm, outPath); }
        }
        try { await fs.unlink(srcWebm); } catch {}
      } else {
        // No trim — move directly to rendered folder, zero extra I/O
        await fs.rename(srcWebm, outPath);
      }
      const webmStat = await fs.stat(outPath);
      console.log(`Rendered WebM saved to ${outPath} (${(webmStat.size / 1024 / 1024).toFixed(1)} MB)`);
      if (jobId) updateJob(jobId, { status: 'done', filename: outName, fileSize: webmStat.size });
      sendEvent({ status: 'done', progress: 100, url: `/rendered/${outName}`, filename: outName });
    }
    // Small delay to ensure the done event is flushed before closing the stream
    console.log('Sending done event, flushing stream...');
    await new Promise(r => setTimeout(r, 1000));
    res.end();
    console.log('Stream closed, render complete.');
    // Clean up temp upload
    try { await fs.unlink(filePath); } catch {}
  } catch (e) {
    console.error(e);
    // Clean up browser on error
    if (activeBrowser) { try { await activeBrowser.close(); } catch {} activeBrowser = null; }
    if (jobId) updateJob(jobId, { status: 'error', error: String(e) });
    try { res.write(`data: ${JSON.stringify({ status: 'error', error: 'render_failed', detail: String(e) })}\n\n`); } catch {}
    try { res.end(); } catch {}
  }
});

// ─── Jobs API ────────────────────────────────────────────────────────────────

// POST /abort  — cancel the current render
app.post('/abort', async (req, res) => {
  await killActiveBrowser();
  res.json({ ok: true });
});

// GET /jobs?limit=50  — list recent render jobs
app.get('/jobs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const jobs  = listJobs(limit);
  const total = countJobs();
  res.json({ total, jobs });
});

// GET /jobs/:id  — single job
app.get('/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`Render server listening on http://localhost:${PORT}`));

// Graceful shutdown: kill any active browser on exit
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`\nReceived ${sig}, cleaning up...`);
    await killActiveBrowser();
    process.exit(0);
  });
}
