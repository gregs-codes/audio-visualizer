import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// Engine state for Tunnel variant (torus rings tunnel + bloom)
type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  rings: THREE.Mesh[];
};

// Cache per-key engines
const engines = new Map<string, Engine>();

/**
 * Render Tunnel variant: concentric torus rings forming an audio-reactive tunnel.
 */
export async function renderHighGfxTunnelWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
): Promise<HTMLCanvasElement> {
  let eng = engines.get(key);
  if (!eng) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 120);

    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(amb);

    // Concentric rings moving down Z to form tunnel
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 24; i++) {
      const geom = new THREE.TorusGeometry(40 + i * 2, 1.2, 16, 64);
      const mat = new THREE.MeshBasicMaterial({ color: 0x7aa2ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.z = -i * 20;
      rings.push(mesh);
      scene.add(mesh);
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 1.0, 0.5, 0.85);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, rings };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.renderer.setSize(width, height, false);
    eng.camera.aspect = width / height; eng.camera.updateProjectionMatrix();
  }

  // Animate tunnel speed and brightness from audio
  const energy = features.energy; const bass = features.bassLevel; const pulse = features.beatPulse; const bpmScale = THREE.MathUtils.clamp(features.bpm / 120, 0.5, 2.0);
  eng.rings.forEach((ring, i) => {
    ring.position.z += (0.8 + energy * 3.0 + bass * 2.0) * bpmScale;
    if (ring.position.z > 80) ring.position.z = -480;
    ring.rotation.y += 0.003 + energy * 0.01;
    // Subtle time-based wobble to add depth and fix unused params
    ring.rotation.x = Math.sin(nowSec * 0.5 + i * 0.3) * (0.1 + energy * 0.2);
    const mat = ring.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.25 + pulse * 0.4 + energy * 0.2;
    // Slight hue variation per ring index for richness
    mat.color.setHSL(0.58 + energy * 0.3 + i * 0.005, 0.7, 0.5 + pulse * 0.2);
  });

  eng.composer.render();
  return eng.canvas;
}
