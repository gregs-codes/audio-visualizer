import { renderDancer, type DancerSources } from './dancer/DancerEngine';
// This module declares all visualizer modes and 2D renderers.
// WebGL HD modes render offscreen in their own engines; we include placeholders here.
// `visualizerModes.ts` re-exports the union type for App/UI use.

export type RenderContext = {
  ctx: CanvasRenderingContext2D;
  x: number; y: number; w: number; h: number;
  panel: { color: string; colors?: { low: string; mid: string; high: string } };
  freq: Uint8Array;
  time: Uint8Array;
  energy: number; // 0..1
  now: number; // seconds
  panelKey: string; // unique key per panel region for persistent state
};

// Categorized visualizer modes
export const VISUALIZER_CATEGORIES = {
  'High Graphics (WebGL)': [
    'high-graphics',
    'high-graphics-nebula',
    'high-graphics-tunnel',
    'high-graphics-curl',
    'high-graphics-spiral',
    'high-graphics-fog',
    'high-graphics-cells',
    'high-graphics-trunk',
    'high-graphics-rings',
    'high-graphics-rings-trails',
    'high-graphics-kaleidoscope',
    'high-graphics-flow-field',
    'high-graphics-hexagon',
    'high-graphics-hex-paths',
    'high-graphics-net',
    'high-graphics-dot-matrix-3d',
  ],
  'Hexagon & Networks': [
    'hexagon-visualizer',
    'triangular-net',
  ],
  'Bars & Waveforms': [
    'vertical-bars',
    'horizontal-bars',
    'mirrored-bars',
    'thick-wave',
    'dual-wave',
    'gradient-spectrum',
    'smooth-gradient-bars',
    'layered-smooth-waves',
    'smooth-dotted-wave',
    'dot-matrix-3d',
  ],
  'Circular & Radial': [
    'circular-bars',
    'rotating-circular-bars',
    'radial-waveform',
    'pulse-circle',
    'concentric-rings',
    'expanding-wave-rings',
    'smooth-concentric-equalizer',
  ],
  'Particles & Dots': [
    'particle-field',
    'particle-burst',
    'minimal-dot-pulse',
    'orbital-particles',
    'firefly-swarm',
  ],
  'Geometric Shapes': [
    'polygon-pulse',
    'starburst',
    'smooth-blob-morph',
  ],
  'Advanced Effects': [
    'neon-glow-wave',
    'frequency-heatmap',
    'line-mesh',
    'particle-mesh',
    'soft-plasma',
    'noise-flow',
    'radar-sweep',
    'ripple-field',
  ],
  'Nature & Atmosphere': [
    'snowfall-react',
    'rain-react',
    'smoke-fog-pulse',
    'cloud-drift',
    'ocean-wave',
  ],
  'Landscapes': [
    'audio-landscape',
    'skyline-bars',
  ],
} as const;

// Flat list of all modes (for backwards compatibility)
export const VISUALIZER_MODES = Object.values(VISUALIZER_CATEGORIES).flat();

export type VisualizerMode = typeof VISUALIZER_MODES[number];

// Visualizer labels for UI
export const LABELS: Record<string, string> = {
    'hexagon-visualizer': 'Hexagon Visualizer (Soundcloud Style)',
  'threejs-ripples': 'Water Ripples (WebGL)',
  'high-graphics': 'High Graphics (WebGL)',
  'high-graphics-nebula': 'HG: Nebula (WebGL)',
  'high-graphics-tunnel': 'HG: Tunnel (WebGL)',
  'high-graphics-curl': 'HG: Curl Particles (WebGL)',
  'high-graphics-spiral': 'HG: Spiral Wave (WebGL)',
  'high-graphics-fog': 'HG: Fog (WebGL)',
  'high-graphics-cells': 'HG: Cells (WebGL)',
  'high-graphics-trunk': 'HG: Trunk (WebGL)',
  'high-graphics-rings': 'HG: Rings (WebGL)',
  'high-graphics-rings-trails': 'HG: Rings Trails (WebGL)',
  'high-graphics-kaleidoscope': 'HG: Kaleidoscope (WebGL)',
  'high-graphics-flow-field': 'HG: Flow Field (WebGL)',
  'high-graphics-hexagon': 'HG: Hexagon (WebGL)',
  'high-graphics-hex-paths': 'HG: Hex Paths (WebGL)',
  'high-graphics-net': 'HG: Net (WebGL)',
  'high-graphics-dot-matrix-3d': 'HG: Dot Matrix 3D (WebGL)',
  'triangular-net': 'Triangular Net',
  'vertical-bars': 'Vertical Bars',
  'horizontal-bars': 'Horizontal Bars',
  'mirrored-bars': 'Mirrored Bars (center out)',
  'thick-wave': 'Thick Wave (filled waveform)',
  'dual-wave': 'Dual Wave (left/right)',
  'circular-bars': 'Circular Bars',
  'rotating-circular-bars': 'Rotating Circular Bars',
  'radial-waveform': 'Radial Waveform',
  'pulse-circle': 'Pulse Circle (bass-driven)',
  'concentric-rings': 'Concentric Rings',
  'expanding-wave-rings': 'Expanding Wave Rings',
  'particle-field': 'Particle Field',
  'particle-burst': 'Particle Burst (beat-reactive)',
  'neon-glow-wave': 'Neon Glow Wave',
  'frequency-heatmap': 'Frequency Heatmap',
  'gradient-spectrum': 'Gradient Spectrum',
  'smooth-gradient-bars': 'Smooth Gradient Bars',
  'layered-smooth-waves': 'Layered Smooth Waves',
  'smooth-dotted-wave': 'Smooth Dotted Wave',
  'polygon-pulse': 'Polygon Pulse',
  'starburst': 'Starburst',
  'smooth-blob-morph': 'Smooth Blob Morph',
  'smooth-concentric-equalizer': 'Smooth Concentric Equalizer',
  'line-mesh': 'Line Mesh',
  'particle-mesh': 'Particle Mesh',
  'orbital-particles': 'Orbital Particles',
  'soft-plasma': 'Soft Plasma',
  'noise-flow': 'Noise Flow',
  'radar-sweep': 'Radar Sweep',
  'ripple-field': 'Ripple Field',
  'firefly-swarm': 'Firefly Swarm',
  'snowfall-react': 'Snowfall React',
  'rain-react': 'Rain React',
  'smoke-fog-pulse': 'Smoke / Fog Pulse',
  'cloud-drift': 'Cloud Drift',
  'ocean-wave': 'Ocean Wave',
  'audio-landscape': 'Audio Landscape',
  'skyline-bars': 'Skyline Bars',
  'minimal-dot-pulse': 'Minimal Dot Pulse',
  'dot-matrix-3d': 'Dot Matrix 3D Equalizer',
  'dancer-fbx': 'Dancer (FBX / Three.js)',
  // Synonyms
  'bars': 'Vertical Bars',
  'wave': 'Waveform',
  'circle': 'Circular Bars',
};

// Helpers: pick a color from per-band mapping or fallback to panel accent
const pickColor = (ratio: number, colors: RenderContext['panel']['colors'], fallback: string) => {
  if (colors) {
    if (ratio < 1/3) return colors.low;
    if (ratio < 2/3) return colors.mid;
    return colors.high;
  }
  return fallback;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Build a horizontal gradient from low→mid→high band colors (falls back to solid color)
const makeBandGradient = (ctx: CanvasRenderingContext2D, x: number, w: number, colors: RenderContext['panel']['colors'], fallback: string): string | CanvasGradient => {
  if (!colors) return fallback;
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, colors.low);
  grad.addColorStop(0.5, colors.mid);
  grad.addColorStop(1, colors.high);
  return grad;
};

// Core 2D canvas renderers (lightweight, responsive)
const verticalBars = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq } = r;
  const bars = Math.max(32, Math.floor(w / 20));
  const barW = w / bars;
  for (let i = 0; i < bars; i++) {
    const idx = Math.floor((i / bars) * freq.length);
    const v = freq[idx] / 255;
    const ratio = idx / freq.length;
    ctx.fillStyle = pickColor(ratio, panel.colors, panel.color);
    ctx.fillRect(x + i * barW, y + h - v * h, barW - 2, v * h);
  }
};

const horizontalBars = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq } = r;
  const bars = Math.max(24, Math.floor(h / 12));
  const barH = h / bars;
  for (let i = 0; i < bars; i++) {
    const idx = Math.floor((i / bars) * freq.length);
    const v = freq[idx] / 255;
    const ratio = idx / freq.length;
    ctx.fillStyle = pickColor(ratio, panel.colors, panel.color);
    ctx.fillRect(x, y + (bars - 1 - i) * barH, v * w, barH - 2);
  }
};

const mirroredBars = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq } = r;
  const bars = Math.max(32, Math.floor(w / 20));
  const barW = w / bars;
  const midY = y + h / 2;
  for (let i = 0; i < bars; i++) {
    const idx = Math.floor((i / bars) * freq.length);
    const v = freq[idx] / 255;
    const ratio = idx / freq.length;
    const barH = v * (h / 2);
    ctx.fillStyle = pickColor(ratio, panel.colors, panel.color);
    // up
    ctx.fillRect(x + i * barW, midY - barH, barW - 2, barH);
    // down
    ctx.fillRect(x + i * barW, midY, barW - 2, barH);
  }
};

const waveform = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, time } = r;
  ctx.strokeStyle = makeBandGradient(ctx, x, w, panel.colors, panel.color);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < time.length; i++) {
    const v = time[i] / 255;
    const px = x + (i / time.length) * w;
    const py = y + (1 - v) * h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
};

const thickWave = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, time } = r;
  ctx.fillStyle = makeBandGradient(ctx, x, w, panel.colors, panel.color);
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let i = 0; i < time.length; i++) {
    const v = time[i] / 255;
    const px = x + (i / time.length) * w;
    const py = y + (1 - v) * h;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
};

const dualWave = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, time } = r;
  const half = Math.floor(time.length / 2);
  ctx.strokeStyle = makeBandGradient(ctx, x, w, panel.colors, panel.color);
  ctx.lineWidth = 2;
  // top
  ctx.beginPath();
  for (let i = 0; i < half; i++) {
    const v = time[i] / 255;
    const px = x + (i / half) * w;
    const py = y + h * 0.25 * (1 - v);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // bottom
  ctx.beginPath();
  for (let i = 0; i < half; i++) {
    const v = time[half + i] / 255;
    const px = x + (i / half) * w;
    const py = y + h * 0.75 * (1 - v);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
};

const circularBars = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const baseSize = Math.min(w, h);
  const rings = 3;
  const dotsPerRing = 96;
  
  ctx.save();
  
  // Draw concentric circles with audio-reactive dots
  for (let ring = 0; ring < rings; ring++) {
    const ringRadius = (baseSize / 8) * (ring + 1.5) * (1 + energy * 0.1);
    
    // Draw base circle
    ctx.strokeStyle = panel.colors ? pickColor(ring / rings, panel.colors, panel.color) : panel.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw dots/bars around the circle
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < dotsPerRing; i++) {
      const angle = (i / dotsPerRing) * Math.PI * 2;
      const idx = Math.floor((i / dotsPerRing) * freq.length);
      const v = freq[idx] / 255;
      const ratio = idx / freq.length;
      
      // Audio-reactive bar length
      const barLen = (baseSize / 25) * v * (0.5 + energy * 0.5);
      
      const x1 = cx + Math.cos(angle) * (ringRadius - barLen / 2);
      const y1 = cy + Math.sin(angle) * (ringRadius - barLen / 2);
      const x2 = cx + Math.cos(angle) * (ringRadius + barLen / 2);
      const y2 = cy + Math.sin(angle) * (ringRadius + barLen / 2);
      
      ctx.strokeStyle = pickColor(ratio, panel.colors, panel.color);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  
  ctx.restore();
};

const rotatingCircularBars = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, now } = r;
  const cx = x + w / 2; const cy = y + h / 2; const radius = Math.min(w, h) / 4;
  const spokes = 96;
  const offset = now * 0.8; // rotation speed
  for (let i = 0; i < spokes; i++) {
    const t = ((i / spokes) * 2 * Math.PI) + offset;
    const idx = Math.floor((i / spokes) * freq.length);
    const v = (freq[idx] / 255) * (Math.min(w, h) / 4);
    const ratio = idx / freq.length;
    ctx.strokeStyle = pickColor(ratio, panel.colors, panel.color);
    ctx.lineWidth = 2;
    const x1 = cx + Math.cos(t) * radius;
    const y1 = cy + Math.sin(t) * radius;
    const x2 = cx + Math.cos(t) * (radius + v);
    const y2 = cy + Math.sin(t) * (radius + v);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
};

const radialWaveform = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, time } = r;
  const cx = x + w / 2; const cy = y + h / 2; const baseR = Math.min(w, h) / 4;
  ctx.lineWidth = 2;
  // Draw in 3 color sections (low/mid/high) around the circle
  const sections = panel.colors ? 3 : 1;
  const segLen = Math.ceil(time.length / sections);
  for (let s = 0; s < sections; s++) {
    const start = s * segLen;
    const end = Math.min((s + 1) * segLen + 1, time.length);
    const ratio = sections === 1 ? 0 : s / (sections - 1);
    ctx.strokeStyle = pickColor(ratio, panel.colors, panel.color);
    ctx.beginPath();
    for (let i = start; i < end; i++) {
      const v = time[i] / 255;
      const a = (i / time.length) * Math.PI * 2;
      const r2 = baseR + (v - 0.5) * baseR * 0.5;
      const px = cx + Math.cos(a) * r2;
      const py = cy + Math.sin(a) * r2;
      if (i === start) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    if (sections === 1) ctx.closePath();
    ctx.stroke();
  }
};

const pulseCircle = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const cx = x + w / 2; const cy = y + h / 2;
  const baseR = Math.min(w, h) / 6;
  const lowBins = Math.floor(freq.length / 3);
  let lowEnergy = 0;
  for (let i = 0; i < lowBins; i++) lowEnergy += freq[i];
  lowEnergy = lowEnergy / (255 * Math.max(1, lowBins));
  const R = baseR * (1 + lowEnergy * 1.2 + energy * 0.3);
  // Bass-driven circle uses the low-band color
  ctx.strokeStyle = pickColor(0, panel.colors, panel.color);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
};

const polygonPulse = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const cx = x + w / 2; const cy = y + h / 2;
  const baseR = Math.min(w, h) / 4;
  const segments = 64; // Angular segments around the circle

  ctx.beginPath();
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const idx = Math.floor((i / segments) * freq.length);
    const v = freq[idx] / 255;
    
    // Create angular/jagged effect by modulating radius with frequency data
    const R = baseR * (1 + energy * 0.3 + v * 0.8);
    const px = cx + Math.cos(angle) * R;
    const py = cy + Math.sin(angle) * R;
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  
  // Draw with gradient based on position
  ctx.strokeStyle = panel.colors 
    ? pickColor(energy, panel.colors, panel.color)
    : panel.color;
  ctx.lineWidth = 4;
  ctx.stroke();
  
  // Add inner glow effect
  ctx.strokeStyle = panel.colors 
    ? pickColor(energy * 0.5, panel.colors, panel.color)
    : panel.color;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const concentricRings = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq } = r;
  const cx = x + w / 2; const cy = y + h / 2;
  const rings = 5;
  for (let i = 0; i < rings; i++) {
    const idx = Math.floor((i / rings) * freq.length);
    const v = freq[idx] / 255;
    const R = (Math.min(w, h) / 8) * (i + 1) * (1 + v * 0.5);
    ctx.strokeStyle = pickColor(i / rings, panel.colors, panel.color);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  }
};

const expandingWaveRings = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, time, now } = r;
  const cx = x + w / 2; const cy = y + h / 2;
  const rings = 3;
  for (let k = 0; k < rings; k++) {
    const phase = (now * 0.6 + k * 0.8) % 1;
    ctx.beginPath();
    for (let i = 0; i < time.length; i++) {
      const v = time[i] / 255;
      const a = (i / time.length) * Math.PI * 2;
      const R = (Math.min(w, h) / 6) + phase * (Math.min(w, h) / 6) + (v - 0.5) * 16;
      const px = cx + Math.cos(a) * R;
      const py = cy + Math.sin(a) * R;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = pickColor(k / Math.max(1, rings - 1), panel.colors, panel.color);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

// Baseline reactive implementations for the rest (simple but responsive)
const simpleGradientSpectrum = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq } = r;
  const bars = Math.max(48, Math.floor(w / 10));
  const barW = w / bars;
  for (let i = 0; i < bars; i++) {
    const idx = Math.floor((i / bars) * freq.length);
    const v = freq[idx] / 255;
    const ratio = idx / freq.length;
    ctx.fillStyle = pickColor(ratio, panel.colors, panel.color);
    ctx.fillRect(x + i * barW, y + h - v * h, barW - 1, v * h);
  }
};

// Particle Field - floating particles arranged in a grid that react to frequency
const particleFieldVisualizer = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy, now } = r;
  const key = `${r.panelKey}:particle-field`;
  const gridX = 16;
  const gridY = 12;
  const state = getState<{ particles: Array<{ baseX: number; baseY: number; freqIdx: number }> }>(
    key, () => {
      const particles = [];
      for (let i = 0; i < gridX; i++) {
        for (let j = 0; j < gridY; j++) {
          particles.push({
            baseX: x + (i / (gridX - 1)) * w,
            baseY: y + (j / (gridY - 1)) * h,
            freqIdx: Math.floor((i / gridX) * freq.length)
          });
        }
      }
      return { particles };
    }
  );
  
  ctx.save();
  for (const p of state.particles) {
    const v = freq[p.freqIdx] / 255;
    const size = 2 + v * 6;
    const offsetX = Math.sin(now * 2 + p.baseY / 50) * 10 * v;
    const offsetY = Math.cos(now * 3 + p.baseX / 50) * 10 * v;
    
    ctx.fillStyle = pickColor(p.freqIdx / freq.length, panel.colors, panel.color);
    ctx.globalAlpha = 0.4 + v * 0.6;
    ctx.beginPath();
    ctx.arc(p.baseX + offsetX, p.baseY + offsetY, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Particle Burst - expanding particles on beat
const particleBurst = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy, now } = r;
  const key = `${r.panelKey}:particle-burst`;
  const state = getState<{ particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; hue: number }>, lastBeat: number }>(
    key, () => ({ particles: [], lastBeat: 0 })
  );
  
  // Beat detection
  const lowBins = Math.floor(freq.length / 4);
  let lowEnergy = 0;
  for (let i = 0; i < lowBins; i++) lowEnergy += freq[i];
  lowEnergy = lowEnergy / (255 * Math.max(1, lowBins));
  
  if (lowEnergy > 0.65 && now - state.lastBeat > 0.2) {
    state.lastBeat = now;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const count = 20 + Math.floor(energy * 30);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      state.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        hue: i / count
      });
    }
  }
  
  // Update and draw particles
  ctx.save();
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= 0.02;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
    p.vy += 80 * 0.016; // gravity
    
    ctx.fillStyle = pickColor(p.hue, panel.colors, panel.color);
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + p.life * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Audio Spikes - sharp radiating spikes from center
const audioSpikes = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const spikes = 32;
  const maxLen = Math.min(w, h) / 2.5;
  
  ctx.save();
  ctx.lineWidth = 2;
  for (let i = 0; i < spikes; i++) {
    const idx = Math.floor((i / spikes) * freq.length);
    const v = freq[idx] / 255;
    const angle = (i / spikes) * Math.PI * 2;
    const len = maxLen * v * (0.3 + energy * 0.7);
    
    const x1 = cx + Math.cos(angle) * 10;
    const y1 = cy + Math.sin(angle) * 10;
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    
    ctx.strokeStyle = pickColor(idx / freq.length, panel.colors, panel.color);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
};

// Line Mesh - connected horizontal lines with frequency
const lineMesh = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const lines = 16;
  const lineSpacing = h / lines;
  
  ctx.save();
  ctx.lineWidth = 1.5;
  for (let i = 0; i < lines; i++) {
    const py = y + i * lineSpacing;
    ctx.strokeStyle = pickColor(i / lines, panel.colors, panel.color);
    ctx.globalAlpha = 0.4 + energy * 0.6;
    ctx.beginPath();
    
    const samples = Math.max(32, Math.floor(w / 8));
    for (let j = 0; j <= samples; j++) {
      const freqIdx = Math.floor((j / samples) * freq.length);
      const v = freq[freqIdx] / 255;
      const px = x + (j / samples) * w;
      const offset = v * lineSpacing * 2 * Math.sin((i / lines) * Math.PI);
      
      if (j === 0) ctx.moveTo(px, py + offset);
      else ctx.lineTo(px, py + offset);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Particle Mesh - particles with connecting lines
const particleMesh = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const particles = 24;
  const points: Array<{ x: number; y: number; intensity: number }> = [];
  
  // Generate particles based on frequency
  for (let i = 0; i < particles; i++) {
    const idx = Math.floor((i / particles) * freq.length);
    const v = freq[idx] / 255;
    const px = x + (i / (particles - 1)) * w;
    const py = y + h / 2 + Math.sin((i / particles) * Math.PI * 4) * h / 4 * v;
    points.push({ x: px, y: py, intensity: v });
  }
  
  ctx.save();
  // Draw connections
  ctx.strokeStyle = panel.colors ? panel.colors.mid : panel.color;
  ctx.globalAlpha = 0.2 + energy * 0.3;
  ctx.lineWidth = 1;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (dist < 80) {
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }
  
  // Draw particles
  ctx.globalAlpha = 1;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    ctx.fillStyle = pickColor(i / particles, panel.colors, panel.color);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + p.intensity * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

// Skyline Bars - building silhouette effect
const skylineBarsVisualizer = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq } = r;
  const buildings = Math.max(32, Math.floor(w / 16));
  const buildingW = w / buildings;
  
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.3;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  
  for (let i = 0; i < buildings; i++) {
    const idx = Math.floor((i / buildings) * freq.length);
    const v = freq[idx] / 255;
    const buildingH = v * h * 0.8;
    const ratio = idx / freq.length;
    
    // Building body
    ctx.fillStyle = pickColor(ratio, panel.colors, panel.color);
    ctx.fillRect(x + i * buildingW, y + h - buildingH, buildingW - 2, buildingH);
    
    // Window lights
    ctx.fillStyle = 'rgba(255, 255, 200, 0.6)';
    const windows = Math.floor(buildingH / 8);
    for (let j = 0; j < windows; j++) {
      if (Math.random() > 0.3) {
        ctx.fillRect(
          x + i * buildingW + buildingW * 0.25,
          y + h - buildingH + j * 8 + 2,
          buildingW * 0.2, 4
        );
      }
    }
  }
  ctx.restore();
};

// Audio Landscape - mountain/landscape profile
const audioLandscape = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq } = r;
  const samples = Math.max(64, Math.floor(w / 6));
  
  ctx.save();
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(x, y, x, y + h);
  skyGrad.addColorStop(0, '#0a0a1a');
  skyGrad.addColorStop(1, '#1a1a3a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(x, y, w, h);
  
  // Mountain layers (3 layers for depth)
  const layers = 3;
  for (let layer = 0; layer < layers; layer++) {
    const layerOpacity = 0.4 + (layer / layers) * 0.6;
    ctx.globalAlpha = layerOpacity;
    ctx.fillStyle = pickColor(layer / layers, panel.colors, panel.color);
    
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    
    for (let i = 0; i <= samples; i++) {
      const freqIdx = Math.floor(((i / samples) * freq.length) + layer * (freq.length / (layers * 2)));
      const v = freq[Math.min(freqIdx, freq.length - 1)] / 255;
      const px = x + (i / samples) * w;
      const layerHeight = h * (0.3 + layer * 0.2);
      const py = y + h - v * layerHeight;
      ctx.lineTo(px, py);
    }
    
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

const neonGlowWave = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, time } = r;
  // Downsample to avoid subpixel-dense segments whose glow merges into a thick band
  const steps = Math.min(time.length, Math.max(128, Math.floor(w)));
  ctx.save();
  ctx.shadowColor = panel.colors ? panel.colors.mid : panel.color;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = makeBandGradient(ctx, x, w, panel.colors, panel.color);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < steps; i++) {
    const srcIdx = Math.floor((i / steps) * time.length);
    const v = time[srcIdx] / 255;
    const px = x + (i / steps) * w;
    const py = y + (1 - v) * h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
};

const frequencyHeatmap = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq } = r;
  const cols = Math.max(64, Math.floor(w / 8));
  const colW = w / cols;
  for (let i = 0; i < cols; i++) {
    const idx = Math.floor((i / cols) * freq.length);
    const v = freq[idx] / 255;
    const ratio = idx / freq.length;
    const color = pickColor(ratio, panel.colors, panel.color);
    ctx.fillStyle = color;
    ctx.globalAlpha = clamp(0.3 + v * 0.7, 0.3, 1);
    ctx.fillRect(x + i * colW, y, colW, h);
  }
  ctx.globalAlpha = 1;
};

const starburst = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rays = 64;
  const innerRadius = Math.min(w, h) / 8;
  const maxLen = Math.min(w, h) / 2.5;

  ctx.save();
  
  // Draw radial bars
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  
  for (let i = 0; i < rays; i++) {
    const idx = Math.floor((i / rays) * freq.length);
    const v = freq[idx] / 255;
    const a = (i / rays) * Math.PI * 2;
    const barLen = maxLen * v * (0.4 + energy * 0.6);
    
    const startX = cx + Math.cos(a) * innerRadius;
    const startY = cy + Math.sin(a) * innerRadius;
    const endX = cx + Math.cos(a) * (innerRadius + barLen);
    const endY = cy + Math.sin(a) * (innerRadius + barLen);
    
    // Gradient color based on frequency band
    const ratio = idx / freq.length;
    ctx.strokeStyle = pickColor(ratio, panel.colors, panel.color);
    ctx.globalAlpha = 0.7 + v * 0.3;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  
  // Draw glowing center circle
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = panel.colors ? panel.colors.mid : panel.color;
  ctx.shadowColor = panel.colors ? panel.colors.high : panel.color;
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius * (1 + energy * 0.2), 0, Math.PI * 2);
  ctx.fill();
  
  // Inner glow ring
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = panel.colors ? panel.colors.high : panel.color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius * 0.85, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
};

const rippleField = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, now } = r;
  const cx = x + w / 2; const cy = y + h / 2;
  const rings = 6;
  for (let i = 0; i < rings; i++) {
    const phase = (now * 0.7 + i * 0.2) % 1;
    const R = (Math.min(w, h) / 12) * (i + 1) * (1 + energy * 0.5) + phase * 8;
    ctx.strokeStyle = pickColor(i / Math.max(1, rings - 1), panel.colors, panel.color);
    ctx.globalAlpha = clamp(0.2 + energy, 0.2, 1);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const minimalDotPulse = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy } = r;
  const cx = x + w / 2; const cy = y + h / 2;
  const R = Math.min(w, h) / 24;
  // Use energy level to pick band color (low energy = low, high = high)
  ctx.fillStyle = pickColor(energy, panel.colors, panel.color);
  ctx.beginPath();
  ctx.arc(cx, cy, R * (1 + energy * 1.5), 0, Math.PI * 2);
  ctx.fill();
};

// Triangular Net (inspired by equilateral triangular lattice connection) — beat reactive
const triangularNet = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy, now } = r;
  // Beat detection via low-frequency energy delta (simple proxy)
  const key = `${r.panelKey}:tri-net`;
  const state = getState<{ prevLow: number }>(key, () => ({ prevLow: 0 }));
  const lowBins = Math.floor(freq.length / 4);
  let lowEnergy = 0; for (let i = 0; i < lowBins; i++) lowEnergy += freq[i];
  lowEnergy = lowEnergy / (255 * Math.max(1, lowBins));
  const beat = lowEnergy - state.prevLow > 0.06;
  state.prevLow = state.prevLow * 0.85 + lowEnergy * 0.15;

  // Pseudo-random generator (Mersenne-like simplified)
  const MT = new Uint32Array(624);
  let idx = 0;
  const setSeed = (seed: number) => { MT[0] = seed >>> 0; for (let i = 1; i < 624; i++) { MT[i] = (1812433253 * (MT[i-1] ^ (MT[i-1] >>> 30)) + i) >>> 0; } idx = 0; };
  const generateNumbers = () => { for (let i = 0; i < 624; i++) { const y32 = (MT[i] & 0x80000000) + (MT[(i + 1) % 624] & 0x7fffffff); MT[i] = MT[(i + 397) % 624] ^ (y32 >>> 1); if ((y32 & 1) !== 0) MT[i] = MT[i] ^ 0x9908B0DF; } };
  const extractNumber = () => { if (idx === 0) generateNumbers(); let y32 = MT[idx]; y32 ^= (y32 >>> 11); y32 ^= (y32 << 7) & 0x9D2C5680; y32 ^= (y32 << 15) & 0xEFC60000; y32 ^= (y32 >>> 18); idx = (idx + 1) % 624; return y32 >>> 0; };
  const rand = () => (extractNumber() / 0x7FFFFFFF);
  setSeed(3);

  // Generate vertices cloud (audio-reactive spawn & offset)
  const vertices: Array<[number, number]> = [];
  const count = 12 + Math.floor(energy * 8);
  const spawnBase = 20 + Math.floor(lowEnergy * 52);
  const offset = Math.max(36, Math.min(Math.max(w, h) / 3, 52 + lowEnergy * 110));
  const rotScale = (0.0006 + energy * 0.0010) * (0.35 + 0.65 * (beat ? 1.0 : 0.0));
  for (let i = 0; i < count; i++) {
    const rlen = (rand() - 0.5) * Math.max(w, h) / 2;
    const a0 = ((i % 2 === 0 ? 1 : -1) * now * rotScale * 1000) + rand() * Math.PI * 2;
    const v0: [number, number] = [Math.cos(a0) * rlen, Math.sin(a0) * rlen];
    vertices.unshift(v0);
    const spawn = Math.floor(spawnBase * (0.5 + rand()));
    for (let j = 0; j < spawn; j++) {
      const r2 = rand() * offset;
      const a2 = ((j % 2 === 0 ? 1 : -1) * now * rotScale * 2000) + rand() * Math.PI * 2;
      const o = vertices[0];
      const v: [number, number] = [o[0] + Math.cos(a2) * r2, o[1] + Math.sin(a2 * 2) * r2];
      vertices.push(v);
    }
  }

  // Clip to panel region and draw centered
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.lineWidth = 1;
  const maxScale = Math.max(w, h) / 8;
  // Layered lattice scales for depth; alpha reacts to beat/energy
  for (let s = 8; s <= maxScale; s *= 2) {
    // Use layer depth as ratio for band coloring
    const layerRatio = (s - 8) / Math.max(1, maxScale - 8);
    ctx.strokeStyle = pickColor(layerRatio, panel.colors, panel.color);
    ctx.globalAlpha = ((1 - s / maxScale) * 0.12) * (0.7 + energy * 0.6 + (beat ? 0.35 : 0));
    // Render yolo at this scale
    // Measures of an equilateral triangle lattice
    const sides = 3;
    let l = 2 * Math.sin(Math.PI / sides); // base side length
    let a = l / (2 * Math.tan(Math.PI / sides)); // apothem
    let hv = (1 + a);
    l *= s; hv *= s;
    const mx = 2 * Math.ceil(w / l);
    const my = Math.ceil(h / hv);
    const fills: number[][] = [];
    ctx.beginPath();
    for (let vi = 0; vi < vertices.length; vi++) {
      const v = vertices[vi];
      const cell_x = Math.round(((v[0] - 0) / Math.max(1, w - 0)) * mx);
      const cell_y = Math.round(((v[1] - 0) / Math.max(1, h - 0)) * my);
      let md = Number.POSITIVE_INFINITY, d = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      const ps: number[] = [];
      for (let i2 = cell_x - 2; i2 < cell_x + 2; i2++) {
        for (let j2 = cell_y - 2; j2 < cell_y + 2; j2++) {
          if ((Math.abs(i2) % 2 === 1 && Math.abs(j2) % 2 === 0) || (Math.abs(i2) % 2 === 0 && Math.abs(j2) % 2 === 1)) {
            const ix = (i2) * l / 2;
            const iy = (j2) * hv;
            const dx = ix - v[0];
            const dy = iy - v[1];
            d = dx * dx + dy * dy;
            if (d < md) { md = d; x1 = (i2) * l / 2; y1 = (j2) * hv; ps.unshift(x1, y1); }
          }
        }
      }
      // Draw either from vertex to nearest lattice point or between lattice points
      if (rand() > 0.5) {
        ctx.moveTo(v[0], v[1]);
        ctx.lineTo(ps[0], ps[1]);
      } else {
        x2 = ps[2]; y2 = ps[3];
        ctx.moveTo(ps[0], ps[1]);
        ctx.lineTo(x2, y2);
        // Occasionally queue a filled triangle accent (beat increases chance)
        if (rand() > (0.95 - (beat ? 0.15 : 0))) {
          fills.push([ps[0], ps[1], x2, y2, ps[4], ps[5]]);
        }
      }
    }
    ctx.stroke();
    // Fills
    if (fills.length) {
      ctx.beginPath();
      ctx.fillStyle = pickColor(layerRatio, panel.colors, panel.color);
      ctx.globalAlpha = 0.08 + energy * 0.10 + (beat ? 0.12 : 0);
      for (const ps of fills) {
        ctx.moveTo(ps[0], ps[1]);
        ctx.lineTo(ps[2], ps[3]);
        ctx.lineTo(ps[4], ps[5]);
        ctx.closePath();
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Dancer FBX: render with Three.js offscreen and composite into panel region
const dancerFBX = (r: RenderContext) => {
  const { ctx, x, y, w, h, panelKey, energy, freq, now, panel } = r as RenderContext & { panel: { dancerSources?: DancerSources } };
  // Use per-panel sources if provided, otherwise defaults
  const sources: DancerSources = panel.dancerSources ?? {
    characterUrl: '/character/character.fbx',
    animationUrls: ['/dance/Wave Hip Hop Dance.fbx', '/dance/Twist Dance.fbx']
  };
  // Render offscreen and draw into 2D canvas
  const key = `${panelKey}|${sources.characterUrl ?? ''}|${(sources.animationUrls ?? []).join(',')}`;
  renderDancer(key, sources, Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)), energy, true, freq, now)
    .then((canvas) => {
      try { ctx.drawImage(canvas, x, y, w, h); } catch {}
    })
    .catch(() => {/* ignore in render loop */});
};

// Persistent state helper
type StateMap<T> = Map<string, T>;
// Global state map for persistent visualizer data per panel/mode
const states: StateMap<unknown> = new Map();
function getState<T>(key: string, init: () => T): T {
  if (!states.has(key)) states.set(key, init());
  return states.get(key) as T;
}

// Firefly Swarm: glowing particles wander; speed/glow react to energy
const fireflySwarm = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, panelKey, freq } = r;
  const key = `${panelKey}:firefly`;
  type Particle = { px: number; py: number; vx: number; vy: number; glow: number };
  const parts = getState<Particle[]>(key, () => {
    const N = Math.floor(Math.max(24, (w * h) / 25000));
    return Array.from({ length: N }, () => ({
      px: x + Math.random() * w,
      py: y + Math.random() * h,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      glow: Math.random() * 6 + 6,
    }));
  });
  // Update and draw
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    // Wander with slight random and react to energy
    const accel = 0.05 + energy * 0.2;
    p.vx += (Math.random() - 0.5) * accel;
    p.vy += (Math.random() - 0.5) * accel;
    // Limit velocity
    const maxV = 1.2 + energy * 1.0;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > maxV) { p.vx = (p.vx / sp) * maxV; p.vy = (p.vy / sp) * maxV; }
    p.px += p.vx; p.py += p.vy;
    // Wrap around region
    if (p.px < x) p.px = x + w;
    if (p.px > x + w) p.px = x;
    if (p.py < y) p.py = y + h;
    if (p.py > y + h) p.py = y;
    // Map particle X position to a frequency bin to drive brightness
    const ratioX = Math.max(0, Math.min(1, (p.px - x) / Math.max(1, w)));
    const idx = Math.floor(ratioX * Math.max(1, freq.length - 1));
    const fv = freq[idx] / 255; // local frequency value 0..1
    const brightness = clamp(0.25 + fv * 0.9 + energy * 0.4, 0.25, 1.0);
    // Draw glowing dot that lights up with local frequency energy
    const particleColor = pickColor(ratioX, panel.colors, panel.color);
    ctx.shadowColor = particleColor;
    ctx.shadowBlur = p.glow + fv * 24 + energy * 12;
    ctx.globalAlpha = brightness;
    ctx.fillStyle = particleColor;
    ctx.beginPath();
  ctx.arc(p.px, p.py, 1.8 + fv * 1.5 + energy * 1.0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
};

// Snowfall React: falling flakes with speed/size affected by energy
const snowfallReact = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, panelKey } = r;
  const key = `${panelKey}:snow`;
  type Flake = { px: number; py: number; size: number; speed: number; drift: number };
  const flakes = getState<Flake[]>(key, () => {
    const N = Math.floor(Math.max(30, w / 12));
    return Array.from({ length: N }, () => ({
      px: x + Math.random() * w,
      py: y + Math.random() * h,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.8 + 0.4,
      drift: (Math.random() - 0.5) * 0.4,
    }));
  });
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (const f of flakes) {
    f.py += f.speed * (1 + energy * 1.5);
    f.px += f.drift;
    if (f.py > y + h) { f.py = y - 2; f.px = x + Math.random() * w; }
    if (f.px < x) f.px = x + w;
    if (f.px > x + w) f.px = x;
    const ratioX = Math.max(0, Math.min(1, (f.px - x) / Math.max(1, w)));
    ctx.fillStyle = pickColor(ratioX, panel.colors, panel.color);
    ctx.beginPath();
    ctx.arc(f.px, f.py, f.size * (1 + energy * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Rain React: fast vertical streaks; speed/length react to energy
const rainReact = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, panelKey } = r;
  const key = `${panelKey}:rain`;
  type Drop = { px: number; py: number; len: number; speed: number };
  const drops = getState<Drop[]>(key, () => {
    const N = Math.floor(Math.max(40, w / 10));
    return Array.from({ length: N }, () => ({
      px: x + Math.random() * w,
      py: y + Math.random() * h,
      len: Math.random() * 10 + 8,
      speed: Math.random() * 2 + 1.5,
    }));
  });
  ctx.save();
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = clamp(0.4 + energy * 0.6, 0.4, 1);
  // Use high-frequency energy to drive rain intensity
  const highBins = Math.floor(r.freq.length / 3);
  let highEnergy = 0;
  for (let i = r.freq.length - highBins; i < r.freq.length; i++) highEnergy += r.freq[i];
  highEnergy = highEnergy / (255 * Math.max(1, highBins));
  for (const d of drops) {
    d.py += d.speed * (1.2 + highEnergy * 3.0 + energy * 0.8);
    if (d.py - d.len > y + h) {
      d.py = y - 2; d.px = x + Math.random() * w; d.len = Math.random() * 10 + 8;
    }
    const ratioX = Math.max(0, Math.min(1, (d.px - x) / Math.max(1, w)));
    ctx.strokeStyle = pickColor(ratioX, panel.colors, panel.color);
    ctx.beginPath();
    ctx.moveTo(d.px, d.py);
    ctx.lineTo(d.px, d.py - d.len * (1 + highEnergy * 1.5 + energy * 0.5));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Smoke / Fog Pulse: soft puffs that appear and expand on bass pulses
const smokeFogPulse = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, panelKey, freq } = r;
  const key = `${panelKey}:fog`;
  type Puff = { px: number; py: number; r: number; alpha: number; grow: number };
  const state = getState<{ puffs: Puff[]; prevLow: number }>(key, () => ({ puffs: [], prevLow: 0 }));
  // Bass energy
  const lowBins = Math.floor(freq.length / 4);
  let lowEnergy = 0; for (let i = 0; i < lowBins; i++) lowEnergy += freq[i];
  lowEnergy = lowEnergy / (255 * Math.max(1, lowBins));
  const beat = lowEnergy - state.prevLow > 0.08;
  state.prevLow = state.prevLow * 0.85 + lowEnergy * 0.15;
  if (beat) {
    // spawn a few puffs
    for (let k = 0; k < 3; k++) {
      state.puffs.push({
        px: x + Math.random() * w,
        py: y + Math.random() * h,
        r: 6 + Math.random() * 10,
        alpha: 0.05 + Math.random() * 0.08,
        grow: 0.4 + Math.random() * 0.8,
      });
    }
    // limit
    if (state.puffs.length > 120) state.puffs.splice(0, state.puffs.length - 120);
  }
  ctx.save();
  for (const p of state.puffs) {
    // expand and fade
    p.r += p.grow * (1 + energy);
    p.alpha *= 0.985;
    if (p.alpha < 0.01) continue;
    const ratioX = Math.max(0, Math.min(1, (p.px - x) / Math.max(1, w)));
    const puffColor = pickColor(ratioX, panel.colors, panel.color);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = puffColor;
    ctx.shadowColor = puffColor;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Cloud Drift: soft blobs drifting slowly; energy affects size and opacity subtly
const cloudDrift = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, panelKey } = r;
  const key = `${panelKey}:cloud`;
  type Blob = { px: number; py: number; r: number; vx: number };
  const blobs = getState<Blob[]>(key, () => {
    const N = Math.floor(Math.max(6, w / 200));
    return Array.from({ length: N }, () => ({
      px: x + Math.random() * w,
      py: y + Math.random() * h,
      r: 30 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 0.3,
    }));
  });
  ctx.save();
  for (const b of blobs) {
    b.px += b.vx * (1 + energy * 0.5);
    if (b.px < x - 50) b.px = x + w + 50;
    if (b.px > x + w + 50) b.px = x - 50;
    const ratioX = Math.max(0, Math.min(1, (b.px - x) / Math.max(1, w)));
    const blobColor = pickColor(ratioX, panel.colors, panel.color);
    ctx.globalAlpha = 0.06 + energy * 0.08;
    ctx.fillStyle = blobColor;
    ctx.shadowColor = blobColor;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(b.px, b.py, b.r * (1 + energy * 0.2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Soft Plasma: layered radial gradients with subtle motion; energy modulates scale
const softPlasma = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, now, panelKey } = r;
  const key = `${panelKey}:plasma`;
  type Node = { px: number; py: number; r: number; phase: number };
  const nodes = getState<Node[]>(key, () => {
    const N = 3;
    return Array.from({ length: N }, () => ({
      px: x + Math.random() * w,
      py: y + Math.random() * h,
      r: Math.min(w, h) / 6,
      phase: Math.random() * Math.PI * 2,
    }));
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
    const n = nodes[nIdx];
    // gentle bobbing
    const px = n.px + Math.sin(now + n.phase) * 8;
    const py = n.py + Math.cos(now * 0.8 + n.phase) * 6;
    const r2 = n.r * (1 + energy * 0.4);
    const nodeColor = pickColor(nIdx / Math.max(1, nodes.length - 1), panel.colors, panel.color);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r2);
    grad.addColorStop(0, nodeColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
};

// Radar Sweep: sweeping beam highlights blips; blips spawn on energy peaks
const radarSweep = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, now, panelKey, freq } = r;
  const key = `${panelKey}:radar`;
  type Blip = { angle: number; radius: number; alpha: number };
  const state = getState<{ blips: Blip[]; prevHigh: number }>(key, () => ({ blips: [], prevHigh: 0 }));
  const cx = x + w / 2; const cy = y + h / 2;
  const maxR = Math.min(w, h) / 2 - 8;
  // Background grid rings
  ctx.save();
  ctx.strokeStyle = pickColor(0.5, panel.colors, panel.color);
  ctx.globalAlpha = 0.08 + energy * 0.05;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath(); ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Compute high-frequency energy for blip spawning
  const highBins = Math.floor(freq.length / 3);
  let highEnergy = 0; for (let i = freq.length - highBins; i < freq.length; i++) highEnergy += freq[i];
  highEnergy = highEnergy / (255 * Math.max(1, highBins));
  const peak = highEnergy - state.prevHigh > 0.06;
  state.prevHigh = state.prevHigh * 0.9 + highEnergy * 0.1;
  if (peak) {
    const count = 2 + Math.floor(highEnergy * 4);
    for (let k = 0; k < count; k++) {
      state.blips.push({ angle: Math.random() * Math.PI * 2, radius: 12 + Math.random() * (maxR - 12), alpha: 0.7 });
    }
    if (state.blips.length > 120) state.blips.splice(0, state.blips.length - 120);
  }
  // Sweeping beam
  const sweepAngle = (now * 0.8) % (Math.PI * 2);
  const beamWidth = 0.12;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = pickColor(0.5, panel.colors, panel.color);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.4 + highEnergy * 0.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
  ctx.stroke();
  // Blips
  for (const b of state.blips) {
    // Fade over time
    b.alpha *= 0.985;
    if (b.alpha < 0.05) continue;
    const dx = Math.cos(b.angle) * b.radius;
    const dy = Math.sin(b.angle) * b.radius;
    const near = Math.abs(((b.angle - sweepAngle + Math.PI * 2) % (Math.PI * 2)) - Math.PI) < beamWidth;
    const a = b.alpha * (near ? 1.5 : 0.7) * (0.6 + energy * 0.6);
    ctx.globalAlpha = Math.min(1, a);
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, near ? 3.5 : 2.0, 0, Math.PI * 2);
    const blipRatio = b.angle / (Math.PI * 2);
    ctx.fillStyle = pickColor(blipRatio, panel.colors, panel.color);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
};

// Orbital Particles: dots orbit center with varying radii/speeds; speed reacts to frequency
const orbitalParticles = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, energy, panelKey, freq } = r;
  const key = `${panelKey}:orbit`;
  type Part = { angle: number; radius: number; speed: number; size: number };
  const parts = getState<Part[]>(key, () => {
    const N = Math.floor(Math.max(30, (w + h) / 20));
    const minR = Math.min(w, h) / 6;
    const maxR = Math.min(w, h) / 2 - 10;
    return Array.from({ length: N }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: minR + Math.random() * (maxR - minR),
      speed: 0.3 + Math.random() * 0.8,
      size: 1.5 + Math.random() * 1.5,
    }));
  });
  const cx = x + w / 2; const cy = y + h / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    // Map radius to a frequency bin to drive speed/brightness
    const ratioR = (p.radius - Math.min(w, h) / 6) / Math.max(1, (Math.min(w, h) / 2 - 10) - (Math.min(w, h) / 6));
    const idx = Math.floor(ratioR * Math.max(1, freq.length - 1));
    const fv = freq[idx] / 255;
    p.angle += (p.speed + fv * 1.2) * 0.02 * (1 + energy * 0.6);
    const px = cx + Math.cos(p.angle) * p.radius;
    const py = cy + Math.sin(p.angle) * p.radius;
    const glow = 6 + fv * 24 + energy * 10;
    const partColor = pickColor(ratioR, panel.colors, panel.color);
    ctx.shadowColor = partColor;
    ctx.shadowBlur = glow;
    ctx.globalAlpha = 0.5 + fv * 0.5;
    ctx.fillStyle = partColor;
    ctx.beginPath();
    ctx.arc(px, py, p.size * (1 + fv * 0.8 + energy * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
};

// Smooth Gradient Bars: vertical bars with smooth gradients and glow (optimized)
const smoothGradientBars = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const bars = Math.min(64, Math.max(32, Math.floor(w / 16)));
  const barW = w / bars;
  
  ctx.save();
  ctx.lineCap = 'round';
  
  for (let i = 0; i < bars; i++) {
    const idx = Math.floor((i / bars) * freq.length);
    const v = freq[idx] / 255;
    const barH = v * h * (0.7 + energy * 0.3);
    const ratio = idx / freq.length;
    const color = pickColor(ratio, panel.colors, panel.color);
    
    ctx.globalAlpha = 0.8 + v * 0.2;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, barW - 2);
    
    const bx = x + i * barW + barW / 2;
    ctx.beginPath();
    ctx.moveTo(bx, y + h);
    ctx.lineTo(bx, y + h - barH);
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Layered Smooth Waves: overlapping waveforms (optimized)
const layeredSmoothWaves = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, time, energy } = r;
  const layers = 2;
  
  ctx.save();
  ctx.lineWidth = 2;
  
  for (let layer = 0; layer < layers; layer++) {
    const offset = (layer / layers) * 0.3;
    const layerRatio = layer / (layers - 1);
    const color = pickColor(layerRatio, panel.colors, panel.color);
    
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5 + energy * 0.3;
    
    ctx.beginPath();
    for (let i = 0; i < time.length; i++) {
      const v = (time[i] / 255) - 0.5 + offset;
      const px = x + (i / time.length) * w;
      const py = y + h / 2 + v * h * (0.4 - layer * 0.1);
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Smooth Dotted Wave: waveform made of dots (optimized)
const smoothDottedWave = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, time, energy } = r;
  const dots = Math.min(96, Math.max(48, Math.floor(w / 6)));
  
  ctx.save();
  
  for (let i = 0; i < dots; i++) {
    const srcIdx = Math.floor((i / dots) * time.length);
    const v = time[srcIdx] / 255;
    const px = x + (i / dots) * w;
    const py = y + (1 - v) * h;
    const ratio = srcIdx / time.length;
    const color = pickColor(ratio, panel.colors, panel.color);
    
    const dotSize = 2 + v * 3;
    
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7 + v * 0.3;
    
    ctx.beginPath();
    ctx.arc(px, py, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Smooth Blob Morph: organic blob shape (optimized)
const smoothBlobMorph = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const baseR = Math.min(w, h) / 4;
  const points = 24;
  
  ctx.save();
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const idx = Math.floor((i / points) * freq.length);
    const v = freq[idx] / 255;
    const angle = (i / points) * Math.PI * 2;
    
    const R = baseR * (1 + v * 0.5 + energy * 0.2);
    const px = cx + Math.cos(angle) * R;
    const py = cy + Math.sin(angle) * R;
    
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  
  const color = pickColor(0.5, panel.colors, panel.color);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.2 + energy * 0.2;
  ctx.fill();
  
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Smooth Concentric Equalizer: rings with dots (optimized)
const smoothConcentricEqualizer = (r: RenderContext) => {
  const { ctx, x, y, w, h, panel, freq, energy } = r;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const baseSize = Math.min(w, h);
  const rings = 3;
  const dotsPerRing = 64;
  
  ctx.save();
  
  for (let ring = 0; ring < rings; ring++) {
    const ringRadius = (baseSize / 10) * (ring + 1.5) * (1 + energy * 0.1);
    const ringRatio = ring / (rings - 1);
    const ringColor = pickColor(ringRatio, panel.colors, panel.color);
    
    // Draw ring outline
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw dots
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < dotsPerRing; i++) {
      const angle = (i / dotsPerRing) * Math.PI * 2;
      const idx = Math.floor((i / dotsPerRing) * freq.length);
      const v = freq[idx] / 255;
      const ratio = idx / freq.length;
      
      const dotSize = 1.5 + v * 2;
      const px = cx + Math.cos(angle) * ringRadius;
      const py = cy + Math.sin(angle) * ringRadius;
      const color = pickColor(ratio, panel.colors, panel.color);
      
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6 + v * 0.4;
      
      ctx.beginPath();
      ctx.arc(px, py, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Center circle
  const centerColor = panel.colors ? panel.colors.mid : panel.color;
  ctx.fillStyle = centerColor;
  ctx.globalAlpha = 0.5 + energy * 0.3;
  ctx.beginPath();
  ctx.arc(cx, cy, (baseSize / 15) * (1 + energy * 0.2), 0, Math.PI * 2);
  ctx.fill();
  
  ctx.globalAlpha = 1;
  ctx.restore();
};

// ── Dot Matrix 3D Equalizer ──────────────────────────────────────────────────
// Replicates a perspective LED dot-matrix equalizer board: dots arranged in a
// grid that compresses toward the right (1-point perspective). Active dots at
// the top of each column glow; inactive dots are dark charcoal.
const dotMatrix3D = ({ ctx, x, y, w, h, freq, panel }: RenderContext) => {
  // Parse panel color into RGB components for active dot tinting
  const hex = (panel?.color ?? '#22dd44').replace('#', '');
  const pr = parseInt(hex.slice(0, 2), 16);
  const pg = parseInt(hex.slice(2, 4), 16);
  const pb = parseInt(hex.slice(4, 6), 16);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);

  const COLS = 30;
  const ROWS = 16;
  const step = Math.max(1, Math.floor(freq.length / COLS));

  // 1-point perspective: column c has scale factor s(c) = near/(near+c)
  const near = COLS * 0.55;
  const scales: number[] = Array.from({ length: COLS }, (_, c) => near / (near + c));
  const totalW = scales.reduce((a, s) => a + s, 0);
  const unitW = (w * 0.9) / totalW; // base column width unit

  // Precompute column x-centers and widths
  let curX = x + w * 0.04;
  const cols: { cx: number; sc: number; amp: number }[] = [];
  for (let c = 0; c < COLS; c++) {
    const sc = scales[c];
    const colW = unitW * sc;
    const si = c * step;
    let sum = 0;
    for (let i = 0; i < step; i++) sum += freq[si + i] || 0;
    cols.push({ cx: curX + colW * 0.5, sc, amp: sum / (step * 255) });
    curX += colW;
  }

  const gridCY = y + h * 0.46; // vertical center of the grid
  const maxRowH = (h * 0.82) / ROWS; // max row spacing (for leftmost column)

  for (let c = 0; c < COLS; c++) {
    const { cx, sc, amp } = cols[c];
    const dotR = Math.max(1.5, unitW * sc * 0.36);
    const rowH = maxRowH * sc;
    const activeDots = Math.round(amp * ROWS);

    for (let r = 0; r < ROWS; r++) {
      // r=0 is top (active/lit), r=ROWS-1 is bottom
      const dotY = gridCY + (r - ROWS / 2 + 0.5) * rowH;
      const isActive = r < activeDots;

      ctx.beginPath();
      ctx.arc(cx, dotY, dotR, 0, Math.PI * 2);

      if (isActive) {
        // Brightness fades from top (brightest) to the amplitude boundary
        const fade = activeDots > 0 ? (activeDots - r) / activeDots : 0;
        const alpha = 0.55 + fade * 0.45;
        const dr = Math.round(pr * (0.15 + fade * 0.85));
        const dg = Math.round(pg * (0.55 + fade * 0.45));
        const db = Math.round(pb * (0.15 + fade * 0.85));
        ctx.fillStyle = `rgba(${dr},${dg},${db},${alpha})`;
        // Subtle glow only on the top-most 2 active dots for performance
        if (r < 2 && dotR > 2) {
          ctx.shadowBlur = dotR * 2.5;
          ctx.shadowColor = panel?.color ?? '#22dd55';
        } else {
          ctx.shadowBlur = 0;
        }
      } else {
        ctx.shadowBlur = 0;
        // Inactive: dark charcoal, slightly lighter for upper rows
        const base = 38 + Math.round((1 - r / ROWS) * 22);
        ctx.fillStyle = `rgb(${base},${base + 4},${base + 2})`;
      }
      ctx.fill();
    }
  }

  // Subtle floor reflection using panel color
  const floorY = gridCY + (ROWS / 2) * maxRowH * scales[0] + 4;
  const grad = ctx.createLinearGradient(x, floorY, x + w, floorY);
  grad.addColorStop(0, `rgba(${pr},${pg},${pb},0.18)`);
  grad.addColorStop(0.4, `rgba(${pr},${pg},${pb},0.06)`);
  grad.addColorStop(1, `rgba(${pr},${pg},${pb},0.01)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x, floorY, w, 2);

  ctx.shadowBlur = 0;
  ctx.restore();
};

// Registry mapping
export const VISUALIZERS: Record<VisualizerMode, (r: RenderContext) => void> = {
  // Core
  'vertical-bars': verticalBars,
  'horizontal-bars': horizontalBars,
  'mirrored-bars': mirroredBars,
  'waveform': waveform,
  'thick-wave': thickWave,
  'dual-wave': dualWave,
  'high-graphics': ({ ctx, x, y, w, h }) => {
    // WebGL high-graphics visualizer is rendered elsewhere; draw a subtle frame
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-nebula': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-tunnel': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-curl': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-spiral': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-fog': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-cells': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-trunk': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-rings': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-rings-trails': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-kaleidoscope': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-flow-field': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-hexagon': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-hex-paths': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'high-graphics-net': ({ ctx, x, y, w, h }) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore();
  },
  'circular-bars': circularBars,
  'rotating-circular-bars': rotatingCircularBars,
  'radial-waveform': radialWaveform,
  'pulse-circle': pulseCircle,
  'concentric-rings': concentricRings,
  'expanding-wave-rings': expandingWaveRings,
  'smooth-gradient-bars': smoothGradientBars,
  'layered-smooth-waves': layeredSmoothWaves,
  'smooth-dotted-wave': smoothDottedWave,
  'smooth-blob-morph': smoothBlobMorph,
  'smooth-concentric-equalizer': smoothConcentricEqualizer,
  // Unique particle visualizers
  'particle-field': particleFieldVisualizer,
  'particle-burst': particleBurst,
  'floating-dots': minimalDotPulse,
  'bubble': minimalDotPulse,
  'neon-glow-wave': neonGlowWave,
  'audio-spikes': audioSpikes,
  'peak-dots': minimalDotPulse,
  'frequency-heatmap': frequencyHeatmap,
  'gradient-spectrum': simpleGradientSpectrum,
  'spiral-spectrum': radialWaveform,
  'polygon-pulse': polygonPulse,
  'rotating-polygon': rotatingCircularBars,
  'starburst': starburst,
  'line-mesh': lineMesh,
  'particle-mesh': particleMesh,
  'orbital-particles': orbitalParticles,
  'breathing-blob': pulseCircle,
  'soft-plasma': softPlasma,
  'noise-flow': neonGlowWave,
  'light-rays': starburst,
  'equalizer-arc': radialWaveform,
  'radar-sweep': radarSweep,
  'audio-sun': starburst,
  'audio-moon': pulseCircle,
  'tunnel': rippleField,
  'vortex': rippleField,
  'ripple-field': rippleField,
  'echo-trails': neonGlowWave,
  'comet-tails': starburst,
  'firefly-swarm': fireflySwarm,
  'snowfall-react': snowfallReact,
  'rain-react': rainReact,
  'smoke-fog-pulse': smokeFogPulse,
  'cloud-drift': cloudDrift,
  'ocean-wave': thickWave,
  'horizon-pulse': pulseCircle,
  'audio-landscape': audioLandscape,
  'skyline-bars': skylineBarsVisualizer,
  'minimal-dot-pulse': minimalDotPulse,
  'dot-matrix-3d': dotMatrix3D,
  'triangular-net': triangularNet,
  'dancer-fbx': dancerFBX,
  // Synonyms for backward compatibility
  'bars': verticalBars,
  'wave': waveform,
  'circle': circularBars,
};
