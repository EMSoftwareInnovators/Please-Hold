/* ============================================================
   effects.js -- the verbs a call script is allowed to use.

   A call script never calls a function. It lists ops, and this
   file is the only place that knows what an op means. That is the
   seam that keeps writing and engineering apart: a writer can
   create an outage, corrupt a record, schedule a callback or fire
   a horror event without importing anything.

   ADDING AN OP: add a case to OPS below and document it here.
   Everything else -- validation, save/load, the headless tests --
   picks it up automatically.

   -------------------------------------------------------------
   STORY / MEMORY
     { op:'flag',     name, value=true }      set or clear a story flag
     { op:'counter',  name, by=1 }            bump a named counter
     { op:'beat',     to }                    advance the story beat
     { op:'trust',    delta, caller? }        move a caller's opinion of you
     { op:'remember', key, caller? }          the caller now knows they told you
     { op:'promise',  key, caller? }          you said you would do something
     { op:'log',      text, kind? }           write a line into the shift log

   WORK
     { op:'outage.create', id?, feeder, address, town?, cause?, customers?,
                           reportedBy?, priority?, hazard? }
     { op:'outage.update', id, ...fields }
     { op:'outage.restore', id }
     { op:'account.add',    record }          insert a customer record
     { op:'account.patch',  id, field, value} change a record (quietly)
     { op:'account.corrupt',id, kind }        make a record WRONG on purpose

   TELEPHONY / SCHEDULING
     { op:'schedule', call, delay }           queue a call `delay` minutes out
     { op:'cancel',   call }                  un-queue it
     { op:'hangup' }                          the caller hangs up now
     { op:'line',     kind }                  change how the line sounds mid-call

   FIELD
     { op:'radio', crew, text, delay? }       traffic from a crew
     { op:'crew.status', crew, status }       force a crew's status

   PRESENTATION
     { op:'sound',  name, opts? }             one-shot from the audio engine
     { op:'horror', event, args? }            hand off to the horror director
     { op:'toast',  text }                    a line in the corner of the HUD
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

const OPS = {
  /* ---------------- story / memory ---------------- */
  flag(op, ctx) { ctx.state.set(op.name, op.value !== false); },
  counter(op, ctx) { ctx.state.bump(op.name, op.by ?? 1); },
  beat(op, ctx) { ctx.state.advanceBeat(op.to); },
  trust(op, ctx) {
    const id = op.caller || ctx.callerId;
    if (id) ctx.state.trust(id, op.delta ?? 0);
  },
  remember(op, ctx) {
    const id = op.caller || ctx.callerId;
    if (id) ctx.state.remember(id, op.key);
  },
  promise(op, ctx) {
    const id = op.caller || ctx.callerId;
    if (id) ctx.state.promised(id, op.key);
  },
  log(op, ctx) { ctx.state.log(ctx.clock.stamp(), op.text, op.kind || 'note'); },

  /* ---------------- work ---------------- */
  'outage.create': function (op, ctx) {
    const o = ctx.outages.create({
      id: op.id,
      feeder: op.feeder,
      address: op.address,
      town: op.town,
      cause: op.cause,
      customers: op.customers,
      reportedBy: op.reportedBy || (ctx.call && ctx.call.caller && ctx.call.caller.name),
      priority: op.priority,
      hazard: op.hazard,
      stamp: ctx.clock.stamp(),
    });
    if (op.remember && ctx.callerId) ctx.state.remember(ctx.callerId, op.remember);
    return o;
  },
  'outage.update': function (op, ctx) {
    const { op: _ignored, id, ...fields } = op;
    ctx.outages.update(id, fields);
  },
  'outage.restore': function (op, ctx) { ctx.outages.markRestored(op.id, ctx.clock.stamp()); },

  'account.add': function (op, ctx) { ctx.database.add(op.record); },
  'account.patch': function (op, ctx) { ctx.database.patch(op.id, op.field, op.value); },
  'account.corrupt': function (op, ctx) { ctx.database.corrupt(op.id, op.kind, op.value); },

  /* ---------------- telephony ---------------- */
  schedule(op, ctx) { ctx.director.schedule(op.call, op.delay ?? 0, op.reason || 'script'); },
  cancel(op, ctx) { ctx.director.cancel(op.call); },
  hangup(op, ctx) {
    // Defer: an op runs while a node is being entered, and tearing the runner
    // down underneath itself would drop the line that explains the hangup.
    ctx.runner && setTimeout(() => ctx.runner.end(op.reason || 'caller'), 0);
  },
  line(op, ctx) {
    if (ctx.call && ctx.call.caller) ctx.call.caller.line = op.kind;
    bus.emit(EVENTS.LINE_CHANGED, { kind: op.kind });
  },

  /* ---------------- field ---------------- */
  radio(op, ctx) { ctx.radio.transmit(op.crew, op.text, { delay: op.delay ?? 0, voice: op.voice }); },
  'crew.status': function (op, ctx) { ctx.crews.setStatus(op.crew, op.status); },

  /* ---------------- presentation ---------------- */
  sound(op, ctx) { ctx.audio && ctx.audio.play(op.name, op.opts || {}); },
  horror(op, ctx) { ctx.horror && ctx.horror.fire(op.event, op.args || {}); },

  /* ---------------- the building ----------------
     These are what let a conversation reach out of the telephone and do
     something to the room the player is sitting in. A caller from 1943 can
     start the fax machine; the 1978 dispatcher can put the lights out. */

  /** Send a page. `at` names one from src/data/faxes.js. */
  fax(op, ctx) {
    if (!ctx.fax) return;
    const page = op.page || (ctx.faxLibrary || []).find((f) => f.id === op.at);
    if (page) ctx.fax.send(page, { delay: op.delay ?? 0 });
  },

  /** Arm a persistent physical change. See haunt.js. */
  haunt(op, ctx) { ctx.haunt && ctx.haunt.arm(op.name, { force: op.force !== false }); },

  /** Trip or restore circuits. */
  power(op, ctx) {
    if (!ctx.power) return;
    if (op.trip) ctx.power.trip(op.trip, { reason: op.reason || 'unknown', emergency: op.emergency !== false });
    if (op.restore) ctx.power.resetAll();
  },

  /** Ring an instrument somewhere else in the building. */
  ringPhone(op, ctx) {
    if (!ctx.phones) return;
    if (op.all) ctx.phones.ringAll({ seconds: op.seconds ?? 45 });
    else ctx.phones.ring(op.id || 'dispatch', { seconds: op.seconds ?? 20, display: op.display });
  },

  /** Give the player a reason to stand up. */
  task(op, ctx) {
    if (!ctx.tasks) return;
    if (op.cancel) ctx.tasks.cancel();
    else ctx.tasks.start(op.id);
  },

  /** Unlock a paper-log observation without the player having to witness it
      through a haunt -- used when the WITNESSING was the conversation. */
  observe(op, ctx) { ctx.state.set(op.flag, true); },

  /** Play an authored sequence (the cascade, 4:17, the knock, dawn). */
  sequence(op, ctx) {
    if (!ctx.sequences || !ctx.game) return;
    ctx.game.playSequence(op.id);
  },
  toast(op, ctx) { bus.emit(EVENTS.TOAST, { text: op.text }); },
};

export class EffectResolver {
  /** @param {object} systems everything an op might need to reach */
  constructor(systems) { this.systems = systems; }

  /** Run one op. Unknown ops warn rather than throw -- a typo in a script
   *  should not take the shift down mid-call. */
  apply(op, ctx) {
    if (!op || !op.op) return;
    const fn = OPS[op.op];
    if (!fn) { console.warn(`effects: unknown op "${op.op}"`); return; }
    try {
      return fn(op, { ...this.systems, ...ctx });
    } catch (err) {
      console.error(`effects: op "${op.op}" failed:`, err);
    }
  }

  applyAll(list, ctx) {
    if (!Array.isArray(list)) return;
    for (const op of list) this.apply(op, ctx);
  }

  /** The set of op names, for the validator and the docs. */
  static get opNames() { return Object.keys(OPS); }
}

export const OP_NAMES = Object.keys(OPS);
