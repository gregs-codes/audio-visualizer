import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// Engine state for Nebula variant (star field + layered gas clouds + dust particles + bloom)
type CloudLayer = {
  mesh: THREE.Mesh;
  baseOpacity: number;
  driftSpeed: number;
  driftPhase: number;
  rotSpeed: number;
};

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  cloudLayers: CloudLayer[];
  dustPoints: THREE.Points;
  dustOrigin: Float32Array; // original dust positions for stable breathing
  starPoints: THREE.Points;
};

// Cache per-key engines (preview/export isolation)
const engines = new Map<string, Engine>();

/** Space-nebula color palette: deep purples, magentas, blues, teals, and warm cores */
function nebulaHSL(index: number): { h: number; s: number; l: number } {
  const palette = [
    { h: 0.72, s: 0.85, l: 0.45 }, // deep violet
    { h: 0.80, s: 0.90, l: 0.50 }, // vivid magenta
    { h: 0.62, s: 0.80, l: 0.50 }, // azure blue
    { h: 0.55, s: 0.75, l: 0.55 }, // teal-cyan
    { h: 0.85, s: 0.70, l: 0.45 }, // rose-pink
    { h: 0.65, s: 0.80, l: 0.48 }, // indigo
    { h: 0.92, s: 0.65, l: 0.55 }, // warm pink
    { h: 0.58, s: 0.90, l: 0.52 }, // sky blue
  ];
  return palette[index % palette.length];
}

/**
 * Render Nebula variant: a realistic-looking space nebula with layered gas clouds,
 * star field, dust particles and heavy bloom—all reacting to beat/energy.
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
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 2000);
    camera.position.set(0, 0, 130);

    // ── Star field ────────────────────────────────────────────────────────────
    const starCount = 2200;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // Distribute on a large sphere shell so stars always surround the view
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 300 + Math.random() * 400;
      starPos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
      // Slightly warm or cold tints for stars
      const warm = Math.random() > 0.5;
      const c = new THREE.Color();
      c.setHSL(warm ? 0.08 : 0.62, 0.3 + Math.random() * 0.4, 0.75 + Math.random() * 0.25);
      starCol[i * 3 + 0] = c.r;
      starCol[i * 3 + 1] = c.g;
      starCol[i * 3 + 2] = c.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.9, vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // ── Nebula gas cloud layers ───────────────────────────────────────────────
    // Use many overlapping elliptical planes at different scales/depths/rotations
    // to build up a volumetric-looking gas cloud.
    const cloudLayers: CloudLayer[] = [];
    const layerCount = 32;
    for (let i = 0; i < layerCount; i++) {
      const col = nebulaHSL(i);
      // Vary plane sizes: large outer shrouds, smaller dense inner ones
      const scale = 40 + Math.random() * 110;
      const aspect = 0.5 + Math.random() * 1.2; // non-square for organic look
      const geom = new THREE.PlaneGeometry(scale, scale * aspect);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      mat.color.setHSL(col.h, col.s, col.l);
      const baseOpacity = 0.04 + Math.random() * 0.10;
      mat.opacity = baseOpacity;

      const mesh = new THREE.Mesh(geom, mat);
      // Concentrate clouds towards the centre with gentle scatter
      mesh.position.set(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 50,
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      scene.add(mesh);
      cloudLayers.push({
        mesh,
        baseOpacity,
        driftSpeed: 0.004 + Math.random() * 0.010,
        driftPhase: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.0006,
      });
    }

    // ── Dust / particle nebula core ───────────────────────────────────────────
    const dustCount = 1800;
    const dustPos = new Float32Array(dustCount * 3);
    const dustCol = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      // Gaussian-ish cluster centred at origin
      const gx = (Math.random() + Math.random() + Math.random() - 1.5) * 55;
      const gy = (Math.random() + Math.random() + Math.random() - 1.5) * 40;
      const gz = (Math.random() + Math.random() + Math.random() - 1.5) * 35;
      dustPos[i * 3 + 0] = gx;
      dustPos[i * 3 + 1] = gy;
      dustPos[i * 3 + 2] = gz;
      const col = nebulaHSL(i % 8);
      const c = new THREE.Color();
      c.setHSL(col.h + (Math.random() - 0.5) * 0.08, col.s, col.l * (0.7 + Math.random() * 0.6));
      dustCol[i * 3 + 0] = c.r;
      dustCol[i * 3 + 1] = c.g;
      dustCol[i * 3 + 2] = c.b;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 1.4, vertexColors: true, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);
    // Snapshot of original positions used as reference for breathing animation
    const dustOrigin = new Float32Array(dustPos);

    // ── Post-processing ───────────────────────────────────────────────────────
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Higher bloom strength + wider radius for the soft ethereal glow
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 1.6, 1.0, 0.60);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, cloudLayers, dustPoints, dustOrigin, starPoints };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.renderer.setSize(width, height, false);
    eng.composer.setSize(Math.floor(width), Math.floor(height));
    eng.camera.aspect = width / height;
    eng.camera.updateProjectionMatrix();
  }

  const pulse = features.beatPulse;
  const energy = features.energy;
  const bass = features.bassLevel;

  // ── Animate cloud layers ──────────────────────────────────────────────────
  eng.cloudLayers.forEach((layer, i) => {
    const t = nowSec * layer.driftSpeed + layer.driftPhase;
    // Very gentle orbital drift — clouds stay roughly centred
    layer.mesh.position.x += Math.sin(t + i * 0.9) * (0.03 + energy * 0.06);
    layer.mesh.position.y += Math.cos(t + i * 0.7) * (0.025 + energy * 0.05);
    layer.mesh.rotation.z += layer.rotSpeed * (1 + energy * 0.8);
    // Slowly re-centre so clouds don't drift off-screen
    layer.mesh.position.x *= 0.9995;
    layer.mesh.position.y *= 0.9995;
    // Opacity swells on beat
    const mat = layer.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = layer.baseOpacity * (0.8 + 0.5 * pulse + 0.4 * bass);
  });

  // ── Animate dust particles ────────────────────────────────────────────────
  // Apply breathing scale relative to original positions to prevent unbounded drift.
  const dustGeoAttr = eng.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
  const dustCount = dustGeoAttr.count;
  const breathe = 1.0 + bass * 0.015 - energy * 0.008;
  for (let i = 0; i < dustCount; i++) {
    dustGeoAttr.setXYZ(
      i,
      eng.dustOrigin[i * 3 + 0] * breathe,
      eng.dustOrigin[i * 3 + 1] * breathe,
      eng.dustOrigin[i * 3 + 2] * breathe,
    );
  }
  dustGeoAttr.needsUpdate = true;
  (eng.dustPoints.material as THREE.PointsMaterial).size = 1.2 + energy * 1.0 + pulse * 0.6;
  (eng.dustPoints.material as THREE.PointsMaterial).opacity = 0.45 + pulse * 0.35 + bass * 0.20;

  // ── Star field twinkle ────────────────────────────────────────────────────
  (eng.starPoints.material as THREE.PointsMaterial).opacity = 0.70 + pulse * 0.20;

  // ── Very slow camera drift for parallax depth ─────────────────────────────
  // X drifts with ~251 s period (2π/0.025), Y with ~349 s (2π/0.018).
  const cx = Math.sin(nowSec * 0.025) * 6;
  const cy = Math.cos(nowSec * 0.018) * 4;
  eng.camera.position.set(cx, cy, 130);
  eng.camera.lookAt(new THREE.Vector3(0, 0, 0));

  eng.composer.render();
  return eng.canvas;
}
