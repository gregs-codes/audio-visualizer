// Laser lights parallax effect
export function laserLightsAnimate(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  const numLasers = 7;
  const x0 = width / 2;
  const y0 = height;
  const len = height * 1.2;
  ctx.save();
  ctx.shadowBlur = 24; // set once, not per-laser
  for (let i = 0; i < numLasers; i++) {
    const phase = (i / numLasers) * Math.PI * 2;
    const angle = Math.sin(time / 900 + phase) * Math.PI/3 + phase;
    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 - Math.abs(Math.sin(angle)) * len;
    const color = `hsl(${(i * 50 + time/10) % 360}, 90%, 60%)`;
    ctx.globalAlpha = 0.18 + 0.12 * Math.sin(time / 400 + i);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.lineWidth = 6 + 3 * Math.sin(time/600 + i);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

// Tunnel/starfield parallax effect
export function tunnelStarfieldAnimate(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  const numStars = 120;
  const cx = width / 2, cy = height / 2;
  // Pre-compute star positions
  type StarData = { x: number; y: number; r: number; alpha: number; hue: number };
  const byAlphaGroup: StarData[][] = Array.from({ length: 7 }, () => []);
  for (let i = 0; i < numStars; i++) {
    const angle = (i / numStars) * Math.PI * 2 + (time / 2000);
    const speed = 0.18 + 0.6 * (i % 7) / 7;
    const dist = ((time * speed + i * 80) % (width * 0.6)) + 40;
    byAlphaGroup[i % 7].push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: 1.2 + 1.5 * (i % 5) / 5,
      alpha: 0.18 + 0.5 * (i % 7) / 7,
      hue: (angle * 180 / Math.PI + time / 20) % 360,
    });
  }
  // Single glow pass (one shadowBlur state change instead of 120)
  ctx.save();
  ctx.shadowBlur = 8;
  for (const group of byAlphaGroup) {
    if (!group.length) continue;
    ctx.globalAlpha = group[0].alpha;
    // Batch all stars in this alpha group into one path per hue bucket
    // Use the average hue of the group for one fill call
    const hue = group[0].hue;
    ctx.fillStyle = `hsl(${hue}, 90%, 70%)`;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    for (const s of group) {
      ctx.moveTo(s.x + s.r, s.y);
      ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
    }
    ctx.fill();
  }
  ctx.restore();
}

// Moving rays/spotlights effect
export function movingRaysAnimate(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  const numRays = 6;
  const x0 = width / 2;
  const y0 = height * 0.1;
  const len = height * 1.1;
  ctx.save();
  ctx.shadowBlur = 32; // set once, not per-ray
  for (let i = 0; i < numRays; i++) {
    const baseAngle = (i / numRays) * Math.PI * 2;
    const angle = baseAngle + Math.sin(time / 1200 + i) * 0.5;
    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 + Math.sin(angle) * len;
    const color = `hsl(${(i * 60 + time/15) % 360}, 100%, 80%)`;
    ctx.globalAlpha = 0.13 + 0.13 * Math.sin(time / 700 + i);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.lineWidth = 32 + 16 * Math.sin(time/900 + i);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}
// ParallaxBackgroundEngine.ts
// Handles animated parallax backgrounds for the visualizer

import { RefObject } from 'react';

export type ParallaxLayer = {
  image?: HTMLImageElement;
  color?: string;
  speed: number;
  opacity: number;
  blendMode?: string;
  animate?: (ctx: CanvasRenderingContext2D, time: number, width: number, height: number) => void;
};

export class ParallaxBackgroundEngine {
  layers: ParallaxLayer[] = [];

  constructor(layers: ParallaxLayer[]) {
    this.layers = layers;
  }

  render(ctx: CanvasRenderingContext2D, time: number, width: number, height: number) {
    ctx.save();
    this.layers.forEach((layer, idx) => {
      ctx.globalAlpha = layer.opacity;
      if (layer.blendMode) ctx.globalCompositeOperation = layer.blendMode;
      if (layer.animate) {
        layer.animate(ctx, time * layer.speed, width, height);
      } else if (layer.image) {
        // Simple parallax scroll
        const offset = (time * layer.speed) % width;
        ctx.drawImage(layer.image, offset, 0, width, height);
        ctx.drawImage(layer.image, offset - width, 0, width, height);
      } else if (layer.color) {
        ctx.fillStyle = layer.color;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
    ctx.restore();
  }
}

// ─── Audio-reactive background visualizers ────────────────────────────────────

/** Full-width mirrored bars, rendered behind everything, react to frequency data. */
export function bgVizBarsAnimate(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  time: number,
  w: number,
  h: number,
  _color: string = '#a0b4f7'
) {
  ctx.fillStyle = '#0b0d1c';
  ctx.fillRect(0, 0, w, h);
  const count = Math.min(freq.length, 96);
  const barW = w / count;
  const cy = h / 2;
  ctx.save();
  ctx.beginPath();
  // Build one path per alpha band to avoid per-bar save/restore
  for (let i = 0; i < count; i++) {
    const val = freq[i] / 255;
    const barH = val * (h * 0.44);
    const hue = (i / count * 50 + 215 + time * 0.008) % 360;
    ctx.globalAlpha = 0.22 + val * 0.22;
    ctx.fillStyle = `hsl(${hue}, 60%, 76%)`;
    ctx.fillRect(i * barW, cy - barH, barW - 1, barH * 2);
  }
  ctx.restore();
}

/** Radial equalizer ring from the center, react to frequency data. */
export function bgVizRadialAnimate(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  time: number,
  w: number,
  h: number,
  _color: string = '#a0b4f7'
) {
  ctx.fillStyle = '#0b0d1c';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const count = Math.min(freq.length, 128);
  const baseR = Math.min(w, h) * 0.13;
  const maxAmp = Math.min(w, h) * 0.36;
  const angleStep = (Math.PI * 2) / count;
  const rotation = time * 0.00018;
  const barW = Math.max(1.5, (2 * Math.PI * baseR) / count * 0.7);
  ctx.save();
  ctx.lineWidth = barW;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const angle = i * angleStep + rotation;
    const val = freq[i] / 255;
    const r2 = baseR + val * maxAmp;
    const hue = (i / count * 55 + 210 + time * 0.004) % 360;
    ctx.globalAlpha = 0.25 + val * 0.35;
    ctx.strokeStyle = `hsl(${hue}, 62%, 74%)`;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * baseR, cy + Math.sin(angle) * baseR);
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Floating orbs orbiting center, each pulsing to a frequency band. */
export function bgVizOrbsAnimate(
  ctx: CanvasRenderingContext2D,
  freq: Uint8Array,
  time: number,
  w: number,
  h: number,
  _color: string = '#a0b4f7'
) {
  ctx.fillStyle = '#0b0d1c';
  ctx.fillRect(0, 0, w, h);
  const orbCount = 9;
  const bandSize = Math.max(1, Math.floor(freq.length / orbCount));
  const minDim = Math.min(w, h);
  ctx.save();
  for (let i = 0; i < orbCount; i++) {
    let sum = 0;
    for (let j = 0; j < bandSize; j++) sum += freq[i * bandSize + j] ?? 0;
    const val = Math.min(1, sum / bandSize / 255);
    const angle = (i / orbCount) * Math.PI * 2 + time * 0.00025 + i * 0.55;
    const orbitR = minDim * (0.18 + (i % 3) * 0.09);
    const ox = w * 0.5 + Math.cos(angle) * orbitR;
    const oy = h * 0.5 + Math.sin(angle) * orbitR;
    const r = minDim * (0.03 + val * 0.09);
    const hue = (i / orbCount * 75 + 195 + time * 0.004) % 360;
    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    grad.addColorStop(0, `hsla(${hue}, 65%, 83%, ${0.55 + val * 0.3})`);
    grad.addColorStop(1, `hsla(${hue}, 65%, 75%, 0)`);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────

// Example spotlight animation
export function spotlightAnimate(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  const numLights = 3;
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = 'rgba(255,255,200,0.7)';
  ctx.shadowColor = 'rgba(255,255,200,0.8)';
  ctx.shadowBlur = 40; // set once, not per-light
  for (let i = 0; i < numLights; i++) {
    const angle = Math.sin(time / 1000 + i) * 0.5 + i * 0.7;
    const x = width / 2 + Math.cos(angle) * width * 0.3;
    const y = height * 0.2 + Math.sin(angle) * height * 0.3;
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.15, height * 0.5, angle, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}
