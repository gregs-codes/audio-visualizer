import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/* Trunk effect (inspired by Vanta Trunk): swirly line field via layered noise stripes; alpha output */

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
  varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const fragment = `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time;
  uniform vec2 u_res;
  uniform float u_energy;
  uniform float u_bass;
  uniform float u_pulse;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  float fbm(vec2 p){ float v=0.0; float a=0.5; mat2 m=mat2(1.7,1.25,-1.25,1.7); for(int i=0;i<5;i++){ v += a*noise(p); p = m*p; a *= 0.5; } return v; }

  vec3 hsl2rgb(vec3 hsl){ vec3 rgb = clamp(abs(mod(hsl.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); rgb = rgb*rgb*(3.0-2.0*rgb); return hsl.z + hsl.y*(rgb-0.5)*(1.0-abs(2.0*hsl.z-1.0)); }

  uniform float u_viewTilt; // 0 top, 1 side
  void main(){
    vec2 uv = vUv; float aspect = u_res.x / max(1.0, u_res.y); uv.x *= aspect;
    uv.y = mix(uv.y, uv.y * 0.87 + (uv.x - 0.5*aspect) * 0.08, u_viewTilt);
    // Radial swirl field around center
    vec2 c = vec2(0.5*aspect, 0.5);
    vec2 d = uv - c;
    float r = length(d);
    float ang = atan(d.y, d.x);
    float beat = smoothstep(0.0, 1.0, u_pulse);
    float speed = (0.18 + u_energy * 0.35 + u_bass * 0.28) * (0.35 + 0.65 * beat);
    // Curved coordinate warp to emphasize trunk-like swirls
    vec2 p = vec2(ang * 2.0 + r * 1.2, r * 2.6) + vec2(u_time * speed * 0.6, -u_time * speed * 0.4);
    // Multi-stripe composition to increase line density
    float n1 = fbm(p);
    float n2 = fbm(p * 1.7 + vec2(1.3, -2.1));
    float s1 = 0.5 + 0.5 * sin(14.0 * n1 + u_time * speed);
    float s2 = 0.5 + 0.5 * sin(12.0 * n2 - u_time * speed * 0.9);
    float v = max(s1, s2);
    float lines = smoothstep(0.72, 0.94, v);
    // Warm amber palette similar to Vanta Trunk
    float hue = 0.06 + 0.02 * sin(u_time * 0.25);
    float sat = mix(0.65, 0.95, lines);
    float light = mix(0.20, 0.88, lines);
    vec3 rgb = hsl2rgb(vec3(hue, sat, light));
    // Audio-reactive thickness: boost line glow on bass/energy, gated by beat
    rgb += lines * (0.10 + (u_bass * 0.22 + u_energy * 0.08) * (0.35 + 0.65 * beat));
    gl_FragColor = vec4(rgb, 0.92);
  }
`;

export async function renderHighGfxTrunkWithFeatures(
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
    renderer.setPixelRatio(1); renderer.setSize(W,H,false); renderer.setClearColor(0x000000,0);
    const scene = new THREE.Scene(); scene.background = null;
    const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.01,10); camera.position.z = 1;
    const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { u_time: { value: 0 }, u_res: { value: new THREE.Vector2(W,H) }, u_energy: { value: 0 }, u_bass: { value: 0 }, u_pulse: { value: 0 }, u_viewTilt: { value: 0 } } });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material); scene.add(quad);
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W,H), 0.6, 0.6, 0.8); composer.addPass(bloom);
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
