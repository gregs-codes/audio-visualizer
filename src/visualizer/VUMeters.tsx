import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

export type AnchorPos = 'lt' | 'ct' | 'rt' | 'bl' | 'br';
export type VUMetersProps = {
  left: AnalyserNode | null;
  right: AnalyserNode | null;
  accentColor?: string; // optional override
  orientation?: 'vertical' | 'horizontal';
  anchorPos?: AnchorPos; // when horizontal, attach near countdown
  length?: number; // px length of the bar
  thickness?: number; // px height of each bar
};

function levelFromAnalyser(an: AnalyserNode | null, tmp: Float32Array): number {
  if (!an) return 0;
  if (tmp.length !== an.fftSize) tmp = new Float32Array(an.fftSize);
  // TypeScript generic mismatch workaround: cast to any for WebAudio API
  an.getFloatTimeDomainData(tmp as any);
  // Compute RMS of -1..1 signal
  let sumSq = 0;
  for (let i = 0; i < tmp.length; i++) {
    const v = tmp[i];
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / tmp.length);
  return Math.max(0, Math.min(1, rms));
}

function anchorStyle(pos: AnchorPos | undefined, length: number, thickness: number): CSSProperties {
  // Default to top-right under countdown
  // Distance under/over the countdown (approximate)
  const rows = thickness * 2 + 2; // two rows + spacing
  // Mirror GridVisualizerCanvas overlay countdown: margin=24, size=22, float up to 8px
  const offsetUnderTop = 24 + 22 + 6; // 52px
  const offsetAboveBottom = 24 + 22 + 6; // 52px
  if (!pos || pos === 'rt') return { position: 'absolute', top: offsetUnderTop, right: 24, width: length, height: rows };
  if (pos === 'lt') return { position: 'absolute', top: offsetUnderTop, left: 24, width: length, height: rows };
  if (pos === 'ct') return { position: 'absolute', top: offsetUnderTop, left: '50%', transform: 'translateX(-50%)', width: length, height: rows };
  if (pos === 'br') return { position: 'absolute', bottom: offsetAboveBottom, right: 24, width: length, height: rows };
  if (pos === 'bl') return { position: 'absolute', bottom: offsetAboveBottom, left: 24, width: length, height: rows };
  return { position: 'absolute', top: offsetUnderTop, right: 24, width: length, height: rows };
}

export function VUMeters({ left, right, accentColor, orientation = 'vertical', anchorPos = 'rt', length = 128, thickness = 6 }: VUMetersProps){
  const [levels, setLevels] = useState<{ L: number; R: number }>({ L: 0, R: 0 });
  const rafRef = useRef<number | null>(null);
  const bufLRef = useRef<Float32Array>(new Float32Array(2048));
  const bufRRef = useRef<Float32Array>(new Float32Array(2048));
  const peakRef = useRef<{ L: number; R: number }>({ L: 0, R: 0 });

  useEffect(() => {
    const tick = () => {
      // Read levels
      let L = levelFromAnalyser(left, bufLRef.current);
      let R = levelFromAnalyser(right, bufRRef.current);
      // Smooth with a simple low-pass filter
      setLevels(prev => ({
        L: prev.L * 0.85 + L * 0.15,
        R: prev.R * 0.85 + R * 0.15,
      }));
      // Peak hold with slow decay
      peakRef.current.L = Math.max(peakRef.current.L * 0.98, L);
      peakRef.current.R = Math.max(peakRef.current.R * 0.98, R);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [left, right]);

  const lPct = Math.round(levels.L * 100);
  const rPct = Math.round(levels.R * 100);
  const lp = Math.round(peakRef.current.L * 100);
  const rp = Math.round(peakRef.current.R * 100);

  if (orientation === 'horizontal') {
    const style = anchorStyle(anchorPos, length, thickness);
    return (
      <div className="vu-meters vu-h" style={{ ...style, ['--accent' as any]: accentColor ?? undefined }}>
        <div className="vu-h-row" style={{ height: thickness }}>
          <div className="vu-h-track">
            <div className="vu-h-fill" style={{ width: `${lPct}%` }} />
            <div className="vu-h-peak" style={{ left: `${lp}%` }} />
          </div>
        </div>
        <div className="vu-h-row" style={{ height: thickness }}>
          <div className="vu-h-track">
            <div className="vu-h-fill" style={{ width: `${rPct}%` }} />
            <div className="vu-h-peak" style={{ left: `${rp}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // fallback vertical rendering
  const lHeight = lPct;
  const rHeight = rPct;
  return (
    <div className="vu-meters" style={{ ['--accent' as any]: accentColor ?? undefined }}>
      <div className="vu vu-left" aria-label="Left channel level">
        <div className="vu-track">
          <div className="vu-fill" style={{ height: `${lHeight}%` }} />
          <div className="vu-peak" style={{ bottom: `${lp}%` }} />
        </div>
      </div>
      <div className="vu vu-right" aria-label="Right channel level">
        <div className="vu-track">
          <div className="vu-fill" style={{ height: `${rHeight}%` }} />
          <div className="vu-peak" style={{ bottom: `${rp}%` }} />
        </div>
      </div>
    </div>
  );
}

export default VUMeters;
