import { useEffect, useRef } from 'react';
import { renderDancer, getDancerClipNames, type DancerSources } from './DancerEngine';

/**
 * Small preview canvas for dancer overlay settings.
 * - Uses legacy `renderDancer` with energy-only to keep it lightweight.
 * - Runs its own RAF loop and draws the returned offscreen canvas.
 */
export function DancerPreview({
  sources,
  analyser,
  audioEl,
  width = 220,
  height = 124,
  panelKey = 'preview',
  onClipsLoaded,
}: {
  sources: DancerSources;
  analyser?: AnalyserNode | null;
  audioEl?: HTMLAudioElement | null;
  width?: number;
  height?: number;
  panelKey?: string;
  onClipsLoaded?: (names: string[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastClipCountRef = useRef(0);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(256);
    const loop = () => {
      let energy = 0.0;
      let now = performance.now() / 1000;
      if (analyser) {
        analyser.getByteFrequencyData(freq);
        energy = freq.reduce((s, v) => s + v, 0) / (255 * Math.max(1, freq.length));
      }
      const key = `${panelKey}|${sources.characterUrl ?? ''}|${(sources.animationUrls ?? []).join(',')}`;
      const isPlaying = audioEl ? !audioEl.paused && !audioEl.ended && (audioEl.currentTime ?? 0) > 0 : energy > 0.01;
      renderDancer(key, sources, c.width, c.height, energy, isPlaying, freq, now)
        .then((off) => {
          try { ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(off, 0, 0, c.width, c.height); } catch {}
          // Report clip names to parent when they change (async load completes)
          if (onClipsLoaded) {
            const names = getDancerClipNames(key);
            if (names.length !== lastClipCountRef.current) {
              lastClipCountRef.current = names.length;
              onClipsLoaded(names);
            }
          }
        })
        .catch(() => {});
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); };
  }, [sources, analyser, audioEl, onClipsLoaded]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ borderRadius: 8, border: '1px solid var(--panelBorder)', background: 'transparent' }} />;
}
