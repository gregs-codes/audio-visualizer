// Old visualizer components and logic extracted from App.tsx
// Export all old visualizer React components and helpers here


// --- Old/test visualizer logic extracted from App.tsx ---
import VisualizerCanvasWithTriangles from './VisualizerCanvasWithTriangles';

// Custom mode definition for archival
export const TRIANGLES_BARS_MODE = { key: 'triangles-bars', label: 'Triangles + Bars' };

// List component for old visualizers (expand as needed)
export function OldVisualizerList({ analyser, mode, backgroundUrl, backgroundType, backgroundFit }) {
	if (mode === 'triangles-bars') {
		return (
			<VisualizerCanvasWithTriangles
				analyser={analyser}
				backgroundUrl={backgroundUrl}
				backgroundType={backgroundType}
				backgroundFit={backgroundFit}
			/>
		);
	}
	return null;
}
