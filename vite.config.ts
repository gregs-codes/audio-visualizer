import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function manifestPlugin() {
	return {
		name: 'manifest-plugin',
		apply: 'serve',
		configureServer() {
			const root = process.cwd();
			const writeManifest = (dir: string, file: string) => {
				try {
					const abs = path.join(root, 'public', dir);
					const names = fs.readdirSync(abs).filter(n => n.toLowerCase().endsWith('.fbx')).map(n => `/${dir}/${n}`);
					fs.writeFileSync(path.join(abs, file), JSON.stringify(names, null, 2));
				} catch {}
			};
			writeManifest('dance', 'manifest.json');
			writeManifest('character', 'manifest.json');
		},
		buildStart() {
			const root = process.cwd();
			const writeManifest = (dir: string, file: string) => {
				try {
					const abs = path.join(root, 'public', dir);
					const names = fs.readdirSync(abs).filter(n => n.toLowerCase().endsWith('.fbx')).map(n => `/${dir}/${n}`);
					fs.writeFileSync(path.join(abs, file), JSON.stringify(names, null, 2));
				} catch {}
			};
			writeManifest('dance', 'manifest.json');
			writeManifest('character', 'manifest.json');
		}
	} as import('vite').Plugin;
}

export default defineConfig({
	plugins: [react(), manifestPlugin()],
});