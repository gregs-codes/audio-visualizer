import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/*
  Beat Kaleidoscope Engine (original implementation):
  - Fullscreen shader with kaleidoscope sector folding.
  - Combines radial waves, angular stripes, and dot accents.
  - Audio features drive rotation speed, warp, glow, and hue.
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

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time; // seconds
  uniform vec2 u_res;   // resolution
  uniform float u_energy; // 0..1
  uniform float u_bass;   // 0..1
  uniform float u_pulse;  // 0..1

  // Fast hash
  float hash(float n){ return fract(sin(n)*43758.5453123); }

  // HSL to RGB
  vec3 hsl2rgb(vec3 hsl){
    vec3 rgb = clamp(abs(mod(hsl.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return hsl.z + hsl.y*(rgb-0.5)*(1.0-abs(2.0*hsl.z-1.0));
  }

  // Rotate
  vec2 rot(vec2 p, float a){
    float c=cos(a), s=sin(a);
    return vec2(c*p.x - s*p.y, s*p.x + c*p.y);
  }

  void main(){
    // Normalize and center coordinates
    vec2 uv = vUv;
    float aspect = u_res.x / max(1.0, u_res.y);
    uv.x = (uv.x - 0.5) * aspect;
    uv.y -= 0.5;

    // Global motion parameters
    float beat = smoothstep(0.0, 1.0, u_pulse);
    float energy = u_energy;
    float bass = u_bass;

    // Kaleidoscope sector count (audio-reactive)
    float sectorsF = mix(6.0, 10.0, clamp(energy + bass*0.5, 0.0, 1.0));
    float sectors = floor(sectorsF);

    // Time-based rotation, slower base and gated by beat
    float rotSpeed = (0.12 + energy*0.25 + bass*0.20) * (0.35 + 0.65 * beat);
    float t = u_time * rotSpeed;

    // Warp and scale
    float warp = (0.04 + energy*0.08 + bass*0.14) * (0.35 + 0.65 * beat);
    vec2 p = uv;
    p = rot(p, t*0.35);
    p += vec2(sin(t*0.7)*warp, cos(t*0.6)*warp);

    // Polar coordinates
    float r = length(p);
    float a = atan(p.y, p.x);

    // Sector folding (kaleidoscope)
    float sectorAngle = 6.28318530718 / max(1.0, sectors);
    a = mod(a, sectorAngle);
    if(a > sectorAngle*0.5) a = sectorAngle - a; // mirror within sector

    // Reconstruct folded position
    vec2 q = vec2(cos(a), sin(a)) * r;

    // Layer 1: radial waves (rings)
    float ringFreq = 6.0 + energy*12.0;
    float rings = 0.5 + 0.5*cos(r*ringFreq - t*3.0);
    float ringMask = smoothstep(0.65, 0.95, rings);

    // Layer 2: angular stripes within sector
    float stripes = 0.5 + 0.5*sin(a*sectors*2.0 + t*1.4);
    stripes = pow(stripes, 1.8);

    // Layer 3: dotted accents
    float id = floor(r*4.0 + a*12.0);
    float jitter = hash(id);
    float dot = smoothstep(0.015, 0.0, abs(fract(r*3.0 + jitter) - 0.5));
    dot *= smoothstep(0.2, 0.0, r);

    // Audio glow
    float glow = beat*0.7 + energy*0.4 + bass*0.5;

    // Composite
    float shade = ringMask*0.55 + stripes*0.35 + dot*0.6;

    // Color mapping (neon palette)
    float hue = fract(0.62 + energy*0.18 + bass*0.12 + beat*0.10 + t*0.02);
    float sat = mix(0.65, 0.95, shade);
    float lum = mix(0.15, 0.65, shade) + glow*0.15;
    vec3 base = hsl2rgb(vec3(hue, sat, lum));

    // Additional edge glow near center
    float centerGlow = smoothstep(0.25, 0.0, r);
    base += vec3(1.0, 1.0, 1.0) * centerGlow * (0.15 + glow*0.25);

    gl_FragColor = vec4(base, 0.95);
  }
`;

export async function renderHighGfxKaleidoscopeWithFeatures(
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
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.95, 0.55, 0.85);
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
