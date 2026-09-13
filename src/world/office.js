/* ============================================================
   office.js -- turns plan.js into geometry.

   It knows how to build four things: a floor, a ceiling (with a
   suspended T-bar grid), a wall with rectangular holes punched
   in it, and the trim that makes those holes read as real doors
   and windows. It does not know what any particular room is for.

   It also accumulates the collision volumes as it goes, so the
   player's collider and the visible world can never drift apart.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { box, plane, planeUV, boxUV } from './geo.js';
import { ROOMS, WALLS, WALL_T } from './plan.js';

/** An axis-aligned solid the player cannot walk through. */
class Solids {
  constructor() { this.list = []; }
  add(x0, z0, x1, z1, y1 = 3, tag = '') {
    this.list.push({
      x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1),
      y1, tag,
    });
  }
  /** Register the world-space footprint of an already-positioned object. */
  addObject(obj, tag = '', pad = 0) {
    const b = new THREE.Box3().setFromObject(obj);
    if (!isFinite(b.min.x)) return;
    this.add(b.min.x - pad, b.min.z - pad, b.max.x + pad, b.max.z + pad, b.max.y, tag);
  }
}

export class Office {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../engine/materials.js').MaterialLibrary} mats
   */
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;
    this.root = new THREE.Group();
    this.root.name = 'office';
    scene.add(this.root);
    this.solids = new Solids();
    this.rooms = new Map();
    this.doors = new Map();
    this.windows = [];
    this.lightSlots = [];      // where lighting.js should hang fixtures
  }

  build() {
    for (const room of ROOMS) this._room(room);
    for (const w of WALLS) this._wall(w);
    return this;
  }

  /* ---------------- rooms ---------------- */
  _room(room) {
    const [x0, z0, x1, z1] = room.rect;
    const w = x1 - x0, d = z1 - z0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const g = new THREE.Group();
    g.name = `room:${room.id}`;

    const floor = plane(w, d, this.mats.get(room.floor), { pos: [cx, 0, cz] });
    floor.name = `floor:${room.id}`;
    g.add(floor);

    // Structural deck above the tiles, so a missing tile shows something.
    const deck = plane(w, d, this.mats.get('concrete'), { pos: [cx, room.h + 0.34, cz], down: true });
    deck.receiveShadow = false;
    g.add(deck);

    const ceil = plane(w, d, this.mats.get(room.ceiling), { pos: [cx, room.h, cz], down: true });
    ceil.name = `ceiling:${room.id}`;
    g.add(ceil);

    if (room.grid) g.add(this._ceilingGrid(x0, z0, x1, z1, room.h));

    // Baseboard: a 100mm rubber cove base around the room's inside edge.
    const baseMat = this.mats.get('rubberBlack');
    const bh = 0.10, bt = 0.012;
    const bb = (bx, by, bz, sx, sz) => {
      const m = box(sx, bh, sz, baseMat, { pos: [bx, by, bz], shadow: 'receive' });
      g.add(m);
    };
    bb(cx, bh / 2, z0 + bt / 2, w, bt);
    bb(cx, bh / 2, z1 - bt / 2, w, bt);
    bb(x0 + bt / 2, bh / 2, cz, bt, d);
    bb(x1 - bt / 2, bh / 2, cz, bt, d);

    this.root.add(g);
    this.rooms.set(room.id, { ...room, group: g, center: new THREE.Vector3(cx, 0, cz) });

    // Suggest fixture positions on a 2.4m lattice -- lighting.js picks from these.
    const nx = Math.max(1, Math.round(w / 3.2)), nz = Math.max(1, Math.round(d / 3.2));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        this.lightSlots.push({
          room: room.id,
          x: x0 + (w * (i + 0.5)) / nx,
          z: z0 + (d * (j + 0.5)) / nz,
          y: room.h - 0.02,
        });
      }
    }
  }

  /** The visible T-bar of a suspended ceiling: 2ft x 4ft, i.e. 0.6m x 1.2m. */
  _ceilingGrid(x0, z0, x1, z1, h) {
    const mat = this.mats.get('ceilingGrid');
    const g = new THREE.Group();
    g.name = 'ceiling-grid';
    const t = 0.024, drop = 0.012;
    const y = h - drop / 2;
    for (let x = Math.ceil(x0 / 1.2) * 1.2; x <= x1; x += 1.2) {
      const m = box(t, drop, z1 - z0, mat, { pos: [x, y, (z0 + z1) / 2], shadow: 'none' });
      g.add(m);
    }
    for (let z = Math.ceil(z0 / 0.6) * 0.6; z <= z1; z += 0.6) {
      const m = box(x1 - x0, drop, t, mat, { pos: [(x0 + x1) / 2, y, z], shadow: 'none' });
      g.add(m);
    }
    return g;
  }

  /* ---------------- walls ---------------- */
  _wall(spec) {
    const [ax, az] = spec.a, [bx, bz] = spec.b;
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    // Rotate so the panel's local +X runs along the wall.
    const yaw = Math.atan2(-uz, ux);
    const mat = this.mats.get(spec.mat);
    const h = spec.h;
    const g = new THREE.Group();
    g.name = `wall:${ax},${az}-${bx},${bz}`;

    const panel = (t0, t1, y0, y1) => {
      const w = t1 - t0;
      if (w <= 0.0005 || y1 - y0 <= 0.0005) return;
      const mid = (t0 + t1) / 2;
      const m = box(w, y1 - y0, WALL_T, mat, {
        pos: [ax + ux * mid, (y0 + y1) / 2, az + uz * mid],
        rot: [0, yaw, 0],
        shadow: 'receive',
      });
      m.castShadow = true;
      g.add(m);
    };

    // Two-tone institutional paint: darker below a chair rail. Applied as a
    // thin overlay so it does not complicate the wall's own hole logic.
    const wainscotH = spec.wainscot === false ? 0 : 1.05;
    const lowMat = this.mats.get('wallPaintLow');
    const railMat = this.mats.get('woodTrim');
    const overlay = (t0, t1, capH) => {
      const w = t1 - t0;
      const wh = Math.min(wainscotH, capH ?? wainscotH);
      if (w <= 0.02 || wh <= 0.02) return;
      const mid = (t0 + t1) / 2;
      const face = WALL_T / 2 + 0.011;
      for (const side of [1, -1]) {
        const nx = -uz * side, nz = ux * side;
        g.add(box(w, wh, 0.022, lowMat, {
          pos: [ax + ux * mid + nx * face, wh / 2, az + uz * mid + nz * face],
          rot: [0, yaw, 0], shadow: 'receive',
        }));
        // The rail only runs where the wall goes full height; under a window
        // the dark paint simply runs up to the sill.
        if (wh >= wainscotH - 0.001) {
          g.add(box(w, 0.05, 0.034, railMat, {
            pos: [ax + ux * mid + nx * (face + 0.006), wh + 0.025, az + uz * mid + nz * (face + 0.006)],
            rot: [0, yaw, 0], shadow: 'receive',
          }));
        }
      }
    };

    const holes = (spec.holes || []).slice().sort((p, q) => p.t0 - q.t0);
    let cursor = 0;
    for (const hole of holes) {
      panel(cursor, hole.t0, 0, h);
      overlay(cursor, hole.t0);
      if (hole.y0 > 0.001) { panel(hole.t0, hole.t1, 0, hole.y0); overlay(hole.t0, hole.t1, hole.y0 - 0.02); }
      if (hole.y1 < h - 0.001) panel(hole.t0, hole.t1, hole.y1, h);
      this._trim(g, hole, ax, az, ux, uz, yaw, h);
      cursor = hole.t1;
    }
    panel(cursor, len, 0, h);
    overlay(cursor, len);

    this.root.add(g);

    // Collision: the wall as a whole, minus the door openings, which we cut
    // by registering the solid in spans instead of one slab.
    const spans = [];
    let c = 0;
    for (const hole of holes) {
      if (hole.y0 < 0.9) { spans.push([c, hole.t0]); c = hole.t1; }   // walk-through
    }
    spans.push([c, len]);
    const half = WALL_T / 2 + 0.02;
    for (const [s0, s1] of spans) {
      if (s1 - s0 <= 0.001) continue;
      const p0x = ax + ux * s0, p0z = az + uz * s0;
      const p1x = ax + ux * s1, p1z = az + uz * s1;
      this.solids.add(
        Math.min(p0x, p1x) - (Math.abs(ux) > 0.5 ? 0 : half),
        Math.min(p0z, p1z) - (Math.abs(uz) > 0.5 ? 0 : half),
        Math.max(p0x, p1x) + (Math.abs(ux) > 0.5 ? 0 : half),
        Math.max(p0z, p1z) + (Math.abs(uz) > 0.5 ? 0 : half),
        h, 'wall',
      );
    }
    // A locked door leaf is solid too.
    for (const hole of holes) {
      if (hole.kind === 'door' && hole.locked) {
        const mx = ax + ux * ((hole.t0 + hole.t1) / 2), mz = az + uz * ((hole.t0 + hole.t1) / 2);
        this.solids.add(mx - 0.5, mz - 0.5, mx + 0.5, mz + 0.5, hole.y1, 'door');
      }
    }
  }

  /** Casings, sills, glass and leaves -- the detail that sells an opening. */
  _trim(group, hole, ax, az, ux, uz, yaw, wallH) {
    const casingMat = this.mats.get(hole.kind === 'window' ? 'paintedSteel' : 'woodTrim');
    const t = WALL_T + 0.014;
    const cw = 0.055;
    const mid = (hole.t0 + hole.t1) / 2;
    const at = (s, y) => [ax + ux * s, y, az + uz * s];

    // jambs
    for (const s of [hole.t0 - cw / 2, hole.t1 + cw / 2]) {
      group.add(box(cw, hole.y1 - hole.y0 + cw, t, casingMat, {
        pos: at(s, (hole.y0 + hole.y1) / 2), rot: [0, yaw, 0], shadow: 'receive',
      }));
    }
    // header
    group.add(box(hole.t1 - hole.t0 + cw * 2, cw, t, casingMat, {
      pos: at(mid, hole.y1 + cw / 2), rot: [0, yaw, 0], shadow: 'receive',
    }));

    if (hole.kind === 'window') {
      // sill, glass and a center mullion
      group.add(box(hole.t1 - hole.t0 + cw * 2, cw, t + 0.035, casingMat, {
        pos: at(mid, hole.y0 - cw / 2), rot: [0, yaw, 0], shadow: 'receive',
      }));
      const glass = box(hole.t1 - hole.t0, hole.y1 - hole.y0, 0.012, this.mats.get('glass'), {
        pos: at(mid, (hole.y0 + hole.y1) / 2), rot: [0, yaw, 0], shadow: 'none',
      });
      glass.castShadow = false; glass.receiveShadow = false;
      glass.userData.noReflect = true;
      glass.name = 'window-glass';
      group.add(glass);
      group.add(box(0.04, hole.y1 - hole.y0, WALL_T, casingMat, {
        pos: at(mid, (hole.y0 + hole.y1) / 2), rot: [0, yaw, 0], shadow: 'none',
      }));
      this.windows.push({
        x: ax + ux * mid, z: az + uz * mid, yaw,
        y0: hole.y0, y1: hole.y1, w: hole.t1 - hole.t0,
      });
    }

    if (hole.kind === 'door') {
      const leafW = hole.t1 - hole.t0 - 0.02;
      const leafH = hole.y1 - 0.02;
      const leaf = box(leafW, leafH, 0.042, this.mats.get('woodTrim'), {
        pos: [0, 0, 0], shadow: 'both',
      });
      const pivot = new THREE.Group();
      // hinge on the low-t side, swing into the room
      pivot.position.set(...at(hole.t0 + 0.01, leafH / 2));
      pivot.rotation.y = yaw;
      leaf.position.x = leafW / 2;
      pivot.add(leaf);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), this.mats.get('brass'));
      knob.position.set(leafW - 0.07, 0.06, 0.03);
      knob.castShadow = true;
      leaf.add(knob);
      pivot.rotation.y += hole.locked ? 0 : -1.35;   // ajar unless it is the locked one
      group.add(pivot);
      if (hole.id) this.doors.set(hole.id, { pivot, locked: !!hole.locked, hole });
    }
  }
}
