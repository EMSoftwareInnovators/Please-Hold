/* ============================================================
   archive.js -- Records, and why the player walks down there.

   The CIS went live in 1984. Everything before that is paper: a
   drawer of service cards, a shelf of outage ledgers, an
   incident file the company would rather not have kept, and a
   card index because the microfilm reader has been broken since
   the spring and everybody knows it.

   THE POINT OF THIS SYSTEM is that the terminal saying NO
   RECORDS MATCH is not the end of a conversation. A caller gives
   a name, a road and a service number; the modern database has
   never heard of any of it; and the player can either tell them
   they do not exist, or walk to Records and find out that they
   did.

   That is a far better scare than a ghost detector. The player
   assembles the impossible fact themselves, out of a filing
   cabinet, in a room with the door open behind them.

   Cards live in src/data/archive.js. Searching here is
   deliberately dumber than the CIS search: paper does not do
   fuzzy matching, and a player who has the wrong road gets
   nothing.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();

export class Archive {
  constructor({ state, clock, cards = [], ledgers = [], incidents = [] } = {}) {
    this.state = state;
    this.clock = clock;
    this.cards = cards;
    this.ledgers = ledgers;
    this.incidents = incidents;
    /** Card ids the player has physically pulled. */
    this.pulled = new Set();
    /** Which drawer the player currently has open, for the room state. */
    this.openDrawer = null;
  }

  /* ---------------- the card index ---------------- */

  /**
   * Paper search. Matches a surname, a road, or a service number, and
   * nothing else -- no scoring, no partial credit. The index is a box of
   * cards in somebody's handwriting.
   */
  find(query) {
    const q = norm(query);
    if (q.length < 3) return [];
    return this.cards.filter((c) => (
      norm(c.name).includes(q)
      || norm(c.address).includes(q)
      || norm(c.service).includes(q)
      || (c.aliases || []).some((a) => norm(a).includes(q))
    ));
  }

  get(id) { return this.cards.find((c) => c.id === id) || null; }

  /** Pull a card out of the drawer. This is what makes it count. */
  pull(id) {
    const card = this.get(id);
    if (!card) return null;
    this.pulled.add(id);
    if (this.state) {
      this.state.set(`card:${id}`, true);
      this.state.bump('cards_pulled');
      if (card.confirms) this.state.set(card.confirms, true);
    }
    if (this.state && this.clock) {
      this.state.log(this.clock.stamp(), `Records: pulled ${card.service} — ${card.name}.`,
        card.anomalous ? 'anomaly' : 'note');
    }
    bus.emit(EVENTS.ARCHIVE, { card });
    return card;
  }

  wasPulled(id) { return this.pulled.has(id); }

  /* ---------------- the shelves ---------------- */

  /** Outage ledgers, one volume per period. */
  ledger(year) {
    return this.ledgers.filter((l) => l.year === year);
  }

  /** The incident file. Unlocks a page at a time as the night earns them. */
  incidentPages() {
    return this.incidents.filter((i) => !i.requires || this.state.hasAll(i.requires));
  }

  readIncident(id) {
    const page = this.incidents.find((i) => i.id === id);
    if (!page) return null;
    this.state.set(`incident:${id}`, true);
    if (page.flag) this.state.set(page.flag, true);
    this.state.bump('incident_pages');
    if (this.clock) this.state.log(this.clock.stamp(), `Records: ${page.title}`, 'anomaly');
    bus.emit(EVENTS.ARCHIVE, { incident: page });
    return page;
  }

  /** How much of the 1978 file the player has put together. */
  get investigation() {
    const total = this.incidents.length || 1;
    const read = this.incidents.filter((i) => this.state.has(`incident:${i.id}`)).length;
    return { read, total, fraction: read / total };
  }

  serialize() {
    return { pulled: [...this.pulled], openDrawer: this.openDrawer };
  }
  restore(d) {
    if (!d) return;
    this.pulled = new Set(d.pulled || []);
    this.openDrawer = d.openDrawer || null;
  }
}
