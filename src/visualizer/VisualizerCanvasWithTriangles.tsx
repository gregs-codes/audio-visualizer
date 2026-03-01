import React, { useRef, useEffect, useState } from 'react';
import { useAudioAnalyzer } from '../audio/useAudioAnalyzer';

interface VisualizerCanvasWithTrianglesProps {
  analyser?: AnalyserNode | null;
  width?: number;
  height?: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  backgroundFit?: 'cover' | 'contain' | 'stretch';
  backgroundOpacity?: number;
}

const MAX_BG_SIZE_MB = 10;
const MAX_BG_SIZE_BYTES = MAX_BG_SIZE_MB * 1024 * 1024;

const VisualizerCanvasWithTriangles: React.FC<VisualizerCanvasWithTrianglesProps> = ({
  analyser,
  width = 1280,
  height = 720,
  backgroundColor,
  backgroundImageUrl,
  backgroundFit = 'cover',
  backgroundOpacity = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frequencyData, setFrequencyData] = useState<number[]>([]);
  const [beat, setBeat] = useState<boolean>(false);

  // Triangles state
  const [triangles, setTriangles] = useState<any[]>([]);

  // Audio analyser polling
  useEffect(() => {
    if (!analyser) return;
    const freqArr = new Uint8Array(analyser.frequencyBinCount);
    let rafId: number;
    const update = () => {
      analyser.getByteFrequencyData(freqArr);
      setFrequencyData(Array.from(freqArr));
      // Simple beat detection: high average triggers beat
      setBeat(freqArr.reduce((a, b) => a + b, 0) / freqArr.length > 100);
      rafId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(rafId);
  }, [analyser]);

  // Initialize triangles
  useEffect(() => {
    if (triangles.length === 0) {
      const arr = Array.from({ length: 20 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 40 + Math.random() * 60,
        angle: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.03,
        color: `rgba(${100 + Math.random()*155},${50 + Math.random()*205},${200 + Math.random()*55},0.7)`
      }));
      setTriangles(arr);
    }
  }, [triangles, width, height]);

  // Draw visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background color
    if (backgroundColor) {
      ctx.save();
      ctx.globalAlpha = backgroundOpacity;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw background image if provided
    if (backgroundImageUrl) {
      const img = new window.Image();
      img.src = backgroundImageUrl;
      img.onload = () => {
        ctx.save();
        ctx.globalAlpha = backgroundOpacity;
        drawBgImage(ctx, img, backgroundFit);
        ctx.restore();
        drawTriangles(ctx);
        drawBars(ctx);
      };
      if (img.complete) {
        ctx.save();
        ctx.globalAlpha = backgroundOpacity;
        drawBgImage(ctx, img, backgroundFit);
        ctx.restore();
      }
    }
    
    // Draw background image with fit (cover/contain/stretch)
    function drawBgImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, fit: 'cover' | 'contain' | 'stretch') {
      const cw = ctx.canvas.width, ch = ctx.canvas.height;
      const iw = img.width, ih = img.height;
      if (fit === 'stretch') {
        ctx.drawImage(img, 0, 0, cw, ch);
        return;
      }
      const ir = iw / ih, cr = cw / ch;
      let drawW = cw, drawH = ch, dx = 0, dy = 0;
      if ((fit === 'cover' && ir > cr) || (fit === 'contain' && ir < cr)) {
        // Image is wider (cover) or narrower (contain) than canvas
        drawW = ch * ir;
        drawH = ch;
        dx = (cw - drawW) / 2;
        dy = 0;
      } else {
        drawW = cw;
        drawH = cw / ir;
        dx = 0;
        dy = (ch - drawH) / 2;
      }
      ctx.drawImage(img, dx, dy, drawW, drawH);
    }
    
    drawTriangles(ctx);
    drawBars(ctx);
  }, [frequencyData, backgroundColor, backgroundImageUrl, backgroundOpacity, backgroundFit, triangles, beat]);

  // Draw triangles
  function drawTriangles(ctx: CanvasRenderingContext2D) {
    setTriangles(triangles => triangles.map(tri => {
      // Animate triangle
      const newAngle = tri.angle + tri.speed * (beat ? 2 : 1);
      const newX = tri.x + Math.sin(newAngle) * 2 * (beat ? 2 : 1);
      const newY = tri.y + Math.cos(newAngle) * 2 * (beat ? 2 : 1);
      ctx.save();
      ctx.translate(newX, newY);
      ctx.rotate(newAngle);
      ctx.beginPath();
      ctx.moveTo(0, -tri.size/2);
      ctx.lineTo(tri.size/2, tri.size/2);
      ctx.lineTo(-tri.size/2, tri.size/2);
      ctx.closePath();
      ctx.fillStyle = tri.color;
      ctx.fill();
      ctx.restore();
      return {
        ...tri,
        x: (newX + width) % width,
        y: (newY + height) % height,
        angle: newAngle
      };
    }));
  }

  // Draw bars
  function drawBars(ctx: CanvasRenderingContext2D) {
    const barCount = 64;
    const barWidth = canvasRef.current!.width / barCount;
    for (let i = 0; i < barCount; i++) {
      const value = frequencyData[i] || 0;
      const barHeight = value * 2;
      ctx.fillStyle = `rgb(255,${Math.max(100, value)},0)`;
      ctx.fillRect(i * barWidth, canvasRef.current!.height - barHeight, barWidth - 2, barHeight);
    }
  }

  return (
    <canvas ref={canvasRef} width={800} height={400} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
  );
};

export default VisualizerCanvasWithTriangles;
