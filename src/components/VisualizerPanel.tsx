import ThreeShaderVisualizer from '../visualizer/ThreeShaderVisualizer';
import React from 'react';
import { GridVisualizerCanvas } from '../visualizer/GridVisualizerCanvas';
import ThreeAudioVisualizer from '../visualizer/ThreeAudioVisualizer';
import HexagonVisualizer from '../visualizer/HexagonVisualizer';
import VisualizerOverlays from './VisualizerOverlays';
import type { LayoutMode } from '../visualizer/GridVisualizerCanvas';

interface VisualizerPanelProps {
  analyserNode: AnalyserNode | null;
  analysers: any;
  layout: LayoutMode;
  panels: any;
  previewSize: { w: number; h: number };
  effectiveSize: { w: number; h: number };
  audioEl: HTMLAudioElement | null;
  bgMode: 'none'|'color'|'image'|'parallax'|undefined;
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

  // Render visualizer based on mode
  const renderVisualizer = () => {
    switch (mode) {
      case 'hexagon-visualizer':
        return (
          <div style={{ position: 'relative', width: previewSize.w, height: previewSize.h }}>
            <HexagonVisualizer {...commonProps} />
            <VisualizerOverlays {...overlayProps} panelKey="hexagon" />
          </div>
        );

      case 'threejs-3d':
        return (
          <div style={{ position: 'relative', width: previewSize.w, height: previewSize.h }}>
            <ThreeAudioVisualizer {...commonProps} />
            <VisualizerOverlays {...overlayProps} panelKey="threejs-3d" />
          </div>
        );

      case 'threejs-shader':
        return (
          <div style={{ position: 'relative', width: previewSize.w, height: previewSize.h }}>
            <ThreeShaderVisualizer
              {...commonProps}
              cameraPosition={dancerOverlaySources?.cameraPosition ?? [0, -2, 14]}
              cameraLookAt={dancerOverlaySources?.cameraLookAt ?? [0, 0, 0]}
              color={hexToRgb(color)}
            />
            <VisualizerOverlays {...overlayProps} panelKey="shader" />
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
            backgroundColor={bgMode === 'color' ? bgColor : undefined}
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
          backgroundColor={bgMode === 'color' ? bgColor : undefined}
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
