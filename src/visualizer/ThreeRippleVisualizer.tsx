import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface ThreeRippleVisualizerProps {
  analyser: AnalyserNode | null;
  width: number;
  height: number;
  color?: { r: number; g: number; b: number };
}


// Vertex shader: displace mesh vertically for 3D ripple effect
const vertexShader = `
  uniform float uTime;
  uniform float uAudio[64];
  varying vec2 vUv;
  varying float vRadius;
  void main() {
    vUv = uv;
    vec2 centeredUv = uv * 2.0 - 1.0;
    vRadius = length(centeredUv);
    float t = uTime;
    float freq = 8.0;
    float speed = 0.5;
    float rippleSum = 0.0;
    for (int i = 0; i < 32; i++) {
      float band = float(i) / 32.0;
      float a = uAudio[i] * 0.5;
      rippleSum += sin((vRadius * freq + band - t * speed) * 6.2831) * a / (1.0 + 10.0 * vRadius);
    }
    float height = 0.12 * rippleSum;
    vec3 displaced = position + normal * height;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

// Fragment shader: circular ripples, vignette, and soft fade at edge
const fragmentShader = `
  uniform float uTime;
  uniform float uAudio[64];
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vRadius;

  float ripple(float r, float t, float amp, float freq, float speed) {
    float ripple = sin((r * freq - t * speed) * 6.2831) * amp / (1.0 + 10.0 * r);
    return ripple;
  }

  void main() {
    float t = uTime;
    float freq = 8.0;
    float speed = 0.5;
    float rippleSum = 0.0;
    for (int i = 0; i < 32; i++) {
      float band = float(i) / 32.0;
      float a = uAudio[i] * 0.5;
      rippleSum += ripple(vRadius, t + band * 0.2, a, freq + float(i), speed + band);
    }
    float intensity = 0.5 + 0.5 * rippleSum;
    // Vignette: fade out at edge
    float vignette = smoothstep(0.95, 0.7, vRadius);
    vec3 color = mix(vec3(0.1,0.1,0.1), uColor, intensity) * vignette;
    float alpha = vignette;
    if (vRadius > 1.0) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const ThreeRippleVisualizer: React.FC<ThreeRippleVisualizerProps> = ({ analyser, width, height, color }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  // Fix: Use plain Float32Array, not parameterized
  const audioData = useRef(new Float32Array(64));

  useEffect(() => {

    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let material: THREE.ShaderMaterial;
    let mesh: THREE.Mesh;
    let frame = 0;
    let start = performance.now();

    if (!mountRef.current) return;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 1);
    mountRef.current.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    // Perspective camera, angled down
    const aspect = width / height;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10);
    camera.position.set(0, 1.1, 1.7); // slightly above and back
    camera.lookAt(0, 0, 0);

    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudio: { value: new Array(64).fill(0) },
        uColor: { value: new THREE.Color(color?.r ?? 1, color?.g ?? 1, color?.b ?? 1) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Use a circle mesh for round ripples
    const geometry = new THREE.CircleGeometry(1, 128);
    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2.2; // tilt for perspective
    scene.add(mesh);

    function animate() {
      frame++;
      const now = performance.now();
      material.uniforms.uTime.value = (now - start) * 0.001;
      if (analyser) {
        const arr = audioData.current;
        analyser.getFloatFrequencyData(arr);
        // Normalize and scale for shader
        const norm = Array.from(arr).map(v => Math.max(0, (v + 100) / 60));
        for (let i = 0; i < 64; i++) {
          material.uniforms.uAudio.value[i] = norm[i] ?? 0;
        }
      }
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(requestRef.current!);
      renderer.dispose();
      material.dispose();
      geometry.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [analyser, width, height, color]);

  return <div ref={mountRef} style={{ width, height, position: 'relative' }} />;
};

export default ThreeRippleVisualizer;
