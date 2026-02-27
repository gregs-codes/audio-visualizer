import { useState, useEffect } from 'react';

export function useManifestLoader(initialAnimFiles: string[], initialCharFiles: string[]) {
	const [animFiles, setAnimFiles] = useState<string[]>(initialAnimFiles);
	const [charFiles, setCharFiles] = useState<string[]>(initialCharFiles);

	useEffect(() => {
		const load = async () => {
			try {
				const a = await fetch('/dance/manifest.json').then(r => r.ok ? r.json() : []);
				if (Array.isArray(a) && a.length) setAnimFiles(a);
			} catch {}
			try {
				const c = await fetch('/character/manifest.json').then(r => r.ok ? r.json() : []);
				if (Array.isArray(c) && c.length) setCharFiles(c);
			} catch {}
		};
		load();
	}, []);

	return { animFiles, charFiles };
}
