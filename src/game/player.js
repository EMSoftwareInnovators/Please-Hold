/* ============================================================
   player.js -- first-person movement, and sitting down.

   Movement is modern: acceleration, friction, a real crouch-free
   walk with a subtle bob and footsteps keyed to the bob phase.
   The design brief is explicit that the SETTING is 1999 and the
   CONTROLS are not, so nothing here is tank-y or stiff.

   The other half of this file is the seated state. Most of the
   game happens in a chair, so sitting is a first-class mode: the
   camera eases into the desk pose, movement is locked, and the
   workstation interactables come into range. Standing up eases
   back out. No cut, no fade -- the room never stops being there.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { bus, EVENTS } from '../engine/bus.js';

const EYE = 1.68;
const RADIUS = 0.28;

export class Player {
  constructor({ camera, solids, settings, audio, spawn }) {
    this.camera = camera;
    this.solids = solids;
    this.settings = settings;
    this.audio = audio;

    this.pos = new THREE.Vector3(spawn.x, EYE, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;

    this.frozen = false;
    this.seated = false;
    this._seatBlend = 0;
    this._seat = null;
    this._standPos = null;
    this._standYaw = 0;

    this.bob = 0;
    this._lastStep = 0;
    this.camera.rotation.order = 'YXZ';
  }

  /* ---------------- look ---------------- */
  look(dx, dy) {
    if (this.frozen) return;
    const s = 0.0022 * (this.settings ? this.settings.get('mouseSensitivity') : 1);
    this.yaw -= dx * s;
    const inv = this.settings && this.settings.get('invertY') ? -1 : 1;
    this.pitch -= dy * s * inv;
    const limit = this.seated ? 0.85 : 1.45;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    if (this.seated && this._seat) {
      // Sitting at a desk, you can turn your head but not spin the chair.
      const rel = wrapAngle(this.yaw - this._seat.yaw);
      const clamped = Math.max(-1.35, Math.min(1.35, rel));
      this.yaw = this._seat.yaw + clamped;
    }
  }

  /* ---------------- sitting ---------------- */
  sit(seat) {
    if (this.seated) return;
    this._standPos = this.pos.clone();
    this._standYaw = this.yaw;
    this._seat = { x: seat.x, z: seat.z, yaw: seat.yaw ?? 0, eye: seat.eye ?? 1.24 };
    this.seated = true;
    this._seatBlend = 0;
    // The chair swings round with you. Without this the player sits down
    // still facing whatever they walked in looking at.
    this._fromYaw = this.yaw;
    this._fromPitch = this.pitch;
    this.vel.set(0, 0, 0);
    if (this.audio) this.audio.play('chair');
    bus.emit(EVENTS.TOAST, { text: 'SEATED AT DISPATCH' });
  }

  stand() {
    if (!this.seated) return;
    this.seated = false;
    this._seatBlend = 0;
    if (this.audio) this.audio.play('chair');
  }

  /* ---------------- movement ---------------- */
  update(dt, input) {
    if (this.seated) return this._updateSeated(dt);

    if (!this.frozen && input) {
      const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
      const r = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const len = Math.hypot(f, r) || 1;
      const speed = input.run ? 3.1 : 1.72;   // an office, not an athletics track
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // three's -Z is forward
      const wx = (-sin * f / len + cos * r / len) * speed;
      const wz = (-cos * f / len - sin * r / len) * speed;
      const accel = 14;
      this.vel.x += (wx - this.vel.x) * Math.min(1, dt * accel);
      this.vel.z += (wz - this.vel.z) * Math.min(1, dt * accel);
    } else {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 12));
    }

    this._move(this.vel.x * dt, this.vel.z * dt);

    // head bob and footsteps, both driven by the same phase
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.15 && this.settings && this.settings.get('headBob')) {
      this.bob += dt * speed * 5.2;
      const phase = Math.sin(this.bob);
      if (phase < 0 && this._lastStep >= 0 && this.audio) this.audio.play('step', { volume: 0.5 });
      this._lastStep = phase;
    } else {
      this.bob += (0 - (this.bob % (Math.PI * 2))) * Math.min(1, dt * 4);
    }

    const bobY = Math.sin(this.bob) * 0.022 * Math.min(1, speed);
    const bobX = Math.cos(this.bob * 0.5) * 0.014 * Math.min(1, speed);
    this.camera.position.set(this.pos.x + bobX, EYE + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob * 0.5) * 0.004 * Math.min(1, speed));
  }

  _updateSeated(dt) {
    this._seatBlend = Math.min(1, this._seatBlend + dt * 2.6);
    const k = easeInOut(this._seatBlend);
    const s = this._seat;
    const x = lerp(this.pos.x, s.x, k);
    const z = lerp(this.pos.z, s.z, k);
    const y = lerp(EYE, s.eye, k);
    if (k < 1) {
      // Turn toward the desk over the same blend, by the short way round.
      this.yaw = this._fromYaw + wrapAngle(s.yaw - this._fromYaw) * k;
      this.pitch = lerp(this._fromPitch, -0.10, k);
    }
    if (this._seatBlend >= 1) { this.pos.x = s.x; this.pos.z = s.z; }
    this.camera.position.set(x, y, z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /** Ease back to standing. Called from update when not seated but blending. */
  _updateStanding(dt) {
    this._seatBlend = Math.min(1, this._seatBlend + dt * 2.6);
  }

  /** Axis-separated collision, so sliding along a wall feels right. */
  _move(dx, dz) {
    const tryAxis = (nx, nz) => {
      const x = this.pos.x + nx, z = this.pos.z + nz;
      for (const s of this.solids) {
        if (s.y1 < 0.45) continue;                // step over the low stuff
        if (x > s.x0 - RADIUS && x < s.x1 + RADIUS && z > s.z0 - RADIUS && z < s.z1 + RADIUS) return false;
      }
      this.pos.x = x; this.pos.z = z;
      return true;
    };
    if (!tryAxis(dx, 0)) this.vel.x = 0;
    if (!tryAxis(0, dz)) this.vel.z = 0;
  }

  /** Where the interaction ray starts and points. */
  get eye() { return this.camera.position; }
  get forward() {
    return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  serialize() {
    return { x: this.pos.x, z: this.pos.z, yaw: this.yaw, pitch: this.pitch, seated: this.seated };
  }
  restore(d) {
    if (!d) return;
    this.pos.set(d.x, EYE, d.z);
    this.yaw = d.yaw; this.pitch = d.pitch;
    this.seated = false;
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
