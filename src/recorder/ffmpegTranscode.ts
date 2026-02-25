// Load ffmpeg wasm at runtime to avoid bundling export issues

export type TranscodeOpts = {
  preset?: 'ultrafast'|'superfast'|'veryfast'|'faster'|'fast'|'medium'|'slow'|'slower'|'veryslow';
  videoBitrateKbps?: number; // target video bitrate
  audioBitrateKbps?: number; // target audio bitrate
  crf?: number; // 18-28 reasonable range (lower = higher quality); ignored if videoBitrateKbps provided
  fps?: number;
  width?: number;
  height?: number;
};

export async function webmToMp4(blob: Blob, opts?: TranscodeOpts, onProgress?: (ratio: number) => void): Promise<Blob> {
  const mod = await import('@ffmpeg/ffmpeg');
  const createFFmpeg = (mod as any).createFFmpeg as (args?: any) => any;
  // Hint corePath for reliable loading in Chrome
  const ffmpeg = createFFmpeg({ log: false, corePath: 'https://unpkg.com/@ffmpeg/core@0.12.7/dist/ffmpeg-core.js' });
  await ffmpeg.load();
  const data = new Uint8Array(await blob.arrayBuffer());
  ffmpeg.FS('writeFile', 'input.webm', data);
  const buildArgs = (vcodec: 'libx264'|'mpeg4'): string[] => {
    const a: string[] = ['-i', 'input.webm'];
    if (opts?.fps) { a.push('-r', String(opts.fps)); }
    if (opts?.width && opts?.height) { a.push('-s', `${opts.width}x${opts.height}`); }
    a.push('-c:v', vcodec);
    if (vcodec === 'libx264') a.push('-preset', opts?.preset ?? 'fast');
    if (typeof opts?.videoBitrateKbps === 'number') { a.push('-b:v', `${opts.videoBitrateKbps}k`); }
    else if (typeof opts?.crf === 'number' && vcodec === 'libx264') { a.push('-crf', String(opts.crf)); }
    a.push('-pix_fmt', 'yuv420p');
    if (typeof opts?.audioBitrateKbps === 'number') { a.push('-b:a', `${opts.audioBitrateKbps}k`); }
    a.push('-movflags', '+faststart', 'output.mp4');
    return a;
  };
  ffmpeg.setProgress((p: any) => { if (onProgress && typeof p?.ratio === 'number') onProgress(p.ratio); });
  try {
    await ffmpeg.run(...buildArgs('libx264'));
  } catch (e) {
    // Fallback if H.264 encoder is not available
    await ffmpeg.run(...buildArgs('mpeg4'));
  }
  const out = ffmpeg.FS('readFile', 'output.mp4');
  const mp4Blob = new Blob([out.buffer], { type: 'video/mp4' });
  try { ffmpeg.FS('unlink', 'input.webm'); } catch {}
  try { ffmpeg.FS('unlink', 'output.mp4'); } catch {}
  return mp4Blob;
}
