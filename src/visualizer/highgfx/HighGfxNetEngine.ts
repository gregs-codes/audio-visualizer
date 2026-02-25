import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/* Net effect (closer to Vanta Net): perspective wireframe grid with animated vertex displacement and additive glow; alpha output */

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  material: THREE.ShaderMaterial;
  lines: THREE.LineSegments;
};

const engines = new Map<string, Engine>();

const vert = /* glsl */ `
  uniform float u_time; uniform float u_energy; uniform float u_bass; uniform float u_pulse;
  varying float vWave;
  void main(){
    // Slow base speed; gate motion by beat pulse
    float beat = smoothstep(0.0, 1.0, u_pulse);
    float speed = (0.22 + u_energy * 0.35) * (0.35 + 0.65 * beat);
    float amp = (0.04 + u_bass * 0.18 + u_energy * 0.06) * (0.4 + 0.6 * beat);
    // combine two traveling waves for a lively net
    float dz = sin(position.x * 2.2 + u_time * speed) + cos(position.y * 2.8 - u_time * speed * 0.9);
    vWave = dz;
    vec3 pos = position + vec3(0.0, 0.0, dz * amp);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float; varying float vWave; uniform float u_energy; uniform float u_bass;
  void main(){
    float glow = 0.45 + 0.35 * abs(vWave) + 0.15 * (u_energy + u_bass);
    vec3 base = vec3(0.20, 0.90, 1.0); // cyan
    vec3 rgb = base * glow;
    gl_FragColor = vec4(rgb, 0.88);
  }
`;

export async function renderHighGfxNetWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
  opts?: { view?: 'top'|'side' }
): Promise<HTMLCanvasElement> {
  let eng = engines.get(key);
  const W = Math.max(1, Math.floor(width));
  const H = Math.max(1, Math.floor(height));
  if (!eng) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene(); scene.background = null;
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0.45, 2.8);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    // Geometry and wireframe lines
    const plane = new THREE.PlaneGeometry(2.6, 1.6, 64, 40);
    const wire = new THREE.WireframeGeometry(plane);
    const material = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, blending: THREE.AdditiveBlending,
      uniforms: { u_time: { value: 0 }, u_energy: { value: 0 }, u_bass: { value: 0 }, u_pulse: { value: 0 } }
    });
    const lines = new THREE.LineSegments(wire, material);
    lines.rotation.x = -0.35; // default: top view tilt
    lines.rotation.y = 0.0;
    scene.add(lines);
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.65, 0.55, 0.85); composer.addPass(bloom);
    eng = { canvas, renderer, scene, camera, composer, material, lines };
    engines.set(key, eng);
  }
  if (eng.canvas.width !== W || eng.canvas.height !== H) { eng.renderer.setSize(W, H, false); eng.camera.aspect = W / H; eng.camera.updateProjectionMatrix(); }
  (eng.material.uniforms.u_time as any).value = nowSec;
  (eng.material.uniforms.u_energy as any).value = THREE.MathUtils.clamp(features.energy, 0, 1);
  (eng.material.uniforms.u_bass as any).value = THREE.MathUtils.clamp(features.bassLevel, 0, 1);
  (eng.material.uniforms.u_pulse as any).value = THREE.MathUtils.clamp(features.beatPulse, 0, 1);
  // Apply view option
  const view = opts?.view ?? 'top';
  if (view === 'top') {
    eng.camera.position.set(0, 0.45, 2.8);
    eng.lines.rotation.x = -0.35;
    eng.lines.rotation.y = 0.0;
  } else {
    // side view centered: face the grid more frontally and add slight yaw
    eng.camera.position.set(0, 0.20, 2.7);
    eng.lines.rotation.x = -0.05;
    eng.lines.rotation.y = 0.45;
  }
  eng.composer.render(); return eng.canvas;
}
