import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// ─────────────────────── Background nebula cloud shader ──────────────────────

const BG_VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

// Domain-warped FBM produces volumetric nebula tendrils and cloud shapes.
// Color ramp: deep space → purple → indigo → magenta → teal → white-pink.
const BG_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_energy;
  uniform float u_bass;
  uniform float u_pulse;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
  float noise(vec2 p){
    vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=0.5; mat2 m=mat2(1.7,1.2,-1.2,1.7);
    for(int i=0;i<6;i++){v+=a*noise(p);p=m*p;a*=0.5;} return v;
  }

  void main(){
    float beat = u_pulse * u_pulse;
    float speed = 0.022 + u_bass * 0.04 + u_energy * 0.035;
    vec2 p = vUv * 3.0 + vec2(u_time*speed*0.25, -u_time*speed*0.12);
    // Two levels of domain warping for complex cloud shapes
    vec2 q = vec2(fbm(p), fbm(p+vec2(6.2,1.3)));
    vec2 r = vec2(fbm(p+4.0*q+vec2(1.7,9.2)+u_time*speed*0.08), fbm(p+4.0*q+vec2(8.3,2.8)));
    float f = fbm(p + 4.0*r);

    // Nebula palette: black-purple → indigo → magenta → teal → white-lavender
    vec3 col = mix(vec3(0.01,0.00,0.08), vec3(0.18,0.03,0.35), smoothstep(0.00,0.30,f));
    col = mix(col, vec3(0.03,0.14,0.42), smoothstep(0.22,0.48,f));
    col = mix(col, vec3(0.52,0.06,0.45), smoothstep(0.42,0.62,f));
    col = mix(col, vec3(0.04,0.48,0.58), smoothstep(0.56,0.74,f));
    col = mix(col, vec3(0.88,0.82,1.00), smoothstep(0.70,0.92,f));
    col *= 1.0 + beat*0.35 + u_bass*0.18;

    float alpha = smoothstep(0.15,0.52,f) * (0.72 + beat*0.18 + u_energy*0.08);
    alpha = clamp(alpha, 0.0, 0.90);
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─────────────────────── Particle group helpers ───────────────────────────────

type ParticleGroup = {
  points: THREE.Points;
  baseAngles: Float32Array;  // initial polar angle (radians) of each particle
  baseRadii: Float32Array;   // initial polar radius (distance from center)
  baseZ: Float32Array;       // depth coordinate — does not orbit
  phases: Float32Array;      // per-particle turbulence phase
  orbitDir: number;          // +1 or -1 rotation direction
  orbitSpeed: number;        // base angular speed (rad/s)
};

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  groups: ParticleGroup[];
  bgMat: THREE.ShaderMaterial;
};

const engines = new Map<string, Engine>();

function createSpriteTexture(): THREE.Texture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d')!;
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0,   'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

// hslPalette: array of [h,s,l] entries; each particle picks one at random
function makeGroup(
  count: number,
  spread: [number, number, number],
  hslPalette: Array<[number, number, number]>,
  sprite: THREE.Texture,
  orbitDir: number,
  orbitSpeed: number,
): ParticleGroup {
  const positions  = new Float32Array(count * 3);
  const colors     = new Float32Array(count * 3);
  const phases     = new Float32Array(count);
  const baseAngles = new Float32Array(count);
  const baseRadii  = new Float32Array(count);
  const baseZ      = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Elliptical distribution — triangular radial bias makes the core denser
    const angle = Math.random() * Math.PI * 2;
    const u = Math.random() + Math.random();
    const rNorm = u > 1 ? 2 - u : u; // 0..1, biased toward 0.5
    const x = rNorm * spread[0] * 0.5 * Math.cos(angle);
    const y = rNorm * spread[1] * 0.5 * Math.sin(angle);
    const z = (Math.random() - 0.5) * spread[2];

    positions[i*3]   = x;
    positions[i*3+1] = y;
    positions[i*3+2] = z;

    baseAngles[i] = Math.atan2(y, x);
    baseRadii[i]  = Math.sqrt(x * x + y * y);
    baseZ[i]      = z;
    phases[i]     = Math.random() * Math.PI * 2;

    // Per-particle color sampled from the palette with a small random nudge
    const hsl = hslPalette[Math.floor(Math.random() * hslPalette.length)];
    const hue = (hsl[0] + (Math.random() - 0.5) * 0.08) % 1;
    const sat = THREE.MathUtils.clamp(hsl[1] + (Math.random() - 0.5) * 0.12, 0.3, 1.0);
    const lig = THREE.MathUtils.clamp(hsl[2] + (Math.random() - 0.5) * 0.15, 0.2, 0.9);
    const c = new THREE.Color().setHSL(hue, sat, lig);
    colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 3.0,
    map: sprite,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0.6,
  });

  return { points: new THREE.Points(geom, mat), baseAngles, baseRadii, baseZ, phases, orbitDir, orbitSpeed };
}

// ─────────────────────── Main entry point ─────────────────────────────────────

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

    // Background nebula cloud — large plane at z=-90 using screen-space UV
    // (plane is oversized so it always fills the viewport)
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        u_time:   { value: 0 },
        u_energy: { value: 0 },
        u_bass:   { value: 0 },
        u_pulse:  { value: 0 },
      },
    });
    // At z=-90 (distance 210 from camera), FOV 55° → visible height ≈ 220; use 700×500 to be safe
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), bgMat);
    bgMesh.position.z = -90;
    scene.add(bgMesh);

    // Four particle layers:
    //  0 – core:  deep blue / violet, tight, fast counter-clockwise orbit
    //  1 – mid:   purple / magenta, medium spread, slower clockwise
    //  2 – outer: pink / teal, wide, slow counter-clockwise
    //  3 – stars: bright white / pale gold, nearly stationary, twinkle
    const groups: ParticleGroup[] = [
      makeGroup(1200, [120,  90,  60], [[0.62,0.95,0.55],[0.68,0.88,0.50]], sprite, -1, 0.18),
      makeGroup( 900, [190, 140,  80], [[0.75,0.88,0.52],[0.80,0.82,0.48]], sprite,  1, 0.11),
      makeGroup( 600, [260, 190, 100], [[0.85,0.80,0.48],[0.50,0.75,0.55]], sprite, -1, 0.07),
      makeGroup( 400, [300, 220, 150], [[0.10,0.20,0.85],[0.12,0.15,0.90]], sprite,  1, 0.02),
    ];
    for (const g of groups) scene.add(g.points);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Stronger bloom with softer radius for a true nebula glow
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 1.6, 0.5, 0.55);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, groups, bgMat };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.renderer.setSize(width, height, false);
    eng.composer.setSize(Math.floor(width), Math.floor(height));
    eng.camera.aspect = width / height;
    eng.camera.updateProjectionMatrix();
  }

  const { energy, beatPulse, bassLevel } = features;

  // Drive the background shader
  eng.bgMat.uniforms.u_time.value   = nowSec;
  eng.bgMat.uniforms.u_energy.value = THREE.MathUtils.clamp(energy, 0, 1);
  eng.bgMat.uniforms.u_bass.value   = THREE.MathUtils.clamp(bassLevel, 0, 1);
  eng.bgMat.uniforms.u_pulse.value  = THREE.MathUtils.clamp(beatPulse, 0, 1);

  // Animate particle groups
  eng.groups.forEach((g, gi) => {
    const posAttr = g.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const count = arr.length / 3;
    const isStarLayer = gi === 3;
    const turbScale  = isStarLayer ? 1.0 : (3.0 + energy * 7.0 + bassLevel * 4.0);
    const radialBump = isStarLayer ? 0   : (bassLevel * 10 + beatPulse * 6);

    for (let i = 0; i < count; i++) {
      const r  = g.baseRadii[i];
      const ph = g.phases[i];
      // Keplerian-like differential rotation: inner particles orbit faster.
      // 1/sqrt(r·k + 1) gives a smooth curve from fast (center) to slow (edge).
      const angularSpeed = g.orbitDir * g.orbitSpeed * (1.0 / Math.sqrt(r * 0.008 + 1.0));
      const angle = g.baseAngles[i] + nowSec * angularSpeed * (1.0 + energy * 0.7);

      // Soft wisp displacement layered on top of the orbital position
      const dx = Math.sin(nowSec * 0.35 + ph)        * turbScale * 0.6;
      const dy = Math.cos(nowSec * 0.27 + ph * 1.3)  * turbScale * 0.55;

      arr[i*3]   = Math.cos(angle) * (r + radialBump) + dx;
      arr[i*3+1] = Math.sin(angle) * (r + radialBump) + dy;
      arr[i*3+2] = g.baseZ[i] + Math.sin(nowSec * 0.18 + ph * 0.6) * 3;
    }
    posAttr.needsUpdate = true;

    const mat = g.points.material as THREE.PointsMaterial;
    if (isStarLayer) {
      mat.opacity = 0.40 + Math.sin(nowSec * 0.5 + gi) * 0.10 + beatPulse * 0.20;
      mat.size    = 1.8 + beatPulse * 0.8;
    } else {
      mat.opacity = 0.45 + beatPulse * 0.40 + bassLevel * 0.18;
      mat.size    = 4.0 + energy * 3.5 + beatPulse * 2.5;
    }
  });

  eng.composer.render();
  return eng.canvas;
}
