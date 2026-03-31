import { useEffect, type RefObject } from 'react';

/**
 * Manages sequential playback of multiple video scenes.
 * Attach the returned ref to a hidden <video> element in JSX.
 * When one video ends, the next URL in the list is loaded automatically (cycling).
 */
export function useVideoScenes(
  videoRef: RefObject<HTMLVideoElement | null>,
  urls: string[],
  enabled: boolean,
) {
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
      index = (index + 1) % list.length;
      video.src = list[index];
      video.load();
      video.play().catch(() => {});
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, urls.join('\n')]);
}
