import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/*
  Flow Field HD (original):
  - Fullscreen shader rendering flow lines via curl noise.
  - Lines advect slowly; speed and thickness gated by beat.
  - Palette blends teal/magenta; additive bloom for neon look.
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
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time;
  uniform vec2  u_res;
  uniform float u_energy;
  uniform float u_bass;
  uniform float u_pulse;
  uniform float u_viewTilt; // 0 top, 1 side

  // Hash & noise
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
  float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); float a=hash(i); float b=hash(i+vec2(1.0,0.0)); float c=hash(i+vec2(0.0,1.0)); float d=hash(i+vec2(1.0,1.0)); vec2 u=f*f*(3.0-2.0*f); return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y; }
  float fbm(vec2 p){ float v=0.0; float a=0.5; mat2 m=mat2(1.7,1.2,-1.2,1.7); for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=0.5; } return v; }

  // Curl of noise field (approximate)
  vec2 curl(vec2 p){
    float e = 0.001;
    float n1 = fbm(p + vec2(0.0, e));
    float n2 = fbm(p - vec2(0.0, e));
    float n3 = fbm(p + vec2(e, 0.0));
    float n4 = fbm(p - vec2(e, 0.0));
    float cx = n1 - n2;
    float cy = n3 - n4;
    return normalize(vec2(cx, -cy));
  }

  vec3 hsl2rgb(vec3 hsl){ vec3 rgb = clamp(abs(mod(hsl.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); rgb = rgb*rgb*(3.0-2.0*rgb); return hsl.z + hsl.y*(rgb-0.5)*(1.0-abs(2.0*hsl.z-1.0)); }

  void main(){
    vec2 uv = vUv; float aspect = u_res.x / max(1.0, u_res.y); uv.x *= aspect;
    uv.y = mix(uv.y, uv.y * 0.88 + (uv.x - 0.5*aspect) * 0.06, u_viewTilt);

    float beat = smoothstep(0.0, 1.0, u_pulse);
    float speed = (0.06 + u_energy * 0.10 + u_bass * 0.12) * (0.35 + 0.65 * beat);
    float thickness = (0.6 + u_bass * 0.5 + u_energy * 0.3) * (0.35 + 0.65 * beat);

    // Seed for streamlines
    vec2 p = uv * 2.2 + vec2(sin(u_time*0.15), cos(u_time*0.12));
    // Accumulate line contributions along short advection
    float acc = 0.0;
    vec3 col = vec3(0.0);
    vec2 pos = p;
    for(int i=0;i<14;i++){
      vec2 dir = curl(pos + vec2(u_time * speed, -u_time * speed*0.85));
      pos += dir * 0.03;
      float d = abs(fract(fbm(pos*2.0) + 0.5) - 0.5);
      float line = smoothstep(0.15, 0.02, d);
      float hue = 0.55 + 0.25 * sin(u_time*0.20 + float(i)*0.18);
      float sat = 0.75;
      float lum = 0.25 + 0.55 * line;
      vec3 rgb = hsl2rgb(vec3(hue, sat, lum));
      col += rgb * (0.08 + 0.92 * line) * (0.5 + 0.5 * beat);
      acc += line;
    }
    col /= 14.0;
    // Subtle center glow
    float cg = smoothstep(0.35, 0.0, distance(uv, vec2(0.5*aspect,0.5)));
    col += vec3(1.0) * cg * 0.10 * (0.4 + 0.6 * beat);

    gl_FragColor = vec4(col, 0.92);
  }
`;

export async function renderHighGfxFlowFieldWithFeatures(
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
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10); camera.position.z = 1;
    const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { u_time: { value: 0 }, u_res: { value: new THREE.Vector2(W,H) }, u_energy: { value: 0 }, u_bass: { value: 0 }, u_pulse: { value: 0 }, u_viewTilt: { value: 0 } } });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); scene.add(quad);
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.75, 0.55, 0.85); composer.addPass(bloom);
    eng = { canvas, renderer, scene, camera, composer, mesh: quad, material }; engines.set(key, eng);
  }
  if (eng.canvas.width !== W || eng.canvas.height !== H) { eng.renderer.setSize(W, H, false); (eng.material.uniforms.u_res.value as THREE.Vector2).set(W, H); }
  (eng.material.uniforms.u_time as any).value = nowSec;
  (eng.material.uniforms.u_energy as any).value = THREE.MathUtils.clamp(features.energy, 0, 1);
  (eng.material.uniforms.u_bass as any).value = THREE.MathUtils.clamp(features.bassLevel, 0, 1);
  (eng.material.uniforms.u_pulse as any).value = THREE.MathUtils.clamp(features.beatPulse, 0, 1);
  (eng.material.uniforms.u_viewTilt as any).value = (opts?.view === 'side') ? 1.0 : 0.0;
  eng.composer.render(); return eng.canvas;
}
