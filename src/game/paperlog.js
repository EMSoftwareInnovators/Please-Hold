/* ============================================================
   paperlog.js -- the book on the counter in Records.

   THE TERMINAL LOG holds what the computer believes happened.
   THE PAPER LOG holds what the dispatcher says they saw.

   Those are different things, and the whole late game turns on
   the difference. The terminal can be edited by something that
   is not the player. Paper cannot -- or rather, paper can, and
   when it is, the player is holding the evidence.

   The supervisor gives the instruction in the handover call:
   "If something happens you can't account for, you put it in the
   log with a time on it and you keep answering the phone."
   This is that log. It is deliberately physical: it is a walk
   away from the desk, and the phone can ring while you are
   writing.

   NO TYPING. The player picks from observations that have
   UNLOCKED because they actually witnessed the thing. An entry
   the player has not earned is not on the list, so the book can
   never tell them something they do not already know.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

/**
 * Everything that can be written down.
 *
 *   id        stable key, also the flag that marks it written
 *   text      what goes in the book, in the player's own shorthand
 *   requires  flags that must be set before it appears on the list
 *   weight    how much it counts toward the end-of-shift record
 */
export const OBSERVATIONS = [
  {
    id: 'obs_1956',
    text: 'CALLER STATED YEAR 1956. GAVE ACCT NO. NOT IN CIS.',
    requires: ['pratt1956'],
    weight: 3,
  },
  {
    id: 'obs_keefe',
    text: 'INTERNAL x2240 — R. KEEFE, DISPATCH. CLAIMS 11 NOV 1978.',
    requires: ['keefe_said_1956'],
    weight: 4,
  },
  {
    id: 'obs_clocks',
    text: 'DISPATCH AND CORRIDOR CLOCKS DISAGREE.',
    requires: ['saw_clock_drift'],
    weight: 2,
  },
  {
    id: 'obs_feeder',
    text: 'UNLISTED FEEDER ON SERVICE DISPLAY. NOT ON WALL MAP.',
    requires: ['saw_ghost_feeder'],
    weight: 2,
  },
  {
    id: 'obs_evp',
    text: 'NO CARRIER ON L4. VOICE WARNED AGAINST UNIT 7.',
    requires: ['evpWarning'],
    weight: 3,
  },
  {
    id: 'obs_nogrid',
    text: 'BUILDING POWER FAILURE. NO GRID EVENT ON ANY FEEDER.',
    requires: ['cascade_no_grid_event'],
    weight: 3,
  },
  {
    id: 'obs_chair',
    text: 'CHAIR MOVED AT DISPATCH DESK. I WAS THE ONLY ONE HERE.',
    requires: ['saw_chair_moved'],
    weight: 2,
  },
  {
    id: 'obs_handset',
    text: 'DESK HANDSET OFF HOOK. NO LINE ACTIVE.',
    requires: ['saw_handset_off'],
    weight: 2,
  },
  {
    id: 'obs_1943',
    text: 'CALLER — GAINES, BLACKRIDGE RD. SERVICE CARD DATED 1943.',
    requires: ['gaines_confirmed'],
    weight: 4,
  },
  {
    id: 'obs_1987',
    text: 'CALLER AT 300 COMMERCE — BUSINESS CLOSED 1991.',
    requires: ['halvorsen_confirmed'],
    weight: 3,
  },
  {
    id: 'obs_loop',
    text: 'SAME CALLER, SAME WORDS, THIRD TIME. SHE DOES NOT REMEMBER.',
    requires: ['loop_recognised'],
    weight: 4,
  },
  {
    id: 'obs_fax_future',
    text: 'FAX RECEIVED AHEAD OF ITS OWN TIMESTAMP. OUTAGE OCCURRED AFTER.',
    requires: ['fax_predicted'],
    weight: 4,
  },
  {
    id: 'obs_ticket',
    text: 'TROUBLE TICKET OPEN ON CONSOLE THAT I DID NOT WRITE.',
    requires: ['saw_phantom_ticket'],
    weight: 3,
  },
  {
    id: 'obs_imitation',
    text: 'CALLER USED MRS DALEY’S NUMBER AND VOICE. IT WAS NOT HER.',
    requires: ['imitation_caught'],
    weight: 5,
  },
  {
    id: 'obs_417',
    text: '0417 — EVERY INSTRUMENT IN THE BUILDING RANG AT ONCE.',
    requires: ['four_seventeen_done'],
    weight: 5,
  },
  {
    id: 'obs_knock',
    text: 'KNOCKING AT THE REAR DOOR. NO VEHICLE IN THE LOT.',
    requires: ['heard_the_knock'],
    weight: 3,
  },
];

export class PaperLog {
  constructor({ state, clock, audio } = {}) {
    this.state = state;
    this.clock = clock;
    this.audio = audio;
    /** [{ id, stamp, text, hand }] -- `hand` is whose handwriting it is. */
    this.entries = [];
    /** Set when something else has written in the book. */
    this.defaced = false;
  }

  /** The observations the player has earned and not yet written down. */
  available() {
    return OBSERVATIONS.filter((o) => (
      this.state.hasAll(o.requires) && !this.entries.some((e) => e.id === o.id)
    ));
  }

  written(id) { return this.entries.some((e) => e.id === id); }

  /** Write one down. Returns the entry, or null if it was not available. */
  record(id) {
    const obs = OBSERVATIONS.find((o) => o.id === id);
    if (!obs || !this.state.hasAll(obs.requires) || this.written(id)) return null;
    const entry = {
      id,
      stamp: this.clock ? this.clock.stamp() : '----',
      text: obs.text,
      hand: 'player',
      weight: obs.weight || 1,
    };
    this.entries.push(entry);
    this.state.set(`logged:${id}`, true);
    this.state.bump('paper_entries');
    if (this.audio) this.audio.play('penScratch', { volume: 0.6 });
    this.state.log(entry.stamp, `Paper log: ${obs.text}`, 'note');
    bus.emit(EVENTS.PAPERLOG, { entry, entries: this.entries.length });
    return entry;
  }

  /**
   * Something else writes in the book.
   *
   * Used exactly twice in the night. One impossible physical addition is
   * worth more than ten glitch effects, and the second one is only there
   * because the first has to be confirmed rather than doubted.
   */
  deface(afterId, text) {
    const at = this.entries.findIndex((e) => e.id === afterId);
    const entry = {
      id: `other:${afterId}`,
      stamp: '',
      text,
      hand: 'other',
      weight: 0,
    };
    if (at < 0) this.entries.push(entry);
    else this.entries.splice(at + 1, 0, entry);
    this.defaced = true;
    this.state.set('paperlog_defaced', true);
    bus.emit(EVENTS.PAPERLOG, { entry, defaced: true });
    return entry;
  }

  /** What the end-of-shift report counts. */
  get score() {
    return this.entries.filter((e) => e.hand === 'player')
      .reduce((n, e) => n + (e.weight || 1), 0);
  }

  serialize() { return { entries: this.entries, defaced: this.defaced }; }
  restore(d) {
    if (!d) return;
    this.entries = d.entries || [];
    this.defaced = !!d.defaced;
  }
}
