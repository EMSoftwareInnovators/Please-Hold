/* ============================================================
   state.js -- story flags, counters and caller memory.

   Everything the game needs to remember between one call and the
   next lives here and nowhere else. Call scripts read and write
   it through declarative effects (see dialogue.js), never by
   reaching into other systems, which is what keeps the writing
   separable from the code.

   Three kinds of memory:
     flags    -- a set of strings that are either set or not
     counters -- named integers (how many times Daley has called)
     callers  -- per-caller relationship record: trust, what they
                 told you, what you told them, whether they are
                 still owed a callback
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

export class GameState {
  constructor() {
    this.flags = new Set();
    this.counters = new Map();
    this.callers = new Map();
    this.beat = 0;                   // story progression index
    this.shiftLog = [];              // every notable thing that happened
  }

  /** Wipe the shift. Mutates in place: every system holds a reference to
   *  this object, and swapping it out means patching all of them by hand. */
  reset() {
    this.flags.clear();
    this.counters.clear();
    this.callers.clear();
    this.beat = 0;
    this.shiftLog.length = 0;
    return this;
  }

  /* ---------------- flags ---------------- */
  set(flag, on = true) {
    const had = this.flags.has(flag);
    if (on) this.flags.add(flag); else this.flags.delete(flag);
    if (had !== on) bus.emit(EVENTS.FLAG, { flag, on });
    return this;
  }
  has(flag) { return this.flags.has(flag); }
  /** All of `list` are set. An empty list is vacuously true. */
  hasAll(list) { return !list || list.every((f) => this.flags.has(f)); }
  /** None of `list` are set. */
  hasNone(list) { return !list || list.every((f) => !this.flags.has(f)); }

  /* ---------------- counters ---------------- */
  bump(name, by = 1) {
    const v = (this.counters.get(name) || 0) + by;
    this.counters.set(name, v);
    return v;
  }
  count(name) { return this.counters.get(name) || 0; }

  /* ---------------- caller memory ---------------- */
  caller(id) {
    if (!this.callers.has(id)) {
      this.callers.set(id, {
        id,
        calls: 0,              // how many times they have reached you
        trust: 0,              // -3 hostile .. +3 they ask for you by name
        lastTopic: null,
        toldYou: [],           // things they said that you can refer back to
        youPromised: [],       // things you said you would do
        onHoldSeconds: 0,      // total, across the night
        hungUpOn: 0,           // times you or the line dropped them
        satisfied: null,
      });
    }
    return this.callers.get(id);
  }
  trust(id, delta) {
    const c = this.caller(id);
    c.trust = Math.max(-3, Math.min(3, c.trust + delta));
    return c.trust;
  }
  remember(id, key) {
    const c = this.caller(id);
    if (!c.toldYou.includes(key)) c.toldYou.push(key);
  }
  promised(id, key) {
    const c = this.caller(id);
    if (!c.youPromised.includes(key)) c.youPromised.push(key);
  }

  /* ---------------- story beats ---------------- */
  advanceBeat(to) {
    const next = to ?? this.beat + 1;
    if (next <= this.beat) return this.beat;
    this.beat = next;
    bus.emit(EVENTS.BEAT, { beat: this.beat });
    return this.beat;
  }

  /* ---------------- the log ---------------- */
  log(stamp, text, kind = 'note') {
    this.shiftLog.push({ stamp, text, kind });
    if (this.shiftLog.length > 400) this.shiftLog.shift();
  }

  /* ---------------- persistence ---------------- */
  serialize() {
    return {
      flags: [...this.flags],
      counters: [...this.counters],
      callers: [...this.callers].map(([k, v]) => [k, v]),
      beat: this.beat,
      shiftLog: this.shiftLog.slice(-200),
    };
  }
  restore(d) {
    if (!d) return;
    this.flags = new Set(d.flags || []);
    this.counters = new Map(d.counters || []);
    this.callers = new Map(d.callers || []);
    this.beat = d.beat || 0;
    this.shiftLog = d.shiftLog || [];
  }
}
