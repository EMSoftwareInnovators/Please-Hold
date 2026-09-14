/* ============================================================
   phone.js -- the telephone itself.

   Six line appearances, one handset. A line is idle, ringing,
   active or on hold. The phone owns line state and the physical
   behavior (ring cadence, hook, lamps, hold music); it does NOT
   own the conversation -- that is the DialogueRunner, which the
   phone starts and pauses.

   Hold is the mechanic the game is named after, so it is modeled
   properly: a held caller has patience measured in seconds, gets
   a warning when it runs short, and does something specific when
   it runs out, all of it declared per call script. Holding an
   angry man to take a hazard call is a real trade, and the game
   should remember that you made it.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

export const LINE_STATE = {
  IDLE: 'IDLE',
  RINGING: 'RINGING',
  ACTIVE: 'ACTIVE',
  HOLD: 'HOLD',
};

export const LINES = 6;

export class PhoneSystem {
  constructor({ audio, clock, state, runner, effects }) {
    this.audio = audio;
    this.clock = clock;
    this.state = state;
    this.runner = runner;
    this.effects = effects;

    this.lines = Array.from({ length: LINES }, (_, i) => ({
      index: i,
      state: LINE_STATE.IDLE,
      call: null,
      convo: null,          // this line's own paused conversation, if parked
      heldSeconds: 0,
      patience: 0,
      warned: false,
      ringSeconds: 0,
      ringsLeft: 0,
    }));
    this.activeLine = null;
    this.offHook = false;
    this._ringTimer = 0;
    this._holdMusic = null;
  }

  get active() { return this.activeLine != null ? this.lines[this.activeLine] : null; }
  get activeCall() { return this.active ? this.active.call : null; }
  get anyRinging() { return this.lines.some((l) => l.state === LINE_STATE.RINGING); }
  get held() { return this.lines.filter((l) => l.state === LINE_STATE.HOLD); }
  /** The longest-parked line, or null. */
  get oldestHeld() {
    let best = null;
    for (const l of this.held) if (!best || l.heldSeconds > best.heldSeconds) best = l;
    return best;
  }
  freeLine() { return this.lines.find((l) => l.state === LINE_STATE.IDLE) || null; }

  /* ============================================================
     INCOMING
     ============================================================ */

  /** Put a call on a line and start it ringing. Returns the line, or null. */
  ring(call) {
    const line = this.freeLine();
    if (!line) return null;
    line.state = LINE_STATE.RINGING;
    line.call = call;
    line.ringSeconds = 0;
    line.ringsLeft = call.rings ?? 12;
    line.heldSeconds = 0;
    line.warned = false;
    bus.emit(EVENTS.RING, { line: line.index, call });
    bus.emit(EVENTS.LINE_CHANGED, { lines: this.snapshot() });
    return line;
  }

  /** Answer a specific line (or the lowest ringing one). */
  answer(index = null) {
    const line = index != null
      ? this.lines[index]
      : this.lines.find((l) => l.state === LINE_STATE.RINGING);
    if (!line || line.state !== LINE_STATE.RINGING) return false;

    // Picking up a second call automatically parks the first. That is what
    // the real set does, and it is how the player learns what hold costs.
    if (this.active && this.active !== line) this.hold(this.activeLine, { automatic: true });

    line.state = LINE_STATE.ACTIVE;
    this.activeLine = line.index;
    this.offHook = true;
    this._stopHoldMusic();
    if (this.audio) this.audio.play('hookUp');

    const call = line.call;
    const rec = this.state.caller(call.caller.id || call.id);
    rec.calls += 1;
    this.state.bump(`answered:${call.id}`);

    bus.emit(EVENTS.ANSWERED, { line: line.index, call, callRecord: rec });
    bus.emit(EVENTS.LINE_CHANGED, { lines: this.snapshot() });
    this.runner.start(call);
    return true;
  }

  /* ============================================================
     HOLD
     ============================================================ */

  hold(index = this.activeLine, { automatic = false } = {}) {
    if (index == null) return false;
    const line = this.lines[index];
    if (!line || line.state !== LINE_STATE.ACTIVE) return false;

    line.state = LINE_STATE.HOLD;
    line.heldSeconds = 0;
    line.warned = false;
    const holdSpec = line.call.hold || {};
    line.patience = holdSpec.patience ?? 75;

    if (this.activeLine === index) {
      this.activeLine = null;
      // The line keeps its own conversation while it waits. See
      // DialogueRunner.capture().
      line.convo = this.runner.capture();
      this.runner.hold();
    }
    if (this.audio) {
      this.audio.play('holdClick');
      this._startHoldMusic();
    }
    const id = line.call.caller.id || line.call.id;
    this.state.caller(id).lastTopic = this.runner.nodeId;
    bus.emit(EVENTS.HOLD, { line: line.index, call: line.call, automatic });
    bus.emit(EVENTS.LINE_CHANGED, { lines: this.snapshot() });
    return true;
  }

  /** Come back to a held caller. */
  resume(index) {
    const line = this.lines[index];
    if (!line || line.state !== LINE_STATE.HOLD) return false;
    if (this.active && this.activeLine !== index) this.hold(this.activeLine, { automatic: true });

    line.state = LINE_STATE.ACTIVE;
    this.activeLine = index;
    this.offHook = true;
    this._stopHoldMusic();
    if (this.audio) this.audio.play('holdClick');

    const id = line.call.caller.id || line.call.id;
    const rec = this.state.caller(id);
    rec.onHoldSeconds += Math.round(line.heldSeconds);
    this.state.set('used_hold', true);

    // RESUME goes out FIRST so the call panel is back on screen before the
    // runner speaks or re-offers replies. The other order meant the panel
    // opened after the replies were emitted and wiped them on the way in.
    bus.emit(EVENTS.RESUME, { line: index, call: line.call, heldSeconds: line.heldSeconds });

    // Reload this line's conversation. Without this the runner is still
    // holding whatever was answered most recently.
    if (line.convo && this.runner.call !== line.call) this.runner.restore(line.convo);
    line.convo = null;

    // The script can branch on a long hold without the phone knowing why.
    const spec = line.call.hold || {};
    if (spec.onReturnNode && line.heldSeconds > (spec.longHold ?? 35)) {
      this.runner.paused = false;
      this.runner._goto(spec.onReturnNode);
    } else {
      this.runner.resume();
    }
    bus.emit(EVENTS.LINE_CHANGED, { lines: this.snapshot() });
    return true;
  }

  /* ============================================================
     ENDING
     ============================================================ */

  /** The player hangs up. */
  hangUp(index = this.activeLine, reason = 'player') {
    if (index == null) return false;
    const line = this.lines[index];
    if (!line || line.state === LINE_STATE.IDLE) return false;
    const call = line.call;
    if (this.activeLine === index) {
      this.activeLine = null;
      this.offHook = false;
      this.runner.end(reason);
    }
    this._clear(line);
    if (this.audio) this.audio.play('hookDown');
    bus.emit(EVENTS.HUNGUP, { line: index, call, reason });
    bus.emit(EVENTS.LINE_CHANGED, { lines: this.snapshot() });
    return true;
  }

  /** The call ended on its own (the script ran out, or the caller left). */
  callEnded(reason) {
    const index = this.activeLine;
    if (index == null) return;
    const line = this.lines[index];
    const call = line.call;
    this.activeLine = null;
    this.offHook = false;
    this._clear(line);
    if (this.audio) this.audio.play(reason === 'dropped' ? 'lineDrop' : 'hookDown');
    bus.emit(EVENTS.CALL_END, { line: index, call, reason });
    bus.emit(EVENTS.LINE_CHANGED, { lines: this.snapshot() });
  }

  _clear(line) {
    line.state = LINE_STATE.IDLE;
    line.call = null;
    line.convo = null;
    line.heldSeconds = 0;
    line.warned = false;
    line.ringsLeft = 0;
    if (!this.held.length) this._stopHoldMusic();
  }

  /* ============================================================
     TICK
     ============================================================ */

  update(dt) {
    // ringing
    this._ringTimer -= dt;
    let ringingNow = false;
    for (const line of this.lines) {
      if (line.state !== LINE_STATE.RINGING) continue;
      ringingNow = true;
      line.ringSeconds += dt;
      if (line.ringsLeft <= 0) {
        // Nobody picked up. Some callers give up for good; some call back.
        const call = line.call;
        this._clear(line);
        bus.emit(EVENTS.HUNGUP, { line: line.index, call, reason: 'unanswered' });
        bus.emit(EVENTS.LINE_CHANGED, { lines: this.snapshot() });
      }
    }
    if (ringingNow && this._ringTimer <= 0) {
      this._ringTimer = 3.4;
      const line = this.lines.find((l) => l.state === LINE_STATE.RINGING);
      if (line) {
        line.ringsLeft -= 1;
        if (this.audio) this.audio.play(line.call.ring || 'ring');
      }
    }

    // hold patience
    for (const line of this.held) {
      line.heldSeconds += dt;
      const spec = line.call.hold || {};
      const patience = line.patience || 75;
      if (!line.warned && line.heldSeconds > patience * 0.65) {
        line.warned = true;
        bus.emit(EVENTS.TOAST, { text: `LINE ${line.index + 1} HAS BEEN HOLDING ${Math.round(line.heldSeconds)}s` });
      }
      if (line.heldSeconds > patience) {
        const call = line.call;
        const id = call.caller.id || call.id;
        const rec = this.state.caller(id);
        rec.onHoldSeconds += Math.round(line.heldSeconds);
        rec.hungUpOn += 1;
        this.state.trust(id, spec.trustOnTimeout ?? -1);
        if (spec.timeoutFlag) this.state.set(spec.timeoutFlag, true);
        // If the runner is still loaded with this conversation, drop it. A
        // caller who gives up did not reach an end node, so this must NOT
        // emit a dialogue end -- nothing downstream should count it as done.
        this.runner.discard(call);
        this._clear(line);
        bus.emit(EVENTS.HUNGUP, { line: line.index, call, reason: 'hold-timeout' });
        bus.emit(EVENTS.TOAST, { text: `LINE ${line.index + 1} HUNG UP` });
        bus.emit(EVENTS.LINE_CHANGED, { lines: this.snapshot() });
      }
    }
  }

  _startHoldMusic() {
    if (!this.audio || this._holdMusic) return;
    this._holdMusic = this.audio.loop('holdMusic', { volume: 0.22 });
  }
  _stopHoldMusic() {
    if (this._holdMusic) { this._holdMusic.stop(0.2); this._holdMusic = null; }
  }

  /** A plain description of every line, for the HUD and the phone's lamps. */
  snapshot() {
    return this.lines.map((l) => ({
      index: l.index,
      state: l.state,
      caller: l.call ? (l.call.caller.display || l.call.caller.name) : null,
      number: l.call ? l.call.caller.number : null,
      heldSeconds: Math.round(l.heldSeconds),
      patience: l.patience,
    }));
  }
}
