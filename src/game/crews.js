/* ============================================================
   crews.js -- the field, simulated just enough.

   A crew has a position, a status and a job. Once dispatched it
   drives (taking real minutes off the shift clock), arrives,
   works, and calls in clear. The player never sees any of this
   directly -- it reaches them as radio traffic, which is the
   point. The county exists only as voices.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';
import { CREWS, SKILL_FOR_CAUSE } from '../data/crews.js';
import { driveMinutes, OPS_CENTER } from '../data/grid.js';

export const CREW_STATUS = {
  AVAILABLE: 'AVAILABLE',
  ASLEEP: 'ON CALL',
  ENROUTE: 'ENROUTE',
  ONSITE: 'ON SITE',
  CLEARING: 'CLEARING',
  OUT_OF_SERVICE: 'OUT OF SERVICE',
};

export class CrewManager {
  constructor({ clock, outages, radio }) {
    this.clock = clock;
    this.outages = outages;
    this.radio = radio;
    this.crews = CREWS.map((c) => ({
      ...c,
      pos: { ...c.home },
      status: c.onCall ? CREW_STATUS.ASLEEP : CREW_STATUS.AVAILABLE,
      ticket: null,
      etaMinutes: 0,
      workMinutes: 0,
      jobsCleared: 0,
    }));
    this.byId = new Map(this.crews.map((c) => [c.id, c]));
  }

  get(id) { return this.byId.get(String(id).toUpperCase()) || null; }

  available() {
    return this.crews.filter((c) => c.status === CREW_STATUS.AVAILABLE || c.status === CREW_STATUS.ASLEEP);
  }
  dispatchedCount() {
    return this.crews.filter((c) => c.status === CREW_STATUS.ENROUTE || c.status === CREW_STATUS.ONSITE).length;
  }
  isDispatched(id) {
    const c = this.get(id);
    return !!c && (c.status === CREW_STATUS.ENROUTE || c.status === CREW_STATUS.ONSITE);
  }

  /**
   * Send a crew to a ticket.
   * @returns {{ok:boolean, reason?:string, eta?:number}}
   */
  dispatch(crewId, ticketId) {
    const crew = this.get(crewId);
    const ticket = this.outages.byId.get(ticketId);
    if (!crew) return { ok: false, reason: 'NO SUCH UNIT' };
    if (!ticket) return { ok: false, reason: 'NO SUCH TICKET' };
    if (crew.ticket) return { ok: false, reason: `${crew.id} IS ALREADY ON ${crew.ticket}` };
    if (crew.status === CREW_STATUS.OUT_OF_SERVICE) return { ok: false, reason: `${crew.id} IS OUT OF SERVICE` };

    const needed = SKILL_FOR_CAUSE[ticket.cause] || 'ASSESS';
    const qualified = crew.skills.includes(needed);

    const eta = driveMinutes(crew.pos, ticket.pos) + (crew.status === CREW_STATUS.ASLEEP ? 18 : 0);
    crew.status = CREW_STATUS.ENROUTE;
    crew.ticket = ticket.id;
    crew.etaMinutes = eta;
    crew.workMinutes = workEstimate(ticket, qualified);
    crew.qualified = qualified;

    ticket.crew = crew.id;
    ticket.etr = this.clock.stamp(this.clock.minutes + eta + crew.workMinutes);
    this.outages.update(ticket.id, { status: 'ASSIGNED', stamp: this.clock.stamp() });

    bus.emit(EVENTS.DISPATCHED, { crew, ticket, eta, qualified });
    this.radio.transmit(crew.id, rollOut(crew, ticket, eta), { delay: 1.2 });
    return { ok: true, eta, qualified };
  }

  setStatus(id, status) {
    const c = this.get(id);
    if (!c) return null;
    c.status = status;
    bus.emit(EVENTS.CREW_STATUS, { crew: c });
    return c;
  }

  /** Called once per shift-minute. Drives the field forward. */
  tick(minutes) {
    for (const crew of this.crews) {
      if (crew.status === CREW_STATUS.ENROUTE) {
        crew.etaMinutes -= 1;
        if (crew.etaMinutes <= 0) {
          crew.status = CREW_STATUS.ONSITE;
          const t = this.outages.byId.get(crew.ticket);
          if (t) {
            crew.pos = { ...t.pos };
            this.outages.update(t.id, { status: 'ON SITE', stamp: this.clock.stamp() });
            this.radio.transmit(crew.id, onScene(crew, t), { delay: 0.6 });
          }
          bus.emit(EVENTS.CREW_STATUS, { crew });
        }
      } else if (crew.status === CREW_STATUS.ONSITE) {
        crew.workMinutes -= 1;
        if (crew.workMinutes <= 0) {
          const t = this.outages.byId.get(crew.ticket);
          if (t) {
            if (crew.qualified) {
              this.outages.markRestored(t.id, this.clock.stamp());
              crew.jobsCleared++;
              this.radio.transmit(crew.id, clearUp(crew, t), { delay: 0.6 });
            } else {
              // Wrong crew for the job. They can assess, not fix.
              this.outages.update(t.id, { status: 'REPORTED', crew: null, etr: null, stamp: this.clock.stamp() });
              this.radio.transmit(crew.id, needBigger(crew, t), { delay: 0.6 });
            }
          }
          crew.ticket = null;
          crew.status = CREW_STATUS.AVAILABLE;
          bus.emit(EVENTS.CREW_STATUS, { crew });
        }
      }
    }
  }

  serialize() { return { crews: this.crews }; }
  restore(d) {
    if (!d || !d.crews) return;
    this.crews = d.crews;
    this.byId = new Map(this.crews.map((c) => [c.id, c]));
  }
}

function workEstimate(ticket, qualified) {
  if (!qualified) return 8;                  // long enough to look and report back
  const base = { 'FUSE': 9, 'SERVICE DROP': 16, 'TREE ON LINE': 26, 'BROKEN POLE': 55, 'WIRE DOWN': 34, 'TRANSFORMER': 30 };
  return (base[ticket.cause] || 18) + Math.round(Math.random() * 6);
}

/* ---------------- the things crews actually say ----------------
   Kept here rather than in a call script because they are
   generated from live state, not authored per-conversation. The
   phrasing is per-crew: Halloran is terse, Sikes narrates.       */

function rollOut(crew, ticket, eta) {
  const where = ticket.address || ticket.feeder;
  if (crew.id === 'T7') return `Dispatch, Seven. Copy ${ticket.id}, ${where}. Rolling. Give me ${eta}.`;
  if (crew.id === 'T12') return `Twelve's got it, ${ticket.id}. We're comin' off ${crew.pos.x > 20 ? 'Kettle Creek' : 'the county road'}, so figure ${eta} minutes, maybe more if the water's over the ford.`;
  return `...Line Three. Yeah. We're up. ${ticket.id}. ${eta} minutes, dispatch, and that's movin'.`;
}

function onScene(crew, ticket) {
  if (crew.id === 'T7') return `Seven's on scene, ${ticket.id}.`;
  if (crew.id === 'T12') return `Twelve on scene. It's ugly out here, dispatch. Stand by.`;
  return `Line Three on location.`;
}

function clearUp(crew, ticket) {
  const n = ticket.customers;
  if (crew.id === 'T7') return `Dispatch, Seven. ${ticket.id} is clear. ${cause(ticket)}. You should have ${n} back.`;
  if (crew.id === 'T12') return `Twelve clearing ${ticket.id}. ${cause(ticket)} — took some doing. Show them restored, about ${n} meters.`;
  return `Line Three. ${ticket.id} restored. ${cause(ticket)}. Put us back in service.`;
}

function needBigger(crew, ticket) {
  if (crew.id === 'T7') return `Dispatch, Seven. I'm looking at ${ticket.id} and it's not mine. This is a line job. You want to wake somebody up.`;
  return `Dispatch, this is past what we've got on the truck. You'll need a line crew on ${ticket.id}.`;
}

function cause(ticket) {
  return {
    'FUSE': 'Cutout was open. Refused it',
    'TREE ON LINE': 'Limb across the primary. Cut it out',
    'SERVICE DROP': 'Service drop was down at the weatherhead',
    'WIRE DOWN': 'Conductor on the ground. It is secured',
    'BROKEN POLE': 'Pole was broke off at the base. Set a new one',
    'TRANSFORMER': 'Transformer was blown. Changed it out',
  }[ticket.cause] || 'Found the trouble';
}
