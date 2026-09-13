/* ============================================================
   geo.js -- geometry helpers.

   The one rule that matters here: UVs are authored in METERS.
   A box that is 2m wide gets UVs running 0..2, so every material
   in the building lands at the same texel density and a desk does
   not look like it is wearing a different scale of woodgrain than
   the door beside it. materials.js reads `repeat` as tiles-per-
   meter on the other side of that contract.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';

/** Rewrite a BoxGeometry's UVs into meters. Assumes 1 segment per face. */
export function boxUV(geo, w, h, d) {
  const uv = geo.attributes.uv;
  // three's box face order: +X, -X, +Y, -Y, +Z, -Z
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Rewrite a PlaneGeometry's UVs into meters. */
export function planeUV(geo, w, h) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  uv.needsUpdate = true;
  return geo;
}

/**
 * A box mesh with meter UVs.
 * `opts.shadow` -> 'both' | 'cast' | 'receive' | 'none' (default 'both').
 */
export function box(w, h, d, material, opts = {}) {
  const geo = boxUV(new THREE.BoxGeometry(w, h, d), w, h, d);
  const m = new THREE.Mesh(geo, material);
  const s = opts.shadow ?? 'both';
  m.castShadow = s === 'both' || s === 'cast';
  m.receiveShadow = s === 'both' || s === 'receive';
  if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  if (opts.rot) m.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
  if (opts.name) m.name = opts.name;
  return m;
}

/** A horizontal plane (floor/ceiling) with meter UVs, facing +Y by default. */
export function plane(w, d, material, opts = {}) {
  const geo = planeUV(new THREE.PlaneGeometry(w, d), w, d);
  const m = new THREE.Mesh(geo, material);
  m.rotation.x = opts.down ? Math.PI / 2 : -Math.PI / 2;
  m.receiveShadow = opts.shadow !== 'none';
  if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  if (opts.name) m.name = opts.name;
  return m;
}

/** A vertical wall panel with meter UVs. `axis` is 'x' or 'z'. */
export function wall(w, h, material, opts = {}) {
  const geo = planeUV(new THREE.PlaneGeometry(w, h), w, h);
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  m.castShadow = false;
  if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  if (opts.rot) m.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
  if (opts.name) m.name = opts.name;
  return m;
}

export function cylinder(rTop, rBottom, h, material, opts = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, opts.seg ?? 16, 1, !!opts.open);
  const m = new THREE.Mesh(geo, material);
  const s = opts.shadow ?? 'both';
  m.castShadow = s === 'both' || s === 'cast';
  m.receiveShadow = s === 'both' || s === 'receive';
  if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  if (opts.rot) m.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
  if (opts.name) m.name = opts.name;
  return m;
}

/**
 * A box whose edges are chamfered, built as three interpenetrating slabs --
 * the classic rounded-box trick. Real furniture almost never has a perfectly
 * sharp corner, and the thin highlight running along a chamfer is most of what
 * sells an object as manufactured rather than modeled.
 */
export function bevelBox(w, h, d, material, bevel = 0.012, opts = {}) {
  const b = Math.min(bevel, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const group = new THREE.Group();
  const slab = (sw, sh, sd) => {
    const m = new THREE.Mesh(boxUV(new THREE.BoxGeometry(sw, sh, sd), sw, sh, sd), material);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  group.add(slab(w - 2 * b, h, d - 2 * b));   // full height, inset sides
  group.add(slab(w, h - 2 * b, d - 2 * b));   // full width, inset top/bottom
  group.add(slab(w - 2 * b, h - 2 * b, d));   // full depth, inset top/bottom
  if (opts.pos) group.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  if (opts.rot) group.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
  if (opts.name) group.name = opts.name;
  return group;
}

/** Degrees to radians, because the layout data reads better in degrees. */
export const deg = (d) => (d * Math.PI) / 180;

/* ============================================================
   STATIC MERGING
   ============================================================ */

/**
 * Merge every static mesh in `root` into one BufferGeometry per material.
 *
 * The office shell alone is several hundred boxes -- wall panels, wainscot,
 * baseboard, ceiling T-bar -- and none of them ever move. Drawing them
 * individually costs hundreds of draw calls for no benefit.
 *
 * A mesh is left alone if it is flagged `userData.noMerge`, if it or any
 * ancestor is interactive, if it is animated, or if it is not a plain
 * indexed/non-indexed triangle mesh. Lights, cameras and instanced meshes
 * are never touched.
 *
 * @returns {{before:number, after:number}}
 */
export function mergeStatics(root) {
  const buckets = new Map();        // material -> [mesh]
  let before = 0;

  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    before++;
    if (o.userData.noMerge) return;
    // walk up: anything inside an interactive or animated object stays put
    for (let p = o; p; p = p.parent) {
      if (p.userData && (p.userData.interact || p.userData.animated || p.userData.noMerge)) return;
    }
    const g = o.geometry;
    if (!g || !g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
    const mat = o.material;
    if (Array.isArray(mat) || mat.transparent) return;
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(o);
  });

  let after = before;
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const merged = mergeGeometries(meshes);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = meshes.some((m) => m.castShadow);
    mesh.receiveShadow = meshes.some((m) => m.receiveShadow);
    mesh.name = `merged:${material.name || 'material'}`;
    mesh.userData.merged = meshes.length;
    root.add(mesh);
    for (const m of meshes) {
      m.parent.remove(m);
      m.geometry.dispose();
    }
    after -= meshes.length - 1;
  }
  return { before, after };
}

/** Concatenate meshes' geometries in world space. Positions/normals/uvs only. */
function mergeGeometries(meshes) {
  let vertCount = 0;
  let indexCount = 0;
  for (const m of meshes) {
    const g = m.geometry;
    vertCount += g.attributes.position.count;
    indexCount += g.index ? g.index.count : g.attributes.position.count;
  }
  if (vertCount === 0) return null;

  const pos = new Float32Array(vertCount * 3);
  const nrm = new Float32Array(vertCount * 3);
  const uv = new Float32Array(vertCount * 2);
  const idx = vertCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  let vo = 0, io = 0;

  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const world = m.matrixWorld;
    normalMatrix.getNormalMatrix(world);
    const g = m.geometry;
    const p = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(world);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      n.fromBufferAttribute(na, i).applyMatrix3(normalMatrix).normalize();
      nrm[(vo + i) * 3] = n.x; nrm[(vo + i) * 3 + 1] = n.y; nrm[(vo + i) * 3 + 2] = n.z;
      uv[(vo + i) * 2] = ua.getX(i); uv[(vo + i) * 2 + 1] = ua.getY(i);
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = vo + g.index.getX(i);
      io += g.index.count;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = vo + i;
      io += p.count;
    }
    vo += p.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}
