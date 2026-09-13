/* ============================================================
   lighting.js -- fixtures, and the power behind them.

   The office is lit by recessed fluorescent troffers: an emissive
   prismatic diffuser for the look, a downward spot for the falloff.
   Only a couple of them cast real shadows -- a ceiling full of
   shadow-casting lights buys almost nothing and costs a lot.

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

const TUBE_COLOR = new THREE.Color(0xdce6f2);     // cool white, healthy
const TUBE_SICK = new THREE.Color(0xbfd4a8);      // failing ballast green

export class Fixture {
  constructor(group, light, diffuser, seed) {
    this.group = group;
    this.light = light;
    this.diffuser = diffuser;
    this.baseIntensity = light.intensity;
    this.rand = rng(seed);
    this.phase = this.rand() * 100;
    this.health = 0.75 + this.rand() * 0.25;   // some tubes are just tired
    this.flickerUntil = 0;
    this.out = false;
  }

  /** Make this fixture stutter for `dur` seconds. */
  stutter(now, dur = 1.2) { this.flickerUntil = now + dur; }

  update(now, power) {
    if (this.out || power <= 0.001) {
      this.light.intensity = 0;
      if (this.light.userData.spill) this.light.userData.spill.intensity = 0;
      this.diffuser.material.emissiveIntensity = 0.02;
      return;
    }
    let k = power * this.health;
    // A fluorescent under a sagging supply does not dim, it chatters.
    const unstable = power < 0.62 || now < this.flickerUntil;
    if (unstable) {
      const n = Math.sin((now + this.phase) * 47.3) * Math.sin((now + this.phase) * 13.1);
      const drop = n > 0.15 ? 1 : n > -0.1 ? 0.35 : 0.06;
      k *= drop;
      // 120Hz ripple on top, because that is what a failing ballast does
      k *= 0.85 + 0.15 * Math.sin(now * 120 + this.phase);
    } else {
      k *= 0.985 + 0.015 * Math.sin(now * 100 + this.phase);
    }
    this.light.intensity = this.baseIntensity * k;
    if (this.light.userData.spill) this.light.userData.spill.intensity = 9.0 * k;
    this.light.color.copy(TUBE_COLOR).lerp(TUBE_SICK, unstable ? 0.7 : Math.max(0, 0.35 - power * 0.35));
    this.diffuser.material.emissiveIntensity = 0.06 + 2.6 * k;
  }
}

export class Lighting {
  constructor(scene, mats, office) {
    this.scene = scene;
    this.mats = mats;
    this.office = office;
    this.fixtures = [];
    this.power = 1;            // 0..1, the horror director's main dial
    this.targetPower = 1;
    this.root = new THREE.Group();
    this.root.name = 'lighting';
    scene.add(this.root);
    this._lightning = { t: -99, strength: 0, next: 6 };
    this._rand = rng(0xBEEF);
  }

  build() {
    // Ambient: the tiny amount of bounce a windowless-feeling office has.
    this.hemi = new THREE.HemisphereLight(0x6d7c92, 0x3b3733, 0.62);
    this.root.add(this.hemi);

    // The storm outside. Very dim on its own; it exists so lightning has
    // something to spike, and so the windows are not black rectangles.
    this.moon = new THREE.DirectionalLight(0x6f86b8, 0.10);
    this.moon.position.set(16, 9, 5);
    this.moon.target.position.set(5, 0, 4);
    this.root.add(this.moon, this.moon.target);

    // Troffers. Shadow casters only where the player actually looks.
    const shadowRooms = new Set(['dispatch']);
    let castersLeft = 2;
    this.office.lightSlots.forEach((slot, i) => {
      const wantShadow = shadowRooms.has(slot.room) && castersLeft > 0 && i % 2 === 0;
      if (wantShadow) castersLeft--;
      this.root.add(this._troffer(slot, wantShadow, i));
    });

    return this;
  }

  _troffer(slot, castShadow, seed) {
    const g = new THREE.Group();
    g.position.set(slot.x, slot.y, slot.z);

    // housing + prismatic diffuser (1.2m x 0.6m, the standard 2x4 troffer)
    const shell = box(1.22, 0.10, 0.62, this.mats.get('paintedSteel'), {
      pos: [0, 0.05, 0], shadow: 'none',
    });
    g.add(shell);
    const diffMat = this.mats.get('lampDiffuser').clone();
    diffMat.emissive = new THREE.Color(0xdfe9ff);
    const diffuser = plane(1.14, 0.54, diffMat, { pos: [0, -0.005, 0], down: true });
    diffuser.receiveShadow = false;
    diffuser.userData.noReflect = false;
    g.add(diffuser);

    const light = new THREE.SpotLight(TUBE_COLOR.getHex(), 22.0, 10.0, Math.PI * 0.52, 0.82, 1.9);
    light.position.set(0, -0.04, 0);
    light.target.position.set(0, -3, 0);
    g.add(light, light.target);
    if (castShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = 0.4;
      light.shadow.camera.far = 8;
      light.shadow.bias = -0.0016;
      light.shadow.normalBias = 0.022;
    }

    // A dim omni just under the diffuser so the tile field around each
    // fixture picks up light; a real troffer spills onto its own ceiling.
    const spill = new THREE.PointLight(TUBE_COLOR.getHex(), 9.0, 5.0, 2.0);
    spill.position.set(0, -0.12, 0);
    g.add(spill);
    light.userData.spill = spill;

    g.userData.animated = true;        // the diffuser's emissive is driven per frame

    const f = new Fixture(g, light, diffuser, 1000 + seed * 17);
    this.fixtures.push(f);
    return g;
  }

  /** Attach an extra light that follows the power rail (desk lamp, CRT glow). */
  register(light, diffuser, seed = 0) {
    const f = new Fixture(light.parent || this.root, light, diffuser || { material: {} }, seed);
    this.fixtures.push(f);
    return f;
  }

  /** Kill or restore the building. `rate` is how fast power slews. */
  setPower(v, immediate = false) {
    this.targetPower = Math.max(0, Math.min(1, v));
    if (immediate) this.power = this.targetPower;
  }

  /** Make every fixture in the room stutter at once. */
  stutterAll(now, dur = 1.4) { for (const f of this.fixtures) f.stutter(now, dur); }

  /** Fire a lightning flash immediately. */
  strike(now, strength = 1) {
    this._lightning.t = now;
    this._lightning.strength = strength;
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
    this.hemi.intensity = 0.62 + flash * 1.1;
    this.lightningFlash = flash;

    for (const f of this.fixtures) f.update(now, this.power);
  }
}
