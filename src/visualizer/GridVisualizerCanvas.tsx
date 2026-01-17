import React, { useEffect, useRef, forwardRef } from 'react';
import type { VisualizerMode } from './visualizerModes';

export type LayoutMode = '1' | '2-horizontal' | '2-vertical' | '4';

type Panel = { mode: VisualizerMode; color: string; colors?: { low: string; mid: string; high: string } };

type Props = {
  analyser: AnalyserNode | null;
  analysers?: Array<AnalyserNode | null>;
  layout: LayoutMode;
  panels: Panel[];
  width?: number;
  height?: number;
  audio?: HTMLAudioElement | null;
  overlayTitle?: { text: string; position: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'; color: string; effects?: { float?: boolean; bounce?: boolean; pulse?: boolean } };
  overlayDescription?: { text: string; position: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'; color: string; effects?: { float?: boolean; bounce?: boolean; pulse?: boolean } };
  overlayCountdown?: { enabled: boolean; position: 'lt'|'ct'|'rt'|'bl'|'br'; color: string; effects?: { float?: boolean; bounce?: boolean; pulse?: boolean } };
};

export const GridVisualizerCanvas = forwardRef<HTMLCanvasElement, Props>(function GridVisualizerCanvas({
  analyser,
  analysers,
  layout,
  panels,
  width = 1280,
  height = 720,
  audio,
  overlayTitle,
  overlayDescription,
  overlayCountdown,
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
    const pickColor = (ratio: number, colors: Panel['colors'], fallback: string) => {
      if (colors) {
        if (ratio < 1/3) return colors.low;
        if (ratio < 2/3) return colors.mid;
        return colors.high;
      }
      return fallback;
    };
    const drawBars = (x: number, y: number, w: number, h: number, panel: Panel, data: Uint8Array) => {
      const bars = Math.max(32, Math.floor(w / 20));
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * data.length);
        const v = data[idx] / 255;
        const ratio = idx / data.length;
        ctx.fillStyle = pickColor(ratio, panel.colors, panel.color);
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
    const drawCircle = (x: number, y: number, w: number, h: number, panel: Panel, data: Uint8Array) => {
      const cx = x + w / 2; const cy = y + h / 2; const radius = Math.min(w, h) / 4;
      const spokes = 96;
      for (let i = 0; i < spokes; i++) {
        const t = (i / spokes) * 2 * Math.PI;
        const idx = Math.floor((i / spokes) * data.length);
        const v = (data[idx] / 255) * (Math.min(w, h) / 4);
        const ratio = idx / data.length;
        ctx.strokeStyle = pickColor(ratio, panel.colors, panel.color);
        ctx.lineWidth = 2;
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
      // Base energy for text effects
      const baseFreq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(baseFreq);
      const energy = baseFreq.reduce((sum, v) => sum + v, 0) / (255 * Math.max(1, baseFreq.length));
      const timeNow = performance.now() / 1000;
      panels.forEach((p, i) => {
        const r = regions[i] || regions[0];
        const panelAnalyser = analysers?.[i] || analyser;
        const freq = new Uint8Array(panelAnalyser.frequencyBinCount);
        const time = new Uint8Array(panelAnalyser.fftSize);
        panelAnalyser.getByteFrequencyData(freq);
        panelAnalyser.getByteTimeDomainData(time);
        switch (p.mode) {
          case 'bars': drawBars(r.x, r.y, r.w, r.h, p, freq); break;
          case 'wave': drawWave(r.x, r.y, r.w, r.h, p.color, time); break;
          case 'circle': drawCircle(r.x, r.y, r.w, r.h, p, freq); break;
        }
      });
      // Overlay text helper
      const drawOverlayText = (
        text: string,
        pos: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'|'ct',
        color: string,
        size: number,
        effects?: { float?: boolean; bounce?: boolean; pulse?: boolean }
      ) => {
        if (!text) return;
        ctx.save();
        const baseSize = size * (effects?.pulse ? (1 + energy * 0.25) : 1);
        ctx.font = `600 ${Math.round(baseSize)}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
        ctx.fillStyle = color;
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 6;
        const margin = 24;
        let x = margin, y = margin;
        let textAlign: CanvasTextAlign = 'left';
        let textBaseline: CanvasTextBaseline = 'top';
        switch (pos) {
          case 'lt': x = margin; y = margin; textAlign='left'; textBaseline='top'; break;
          case 'mt': x = c.width/2; y = margin; textAlign='center'; textBaseline='top'; break;
          case 'rt': x = c.width - margin; y = margin; textAlign='right'; textBaseline='top'; break;
          case 'lm': x = margin; y = c.height/2; textAlign='left'; textBaseline='middle'; break;
          case 'mm': x = c.width/2; y = c.height/2; textAlign='center'; textBaseline='middle'; break;
          case 'rm': x = c.width - margin; y = c.height/2; textAlign='right'; textBaseline='middle'; break;
          case 'lb': x = margin; y = c.height - margin; textAlign='left'; textBaseline='bottom'; break;
          case 'mb': x = c.width/2; y = c.height - margin; textAlign='center'; textBaseline='bottom'; break;
          case 'rb': x = c.width - margin; y = c.height - margin; textAlign='right'; textBaseline='bottom'; break;
          case 'ct': x = c.width/2; y = margin; textAlign='center'; textBaseline='top'; break;
        }
        const floatOffset = effects?.float ? Math.sin(timeNow * 1.5) * 8 : 0;
        const bounceOffset = effects?.bounce ? -energy * 20 : 0;
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        ctx.fillText(text, x, y + floatOffset + bounceOffset);
        ctx.restore();
      };
      if (overlayTitle) {
        drawOverlayText(overlayTitle.text, overlayTitle.position, overlayTitle.color, 48, overlayTitle.effects);
      }
      if (overlayDescription) {
        drawOverlayText(overlayDescription.text, overlayDescription.position, overlayDescription.color, 24, overlayDescription.effects);
      }
      if (overlayCountdown?.enabled && audio) {
        const dur = audio.duration || 0;
        const cur = audio.currentTime || 0;
        const rem = Math.max(0, dur - cur);
        const mm = Math.floor(rem / 60).toString().padStart(2, '0');
        const ss = Math.floor(rem % 60).toString().padStart(2, '0');
        const text = `${mm}:${ss}`;
        const mapPos = (p: 'lt'|'ct'|'rt'|'bl'|'br'): 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb' => (
          p === 'lt' ? 'lt' : p === 'ct' ? 'mt' : p === 'rt' ? 'rt' : p === 'bl' ? 'lb' : 'rb'
        );
        drawOverlayText(text, mapPos(overlayCountdown.position), overlayCountdown.color, 22, overlayCountdown.effects);
      }
      raf = requestAnimationFrame(render);
    };
    render();
    return () => { cancelAnimationFrame(raf); };
  }, [analyser, analysers, layout, panels, innerRef, audio, overlayTitle, overlayDescription, overlayCountdown]);

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
