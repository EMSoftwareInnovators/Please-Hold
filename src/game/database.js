/* ============================================================
   database.js -- the customer master file, and what happens to it.

   Two jobs. The ordinary one: let the player search by account,
   name, phone or address, and track WHICH records they have
   actually pulled up -- dialogue choices gate on that, so you
   cannot confirm a service address you never looked at.

   The other job is that this file can be made to lie. `corrupt()`
   damages a record in a specific, reproducible way, and the
   terminal renders the damage rather than hiding it. A record
   that has quietly changed since you read it twenty minutes ago
   is worse than any noise on the line.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';
import { ACCOUNTS } from '../data/accounts.js';
import { STREETS } from '../data/grid.js';

const norm = (s) => String(s || '').toUpperCase().trim();

export class CustomerDatabase {
  constructor() {
    this.records = new Map();
    for (const a of ACCOUNTS) this.records.set(a.id, { ...a });
    this.lookups = new Set();        // accounts the player has actually opened
    this.searches = [];              // every query, for the terminal's history
    this.corruptions = [];
  }

  get all() { return [...this.records.values()]; }
  /** Records the player is allowed to find by ordinary means. */
  get visible() { return this.all.filter((r) => !r.hidden); }

  get(id) { return this.records.get(norm(id)) || null; }

  /** Record that the player opened a record. Dialogue gates read this. */
  markLookedUp(id) {
    if (!id) return;
    this.lookups.add(norm(id));
    bus.emit(EVENTS.LOOKUP, { id: norm(id) });
  }
  wasLookedUp(id) { return this.lookups.has(norm(id)); }

  /**
   * Free-text search across the fields a dispatcher would actually use.
   * Hidden records stay hidden unless `includeHidden` is set, which is how
   * a story beat makes one surface.
   */
  search(query, { includeHidden = false, limit = 12 } = {}) {
    const q = norm(query);
    this.searches.push({ q, at: Date.now() });
    if (!q) return [];
    const pool = includeHidden ? this.all : this.visible;
    const scored = [];
    for (const r of pool) {
      let score = 0;
      if (norm(r.id) === q) score = 100;
      else if (norm(r.id).includes(q)) score = 70;
      else if (norm(r.phone).replace(/\D/g, '') === q.replace(/\D/g, '') && q.replace(/\D/g, '')) score = 90;
      else if (norm(r.name).startsWith(q)) score = 60;
      else if (norm(r.name).includes(q)) score = 45;
      else if (norm(r.address).includes(q)) score = 50;
      else if (norm(r.town).includes(q)) score = 25;
      else if (norm(r.feeder) === q) score = 40;
      if (score) scored.push({ r, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.r);
  }

  /** Does this street exist in the index at all? The suspicious call hinges
   *  on the answer being no. */
  streetExists(address, town) {
    const a = norm(address).replace(/^\d+\s*/, '');
    const list = STREETS[norm(town)] || [];
    if (list.some((s) => a.startsWith(norm(s)))) return true;
    return Object.values(STREETS).some((ls) => ls.some((s) => a.startsWith(norm(s))));
  }

  add(record) {
    if (!record || !record.id) return null;
    const r = { ...record, id: norm(record.id) };
    this.records.set(r.id, r);
    return r;
  }

  patch(id, field, value) {
    const r = this.get(id);
    if (!r) return null;
    r[field] = value;
    return r;
  }

  /**
   * Damage a record on purpose.
   *   'reveal'      -- a hidden record becomes findable
   *   'dateshift'   -- the service date moves to a year that cannot be right
   *   'garble'      -- characters in the name rot into the wrong glyphs
   *   'blank'       -- fields empty out, leaving the shell of a record
   *   'duplicate'   -- a second copy appears with a different service date
   *   'note'        -- a note appears that nobody typed
   */
  corrupt(id, kind, value) {
    const r = this.get(id);
    if (!r) return null;
    this.corruptions.push({ id: norm(id), kind, at: Date.now() });
    switch (kind) {
      case 'reveal':
        r.hidden = false;
        break;
      case 'dateshift':
        r.since = value || '06/1954';
        r.flagged = true;
        break;
      case 'garble':
        r.name = garble(r.name);
        r.flagged = true;
        break;
      case 'blank':
        r.address = ''; r.phone = ''; r.meter = '';
        r.status = '—';
        r.flagged = true;
        break;
      case 'duplicate': {
        const copy = { ...r, id: `${r.id}-A`, since: value || '06/1954', flagged: true, duplicate: true };
        this.records.set(copy.id, copy);
        break;
      }
      case 'note':
        r.notes = value || 'RECORD ACCESSED 0000 - TERMINAL 2';
        r.flagged = true;
        break;
      default:
        break;
    }
    return r;
  }

  serialize() {
    return {
      records: this.all,
      lookups: [...this.lookups],
      corruptions: this.corruptions,
    };
  }
  restore(d) {
    if (!d) return;
    this.records = new Map((d.records || []).map((r) => [r.id, r]));
    this.lookups = new Set(d.lookups || []);
    this.corruptions = d.corruptions || [];
  }
}

/** Swap letters for the wrong-but-adjacent glyphs a bad terminal would show. */
function garble(s) {
  const map = { A: 'Å', E: 'È', I: 'Ì', O: 'Ø', U: 'Ù', S: '5', T: '7', N: 'Ñ' };
  return String(s).split('').map((ch, i) => (i % 3 === 1 && map[ch] ? map[ch] : ch)).join('');
}
