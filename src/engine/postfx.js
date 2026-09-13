/* ============================================================
   postfx.js -- the post chain, hand-rolled.

   three's EffectComposer lives in examples/jsm, which would mean
   vendoring a second pile of code for three passes we can write
   ourselves. This is those three passes:

     1. bright-pass + separable gaussian  -> bloom (CRT glow,
        fluorescent tubes, the lightning)
     2. ACES filmic tonemap + grade       -> film response
     3. grain / vignette / chromatic      -> lens, tastefully

   Everything is uniform-driven so the horror director can shove
   the grade around at runtime (see game/horror.js): drop the
   exposure, crush the chroma, push the aberration until the
   picture itself feels like it is losing signal.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';

const QUAD_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform float threshold;
uniform float softness;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(threshold, threshold + softness, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 dir;          // texel-sized step, horizontal or vertical
void main() {
  // 9-tap gaussian, linear-sampled weights
  vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;
  vec2 o1 = dir * 1.3846153846;
  vec2 o2 = dir * 3.2307692308;
  sum += (texture2D(tDiffuse, vUv + o1).rgb + texture2D(tDiffuse, vUv - o1).rgb) * 0.3162162162;
  sum += (texture2D(tDiffuse, vUv + o2).rgb + texture2D(tDiffuse, vUv - o2).rgb) * 0.0702702703;
  gl_FragColor = vec4(sum, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float exposure;
uniform float bloomAmount;
uniform float vignette;      // 0 none .. 1 heavy
uniform float grain;         // film grain amount
uniform float aberration;    // chromatic split in texels
uniform float saturation;    // 1 = normal, 0 = monochrome
uniform vec3  lift;          // shadow tint
uniform float time;
uniform float scanline;      // signal-degradation rolling bar (horror only)
uniform float warp;          // barrel warp, used when the picture "loses lock"

// Narkowicz ACES approximation -- cheap, and the shoulder is right.
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;

  // barrel warp toward the center when the signal is unstable
  if (warp > 0.0001) {
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    uv = 0.5 + c * (1.0 + warp * r2 * 2.2);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
  }

  // chromatic aberration grows toward the edge of frame, like a real lens
  vec2 dir = (uv - 0.5);
  float edge = dot(dir, dir);
  vec2 off = dir * aberration * edge;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + off).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - off).b;

  col += texture2D(tBloom, uv).rgb * bloomAmount;
  col *= exposure;
  col = aces(col);

  // grade: lift the shadows cold, then pull saturation
  col += lift * (1.0 - smoothstep(0.0, 0.45, dot(col, vec3(0.333))));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);

  // rolling interference bar -- only ever nonzero during an event
  if (scanline > 0.0001) {
    float bar = fract(uv.y * 1.5 - time * 0.35);
    float band = smoothstep(0.0, 0.06, bar) * (1.0 - smoothstep(0.10, 0.20, bar));
    col += band * scanline * vec3(0.16, 0.18, 0.22);
    col *= 1.0 - scanline * 0.10 * step(0.5, fract(uv.y * 340.0));
  }

  // vignette
  float v = smoothstep(0.85, 0.2, length(dir) * (1.0 + vignette));
  col *= mix(1.0, v, clamp(vignette, 0.0, 1.0));

  // film grain, luminance-weighted so it lives in the midtones
  float n = hash(uv * 1024.0 + fract(time) * 91.7) - 0.5;
  col += n * grain * (0.35 + 0.65 * (1.0 - abs(l * 2.0 - 1.0)));

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

/** Fullscreen triangle-ish quad shared by every pass. */
function quadMesh(material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return new THREE.Mesh(g, material);
}

export class PostChain {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const half = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.type = half;

    const rtOpts = { type: half, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    this.scene3 = new THREE.WebGLRenderTarget(width, height, { ...rtOpts, samples: 4 });
    const bw = Math.max(1, width >> 2), bh = Math.max(1, height >> 2);
    this.bright = new THREE.WebGLRenderTarget(bw, bh, { ...rtOpts, depthBuffer: false });
    this.blurA = new THREE.WebGLRenderTarget(bw, bh, { ...rtOpts, depthBuffer: false });
    this.blurB = new THREE.WebGLRenderTarget(bw, bh, { ...rtOpts, depthBuffer: false });

    this.mBright = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG,
      uniforms: { tDiffuse: { value: null }, threshold: { value: 1.15 }, softness: { value: 0.60 } },
      depthTest: false, depthWrite: false,
    });
    this.mBlur = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG,
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false,
    });
    this.mComposite = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        exposure: { value: 0.95 },
        bloomAmount: { value: 0.32 },
        vignette: { value: 0.42 },
        grain: { value: 0.030 },
        aberration: { value: 0.010 },
        saturation: { value: 0.92 },
        lift: { value: new THREE.Color(0.012, 0.016, 0.028) },
        time: { value: 0 },
        scanline: { value: 0 },
        warp: { value: 0 },
      },
      depthTest: false, depthWrite: false,
    });

    this.quad = quadMesh(this.mComposite);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.setSize(width, height);
  }

  /** The uniforms the horror director is allowed to move. */
  get grade() { return this.mComposite.uniforms; }

  setSize(w, h) {
    this.width = w; this.height = h;
    this.scene3.setSize(w, h);
    const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    this.bright.setSize(bw, bh);
    this.blurA.setSize(bw, bh);
    this.blurB.setSize(bw, bh);
  }

  _pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  /** Render `scene3d` through the whole chain to the screen. */
  render(scene3d, camera, time) {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();

    r.setRenderTarget(this.scene3);
    r.clear();
    r.render(scene3d, camera);

    // bright pass
    this.mBright.uniforms.tDiffuse.value = this.scene3.texture;
    this._pass(this.mBright, this.bright);

    // two separable blur iterations at quarter res -- wide, soft halation
    const bw = this.bright.width, bh = this.bright.height;
    let src = this.bright;
    for (let i = 0; i < 2; i++) {
      this.mBlur.uniforms.tDiffuse.value = src.texture;
      this.mBlur.uniforms.dir.value.set((1.6 + i * 1.9) / bw, 0);
      this._pass(this.mBlur, this.blurA);
      this.mBlur.uniforms.tDiffuse.value = this.blurA.texture;
      this.mBlur.uniforms.dir.value.set(0, (1.6 + i * 1.9) / bh);
      this._pass(this.mBlur, this.blurB);
      src = this.blurB;
    }

    this.mComposite.uniforms.tDiffuse.value = this.scene3.texture;
    this.mComposite.uniforms.tBloom.value = this.blurB.texture;
    this.mComposite.uniforms.time.value = time;
    this._pass(this.mComposite, null);

    r.setRenderTarget(prevTarget);
  }

  dispose() {
    for (const rt of [this.scene3, this.bright, this.blurA, this.blurB]) rt.dispose();
    for (const m of [this.mBright, this.mBlur, this.mComposite]) m.dispose();
    this.quad.geometry.dispose();
  }
}
