/* ============================================================
   doors.js -- doors and light switches, which are the same idea.

   Both are small persistent facts about the building that the
   PLAYER sets, and that is what makes them useful for horror. A
   door that swings open on its own is a cheap noise. A door the
   player deliberately shut, which is open when they come back,
   is an accusation.

   The same goes for the lights. If the player turns the Records
   light off on their way out, Records is dark when they return --
   and when it is NOT dark, that means something. The game never
   resets these behind the player's back. Only the night does.

   Deliberately not a physics simulation: a door is open or shut,
   it takes half a second to swing, it makes a noise, and it is
   solid when closed.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class Doors {
  constructor({ office, audio, state, lighting } = {}) {
    this.office = office;
    this.audio = audio;
    this.state = state;
    this.lighting = lighting;
    /** id -> { pivot, open, closedYaw, openYaw, target, locked } */
    this.leaves = new Map();
    /** room -> true when the player has left the light on. */
    this.lights = new Map([
      ['dispatch', true], ['corridor', true], ['records', true], ['breakroom', true],
    ]);
    this._wire();
  }

  _wire() {
    if (!this.office || !this.office.doors) return;
    for (const [id, d] of this.office.doors.entries()) {
      const closed = d.pivot.rotation.y + (d.locked ? 0 : 1.35);
      this.leaves.set(id, {
        pivot: d.pivot,
        locked: !!d.locked,
        closedYaw: closed,
        openYaw: closed - 1.35,
        open: !d.locked,
        target: d.locked ? 0 : 1,
      });
    }
  }

  get(id) { return this.leaves.get(id) || null; }
  isOpen(id) { const l = this.get(id); return !!(l && l.open); }

  /** Open or shut one. `silent` is for the night doing it. */
  set(id, open, { silent = false } = {}) {
    const l = this.get(id);
    if (!l) return false;
    if (l.locked) {
      if (!silent && this.audio) this.audio.play('doorLocked', { volume: 0.6 });
      return false;
    }
    if (l.open === open) return false;
    l.open = open;
    l.target = open ? 1 : 0;
    if (!silent && this.audio) this.audio.play(open ? 'doorOpen' : 'doorClose', { volume: 0.55 });
    if (this.state) this.state.set(`door:${id}:open`, open);
    bus.emit(EVENTS.DOOR, { id, open, silent });
    return true;
  }

  toggle(id) { return this.set(id, !this.isOpen(id)); }

  /* ---------------- lights ---------------- */

  lightOn(room) { return this.lights.get(room) !== false; }

  setLight(room, on) {
    if (this.lights.get(room) === on) return false;
    this.lights.set(room, on);
    if (this.audio) this.audio.play('switchClick', { volume: 0.5 });
    if (this.lighting && this.lighting.setRoomLights) this.lighting.setRoomLights(room, on);
    if (this.state) this.state.set(`light:${room}:on`, on);
    bus.emit(EVENTS.LIGHT, { room, on });
    return true;
  }

  toggleLight(room) { return this.setLight(room, !this.lightOn(room)); }

  update(dt) {
    for (const l of this.leaves.values()) {
      const want = lerp(l.closedYaw, l.openYaw, l.target);
      if (Math.abs(l.pivot.rotation.y - want) < 0.002) continue;
      const k = Math.min(1, dt * 7.5);
      l.pivot.rotation.y = lerp(l.pivot.rotation.y, want, k);
    }
  }

  serialize() {
    return {
      doors: [...this.leaves.entries()].map(([id, l]) => [id, l.open]),
      lights: [...this.lights.entries()],
    };
  }
  restore(d) {
    if (!d) return;
    for (const [id, open] of d.doors || []) this.set(id, open, { silent: true });
    for (const [room, on] of d.lights || []) this.setLight(room, on);
  }
}
