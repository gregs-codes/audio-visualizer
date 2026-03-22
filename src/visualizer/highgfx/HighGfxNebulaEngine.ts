import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioFeatures } from '../../audio/audioFeatures';

// Engine state for Nebula variant (additive clouds + bloom)
type BeatFlash = { mesh: THREE.Mesh; spawnTime: number; life: number; vx: number; vy: number };
type Engine = {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  clouds: THREE.Mesh[];
  distantNebulae: THREE.Mesh[];
  closeBodies: THREE.Mesh[];
  flashGroup: THREE.Group;
  flashPool: BeatFlash[];
  orbTextures: THREE.CanvasTexture[];
  orbIndex: number;
  zoneIndex: number;
  lastPulse: number;
};

// Cache per-key engines (preview/export isolation)
const engines = new Map<string, Engine>();

/**
 * Render Nebula variant: alpha clouds reacting to beat/energy.
 */
export async function renderHighGfxNebulaWithFeatures(
  key: string,
  width: number,
  height: number,
  features: AudioFeatures,
  nowSec: number,
): Promise<HTMLCanvasElement> {
  let eng = engines.get(key);
  if (!eng) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true , preserveDrawingBuffer: true});
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.background = null;
    // Narrower FOV = telephoto "deep space" compression
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 4000);
    camera.position.set(0, 0, 380);

    // Deep space background quad (very dark navy)
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x01010d, side: THREE.FrontSide, depthWrite: false });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), bgMat);
    bgMesh.position.z = -900;
    scene.add(bgMesh);

    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(amb);


    // Nebula clouds — pushed far back, dim and wispy like a distant nebula
    const clouds: THREE.Mesh[] = [];
    const cloudCount = 16;
    for (let i = 0; i < cloudCount; i++) {
      const geom = new THREE.PlaneGeometry(200 + Math.random() * 120, 140 + Math.random() * 80);
      // Use a canvas texture for noise and color gradient
      const texCanvas = document.createElement('canvas');
      texCanvas.width = 256; texCanvas.height = 256;
      const ctx = texCanvas.getContext('2d');
      if (ctx) {
        // Radial gradient with random color, full transparency at edge, and perfect circular alpha mask
        const grad = ctx.createRadialGradient(128, 128, 10 + Math.random()*30, 128, 128, 128);
        const hue = 200 + Math.random() * 120;
        grad.addColorStop(0, `hsla(${hue},100%,70%,1)`);
        grad.addColorStop(0.5, `hsla(${hue+Math.random()*40-20},100%,60%,0.7)`);
        grad.addColorStop(0.85, `hsla(${hue+Math.random()*60-30},100%,40%,0.15)`);
        grad.addColorStop(1, `hsla(${hue+Math.random()*60-30},100%,40%,0)`);
        ctx.clearRect(0, 0, 256, 256);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        // Add noise, but apply a perfect circular alpha mask
        const imgData = ctx.getImageData(0, 0, 256, 256);
        for (let y = 0; y < 256; y++) {
          for (let x = 0; x < 256; x++) {
            const dx = x - 128;
            const dy = y - 128;
            const dist = Math.sqrt(dx*dx + dy*dy) / 128;
            const idx = (y * 256 + x) * 4;
            const n = (Math.random() - 0.5) * 32;
            imgData.data[idx] = Math.min(255, Math.max(0, imgData.data[idx] + n));
            imgData.data[idx+1] = Math.min(255, Math.max(0, imgData.data[idx+1] + n));
            imgData.data[idx+2] = Math.min(255, Math.max(0, imgData.data[idx+2] + n));
            // Apply a hard circular alpha mask (fully transparent outside the circle)
            if (dist > 1) {
              imgData.data[idx+3] = 0;
            } else {
              // Feather alpha for extra softness at edge
              const feather = dist > 0.85 ? (1 - dist) / 0.15 : 1;
              imgData.data[idx+3] = Math.floor(imgData.data[idx+3] * Math.max(0, Math.min(1, feather)));
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
      const tex = new THREE.CanvasTexture(texCanvas);
      tex.needsUpdate = true;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.13 + Math.random()*0.10, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(geom, mat);
      // Scatter clouds far back in Z for deep-space parallax
      mesh.position.set((Math.random() - 0.5) * 300, (Math.random() - 0.5) * 200, -100 - Math.random() * 400);
      mesh.rotation.z = Math.random() * Math.PI;
      scene.add(mesh);
      clouds.push(mesh);
    }

    // Create a circular glow sprite texture (white center → transparent edge)
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 64; spriteCanvas.height = 64;
    const sCtx = spriteCanvas.getContext('2d')!;
    const spriteGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    spriteGrad.addColorStop(0,   'rgba(255,255,255,1)');
    spriteGrad.addColorStop(0.2, 'rgba(255,255,255,0.9)');
    spriteGrad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    spriteGrad.addColorStop(1,   'rgba(255,255,255,0)');
    sCtx.clearRect(0, 0, 64, 64);
    sCtx.fillStyle = spriteGrad;
    sCtx.fillRect(0, 0, 64, 64);
    const spriteTex = new THREE.CanvasTexture(spriteCanvas);

    // Add deep-space starfield — many tiny stars scattered at great depth
    const starGroup = new THREE.Group();
    const starCount = 220;
    for (let i = 0; i < starCount; i++) {
      const starGeom = new THREE.BufferGeometry();
      const starVerts = new Float32Array([0, 0, 0]);
      starGeom.setAttribute('position', new THREE.BufferAttribute(starVerts, 3));
      const starHue = 40 + Math.random() * 320;
      const starColor = new THREE.Color(`hsl(${starHue},80%,75%)`);
      const baseSize = 1.2 + Math.random() * 5.5;
      const isLarge = baseSize > 5.5;
      const starMat = new THREE.PointsMaterial({
        color: starColor,
        map: spriteTex,
        size: baseSize,
        sizeAttenuation: true,
        transparent: true,
        opacity: isLarge ? 0.22 : 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        alphaTest: 0.001,
      });
      const star = new THREE.Points(starGeom, starMat);
      // Spread stars across a huge depth range
      const sz = -20 - Math.random() * 700;
      star.position.set((Math.random()-0.5)*500, (Math.random()-0.5)*380, sz);
      star.userData.baseSize = baseSize;
      star.userData.baseOpacity = isLarge ? 0.18 + Math.random() * 0.10 : 0.08 + Math.random() * 0.07;
      star.userData.isLarge = isLarge;
      star.userData.pulseSpeed = 0.10 + Math.random() * 0.08;
      star.userData.pulsePhase = Math.random() * Math.PI * 2;
      starGroup.add(star);
    }
    scene.add(starGroup);

    // Build 6 distinct orb textures — one per chord style
    function makeOrbTex(drawFn: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const x = c.getContext('2d')!; drawFn(x); return new THREE.CanvasTexture(c);
    }
    const orbTextures: THREE.CanvasTexture[] = [
      // 0 — tight spike (bright hot core, very narrow falloff)
      makeOrbTex(ctx => {
        const g = ctx.createRadialGradient(64,64,0,64,64,64);
        g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.08,'rgba(255,255,255,0.95)');
        g.addColorStop(0.25,'rgba(255,255,255,0.3)'); g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
      }),
      // 1 — soft wide halo (broad glow, dim centre)
      makeOrbTex(ctx => {
        const g = ctx.createRadialGradient(64,64,12,64,64,64);
        g.addColorStop(0,'rgba(255,255,255,0.2)'); g.addColorStop(0.3,'rgba(255,255,255,0.7)');
        g.addColorStop(0.6,'rgba(255,255,255,0.35)'); g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
      }),
      // 2 — ring (empty centre, glowing ring edge)
      makeOrbTex(ctx => {
        const g = ctx.createRadialGradient(64,64,30,64,64,64);
        g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.45,'rgba(255,255,255,0.05)');
        g.addColorStop(0.65,'rgba(255,255,255,0.9)'); g.addColorStop(0.8,'rgba(255,255,255,0.4)');
        g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
      }),
      // 3 — double ring (two concentric glowing bands)
      makeOrbTex(ctx => {
        const g = ctx.createRadialGradient(64,64,0,64,64,64);
        g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.28,'rgba(255,255,255,0.8)');
        g.addColorStop(0.42,'rgba(255,255,255,0.1)'); g.addColorStop(0.62,'rgba(255,255,255,0.7)');
        g.addColorStop(0.78,'rgba(255,255,255,0.1)'); g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
      }),
      // 4 — corona (solid core + long diffuse corona)
      makeOrbTex(ctx => {
        const g = ctx.createRadialGradient(64,64,0,64,64,64);
        g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.12,'rgba(255,255,255,1)');
        g.addColorStop(0.3,'rgba(255,255,255,0.55)'); g.addColorStop(0.6,'rgba(255,255,255,0.18)');
        g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
      }),
      // 5 — nebula puff (large, very soft, lumpy feel via layered ovals)
      makeOrbTex(ctx => {
        ctx.clearRect(0,0,128,128);
        for (let layer=0; layer<4; layer++) {
          const ox=54+layer*4, oy=54+layer*3, rx=36+layer*6, ry=30+layer*5;
          const g = ctx.createRadialGradient(ox,oy,0,ox,oy,Math.max(rx,ry));
          g.addColorStop(0,`rgba(255,255,255,${0.35-layer*0.07})`);
          g.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=g;
          ctx.save(); ctx.scale(rx/Math.max(rx,ry),ry/Math.max(rx,ry)); ctx.fillRect(0,0,128/Math.min(rx/Math.max(rx,ry),1),128/Math.min(ry/Math.max(rx,ry),1)); ctx.restore();
        }
      }),
    ];

    const flashGroup = new THREE.Group();
    scene.add(flashGroup);

    // --- Distant pulsating nebulae (5 unique shapes + colors far in Z) ---
    const distantNebulae: THREE.Mesh[] = [];
    const dnDefs = [
      // [hue, sat%, light%, x,  y,    z,    w,   h,   baseOp]
      [ 240, 100, 60,  -90,  40, -600, 280, 200, 0.18 ],  // blue-purple
      [ 355,  90, 55,   80, -30, -700, 220, 160, 0.14 ],  // deep red
      [ 140,  80, 50,  -60, -60, -500, 180, 140, 0.16 ],  // emerald green
      [  30, 100, 60,  110,  50, -650, 170, 130, 0.15 ],  // amber orange
      [ 290,  90, 55,   20,  70, -580, 240, 170, 0.17 ],  // violet
    ];
    for (const [hue, sat, lit, dx, dy, dz, dw, dh, baseOp] of dnDefs) {
      const dnCanvas = document.createElement('canvas');
      dnCanvas.width = 256; dnCanvas.height = 256;
      const dnCtx = dnCanvas.getContext('2d')!;
      // Multi-layer radial gradients for organic nebula shape
      for (let layer = 0; layer < 3; layer++) {
        const ox = 100 + layer * 24 + Math.random() * 30;
        const oy = 90 + layer * 18 + Math.random() * 30;
        const r  = 80 + layer * 30;
        const g  = dnCtx.createRadialGradient(ox, oy, 0, ox, oy, r);
        g.addColorStop(0,   `hsla(${hue},${sat}%,${lit + 15}%,${0.55 - layer * 0.12})`);
        g.addColorStop(0.5, `hsla(${hue + 20},${sat}%,${lit}%,${0.30 - layer * 0.08})`);
        g.addColorStop(1,   `hsla(${hue - 20},${sat}%,${lit - 10}%,0)`);
        dnCtx.fillStyle = g;
        dnCtx.fillRect(0, 0, 256, 256);
      }
      // Circular alpha mask
      const dnImg = dnCtx.getImageData(0, 0, 256, 256);
      for (let y2 = 0; y2 < 256; y2++) for (let x2 = 0; x2 < 256; x2++) {
        const dist2 = Math.sqrt((x2-128)**2 + (y2-128)**2) / 128;
        const idx2 = (y2*256+x2)*4;
        if (dist2 > 1) { dnImg.data[idx2+3] = 0; }
        else if (dist2 > 0.8) { dnImg.data[idx2+3] = Math.floor(dnImg.data[idx2+3] * (1-dist2)/0.2); }
      }
      dnCtx.putImageData(dnImg, 0, 0);
      const dnTex = new THREE.CanvasTexture(dnCanvas);
      const dnMat = new THREE.MeshBasicMaterial({ map: dnTex, transparent: true, opacity: baseOp as number, blending: THREE.AdditiveBlending, depthWrite: false });
      const dnMesh = new THREE.Mesh(new THREE.PlaneGeometry(dw as number, dh as number), dnMat);
      dnMesh.position.set(dx as number, dy as number, dz as number);
      dnMesh.userData.baseOp = baseOp;
      dnMesh.userData.pulsePhase = Math.random() * Math.PI * 2;
      scene.add(dnMesh);
      distantNebulae.push(dnMesh);
    }

    // --- Close celestial bodies: suns, pulsars, planets (z = -20 to -180) ---
    const closeBodies: THREE.Mesh[] = [];
    function makeBodyTex(
      type: 'sun'|'dwarf'|'pulsar'|'planet'|'bluestar'
    ): THREE.CanvasTexture {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 256);
      if (type === 'sun') {
        // Yellow-white hot sun: bright core, long corona
        const g = ctx.createRadialGradient(128,128,0,128,128,128);
        g.addColorStop(0,   'rgba(255,255,220,1)');
        g.addColorStop(0.08,'rgba(255,240,120,1)');
        g.addColorStop(0.18,'rgba(255,180,40,0.85)');
        g.addColorStop(0.4, 'rgba(255,120,20,0.35)');
        g.addColorStop(0.7, 'rgba(255,80,0,0.12)');
        g.addColorStop(1,   'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
      } else if (type === 'dwarf') {
        // Orange-red cool dwarf: smaller, dimmer
        const g = ctx.createRadialGradient(128,128,0,128,128,128);
        g.addColorStop(0,   'rgba(255,160,60,1)');
        g.addColorStop(0.12,'rgba(220,80,20,0.9)');
        g.addColorStop(0.35,'rgba(180,40,10,0.4)');
        g.addColorStop(0.7, 'rgba(140,20,5,0.1)');
        g.addColorStop(1,   'rgba(100,10,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
      } else if (type === 'pulsar') {
        // Pulsar: tiny hard white-blue core, narrow beam halo
        const g = ctx.createRadialGradient(128,128,0,128,128,128);
        g.addColorStop(0,   'rgba(200,230,255,1)');
        g.addColorStop(0.05,'rgba(160,200,255,1)');
        g.addColorStop(0.12,'rgba(100,160,255,0.7)');
        g.addColorStop(0.25,'rgba(60,120,255,0.2)');
        g.addColorStop(0.5, 'rgba(30,80,200,0.05)');
        g.addColorStop(1,   'rgba(0,40,120,0)');
        ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
        // Beam streaks
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let angle = 0; angle < Math.PI; angle += Math.PI/2) {
          const gBeam = ctx.createLinearGradient(
            128 + Math.cos(angle)*10, 128 + Math.sin(angle)*10,
            128 + Math.cos(angle)*128, 128 + Math.sin(angle)*128
          );
          gBeam.addColorStop(0, 'rgba(180,220,255,0.55)');
          gBeam.addColorStop(1, 'rgba(100,180,255,0)');
          ctx.fillStyle = gBeam;
          ctx.beginPath();
          ctx.ellipse(128,128, 6, 120, angle, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      } else if (type === 'planet') {
        // Gas giant: solid disc with atmospheric bands
        ctx.save();
        const gDisc = ctx.createRadialGradient(110,100,0,128,128,100);
        gDisc.addColorStop(0,   'rgba(170,120,200,1)');
        gDisc.addColorStop(0.4, 'rgba(100,60,160,1)');
        gDisc.addColorStop(0.7, 'rgba(60,30,100,0.95)');
        gDisc.addColorStop(1,   'rgba(20,10,50,0)');
        ctx.fillStyle = gDisc;
        ctx.beginPath(); ctx.arc(128,128,98,0,Math.PI*2); ctx.fill();
        // Atmospheric band lines
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 6; b++) {
          const by = 60 + b * 22;
          const gBand = ctx.createLinearGradient(30,by,226,by);
          gBand.addColorStop(0,'rgba(200,150,255,0)');
          gBand.addColorStop(0.3,`rgba(${180+b*8},${100+b*10},255,0.25)`);
          gBand.addColorStop(0.7,`rgba(${180+b*8},${100+b*10},255,0.25)`);
          gBand.addColorStop(1,'rgba(200,150,255,0)');
          ctx.fillStyle = gBand;
          ctx.fillRect(30, by-3, 196, 7);
        }
        ctx.restore();
        // Edge glow
        const gEdge = ctx.createRadialGradient(128,128,88,128,128,128);
        gEdge.addColorStop(0,'rgba(140,80,220,0)');
        gEdge.addColorStop(0.7,'rgba(180,100,255,0.18)');
        gEdge.addColorStop(1,'rgba(200,120,255,0)');
        ctx.fillStyle = gEdge; ctx.fillRect(0,0,256,256);
      } else {
        // Blue star: hot, blue-white, sharp core
        const g = ctx.createRadialGradient(128,128,0,128,128,128);
        g.addColorStop(0,   'rgba(255,255,255,1)');
        g.addColorStop(0.06,'rgba(200,230,255,1)');
        g.addColorStop(0.15,'rgba(100,180,255,0.75)');
        g.addColorStop(0.35,'rgba(40,120,255,0.25)');
        g.addColorStop(0.7, 'rgba(20,80,200,0.07)');
        g.addColorStop(1,   'rgba(0,40,160,0)');
        ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
      }
      return new THREE.CanvasTexture(c);
    }

    const bodyDefs: Array<{
      type: 'sun'|'dwarf'|'pulsar'|'planet'|'bluestar';
      x: number; y: number; z: number;
      size: number; baseOp: number;
      pulseSpeed: number; pulseType: string;
    }> = [
      // Close bodies
      { type: 'sun',     x: -130, y:  55,  z:  -60, size:  70, baseOp: 0.80, pulseSpeed: 0.20, pulseType: 'slow'  },
      { type: 'dwarf',   x:  145, y: -55,  z:  -90, size:  50, baseOp: 0.70, pulseSpeed: 0.15, pulseType: 'slow'  },
      { type: 'pulsar',  x:   65, y:  85,  z:  -40, size:  36, baseOp: 0.90, pulseSpeed: 8.0,  pulseType: 'fast'  },
      { type: 'planet',  x: -105, y: -75,  z: -120, size:  60, baseOp: 0.80, pulseSpeed: 0.08, pulseType: 'none'  },
      { type: 'bluestar',x:   95, y:  65,  z:  -55, size:  44, baseOp: 0.78, pulseSpeed: 0.25, pulseType: 'slow'  },
      // Mid-distance suns
      { type: 'sun',     x:  170, y:  80,  z: -240, size:  90, baseOp: 0.65, pulseSpeed: 0.14, pulseType: 'slow'  },
      { type: 'dwarf',   x: -170, y: -80,  z: -280, size:  75, baseOp: 0.60, pulseSpeed: 0.18, pulseType: 'slow'  },
      { type: 'bluestar',x:  -40, y:  110, z: -200, size:  55, baseOp: 0.62, pulseSpeed: 0.22, pulseType: 'slow'  },
      { type: 'pulsar',  x:  -90, y:  -30, z: -160, size:  28, baseOp: 0.85, pulseSpeed: 9.5,  pulseType: 'fast'  },
      // Far distant suns
      { type: 'sun',     x:  -60, y:  -90, z: -420, size: 110, baseOp: 0.50, pulseSpeed: 0.10, pulseType: 'slow'  },
      { type: 'sun',     x:  130, y:   30, z: -380, size:  95, baseOp: 0.45, pulseSpeed: 0.12, pulseType: 'slow'  },
      { type: 'dwarf',   x:   50, y: -110, z: -460, size:  85, baseOp: 0.42, pulseSpeed: 0.09, pulseType: 'slow'  },
    ];
    // Each body reacts to a different audio band (cycle so all bands covered)
    const audioBands = ['bass', 'mid', 'high', 'energy', 'beat'];
    for (let bi = 0; bi < bodyDefs.length; bi++) {
      const def = bodyDefs[bi];
      const tex = makeBodyTex(def.type);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: def.baseOp, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.size, def.size), mat);
      mesh.position.set(def.x, def.y, def.z);
      mesh.userData = { ...def };
      mesh.userData.pulsePhase = Math.random() * Math.PI * 2;
      mesh.userData.audioBand = audioBands[bi % audioBands.length];
      mesh.userData.smoothVal = def.baseOp;
      scene.add(mesh);
      closeBodies.push(mesh);
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Strong bloom — bodies and flashes need to pop like explosions
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 2.8, 0.85, 0.82);
    composer.addPass(bloom);

    eng = { canvas, renderer, scene, camera, composer, clouds, distantNebulae, closeBodies, flashGroup, flashPool: [], orbTextures, orbIndex: 0, zoneIndex: 0, lastPulse: 0 };
    engines.set(key, eng);
  }

  if (eng.canvas.width !== Math.floor(width) || eng.canvas.height !== Math.floor(height)) {
    eng.renderer.setSize(width, height, false);
    eng.composer.setSize(Math.floor(width), Math.floor(height));
    eng.camera.aspect = width / height; eng.camera.updateProjectionMatrix();
  }

  // Animate clouds with beat and energy
  const pulse = features.beatPulse; const energy = features.energy; const bass = features.bassLevel;

  // Spawn new random-position beat flashes on rising edge of beatPulse
  const flashThreshold = 0.55;
  if (pulse > flashThreshold && eng.lastPulse <= flashThreshold) {
    // Pick a completely random orb style on every pulse
    eng.orbIndex = Math.floor(Math.random() * eng.orbTextures.length);
    const orbTex = eng.orbTextures[eng.orbIndex];

    // 8 screen zones: left, right, top, bottom, TL, TR, BL, BR — cycle through them
    // so orbs spread evenly across all sides, not clustered
    const zones = [
      [-85,  0],   // left
      [ 85,  0],   // right
      [  0,  55],  // top
      [  0, -55],  // bottom
      [-75,  45],  // top-left
      [ 75,  45],  // top-right
      [-75, -45],  // bottom-left
      [ 75, -45],  // bottom-right
    ];
    eng.zoneIndex = (eng.zoneIndex + 1) % zones.length;
    const [zx, zy] = zones[eng.zoneIndex];

    const count = 1 + Math.floor(bass * 2);
    for (let f = 0; f < count; f++) {
      const hue = Math.random() * 360;
      const flashColor = new THREE.Color(`hsl(${hue},100%,92%)`);
      const flashSize = 32 + Math.random() * 44;
      const flashMat = new THREE.MeshBasicMaterial({
        map: orbTex,
        color: flashColor,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flashGeom = new THREE.PlaneGeometry(flashSize, flashSize);
      const flashMesh = new THREE.Mesh(flashGeom, flashMat);
      flashMesh.position.set(
        zx + (Math.random() - 0.5) * 50,
        zy + (Math.random() - 0.5) * 35,
        -80 + Math.random() * 60
      );
      flashMesh.lookAt(eng.camera.position);
      eng.flashGroup.add(flashMesh);
      eng.flashPool.push({
        mesh: flashMesh,
        spawnTime: nowSec,
        life: 1.2 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
      });
    }
  }
  eng.lastPulse = pulse;

  // Fade out, drift, and remove expired flashes
  for (let i = eng.flashPool.length - 1; i >= 0; i--) {
    const fl = eng.flashPool[i];
    const age = nowSec - fl.spawnTime;
    if (age >= fl.life) {
      eng.flashGroup.remove(fl.mesh);
      eng.flashPool.splice(i, 1);
    } else {
      // Drift the orb slowly in its random direction
      fl.mesh.position.x += fl.vx;
      fl.mesh.position.y += fl.vy;
      const t = age / fl.life;
      (fl.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 * (1 - t * t);
    }
  }

  // Animate distant nebulae — slow pulse tied to bass/energy
  eng.distantNebulae.forEach((dn, i) => {
    const mat = dn.material as THREE.MeshBasicMaterial;
    const base: number = dn.userData.baseOp;
    const phase: number = dn.userData.pulsePhase;
    const t = Math.sin(nowSec * 0.18 + phase + i * 0.9);
    mat.opacity = THREE.MathUtils.clamp(base + t * 0.07 + bass * 0.06, 0.04, 0.45);
  });

  // Animate close celestial bodies — each reacts to its assigned audio band
  eng.closeBodies.forEach((body) => {
    const mat = body.material as THREE.MeshBasicMaterial;
    const { baseOp, pulseSpeed, pulseType, pulsePhase, audioBand } = body.userData;

    // Sample audio level for this body's assigned band
    let bandVal = 0;
    if (audioBand === 'bass')   bandVal = bass;
    else if (audioBand === 'mid') {
      // mid = average of freq bins ~20-60% of spectrum
      const fd = features.freqData;
      const lo = Math.floor(fd.length * 0.20), hi = Math.floor(fd.length * 0.60);
      let sum = 0; for (let b = lo; b < hi; b++) sum += fd[b];
      bandVal = sum / ((hi - lo) * 255);
    } else if (audioBand === 'high') {
      const fd = features.freqData;
      const lo = Math.floor(fd.length * 0.60);
      let sum = 0; for (let b = lo; b < fd.length; b++) sum += fd[b];
      bandVal = sum / ((fd.length - lo) * 255);
    } else if (audioBand === 'energy') {
      bandVal = energy;
    } else {
      bandVal = pulse;
    }

    // Smooth the band value — fast attack, slow release
    const prev: number = body.userData.smoothVal ?? baseOp;
    const smoothed = bandVal > prev ? bandVal * 0.85 + prev * 0.15 : bandVal * 0.06 + prev * 0.94;
    body.userData.smoothVal = smoothed;

    if (pulseType === 'fast') {
      // Pulsar: rapid strobe, EXPLOSIVE on its band
      const strobe = 0.5 + 0.5 * Math.sin(nowSec * pulseSpeed + pulsePhase);
      mat.opacity = THREE.MathUtils.clamp(baseOp * 0.15 + strobe * 0.4 + smoothed * 1.8, 0.0, 1.0);
    } else if (pulseType === 'slow') {
      // Stars/suns: explosive swell — dims right down at rest, blazes on hit
      const breath = 0.5 + 0.5 * Math.sin(nowSec * pulseSpeed + pulsePhase);
      mat.opacity = THREE.MathUtils.clamp(baseOp * 0.15 + breath * 0.15 + smoothed * 1.5, 0.05, 1.0);
    } else {
      // Planet: swells hard with its band
      mat.opacity = THREE.MathUtils.clamp(baseOp * 0.25 + smoothed * 1.4, 0.1, 1.0);
    }
  });

  // Animate clouds — very slow drift, barely reacts to audio
  eng.clouds.forEach((m, i) => {
    const t = nowSec * 0.012 + i * 0.37;
    m.position.x += Math.sin(t) * 0.02;
    m.position.y += Math.cos(t) * 0.018;
    m.rotation.z += 0.0002;
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.10 + bass * 0.06 + Math.sin(nowSec * 0.08 + i) * 0.04;
  });

  // Animate stars: large stars pulse very slowly with bass only; small stars are static
  if (eng.scene.children) {
    eng.scene.children.forEach(obj => {
      if (obj.type === 'Group' && obj.children.length > 0 && obj.children[0].type === 'Points') {
        obj.children.forEach((star) => {
          const mat = star.material as THREE.PointsMaterial;
          if (!mat) return;
          const base: number = star.userData.baseOpacity ?? 0.15;
          const baseSize: number = star.userData.baseSize ?? 8;
          const isLarge: boolean = star.userData.isLarge ?? false;
          if (isLarge) {
            const speed: number = star.userData.pulseSpeed ?? 0.15;
            const phase: number = star.userData.pulsePhase ?? 0;
            // Only bass drives the pulse amplitude
            const bassAmp = bass * 0.10;
            const t = Math.sin(nowSec * speed + phase);
            mat.opacity = THREE.MathUtils.clamp(base + t * 0.07 + bassAmp, 0.05, 0.40);
            mat.size = baseSize * (1.0 + t * 0.06 + bass * 0.08);
          } else {
            // Small stars: static, no pulse
            mat.opacity = base;
          }
        });
      }
    });
  }

  eng.composer.render();
  return eng.canvas;
}
