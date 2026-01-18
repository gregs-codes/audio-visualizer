import { useMemo, useRef, useState } from 'react';
import { useAudioAnalyzer } from './audio/useAudioAnalyzer';
import { GridVisualizerCanvas } from './visualizer/GridVisualizerCanvas';
import type { VisualizerMode, FrequencyBand } from './visualizer/visualizerModes';
import type { DancerSources } from './visualizer/dancer/DancerEngine';
import { DancerPreview } from './visualizer/dancer/DancerPreview';
import { ANIMATION_FILES } from './visualizer/dancer/animations';
import { CHARACTER_FILES } from './visualizer/dancer/characters';
import { VISUALIZER_MODES, LABELS } from './visualizer/visualizers';
import type { LayoutMode } from './visualizer/GridVisualizerCanvas';
import { useCanvasRecorder } from './recorder/useCanvasRecorder';

export default function App() {
	const { audioRef, init, getAudioStream, getBandAnalyser } = useAudioAnalyzer();
		const [mode, setMode] = useState<VisualizerMode>('vertical-bars');
	const [theme, setTheme] = useState('dark');
	const [color, setColor] = useState('#7aa2ff');
	const [ready, setReady] = useState(false);
	const [layout, setLayout] = useState<LayoutMode>('1');
	const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const { start, stop, download, recording } = useCanvasRecorder();
		const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

		type PanelConfig = { mode: VisualizerMode; color: string; band: FrequencyBand; colors?: { low: string; mid: string; high: string }; dancerSources?: DancerSources };
	const defaultPanelColors = { low: '#00d08a', mid: '#7aa2ff', high: '#ff6b6b' };
		const [panels, setPanels] = useState<PanelConfig[]>([{ mode: 'vertical-bars', color, band: 'full', colors: defaultPanelColors }]);

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

	// Dancer overlay state (acts like text overlays, independent of panel modes)
	const [showDancer, setShowDancer] = useState(false);
	const [dancerPos, setDancerPos] = useState<Position9>('mm');
	const [dancerSize, setDancerSize] = useState<number>(40); // percent of canvas width
	const [dancerOverlaySources, setDancerOverlaySources] = useState<DancerSources>({});

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
											{VISUALIZER_MODES.filter(m => m !== 'dancer-fbx').map(m => (
								<option key={m} value={m}>{LABELS[m]}</option>
							))}
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
								{VISUALIZER_MODES.filter(m => m !== 'dancer-fbx').map(m => (
									<option key={m} value={m}>{LABELS[m]}</option>
								))}
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

			{/* Dancer overlay controls */}
			<div className="toolbar" style={{ gap: 12 }}>
				<div style={{ display: 'grid', gap: 8 }}>
					<div style={{ color: 'var(--muted)' }}>Dancer Overlay</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<label><input type='checkbox' checked={showDancer} onChange={e => setShowDancer(e.target.checked)} /> Show</label>
						<select value={dancerPos} onChange={e => setDancerPos(e.target.value as Position9)}>
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
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Size
							<input type='range' min={20} max={70} value={dancerSize} onChange={e => setDancerSize(parseInt(e.target.value, 10))} />
							<span style={{ width: 36, textAlign: 'right' }}>{dancerSize}%</span>
						</label>
					</div>
					<div style={{ display: 'grid', gap: 6 }}>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Camera Movement
							<select value={dancerOverlaySources.cameraMode ?? 'static'} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraMode: e.target.value as DancerSources['cameraMode'] }))}>
								<option value="static">Static</option>
								<option value="pan">Pan</option>
								<option value="rotate">Rotate</option>
							</select>
						</label>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Color Flash
							<input type='checkbox' checked={!!dancerOverlaySources.colorFlash?.enabled} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), enabled: e.target.checked } }))} />
							<select value={(dancerOverlaySources.colorFlash && dancerOverlaySources.colorFlash.mode) ? dancerOverlaySources.colorFlash.mode : 'flash'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), mode: e.target.value as ('flash'|'strobe'|'spot') } }))}>
								<option value='flash'>Flash</option>
								<option value='strobe'>Strobe</option>
								<option value='spot'>Spot Lights</option>
							</select>
							<input type='color' value={dancerOverlaySources.colorFlash?.colors?.[0] ?? dancerOverlaySources.colorFlash?.color ?? '#ffffff'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), colors: [e.target.value, s.colorFlash?.colors?.[1] ?? '#ff0080', s.colorFlash?.colors?.[2] ?? '#00d08a'], color: e.target.value } }))} />
							<input type='color' value={dancerOverlaySources.colorFlash?.colors?.[1] ?? '#ff0080'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), colors: [s.colorFlash?.colors?.[0] ?? '#ffffff', e.target.value, s.colorFlash?.colors?.[2] ?? '#00d08a'] } }))} />
							<input type='color' value={dancerOverlaySources.colorFlash?.colors?.[2] ?? '#00d08a'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), colors: [s.colorFlash?.colors?.[0] ?? '#ffffff', s.colorFlash?.colors?.[1] ?? '#ff0080', e.target.value] } }))} />
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								Intensity
								<input type='range' min={0} max={100} value={Math.round((dancerOverlaySources.colorFlash?.intensity ?? 1) * 100)} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), intensity: Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100)) } }))} />
								<span style={{ width: 36, textAlign: 'right' }}>{Math.round((dancerOverlaySources.colorFlash?.intensity ?? 1) * 100)}%</span>
							</label>
						</label>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Choose Character
							<select value={dancerOverlaySources.characterUrl ?? ''} onChange={e => setDancerOverlaySources(s => ({ ...s, characterUrl: e.target.value }))}>
								<option value="">Select from /public/character</option>
								{CHARACTER_FILES.map((c) => (
									<option key={c} value={c}>{c.replace('/character/','')}</option>
								))}
							</select>
						</label>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Character FBX
							<input placeholder="/character/hero.fbx" value={dancerOverlaySources.characterUrl ?? ''} onChange={e => setDancerOverlaySources(s => ({ ...s, characterUrl: e.target.value }))} />
						</label>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Choose Animations
							<select multiple size={4} value={(dancerOverlaySources.animationUrls ?? [])} onChange={e => {
								const selected: string[] = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value);
								setDancerOverlaySources(s => ({ ...s, animationUrls: selected }));
							}}>
								{ANIMATION_FILES.map(a => (
									<option key={a} value={a}>{a.replace('/dance/','')}</option>
								))}
							</select>
						</label>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Animations (comma-separated)
							<input placeholder="/dance/Belly Dance.fbx, /dance/Twist Dance.fbx" value={(dancerOverlaySources.animationUrls ?? []).join(', ')} onChange={e => {
								const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
								setDancerOverlaySources(s => ({ ...s, animationUrls: list }));
							}} />
						</label>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<DancerPreview
								sources={dancerOverlaySources}
								analyser={analyserNode}
								width={220}
								height={124}
								panelKey={`overlay-preview`}
							/>
							<div style={{ color: 'var(--muted)', fontSize: 12 }}>Preview</div>
						</div>
					</div>
				</div>
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
						overlayDancer={{ enabled: showDancer, position: dancerPos, widthPct: dancerSize, sources: dancerOverlaySources }}
					/>
				)}
			</div>
		</div>
	);
}