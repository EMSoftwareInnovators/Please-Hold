/* ============================================================
   calls.js -- the call library and the director that decides
   what rings, and when.

   THE LIBRARY holds every script from src/data/calls/ and
   validates all of them at boot, so a bad `goto` is a loud error
   with a call id rather than a silent dead end at 3am.

   THE DIRECTOR is the scheduler. Three ways a call reaches the
   player:

     beat    -- fires when the story reaches a given beat. This is
                the spine: the ordinary calls that teach the job,
                then the ones that break it.
     time    -- fires at a specific shift minute.
     random  -- drawn from the eligible pool to fill the gaps, so
                a shift never feels like a list being read out.

   The director also enforces breathing room. Two supernatural
   calls back to back are worth less than one with four minutes
   of ordinary utility work in front of it -- the mundane calls
   are what the strange ones are measured against, so `minGap`
   and `mundaneDebt` exist to protect that rhythm.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';
import { validateCall, meets } from './dialogue.js';

export class CallLibrary {
  constructor() {
    this.calls = new Map();
    this.problems = [];
  }

  /** Register one script. Returns the list of validation problems. */
  register(call) {
    const errs = validateCall(call);
    if (errs.length) {
      this.problems.push(...errs);
      console.error(`call "${call && call.id}" failed validation:\n  ` + errs.join('\n  '));
      return errs;
    }
    if (this.calls.has(call.id)) {
      const e = `duplicate call id "${call.id}"`;
      this.problems.push(e);
      return [e];
    }
    this.calls.set(call.id, call);
    return [];
  }

  registerAll(list) {
    for (const c of list) this.register(c);
    return this.problems;
  }

  get(id) { return this.calls.get(id) || null; }
  get all() { return [...this.calls.values()]; }
  get size() { return this.calls.size; }
}

export class CallDirector {
  constructor(deps) {
    this.deps = deps;                  // { library, phone, state, clock, outages, crews, database, horror }
    this.queue = [];                   // [{ id, atMinute, reason }]
    this.fired = new Set();
    this.lastCallEndedAt = -999;
    this.mundaneDebt = 0;              // strange calls raise it; ordinary ones pay it down
    this.minGapSeconds = 6;
    this._sinceLast = 0;
    this._debtTimer = 0;
    this.enabled = true;
    this.autoRandom = true;
  }

  /* ---------------- scheduling ---------------- */

  /** Queue a call `delayMinutes` of shift time from now. */
  schedule(id, delayMinutes = 0, reason = 'script') {
    if (!this.deps.library.get(id)) {
      console.warn(`director: cannot schedule unknown call "${id}"`);
      return false;
    }
    this.queue.push({ id, atMinute: this.deps.clock.minutes + delayMinutes, reason });
    this.queue.sort((a, b) => a.atMinute - b.atMinute);
    return true;
  }

  cancel(id) {
    this.queue = this.queue.filter((q) => q.id !== id);
  }

  /** Everything that has not yet fired, for the debug overlay and tests. */
  get pending() { return this.queue.slice(); }

  /* ---------------- eligibility ---------------- */

  _ctx(call) {
    return {
      state: this.deps.state,
      clock: this.deps.clock,
      outages: this.deps.outages,
      crews: this.deps.crews,
      database: this.deps.database,
      callerId: call && call.caller ? (call.caller.id || call.id) : null,
    };
  }

  eligible(call) {
    if (!call) return false;
    if (this.fired.has(call.id) && !call.repeatable) return false;
    if (!meets(call.requires, this._ctx(call))) return false;
    const sched = call.schedule || {};
    if (sched.type === 'beat' && this.deps.state.beat < (sched.beat ?? 0)) return false;
    if (sched.type === 'time' && this.deps.clock.minutes < (sched.at ?? 0)) return false;
    return true;
  }

  /** Calls that are allowed to be drawn at random right now. */
  randomPool() {
    return this.deps.library.all.filter((c) => {
      const s = c.schedule || {};
      if (s.type !== 'random') return false;
      return this.eligible(c);
    });
  }

  /** Story calls whose beat has arrived. */
  beatDue() {
    return this.deps.library.all
      .filter((c) => (c.schedule || {}).type === 'beat' && this.eligible(c))
      .sort((a, b) => (a.schedule.beat - b.schedule.beat) || ((b.priority || 0) - (a.priority || 0)));
  }

  timeDue() {
    return this.deps.library.all
      .filter((c) => (c.schedule || {}).type === 'time' && this.eligible(c));
  }

  /* ---------------- firing ---------------- */

  /**
   * Put a specific call in front of the player right now.
   * A call with `medium: 'radio'` does not ring a line -- it goes straight to
   * the runner as field traffic, which is why crew conversations can use the
   * exact same script format as telephone calls.
   */
  fire(id, reason = 'direct') {
    const call = this.deps.library.get(id);
    if (!call) return false;
    let started;
    if (call.medium === 'radio') {
      started = this.deps.onRadioCall ? this.deps.onRadioCall(call) : false;
    } else {
      started = !!this.deps.phone.ring(call);
    }
    if (!started) return false;
    this.fired.add(id);
    this._sinceLast = 0;
    if (call.category === 'anomaly' || call.category === 'story') this.mundaneDebt += (call.debt ?? 2);
    else this.mundaneDebt = Math.max(0, this.mundaneDebt - 1);
    this.deps.state.log(this.deps.clock.stamp(), `Call in: ${call.caller.name}`, 'call');
    return true;
  }

  update(dt) {
    if (!this.enabled) return;
    this._sinceLast += dt;

    // The debt is paid down by ordinary calls and, failing that, by time.
    // Without this a shift can strand itself: the random pool is finite, and
    // a story beat that waits forever for filler traffic never arrives.
    this._debtTimer += dt;
    if (this._debtTimer > 40) { this._debtTimer = 0; this.mundaneDebt = Math.max(0, this.mundaneDebt - 1); }

    const phone = this.deps.phone;
    // Never ring over a live conversation, and never stack two ringing lines:
    // a dispatcher with three phones going is a different, worse game.
    if (phone.activeLine != null || phone.anyRinging) return;
    if (this.deps.isBusy && this.deps.isBusy()) return;
    if (this._sinceLast < this.minGapSeconds) return;

    const now = this.deps.clock.minutes;

    // 1. explicitly queued callbacks come first, they were promised
    const due = this.queue.find((q) => q.atMinute <= now);
    if (due) {
      this.queue = this.queue.filter((q) => q !== due);
      if (this.fire(due.id, due.reason)) return;
    }

    // 2. time-pinned story calls
    for (const c of this.timeDue()) { if (this.fire(c.id, 'time')) return; }

    // 3. beat calls -- but pay off the mundane debt first, so the strange
    //    ones always land against a floor of ordinary work
    const beat = this.beatDue();
    if (beat.length) {
      const next = beat[0];
      const strange = next.category === 'anomaly' || next.category === 'story';
      const noFiller = this.randomPool().length === 0;
      if (!strange || this.mundaneDebt <= 0 || noFiller) {
        if (this.fire(next.id, 'beat')) return;
      }
    }

    // 4. fill with ordinary traffic
    if (this.autoRandom) {
      const pool = this.randomPool();
      if (pool.length) {
        const total = pool.reduce((n, c) => n + ((c.schedule || {}).weight || 1), 0);
        let r = Math.random() * total;
        for (const c of pool) {
          r -= (c.schedule || {}).weight || 1;
          if (r <= 0) { this.fire(c.id, 'random'); return; }
        }
      }
    }
  }

  serialize() {
    return { queue: this.queue, fired: [...this.fired], mundaneDebt: this.mundaneDebt };
  }
  restore(d) {
    if (!d) return;
    this.queue = d.queue || [];
    this.fired = new Set(d.fired || []);
    this.mundaneDebt = d.mundaneDebt || 0;
  }
}
