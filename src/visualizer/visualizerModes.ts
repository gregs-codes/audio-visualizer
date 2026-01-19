// Frequency bands remain as-is
export type FrequencyBand = 'bass' | 'mid' | 'treble' | 'voice' | 'full';

// VisualizerMode is now sourced from the visualizers registry
export { VISUALIZER_MODES } from './visualizers';
export type { VisualizerMode } from './visualizers';