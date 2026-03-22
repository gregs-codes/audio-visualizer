import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

type ParticleGroup = {
  points: THREE.Points;
  basePositions: Float32Array;
  phases: Float32Array;
};

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  groups: ParticleGroup[];
  bgMats: THREE.MeshBasicMaterial[];
};

const engines = new Map<string, Engine>();

function createSpriteTexture(): THREE.Texture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d')!;
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0,   'rgba(255,255,255,1)');
  grd.addColorStop(0.35,'rgba(255,255,255,0.5)');
  grd.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

function makeGroup(count: number, spread: [number,number,number], hsl: [number,number,number], sprite: THREE.Texture): ParticleGroup {
  const positions = new Float32Array(count * 3);
  const phases    = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i*3]   = (Math.random() - 0.5) * spread[0];
    positions[i*3+1] = (Math.random() - 0.5) * spread[1];
    positions[i*3+2] = (Math.random() - 0.5) * spread[2];
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));

  const color = new THREE.Color().setHSL(...hsl);
  const mat = new THREE.PointsMaterial({
    size: 2.2,
    map: sprite,
    color,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });

  return { points: new THREE.Points(geom, mat), basePositions: positions, phases };
}

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
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0, 120);

    const sprite = createSpriteTexture();

    // Background glow planes — large soft planes behind the particles
    // that pulse brighter on beat
    const bgColors  = [0x1a0a3a, 0x0a1a3a, 0x2a0a2a];
    const bgMats: THREE.MeshBasicMaterial[] = [];
    for (let b = 0; b < bgColors.length; b++) {
      const bgMat = new THREE.MeshBasicMaterial({
        color: bgColors[b],
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), bgMat);
      bgMesh.position.z = -60 - b * 10;
      bgMesh.position.x = (b - 1) * 40;
      scene.add(bgMesh);
      bgMats.push(bgMat);
    }

    // Three particle layers: deep blue core, purple mid, soft pink outer
    const groups: ParticleGroup[] = [
      makeGroup(900,  [160, 120, 80],  [0.62, 0.9, 0.6], sprite),
      makeGroup(700,  [200, 150, 100], [0.75, 0.85, 0.55], sprite),
      makeGroup(500,  [240, 180, 120], [0.85, 0.8, 0.5], sprite),
    ];
    for (const g of groups) scene.add(g.points);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 1.2, 0.5, 0.7);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, groups, bgMats };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.renderer.setSize(width, height, false);
    eng.composer.setSize(Math.floor(width), Math.floor(height));
    eng.camera.aspect = width / height;
    eng.camera.updateProjectionMatrix();
  }

  const { energy, beatPulse, bassLevel } = features;
  const drift = 0.06 + energy * 0.14;

  // Background glow: pulses on beat and with bass
  eng.bgMats.forEach((mat, bi) => {
    const target = beatPulse * (0.5 + bi * 0.15) + bassLevel * 0.25 + energy * 0.1;
    mat.opacity = mat.opacity * 0.75 + target * 0.25;
  });

  eng.groups.forEach((g, gi) => {
    const posAttr = g.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const count = arr.length / 3;
    const layerSpeed = drift * (1 + gi * 0.3);

    for (let i = 0; i < count; i++) {
      const ph = g.phases[i];
      arr[i*3]   = g.basePositions[i*3]   + Math.sin(nowSec * layerSpeed + ph) * (4 + energy * 6);
      arr[i*3+1] = g.basePositions[i*3+1] + Math.cos(nowSec * layerSpeed * 0.7 + ph) * (3 + energy * 5);
      arr[i*3+2] = g.basePositions[i*3+2] + Math.sin(nowSec * layerSpeed * 0.5 + ph * 2) * 2;
    }
    posAttr.needsUpdate = true;

    const mat = g.points.material as THREE.PointsMaterial;
    mat.opacity = 0.5 + beatPulse * 0.4 + bassLevel * 0.2;
    mat.size = 4.5 + energy * 2.5 + beatPulse * 2.0;

    // Slow rotation per group
    g.points.rotation.z += 0.0003 * (gi % 2 === 0 ? 1 : -1);
  });

  eng.composer.render();
  return eng.canvas;
}
