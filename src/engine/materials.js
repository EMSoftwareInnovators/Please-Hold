/* ============================================================
   materials.js -- the named material library.

   Everything in the world asks for a material BY NAME. Nothing
   in the world knows whether that material came from a noise
   recipe or a photograph, which is the whole point: when real
   art arrives, call `MaterialLibrary.override()` (or drop files
   into assets/textures/ and list them in IMAGE_OVERRIDES) and
   the office re-skins without a single geometry change.

   Texel density is kept consistent by authoring UVs in METERS
   (see world/geo.js), so `repeat` below reads as "texture tiles
   per meter" -- a 0.5 means the pattern is two meters across.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { bake } from './textures.js';

/**
 * Optional real-art overrides. Key = material name, value = base path;
 * the loader looks for `<path>_albedo.png`, `_normal.png`, `_rough.png`.
 * Missing files silently fall back to the procedural recipe, so this list
 * can be filled in one material at a time.
 */
export const IMAGE_OVERRIDES = {
  // carpet: 'assets/textures/carpet/carpet',
};

/**
 * name -> spec.
 *   recipe   which textures.js recipe to bake
 *   size     bake resolution
 *   repeat   texture tiles per meter of surface
 *   color    multiplier over the albedo (subtle grading only)
 *   rough    roughness multiplier
 *   metal    metalness
 *   normal   normal map strength
 */
export const MATERIALS = {
  carpet:        { recipe: 'carpet',        size: 512, repeat: 1.25, rough: 1.0,  metal: 0.0, normal: 0.45 },
  ceilingTile:   { recipe: 'ceilingTile',   size: 512, repeat: 0.85, rough: 1.0,  metal: 0.0, normal: 0.05 },
  wallPaint:     { recipe: 'wallPaint',     size: 512, repeat: 1.15, rough: 1.0,  metal: 0.0, normal: 0.12 },
  wallPaintLow:  { recipe: 'wallPaint',     size: 512, repeat: 1.15, rough: 1.0,  metal: 0.0, normal: 0.12, color: 0x78806f },
  cinderblock:   { recipe: 'cinderblock',   size: 512, repeat: 0.62, rough: 1.0,  metal: 0.0, normal: 0.9 },
  vct:           { recipe: 'vct',           size: 512, repeat: 0.33, rough: 1.0,  metal: 0.0, normal: 0.5 },
  deskLaminate:  { recipe: 'deskLaminate',  size: 512, repeat: 0.42, rough: 1.0,  metal: 0.0, normal: 0.22 },
  woodTrim:      { recipe: 'woodTrim',      size: 256, repeat: 0.75, rough: 1.0,  metal: 0.0, normal: 0.28 },
  paintedSteel:  { recipe: 'paintedSteel',  size: 256, repeat: 1.6,  rough: 1.0,  metal: 0.18, normal: 0.2 },
  greyMetal:     { recipe: 'greyMetal',     size: 256, repeat: 1.8,  rough: 1.0,  metal: 0.75, normal: 0.5 },
  beigePlastic:  { recipe: 'beigePlastic',  size: 256, repeat: 6.0,  rough: 1.0,  metal: 0.0, normal: 0.08 },
  darkPlastic:   { recipe: 'darkPlastic',   size: 256, repeat: 7.0,  rough: 1.0,  metal: 0.0, normal: 0.10 },
  corkboard:     { recipe: 'corkboard',     size: 256, repeat: 2.2,  rough: 1.0,  metal: 0.0, normal: 0.3 },
  paper:         { recipe: 'paper',         size: 256, repeat: 1.6,  rough: 1.0,  metal: 0.0, normal: 0.3 },
  concrete:      { recipe: 'concrete',      size: 512, repeat: 0.45, rough: 1.0,  metal: 0.0, normal: 0.8 },
  rubberMat:     { recipe: 'rubberMat',     size: 256, repeat: 1.6,  rough: 1.0,  metal: 0.0, normal: 1.0 },
};

/** Flat (non-textured) materials for small parts where a bake is wasted. */
export const FLATS = {
  black:        { color: 0x121316, rough: 0.55, metal: 0.0 },
  rubberBlack:  { color: 0x0d0e10, rough: 0.9,  metal: 0.0 },
  chrome:       { color: 0xc6cad0, rough: 0.18, metal: 1.0 },
  brass:        { color: 0xb08d4a, rough: 0.32, metal: 1.0 },
  glass:        { color: 0x9fb4bd, rough: 0.05, metal: 0.0, opacity: 0.22, transparent: true },
  crtGlass:     { color: 0x16191c, rough: 0.10, metal: 0.0 },
  amberLens:    { color: 0xffb641, rough: 0.3,  metal: 0.0, emissive: 0xff9a20, emissiveIntensity: 1.2 },
  redLens:      { color: 0xd83b32, rough: 0.3,  metal: 0.0, emissive: 0xff2a1a, emissiveIntensity: 1.0 },
  greenLens:    { color: 0x3fd873, rough: 0.3,  metal: 0.0, emissive: 0x28ff72, emissiveIntensity: 1.0 },
  lampDiffuser: { color: 0xe8ecf2, rough: 0.65, metal: 0.0, emissive: 0xdfe9ff, emissiveIntensity: 1.0 },
  ceilingGrid:  { color: 0xb9bcc0, rough: 0.55, metal: 0.35 },
  darkFabric:   { color: 0x2a2d35, rough: 0.95, metal: 0.0 },
  whitePaint:   { color: 0xd7d9d4, rough: 0.8,  metal: 0.0 },
  copper:       { color: 0xa8662f, rough: 0.35, metal: 1.0 },
};

export class MaterialLibrary {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = new Map();
    this.maps = new Map();
    this.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  }

  /** Bake (or fetch) the texture set behind a material name. */
  _maps(name) {
    if (this.maps.has(name)) return this.maps.get(name);
    const spec = MATERIALS[name];
    const baked = bake(spec.recipe, spec.size);
    const wrap = (canvas, srgb) => {
      const t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = this.anisotropy;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    };
    const set = {
      map: wrap(baked.albedo, true),
      normalMap: wrap(baked.normal, false),
      roughnessMap: wrap(baked.rough, false),
    };
    this.maps.set(name, set);
    return set;
  }

  /**
   * Get a material by name. `repeatScale` lets one surface tile differently
   * from the library default without authoring a second material.
   */
  get(name, repeatScale = 1) {
    const key = repeatScale === 1 ? name : `${name}@${repeatScale}`;
    if (this.cache.has(key)) return this.cache.get(key);

    if (FLATS[name]) {
      const f = FLATS[name];
      const m = new THREE.MeshStandardMaterial({
        color: f.color,
        roughness: f.rough,
        metalness: f.metal,
        emissive: f.emissive ?? 0x000000,
        emissiveIntensity: f.emissiveIntensity ?? 1,
        transparent: !!f.transparent,
        opacity: f.opacity ?? 1,
      });
      m.name = name;
      this.cache.set(key, m);
      return m;
    }

    const spec = MATERIALS[name];
    if (!spec) throw new Error(`materials: unknown material "${name}"`);
    const base = this._maps(name);
    const rep = spec.repeat * repeatScale;
    // Textures are shared; clone so each repeat variant keeps its own matrix.
    const map = base.map.clone(); map.needsUpdate = true;
    const normalMap = base.normalMap.clone(); normalMap.needsUpdate = true;
    const roughnessMap = base.roughnessMap.clone(); roughnessMap.needsUpdate = true;
    for (const t of [map, normalMap, roughnessMap]) t.repeat.set(rep, rep);

    const m = new THREE.MeshStandardMaterial({
      map, normalMap, roughnessMap,
      color: spec.color ?? 0xffffff,
      roughness: spec.rough ?? 1,
      metalness: spec.metal ?? 0,
    });
    m.normalScale = new THREE.Vector2(spec.normal ?? 1, spec.normal ?? 1);
    m.name = name;
    this.cache.set(key, m);
    return m;
  }

  /**
   * Replace a material's textures with loaded images. Call before the world
   * is built. Any of the three maps may be omitted.
   */
  override(name, { map, normalMap, roughnessMap }) {
    const existing = this.maps.get(name) || {};
    this.maps.set(name, { ...existing, ...(map && { map }), ...(normalMap && { normalMap }), ...(roughnessMap && { roughnessMap }) });
    for (const key of [...this.cache.keys()]) if (key === name || key.startsWith(`${name}@`)) this.cache.delete(key);
  }

  /** Bake everything up front so there is no hitch mid-shift. */
  async warm(onProgress) {
    const names = Object.keys(MATERIALS);
    for (let i = 0; i < names.length; i++) {
      this.get(names[i]);
      if (onProgress) onProgress((i + 1) / names.length, names[i]);
      // Yield so the loading screen can actually paint.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    for (const set of this.maps.values()) for (const t of Object.values(set)) t.dispose && t.dispose();
    this.cache.clear(); this.maps.clear();
  }
}
