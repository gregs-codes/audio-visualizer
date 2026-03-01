import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/* Rings Trails: procedural arc segments forming concentric rotating rings, neon additive glow. */

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  rings: THREE.Group[];
};

const engines = new Map<string, Engine>();

function makeArcSegment(innerR: number, outerR: number, start: number, end: number, segments = 24): THREE.Mesh {
  const geom = new THREE.BufferGeometry();
  const verts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const t0 = start + (i / segments) * (end - start);
    const t1 = start + ((i + 1) / segments) * (end - start);
    const x0i = Math.cos(t0) * innerR, y0i = Math.sin(t0) * innerR;
    const x0o = Math.cos(t0) * outerR, y0o = Math.sin(t0) * outerR;
    const x1i = Math.cos(t1) * innerR, y1i = Math.sin(t1) * innerR;
    const x1o = Math.cos(t1) * outerR, y1o = Math.sin(t1) * outerR;
    // two triangles per segment quad
    verts.push(x0i, y0i, 0,  x0o, y0o, 0,  x1o, y1o, 0);
    verts.push(x0i, y0i, 0,  x1o, y1o, 0,  x1i, y1i, 0);
  }
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending });
  return new THREE.Mesh(geom, mat);
}

function neonColorPalette(): THREE.Color[] {
  return [
    new THREE.Color('#00ffa2'), // neon green
    new THREE.Color('#00baff'), // neon blue
    new THREE.Color('#ffee00'), // neon yellow
    new THREE.Color('#ff00b8'), // neon pink
  ];
}

export async function renderHighGfxRingsTrailsWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
  opts?: { view?: 'top'|'side'; mouse?: { x: number; y: number } }
): Promise<HTMLCanvasElement> {
  let eng = engines.get(key);
  const W = Math.max(1, Math.floor(width));
  const H = Math.max(1, Math.floor(height));
  if (!eng) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene(); scene.background = null; scene.fog = undefined;
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 1.0, 8);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.6, 0.85); composer.addPass(bloom);
    // Build rings
    const palette = neonColorPalette();
    const rings: THREE.Group[] = [];
    const ringCount = 14;
    for (let i = 0; i < ringCount; i++) {
      const g = new THREE.Group();
      const r = 0.6 + i * 0.18; // radii
      const thickness = 0.06 + (i % 3) * 0.01;
      const segCount = 10 + (i % 5);
      const gap = 0.25; // leave breaks for partial arcs
      const color = palette[i % palette.length];
      for (let s = 0; s < segCount; s++) {
        const span = (Math.PI * 2 - gap) / segCount;
        const start = -Math.PI + s * span;
        const end = start + span * 0.9; // leave small gaps
        const mesh = makeArcSegment(r - thickness, r + thickness, start, end, 24);
        (mesh.material as THREE.MeshBasicMaterial).color = color.clone();
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
        g.add(mesh);
      }
      scene.add(g); rings.push(g);
    }
    eng = { canvas, renderer, scene, camera, composer, rings };
    engines.set(key, eng);
  }
  if (eng.canvas.width !== W || eng.canvas.height !== H) { eng.renderer.setSize(W, H, false); eng.camera.aspect = W / H; eng.camera.updateProjectionMatrix(); }
  // View tilt
  const view = opts?.view ?? 'top';
  if (view === 'top') {
    eng.camera.position.set(0, 1.0, 8);
    eng.camera.fov = 55;
  } else {
    eng.camera.position.set(4, 1, 6);
    eng.camera.fov = 55;
  }
  eng.camera.lookAt(new THREE.Vector3(0, 0, 0));
  eng.camera.updateProjectionMatrix();
  // Mouse parallax (subtle)
  const mx = (opts?.mouse?.x ?? 0.5) - 0.5;
  const my = (opts?.mouse?.y ?? 0.5) - 0.5;
  eng.camera.position.x += mx * 0.6;
  eng.camera.position.y += my * 0.4;
  // Animate rings (slow base, gated by beat)
  const palette = neonColorPalette();
  const energy = THREE.MathUtils.clamp(features.energy, 0, 1);
  const bass = THREE.MathUtils.clamp(features.bassLevel, 0, 1);
  const beat = THREE.MathUtils.clamp(features.beatPulse, 0, 1);
  eng.rings.forEach((g, i) => {
    const dir = (i % 2 === 0) ? 1 : -1;
    const base = 0.06 + (i * 0.008);
    const speed = base * (0.35 + 0.65 * beat);
    g.rotation.z = nowSec * speed * dir + (i * 0.12);
    // pulse color subtly over time
    g.children.forEach((m, j) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const base = palette[(i + j) % palette.length];
      const pulse = 0.85 + 0.12 * (0.3 + 0.7 * beat) * Math.sin(nowSec * 0.5 + i * 0.35 + j * 0.18);
      mat.color.copy(base.clone().multiplyScalar(pulse));
      mat.opacity = 0.82 + 0.10 * (0.3 + 0.7 * beat) * Math.sin(nowSec * 0.7 + i * 0.28);
    });
  });
  eng.composer.render(); return eng.canvas;
}
