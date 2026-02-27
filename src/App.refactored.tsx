import { useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { PlaybackControls } from './components/PlaybackControls';
import { TimelineScroller } from './components/TimelineScroller';
import { SettingsDrawer, SettingsSection } from './components/SettingsDrawer';
import { GeneralSettings } from './components/GeneralSettings';
import { PanelsSettings } from './components/PanelsSettings';
import { CharacterSettings } from './components/CharacterSettings';
import { CameraSettings } from './components/CameraSettings';
import { TextOverlaySettings } from './components/TextOverlaySettings';
import { ExportSettings } from './components/ExportSettings';
import VisualizerPanel from './components/VisualizerPanel';
import { useAudioAnalyzer } from './audio/useAudioAnalyzer';
import { useCanvasRecorder } from './recorder/useCanvasRecorder';
import { usePlaybackState } from './hooks/usePlaybackState';
import { useQueryParams } from './hooks/useQueryParams';
import { useManifestLoader } from './hooks/useManifestLoader';
import { useAutoExport } from './hooks/useAutoExport';
import { useServerAutoExport } from './hooks/useServerAutoExport';
import { useDemoMode } from './hooks/useDemoMode';
import type { VisualizerMode, FrequencyBand } from './visualizer/visualizerModes';
import type { DancerSources } from './visualizer/dancer/DancerEngine';
import { ANIMATION_FILES } from './visualizer/dancer/animations';
import { CHARACTER_FILES } from './visualizer/dancer/characters';
import { VISUALIZER_MODES, LABELS } from './visualizer/visualizers';
import type { LayoutMode } from './visualizer/GridVisualizerCanvas';

const CUSTOM_MODES = [
	{ key: 'triangles-bars', label: 'Triangles + Bars' },
	{ key: 'threejs-3d', label: '3D Three.js Visualizer' },
	{ key: 'threejs-points', label: '3D Points Sphere' },
	{ key: 'threejs-shader', label: 'Shader Beast Visualizer' },
	{ key: 'threejs-ripples', label: 'Water Ripples Visualizer' },
	{ key: 'beast-shader-canvas', label: 'Beast Shader Canvas (Pure WebGL)' },
];

type Position9 = 'lt' | 'mt' | 'rt' | 'lm' | 'mm' | 'rm' | 'lb' | 'mb' | 'rb';
type Position5 = 'lt' | 'ct' | 'rt' | 'bl' | 'br';
type PanelConfig = {
	mode: VisualizerMode | 'triangles-bars' | 'threejs-3d' | 'threejs-points' | 'threejs-shader';
	color: string;
	band: FrequencyBand;
	colors?: { low: string; mid: string; high: string };
	dancerSources?: DancerSources;
	hgView?: 'top' | 'side';
};

export default function App() {
	const { audioRef, init, getAudioStream, getBandAnalyser, getStereoAnalysers, setPlaybackMuted } = useAudioAnalyzer();

	// UI State
	const [showSettings, setShowSettings] = useState(true);
	const [theme, setTheme] = useState('dark');
	const [color, setColor] = useState('#7aa2ff');

	// Background controls
	const [bgMode, setBgMode] = useState<'none' | 'color' | 'image' | 'parallax-spotlights' | 'parallax-lasers' | 'parallax-tunnel' | 'parallax-rays'>('none');
	const [bgColor, setBgColor] = useState<string>('#101321');
	const [bgImageUrl, setBgImageUrl] = useState<string>('');
	const [bgFit, setBgFit] = useState<'cover' | 'contain' | 'stretch'>('cover');
	const [bgOpacity, setBgOpacity] = useState<number>(1);

	// Audio state
	const [ready, setReady] = useState(false);
	const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
	const [audioFile, setAudioFile] = useState<File | null>(null);
	const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
	const [volume] = useState<number>(80);

	// Layout and panels
	const [layout, setLayout] = useState<LayoutMode>('1');
	const defaultPanelColors = { low: '#00d08a', mid: '#7aa2ff', high: '#ff6b6b' };
	const [panels, setPanels] = useState<PanelConfig[]>([
		{ mode: 'vertical-bars', color, band: 'full', colors: defaultPanelColors, hgView: 'top' }
	]);
	const [mode, setMode] = useState<VisualizerMode | 'triangles-bars'>('vertical-bars');

	// Canvas refs
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const wrapRef = useRef<HTMLDivElement | null>(null);

	// Export state
	const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9');
	const [res, setRes] = useState<'360' | '480' | '720' | '1080'>('720');
	const [fps, setFps] = useState<24 | 30 | 60>(30);
	const [codec, setCodec] = useState<'vp9' | 'vp8'>('vp9');
	const [outputFormat, setOutputFormat] = useState<'mp4' | 'webm'>('webm');
	const [vBitrate, setVBitrate] = useState<number>(4000);
	const [aBitrate, setABitrate] = useState<number>(192);
	const [muteDuringExport, setMuteDuringExport] = useState<boolean>(true);
	const [exporting, setExporting] = useState<boolean>(false);
	const [exportProgress, setExportProgress] = useState<number>(0);
	const [exportError, setExportError] = useState<string>('');
	const [exportPhase, setExportPhase] = useState<'intro' | 'playing' | 'outro' | undefined>(undefined);
	const [introSecs, setIntroSecs] = useState<number>(4);
	const [outroSecs, setOutroSecs] = useState<number>(5);

	// Auto export state
	const [autoExport, setAutoExport] = useState<boolean>(false);
	const [autoParams, setAutoParams] = useState<{ audioUrl?: string } | null>(null);

	// Text overlays
	const [title, setTitle] = useState('');
	const [titlePos, setTitlePos] = useState<Position9>('mt');
	const [titleColor, setTitleColor] = useState('#e6e6eb');
	const [titleFx, setTitleFx] = useState<{ float: boolean; bounce: boolean; pulse: boolean }>({ float: false, bounce: false, pulse: false });
	const [desc, setDesc] = useState('');
	const [descPos, setDescPos] = useState<Position9>('mb');
	const [descColor, setDescColor] = useState('#a0a4ae');
	const [descFx, setDescFx] = useState<{ float: boolean; bounce: boolean; pulse: boolean }>({ float: false, bounce: false, pulse: false });
	const [countPos, setCountPos] = useState<Position5>('rt');
	const [countColor, setCountColor] = useState('#e6e6eb');
	const [countFx, setCountFx] = useState<{ float: boolean; bounce: boolean; pulse: boolean }>({ float: false, bounce: true, pulse: true });

	// Dancer overlay
	const [showDancer, setShowDancer] = useState(false);
	const [dancerPos, setDancerPos] = useState<Position9>('mm');
	const [dancerSize, setDancerSize] = useState<number>(40);
	const [dancerOverlaySources, setDancerOverlaySources] = useState<DancerSources>({});

	// Server rendering
	const [serverUrl, setServerUrl] = useState('http://localhost:9090/render');
	const [serverRendering, setServerRendering] = useState(false);
	const [serverProgress, setServerProgress] = useState(0);
	const [serverStatus, setServerStatus] = useState('');
	const [serverError, setServerError] = useState('');
	const [renderedFiles, setRenderedFiles] = useState<{ name: string; size: number; date: string }[]>([]);

	// Collapsible sections
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

	// Recorder
	const { start, stop } = useCanvasRecorder();

	// Custom hooks
	const { animFiles, charFiles } = useManifestLoader(ANIMATION_FILES, CHARACTER_FILES);
	const { isPlaying, progress } = usePlaybackState({ audioEl });

	useQueryParams({
		setAutoExport,
		setAutoParams,
		setAspect,
		setRes,
		setFps,
		setVBitrate,
		setABitrate,
		setCodec,
		setTheme,
		setMode
	});

	// Stereo analysers
	const stereo = useMemo(() => (ready ? getStereoAnalysers() : null), [ready, getStereoAnalysers]);

	// Analysers for panels
	const analysers = useMemo(() => {
		if (!ready) return [] as (AnalyserNode | null)[];
		return panels.map(p => p.band === 'full' ? analyserNode : getBandAnalyser(p.band));
	}, [ready, panels, analyserNode, getBandAnalyser]);

	// Preview and effective sizes
	const previewSize = useMemo(() => {
		const h = Math.min(480, parseInt(res, 10));
		const w = Math.round(h * (aspect === '9:16' ? 9 / 16 : 16 / 9));
		if (aspect === '9:16') return { w: h, h: w };
		return { w, h };
	}, [aspect, res]);

	const effectiveSize = useMemo(() => {
		const h = parseInt(res, 10);
		const w = Math.round(h * 16 / 9);
		if (aspect === '16:9') return { w, h };
		return { w: h, h: w };
	}, [aspect, res]);

	// Demo mode
	const handleDemo = useDemoMode({
		audioRef,
		init,
		setAudioFile,
		setAnalyserNode,
		setAudioEl,
		setReady,
		setBgMode,
		setBgImageUrl,
		setBgFit,
		setBgOpacity,
		setTitle,
		setTitlePos,
		setTitleFx,
		setDesc,
		setDescPos,
		setDescFx,
		setPanels,
		setShowDancer,
		setDancerPos,
		setDancerSize,
		setDancerOverlaySources,
		color
	});

	// Audio file handler
	const handleAudioFile = async (file: File) => {
		setAudioFile(file);
		const a = await init(file);
		setAnalyserNode(a);
		setAudioEl(audioRef.current);
		setReady(true);
	};

	// Export runner
	const runExport = async () => {
		if (!canvasRef.current || !audioRef.current || !analyserNode) return null;
		const audio = audioRef.current;
		const canvas = exportCanvasRef.current;
		if (!canvas) {
			setExportError('Export canvas not ready');
			return null;
		}
		if (muteDuringExport) setPlaybackMuted(true);
		setExporting(true);
		setExportProgress(0);
		setExportError('');
		const mime = codec === 'vp9' ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp8,opus';

		// Intro
		setExportPhase('intro');
		audio.currentTime = 0;
		start(canvas, getAudioStream(), {
			fps,
			mime,
			audioBitsPerSecond: aBitrate * 1000,
			videoBitsPerSecond: vBitrate * 1000
		});
		await new Promise(r => setTimeout(r, introSecs * 1000));

		// Playing
		setExportPhase('playing');
		await audio.play();
		const totalDur = (audio.duration || 0) + introSecs + outroSecs;
		const tick = () => {
			if (audio.duration > 0) {
				const elapsed = introSecs + (audio.currentTime || 0);
				setExportProgress(Math.min(1, elapsed / totalDur));
			}
			if (!audio.paused && !audio.ended) {
				requestAnimationFrame(tick);
			}
		};
		tick();
		await new Promise<void>((resolve) => {
			const check = () => {
				if (audio.ended || (audio.duration > 0 && (audio.currentTime || 0) >= audio.duration - 0.03)) {
					resolve();
				} else requestAnimationFrame(check);
			};
			check();
		});
		audio.pause();

		// Outro
		setExportPhase('outro');
		await new Promise(r => setTimeout(r, outroSecs * 1000));
		setExportPhase(undefined);
		const blob = await stop();
		if (muteDuringExport) setPlaybackMuted(false);
		setExportProgress(1);
		setExporting(false);
		return blob;
	};

	// Auto export hooks
	useAutoExport({ autoExport, ready, analyserNode, runExport });

	useServerAutoExport({
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
	});

	// Load audio from URL (auto params)
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
				const el = audioRef.current;
				if (el) el.volume = Math.max(0, Math.min(1, volume / 100));
			} catch (e) {
				console.error('Auto audio init error', e);
			}
		};
		run();
	}, [autoParams, init, audioRef, volume]);

	// Fetch rendered files
	const fetchRenderedFiles = async () => {
		try {
			let resp = await fetch('/rendered/list').catch(() => null);
			if (!resp || !resp.ok) resp = await fetch('http://localhost:9090/rendered/list').catch(() => null);
			if (resp && resp.ok) setRenderedFiles(await resp.json());
		} catch {}
	};

	useEffect(() => {
		fetchRenderedFiles();
	}, []);

	// Server render handler
	const handleServerRender = async () => {
		if (!audioFile) return;
		setServerRendering(true);
		setServerProgress(0);
		setServerError('');
		setServerStatus('uploading');
		try {
			const fd = new FormData();
			fd.append('file', audioFile);
			fd.append('aspect', aspect);
			fd.append('res', res);
			fd.append('fps', String(fps));
			fd.append('codec', codec);
			fd.append('format', outputFormat);
			fd.append('vBitrate', String(vBitrate));
			fd.append('aBitrate', String(aBitrate));
			fd.append('mode', panels[0]?.mode || mode);
			fd.append('layout', layout);
			fd.append('panels', JSON.stringify(panels));
			fd.append('theme', theme);

			if (showDancer && dancerOverlaySources.characterUrl) {
				fd.append('character', dancerOverlaySources.characterUrl);
				if (dancerOverlaySources.animationUrls?.length) {
					fd.append('animations', dancerOverlaySources.animationUrls.join(','));
				}
				fd.append('dancerSize', String(dancerSize));
				fd.append('dancerPos', dancerPos);
				if (dancerOverlaySources.cameraMode) fd.append('cameraMode', dancerOverlaySources.cameraMode);
				if (dancerOverlaySources.cameraElevationPct !== undefined) fd.append('cameraElevationPct', String(dancerOverlaySources.cameraElevationPct));
				if (dancerOverlaySources.cameraTiltDeg !== undefined) fd.append('cameraTiltDeg', String(dancerOverlaySources.cameraTiltDeg));
				if (dancerOverlaySources.cameraSpeed !== undefined) fd.append('cameraSpeed', String(dancerOverlaySources.cameraSpeed));
				if (dancerOverlaySources.cameraDistance !== undefined) fd.append('cameraDistance', String(dancerOverlaySources.cameraDistance));
			}

			if (title) {
				fd.append('title', title);
				fd.append('titlePos', titlePos);
				fd.append('titleColor', titleColor);
				if (titleFx.float) fd.append('titleFloat', '1');
				if (titleFx.bounce) fd.append('titleBounce', '1');
				if (titleFx.pulse) fd.append('titlePulse', '1');
			}
			if (desc) {
				fd.append('desc', desc);
				fd.append('descPos', descPos);
				fd.append('descColor', descColor);
				if (descFx.float) fd.append('descFloat', '1');
				if (descFx.bounce) fd.append('descBounce', '1');
				if (descFx.pulse) fd.append('descPulse', '1');
			}
			fd.append('showCountdown', '1');
			fd.append('countPos', countPos);
			fd.append('countColor', countColor);
			if (countFx.float) fd.append('countFloat', '1');
			if (countFx.bounce) fd.append('countBounce', '1');
			if (countFx.pulse) fd.append('countPulse', '1');
			fd.append('bgMode', bgMode);
			if (bgMode === 'color') fd.append('bgColor', bgColor);
			if (bgMode === 'image' && bgImageUrl) fd.append('bgImageUrl', bgImageUrl);
			fd.append('bgFit', bgFit);
			fd.append('bgOpacity', String(bgOpacity));

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
						if (evt.status === 'error') {
							setServerError(evt.detail || evt.error || 'Render failed');
							setServerRendering(false);
							return true;
						}
						if (evt.status === 'done') {
							setServerProgress(100);
							setServerRendering(false);
							fetchRenderedFiles();
							return true;
						}
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
				const remaining = buf;
				buf = '';
				finished = processLines(remaining + '\n');
			}
			if (!finished) {
				setServerRendering(false);
				fetchRenderedFiles();
			}
		} catch (e: any) {
			setServerError(String(e.message || e));
			setServerRendering(false);
		}
	};

	// Handle layout changes
	const handleLayoutChange = (nextLayout: LayoutMode) => {
		setLayout(nextLayout);
		const nextCount = nextLayout === '4' ? 4 : nextLayout === '1' ? 1 : 2;
		setPanels(prev => {
			const next = [...prev];
			if (next.length < nextCount) {
				for (let i = next.length; i < nextCount; i++) {
					next.push({ mode, color, band: 'full', colors: defaultPanelColors, hgView: 'top' });
				}
			} else if (next.length > nextCount) {
				next.length = nextCount;
			}
			return next;
		});
	};

	return (
		<>
			<div className="viz-glow viz-glow-1" />
			<div className="viz-glow viz-glow-2" />
			<div className="viz-glow viz-glow-3" />
			<div data-theme={theme} className={`app ${showSettings ? 'settings-open' : ''}`}>
				<TopBar onToggleSettings={() => setShowSettings(s => !s)} onDemo={handleDemo} />

				<SettingsDrawer isOpen={showSettings}>
					<GeneralSettings
						openSections={openSections}
						toggleSection={toggleSection}
						layout={layout}
						setLayout={handleLayoutChange}
						theme={theme}
						setTheme={setTheme}
						color={color}
						setColor={setColor}
						bgMode={bgMode}
						setBgMode={setBgMode}
						bgColor={bgColor}
						setBgColor={setBgColor}
						bgImageUrl={bgImageUrl}
						setBgImageUrl={setBgImageUrl}
						bgFit={bgFit}
						setBgFit={setBgFit}
						bgOpacity={bgOpacity}
						setBgOpacity={setBgOpacity}
					/>

					<PanelsSettings
						openSections={openSections}
						toggleSection={toggleSection}
						panels={panels}
						setPanels={setPanels}
						visualizerModes={VISUALIZER_MODES}
						customModes={CUSTOM_MODES}
						labels={LABELS}
						defaultPanelColors={defaultPanelColors}
					/>

					<CharacterSettings
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

					{ready && (
						<ExportSettings
							openSections={openSections}
							toggleSection={toggleSection}
							aspect={aspect}
							setAspect={setAspect}
							res={res}
							setRes={setRes}
							fps={fps}
							setFps={setFps}
							outputFormat={outputFormat}
							setOutputFormat={setOutputFormat}
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
							onExport={async () => {
								const blob = await runExport();
								if (blob) {
									const url = URL.createObjectURL(blob);
									const a = document.createElement('a');
									a.href = url;
									a.download = `visualizer_${res}_${aspect.replace(':', '-')}.webm`;
									document.body.appendChild(a);
									a.click();
									a.remove();
									URL.revokeObjectURL(url);
								}
							}}
							serverUrl={serverUrl}
							setServerUrl={setServerUrl}
							serverRendering={serverRendering}
							serverProgress={serverProgress}
							serverStatus={serverStatus}
							serverError={serverError}
							renderedFiles={renderedFiles}
							onServerRender={handleServerRender}
							audioFile={audioFile}
						/>
					)}
				</SettingsDrawer>

				<PlaybackControls
					isPlaying={isPlaying}
					progress={progress}
					volume={volume}
					audioRef={audioRef}
					onAudioFile={handleAudioFile}
				/>

				<TimelineScroller audioRef={audioRef} isPlaying={isPlaying} progress={progress} />

				<div className="glassy-panel overlay-controls" ref={wrapRef} style={{ position: 'relative' }}>
					{ready && analyserNode && (
						<>
							<VisualizerPanel
								analyserNode={analyserNode}
								analysers={analysers}
								layout={layout}
								panels={panels}
								previewSize={previewSize}
								effectiveSize={effectiveSize}
								audioEl={audioEl}
								bgMode={bgMode as 'none' | 'color' | 'image' | 'parallax' | undefined}
								bgColor={bgColor}
								bgImageUrl={bgImageUrl}
								bgFit={bgFit as 'cover' | 'contain' | 'stretch' | undefined}
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
							<button
								className="icon-btn fullscreen"
								aria-label="Toggle Fullscreen"
								onClick={() => {
									const el = wrapRef.current;
									if (!el) return;
									if (!document.fullscreenElement) el.requestFullscreen?.();
									else document.exitFullscreen?.();
								}}
							>
								⤢
							</button>
						</>
					)}
				</div>
			</div>
		</>
	);
}
