import { useRef } from 'react';
import type { FrequencyBand } from '../visualizer/visualizerModes';

/**
 * Hook to initialize Web Audio graph and provide an analyser plus a MediaStream for recording.
 * Graph:
 *   HTMLAudioElement -> MediaElementSource -> [Analyser] -> AudioContext.destination (speakers)
 *                                         -> MediaStreamDestination (for recording)
 */
export function useAudioAnalyzer(){
	const audioRef = useRef<HTMLAudioElement|null>(null);
	const analyserRef = useRef<AnalyserNode|null>(null);
	const ctxRef = useRef<AudioContext|null>(null);
	const sourceRef = useRef<MediaElementAudioSourceNode|null>(null);
	const mediaDestRef = useRef<MediaStreamAudioDestinationNode|null>(null);
		const bandAnalyserMapRef = useRef<Map<FrequencyBand, { filter: BiquadFilterNode; analyser: AnalyserNode }>>(new Map());

		const init = async (file: File): Promise<AnalyserNode> => {
		// Create or reuse AudioContext
		let ctx = ctxRef.current;
		if (!ctx) {
			ctx = new AudioContext();
			ctxRef.current = ctx;
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 2048;
			analyserRef.current = analyser;
			// Destination stream (not audible, used for recording)
			mediaDestRef.current = ctx.createMediaStreamDestination();
			// Connect analyser to speakers
			analyser.connect(ctx.destination);
		}

		// Create new audio element for the provided file
		const audio = new Audio(URL.createObjectURL(file));
		audio.crossOrigin = 'anonymous';
		audioRef.current = audio;

		// Disconnect previous source if present
			if (sourceRef.current) {
				try {
					sourceRef.current.disconnect();
						} catch (e) {
							console.debug('Audio source disconnect failed (ignored):', e);
						}
				sourceRef.current = null;
			}

		// Create source and connect to analyser and media stream destination
		const source = ctx.createMediaElementSource(audio);
		sourceRef.current = source;
		if (analyserRef.current) {
			source.connect(analyserRef.current);
		}
			if (mediaDestRef.current) {
			// Tap the raw audio into the recording stream
			source.connect(mediaDestRef.current);
		}
			// Reconnect any existing band filters to the new source
			bandAnalyserMapRef.current.forEach(({ filter }) => {
				try { filter.disconnect(); } catch (e) { console.debug('Filter disconnect ignored', e); }
				source.connect(filter);
			});
			return analyserRef.current!;
		};

	const getAudioStream = () => mediaDestRef.current?.stream ?? null;

		const getBandAnalyser = (band: FrequencyBand): AnalyserNode | null => {
			const ctx = ctxRef.current; const source = sourceRef.current;
			if (!ctx || !source) return null;
			const existing = bandAnalyserMapRef.current.get(band);
			if (existing) return existing.analyser;

			const filter = ctx.createBiquadFilter();
			// Configure filter based on band
			const setBandpass = (f1: number, f2: number) => {
				const f0 = Math.sqrt(f1 * f2);
				const Q = f0 / (f2 - f1);
				filter.type = 'bandpass';
				filter.frequency.value = f0;
				filter.Q.value = Math.max(0.707, Math.min(Q, 50));
			};
			switch (band) {
				case 'bass':
					filter.type = 'lowpass'; filter.frequency.value = 250; filter.Q.value = 0.707; break;
				case 'treble':
					filter.type = 'highpass'; filter.frequency.value = 4000; filter.Q.value = 0.707; break;
				case 'voice':
					setBandpass(300, 3000); break;
				case 'mid':
					setBandpass(250, 2000); break;
				case 'full':
				default:
					filter.type = 'allpass'; filter.frequency.value = 1000; filter.Q.value = 0.707; break;
			}

			const analyser = ctx.createAnalyser();
			analyser.fftSize = 2048;
			// Connect branch: source -> filter -> analyser (not to destination)
			source.connect(filter);
			filter.connect(analyser);
			bandAnalyserMapRef.current.set(band, { filter, analyser });
			return analyser;
		};

		return { audioRef, analyserRef, init, getAudioStream, getBandAnalyser };
}