import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type BgCharacterCamera = {
  mode?: 'static' | 'pan' | 'rotate';
  distance?: number;
  elevation?: number;
  tilt?: number;
  speed?: number;
  lookHeight?: number;
  fov?: number;
  animIndex?: number;    // -1 = auto-cycle on peaks, 0+ = lock to that clip
};

export type BgCharacterSettings = BgCharacterCamera & {
  url?: string;
  fileExt?: string;
  rotationY?: number;
  verticalShift?: number;
};

/** Returns clip names for an already-loaded engine (empty if not yet loaded). */
export function getBgCharacterClipNames(key: string): string[] {
  return engines.get(key)?.clips.map(c => c.name) ?? [];
}

// Normalize every loaded model to this height in Three.js units
const TARGET_HEIGHT = 160;

type Eng = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  mixer: THREE.AnimationMixer | null;
  clips: THREE.AnimationClip[];
  currentAction: THREE.AnimationAction | null;
  curClip: number;
  lastSwitch: number;
  modelHeight: number;   // actual scaled height in Three.js units
  groundOffset: number; // y-offset applied so model feet sit at groundOffset
  rootObj: THREE.Object3D | null;
  cacheKey: string;
};

const engines = new Map<string, Eng>();

async function loadModel(url: string, ext: string): Promise<{ obj: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  if (ext === 'glb' || ext === 'gltf') {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(url, gltf => resolve({ obj: gltf.scene, clips: gltf.animations }), undefined, reject);
    });
  }
  const loader = new FBXLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, fbx => resolve({ obj: fbx, clips: fbx.animations }), undefined, reject);
  });
}

async function initEngine(key: string, url: string, ext: string): Promise<Eng> {
  const cacheKey = `${url}|${ext}`;
  const existing = engines.get(key);
  if (existing && existing.cacheKey === cacheKey) return existing;

  if (existing) {
    existing.renderer.dispose();
    engines.delete(key);
  }

  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 20000);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(100, 200, 100);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0x8899ff, 0.5);
  fill.position.set(-100, 80, -80);
  scene.add(fill);

  const eng: Eng = {
    canvas, renderer, scene, camera,
    clock: new THREE.Clock(),
    mixer: null,
    clips: [],
    currentAction: null,
    curClip: 0,
    lastSwitch: 0,
    modelHeight: TARGET_HEIGHT,
    groundOffset: 0,
    rootObj: null,
    cacheKey,
  };
  engines.set(key, eng);

  if (url) {
    try {
      const { obj, clips } = await loadModel(url, ext);

      // Auto-scale: normalize to TARGET_HEIGHT regardless of model's original units
      const rawBox = new THREE.Box3().setFromObject(obj);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);
      // Use the tallest axis as height reference (handles Y-up and Z-up models)
      const rawH = Math.max(rawSize.y, rawSize.z, rawSize.x, 0.001);
      const scaleFactor = TARGET_HEIGHT / rawH;
      obj.scale.multiplyScalar(scaleFactor);

      // Re-center and ground after scaling
      const box = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3();
      box.getCenter(center);
      obj.position.x -= center.x;
      obj.position.z -= center.z;
      obj.position.y -= box.min.y;
      // Store grounding offset so renderBgCharacter can preserve it when applying verticalShift
      eng.groundOffset = obj.position.y;

      scene.add(obj);
      eng.rootObj = obj;
      eng.modelHeight = TARGET_HEIGHT;

      // Initial camera — will be overridden each frame by renderBgCharacter
      camera.position.set(0, TARGET_HEIGHT * 0.6, TARGET_HEIGHT * 1.8);
      camera.lookAt(new THREE.Vector3(0, TARGET_HEIGHT * 0.6, 0));
      camera.aspect = 16 / 9;
      camera.updateProjectionMatrix();

      if (clips && clips.length > 0) {
        eng.clips = clips;
        eng.mixer = new THREE.AnimationMixer(obj);
        const first = eng.mixer.clipAction(clips[0]);
        first.setLoop(THREE.LoopRepeat, Infinity);
        first.reset().play();
        eng.currentAction = first;
      }
    } catch (e) {
      console.warn('[BgCharacterEngine] Failed to load model:', url, e);
    }
  }

  return eng;
}

export async function renderBgCharacter(
  key: string,
  settings: BgCharacterSettings,
  width: number,
  height: number,
  energy: number,
  isPlaying: boolean,
  now: number,
): Promise<HTMLCanvasElement> {
  const url = settings.url ?? '';
  const ext = (settings.fileExt ?? 'fbx').toLowerCase();
  const eng = await initEngine(key, url, ext);

  const w = Math.floor(width);
  const h = Math.floor(height);
  if (eng.canvas.width !== w || eng.canvas.height !== h) {
    eng.canvas.width = w;
    eng.canvas.height = h;
    eng.renderer.setSize(w, h, false);
    eng.camera.aspect = w / h;
    eng.camera.updateProjectionMatrix();
  }

  const delta = eng.clock.getDelta();

  if (eng.mixer) {
    eng.mixer.timeScale = isPlaying ? (1 + energy * 0.12) : 0;
    eng.mixer.update(delta);

    const animIndex = settings.animIndex ?? -1;
    if (animIndex >= 0 && eng.clips.length > 0) {
      // Manual: lock to specified clip
      const idx = Math.min(animIndex, eng.clips.length - 1);
      if (eng.curClip !== idx) {
        eng.curClip = idx;
        const next = eng.mixer.clipAction(eng.clips[idx]);
        next.setLoop(THREE.LoopRepeat, Infinity);
        if (eng.currentAction) eng.currentAction.fadeOut(0.3);
        next.reset().fadeIn(0.3).play();
        eng.currentAction = next;
      }
    } else {
      // Auto-cycle on audio peaks
      if (isPlaying && energy > 0.65 && now - eng.lastSwitch > 3 && eng.clips.length > 1) {
        eng.lastSwitch = now;
        let next = eng.curClip;
        for (let t = 0; t < 4; t++) {
          const c = Math.floor(Math.random() * eng.clips.length);
          if (c !== eng.curClip) { next = c; break; }
        }
        eng.curClip = next;
        const nextAction = eng.mixer.clipAction(eng.clips[next]);
        nextAction.setLoop(THREE.LoopRepeat, Infinity);
        if (eng.currentAction) eng.currentAction.fadeOut(0.4);
        nextAction.reset().fadeIn(0.4).play();
        eng.currentAction = nextAction;
      }
    }
  }

  // Apply per-frame rotation and vertical shift to the root object
  if (eng.rootObj) {
    eng.rootObj.rotation.y = THREE.MathUtils.degToRad(settings.rotationY ?? 0);
    const vShift = (settings.verticalShift ?? 0) / 100 * eng.modelHeight;
    // Preserve groundOffset so feet stay at groundOffset (not float below ground)
    eng.rootObj.position.y = eng.groundOffset + vShift;
  }

  // Camera
  const H = eng.modelHeight;
  const lookFrac = Math.max(0, Math.min(1, (settings.lookHeight ?? 60) / 100));
  const lookY = H * lookFrac + (eng.rootObj?.position.y ?? 0);
  const baseRadius = H * 1.8;
  const distFactor = Math.max(0.1, (settings.distance ?? 100) / 100);
  const adjRadius = baseRadius * distFactor;
  const elev = Math.max(-0.5, Math.min(0.5, (settings.elevation ?? 0) / 100));
  const tiltDeg = Math.max(-30, Math.min(30, settings.tilt ?? 0));
  const speedFactor = Math.max(0, (settings.speed ?? 100) / 100);
  const mode = settings.mode ?? 'static';
  const fov = Math.max(10, Math.min(120, settings.fov ?? 45));
  if (eng.camera.fov !== fov) {
    eng.camera.fov = fov;
    eng.camera.updateProjectionMatrix();
  }

  const camY = lookY + H * elev;

  if (mode === 'rotate') {
    const ang = now * 0.105 * speedFactor;
    eng.camera.position.set(Math.sin(ang) * adjRadius, camY, Math.cos(ang) * adjRadius);
  } else if (mode === 'pan') {
    const x = Math.sin(now * 0.12 * speedFactor) * adjRadius * 0.25;
    eng.camera.position.set(x, camY, adjRadius);
  } else {
    eng.camera.position.set(0, camY, adjRadius);
  }

  const tiltOffset = Math.sin(THREE.MathUtils.degToRad(tiltDeg)) * H * 0.15;
  eng.camera.lookAt(new THREE.Vector3(0, lookY + tiltOffset, 0));

  eng.renderer.render(eng.scene, eng.camera);
  return eng.canvas;
}
