import { useEffect } from 'react';
import type { VisualizerMode, FrequencyBand } from '../visualizer/visualizerModes';
import type { DancerSources } from '../visualizer/dancer/DancerEngine';

type Position9 = 'lt' | 'mt' | 'rt' | 'lm' | 'mm' | 'rm' | 'lb' | 'mb' | 'rb';
type Position5 = 'lt' | 'ct' | 'rt' | 'bl' | 'br';
type LayoutMode = '1' | '2-horizontal' | '2-vertical' | '4';
type PanelConfig = {
	mode: VisualizerMode | 'triangles-bars' | 'threejs-3d' | 'threejs-points' | 'threejs-shader';
	color: string;
	band: FrequencyBand;
	colors?: { low: string; mid: string; high: string };
	dancerSources?: DancerSources;
	hgView?: 'top' | 'side';
};

interface ServerAutoExportParams {
	audioRef: React.RefObject<HTMLAudioElement>;
	exportCanvasRef: React.RefObject<HTMLCanvasElement>;
	init: (file: File) => Promise<AnalyserNode>;
	getAudioStream: () => MediaStream;
	setAnalyserNode: (node: AnalyserNode) => void;
	setAudioEl: (el: HTMLAudioElement | null) => void;
	setReady: (ready: boolean) => void;
	setPlaybackMuted: (muted: boolean) => void;
	setExportPhase: (phase: 'intro' | 'playing' | 'outro' | undefined) => void;
	start: (canvas: HTMLCanvasElement, stream: MediaStream, options: any) => void;
	stop: () => Promise<Blob | null>;
	introSecs: number;
	outroSecs: number;
	color: string;
	defaultPanelColors: { low: string; mid: string; high: string };
	setAspect: (val: '16:9' | '9:16') => void;
	setRes: (val: '360' | '480' | '720' | '1080') => void;
	setFps: (val: 24 | 30 | 60) => void;
	setCodec: (val: 'vp9' | 'vp8') => void;
	setVBitrate: (val: number) => void;
	setABitrate: (val: number) => void;
	setTheme: (val: string) => void;
	setMode: (val: VisualizerMode | 'triangles-bars') => void;
	setPanels: (fn: (prev: PanelConfig[]) => PanelConfig[]) => void;
	setLayout: (val: LayoutMode) => void;
	setTitle: (val: string) => void;
	setTitlePos: (val: Position9) => void;
	setTitleColor: (val: string) => void;
	setTitleFx: (val: { float: boolean; bounce: boolean; pulse: boolean }) => void;
	setDesc: (val: string) => void;
	setDescPos: (val: Position9) => void;
	setDescColor: (val: string) => void;
	setDescFx: (val: { float: boolean; bounce: boolean; pulse: boolean }) => void;
	setCountPos: (val: Position5) => void;
	setCountColor: (val: string) => void;
	setCountFx: (val: { float: boolean; bounce: boolean; pulse: boolean }) => void;
	setBgMode: (val: 'none' | 'color' | 'image' | 'parallax-spotlights' | 'parallax-lasers' | 'parallax-tunnel' | 'parallax-rays') => void;
	setBgColor: (val: string) => void;
	setBgImageUrl: (val: string) => void;
	setBgFit: (val: 'cover' | 'contain' | 'stretch') => void;
	setBgOpacity: (val: number) => void;
	setShowDancer: (val: boolean) => void;
	setDancerOverlaySources: (val: DancerSources) => void;
	setDancerSize: (val: number) => void;
	setDancerPos: (val: Position9) => void;
	setShowSettings: (val: boolean) => void;
}

export function useServerAutoExport(params: ServerAutoExportParams) {
	const {
		audioRef,
		exportCanvasRef,
		init,
		getAudioStream,
		setAnalyserNode,
		setAudioEl,
		setReady,
		setPlaybackMuted,
		setExportPhase,
		start,
		stop,
		introSecs,
		outroSecs,
		color,
		defaultPanelColors,
		setAspect,
		setRes,
		setFps,
		setCodec,
		setVBitrate,
		setABitrate,
		setTheme,
		setMode,
		setPanels,
		setLayout,
		setTitle,
		setTitlePos,
		setTitleColor,
		setTitleFx,
		setDesc,
		setDescPos,
		setDescColor,
		setDescFx,
		setCountPos,
		setCountColor,
		setCountFx,
		setBgMode,
		setBgColor,
		setBgImageUrl,
		setBgFit,
		setBgOpacity,
		setShowDancer,
		setDancerOverlaySources,
		setDancerSize,
		setDancerPos,
		setShowSettings
	} = params;

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
				const aspectQ = qp('aspect', '16:9') as '16:9' | '9:16';
				const resQ = qp('res', '720') as '360' | '480' | '720' | '1080';
				const fpsQ = parseInt(qp('fps', '30'), 10) as 24 | 30 | 60;
				const codecQ = qp('codec', 'vp9') as 'vp9' | 'vp8';
				const vBitQ = parseInt(qp('vBitrate', '8000'), 10);
				const aBitQ = parseInt(qp('aBitrate', '192'), 10);
				const modeQ = q.get('mode') as VisualizerMode | null;
				const themeQ = q.get('theme');
				const characterQ = q.get('character');
				const animationsQ = q.get('animations');
				const dancerSizeQ = q.get('dancerSize');
				const dancerPosQ = q.get('dancerPos');

				// Text overlay params
				const titleQ = q.get('title');
				const titlePosQ = q.get('titlePos');
				const titleColorQ = q.get('titleColor');
				const titleFxQ = {
					float: q.get('titleFloat') === '1',
					bounce: q.get('titleBounce') === '1',
					pulse: q.get('titlePulse') === '1'
				};
				const descQ = q.get('desc');
				const descPosQ = q.get('descPos');
				const descColorQ = q.get('descColor');
				const descFxQ = {
					float: q.get('descFloat') === '1',
					bounce: q.get('descBounce') === '1',
					pulse: q.get('descPulse') === '1'
				};

				// Countdown params
				const countPosQ = q.get('countPos');
				const countColorQ = q.get('countColor');
				const countFxQ = {
					float: q.get('countFloat') === '1',
					bounce: q.get('countBounce') === '1',
					pulse: q.get('countPulse') === '1'
				};

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
								dancerSources: p.dancerSources
							})));
						}
					} catch {}
				}

				// Wait for React to re-render
				for (let i = 0; i < 10; i++) await new Promise(r => requestAnimationFrame(r));

				// Text overlays
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

				// Countdown
				if (countPosQ) setCountPos(countPosQ as any);
				if (countColorQ) setCountColor(countColorQ.startsWith('#') ? countColorQ : '#' + countColorQ);
				setCountFx(countFxQ);

				// Background
				if (bgModeQ) setBgMode(bgModeQ as any);
				if (bgColorQ) setBgColor(bgColorQ.startsWith('#') ? bgColorQ : '#' + bgColorQ);
				if (bgImageUrlQ) setBgImageUrl(bgImageUrlQ);
				if (bgFitQ) setBgFit(bgFitQ as any);
				if (bgOpacityQ) setBgOpacity(parseFloat(bgOpacityQ));

				// Dancer overlay
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

				// Load audio
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

				// Wait for export canvas
				let canvas: HTMLCanvasElement | null = null;
				for (let i = 0; i < 200; i++) {
					await new Promise(r => requestAnimationFrame(r));
					canvas = exportCanvasRef.current;
					if (canvas) break;
				}
				if (!canvas) throw new Error('Export canvas not ready after waiting');

				// Prebuffer
				console.log('[auto-export] Prebuffering (warming up renderer)...');
				(window as any).__exportPrebuffering = true;
				const PREBUFFER_FRAMES = 300;
				for (let i = 0; i < PREBUFFER_FRAMES; i++) {
					await new Promise(r => requestAnimationFrame(r));
				}
				await new Promise(r => setTimeout(r, 3000));
				(window as any).__exportPrebuffering = false;
				console.log('[auto-export] Prebuffer done, starting recording');

				setPlaybackMuted(true);

				// Fallback codecs
				const mimePrefs = codecQ === 'vp9'
					? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
					: ['video/webm;codecs=vp8,opus', 'video/webm'];
				let mimeOut = '';
				for (const m of mimePrefs) {
					if (MediaRecorder.isTypeSupported(m)) {
						mimeOut = m;
						break;
					}
				}
				console.log('[auto-export] Using MIME:', mimeOut || '(default)');

				const RECORDER_PREBUFFER_SECS = 3;
				setExportPhase('intro');
				start(canvas, getAudioStream(), {
					fps: fpsQ,
					mime: mimeOut || undefined,
					audioBitsPerSecond: aBitQ * 1000,
					videoBitsPerSecond: vBitQ * 1000
				});
				console.log(`[auto-export] Recorder started, prebuffering ${RECORDER_PREBUFFER_SECS}s...`);
				await new Promise(r => setTimeout(r, RECORDER_PREBUFFER_SECS * 1000));
				console.log('[auto-export] Pipeline ready, recording intro...');
				(window as any).__exportTrimStart = RECORDER_PREBUFFER_SECS;
				await new Promise(r => setTimeout(r, introSecs * 1000));
				console.log('[auto-export] Intro done, starting audio playback');

				setExportPhase('playing');
				(window as any).__exportProgress = 0;
				a.currentTime = 0;
				await a.play();
				const totalDur = introSecs + (a.duration || 0) + outroSecs;
				console.log('[auto-export] Playback started, duration:', a.duration);

				await new Promise<void>((resolve) => {
					const startTime = Date.now();
					const maxWaitMs = (a.duration + 5) * 1000;
					const check = () => {
						if (a.duration > 0) {
							const elapsed = introSecs + (a.currentTime || 0);
							const p = Math.min(1, elapsed / totalDur);
							(window as any).__exportProgress = p;
						}
						const elapsedMs = Date.now() - startTime;
						if (a.ended || (a.duration > 0 && (a.currentTime || 0) >= a.duration - 0.05) || elapsedMs > maxWaitMs) {
							console.log('[auto-export] Playback finished');
							resolve();
						} else requestAnimationFrame(check);
					};
					check();
				});
				a.pause();

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
					__exportDone: true
				}));
			} catch (err) {
				console.error('Auto-export failed:', err);
				(Object.assign(window as any, {
					__exportDone: false,
					__exportError: String(err)
				}));
			}
		})();
	}, []); // Empty deps - run once
}
