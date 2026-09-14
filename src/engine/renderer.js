/* ============================================================
   renderer.js -- WebGL setup, camera, environment capture, the
   frame's render half, and the budget that keeps it playable.

   Notes on the look:
   * Scene renders LINEAR into a half-float target; the tonemap
     happens in postfx so the grade is ours, not the renderer's.
   * Specular comes from a cubemap captured FROM THE ROOM ITSELF
     at boot, run through PMREM. That is what makes the waxed VCT,
     the desk clearcoat and the CRT bezel look like they are in
     the room instead of floating in it.

   Notes on the cost:
   * PIXEL RATIO DEFAULTS TO 1. A Retina display at devicePixelRatio
     2 renders four times the fragments. In a dark, grainy, heavily
     post-processed game that is close to invisible and close to
     unaffordable. It is an option, not a default.
   * There is an ADAPTIVE SCALER. It watches a rolling median frame
     time and walks the internal render scale down when the frame
     budget is missed, and back up when there is headroom. It never
     touches the preset the player chose -- only the resolution
     inside it -- so the game degrades smoothly instead of
     becoming a slideshow.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { PostChain } from './postfx.js';
import { PRESETS } from './quality.js';

export class Renderer {
  constructor(canvas, preset = PRESETS.medium) {
    this.canvas = canvas;
    this.preset = preset;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,          // MSAA happens on the render target instead
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.gl.setPixelRatio(preset.pixelRatio);
    this.gl.shadowMap.enabled = preset.shadows > 0;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.shadowMap.autoUpdate = false;      // we drive this by hand
    this.gl.toneMapping = THREE.NoToneMapping; // postfx owns the tonemap
    this.gl.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(66, 1, 0.03, 120);
    this.post = null;
    this._size = { w: 0, h: 0 };

    /* --- adaptive scaling --- */
    this.renderScale = preset.renderScale;
    this.minScale = 0.5;
    this.adaptive = true;
    this.targetFrameMs = 16.9;          // aim for 60; back off below 30
    this._frameTimes = new Array(45).fill(16);
    this._frameIndex = 0;
    this._cooldown = 0;
    this._shadowTick = 0;

    /* --- stats for the perf overlay --- */
    this.stats = { fps: 0, ms: 0, scale: 1, drawCalls: 0, tris: 0, lights: 0, rt: '' };

    this.resize(true);
  }

  get domElement() { return this.canvas; }

  /** Apply a whole preset. Rebuilds the render targets. */
  setPreset(preset) {
    this.preset = preset;
    this.gl.setPixelRatio(preset.pixelRatio);
    this.renderScale = preset.renderScale;
    const wantShadows = preset.shadows > 0;
    if (this.gl.shadowMap.enabled !== wantShadows) {
      this.gl.shadowMap.enabled = wantShadows;
      this._refreshMaterials = true;
    }
    if (this.post) this.post.setSamples(preset.samples);
    this.resize(true);
  }

  /** Manual override of the internal resolution (the options slider). */
  setRenderScale(scale) {
    this.renderScale = Math.max(this.minScale, Math.min(1, scale));
    this.resize(true);
  }

  setPixelRatio(r) {
    this.gl.setPixelRatio(Math.max(0.75, Math.min(2, r)));
    this.resize(true);
  }

  resize(force = false) {
    const parent = this.canvas.parentElement || document.body;
    const w = Math.max(320, parent.clientWidth | 0);
    const h = Math.max(240, parent.clientHeight | 0);
    if (!force && w === this._size.w && h === this._size.h) return;
    this._size = { w, h };
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._applyTargetSize();
  }

  _applyTargetSize() {
    const dpr = this.gl.getPixelRatio();
    const rw = Math.max(320, Math.round(this._size.w * dpr * this.renderScale));
    const rh = Math.max(240, Math.round(this._size.h * dpr * this.renderScale));
    if (!this.post) this.post = new PostChain(this.gl, rw, rh, this.preset.samples);
    else this.post.setSize(rw, rh);
    this.stats.rt = `${rw}x${rh}`;
    this.stats.scale = this.renderScale;
  }

  /**
   * Watch the frame time and move the internal resolution to fit the budget.
   * Uses a median rather than a mean so one hitch does not drop the quality.
   */
  _adapt(dtMs) {
    this._frameTimes[this._frameIndex++ % this._frameTimes.length] = dtMs;
    if (this._cooldown > 0) { this._cooldown--; return; }
    if (this._frameIndex < this._frameTimes.length) return;

    const sorted = [...this._frameTimes].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.stats.ms = median;
    this.stats.fps = 1000 / median;
    if (!this.adaptive) return;

    // Below ~34 fps: shed resolution. Above ~58 fps with room to spare: take
    // some back, but never past what the preset asked for.
    if (median > 29 && this.renderScale > this.minScale) {
      this.renderScale = Math.max(this.minScale, this.renderScale - 0.1);
      this._applyTargetSize();
      this._cooldown = 90;
    } else if (median < 13.5 && this.renderScale < this.preset.renderScale) {
      this.renderScale = Math.min(this.preset.renderScale, this.renderScale + 0.05);
      this._applyTargetSize();
      this._cooldown = 150;
    }
  }

  /**
   * Capture the room into an environment map. Call once the world is built
   * and the lights are on.
   */
  captureEnvironment(scene, position = new THREE.Vector3(0, 1.5, 0), size = 128) {
    if (this._pmrem) this._pmrem.dispose();
    this._pmrem = new THREE.PMREMGenerator(this.gl);
    this._pmrem.compileCubemapShader();

    const cubeRT = new THREE.WebGLCubeRenderTarget(size, { type: this.post ? this.post.type : THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.1, 60, cubeRT);
    cam.position.copy(position);
    const hidden = [];
    scene.traverse((o) => { if (o.userData.noReflect && o.visible) { o.visible = false; hidden.push(o); } });
    const prevShadow = this.gl.shadowMap.enabled;
    this.gl.shadowMap.enabled = false;
    cam.update(this.gl, scene);
    this.gl.shadowMap.enabled = prevShadow;
    for (const o of hidden) o.visible = true;

    const env = this._pmrem.fromCubemap(cubeRT.texture).texture;
    if (scene.environment) scene.environment.dispose?.();
    scene.environment = env;
    cubeRT.dispose();
    return env;
  }

  render(scene, time, dtMs = 16) {
    if (this._refreshMaterials) {
      // A shadow toggle changes the shader, so every material must recompile
      // exactly once rather than on every frame.
      scene.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
      this._refreshMaterials = false;
    }

    // Shadow maps are static geometry lit by lights that move rarely. There
    // is no reason to re-render them sixty times a second.
    if (this.gl.shadowMap.enabled) {
      this._shadowTick--;
      if (this._shadowTick <= 0) { this.gl.shadowMap.needsUpdate = true; this._shadowTick = 4; }
    }

    this.post.render(scene, this.camera, time);

    const scene3 = this.post.sceneStats;
    this.stats.drawCalls = scene3.calls;
    this.stats.tris = scene3.triangles;
    this._adapt(dtMs);
  }

  dispose() {
    this.post?.dispose();
    this._pmrem?.dispose();
    this.gl.dispose();
  }
}
