/* ============================================================
   bake.js -- static lighting, computed once at load.

   The problem this solves:

   A thirteen-fixture office needs thirteen lights to look lit,
   and a forward renderer cannot afford thirteen lights. Pooling
   them (lighting.js) makes the game fast but leaves everything
   more than a few meters from the player in the dark, which is
   not what a fluorescent office looks like.

   So the fixtures are evaluated ONCE, at load, into a per-vertex
   irradiance term stored as vertex colors. Every fixture in the
   building contributes to every static surface, for zero cost per
   frame. The light pool then only has to supply what a bake
   cannot: crisp nearby falloff, real shadows, and flicker.

   The baked term is ADDED as irradiance, not multiplied into
   albedo. three's built-in `vertexColors` multiplies the diffuse
   color, which can only ever darken a surface -- baking that way
   produced a uniformly black building, because multiplying
   darkness by anything is still darkness. So the value is stored
   in a custom `bakedLight` attribute and injected into the
   standard material's shader as
       totalEmissiveRadiance += bakedLight * diffuseColor.rgb
   which is irradiance times albedo: real diffuse lighting, with
   the surface's own color and texture intact, at the cost of one
   extra vec3 per vertex and no per-fragment light loop.

   Occlusion is tested against the wall volumes only, so the
   corridor does not get lit through a wall by the dispatch room.

   LIMITATION: a baked term cannot move. Global dimming still
   works (the brownout scales every baked material's `color`), but
   a single fixture going dark leaves its baked pool of light on
   the floor. Fixtures near the player hold a real pooled light,
   so the ones the player can actually watch flicker correctly.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';

const AMBIENT_FLOOR = 0.055;   // the bounce that keeps corners off pure black
const FIXTURE_RANGE = 5.2;     // meters at which a troffer is half strength

/**
 * @param {THREE.Object3D} root      the scene (or a subtree)
 * @param {Array} fixtures           lighting.js Fixture list (position + health)
 * @param {Array} solids             office.solids.list, for occlusion
 * @returns {{meshes:number, verts:number, ms:number}}
 */
export function bakeStaticLight(root, fixtures, solids) {
  const t0 = performance.now();

  // Only the wall volumes block light. Desks and cabinets are short and
  // testing them buys shadow detail the pool is already providing.
  const blockers = solids.filter((s) => s.tag === 'wall' && s.y1 > 1.5);

  const targets = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!o.geometry || !o.geometry.attributes.position || !o.geometry.attributes.normal) return;
    if (o.material && (Array.isArray(o.material) || o.material.transparent)) return;
    if (!o.material || !o.material.isMeshStandardMaterial) return;
    // Anything that moves, glows or is driven per frame keeps a plain material.
    for (let p = o; p; p = p.parent) {
      if (p.userData && (p.userData.animated || p.userData.noBake)) return;
    }
    // Skip things that emit their own light. Test the emissive COLOR, not
    // emissiveIntensity -- that defaults to 1 on every standard material
    // whether or not the material emits anything, and testing it excluded
    // almost the entire building from the bake.
    const e = o.material.emissive;
    if (e && (e.r + e.g + e.b) > 0.01) return;
    targets.push(o);
  });

  // One vertex-colored clone per source material, so the number of draw
  // calls is unchanged -- meshes that batched together before still do.
  const clones = new Map();
  const lit = fixtures.map((f) => ({ x: f.pos.x, y: f.pos.y, z: f.pos.z, k: f.health }));

  let verts = 0;
  let lo = 1, hi = 0, acc = 0;         // so the result can be sanity-checked
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (const mesh of targets) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const count = pos.count;
    const col = new Float32Array(count * 3);
    mesh.updateWorldMatrix(true, false);
    const world = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(world);

    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(world);
      n.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();

      let sum = AMBIENT_FLOOR;
      let bounce = 0;
      for (const f of lit) {
        const dx = f.x - v.x, dy = f.y - v.y, dz = f.z - v.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 400) continue;                         // 20m: nothing to add
        const d = Math.sqrt(d2) || 1e-4;
        const lx = dx / d, ly = dy / d, lz = dz / d;

        // A single-bounce approximation: light that reaches this point off
        // the floor and the walls rather than straight from the tube. It is
        // normal-independent and falls off slowly, which is what lifts the
        // corners and the undersides that direct light never reaches. Without
        // it a room lit only by direct terms reads as a cave with lamps in it.
        const dw = d / 9;
        bounce += (0.17 * f.k) / (1 + dw * dw * 1.6);

        const ndotl = n.x * lx + n.y * ly + n.z * lz;
        if (ndotl <= 0.001) continue;                   // facing away

        // A troffer is a downward-facing panel, not a bulb: weight by how
        // far off its axis the surface is. The fixture points down (0,-1,0)
        // and the direction from it to this vertex is -L, so the cosine we
        // want is dot((0,-1,0), -L) = +ly. Getting this sign wrong skips
        // every contribution and bakes a pitch-black building.
        const axis = ly;
        if (axis <= 0.02) continue;
        const spot = axis * axis;

        const atten = 1 / (1 + (d / FIXTURE_RANGE) * (d / FIXTURE_RANGE) * 2.6);
        const contrib = ndotl * spot * atten * f.k;
        if (contrib < 0.004) continue;
        if (occluded(v, f, blockers)) continue;
        sum += contrib * 0.95;
      }

      // The bounce is occluded by the same walls, cheaply: scale it by how
      // much direct light the point saw, so a sealed corridor does not glow
      // from the dispatch room's fixtures.
      const c = Math.min(1.35, sum + bounce * Math.min(1, 0.25 + sum));
      if (c < lo) lo = c;
      if (c > hi) hi = c;
      acc += c;
      // A slight warm/cool split: light from the tubes is cool, the floor
      // bounce that fills the rest is not.
      col[i * 3] = c;
      col[i * 3 + 1] = Math.min(1, c * 1.005);
      col[i * 3 + 2] = Math.min(1, c * 1.02);
    }

    geo.setAttribute('bakedLight', new THREE.BufferAttribute(col, 3));
    verts += count;

    let clone = clones.get(mesh.material);
    if (!clone) {
      clone = makeBakedMaterial(mesh.material);
      clones.set(mesh.material, clone);
    }
    mesh.material = clone;
  }

  return {
    meshes: targets.length,
    verts,
    min: +lo.toFixed(3),
    max: +hi.toFixed(3),
    mean: verts ? +(acc / verts).toFixed(3) : 0,
    ms: Math.round(performance.now() - t0),
    materials: [...clones.values()],
  };
}

/**
 * Clone a standard material and teach it to read the baked attribute.
 *
 * `onBeforeCompile` is the supported way to extend three's built-in
 * materials without forking them: the material keeps shadows, the
 * environment map, normal mapping and everything else, and gains one
 * additional term.
 */
function makeBakedMaterial(source) {
  const m = source.clone();
  m.name = `${source.name || 'mat'}:baked`;
  m.userData.bakedPower = { value: 1 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBakedPower = m.userData.bakedPower;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 bakedLight;
varying vec3 vBakedLight;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vBakedLight = bakedLight;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uBakedPower;
varying vec3 vBakedLight;`)
      // diffuseColor is final albedo here (material color * map), and
      // totalEmissiveRadiance is added to the outgoing light further down.
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vBakedLight * diffuseColor.rgb * uBakedPower;`);
  };
  // Materials that compile to different programs must not share a cache key.
  m.customProgramCacheKey = () => 'baked';
  return m;
}

/** Segment-vs-AABB, slab method. Tolerances keep coplanar surfaces lit. */
function occluded(from, to, blockers) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  for (const b of blockers) {
    // Nudge the ends in so a wall never shadows its own face.
    let t0 = 0.02, t1 = 0.98;
    let ok = true;
    for (const [o, d, lo, hi] of [
      [from.x, dx, b.x0, b.x1],
      [from.z, dz, b.z0, b.z1],
      [from.y, dy, 0, b.y1],
    ]) {
      if (Math.abs(d) < 1e-6) {
        if (o < lo || o > hi) { ok = false; break; }
        continue;
      }
      let a = (lo - o) / d, c = (hi - o) / d;
      if (a > c) { const tmp = a; a = c; c = tmp; }
      if (a > t0) t0 = a;
      if (c < t1) t1 = c;
      if (t0 > t1) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Scale every baked material with the mains. A brownout has to dim the baked
 * contribution too, or the building browns out everywhere except the walls.
 */
export function setBakedPower(materials, power) {
  const k = Math.max(0, Math.min(1, power));
  for (const m of materials) {
    if (m.userData.bakedPower) m.userData.bakedPower.value = k;
  }
}
