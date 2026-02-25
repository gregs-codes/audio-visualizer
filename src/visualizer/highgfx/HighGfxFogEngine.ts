import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/* Fog effect (inspired by Vanta Fog): procedural FBM noise with alpha */

type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  composer: EffectComposer;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
};

const engines = new Map<string, Engine>();

const vertex = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const fragment = `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time;
  uniform vec2 u_res;
  uniform float u_energy;
  uniform float u_bass;
  uniform float u_pulse;
  uniform float u_viewTilt; // 0 top, 1 side

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
  float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); float a=hash(i); float b=hash(i+vec2(1.0,0.0)); float c=hash(i+vec2(0.0,1.0)); float d=hash(i+vec2(1.0,1.0)); vec2 u=f*f*(3.0-2.0*f); return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y; }
  float fbm(vec2 p){ float v=0.0; float a=0.5; mat2 m=mat2(1.7,1.2,-1.2,1.7); for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=0.5; } return v; }

  // Color ramp resembling Vanta Fog palette
  vec3 ramp(float t){
    // dark navy -> teal -> light blue
    vec3 c1 = vec3(0.06,0.08,0.12);
    vec3 c2 = vec3(0.10,0.45,0.60);
    vec3 c3 = vec3(0.65,0.80,0.95);
    t = clamp(t, 0.0, 1.0);
    vec3 mid = mix(c1, c2, smoothstep(0.0, 0.6, t));
    return mix(mid, c3, smoothstep(0.6, 1.0, t));
  }

  void main(){
    vec2 uv = vUv; float aspect = u_res.x / max(1.0, u_res.y); uv.x *= aspect;
    // side tilt skew
    uv.y = mix(uv.y, uv.y * 0.85 + (uv.x - 0.5*aspect) * 0.06, u_viewTilt);
    float beat = smoothstep(0.0, 1.0, u_pulse);
    float speed = (0.06 + u_bass * 0.18 + u_energy * 0.18) * (0.35 + 0.65 * beat);
    // Two-layer FBM with opposite drifts for parallax
    vec2 p1 = uv * 2.2 + vec2(u_time * speed, -u_time * speed * 0.55);
    vec2 p2 = (uv + vec2(0.2, -0.15)) * 3.4 + vec2(-u_time * speed * 0.65, u_time * speed * 0.4);
    float n1 = fbm(p1);
    float n2 = fbm(p2);
    float fogField = clamp(0.5 * n1 + 0.5 * n2, 0.0, 1.0);
    // Subtle directional gradient (light from top-right)
    float lightDir = clamp(0.6 + (uv.x/aspect) * 0.12 + (1.0-uv.y) * 0.18, 0.0, 1.0);
    float density = smoothstep(0.35, 0.9, fogField) * (0.8 + 0.2 * lightDir);
    // Audio-reactive thickness
    float thickness = 0.50 + (u_bass * 0.18 + u_energy * 0.18) * (0.3 + 0.7 * beat);
    vec3 color = ramp(density);
    float alpha = clamp(thickness * density, 0.0, 0.85);
    gl_FragColor = vec4(color, alpha);
  }
`;

export async function renderHighGfxFogWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
  opts?: { view?: 'top'|'side' }
): Promise<HTMLCanvasElement>{
  let eng = engines.get(key);
  const W = Math.max(1, Math.floor(width));
  const H = Math.max(1, Math.floor(height));
  if(!eng){
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1);
    renderer.setSize(W,H,false);
    renderer.setClearColor(0x000000,0);
    const scene = new THREE.Scene(); scene.background = null;
    const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.01,10); camera.position.z = 1;
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment, transparent: true, depthTest: false,
      blending: THREE.AdditiveBlending, uniforms: { u_time: { value: 0 }, u_res: { value: new THREE.Vector2(W,H) }, u_energy: { value: 0 }, u_bass: { value: 0 }, u_pulse: { value: 0 }, u_viewTilt: { value: 0 } }
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material); scene.add(quad);
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W,H), 0.55, 0.5, 0.85); composer.addPass(bloom);
    eng = { canvas, renderer, scene, camera, composer, material, mesh: quad }; engines.set(key, eng);
  }
  if(eng.canvas.width!==W || eng.canvas.height!==H){ eng.renderer.setSize(W,H,false); (eng.material.uniforms.u_res.value as THREE.Vector2).set(W,H); }
  (eng.material.uniforms.u_time as any).value = nowSec;
  (eng.material.uniforms.u_energy as any).value = THREE.MathUtils.clamp(features.energy,0,1);
  (eng.material.uniforms.u_bass as any).value = THREE.MathUtils.clamp(features.bassLevel,0,1);
  (eng.material.uniforms.u_pulse as any).value = THREE.MathUtils.clamp(features.beatPulse,0,1);
  (eng.material.uniforms.u_viewTilt as any).value = (opts?.view === 'side') ? 1.0 : 0.0;
  eng.composer.render(); return eng.canvas;
}
