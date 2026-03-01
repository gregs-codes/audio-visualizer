import React from 'react';
import { DancerPreview } from '../visualizer/dancer/DancerPreview';

interface CharacterSettingsProps {
  open: boolean;
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  showDancer: boolean;
  setShowDancer: (v: boolean) => void;
  dancerPos: string;
  setDancerPos: (v: string) => void;
  dancerSize: number;
  setDancerSize: (v: number) => void;
  dancerOverlaySources: any;
  setDancerOverlaySources: (cb: (s: any) => any) => void;
  charFiles: string[];
  animFiles: string[];
  analyserNode: any;
}

const POS_GRID = [
  ['lt','mt','rt'],
  ['lm','mm','rm'],
  ['lb','mb','rb'],
];
const POS_ICONS: Record<string, string> = {
  lt:'↖', mt:'↑', rt:'↗', lm:'←', mm:'·', rm:'→', lb:'↙', mb:'↓', rb:'↘',
};

const shortName = (path: string) =>
  path.replace('/character/', '').replace('/dance/', '').replace('.fbx', '').replace(/_/g, ' ');

export function CharacterSettings({ openSections, toggleSection, showDancer, setShowDancer, dancerPos, setDancerPos, dancerSize, setDancerSize, dancerOverlaySources, setDancerOverlaySources, charFiles, animFiles, analyserNode }: CharacterSettingsProps) {
  const selectedAnims: string[] = dancerOverlaySources.animationUrls ?? [];

  const toggleAnim = (url: string) => {
    setDancerOverlaySources((s: any) => {
      const prev: string[] = s.animationUrls ?? [];
      const next = prev.includes(url) ? prev.filter(a => a !== url) : [...prev, url];
      return { ...s, animationUrls: next };
    });
  };

  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('character')}>
        <span className={`chevron ${openSections.character ? 'open' : ''}`}>▶</span>
        3D Character
        {showDancer && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--accent)', fontWeight: 700, letterSpacing: 0 }}>LIVE</span>}
      </div>

      {openSections.character && (
        <div className="section-body">

          {/* Enable toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowDancer(!showDancer)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8, fontWeight: 600, fontSize: 11,
                background: showDancer ? 'rgba(0,229,160,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showDancer ? 'rgba(0,229,160,0.4)' : 'var(--panelBorder)'}`,
                color: showDancer ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              {showDancer ? '● Visible on Canvas' : '○ Hidden'}
            </button>
          </div>

          {/* Character selection — pill grid */}
          <div className="field-label">Character</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {charFiles.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No character files found</span>
            )}
            {charFiles.map(c => {
              const active = dancerOverlaySources.characterUrl === c;
              return (
                <button
                  key={c}
                  onClick={() => setDancerOverlaySources((s: any) => ({ ...s, characterUrl: c }))}
                  style={{
                    padding: '3px 9px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
                    background: active ? 'rgba(0,229,160,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(0,229,160,0.45)' : 'var(--panelBorder)'}`,
                    color: active ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {shortName(c)}
                </button>
              );
            })}
          </div>

          {/* Animations — toggle pills */}
          <div className="field-label" style={{ marginTop: 4 }}>
            Animations
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 400, color: 'var(--muted)' }}>tap to add/remove</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {animFiles.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No animation files found</span>
            )}
            {animFiles.map(a => {
              const active = selectedAnims.includes(a);
              return (
                <button
                  key={a}
                  onClick={() => toggleAnim(a)}
                  style={{
                    padding: '3px 9px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
                    background: active ? 'rgba(77,168,255,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(77,168,255,0.45)' : 'var(--panelBorder)'}`,
                    color: active ? 'var(--accent2)' : 'var(--muted)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {active ? '✓ ' : ''}{shortName(a)}
                </button>
              );
            })}
          </div>
          {selectedAnims.length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {selectedAnims.length} animation{selectedAnims.length > 1 ? 's' : ''} queued — will cycle randomly
            </div>
          )}

          {/* Position grid */}
          <div className="field-label" style={{ marginTop: 4 }}>Position on Canvas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3, width: 96 }}>
            {POS_GRID.flat().map(pos => (
              <button
                key={pos}
                onClick={() => setDancerPos(pos)}
                title={pos}
                style={{
                  height: 28, borderRadius: 5, fontSize: 14, cursor: 'pointer', padding: 0,
                  background: dancerPos === pos ? 'rgba(0,229,160,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${dancerPos === pos ? 'rgba(0,229,160,0.45)' : 'var(--panelBorder)'}`,
                  color: dancerPos === pos ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {POS_ICONS[pos]}
              </button>
            ))}
          </div>

          {/* Size slider */}
          <div className="field-label" style={{ marginTop: 4 }}>Size — {dancerSize}%</div>
          <input
            type="range" min={10} max={100} value={dancerSize}
            onChange={e => setDancerSize(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
          />

          {/* Lighting */}
          <div className="field-label" style={{ marginTop: 4 }}>Lighting Effects</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setDancerOverlaySources((s: any) => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), enabled: !s.colorFlash?.enabled } }))}
              style={{
                padding: '3px 9px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
                background: dancerOverlaySources.colorFlash?.enabled ? 'rgba(255,180,0,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${dancerOverlaySources.colorFlash?.enabled ? 'rgba(255,180,0,0.45)' : 'var(--panelBorder)'}`,
                color: dancerOverlaySources.colorFlash?.enabled ? '#ffb400' : 'var(--muted)',
              }}
            >
              ⚡ Flash
            </button>
            <button
              onClick={() => setDancerOverlaySources((s: any) => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), rays: !s.colorFlash?.rays } }))}
              style={{
                padding: '3px 9px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
                background: dancerOverlaySources.colorFlash?.rays ? 'rgba(255,100,200,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${dancerOverlaySources.colorFlash?.rays ? 'rgba(255,100,200,0.45)' : 'var(--panelBorder)'}`,
                color: dancerOverlaySources.colorFlash?.rays ? '#ff64c8' : 'var(--muted)',
              }}
            >
              ✦ Rays
            </button>
            <button
              onClick={() => setDancerOverlaySources((s: any) => ({ ...s, discoBall: { ...(s.discoBall ?? {}), enabled: !s.discoBall?.enabled } }))}
              style={{
                padding: '3px 9px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
                background: dancerOverlaySources.discoBall?.enabled ? 'rgba(100,200,255,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${dancerOverlaySources.discoBall?.enabled ? 'rgba(100,200,255,0.45)' : 'var(--panelBorder)'}`,
                color: dancerOverlaySources.discoBall?.enabled ? '#64c8ff' : 'var(--muted)',
              }}
            >
              🪩 Disco
            </button>
            {dancerOverlaySources.colorFlash?.enabled && (
              <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 2, width: '100%' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Colors:</span>
                {[0, 1, 2].map(i => (
                  <input key={i} type="color"
                    value={dancerOverlaySources.colorFlash?.colors?.[i] ?? ['#ffffff','#ff0080','#00d08a'][i]}
                    onChange={e => setDancerOverlaySources((s: any) => {
                      const colors = [...(s.colorFlash?.colors ?? ['#ffffff','#ff0080','#00d08a'])];
                      colors[i] = e.target.value;
                      return { ...s, colorFlash: { ...(s.colorFlash ?? {}), colors } };
                    })}
                  />
                ))}
                <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>
                  Intensity {Math.round((dancerOverlaySources.colorFlash?.intensity ?? 1) * 100)}%
                </span>
                <input type="range" min={0} max={100} style={{ flex: 1 }}
                  value={Math.round((dancerOverlaySources.colorFlash?.intensity ?? 1) * 100)}
                  onChange={e => setDancerOverlaySources((s: any) => ({
                    ...s, colorFlash: { ...(s.colorFlash ?? {}), intensity: parseInt(e.target.value, 10) / 100 }
                  }))}
                />
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="field-label" style={{ marginTop: 6 }}>Preview</div>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--panelBorder)' }}>
            <DancerPreview sources={dancerOverlaySources} analyser={analyserNode} width={280} height={158} panelKey="overlay-preview" />
          </div>
        </div>
      )}
    </div>
  );
}

