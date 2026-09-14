/* ============================================================
   weather.js -- the storm, and the world it is falling on.

   Three parts:
     * the exterior beyond the east windows -- a parking lot, a
       fence, a distribution line on poles, a treeline. Without
       it the windows are black rectangles and the building has
       no outside; with it, every lightning flash puts the pole
       line in silhouette, which is the whole mood of the game.
     * a falling rain volume, animated entirely on the GPU.
     * rain ON the glass: runnels and beads that drift down the
       window and refract the parking lot lights behind them.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { box, cylinder, plane } from './geo.js';
import { rng } from '../engine/noise.js';

/* ============================================================
   RAIN VOLUME
   ============================================================ */
const RAIN_VERT = /* glsl */`
attribute vec3 iOffset;
attribute vec2 iParams;      // x = fall speed, y = length scale
uniform float uTime;
uniform float uHeight;
varying float vFade;
void main() {
  float speed = iParams.x;
  float y = mod(iOffset.y - uTime * speed, uHeight);
  vec3 base = vec3(iOffset.x, y, iOffset.z);
  // stretch the quad along Y by the streak length, lean it with the wind
  vec3 p = position;
  p.y *= iParams.y;
  p.x += p.y * 0.16;
  vec4 mv = modelViewMatrix * vec4(base, 1.0);
  mv.xy += p.xy;
  vFade = smoothstep(0.0, 3.0, y) * (1.0 - smoothstep(uHeight - 4.0, uHeight, y));
  gl_Position = projectionMatrix * mv;
}`;

const RAIN_FRAG = /* glsl */`
precision mediump float;
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  gl_FragColor = vec4(uColor, uOpacity * vFade);
}`;

export class Rain {
  /** @param {object} vol {x, y, z, w, h, d} world-space volume to fill */
  constructor(scene, vol, count = 800) {
    const g = new THREE.InstancedBufferGeometry();
    const streak = new THREE.PlaneGeometry(0.008, 1);
    g.index = streak.index;
    g.attributes.position = streak.attributes.position;
    g.attributes.uv = streak.attributes.uv;

    const off = new Float32Array(count * 3);
    const par = new Float32Array(count * 2);
    const r = rng(99);
    for (let i = 0; i < count; i++) {
      off[i * 3] = vol.x + (r() - 0.5) * vol.w;
      off[i * 3 + 1] = r() * vol.h;
      off[i * 3 + 2] = vol.z + (r() - 0.5) * vol.d;
      par[i * 2] = 11 + r() * 9;
      par[i * 2 + 1] = 0.22 + r() * 0.34;
    }
    g.setAttribute('iOffset', new THREE.InstancedBufferAttribute(off, 3));
    g.setAttribute('iParams', new THREE.InstancedBufferAttribute(par, 2));
    g.instanceCount = count;

    this.material = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uHeight: { value: vol.h },
        uColor: { value: new THREE.Color(0x9fb4c8) },
        uOpacity: { value: 0.34 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.position.set(0, vol.y, 0);
    this.mesh.frustumCulled = false;
    this.mesh.userData.noReflect = true;
    this.mesh.name = 'rain';
    scene.add(this.mesh);
  }
  update(t) { this.material.uniforms.uTime.value = t; }
  setIntensity(v) { this.material.uniforms.uOpacity.value = 0.34 * v; }
}

/* ============================================================
   RAIN ON THE GLASS
   ============================================================ */
const GLASS_VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const GLASS_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform vec3 uTint;
uniform float uFlash;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

// A column of water running down the pane, with beads that hang and release.
float runnel(vec2 uv, float seed) {
  float col = floor(uv.x * 14.0 + seed * 7.0);
  float h = hash(vec2(col, seed));
  if (h < 0.55) return 0.0;
  float speed = 0.10 + h * 0.30;
  float y = fract(uv.y * 0.85 + uTime * speed + h * 10.0);
  float x = fract(uv.x * 14.0 + seed * 7.0) - 0.5;
  // wobble the trail so it does not read as a straight line
  x += sin(y * 22.0 + h * 30.0) * 0.06;
  float trail = smoothstep(0.34, 0.0, abs(x)) * smoothstep(0.0, 0.22, y) * (1.0 - smoothstep(0.22, 0.95, y));
  float bead = smoothstep(0.11, 0.0, length(vec2(x * 1.7, (y - 0.22) * 3.0)));
  return clamp(trail * 0.55 + bead, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  float w = runnel(uv, 1.0);
#if GLASS_DETAIL > 0
  w += runnel(uv * vec2(1.3, 0.9) + 0.31, 2.0) * 0.8;
#endif
  // static speckle of fine drops that have not started moving yet
  float spec = step(0.985, hash(floor(uv * vec2(130.0, 190.0))));
  w = clamp(w + spec * 0.5, 0.0, 1.0);

  vec3 col = uTint * (0.16 + w * 0.5);
  col += uFlash * (0.35 + w * 1.4);
  float a = 0.20 + w * 0.55 + uFlash * 0.2;
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
}`;

export class WetGlass {
  /** `detail` 0 runs a single runnel pass instead of two. */
  constructor(detail = 1) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG.replace('GLASS_DETAIL', String(detail | 0)),
      uniforms: {
        uTime: { value: 0 },
        uTint: { value: new THREE.Color(0x8aa6bd) },
        uFlash: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
  }
  /** Swap every window pane in the office over to the wet-glass shader. */
  applyTo(root) {
    root.traverse((o) => {
      if (o.isMesh && o.name === 'window-glass') {
        o.material = this.material;
        o.userData.noReflect = true;
      }
    });
    return this;
  }
  update(t, flash) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uFlash.value = Math.min(1.2, flash);
  }
}


/* ============================================================
   STORM SKY
   A dome, not a flat background color. The cloud deck has
   structure so lightning has something to light up from behind,
   and the horizon carries the orange of a small town's sodium
   lights bouncing off the underside of the overcast.
   ============================================================ */
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform float uFlash;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < SKY_OCTAVES; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);

  // cloud deck, drifting
  vec2 uv = d.xz / max(0.12, d.y + 0.30);
  float c = fbm(uv * 1.6 + vec2(uTime * 0.012, uTime * 0.006));
  c = smoothstep(0.25, 0.85, c);

  vec3 low  = vec3(0.055, 0.062, 0.082);
  vec3 high = vec3(0.014, 0.018, 0.030);
  vec3 col = mix(low, high, smoothstep(0.0, 0.55, h));

  // the town's light on the underside of the overcast
  col += vec3(0.085, 0.048, 0.016) * (1.0 - smoothstep(0.0, 0.26, h)) * (0.5 + c * 0.8);
  // cloud structure
  col += vec3(0.035, 0.040, 0.052) * c * (1.0 - smoothstep(0.1, 0.8, h));
  // lightning lights the deck from inside
  col += uFlash * (0.25 + c * 1.1) * vec3(0.72, 0.80, 1.0);

  gl_FragColor = vec4(col, 1.0);
}`;

export class StormSky {
  /** `octaves` trades cloud detail for fill cost; see engine/quality.js. */
  constructor(scene, octaves = 3) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG.replace('SKY_OCTAVES', String(Math.max(1, octaves | 0))),
      uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), this.material);
    this.mesh.name = 'storm-sky';
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(t, flash) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uFlash.value = Math.min(1.0, flash * 0.55);
  }
}

/* ============================================================
   THE EXTERIOR
   ============================================================ */
export function buildExterior(scene, mats) {
  const g = new THREE.Group();
  g.name = 'exterior';
  scene.add(g);
  const r = rng(2025);

  // Wet asphalt. Low roughness so the pole lights streak across it.
  const lot = plane(70, 70, new THREE.MeshStandardMaterial({
    color: 0x14161a, roughness: 0.28, metalness: 0.0,
  }), { pos: [26, -0.22, 6] });
  lot.receiveShadow = false;
  g.add(lot);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.92 });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x2f2a22, roughness: 0.9 });
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1a1d22 });

  // A distribution line marching away from the building -- three phase on
  // crossarms, exactly what this company would own.
  const poles = [];
  for (let i = 0; i < 6; i++) {
    const px = 16 + i * 8.5 + r() * 1.2;
    const pz = -6 + i * 4.4 + r() * 2;
    const h = 8.6 + r() * 0.8;
    g.add(cylinder(0.14, 0.19, h, poleMat, { pos: [px, h / 2 - 0.2, pz], seg: 8, shadow: 'none' }));
    g.add(box(2.4, 0.13, 0.13, armMat, { pos: [px, h - 0.9, pz], shadow: 'none' }));
    g.add(box(1.7, 0.11, 0.11, armMat, { pos: [px, h - 1.7, pz], shadow: 'none' }));
    for (const dx of [-1.0, 0, 1.0]) {
      g.add(cylinder(0.055, 0.07, 0.16, new THREE.MeshStandardMaterial({ color: 0x4a5a62, roughness: 0.35 }), {
        pos: [px + dx, h - 0.74, pz], seg: 8, shadow: 'none',
      }));
    }
    // a transformer on every third pole
    if (i % 3 === 1) {
      g.add(cylinder(0.32, 0.32, 0.7, new THREE.MeshStandardMaterial({ color: 0x4e5358, roughness: 0.55, metalness: 0.4 }), {
        pos: [px + 0.34, h - 3.0, pz], seg: 14, shadow: 'none',
      }));
    }
    poles.push({ x: px, y: h - 0.9, z: pz });
  }
  // the conductors, sagging between poles
  for (const dx of [-1.0, 0, 1.0]) {
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i], b = poles[i + 1];
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const sag = Math.sin(t * Math.PI) * 0.55;
        pts.push(new THREE.Vector3(
          a.x + dx + (b.x - a.x) * t,
          a.y + (b.y - a.y) * t - sag + 0.16,
          a.z + (b.z - a.z) * t,
        ));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat);
      line.userData.noReflect = true;
      g.add(line);
    }
  }

  // Chain-link fence line, read as a dark band with posts.
  for (let i = 0; i < 14; i++) {
    g.add(cylinder(0.035, 0.035, 2.0, new THREE.MeshStandardMaterial({ color: 0x3f4348, roughness: 0.6, metalness: 0.5 }), {
      pos: [13.4, 0.8, -8 + i * 2.4], seg: 6, shadow: 'none',
    }));
  }

  // Sodium yard lights. The heads are emissive on both, but only ONE of them
  // is a real light -- see the note at the top of lighting.js about what a
  // forward renderer charges for a light that is merely "outside".
  for (const [lx, lz, real] of [[19.5, 2.0, true], [24.0, 12.0, false]]) {
    const h = 7.4;
    g.add(cylinder(0.10, 0.13, h, poleMat, { pos: [lx, h / 2 - 0.2, lz], seg: 8, shadow: 'none' }));
    g.add(box(0.6, 0.14, 0.34, armMat, { pos: [lx + 0.3, h - 0.3, lz], shadow: 'none' }));
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb14a, emissiveIntensity: 4.5, roughness: 0.5 }),
    );
    head.position.set(lx + 0.58, h - 0.42, lz);
    g.add(head);
    if (real) {
      const l = new THREE.PointLight(0xffa93a, 34, 26, 2.0);
      l.position.set(lx + 0.58, h - 0.5, lz);
      g.add(l);
    }
  }

  // A treeline far out, as low-detail silhouettes. Lightning is what sees it.
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x0e1411, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const tx = 34 + r() * 26, tz = -24 + r() * 60, th = 7 + r() * 7;
    const t = new THREE.Mesh(new THREE.ConeGeometry(1.4 + r(), th, 6), treeMat);
    t.position.set(tx, th / 2 - 0.2, tz);
    t.userData.noReflect = true;
    g.add(t);
  }

  // A single service truck in the lot, so the company owns vehicles.
  const truck = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcfa33a, roughness: 0.45, metalness: 0.15 });
  truck.add(box(2.1, 1.0, 5.2, bodyMat, { pos: [0, 1.1, 0], shadow: 'none' }));
  truck.add(box(2.0, 0.9, 1.8, bodyMat, { pos: [0, 1.95, 1.5], shadow: 'none' }));
  truck.add(box(1.86, 0.55, 0.10, new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.1 }), { pos: [0, 2.02, 0.62], shadow: 'none' }));
  for (const [wx, wz] of [[-1.0, 1.7], [1.0, 1.7], [-1.0, -1.6], [1.0, -1.6]]) {
    truck.add(cylinder(0.46, 0.46, 0.32, new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 }), {
      pos: [wx, 0.46, wz], rot: [0, 0, Math.PI / 2], seg: 12, shadow: 'none',
    }));
  }
  truck.position.set(17.6, 0, 9.5);
  truck.rotation.y = 0.5;
  truck.userData.noReflect = true;
  g.add(truck);

  return g;
}
