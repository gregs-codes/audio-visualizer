import ThreeShaderVisualizer from '../visualizer/ThreeShaderVisualizer';
import React, { useEffect, useRef } from 'react';
import { GridVisualizerCanvas } from '../visualizer/GridVisualizerCanvas';
import ThreeAudioVisualizer from '../visualizer/ThreeAudioVisualizer';
import HexagonVisualizer from '../visualizer/HexagonVisualizer';
import VisualizerOverlays from './VisualizerOverlays';
import type { LayoutMode } from '../visualizer/GridVisualizerCanvas';
import {
  ParallaxBackgroundEngine,
  spotlightAnimate,
  laserLightsAnimate,
  tunnelStarfieldAnimate,
  movingRaysAnimate,
  bgVizBarsAnimate,
  bgVizRadialAnimate,
  bgVizOrbsAnimate,
} from '../visualizer/ParallaxBackgroundEngine';

// Background canvas layer that supports all background modes (including animated parallax/bg-viz)
const ThreeJsBgLayer: React.FC<{
  bgMode: string | undefined;
  bgColor: string;
  bgImageUrl: string;
  bgFit: 'cover' | 'contain' | 'stretch' | undefined;
  bgOpacity: number;
  width: number;
  height: number;
  analyser: AnalyserNode | null;
}> = ({ bgMode, bgColor, bgImageUrl, bgFit, bgOpacity, width, height, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parallaxRef = useRef<ParallaxBackgroundEngine & { bgMode?: string } | null>(null);
  const rafRef = useRef<number>();
  const isAnimated = bgMode?.startsWith('parallax-') || bgMode?.startsWith('bg-viz-');

  useEffect(() => {
    if (!isAnimated) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    parallaxRef.current = null;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      const time = performance.now();

      if (bgMode === 'parallax-spotlights' || bgMode === 'parallax-lasers' || bgMode === 'parallax-tunnel' || bgMode === 'parallax-rays') {
        if (!parallaxRef.current || parallaxRef.current.bgMode !== bgMode) {
          let layers: any[];
          switch (bgMode) {
            case 'parallax-spotlights': layers = [{ color: '#181a20', speed: 0, opacity: 1 }, { animate: spotlightAnimate, speed: 1, opacity: 1, blendMode: 'lighter' }]; break;
            case 'parallax-lasers':     layers = [{ color: '#0a0c18', speed: 0, opacity: 1 }, { animate: laserLightsAnimate, speed: 1, opacity: 1, blendMode: 'lighter' }]; break;
            case 'parallax-tunnel':     layers = [{ color: '#0a0c18', speed: 0, opacity: 1 }, { animate: tunnelStarfieldAnimate, speed: 1, opacity: 1, blendMode: 'lighter' }]; break;
            case 'parallax-rays':       layers = [{ color: '#181a20', speed: 0, opacity: 1 }, { animate: movingRaysAnimate, speed: 1, opacity: 1, blendMode: 'lighter' }]; break;
            default:                    layers = [{ color: '#181a20', speed: 0, opacity: 1 }, { animate: spotlightAnimate, speed: 1, opacity: 1, blendMode: 'lighter' }];
          }
          parallaxRef.current = Object.assign(new ParallaxBackgroundEngine(layers), { bgMode });
        }
        parallaxRef.current.render(ctx, time, width, height);
      } else if (bgMode?.startsWith('bg-viz-')) {
        const freqData = analyser
          ? (() => { const d = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(d); return d; })()
          : new Uint8Array(128);
        const tint = bgColor || '#a0b4f7';
        if (bgMode === 'bg-viz-bars')   bgVizBarsAnimate(ctx, freqData, time, width, height, tint);
        else if (bgMode === 'bg-viz-radial') bgVizRadialAnimate(ctx, freqData, time, width, height, tint);
        else                            bgVizOrbsAnimate(ctx, freqData, time, width, height, tint);
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [bgMode, width, height, analyser, bgColor]);

  const base: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 0 };

  if (!bgMode || bgMode === 'none')
    return <div style={{ ...base, backgroundColor: '#000' }} />;
  if (bgMode === 'image')
    return (
      <div style={{
        ...base,
        backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
        backgroundColor: bgImageUrl ? undefined : bgColor,
        backgroundSize: bgFit === 'stretch' ? '100% 100%' : (bgFit ?? 'cover'),
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: bgOpacity,
      }} />
    );
  if (bgMode === 'color')
    return <div style={{ ...base, backgroundColor: bgColor, opacity: bgOpacity }} />;
  if (isAnimated)
    return <canvas ref={canvasRef} width={width} height={height} style={{ ...base, width, height, display: 'block' }} />;

  // fallback
  return <div style={{ ...base, backgroundColor: bgColor || '#000', opacity: bgOpacity }} />;
};

interface VisualizerPanelProps {
  analyserNode: AnalyserNode | null;
  analysers: any;
  layout: LayoutMode;
  panels: any;
  previewSize: { w: number; h: number };
  effectiveSize: { w: number; h: number };
  audioEl: HTMLAudioElement | null;
  bgMode: 'none'|'color'|'image'|'parallax-spotlights'|'parallax-lasers'|'parallax-tunnel'|'parallax-rays'|'bg-viz-bars'|'bg-viz-radial'|'bg-viz-orbs'|undefined;
  bgColor: string;
  bgImageUrl: string;
  bgFit: 'cover'|'contain'|'stretch'|undefined;
  bgOpacity: number;
  title: string;
  titlePos: any;
  titleColor: string;
  titleFx: any;
  desc: string;
  descPos: any;
  descColor: string;
  descFx: any;
  countPos: any;
  countColor: string;
  countFx: any;
  showDancer: boolean;
  dancerPos: any;
  dancerSize: number;
  dancerOverlaySources: any;
  stereo: any;
  color: string;
  exportPhase: any;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  exportCanvasRef: React.RefObject<HTMLCanvasElement>;
}

const VisualizerPanel: React.FC<VisualizerPanelProps> = ({
  analyserNode,
  analysers,
  layout,
  panels,
  previewSize,
  effectiveSize,
  audioEl,
  bgMode,
  bgColor,
  bgImageUrl,
  bgFit,
  bgOpacity,
  title,
  titlePos,
  titleColor,
  titleFx,
  desc,
  descPos,
  descColor,
  descFx,
  countPos,
  countColor,
  countFx,
  showDancer,
  dancerPos,
  dancerSize,
  dancerOverlaySources,
  stereo,
  color,
  exportPhase,
  canvasRef,
  exportCanvasRef,
}) => {
  // Determine the actual mode being used
  const mode = panels[0]?.mode;
  
  // Common props for all visualizers
  const commonProps = {
    analyser: analyserNode,
    width: previewSize.w,
    height: previewSize.h,
    // For parallax/bg-viz modes, background is rendered by ThreeJsBgLayer behind the canvas,
    // so don't fill the canvas with a solid color (keep it transparent).
    backgroundColor: bgMode === 'color' ? bgColor : undefined,
    backgroundImageUrl: bgMode === 'image' ? bgImageUrl : undefined,
    backgroundFit: bgFit,
    backgroundOpacity: bgOpacity,
  };

  const overlayProps = {
    width: previewSize.w,
    height: previewSize.h,
    analyser: analyserNode,
    audioEl: audioEl,
    showDancer: showDancer,
    dancerPos: dancerPos,
    dancerSize: dancerSize,
    dancerOverlaySources: dancerOverlaySources,
    title: title,
    titlePos: titlePos,
    titleColor: titleColor,
    titleFx: titleFx,
    desc: desc,
    descPos: descPos,
    descColor: descColor,
    descFx: descFx,
    countPos: countPos,
    countColor: countColor,
    countFx: countFx,
    exportPhase: exportPhase,
    stereo: stereo ? { left: stereo.left, right: stereo.right } : null,
    vuColor: color,
    vuPos: countPos, // Use countPos for VU meters like GridVisualizerCanvas does
  };

  // Color conversion helper for WebGL visualizers
  const hexToRgb = (hex: string) => ({
    r: typeof hex === 'string' ? parseInt(hex.slice(1, 3), 16) / 255 : 1,
    g: typeof hex === 'string' ? parseInt(hex.slice(3, 5), 16) / 255 : 1,
    b: typeof hex === 'string' ? parseInt(hex.slice(5, 7), 16) / 255 : 1,
  });

  // Shared props for the animated/static background layer used by Three.js overlay modes
  const bgLayerProps = {
    bgMode,
    bgColor,
    bgImageUrl,
    bgFit,
    bgOpacity,
    width: previewSize.w,
    height: previewSize.h,
    analyser: analyserNode,
  };

  // Render visualizer based on mode
  const renderVisualizer = () => {
    switch (mode) {
      case 'hexagon-visualizer':
        return (
          <div style={{ position: 'relative', width: previewSize.w, height: previewSize.h }}>
            <ThreeJsBgLayer {...bgLayerProps} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <HexagonVisualizer {...commonProps} />
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
              <VisualizerOverlays {...overlayProps} panelKey="hexagon" />
            </div>
          </div>
        );

      case 'threejs-3d':
        return (
          <div style={{ position: 'relative', width: previewSize.w, height: previewSize.h }}>
            <ThreeJsBgLayer {...bgLayerProps} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <ThreeAudioVisualizer analyser={analyserNode} width={previewSize.w} height={previewSize.h} />
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
              <VisualizerOverlays {...overlayProps} panelKey="threejs-3d" />
            </div>
          </div>
        );

      case 'threejs-shader':
        return (
          <div style={{ position: 'relative', width: previewSize.w, height: previewSize.h }}>
            <ThreeJsBgLayer {...bgLayerProps} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <ThreeShaderVisualizer
                analyser={analyserNode}
                width={previewSize.w}
                height={previewSize.h}
                cameraPosition={dancerOverlaySources?.cameraPosition ?? [0, -2, 14]}
                cameraLookAt={dancerOverlaySources?.cameraLookAt ?? [0, 0, 0]}
                color={hexToRgb(color)}
              />
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
              <VisualizerOverlays {...overlayProps} panelKey="shader" />
            </div>
          </div>
        );

      default:
        // GridVisualizerCanvas handles its own overlays internally
        return (
          <GridVisualizerCanvas
            ref={canvasRef}
            analyser={analyserNode}
            analysers={analysers}
            layout={layout}
            panels={panels}
            width={previewSize.w}
            height={previewSize.h}
            audio={audioEl}
            backgroundColor={bgMode === 'color' || bgMode?.startsWith('bg-viz') ? bgColor : undefined}
            backgroundImageUrl={bgMode === 'image' ? bgImageUrl : undefined}
            backgroundFit={bgFit}
            backgroundOpacity={bgOpacity}
            bgMode={bgMode}
            instanceKey={'preview'}
            overlayTitle={{ text: title, position: titlePos, color: titleColor, effects: titleFx }}
            overlayDescription={{ text: desc, position: descPos, color: descColor, effects: descFx }}
            overlayCountdown={{ enabled: true, position: countPos, color: countColor, effects: countFx }}
            overlayDancer={{ enabled: showDancer, position: dancerPos, widthPct: dancerSize, sources: dancerOverlaySources }}
            overlayVU={stereo ? { left: stereo.left, right: stereo.right, accentColor: color, position: countPos } : undefined}
            exportPhase={exportPhase}
          />
        );
    }
  };

  return (
    <>
      {renderVisualizer()}
      <div style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        <GridVisualizerCanvas
          ref={exportCanvasRef}
          analyser={analyserNode}
          analysers={analysers}
          layout={layout}
          panels={panels}
          width={effectiveSize.w}
          height={effectiveSize.h}
          audio={audioEl}
          backgroundColor={bgMode === 'color' || bgMode?.startsWith('bg-viz') ? bgColor : undefined}
          backgroundImageUrl={bgMode === 'image' ? bgImageUrl : undefined}
          backgroundFit={bgFit}
          backgroundOpacity={bgOpacity}
          bgMode={bgMode}
          instanceKey={'export'}
          overlayTitle={{ text: title, position: titlePos, color: titleColor, effects: titleFx }}
          overlayDescription={{ text: desc, position: descPos, color: descColor, effects: descFx }}
          overlayCountdown={{ enabled: true, position: countPos, color: countColor, effects: countFx }}
          overlayDancer={{ enabled: showDancer, position: dancerPos, widthPct: dancerSize, sources: dancerOverlaySources }}
          overlayVU={stereo ? { left: stereo.left, right: stereo.right, accentColor: color, position: countPos } : undefined}
          exportPhase={exportPhase}
        />
      </div>
    </>
  );
};

export default VisualizerPanel;
