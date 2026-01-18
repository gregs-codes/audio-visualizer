import React, { useEffect, useRef, forwardRef } from 'react';
import type { VisualizerMode } from './visualizerModes';
import { VISUALIZERS } from './visualizers';
import type { DancerSources } from './dancer/DancerEngine';

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

    // Helper to convert hex color (e.g., #rrggbb or #rgb) to rgba string with alpha
    const hexToRgba = (hex: string, alpha = 1): string => {
      let h = hex.replace('#', '');
      if (h.length === 3) {
        h = h.split('').map(ch => ch + ch).join('');
      }
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const regions = computeRegions(layout, c.width, c.height);

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      // Base energy for text effects
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
        // Ensure color changes are visually apparent: fill + subtle stroke + color-matched shadow
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
        // Stroke for better contrast regardless of background visuals
        ctx.strokeText(text, x, ty);
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
