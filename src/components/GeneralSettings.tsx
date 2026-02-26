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
}

export function GeneralSettings(props: GeneralSettingsProps) {
  const {
    openSections, toggleSection, layout, setLayout, theme, setTheme, color, setColor,
    bgMode, setBgMode, bgColor, setBgColor, bgImageUrl, setBgImageUrl, bgFit, setBgFit, bgOpacity, setBgOpacity
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
                <option value='parallax-spotlights'>Parallax (Spotlights)</option>
                <option value='parallax-lasers'>Parallax (Lasers)</option>
                <option value='parallax-tunnel'>Parallax (Tunnel/Starfield)</option>
                <option value='parallax-rays'>Parallax (Rays)</option>
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
          </div>
        </div>
      )}
    </div>
  );
}
