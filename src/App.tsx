import { useEffect, useMemo, useRef, useState } from 'react';
import VisualizerPanel from './components/VisualizerPanel';
import { TopBar } from './components/TopBar';
import { PlaybackControls } from './components/PlaybackControls';
import { TimelineScroller } from './components/TimelineScroller';
import { GeneralSettings } from './components/GeneralSettings';
import { PanelsSettings } from './components/PanelsSettings';
import { CharacterSettings } from './components/CharacterSettings';
import { CameraSettings } from './components/CameraSettings';
import { TextOverlaySettings } from './components/TextOverlaySettings';
import { ExportSettings } from './components/ExportSettings';
import { useAudioAnalyzer } from './audio/useAudioAnalyzer';
import type { VisualizerMode, FrequencyBand } from './visualizer/visualizerModes';
import type { DancerSources } from './visualizer/dancer/DancerEngine';
import { ANIMATION_FILES } from './visualizer/dancer/animations';
import { CHARACTER_FILES } from './visualizer/dancer/characters';
import { VISUALIZER_MODES, LABELS, VISUALIZER_CATEGORIES } from './visualizer/visualizers';

const CUSTOM_MODES = [
	{ key: 'threejs-3d', label: '3D Three.js Visualizer' },
	{ key: 'threejs-shader', label: 'Shader Beast Visualizer' },
	{ key: 'beast-shader', label: 'Beast Shader Canvas (Pure WebGL)' },
];

// Add Three.js visualizers to categories
const EXTENDED_CATEGORIES = {
	...VISUALIZER_CATEGORIES,
	'Three.js (3D)': CUSTOM_MODES.map(m => m.key),
};
import type { LayoutMode } from './visualizer/GridVisualizerCanvas';
import { useCanvasRecorder } from './recorder/useCanvasRecorder';

export default function App() {
	const { audioRef, init, getAudioStream, getBandAnalyser, getStereoAnalysers, setPlaybackMuted, setPlaybackVolume } = useAudioAnalyzer();
	const [showSettings, setShowSettings] = useState(true);
		const [mode, setMode] = useState<VisualizerMode | 'triangles-bars'>('vertical-bars');
// Add state for server URL
const [serverUrl, setServerUrl] = useState('http://localhost:9090/render');
	const [theme, setTheme] = useState('dark');
	const [color, setColor] = useState('#a0b4f7');
	// Background controls
	const [bgMode, setBgMode] = useState<'none'|'color'|'image'|'parallax-spotlights'|'parallax-lasers'|'parallax-tunnel'|'parallax-rays'|'bg-viz-bars'|'bg-viz-radial'|'bg-viz-orbs'>('none');
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
	const [audioFile, setAudioFile] = useState<File | null>(null);
	const [serverRendering, setServerRendering] = useState(false);
	// ...existing code...

	// Auto export via query params (for server-side rendering through Puppeteer)
	const [autoExport, setAutoExport] = useState<boolean>(false);
	const [autoParams, setAutoParams] = useState<{ audioUrl?: string } | null>(null);
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
	const [outputFormat, setOutputFormat] = useState<'mp4'|'webm'>('webm');
	const [vBitrate, setVBitrate] = useState<number>(4000); // kbps
	const [aBitrate, setABitrate] = useState<number>(192); // kbps
	const [muteDuringExport, setMuteDuringExport] = useState<boolean>(true);
	const [exporting, setExporting] = useState<boolean>(false);
	const [exportProgress, setExportProgress] = useState<number>(0);
	const [exportError, setExportError] = useState<string>('');
	const [exportPhase, setExportPhase] = useState<'intro' | 'playing' | 'outro' | undefined>(undefined);
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [progress, setProgress] = useState<number>(0); // 0..1
	const [volume, setVolume] = useState<number>(80);
	const [canvasScale, setCanvasScale] = useState<number>(100); // percent 40–200
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const canvasAreaRef = useRef<HTMLDivElement | null>(null);
	const [availWidth, setAvailWidth] = useState<number>(9999);

	// Intro/Outro duration (seconds) — visible in UI
	const [introSecs, setIntroSecs] = useState<number>(4);
	const [outroSecs, setOutroSecs] = useState<number>(5);

	// Preview canvas size (smaller than export to save memory)
	const previewSize = useMemo(() => {
		const h = Math.min(480, parseInt(res, 10));
		const w = Math.round(h * (aspect === '9:16' ? 9 / 16 : 16 / 9));
		if (aspect === '9:16') return { w: h, h: w };
		return { w, h };
	}, [aspect, res]);

	// Collapsible section state
	const [openSections, setOpenSections] = useState<Record<string, boolean>>({
		general: true,
		panels: false,
		character: false,
		camera: false,
		text: false,
		export: false,
		server: false,
	});
	const toggleSection = (key: string) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

	// Server render state
	const [serverProgress, setServerProgress] = useState(0);
	const [serverStatus, setServerStatus] = useState('');
	const [serverError, setServerError] = useState('');
	const [renderedFiles, setRenderedFiles] = useState<{ name: string; size: number; date: string }[]>([]);

	const fetchRenderedFiles = async () => {
		try {
			// Try same-origin first (Vite plugin), fall back to Express server
			let resp = await fetch('/rendered/list').catch(() => null);
			if (!resp || !resp.ok) resp = await fetch('http://localhost:9090/rendered/list').catch(() => null);
			if (resp && resp.ok) setRenderedFiles(await resp.json());
		} catch {}
	};
	useEffect(() => { fetchRenderedFiles(); }, []);

	// Parse query params once
	useEffect(() => {
		const p = new URLSearchParams(window.location.search);
		const ae = p.get('autoExport');
		const audioUrl = p.get('audio');
		if (ae === '1' || ae === 'true') setAutoExport(true);
		if (audioUrl) setAutoParams({ audioUrl });
		// Optional params
		const aspectParam = p.get('aspect') as ('16:9'|'9:16') | null; if (aspectParam) setAspect(aspectParam);
		const resParam = p.get('res') as ('360'|'480'|'720'|'1080') | null; if (resParam) setRes(resParam);
		const fpsParam = p.get('fps'); if (fpsParam) setFps(parseInt(fpsParam, 10) as 24|30|60);
		const vbr = p.get('vBitrate'); if (vbr) setVBitrate(parseInt(vbr, 10));
		const abr = p.get('aBitrate'); if (abr) setABitrate(parseInt(abr, 10));
		const codecParam = p.get('codec') as ('vp9'|'vp8') | null; if (codecParam) setCodec(codecParam);
		const themeParam = p.get('theme'); if (themeParam) setTheme(themeParam);
		const modeParam = p.get('mode') as VisualizerMode | null; if (modeParam) setMode(modeParam);
	}, []);

	// If audioUrl is provided, load it
	useEffect(() => {
		const run = async () => {
			if (!autoParams?.audioUrl) return;
			try {
				const resp = await fetch(autoParams.audioUrl);
				if (!resp.ok) throw new Error('Audio fetch failed');
				const blob = await resp.blob();
				const ext = (blob.type && blob.type.split('/')[1]) || 'audio';
				const file = new File([blob], `input.${ext}`, { type: blob.type });
				const a = await init(file);
				setAnalyserNode(a);
				setAudioEl(audioRef.current);
				setReady(true);
				// Ensure initial volume from slider
				const el = audioRef.current; if (el) el.volume = Math.max(0, Math.min(1, volume / 100));
			} catch (e) {
				console.error('Auto audio init error', e);
			}
		};
		run();
	}, [autoParams]);

	// Reusable export runner (used by button and auto export)
	const runExport = async () => {
		if (!canvasRef.current || !audioRef.current || !analyserNode) return null;
		const audio = audioRef.current;
		const canvas = exportCanvasRef.current;
		if (!canvas) { setExportError('Export canvas not ready'); return null; }
		if (muteDuringExport) setPlaybackMuted(true);
		setExporting(true); setExportProgress(0); setExportError('');
		const mime = codec === 'vp9' ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp8,opus';
		// Start recording with intro phase
		setExportPhase('intro');
		audio.currentTime = 0;
		start(canvas, getAudioStream(), { fps, mime, audioBitsPerSecond: aBitrate * 1000, videoBitsPerSecond: vBitrate * 1000 });
		// Record intro: dark screen with title/artist/frozen countdown
		await new Promise(r => setTimeout(r, introSecs * 1000));
		// Switch to playing phase and start audio
		setExportPhase('playing');
		await audio.play();
		const totalDur = (audio.duration || 0) + introSecs + outroSecs;
		const tick = () => {
			if (audio.duration > 0) {
				const elapsed = introSecs + (audio.currentTime || 0);
				setExportProgress(Math.min(1, elapsed / totalDur));
			}
			if (!audio.paused && !audio.ended) { requestAnimationFrame(tick); }
		};
		tick();
		await new Promise<void>((resolve) => {
			const check = () => {
				if (audio.ended || (audio.duration > 0 && (audio.currentTime || 0) >= audio.duration - 0.03)) { resolve(); }
				else requestAnimationFrame(check);
			};
			check();
		});
		audio.pause();
		// Switch to outro phase
		setExportPhase('outro');
		await new Promise(r => setTimeout(r, outroSecs * 1000));
		setExportPhase(undefined);
		const blob = await stop();
		if (muteDuringExport) setPlaybackMuted(false);
		setExportProgress(1);
		setExporting(false);
		return blob;
	};

	// Auto export when ready — only used for non-server (manual) auto export.
	// Server-side rendering uses the query-param useEffect below, which handles
	// prebuffering, progress tracking, and proper export canvas recording.
	// This effect is intentionally disabled when query-param auto-export is active.
	useEffect(() => {
		const run = async () => {
			if (!autoExport) return;
			if (!ready || !analyserNode) return;
			// Skip if server-side auto-export (query param) is handling it
			const q = new URLSearchParams(window.location.search);
			if (q.get('autoExport') === '1' && q.get('audio')) return;
			const blob = await runExport();
			if (blob) {
				(async () => {
					const ab = await blob.arrayBuffer();
					(Object.assign(window as any, { __exportBuffer: ab, __exportMime: blob.type, __exportDone: true }));
				})();
			}
		};
		run();
	}, [autoExport, ready, analyserNode]);

	const effectiveSize = useMemo(() => {
		const h = parseInt(res, 10);
		const w = Math.round(h * 16 / 9);
		if (aspect === '16:9') return { w, h };
		// 9:16 portrait: swap dimensions
		return { w: h, h: w };
	}, [aspect, res]);

	// Measure available canvas area width for auto-fit on window/panel resize
	useEffect(() => {
		const el = canvasAreaRef.current;
		if (!el) return;
		const ro = new ResizeObserver(entries => {
			setAvailWidth(entries[0]?.contentRect.width ?? el.clientWidth);
		});
		ro.observe(el);
		setAvailWidth(el.clientWidth);
		return () => ro.disconnect();
	}, []);

	// Sync theme to document root so body background/colors follow active theme
	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme);
	}, [theme]);

	// Effective display scale: respect user's canvasScale but clamp to fit container
	const displayScale = Math.min(canvasScale / 100, availWidth > 4 ? (availWidth - 4) / previewSize.w : 1);

	// Auto-export when launched with query params from server-side renderer.
	// Expected params: autoExport=1, audio=<url>, aspect, res, fps, codec, vBitrate, aBitrate, mode, theme
	useEffect(() => {
		const q = new URLSearchParams(window.location.search);
		if (q.get('autoExport') !== '1') return;
		// Prevent double-execution from React Strict Mode
		if ((window as any).__autoExportStarted) return;
		(window as any).__autoExportStarted = true;
		(async () => {
			try {
				setShowSettings(false);
				const qp = (name: string, fallback: string) => q.get(name) || fallback;
				const audioUrl = q.get('audio');
				const aspectQ = qp('aspect', '16:9') as '16:9'|'9:16';
				const resQ = (qp('res', '720') as '360'|'480'|'720'|'1080');
				const fpsQ = parseInt(qp('fps', '30'), 10) as 24|30|60;
				const codecQ = (qp('codec', 'vp9') as 'vp9'|'vp8');
				const vBitQ = parseInt(qp('vBitrate', '8000'), 10);
				const aBitQ = parseInt(qp('aBitrate', '192'), 10);
				const modeQ = q.get('mode') as VisualizerMode | null;
				const themeQ = q.get('theme');
				const characterQ = q.get('character');
				const animationsQ = q.get('animations'); // comma-separated
				const dancerSizeQ = q.get('dancerSize');
				const dancerPosQ = q.get('dancerPos');
				// Text overlay params
				const titleQ = q.get('title');
				const titlePosQ = q.get('titlePos');
				const titleColorQ = q.get('titleColor');
				const titleFxQ = { float: q.get('titleFloat') === '1', bounce: q.get('titleBounce') === '1', pulse: q.get('titlePulse') === '1' };
				const descQ = q.get('desc');
				const descPosQ = q.get('descPos');
				const descColorQ = q.get('descColor');
				const descFxQ = { float: q.get('descFloat') === '1', bounce: q.get('descBounce') === '1', pulse: q.get('descPulse') === '1' };
				// Countdown params
				const countPosQ = q.get('countPos');
				const countColorQ = q.get('countColor');
				const countFxQ = { float: q.get('countFloat') === '1', bounce: q.get('countBounce') === '1', pulse: q.get('countPulse') === '1' };
				// Background params
				const bgModeQ = q.get('bgMode');
				const bgColorQ = q.get('bgColor');
				const bgImageUrlQ = q.get('bgImageUrl');
				const bgFitQ = q.get('bgFit');
				const bgOpacityQ = q.get('bgOpacity');

				setAspect(aspectQ);
				setRes(resQ);
				setFps(fpsQ);
				setCodec(codecQ);
				setVBitrate(isFinite(vBitQ) ? vBitQ : 8000);
				setABitrate(isFinite(aBitQ) ? aBitQ : 192);
				if (themeQ) setTheme(themeQ);
				if (modeQ) {
					setMode(modeQ);
					setPanels(prev => prev.map(p => ({ ...p, mode: modeQ })));
				}
				// Multi-panel setup from query params
				const layoutQ = q.get('layout') as LayoutMode | null;
				const panelsJson = q.get('panels');
				if (layoutQ) setLayout(layoutQ);
				if (panelsJson) {
					try {
						const parsed = JSON.parse(panelsJson);
						if (Array.isArray(parsed) && parsed.length) {
							setPanels(parsed.map((p: any) => ({
								mode: p.mode || 'vertical-bars',
								color: p.color || color,
								band: p.band || 'full',
								colors: p.colors || defaultPanelColors,
								hgView: p.hgView || 'top',
								dancerSources: p.dancerSources,
							})));
						}
					} catch {}
				}

				// Wait for React to re-render with new panels/layout before continuing
				for (let i = 0; i < 10; i++) await new Promise(r => requestAnimationFrame(r));

				// Text overlays from query params
				if (titleQ) {
					setTitle(titleQ);
					if (titlePosQ) setTitlePos(titlePosQ as any);
					if (titleColorQ) setTitleColor(titleColorQ.startsWith('#') ? titleColorQ : '#' + titleColorQ);
					setTitleFx(titleFxQ);
				}
				if (descQ) {
					setDesc(descQ);
					if (descPosQ) setDescPos(descPosQ as any);
					if (descColorQ) setDescColor(descColorQ.startsWith('#') ? descColorQ : '#' + descColorQ);
					setDescFx(descFxQ);
				}

				// Countdown from query params (always enabled)
				if (countPosQ) setCountPos(countPosQ as any);
				if (countColorQ) setCountColor(countColorQ.startsWith('#') ? countColorQ : '#' + countColorQ);
				setCountFx(countFxQ);

				// Background from query params
				if (bgModeQ) setBgMode(bgModeQ as any);
				if (bgColorQ) setBgColor(bgColorQ.startsWith('#') ? bgColorQ : '#' + bgColorQ);
				if (bgImageUrlQ) setBgImageUrl(bgImageUrlQ);
				if (bgFitQ) setBgFit(bgFitQ as any);
				if (bgOpacityQ) setBgOpacity(parseFloat(bgOpacityQ));

				// Dancer overlay from query params
				const showDancerQ = q.get('showDancer') === '1';
				if (showDancerQ || characterQ || animationsQ) {
					setShowDancer(true);
					const src: DancerSources = {};
					if (characterQ) src.characterUrl = characterQ;
					if (animationsQ) src.animationUrls = animationsQ.split(',').map(s => s.trim()).filter(Boolean);
					// Camera settings from query params
					const cameraModeQ = q.get('cameraMode');
					const cameraElevQ = q.get('cameraElevationPct');
					const cameraTiltQ = q.get('cameraTiltDeg');
					const cameraSpeedQ = q.get('cameraSpeed');
					const cameraDistQ = q.get('cameraDistance');
					if (cameraModeQ) src.cameraMode = cameraModeQ as any;
					if (cameraElevQ) src.cameraElevationPct = parseFloat(cameraElevQ);
					if (cameraTiltQ) src.cameraTiltDeg = parseFloat(cameraTiltQ);
					if (cameraSpeedQ) src.cameraSpeed = parseFloat(cameraSpeedQ);
					if (cameraDistQ) src.cameraDistance = parseFloat(cameraDistQ);
					setDancerOverlaySources(src);
					if (dancerSizeQ) setDancerSize(Math.max(10, Math.min(100, parseInt(dancerSizeQ, 10) || 40)));
					if (dancerPosQ) setDancerPos(dancerPosQ as any);
				}
				
				// VU meter color from query params
				const colorQ = q.get('color');
				if (colorQ) setColor(colorQ.startsWith('#') ? colorQ : '#' + colorQ);

				if (!audioUrl) throw new Error('Missing audio URL');
				// Load audio from URL by creating a File to reuse existing init()
				const resp = await fetch(audioUrl);
				if (!resp.ok) throw new Error(`Audio fetch failed: ${resp.status}`);
				const mime = resp.headers.get('content-type') || 'audio/mpeg';
				const buf = await resp.arrayBuffer();
				const file = new File([buf], 'input.' + (mime.split('/')[1] || 'bin'), { type: mime });

				const analyser = await init(file);
				setAnalyserNode(analyser);
				const a = audioRef.current;
				setAudioEl(a || null);
				setReady(true);
				if (!a) throw new Error('Audio element not ready');

				// Wait for React to re-render and mount the export canvas
				let canvas: HTMLCanvasElement | null = null;
				for (let i = 0; i < 200; i++) {
					await new Promise(r => requestAnimationFrame(r));
					canvas = exportCanvasRef.current;
					if (canvas) break;
				}
				if (!canvas) throw new Error('Export canvas not ready after waiting');

				// --- Prebuffer: let the visualizer warm up before recording ---
				// Render idle frames so shaders compile, textures load, and 3D models settle.
				console.log('[auto-export] Prebuffering (warming up renderer)...');
				(window as any).__exportPrebuffering = true;
				const PREBUFFER_FRAMES = 300; // ~5 seconds at 60fps
				for (let i = 0; i < PREBUFFER_FRAMES; i++) {
					await new Promise(r => requestAnimationFrame(r));
				}
				// Additional time-based wait to ensure heavy assets (FBX models, textures) finish loading
				await new Promise(r => setTimeout(r, 3000));
				(window as any).__exportPrebuffering = false;
				console.log('[auto-export] Prebuffer done, starting recording');

				// Mute local playback so Puppeteer doesn't need audio output
				setPlaybackMuted(true);

				// Fallback codecs for headless Chrome (VP9 may not be available)
				const mimePrefs = codecQ === 'vp9'
					? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
					: ['video/webm;codecs=vp8,opus', 'video/webm'];
				let mimeOut = '';
				for (const m of mimePrefs) {
					if (MediaRecorder.isTypeSupported(m)) { mimeOut = m; break; }
				}
				console.log('[auto-export] Using MIME:', mimeOut || '(default)');

				// Start recording first, then wait for the recorder to settle before playing audio.
				// This ensures the video pipeline is fully primed so audio and video are in sync from frame 1.
				// We record extra silent frames that the server will trim with ffmpeg.
				const RECORDER_PREBUFFER_SECS = 3;
				// Start in intro phase (dark screen with title/artist/frozen countdown)
				setExportPhase('intro');
				start(canvas, getAudioStream(), { fps: fpsQ, mime: mimeOut || undefined, audioBitsPerSecond: aBitQ * 1000, videoBitsPerSecond: vBitQ * 1000 });
				console.log(`[auto-export] Recorder started, prebuffering ${RECORDER_PREBUFFER_SECS}s of silent frames...`);
				// Record silent frames to let the encoder fully warm up (these will be trimmed by server)
				await new Promise(r => setTimeout(r, RECORDER_PREBUFFER_SECS * 1000));
				console.log('[auto-export] Pipeline ready, recording intro...');
				// Expose the trim offset so the server knows how much to cut (prebuffer only, intro is kept)
				(window as any).__exportTrimStart = RECORDER_PREBUFFER_SECS;
				// Record intro dark screen
				await new Promise(r => setTimeout(r, introSecs * 1000));
				console.log('[auto-export] Intro done, starting audio playback');
				// Switch to playing phase
				setExportPhase('playing');
				(window as any).__exportProgress = 0;
				a.currentTime = 0;
				await a.play();
				const totalDur = introSecs + (a.duration || 0) + outroSecs;
				console.log('[auto-export] Playback started, duration:', a.duration);
				await new Promise<void>((resolve) => {
					const startTime = Date.now();
					const maxWaitMs = (a.duration + 5) * 1000; // duration + 5s safety margin
					const check = () => {
						if (a.duration > 0) {
							const elapsed = introSecs + (a.currentTime || 0);
							const p = Math.min(1, elapsed / totalDur);
							(window as any).__exportProgress = p;
						}
						const elapsedMs = Date.now() - startTime;
						if (a.ended || (a.duration > 0 && (a.currentTime || 0) >= a.duration - 0.05) || elapsedMs > maxWaitMs) {
							console.log('[auto-export] Playback finished, ended:', a.ended, 'currentTime:', a.currentTime, 'elapsed:', elapsedMs);
							resolve();
						}
						else requestAnimationFrame(check);
					};
					check();
				});
				a.pause();
				// Record outro: dark screen with title/artist and 00:00 countdown
				console.log('[auto-export] Recording outro...');
				setExportPhase('outro');
				await new Promise(r => setTimeout(r, outroSecs * 1000));
				(window as any).__exportProgress = 1;
				setExportPhase(undefined);
				console.log('[auto-export] Stopping recorder...');
				const blob = await stop();
				console.log('[auto-export] Recorder stopped, blob size:', blob?.size);


				if (!blob) throw new Error('No export blob');
				const ab = await blob.arrayBuffer();
				console.log('[auto-export] Buffer ready, size:', ab.byteLength);
				// Expose to Puppeteer
				(Object.assign(window as any, {
					__exportBuffer: ab,
					__exportMime: blob.type || 'video/webm',
					__exportDone: true,
				}));
			} catch (err) {
				console.error('Auto-export failed:', err);
				(Object.assign(window as any, { __exportDone: false, __exportError: String(err) }));
			}
		})();
	}, []);
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


		type PanelConfig = { mode: VisualizerMode | 'triangles-bars' | 'threejs-3d' | 'threejs-points' | 'threejs-shader'; color: string; band: FrequencyBand; colors?: { low: string; mid: string; high: string }; dancerSources?: DancerSources; hgView?: 'top'|'side' };
	const defaultPanelColors = { low: '#7ee8c8', mid: '#a0b4f7', high: '#f7a0ba' };
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

	const handleDemo = async () => {
		const audioResp = await fetch('/demo/demo.wav');
		const audioBlob = await audioResp.blob();
		const audioFile = new File([audioBlob], 'demo.wav', { type: audioBlob.type });
		setAudioFile(audioFile);
		const a = await init(audioFile);
		setAnalyserNode(a);
		setAudioEl(audioRef.current);
		setReady(true);
		setBgMode('image');
		setBgImageUrl('/demo/demo.jpg');
		setBgFit('cover');
		setBgOpacity(1);
		setTitle('Demo');
		setTitlePos('mt');
		setTitleFx({ float: false, bounce: true, pulse: true });
		setDesc('Yegor Shabanov');
		setDescPos('lt');
		setDescFx({ float: false, bounce: true, pulse: true });
		setPanels([{ mode: 'rotating-circular-bars', color, band: 'full', colors: { low: '#00d08a', mid: '#7aa2ff', high: '#ff6b6b' }, hgView: 'top' }]);
		setShowDancer(true);
		setDancerPos('mm');
		setDancerSize(100);
		setDancerOverlaySources({ characterUrl: '/character/Maria J J Ong.fbx', animationUrls: ['/dance/Swing Dancing.fbx', '/dance/Twist Dance.fbx', '/dance/Wave Hip Hop Dance.fbx'] });
		setTimeout(() => { const el = audioRef.current; if (el) el.play(); }, 400);
	};

	return (
		<>
			<div className="viz-glow viz-glow-1" />
			<div className="viz-glow viz-glow-2" />
			<div className="viz-glow viz-glow-3" />
			<div data-theme={theme} className={`app ${showSettings ? 'settings-open' : ''}`}> 
			<TopBar onToggleSettings={() => setShowSettings(s => !s)} onDemo={handleDemo} />
			<aside className={`settings-drawer ${showSettings ? 'open' : ''}`}>

			<GeneralSettings
				openSections={openSections}
				toggleSection={toggleSection}
				layout={layout}
				setLayout={v => {
					const nextLayout = v as LayoutMode;
					setLayout(nextLayout);
					const nextCount = nextLayout === '4' ? 4 : nextLayout === '1' ? 1 : 2;
					setPanels(prev => {
						const next = [...prev];
						if (next.length < nextCount) {
							for (let i = next.length; i < nextCount; i++) next.push({ mode, color, band: 'full', colors: defaultPanelColors, hgView: 'top' });
						} else if (next.length > nextCount) { next.length = nextCount; }
						return next;
					});
				}}
				theme={theme}
				setTheme={setTheme}
				color={color}
				setColor={setColor}
				bgMode={bgMode}
				setBgMode={v => setBgMode(v as typeof bgMode)}
				bgColor={bgColor}
				setBgColor={setBgColor}
				bgImageUrl={bgImageUrl}
				setBgImageUrl={setBgImageUrl}
				bgFit={bgFit}
				setBgFit={v => setBgFit(v as typeof bgFit)}
				bgOpacity={bgOpacity}
				setBgOpacity={setBgOpacity}
			/>
			<PanelsSettings
				openSections={openSections}
				toggleSection={toggleSection}
				panels={panels}
				setPanels={setPanels}
				VISUALIZER_CATEGORIES={EXTENDED_CATEGORIES}
				LABELS={LABELS}
				CUSTOM_MODES={CUSTOM_MODES}
				defaultPanelColors={defaultPanelColors}
			/>
			<CharacterSettings
				open={openSections.character}
				openSections={openSections}
				toggleSection={toggleSection}
				showDancer={showDancer}
				setShowDancer={setShowDancer}
				dancerPos={dancerPos}
				setDancerPos={setDancerPos}
				dancerSize={dancerSize}
				setDancerSize={setDancerSize}
				dancerOverlaySources={dancerOverlaySources}
				setDancerOverlaySources={setDancerOverlaySources}
				charFiles={charFiles}
				animFiles={animFiles}
				analyserNode={analyserNode}
			/>
			<CameraSettings
				open={openSections.camera}
				openSections={openSections}
				toggleSection={toggleSection}
				dancerOverlaySources={dancerOverlaySources}
				setDancerOverlaySources={setDancerOverlaySources}
			/>
			<TextOverlaySettings
				openSections={openSections}
				toggleSection={toggleSection}
				introSecs={introSecs}
				setIntroSecs={setIntroSecs}
				outroSecs={outroSecs}
				setOutroSecs={setOutroSecs}
				title={title}
				setTitle={setTitle}
				titlePos={titlePos}
				setTitlePos={setTitlePos}
				titleColor={titleColor}
				setTitleColor={setTitleColor}
				titleFx={titleFx}
				setTitleFx={setTitleFx}
				desc={desc}
				setDesc={setDesc}
				descPos={descPos}
				setDescPos={setDescPos}
				descColor={descColor}
				setDescColor={setDescColor}
				descFx={descFx}
				setDescFx={setDescFx}
				countPos={countPos}
				setCountPos={setCountPos}
				countColor={countColor}
				setCountColor={setCountColor}
				countFx={countFx}
				setCountFx={setCountFx}
			/>
			<ExportSettings
				openSections={openSections}
				toggleSection={toggleSection}
				ready={ready}
				aspect={aspect}
				setAspect={v => setAspect(v as typeof aspect)}
				res={res}
				setRes={v => setRes(v as typeof res)}
				fps={fps}
				setFps={v => setFps(v as typeof fps)}
				outputFormat={outputFormat}
				setOutputFormat={v => setOutputFormat(v as typeof outputFormat)}
				vBitrate={vBitrate}
				setVBitrate={setVBitrate}
				aBitrate={aBitrate}
				setABitrate={setABitrate}
				muteDuringExport={muteDuringExport}
				setMuteDuringExport={setMuteDuringExport}
				effectiveSize={effectiveSize}
				exporting={exporting}
				exportProgress={exportProgress}
				exportError={exportError}
				runExport={runExport}
			/>
			{/* ── SERVER RENDER ── */}
			{ready && (
			<div className="section">
				<div className="section-header" onClick={() => toggleSection('server')}>
					<span className={`chevron ${openSections.server ? 'open' : ''}`}>▶</span>
					Server Render
				</div>
				{openSections.server && (
					<div className="section-body">
						   <div className="field-row" style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
							   <label style={{ fontWeight: 500, fontSize: 13, color: '#7aa2ff', marginBottom: 2 }}>Server Render URL</label>
							   <input
								   type="text"
								   value={serverUrl}
								   onChange={e => setServerUrl(e.target.value)}
								   style={{ width: '100%', fontSize: 13, padding: 4, borderRadius: 4, border: '1px solid #333', background: '#181a20', color: '#e6e6eb', marginBottom: 6 }}
							   />
							<button disabled={serverRendering || !audioFile} onClick={async () => {
								if (!audioFile) return;
								setServerRendering(true); setServerProgress(0); setServerError(''); setServerStatus('uploading');
								try {
									const fd = new FormData();
									fd.append('file', audioFile);
									fd.append('aspect', aspect); fd.append('res', res); fd.append('fps', String(fps));
									fd.append('codec', codec); fd.append('format', outputFormat);
									fd.append('vBitrate', String(vBitrate)); fd.append('aBitrate', String(aBitrate));
									fd.append('mode', panels[0]?.mode || mode); fd.append('layout', layout);
									fd.append('panels', JSON.stringify(panels)); fd.append('theme', theme);
									fd.append('color', color); // VU meter accent color
									if (stereo) fd.append('showVU', '1'); // Enable VU meters if stereo is available
									if (showDancer && dancerOverlaySources.characterUrl) {
										fd.append('showDancer', '1');
										fd.append('character', dancerOverlaySources.characterUrl);
										if (dancerOverlaySources.animationUrls?.length) fd.append('animations', dancerOverlaySources.animationUrls.join(','));
										fd.append('dancerSize', String(dancerSize));
										fd.append('dancerPos', dancerPos);
										// Send camera parameters if present
										if (dancerOverlaySources.cameraMode) fd.append('cameraMode', dancerOverlaySources.cameraMode);
										if (dancerOverlaySources.cameraElevationPct !== undefined) fd.append('cameraElevationPct', String(dancerOverlaySources.cameraElevationPct));
										if (dancerOverlaySources.cameraTiltDeg !== undefined) fd.append('cameraTiltDeg', String(dancerOverlaySources.cameraTiltDeg));
										if (dancerOverlaySources.cameraSpeed !== undefined) fd.append('cameraSpeed', String(dancerOverlaySources.cameraSpeed));
										if (dancerOverlaySources.cameraDistance !== undefined) fd.append('cameraDistance', String(dancerOverlaySources.cameraDistance));
									}
									if (title) { fd.append('title', title); fd.append('titlePos', titlePos); fd.append('titleColor', titleColor); if (titleFx.float) fd.append('titleFloat', '1'); if (titleFx.bounce) fd.append('titleBounce', '1'); if (titleFx.pulse) fd.append('titlePulse', '1'); }
									if (desc) { fd.append('desc', desc); fd.append('descPos', descPos); fd.append('descColor', descColor); if (descFx.float) fd.append('descFloat', '1'); if (descFx.bounce) fd.append('descBounce', '1'); if (descFx.pulse) fd.append('descPulse', '1'); }
									fd.append('showCountdown', '1'); fd.append('countPos', countPos); fd.append('countColor', countColor); if (countFx.float) fd.append('countFloat', '1'); if (countFx.bounce) fd.append('countBounce', '1'); if (countFx.pulse) fd.append('countPulse', '1');
									fd.append('bgMode', bgMode);
									if (bgMode === 'color') fd.append('bgColor', bgColor);
									if (bgMode === 'image' && bgImageUrl) fd.append('bgImageUrl', bgImageUrl);
									fd.append('bgFit', bgFit); fd.append('bgOpacity', String(bgOpacity));

									const resp = await fetch(serverUrl, { method: 'POST', body: fd });
									const reader = resp.body?.getReader();
									if (!reader) throw new Error('No response stream');
									const decoder = new TextDecoder();
									let buf = '';
									const processLines = (text: string) => {
										buf += text;
										const lines = buf.split('\n');
										buf = lines.pop() || '';
										for (const line of lines) {
											if (!line.startsWith('data: ')) continue;
											try {
												const evt = JSON.parse(line.slice(6));
												if (evt.status) setServerStatus(evt.status);
												if (evt.progress !== undefined) setServerProgress(evt.progress);
												if (evt.status === 'error') { setServerError(evt.detail || evt.error || 'Render failed'); setServerRendering(false); return true; }
												if (evt.status === 'done') { setServerProgress(100); setServerRendering(false); fetchRenderedFiles(); return true; }
											} catch {}
										}
										return false;
									};
									let finished = false;
									while (true) {
										const { done, value } = await reader.read();
										if (done) break;
										finished = processLines(decoder.decode(value, { stream: true }));
										if (finished) break;
									}
									if (!finished && buf.trim()) {
										const remaining = buf; buf = '';
										finished = processLines(remaining + '\n');
									}
									if (!finished) { setServerRendering(false); fetchRenderedFiles(); }
								} catch (e: any) {
									setServerError(String(e.message || e)); setServerRendering(false);
								}
							}} style={{ fontWeight: 600, flex: 1 }}>
								{serverRendering
									? (serverStatus === 'uploading' ? 'Uploading…' : serverStatus === 'loading' ? 'Loading…' : serverStatus === 'buffering' ? 'Buffering…' : serverStatus === 'recording' ? 'Recording…' : serverStatus === 'encoding' ? 'Encoding…' : serverStatus === 'transcoding' ? 'Transcoding…' : serverStatus === 'saving' ? 'Saving…' : 'Processing…')
									: 'Render on Server'}
							</button>
							{serverRendering && (() => {
								const phases = [
									{ key: 'uploading', icon: '⬆️', label: 'Upload' }, { key: 'loading', icon: '📦', label: 'Load' },
									{ key: 'buffering', icon: '⏳', label: 'Buffer' }, { key: 'recording', icon: '🔴', label: 'Record' },
									{ key: 'encoding', icon: '📤', label: 'Encode' }, { key: 'transcoding', icon: '🔄', label: 'Convert' },
									{ key: 'saving', icon: '💾', label: 'Save' },
								];
								const currentIdx = phases.findIndex(p => p.key === serverStatus);
								const phaseColors: Record<string, string> = { uploading: '#7aa2ff', loading: '#7aa2ff', buffering: '#ffa64d', recording: '#ff5555', encoding: '#aa77ff', transcoding: '#55cc77', saving: '#55cc77' };
								const clr = phaseColors[serverStatus] || '#7aa2ff';
								const isIndeterminate = serverStatus !== 'recording';
								const circ = 2 * Math.PI * 18;
								return (
									<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
										<div style={{ display: 'flex', gap: 2 }}>
											{phases.map((p, i) => (
												<div key={p.key} style={{ width: 6, height: 6, borderRadius: '50%', background: i < currentIdx ? '#55cc77' : i === currentIdx ? clr : 'var(--panelBorder)', transition: 'background 0.3s', boxShadow: i === currentIdx ? `0 0 4px ${clr}` : 'none' }} title={p.label} />
											))}
										</div>
										<div style={{ position: 'relative', width: 42, height: 42 }}>
											<svg width={42} height={42} viewBox="0 0 42 42">
												<circle cx={21} cy={21} r={18} fill="none" stroke="var(--panelBorder)" strokeWidth={3} />
												{isIndeterminate ? (
													<circle cx={21} cy={21} r={18} fill="none" stroke={clr} strokeWidth={3} strokeDasharray={`${circ * 0.25} ${circ * 0.75}`} strokeLinecap="round" transform="rotate(-90 21 21)" style={{ animation: 'spin 1s linear infinite', transformOrigin: '21px 21px' }} />
												) : (
													<circle cx={21} cy={21} r={18} fill="none" stroke={clr} strokeWidth={3} strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - serverProgress / 100)}`} strokeLinecap="round" transform="rotate(-90 21 21)" style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
												)}
											</svg>
											<span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
												{isIndeterminate ? phases[currentIdx]?.icon || '⏳' : `${serverProgress}%`}
											</span>
										</div>
									</div>
								);
							})()}
						</div>
						{serverError && <div style={{ color: '#ff6b6b', fontSize: 11 }}>{serverError}</div>}

						{/* Rendered files */}
						<div className="field-label" style={{ marginTop: 4 }}>Rendered Files</div>
						{renderedFiles.length === 0 ? (
							<div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No rendered files yet</div>
						) : (
							<div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
								{renderedFiles.map(f => (
									<div key={f.name} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
										<a href={`/rendered/${f.name}`} download style={{ color: 'var(--accent)', textDecoration: 'none' }}>{f.name}</a>
										<span style={{ color: 'var(--muted)' }}>{(f.size / 1048576).toFixed(1)} MB</span>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
			)}

			</aside>

			<PlaybackControls
				isPlaying={isPlaying}
				progress={progress}
				volume={volume}
				audioRef={audioRef}
				onAudioFile={async f => { setAudioFile(f); const a = await init(f); setAnalyserNode(a); setAudioEl(audioRef.current); setReady(true); }}
				onVolumeChange={v => { setVolume(v); setPlaybackVolume(v / 100); }}
			/>

			<TimelineScroller
				audioRef={audioRef}
				isPlaying={isPlaying}
				progress={progress}
			/>

				{/* Canvas area — measured for responsive auto-fit */}
				<div ref={canvasAreaRef} style={{ width: '100%' }}>
				{/* Canvas resize handle */}
				<div className="canvas-resize-row">
					<span className="canvas-resize-label">Canvas Size</span>
					<input type="range" min={40} max={160} value={canvasScale}
						onChange={e => setCanvasScale(Number(e.target.value))}
						className="canvas-resize-slider"
					/>
					<span className="canvas-resize-val">{Math.round(displayScale * 100)}%</span>
				</div>
				<div className="glassy-panel overlay-controls" ref={wrapRef}
					style={{
						position: 'relative',
						width: Math.round(previewSize.w * displayScale),
						height: Math.round(previewSize.h * displayScale),
						margin: '0 auto',
						overflow: 'hidden',
						cursor: ready ? 'pointer' : 'default',
					}}
					onClick={() => {
						const a = audioRef.current;
						if (!a || !ready) return;
						if (a.paused) a.play(); else a.pause();
					}}
				>
					{/* Only show overlays in the correct position, no duplicate title/timer. */}
					{ready && analyserNode && (
						<>
							{/* Scale inner content to fit the resized canvas wrapper */}
							<div style={{
								transformOrigin: 'top left',
							transform: `scale(${displayScale})`,
								width: previewSize.w,
								height: previewSize.h,
							}}>
								<VisualizerPanel
									analyserNode={analyserNode}
									analysers={analysers}
									layout={layout}
									panels={panels}
									previewSize={previewSize}
									effectiveSize={effectiveSize}
									audioEl={audioEl}
									bgMode={bgMode}
									bgColor={bgColor}
									bgImageUrl={bgImageUrl}
									bgFit={bgFit as 'cover'|'contain'|'stretch'|undefined}
									bgOpacity={bgOpacity}
									title={title}
									titlePos={titlePos}
									titleColor={titleColor}
									titleFx={titleFx}
									desc={desc}
									descPos={descPos}
									descColor={descColor}
									descFx={descFx}
									countPos={countPos}
									countColor={countColor}
									countFx={countFx}
									showDancer={showDancer}
									dancerPos={dancerPos}
									dancerSize={dancerSize}
									dancerOverlaySources={dancerOverlaySources}
									stereo={stereo}
									color={color}
									exportPhase={exportPhase}
									canvasRef={canvasRef}
									exportCanvasRef={exportCanvasRef}
								/>
							</div>
							{/* Fullscreen toggle — outside scaled div so it stays at corner */}
							<button
								className="icon-btn fullscreen"
								aria-label="Toggle Fullscreen"
								onClick={(e) => {
									e.stopPropagation();
									const el = wrapRef.current; if (!el) return;
									if (!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.();
								}}
							>⤢</button>
						</>
					)}
				</div>
				</div>{/* /canvasAreaRef */}
		</div>
	</>);
}