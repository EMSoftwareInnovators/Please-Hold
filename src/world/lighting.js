/* ============================================================
   lighting.js -- fixtures, and the power behind them.

   -------------------------------------------------------------
   THE RULE THIS FILE EXISTS TO ENFORCE: a small, FIXED number of
   real lights.

   three.js is a forward renderer. Every light in the scene is
   evaluated by every fragment of every object, every frame. The
   first version of this file put a spot light AND a fill point
   light inside each of thirteen ceiling troffers, which together
   with the exterior and the desk came to thirty-seven lights.
   That is thirty-seven lighting evaluations per pixel, and it ran
   at seconds per frame on an M1.

   So: the troffers are now geometry with an emissive diffuser and
   nothing else. A POOL of a few real lights follows the player
   around and is lent to whichever fixtures are nearest. The pool
   never changes size -- unused slots are driven to zero intensity
   rather than removed -- because changing the light count forces
   three.js to recompile every material in the scene.

   If you add a light anywhere in this project, add it here, and
   subtract one somewhere else.
   -------------------------------------------------------------

   The whole rig hangs off a single `power` value (0..1) so the
   horror director can brown the building out, strobe it, or kill
   it outright without touching individual fixtures. Fluorescent
   tubes do not fade gracefully, so `power` drives a flicker model
   rather than a plain dimmer: below about 0.6 the ballasts start
   to stutter and the color goes green and sick.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { box, plane } from './geo.js';
import { rng } from '../engine/noise.js';

const TUBE_COLOR = new THREE.Color(0xdce6f2);     // 4100K office white
const TUBE_SICK = new THREE.Color(0xbfd4a8);      // failing ballast green

/** How many real spot lights the ceiling is allowed, by quality level. */
export const POOL_SIZE = { low: 2, medium: 4, high: 5 };

/**
 * One ceiling troffer. It owns its housing, its diffuser and its flicker
 * state. It does NOT own a light -- it borrows one from the pool when the
 * player is near enough for it to matter.
 */
export class Fixture {
  constructor(group, diffuser, seed, pos) {
    this.group = group;
    this.diffuser = diffuser;
    this.pos = pos;
    this.rand = rng(seed);
    this.phase = this.rand() * 100;
    this.health = 0.75 + this.rand() * 0.25;   // some tubes are just tired
    this.flickerUntil = 0;
    this.out = false;
    this.k = 1;            // current brightness, 0..1
    this.slot = null;      // the pooled light on loan to this fixture
  }

  /** Make this fixture stutter for `dur` seconds. */
  stutter(now, dur = 1.2) { this.flickerUntil = now + dur; }

  /** Recompute brightness and drive the diffuser. Returns the brightness. */
  update(now, power, reduceFlicker) {
    if (this.out || power <= 0.001) {
      this.k = 0;
      this.diffuser.material.emissiveIntensity = 0.02;
      return 0;
    }
    let k = power * this.health;
    // A fluorescent under a sagging supply does not dim, it chatters.
    const unstable = power < 0.62 || now < this.flickerUntil;
    if (unstable) {
      if (reduceFlicker) {
        k *= 0.55 + 0.12 * Math.sin(now * 7 + this.phase);
      } else {
        const n = Math.sin((now + this.phase) * 47.3) * Math.sin((now + this.phase) * 13.1);
        const drop = n > 0.15 ? 1 : n > -0.1 ? 0.35 : 0.06;
        k *= drop;
        // 120Hz ripple on top, because that is what a failing ballast does
        k *= 0.85 + 0.15 * Math.sin(now * 120 + this.phase);
      }
    } else {
      k *= 0.985 + 0.015 * Math.sin(now * 100 + this.phase);
    }
    this.k = k;
    this.unstable = unstable;
    this.diffuser.material.emissiveIntensity = 0.06 + 2.6 * k;
    return k;
  }
}

/**
 * A fixed set of spot lights lent to the nearest fixtures.
 *
 * Reassignment has hysteresis: a slot only changes hands when a clearly
 * closer fixture appears, and the handover fades rather than cuts, so
 * walking across the office does not make the lighting pop.
 */
class LightPool {
  constructor(parent, count, shadows) {
    this.lights = [];
    this.owners = new Array(count).fill(null);
    for (let i = 0; i < count; i++) {
      const l = new THREE.SpotLight(TUBE_COLOR.getHex(), 0, 11.0, Math.PI * 0.52, 0.82, 1.9);
      l.position.set(0, 2.8, 0);
      l.target.position.set(0, 0, 0);
      parent.add(l, l.target);
      if (i < shadows) {
        l.castShadow = true;
        l.shadow.mapSize.set(1024, 1024);
        l.shadow.camera.near = 0.4;
        l.shadow.camera.far = 9;
        l.shadow.bias = -0.0016;
        l.shadow.normalBias = 0.022;
      }
      this.lights.push(l);
    }
    this._reassignTimer = 0;
  }

  /**
   * Hand the slots to the `count` nearest fixtures. Cheap enough to run a
   * few times a second; there is no reason to do it every frame.
   */
  assign(fixtures, focus) {
    const n = this.lights.length;
    const ranked = fixtures
      .map((f) => ({ f, d: distSq(f.pos, focus) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);

    const wanted = new Set(ranked.map((r) => r.f));
    // Keep a slot where it is if its fixture is still wanted.
    const free = [];
    for (let i = 0; i < n; i++) {
      const owner = this.owners[i];
      if (owner && wanted.has(owner)) wanted.delete(owner);
      else free.push(i);
    }
    for (const i of free) {
      const next = [...wanted][0];
      if (next === undefined) { this.owners[i] = null; continue; }
      wanted.delete(next);
      const prev = this.owners[i];
      if (prev) prev.slot = null;
      this.owners[i] = next;
      next.slot = this.lights[i];
      const l = this.lights[i];
      l.position.copy(next.pos);
      l.target.position.set(next.pos.x, next.pos.y - 3, next.pos.z);
      l.target.updateMatrixWorld();
      l.intensity = 0;                 // fade in rather than snap on
    }
  }

  /** Drive every slot from its fixture's current brightness. */
  update(dt) {
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const owner = this.owners[i];
      const target = owner ? owner.k * 10.0 : 0;
      // A pooled light fades to its target so a handover is never a cut.
      l.intensity += (target - l.intensity) * Math.min(1, dt * 9);
      if (owner) {
        l.color.copy(TUBE_COLOR).lerp(TUBE_SICK, owner.unstable ? 0.7 : 0);
      }
    }
  }
}

const distSq = (a, b) => {
  const dx = a.x - b.x, dy = (a.y - b.y) * 0.35, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};

export class Lighting {
  /** @param {object} opts { poolSize, shadows } */
  constructor(scene, mats, office, opts = {}) {
    this.scene = scene;
    this.mats = mats;
    this.office = office;
    this.fixtures = [];
    this.power = 1;            // 0..1, the horror director's main dial
    this.targetPower = 1;
    this.reduceFlicker = false;
    this.root = new THREE.Group();
    this.root.name = 'lighting';
    scene.add(this.root);
    this._lightning = { t: -99, strength: 0, next: 6 };
    this._rand = rng(0xBEEF);
    this._focus = new THREE.Vector3(5, 2.8, 2);
    this._assignTimer = 0;
    this.poolSize = opts.poolSize ?? POOL_SIZE.high;
    this.shadowCount = opts.shadows ?? 1;
  }

  build() {
    // Ambient: the bounce a windowless-feeling office has. Two cheap lights
    // doing the work that thirteen expensive ones used to.
    this.hemi = new THREE.HemisphereLight(0x8f9caf, 0x5c564e, 0.30);
    this.root.add(this.hemi);

    // The storm outside. Very dim on its own; it exists so lightning has
    // something to spike, and so the windows are not black rectangles.
    this.moon = new THREE.DirectionalLight(0x6f86b8, 0.10);
    this.moon.position.set(16, 9, 5);
    this.moon.target.position.set(5, 0, 4);
    this.root.add(this.moon, this.moon.target);

    // Troffer geometry: housing and diffuser only, no light of its own.
    this.office.lightSlots.forEach((slot, i) => {
      this.root.add(this._troffer(slot, i));
    });

    this.pool = new LightPool(this.root, this.poolSize, this.shadowCount);
    this.pool.assign(this.fixtures, this._focus);

    // One roaming fill point so ceilings and corners are not crushed. It
    // follows the player at ceiling height and replaces the thirteen
    // per-fixture spill lights the first version had.
    this.fill = new THREE.PointLight(TUBE_COLOR.getHex(), 5.0, 9.0, 2.0);
    this.fill.position.set(5, 2.6, 3);
    this.root.add(this.fill);

    return this;
  }

  _troffer(slot, seed) {
    const g = new THREE.Group();
    g.position.set(slot.x, slot.y, slot.z);
    g.userData.animated = true;        // the diffuser's emissive is per-frame

    const shell = box(1.22, 0.10, 0.62, this.mats.get('paintedSteel'), {
      pos: [0, 0.05, 0], shadow: 'none',
    });
    g.add(shell);
    const diffMat = this.mats.get('lampDiffuser').clone();
    diffMat.emissive = new THREE.Color(0xdfe9ff);
    const diffuser = plane(1.14, 0.54, diffMat, { pos: [0, -0.005, 0], down: true });
    diffuser.receiveShadow = false;
    g.add(diffuser);

    this.fixtures.push(new Fixture(
      g, diffuser, 1000 + seed * 17,
      new THREE.Vector3(slot.x, slot.y - 0.04, slot.z),
    ));
    return g;
  }

  /** Tell the pool where the player is, so it lends lights to the right room. */
  setFocus(x, y, z) { this._focus.set(x, y, z); }

  /** Kill or restore the building. */
  setPower(v, immediate = false) {
    this.targetPower = Math.max(0, Math.min(1, v));
    if (immediate) this.power = this.targetPower;
  }

  /** Make every fixture in the building stutter at once. */
  stutterAll(now, dur = 1.4) { for (const f of this.fixtures) f.stutter(now, dur); }

  /** Fire a lightning flash immediately. */
  strike(now, strength = 1) {
    this._lightning.t = now;
    this._lightning.strength = strength;
  }

  /** Change the pool size at runtime (the quality menu). Rebuilds the pool,
   *  which recompiles materials once -- acceptable for a settings change. */
  setPoolSize(count, shadows = this.shadowCount) {
    if (count === this.poolSize && shadows === this.shadowCount) return;
    for (const l of this.pool.lights) {
      l.parent && l.parent.remove(l.target);
      l.parent && l.parent.remove(l);
      l.dispose && l.dispose();
    }
    for (const f of this.fixtures) f.slot = null;
    this.poolSize = count;
    this.shadowCount = shadows;
    this.pool = new LightPool(this.root, count, shadows);
    this.pool.assign(this.fixtures, this._focus);
  }

  update(now, dt) {
    // Power slews toward its target; a brownout sags, it does not snap.
    this.power += (this.targetPower - this.power) * Math.min(1, dt * 3.2);

    // Ambient lightning on its own schedule, plus whatever the story fires.
    if (now > this._lightning.next) {
      this._lightning.next = now + 7 + this._rand() * 22;
      this.strike(now, 0.5 + this._rand() * 0.7);
    }
    const age = now - this._lightning.t;
    let flash = 0;
    if (age >= 0 && age < 0.85) {
      // double-strike envelope: fast rise, a stutter, then a slow fade
      const a = Math.exp(-age * 16);
      const b = age > 0.14 && age < 0.26 ? Math.exp(-(age - 0.14) * 20) * 0.8 : 0;
      flash = (a + b) * this._lightning.strength;
    }
    this.moon.intensity = 0.10 + flash * 9.0;
    // The hemisphere is the base level the bake modulates, so it is part of
    // the mains: a brownout has to take it down or the walls stay lit.
    this.hemi.intensity = (0.05 + 0.25 * this.power) + flash * 1.2;
    this.lightningFlash = flash;

    // Fixtures compute their own brightness whether or not they hold a light;
    // the diffuser is what the player actually sees across the room.
    let nearest = 0;
    for (const f of this.fixtures) {
      const k = f.update(now, this.power, this.reduceFlicker);
      if (f.slot) nearest = Math.max(nearest, k);
    }

    // Lend the pool to whatever is closest, a few times a second.
    this._assignTimer -= dt;
    if (this._assignTimer <= 0) {
      this._assignTimer = 0.25;
      this.pool.assign(this.fixtures, this._focus);
    }
    this.pool.update(dt);

    // Offset behind and above, so its reflection lands off-axis rather
    // than in the middle of whatever the player is reading.
    this.fill.position.set(this._focus.x - 0.9, 2.62, this._focus.z + 1.1);
    this.fill.intensity = 1.8 * this.power * (0.9 + nearest * 0.1);
    this.fill.color.copy(TUBE_COLOR).lerp(TUBE_SICK, this.power < 0.62 ? 0.6 : 0);
  }
}
