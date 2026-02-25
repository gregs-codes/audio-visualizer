import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/*
  Cells effect (inspired by Vanta.js Cells) implemented from scratch:
  - Fullscreen shader renders a Voronoi-like cellular pattern.
  - Seed points are procedurally generated per tile and animated over time.
  - Audio features control wobble, color hues, and edge intensity.
*/

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  composer: EffectComposer;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
};

const engines = new Map<string, Engine>();

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Hash & pseudo-random helpers
const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time; // seconds
  uniform vec2 u_res;   // resolution
  uniform float u_energy; // 0..1
  uniform float u_bass;   // 0..1
  uniform float u_pulse;  // 0..1

  // Hash functions for Voronoi seeds
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }
  vec2 hash21(float p) {
    float x = hash11(p);
    float y = hash11(p + 17.17);
    return vec2(x, y);
  }

  // Simple pseudo-noise based on trig for animation
  float n1(float t) { return sin(t) * 0.5 + 0.5; }

  // Voronoi cell function: returns distance to nearest and second nearest seeds
  vec2 voronoi(vec2 uv, float scale, float time) {
    vec2 grid = uv * scale; // scale tiles
    vec2 i = floor(grid);
    vec2 f = fract(grid);
    float minDist = 1e9;
    float secondDist = 1e9;
    // search neighboring cells for nearest seeds
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell = i + vec2(float(x), float(y));
        float idx = cell.x + cell.y * 57.0;
        vec2 rnd = hash21(idx);
        // animate seed offset with time
        vec2 seed = vec2(rnd.x + (sin(time + idx) * 0.35), rnd.y + (cos(time * 0.8 + idx) * 0.35));
        vec2 diff = vec2(float(x), float(y)) + seed - f;
        float d = dot(diff, diff);
        if (d < minDist) {
          secondDist = minDist; minDist = d;
        } else if (d < secondDist) {
          secondDist = d;
        }
      }
    }
    return vec2(sqrt(minDist), sqrt(secondDist));
  }

  // HSL to RGB
  vec3 hsl2rgb(vec3 hsl){
    vec3 rgb = clamp(abs(mod(hsl.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return hsl.z + hsl.y*(rgb-0.5)*(1.0-abs(2.0*hsl.z-1.0));
  }

  void main() {
    // Pixel coords and aspect-correct UV
    vec2 uv = vUv;
    float aspect = u_res.x / max(1.0, u_res.y);
    uv.x *= aspect;

    // Audio-driven parameters
    float wobble = 0.45 + u_energy * 0.90 + u_bass * 0.40; // more wobble
    float speed  = 0.55 + u_energy * 1.40;                 // faster animation
    // Edge intensity constant (no beat flash for Cells)
    float edges  = 0.25;                                   // edge intensity

    // Subtle global drift to give sense of movement through cells
    uv += vec2(u_time * 0.03, u_time * 0.005);
    float hue    = 0.55 + u_energy * 0.20 + u_bass * 0.10; // base hue

    // Increase scale for more compact/smaller cells
    vec2 vd = voronoi(uv, 22.0, u_time * speed + wobble);
    float cell = vd.x;            // distance to nearest
    float ridge = vd.y - vd.x;    // distance difference: highlights edges between nearest & second nearest

    // Color mapping
    float edgeShade = smoothstep(0.0, 0.25, ridge);
    float fillShade = smoothstep(0.9, 0.0, cell);

    float l = mix(0.25, 0.65, fillShade);
    float s = mix(0.6, 0.95, edgeShade);
    vec3 rgb = hsl2rgb(vec3(hue, s, l));

    // Edge glow on pulses
    float glow = smoothstep(0.0, 0.12, ridge) * edges; // no pulse contribution
    rgb += glow * vec3(1.0, 1.0, 1.0);

    // Output with alpha for compositing
    gl_FragColor = vec4(rgb, 0.95);
  }
`;

export async function renderHighGfxCellsWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
): Promise<HTMLCanvasElement> {
  let eng = engines.get(key);
  const W = Math.max(1, Math.floor(width));
  const H = Math.max(1, Math.floor(height));
  if (!eng) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
    camera.position.z = 1;

    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        u_time: { value: 0 },
        u_res: { value: new THREE.Vector2(W, H) },
        u_energy: { value: 0 },
        u_bass: { value: 0 },
        u_pulse: { value: 0 },
      },
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.5, 0.85);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, mesh: quad, material };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== W || eng.canvas.height !== H) {
    eng.renderer.setSize(W, H, false);
    (eng.material.uniforms.u_res.value as THREE.Vector2).set(W, H);
  }

  // Update uniforms from audio features
  const energy = THREE.MathUtils.clamp(features.energy, 0, 1);
  const bass = THREE.MathUtils.clamp(features.bassLevel, 0, 1);
  const pulse = THREE.MathUtils.clamp(features.beatPulse, 0, 1);
  (eng.material.uniforms.u_time as any).value = nowSec;
  (eng.material.uniforms.u_energy as any).value = energy;
  (eng.material.uniforms.u_bass as any).value = bass;
  (eng.material.uniforms.u_pulse as any).value = pulse;

  eng.composer.render();
  return eng.canvas;
}
