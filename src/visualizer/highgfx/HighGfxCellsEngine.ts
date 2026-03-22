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
  uniform float u_time;
  uniform vec2  u_res;
  uniform float u_energy;
  uniform float u_bass;
  uniform float u_pulse;
  uniform vec3 u_centerColor;
  uniform vec3 u_lineColor;
  uniform vec3 u_bgColor;

  float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
  vec2  hash21(float p){ return vec2(hash11(p), hash11(p+17.17)); }

  // Smooth noise for membrane wobble
  float smoothNoise(vec2 p){
    vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash11(i.x+i.y*57.0);
    float b=hash11(i.x+1.0+i.y*57.0);
    float c=hash11(i.x+(i.y+1.0)*57.0);
    float d=hash11(i.x+1.0+(i.y+1.0)*57.0);
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }
  float fbm(vec2 p){ return 0.5*smoothNoise(p)+0.25*smoothNoise(p*2.1)+0.125*smoothNoise(p*4.3); }

  // Voronoi — few large cells (low scale = fewer tiles)
  vec2 voronoi(vec2 uv, float scale, float time) {
    vec2 grid = uv * scale;
    vec2 gi = floor(grid); vec2 gf = fract(grid);
    float d1 = 1e9, d2 = 1e9;
    for (int y = -2; y <= 2; y++) {
      for (int x = -2; x <= 2; x++) {
        vec2 cell = gi + vec2(float(x), float(y));
        float idx = cell.x + cell.y * 57.0;
        vec2 rnd = hash21(idx);
        // Very slow, independent drift per cell
        vec2 seed = rnd + 0.18 * vec2(sin(time * 0.18 + idx*1.3), cos(time * 0.14 + idx*0.9));
        vec2 diff = vec2(float(x), float(y)) + seed - gf;
        float d = dot(diff, diff);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return vec2(sqrt(d1), sqrt(d2));
  }

  void main() {
    vec2 uv = vUv;
    float aspect = u_res.x / max(1.0, u_res.y);
    uv.x *= aspect;

    // Extremely slow global drift — microscope slide movement
    uv += vec2(u_time * 0.008, u_time * 0.004);

    // Low scale = few large biological cells (6–8 visible on screen)
    float scale = 3.8;
    vec2 vd = voronoi(uv, scale, u_time);
    float cell  = vd.x;
    float ridge = vd.y - vd.x; // border between cells

    // FBM noise for organic membrane texture
    float membrane = fbm(uv * 4.5 + u_time * 0.04);

    // --- Cell body ---
    // translucent interior, tinted by u_panelColor
    float bodyMask = smoothstep(0.55, 0.25, cell);
      vec3 baseBodyColor = vec3(0.04, 0.14, 0.18) + membrane * 0.06 * vec3(0.2, 0.8, 0.7);
      vec3 bodyColor = mix(u_bgColor, u_lineColor, 0.2) + membrane * 0.04 * u_lineColor;

    // --- Membrane / edge glow ---
    float edgeMask = smoothstep(0.22, 0.04, ridge);
    float edgeGlow = edgeMask * (0.6 + u_energy * 0.4 + u_pulse * 0.5);
      vec3 edgeColor = u_lineColor * edgeGlow;

    // --- Nucleus ---
    float nucleusMask = smoothstep(0.18, 0.04, cell);
    float nucleusPulse = nucleusMask * (0.35 + u_bass * 0.55 + u_pulse * 0.4);
      vec3 nucleusColor = u_centerColor * nucleusPulse;

    // --- Compose ---
    vec3 col = bodyColor * bodyMask + edgeColor + nucleusColor;

    // Use user background color
    col = mix(u_bgColor, col, clamp(bodyMask + edgeMask * 0.5, 0.0, 1.0));

    // Gentle vignette
    vec2 vuv = vUv - 0.5;
    float vign = 1.0 - dot(vuv, vuv) * 1.6;
    col *= clamp(vign, 0.0, 1.0);

    gl_FragColor = vec4(col, 0.97);
  }
`;

export async function renderHighGfxCellsWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
  colors?: { center: string; lines: string; bg: string },
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
          u_centerColor: { value: new THREE.Color(0.3, 0.9, 0.85) },
          u_lineColor: { value: new THREE.Color(0.15, 0.85, 0.75) },
          u_bgColor: { value: new THREE.Color(0.04, 0.14, 0.18) },
      },
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.6, 0.75);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, mesh: quad, material };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== W || eng.canvas.height !== H) {
    eng.renderer.setSize(W, H, false);
    eng.composer.setSize(W, H);
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
  // Set color uniforms every frame, with fallback to default if missing
  const center = (colors && colors.center) ? colors.center : '#ffffff';
  const lines = (colors && colors.lines) ? colors.lines : '#00ffff';
  const bg = (colors && colors.bg) ? colors.bg : '#000000';
  // Debug log
  // console.log('Cells colors:', { center, lines, bg });
  (eng.material.uniforms.u_centerColor.value as THREE.Color).set(center);
  (eng.material.uniforms.u_lineColor.value as THREE.Color).set(lines);
  (eng.material.uniforms.u_bgColor.value as THREE.Color).set(bg);

  eng.composer.render();
  return eng.canvas;
}
