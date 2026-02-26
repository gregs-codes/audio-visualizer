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

export function CharacterSettings({ openSections, toggleSection, showDancer, setShowDancer, dancerPos, setDancerPos, dancerSize, setDancerSize, dancerOverlaySources, setDancerOverlaySources, charFiles, animFiles, analyserNode }: CharacterSettingsProps) {
  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('character')}>
        <span className={`chevron ${openSections.character ? 'open' : ''}`}>▶</span>
        3D Character
      </div>
      {openSections.character && (
        <div className="section-body">
          <div className="field-row">
            <label><input type='checkbox' checked={showDancer} onChange={e => setShowDancer(e.target.checked)} /> Show Character</label>
          </div>
          <div className="field-row">
            <label>Position
              <select value={dancerPos} onChange={e => setDancerPos(e.target.value)}>
                <option value='lt'>Left Top</option><option value='mt'>Mid Top</option><option value='rt'>Right Top</option>
                <option value='lm'>Left Mid</option><option value='mm'>Middle</option><option value='rm'>Right Mid</option>
                <option value='lb'>Left Bottom</option><option value='mb'>Mid Bottom</option><option value='rb'>Right Bottom</option>
              </select>
            </label>
          </div>
          <div className="field-row">
            <label>Size
              <input type='range' min={10} max={100} value={dancerSize} onChange={e => setDancerSize(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{dancerSize}%</span>
            </label>
          </div>
          <div className="field-row">
            <label>Character
              <select value={dancerOverlaySources.characterUrl ?? ''} onChange={e => setDancerOverlaySources(s => ({ ...s, characterUrl: e.target.value }))}>
                <option value="">Select…</option>
                {charFiles.map(c => <option key={c} value={c}>{c.replace('/character/','')}</option>)}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label>FBX Path
              <input placeholder="/character/hero.fbx" value={dancerOverlaySources.characterUrl ?? ''} onChange={e => setDancerOverlaySources(s => ({ ...s, characterUrl: e.target.value }))} style={{ flex: 1 }} />
            </label>
          </div>
          <div className="field-label" style={{ marginTop: 4 }}>Animations</div>
          <select multiple size={3} value={dancerOverlaySources.animationUrls ?? []} onChange={e => {
            const selected: string[] = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value);
            setDancerOverlaySources(s => ({ ...s, animationUrls: selected }));
          }} style={{ fontSize: 11 }}>
            {animFiles.map(a => <option key={a} value={a}>{a.replace('/dance/','')}</option>)}
          </select>
          <input placeholder="Comma-separated paths" value={(dancerOverlaySources.animationUrls ?? []).join(', ')} onChange={e => {
            const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            setDancerOverlaySources(s => ({ ...s, animationUrls: list }));
          }} style={{ fontSize: 11 }} />

          {/* Color Flash */}
          <div className="field-label" style={{ marginTop: 4 }}>Lighting</div>
          <div className="field-row">
            <label><input type='checkbox' checked={!!dancerOverlaySources.colorFlash?.enabled} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), enabled: e.target.checked } }))} /> Flash</label>
            <select value={(dancerOverlaySources.colorFlash?.mode) ?? 'flash'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), mode: e.target.value } }))}>
              <option value='flash'>Flash</option><option value='strobe'>Strobe</option><option value='spot'>Spot</option>
            </select>
            <input type='color' value={dancerOverlaySources.colorFlash?.colors?.[0] ?? '#ffffff'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), colors: [e.target.value, s.colorFlash?.colors?.[1] ?? '#ff0080', s.colorFlash?.colors?.[2] ?? '#00d08a'], color: e.target.value } }))} />
            <input type='color' value={dancerOverlaySources.colorFlash?.colors?.[1] ?? '#ff0080'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), colors: [s.colorFlash?.colors?.[0] ?? '#ffffff', e.target.value, s.colorFlash?.colors?.[2] ?? '#00d08a'] } }))} />
            <input type='color' value={dancerOverlaySources.colorFlash?.colors?.[2] ?? '#00d08a'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), colors: [s.colorFlash?.colors?.[0] ?? '#ffffff', s.colorFlash?.colors?.[1] ?? '#ff0080', e.target.value] } }))} />
          </div>
          <div className="field-row">
            <label>Intensity
              <input type='range' min={0} max={100} value={Math.round((dancerOverlaySources.colorFlash?.intensity ?? 1) * 100)} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), intensity: parseInt(e.target.value, 10) / 100 } }))} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{Math.round((dancerOverlaySources.colorFlash?.intensity ?? 1) * 100)}%</span>
            </label>
            <label><input type='checkbox' checked={!!dancerOverlaySources.colorFlash?.rays} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), rays: e.target.checked } }))} /> Rays</label>
            <label><input type='checkbox' checked={!!dancerOverlaySources.discoBall?.enabled} onChange={e => setDancerOverlaySources(s => ({ ...s, discoBall: { ...(s.discoBall ?? {}), enabled: e.target.checked } }))} /> Disco Ball</label>
          </div>
          {/* Preview */}
          <DancerPreview sources={dancerOverlaySources} analyser={analyserNode} width={200} height={112} panelKey="overlay-preview" />
        </div>
      )}
    </div>
  );
}
