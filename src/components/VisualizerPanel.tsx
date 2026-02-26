import ThreeShaderVisualizer from '../visualizer/ThreeShaderVisualizer';
import ThreeRippleVisualizer from '../visualizer/ThreeRippleVisualizer';
import BeastShaderCanvas from '../visualizer/BeastShaderCanvas';
import { DancerPreview } from '../visualizer/dancer/DancerPreview';
import VUMeters from '../visualizer/VUMeters';
import ThreePointsVisualizer from '../visualizer/ThreePointsVisualizer';
import React from 'react';
import { GridVisualizerCanvas } from '../visualizer/GridVisualizerCanvas';
import VisualizerCanvasWithTriangles from '../visualizer/VisualizerCanvasWithTriangles';
import ThreeAudioVisualizer from '../visualizer/ThreeAudioVisualizer';
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
  return (
    <>
      {panels[0]?.mode === 'triangles-bars' ? (
        <VisualizerCanvasWithTriangles
          analyser={analyserNode}
          backgroundUrl={bgMode === 'image' ? bgImageUrl : undefined}
          backgroundType={bgMode === 'image' ? 'image' : undefined}
          backgroundFit={bgFit}
        />
      ) : panels[0]?.mode === 'threejs-3d' ? (
        <ThreeAudioVisualizer
          analyser={analyserNode}
          width={previewSize.w}
          height={previewSize.h}
        />
      ) : panels[0]?.mode === 'threejs-points' ? (
        <ThreePointsVisualizer
          analyser={analyserNode}
          width={previewSize.w}
          height={previewSize.h}
        />
      ) : panels[0]?.mode === 'threejs-shader' ? (
        <ThreeShaderVisualizer
          analyser={analyserNode}
          width={previewSize.w}
          height={previewSize.h}
          cameraPosition={dancerOverlaySources?.cameraPosition ?? [0, -2, 14]}
          cameraLookAt={dancerOverlaySources?.cameraLookAt ?? [0, 0, 0]}
          color={{
            r: typeof color === 'string' ? parseInt(color.slice(1, 3), 16) / 255 : 1,
            g: typeof color === 'string' ? parseInt(color.slice(3, 5), 16) / 255 : 1,
            b: typeof color === 'string' ? parseInt(color.slice(5, 7), 16) / 255 : 1,
          }}
        >
          {/* Overlays */}
          {showDancer && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, pointerEvents: 'none' }}>
              <DancerPreview
                sources={dancerOverlaySources}
                analyser={analyserNode}
                width={Math.round(previewSize.w * 0.5)}
                height={Math.round(previewSize.h * 0.5)}
                panelKey="shader"
              />
            </div>
          )}
          {/* Text overlays */}
          {title && (
            <div style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', color: titleColor, fontSize: 32, fontWeight: 600, textShadow: '0 2px 8px #000' }}>{title}</div>
          )}
          {desc && (
            <div style={{ position: 'absolute', top: 64, left: 0, right: 0, textAlign: 'center', color: descColor, fontSize: 20, fontWeight: 400, textShadow: '0 2px 8px #000' }}>{desc}</div>
          )}
          {/* Countdown overlay */}
          {exportPhase === 'intro' && (
            <div style={{ position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center', color: countColor, fontSize: 28, fontWeight: 700, textShadow: '0 2px 8px #000' }}>Starting...</div>
          )}
          {/* VU meters overlay */}
          {stereo && (
            <div style={{ position: 'absolute', right: 24, top: 24 }}>
              <VUMeters left={stereo.left} right={stereo.right} accentColor={color} orientation="vertical" />
            </div>
          )}
        </ThreeShaderVisualizer>
      ) : panels[0]?.mode === 'threejs-ripples' ? (
        <ThreeRippleVisualizer
          analyser={analyserNode}
          width={previewSize.w}
          height={previewSize.h}
          color={{
            r: typeof color === 'string' ? parseInt(color.slice(1, 3), 16) / 255 : 1,
            g: typeof color === 'string' ? parseInt(color.slice(3, 5), 16) / 255 : 1,
            b: typeof color === 'string' ? parseInt(color.slice(5, 7), 16) / 255 : 1,
          }}
        />
      ) : panels[0]?.mode === 'beast-shader-canvas' ? (
        <BeastShaderCanvas
          analyser={analyserNode}
          width={previewSize.w}
          height={previewSize.h}
          color={{
            r: typeof color === 'string' ? parseInt(color.slice(1, 3), 16) / 255 : 1,
            g: typeof color === 'string' ? parseInt(color.slice(3, 5), 16) / 255 : 1,
            b: typeof color === 'string' ? parseInt(color.slice(5, 7), 16) / 255 : 1,
          }}
        />
      ) : (
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
      )}
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
