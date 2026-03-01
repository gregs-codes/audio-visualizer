import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

/*
  Hex Paths HD:
  - Renders only hex outlines over black.
  - Multi-color highlights travel along the hex edges in three families
    (0°, +60°, -60°) and expand across the grid, driven by audio.
  - Motion is gated by beat and bass; supports top/side view tilt.
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

  const float PI = 3.141592653589793;
  const float SQ3 = 1.7320508075688772;

  vec3 hsl2rgb(vec3 hsl){ vec3 rgb = clamp(abs(mod(hsl.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); rgb = rgb*rgb*(3.0-2.0*rgb); return hsl.z + hsl.y*(rgb-0.5)*(1.0-abs(2.0*hsl.z-1.0)); }

  // Signed distance to a centered hex (radius r)
  float sdHex(vec2 p, float r){
    p = abs(p);
    float k = 0.57735026919; // 1/sqrt(3)
    float d = max(dot(p, vec2(k, 0.5)), p.x) - r;
    return d;
  }

  // Axial conversions
  vec2 axialToPixel(vec2 qr, float s){
    float x = s * (SQ3 * qr.x + SQ3/2.0 * qr.y);
    float y = s * (1.5 * qr.y);
    return vec2(x, y);
  }
  vec2 pixelToAxial(vec2 p, float s){
    float q = (SQ3/3.0 * p.x - 1.0/3.0 * p.y) / s;
    float r = (2.0/3.0 * p.y) / s;
    return vec2(q, r);
  }
  vec2 axialRound(vec2 qr){
    float x = qr.x; float z = qr.y; float y = -x - z;
    float rx = round(x), ry = round(y), rz = round(z);
    float dx = abs(rx-x), dy = abs(ry-y), dz = abs(rz-z);
    if(dx>dy && dx>dz) rx = -ry - rz; else if(dy>dz) ry = -rx - rz; else rz = -rx - ry;
    return vec2(rx, rz);
  }

  float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

  void main(){
    vec2 uv = vUv; float aspect = u_res.x / max(1.0, u_res.y); uv.x *= aspect;
    uv.y = mix(uv.y, uv.y * 0.90 + (uv.x - 0.5*aspect) * 0.06, u_viewTilt);

    // World coords centered
    vec2 p = (uv - vec2(0.5*aspect, 0.5)) * 2.4;
    float beat = smoothstep(0.0, 1.0, u_pulse);
    float s = 0.22; // hex radius
    p += vec2(sin(u_time * 0.12), cos(u_time * 0.10)) * (0.12 + 0.25 * beat);

    vec2 qr = pixelToAxial(p, s);
    vec2 hqr = axialRound(qr);
    vec2 hc  = axialToPixel(hqr, s);
    vec2 lp  = p - hc; // local in cell

    float d = sdHex(lp, s * 0.98);
    float t = fwidth(d);
    float edge = 1.0 - smoothstep(t * 0.8, t * 1.6, abs(d));

    // Randomly select clusters of hexes to light up
    float clusterSeed = hash12(hqr + floor(u_time * 0.7));
    float clusterActive = step(0.85 - 0.45 * beat, clusterSeed); // more clusters on beat
    float clusterFade = smoothstep(0.0, 0.15 + 0.5 * beat, clusterSeed);

    // Color for active clusters
    vec3 clusterColor = hsl2rgb(vec3(0.08 + 0.12 * hash12(hqr), 0.85, 0.55));

    // Base grid line (dim) so hex lattice is always visible
    vec3 base = hsl2rgb(vec3(0.08, 0.6, 0.15));
    vec3 color = edge * (base * 0.25);
    // Add cluster highlights
    color += edge * clusterActive * clusterFade * clusterColor * (0.7 + 0.6 * beat);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export async function renderHighGfxHexPathsWithFeatures(
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
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10); camera.position.z = 1;
    const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { u_time: { value: 0 }, u_res: { value: new THREE.Vector2(W,H) }, u_energy: { value: 0 }, u_bass: { value: 0 }, u_pulse: { value: 0 }, u_viewTilt: { value: 0 } } });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); scene.add(quad);
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.6, 0.85); composer.addPass(bloom);
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
