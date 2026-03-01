import { useRef, useCallback } from 'react';

interface PlaybackControlsProps {
	isPlaying: boolean;
	progress: number;        // 0..1
	volume: number;          // 0..100
	audioRef: React.RefObject<HTMLAudioElement>;
	onAudioFile: (file: File) => void;
	onVolumeChange: (v: number) => void;
}

export function PlaybackControls({
	isPlaying,
	progress,
	volume,
	audioRef,
	onAudioFile,
	onVolumeChange,
}: PlaybackControlsProps) {
	const seekBarRef = useRef<HTMLDivElement>(null);
	const volBarRef = useRef<HTMLDivElement>(null);
	const isDraggingSeek = useRef(false);
	const isDraggingVol = useRef(false);

	const seekTo = useCallback((clientX: number) => {
		const bar = seekBarRef.current;
		const a = audioRef.current;
		if (!bar || !a || !isFinite(a.duration) || a.duration <= 0) return;
		const rect = bar.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		a.currentTime = ratio * a.duration;
	}, [audioRef]);

	const adjustVol = useCallback((clientX: number) => {
		const bar = volBarRef.current;
		if (!bar) return;
		const rect = bar.getBoundingClientRect();
		const v = Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 100);
		onVolumeChange(v);
	}, [onVolumeChange]);

	const formatTime = (secs: number) => {
		if (!isFinite(secs)) return '0:00';
		const m = Math.floor(secs / 60);
		const s = Math.floor(secs % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	};

	const dur = audioRef.current?.duration || 0;
	const cur = audioRef.current?.currentTime || 0;

	return (
		<div className="playback-bar">
			{/* Play / Pause */}
			<button
				className="pb-btn pb-btn-play"
				aria-label={isPlaying ? 'Pause' : 'Play'}
				onClick={() => {
					const a = audioRef.current;
					if (!a) return;
					if (a.paused) a.play(); else a.pause();
				}}
			>
				{isPlaying
					? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="4" height="12" rx="1" fill="currentColor"/><rect x="8" y="1" width="4" height="12" rx="1" fill="currentColor"/></svg>
					: <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5L12.5 7 3 12.5Z" fill="currentColor"/></svg>
				}
			</button>

			{/* Time label */}
			<span className="pb-time">{formatTime(cur)}</span>

			{/* Seek bar */}
			<div
				ref={seekBarRef}
				className="pb-seek"
				onMouseDown={e => {
					isDraggingSeek.current = true;
					seekTo(e.clientX);
					const onMove = (mv: MouseEvent) => { if (isDraggingSeek.current) seekTo(mv.clientX); };
					const onUp = () => { isDraggingSeek.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
					window.addEventListener('mousemove', onMove);
					window.addEventListener('mouseup', onUp);
				}}
				onClick={e => seekTo(e.clientX)}
			>
				<div className="pb-seek-track">
					<div className="pb-seek-fill" style={{ width: `${progress * 100}%` }} />
					<div className="pb-seek-thumb" style={{ left: `${progress * 100}%` }} />
				</div>
			</div>

			{/* Duration */}
			<span className="pb-time">{formatTime(dur)}</span>

			{/* Volume icon */}
			<svg className="pb-vol-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
				<path d="M2 5h2.5L8 2v10L4.5 9H2V5z" fill="currentColor"/>
				{volume > 0 && <path d="M9.5 4.5a3 3 0 0 1 0 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>}
				{volume > 50 && <path d="M11 2.5a5.5 5.5 0 0 1 0 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>}
			</svg>

			{/* Volume slider */}
			<div
				ref={volBarRef}
				className="pb-vol"
				onMouseDown={e => {
					isDraggingVol.current = true;
					adjustVol(e.clientX);
					const onMove = (mv: MouseEvent) => { if (isDraggingVol.current) adjustVol(mv.clientX); };
					const onUp = () => { isDraggingVol.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
					window.addEventListener('mousemove', onMove);
					window.addEventListener('mouseup', onUp);
				}}
				onClick={e => adjustVol(e.clientX)}
			>
				<div className="pb-vol-track">
					<div className="pb-vol-fill" style={{ width: `${volume}%` }} />
					<div className="pb-vol-thumb" style={{ left: `${volume}%` }} />
				</div>
			</div>

			{/* Upload */}
			<button className="pb-btn pb-btn-upload" title="Load audio file" style={{ position: 'relative' }}>
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
					<path d="M7 1v8M4 4l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M2 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
				</svg>
				<input
					type="file"
					accept="audio/*"
					aria-label="Upload Audio File"
					style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
					onChange={e => {
						const f = e.target.files?.[0];
						if (f) onAudioFile(f);
					}}
				/>
			</button>
		</div>
	);
}

