import { useRef, useState } from 'react';

export function useCanvasRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);

  const start = (canvas: HTMLCanvasElement, audioStream: MediaStream | null, fps = 30) => {
    if (recording) return;
    const videoStream = canvas.captureStream(fps);
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(audioStream ? audioStream.getAudioTracks() : []),
    ]);

    const preferredTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    let mimeType = '';
    for (const t of preferredTypes) {
      if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
    }
    const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      setLastBlob(blob);
      setRecording(false);
    };
    recorderRef.current = recorder;
    setRecording(true);
    recorder.start();
  };

  const stop = () => {
    if (!recorderRef.current) return null;
    recorderRef.current.stop();
    return recorderRef.current;
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
