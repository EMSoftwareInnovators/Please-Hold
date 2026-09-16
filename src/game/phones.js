/* ============================================================
   phones.js -- the instruments, as objects in rooms.

   The six-line console on the desk is the game. These are the
   other telephones: the supervisor's, the one screwed to the
   break room wall, the extension on the Records counter, the
   corridor extension by the equipment shelf. For most of the
   night they do nothing at all.

   They exist for two reasons.

   1. POSITION. A phone ringing in a room the player is not in is
      a different sound from the one on the desk, and the whole
      breaker sequence is built on hearing your own desk from
      forty feet away with something between you and it.
   2. 04:17. The player has spent five hours learning that a
      ringing telephone means a line lamp, a caller ID and a
      reason. At 4:17 every instrument in the building rings at
      once and the console shows nothing. That only lands if the
      other instruments have been sitting there, silent, all
      night.

   The console itself is phone.js and is NOT managed here -- this
   is the building's telephones, not the dispatcher's lines.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { bus, EVENTS } from '../engine/bus.js';

/** Every instrument in the building, and where it is. */
export const INSTRUMENTS = [
  { id: 'dispatch', label: 'DISPATCH DESK', ext: 'x2201', pos: { x: 4.45, y: 0.78, z: 1.55 }, room: 'dispatch' },
  { id: 'supervisor', label: "SUPERVISOR'S DESK", ext: 'x2203', pos: { x: 8.7, y: 0.78, z: 6.6 }, room: 'dispatch' },
  { id: 'records', label: 'RECORDS COUNTER', ext: 'x2214', pos: { x: -4.4, y: 0.95, z: 2.4 }, room: 'records' },
  { id: 'breakroom', label: 'BREAK ROOM WALL', ext: 'x2219', pos: { x: -5.7, y: 1.35, z: 9.4 }, room: 'breakroom' },
  { id: 'corridor', label: 'CORRIDOR EXTENSION', ext: 'x2222', pos: { x: -6.2, y: 1.30, z: 6.4 }, room: 'corridor' },
];

export class BuildingPhones {
  constructor({ audio, scene, camera, state, clock } = {}) {
    this.audio = audio;
    this.scene = scene;
    this.camera = camera;
    this.state = state;
    this.clock = clock;
    /** id -> { seconds, display, loop, answered } */
    this.ringing = new Map();
    this.answeredAt = null;
  }

  instrument(id) { return INSTRUMENTS.find((i) => i.id === id) || null; }

  /** Ring one instrument for `seconds`. */
  ring(id, { seconds = 20, display = null, cadence = 'bell' } = {}) {
    const inst = this.instrument(id);
    if (!inst) return false;
    if (this.ringing.has(id)) return true;
    const handle = this.audio
      ? this.audio.loop(`ring:${id}`, {
        volume: 0.0001, kind: cadence, at: inst.pos,
      })
      : null;
    this.ringing.set(id, { seconds, display, handle, t: 0 });
    bus.emit(EVENTS.BUILDING_RING, { id, display, all: this.ringing.size });
    return true;
  }

  /** Every instrument in the building, including the console. This is 4:17. */
  ringAll({ seconds = 45 } = {}) {
    for (const i of INSTRUMENTS) this.ring(i.id, { seconds });
    this.state && this.state.set('every_phone_rang', true);
    bus.emit(EVENTS.BUILDING_RING, { all: this.ringing.size, everything: true });
  }

  silence(id) {
    const r = this.ringing.get(id);
    if (!r) return false;
    if (this.audio) this.audio.stopLoop(`ring:${id}`, 0.05);
    this.ringing.delete(id);
    bus.emit(EVENTS.BUILDING_RING, { id, stopped: true, all: this.ringing.size });
    return true;
  }

  silenceAll() { for (const id of [...this.ringing.keys()]) this.silence(id); }

  isRinging(id) { return this.ringing.has(id); }
  get anyRinging() { return this.ringing.size > 0; }
  get ringingIds() { return [...this.ringing.keys()]; }

  /**
   * The player picks one up. Which one they chose is the interesting part --
   * it is the only decision 4:17 asks for, and the game remembers it.
   */
  answer(id) {
    if (!this.ringing.has(id)) return null;
    const inst = this.instrument(id);
    this.silence(id);
    this.answeredAt = id;
    if (this.state) {
      this.state.set(`answered:${id}`, true);
      this.state.bump('building_phones_answered');
    }
    bus.emit(EVENTS.BUILDING_RING, { id, answered: true });
    return inst;
  }

  /**
   * Distance-attenuated volume for every ringing instrument.
   *
   * Hand-rolled rather than using PannerNodes: the game has walls, and a
   * 1/r falloff through a cinderblock wall is wrong in a way the player
   * notices. Muffling by room is closer to the truth and cheaper.
   */
  update(dt, listener) {
    if (!this.ringing.size) return;
    const p = listener || (this.camera && this.camera.position) || { x: 0, y: 0, z: 0 };
    for (const [id, r] of [...this.ringing.entries()]) {
      r.t += dt;
      if (r.seconds > 0 && r.t > r.seconds) { this.silence(id); continue; }
      const inst = this.instrument(id);
      const d = Math.hypot(p.x - inst.pos.x, (p.z ?? 0) - inst.pos.z);
      // Audible across the building, but unmistakably somewhere else.
      const near = Math.max(0, 1 - d / 22);
      let vol = 0.06 + near * near * 0.5;
      if (r.handle && r.handle.setVolume) r.handle.setVolume(vol, 0.08);
      if (r.handle && r.handle.setMuffle) {
        r.handle.setMuffle(Math.min(1, d / 14));
      }
    }
  }

  serialize() { return { ringing: [...this.ringing.keys()], answeredAt: this.answeredAt }; }
  restore(d) {
    if (!d) return;
    this.answeredAt = d.answeredAt || null;
    for (const id of d.ringing || []) this.ring(id);
  }
}

/** A cheap wall/desk telephone. Silhouette first: it has to read at 20m. */
export function buildInstrument(mats, { wall = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    wall ? new THREE.BoxGeometry(0.17, 0.30, 0.11) : new THREE.BoxGeometry(0.24, 0.075, 0.20),
    mats.get('beigePlastic'),
  );
  body.castShadow = true;
  g.add(body);

  const handset = new THREE.Group();
  handset.name = 'handset';
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(wall ? 0.05 : 0.055, 0.045, wall ? 0.22 : 0.055),
    mats.get('darkPlastic'),
  );
  if (!wall) {
    bar.geometry = new THREE.BoxGeometry(0.22, 0.045, 0.055);
    handset.position.set(0, 0.06, -0.045);
  } else {
    handset.position.set(0.10, 0.02, 0);
  }
  handset.add(bar);
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.065), mats.get('darkPlastic'));
    if (wall) cup.position.set(0, -0.02, s * 0.085);
    else cup.position.set(s * 0.085, -0.02, 0);
    handset.add(cup);
  }
  g.add(handset);
  return g;
}
