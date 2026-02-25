import { useEffect, useRef } from 'react';
import { renderDancer, type DancerSources } from './DancerEngine';

/**
 * Small preview canvas for dancer overlay settings.
 * - Uses legacy `renderDancer` with energy-only to keep it lightweight.
 * - Runs its own RAF loop and draws the returned offscreen canvas.
 */
export function DancerPreview({
  sources,
  analyser,
  width = 220,
  height = 124,
  panelKey = 'preview',
}: {
  sources: DancerSources;
  analyser?: AnalyserNode | null;
  width?: number;
  height?: number;
  panelKey?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Simple loop: sample energy, render dancer offscreen, composite into preview
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
      const isPlaying = energy > 0.01;
      renderDancer(key, sources, c.width, c.height, energy, isPlaying, freq, now)
        .then((off) => {
          try { ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(off, 0, 0, c.width, c.height); } catch {}
        })
        .catch(() => {});
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); };
  }, [sources, analyser]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ borderRadius: 8, border: '1px solid var(--panelBorder)', background: 'transparent' }} />;
}
