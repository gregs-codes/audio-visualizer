import React, { useEffect, useRef, forwardRef } from 'react';
import type { VisualizerMode } from './visualizerModes';

export type LayoutMode = '1' | '2-horizontal' | '2-vertical' | '4';

type Panel = { mode: VisualizerMode; color: string };

type Props = {
  analyser: AnalyserNode | null;
  analysers?: Array<AnalyserNode | null>;
  layout: LayoutMode;
  panels: Panel[];
  width?: number;
  height?: number;
};

export const GridVisualizerCanvas = forwardRef<HTMLCanvasElement, Props>(function GridVisualizerCanvas({
  analyser,
  analysers,
  layout,
  panels,
  width = 1280,
  height = 720,
}, ref) {
  const innerRef = useRef<HTMLCanvasElement>(null);
  // Bridge innerRef to the forwarded ref
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === 'function') {
      ref(innerRef.current);
    } else {
      (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = innerRef.current;
    }
  }, [ref]);

  useEffect(() => {
    const c = innerRef.current;
    if (!analyser || !c) return;
    const ctx = c.getContext('2d')!;

    const regions = computeRegions(layout, c.width, c.height);
    const drawBars = (x: number, y: number, w: number, h: number, color: string, data: Uint8Array) => {
      const bars = Math.max(32, Math.floor(w / 20));
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * data.length);
        const v = data[idx] / 255;
        ctx.fillStyle = color;
        ctx.fillRect(x + i * barW, y + h - v * h, barW - 2, v * h);
      }
    };
    const drawWave = (x: number, y: number, w: number, h: number, color: string, time: Uint8Array) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < time.length; i++) {
        const v = time[i] / 255;
        const px = x + (i / time.length) * w;
        const py = y + (1 - v) * h;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    const drawCircle = (x: number, y: number, w: number, h: number, color: string, data: Uint8Array) => {
      const cx = x + w / 2; const cy = y + h / 2; const radius = Math.min(w, h) / 4;
      const spokes = 96;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      for (let i = 0; i < spokes; i++) {
        const t = (i / spokes) * 2 * Math.PI;
        const idx = Math.floor((i / spokes) * data.length);
        const v = (data[idx] / 255) * (Math.min(w, h) / 4);
        const x1 = cx + Math.cos(t) * radius;
        const y1 = cy + Math.sin(t) * radius;
        const x2 = cx + Math.cos(t) * (radius + v);
        const y2 = cy + Math.sin(t) * (radius + v);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    };

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      panels.forEach((p, i) => {
        const r = regions[i] || regions[0];
        const panelAnalyser = analysers?.[i] || analyser;
        const freq = new Uint8Array(panelAnalyser.frequencyBinCount);
        const time = new Uint8Array(panelAnalyser.fftSize);
        panelAnalyser.getByteFrequencyData(freq);
        panelAnalyser.getByteTimeDomainData(time);
        switch (p.mode) {
          case 'bars': drawBars(r.x, r.y, r.w, r.h, p.color, freq); break;
          case 'wave': drawWave(r.x, r.y, r.w, r.h, p.color, time); break;
          case 'circle': drawCircle(r.x, r.y, r.w, r.h, p.color, freq); break;
        }
      });
      raf = requestAnimationFrame(render);
    };
    render();
    return () => { cancelAnimationFrame(raf); };
  }, [analyser, analysers, layout, panels, innerRef]);

  return <canvas ref={innerRef} width={width} height={height} />;
});

function computeRegions(layout: LayoutMode, W: number, H: number): Array<{x:number;y:number;w:number;h:number}> {
  switch (layout) {
    case '1': return [{ x: 0, y: 0, w: W, h: H }];
    case '2-horizontal': return [
      { x: 0, y: 0, w: W, h: H/2 },
      { x: 0, y: H/2, w: W, h: H/2 },
    ];
    case '2-vertical': return [
      { x: 0, y: 0, w: W/2, h: H },
      { x: W/2, y: 0, w: W/2, h: H },
    ];
    case '4': default: return [
      { x: 0, y: 0, w: W/2, h: H/2 },
      { x: W/2, y: 0, w: W/2, h: H/2 },
      { x: 0, y: H/2, w: W/2, h: H/2 },
      { x: W/2, y: H/2, w: W/2, h: H/2 },
    ];
  }
}
