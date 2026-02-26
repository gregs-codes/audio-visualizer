import React from 'react';

interface PanelsSettingsProps {
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  panels: any[];
  setPanels: (cb: (old: any[]) => any[]) => void;
  VISUALIZER_MODES: any[];
  LABELS: Record<string, string>;
  CUSTOM_MODES: any[];
  defaultPanelColors: { low: string; mid: string; high: string };
}

export function PanelsSettings({ openSections, toggleSection, panels, setPanels, VISUALIZER_MODES, LABELS, CUSTOM_MODES, defaultPanelColors }: PanelsSettingsProps) {
  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('panels')}>
        <span className={`chevron ${openSections.panels ? 'open' : ''}`}>▶</span>
        Panels
      </div>
      {openSections.panels && (
        <div className="section-body">
          {panels.map((p, i) => (
            <div key={i} style={{ display: 'grid', gap: 6 }}>
              <div className="field-label">Panel {i + 1}</div>
              <div className="field-row">
                <select value={p.mode} onChange={e => {
                  const val = e.target.value;
                  setPanels(old => old.map((x, idx) => idx === i ? { ...x, mode: val } : x));
                }}>
                  {[...VISUALIZER_MODES.filter(m => m !== 'dancer-fbx').map(m => ({ key: m, label: LABELS[m] })), ...CUSTOM_MODES].map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <select value={p.band} onChange={e => {
                  const val = e.target.value;
                  setPanels(old => old.map((x, idx) => idx === i ? { ...x, band: val } : x));
                }}>
                  <option value='full'>Full</option>
                  <option value='bass'>Bass</option>
                  <option value='mid'>Mid</option>
                  <option value='voice'>Voice</option>
                  <option value='treble'>Treble</option>
                </select>
                {(['high-graphics-fog','high-graphics-trunk','high-graphics-rings','high-graphics-net','high-graphics-rings-trails','high-graphics-flow-field','high-graphics-hexagon']).includes(p.mode) && (
                  <select value={p.hgView ?? 'top'} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, hgView: e.target.value } : x))}>
                    <option value='top'>Top</option>
                    <option value='side'>Side</option>
                  </select>
                )}
                <input type='color' value={p.color} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, color: e.target.value } : x))} />
                <span className="swatch" style={{ background: p.color }} />
              </div>
              {p.mode !== 'wave' && (
                <div className="field-row">
                  <label>Low <input type='color' value={p.colors?.low ?? defaultPanelColors.low} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), low: e.target.value } } : x))} /> <span className="swatch" style={{ background: p.colors?.low ?? defaultPanelColors.low, width: 12, height: 12 }} /></label>
                  <label>Mid <input type='color' value={p.colors?.mid ?? defaultPanelColors.mid} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), mid: e.target.value } } : x))} /> <span className="swatch" style={{ background: p.colors?.mid ?? defaultPanelColors.mid, width: 12, height: 12 }} /></label>
                  <label>High <input type='color' value={p.colors?.high ?? defaultPanelColors.high} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), high: e.target.value } } : x))} /> <span className="swatch" style={{ background: p.colors?.high ?? defaultPanelColors.high, width: 12, height: 12 }} /></label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
