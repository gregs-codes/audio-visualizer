import React from 'react';

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
}

export function GeneralSettings(props: GeneralSettingsProps) {
  const {
    openSections, toggleSection, layout, setLayout, theme, setTheme, color, setColor,
    bgMode, setBgMode, bgColor, setBgColor, bgImageUrl, setBgImageUrl, bgFit, setBgFit, bgOpacity, setBgOpacity,
    bgVideoUrls, setBgVideoUrls, bgVideoZoom, setBgVideoZoom, bgVideoOffsetX, setBgVideoOffsetX, bgVideoOffsetY, setBgVideoOffsetY,
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
                    if (f) setBgImageUrl(URL.createObjectURL(f));
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
          </div>
        </div>
      )}
    </div>
  );
}
