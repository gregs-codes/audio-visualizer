import { useMemo, useRef, useState } from 'react';
import { useAudioAnalyzer } from './audio/useAudioAnalyzer';
import { GridVisualizerCanvas } from './visualizer/GridVisualizerCanvas';
import type { VisualizerMode, FrequencyBand } from './visualizer/visualizerModes';
import type { LayoutMode } from './visualizer/GridVisualizerCanvas';
import { useCanvasRecorder } from './recorder/useCanvasRecorder';

export default function App() {
	const { audioRef, init, getAudioStream, getBandAnalyser } = useAudioAnalyzer();
	const [mode, setMode] = useState<VisualizerMode>('bars');
	const [theme, setTheme] = useState('dark');
	const [color, setColor] = useState('#7aa2ff');
	const [ready, setReady] = useState(false);
	const [layout, setLayout] = useState<LayoutMode>('1');
	const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const { start, stop, download, recording } = useCanvasRecorder();
		const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

	type PanelConfig = { mode: VisualizerMode; color: string; band: FrequencyBand; colors?: { low: string; mid: string; high: string } };
	const defaultPanelColors = { low: '#00d08a', mid: '#7aa2ff', high: '#ff6b6b' };
	const [panels, setPanels] = useState<PanelConfig[]>([{ mode: 'bars', color, band: 'full', colors: defaultPanelColors }]);

	// Overlay text state
	const [title, setTitle] = useState('');
		type Position9 = 'lt'|'mt'|'rt'|'lm'|'mm'|'rm'|'lb'|'mb'|'rb';
		const [titlePos, setTitlePos] = useState<Position9>('mt');
	const [titleColor, setTitleColor] = useState('#e6e6eb');
	const [titleFx, setTitleFx] = useState<{ float: boolean; bounce: boolean; pulse: boolean }>({ float: false, bounce: false, pulse: false });
	const [desc, setDesc] = useState('');
		const [descPos, setDescPos] = useState<Position9>('mb');
	const [descColor, setDescColor] = useState('#a0a4ae');
	const [descFx, setDescFx] = useState<{ float: boolean; bounce: boolean; pulse: boolean }>({ float: false, bounce: false, pulse: false });
	const [showCountdown, setShowCountdown] = useState(true);
		type Position5 = 'lt'|'ct'|'rt'|'bl'|'br';
		const [countPos, setCountPos] = useState<Position5>('rt');
	const [countColor, setCountColor] = useState('#e6e6eb');
	const [countFx, setCountFx] = useState<{ float: boolean; bounce: boolean; pulse: boolean }>({ float: false, bounce: true, pulse: true });

	const analysers = useMemo(() => {
		if (!ready) return [] as (AnalyserNode | null)[];
		return panels.map(p => p.band === 'full' ? analyserNode : (getBandAnalyser(p.band)));
	}, [ready, panels, analyserNode, getBandAnalyser]);

	return (
		<div data-theme={theme} className="app">
			<div className="toolbar">
			<input type='file' accept='audio/*' onChange={async e => { const f = e.target.files?.[0]; if (f) { const a = await init(f); setAnalyserNode(a); setAudioEl(audioRef.current); setReady(true); } }} />
				<button onClick={() => audioRef.current?.play()}>Play</button>
				<button onClick={() => audioRef.current?.pause()}>Pause</button>
				<label>
					Layout
					<select value={layout} onChange={e => {
						const nextLayout = e.target.value as LayoutMode;
						setLayout(nextLayout);
						const nextCount = nextLayout === '4' ? 4 : nextLayout === '1' ? 1 : 2;
						setPanels(prev => {
							const next = [...prev];
							if (next.length < nextCount) {
								for (let i = next.length; i < nextCount; i++) next.push({ mode, color, band: 'full', colors: defaultPanelColors });
							} else if (next.length > nextCount) {
								next.length = nextCount;
							}
							return next;
						});
					}}>
						<option value='1'>1</option>
						<option value='2-horizontal'>2 horizontal</option>
						<option value='2-vertical'>2 vertical</option>
						<option value='4'>4</option>
					</select>
				</label>
				<label>
					Default Mode
					<select value={mode} onChange={e => setMode(e.target.value as VisualizerMode)}>
						<option value='bars'>Bars</option>
						<option value='wave'>Wave</option>
						<option value='circle'>Circle</option>
					</select>
				</label>
				<label>
					Theme
					<select value={theme} onChange={e => setTheme(e.target.value)}>
						<option value='dark'>Dark</option>
						<option value='light'>Light</option>
						<option value='neon'>Neon</option>
					</select>
				</label>
				<label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					Accent Color
					<input type='color' value={color} onChange={e => setColor(e.target.value)} />
					<span title="Accent" style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--panelBorder)', background: color }}></span>
				</label>
				{ready && (
					<>
						{!recording && <button onClick={() => { if (!canvasRef.current) return; start(canvasRef.current, getAudioStream(), 30); }}>Start Recording</button>}
						{recording && <button onClick={() => { stop(); setTimeout(() => download(), 50); }}>Stop & Download</button>}
					</>
				)}
			</div>

			<div className="toolbar" style={{ gap: 12 }}>
				{panels.map((p, i) => (
					<div key={i} style={{ display: 'grid', gap: 6 }}>
						<div style={{ color: 'var(--muted)' }}>Panel {i + 1}</div>
						<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							<select value={p.mode} onChange={e => {
								const val = e.target.value as VisualizerMode;
								setPanels(old => old.map((x, idx) => idx === i ? { ...x, mode: val } : x));
							}}>
								<option value='bars'>Bars</option>
								<option value='wave'>Wave</option>
								<option value='circle'>Circle</option>
							</select>
							<select value={p.band} onChange={e => {
								const val = e.target.value as FrequencyBand;
								setPanels(old => old.map((x, idx) => idx === i ? { ...x, band: val } : x));
							}}>
								<option value='full'>Full</option>
								<option value='bass'>Bass</option>
								<option value='mid'>Mid</option>
								<option value='voice'>Voice</option>
								<option value='treble'>Treble</option>
							</select>
							<input aria-label={`Panel ${i + 1} color`} type='color' value={p.color} onChange={e => {
								const val = e.target.value;
								setPanels(old => old.map((x, idx) => idx === i ? { ...x, color: val } : x));
							}} />
							<span title="Accent" style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--panelBorder)', background: p.color }}></span>
						</div>
						{p.mode !== 'wave' && (
							<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
									Low
									<input type='color' value={p.colors?.low ?? defaultPanelColors.low} onChange={e => {
										const val = e.target.value;
										setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), low: val } } : x));
									}} />
									<span style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid var(--panelBorder)', background: p.colors?.low ?? defaultPanelColors.low }}></span>
								</label>
								<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
									Mid
									<input type='color' value={p.colors?.mid ?? defaultPanelColors.mid} onChange={e => {
										const val = e.target.value;
										setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), mid: val } } : x));
									}} />
									<span style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid var(--panelBorder)', background: p.colors?.mid ?? defaultPanelColors.mid }}></span>
								</label>
								<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
									High
									<input type='color' value={p.colors?.high ?? defaultPanelColors.high} onChange={e => {
										const val = e.target.value;
										setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), high: val } } : x));
									}} />
									<span style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid var(--panelBorder)', background: p.colors?.high ?? defaultPanelColors.high }}></span>
								</label>
							</div>
						)}
					</div>
				))}
			</div>

			<div className="toolbar" style={{ gap: 12 }}>
				<div style={{ display: 'grid', gap: 8 }}>
					<div style={{ color: 'var(--muted)' }}>Title</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
						<select value={titlePos} onChange={e => setTitlePos(e.target.value as Position9)}>
							<option value='lt'>Left Top</option>
							<option value='mt'>Mid Top</option>
							<option value='rt'>Right Top</option>
							<option value='lm'>Left Mid</option>
							<option value='mm'>Middle</option>
							<option value='rm'>Right Mid</option>
							<option value='lb'>Left Bottom</option>
							<option value='mb'>Mid Bottom</option>
							<option value='rb'>Right Bottom</option>
						</select>
						<input type='color' value={titleColor} onChange={e => setTitleColor(e.target.value)} />
						<span style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--panelBorder)', background: titleColor }}></span>
					</div>
					<div style={{ display: 'flex', gap: 12 }}>
						<label><input type='checkbox' checked={titleFx.float} onChange={e => setTitleFx(s => ({ ...s, float: e.target.checked }))} /> Float</label>
						<label><input type='checkbox' checked={titleFx.bounce} onChange={e => setTitleFx(s => ({ ...s, bounce: e.target.checked }))} /> Bounce</label>
						<label><input type='checkbox' checked={titleFx.pulse} onChange={e => setTitleFx(s => ({ ...s, pulse: e.target.checked }))} /> Pulse</label>
					</div>
				</div>
				<div style={{ display: 'grid', gap: 8 }}>
					<div style={{ color: 'var(--muted)' }}>Description</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
						<select value={descPos} onChange={e => setDescPos(e.target.value as Position9)}>
							<option value='lt'>Left Top</option>
							<option value='mt'>Mid Top</option>
							<option value='rt'>Right Top</option>
							<option value='lm'>Left Mid</option>
							<option value='mm'>Middle</option>
							<option value='rm'>Right Mid</option>
							<option value='lb'>Left Bottom</option>
							<option value='mb'>Mid Bottom</option>
							<option value='rb'>Right Bottom</option>
						</select>
						<input type='color' value={descColor} onChange={e => setDescColor(e.target.value)} />
						<span style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--panelBorder)', background: descColor }}></span>
					</div>
					<div style={{ display: 'flex', gap: 12 }}>
						<label><input type='checkbox' checked={descFx.float} onChange={e => setDescFx(s => ({ ...s, float: e.target.checked }))} /> Float</label>
						<label><input type='checkbox' checked={descFx.bounce} onChange={e => setDescFx(s => ({ ...s, bounce: e.target.checked }))} /> Bounce</label>
						<label><input type='checkbox' checked={descFx.pulse} onChange={e => setDescFx(s => ({ ...s, pulse: e.target.checked }))} /> Pulse</label>
					</div>
				</div>
				<div style={{ display: 'grid', gap: 8 }}>
					<div style={{ color: 'var(--muted)' }}>Countdown</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<label><input type='checkbox' checked={showCountdown} onChange={e => setShowCountdown(e.target.checked)} /> Show</label>
						<select value={countPos} onChange={e => setCountPos(e.target.value as Position5)}>
							<option value='lt'>Left Top</option>
							<option value='ct'>Center Top</option>
							<option value='rt'>Right Top</option>
							<option value='bl'>Bottom Left</option>
							<option value='br'>Bottom Right</option>
						</select>
						<input type='color' value={countColor} onChange={e => setCountColor(e.target.value)} />
						<span style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--panelBorder)', background: countColor }}></span>
					</div>
					<div style={{ display: 'flex', gap: 12 }}>
						<label><input type='checkbox' checked={countFx.float} onChange={e => setCountFx(s => ({ ...s, float: e.target.checked }))} /> Float</label>
						<label><input type='checkbox' checked={countFx.bounce} onChange={e => setCountFx(s => ({ ...s, bounce: e.target.checked }))} /> Bounce</label>
						<label><input type='checkbox' checked={countFx.pulse} onChange={e => setCountFx(s => ({ ...s, pulse: e.target.checked }))} /> Pulse</label>
					</div>
				</div>
			</div>

			<div className="canvas-wrap">
				{ready && analyserNode && (
					<GridVisualizerCanvas
						ref={canvasRef}
						analyser={analyserNode}
						analysers={analysers}
						layout={layout}
						panels={panels}
						audio={audioEl}
						overlayTitle={{ text: title, position: titlePos, color: titleColor, effects: titleFx }}
						overlayDescription={{ text: desc, position: descPos, color: descColor, effects: descFx }}
						overlayCountdown={{ enabled: showCountdown, position: countPos, color: countColor, effects: countFx }}
					/>
				)}
			</div>
		</div>
	);
}