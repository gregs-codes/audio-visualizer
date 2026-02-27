import type { DancerSources } from '../visualizer/dancer/DancerEngine';
import type { VisualizerMode } from '../visualizer/visualizerModes';

type Position9 = 'lt' | 'mt' | 'rt' | 'lm' | 'mm' | 'rm' | 'lb' | 'mb' | 'rb';

interface UseDemoModeParams {
	audioRef: React.RefObject<HTMLAudioElement>;
	init: (file: File) => Promise<AnalyserNode>;
	setAudioFile: (file: File) => void;
	setAnalyserNode: (node: AnalyserNode) => void;
	setAudioEl: (el: HTMLAudioElement | null) => void;
	setReady: (ready: boolean) => void;
	setBgMode: (val: 'image') => void;
	setBgImageUrl: (val: string) => void;
	setBgFit: (val: 'cover') => void;
	setBgOpacity: (val: number) => void;
	setTitle: (val: string) => void;
	setTitlePos: (val: Position9) => void;
	setTitleFx: (val: { float: boolean; bounce: boolean; pulse: boolean }) => void;
	setDesc: (val: string) => void;
	setDescPos: (val: Position9) => void;
	setDescFx: (val: { float: boolean; bounce: boolean; pulse: boolean }) => void;
	setPanels: (panels: any[]) => void;
	setShowDancer: (val: boolean) => void;
	setDancerPos: (val: Position9) => void;
	setDancerSize: (val: number) => void;
	setDancerOverlaySources: (val: DancerSources) => void;
	color: string;
}

export function useDemoMode(params: UseDemoModeParams) {
	const {
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
	} = params;

	return async () => {
		// Set demo audio
		const audioResp = await fetch('/demo/demo.wav');
		const audioBlob = await audioResp.blob();
		const audioFile = new File([audioBlob], 'demo.wav', { type: audioBlob.type });
		setAudioFile(audioFile);
		const a = await init(audioFile);
		setAnalyserNode(a);
		setAudioEl(audioRef.current);
		setReady(true);

		// Set demo background
		setBgMode('image');
		setBgImageUrl('/demo/demo.jpg');
		setBgFit('cover');
		setBgOpacity(1);

		// Set title and description
		setTitle('Demo');
		setTitlePos('mt');
		setTitleFx({ float: false, bounce: true, pulse: true });
		setDesc('Yegor Shabanov');
		setDescPos('lt');
		setDescFx({ float: false, bounce: true, pulse: true });

		// Set visualizer mode
		setPanels([{
			mode: 'rotating-circular-bars' as VisualizerMode,
			color: color,
			band: 'full' as const,
			colors: { low: '#00d08a', mid: '#7aa2ff', high: '#ff6b6b' },
			hgView: 'top' as const
		}]);

		// Set dancer overlay
		setShowDancer(true);
		setDancerPos('mm');
		setDancerSize(100);
		setDancerOverlaySources({
			characterUrl: '/character/Maria J J Ong.fbx',
			animationUrls: [
				'/dance/Swing Dancing.fbx',
				'/dance/Twist Dance.fbx',
				'/dance/Wave Hip Hop Dance.fbx'
			]
		});

		// Play audio after everything is set
		setTimeout(() => {
			const el = audioRef.current;
			if (el) el.play();
		}, 400);
	};
}
