import { useEffect } from 'react';
import type { VisualizerMode } from '../visualizer/visualizerModes';

interface QueryParamHandlers {
	setAutoExport: (val: boolean) => void;
	setAutoParams: (val: { audioUrl?: string } | null) => void;
	setAspect: (val: '16:9' | '9:16') => void;
	setRes: (val: '360' | '480' | '720' | '1080') => void;
	setFps: (val: 24 | 30 | 60) => void;
	setVBitrate: (val: number) => void;
	setABitrate: (val: number) => void;
	setCodec: (val: 'vp9' | 'vp8') => void;
	setTheme: (val: string) => void;
	setMode: (val: VisualizerMode | 'triangles-bars') => void;
}

export function useQueryParams(handlers: QueryParamHandlers) {
	useEffect(() => {
		const p = new URLSearchParams(window.location.search);
		const ae = p.get('autoExport');
		const audioUrl = p.get('audio');

		if (ae === '1' || ae === 'true') handlers.setAutoExport(true);
		if (audioUrl) handlers.setAutoParams({ audioUrl });

		// Optional params
		const aspectParam = p.get('aspect') as ('16:9' | '9:16') | null;
		if (aspectParam) handlers.setAspect(aspectParam);

		const resParam = p.get('res') as ('360' | '480' | '720' | '1080') | null;
		if (resParam) handlers.setRes(resParam);

		const fpsParam = p.get('fps');
		if (fpsParam) handlers.setFps(parseInt(fpsParam, 10) as 24 | 30 | 60);

		const vbr = p.get('vBitrate');
		if (vbr) handlers.setVBitrate(parseInt(vbr, 10));

		const abr = p.get('aBitrate');
		if (abr) handlers.setABitrate(parseInt(abr, 10));

		const codecParam = p.get('codec') as ('vp9' | 'vp8') | null;
		if (codecParam) handlers.setCodec(codecParam);

		const themeParam = p.get('theme');
		if (themeParam) handlers.setTheme(themeParam);

		const modeParam = p.get('mode') as VisualizerMode | null;
		if (modeParam) handlers.setMode(modeParam);
	}, [handlers]);
}
