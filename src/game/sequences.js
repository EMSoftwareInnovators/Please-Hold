/* ============================================================
   sequences.js -- authored moments, without a timeline in game.js.

   Most of this game is systems talking to each other. A few
   things are not: the cascade and the dark building after Keefe,
   4:17, the knock at the rear door, the day shift arriving. Those
   are AUTHORED, and they need to be authored somewhere that is
   not a thousand-line `if` inside the orchestrator.

   A sequence is a list of steps, run in order:

     { do(ctx) }            make something happen
     { wait: 4 }            four real seconds of nothing
     { until: (ctx) => … }  hold here until the player does a thing
     { timeout: 90 }        ...but not forever
     { label: 'name' }      for the test harness to assert against

   Steps are plain data with plain functions, so a sequence reads
   top to bottom like a shooting script, and the harness can step
   one without a browser doing it in real time.

   THE SILENCE IS A STEP. `{ wait: 9 }` after the lights fail is
   not a gap in the writing -- it is the part where the player
   wonders whether the game has ended. Do not tune those out.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

export class SequenceRunner {
  constructor(systems) {
    this.sys = systems;
    this.current = null;
    this.step = 0;
    this._t = 0;
    this._waited = 0;
    this.finished = new Set();
    this.log = [];
    /* Test hook. The nine seconds of silence after the cascade are the point
       of the cascade; a harness that has to sit through them for every run
       is a harness nobody runs. Nothing in the game sets this. */
    this.speed = 1;
  }

  get running() { return !!this.current; }
  get label() {
    if (!this.current) return null;
    const s = this.current.steps[this.step];
    return (s && s.label) || `${this.current.id}:${this.step}`;
  }

  /** Start one. A sequence already running wins -- these never overlap. */
  play(seq, ctx = {}) {
    if (!seq) return false;
    if (this.current) return false;
    if (seq.once && this.finished.has(seq.id)) return false;
    this.current = seq;
    this.ctx = { ...this.sys, ...ctx, seq };
    this.step = 0;
    this._t = 0;
    this._waited = 0;
    this.log.push({ id: seq.id, at: Date.now() });
    if (seq.enter) { try { seq.enter(this.ctx); } catch (e) { console.error(e); } }
    bus.emit(EVENTS.SEQUENCE, { id: seq.id, state: 'start' });
    this._enterStep();
    return true;
  }

  /** Abandon whatever is playing. Used when a shift resets. */
  stop() {
    if (!this.current) return;
    const seq = this.current;
    this.current = null;
    if (seq.exit) { try { seq.exit(this.ctx); } catch (e) { console.error(e); } }
    bus.emit(EVENTS.SEQUENCE, { id: seq.id, state: 'stop' });
  }

  _enterStep() {
    const seq = this.current;
    if (!seq) return;
    const s = seq.steps[this.step];
    if (!s) {
      this.finished.add(seq.id);
      const done = seq;
      this.current = null;
      if (done.exit) { try { done.exit(this.ctx); } catch (e) { console.error(e); } }
      bus.emit(EVENTS.SEQUENCE, { id: done.id, state: 'end' });
      return;
    }
    this._t = 0;
    this._waited = 0;
    if (s.do) {
      try { s.do(this.ctx); } catch (err) { console.error(`sequence ${seq.id} step ${this.step}:`, err); }
    }
    bus.emit(EVENTS.SEQUENCE, { id: seq.id, state: 'step', step: this.step, label: s.label });
    // A step with nothing to wait for is over as soon as it has happened.
    if (!s.wait && !s.until) { this.step++; this._enterStep(); }
  }

  update(dt) {
    if (!this.current) return;
    dt *= this.speed;
    const s = this.current.steps[this.step];
    if (!s) { this._enterStep(); return; }
    this._t += dt;
    if (s.until) {
      let done = false;
      try { done = !!s.until(this.ctx); } catch (err) { console.error(err); done = true; }
      const timedOut = s.timeout != null && this._t >= s.timeout;
      if (timedOut && s.onTimeout) {
        try { s.onTimeout(this.ctx); } catch (err) { console.error(err); }
      }
      if (!done && !timedOut) return;
    } else if (s.wait != null && this._t < s.wait) {
      return;
    }
    this.step++;
    this._enterStep();
  }

  serialize() { return { finished: [...this.finished] }; }
  restore(d) { if (d) this.finished = new Set(d.finished || []); }
}
