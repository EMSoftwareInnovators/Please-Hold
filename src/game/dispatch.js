/* ============================================================
   dispatch.js -- the decision layer over crews.

   Separate from crews.js on purpose: crews.js simulates trucks,
   this decides which truck should get which job and explains
   itself to the player. That split is what lets the terminal's
   dispatch screen stay dumb -- it lists recommendations and sends
   the one the player picks.
   ============================================================ */
import { SKILL_FOR_CAUSE } from '../data/crews.js';
import { driveMinutes } from '../data/grid.js';
import { CREW_STATUS } from './crews.js';
import { bus, EVENTS } from '../engine/bus.js';

export class Dispatcher {
  constructor({ crews, outages, radio, clock, state }) {
    this.crews = crews;
    this.outages = outages;
    this.radio = radio;
    this.clock = clock;
    this.state = state;
  }

  /**
   * Rank the crews for a ticket. Returns entries the dispatch screen can
   * render directly, including WHY a unit is or is not a good idea.
   */
  recommend(ticketId) {
    const ticket = this.outages.byId.get(ticketId);
    if (!ticket) return [];
    const needed = SKILL_FOR_CAUSE[ticket.cause] || 'ASSESS';
    return this.crews.crews.map((c) => {
      const qualified = c.skills.includes(needed);
      const free = c.status === CREW_STATUS.AVAILABLE || c.status === CREW_STATUS.ASLEEP;
      const eta = driveMinutes(c.pos, ticket.pos) + (c.status === CREW_STATUS.ASLEEP ? 18 : 0);
      let note = '';
      if (!free) note = `ON ${c.ticket || 'ASSIGNMENT'}`;
      else if (!qualified) note = `NOT RATED FOR ${needed}`;
      else if (c.status === CREW_STATUS.ASLEEP) note = 'ON CALL - MUST BE WOKEN';
      else note = 'READY';
      return {
        crew: c, eta, qualified, free, note,
        score: (free ? 0 : 1000) + (qualified ? 0 : 400) + eta + (c.status === CREW_STATUS.ASLEEP ? 25 : 0),
      };
    }).sort((a, b) => a.score - b.score);
  }

  /** Send a unit, announcing it over the air the way a dispatcher would. */
  send(crewId, ticketId) {
    const ticket = this.outages.byId.get(ticketId);
    const crew = this.crews.get(crewId);
    if (!ticket || !crew) return { ok: false, reason: 'BAD ASSIGNMENT' };

    // The player's own transmission comes first; the crew answers after.
    this.radio.keyUp(assignment(crew, ticket));
    const res = this.crews.dispatch(crewId, ticketId);
    if (res.ok) {
      this.state.log(this.clock.stamp(), `${crew.id} dispatched to ${ticket.id} (${ticket.address || ticket.feeder})`, 'dispatch');
      this.state.bump('dispatches');
    }
    return res;
  }

  /** Everything currently assignable, worst trouble first. */
  workQueue() { return this.outages.unassigned(); }
}

function assignment(crew, ticket) {
  const where = [ticket.address, ticket.town].filter(Boolean).join(', ') || ticket.feeder;
  const hazard = ticket.hazard ? ' Caller reports wire down — treat it as energized.' : '';
  return `${crew.callsign}, dispatch. I've got ${ticket.id}, ${where}, ${ticket.feeder}. Reported ${ticket.cause.toLowerCase()}.${hazard}`;
}
