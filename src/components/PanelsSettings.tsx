import React, { useState } from 'react';

interface PanelsSettingsProps {
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  panels: any[];
  setPanels: (cb: (old: any[]) => any[]) => void;
  VISUALIZER_CATEGORIES: Record<string, readonly string[]>;
  LABELS: Record<string, string>;
  CUSTOM_MODES: any[];
  defaultPanelColors: { low: string; mid: string; high: string };
}

export function PanelsSettings({ openSections, toggleSection, panels, setPanels, VISUALIZER_CATEGORIES, LABELS, CUSTOM_MODES, defaultPanelColors }: PanelsSettingsProps) {
  // Track expanded category for each panel
  const [expandedCategories, setExpandedCategories] = useState<Record<number, string | null>>({});

  const toggleCategory = (panelIndex: number, category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [panelIndex]: prev[panelIndex] === category ? null : category
    }));
  };

  // Create labels map that includes CUSTOM_MODES
  const allLabels = {
    ...LABELS,
    ...Object.fromEntries(CUSTOM_MODES.map(m => [m.key, m.label]))
  };

  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('panels')}>
        <span className={`chevron ${openSections.panels ? 'open' : ''}`}>▶</span>
        Panels
      </div>
      {openSections.panels && (
        <div className="section-body">
          {panels.map((p, i) => (
            <div key={i} style={{ display: 'grid', gap: 6, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="field-label">Panel {i + 1}</div>
              
              {/* Category selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(VISUALIZER_CATEGORIES).map(([category, modes]) => {
                  const isExpanded = expandedCategories[i] === category;
                  const currentModeInCategory = modes.includes(p.mode as any);
                  
                  return (
                    <div key={category} style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        onClick={() => toggleCategory(i, category)}
                        style={{
                          padding: '6px 10px',
                          background: currentModeInCategory ? 'rgba(100,150,255,0.2)' : 'rgba(255,255,255,0.05)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '13px',
                          fontWeight: currentModeInCategory ? 600 : 400,
                        }}
                      >
                        <span>{category}</span>
                        <span style={{ fontSize: '10px', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                      </div>
                      
                      {isExpanded && (
                        <div style={{ padding: '4px', background: 'rgba(0,0,0,0.3)' }}>
                          {modes.map((mode) => (
                            <div
                              key={mode}
                              onClick={() => {
                                setPanels(old => old.map((x, idx) => idx === i ? { ...x, mode } : x));
                              }}
                              style={{
                                padding: '6px 10px',
                                cursor: 'pointer',
                                background: p.mode === mode ? 'rgba(100,150,255,0.4)' : 'transparent',
                                borderRadius: 3,
                                fontSize: '12px',
                                marginBottom: 2,
                              }}
                            >
                              {allLabels[mode] || mode}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Band and color controls */}
              <div className="field-row">
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