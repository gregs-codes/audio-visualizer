import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// Engine state for Spiral Wave variant
type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  points: THREE.Points;
};

// Cache per-key engines
const engines = new Map<string, Engine>();

// Pre-generate spiral point geometry; colored via vertex colors
function generateSpiralGeometry(count: number, radius: number, spacing: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  let r = 4;
  for (let i = 0; i < count; i++) {
    const t = i * spacing;
    r += Math.sin(i * 0.03) * 0.35;
    const x = Math.cos(t) * (radius + r);
    const y = Math.sin(t) * (radius + r);
    const z = Math.sin(i * 0.01) * 2;
    const ix = i * 3;
    positions[ix + 0] = x;
    positions[ix + 1] = y;
    positions[ix + 2] = z;
    color.setHSL(0.58 + (i / count) * 0.2, 0.7, 0.5);
    colors[ix + 0] = color.r;
    colors[ix + 1] = color.g;
    colors[ix + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Render Spiral Wave variant: rotating/breathing spiral point cloud with bloom.
 */
export async function renderHighGfxSpiralWithFeatures(
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
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.set(0, 0, 120);

    const count = 9000;
    const radius = Math.min(W, H) * 0.12;
    const spacing = 0.025;
    const geometry = generateSpiralGeometry(count, radius, spacing);

    const material = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 1.0, 0.5, 0.85);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, points };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== W || eng.canvas.height !== H) {
    eng.renderer.setSize(W, H, false);
    eng.camera.aspect = W / H; eng.camera.updateProjectionMatrix();
  }

  // Animate spiral with audio features
  const energy = features.energy; const bass = features.bassLevel; const pulse = features.beatPulse;
  const bpmScale = THREE.MathUtils.clamp(features.bpm / 120, 0.5, 2.0);
  const rotSpeed = (0.002 + energy * 0.01 + bass * 0.008) * bpmScale;
  eng.points.rotation.z += rotSpeed;
  eng.points.rotation.x = Math.sin(nowSec * 0.4) * 0.06;

  const mat = eng.points.material as THREE.PointsMaterial;
  mat.opacity = 0.6 + pulse * 0.3 + energy * 0.2;

  // Slight breathing scale
  const s = 1 + Math.sin(nowSec * 0.9) * (0.03 + energy * 0.05);
  eng.points.scale.set(s, s, s);

  // Gentle hue shift via per-vertex recolor (skip heavy updates; tint using fog color)
  const tint = new THREE.Color(); tint.setHSL(0.58 + energy * 0.25, 0.7, 0.5 + pulse * 0.15);
  eng.scene.fog = new THREE.FogExp2(tint.getHex(), 0.002);

  eng.composer.render();
  return eng.canvas;
}
