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

async function killActiveBrowser() {
  if (activeBrowser) {
    console.log('Killing previous render browser...');
    activeRenderAborted = true;
    try { await activeBrowser.close(); } catch {}
    activeBrowser = null;
  }
}

// --- Live log broadcasting ---
const logClients = new Set();
const MAX_LOG_HISTORY = 200;
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

// POST /render accepts multipart form: file, aspect, res, fps, codec, vBitrate, aBitrate
app.post('/render', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    // Kill any previous render before starting a new one
    await killActiveBrowser();
    activeRenderAborted = false;

    const {
      aspect = '16:9', res: resolution = '720', fps = '30', codec = 'vp9',
      vBitrate = '8000', aBitrate = '192', format = 'webm', mode, theme, layout, panels,
      character, animations, dancerSize, dancerPos,
      title, titlePos, titleColor, titleFloat, titleBounce, titlePulse,
      desc, descPos, descColor, descFloat, descBounce, descPulse,
      showCountdown, countPos, countColor, countFloat, countBounce, countPulse,
      bgMode, bgColor, bgImageUrl, bgFit, bgOpacity,
    } = req.body || {};

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

    // Build URL with autoExport and params; write upload to a short URL to avoid huge query strings
    const audioMime = req.file.mimetype || 'audio/mpeg';
    const ext = (audioMime.split('/')[1] || 'bin').split(';')[0];
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    await fs.mkdir(TMP_DIR, { recursive: true });
    const filePath = path.join(TMP_DIR, fileId);
    await fs.writeFile(filePath, req.file.buffer);
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

    // Stream progress via SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };
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
        if (state.done !== undefined) { pollStopped = true; console.log('[poll] Export done detected, stopping poll'); return; }
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
        console.error('[poll] Error:', e.message || e);
      }
      pollRunning = false;
    }, 250);

    // Wait for export to finish
    await page.waitForFunction('window.__exportDone !== undefined', { timeout: 300_000 });
    clearInterval(progressInterval);
    pollStopped = true;

    const exportOk = await page.evaluate(() => (window).__exportDone);
    if (!exportOk) {
      const errDetail = await page.evaluate(() => (window).__exportError || 'unknown');
      await browser.close().catch(() => {}); activeBrowser = null;
      console.error('Auto-export error:', errDetail);
      sendEvent({ status: 'error', error: 'export_failed', detail: errDetail });
      return res.end();
    }

    console.log('Export done, extracting buffer from page...');
    sendEvent({ status: 'encoding', progress: 0 });
    const { bufferBase64, mime } = await page.evaluate(async () => {
      const ab = (window).__exportBuffer;
      const mime = (window).__exportMime;
      const blob = new Blob([new Uint8Array(ab)]);
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      return { bufferBase64: base64, mime };
    });
    console.log(`Buffer extracted, base64 length: ${bufferBase64.length}`);

    // Get trim offset (seconds of prebuffer recorded before audio started)
    const trimStart = await page.evaluate(() => (window).__exportTrimStart || 0);
    console.log(`Trim offset: ${trimStart}s`);

    await browser.close();
    activeBrowser = null;
    console.log('Browser closed, saving file...');
    sendEvent({ status: 'saving', progress: 0 });

    const buf = Buffer.from(bufferBase64, 'base64');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const renderedDir = path.join(__dirname, '..', 'public', 'rendered');
    await fs.mkdir(renderedDir, { recursive: true });

    if (format === 'mp4') {
      // Transcode WebM → MP4 (H.264 + AAC) with ffmpeg, trimming prebuffer
      sendEvent({ status: 'transcoding', progress: 99 });
      console.log('Starting ffmpeg transcode WebM → MP4...');
      const tmpWebm = path.join(TMP_DIR, `${timestamp}.webm`);
      await fs.writeFile(tmpWebm, buf);
      console.log(`Temp WebM written: ${tmpWebm} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
      const outName = `visualizer_${timestamp}.mp4`;
      const outPath = path.join(renderedDir, outName);
      try {
        await new Promise((resolve, reject) => {
          const cmd = ffmpeg(tmpWebm);
          if (trimStart > 0) {
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
            .on('progress', (p) => {
              if (p.percent) console.log(`ffmpeg transcode: ${Math.round(p.percent)}%`);
            })
            .on('end', () => { console.log('ffmpeg transcode complete'); resolve(); })
            .on('error', (err) => { console.error('ffmpeg error:', err); reject(err); })
            .save(outPath);
        });
        const stat = await fs.stat(outPath);
        console.log(`Rendered MP4 saved to ${outPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
        sendEvent({ status: 'done', progress: 100, url: `/rendered/${outName}`, filename: outName });
      } catch (transcodeErr) {
        console.error('ffmpeg transcode failed, saving raw WebM instead:', transcodeErr.message);
        const fallbackName = `visualizer_${timestamp}.webm`;
        const fallbackPath = path.join(renderedDir, fallbackName);
        await fs.writeFile(fallbackPath, buf);
        sendEvent({ status: 'done', progress: 100, url: `/rendered/${fallbackName}`, filename: fallbackName });
      }
      try { await fs.unlink(tmpWebm); } catch {}
    } else {
      // Save WebM — trim prebuffer with ffmpeg if needed
      const outName = `visualizer_${timestamp}.webm`;
      const outPath = path.join(renderedDir, outName);
      if (trimStart > 0) {
        const tmpWebm = path.join(TMP_DIR, `${timestamp}_raw.webm`);
        await fs.writeFile(tmpWebm, buf);
        sendEvent({ status: 'transcoding', progress: 99 });
        console.log(`Trimming first ${trimStart}s of prebuffer from WebM (re-encode)...`);
        try {
          await new Promise((resolve, reject) => {
            ffmpeg(tmpWebm)
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
          await fs.writeFile(outPath, buf);
        }
        try { await fs.unlink(tmpWebm); } catch {}
      } else {
        await fs.writeFile(outPath, buf);
      }
      console.log(`Rendered WebM saved to ${outPath}`);
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
    try { res.write(`data: ${JSON.stringify({ status: 'error', error: 'render_failed', detail: String(e) })}\n\n`); } catch {}
    try { res.end(); } catch {}
  }
});

app.listen(PORT, () => console.log(`Render server listening on http://localhost:${PORT}`));

// Graceful shutdown: kill any active browser on exit
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`\nReceived ${sig}, cleaning up...`);
    await killActiveBrowser();
    process.exit(0);
  });
}
