import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/* Anomaly: wireframe icosahedron with Simplex Noise vertex displacement + glow sphere + drifting background particles */

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  anomalyGroup: THREE.Group;
  outerMaterial: THREE.ShaderMaterial;
  glowMaterial: THREE.ShaderMaterial;
  particlesMaterial: THREE.ShaderMaterial;
  currentResolution: number;
};

const engines = new Map<string, Engine>();

// ---- Shaders ---------------------------------------------------------------

const VERT_NOISE = `
uniform float time;
uniform float audioLevel;
uniform float distortion;
varying vec3 vNormal;
varying vec3 vPosition;

vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute4(vec4 x) { return mod289v4(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute4(permute4(permute4(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 xv = x_ * ns.x + ns.yyyy;
  vec4 yv = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(xv) - abs(yv);
  vec4 b0 = vec4(xv.xy, yv.xy);
  vec4 b1 = vec4(xv.zw, yv.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt4(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec3 pos = position;
  float noise = snoise(vec3(position * 0.5 + vec3(0.0, 0.0, time * 0.3)));
  pos += normal * noise * 0.2 * distortion * (1.0 + audioLevel);
  vPosition = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

const FRAG_OUTER = `
uniform float time;
uniform vec3 color;
uniform float audioLevel;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = 1.0 - max(0.0, dot(viewDir, vNormal));
  fresnel = pow(fresnel, 2.0 + audioLevel * 2.0);
  float pulse = 0.8 + 0.2 * sin(time * 2.0);
  vec3 col = color * fresnel * pulse * (1.0 + audioLevel * 0.8);
  float alpha = fresnel * (0.7 - audioLevel * 0.3);
  gl_FragColor = vec4(col, alpha);
}`;

const VERT_GLOW = `
varying vec3 vNormal;
varying vec3 vPosition;
uniform float audioLevel;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position * (1.0 + audioLevel * 0.2);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
}`;

const FRAG_GLOW = `
varying vec3 vNormal;
varying vec3 vPosition;
uniform vec3 color;
uniform float time;
uniform float audioLevel;
void main() {
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = 1.0 - max(0.0, dot(viewDir, vNormal));
  fresnel = pow(fresnel, 3.0 + audioLevel * 3.0);
  float audioFactor = 1.0 + audioLevel * 3.0;
  vec3 col = color * fresnel * (0.8 + 0.2 * sin(time * 2.0)) * audioFactor;
  float alpha = fresnel * 0.3 * audioFactor * (1.0 - audioLevel * 0.2);
  gl_FragColor = vec4(col, alpha);
}`;

const VERT_PARTICLES = `
attribute float size;
varying vec3 vColor;
uniform float time;
void main() {
  vColor = color;
  vec3 pos = position;
  pos.x += sin(time * 0.1 + position.z * 0.2) * 0.05;
  pos.y += cos(time * 0.1 + position.x * 0.2) * 0.05;
  pos.z += sin(time * 0.1 + position.y * 0.2) * 0.05;
  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = size * (300.0 / -mvPos.z);
  gl_Position = projectionMatrix * mvPos;
}`;

const FRAG_PARTICLES = `
varying vec3 vColor;
void main() {
  float r = distance(gl_PointCoord, vec2(0.5));
  if (r > 0.5) discard;
  float glow = pow(1.0 - r * 2.0, 2.0);
  gl_FragColor = vec4(vColor, glow);
}`;

// ---- Builders ---------------------------------------------------------------

function buildAnomalyGroup(resolution: number, col: THREE.Color) {
  const group = new THREE.Group();
  const radius = 2;
  const detail = Math.max(1, Math.floor(resolution / 8));

  const outerMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: col.clone() },
      audioLevel: { value: 0 },
      distortion: { value: 1.0 },
    },
    vertexShader: VERT_NOISE,
    fragmentShader: FRAG_OUTER,
    wireframe: true,
    transparent: true,
  });
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), outerMat));

  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: col.clone() },
      audioLevel: { value: 0 },
    },
    vertexShader: VERT_GLOW,
    fragmentShader: FRAG_GLOW,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.2, 32, 32), glowMat));

  return { group, outerMat, glowMat };
}

function buildParticles(col: THREE.Color) {
  const count = 3000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const c2 = col.clone().multiplyScalar(0.75);
  const c3 = col.clone().lerp(new THREE.Color(1, 1, 1), 0.3);
  for (let i = 0; i < count; i++) {
    positions[i*3]   = (Math.random() - 0.5) * 100;
    positions[i*3+1] = (Math.random() - 0.5) * 100;
    positions[i*3+2] = (Math.random() - 0.5) * 100;
    const pick = Math.random() < 0.33 ? col : Math.random() < 0.5 ? c2 : c3;
    colors[i*3] = pick.r; colors[i*3+1] = pick.g; colors[i*3+2] = pick.b;
    sizes[i] = 0.05;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute('size',     new THREE.Float32BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: VERT_PARTICLES,
    fragmentShader: FRAG_PARTICLES,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  return { particles: new THREE.Points(geom, mat), particlesMat: mat };
}

// ---- Public API ------------------------------------------------------------

export async function renderHighGfxAnomalyWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
  opts?: {
    view?: 'top' | 'side';
    rotationSpeed?: number;
    resolution?: number;
    distortion?: number;
    color?: string;
    mouse?: { x: number; y: number };
  }
): Promise<HTMLCanvasElement> {
  let eng = engines.get(key);
  const W = Math.max(1, Math.floor(width));
  const H = Math.max(1, Math.floor(height));

  const rotationSpeed = opts?.rotationSpeed ?? 1.0;
  const resolution    = opts?.resolution    ?? 32;
  const distortion    = opts?.distortion    ?? 1.0;
  const mainColor     = new THREE.Color(opts?.color ?? '#ff4e42');

  if (!eng) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.025);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.65, 0.45, 0.82);
    composer.addPass(bloom);

    scene.add(new THREE.AmbientLight(0x404040, 1.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    const { particles, particlesMat } = buildParticles(mainColor);
    scene.add(particles);

    const { group: anomalyGroup, outerMat, glowMat } = buildAnomalyGroup(resolution, mainColor);
    scene.add(anomalyGroup);

    eng = { canvas, renderer, scene, camera, composer, anomalyGroup, outerMaterial: outerMat, glowMaterial: glowMat, particlesMaterial: particlesMat, currentResolution: resolution };
    engines.set(key, eng);
  }

  // Resize
  if (eng.canvas.width !== W || eng.canvas.height !== H) {
    eng.renderer.setSize(W, H, false);
    eng.composer.setSize(W, H);
    eng.camera.aspect = W / H;
    eng.camera.updateProjectionMatrix();
  }

  // Rebuild anomaly when resolution changes
  if (resolution !== eng.currentResolution) {
    eng.scene.remove(eng.anomalyGroup);
    const { group, outerMat, glowMat } = buildAnomalyGroup(resolution, mainColor);
    eng.scene.add(group);
    eng.anomalyGroup = group;
    eng.outerMaterial = outerMat;
    eng.glowMaterial = glowMat;
    eng.currentResolution = resolution;
  }

  // Camera
  const view = opts?.view ?? 'top';
  if (view === 'top') {
    eng.camera.position.set(0, 0, 10);
  } else {
    eng.camera.position.set(5, 3, 7);
  }
  const mx = (opts?.mouse?.x ?? 0.5) - 0.5;
  const my = (opts?.mouse?.y ?? 0.5) - 0.5;
  eng.camera.position.x += mx * 1.5;
  eng.camera.position.y += my * 1.0;
  eng.camera.lookAt(0, 0, 0);
  eng.camera.updateProjectionMatrix();

  // Audio features
  const energy = THREE.MathUtils.clamp(features.energy, 0, 1);
  const bass   = THREE.MathUtils.clamp(features.bassLevel, 0, 1);
  const beat   = THREE.MathUtils.clamp(features.beatPulse, 0, 1);
  const audioLevel = energy * 0.6 + bass * 0.3 + beat * 0.1;

  // Update outer shell uniforms
  eng.outerMaterial.uniforms.time.value      = nowSec;
  eng.outerMaterial.uniforms.audioLevel.value = audioLevel;
  eng.outerMaterial.uniforms.distortion.value = distortion;
  eng.outerMaterial.uniforms.color.value      = mainColor;

  // Update glow uniforms
  eng.glowMaterial.uniforms.time.value       = nowSec;
  eng.glowMaterial.uniforms.audioLevel.value = audioLevel;
  eng.glowMaterial.uniforms.color.value      = mainColor;

  // Rotate anomaly group
  const audioRotFactor = 1.0 + audioLevel;
  eng.anomalyGroup.rotation.y += 0.005 * rotationSpeed * audioRotFactor;
  eng.anomalyGroup.rotation.z += 0.002 * rotationSpeed * audioRotFactor;

  // Update particle drift
  eng.particlesMaterial.uniforms.time.value = nowSec;

  eng.composer.render();
  return eng.canvas;
}
