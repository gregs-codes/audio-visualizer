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

function renderedListPlugin() {
	return {
		name: 'rendered-list-plugin',
		configureServer(server: import('vite').ViteDevServer) {
			server.middlewares.use('/rendered/list', (_req, res) => {
				const dir = path.join(process.cwd(), 'public', 'rendered');
				try {
					fs.mkdirSync(dir, { recursive: true });
					const entries = fs.readdirSync(dir).filter(n => n.endsWith('.webm') || n.endsWith('.mp4'));
					const files = entries.map(name => {
						const stat = fs.statSync(path.join(dir, name));
						return { name, size: stat.size, date: stat.mtime.toISOString() };
					}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(files));
				} catch {
					res.setHeader('Content-Type', 'application/json');
					res.end('[]');
				}
			});
		}
	} as import('vite').Plugin;
}

export default defineConfig({
	plugins: [react(), manifestPlugin(), renderedListPlugin()],
});