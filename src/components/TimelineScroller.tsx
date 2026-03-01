import { useRef, useCallback } from 'react';

interface TimelineScrollerProps {
	audioRef: React.RefObject<HTMLAudioElement>;
	isPlaying: boolean;
	progress: number;
}

export function TimelineScroller({
	audioRef,
	progress,
}: TimelineScrollerProps) {
	const barRef = useRef<HTMLDivElement>(null);
	const isDragging = useRef(false);

	const seekTo = useCallback((clientX: number) => {
		const bar = barRef.current;
		const a = audioRef.current;
		if (!bar || !a || !isFinite(a.duration) || a.duration <= 0) return;
		const rect = bar.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		a.currentTime = ratio * a.duration;
	}, [audioRef]);

	const dur = audioRef.current?.duration || 0;
	const cur = audioRef.current?.currentTime || 0;

	if (!audioRef.current || dur <= 0) return null;

	// Generate waveform-like tick marks for decoration
	const NUM_TICKS = 80;
	const ticks = Array.from({ length: NUM_TICKS }, (_, i) => {
		const isBeat = i % 8 === 0;
		const isQuarter = i % 4 === 0;
		return { h: isBeat ? 10 : isQuarter ? 7 : 4 };
	});

	const formatTime = (s: number) => {
		if (!isFinite(s)) return '0:00';
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	};

	const pct = `${progress * 100}%`;

	return (
		<div className="timeline-wrap">
			<span className="timeline-curr">{formatTime(cur)}</span>
			<div
				ref={barRef}
				className="timeline-bar"
				onMouseDown={e => {
					isDragging.current = true;
					seekTo(e.clientX);
					const onMove = (mv: MouseEvent) => { if (isDragging.current) seekTo(mv.clientX); };
					const onUp = () => {
						isDragging.current = false;
						window.removeEventListener('mousemove', onMove);
						window.removeEventListener('mouseup', onUp);
					};
					window.addEventListener('mousemove', onMove);
					window.addEventListener('mouseup', onUp);
				}}
				onClick={e => seekTo(e.clientX)}
			>
				{/* Ticks */}
				<div className="timeline-ticks">
					{ticks.map((t, i) => (
						<div
							key={i}
							className="timeline-tick"
							style={{
								height: t.h,
								opacity: (i / NUM_TICKS) < progress ? 0.7 : 0.2,
							}}
						/>
					))}
				</div>
				{/* Progress fill overlay */}
				<div className="timeline-fill" style={{ width: pct }} />
				{/* Playhead */}
				<div className="timeline-playhead" style={{ left: pct }} />
			</div>
			<span className="timeline-dur">{formatTime(dur)}</span>
		</div>
	);
}

