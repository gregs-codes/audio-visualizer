import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioAnalyzer } from './audio/useAudioAnalyzer';
import { VUMeters } from './visualizer/VUMeters';
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
	const { audioRef, init, getAudioStream, getBandAnalyser, getStereoAnalysers, setPlaybackMuted } = useAudioAnalyzer();
	const [showSettings, setShowSettings] = useState(true);
		const [mode, setMode] = useState<VisualizerMode>('vertical-bars');
	const [theme, setTheme] = useState('dark');
	const [color, setColor] = useState('#7aa2ff');
	// Background controls
	const [bgMode, setBgMode] = useState<'none'|'color'|'image'>('none');
	const [bgColor, setBgColor] = useState<string>('#101321');
	const [bgImageUrl, setBgImageUrl] = useState<string>('');
	const [bgFit, setBgFit] = useState<'cover'|'contain'|'stretch'>('cover');
	const [bgOpacity, setBgOpacity] = useState<number>(1);
	const [ready, setReady] = useState(false);
	const [layout, setLayout] = useState<LayoutMode>('1');
	const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const { start, stop } = useCanvasRecorder();
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const isSyncingScroll = useRef<boolean>(false);
	const pxPerSecond = 40;

	// Stereo analysers for VU meters
	const stereo = useMemo(() => (ready ? getStereoAnalysers() : null), [ready, getStereoAnalysers]);

	// Export settings
	const [aspect, setAspect] = useState<'16:9'|'9:16'>('16:9');
	// Manifest-driven lists
	const [animFiles, setAnimFiles] = useState<string[]>(ANIMATION_FILES);
	const [charFiles, setCharFiles] = useState<string[]>(CHARACTER_FILES);
	useEffect(() => {
		const load = async () => {
			try {
				const a = await fetch('/dance/manifest.json').then(r => r.ok ? r.json() : []);
				if (Array.isArray(a) && a.length) setAnimFiles(a);
			} catch {}
			try {
				const c = await fetch('/character/manifest.json').then(r => r.ok ? r.json() : []);
				if (Array.isArray(c) && c.length) setCharFiles(c);
			} catch {}
		};
		load();
	}, []);
	const [res, setRes] = useState<'360'|'480'|'720'|'1080'>('720');
	const [fps, setFps] = useState<24|30|60>(30);
	const [codec, setCodec] = useState<'vp9'|'vp8'>('vp9');
	const [vBitrate, setVBitrate] = useState<number>(8000); // kbps
	const [aBitrate, setABitrate] = useState<number>(192); // kbps
	const [muteDuringExport, setMuteDuringExport] = useState<boolean>(true);
	const [exporting, setExporting] = useState<boolean>(false);
	const [exportProgress, setExportProgress] = useState<number>(0);
	const [exportError, setExportError] = useState<string>('');
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [progress, setProgress] = useState<number>(0); // 0..1
	const [volume, setVolume] = useState<number>(80);
	const wrapRef = useRef<HTMLDivElement | null>(null);

	const effectiveSize = useMemo(() => {
		const h = parseInt(res, 10);
		const w = Math.round(h * 16 / 9);
		if (aspect === '16:9') return { w, h };
		// 9:16 portrait: swap dimensions
		return { w: h, h: w };
	}, [aspect, res]);
		const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
		useEffect(() => {
			const a = audioEl ?? audioRef.current;
			if (!a) return;
			const onPlay = () => setIsPlaying(true);
			const onPause = () => setIsPlaying(false);
			const onEnded = () => setIsPlaying(false);
			const onTime = () => {
				if (a.duration > 0) setProgress(Math.min(1, (a.currentTime || 0) / a.duration));
			};
			a.addEventListener('play', onPlay);
			a.addEventListener('pause', onPause);
			a.addEventListener('ended', onEnded);
			a.addEventListener('timeupdate', onTime);
			return () => {
				a.removeEventListener('play', onPlay);
				a.removeEventListener('pause', onPause);
				a.removeEventListener('ended', onEnded);
				a.removeEventListener('timeupdate', onTime);
			};
		}, [audioEl]);

	// Sync horizontal scroll position with playback progress
	useEffect(() => {
		const div = scrollRef.current; const a = audioRef.current;
		if (!div || !a || !isFinite(a.duration) || a.duration <= 0) return;
		isSyncingScroll.current = true;
		div.scrollTo({ left: (a.currentTime || 0) * pxPerSecond });
		requestAnimationFrame(() => { isSyncingScroll.current = false; });
	}, [progress]);

		type PanelConfig = { mode: VisualizerMode; color: string; band: FrequencyBand; colors?: { low: string; mid: string; high: string }; dancerSources?: DancerSources; hgView?: 'top'|'side' };
	const defaultPanelColors = { low: '#00d08a', mid: '#7aa2ff', high: '#ff6b6b' };
		const [panels, setPanels] = useState<PanelConfig[]>([{ mode: 'vertical-bars', color, band: 'full', colors: defaultPanelColors, hgView: 'top' }]);

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
		<div data-theme={theme} className={`app ${showSettings ? 'settings-open' : ''}`}>
			<div className="topbar">
				<div className="brand">Audio Visualizer</div>
				<div className="spacer" />
				<button className="icon-btn" onClick={() => setShowSettings(s => !s)} aria-label="Toggle Settings">⚙︎ Settings</button>
			</div>
			<aside className={`settings-drawer ${showSettings ? 'open' : ''}`}>
			<div className="toolbar">
				<label>
					Layout
					<select value={layout} onChange={e => {
						const nextLayout = e.target.value as LayoutMode;
						setLayout(nextLayout);
						const nextCount = nextLayout === '4' ? 4 : nextLayout === '1' ? 1 : 2;
						setPanels(prev => {
							const next = [...prev];
							if (next.length < nextCount) {
								for (let i = next.length; i < nextCount; i++) next.push({ mode, color, band: 'full', colors: defaultPanelColors, hgView: 'top' });
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
				{/* Background controls */}
				<label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					Background
					<select value={bgMode} onChange={e => setBgMode(e.target.value as 'none'|'color'|'image')}>
						<option value='none'>None</option>
						<option value='color'>Color</option>
						<option value='image'>Image</option>
					</select>
				</label>
				{bgMode === 'color' && (
					<label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						Color
						<input type='color' value={bgColor} onChange={e => setBgColor(e.target.value)} />
						<span style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--panelBorder)', background: bgColor }}></span>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Opacity
							<input type='range' min={0} max={100} value={Math.round(bgOpacity * 100)} onChange={e => setBgOpacity(Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100)))} />
							<span style={{ width: 36, textAlign: 'right' }}>{Math.round(bgOpacity * 100)}%</span>
						</label>
					</label>
				)}
				{bgMode === 'image' && (
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<div className="upload">
							<button className="icon-btn" aria-label="Upload Background">＋ Bg</button>
							<input type='file' accept='image/*' aria-label='Upload Background Image' onChange={e => {
								const f = e.target.files?.[0];
								if (f) {
									const url = URL.createObjectURL(f);
									setBgImageUrl(url);
								}
							}} />
						</div>
						<select value={bgFit} onChange={e => setBgFit(e.target.value as 'cover'|'contain'|'stretch')}>
							<option value='cover'>Cover</option>
							<option value='contain'>Contain</option>
							<option value='stretch'>Stretch</option>
						</select>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Opacity
							<input type='range' min={0} max={100} value={Math.round(bgOpacity * 100)} onChange={e => setBgOpacity(Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100)))} />
							<span style={{ width: 36, textAlign: 'right' }}>{Math.round(bgOpacity * 100)}%</span>
						</label>
					</div>
				)}
				{ready && (
					<>
						{/* Export settings */}
						<div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
							<label>Aspect
								<select value={aspect} onChange={e => setAspect(e.target.value as '16:9'|'9:16')}>
									<option value='16:9'>16:9</option>
									<option value='9:16'>9:16</option>
								</select>
							</label>
							<label>Resolution
								<select value={res} onChange={e => setRes(e.target.value as typeof res)}>
									<option value='360'>360p</option>
									<option value='480'>480p</option>
									<option value='720'>720p</option>
									<option value='1080'>1080p</option>
								</select>
							</label>
							<label>FPS
								<select value={fps} onChange={e => setFps(parseInt(e.target.value, 10) as 24|30|60)}>
									<option value={24}>24</option>
									<option value={30}>30</option>
									<option value={60}>60</option>
								</select>
							</label>
							<label>Codec
								<select value={codec} onChange={e => setCodec(e.target.value as 'vp9'|'vp8')}>
									<option value='vp9'>VP9</option>
									<option value='vp8'>VP8</option>
								</select>
							</label>
							<label>Video bitrate
								<select value={vBitrate} onChange={e => setVBitrate(parseInt(e.target.value, 10))}>
									<option value={2000}>2 Mbps</option>
									<option value={4000}>4 Mbps</option>
									<option value={6000}>6 Mbps</option>
									<option value={8000}>8 Mbps</option>
									<option value={12000}>12 Mbps</option>
								</select>
							</label>
							<label>Audio bitrate
								<select value={aBitrate} onChange={e => setABitrate(parseInt(e.target.value, 10))}>
									<option value={128}>128 kbps</option>
									<option value={160}>160 kbps</option>
									<option value={192}>192 kbps</option>
									<option value={256}>256 kbps</option>
									<option value={320}>320 kbps</option>
								</select>
							</label>
							<label><input type='checkbox' checked={muteDuringExport} onChange={e => setMuteDuringExport(e.target.checked)} /> Mute during export</label>
							{/* MP4 transcode option removed */}
							<span style={{ color: 'var(--muted)', fontSize: 12 }}>Target: {effectiveSize.w}×{effectiveSize.h}</span>
						</div>
						<button disabled={exporting} onClick={async () => {
							if (!canvasRef.current || !audioRef.current || !analyserNode) return;
							const audio = audioRef.current;
							const canvas = exportCanvasRef.current;
							if (!canvas) { setExportError('Export canvas not ready'); return; }
							// Prepare
							// Mute local speakers via GainNode (recording still taps MediaStreamDestination)
							if (muteDuringExport) setPlaybackMuted(true);
							setExporting(true); setExportProgress(0); setExportError('');
							// Start recorder
							const mime = codec === 'vp9' ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp8,opus';
							start(canvas, getAudioStream(), { fps, mime, audioBitsPerSecond: aBitrate * 1000, videoBitsPerSecond: vBitrate * 1000 });
							// Play from start
							audio.currentTime = 0;
							await audio.play();
							// Progress loop
							const tick = () => {
								if (audio.duration > 0) setExportProgress(Math.min(1, (audio.currentTime || 0) / audio.duration));
								if (!audio.paused && !audio.ended) { requestAnimationFrame(tick); }
							};
							tick();
							// Wait end reliably via RAF
							await new Promise<void>((resolve) => {
								const check = () => {
									if (audio.ended || (audio.duration > 0 && (audio.currentTime || 0) >= audio.duration - 0.03)) { resolve(); }
									else requestAnimationFrame(check);
								};
								check();
							});
							audio.pause();
							const blob = await stop();
							// Restore state
							if (muteDuringExport) setPlaybackMuted(false);
							setExportProgress(1);
							setExporting(false);
							// Download WebM directly
							if (blob) {
								const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `visualizer_${res}_${aspect.replace(':','-')}.webm`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
							}
						}}>
							Export
						</button>
						{exporting && (
							<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<div style={{ width: 160, height: 8, background: 'var(--panelBorder)', borderRadius: 4, overflow: 'hidden' }}>
									<div style={{ width: `${Math.round(exportProgress * 100)}%`, height: '100%', background: 'var(--accent, #7aa2ff)' }} />
								</div>
								<span style={{ fontSize: 12, color: 'var(--muted)' }}>Exporting {Math.round(exportProgress * 100)}%</span>
							</div>
						)}
						{exportError && (
							<div style={{ color: 'var(--danger, #ff6b6b)', fontSize: 12 }}>{exportError}</div>
						)}
						{/* MP4 transcode progress removed */}
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
													{(['high-graphics-fog','high-graphics-trunk','high-graphics-rings','high-graphics-net','high-graphics-rings-trails','high-graphics-flow-field','high-graphics-hexagon'] as VisualizerMode[]).includes(p.mode) && (
														<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
															View
															<select value={p.hgView ?? 'top'} onChange={e => {
																const val = e.target.value as ('top'|'side');
																setPanels(old => old.map((x, idx) => idx === i ? { ...x, hgView: val } : x));
															}}>
																<option value='top'>Top</option>
																<option value='side'>Side (centered)</option>
															</select>
														</label>
													)}
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
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								Rays
								<input type='checkbox' checked={!!dancerOverlaySources.colorFlash?.rays} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), rays: e.target.checked } }))} />
							</label>
						</label>
						<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								Camera Elevation
								<input type='range' min={-20} max={20} value={Math.round((dancerOverlaySources.cameraElevationPct ?? 0) * 100)} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraElevationPct: Math.max(-0.2, Math.min(0.2, parseInt(e.target.value, 10) / 100)) }))} />
								<span style={{ width: 36, textAlign: 'right' }}>{Math.round((dancerOverlaySources.cameraElevationPct ?? 0) * 100)}%</span>
							</label>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								Camera Tilt
								<input type='range' min={-15} max={15} value={Math.round(dancerOverlaySources.cameraTiltDeg ?? 0)} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraTiltDeg: Math.max(-15, Math.min(15, parseInt(e.target.value, 10))) }))} />
								<span style={{ width: 36, textAlign: 'right' }}>{Math.round(dancerOverlaySources.cameraTiltDeg ?? 0)}°</span>
							</label>
							<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
								Disco Ball
								<input type='checkbox' checked={!!dancerOverlaySources.discoBall?.enabled} onChange={e => setDancerOverlaySources(s => ({ ...s, discoBall: { ...(s.discoBall ?? {}), enabled: e.target.checked } }))} />
							</label>
						</div>
						<label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
							Choose Character
							<select value={dancerOverlaySources.characterUrl ?? ''} onChange={e => setDancerOverlaySources(s => ({ ...s, characterUrl: e.target.value }))}>
								<option value="">Select from /public/character</option>
								{charFiles.map((c) => (
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
								{animFiles.map(a => (
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
			</aside>

			{/* Top controlbar (above canvas) */}
			<div className="controlbar controlbar-top" aria-label="Playback Controls" role="group">
				<div className="left">
					<button
						className="icon-btn"
						aria-label={isPlaying ? 'Pause' : 'Play'}
						onClick={() => {
							const a = audioRef.current; if (!a) return;
							if (a.paused) a.play(); else a.pause();
						}}
					>{isPlaying ? '⏸' : '▶︎'}</button>
					<div className="upload">
						<button className="icon-btn" aria-label="Upload Audio">＋ Audio</button>
						<input
							type='file'
							accept='audio/*'
							aria-label='Upload Audio File'
							onChange={async e => { const f = e.target.files?.[0]; if (f) { const a = await init(f); setAnalyserNode(a); setAudioEl(audioRef.current); setReady(true); } }}
						/>
					</div>
				</div>
				<div className="right">
					<input
						className="timeline"
						type='range'
						min={0}
						max={1000}
						value={Math.round(progress * 1000)}
						onChange={e => {
							const a = audioRef.current; if (!a || a.duration <= 0) return;
							const frac = Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 1000));
							a.currentTime = frac * a.duration;
							setProgress(frac);
						}}
					/>
					<div className="volume" aria-label="Volume">
						<span>Vol</span>
						<input
							type='range'
							min={0}
							max={100}
							step={1}
							value={volume}
							onChange={e => {
								const v = parseInt(e.target.value, 10); setVolume(v);
								const a = audioRef.current; if (a) a.volume = Math.max(0, Math.min(1, v / 100));
							}}
						/>
					</div>
				</div>
			</div>

			{/* Horizontal scrollable timeline (only show when audio is loaded) */}
			{ready && (audioRef.current?.duration ?? 0) > 0 && (
				<div
					className="music-scroll"
					ref={scrollRef}
					onScroll={e => {
						if (isSyncingScroll.current) return;
						const a = audioRef.current; const div = e.currentTarget as HTMLDivElement;
						if (!a || !isFinite(a.duration) || a.duration <= 0) return;
						const time = div.scrollLeft / pxPerSecond;
						a.currentTime = Math.max(0, Math.min(a.duration, time));
						setProgress(Math.max(0, Math.min(1, (a.currentTime || 0) / a.duration)));
					}}
				>
					<div
						className="scroll-track"
						style={{ width: `${Math.max(0, (audioRef.current?.duration || 0) * pxPerSecond)}px` }}
					>
						<div
							className="scroll-thumb"
							style={{ left: `${(audioRef.current?.currentTime || 0) * pxPerSecond}px` }}
						/>
					</div>
				</div>
			)}

				<div className="canvas-wrap overlay-controls" ref={wrapRef}>
					{ready && analyserNode && (
						<>
								<GridVisualizerCanvas
								ref={canvasRef}
								analyser={analyserNode}
								analysers={analysers}
								layout={layout}
								panels={panels}
								width={effectiveSize.w}
								height={effectiveSize.h}
								audio={audioEl}
									backgroundColor={bgMode === 'color' ? bgColor : undefined}
									backgroundImageUrl={bgMode === 'image' ? bgImageUrl : undefined}
									backgroundFit={bgFit}
									backgroundOpacity={bgOpacity}
								instanceKey={'preview'}
								overlayTitle={{ text: title, position: titlePos, color: titleColor, effects: titleFx }}
								overlayDescription={{ text: desc, position: descPos, color: descColor, effects: descFx }}
								overlayCountdown={{ enabled: showCountdown, position: countPos, color: countColor, effects: countFx }}
								overlayDancer={{ enabled: showDancer, position: dancerPos, widthPct: dancerSize, sources: dancerOverlaySources }}
							/>
							{/* Futuristic VU meters: horizontal, tiny, under countdown */}
							{stereo && (
								<VUMeters
									left={stereo.left}
									right={stereo.right}
									accentColor={color}
									orientation="horizontal"
									anchorPos={'rt'}
									length={96}
									thickness={4}
								/>
							)}
							<div style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, overflow: 'hidden' }}>
								<GridVisualizerCanvas
									ref={exportCanvasRef}
									analyser={analyserNode}
									analysers={analysers}
									layout={layout}
									panels={panels}
									width={effectiveSize.w}
									height={effectiveSize.h}
									audio={audioEl}
									backgroundColor={bgMode === 'color' ? bgColor : undefined}
									backgroundImageUrl={bgMode === 'image' ? bgImageUrl : undefined}
									backgroundFit={bgFit}
									backgroundOpacity={bgOpacity}
									instanceKey={'export'}
									overlayTitle={{ text: title, position: titlePos, color: titleColor, effects: titleFx }}
									overlayDescription={{ text: desc, position: descPos, color: descColor, effects: descFx }}
									overlayCountdown={{ enabled: showCountdown, position: countPos, color: countColor, effects: countFx }}
									overlayDancer={{ enabled: showDancer, position: dancerPos, widthPct: dancerSize, sources: dancerOverlaySources }}
								/>
							</div>


								{/* Fullscreen toggle */}
								<button
									className="icon-btn fullscreen"
									aria-label="Toggle Fullscreen"
									onClick={() => {
										const el = wrapRef.current; if (!el) return;
										if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.();
									}}
								>⤢</button>
						</>
					)}
				</div>
		</div>
	);
}