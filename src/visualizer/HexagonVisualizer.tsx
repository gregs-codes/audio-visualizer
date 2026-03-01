import React, { useRef, useEffect } from 'react';

interface HexagonVisualizerProps {
  analyser: AnalyserNode | null;
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  backgroundFit?: 'cover' | 'contain' | 'stretch';
  backgroundOpacity?: number;
}

// Helper to get frequency data
function getFrequencyData(analyser: AnalyserNode | null, bins = 128): Uint8Array {
  const arr = new Uint8Array(bins);
  if (analyser) {
    analyser.getByteFrequencyData(arr);
  }
  return arr;
}

// Helper to draw a single hexagon
function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, opacity: number, outline: boolean) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i + Math.PI / 6;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (outline) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Color mapping from bin value
function binToColor(val: number) {
  // Spherical color mapping: green center, red edges
  const t = val / 255;
  const r = Math.round(255 * t);
  const g = Math.round(220 * t + 35 * (1 - t));
  const b = Math.round(60 * (1 - t));
  return `rgb(${r},${g},${b})`;
}

const HexagonVisualizer: React.FC<HexagonVisualizerProps> = ({
  analyser,
  width,
  height,
  backgroundColor,
  backgroundImageUrl,
  backgroundFit = 'cover',
  backgroundOpacity = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImgEl, setBgImgEl] = React.useState<HTMLImageElement | null>(null);
  
  React.useEffect(() => {
    if (backgroundImageUrl) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = backgroundImageUrl;
      img.onload = () => setBgImgEl(img);
      img.onerror = () => setBgImgEl(null);
    } else {
      setBgImgEl(null);
    }
  }, [backgroundImageUrl]);

  useEffect(() => {
    let animationId: number;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const tileSize = Math.min(width, height) / 18;
    const radius = Math.min(width, height) * 0.38;
    const centerX = width / 2;
    const centerY = height / 2;
    const layers = 7;
    const hexes: Array<{ x: number; y: number; bin: number }> = [];
    // Spherical hex grid
    for (let layer = 0; layer < layers; layer++) {
      const hexCount = layer === 0 ? 1 : layer * 6;
      for (let i = 0; i < hexCount; i++) {
        const angle = (Math.PI * 2 * i) / hexCount;
        const r = (radius / layers) * layer;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        hexes.push({ x, y, bin: hexes.length });
      }
    }
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      
      // Draw background color
      if (backgroundColor) {
        ctx.save();
        ctx.globalAlpha = backgroundOpacity;
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      
      // Draw background image if provided
      if (bgImgEl) {
        ctx.save();
        ctx.globalAlpha = backgroundOpacity;
        const iw = bgImgEl.naturalWidth || bgImgEl.width;
        const ih = bgImgEl.naturalHeight || bgImgEl.height;
        let dx = 0, dy = 0, dw = width, dh = height;
        if (backgroundFit === 'cover') {
          const scale = Math.max(width / iw, height / ih);
          dw = Math.ceil(iw * scale);
          dh = Math.ceil(ih * scale);
          dx = Math.floor((width - dw) / 2);
          dy = Math.floor((height - dh) / 2);
        } else if (backgroundFit === 'contain') {
          const scale = Math.min(width / iw, height / ih);
          dw = Math.ceil(iw * scale);
          dh = Math.ceil(ih * scale);
          dx = Math.floor((width - dw) / 2);
          dy = Math.floor((height - dh) / 2);
        }
        try { ctx.drawImage(bgImgEl, dx, dy, dw, dh); } catch {}
        ctx.restore();
      }
      const freqData = getFrequencyData(analyser, hexes.length);
      // Draw hexes
      hexes.forEach(({ x, y, bin }) => {
        const val = freqData[bin % freqData.length];
        if (val > 32) {
          const color = binToColor(val);
          const opacity = Math.min(1, Math.max(0.18, val / 255));
          drawHexagon(ctx, x, y, tileSize, color, opacity, false);
        } else {
          drawHexagon(ctx, x, y, tileSize, 'rgba(0,0,0,0)', 0.18, true);
        }
      });
      animationId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, width, height, bgImgEl, backgroundColor, backgroundOpacity, backgroundFit]);

  return (
    <div style={{ position: 'relative', width: width + 'px', height: height + 'px' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: width + 'px',
          height: height + 'px',
          zIndex: 0,
          pointerEvents: 'none',
          display: 'block',
          objectFit: 'cover',
        }}
      />
    </div>
  );
};

export default HexagonVisualizer;
