/* ============================================================
   tasks.js -- the reasons to get up.

   THE RULE, which the whole building is built around:

     THE REASON TO GET UP MUST COME FROM THE JOB,
     AND THE COST OF GETTING UP MUST BE THE PHONE.

   The player never walks down the corridor because they heard a
   spooky noise. They walk down the corridor because the terminal
   is dead and the breakers are down there, or because a caller
   from 1943 gave a service number that the CIS has never heard
   of and the paper cards are in Records, or because the
   supervisor told them to write anything they cannot account for
   in the book. Every one of those is a thing a night dispatcher
   would actually do.

   What makes it horror is what it costs. The telephone is in the
   other room and it does not care that the player is busy. The
   game is honest about that: ordinary traffic still rings while
   a task is open. Story beats do NOT -- see the director. Being
   punished for doing what the game asked is the one thing that
   would teach the player to never leave the chair again.

   A task is data. Anything can raise one: a call script, a
   sequence, a system. One at a time.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';
import { roomAt } from './haunt.js';

/**
 * The jobs.
 *
 *   objective  what the HUD says, with {action} tokens
 *   where      the room it is done in, for the HUD arrow and for the
 *              director's "the player is away from the desk" test
 *   done(ctx)  when it is finished
 *   onDone     flags to set, so scripts can gate on it
 */
export const TASKS = {
  restore_power: {
    objective: 'RESTORE THE BREAKERS — the panel is at the end of the corridor',
    where: 'corridor',
    urgent: true,
    done: (ctx) => ctx.power.allLive,
    onDone: ['power_restored'],
  },
  log_anomaly: {
    objective: 'WRITE IT IN THE LOG — the book is on the Records counter',
    where: 'records',
    done: (ctx) => ctx.paperlog.entries.length > (ctx.task.mark || 0),
    mark: (ctx) => ctx.paperlog.entries.length,
    onDone: ['logged_something'],
  },
  pull_card: {
    objective: 'FIND THE SERVICE CARD — Records, the index drawer',
    where: 'records',
    done: (ctx) => ctx.archive.pulled.size > (ctx.task.mark || 0),
    mark: (ctx) => ctx.archive.pulled.size,
    onDone: ['pulled_a_card'],
  },
  collect_fax: {
    objective: 'COLLECT THE FAX — the machine on the back counter',
    where: 'dispatch',
    done: (ctx) => !ctx.fax.hasUnread,
    onDone: ['collected_fax'],
  },
  backup_radio: {
    objective: 'USE THE BACKUP SET — the shelf by the breaker panel',
    where: 'corridor',
    urgent: true,
    done: (ctx) => ctx.state.has('used_backup_radio'),
    onDone: ['reached_crew_on_backup'],
  },
  compare_clocks: {
    objective: 'CHECK BOTH CLOCKS — dispatch, then the corridor',
    where: 'corridor',
    done: (ctx) => ctx.state.has('checked_clock_dispatch') && ctx.state.has('checked_clock_corridor'),
    onDone: ['compared_clocks'],
  },
  coffee: {
    objective: 'THERE IS COFFEE IN THE BREAK ROOM',
    where: 'breakroom',
    soft: true,
    done: (ctx) => ctx.state.has('had_coffee'),
    onDone: ['took_a_break'],
  },
  rear_door: {
    objective: 'SOMEBODY IS KNOCKING AT THE REAR DOOR',
    where: 'corridor',
    soft: true,
    done: (ctx) => ctx.state.has('answered_knock') || ctx.state.has('ignored_knock'),
    onDone: [],
  },
};

export class TaskSystem {
  constructor(systems) {
    this.sys = systems;        // power, paperlog, archive, fax, state, clock, player
    this.active = null;
    this.history = [];
    this._t = 0;
  }

  get objective() { return this.active ? this.active.def.objective : null; }
  get room() { return this.active ? this.active.def.where : null; }
  get id() { return this.active ? this.active.id : null; }

  /** True when the game has deliberately sent the player away from the desk. */
  get sendsPlayerAway() {
    return !!(this.active && this.active.def.where && this.active.def.where !== 'dispatch');
  }

  /** Where the player actually is. */
  get playerRoom() {
    const p = this.sys.player;
    return p ? roomAt(p.pos.x, p.pos.z) : 'dispatch';
  }

  get playerAtDesk() {
    return this.playerRoom === 'dispatch' && (!this.sys.player || !this.sys.player.walkingAway);
  }

  start(id, { quiet = false } = {}) {
    const def = TASKS[id];
    if (!def) { console.warn(`task: unknown "${id}"`); return false; }
    if (this.active && this.active.id === id) return false;
    const task = { id, def, t: 0, mark: 0 };
    this.active = task;
    // Some tasks are "do one more of these than you have already", so they
    // record the count at the moment they are issued.
    if (def.mark) task.mark = def.mark({ ...this.sys, task });
    this.sys.state.set(`task:${id}`, true);
    if (!quiet) bus.emit(EVENTS.TASK, { id, objective: def.objective, where: def.where });
    return true;
  }

  /** Give up on it (the story moved on, or the shift ended). */
  cancel() {
    if (!this.active) return;
    const id = this.active.id;
    this.active = null;
    bus.emit(EVENTS.TASK, { id, cancelled: true });
  }

  update(dt) {
    if (!this.active) return;
    this.active.t += dt;
    const ctx = { ...this.sys, task: this.active };
    let done = false;
    try { done = !!this.active.def.done(ctx); } catch (err) { console.error(err); done = true; }
    if (!done) return;
    const { id, def } = this.active;
    this.active = null;
    for (const f of def.onDone || []) this.sys.state.set(f, true);
    this.sys.state.bump('tasks_done');
    this.history.push({ id, at: this.sys.clock ? this.sys.clock.stamp() : '' });
    bus.emit(EVENTS.TASK, { id, done: true });
  }

  serialize() { return { active: this.active ? this.active.id : null, history: this.history }; }
  restore(d) {
    if (!d) return;
    this.history = d.history || [];
    if (d.active) this.start(d.active, { quiet: true });
  }
}
