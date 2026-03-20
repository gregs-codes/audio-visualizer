import React from 'react';
import { parseSubtitles } from '../subtitles/parseSrt';
import type { SubtitleCue } from '../subtitles/parseSrt';

interface SubtitleSettingsProps {
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  subtitleCues: SubtitleCue[];
  setSubtitleCues: (cues: SubtitleCue[]) => void;
  subtitleEnabled: boolean;
  setSubtitleEnabled: (v: boolean) => void;
  subtitlePos: string;
  setSubtitlePos: (v: string) => void;
  subtitleColor: string;
  setSubtitleColor: (v: string) => void;
  subtitleOffset: number;
  setSubtitleOffset: (v: number) => void;
  subtitleFontSize: number;
  setSubtitleFontSize: (v: number) => void;
}

/** 3×3 visual position picker */
const POS_GRID = [
  ['lt', 'mt', 'rt'],
  ['lm', 'mm', 'rm'],
  ['lb', 'mb', 'rb'],
] as const;

const POS_LABELS: Record<string, string> = {
  lt: '↖', mt: '↑', rt: '↗',
  lm: '←', mm: '•', rm: '→',
  lb: '↙', mb: '↓', rb: '↘',
};

function PositionGrid({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 28px)',
      gridTemplateRows: 'repeat(3, 22px)',
      gap: 2,
    }}>
      {POS_GRID.flat().map(pos => (
        <button
          key={pos}
          onClick={() => onChange(pos)}
          title={pos.toUpperCase()}
          style={{
            width: 28,
            height: 22,
            padding: 0,
            border: `1.5px solid ${value === pos ? 'var(--accent)' : 'var(--panelBorder)'}`,
            borderRadius: 4,
            background: value === pos ? 'var(--accent)' : 'var(--inputBg, transparent)',
            color: value === pos ? '#fff' : 'var(--muted)',
            fontSize: 12,
            cursor: 'pointer',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          {POS_LABELS[pos]}
        </button>
      ))}
    </div>
  );
}

export function SubtitleSettings(props: SubtitleSettingsProps) {
  const {
    openSections, toggleSection,
    subtitleCues, setSubtitleCues,
    subtitleEnabled, setSubtitleEnabled,
    subtitlePos, setSubtitlePos,
    subtitleColor, setSubtitleColor,
    subtitleOffset, setSubtitleOffset,
    subtitleFontSize, setSubtitleFontSize,
  } = props;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const cues = parseSubtitles(text);
    setSubtitleCues(cues);
    if (cues.length > 0) setSubtitleEnabled(true);
  };

  const [dragOver, setDragOver] = React.useState(false);

  return (
    <div className="section">
      <div className="section-header" onClick={() => toggleSection('subtitles')}>
        <span className={`chevron ${openSections.subtitles ? 'open' : ''}`}>▶</span>
        Subtitles / Lyrics
        {subtitleCues.length > 0 && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 10,
            background: subtitleEnabled ? 'var(--accent)' : 'var(--panelBorder)',
            color: subtitleEnabled ? '#fff' : 'var(--muted)',
            borderRadius: 8,
            padding: '1px 7px',
          }}>
            {subtitleEnabled ? `${subtitleCues.length} cues` : 'off'}
          </span>
        )}
      </div>

      {openSections.subtitles && (
        <div className="section-body">

          {/* Enable toggle */}
          <div className="field-row" style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type='checkbox'
                checked={subtitleEnabled}
                onChange={e => setSubtitleEnabled(e.target.checked)}
              />
              Show subtitles on visualizer
            </label>
          </div>

          {/* Drop zone / file picker */}
          <div
            className="field-label"
            style={{ marginBottom: 4 }}
          >
            SRT File
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--panelBorder)'}`,
              borderRadius: 7,
              padding: '10px 8px',
              textAlign: 'center',
              cursor: 'pointer',
              fontSize: 12,
              color: dragOver ? 'var(--accent)' : 'var(--muted)',
              background: dragOver ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
              marginBottom: 6,
            }}
          >
            {subtitleCues.length > 0
              ? `✓ ${subtitleCues.length} cues loaded — click to replace`
              : 'Drop .srt or .sbv here, or click to browse'}
            <input
              ref={fileInputRef}
              type='file'
              accept='.srt,.sbv,.txt'
              style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) await handleFile(file);
                e.target.value = '';
              }}
            />
          </div>

          {subtitleCues.length > 0 && (
            <div className="field-row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
              <button
                style={{ fontSize: 11, padding: '1px 8px', color: '#ff6b6b', borderColor: '#ff6b6b' }}
                onClick={() => { setSubtitleCues([]); setSubtitleEnabled(false); }}
              >
                ✕ Clear
              </button>
            </div>
          )}

          {/* Position grid */}
          <div className="field-label" style={{ marginTop: 4, marginBottom: 6 }}>Position on Screen</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <PositionGrid value={subtitlePos} onChange={setSubtitlePos} />
            <div style={{ flex: 1 }}>
              {/* Visual screen preview */}
              <div style={{
                width: '100%',
                aspectRatio: '16/9',
                background: 'var(--panelBg, #1a1e2e)',
                border: '1px solid var(--panelBorder)',
                borderRadius: 5,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Dot showing current position */}
                {(() => {
                  // pos format: [horizontal][vertical] e.g. 'mb' = middle-horizontal, bottom-vertical
                  const col = subtitlePos[0] === 'l' ? '12%' : subtitlePos[0] === 'r' ? '88%' : '50%';
                  const row = subtitlePos[1] === 't' ? '15%' : subtitlePos[1] === 'b' ? '85%' : '50%';
                  return (
                    <div style={{
                      position: 'absolute',
                      left: col, top: row,
                      transform: 'translate(-50%, -50%)',
                      background: subtitleColor,
                      borderRadius: 3,
                      padding: '1px 5px',
                      fontSize: 7,
                      color: '#000',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      boxShadow: `0 0 6px ${subtitleColor}88`,
                    }}>
                      Lyrics
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Color */}
          <div className="field-row" style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12 }}>Text color</label>
            <input type='color' value={subtitleColor} onChange={e => setSubtitleColor(e.target.value)} />
            {/* Preset swatches */}
            {['#ffffff', '#ffff55', '#55ffee', '#ff88cc'].map(c => (
              <button
                key={c}
                onClick={() => setSubtitleColor(c)}
                title={c}
                style={{
                  width: 18, height: 18, borderRadius: 3, background: c, border: subtitleColor === c ? '2px solid var(--accent)' : '1px solid var(--panelBorder)', cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>

          {/* Font size */}
          <div className="field-row" style={{ marginTop: 4, alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Font size</label>
            <input
              type='range'
              min={16} max={48} step={1}
              value={subtitleFontSize}
              onChange={e => setSubtitleFontSize(parseInt(e.target.value, 10))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, width: 32, textAlign: 'right' }}>{subtitleFontSize}px</span>
          </div>

          {/* Timing offset */}
          <div className="field-label" style={{ marginTop: 8, marginBottom: 2 }}>Timing Sync</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, lineHeight: 1.4 }}>
            Shift lyrics earlier (−) or later (+) to match audio.
          </div>
          <div className="field-row" style={{ alignItems: 'center', gap: 6 }}>
            <input
              type='range'
              min={-10} max={10} step={0.1}
              value={subtitleOffset}
              onChange={e => setSubtitleOffset(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{
              fontSize: 12, fontWeight: 600, width: 48, textAlign: 'right',
              color: subtitleOffset !== 0 ? 'var(--accent)' : 'var(--muted)',
            }}>
              {subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s
            </span>
            {subtitleOffset !== 0 && (
              <button
                style={{ fontSize: 11, padding: '1px 6px' }}
                onClick={() => setSubtitleOffset(0)}
                title="Reset offset"
              >↺</button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
