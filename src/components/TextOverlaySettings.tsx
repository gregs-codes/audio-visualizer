import React from 'react';

interface TextOverlaySettingsProps {
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  introSecs: number;
  setIntroSecs: (v: number) => void;
  outroSecs: number;
  setOutroSecs: (v: number) => void;
  title: string;
  setTitle: (v: string) => void;
  titlePos: string;
  setTitlePos: (v: string) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
  titleFx: any;
  setTitleFx: (cb: (s: any) => any) => void;
  desc: string;
  setDesc: (v: string) => void;
  descPos: string;
  setDescPos: (v: string) => void;
  descColor: string;
  setDescColor: (v: string) => void;
  descFx: any;
  setDescFx: (cb: (s: any) => any) => void;
  countPos: string;
  setCountPos: (v: string) => void;
  countColor: string;
  setCountColor: (v: string) => void;
  countFx: any;
  setCountFx: (cb: (s: any) => any) => void;
}

export function TextOverlaySettings(props: TextOverlaySettingsProps) {
  const {
    openSections, toggleSection,
    introSecs, setIntroSecs, outroSecs, setOutroSecs,
    title, setTitle, titlePos, setTitlePos, titleColor, setTitleColor, titleFx, setTitleFx,
    desc, setDesc, descPos, setDescPos, descColor, setDescColor, descFx, setDescFx,
    countPos, setCountPos, countColor, setCountColor, countFx, setCountFx
  } = props;
  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('text')}>
        <span className={`chevron ${openSections.text ? 'open' : ''}`}>▶</span>
        Text Overlays
      </div>
      {openSections.text && (
        <div className="section-body">
          {/* Intro / Outro timing */}
          <div className="field-label">Intro &amp; Outro</div>
          <div className="field-row">
            <label>Intro
              <input type='range' min={0} max={10} step={1} value={introSecs} onChange={e => setIntroSecs(parseInt(e.target.value, 10))} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{introSecs}s</span>
            </label>
            <label>Outro
              <input type='range' min={0} max={10} step={1} value={outroSecs} onChange={e => setOutroSecs(parseInt(e.target.value, 10))} />
              <span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{outroSecs}s</span>
            </label>
          </div>

          {/* Title */}
          <div className="field-label" style={{ marginTop: 4 }}>Title</div>
          <div className="field-row">
            <input placeholder="Title text" value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 1 }} />
            <select value={titlePos} onChange={e => setTitlePos(e.target.value)}>
              <option value='lt'>LT</option><option value='mt'>MT</option><option value='rt'>RT</option>
              <option value='lm'>LM</option><option value='mm'>MM</option><option value='rm'>RM</option>
              <option value='lb'>LB</option><option value='mb'>MB</option><option value='rb'>RB</option>
            </select>
            <input type='color' value={titleColor} onChange={e => setTitleColor(e.target.value)} />
          </div>
          <div className="field-row">
            <label><input type='checkbox' checked={titleFx.float} onChange={e => setTitleFx(s => ({ ...s, float: e.target.checked }))} /> Float</label>
            <label><input type='checkbox' checked={titleFx.bounce} onChange={e => setTitleFx(s => ({ ...s, bounce: e.target.checked }))} /> Bounce</label>
            <label><input type='checkbox' checked={titleFx.pulse} onChange={e => setTitleFx(s => ({ ...s, pulse: e.target.checked }))} /> Pulse</label>
          </div>

          {/* Description */}
          <div className="field-label" style={{ marginTop: 4 }}>Description</div>
          <div className="field-row">
            <input placeholder="Description text" value={desc} onChange={e => setDesc(e.target.value)} style={{ flex: 1 }} />
            <select value={descPos} onChange={e => setDescPos(e.target.value)}>
              <option value='lt'>LT</option><option value='mt'>MT</option><option value='rt'>RT</option>
              <option value='lm'>LM</option><option value='mm'>MM</option><option value='rm'>RM</option>
              <option value='lb'>LB</option><option value='mb'>MB</option><option value='rb'>RB</option>
            </select>
            <input type='color' value={descColor} onChange={e => setDescColor(e.target.value)} />
          </div>
          <div className="field-row">
            <label><input type='checkbox' checked={descFx.float} onChange={e => setDescFx(s => ({ ...s, float: e.target.checked }))} /> Float</label>
            <label><input type='checkbox' checked={descFx.bounce} onChange={e => setDescFx(s => ({ ...s, bounce: e.target.checked }))} /> Bounce</label>
            <label><input type='checkbox' checked={descFx.pulse} onChange={e => setDescFx(s => ({ ...s, pulse: e.target.checked }))} /> Pulse</label>
          </div>

          {/* Countdown */}
          <div className="field-label" style={{ marginTop: 4 }}>Countdown</div>
          <div className="field-row">
            <select value={countPos} onChange={e => setCountPos(e.target.value)}>
              <option value='lt'>Left Top</option><option value='ct'>Center Top</option><option value='rt'>Right Top</option>
              <option value='bl'>Bottom Left</option><option value='br'>Bottom Right</option>
            </select>
            <input type='color' value={countColor} onChange={e => setCountColor(e.target.value)} />
          </div>
          <div className="field-row">
            <label><input type='checkbox' checked={countFx.float} onChange={e => setCountFx(s => ({ ...s, float: e.target.checked }))} /> Float</label>
            <label><input type='checkbox' checked={countFx.bounce} onChange={e => setCountFx(s => ({ ...s, bounce: e.target.checked }))} /> Bounce</label>
            <label><input type='checkbox' checked={countFx.pulse} onChange={e => setCountFx(s => ({ ...s, pulse: e.target.checked }))} /> Pulse</label>
          </div>
        </div>
      )}
    </div>
  );
}
