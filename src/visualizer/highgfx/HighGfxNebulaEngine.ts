import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// Engine state for Nebula variant (additive clouds + bloom)
type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  clouds: THREE.Mesh[];
};

// Cache per-key engines (preview/export isolation)
const engines = new Map<string, Engine>();

/**
 * Render Nebula variant: alpha clouds reacting to beat/energy.
 */
export async function renderHighGfxNebulaWithFeatures(
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
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0, 120);

    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(amb);

    // Nebula clouds (soft planes with additive colors)
    const clouds: THREE.Mesh[] = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0x7aa2ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 12; i++) {
      const geom = new THREE.PlaneGeometry(120, 80);
      const mesh = new THREE.Mesh(geom, cloudMat.clone());
      mesh.position.set((Math.random() - 0.5) * 160, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 60);
      mesh.rotation.z = Math.random() * Math.PI;
      (mesh.material as THREE.MeshBasicMaterial).color.setHSL(0.55 + Math.random() * 0.2, 0.6, 0.5);
      scene.add(mesh);
      clouds.push(mesh);
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 1.0, 0.6, 0.85);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, clouds };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.renderer.setSize(width, height, false);
    eng.camera.aspect = width / height; eng.camera.updateProjectionMatrix();
  }

  // Animate clouds with beat and energy
  const pulse = features.beatPulse; const energy = features.energy; const bass = features.bassLevel;
  eng.clouds.forEach((m, i) => {
    const t = nowSec * (0.08 + energy * 0.2) + i * 0.37;
    m.position.x += Math.sin(t) * 0.2;
    m.position.y += Math.cos(t) * 0.18;
    m.rotation.z += 0.001 + energy * 0.004;
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.18 + pulse * 0.3 + bass * 0.2;
  });

  eng.composer.render();
  return eng.canvas;
}
