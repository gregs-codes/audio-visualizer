
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreePointsVisualizerProps {
  analyser: AnalyserNode | null;
  width?: number;
  height?: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  backgroundFit?: 'cover' | 'contain' | 'stretch';
  backgroundOpacity?: number;
}

// Helper to generate flat disc points in concentric rings
function generateDiscPoints(rings = 32, pointsPerRing = 180, radius = 20) {
  const positions = [];
  for (let r = 0; r < rings; r++) {
    const rad = (r / (rings - 1)) * radius;
    const count = Math.max(8, Math.floor(pointsPerRing * (rad / radius + 0.1)));
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      positions.push(rad * Math.cos(theta), rad * Math.sin(theta), 0);
    }
  }
  return new Float32Array(positions);
}

const ThreePointsVisualizer: React.FC<ThreePointsVisualizerProps> = ({ analyser, width = 640, height = 480, backgroundColor, backgroundImageUrl, backgroundFit = 'cover', backgroundOpacity = 1 }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number>();
  const positionsRef = useRef<Float32Array>();
  const geometryRef = useRef<THREE.BufferGeometry>();

  useEffect(() => {
    if (!mountRef.current) return;
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 20, 60); // slightly above and back
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    // Generate flat disc points
    const rings = 32;
    const pointsPerRing = 180;
    const radius = 24;
    const positions = generateDiscPoints(rings, pointsPerRing, radius);
    positionsRef.current = positions;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometryRef.current = geometry;

    // Points material
    const pointsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.7,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, pointsMat);
    scene.add(points);

    // Animation loop
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    function animate() {
      if (analyser && dataArray && geometryRef.current && positionsRef.current) {
        analyser.getByteFrequencyData(dataArray);
        const pos = geometryRef.current.getAttribute('position');
        const orig = positionsRef.current;
        for (let i = 0; i < pos.count; i++) {
          const ix = i * 3;
          const x = orig[ix];
          const y = orig[ix + 1];
          // Flat disc, z=0
          const r = Math.sqrt(x * x + y * y);
          // Map radius to frequency bin
          const freqIdx = Math.floor((r / radius) * dataArray.length);
          const amp = (dataArray[freqIdx] || 0) / 255;
          // Deform radius
          const deform = 1 + amp * 0.7;
          const nx = (x / (r || 1)) * r * deform;
          const ny = (y / (r || 1)) * r * deform;
          pos.setXYZ(i, nx, ny, 0);
        }
        pos.needsUpdate = true;
      }
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [analyser, width, height]);

  return <div ref={mountRef} style={{ width, height }} />;
};

export default ThreePointsVisualizer;
