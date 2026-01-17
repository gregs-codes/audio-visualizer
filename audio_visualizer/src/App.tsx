import { useMemo, useRef, useState } from 'react';
import { useAudioAnalyzer } from './audio/useAudioAnalyzer';
import { GridVisualizerCanvas } from './visualizer/GridVisualizerCanvas';
import type { VisualizerMode, FrequencyBand } from './visualizer/visualizerModes';
import type { LayoutMode } from './visualizer/GridVisualizerCanvas';
import { useCanvasRecorder } from './recorder/useCanvasRecorder';

export default function App(){
			const { audioRef, init, getAudioStream, getBandAnalyser } = useAudioAnalyzer();
		const [mode, setMode] = useState<VisualizerMode>('bars');
	const [theme, setTheme] = useState('dark');
	const [color, setColor] = useState('#7aa2ff');
	const [ready, setReady] = useState(false);
	const [layout, setLayout] = useState<LayoutMode>('1');
	const [analyserNode, setAnalyserNode] = useState<AnalyserNode|null>(null);
	const canvasRef = useRef<HTMLCanvasElement|null>(null);
	const { start, stop, download, recording } = useCanvasRecorder();

		type PanelConfig = { mode: VisualizerMode; color: string; band: FrequencyBand };
		const [panels, setPanels] = useState<PanelConfig[]>([{ mode: 'bars', color, band: 'full' }]);

			// Panels are user-controlled; length changes handled when layout changes.

			const analysers = useMemo(() => {
			if (!ready) return [] as (AnalyserNode|null)[];
			return panels.map(p => p.band === 'full' ? analyserNode : (getBandAnalyser(p.band)));
			}, [ready, panels, analyserNode, getBandAnalyser]);

		return (
			<div data-theme={theme} className="app">
				<div className="toolbar">
			<input type='file' accept='audio/*' onChange={async e=>{const f=e.target.files?.[0]; if(f){const a=await init(f); setAnalyserNode(a); setReady(true);} }} />
				<button onClick={()=>audioRef.current?.play()}>Play</button>
				<button onClick={()=>audioRef.current?.pause()}>Pause</button>
				<label>
					Layout
								<select value={layout} onChange={e=>{
									const nextLayout = e.target.value as LayoutMode;
									setLayout(nextLayout);
									const nextCount = nextLayout === '4' ? 4 : nextLayout === '1' ? 1 : 2;
									setPanels(prev => {
										const next = [...prev];
										if (next.length < nextCount) {
											for (let i = next.length; i < nextCount; i++) next.push({ mode, color, band: 'full' });
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
							<select value={mode} onChange={e=>setMode(e.target.value as VisualizerMode)}>
								<option value='bars'>Bars</option>
								<option value='wave'>Wave</option>
								<option value='circle'>Circle</option>
							</select>
						</label>
				<label>
					Theme
					<select value={theme} onChange={e=>setTheme(e.target.value)}>
						<option value='dark'>Dark</option>
						<option value='light'>Light</option>
						<option value='neon'>Neon</option>
					</select>
				</label>
						<label>
							Accent Color
							<input type='color' value={color} onChange={e=>setColor(e.target.value)} />
						</label>
				{ready && (
					<>
						{!recording && <button onClick={()=>{ if(!canvasRef.current) return; start(canvasRef.current, getAudioStream(), 30); }}>Start Recording</button>}
						{recording && <button onClick={()=>{ stop(); setTimeout(()=>download(), 50); }}>Stop & Download</button>}
					</>
				)}
			</div>
									<div className="toolbar" style={{ gap: 12 }}>
										{panels.map((p, i) => (
											<div key={i} style={{ display: 'grid', gap: 6 }}>
												<div style={{ color: 'var(--muted)' }}>Panel {i+1}</div>
												<div style={{ display: 'flex', gap: 6 }}>
													<select value={p.mode} onChange={e=>{
														const val = e.target.value as VisualizerMode;
														setPanels(old => old.map((x, idx) => idx===i ? { ...x, mode: val } : x));
													}}>
														<option value='bars'>Bars</option>
														<option value='wave'>Wave</option>
														<option value='circle'>Circle</option>
													</select>
													<select value={p.band} onChange={e=>{
														const val = e.target.value as FrequencyBand;
														setPanels(old => old.map((x, idx) => idx===i ? { ...x, band: val } : x));
													}}>
														<option value='full'>Full</option>
														<option value='bass'>Bass</option>
														<option value='mid'>Mid</option>
														<option value='voice'>Voice</option>
														<option value='treble'>Treble</option>
													</select>
													<input type='color' value={p.color} onChange={e=>{
														const val = e.target.value;
														setPanels(old => old.map((x, idx) => idx===i ? { ...x, color: val } : x));
													}} />
												</div>
											</div>
										))}
									</div>
									<div className="canvas-wrap">
								{ready && analyserNode && (
											<GridVisualizerCanvas ref={canvasRef} analyser={analyserNode} analysers={analysers} layout={layout} panels={panels} />
								)}
							</div>
		</div>
	);
}