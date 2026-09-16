/* ============================================================
   power.js -- what is energised in this building, and why.

   Until now a blackout was a light change: the horror director
   dimmed the room, waited, and put it back. That is a two-second
   effect the player watches. This makes it a STATE the player
   has to do something about.

   Four circuits, because four is enough to make the player
   choose an order and not enough to be a puzzle:

     LIGHTS    the fluorescents. Off means the emergency heads.
     TERMINAL  the CIS. Off means the dispatcher is blind.
     COMMS     the radio base and the phone system's ringers.
     AUX       the fax, the coffee maker, the vending machine.

   The brief on this is deliberate: TENSION, NOT A SWITCH PUZZLE.
   Resetting a breaker is one interaction per circuit and the
   panel tells you which ones are tripped. What costs the player
   is that the panel is at the far end of the corridor and the
   telephone is not.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

export const CIRCUITS = [
  { id: 'lights', label: 'LIGHTING — OFFICE', order: 1 },
  { id: 'terminal', label: 'CIS TERMINAL / DATA', order: 2 },
  { id: 'comms', label: 'RADIO / TELEPHONE', order: 3 },
  { id: 'aux', label: 'RECEPTACLES — GENERAL', order: 4 },
];

export class PowerSystem {
  constructor({ lighting, terminal, audio, state, clock, world } = {}) {
    this.lighting = lighting;
    this.terminal = terminal;
    this.audio = audio;
    this.state = state;
    this.clock = clock;
    this.world = world;

    /** circuit id -> true when energised. */
    this.on = new Map(CIRCUITS.map((c) => [c.id, true]));
    /** True while the building is running on the emergency heads. */
    this.emergency = false;
    this._pending = null;
  }

  live(id) { return this.on.get(id) !== false; }
  get tripped() { return CIRCUITS.filter((c) => !this.live(c.id)); }
  get allLive() { return this.tripped.length === 0; }

  /**
   * Drop circuits. `reason` is for the log, and matters: a breaker that trips
   * because a tree took out a service drop is a night at work. A breaker that
   * trips with no grid event behind it is the thing the player writes in the
   * paper log.
   */
  trip(ids = CIRCUITS.map((c) => c.id), { reason = 'unknown', emergency = true } = {}) {
    const list = Array.isArray(ids) ? ids : [ids];
    let changed = false;
    for (const id of list) {
      if (this.live(id)) { this.on.set(id, false); changed = true; }
    }
    if (!changed) return false;
    this.emergency = emergency && !this.live('lights');
    this._apply({ hard: true });
    if (this.state && this.clock) {
      this.state.log(this.clock.stamp(), `Power failure — ${reason}.`,
        reason === 'no grid event' ? 'anomaly' : 'warn');
    }
    bus.emit(EVENTS.POWER_STATE, { tripped: this.tripped.map((c) => c.id), reason });
    return true;
  }

  /** Put one circuit back. This is what the breaker panel calls. */
  reset(id) {
    if (this.live(id)) return false;
    this.on.set(id, true);
    if (id === 'lights') this.emergency = false;
    if (this.audio) this.audio.play('breaker', { volume: 0.85 });
    this._apply({ hard: false });
    bus.emit(EVENTS.POWER_STATE, { tripped: this.tripped.map((c) => c.id), restored: id });
    return true;
  }

  resetAll() {
    let any = false;
    for (const c of CIRCUITS) if (this.reset(c.id)) any = true;
    return any;
  }

  /** Push the current state into the systems that actually show it. */
  _apply({ hard }) {
    const lights = this.live('lights');
    if (this.lighting) {
      // The emergency heads are a dim, cold, batteried thing: not darkness,
      // which would be unplayable, but nothing anybody would call lit.
      this.lighting.setPower(lights ? 1 : 0.14, hard);
      if (this.lighting.setEmergency) this.lighting.setEmergency(!lights);
    }
    if (this.terminal) this.terminal.setPower(this.live('terminal'));
    if (this.audio) {
      if (!this.live('lights')) this.audio.stopLoop('fluorescent', hard ? 0.05 : 0.8);
      else if (!this.audio.isLooping('fluorescent')) this.audio.loop('fluorescent', { volume: 0.45 });
      if (!this.live('terminal')) this.audio.stopLoop('crtWhine', hard ? 0.05 : 0.6);
    }
    bus.emit(EVENTS.POWER, { level: lights ? 1 : 0.14 });
  }

  serialize() {
    return { on: [...this.on.entries()], emergency: this.emergency };
  }
  restore(d) {
    if (!d) return;
    this.on = new Map(d.on || []);
    this.emergency = !!d.emergency;
    this._apply({ hard: true });
  }
}
