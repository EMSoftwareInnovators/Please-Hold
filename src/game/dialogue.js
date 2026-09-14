/* ============================================================
   dialogue.js -- the conversation format and the machine that
   walks it.

   A call is DATA. It is a plain object: a caller, some metadata
   about how the line sounds and how patient the caller is, and a
   graph of nodes. A node is either the caller saying something
   (with a `next`), or the player choosing what to say. Nothing in
   this file knows anything about Mrs. Daley, outages or 1956.

   WRITING A NEW CALL: copy any file in src/data/calls/, change
   the id, add one import line to src/data/calls/index.js. You do
   not touch phone.js, calls.js or this file. `validateCall()`
   runs over every script at boot and again in tools/calls.mjs,
   so a typo in a `goto` is a startup error with a filename, not
   a dead end discovered at 3am in a playtest.

   -------------------------------------------------------------
   NODE SHAPE
     {
       speaker: 'caller' | 'player' | 'system' | 'radio',
       lines:  [{ text, clip?, pause?, effect?, stage? }],
       effects: [ ...ops... ],          // applied on entering
       choices: [{ text, goto, requires?, effects?, tone? }],
       next:   'nodeId',                // when there are no choices
       end:    true,                    // hang up here
     }

   OPS are documented in effects.js.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

/* ============================================================
   VALIDATION
   ============================================================ */

const SPEAKERS = new Set(['caller', 'player', 'system', 'radio']);
const LINE_KINDS = new Set(['clean', 'degraded', 'era1978', 'era1956', 'evp', 'inside']);

/**
 * Check a call script for the mistakes that are easy to make and expensive
 * to find. Returns an array of human-readable problems; empty means good.
 */
export function validateCall(call) {
  const errs = [];
  const at = (s) => `${call && call.id ? call.id : '<no id>'}: ${s}`;

  if (!call || typeof call !== 'object') return ['call is not an object'];
  if (!call.id) errs.push(at('missing id'));
  if (!call.caller || !call.caller.name) errs.push(at('missing caller.name'));
  if (call.caller && call.caller.line && !LINE_KINDS.has(call.caller.line)) {
    errs.push(at(`caller.line "${call.caller.line}" is not one of ${[...LINE_KINDS].join(', ')}`));
  }
  if (!call.nodes || typeof call.nodes !== 'object') {
    errs.push(at('missing nodes'));
    return errs;
  }
  const entry = call.entry || 'start';
  if (!call.nodes[entry]) errs.push(at(`entry node "${entry}" does not exist`));

  const seen = new Set();
  for (const [id, node] of Object.entries(call.nodes)) {
    const where = at(`node "${id}"`);
    if (node.speaker && !SPEAKERS.has(node.speaker)) {
      errs.push(`${where}: unknown speaker "${node.speaker}"`);
    }
    if (node.lines && !Array.isArray(node.lines)) errs.push(`${where}: lines must be an array`);
    if (node.waitFor && !node.next) {
      errs.push(`${where}: has waitFor but no next -- it would block forever`);
    }
    if (node.waitFor && node.choices) {
      errs.push(`${where}: waitFor and choices on the same node; pick one`);
    }
    for (const [i, l] of (node.lines || []).entries()) {
      if (typeof l === 'string') continue;
      if (!l || typeof l.text !== 'string') errs.push(`${where}: line ${i} has no text`);
      if (l.effect && !LINE_KINDS.has(l.effect)) errs.push(`${where}: line ${i} effect "${l.effect}" unknown`);
    }
    const hasChoices = Array.isArray(node.choices) && node.choices.length > 0;
    if (hasChoices) {
      for (const [i, c] of node.choices.entries()) {
        if (!c || typeof c.text !== 'string') errs.push(`${where}: choice ${i} has no text`);
        if (!c.goto && !c.end) errs.push(`${where}: choice ${i} has neither goto nor end`);
        if (c.goto) { seen.add(c.goto); if (!call.nodes[c.goto]) errs.push(`${where}: choice ${i} goes to missing node "${c.goto}"`); }
      }
    } else if (node.next) {
      seen.add(node.next);
      if (!call.nodes[node.next]) errs.push(`${where}: next points at missing node "${node.next}"`);
    } else if (!node.end) {
      errs.push(`${where}: no choices, no next and not marked end -- the call would stall here`);
    }
    if (node.effects && !Array.isArray(node.effects)) errs.push(`${where}: effects must be an array`);
  }

  // Unreachable nodes are usually a rename that was only half done.
  // `hold.onReturnNode` is a second entry point -- the phone jumps there when
  // the player comes back to a caller they parked -- so it counts as reached.
  seen.add(entry);
  if (call.hold && call.hold.onReturnNode) {
    seen.add(call.hold.onReturnNode);
    if (!call.nodes[call.hold.onReturnNode]) {
      errs.push(at(`hold.onReturnNode points at missing node "${call.hold.onReturnNode}"`));
    }
  }
  for (const id of Object.keys(call.nodes)) {
    if (!seen.has(id)) errs.push(at(`node "${id}" is unreachable`));
  }
  return errs;
}

/* ============================================================
   REQUIREMENT TESTS
   Shared by call eligibility and by individual player choices.
   ============================================================ */

/**
 * @param {object} req   the `requires` block, or undefined
 * @param {object} ctx   { state, clock, outages, crews, database, callerId }
 */
export function meets(req, ctx) {
  if (!req) return true;
  const { state, clock, outages, crews, database } = ctx;

  if (req.flags && !state.hasAll(req.flags)) return false;
  if (req.notFlags && !state.hasNone(req.notFlags)) return false;
  if (req.beat) {
    if (req.beat.min != null && state.beat < req.beat.min) return false;
    if (req.beat.max != null && state.beat > req.beat.max) return false;
  }
  if (req.minutes) {
    const m = clock.minutes;
    if (req.minutes.from != null && m < req.minutes.from) return false;
    if (req.minutes.to != null && m > req.minutes.to) return false;
  }
  if (req.trustAtLeast != null) {
    const id = req.caller || ctx.callerId;
    if (!id || state.caller(id).trust < req.trustAtLeast) return false;
  }
  if (req.trustAtMost != null) {
    const id = req.caller || ctx.callerId;
    if (!id || state.caller(id).trust > req.trustAtMost) return false;
  }
  if (req.remembers) {
    const id = req.caller || ctx.callerId;
    if (!id || !state.caller(id).toldYou.includes(req.remembers)) return false;
  }
  if (req.counter) {
    if (state.count(req.counter.name) < (req.counter.atLeast ?? 1)) return false;
  }
  // "You have actually done the work" gates. These are what make the
  // terminal matter: you cannot say a thing you have not looked up.
  if (req.lookedUp && database && !database.wasLookedUp(req.lookedUp)) return false;
  if (req.anyLookup && database && database.lookups.size === 0) return false;
  if (req.outageOpen && outages && !outages.find(req.outageOpen)) return false;
  if (req.noOutageOpen && outages && outages.find(req.noOutageOpen)) return false;
  if (req.outageOnFeeder && outages && !outages.byFeeder(req.outageOnFeeder).length) return false;
  if (req.crewDispatched && crews && !crews.isDispatched(req.crewDispatched)) return false;
  if (req.anyCrewDispatched && crews && crews.dispatchedCount() === 0) return false;
  if (req.crewAvailable && crews && !crews.available().length) return false;
  if (req.ticketCount != null && outages && outages.list.length < req.ticketCount) return false;
  if (typeof req.test === 'function' && !req.test(ctx)) return false;
  return true;
}

/* ============================================================
   THE RUNNER
   Walks one call script. Knows nothing about audio or UI: it
   emits events and waits to be told the line finished.
   ============================================================ */

export class DialogueRunner {
  /**
   * @param {object} deps { state, clock, outages, crews, database, effects, audio }
   */
  constructor(deps) {
    this.deps = deps;
    this.call = null;
    this.node = null;
    this.nodeId = null;
    this.lineIndex = 0;
    this.choices = [];
    this.active = false;
    this.paused = false;             // true while the caller is on hold
    this.waiting = false;            // true while a line is being spoken
    this.blocked = false;            // true while a waitFor node is unsatisfied
    this.hint = null;                // what the player is being asked to do
    this._onLineDone = null;
    this.history = [];
  }

  get callerId() { return this.call && this.call.caller ? (this.call.caller.id || this.call.id) : null; }

  /** Begin a call script. */
  start(call) {
    this.call = call;
    this.active = true;
    this.paused = false;
    this.history = [];
    this._goto(call.entry || 'start');
    return this;
  }

  /** Put the conversation to sleep without tearing it down. */
  hold() { this.paused = true; }

  /**
   * Wake it back up. There are three states a held conversation can be in and
   * all three have to be handled, because the player is free to press HOLD at
   * any instant:
   *
   *   waiting on a line   -- replay that line from the top
   *   waiting on a reply  -- put the replies back on screen. This one bit:
   *                          the runner still had them, but the UI had
   *                          cleared its copy when the panel closed, so the
   *                          conversation was alive with no way to answer it.
   *   between the two     -- carry on
   */
  resume() {
    this.paused = false;
    if (!this.node) return;
    if (this.choices.length) {
      bus.emit(EVENTS.CHOICES, { call: this.call, node: this.nodeId, choices: this.choices });
      return;
    }
    if (this.waiting) return this._speakCurrentLine();
    this._advanceLines();
  }

  /** Walk to a node: apply its effects, then start its lines. */
  _goto(id) {
    const node = this.call.nodes[id];
    if (!node) {
      console.warn(`dialogue: ${this.call.id} has no node "${id}"`);
      return this.end('error');
    }
    this.nodeId = id;
    this.node = node;
    this.lineIndex = 0;
    this.choices = [];
    this.history.push(id);

    if (node.effects) this.deps.effects.applyAll(node.effects, this._ctx());
    if (node.end && !(node.lines && node.lines.length)) return this.end('script');
    this._advanceLines();
  }

  _ctx() {
    return {
      ...this.deps,
      call: this.call,
      callerId: this.callerId,
      node: this.node,
      runner: this,
    };
  }

  /** Normalize a line entry to an object. */
  _line(i) {
    const raw = (this.node.lines || [])[i];
    if (raw == null) return null;
    return typeof raw === 'string' ? { text: raw } : raw;
  }

  _advanceLines() {
    if (this.paused || !this.active) return;
    const line = this._line(this.lineIndex);
    if (line) return this._speakCurrentLine();

    /* A `waitFor` node holds the conversation until the player has actually
       done something -- sat down, looked up an account, sent a truck. It is
       what lets the tutorial teach by doing instead of by telling, and any
       later call can use it to wait on real work. `tick()` re-checks it. */
    if (this.node.waitFor && !meets(this.node.waitFor, this._ctx())) {
      if (!this.blocked) {
        this.blocked = true;
        this.hint = this.node.hint || null;
        bus.emit(EVENTS.WAITING, { call: this.call, node: this.nodeId, hint: this.hint });
      }
      return;
    }
    if (this.blocked) {
      this.blocked = false;
      this.hint = null;
      bus.emit(EVENTS.WAITING, { call: this.call, node: this.nodeId, hint: null });
    }

    // Out of lines: either offer choices, follow `next`, or end.
    if (this.node.end) return this.end('script');
    const avail = this._availableChoices();
    if (avail.length) {
      this.choices = avail;
      bus.emit(EVENTS.CHOICES, { call: this.call, node: this.nodeId, choices: avail });
      return;
    }
    if (this.node.next) return this._goto(this.node.next);
    // A node with choices that ALL failed their requirements would strand the
    // player, so fall through to the declared fallback or simply end.
    if (this.node.fallback) return this._goto(this.node.fallback);
    return this.end('exhausted');
  }

  _speakCurrentLine() {
    const line = this._line(this.lineIndex);
    if (!line) return this._advanceLines();
    this.waiting = true;
    const speaker = this.node.speaker || 'caller';
    const payload = {
      call: this.call,
      node: this.nodeId,
      index: this.lineIndex,
      speaker,
      text: line.text,
      stage: line.stage || null,
      effect: line.effect || (this.call.caller && this.call.caller.line) || 'clean',
      voice: line.voiceProfile || (this.call.caller && this.call.caller.voice) || 'neutral',
      clip: line.clip || null,
      pause: line.pause ?? 0.25,
      line,
    };
    if (line.effects) this.deps.effects.applyAll(line.effects, this._ctx());
    bus.emit(EVENTS.LINE_SPOKEN, payload);
  }

  /**
   * The presentation layer calls this when a line has finished being spoken
   * and its post-pause has elapsed.
   */
  lineFinished() {
    if (!this.active || !this.waiting) return;
    this.waiting = false;
    if (this.paused) return;
    this.lineIndex++;
    this._advanceLines();
  }

  _availableChoices() {
    const ctx = this._ctx();
    return (this.node.choices || [])
      .map((c, i) => ({ ...c, index: i }))
      .filter((c) => {
        if (!meets(c.requires, ctx)) return false;
        if (c.once && this.history.includes(`choice:${this.nodeId}:${c.index}`)) return false;
        return true;
      });
  }

  /** Called every frame. Only does anything while a waitFor is unsatisfied. */
  tick() {
    if (!this.active || this.paused || !this.blocked) return;
    if (meets(this.node.waitFor, this._ctx())) this._advanceLines();
  }

  /** The player picked a reply. `index` is into the AVAILABLE list. */
  choose(index) {
    if (!this.active || this.paused) return false;
    const c = this.choices[index];
    if (!c) return false;
    this.history.push(`choice:${this.nodeId}:${c.index}`);
    this.choices = [];
    if (c.effects) this.deps.effects.applyAll(c.effects, this._ctx());
    this._pendingGoto = c.end ? null : c.goto;
    this._playerEnd = !!c.end;

    // A choice with `say: false` is the player deciding to say nothing. There
    // is no spoken line, so nothing will ever call playerLineFinished() for
    // it -- the conversation has to be moved along here instead.
    if (c.say === false) {
      this.waiting = false;
      this.playerLineFinished();
      return true;
    }

    // Otherwise the player's own line is shown before the caller answers.
    bus.emit(EVENTS.LINE_SPOKEN, {
      call: this.call,
      node: this.nodeId,
      speaker: 'player',
      text: c.spoken || c.text,
      effect: 'inside',
      voice: 'player',
      pause: 0.12,
      isPlayer: true,
    });
    this.waiting = true;
    return true;
  }

  /** Called when the player's own spoken line has finished. */
  playerLineFinished() {
    this.waiting = false;
    if (this._playerEnd) { this._playerEnd = false; return this.end('player'); }
    const to = this._pendingGoto;
    this._pendingGoto = null;
    if (to) this._goto(to);
  }

  /**
   * Snapshot this conversation so another one can use the runner.
   *
   * There is one runner and six telephone lines. Parking a caller and picking
   * up a second one used to overwrite the first conversation outright: coming
   * back to line 1 resumed you into line 2's node graph. Hold is the central
   * mechanic of this game, so each parked line carries its own state and
   * hands it back on the way in.
   */
  capture() {
    if (!this.active || !this.call) return null;
    return {
      blocked: this.blocked,
      hint: this.hint,
      call: this.call,
      nodeId: this.nodeId,
      lineIndex: this.lineIndex,
      choices: this.choices.slice(),
      waiting: this.waiting,
      history: this.history.slice(),
      pendingGoto: this._pendingGoto,
      playerEnd: this._playerEnd,
    };
  }

  /** Put a captured conversation back. */
  restore(snap) {
    if (!snap) return false;
    this.call = snap.call;
    this.nodeId = snap.nodeId;
    this.node = snap.call.nodes[snap.nodeId] || null;
    this.lineIndex = snap.lineIndex;
    this.choices = snap.choices.slice();
    this.waiting = snap.waiting;
    this.history = snap.history.slice();
    this._pendingGoto = snap.pendingGoto;
    this._playerEnd = snap.playerEnd;
    this.blocked = snap.blocked;
    this.hint = snap.hint;
    this.active = true;
    this.paused = true;      // resume() is what wakes it
    return true;
  }

  /**
   * Drop the current conversation without announcing an ending. Used when a
   * parked caller runs out of patience: the call is over, but it did not
   * reach an end node, so nothing downstream should treat it as completed.
   */
  discard(call) {
    if (call && this.call !== call) return false;
    this.active = false;
    this.paused = false;
    this.waiting = false;
    this.call = null;
    this.node = null;
    this.nodeId = null;
    this.choices = [];
    return true;
  }

  /** Caller (or something else) terminates the call. */
  end(reason = 'script') {
    if (!this.active) return;
    this.active = false;
    if (this.blocked) {
      this.blocked = false;
      this.hint = null;
      bus.emit(EVENTS.WAITING, { call: this.call, node: this.nodeId, hint: null });
    }
    const call = this.call;
    const nodeId = this.nodeId;
    this.node = null;
    this.choices = [];
    this.waiting = false;
    bus.emit(EVENTS.DIALOGUE_END, { call, reason, node: nodeId });
  }
}
