
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeAudioVisualizerProps {
  analyser: AnalyserNode | null;
  width?: number;
  height?: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  backgroundFit?: 'cover' | 'contain' | 'stretch';
  backgroundOpacity?: number;
}

const ThreeAudioVisualizer: React.FC<ThreeAudioVisualizerProps> = ({ analyser, width = 640, height = 480, backgroundColor, backgroundImageUrl, backgroundFit = 'cover', backgroundOpacity = 1 }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number>();
  const sphereRef = useRef<THREE.Mesh>();
  const originalVertices = useRef<THREE.Vector3[]>();

  useEffect(() => {
    if (!mountRef.current) return;
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 60;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    // Lighting (optional, for subtle shading)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Sphere geometry
    const sphereGeom = new THREE.SphereGeometry(20, 128, 128);
    const wireframeMat = new THREE.MeshBasicMaterial({ color: 0x99ffff, wireframe: true, transparent: true, opacity: 0.5 });
    const sphere = new THREE.Mesh(sphereGeom, wireframeMat);
    scene.add(sphere);
    sphereRef.current = sphere;
    // Store original vertices for deformation
    originalVertices.current = sphereGeom.attributes.position.array.slice();

    // Animation loop
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    function animate() {
      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        const pos = sphereGeom.attributes.position;
        const orig = originalVertices.current as Float32Array;
        for (let i = 0; i < pos.count; i++) {
          // Spherical coordinates
          const ix = i * 3;
          const x = orig[ix];
          const y = orig[ix + 1];
          const z = orig[ix + 2];
          // Get spherical radius
          const r = Math.sqrt(x * x + y * y + z * z);
          // Map vertex index to frequency bin
          const freqIdx = Math.floor((i / pos.count) * dataArray.length);
          const amp = (dataArray[freqIdx] || 0) / 255;
          // Deform radius
          const deform = 1 + amp * 0.7;
          const nx = (x / r) * 20 * deform;
          const ny = (y / r) * 20 * deform;
          const nz = (z / r) * 20 * deform;
          pos.setXYZ(i, nx, ny, nz);
        }
        pos.needsUpdate = true;
      }
      sphere.rotation.y += 0.003;
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

  return (
    <div style={{ position: 'relative', width, height }}>
      {backgroundColor && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor, opacity: backgroundOpacity, zIndex: 0 }} />
      )}
      {backgroundImageUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${backgroundImageUrl})`,
          backgroundSize: backgroundFit === 'stretch' ? '100% 100%' : backgroundFit,
          backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          opacity: backgroundOpacity, zIndex: 0,
        }} />
      )}
      <div ref={mountRef} style={{ width, height, position: 'relative', zIndex: 1 }} />
    </div>
  );
};

export default ThreeAudioVisualizer;
