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
    /** If set, each recorded chunk is POSTed here immediately — no in-memory accumulation */
    uploadUrl?: string;
    /** Seconds of prebuffer to report to server for ffmpeg trim */
    trimStart?: number;
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
    const uploadUrl = opts?.uploadUrl;
    const trimStartVal = opts?.trimStart ?? 0;
    // Serial promise chain so chunks always arrive at the server in order
    let chunkChain: Promise<unknown> = Promise.resolve();
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        if (uploadUrl) {
          // Stream chunk to server immediately — skip in-memory accumulation
          chunkChain = chunkChain.then(() =>
            fetch(`${uploadUrl}/chunk`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: e.data,
            }).then(r => { if (!r.ok) throw new Error(`Chunk upload HTTP ${r.status}`); })
              .catch(err => console.error('[recorder] Chunk upload error:', err))
          );
        } else {
          chunksRef.current.push(e.data);
        }
      }
    };
    recorder.onstop = async () => {
      if (uploadUrl) {
        // Drain any in-flight chunk uploads, then finalize
        await chunkChain.then(() =>
          fetch(`${uploadUrl}/finalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trimStart: trimStartVal }),
          }).then(r => { if (!r.ok) throw new Error(`Finalize HTTP ${r.status}`); })
            .catch(err => console.error('[recorder] Finalize error:', err))
        );
        setLastBlob(null);
        setRecording(false);
        if (stopResolverRef.current) { stopResolverRef.current(null); stopResolverRef.current = null; }
      } else {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        setLastBlob(blob);
        setRecording(false);
        if (stopResolverRef.current) { stopResolverRef.current(blob); stopResolverRef.current = null; }
      }
    };
    recorderRef.current = recorder;
    setRecording(true);
    recorder.start(1000); // collect data every 1s for reliable chunking in headless browsers
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

  return { start, stop, download, recording, lastBlob };
}
