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
import { actFor } from './acts.js';

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
    /* The floor, not the target. The TARGET comes from the act (acts.js) and
       is re-rolled after every call, so the night is never metronomic. Six
       seconds was fine for a twenty-minute slice and is machine-gun pacing
       across seven hours. */
    this.minGapSeconds = 6;
    this.holdGrace = 25;       // seconds a parked caller is protected for
    this._sinceLast = 0;
    this._debtTimer = 0;
    this._target = 0;
    this.enabled = true;
    this.autoRandom = true;
    /** Density bookkeeping, for tools/pacing.mjs. */
    this.history = [];
    this._rollTarget();

    /* THE GAP IS SILENCE, NOT CADENCE.
       Measuring from when the last call STARTED means a fifty-five second
       conversation eats a fifty-second gap and the next call lands the
       instant the player puts the handset down. That is the machine-gun
       feeling, and it is invisible in the numbers unless you measure the
       right thing: the clock starts when the desk goes quiet. */
    bus.on(EVENTS.CALL_END, () => { this._sinceLast = 0; });
    bus.on(EVENTS.DIALOGUE_END, () => { this._sinceLast = 0; });
  }

  /* ---------------- pacing ---------------- */

  get act() { return actFor(this.deps.state.beat); }

  /**
   * How long the next gap should be.
   *
   * Two dials on top of the act's range. A player with tickets open and
   * crews rolling is BUSY, and the switchboard leaning on them is correct.
   * A player with a clear board is owed the silence -- that is when the
   * building gets to be the loudest thing in the game.
   */
  _rollTarget() {
    /* Test hook: the pacing harness and the full-night harness cannot wait
       ninety real seconds between calls sixty times. Nothing in the game
       sets this. */
    if (this.fastForward) { this._target = this.minGapSeconds; return this._target; }
    const act = this.act;
    const [lo, hi] = act.gap;
    let t = lo + Math.random() * (hi - lo);
    const busy = this._workload();
    t *= busy > 0 ? Math.max(0.55, 1 - busy * 0.16) : act.quiet;
    // A major revelation buys room. Nobody wants a well-pump call eight
    // seconds after a dead man says his own name.
    if (this._afterMajor) { t *= 1.9; this._afterMajor = false; }
    this._target = Math.max(this.minGapSeconds, t);
    return this._target;
  }

  /** Outstanding work, roughly: open tickets plus crews in the field. */
  _workload() {
    const o = this.deps.outages ? this.deps.outages.unassigned().length : 0;
    const c = this.deps.crews ? this.deps.crews.dispatchedCount() : 0;
    return o + c * 0.5;
  }

  /**
   * Is the player somewhere a story call would be wasted?
   *
   * A story beat fired into an empty chair is worse than one that waits: the
   * game asked the player to walk to Records, and ringing the one call that
   * matters while they are down there punishes them for doing it. Ordinary
   * traffic may still ring -- that is the cost of leaving the desk, and it is
   * meant to be felt.
   */
  get playerAway() {
    const t = this.deps.tasks;
    if (!t) return false;
    return t.playerRoom !== 'dispatch';
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
    const strange = call.category === 'anomaly' || call.category === 'story';
    this.history.push({
      id,
      reason,
      category: call.category || 'other',
      act: this.act.id,
      atMinute: this.deps.clock.minutes,
      gap: this._sinceLast,
      target: this._target,
    });
    this._sinceLast = 0;
    if (call.major) this._afterMajor = true;
    if (strange) this.mundaneDebt += (call.debt ?? 2);
    else this.mundaneDebt = Math.max(0, this.mundaneDebt - 1);
    this._rollTarget();
    this.deps.state.log(this.deps.clock.stamp(), `Call in: ${call.caller.name}`, 'call');
    return true;
  }

  /** What the pacing harness reads. */
  density() {
    const gaps = this.history.slice(1).map((h) => h.gap);
    const byAct = {};
    for (const h of this.history) {
      byAct[h.act] = byAct[h.act] || { calls: 0, strange: 0 };
      byAct[h.act].calls++;
      if (h.category === 'anomaly' || h.category === 'story') byAct[h.act].strange++;
    }
    const sorted = gaps.slice().sort((a, b) => a - b);
    return {
      total: this.history.length,
      ordinary: this.history.filter((h) => !['anomaly', 'story'].includes(h.category)).length,
      strange: this.history.filter((h) => ['anomaly', 'story'].includes(h.category)).length,
      meanGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
      medianGap: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      shortestGap: sorted.length ? sorted[0] : 0,
      longestGap: sorted.length ? sorted[sorted.length - 1] : 0,
      byAct,
    };
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

    // Do not ring on top of a caller the player has only just parked. Hold is
    // a few seconds of pressure, not an invitation for the switchboard to
    // bury the conversation you were having -- a story call parked for two
    // seconds used to be starved out by the next call in the queue and never
    // come back. After `holdGrace` the player has clearly moved on and the
    // phone is fair game again.
    const parked = phone.oldestHeld;
    if (parked && parked.heldSeconds < this.holdGrace) return;
    /* The gap the act asked for, not a fixed cooldown. Half a minute to a
       minute and a half early on; longer in the lull; nothing at all at
       4:17, where breaking this rule is the point. */
    if (this._sinceLast < Math.max(this.minGapSeconds, this._target)) return;

    const now = this.deps.clock.minutes;
    /* Away from the desk on the game's own instructions: ordinary traffic is
       fair -- that is the cost of the walk -- but nothing story-critical. */
    const away = this.playerAway;

    // 1. explicitly queued callbacks come first, they were promised
    const due = this.queue.find((q) => q.atMinute <= now);
    if (due) {
      const call = this.deps.library.get(due.id);
      const critical = call && (call.category === 'story' || call.major);
      if (!(away && critical)) {
        this.queue = this.queue.filter((q) => q !== due);
        if (this.fire(due.id, due.reason)) return;
      }
    }

    // 2. time-pinned story calls
    if (!away) { for (const c of this.timeDue()) { if (this.fire(c.id, 'time')) return; } }

    // 3. beat calls -- but pay off the mundane debt first, so the strange
    //    ones always land against a floor of ordinary work
    const beat = this.beatDue();
    if (beat.length && !away) {
      const next = beat[0];
      const strange = next.category === 'anomaly' || next.category === 'story';
      const noFiller = this.randomPool().length === 0;
      if (!strange || this.mundaneDebt <= this.act.debtFloor - 1 || noFiller) {
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
  /** Everything the director has rung tonight, for the pacing report. */
  get calls() { return this.history; }
  restore(d) {
    if (!d) return;
    this.queue = d.queue || [];
    this.fired = new Set(d.fired || []);
    this.mundaneDebt = d.mundaneDebt || 0;
  }
}
