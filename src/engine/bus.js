/* ============================================================
   bus.js -- the one global event channel.

   Systems talk to each other through named events rather than
   by holding references. The phone does not know the horror
   director exists; it emits `call:answered` and whoever cares
   listens. That is what lets a new horror event hook an existing
   call without editing the phone code.

   Event names are `domain:verb`. Keep them in EVENTS below so
   there is one place to read the whole vocabulary.
   ============================================================ */

export const EVENTS = {
  // shift / story
  SHIFT_START: 'shift:start',
  SHIFT_END: 'shift:end',
  BEAT: 'story:beat',
  FLAG: 'story:flag',

  // clock
  MINUTE: 'clock:minute',

  // telephone
  RING: 'phone:ring',
  ANSWERED: 'call:answered',
  HOLD: 'call:hold',
  RESUME: 'call:resume',
  HUNGUP: 'call:hungup',
  CALL_END: 'call:end',
  LINE_CHANGED: 'phone:line',

  // dialogue
  LINE_SPOKEN: 'dialogue:line',
  CHOICES: 'dialogue:choices',
  DIALOGUE_END: 'dialogue:end',
  WAITING: 'dialogue:waiting',      // a waitFor node is holding for the player

  // work
  OUTAGE_NEW: 'outage:new',
  OUTAGE_UPDATE: 'outage:update',
  OUTAGE_RESTORED: 'outage:restored',
  DISPATCHED: 'crew:dispatched',
  CREW_STATUS: 'crew:status',
  RADIO_TRAFFIC: 'radio:traffic',
  LOOKUP: 'db:lookup',

  // horror
  HORROR: 'horror:event',
  POWER: 'power:level',

  // ui
  TOAST: 'ui:toast',

  /* --- the building, as opposed to the telephone --- */
  POWER_STATE: 'power:circuits',
  PAPERLOG: 'paper:entry',
  FAX: 'fax:page',
  ARCHIVE: 'records:pulled',
  HAUNT: 'haunt:event',
  SEQUENCE: 'sequence:step',
  TASK: 'task:state',
  DOOR: 'door:state',
  LIGHT: 'light:state',
  BUILDING_RING: 'phones:ring',
  TERMINAL_SCREEN: 'terminal:screen',
};

export class Bus {
  constructor() { this.map = new Map(); this.log = []; this.logging = false; }

  on(event, fn) {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event).add(fn);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    const un = this.on(event, (...a) => { un(); fn(...a); });
    return un;
  }

  off(event, fn) {
    const set = this.map.get(event);
    if (set) set.delete(fn);
  }

  emit(event, payload) {
    if (this.logging) this.log.push({ event, payload, t: Date.now() });
    const set = this.map.get(event);
    if (!set) return;
    // Copy first: a handler is allowed to unsubscribe itself.
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`bus handler for ${event}:`, err); }
    }
  }

  clear() { this.map.clear(); }
}

export const bus = new Bus();
