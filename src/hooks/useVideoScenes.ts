import { useEffect, useRef, type RefObject } from 'react';

const SCENE_FADE_DURATION_MS = 1500;

export type VideoFadeRef = RefObject<{ prev: HTMLCanvasElement | null; startMs: number; durationMs: number }>;

/**
 * Manages sequential playback of multiple video scenes with crossfade on scene change.
 * Returns a `fadeRef` the draw code uses to composite prev/current during transition.
 */
export function useVideoScenes(
  videoRef: RefObject<HTMLVideoElement | null>,
  urls: string[],
  enabled: boolean,
): VideoFadeRef {
  const fadeRef = useRef<{ prev: HTMLCanvasElement | null; startMs: number; durationMs: number }>({
    prev: null,
    startMs: 0,
    durationMs: SCENE_FADE_DURATION_MS,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled || urls.length === 0) {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    let index = 0;
    const list = urls.slice(); // snapshot at effect-setup time

    const advance = () => {
      // Capture the current video's last visible frame into an offscreen canvas (synchronous — no decode delay)
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const snap = document.createElement('canvas');
        snap.width = video.videoWidth;
        snap.height = video.videoHeight;
        const snapCtx = snap.getContext('2d');
        if (snapCtx) {
          try { snapCtx.drawImage(video, 0, 0); } catch {}
        }
        fadeRef.current = { prev: snap, startMs: performance.now(), durationMs: SCENE_FADE_DURATION_MS };
      }

      index = (index + 1) % list.length;
      video.src = list[index];
      video.load();
      video.play().catch(() => {});

      // Release the snapshot canvas after the fade completes
      setTimeout(() => { fadeRef.current.prev = null; }, SCENE_FADE_DURATION_MS + 200);
    };

    video.addEventListener('ended', advance);
    video.src = list[0];
    video.load();
    video.play().catch(() => {});

    return () => {
      video.removeEventListener('ended', advance);
      video.pause();
      video.removeAttribute('src');
      video.load();
      // Clean up any in-progress prev canvas
      fadeRef.current = { prev: null, startMs: 0, durationMs: SCENE_FADE_DURATION_MS };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, urls.join('\n')]);

  return fadeRef;
}
