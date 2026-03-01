import React from 'react';
import { DancerPreview } from '../visualizer/dancer/DancerPreview';
import VUMeters from '../visualizer/VUMeters';

/**
 * Unified overlay layer for all visualizer modes.
 * Renders dancer, text (title/desc), countdown, and VU meters using
 * the same position props as GridVisualizerCanvas overlays.
 */

interface OverlayProps {
  width: number;
  height: number;
  // Audio
  analyser: AnalyserNode | null;
  audioEl?: HTMLAudioElement | null;
  // Dancer
  showDancer?: boolean;
  dancerPos?: string; // position key: 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb'
  dancerSize?: number; // percentage 0–100
  dancerOverlaySources?: any;
  panelKey?: string;
  // Title
  title?: string;
  titlePos?: string;
  titleColor?: string;
  titleFx?: { float?: boolean; bounce?: boolean; pulse?: boolean };
  // Description
  desc?: string;
  descPos?: string;
  descColor?: string;
  descFx?: { float?: boolean; bounce?: boolean; pulse?: boolean };
  // Countdown
  countPos?: string;
  countColor?: string;
  countFx?: { float?: boolean; bounce?: boolean; pulse?: boolean };
  exportPhase?: 'intro' | 'playing' | 'outro';
  // VU meters
  stereo?: { left: AnalyserNode | null; right: AnalyserNode | null } | null;
  vuColor?: string;
  vuPos?: string;
}

// Map position code to CSS properties
function positionStyle(
  pos: string | undefined,
  width: number,
  height: number,
): React.CSSProperties {
  const margin = 24;
  const base: React.CSSProperties = { position: 'absolute', pointerEvents: 'none' };
  switch (pos) {
    case 'lt': return { ...base, left: margin, top: margin, textAlign: 'left' };
    case 'mt': return { ...base, left: 0, right: 0, top: margin, textAlign: 'center' };
    case 'rt': return { ...base, right: margin, top: margin, textAlign: 'right' };
    case 'ct': return { ...base, left: 0, right: 0, top: margin, textAlign: 'center' };
    case 'lm': return { ...base, left: margin, top: '50%', transform: 'translateY(-50%)', textAlign: 'left' };
    case 'mm': return { ...base, left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: 'center' };
    case 'rm': return { ...base, right: margin, top: '50%', transform: 'translateY(-50%)', textAlign: 'right' };
    case 'lb': return { ...base, left: margin, bottom: margin, textAlign: 'left' };
    case 'mb': return { ...base, left: 0, right: 0, bottom: margin, textAlign: 'center' };
    case 'rb': return { ...base, right: margin, bottom: margin, textAlign: 'right' };
    case 'bl': return { ...base, left: margin, bottom: margin, textAlign: 'left' };
    case 'br': return { ...base, right: margin, bottom: margin, textAlign: 'right' };
    default:   return { ...base, left: 0, right: 0, top: margin, textAlign: 'center' };
  }
}

// Map position code to dancer container CSS
function dancerContainerStyle(
  pos: string | undefined,
  width: number,
  height: number,
  dancerW: number,
  dancerH: number,
): React.CSSProperties {
  const margin = 16;
  const base: React.CSSProperties = { position: 'absolute', pointerEvents: 'none', width: dancerW, height: dancerH };
  switch (pos) {
    case 'lt': return { ...base, left: margin, top: margin };
    case 'mt': return { ...base, left: (width - dancerW) / 2, top: margin };
    case 'rt': return { ...base, right: margin, top: margin };
    case 'lm': return { ...base, left: margin, top: (height - dancerH) / 2 };
    case 'mm': return { ...base, left: (width - dancerW) / 2, top: (height - dancerH) / 2 };
    case 'rm': return { ...base, right: margin, top: (height - dancerH) / 2 };
    case 'lb': return { ...base, left: margin, bottom: margin };
    case 'mb': return { ...base, left: (width - dancerW) / 2, bottom: margin };
    case 'rb': return { ...base, right: margin, bottom: margin };
    default:   return { ...base, left: (width - dancerW) / 2, top: (height - dancerH) / 2 };
  }
}

function fxStyle(fx?: { float?: boolean; bounce?: boolean; pulse?: boolean }): React.CSSProperties {
  // Text effects are applied via inline styles / CSS animations
  // For simplicity, we apply a subset here; the canvas-based GridVisualizer handles them more precisely.
  return {};
}

// Map 9-grid or 5-grid position code to VUMeters anchor
function vuPosToAnchor(pos: string | undefined): 'lt' | 'ct' | 'rt' | 'bl' | 'br' {
  switch (pos) {
    case 'lt': case 'lm': return 'lt';
    case 'ct': case 'mt': case 'mm': case 'mb': return 'ct';
    case 'lb': case 'bl': return 'bl';
    case 'rb': case 'br': return 'br';
    case 'rt': case 'rm': default: return 'rt';
  }
}

const VisualizerOverlays: React.FC<OverlayProps> = ({
  width,
  height,
  analyser,
  audioEl,
  showDancer,
  dancerPos,
  dancerSize = 40,
  dancerOverlaySources,
  panelKey = 'overlay',
  title,
  titlePos,
  titleColor = '#ffffff',
  titleFx,
  desc,
  descPos,
  descColor = '#ffffff',
  descFx,
  countPos,
  countColor = '#ffffff',
  countFx,
  exportPhase,
  stereo,
  vuColor = '#7aa2ff',
  vuPos,
}) => {
  const scaleFactor = height / 720;
  const dancerW = Math.max(80, Math.round(width * (dancerSize / 100)));
  const dancerH = Math.round(dancerW * 9 / 16);

  // Force re-render for countdown updates
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!audioEl) return;
    const interval = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(interval);
  }, [audioEl]);

  return (
    <div className="overlay-controls" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Dancer overlay */}
      {showDancer && dancerOverlaySources && (
        <div style={dancerContainerStyle(dancerPos, width, height, dancerW, dancerH)}>
          <DancerPreview
            sources={dancerOverlaySources}
            analyser={analyser}
            audioEl={audioEl}
            width={dancerW}
            height={dancerH}
            panelKey={panelKey}
          />
        </div>
      )}

      {/* Title overlay */}
      {title && (
        <div style={{
          ...positionStyle(titlePos, width, height),
          color: titleColor,
          fontSize: Math.round(32 * scaleFactor),
          fontWeight: 600,
          textShadow: '0 2px 8px #000',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}>
          {title}
        </div>
      )}

      {/* Description overlay */}
      {desc && (
        <div style={{
          ...positionStyle(descPos, width, height),
          color: descColor,
          fontSize: Math.round(20 * scaleFactor),
          fontWeight: 400,
          textShadow: '0 2px 8px #000',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}>
          {desc}
        </div>
      )}

      {/* Countdown overlay */}
      {exportPhase === 'intro' ? (
        <div style={{
          ...positionStyle(countPos || 'mt', width, height),
          color: countColor,
          fontSize: Math.round(28 * scaleFactor),
          fontWeight: 700,
          textShadow: '0 2px 8px #000',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}>
          Starting...
        </div>
      ) : audioEl && audioEl.duration > 0 && (
        <div style={{
          ...positionStyle(countPos || 'rt', width, height),
          color: countColor,
          fontSize: Math.round(22 * scaleFactor),
          fontWeight: 600,
          textShadow: '0 2px 8px #000',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
        }}>
          {(() => {
            const dur = audioEl.duration || 0;
            const cur = audioEl.currentTime || 0;
            const rem = Math.max(0, dur - cur);
            const mm = Math.floor(rem / 60).toString().padStart(2, '0');
            const ss = Math.floor(rem % 60).toString().padStart(2, '0');
            return `${mm}:${ss}`;
          })()}
        </div>
      )}

      {/* VU meters overlay - horizontal bars anchored near countdown position */}
      {stereo && stereo.left && stereo.right && (
        <VUMeters
          left={stereo.left}
          right={stereo.right}
          accentColor={vuColor}
          orientation="horizontal"
          anchorPos={vuPosToAnchor(vuPos ?? countPos)}
        />
      )}
    </div>
  );
};

export default VisualizerOverlays;
