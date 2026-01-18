import React, { useEffect, useRef, forwardRef } from 'react';
import type { VisualizerMode } from './visualizerModes';
import { VISUALIZERS } from './visualizers';
import type { DancerSources } from './dancer/DancerEngine';
import { renderDancer } from './dancer/DancerEngine';

export type LayoutMode = '1' | '2-horizontal' | '2-vertical' | '4';

type Panel = { mode: VisualizerMode; color: string; colors?: { low: string; mid: string; high: string }; dancerSources?: DancerSources };

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
  overlayDancer?: { enabled: boolean; position: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'; widthPct: number; sources?: DancerSources };
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
  overlayDancer,
}, ref) {
  const innerRef = useRef<HTMLCanvasElement>(null);
  const dancerFrameRef = useRef<HTMLCanvasElement | null>(null);

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

    // color helper
    const hexToRgba = (hex: string, alpha = 1): string => {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const drawOverlayText = (
      text: string,
      pos: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'|'ct',
      color: string,
      size: number,
      energy: number,
      timeNow: number,
      effects?: { float?: boolean; bounce?: boolean; pulse?: boolean },
    ) => {
      if (!text) return;
      ctx.save();
      const baseSize = size * (effects?.pulse ? (1 + energy * 0.25) : 1);
      ctx.font = `600 ${Math.round(baseSize)}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
      ctx.fillStyle = color;
      ctx.strokeStyle = hexToRgba(color, 0.85);
      ctx.lineWidth = 1;
      ctx.shadowColor = hexToRgba(color, 0.3);
      ctx.shadowBlur = 8;
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
      const ty = y + floatOffset + bounceOffset;
      ctx.fillText(text, x, ty);
      ctx.strokeText(text, x, ty);
      ctx.restore();
    };

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const baseFreq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(baseFreq);
      const energy = baseFreq.reduce((sum, v) => sum + v, 0) / (255 * Math.max(1, baseFreq.length));
      const timeNow = performance.now() / 1000;

      panels.forEach((p, i) => {
        const rgn = regions[i] || regions[0];
        const panelAnalyser = analysers?.[i] || analyser;
        const freq = new Uint8Array(panelAnalyser.frequencyBinCount);
        const time = new Uint8Array(panelAnalyser.fftSize);
        panelAnalyser.getByteFrequencyData(freq);
        panelAnalyser.getByteTimeDomainData(time);
        const renderer = VISUALIZERS[p.mode as VisualizerMode];
        if (renderer) {
          renderer({ ctx, x: rgn.x, y: rgn.y, w: rgn.w, h: rgn.h, panel: p, freq, time, energy, now: timeNow, panelKey: `panel-${i}` });
        }
      });

      // Dancer overlay draw (cached), then request async update for next frames
      if (overlayDancer?.enabled) {
        const W = c.width; const H = c.height;
        const targetW = Math.max(80, Math.min(W, Math.round(W * (overlayDancer.widthPct / 100))));
        const targetH = Math.round(targetW * 9 / 16);
        const margin = 16;
        let cx = W / 2, cy = H / 2;
        switch (overlayDancer.position) {
          case 'lt': cx = margin + targetW/2; cy = margin + targetH/2; break;
          case 'mt': cx = W/2; cy = margin + targetH/2; break;
          case 'rt': cx = W - margin - targetW/2; cy = margin + targetH/2; break;
          case 'lm': cx = margin + targetW/2; cy = H/2; break;
          case 'mm': cx = W/2; cy = H/2; break;
          case 'rm': cx = W - margin - targetW/2; cy = H/2; break;
          case 'lb': cx = margin + targetW/2; cy = H - margin - targetH/2; break;
          case 'mb': cx = W/2; cy = H - margin - targetH/2; break;
          case 'rb': cx = W - margin - targetW/2; cy = H - margin - targetH/2; break;
        }
        const x = Math.round(cx - targetW/2);
        const y = Math.round(cy - targetH/2);
        if (dancerFrameRef.current) {
          try { ctx.drawImage(dancerFrameRef.current, x, y, targetW, targetH); } catch {}
        }
        const sources = overlayDancer.sources ?? {};
        const key = `overlay-dancer|${sources.characterUrl ?? ''}|${(sources.animationUrls ?? []).join(',')}`;
        const isPlaying = !!audio && !audio.paused && !audio.ended && (audio.currentTime ?? 0) > 0;
        renderDancer(key, sources, targetW, targetH, energy, isPlaying, baseFreq, timeNow)
          .then((canvas3d) => { dancerFrameRef.current = canvas3d; })
          .catch(() => {});
      }

      // Text overlays on top
  if (overlayTitle) drawOverlayText(overlayTitle.text, overlayTitle.position, overlayTitle.color, 48, energy, timeNow, overlayTitle.effects);
  if (overlayDescription) drawOverlayText(overlayDescription.text, overlayDescription.position, overlayDescription.color, 24, energy, timeNow, overlayDescription.effects);
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
  drawOverlayText(text, mapPos(overlayCountdown.position), overlayCountdown.color, 22, energy, timeNow, overlayCountdown.effects);
      }

      raf = requestAnimationFrame(render);
    };
    render();
    return () => { cancelAnimationFrame(raf); };
  }, [analyser, analysers, layout, panels, innerRef, audio, overlayTitle, overlayDescription, overlayCountdown, overlayDancer]);

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
