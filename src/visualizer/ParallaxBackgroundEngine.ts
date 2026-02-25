// Laser lights parallax effect
export function laserLightsAnimate(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  const numLasers = 7;
  for (let i = 0; i < numLasers; i++) {
    const phase = (i / numLasers) * Math.PI * 2;
    const angle = Math.sin(time / 900 + phase) * Math.PI/3 + phase;
    const x0 = width / 2;
    const y0 = height;
    const len = height * 1.2;
    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 - Math.abs(Math.sin(angle)) * len;
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.12 * Math.sin(time / 400 + i);
    ctx.strokeStyle = `hsl(${(i * 50 + time/10) % 360}, 90%, 60%)`;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 6 + 3 * Math.sin(time/600 + i);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }
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
  for (let i = 0; i < numStars; i++) {
    const angle = (i / numStars) * Math.PI * 2 + (time / 2000);
    const speed = 0.18 + 0.6 * (i % 7) / 7;
    const dist = ((time * speed + i * 80) % (width * 0.6)) + 40;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.5 * (i % 7) / 7;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + 1.5 * (i % 5) / 5, 0, 2 * Math.PI);
    ctx.fillStyle = `hsl(${(angle * 180 / Math.PI + time/20) % 360}, 90%, 70%)`;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }
}

// Moving rays/spotlights effect
export function movingRaysAnimate(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  const numRays = 6;
  for (let i = 0; i < numRays; i++) {
    const baseAngle = (i / numRays) * Math.PI * 2;
    const angle = baseAngle + Math.sin(time / 1200 + i) * 0.5;
    const x0 = width / 2;
    const y0 = height * 0.1;
    const len = height * 1.1;
    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 + Math.sin(angle) * len;
    ctx.save();
    ctx.globalAlpha = 0.13 + 0.13 * Math.sin(time / 700 + i);
    ctx.strokeStyle = `hsl(${(i * 60 + time/15) % 360}, 100%, 80%)`;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 32;
    ctx.lineWidth = 32 + 16 * Math.sin(time/900 + i);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }
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

// Example spotlight animation
export function spotlightAnimate(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number
) {
  const numLights = 3;
  for (let i = 0; i < numLights; i++) {
    const angle = Math.sin(time / 1000 + i) * 0.5 + i * 0.7;
    const x = width / 2 + Math.cos(angle) * width * 0.3;
    const y = height * 0.2 + Math.sin(angle) * height * 0.3;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.15, height * 0.5, angle, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,200,0.7)';
    ctx.shadowColor = 'rgba(255,255,200,0.8)';
    ctx.shadowBlur = 40;
    ctx.fill();
    ctx.restore();
  }
}
