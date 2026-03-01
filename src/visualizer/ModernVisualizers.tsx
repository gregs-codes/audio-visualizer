import { useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';

// Perlin noise vertex shader from kuhung/audiovisualizer
const vertexShader = `
// Uniforms passed from JavaScript
uniform float u_time;      // Elapsed time for animations
uniform float u_frequency; // Average audio frequency for displacement

// --- Perlin Noise Functions (Classic Perlin 3D - periodic variant) ---
// Based on Stefan Gustavson's and Ian McEwan's GLSL implementation
// Source: https://github.com/ashima/webgl-noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float pnoise(vec3 P, vec3 rep) {
  vec3 Pi0 = mod(floor(P), rep);
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.y, Pi0.y, Pi1.y, Pi1.y);
  vec4 iz0 = vec4(Pi0.z);
  vec4 iz1 = vec4(Pi1.z);
  vec4 iz = vec4(iz0, iz1);
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixyz = permute(ixy + iz);
  vec4 gx = fract(ixyz * (1.0 / 41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 gz = vec4(0.5) - abs(gx);
  vec4 sz = step(gz, vec4(0.0));
  gx -= sz * (step(0.0, gx) - 0.5);
  vec3 g000 = vec3(gx.x, gy.x, gz.x);
  vec3 g100 = vec3(gx.y, gy.y, gz.y);
  vec3 g010 = vec3(gx.z, gy.z, gz.z);
  vec3 g110 = vec3(gx.w, gy.w, gz.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g000, g000), dot(g100, g100), dot(g010, g010), dot(g110, g110)));
  g000 *= norm.x;
  g100 *= norm.y;
  g010 *= norm.z;
  g110 *= norm.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.x, Pf1.y, Pf0.z));
  vec2 fade_xy = fade(Pf0.xy);
  float n_x = mix(n000, n100, fade_xy.x);
  float n_y = mix(n010, n110, fade_xy.x);
  float n_xy = mix(n_x, n_y, fade_xy.y);
  return 2.2 * n_xy;
}
void main() {
  float noise = 3.0 * pnoise(position + u_time, vec3(10.0));
  float displacement = 0.0;
  if (u_frequency > 0.0) {
    float normalized_freq = clamp(u_frequency / 30.0, 0.0, 2.0);
    displacement = normalized_freq * noise * 0.5;
  }
  vec3 newPosition = position + normal * displacement;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

// Fragment shader from kuhung/audiovisualizer
const fragmentShader = `
uniform float u_red;
uniform float u_green;
uniform float u_blue;
void main() {
    gl_FragColor = vec4(vec3(u_red, u_green, u_blue), 1.0);
}
`;

function VisualizerMesh({ frequency, color }: { frequency: number; color: { red: number; green: number; blue: number } }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useRef({
    u_time: { value: 0 },
    u_frequency: { value: frequency },
    u_red: { value: color.red },
    u_green: { value: color.green },
    u_blue: { value: color.blue },
  });

  useFrame(({ clock }: { clock: THREE.Clock }) => {
    if (meshRef.current && meshRef.current.material instanceof THREE.ShaderMaterial) {
      meshRef.current.material.uniforms.u_time.value = clock.getElapsedTime();
      meshRef.current.material.uniforms.u_frequency.value = frequency;
      meshRef.current.material.uniforms.u_red.value = color.red;
      meshRef.current.material.uniforms.u_green.value = color.green;
      meshRef.current.material.uniforms.u_blue.value = color.blue;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[4, 30]} />
      <shaderMaterial attach="material" uniforms={uniforms.current} vertexShader={vertexShader} fragmentShader={fragmentShader} wireframe />
    </mesh>
  );
}


// Add a prop for mode and switch between visualizer types
const ModernVisualizers = ({
  mode = 'high-graphics',
  frequency = 0,
  color = { red: 1, green: 1, blue: 1 }
}) => {
  function renderVisualizer() {
    switch (mode) {
      case 'high-graphics':
        return <VisualizerMesh frequency={frequency} color={color} />;
      // Scaffold for other modern visualizer types:
      case 'high-graphics-nebula':
        return <mesh><icosahedronGeometry args={[4, 30]} /><meshStandardMaterial color="purple" wireframe /></mesh>;
      case 'high-graphics-tunnel':
        return <mesh><torusGeometry args={[4, 1, 16, 100]} /><meshStandardMaterial color="cyan" wireframe /></mesh>;
      case 'high-graphics-curl':
        return <mesh><torusKnotGeometry args={[3, 0.7, 100, 16]} /><meshStandardMaterial color="orange" wireframe /></mesh>;
      case 'high-graphics-spiral':
        return <mesh><sphereGeometry args={[3, 32, 32]} /><meshStandardMaterial color="yellow" wireframe /></mesh>;
      case 'high-graphics-fog':
        return <mesh><boxGeometry args={[4, 4, 4]} /><meshStandardMaterial color="white" wireframe /></mesh>;
      case 'high-graphics-cells':
        return <mesh><octahedronGeometry args={[3, 2]} /><meshStandardMaterial color="lime" wireframe /></mesh>;
      case 'high-graphics-trunk':
        return <mesh><cylinderGeometry args={[1, 1, 6, 32]} /><meshStandardMaterial color="brown" wireframe /></mesh>;
      case 'high-graphics-rings':
        return <mesh><ringGeometry args={[2, 4, 32]} /><meshStandardMaterial color="magenta" wireframe /></mesh>;
      case 'high-graphics-rings-trails':
        return <mesh><ringGeometry args={[2, 4, 64]} /><meshStandardMaterial color="pink" wireframe /></mesh>;
      case 'high-graphics-kaleidoscope':
        return <mesh><dodecahedronGeometry args={[3, 1]} /><meshStandardMaterial color="teal" wireframe /></mesh>;
      case 'high-graphics-flow-field':
        return <mesh><torusGeometry args={[3, 0.5, 16, 100]} /><meshStandardMaterial color="aqua" wireframe /></mesh>;
      case 'high-graphics-hexagon':
        return <mesh><circleGeometry args={[3, 6]} /><meshStandardMaterial color="gold" wireframe /></mesh>;
      case 'high-graphics-hex-paths':
        return <mesh><circleGeometry args={[3, 12]} /><meshStandardMaterial color="orange" wireframe /></mesh>;
      case 'high-graphics-net':
        return <mesh><planeGeometry args={[6, 6, 10, 10]} /><meshStandardMaterial color="blue" wireframe /></mesh>;
      default:
        return <VisualizerMesh frequency={frequency} color={color} />;
    }
  }
  return (
    <Canvas style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      {renderVisualizer()}
      <PerspectiveCamera makeDefault position={[0, -2, 14]} />
    </Canvas>
  );
};

export default ModernVisualizers;
