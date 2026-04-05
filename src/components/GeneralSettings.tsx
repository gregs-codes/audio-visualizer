import React from 'react';
import type { BgCharacterSettings } from '../visualizer/dancer/BgCharacterEngine';

interface GeneralSettingsProps {
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  layout: string;
  setLayout: (v: string) => void;
  theme: string;
  setTheme: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  bgMode: string;
  setBgMode: (v: string) => void;
  bgColor: string;
  setBgColor: (v: string) => void;
  bgImageUrl: string;
  setBgImageUrl: (v: string) => void;
  bgFit: string;
  setBgFit: (v: string) => void;
  bgOpacity: number;
  setBgOpacity: (v: number) => void;
  bgVideoUrls: string[];
  setBgVideoUrls: (v: string[]) => void;
  bgVideoZoom: number;
  setBgVideoZoom: (v: number) => void;
  bgVideoOffsetX: number;
  setBgVideoOffsetX: (v: number) => void;
  bgVideoOffsetY: number;
  setBgVideoOffsetY: (v: number) => void;
  bgCharacterSettings: BgCharacterSettings;
  setBgCharacterSettings: (cb: (s: BgCharacterSettings) => BgCharacterSettings) => void;
  bgClipNames: string[];
}

export function GeneralSettings(props: GeneralSettingsProps) {
  const {
    openSections, toggleSection, layout, setLayout, theme, setTheme, color, setColor,
    bgMode, setBgMode, bgColor, setBgColor, bgImageUrl, setBgImageUrl, bgFit, setBgFit, bgOpacity, setBgOpacity,
    bgVideoUrls, setBgVideoUrls, bgVideoZoom, setBgVideoZoom, bgVideoOffsetX, setBgVideoOffsetX, bgVideoOffsetY, setBgVideoOffsetY,
    bgCharacterSettings, setBgCharacterSettings, bgClipNames,
  } = props;
  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('general')}>
        <span className={`chevron ${openSections.general ? 'open' : ''}`}>▶</span>
        General
      </div>
      {openSections.general && (
        <div className="section-body">
          <div className="field-row">
            <label>Layout
              <select value={layout} onChange={e => setLayout(e.target.value)}>
                <option value='1'>1</option>
                <option value='2-horizontal'>2 Horizontal</option>
                <option value='2-vertical'>2 Vertical</option>
                <option value='4'>4</option>
              </select>
            </label>
          </div>
          <div className="field-row">
            <label>Theme
              <select value={theme} onChange={e => setTheme(e.target.value)}>
                <option value='dark'>Dark</option>
                <option value='light'>Light</option>
                <option value='neon'>Neon</option>
              </select>
            </label>
            <label>Accent
              <input type='color' value={color} onChange={e => setColor(e.target.value)} />
              <span className="swatch" style={{ background: color }} />
            </label>
          </div>
          <div className="field-row">
            <label>Background
              <select value={bgMode} onChange={e => setBgMode(e.target.value)}>
                <option value='none'>None</option>
                <option value='color'>Color</option>
                <option value='image'>Image</option>
                <option value='video'>Video (Scenes)</option>
                <option value='character'>3D Character</option>
                <optgroup label="Parallax">
                  <option value='parallax-spotlights'>Parallax (Spotlights)</option>
                  <option value='parallax-lasers'>Parallax (Lasers)</option>
                  <option value='parallax-tunnel'>Parallax (Tunnel/Starfield)</option>
                  <option value='parallax-rays'>Parallax (Rays)</option>
                </optgroup>
                <optgroup label="Audio Visualizer BG">
                  <option value='bg-viz-bars'>Viz BG (Bars)</option>
                  <option value='bg-viz-radial'>Viz BG (Radial)</option>
                  <option value='bg-viz-orbs'>Viz BG (Orbs)</option>
                </optgroup>
              </select>
            </label>
            {bgMode === 'color' && (
              <>
                <label>
                  <input type='color' value={bgColor} onChange={e => setBgColor(e.target.value)} />
                  <span className="swatch" style={{ background: bgColor }} />
                </label>
                <label>Opacity
                  <input type='range' min={0} max={100} value={Math.round(bgOpacity * 100)} onChange={e => setBgOpacity(parseInt(e.target.value, 10) / 100)} />
                  <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{Math.round(bgOpacity * 100)}%</span>
                </label>
              </>
            )}
            {(bgMode === 'bg-viz-bars' || bgMode === 'bg-viz-radial' || bgMode === 'bg-viz-orbs') && (
              <>
                <label>Tint
                  <input type='color' value={bgColor} onChange={e => setBgColor(e.target.value)} />
                  <span className="swatch" style={{ background: bgColor }} />
                </label>
              </>
            )}
            {bgMode === 'image' && (
              <>
                <div className="upload" style={{ position: 'relative' }}>
                  <button className="icon-btn" aria-label="Upload Background">+ Bg</button>
                  <input type='file' accept='image/*' style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (bgImageUrl?.startsWith('blob:')) URL.revokeObjectURL(bgImageUrl);
                      setBgImageUrl(URL.createObjectURL(f));
                    }
                  }} />
                </div>
                <select value={bgFit} onChange={e => setBgFit(e.target.value)}>
                  <option value='cover'>Cover</option>
                  <option value='contain'>Contain</option>
                  <option value='stretch'>Stretch</option>
                </select>
                <label>Opacity
                  <input type='range' min={0} max={100} value={Math.round(bgOpacity * 100)} onChange={e => setBgOpacity(parseInt(e.target.value, 10) / 100)} />
                  <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{Math.round(bgOpacity * 100)}%</span>
                </label>
              </>
            )}
            {bgMode === 'video' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, width: '100%' }}>
                <div className="field-row">
                  <label>Fit
                    <select value={bgFit} onChange={e => setBgFit(e.target.value)}>
                      <option value='cover'>Cover</option>
                      <option value='contain'>Contain</option>
                      <option value='stretch'>Stretch</option>
                    </select>
                  </label>
                  <label>Zoom
                    <input type='range' min={100} max={300} value={Math.round(bgVideoZoom * 100)} onChange={e => setBgVideoZoom(parseInt(e.target.value, 10) / 100)} />
                    <span style={{ width: 36, textAlign: 'right', fontSize: 11 }}>{Math.round(bgVideoZoom * 100)}%</span>
                  </label>
                </div>
                <div className="field-row">
                  <label>X
                    <input type='range' min={-100} max={100} value={bgVideoOffsetX} onChange={e => setBgVideoOffsetX(parseInt(e.target.value, 10))} />
                    <span style={{ width: 36, textAlign: 'right', fontSize: 11 }}>{bgVideoOffsetX > 0 ? '+' : ''}{bgVideoOffsetX}%</span>
                  </label>
                  <label>Y
                    <input type='range' min={-100} max={100} value={bgVideoOffsetY} onChange={e => setBgVideoOffsetY(parseInt(e.target.value, 10))} />
                    <span style={{ width: 36, textAlign: 'right', fontSize: 11 }}>{bgVideoOffsetY > 0 ? '+' : ''}{bgVideoOffsetY}%</span>
                  </label>
                </div>
                {bgVideoUrls.map((url, i) => (
                  <div key={i} className="field-row" style={{ gap: 4, alignItems: 'center' }}>
                    <button className="icon-btn" style={{ color: '#ff6b6b', minWidth: 24 }} onClick={() => {
                      URL.revokeObjectURL(url);
                      setBgVideoUrls(bgVideoUrls.filter((_, j) => j !== i));
                    }}>✕</button>
                    <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Scene {i + 1}</span>
                    <div className="upload" style={{ position: 'relative' }}>
                      <button className="icon-btn" style={{ fontSize: 11 }}>Change</button>
                      <input type='file' accept='video/*' style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        URL.revokeObjectURL(url);
                        const next = bgVideoUrls.slice();
                        next[i] = URL.createObjectURL(f);
                        setBgVideoUrls(next);
                      }} />
                    </div>
                  </div>
                ))}
                <div className="upload" style={{ position: 'relative', display: 'inline-block' }}>
                  <button className="icon-btn">+ Add Scene</button>
                  <input type='file' accept='video/*' style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setBgVideoUrls([...bgVideoUrls, URL.createObjectURL(f)]);
                  }} />
                </div>
              </div>
            )}
            {bgMode === 'character' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, width: '100%' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>FBX / GLB File (with embedded animations)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {bgCharacterSettings.url && (
                    <span style={{ fontSize: 10, color: 'var(--accent)', padding: '2px 8px', borderRadius: 99, background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.3)' }}>
                      {bgCharacterSettings.url.startsWith('blob:') ? 'Custom file loaded ✓' : bgCharacterSettings.url.replace('/character/', '').replace('.fbx', '').replace(/_/g, ' ')}
                    </span>
                  )}
                  <div className="upload" style={{ position: 'relative' }}>
                    <button className="icon-btn" style={{ fontSize: 10 }}>+ Upload FBX / GLB</button>
                    <input type='file' accept='.fbx,.glb,.gltf' style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const ext = f.name.split('.').pop()?.toLowerCase() ?? 'fbx';
                        if (bgCharacterSettings.url?.startsWith('blob:')) URL.revokeObjectURL(bgCharacterSettings.url);
                        setBgCharacterSettings(s => ({ ...s, url: URL.createObjectURL(f), fileExt: ext }));
                      }
                    }} />
                  </div>
                </div>

                {bgClipNames.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Animations ({bgClipNames.length} found)</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <button
                        onClick={() => setBgCharacterSettings(s => ({ ...s, animIndex: -1 }))}
                        style={{ padding: '3px 9px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
                          background: (bgCharacterSettings.animIndex ?? -1) === -1 ? 'rgba(0,229,160,0.18)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${(bgCharacterSettings.animIndex ?? -1) === -1 ? 'rgba(0,229,160,0.45)' : 'var(--panelBorder)'}`,
                          color: (bgCharacterSettings.animIndex ?? -1) === -1 ? 'var(--accent)' : 'var(--muted)' }}>
                        🔀 Auto-cycle
                      </button>
                      {bgClipNames.map((name, i) => {
                        const active = bgCharacterSettings.animIndex === i;
                        return (
                          <button key={i} onClick={() => setBgCharacterSettings(s => ({ ...s, animIndex: i }))}
                            style={{ padding: '3px 9px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
                              background: active ? 'rgba(77,168,255,0.18)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${active ? 'rgba(77,168,255,0.45)' : 'var(--panelBorder)'}`,
                              color: active ? '#7aa2ff' : 'var(--muted)', fontWeight: active ? 700 : 400 }}>
                            {active ? '▶ ' : ''}{name || `Clip ${i + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 4 }}>Model</span>
                <div className="field-row">
                  <label>Rotation Y
                    <input type='range' min={0} max={360} value={bgCharacterSettings.rotationY ?? 0} onChange={e => setBgCharacterSettings(s => ({ ...s, rotationY: parseInt(e.target.value, 10) }))} />
                    <span style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{bgCharacterSettings.rotationY ?? 0}°</span>
                  </label>
                  <label>Vertical Shift
                    <input type='range' min={-100} max={100} value={bgCharacterSettings.verticalShift ?? 0} onChange={e => setBgCharacterSettings(s => ({ ...s, verticalShift: parseInt(e.target.value, 10) }))} />
                    <span style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{bgCharacterSettings.verticalShift ?? 0}</span>
                  </label>
                </div>

                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 4 }}>Camera</span>
                <div className="field-row">
                  <label>Mode
                    <select value={bgCharacterSettings.mode ?? 'static'} onChange={e => setBgCharacterSettings(s => ({ ...s, mode: e.target.value as any }))}>
                      <option value="static">Static</option>
                      <option value="pan">Pan</option>
                      <option value="rotate">Rotate</option>
                    </select>
                  </label>
                  <label>Distance
                    <input type='range' min={20} max={500} value={bgCharacterSettings.distance ?? 100} onChange={e => setBgCharacterSettings(s => ({ ...s, distance: parseInt(e.target.value, 10) }))} />
                    <span style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{bgCharacterSettings.distance ?? 100}%</span>
                  </label>
                </div>
                <div className="field-row">
                  <label>Look Height
                    <input type='range' min={0} max={100} value={bgCharacterSettings.lookHeight ?? 60} onChange={e => setBgCharacterSettings(s => ({ ...s, lookHeight: parseInt(e.target.value, 10) }))} />
                    <span style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{bgCharacterSettings.lookHeight ?? 60}%</span>
                  </label>
                  <label>FOV
                    <input type='range' min={10} max={120} value={bgCharacterSettings.fov ?? 45} onChange={e => setBgCharacterSettings(s => ({ ...s, fov: parseInt(e.target.value, 10) }))} />
                    <span style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{bgCharacterSettings.fov ?? 45}</span>
                  </label>
                </div>
                <div className="field-row">
                  <label>Elevation
                    <input type='range' min={-50} max={50} value={bgCharacterSettings.elevation ?? 0} onChange={e => setBgCharacterSettings(s => ({ ...s, elevation: parseInt(e.target.value, 10) }))} />
                    <span style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{bgCharacterSettings.elevation ?? 0}%</span>
                  </label>
                  <label>Tilt
                    <input type='range' min={-30} max={30} value={bgCharacterSettings.tilt ?? 0} onChange={e => setBgCharacterSettings(s => ({ ...s, tilt: parseInt(e.target.value, 10) }))} />
                    <span style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{bgCharacterSettings.tilt ?? 0}°</span>
                  </label>
                </div>
                {(bgCharacterSettings.mode === 'pan' || bgCharacterSettings.mode === 'rotate') && (
                  <div className="field-row">
                    <label>Speed
                      <input type='range' min={0} max={200} value={bgCharacterSettings.speed ?? 100} onChange={e => setBgCharacterSettings(s => ({ ...s, speed: parseInt(e.target.value, 10) }))} />
                      <span style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{bgCharacterSettings.speed ?? 100}%</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
