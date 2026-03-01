import React, { useRef, useEffect } from 'react';

// Pure WebGL beast mode visualizer (no Three.js)
// This component creates a WebGL canvas, compiles shaders, and animates a disc mesh with audio-reactive deformation

const vertexShaderSource = `
attribute vec2 aPosition;
uniform float uTime;
uniform float uAudio[64];
varying float vRadius;
varying vec2 vUv;

float ripple(float r, float t, float amp, float freq, float speed) {
  return sin((r * freq - t * speed) * 6.2831) * amp / (1.0 + 10.0 * r);
}

void main() {
  vUv = aPosition * 0.5 + 0.5;
  vRadius = length(aPosition);
  float t = uTime;
  float freq = 8.0;
  float speed = 0.5;
  float rippleSum = 0.0;
  for (int i = 0; i < 32; i++) {
    float band = float(i) / 32.0;
    float a = uAudio[i] * 0.5;
    rippleSum += ripple(vRadius, t + band * 0.2, a, freq + float(i), speed + band);
  }
  float height = 0.18 * rippleSum;
  gl_Position = vec4(aPosition.x, height, aPosition.y, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;
varying float vRadius;
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor;

void main() {
  float vignette = smoothstep(0.95, 0.7, vRadius);
  vec3 color = mix(vec3(0.1,0.1,0.1), uColor, vignette);
  float alpha = vignette;
  if (vRadius > 1.0) discard;
  gl_FragColor = vec4(color, alpha);
}
`;

function createDiscMesh(segments = 128) {
  const positions = [];
  for (let i = 0; i < segments; i++) {
    const theta1 = (i / segments) * Math.PI * 2;
    const theta2 = ((i + 1) / segments) * Math.PI * 2;
    positions.push(0, 0);
    positions.push(Math.cos(theta1), Math.sin(theta1));
    positions.push(Math.cos(theta2), Math.sin(theta2));
  }
  return new Float32Array(positions);
}

const BeastShaderCanvas = ({ width = 512, height = 512, color = { r: 1, g: 1, b: 1 }, analyser, backgroundColor, backgroundImageUrl, backgroundFit = 'cover', backgroundOpacity = 1 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // Compile shaders
    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }
      return shader;
    }
    const vShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Mesh
    const positions = createDiscMesh(128);
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uAudio = gl.getUniformLocation(program, 'uAudio');
    const uColor = gl.getUniformLocation(program, 'uColor');

    // Animation
    let start = performance.now();
    const audioArr = new Float32Array(64);
    function render() {
      const now = performance.now();
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(uTime, (now - start) * 0.001);
      gl.uniform3f(uColor, color.r, color.g, color.b);
      if (analyser) {
        analyser.getFloatFrequencyData(audioArr);
        const norm = Array.from(audioArr).map(v => Math.max(0, (v + 100) / 60));
        gl.uniform1fv(uAudio, norm);
      } else {
        gl.uniform1fv(uAudio, new Float32Array(64));
      }
      gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
      requestAnimationFrame(render);
    }
    render();

    return () => {
      // Cleanup
      gl.deleteBuffer(posBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vShader);
      gl.deleteShader(fShader);
    };
  }, [width, height, color, analyser]);

  return (
    <div style={{ position: 'relative', width, height }}>
      {backgroundColor && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor, opacity: backgroundOpacity, zIndex: 0, borderRadius: '50%' }} />
      )}
      {backgroundImageUrl && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${backgroundImageUrl})`,
          backgroundSize: backgroundFit === 'stretch' ? '100% 100%' : backgroundFit,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: backgroundOpacity,
          zIndex: 0,
          borderRadius: '50%',
        }} />
      )}
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height, background: backgroundColor || '#000', borderRadius: '50%', position: 'relative', zIndex: 1 }} />
    </div>
  );
};

export default BeastShaderCanvas;
