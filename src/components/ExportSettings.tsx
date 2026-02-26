import React from 'react';

interface ExportSettingsProps {
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  ready: boolean;
  aspect: string;
  setAspect: (v: string) => void;
  res: string;
  setRes: (v: string) => void;
  fps: number;
  setFps: (v: number) => void;
  outputFormat: string;
  setOutputFormat: (v: string) => void;
  vBitrate: number;
  setVBitrate: (v: number) => void;
  aBitrate: number;
  setABitrate: (v: number) => void;
  muteDuringExport: boolean;
  setMuteDuringExport: (v: boolean) => void;
  effectiveSize: { w: number; h: number };
  exporting: boolean;
  exportProgress: number;
  exportError: string;
  runExport: () => Promise<Blob | null>;
}

export function ExportSettings(props: ExportSettingsProps) {
  const {
    openSections, toggleSection, ready,
    aspect, setAspect, res, setRes, fps, setFps,
    outputFormat, setOutputFormat, vBitrate, setVBitrate, aBitrate, setABitrate,
    muteDuringExport, setMuteDuringExport, effectiveSize,
    exporting, exportProgress, exportError, runExport
  } = props;
  if (!ready) return null;
  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('export')}>
        <span className={`chevron ${openSections.export ? 'open' : ''}`}>▶</span>
        Export
      </div>
      {openSections.export && (
        <div className="section-body">
          <div className="field-row">
            <label>Aspect
              <select value={aspect} onChange={e => setAspect(e.target.value)}>
                <option value='16:9'>16:9</option><option value='9:16'>9:16</option>
              </select>
            </label>
            <label>Res
              <select value={res} onChange={e => setRes(e.target.value)}>
                <option value='360'>360p</option><option value='480'>480p</option>
                <option value='720'>720p</option><option value='1080'>1080p</option>
              </select>
            </label>
            <label>FPS
              <select value={fps} onChange={e => setFps(parseInt(e.target.value, 10))}>
                <option value={24}>24</option><option value={30}>30</option><option value={60}>60</option>
              </select>
            </label>
          </div>
          <div className="field-row">
            <label>Format
              <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}>
                <option value='mp4'>MP4</option><option value='webm'>WebM</option>
              </select>
            </label>
            <label>Video
              <select value={vBitrate} onChange={e => setVBitrate(parseInt(e.target.value, 10))}>
                <option value={2000}>2 Mbps</option><option value={4000}>4 Mbps</option>
                <option value={6000}>6 Mbps</option><option value={8000}>8 Mbps</option>
                <option value={12000}>12 Mbps</option>
              </select>
            </label>
            <label>Audio
              <select value={aBitrate} onChange={e => setABitrate(parseInt(e.target.value, 10))}>
                <option value={128}>128k</option><option value={160}>160k</option>
                <option value={192}>192k</option><option value={256}>256k</option>
                <option value={320}>320k</option>
              </select>
            </label>
          </div>
          <div className="field-row">
            <label><input type='checkbox' checked={muteDuringExport} onChange={e => setMuteDuringExport(e.target.checked)} /> Mute during export</label>
            <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 'auto' }}>{effectiveSize.w}×{effectiveSize.h}</span>
          </div>
          <button disabled={exporting} onClick={async () => {
            const blob = await runExport();
            if (blob) {
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `visualizer_${res}_${aspect.replace(':','-')}.webm`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            }
          }}>Export</button>
          {exporting && (
            <div className="field-row">
              <div style={{ flex: 1, height: 6, background: 'var(--panelBorder)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(exportProgress * 100)}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{Math.round(exportProgress * 100)}%</span>
            </div>
          )}
          {exportError && <div style={{ color: '#ff6b6b', fontSize: 11 }}>{exportError}</div>}
        </div>
      )}
    </div>
  );
}
