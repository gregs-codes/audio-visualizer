import { useRef, useEffect } from 'react';

interface TimelineScrollerProps {
	audioRef: React.RefObject<HTMLAudioElement>;
	isPlaying: boolean;
	progress: number;
	pxPerSecond?: number;
}

export function TimelineScroller({
	audioRef,
	isPlaying,
	progress,
	pxPerSecond = 40
}: TimelineScrollerProps) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const isSyncingScroll = useRef<boolean>(false);

	// Sync horizontal scroll position with playback progress
	useEffect(() => {
		const div = scrollRef.current;
		const a = audioRef.current;
		if (!div || !a || !isFinite(a.duration) || a.duration <= 0) return;
		isSyncingScroll.current = true;
		div.scrollTo({ left: (a.currentTime || 0) * pxPerSecond });
		requestAnimationFrame(() => {
			isSyncingScroll.current = false;
		});
	}, [progress, audioRef, pxPerSecond]);

	const duration = audioRef.current?.duration || 0;
	const currentTime = audioRef.current?.currentTime || 0;

	if (!audioRef.current || duration <= 0) {
		return null;
	}

	return (
		<div
			className="music-scroll"
			ref={scrollRef}
			onScroll={e => {
				if (isSyncingScroll.current) return;
				const a = audioRef.current;
				const div = e.currentTarget as HTMLDivElement;
				if (!a || !isFinite(a.duration) || a.duration <= 0) return;
				const time = div.scrollLeft / pxPerSecond;
				a.currentTime = Math.max(0, Math.min(a.duration, time));
			}}
		>
			<div
				className="scroll-track"
				style={{ width: `${Math.max(0, duration * pxPerSecond)}px` }}
			>
				<div
					className="scroll-thumb"
					style={{ left: `${currentTime * pxPerSecond}px` }}
				/>
			</div>
		</div>
	);
}
