import React from 'react';

interface CameraSettingsProps {
  open: boolean;
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  dancerOverlaySources: any;
  setDancerOverlaySources: (cb: (s: any) => any) => void;
}

export function CameraSettings({ open, openSections, toggleSection, dancerOverlaySources, setDancerOverlaySources }: CameraSettingsProps) {
  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('camera')}>
        <span className={`chevron ${openSections.camera ? 'open' : ''}`}>▶</span>
        Camera
      </div>
      {openSections.camera && (
        <div className="section-body">
          <div className="field-row">
            <label>Movement
              <select value={dancerOverlaySources.cameraMode ?? 'static'} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraMode: e.target.value }))}>
                <option value="static">Static</option>
                <option value="pan">Pan</option>
                <option value="rotate">Rotate</option>
              </select>
            </label>
          </div>
          <div className="field-row">
            <label>Elevation
              <input type='range' min={-20} max={20} value={Math.round((dancerOverlaySources.cameraElevationPct ?? 0) * 100)} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraElevationPct: parseInt(e.target.value, 10) / 100 }))} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{Math.round((dancerOverlaySources.cameraElevationPct ?? 0) * 100)}%</span>
            </label>
          </div>
          <div className="field-row">
            <label>Tilt
              <input type='range' min={-15} max={15} value={Math.round(dancerOverlaySources.cameraTiltDeg ?? 0)} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraTiltDeg: parseInt(e.target.value, 10) }))} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{Math.round(dancerOverlaySources.cameraTiltDeg ?? 0)}°</span>
            </label>
          </div>
          <div className="field-row">
            <label>Speed
              <input type='range' min={0} max={200} value={dancerOverlaySources.cameraSpeed ?? 100} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraSpeed: parseInt(e.target.value, 10) }))} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{dancerOverlaySources.cameraSpeed ?? 100}%</span>
            </label>
          </div>
          <div className="field-row">
            <label>Distance
              <input type='range' min={20} max={200} value={dancerOverlaySources.cameraDistance ?? 100} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraDistance: parseInt(e.target.value, 10) }))} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{dancerOverlaySources.cameraDistance ?? 100}%</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
