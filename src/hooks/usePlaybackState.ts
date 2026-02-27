import { useState, useEffect } from 'react';

interface UsePlaybackStateParams {
	audioEl: HTMLAudioElement | null;
}

export function usePlaybackState({ audioEl }: UsePlaybackStateParams) {
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [progress, setProgress] = useState<number>(0);

	useEffect(() => {
		if (!audioEl) return;

		const onPlay = () => setIsPlaying(true);
		const onPause = () => setIsPlaying(false);
		const onEnded = () => setIsPlaying(false);
		const onTime = () => {
			if (audioEl.duration > 0) {
				setProgress(Math.min(1, (audioEl.currentTime || 0) / audioEl.duration));
			}
		};

		audioEl.addEventListener('play', onPlay);
		audioEl.addEventListener('pause', onPause);
		audioEl.addEventListener('ended', onEnded);
		audioEl.addEventListener('timeupdate', onTime);

		return () => {
			audioEl.removeEventListener('play', onPlay);
			audioEl.removeEventListener('pause', onPause);
			audioEl.removeEventListener('ended', onEnded);
			audioEl.removeEventListener('timeupdate', onTime);
		};
	}, [audioEl]);

	return { isPlaying, progress };
}
