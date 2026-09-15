/* ============================================================
   terminal.js -- the dispatch terminal.

   ONE state machine, TWO presentations:

     * the TUBE   -- a coarse canvas used as the emissive texture
                     on the monitor in the 3D scene, so the CRT
                     genuinely lights the room. Nobody reads it.
     * the VIEW   -- real DOM, shown when the player leans in.
                     Text scales with the window (cqw units), rows
                     are clickable, selection is obvious.

   Both are generated from the same `screen()` description, so
   they can never disagree about what the terminal is showing.

   The first version drew an 80x30 character grid to a 720x540
   canvas and then stretched that canvas over the screen. Nine
   pixel cells, upscaled and blurry: unreadable, and unclickable.
   Do not go back to that. If a screen needs a new kind of row,
   add it to ROW KINDS below and both renderers pick it up.
   ============================================================ */
import { STATUS } from '../game/outages.js';
import { CREW_STATUS } from '../game/crews.js';
import { drawTerritory } from '../world/signage.js';
import { bus, EVENTS } from '../engine/bus.js';

/* The tube only has to read as "a terminal" from across a room. */
const TUBE_W = 640, TUBE_H = 480;
const TUBE_COLS = 62, TUBE_ROWS = 26;

const AMBER = '#ffb641';
const AMBER_DIM = '#a06c1c';
const AMBER_BRIGHT = '#ffe6b8';
const RED = '#ff5a3c';
const GREEN = '#5ce08a';
const BG = '#120b04';

export const SCREENS = {
  CALL: 'CALL',
  OUTAGE: 'OUTG',
  ACCOUNT: 'ACCT',
  MAP: 'MAP',
  LOG: 'LOG',
};

/* Screens are on the NUMBER row, not the function row: on most laptops F1-F6
   need an Fn chord, which made the terminal unusable without a desktop
   keyboard. F1-F6 still work for anyone who has them, and a pad gets the
   shoulder buttons. */
export const TABS = [
  { key: '1', screen: SCREENS.CALL, label: 'CALL' },
  { key: '2', screen: SCREENS.OUTAGE, label: 'TICKETS' },
  { key: '3', screen: SCREENS.ACCOUNT, label: 'ACCOUNTS' },
  { key: '4', screen: SCREENS.MAP, label: 'MAP' },
  { key: '5', screen: SCREENS.LOG, label: 'LOG' },
];

const CAUSES = ['UNKNOWN', 'FUSE', 'TREE ON LINE', 'SERVICE DROP', 'WIRE DOWN', 'BROKEN POLE', 'TRANSFORMER'];

/* The on-screen keys, for a player who has no keyboard in front of them.
   Four rows of ten, so a d-pad reaches anything in at most five presses, and
   laid out alphabetically rather than QWERTY because this is a 1999 utility
   terminal and because nobody hunts for keys faster on a grid they have to
   learn. The last three cells are space, backspace and search. */
const KEY_COLS = 10;
const KEY_CELLS = [
  ...'ABCDEFGHIJ', ...'KLMNOPQRST', ...'UVWXYZ0123', ...'456789-',
  '␣', '⌫', '↵',
];

/* ---------- ROW KINDS ----------
   head  a section heading
   rule  a horizontal rule
   text  ordinary text
   dim   secondary text
   warn  something the player should not miss
   kv    a label/value pair
   item  a selectable row. `cols` are laid out in columns.
   note  an inline instruction
   gap   vertical space
   map   the territory display (view only; the tube draws its own)
--------------------------------- */
const row = (k, extra = {}) => ({ k, ...extra });

/* Column layouts, in container units. Header rows and their item rows share
   one entry so they can never drift apart -- the first version styled them
   separately and the headings collapsed into "UNITLEADETANOTE". */
const COLS = {
  account: ['12cqw', '22cqw', '1 1 22cqw', '8cqw'],
  /* These have to fit the body's width (about 78cqw once the selection mark
     and the row padding are taken off) or the last column wraps onto its own
     line and the table stops reading as a table. */
  ticket: ['10cqw', '7cqw', '1 1 17cqw', '14cqw', '5cqw', '11cqw'],
  crew: ['7cqw', '13cqw', '7cqw', '1 1 22cqw'],
  roster: ['7cqw', '13cqw', '18cqw', '1 1 12cqw'],
  menu: ['7cqw', '1 1 30cqw'],
  cause: ['1 1 30cqw'],
  log: ['9cqw', '1 1 40cqw'],
};

export class Terminal {
  constructor(systems) {
    this.sys = systems;
    this.canvas = document.createElement('canvas');
    this.canvas.width = TUBE_W;
    this.canvas.height = TUBE_H;
    this.ctx = this.canvas.getContext('2d');

    this.screen = SCREENS.CALL;
    this.powered = true;
    this.dirty = true;
    this.focused = false;

    this.input = '';
    /* The query the visible results belong to. Without this, typing a second
       name and pressing RETURN opened the FIRST result of the PREVIOUS
       search: the results list was non-empty, so RETURN was read as "open the
       selected row" rather than "run this query". */
    this.searched = null;
    /** The on-screen keyboard: open, and which cell is under the cursor. */
    this.keyboard = false;
    this.kbCursor = 0;
    this.cursor = 0;
    this.scroll = 0;
    this.results = [];
    this.record = null;
    this.ticket = null;
    this.draft = null;
    this.message = '';
    this.messageUntil = 0;

    this._glitch = 0;
    this._glitchUntil = 0;
    this._blink = 0;

    for (const ev of [EVENTS.OUTAGE_NEW, EVENTS.OUTAGE_UPDATE, EVENTS.OUTAGE_RESTORED,
      EVENTS.DISPATCHED, EVENTS.CREW_STATUS, EVENTS.MINUTE]) {
      bus.on(ev, () => { this.dirty = true; });
    }
  }

  /* ============================================================
     EXTERNAL CONTROL
     ============================================================ */
  setPower(on) { this.powered = on; this.dirty = true; }
  markStale() { this.dirty = true; }
  glitch(severity = 0.6, duration = 2.5) {
    this._glitch = severity;
    this._glitchUntil = performance.now() / 1000 + duration;
    this.dirty = true;
  }
  toast(text, seconds = 3.5) {
    this.message = text;
    this.messageUntil = performance.now() / 1000 + seconds;
    this.dirty = true;
  }

  /** Switch screens. `keep` preserves the open ticket (dispatch needs it). */
  go(screen, keep = false) {
    this.screen = screen;
    this.cursor = 0;
    this.scroll = 0;
    this.input = '';
    this.record = null;
    if (!keep) this.ticket = null;
    this.draft = null;
    this.dirty = true;
    bus.emit(EVENTS.TERMINAL_SCREEN, { screen });
    if (this.sys.audio) this.sys.audio.play('keyClack');
  }

  /* ============================================================
     SCREEN DESCRIPTIONS
     Each returns { title, rows, keys }. Rows tagged `item` are
     selectable and clickable; `act` names what activating does.
     ============================================================ */
  describe() {
    if (!this.powered) return { title: '', rows: [], keys: [], dead: true };
    switch (this.screen) {
      case SCREENS.CALL: return this._callScreen();
      case SCREENS.ACCOUNT: return this.record ? this._record() : this._accounts();
      case SCREENS.OUTAGE: return this.draft ? this._draft() : this._tickets();
      case SCREENS.MAP: return this._map();
      case SCREENS.LOG: return this._log();
      default: return { title: '', rows: [], keys: [] };
    }
  }

  /**
   * The screen the player is on for most of the night.
   *
   * The old first screen was a MENU: a list of the other screens, which the
   * tab strip above it was already showing. It cost a keypress and taught
   * nothing. This replaces it with the thing the player actually wants the
   * moment a call connects -- who is on the line, and which account that is.
   *
   * The lookup is the terminal's job, not the player's. Typing a name into a
   * search box on every single call was the clerical tax that made the whole
   * desk feel like data entry. What the player still has to do is READ the
   * record (RETURN), because several conversations gate on having read it,
   * and because the anomalies live in the detail rather than in the name.
   */
  _callScreen() {
    const phone = this.sys.phone;
    const line = phone && phone.active;
    const call = line && line.call;

    if (!call) {
      const rows = [
        row('head', { t: 'DISTRICT OPERATIONS — MARROW HILL' }),
        row('rule'),
        row('gap'),
        row('dim', { t: 'NO CALL ON THE LINE.' }),
        row('gap'),
        row('kv', { label: 'TICKETS OPEN', value: String(this.sys.outages.open.length) }),
        row('kv', { label: 'METERS OUT', value: String(this.sys.outages.customersOut()) }),
        row('kv', { label: 'CREWS OUT', value: String(this.sys.crews.dispatchedCount()) }),
        row('kv', { label: 'HELD', value: String(phone ? phone.held.length : 0) }),
      ];
      const log = this.sys.state.shiftLog.slice(-3);
      if (log.length) {
        rows.push(row('gap'), row('rule'), row('head', { t: 'LAST LOGGED' }));
        for (const e of log) rows.push(row('dim', { cw: COLS.log, cols: [e.stamp || '----', e.text] }));
      }
      return { title: 'DISPATCH CONSOLE', rows, keys: [['screens', 'jump to a screen']] };
    }

    const c = call.caller || {};
    const rows = [
      row('kv', { label: 'LINE', value: String((phone.activeLine ?? 0) + 1) }),
      row('kv', { label: 'CALLING', value: c.display || c.name || 'UNKNOWN' }),
      row('kv', { label: 'NUMBER', value: c.number || 'UNAVAILABLE' }),
      row('gap'),
      row('rule'),
    ];

    const match = this._callerRecord();
    if (!match) {
      const internal = /^x/i.test(String(c.number || ''));
      rows.push(row('gap'));
      rows.push(row(internal ? 'dim' : 'warn', {
        t: internal ? 'INTERNAL EXTENSION — NO SUBSCRIBER RECORD.' : 'NO ACCOUNT ON FILE FOR THIS NUMBER.',
      }));
      rows.push(row('note', { t: 'try ACCOUNTS and search by name or street' }));
      return {
        title: 'CALL IN PROGRESS',
        rows,
        keys: [['newTicket', 'open a ticket anyway'], ['screens', 'other screens']],
      };
    }

    const read = this.sys.database.wasLookedUp(match.id);
    rows.push(row('cols', { cw: COLS.account, cols: ['ACCOUNT', 'NAME', 'SERVICE ADDRESS', 'CKT'] }));
    rows.push(row('item', {
      id: `caller:${match.id}`,
      sel: this.cursor === 0,
      cw: COLS.account,
      warn: !!match.flagged,
      cols: [match.id, match.name, match.address || '—', match.feeder],
    }));

    if (!read) {
      rows.push(row('gap'));
      rows.push(row('note', { t: 'RETURN to pull the record' }));
    } else {
      rows.push(row('gap'));
      for (const [label, value, flag] of [
        ['TOWN', match.town || '—'],
        ['METER', match.meter || '—'],
        ['SERVICE SINCE', match.since, match.flagged],
        ['STATUS', match.status],
      ]) rows.push(row('kv', { label, value, warn: !!flag }));
      rows.push(row('rule'), row('head', { t: 'ACCOUNT NOTES' }));
      const note = match.notes || '(none)';
      rows.push(row(/MEDICAL|PRIORITY/.test(note) ? 'warn' : 'text', { t: note }));
      if (match.duplicate) rows.push(row('warn', { t: '** DUPLICATE RECORD — SEE FILE **' }));
    }

    return {
      title: 'CALL IN PROGRESS',
      rows,
      keys: read
        ? [['newTicket', 'open a ticket for this caller'], ['screens', 'other screens']]
        : [['select', 'pull the record'], ['newTicket', 'open a ticket']],
    };
  }

  /** The account the caller's number belongs to, if any. */
  _callerRecord() {
    const line = this.sys.phone && this.sys.phone.active;
    const call = line && line.call;
    const num = call && call.caller && call.caller.number;
    if (!num) return null;
    if (/^x/i.test(String(num))) return null;    // an internal extension
    const digits = String(num).replace(/\D/g, '');
    if (digits.length < 4) return null;
    const hit = this.sys.database.search(num, { limit: 1 });
    return hit && hit.length ? hit[0] : null;
  }

  _accounts() {
    /* The search box is a selectable ROW, not just a field. That is the only
       reason this screen is reachable without a keyboard: a controller lands
       on it, presses A, and gets the on-screen keys. */
    const rows = [
      row('item', {
        id: 'search',
        sel: this.cursor === 0 && !this.keyboard,
        field: true,
        label: 'SEARCH',
        value: this.input,
        cols: ['SEARCH', `${this.input}${this.keyboard ? '' : '_'}`],
        cw: ['12cqw', '1 1 40cqw'],
      }),
    ];
    if (this.keyboard) {
      rows.push(row('grid', { cells: KEY_CELLS, perRow: KEY_COLS, sel: this.kbCursor }));
      rows.push(row('note', { t: 'pick letters, then ↵ to search' }));
    } else {
      rows.push(row('note', { t: 'type a name, a number or a street, then RETURN — or RETURN here for on-screen keys' }));
    }
    rows.push(row('rule'));
    if (!this.results.length) {
      rows.push(row('gap'));
      rows.push(row('dim', { t: 'TRY:' }));
      rows.push(row('dim', { t: '   DALEY          555-0203        WH-40988' }));
      rows.push(row('dim', { t: '   ORCHARD        MH-11           MARROW HILL' }));
    } else {
      rows.push(row('dim', {
        t: this.input !== this.searched
          ? `SHOWING RESULTS FOR "${this.searched}" — RETURN TO SEARCH AGAIN`
          : `${this.results.length} MATCH${this.results.length === 1 ? '' : 'ES'} FOR "${this.searched}"`,
      }));
      rows.push(row('cols', { cw: COLS.account, cols: ['ACCOUNT', 'NAME', 'SERVICE ADDRESS', 'CKT'] }));
      this.results.slice(0, 12).forEach((r, i) => {
        rows.push(row('item', {
          id: `acct:${r.id}`,
          sel: !this.keyboard && this.cursor === i + 1,
          cw: COLS.account,
          warn: !!r.flagged,
          cols: [r.id, r.name, r.address || '—', r.feeder],
        }));
      });
    }
    const pending = this.input && this.input !== this.searched;
    return {
      title: 'CUSTOMER ACCOUNT INQUIRY',
      rows,
      keys: this.keyboard
        ? [['nav', 'move'], ['select', 'press the key'], ['cancel', 'done']]
        : pending
          ? [['select', 'search']]
          : this.results.length
            ? [['nav', 'select'], ['select', 'open record'], [null, 'type to search again']]
            : [['select', 'on-screen keys'], [null, 'or just type']],
    };
  }

  _record() {
    const r = this.record;
    const rows = [row('head', { t: `ACCOUNT ${r.id}` }), row('rule')];
    for (const [label, value, flag] of [
      ['NAME', r.name, r.flagged],
      ['SERVICE ADDRESS', r.address || '—'],
      ['TOWN', r.town || '—'],
      ['TELEPHONE', r.phone || '—'],
      ['CIRCUIT', r.feeder],
      ['METER', r.meter || '—'],
      ['SERVICE SINCE', r.since, r.flagged],
      ['RATE', r.rate],
      ['STATUS', r.status],
    ]) rows.push(row('kv', { label, value, warn: !!flag }));

    rows.push(row('gap'), row('rule'), row('head', { t: 'ACCOUNT NOTES' }));
    const note = r.notes || '(none)';
    rows.push(row(/MEDICAL|PRIORITY/.test(note) ? 'warn' : 'text', { t: note }));
    if (r.duplicate) rows.push(row('warn', { t: '** DUPLICATE RECORD — SEE FILE **' }));

    return {
      title: 'ACCOUNT RECORD',
      rows,
      keys: [['newTicket', 'open a ticket for this account'], ['cancel', 'back to results']],
    };
  }

  /**
   * Tickets, with the units folded in.
   *
   * Assigning a crew used to be a separate screen, which meant the player
   * opened a ticket on one screen, remembered its number, switched, and found
   * it again. Now a ticket opens IN PLACE: RETURN on it drops the unit list
   * underneath it with the reason each unit is or is not suitable, and RETURN
   * on a unit sends it. Two presses, and the ticket you are looking at is the
   * ticket you are assigning.
   */
  _tickets() {
    const list = this.sys.outages.open;
    const rows = [];
    if (!list.length) {
      rows.push(row('gap'));
      rows.push(row('dim', { t: 'NO OPEN TICKETS.' }));
      rows.push(row('gap'));
      rows.push(row('item', { id: 'new', sel: true, cw: COLS.cause, cols: ['>> NEW TROUBLE TICKET'] }));
      rows.push(row('gap'), row('rule'), row('head', { t: 'UNIT STATUS' }));
      rows.push(row('cols', { cw: COLS.roster, cols: ['UNIT', 'LEAD', 'STATUS', 'ON'] }));
      this.cursor = 0;
      for (const c of this.sys.crews.crews) {
        rows.push(row('text', {
          cw: COLS.roster,
          cols: [c.id, c.lead, c.status, c.ticket || '—'],
          tone: c.status === CREW_STATUS.AVAILABLE ? 'good' : 'off',
        }));
      }
      return {
        title: 'TROUBLE TICKET FILE',
        rows,
        keys: [['select', 'new ticket'], ['screens', 'other screens']],
      };
    }

    rows.push(row('item', { id: 'new', cw: COLS.cause, cols: ['>> NEW TROUBLE TICKET'] }));
    rows.push(row('gap'));
    rows.push(row('cols', { cw: COLS.ticket, cols: ['TICKET', 'CKT', 'ADDRESS', 'CAUSE', 'MTRS', 'STATUS'] }));
    for (const t of list.slice(0, 14)) {
      const open = this.ticket === t;
      rows.push(row('item', {
        id: `tkt:${t.id}`,
        cw: COLS.ticket,
        warn: t.hazard,
        cols: [t.id, t.feeder, t.address || t.town || '—', t.cause, String(t.customers), t.status],
      }));
      if (!open) continue;

      // --- the expanded ticket ---
      if (t.hazard) rows.push(row('warn', { t: '** HAZARD — TREAT THE LINE AS ENERGIZED **' }));
      if (t.crew) {
        rows.push(row('kv', { label: 'ASSIGNED', value: `${t.crew} — ${t.status}` }));
        rows.push(row('note', { t: 'RETURN on another unit to reassign' }));
      }
      rows.push(row('cols', { cw: COLS.crew, nest: true, cols: ['UNIT', 'LEAD', 'ETA', 'NOTE'] }));
      for (const r of this.sys.dispatcher.recommend(t.id)) {
        // The NOTE column is the answer to "can I send this unit", so it is
        // the one that carries the colour: green only for a unit that is
        // genuinely ready, never for one that has to be woken up first.
        const tone = !r.free ? 'off' : !r.qualified ? 'bad' : r.note === 'READY' ? 'good' : 'caution';
        rows.push(row('item', {
          id: `crew:${r.crew.id}`,
          nest: true,
          cw: COLS.crew,
          warn: r.free && !r.qualified,
          off: !r.free,
          tone,
          cols: [r.crew.id, r.crew.lead, `${r.eta}m`, r.note],
        }));
      }
      rows.push(row('gap'));
    }

    // Selection is over whatever rows ended up on screen, tickets and units
    // together, so one pair of arrow keys drives the whole page.
    const items = rows.filter((r) => r.k === 'item');
    this.cursor = Math.max(0, Math.min(items.length - 1, this.cursor));
    items.forEach((r, i) => { r.sel = i === this.cursor; });

    const sel = items[this.cursor];
    return {
      title: 'TROUBLE TICKET FILE',
      rows,
      keys: [
        ['nav', 'select'],
        ['select', sel && sel.id.startsWith('crew:') ? 'dispatch this unit' : 'open the ticket'],
        ['newTicket', 'new ticket'],
      ],
    };
  }

  _draft() {
    const d = this.draft;
    const rows = [
      row('kv', { label: 'SERVICE ADDRESS', value: d.address || '(not set)' }),
      row('kv', { label: 'TOWN', value: d.town || '(not set)' }),
      row('kv', { label: 'CIRCUIT', value: d.feeder }),
      row('kv', { label: 'ACCOUNT', value: d.account || '—' }),
      row('gap'),
      row('rule'),
      row('cols', { cw: COLS.cause, cols: ['CAUSE'] }),
    ];
    CAUSES.forEach((c, i) => {
      rows.push(row('item', { id: `cause:${c}`, sel: this.cursor === i, cw: COLS.cause, cols: [c] }));
    });
    rows.push(row('gap'));
    /* Hazard is a ROW, not a key. It used to be H, which a controller has no
       way to press -- and a toggle you can see is better than a toggle you
       have to be told about anyway. */
    rows.push(row('item', {
      id: 'hazard',
      sel: this.cursor === CAUSES.length,
      warn: d.hazard,
      cw: COLS.cause,
      cols: [d.hazard ? '[X] HAZARD — WIRE DOWN / PUBLIC DANGER' : '[ ] HAZARD'],
    }));
    rows.push(row('gap'));
    rows.push(row('item', {
      id: 'commit',
      sel: this.cursor === CAUSES.length + 1,
      cw: COLS.cause,
      cols: ['>> OPEN THIS TICKET'],
    }));
    return {
      title: 'NEW TROUBLE TICKET',
      rows,
      keys: [['nav', 'move'], ['select', 'choose / open'], ['cancel', 'cancel']],
    };
  }

  _map() {
    const affected = this.sys.outages.affectedFeeders();
    const ghosts = (this.sys.world && this.sys.world.ghostFeeders) || [];
    const rows = [row('map', { outages: affected })];
    if (ghosts.length) rows.push(row('warn', { t: `UNRECOGNIZED CIRCUIT ID ON DISPLAY: ${ghosts.join(', ')}` }));
    rows.push(row('kv', { label: 'CIRCUITS OUT', value: String(affected.size) }));
    rows.push(row('kv', { label: 'METERS OUT', value: String(this.sys.outages.customersOut()) }));
    return { title: 'SERVICE AREA DISPLAY', rows, keys: [['screens', 'other screens']] };
  }

  _log() {
    const log = this.sys.state.shiftLog;
    const rows = [];
    if (!log.length) {
      rows.push(row('gap'), row('dim', { t: 'NOTHING LOGGED YET.' }));
    } else {
      const end = Math.max(0, log.length - this.scroll);
      const view = log.slice(Math.max(0, end - 14), end);
      for (const e of view) {
        rows.push(row(e.kind === 'anomaly' || e.kind === 'warn' ? 'warn' : e.kind === 'priority' ? 'bright' : 'text', {
          cw: COLS.log,
          cols: [e.stamp || '----', e.text],
          t: e.kind === 'anomaly' || e.kind === 'warn' ? `${e.stamp || '----'}  ${e.text}` : undefined,
        }));
      }
    }
    return { title: 'SHIFT LOG', rows, keys: [['nav', 'scroll']] };
  }

  /** Shoulder buttons walk the tab strip. */
  stepScreen(delta) {
    const i = TABS.findIndex((t) => t.screen === this.screen);
    const next = TABS[Math.max(0, Math.min(TABS.length - 1, (i < 0 ? 0 : i) + delta))];
    if (next && next.screen !== this.screen) this.go(next.screen);
  }

  /** The selectable rows of the current screen, in order. */
  _items() { return this.describe().rows.filter((r) => r.k === 'item'); }

  /* ============================================================
     INPUT
     ============================================================ */
  handleKey(e) {
    if (!this.powered) return false;
    const k = e.key;
    this.dirty = true;
    if (this.sys.audio) this.sys.audio.play('keyClack', { volume: 0.45 });

    /* Back, one step at a time: an open record, a half-written ticket, an
       expanded ticket, then the screen, then out of the terminal entirely. */
    if (k === 'Escape') {
      if (this.keyboard) { this.keyboard = false; return true; }
      if (this.record) { this.record = null; return true; }
      if (this.draft) { this.draft = null; return true; }
      if (this.screen === SCREENS.OUTAGE && this.ticket) { this.ticket = null; this.cursor = 0; return true; }
      if (this.screen !== SCREENS.CALL) { this.go(SCREENS.CALL); return true; }
      return false;                      // game.js reads this as "step back"
    }

    /* The on-screen keyboard owns the arrows while it is open, and it is the
       only thing in the terminal that needs left and right. */
    if (this.keyboard && this.screen === SCREENS.ACCOUNT) {
      const n = KEY_CELLS.length;
      const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -KEY_COLS, ArrowDown: KEY_COLS }[k];
      if (move !== undefined) {
        this.kbCursor = (this.kbCursor + move + n) % n;
        return true;
      }
      if (k === 'Enter') { this.pressKey(KEY_CELLS[this.kbCursor]); return true; }
      // A real keyboard still works while the on-screen one is up; somebody
      // who reaches for it clearly has one.
      if (k === 'Backspace') { this.type('\b'); return true; }
      if (k.length === 1 && /[A-Za-z0-9\s\-]/.test(k)) { this.type(k); return true; }
      return true;
    }

    const items = this._items();
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      const d = k === 'ArrowDown' ? 1 : -1;
      if (this.screen === SCREENS.LOG) {
        const n = this.sys.state.shiftLog.length;
        this.scroll = Math.max(0, Math.min(Math.max(0, n - 14), this.scroll - d));
      } else if (items.length) {
        this.cursor = Math.max(0, Math.min(items.length - 1, this.cursor + d));
      }
      return true;
    }

    if (k === 'Enter') { this.activate(); return true; }

    const isN = k === 'n' || k === 'N';
    switch (this.screen) {
      case SCREENS.CALL:
        // N is the whole point of this screen: the caller is on the line and
        // their account is already on the glass, so a ticket is one key.
        if (isN) { this._startTicketFrom(this._callerRecord()); return true; }
        return true;
      case SCREENS.ACCOUNT:
        if (this.record) {
          if (isN) { this._startTicketFrom(this.record); return true; }
          return true;
        }
        return this._typing(k);
      case SCREENS.OUTAGE:
        if (this.draft) {
          if (k === 'h' || k === 'H') { this.draft.hazard = !this.draft.hazard; return true; }
          return true;
        }
        if (isN) { this._startTicketFrom(this._callerRecord()); return true; }
        if (k === 'Tab') { this.nextTicket(); return true; }
        return true;
      default:
        return true;
    }
  }

  /* Digits are screen keys now, so the search box does not take them. Names,
     streets and the letter part of an account number all still work, which is
     what people actually type. */
  _typing(k) {
    if (k === 'Backspace') { this.type('\b'); return true; }
    if (k.length === 1 && /[A-Za-z\s\-.,#]/.test(k)) { this.type(k); return true; }
    return true;
  }

  /**
   * One way in for text, whether it came from a keyboard or from the
   * on-screen keys a controller uses.
   *
   * Typing after a completed search starts a NEW query rather than appending
   * to the old one -- the box is a search field, not a document, and the
   * previous version left the player editing "DALEYPRZ".
   */
  type(ch) {
    if (this.searched !== null && this.input === this.searched && ch !== '\b') {
      this.input = '';
      this.results = [];
      this.searched = null;
      this.cursor = 0;
    }
    if (ch === '\b') this.input = this.input.slice(0, -1);
    else this.input = (this.input + ch).toUpperCase().slice(0, 40);
    this.dirty = true;
  }

  /** Open the on-screen keys, from a controller or from a click. */
  openKeyboard(on = true) {
    this.keyboard = on;
    this.kbCursor = 0;
    this.dirty = true;
  }

  /** One cell of the on-screen keyboard. */
  pressKey(cell) {
    if (cell === '␣') this.type(' ');
    else if (cell === '⌫') this.type('\b');
    else if (cell === '↵') { this.keyboard = false; this.runSearch(); }
    else this.type(cell);
    this.dirty = true;
  }

  /** Run whatever is in the box. */
  runSearch() {
    this.results = this.sys.database.search(this.input);
    this.searched = this.input;
    /* Land on the first RESULT, not back on the search box: the search row is
       row zero now, and leaving the cursor there made the next RETURN re-run
       the same query instead of opening what it found. */
    this.cursor = this.results.length ? 1 : 0;
    this.dirty = true;
    if (!this.results.length) this.toast('NO RECORDS MATCH');
    return this.results;
  }

  /** RETURN, or a click on a row. */
  activate(id = null) {
    const items = this._items();
    const item = id ? items.find((r) => r.id === id) : items[this.cursor];
    if (id && item) this.cursor = items.indexOf(item);

    switch (this.screen) {
      case SCREENS.CALL: {
        // Pulling the record is a deliberate act -- several conversations
        // gate on the player having actually read the account -- but it is
        // now one key instead of a screen change and a search.
        const rec = this._callerRecord();
        if (rec) this.openRecord(rec.id, { stay: true });
        return;
      }
      case SCREENS.ACCOUNT: {
        if (this.record) return;
        if (this.keyboard) { this.pressKey(KEY_CELLS[this.kbCursor]); return; }
        if (item && item.id === 'search') {
          // An empty box wants letters; a full one wants running.
          if (this.input && this.input !== this.searched) this.runSearch();
          else this.openKeyboard();
          return;
        }
        // A query that has not been run yet always runs. Only once what is on
        // screen matches what is in the box does RETURN open a row.
        if (this.input !== this.searched || !this.results.length || !item) {
          this.runSearch();
          return;
        }
        this.openRecord(item.id.split(':')[1]);
        return;
      }
      case SCREENS.OUTAGE: {
        if (this.draft) {
          if (!item) { this.commitTicket(); return; }
          if (item.id === 'hazard') {
            this.draft.hazard = !this.draft.hazard;
            this.draft.cause = this.draft.hazard && this.draft.cause === 'UNKNOWN'
              ? 'WIRE DOWN' : this.draft.cause;
            this.dirty = true;
            return;
          }
          if (item.id === 'commit') { this.commitTicket(); return; }
          // A cause row both picks the cause and opens the ticket: choosing
          // one is the decision, and a second confirmation is a keypress that
          // asks nothing.
          this.draft.cause = item.id.split(':')[1];
          this.commitTicket();
          return;
        }
        if (!item) return;
        if (item.id === 'new') { this._startTicketFrom(this._callerRecord()); return; }
        const [kind, id] = item.id.split(':');
        if (kind === 'crew') { this.dispatchTo(id); return; }
        // Opening a ticket drops its units in underneath it; opening the one
        // that is already open closes it again.
        const t = this.sys.outages.byId.get(id) || null;
        this.ticket = this.ticket === t ? null : t;
        this.cursor = this._items().findIndex((r) => r.id === item.id);
        if (this.cursor < 0) this.cursor = 0;
        return;
      }
      default:
    }
  }

  /** Clicking a cause row in the draft form selects it without committing. */
  select(id) {
    const items = this._items();
    const i = items.findIndex((r) => r.id === id);
    if (i >= 0) { this.cursor = i; this.dirty = true; }
    if (this.screen === SCREENS.OUTAGE && this.draft && id.startsWith('cause:')) {
      this.draft.cause = id.split(':')[1];
    }
  }

  /* ---------------- actions ---------------- */
  /** `stay` reads the record without leaving the screen the player is on. */
  openRecord(id, { stay = false } = {}) {
    const r = this.sys.database.get(id);
    if (!r) return;
    if (!stay) this.record = r;
    this.sys.database.markLookedUp(r.id);
    this.sys.state.set('used_terminal_lookup', true);
    this.dirty = true;
  }

  newTicket(from = null) {
    this.draft = from
      ? { address: from.address, town: from.town, feeder: from.feeder, cause: 'UNKNOWN', hazard: false, account: from.id }
      : { address: '', town: '', feeder: 'MH-11', cause: 'UNKNOWN', hazard: false };
    this.cursor = CAUSES.indexOf(this.draft.cause);
    this.dirty = true;
  }
  _startTicketFrom(record) {
    this.record = null;
    this.screen = SCREENS.OUTAGE;
    this.newTicket(record || null);
    this.toast('SELECT A CAUSE, THEN RETURN');
  }

  commitTicket() {
    const d = this.draft;
    if (!d) return;
    const t = this.sys.outages.create({
      feeder: d.feeder, address: d.address, town: d.town,
      cause: d.cause, hazard: d.hazard,
      priority: d.hazard ? 1 : 3,
      reportedBy: 'DISPATCH', stamp: this.sys.clock.stamp(),
    });
    this.sys.state.log(this.sys.clock.stamp(), `${t.id} opened: ${t.address || t.feeder} (${t.cause})`, 'ticket');
    this.sys.state.set('created_a_ticket', true);
    this.draft = null;
    /* Land on the new ticket with its unit list already open AND the best
       unit under the cursor. Writing a ticket and then hunting for it again
       was half the clerical work; so was scrolling to the unit the terminal
       had already worked out. The player still has to press the key, and can
       still send somebody else -- the recommendation is a default, not a
       decision. */
    this.screen = SCREENS.OUTAGE;
    this.ticket = t;
    const items = this._items();
    const firstCrew = items.findIndex((r) => r.id.startsWith('crew:'));
    this.cursor = firstCrew >= 0 ? firstCrew : 0;
    this.toast(`${t.id} OPENED — SELECT A UNIT`);
  }

  dispatchTo(crewId) {
    const ticket = this.ticket || this.sys.outages.unassigned()[0];
    if (!ticket) return;
    const rec = this.sys.dispatcher.recommend(ticket.id).find((r) => r.crew.id === crewId);
    if (rec && !rec.free) { this.toast(`${crewId} IS NOT AVAILABLE`); return; }
    const res = this.sys.dispatcher.send(crewId, ticket.id);
    this.toast(res.ok ? `${crewId} DISPATCHED — ETA ${res.eta} MIN` : res.reason);
    if (res.ok) { this.ticket = null; this.cursor = 0; }
    return res;
  }

  nextTicket() {
    const un = this.sys.outages.unassigned();
    if (!un.length) return;
    const i = un.indexOf(this.ticket);
    this.ticket = un[(i + 1) % un.length];
    this.cursor = 0;
    this.dirty = true;
  }

  /* ============================================================
     THE TUBE
     ============================================================ */
  update(dt) {
    this._blink += dt;
    const now = performance.now() / 1000;
    if (this._glitch && now > this._glitchUntil) { this._glitch = 0; this.dirty = true; }
    if (this.message && now > this.messageUntil) { this.message = ''; this.dirty = true; }
    if (this._blink > 0.5) { this._blink = 0; this.dirty = true; }
    if (this.dirty || this._glitch) { this.drawTube(); this.dirty = false; }
  }

  /** Coarse render for the monitor in the 3D scene. Nobody reads this one. */
  drawTube() {
    const c = this.ctx;
    const CH = TUBE_W / TUBE_COLS, CV = TUBE_H / TUBE_ROWS;
    c.fillStyle = BG;
    c.fillRect(0, 0, TUBE_W, TUBE_H);

    if (!this.powered) {
      c.fillStyle = '#1a0f05';
      c.fillRect(0, TUBE_H / 2 - 1, TUBE_W, 2);
      this._tubeScanlines();
      return;
    }

    const view = this.describe();
    c.font = `${Math.round(CV - 5)}px ui-monospace, "DejaVu Sans Mono", monospace`;
    c.textBaseline = 'alphabetic';

    const clock = this.sys.clock;
    c.fillStyle = AMBER;
    c.fillRect(0, 0, TUBE_W, CV);
    c.fillStyle = BG;
    c.fillText(`WCP&L CIS   ${view.title}`.slice(0, TUBE_COLS - 10).padEnd(TUBE_COLS - 10)
      + clock.stamp(clock.displayMinutes), 4, CV - 5);

    let y = 2;
    const put = (text, color) => {
      if (y >= TUBE_ROWS - 1) return;
      c.fillStyle = color;
      c.fillText(String(text).slice(0, TUBE_COLS), 4, y * CV + CV - 5);
      y++;
    };
    for (const r of view.rows) {
      if (y >= TUBE_ROWS - 1) break;
      switch (r.k) {
        case 'gap': y++; break;
        case 'rule':
          c.fillStyle = AMBER_DIM;
          c.fillRect(4, y * CV + CV - 8, TUBE_W - 8, 1);
          y++;
          break;
        case 'map': {
          c.save();
          c.translate(16, y * CV);
          drawTerritory(c, TUBE_W - 32, (TUBE_ROWS - y - 2) * CV, { style: 'crt', outages: r.outages });
          c.restore();
          y = TUBE_ROWS - 2;
          break;
        }
        case 'head': put(r.t, AMBER_BRIGHT); break;
        case 'dim': case 'note': put(r.t, AMBER_DIM); break;
        case 'warn': put(r.t || `${r.label}: ${r.value}`, RED); break;
        case 'bright': put((r.cols || [r.t]).join('  '), AMBER_BRIGHT); break;
        case 'field': put(`${r.label}: ${r.value}${this._blink < 0.25 ? '_' : ''}`, AMBER_BRIGHT); break;
        case 'kv': put(`${String(r.label).padEnd(18)}${r.value}`, r.warn ? RED : AMBER); break;
        case 'cols': put(r.cols.join('  '), AMBER_DIM); break;
        case 'grid': {
          // The tube is read from across the room, so it shows the keys as
          // plain rows with the selected one marked.
          for (let i = 0; i < r.cells.length; i += r.perRow) {
            const line = r.cells.slice(i, i + r.perRow)
              .map((ch, j) => (i + j === r.sel ? `[${ch}]` : ` ${ch} `)).join('');
            put(line, AMBER);
          }
          break;
        }
        case 'item':
          put(`${r.sel ? '>' : ' '}${r.cols.join('  ')}`,
            r.warn ? RED : r.off ? AMBER_DIM : r.sel ? AMBER_BRIGHT : AMBER);
          break;
        default: put(r.t || (r.cols || []).join('  '), AMBER);
      }
    }

    if (this.message) {
      c.fillStyle = AMBER_BRIGHT;
      c.fillText(`* ${this.message}`.slice(0, TUBE_COLS), 4, (TUBE_ROWS - 1) * CV - 4);
    }
    this._tubeScanlines();
    if (this._glitch) this._corrupt();
  }

  _tubeScanlines() {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < TUBE_H; y += 3) c.fillRect(0, y, TUBE_W, 1);
    const g = c.createRadialGradient(TUBE_W / 2, TUBE_H / 2, TUBE_H * 0.3, TUBE_W / 2, TUBE_H / 2, TUBE_H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, TUBE_W, TUBE_H);
  }

  /** Tear the raster. Used by the horror director, and only by it. */
  _corrupt() {
    const c = this.ctx;
    const sev = this._glitch;
    for (let i = 0, n = Math.round(3 + sev * 9); i < n; i++) {
      const y = Math.random() * TUBE_H;
      const h = 2 + Math.random() * 22 * sev;
      const dx = (Math.random() - 0.5) * 70 * sev;
      try {
        const slice = c.getImageData(0, y, TUBE_W, h);
        c.putImageData(slice, dx, y + (Math.random() - 0.5) * 6 * sev);
      } catch { /* never take the shift down over a glitch */ }
    }
    c.fillStyle = `rgba(255,182,65,${0.03 + sev * 0.05})`;
    c.fillRect(0, Math.random() * TUBE_H, TUBE_W, 1 + Math.random() * 3);
  }
}

export { AMBER, AMBER_DIM, AMBER_BRIGHT, RED, GREEN, BG };
