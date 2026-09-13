/* ============================================================
   renderer.js -- WebGL setup, camera, environment capture and
   the frame loop's render half.

   Notes on the look:
   * Scene renders LINEAR into a half-float target; the tonemap
     happens in postfx so the grade is ours, not the renderer's.
   * Soft shadow maps, but only a small number of casters -- a
     ceiling full of shadow-casting fluorescents is not worth the
     milliseconds, so the fixtures over the dispatch desk cast and
     the rest are fill.
   * Specular comes from a cubemap captured FROM THE ROOM ITSELF
     at boot, run through PMREM. That is what makes the waxed VCT,
     the desk clearcoat and the CRT bezel look like they are in
     the room instead of floating in it.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { PostChain } from './postfx.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,          // MSAA happens on the render target instead
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.NoToneMapping;   // postfx owns the tonemap
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.autoClear = true;

    this.camera = new THREE.PerspectiveCamera(66, 1, 0.03, 120);
    this.post = null;
    this._size = { w: 0, h: 0 };
    this.quality = 1;            // render scale, dropped by the options menu
    this.resize();
  }

  get domElement() { return this.canvas; }

  resize() {
    const parent = this.canvas.parentElement || document.body;
    const w = Math.max(320, parent.clientWidth | 0);
    const h = Math.max(240, parent.clientHeight | 0);
    if (w === this._size.w && h === this._size.h) return;
    this._size = { w, h };
    this.gl.setSize(w, h, false);
    const dpr = this.gl.getPixelRatio();
    const rw = Math.max(320, Math.round(w * dpr * this.quality));
    const rh = Math.max(240, Math.round(h * dpr * this.quality));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.post) this.post = new PostChain(this.gl, rw, rh);
    else this.post.setSize(rw, rh);
  }

  setQuality(scale) {
    this.quality = Math.max(0.5, Math.min(1, scale));
    this._size.w = 0;              // force a resize next tick
    this.resize();
  }

  /**
   * Capture the room into an environment map. Call once the world is built
   * and the lights are on; call again after a lighting change that matters
   * (the power going out, for instance).
   */
  captureEnvironment(scene, position = new THREE.Vector3(0, 1.5, 0), size = 128) {
    if (this._pmrem) this._pmrem.dispose();
    this._pmrem = new THREE.PMREMGenerator(this.gl);
    this._pmrem.compileCubemapShader();

    const cubeRT = new THREE.WebGLCubeRenderTarget(size, { type: this.post ? this.post.type : THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.1, 60, cubeRT);
    cam.position.copy(position);
    // Hide anything flagged as a reflection-hog (billboards, the rain sheet).
    const hidden = [];
    scene.traverse((o) => { if (o.userData.noReflect && o.visible) { o.visible = false; hidden.push(o); } });
    cam.update(this.gl, scene);
    for (const o of hidden) o.visible = true;

    const env = this._pmrem.fromCubemap(cubeRT.texture).texture;
    if (scene.environment) scene.environment.dispose?.();
    scene.environment = env;
    cubeRT.dispose();
    return env;
  }

  render(scene, time) {
    this.post.render(scene, this.camera, time);
  }

  dispose() {
    this.post?.dispose();
    this._pmrem?.dispose();
    this.gl.dispose();
  }
}
