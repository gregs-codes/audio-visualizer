import { useEffect, useRef } from 'react';

interface UseAutoExportParams {
	autoExport: boolean;
	ready: boolean;
	analyserNode: AnalyserNode | null;
	runExport: () => Promise<Blob | null>;
}

export function useAutoExport({ autoExport, ready, analyserNode, runExport }: UseAutoExportParams) {
	const hasRun = useRef(false);

	useEffect(() => {
		const run = async () => {
			if (!autoExport) return;
			if (!ready || !analyserNode) return;
			if (hasRun.current) return;

			// Skip if server-side auto-export (query param) is handling it
			const q = new URLSearchParams(window.location.search);
			if (q.get('autoExport') === '1' && q.get('audio')) return;

			hasRun.current = true;
			const blob = await runExport();
			if (blob) {
				(async () => {
					const ab = await blob.arrayBuffer();
					(Object.assign(window as any, {
						__exportBuffer: ab,
						__exportMime: blob.type,
						__exportDone: true
					}));
				})();
			}
		};
		run();
	}, [autoExport, ready, analyserNode, runExport]);
}
