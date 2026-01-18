import { useRef, useState } from 'react';

export function useCanvasRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopResolverRef = useRef<((b: Blob | null) => void) | null>(null);

  type StartOpts = {
    fps?: number;
    mime?: string; // explicit mime if desired
    bitsPerSecond?: number;
    audioBitsPerSecond?: number;
    videoBitsPerSecond?: number;
  };
  const start = (canvas: HTMLCanvasElement, audioStream: MediaStream | null, opts?: StartOpts) => {
    if (recording) return;
    const fps = opts?.fps ?? 30;
    const videoStream = canvas.captureStream(fps);
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(audioStream ? audioStream.getAudioTracks() : []),
    ]);

    const preferredTypes = [opts?.mime].concat([
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].filter(Boolean) as string[]);
    let mimeType = '';
    for (const t of preferredTypes) {
      if (t && MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
    }
    const recOptions: MediaRecorderOptions = {
      ...(mimeType ? { mimeType } : {}),
      ...(opts?.bitsPerSecond ? { bitsPerSecond: opts.bitsPerSecond } : {}),
      ...(opts?.audioBitsPerSecond ? { audioBitsPerSecond: opts.audioBitsPerSecond } : {}),
      ...(opts?.videoBitsPerSecond ? { videoBitsPerSecond: opts.videoBitsPerSecond } : {}),
    };
    const recorder = new MediaRecorder(combined, recOptions);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      setLastBlob(blob);
      setRecording(false);
      if (stopResolverRef.current) { stopResolverRef.current(blob); stopResolverRef.current = null; }
    };
    recorderRef.current = recorder;
    setRecording(true);
    recorder.start();
  };

  const stop = async (): Promise<Blob | null> => {
    if (!recorderRef.current) return null;
    return await new Promise<Blob | null>((resolve) => {
      stopResolverRef.current = resolve;
      recorderRef.current!.stop();
    });
  };

  const download = (filename = 'visualizer.webm') => {
    if (!lastBlob) return;
    const url = URL.createObjectURL(lastBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const transcodeToMp4 = async (opts?: import('./ffmpegTranscode').TranscodeOpts, onProgress?: (ratio: number) => void): Promise<Blob | null> => {
    if (!lastBlob) return null;
    const { webmToMp4 } = await import('./ffmpegTranscode');
    return await webmToMp4(lastBlob, opts, onProgress);
  };

  return { start, stop, download, transcodeToMp4, recording, lastBlob };
}
