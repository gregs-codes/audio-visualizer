import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/**
 * HG: Dot Matrix 3D Equalizer
 *
 * A perspective 3D grid of glowing spheres arranged as a dot-matrix equalizer.
 * Columns = frequency bands, rows = amplitude levels (bottom-lit to top).
 * Active dots glow neon; inactive dots are dark. Bloom post-processing.
 */

const COLS = 48;   // frequency columns
const ROWS = 20;   // dot rows (amplitude levels per column)
const DOT_SPACING_X = 2.8;
const DOT_SPACING_Y = 2.2;
const DOT_R = 0.55;

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  mesh: THREE.InstancedMesh;
  dummy: THREE.Object3D;
  prevAmp: Float32Array;
  time: number;
};

const engines = new Map<string, Engine>();

export async function renderHighGfxDotMatrix3DWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  _nowSec: number,
): Promise<HTMLCanvasElement> {
  const W = Math.max(1, Math.floor(width));
  const H = Math.max(1, Math.floor(height));

  let eng = engines.get(key);
  if (!eng) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.background = null;

    // Camera: perspective from above-and-front, looking at grid center
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
    const gridW = (COLS - 1) * DOT_SPACING_X;
    const gridH = (ROWS - 1) * DOT_SPACING_Y;
    camera.position.set(gridW / 2, gridH * 1.2, gridH * 1.8);
    camera.lookAt(new THREE.Vector3(gridW / 2, gridH * 0.25, 0));

    // Ambient + directional lights for subtle shading
    scene.add(new THREE.AmbientLight(0x223355, 2.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(gridW / 2, gridH * 2, gridH);
    scene.add(dir);

    // InstancedMesh: COLS * ROWS sphere dots
    const totalDots = COLS * ROWS;
    const geo = new THREE.SphereGeometry(DOT_R, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.25,
      metalness: 0.55,
      emissiveIntensity: 1.0,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, totalDots);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(totalDots * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    // Set initial positions
    const d = new THREE.Object3D();
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const idx = c * ROWS + r;
        d.position.set(c * DOT_SPACING_X, r * DOT_SPACING_Y, 0);
        d.updateMatrix();
        mesh.setMatrixAt(idx, d.matrix);
        // Start all dots dim
        mesh.setColorAt(idx, new THREE.Color(0.04, 0.04, 0.06));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    // Subtle floor grid
    const gridHelper = new THREE.GridHelper(
      Math.max(gridW, gridH) * 1.4,
      Math.round(COLS / 2),
      0x112244,
      0x0d1a2e,
    );
    gridHelper.position.set(gridW / 2, -DOT_R * 1.5, 0);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Bloom post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 1.2, 0.5, 0.72);
    composer.addPass(bloom);

    eng = {
      canvas,
      renderer,
      scene,
      camera,
      composer,
      mesh,
      dummy: d,
      prevAmp: new Float32Array(COLS),
      time: 0,
    };
    engines.set(key, eng);
  }

  // Resize if needed
  if (eng.canvas.width !== W || eng.canvas.height !== H) {
    eng.renderer.setSize(W, H, false);
    eng.camera.aspect = W / H;
    eng.camera.updateProjectionMatrix();
  }

  // Smooth amplitude per column from raw frequency bins
  const rawBins: Uint8Array = features.freqData ?? new Uint8Array(COLS);
  const binCount = rawBins.length || COLS;

  const smoothing = 0.72;
  const activeColor = new THREE.Color();
  const dimColor = new THREE.Color(0.035, 0.04, 0.055);

  for (let c = 0; c < COLS; c++) {
    // Map column to frequency bin
    const binIdx = Math.floor((c / COLS) * binCount);
    const rawAmp = ((rawBins[binIdx] ?? 0) / 255);
    // Smooth
    const amp = smoothing * eng.prevAmp[c] + (1 - smoothing) * rawAmp;
    eng.prevAmp[c] = amp;

    const activeDots = Math.round(amp * ROWS);

    for (let r = 0; r < ROWS; r++) {
      const idx = c * ROWS + r;
      const isActive = r < activeDots;

      // Hue: bass = red/orange, mid = cyan, treble = violet
      const hue = 0.0 + (c / COLS) * 0.72;
      const brightness = isActive ? 0.68 + amp * 0.32 : 0.0;

      if (isActive) {
        activeColor.setHSL(hue, 1.0, brightness * 0.55);
        // Top dot is brightest
        if (r === activeDots - 1) {
          activeColor.setHSL(hue, 1.0, 0.85);
        }
        eng.mesh.setColorAt(idx, activeColor);
      } else {
        eng.mesh.setColorAt(idx, dimColor);
      }
    }
  }

  if (eng.mesh.instanceColor) {
    eng.mesh.instanceColor.needsUpdate = true;
  }

  // Gentle camera sway
  eng.time += 1 / 60;
  const gridW = (COLS - 1) * DOT_SPACING_X;
  const gridH2 = (ROWS - 1) * DOT_SPACING_Y;
  const sway = Math.sin(eng.time * 0.18) * 8;
  eng.camera.position.set(
    gridW / 2 + sway,
    gridH2 * 1.2,
    gridH2 * 1.8,
  );
  eng.camera.lookAt(new THREE.Vector3(gridW / 2, gridH2 * 0.25, 0));

  eng.composer.render();

  return eng.canvas;
}
