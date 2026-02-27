interface PlaybackControlsProps {
	isPlaying: boolean;
	progress: number;
	volume: number;
	audioRef: React.RefObject<HTMLAudioElement>;
	onAudioFile: (file: File) => void;
}

export function PlaybackControls({
	isPlaying,
	progress,
	volume,
	audioRef,
	onAudioFile
}: PlaybackControlsProps) {
	return (
		<div className="glassy-controls" aria-label="Playback Controls" role="group">
			<button
				className="glassy-btn"
				aria-label={isPlaying ? 'Pause' : 'Play'}
				style={{
					background: 'rgba(20,24,32,0.92)',
					color: '#e8e8f2',
					boxShadow: '0 2px 8px #00ffc822',
					border: '1px solid #222',
					fontSize: 20
				}}
				onClick={() => {
					const a = audioRef.current;
					if (!a) return;
					if (a.paused) a.play();
					else a.pause();
				}}
			>
				{isPlaying ? <span style={{ fontWeight: 700 }}>❚❚</span> : <span style={{ fontWeight: 700 }}>▶</span>}
			</button>
			<button
				className="glassy-btn"
				aria-label="Upload Audio"
				style={{
					background: 'rgba(20,24,32,0.92)',
					color: '#e8e8f2',
					boxShadow: '0 2px 8px #00ffc822',
					border: '1px solid #222',
					fontSize: 22,
					width: 40,
					height: 40,
					padding: 0,
					position: 'relative'
				}}
			>
				<span style={{ fontWeight: 700 }}>＋</span>
				<input
					type='file'
					accept='audio/*'
					aria-label='Upload Audio File'
					style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
					onChange={e => {
						const f = e.target.files?.[0];
						if (f) onAudioFile(f);
					}}
				/>
			</button>
			<div className="glassy-seek" style={{ flex: 1, position: 'relative' }}>
				<div className="glassy-seek-fill" style={{ width: `${progress * 100}%` }} />
			</div>
			<div className="glassy-vol" style={{ position: 'relative' }}>
				<div className="glassy-vol-fill" style={{ width: `${volume}%` }} />
			</div>
		</div>
	);
}
