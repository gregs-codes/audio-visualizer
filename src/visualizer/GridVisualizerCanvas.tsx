import React, { useEffect, useRef, forwardRef } from 'react';
import { ParallaxBackgroundEngine, spotlightAnimate, laserLightsAnimate, tunnelStarfieldAnimate, movingRaysAnimate } from './ParallaxBackgroundEngine';
import type { VisualizerMode } from './visualizerModes';
import { VISUALIZERS } from './visualizers';
import type { DancerSources } from './dancer/DancerEngine';
import { renderDancerWithFeatures } from './dancer/DancerEngine';
import { renderHighGfxWithFeatures } from './highgfx/HighGfxEngine';
import { renderHighGfxNebulaWithFeatures } from './highgfx/HighGfxNebulaEngine';
import { renderHighGfxTunnelWithFeatures } from './highgfx/HighGfxTunnelEngine';
import { renderHighGfxCurlWithFeatures } from './highgfx/HighGfxCurlEngine';
import { renderHighGfxSpiralWithFeatures } from './highgfx/HighGfxSpiralEngine';
import { renderHighGfxCellsWithFeatures } from './highgfx/HighGfxCellsEngine';
import { renderHighGfxFogWithFeatures } from './highgfx/HighGfxFogEngine';
import { renderHighGfxTrunkWithFeatures } from './highgfx/HighGfxTrunkEngine';
import { renderHighGfxRingsWithFeatures } from './highgfx/HighGfxRingsEngine';
import { renderHighGfxNetWithFeatures } from './highgfx/HighGfxNetEngine';
import { renderHighGfxRingsTrailsWithFeatures } from './highgfx/HighGfxRingsTrailsEngine';
import { renderHighGfxKaleidoscopeWithFeatures } from './highgfx/HighGfxKaleidoscopeEngine';
import { renderHighGfxFlowFieldWithFeatures } from './highgfx/HighGfxFlowFieldEngine';
import { renderHighGfxHexagonWithFeatures } from './highgfx/HighGfxHexagonEngine';
import { renderHighGfxHexPathsWithFeatures } from './highgfx/HighGfxHexPathsEngine';
import { AudioFeatureDetector } from '../audio/audioFeatures';

export type LayoutMode = '1' | '2-horizontal' | '2-vertical' | '4';

type Panel = { mode: VisualizerMode; color: string; colors?: { low: string; mid: string; high: string }; dancerSources?: DancerSources; hgView?: 'top'|'side' };

type Props = {
  analyser: AnalyserNode | null;
  analysers?: Array<AnalyserNode | null>;
  layout: LayoutMode;
  panels: Panel[];
  width?: number;
  height?: number;
  audio?: HTMLAudioElement | null;
  backgroundColor?: string; // optional solid background
  backgroundImageUrl?: string; // optional image background (local URL)
  backgroundFit?: 'cover'|'contain'|'stretch';
  backgroundOpacity?: number; // 0..1
  bgMode?: 'none'|'color'|'image'|'parallax';
  overlayTitle?: { text: string; position: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'; color: string; effects?: { float?: boolean; bounce?: boolean; pulse?: boolean } };
  overlayDescription?: { text: string; position: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'; color: string; effects?: { float?: boolean; bounce?: boolean; pulse?: boolean } };
  overlayCountdown?: { enabled: boolean; position: 'lt'|'ct'|'rt'|'bl'|'br'; color: string; effects?: { float?: boolean; bounce?: boolean; pulse?: boolean } };
  overlayDancer?: { enabled: boolean; position: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'; widthPct: number; sources?: DancerSources };
  overlayVU?: { left: AnalyserNode | null; right: AnalyserNode | null; accentColor?: string; position?: 'lt'|'ct'|'rt'|'bl'|'br' };
  /** Export phase: 'intro' = dark screen with overlays, 'outro' = dark screen after music, 'playing' or undefined = normal */
  exportPhase?: 'intro' | 'playing' | 'outro';
};

export const GridVisualizerCanvas = forwardRef<HTMLCanvasElement, Props & { instanceKey?: string }>(function GridVisualizerCanvas({
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
  overlayVU,
  exportPhase,
  backgroundColor,
  backgroundImageUrl,
  backgroundFit = 'cover',
  backgroundOpacity = 1,
  bgMode = 'none',
  bgParallax = false,
  parallaxEngine = undefined,
  instanceKey = 'main',
}, ref) {
  const innerRef = useRef<HTMLCanvasElement>(null);
  const dancerFrameRef = useRef<HTMLCanvasElement | null>(null);
  const hgFramesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const bgLoadedRef = useRef<boolean>(false);
  // VU meter state refs for smooth animation
  const vuLevelRef = useRef<{ L: number; R: number }>({ L: 0, R: 0 });
  const vuPeakRef = useRef<{ L: number; R: number }>({ L: 0, R: 0 });
  const vuBufLRef = useRef<Float32Array>(new Float32Array(2048));
  const vuBufRRef = useRef<Float32Array>(new Float32Array(2048));

  // Bridge innerRef to the forwarded ref
  // Parallax background engine instance
  const parallaxRef = useRef<ParallaxBackgroundEngine | null>(null);
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === 'function') {
      ref(innerRef.current);
    } else {
      (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = innerRef.current;
    }
  }, [ref]);

  // Load background image when URL changes
  useEffect(() => {
    if (!backgroundImageUrl) { bgImgRef.current = null; bgLoadedRef.current = false; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { bgImgRef.current = img; bgLoadedRef.current = true; };
    img.onerror = () => { bgImgRef.current = null; bgLoadedRef.current = false; };
    img.src = backgroundImageUrl;
  }, [backgroundImageUrl]);

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
      const scaleFactor = c.height / 720;
      const baseSize = Math.round(size * scaleFactor * (effects?.pulse ? (1 + energy * 0.25) : 1));
      ctx.font = `600 ${baseSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
      ctx.fillStyle = color;
      const margin = Math.round(24 * scaleFactor);
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
      const floatOffset = effects?.float ? Math.sin(timeNow * 1.5) * 8 * scaleFactor : 0;
      const bounceOffset = effects?.bounce ? -energy * 20 * scaleFactor : 0;
      ctx.textAlign = textAlign;
      ctx.textBaseline = textBaseline;
      const ty = y + floatOffset + bounceOffset;
      ctx.lineWidth = Math.max(2, Math.round(3 * scaleFactor));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(text, x, ty);
      ctx.fillText(text, x, ty);
      ctx.restore();
    };
    let raf = 0;
    const mainDetector = new AudioFeatureDetector(analyser);
    const panelDetectors = panels.map((_, i) => new AudioFeatureDetector(analysers?.[i] || analyser));
    const render = () => {
      const isPlaying = !!audio && !audio.paused && !audio.ended && (audio.currentTime ?? 0) > 0;
      const inIntroOutro = exportPhase === 'intro' || exportPhase === 'outro';
      if (inIntroOutro) {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, c.width, c.height);
        const timeNow = performance.now() / 1000;
        if (overlayTitle) drawOverlayText(overlayTitle.text, overlayTitle.position, overlayTitle.color, 48, 0, timeNow, undefined);
        if (overlayDescription) drawOverlayText(overlayDescription.text, overlayDescription.position, overlayDescription.color, 24, 0, timeNow, undefined);
        if (overlayCountdown?.enabled && audio) {
          const dur = audio.duration || 0;
          const rem = exportPhase === 'intro' ? dur : 0;
          const mm = Math.floor(rem / 60).toString().padStart(2, '0');
          const ss = Math.floor(rem % 60).toString().padStart(2, '0');
          const text = `${mm}:${ss}`;
          const mapPos = (p: 'lt'|'ct'|'rt'|'bl'|'br'): 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb' => (
            p === 'lt' ? 'lt' : p === 'ct' ? 'mt' : p === 'rt' ? 'rt' : p === 'bl' ? 'lb' : 'rb'
          );
          drawOverlayText(text, mapPos(overlayCountdown.position), overlayCountdown.color, 22, 0, timeNow, undefined);
        }
        raf = requestAnimationFrame(render);
        return;
      }
      if (!isPlaying) {
        raf = requestAnimationFrame(render);
        return;
      }
      ctx.clearRect(0, 0, c.width, c.height);
      // Draw background: parallax, color, or image
      if (bgMode === 'parallax' || bgMode === 'spotlight' || bgMode === 'lasers' || bgMode === 'tunnel' || bgMode === 'rays') {
        if (!parallaxRef.current || parallaxRef.current.bgMode !== bgMode) {
          let layers;
          switch (bgMode) {
            case 'spotlight':
              layers = [
                { color: '#181a20', speed: 0, opacity: 1 },
                { animate: spotlightAnimate, speed: 1, opacity: 1, blendMode: 'lighter' },
              ];
              break;
            case 'lasers':
              layers = [
                { color: '#0a0c18', speed: 0, opacity: 1 },
                { animate: laserLightsAnimate, speed: 1, opacity: 1, blendMode: 'lighter' },
              ];
              break;
            case 'tunnel':
              layers = [
                { color: '#0a0c18', speed: 0, opacity: 1 },
                { animate: tunnelStarfieldAnimate, speed: 1, opacity: 1, blendMode: 'lighter' },
              ];
              break;
            case 'rays':
              layers = [
                { color: '#181a20', speed: 0, opacity: 1 },
                { animate: movingRaysAnimate, speed: 1, opacity: 1, blendMode: 'lighter' },
              ];
              break;
            default:
              layers = [
                { color: '#181a20', speed: 0, opacity: 1 },
                { animate: spotlightAnimate, speed: 1, opacity: 1, blendMode: 'lighter' },
              ];
          }
          parallaxRef.current = new ParallaxBackgroundEngine(layers);
          parallaxRef.current.bgMode = bgMode;
        }
        parallaxRef.current.render(ctx, performance.now(), c.width, c.height);
      } else {
        if (backgroundColor) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, backgroundOpacity));
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.restore();
        }
        if (bgImgRef.current && bgLoadedRef.current) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, backgroundOpacity));
          const img = bgImgRef.current;
          const cw = c.width, ch = c.height;
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;
          let dx = 0, dy = 0, dw = cw, dh = ch;
          if (backgroundFit === 'cover') {
            const scale = Math.max(cw / iw, ch / ih);
            dw = Math.ceil(iw * scale);
            dh = Math.ceil(ih * scale);
            dx = Math.floor((cw - dw) / 2);
            dy = Math.floor((ch - dh) / 2);
          } else if (backgroundFit === 'contain') {
            const scale = Math.min(cw / iw, ch / ih);
            dw = Math.ceil(iw * scale);
            dh = Math.ceil(ih * scale);
            dx = Math.floor((cw - dw) / 2);
            dy = Math.floor((ch - dh) / 2);
          } else {
            dx = 0; dy = 0; dw = cw; dh = ch;
          }
          try { ctx.drawImage(img, dx, dy, dw, dh); } catch {}
          ctx.restore();
        }
      }
      const baseFreq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(baseFreq);
      const energy = baseFreq.reduce((sum, v) => sum + v, 0) / (255 * Math.max(1, baseFreq.length));
      const timeNow = performance.now() / 1000;
      const features = mainDetector.update(1/60);
      panels.forEach((p, i) => {
        const rgn = regions[i] || regions[0];
        const panelAnalyser = analysers?.[i] || analyser;
        const freq = new Uint8Array(panelAnalyser.frequencyBinCount);
        const time = new Uint8Array(panelAnalyser.fftSize);
        panelAnalyser.getByteFrequencyData(freq);
        panelAnalyser.getByteTimeDomainData(time);
        const renderer = VISUALIZERS[p.mode as VisualizerMode];
        if (p.mode === 'high-graphics' || p.mode === 'high-graphics-nebula' || p.mode === 'high-graphics-tunnel' || p.mode === 'high-graphics-curl' || p.mode === 'high-graphics-spiral' || p.mode === 'high-graphics-cells' || p.mode === 'high-graphics-fog' || p.mode === 'high-graphics-trunk' || p.mode === 'high-graphics-rings' || p.mode === 'high-graphics-rings-trails' || p.mode === 'high-graphics-kaleidoscope' || p.mode === 'high-graphics-flow-field' || p.mode === 'high-graphics-hexagon' || p.mode === 'high-graphics-hex-paths' || p.mode === 'high-graphics-net') {
          const cached = hgFramesRef.current.get(i);
          if (cached) {
            try { ctx.drawImage(cached, Math.floor(rgn.x), Math.floor(rgn.y), Math.floor(rgn.w), Math.floor(rgn.h)); } catch {}
          }
          const feats = panelDetectors[i].update(1/60);
          const W = Math.floor(rgn.w); const H = Math.floor(rgn.h);
          let promise: Promise<HTMLCanvasElement> | null = null;
          if (p.mode === 'high-graphics') promise = renderHighGfxWithFeatures(`highgfx|${instanceKey}|${i}`, W, H, feats, timeNow);
          else if (p.mode === 'high-graphics-nebula') promise = renderHighGfxNebulaWithFeatures(`nebula|${instanceKey}|${i}`, W, H, feats, timeNow);
          else if (p.mode === 'high-graphics-tunnel') promise = renderHighGfxTunnelWithFeatures(`tunnel|${instanceKey}|${i}`, W, H, feats, timeNow);
          else if (p.mode === 'high-graphics-curl') promise = renderHighGfxCurlWithFeatures(`curl|${instanceKey}|${i}`, W, H, feats, timeNow);
          else if (p.mode === 'high-graphics-spiral') promise = renderHighGfxSpiralWithFeatures(`spiral|${instanceKey}|${i}`, W, H, feats, timeNow);
          else if (p.mode === 'high-graphics-cells') promise = renderHighGfxCellsWithFeatures(`cells|${instanceKey}|${i}`, W, H, feats, timeNow);
          else if (p.mode === 'high-graphics-fog') promise = renderHighGfxFogWithFeatures(`fog|${instanceKey}|${i}`, W, H, feats, timeNow, { view: p.hgView ?? 'top' });
          else if (p.mode === 'high-graphics-trunk') promise = renderHighGfxTrunkWithFeatures(`trunk|${instanceKey}|${i}`, W, H, feats, timeNow, { view: p.hgView ?? 'top' });
          else if (p.mode === 'high-graphics-rings') promise = renderHighGfxRingsWithFeatures(`rings|${instanceKey}|${i}`, W, H, feats, timeNow, { view: p.hgView ?? 'top' });
          else if (p.mode === 'high-graphics-rings-trails') promise = renderHighGfxRingsTrailsWithFeatures(`rings-trails|${instanceKey}|${i}`, W, H, feats, timeNow, { view: p.hgView ?? 'top' });
          else if (p.mode === 'high-graphics-kaleidoscope') promise = renderHighGfxKaleidoscopeWithFeatures(`kaleidoscope|${instanceKey}|${i}`, W, H, feats, timeNow);
          else if (p.mode === 'high-graphics-flow-field') promise = renderHighGfxFlowFieldWithFeatures(`flow-field|${instanceKey}|${i}`, W, H, feats, timeNow, { view: p.hgView ?? 'top' });
          else if (p.mode === 'high-graphics-hexagon') promise = renderHighGfxHexagonWithFeatures(`hexagon|${instanceKey}|${i}`, W, H, feats, timeNow, { view: p.hgView ?? 'top' });
          else if (p.mode === 'high-graphics-hex-paths') promise = renderHighGfxHexPathsWithFeatures(`hex-paths|${instanceKey}|${i}`, W, H, feats, timeNow, { view: p.hgView ?? 'top' });
          else if (p.mode === 'high-graphics-net') promise = renderHighGfxNetWithFeatures(`net|${instanceKey}|${i}`, W, H, feats, timeNow, { view: p.hgView ?? 'top' });
          if (promise) {
            promise.then((off) => { hgFramesRef.current.set(i, off); }).catch(() => {});
          }
        } else if (renderer) {
          renderer({ ctx, x: rgn.x, y: rgn.y, w: rgn.w, h: rgn.h, panel: p, freq, time, energy, now: timeNow, panelKey: `panel-${i}` });
        }
      });
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
        const key = `overlay-dancer|${instanceKey}|${sources.characterUrl ?? ''}|${(sources.animationUrls ?? []).join(',')}`;
        renderDancerWithFeatures(key, sources, targetW, targetH, features, isPlaying, timeNow)
          .then((canvas3d) => { dancerFrameRef.current = canvas3d; })
          .catch(() => {});
      }
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
      if (overlayVU && (overlayVU.left || overlayVU.right)) {
        const readLevel = (an: AnalyserNode | null, buf: Float32Array): number => {
          if (!an) return 0;
          if (buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
          an.getFloatTimeDomainData(buf as any);
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) { const v = buf[i]; sumSq += v * v; }
          return Math.max(0, Math.min(1, Math.sqrt(sumSq / buf.length)));
        };
        const rawL = readLevel(overlayVU.left, vuBufLRef.current);
        const rawR = readLevel(overlayVU.right, vuBufRRef.current);
        vuLevelRef.current.L = vuLevelRef.current.L * 0.85 + rawL * 0.15;
        vuLevelRef.current.R = vuLevelRef.current.R * 0.85 + rawR * 0.15;
        vuPeakRef.current.L = Math.max(vuPeakRef.current.L * 0.98, rawL);
        vuPeakRef.current.R = Math.max(vuPeakRef.current.R * 0.98, rawR);
        const sf = c.height / 720;
        const vuPos = overlayVU.position || 'rt';
        const barLen = Math.round(96 * sf);
        const barH = Math.max(2, Math.round(3 * sf));
        const gap = Math.max(1, Math.round(2 * sf));
        const margin = Math.round(24 * sf);
        const vuOffsetTop = Math.round(52 * sf);
        const vuOffsetBottom = Math.round(52 * sf);
        const totalH = barH * 2 + gap;
        let bx = 0, by = 0;
        if (vuPos === 'rt')      { bx = c.width - margin - barLen; by = vuOffsetTop; }
        else if (vuPos === 'lt') { bx = margin;                    by = vuOffsetTop; }
        else if (vuPos === 'ct') { bx = Math.round((c.width - barLen) / 2); by = vuOffsetTop; }
        else if (vuPos === 'br') { bx = c.width - margin - barLen; by = c.height - vuOffsetBottom - totalH; }
        else if (vuPos === 'bl') { bx = margin;                    by = c.height - vuOffsetBottom - totalH; }
        const accent = overlayVU.accentColor || '#7aa2ff';
        const parseHex = (hex: string) => {
          let h = hex.replace('#', '');
          if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
          return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
        };
        const ac = parseHex(accent);
        const drawBar = (x: number, y: number, level: number, peak: number) => {
          const radius = barH / 2;
          ctx.save();
          ctx.fillStyle = 'rgba(20, 20, 25, 0.6)';
          ctx.beginPath();
          ctx.roundRect(x, y, barLen, barH, radius);
          ctx.fill();
          ctx.strokeStyle = `rgba(${ac.r}, ${ac.g}, ${ac.b}, 0.2)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x, y, barLen, barH, radius);
          ctx.stroke();
          ctx.restore();
          const fillW = Math.round(level * barLen);
          if (fillW > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, barLen, barH, radius);
            ctx.clip();
            const grad = ctx.createLinearGradient(x, 0, x + barLen, 0);
            grad.addColorStop(0, '#00fff0');
            grad.addColorStop(0.35, accent);
            grad.addColorStop(1, '#ff00a8');
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, fillW, barH);
            ctx.restore();
          }
          if (peak > 0.01) {
            const peakW = Math.max(1, Math.round(1.5 * sf));
            const peakX = x + Math.round(peak * (barLen - peakW));
            ctx.save();
            ctx.fillStyle = `rgba(${Math.round(ac.r*0.86 + 255*0.14)}, ${Math.round(ac.g*0.86 + 255*0.14)}, ${Math.round(ac.b*0.86 + 255*0.14)}, 0.8)`;
            ctx.fillRect(peakX, y, peakW, barH);
            ctx.restore();
          }
        };
        drawBar(bx, by, vuLevelRef.current.L, vuPeakRef.current.L);
        drawBar(bx, by + barH + gap, vuLevelRef.current.R, vuPeakRef.current.R);
      }
      raf = requestAnimationFrame(render);
    };
    render();
    return () => { cancelAnimationFrame(raf); };
  }, [analyser, analysers, layout, panels, innerRef, audio, overlayTitle, overlayDescription, overlayCountdown, overlayDancer, overlayVU, exportPhase, bgParallax, parallaxEngine]);

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
