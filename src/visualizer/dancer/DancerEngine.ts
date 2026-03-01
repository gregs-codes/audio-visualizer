import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// Runtime configuration for dancer rendering and effects
export type DancerSources = {
  characterUrl?: string; // e.g., '/character/hero.fbx'
  animationUrls?: string[]; // e.g., ['/dance/d1.fbx', '/dance/d2.fbx']
  cameraMode?: 'static' | 'pan' | 'rotate';
  cameraElevationPct?: number; // -0.2..0.2 relative to baseline
  cameraTiltDeg?: number; // -15..15 degrees tilt up/down via target offset
  cameraSpeed?: number; // 0..200, percentage of default speed (default 100)
  cameraDistance?: number; // 0..200, percentage of default orbit radius (default 100)
  colorFlash?: { enabled?: boolean; color?: string; colors?: string[]; intensity?: number; mode?: 'flash'|'strobe'|'spot'; rays?: boolean };
  discoBall?: { enabled?: boolean };
};

// Engine state for dancer preview/overlay (isolated per key)
type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  mixer?: THREE.AnimationMixer;
  idleAction?: THREE.AnimationAction;
  currentAction?: THREE.AnimationAction;
  clips: THREE.AnimationClip[];
  lastSwitch: number;
  curClip: number;
  ready: boolean;
  sources: DancerSources;
  character?: THREE.Object3D;
  targetCenter: THREE.Vector3;
  spotLights?: THREE.SpotLight[];
  rayCones?: THREE.Mesh[];
  discoBall?: THREE.Object3D;
  discoLights?: THREE.PointLight[];
};

// Cache engines per canvas instance key (preview/export isolation)
const engines = new Map<string, Engine>();

async function loadFBX(url: string): Promise<THREE.Object3D> {
  const loader = new FBXLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (obj: THREE.Object3D) => resolve(obj), undefined, (e: unknown) => reject(e));
  });
}

/**
 * Initialize (or reuse) a dancer engine instance by key.
 * - Loads character FBX and animation clips.
 * - Sets up lights, camera, and guarantees an idle action to avoid T-pose.
 */
async function initEngine(key: string, sources: DancerSources): Promise<Engine> {
  const engExisting = engines.get(key);
  if (engExisting) return engExisting;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true , preserveDrawingBuffer: true});
  // Reduce GPU memory on retina displays; prefer logical pixels
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16/9, 0.1, 1000);
  camera.position.set(0, 140, 260);
  const clock = new THREE.Clock();
  // lights
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(120, 200, 120);
  scene.add(dir);
  // Aim camera toward center
  camera.lookAt(new THREE.Vector3(0, 120, 0));
  // ground plane subtle
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const engine: Engine = {
    canvas, renderer, scene, camera, clock,
    mixer: undefined,
    clips: [],
    lastSwitch: 0,
    curClip: 0,
    ready: false,
    sources,
    targetCenter: new THREE.Vector3(0, 100, 0),
    spotLights: undefined,
    rayCones: undefined,
    discoBall: undefined,
    discoLights: undefined,
  };
  engines.set(key, engine);

  // Load character
  try {
    if (sources.characterUrl) {
      const charFBX = await loadFBX(sources.characterUrl);
      charFBX.scale.setScalar(0.5);
      charFBX.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
  if ((mesh as { isMesh?: boolean }).isMesh) { mesh.castShadow = true; (mesh as unknown as { receiveShadow?: boolean }).receiveShadow = true; }
      });
      // Center and ground the character using its bounding box
      const box = new THREE.Box3().setFromObject(charFBX);
      const size = new THREE.Vector3(); box.getSize(size);
      const min = box.min.clone();
      // Raise model so feet touch ground (y=0), and center X/Z around origin
      charFBX.position.y += -min.y;
      charFBX.position.x += -((box.min.x + box.max.x) / 2);
      charFBX.position.z += -((box.min.z + box.max.z) / 2);
      // Hide character until an animation is actually playing to avoid T-pose flashes
      charFBX.visible = false;
      scene.add(charFBX);
      engine.character = charFBX;
      engine.mixer = new THREE.AnimationMixer(charFBX);
      // Reframe camera based on character height to keep it centered nicely
      const h = Math.max(120, size.y);
      engine.camera.position.set(0, h * 0.6, h * 1.8);
      engine.targetCenter.set(0, h * 0.55, 0);
      engine.camera.lookAt(engine.targetCenter);
    }
  } catch (e) {
    console.warn('Failed to load character FBX', e);
  }

  // Load animations and start idle/groove base so model is always animating
  if (engine.mixer && sources.animationUrls && sources.animationUrls.length) {
    for (const url of sources.animationUrls) {
      try {
        const animFBX = await loadFBX(url);
        if (animFBX.animations && animFBX.animations.length) {
          engine.clips.push(...animFBX.animations);
        }
      } catch (e) {
        console.warn('Failed to load animation FBX', url, e);
      }
    }
    if (engine.clips.length > 0) {
      // Always keep an idle/groove base animation running at low weight
      const idleClip = engine.clips[0];
      const idle = engine.mixer.clipAction(idleClip);
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.clampWhenFinished = false;
      idle.enabled = true;
      idle.setEffectiveWeight(0.6); // visible base groove
      idle.reset().play();
      engine.idleAction = idle;
      engine.currentAction = undefined; // no active overriding clip initially
      // Reveal character once idle is actively playing
      if (engine.character) engine.character.visible = true;
    }
  }

  engine.ready = true;
  // If no character loaded, add a visible placeholder so users see something
  if (!engine.mixer) {
    const placeholder = new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 16),
      new THREE.MeshPhongMaterial({ color: 0x8888ff, transparent: true, opacity: 0.7 })
    );
    placeholder.position.set(0, 60, 0);
    scene.add(placeholder);
  }
  return engine;
}

/**
 * Legacy energy-driven dancer rendering (kept for preview compatibility).
 * For overlay, prefer `renderDancerWithFeatures`.
 */
export async function renderDancer(
  key: string,
  sources: DancerSources,
  width: number,
  height: number,
  energy: number,
  isPlaying: boolean,
  freq: Uint8Array,
  now: number,
): Promise<HTMLCanvasElement> {
  const eng = await initEngine(key, sources);
  // Always update engine sources so camera/flash settings apply immediately
  eng.sources = sources;
  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.canvas.width = Math.floor(width);
    eng.canvas.height = Math.floor(height);
    eng.renderer.setSize(eng.canvas.width, eng.canvas.height, false);
    eng.camera.aspect = eng.canvas.width / eng.canvas.height;
    eng.camera.updateProjectionMatrix();
  }
  // Drive mixer
  const delta = eng.clock.getDelta();
  if (eng.mixer) {
    // Slight speed modulation with energy; pause when not playing
    const highBins = Math.floor(freq.length / 3);
    let highEnergy = 0; for (let i = freq.length - highBins; i < freq.length; i++) highEnergy += freq[i];
    highEnergy = highEnergy / (255 * Math.max(1, highBins));
    const timeScale = isPlaying ? (1 + Math.min(0.2, energy * 0.15 + (highEnergy > 0.7 ? 0.05 : 0))) : 0;
    // Set mixer timeScale to pause animation when audio is paused
    eng.mixer.timeScale = timeScale;
    // Always advance mixer; timeScale gates animation speed
    (eng.mixer as THREE.AnimationMixer).update(delta);
    // Ensure idle never drops to zero weight
    if (eng.idleAction) {
      const w = (eng.idleAction as any).getEffectiveWeight ? (eng.idleAction as any).getEffectiveWeight() : 0.0;
      const targetFloor = eng.currentAction ? 0.12 : 0.6;
      if (w < targetFloor) eng.idleAction.setEffectiveWeight(targetFloor);
      eng.idleAction.enabled = true;
      eng.idleAction.play();
    }
    // Switch animations on peaks (high-frequency energy)
    if (isPlaying && highEnergy > 0.65 && now - eng.lastSwitch > 2 && eng.clips.length > 1) {
      eng.lastSwitch = now;
      // Pick a random different clip index
      let nextIdx = eng.curClip;
      if (eng.clips.length > 1) {
        for (let tries = 0; tries < 4; tries++) {
          const candidate = Math.floor(Math.random() * eng.clips.length);
          if (candidate !== eng.curClip) { nextIdx = candidate; break; }
        }
      }
      eng.curClip = nextIdx;
      // fade to next clip
      const next = eng.mixer.clipAction(eng.clips[eng.curClip]);
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.setEffectiveWeight(1);
      next.setEffectiveTimeScale(1);
      if (eng.currentAction) eng.currentAction.fadeOut(0.2);
      next.reset(); next.fadeIn(0.2); next.play();
      eng.currentAction = next;
    }
  }
  // Camera movement modes
  const tgt = eng.targetCenter || new THREE.Vector3(0, 100, 0);
  const hY = tgt.y;
  const radius = Math.max(180, hY * 1.8);
  const camMode = eng.sources.cameraMode ?? 'static';
  // Allow camera elevation and tilt adjustments
  const elev = Math.max(-0.2, Math.min(0.2, eng.sources.cameraElevationPct ?? 0));
  const tiltDeg = Math.max(-15, Math.min(15, eng.sources.cameraTiltDeg ?? 0));
  const speedFactor = Math.max(0, (eng.sources.cameraSpeed ?? 100)) / 100;
  const distFactor = Math.max(0.1, (eng.sources.cameraDistance ?? 100)) / 100;
  const adjRadius = radius * distFactor;
  if (camMode === 'rotate') {
    // ~60s per full revolution at 100% speed (2π/60 ≈ 0.105)
    const ang = now * 0.105 * speedFactor;
    const x = Math.sin(ang) * adjRadius;
    const z = Math.cos(ang) * adjRadius;
    eng.camera.position.set(x, hY * (0.6 + elev), z);
  } else if (camMode === 'pan') {
    // Gentle sway, full cycle ~8s at 100% speed
    const x = Math.sin(now * 0.12 * speedFactor) * (adjRadius * 0.25);
    eng.camera.position.set(x, hY * (0.6 + elev), adjRadius);
  } // else static: keep previous position
  const tiltOffset = Math.sin(THREE.MathUtils.degToRad(tiltDeg)) * (hY * 0.1);
  const lookTarget = tgt.clone(); lookTarget.y += tiltOffset;
  eng.camera.lookAt(lookTarget);

  // Color flash / strobe / spot lights on character based on overall energy
  const flashCfg = eng.sources.colorFlash;
  if (eng.character && flashCfg?.enabled) {
    // Compute flash intensity
    const intenBase = Math.max(0, Math.min(1, (flashCfg.intensity ?? 1) * energy));
    const palette = (flashCfg.colors && flashCfg.colors.length ? flashCfg.colors : [flashCfg.color ?? '#ffffff']).map(c => new THREE.Color(c));
    const pickColor = (): THREE.Color => {
      if (flashCfg.mode === 'strobe') {
        const idx = Math.floor((now * 6) % Math.max(1, palette.length));
        return palette[idx];
      }
      return palette[0];
    };
    const pulseGate = flashCfg.mode === 'strobe' ? (Math.sin(now * 18) > 0 ? 1 : 0) : 1; // fast strobe gate
    const inten = Math.max(0, Math.min(1, intenBase * pulseGate));
    const flashColor = pickColor();

  if (flashCfg.mode === 'spot') {
      // Create spotlights if needed
      if (!eng.spotLights) {
        eng.spotLights = [];
        const count = Math.max(1, Math.min(3, palette.length));
        for (let i = 0; i < count; i++) {
          const sl = new THREE.SpotLight(0xffffff, 0.0, radius * 2, Math.PI / 8, 0.2, 1.5);
          sl.position.set(Math.sin(i * 2.09) * radius, hY * 1.2, Math.cos(i * 2.09) * radius);
          sl.target.position.copy(tgt);
          eng.scene.add(sl);
          eng.scene.add(sl.target);
          eng.spotLights.push(sl);
        }
      }
      // Update spotlights colors and intensities
      eng.spotLights!.forEach((sl, i) => {
        const col = palette[i % palette.length];
        sl.color.copy(col);
        sl.intensity = inten * 2.0; // brighter for spots
        // Optional subtle rotation
        const ang = now * 0.4 + i * 2.09;
        sl.position.set(Math.sin(ang) * radius, hY * 1.2, Math.cos(ang) * radius);
        sl.target.position.copy(tgt);
      });
    } else {
      // Optionally draw translucent rays from above
      if (flashCfg.rays) {
        const rayCount = Math.max(2, Math.min(6, palette.length + 2));
        if (!eng.rayCones) {
          eng.rayCones = [];
          for (let i = 0; i < rayCount; i++) {
            const cone = new THREE.Mesh(
              new THREE.ConeGeometry(hY * 1.1, hY * 0.8, 24, 1, true),
              new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
            );
            cone.position.set(Math.sin(i * 1.05) * (radius * 0.6), hY * 1.5, Math.cos(i * 1.05) * (radius * 0.6));
            cone.rotation.x = -Math.PI / 2.2;
            eng.scene.add(cone);
            eng.rayCones.push(cone);
          }
        }
        eng.rayCones!.forEach((cone, i) => {
          const col = palette[i % palette.length];
          const mat = cone.material as THREE.MeshPhongMaterial;
          mat.color.copy(col);
          mat.opacity = Math.max(0, Math.min(0.45, inten * 0.5));
          const ang = now * 0.25 + i * 1.05;
          cone.position.set(Math.sin(ang) * (radius * 0.6), hY * 1.5, Math.cos(ang) * (radius * 0.6));
        });
      } else if (eng.rayCones && eng.rayCones.length) {
        for (const cone of eng.rayCones) { eng.scene.remove(cone); }
        eng.rayCones = undefined;
      }

      // Traverse meshes and lerp their colors toward flash color
      eng.character.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if ((mesh as { isMesh?: boolean }).isMesh) {
          const matAny = (mesh.material as unknown);
          const mats: THREE.Material[] = Array.isArray(matAny) ? matAny as THREE.Material[] : [matAny as THREE.Material];
          for (const m of mats) {
            const mm = m as any;
            if (mm && mm.color && mm.color.isColor) {
              mm.userData = mm.userData || {};
              if (!mm.userData.origColor) mm.userData.origColor = mm.color.clone();
              mm.color.copy(mm.userData.origColor).lerp(flashColor, inten);
            }
            if (mm && mm.emissive && mm.emissive.isColor) {
              mm.userData = mm.userData || {};
              if (!mm.userData.origEmissive) mm.userData.origEmissive = mm.emissive.clone();
              if (typeof mm.emissiveIntensity === 'number' && mm.userData.origEmissiveIntensity === undefined) mm.userData.origEmissiveIntensity = mm.emissiveIntensity;
              mm.emissive.copy(mm.userData.origEmissive).lerp(flashColor, inten * 0.8);
              if (typeof mm.emissiveIntensity === 'number') mm.emissiveIntensity = (mm.userData.origEmissiveIntensity ?? 1) * (1 + inten * 0.8);
            }
          }
        }
      });
      // Remove spotlights if previously added
      if (eng.spotLights && eng.spotLights.length) {
        for (const sl of eng.spotLights) { eng.scene.remove(sl); if (sl.target) eng.scene.remove(sl.target); }
        eng.spotLights = undefined;
      }
    }
  }

  // Disco ball lights
  if (eng.sources.discoBall?.enabled) {
    const ballY = hY * 1.7;
    if (!eng.discoBall) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(24, 24, 16),
        new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 120, specular: 0xcccccc })
      );
      sphere.position.set(0, ballY, 0);
      eng.scene.add(sphere);
      eng.discoBall = sphere;
      eng.discoLights = [];
      const colors = [0xff0080, 0x00d08a, 0x7aa2ff, 0xffff66];
      for (let i = 0; i < 4; i++) {
        const pl = new THREE.PointLight(colors[i % colors.length], 0.0, radius * 1.2);
        eng.scene.add(pl);
        eng.discoLights!.push(pl);
      }
    }
    // Update disco ball rotation and lights
    (eng.discoBall as THREE.Mesh).rotation.y = now * 0.6;
    eng.discoLights!.forEach((pl, i) => {
      const ang = now * 0.8 + i * (Math.PI / 2);
      pl.position.set(Math.sin(ang) * radius * 0.8, ballY, Math.cos(ang) * radius * 0.8);
      pl.intensity = Math.min(1.6, 0.4 + energy * 1.2);
    });
  } else {
    if (eng.discoBall) { eng.scene.remove(eng.discoBall); eng.discoBall = undefined; }
    if (eng.discoLights && eng.discoLights.length) { for (const pl of eng.discoLights) eng.scene.remove(pl); eng.discoLights = undefined; }
  }

  eng.renderer.render(eng.scene, eng.camera);
  return eng.canvas;
}

// Audio-features driven variant: BPM speed, kick/bass/drop mapping
export async function renderDancerWithFeatures(
  key: string,
  sources: DancerSources,
  width: number,
  height: number,
  features: AudioFeatures,
  isPlaying: boolean,
  now: number,
): Promise<HTMLCanvasElement> {
  const eng = await initEngine(key, sources);
  eng.sources = sources;
  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.canvas.width = Math.floor(width);
    eng.canvas.height = Math.floor(height);
    eng.renderer.setSize(eng.canvas.width, eng.canvas.height, false);
    eng.camera.aspect = eng.canvas.width / eng.canvas.height;
    eng.camera.updateProjectionMatrix();
  }

  // Camera and lights
  const tgt = eng.targetCenter || new THREE.Vector3(0, 100, 0);
  const hY = tgt.y;
  const radius = Math.max(180, hY * 1.8);
  const camMode = eng.sources.cameraMode ?? 'static';
  const elev = Math.max(-0.2, Math.min(0.2, eng.sources.cameraElevationPct ?? 0));
  const tiltDeg = Math.max(-15, Math.min(15, eng.sources.cameraTiltDeg ?? 0));
  const speedFactor = Math.max(0, (eng.sources.cameraSpeed ?? 100)) / 100;
  const distFactor = Math.max(0.1, (eng.sources.cameraDistance ?? 100)) / 100;
  const adjRadius = radius * distFactor;
  if (camMode === 'rotate') {
    // ~60s per revolution at 100%, slight energy modulation
    const baseRate = 0.105 * (1 + features.energy * 0.15);
    const ang = now * baseRate * speedFactor;
    const x = Math.sin(ang) * adjRadius;
    const z = Math.cos(ang) * adjRadius;
    eng.camera.position.set(x, hY * (0.6 + elev), z);
  } else if (camMode === 'pan') {
    // Gentle sway ~8s cycle, slight energy modulation
    const baseRate = 0.12 * (1 + features.energy * 0.15);
    const x = Math.sin(now * baseRate * speedFactor) * (adjRadius * 0.25);
    eng.camera.position.set(x, hY * (0.6 + elev), adjRadius);
  }
  const tiltOffset = Math.sin(THREE.MathUtils.degToRad(tiltDeg)) * (hY * 0.1);
  const lookTarget = tgt.clone(); lookTarget.y += tiltOffset;
  eng.camera.lookAt(lookTarget);

  // Color lights tied to energy + kick
  const flashCfg = eng.sources.colorFlash;
  if (eng.character && flashCfg?.enabled) {
    const intenBase = Math.max(0, Math.min(1, (flashCfg.intensity ?? 1) * (0.3 + features.energy * 0.7) * (features.kick ? 1.2 : 1.0)));
    const palette = (flashCfg.colors && flashCfg.colors.length ? flashCfg.colors : [flashCfg.color ?? '#ffffff']).map(c => new THREE.Color(c));
    const pickColor = (): THREE.Color => {
      if (flashCfg.mode === 'strobe') {
        const idx = Math.floor((now * 6) % Math.max(1, palette.length));
        return palette[idx];
      }
      return palette[0];
    };
    const pulseGate = flashCfg.mode === 'strobe' ? (Math.sin(now * 18) > 0 ? 1 : 0) : 1;
    const inten = Math.max(0, Math.min(1, intenBase * pulseGate));
    const flashColor = pickColor();

    // Rays/spotlights similar to energy-driven variant
    if (flashCfg.mode === 'spot') {
      if (!eng.spotLights) {
        eng.spotLights = [];
        const count = Math.max(1, Math.min(3, palette.length));
        for (let i = 0; i < count; i++) {
          const sl = new THREE.SpotLight(0xffffff, 0.0, radius * 2, Math.PI / 8, 0.2, 1.5);
          sl.position.set(Math.sin(i * 2.09) * radius, hY * 1.2, Math.cos(i * 2.09) * radius);
          sl.target.position.copy(tgt);
          eng.scene.add(sl);
          eng.scene.add(sl.target);
          eng.spotLights.push(sl);
        }
      }
      eng.spotLights!.forEach((sl, i) => {
        const col = palette[i % palette.length];
        sl.color.copy(col);
        sl.intensity = inten * 2.0;
        const ang = now * 0.4 + i * 2.09;
        sl.position.set(Math.sin(ang) * radius, hY * 1.2, Math.cos(ang) * radius);
        sl.target.position.copy(tgt);
      });
    } else {
      if (flashCfg.rays) {
        const rayCount = Math.max(2, Math.min(6, palette.length + 2));
        if (!eng.rayCones) {
          eng.rayCones = [];
          for (let i = 0; i < rayCount; i++) {
            const cone = new THREE.Mesh(
              new THREE.ConeGeometry(hY * 1.1, hY * 0.8, 24, 1, true),
              new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
            );
            cone.position.set(Math.sin(i * 1.05) * (radius * 0.6), hY * 1.5, Math.cos(i * 1.05) * (radius * 0.6));
            cone.rotation.x = -Math.PI / 2.2;
            eng.scene.add(cone);
            eng.rayCones.push(cone);
          }
        }
        eng.rayCones!.forEach((cone, i) => {
          const col = palette[i % palette.length];
          const mat = cone.material as THREE.MeshPhongMaterial;
          mat.color.copy(col);
          mat.opacity = Math.max(0, Math.min(0.45, inten * 0.5));
          const ang = now * 0.25 + i * 1.05;
          cone.position.set(Math.sin(ang) * (radius * 0.6), hY * 1.5, Math.cos(ang) * (radius * 0.6));
        });
      } else if (eng.rayCones && eng.rayCones.length) {
        for (const cone of eng.rayCones) { eng.scene.remove(cone); }
        eng.rayCones = undefined;
      }

      eng.character.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if ((mesh as { isMesh?: boolean }).isMesh) {
          const matAny = (mesh.material as unknown);
          const mats: THREE.Material[] = Array.isArray(matAny) ? matAny as THREE.Material[] : [matAny as THREE.Material];
          for (const m of mats) {
            const mm = m as any;
            if (mm && mm.color && mm.color.isColor) {
              mm.userData = mm.userData || {};
              if (!mm.userData.origColor) mm.userData.origColor = mm.color.clone();
              mm.color.copy(mm.userData.origColor).lerp(flashColor, inten);
            }
            if (mm && mm.emissive && mm.emissive.isColor) {
              mm.userData = mm.userData || {};
              if (!mm.userData.origEmissive) mm.userData.origEmissive = mm.emissive.clone();
              if (typeof mm.emissiveIntensity === 'number' && mm.userData.origEmissiveIntensity === undefined) mm.userData.origEmissiveIntensity = mm.emissiveIntensity;
              mm.emissive.copy(mm.userData.origEmissive).lerp(flashColor, inten * 0.8);
              if (typeof mm.emissiveIntensity === 'number') mm.emissiveIntensity = (mm.userData.origEmissiveIntensity ?? 1) * (1 + inten * 0.8);
            }
          }
        }
      });
      if (eng.spotLights && eng.spotLights.length) {
        for (const sl of eng.spotLights) { eng.scene.remove(sl); if (sl.target) eng.scene.remove(sl.target); }
        eng.spotLights = undefined;
      }
    }
  }

  // Disco ball handling remains identical to energy-driven version
  if (eng.sources.discoBall?.enabled) {
    const ballY = (eng.targetCenter?.y ?? 100) * 1.7;
    if (!eng.discoBall) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(24, 24, 16),
        new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 120, specular: 0xcccccc })
      );
      sphere.position.set(0, ballY, 0);
      eng.scene.add(sphere);
      eng.discoBall = sphere;
      eng.discoLights = [];
      const colors = [0xff0080, 0x00d08a, 0x7aa2ff, 0xffff66];
      for (let i = 0; i < 4; i++) {
        const pl = new THREE.PointLight(colors[i % colors.length], 0.0, 400);
        eng.scene.add(pl);
        eng.discoLights!.push(pl);
      }
    }
    (eng.discoBall as THREE.Mesh).rotation.y = now * 0.6;
    eng.discoLights!.forEach((pl, i) => {
      const ang = now * 0.8 + i * (Math.PI / 2);
      const radius = Math.max(180, (eng.targetCenter?.y ?? 100) * 1.8) * 0.8;
      pl.position.set(Math.sin(ang) * radius, ballY, Math.cos(ang) * radius);
      pl.intensity = Math.min(1.6, 0.4 + features.energy * 1.2);
    });
  } else {
    if (eng.discoBall) { eng.scene.remove(eng.discoBall); eng.discoBall = undefined; }
    if (eng.discoLights && eng.discoLights.length) { for (const pl of eng.discoLights) eng.scene.remove(pl); eng.discoLights = undefined; }
  }

  // Mixer + character modulation using features
  const delta = eng.clock.getDelta();
  if (eng.mixer) {
    const baseBpm = 120;
    const bpmScale = THREE.MathUtils.clamp(features.bpm / baseBpm, 0.5, 2.0);
    eng.mixer.timeScale = isPlaying ? bpmScale : 0.0;

    // Bass sway: subtle yaw
    if (eng.character) {
      const sway = (features.bassLevel - 0.5) * 0.25;
      eng.character.rotation.y = sway;
    }
    // Kick: vertical bounce or quick jump pose
    if (features.kick && eng.character) {
      eng.character.position.y = 0.08;
    } else if (eng.character) {
      eng.character.position.y *= 0.85;
      if (Math.abs(eng.character.position.y) < 0.001) eng.character.position.y = 0;
    }
    // Drop: brief freeze/hit pose (pause mixer for ~150ms)
    if (features.drop) {
      const prev = eng.mixer.timeScale;
      eng.mixer.timeScale = 0.0;
      setTimeout(() => { if (eng.mixer) eng.mixer.timeScale = prev; }, 150);
    }

    // Always update mixer each frame
    eng.mixer.update(delta);
    // Maintain idle weight floor so no T-pose flashes
    if (eng.idleAction) {
      const w = (eng.idleAction as any).getEffectiveWeight ? (eng.idleAction as any).getEffectiveWeight() : 0.0;
      const targetFloor = eng.currentAction ? 0.12 : 0.6;
      if (w < targetFloor) eng.idleAction.setEffectiveWeight(targetFloor);
      eng.idleAction.enabled = true;
      eng.idleAction.play();
    }

    // Clip switching: on kick or strong beat pulse, with cooldown
    if (isPlaying && eng.clips.length > 1) {
      const shouldSwitch = features.kick || features.beatPulse > 0.92;
      if (shouldSwitch && (now - eng.lastSwitch) > 1.5) {
        eng.lastSwitch = now;
        // pick a different clip index
        let nextIdx = eng.curClip;
        for (let tries = 0; tries < 5; tries++) {
          const candidate = Math.floor(Math.random() * eng.clips.length);
          if (candidate !== eng.curClip && candidate !== 0) { nextIdx = candidate; break; }
        }
        eng.curClip = nextIdx;
        const clip = eng.clips[eng.curClip];
        const next = eng.mixer.clipAction(clip);
        const isOneShot = clip.duration <= 3 || /pose|hit|one|combo/i.test(clip.name ?? '');
        next.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, isOneShot ? 1 : Infinity);
        next.clampWhenFinished = !!isOneShot;
        next.setEffectiveTimeScale(bpmScale);
        next.reset(); // always reset before replaying
        // Ensure idle keeps some weight; cross-fade from current to next
        if (eng.currentAction) {
          eng.currentAction.crossFadeTo(next, 0.25, false);
        } else if (eng.idleAction) {
          eng.idleAction.crossFadeTo(next, 0.25, false);
        }
        next.play();
        eng.currentAction = next;
      }
    }

    // If one-shot finished, fade back to idle and clear current
    if (eng.currentAction) {
      const act = eng.currentAction;
      const clip = act.getClip();
      const finished = act.loop === THREE.LoopOnce && act.time >= (clip.duration - 0.02);
      if (finished) {
        if (eng.idleAction) {
          act.crossFadeTo(eng.idleAction, 0.25, false);
          eng.idleAction.setEffectiveWeight(0.6);
          eng.idleAction.play();
        }
        eng.currentAction = undefined;
      }
    }
  }

  eng.renderer.render(eng.scene, eng.camera);
  return eng.canvas;
}
