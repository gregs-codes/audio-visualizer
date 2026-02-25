import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// Simple curl-like motion using trig; avoids copying Muon code
function curl2(x: number, y: number, t: number) {
  const cx = Math.sin(x * 0.02 + t * 0.8) - Math.sin(y * 0.03 - t * 0.6);
  const cy = Math.cos(y * 0.025 + t * 0.7) - Math.cos(x * 0.018 - t * 0.9);
  return { x: cx, y: cy };
}

// Engine state for Curl Particles variant
type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  points: THREE.Points;
  positions: Float32Array;
  velocities: Float32Array;
};

// Cache per-key engines
const engines = new Map<string, Engine>();

/**
 * Render Curl Particles variant: point cloud driven by a synthetic curl field.
 */
export async function renderHighGfxCurlWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
): Promise<HTMLCanvasElement> {
  let eng = engines.get(key);
  const W = Math.max(1, Math.floor(width));
  const H = Math.max(1, Math.floor(height));
  if (!eng) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
    camera.position.set(0, 0, 100);

    const count = 12000; // performance-friendly default
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 2); // vx, vy
    const area = Math.min(W, H) * 0.45;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      positions[ix + 0] = (Math.random() - 0.5) * area * 2;
      positions[ix + 1] = (Math.random() - 0.5) * area * 2;
      positions[ix + 2] = (Math.random() - 0.5) * 4; // slight depth spread
      const iv = i * 2;
      velocities[iv + 0] = (Math.random() - 0.5) * 0.2;
      velocities[iv + 1] = (Math.random() - 0.5) * 0.2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x77bbff,
      size: 1.8,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.5, 0.85);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, points, positions, velocities };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== W || eng.canvas.height !== H) {
    eng.renderer.setSize(W, H, false);
    eng.camera.aspect = W / H; eng.camera.updateProjectionMatrix();
  }

  // Update particles with audio-reactive motion
  const energy = features.energy; const bass = features.bassLevel; const pulse = features.beatPulse;
  const bpmScale = THREE.MathUtils.clamp(features.bpm / 120, 0.5, 2.0);
  const speed = 0.25 + energy * 1.4 + bass * 1.2;
  const swirl = 0.6 + energy * 1.5;
  const area = Math.min(W, H) * 0.52;

  const posAttr = eng.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < eng.positions.length / 3; i++) {
    const ix = i * 3; const iv = i * 2;
    const x = eng.positions[ix + 0];
    const y = eng.positions[ix + 1];
    const field = curl2(x * 0.6, y * 0.6, nowSec * 0.8);
    // Velocity update: curl field + audio pulses
    eng.velocities[iv + 0] += (field.x * swirl + Math.sin(nowSec * 2 + i * 0.001) * pulse * 0.8) * 0.02 * bpmScale;
    eng.velocities[iv + 1] += (field.y * swirl + Math.cos(nowSec * 2 + i * 0.001) * pulse * 0.8) * 0.02 * bpmScale;
    // Damping to avoid runaway
    eng.velocities[iv + 0] *= 0.99; eng.velocities[iv + 1] *= 0.99;
    eng.positions[ix + 0] += eng.velocities[iv + 0] * speed;
    eng.positions[ix + 1] += eng.velocities[iv + 1] * speed;
    // Wrap within area
    if (eng.positions[ix + 0] < -area) eng.positions[ix + 0] = area;
    if (eng.positions[ix + 0] > area) eng.positions[ix + 0] = -area;
    if (eng.positions[ix + 1] < -area) eng.positions[ix + 1] = area;
    if (eng.positions[ix + 1] > area) eng.positions[ix + 1] = -area;
    // Write back
    posAttr.array[ix + 0] = eng.positions[ix + 0];
    posAttr.array[ix + 1] = eng.positions[ix + 1];
    posAttr.array[ix + 2] = eng.positions[ix + 2];
  }
  posAttr.needsUpdate = true;

  const mat = eng.points.material as THREE.PointsMaterial;
  mat.opacity = 0.55 + pulse * 0.35 + energy * 0.25;
  // hue shift subtly with energy
  const hue = 0.56 + energy * 0.2 + bass * 0.1;
  const color = new THREE.Color(); color.setHSL(hue, 0.75, 0.55);
  mat.color = color;

  eng.composer.render();
  return eng.canvas;
}
