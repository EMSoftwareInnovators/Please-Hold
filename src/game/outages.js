/* ============================================================
   outages.js -- trouble tickets.

   A ticket is the unit of work the whole night is measured in.
   Calls create them, the terminal lists them, dispatch assigns
   crews to them, the map colors feeders by them, and the radio
   closes them out. Every one of those systems reads this and
   none of them keep their own copy.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';
import { FEEDER_BY_ID, feederCenter } from '../data/grid.js';

export const STATUS = {
  REPORTED: 'REPORTED',
  ASSIGNED: 'ASSIGNED',
  ENROUTE: 'ENROUTE',
  ONSITE: 'ON SITE',
  RESTORED: 'RESTORED',
  CANCELLED: 'CANCELLED',
};

let seq = 1000;

export class OutageRegistry {
  constructor() {
    this.list = [];
    this.byId = new Map();
  }

  /** Mint a ticket number in the company's format. */
  static nextId() { seq += 1; return `TR-${seq}`; }

  create(spec) {
    const id = spec.id || OutageRegistry.nextId();
    if (this.byId.has(id)) return this.byId.get(id);
    const feeder = spec.feeder && FEEDER_BY_ID[spec.feeder] ? spec.feeder : (spec.feeder || 'UNKNOWN');
    const ticket = {
      id,
      feeder,
      address: spec.address || '',
      town: spec.town || '',
      cause: spec.cause || 'UNKNOWN',
      customers: spec.customers ?? estimateCustomers(feeder),
      reportedBy: spec.reportedBy || '',
      reportedAt: spec.stamp || '',
      status: STATUS.REPORTED,
      priority: spec.priority ?? (spec.hazard ? 1 : 3),   // 1 = highest
      hazard: !!spec.hazard,
      crew: null,
      etr: null,
      restoredAt: null,
      history: [{ stamp: spec.stamp || '', text: 'REPORTED' }],
      pos: feederCenter(feeder),
    };
    this.list.push(ticket);
    this.byId.set(id, ticket);
    bus.emit(EVENTS.OUTAGE_NEW, ticket);
    return ticket;
  }

  update(id, fields = {}) {
    const t = this.byId.get(id);
    if (!t) return null;
    Object.assign(t, fields);
    if (fields.status) t.history.push({ stamp: fields.stamp || '', text: fields.status });
    bus.emit(EVENTS.OUTAGE_UPDATE, t);
    return t;
  }

  /** Close a ticket out. Named `markRestored` so that `restore()` can mean
   *  what it means on every other system: load a saved snapshot. */
  markRestored(id, stamp) {
    const t = this.byId.get(id);
    if (!t) return null;
    t.status = STATUS.RESTORED;
    t.restoredAt = stamp || '';
    t.history.push({ stamp: stamp || '', text: 'RESTORED' });
    bus.emit(EVENTS.OUTAGE_RESTORED, t);
    return t;
  }

  /** Open tickets, worst first: hazards, then priority, then age. */
  get open() {
    return this.list
      .filter((t) => t.status !== STATUS.RESTORED && t.status !== STATUS.CANCELLED)
      .sort((a, b) => (b.hazard - a.hazard) || (a.priority - b.priority) || (a.id < b.id ? -1 : 1));
  }

  get restored() { return this.list.filter((t) => t.status === STATUS.RESTORED); }

  /** Find an open ticket by id, feeder or a substring of the address. */
  find(key) {
    if (!key) return null;
    const k = String(key).toUpperCase();
    return this.open.find((t) => t.id === k || t.feeder === k || t.address.toUpperCase().includes(k)) || null;
  }

  byFeeder(feeder) { return this.open.filter((t) => t.feeder === feeder); }

  /** The set of feeders that currently have trouble, for the map. */
  affectedFeeders() { return new Set(this.open.map((t) => t.feeder)); }

  /** Total meters out, which is the number the supervisor asks for. */
  customersOut() { return this.open.reduce((n, t) => n + (t.customers || 0), 0); }

  unassigned() { return this.open.filter((t) => !t.crew); }

  serialize() { return { list: this.list, seq }; }
  restore(d) {
    if (!d) return;
    this.list = d.list || [];
    this.byId = new Map(this.list.map((t) => [t.id, t]));
    if (d.seq) seq = d.seq;
  }
}

/** A plausible meter count for trouble on a given feeder. */
function estimateCustomers(feeder) {
  const f = FEEDER_BY_ID[feeder];
  if (!f) return 1;
  // Most trouble is a lateral, not the whole circuit.
  return Math.max(1, Math.round(f.customers * (0.02 + Math.random() * 0.08)));
}
