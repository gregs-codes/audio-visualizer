import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// Engine state for the base high-graphics visualizer (particles + ring with bloom)
type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  composer: EffectComposer;
  points: THREE.Points;
  ring: THREE.LineSegments;
  particleCount: number;
  lastTime: number;
};

// Cache engines per `key` so preview/export canvases have isolated instances
const engines = new Map<string, Engine>();

/**
 * Render the base high-graphics visualizer to an offscreen canvas.
 * - Initializes a Three.js scene once per `key` and updates per call.
 * - Returns the transparent canvas for compositing into the 2D grid.
 */
export async function renderHighGfxWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
  opts?: { view?: 'top' | 'side'; cameraControls?: boolean; controlsTarget?: HTMLElement },
): Promise<HTMLCanvasElement> {
  let eng = engines.get(key);
  let controls: OrbitControls | undefined = undefined;
  if (!eng) {
    // First-time setup: renderer (alpha), scene/camera, particles and ring
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 25, 115);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(amb);

    // Particles
    const particleCount = 700;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 40; // base ring radius
      positions[i * 3 + 0] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a) * r;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      
      const c = new THREE.Color().setHSL(Math.random(), 0.6, 0.5);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 2.0, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Ring segments
    const ringSegments = 256;
    const ringGeom = new THREE.BufferGeometry();
    const rpos = new Float32Array(ringSegments * 6);
    for (let i = 0; i < ringSegments; i++) {
      const a1 = (i / ringSegments) * Math.PI * 2;
      const a2 = ((i + 1) / ringSegments) * Math.PI * 2;
      const r = 58;
      rpos[i * 6 + 0] = Math.cos(a1) * r; rpos[i * 6 + 1] = Math.sin(a1) * r; rpos[i * 6 + 2] = 0;
      rpos[i * 6 + 3] = Math.cos(a2) * r; rpos[i * 6 + 4] = Math.sin(a2) * r; rpos[i * 6 + 5] = 0;
    }
    ringGeom.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    const ringMat = new THREE.LineBasicMaterial({ color: 0x7aa2ff, transparent: true, opacity: 0.6 });
    const ring = new THREE.LineSegments(ringGeom, ringMat);
    scene.add(ring);

    const clock = new THREE.Clock();
    // Post-processing with UnrealBloomPass
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.9, 0.4, 0.85);
    composer.addPass(bloom);

    // Optionally add OrbitControls for camera interaction
    if (opts?.cameraControls) {
      controls = new OrbitControls(camera, opts.controlsTarget || canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.minDistance = 30;
      controls.maxDistance = 300;
      controls.target.set(0, 0, 0);
      controls.update();
    }
    eng = { canvas, renderer, scene, camera, clock, composer, points, ring, particleCount, lastTime: nowSec };
    engines.set(key, eng);
  }

  // Resize if needed (maintain correct aspect)
  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.renderer.setSize(width, height, false);
    eng.camera.aspect = width / height; eng.camera.updateProjectionMatrix();
    if (controls) controls.update();
  }

  // Camera view: top = horizontal with slight downward tilt (~12°); side = from the right
  const view = opts?.view ?? 'top';
  if (!opts?.cameraControls) {
    if (view === 'top') {
      // Slightly above and back, looking down at a shallow angle
      eng.camera.position.set(0, 8, 100);
    } else {
      // More horizontal, offset to the side
      eng.camera.position.set(60, 6, 60);
    }
    eng.camera.lookAt(new THREE.Vector3(0, 0, 0));
  }

  // Update visuals from audio features
  const dt = Math.max(0.001, eng.clock.getDelta());
  const pulse = features.beatPulse;
  const bass = features.bassLevel;
  const energy = features.energy;
  const bpmScale = THREE.MathUtils.clamp(features.bpm / 120, 0.5, 2.0);

  // Animate particles: radial motion modulated by bass and beat; subtle swirl
  const pos = eng.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < eng.particleCount; i++) {
    const x = pos.getX(i); const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const a = Math.atan2(y, x) + dt * (0.3 + energy * 0.8) * bpmScale;
    const targetR = r + (bass - 0.5) * 6 + (pulse * 3);
    const nr = THREE.MathUtils.clamp(targetR, 32, 86);
    pos.setXYZ(i, Math.cos(a) * nr, Math.sin(a) * nr, pos.getZ(i) * 0.98);
  }
  pos.needsUpdate = true;

  // Ring pulse and color shift based on energy/beat
  const rpos = eng.ring.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < rpos.count; i += 2) {
    const x1 = rpos.getX(i), y1 = rpos.getY(i);
    const x2 = rpos.getX(i + 1), y2 = rpos.getY(i + 1);
    const a1 = Math.atan2(y1, x1);
    const a2 = Math.atan2(y2, x2);
    const baseR = 58 + Math.sin(a1 * 6 + nowSec * 1.6) * 2;
    const bump = bass * 4 + pulse * 2;
    const r1 = baseR + bump;
    const r2 = baseR + bump;
    rpos.setXYZ(i, Math.cos(a1) * r1, Math.sin(a1) * r1, 0);
    rpos.setXYZ(i + 1, Math.cos(a2) * r2, Math.sin(a2) * r2, 0);
  }
  rpos.needsUpdate = true;
  (eng.ring.material as THREE.LineBasicMaterial).color.setHSL(0.6 + energy * 0.2, 0.7, 0.6 + pulse * 0.2);
  (eng.points.material as THREE.PointsMaterial).size = 1.6 + energy * 1.2 + pulse * 0.8;

  // Render frame with bloom; canvas has alpha so it composites under overlays
  if (controls) controls.update();
  eng.composer.render();
  return eng.canvas;
}
