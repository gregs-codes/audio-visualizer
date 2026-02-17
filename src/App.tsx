import { useEffect, useMemo, useRef, useState } from 'react';
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
	const { audioRef, init, getAudioStream, getBandAnalyser, getStereoAnalysers, setPlaybackMuted } = useAudioAnalyzer();
	const [showSettings, setShowSettings] = useState(true);
		const [mode, setMode] = useState<VisualizerMode>('vertical-bars');
	const [theme, setTheme] = useState('dark');
	const [color, setColor] = useState('#7aa2ff');
	// Background controls
	const [bgMode, setBgMode] = useState<'none'|'color'|'image'|'parallax-spotlights'|'parallax-lasers'|'parallax-tunnel'|'parallax-rays'>('none');
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
	const [serverRenderError, setServerRenderError] = useState('');

	// Auto export via query params (for server-side rendering through Puppeteer)
	const [autoExport, setAutoExport] = useState<boolean>(false);
	const [autoParams, setAutoParams] = useState<{ audioUrl?: string } | null>(null);
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
	const wrapRef = useRef<HTMLDivElement | null>(null);

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

	// Live server logs
	const [showLogs, setShowLogs] = useState(false);
	const [serverLogs, setServerLogs] = useState<{ ts: number; level: string; text: string }[]>([]);
	const logEndRef = useRef<HTMLDivElement | null>(null);
	const logSourceRef = useRef<EventSource | null>(null);

	useEffect(() => {
		if (showLogs && !logSourceRef.current) {
			const es = new EventSource('http://localhost:9090/logs');
			es.onmessage = (e) => {
				try {
					const entry = JSON.parse(e.data);
					setServerLogs(prev => {
						const next = [...prev, entry];
						return next.length > 300 ? next.slice(-300) : next;
					});
				} catch {}
			};
			es.onerror = () => {};
			logSourceRef.current = es;
		} else if (!showLogs && logSourceRef.current) {
			logSourceRef.current.close();
			logSourceRef.current = null;
		}
		return () => {
			if (logSourceRef.current) { logSourceRef.current.close(); logSourceRef.current = null; }
		};
	}, [showLogs]);

	useEffect(() => {
		if (showLogs) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [serverLogs, showLogs]);

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
				if (characterQ || animationsQ) {
					setShowDancer(true);
					const src: DancerSources = {};
					if (characterQ) src.characterUrl = characterQ;
					if (animationsQ) src.animationUrls = animationsQ.split(',').map(s => s.trim()).filter(Boolean);
					setDancerOverlaySources(src);
					if (dancerSizeQ) setDancerSize(Math.max(10, Math.min(100, parseInt(dancerSizeQ, 10) || 40)));
					if (dancerPosQ) setDancerPos(dancerPosQ as any);
				}

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
				<div style={{ position: 'relative' }}>
					<button className="icon-btn" onClick={() => setShowLogs(s => !s)} aria-label="Server Logs"
						style={{ color: showLogs ? 'var(--accent, #7aa2ff)' : undefined }}>
						📋 Logs
					</button>
					{showLogs && (
						<div style={{
							position: 'absolute', top: '100%', right: 0, zIndex: 1000,
							width: 480, maxHeight: 360, overflow: 'hidden',
							background: 'var(--panelBg, #181a20)', border: '1px solid var(--panelBorder, #333)',
							borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,.5)',
							display: 'flex', flexDirection: 'column',
						}}>
							<div style={{ padding: '6px 10px', borderBottom: '1px solid var(--panelBorder, #333)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
								<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Server Logs</span>
								<button onClick={() => setServerLogs([])} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>Clear</button>
							</div>
							<div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5 }}>
								{serverLogs.length === 0 && <div style={{ color: 'var(--muted)', padding: 8, fontStyle: 'italic' }}>No logs yet — waiting for server activity…</div>}
								{serverLogs.map((l, i) => (
									<div key={i} style={{ color: l.level === 'error' ? 'var(--danger, #ff6b6b)' : 'var(--text, #ccc)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
										<span style={{ color: 'var(--muted)', marginRight: 6 }}>{new Date(l.ts).toLocaleTimeString()}</span>
										{l.text}
									</div>
								))}
								<div ref={logEndRef} />
							</div>
						</div>
					)}
				</div>
				<button className="icon-btn" onClick={() => setShowSettings(s => !s)} aria-label="Toggle Settings">⚙︎ Settings</button>
			</div>
			<aside className={`settings-drawer ${showSettings ? 'open' : ''}`}>

			{/* ── GENERAL ── */}
			<div className="section">
				<div className="section-header" onClick={() => toggleSection('general')}>
					<span className={`chevron ${openSections.general ? 'open' : ''}`}>▶</span>
					General
				</div>
				{openSections.general && (
					<div className="section-body">
						<div className="field-row">
							<label>Layout
								<select value={layout} onChange={e => {
									const nextLayout = e.target.value as LayoutMode;
									setLayout(nextLayout);
									const nextCount = nextLayout === '4' ? 4 : nextLayout === '1' ? 1 : 2;
									setPanels(prev => {
										const next = [...prev];
										if (next.length < nextCount) {
											for (let i = next.length; i < nextCount; i++) next.push({ mode, color, band: 'full', colors: defaultPanelColors, hgView: 'top' });
										} else if (next.length > nextCount) { next.length = nextCount; }
										return next;
									});
								}}>
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
							<select value={bgMode} onChange={e => setBgMode(e.target.value as typeof bgMode)}>
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
									<select value={bgFit} onChange={e => setBgFit(e.target.value as 'cover'|'contain'|'stretch')}>
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

			{/* ── PANELS ── */}
			<div className="section">
				<div className="section-header" onClick={() => toggleSection('panels')}>
					<span className={`chevron ${openSections.panels ? 'open' : ''}`}>▶</span>
					Panels
				</div>
				{openSections.panels && (
					<div className="section-body">
						{panels.map((p, i) => (
							<div key={i} style={{ display: 'grid', gap: 6 }}>
								<div className="field-label">Panel {i + 1}</div>
								<div className="field-row">
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
										<select value={p.hgView ?? 'top'} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, hgView: e.target.value as 'top'|'side' } : x))}>
											<option value='top'>Top</option>
											<option value='side'>Side</option>
										</select>
									)}
									<input type='color' value={p.color} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, color: e.target.value } : x))} />
									<span className="swatch" style={{ background: p.color }} />
								</div>
								{p.mode !== 'wave' && (
									<div className="field-row">
										<label>Low <input type='color' value={p.colors?.low ?? defaultPanelColors.low} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), low: e.target.value } } : x))} /> <span className="swatch" style={{ background: p.colors?.low ?? defaultPanelColors.low, width: 12, height: 12 }} /></label>
										<label>Mid <input type='color' value={p.colors?.mid ?? defaultPanelColors.mid} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), mid: e.target.value } } : x))} /> <span className="swatch" style={{ background: p.colors?.mid ?? defaultPanelColors.mid, width: 12, height: 12 }} /></label>
										<label>High <input type='color' value={p.colors?.high ?? defaultPanelColors.high} onChange={e => setPanels(old => old.map((x, idx) => idx === i ? { ...x, colors: { ...(x.colors ?? defaultPanelColors), high: e.target.value } } : x))} /> <span className="swatch" style={{ background: p.colors?.high ?? defaultPanelColors.high, width: 12, height: 12 }} /></label>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			{/* ── 3D CHARACTER ── */}
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
								<select value={dancerPos} onChange={e => setDancerPos(e.target.value as Position9)}>
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
							<select value={(dancerOverlaySources.colorFlash?.mode) ?? 'flash'} onChange={e => setDancerOverlaySources(s => ({ ...s, colorFlash: { ...(s.colorFlash ?? {}), mode: e.target.value as 'flash'|'strobe'|'spot' } }))}>
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

			{/* ── CAMERA ── */}
			<div className="section">
				<div className="section-header" onClick={() => toggleSection('camera')}>
					<span className={`chevron ${openSections.camera ? 'open' : ''}`}>▶</span>
					Camera
				</div>
				{openSections.camera && (
					<div className="section-body">
						<div className="field-row">
							<label>Movement
								<select value={dancerOverlaySources.cameraMode ?? 'static'} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraMode: e.target.value as DancerSources['cameraMode'] }))}>
									<option value="static">Static</option>
									<option value="pan">Pan</option>
									<option value="rotate">Rotate</option>
								</select>
							</label>
						</div>
						<div className="field-row">
							<label>Elevation
								<input type='range' min={-20} max={20} value={Math.round((dancerOverlaySources.cameraElevationPct ?? 0) * 100)} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraElevationPct: parseInt(e.target.value, 10) / 100 }))} />
								<span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{Math.round((dancerOverlaySources.cameraElevationPct ?? 0) * 100)}%</span>
							</label>
						</div>
						<div className="field-row">
							<label>Tilt
								<input type='range' min={-15} max={15} value={Math.round(dancerOverlaySources.cameraTiltDeg ?? 0)} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraTiltDeg: parseInt(e.target.value, 10) }))} />
								<span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{Math.round(dancerOverlaySources.cameraTiltDeg ?? 0)}°</span>
							</label>
						</div>
						<div className="field-row">
							<label>Speed
								<input type='range' min={0} max={200} value={dancerOverlaySources.cameraSpeed ?? 100} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraSpeed: parseInt(e.target.value, 10) }))} />
								<span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{dancerOverlaySources.cameraSpeed ?? 100}%</span>
							</label>
						</div>
						<div className="field-row">
							<label>Distance
								<input type='range' min={20} max={200} value={dancerOverlaySources.cameraDistance ?? 100} onChange={e => setDancerOverlaySources(s => ({ ...s, cameraDistance: parseInt(e.target.value, 10) }))} />
								<span style={{ width: 32, textAlign: 'right', fontSize: 11 }}>{dancerOverlaySources.cameraDistance ?? 100}%</span>
							</label>
						</div>
					</div>
				)}
			</div>

			{/* ── TEXT OVERLAYS ── */}
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
							<select value={titlePos} onChange={e => setTitlePos(e.target.value as Position9)}>
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
							<select value={descPos} onChange={e => setDescPos(e.target.value as Position9)}>
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
							<select value={countPos} onChange={e => setCountPos(e.target.value as Position5)}>
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

			{/* ── EXPORT ── */}
			{ready && (
			<div className="section">
				<div className="section-header" onClick={() => toggleSection('export')}>
					<span className={`chevron ${openSections.export ? 'open' : ''}`}>▶</span>
					Export
				</div>
				{openSections.export && (
					<div className="section-body">
						<div className="field-row">
							<label>Aspect
								<select value={aspect} onChange={e => setAspect(e.target.value as '16:9'|'9:16')}>
									<option value='16:9'>16:9</option><option value='9:16'>9:16</option>
								</select>
							</label>
							<label>Res
								<select value={res} onChange={e => setRes(e.target.value as typeof res)}>
									<option value='360'>360p</option><option value='480'>480p</option>
									<option value='720'>720p</option><option value='1080'>1080p</option>
								</select>
							</label>
							<label>FPS
								<select value={fps} onChange={e => setFps(parseInt(e.target.value, 10) as 24|30|60)}>
									<option value={24}>24</option><option value={30}>30</option><option value={60}>60</option>
								</select>
							</label>
						</div>
						<div className="field-row">
							<label>Format
								<select value={outputFormat} onChange={e => setOutputFormat(e.target.value as 'mp4'|'webm')}>
									<option value='mp4'>MP4</option><option value='webm'>WebM</option>
								</select>
							</label>
							<label>Video
								<select value={vBitrate} onChange={e => setVBitrate(parseInt(e.target.value, 10))}>
									<option value={2000}>2 Mbps</option><option value={4000}>4 Mbps</option>
									<option value={6000}>6 Mbps</option><option value={8000}>8 Mbps</option>
									<option value={12000}>12 Mbps</option>
								</select>
							</label>
							<label>Audio
								<select value={aBitrate} onChange={e => setABitrate(parseInt(e.target.value, 10))}>
									<option value={128}>128k</option><option value={160}>160k</option>
									<option value={192}>192k</option><option value={256}>256k</option>
									<option value={320}>320k</option>
								</select>
							</label>
						</div>
						<div className="field-row">
							<label><input type='checkbox' checked={muteDuringExport} onChange={e => setMuteDuringExport(e.target.checked)} /> Mute during export</label>
							<span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 'auto' }}>{effectiveSize.w}×{effectiveSize.h}</span>
						</div>
						<button disabled={exporting} onClick={async () => {
							const blob = await runExport();
							if (blob) {
								const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `visualizer_${res}_${aspect.replace(':','-')}.webm`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
							}
						}}>Export</button>
						{exporting && (
							<div className="field-row">
								<div style={{ flex: 1, height: 6, background: 'var(--panelBorder)', borderRadius: 3, overflow: 'hidden' }}>
									<div style={{ width: `${Math.round(exportProgress * 100)}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
								</div>
								<span style={{ fontSize: 11, color: 'var(--muted)' }}>{Math.round(exportProgress * 100)}%</span>
							</div>
						)}
						{exportError && <div style={{ color: '#ff6b6b', fontSize: 11 }}>{exportError}</div>}
					</div>
				)}
			</div>
			)}

			{/* ── SERVER RENDER ── */}
			{ready && (
			<div className="section">
				<div className="section-header" onClick={() => toggleSection('server')}>
					<span className={`chevron ${openSections.server ? 'open' : ''}`}>▶</span>
					Server Render
				</div>
				{openSections.server && (
					<div className="section-body">
						<div className="field-row" style={{ gap: 8 }}>
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
									if (showDancer && dancerOverlaySources.characterUrl) {
										fd.append('character', dancerOverlaySources.characterUrl);
										if (dancerOverlaySources.animationUrls?.length) fd.append('animations', dancerOverlaySources.animationUrls.join(','));
										fd.append('dancerSize', String(dancerSize)); fd.append('dancerPos', dancerPos);
									}
									if (title) { fd.append('title', title); fd.append('titlePos', titlePos); fd.append('titleColor', titleColor); if (titleFx.float) fd.append('titleFloat', '1'); if (titleFx.bounce) fd.append('titleBounce', '1'); if (titleFx.pulse) fd.append('titlePulse', '1'); }
									if (desc) { fd.append('desc', desc); fd.append('descPos', descPos); fd.append('descColor', descColor); if (descFx.float) fd.append('descFloat', '1'); if (descFx.bounce) fd.append('descBounce', '1'); if (descFx.pulse) fd.append('descPulse', '1'); }
									fd.append('showCountdown', '1'); fd.append('countPos', countPos); fd.append('countColor', countColor); if (countFx.float) fd.append('countFloat', '1'); if (countFx.bounce) fd.append('countBounce', '1'); if (countFx.pulse) fd.append('countPulse', '1');
									fd.append('bgMode', bgMode);
									if (bgMode === 'color') fd.append('bgColor', bgColor);
									if (bgMode === 'image' && bgImageUrl) fd.append('bgImageUrl', bgImageUrl);
									fd.append('bgFit', bgFit); fd.append('bgOpacity', String(bgOpacity));

									const resp = await fetch('http://localhost:9090/render', { method: 'POST', body: fd });
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
							onChange={async e => { const f = e.target.files?.[0]; if (f) { setAudioFile(f); const a = await init(f); setAnalyserNode(a); setAudioEl(audioRef.current); setReady(true); } }}
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
									width={previewSize.w}
									height={previewSize.h}
									audio={audioEl}
									backgroundColor={bgMode === 'color' ? bgColor : undefined}
									backgroundImageUrl={bgMode === 'image' ? bgImageUrl : undefined}
									backgroundFit={bgFit}
									backgroundOpacity={bgOpacity}
									bgMode={bgMode}
									instanceKey={'preview'}
									overlayTitle={{ text: title, position: titlePos, color: titleColor, effects: titleFx }}
									overlayDescription={{ text: desc, position: descPos, color: descColor, effects: descFx }}
									overlayCountdown={{ enabled: true, position: countPos, color: countColor, effects: countFx }}
									overlayDancer={{ enabled: showDancer, position: dancerPos, widthPct: dancerSize, sources: dancerOverlaySources }}
									overlayVU={stereo ? { left: stereo.left, right: stereo.right, accentColor: color, position: countPos } : undefined}
								/>
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
									bgMode={bgMode}
									instanceKey={'export'}
									overlayTitle={{ text: title, position: titlePos, color: titleColor, effects: titleFx }}
									overlayDescription={{ text: desc, position: descPos, color: descColor, effects: descFx }}
									overlayCountdown={{ enabled: true, position: countPos, color: countColor, effects: countFx }}
									overlayDancer={{ enabled: showDancer, position: dancerPos, widthPct: dancerSize, sources: dancerOverlaySources }}
									overlayVU={stereo ? { left: stereo.left, right: stereo.right, accentColor: color, position: countPos } : undefined}
									exportPhase={exportPhase}
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