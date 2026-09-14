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
  MENU: 'MENU',
  ACCOUNT: 'ACCT',
  OUTAGE: 'OUTG',
  MAP: 'MAP',
  DISPATCH: 'DISP',
  LOG: 'LOG',
};

/* Screens are on the NUMBER row, not the function row: on most laptops F1-F6
   need an Fn chord, which made the terminal unusable without a desktop
   keyboard. F1-F6 still work for anyone who has them, and a pad gets the
   shoulder buttons. */
export const TABS = [
  { key: '1', screen: SCREENS.MENU, label: 'MENU' },
  { key: '2', screen: SCREENS.ACCOUNT, label: 'ACCOUNTS' },
  { key: '3', screen: SCREENS.OUTAGE, label: 'TICKETS' },
  { key: '4', screen: SCREENS.MAP, label: 'MAP' },
  { key: '5', screen: SCREENS.DISPATCH, label: 'UNITS' },
  { key: '6', screen: SCREENS.LOG, label: 'LOG' },
];

const CAUSES = ['UNKNOWN', 'FUSE', 'TREE ON LINE', 'SERVICE DROP', 'WIRE DOWN', 'BROKEN POLE', 'TRANSFORMER'];

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
  account: ['13cqw', '24cqw', '1 1 24cqw', '9cqw'],
  ticket: ['11cqw', '8cqw', '1 1 20cqw', '15cqw', '6cqw', '12cqw'],
  crew: ['8cqw', '15cqw', '8cqw', '1 1 24cqw'],
  roster: ['8cqw', '15cqw', '20cqw', '1 1 12cqw'],
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

    this.screen = SCREENS.MENU;
    this.powered = true;
    this.dirty = true;
    this.focused = false;

    this.input = '';
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
      case SCREENS.MENU: return this._menu();
      case SCREENS.ACCOUNT: return this.record ? this._record() : this._accounts();
      case SCREENS.OUTAGE: return this.draft ? this._draft() : this._tickets();
      case SCREENS.MAP: return this._map();
      case SCREENS.DISPATCH: return this._dispatch();
      case SCREENS.LOG: return this._log();
      default: return { title: '', rows: [], keys: [] };
    }
  }

  _menu() {
    const rows = [
      row('head', { t: 'DISTRICT OPERATIONS — MARROW HILL' }),
      row('rule'),
      row('gap'),
    ];
    TABS.slice(1).forEach((tab, i) => {
      rows.push(row('item', {
        id: `menu:${tab.screen}`,
        sel: this.cursor === i,
        cw: COLS.menu,
        cols: [`[${tab.key}]`, tab.label],
        sub: {
          ACCOUNTS: 'search by account, name, telephone or address',
          TICKETS: 'open, review and create outage reports',
          MAP: 'distribution map with current trouble',
          UNITS: 'dispatch field crews',
          LOG: 'this terminal, this shift',
        }[tab.label],
      }));
    });
    rows.push(row('gap'), row('rule'));
    rows.push(row('kv', { label: 'TICKETS OPEN', value: String(this.sys.outages.open.length) }));
    rows.push(row('kv', { label: 'METERS OUT', value: String(this.sys.outages.customersOut()) }));
    rows.push(row('kv', { label: 'CREWS OUT', value: String(this.sys.crews.dispatchedCount()) }));
    return {
      title: 'MAIN MENU',
      rows,
      keys: [['nav', 'select'], ['select', 'open'], ['screens', 'jump to a screen']],
    };
  }

  _accounts() {
    const rows = [
      row('field', { label: 'SEARCH', value: this.input, caret: true }),
      row('note', { t: 'type an account number, a name, a telephone number or a street, then RETURN' }),
      row('rule'),
    ];
    if (!this.results.length) {
      rows.push(row('gap'));
      rows.push(row('dim', { t: 'TRY:' }));
      rows.push(row('dim', { t: '   DALEY          555-0203        WH-40988' }));
      rows.push(row('dim', { t: '   ORCHARD        MH-11           MARROW HILL' }));
    } else {
      rows.push(row('cols', { cw: COLS.account, cols: ['ACCOUNT', 'NAME', 'SERVICE ADDRESS', 'CKT'] }));
      this.results.slice(0, 12).forEach((r, i) => {
        rows.push(row('item', {
          id: `acct:${r.id}`,
          sel: this.cursor === i,
          cw: COLS.account,
          warn: !!r.flagged,
          cols: [r.id, r.name, r.address || '—', r.feeder],
        }));
      });
    }
    return {
      title: 'CUSTOMER ACCOUNT INQUIRY',
      rows,
      keys: this.results.length
        ? [['nav', 'select'], ['select', 'open record'], [null, 'type to search again']]
        : [[null, 'type a name, number or street'], ['select', 'search']],
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

  _tickets() {
    const list = this.sys.outages.open;
    const rows = [];
    if (!list.length) {
      rows.push(row('gap'));
      rows.push(row('dim', { t: 'NO OPEN TICKETS.' }));
      rows.push(row('gap'));
      rows.push(row('note', { t: 'press N to open a new trouble ticket' }));
    } else {
      rows.push(row('cols', { cw: COLS.ticket, cols: ['TICKET', 'CKT', 'ADDRESS', 'CAUSE', 'MTRS', 'STATUS'] }));
      list.slice(0, 14).forEach((t, i) => {
        rows.push(row('item', {
          id: `tkt:${t.id}`,
          sel: this.cursor === i,
          cw: COLS.ticket,
          warn: t.hazard,
          cols: [t.id, t.feeder, t.address || t.town || '—', t.cause, String(t.customers), t.status],
        }));
      });
    }
    return {
      title: 'TROUBLE TICKET FILE',
      rows,
      keys: [['nav', 'select'], ['select', 'assign a unit'], ['newTicket', 'new ticket']],
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
    rows.push(row(d.hazard ? 'warn' : 'kv', {
      label: 'HAZARD', value: d.hazard ? 'YES — WIRE DOWN / PUBLIC DANGER' : 'NO',
      t: d.hazard ? 'HAZARD: YES — WIRE DOWN / PUBLIC DANGER' : undefined,
    }));
    return {
      title: 'NEW TROUBLE TICKET',
      rows,
      keys: [['nav', 'cause'], ['hazard', 'toggle hazard'], ['select', 'open ticket'], ['cancel', 'cancel']],
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

  _dispatch() {
    const ticket = this.ticket || this.sys.outages.unassigned()[0] || null;
    const rows = [];
    if (!ticket) {
      rows.push(row('gap'));
      rows.push(row('dim', { t: 'NO UNASSIGNED TICKETS.' }));
      rows.push(row('gap'), row('rule'), row('head', { t: 'UNIT STATUS' }));
      rows.push(row('cols', { cols: ['UNIT', 'LEAD', 'STATUS', 'ON'] }));
      for (const c of this.sys.crews.crews) {
        rows.push(row('text', {
          cols: [c.id, c.lead, c.status, c.ticket || '—'],
          good: c.status === CREW_STATUS.AVAILABLE,
        }));
      }
      return { title: 'UNIT ASSIGNMENT', rows, keys: [['screens', 'other screens']] };
    }

    rows.push(row('kv', { label: 'TICKET', value: `${ticket.id}   ${ticket.feeder}` }));
    rows.push(row('kv', { label: 'LOCATION', value: `${ticket.address || '—'} ${ticket.town || ''}`.trim() }));
    rows.push(row('kv', { label: 'CAUSE', value: ticket.cause, warn: ticket.hazard }));
    if (ticket.hazard) rows.push(row('warn', { t: '** HAZARD — TREAT THE LINE AS ENERGIZED **' }));
    rows.push(row('gap'), row('rule'));
    rows.push(row('cols', { cw: COLS.crew, cols: ['UNIT', 'LEAD', 'ETA', 'NOTE'] }));

    const recs = this.sys.dispatcher.recommend(ticket.id);
    recs.forEach((r, i) => {
      // The NOTE column is the answer to "can I send this unit", so it is the
      // one that carries the color: green only for a unit that is genuinely
      // ready, never for one that has to be woken up first.
      const tone = !r.free ? 'off' : !r.qualified ? 'bad' : r.note === 'READY' ? 'good' : 'caution';
      rows.push(row('item', {
        id: `crew:${r.crew.id}`,
        sel: this.cursor === i,
        cw: COLS.crew,
        warn: r.free && !r.qualified,
        off: !r.free,
        tone,
        cols: [r.crew.id, r.crew.lead, `${r.eta}m`, r.note],
      }));
    });
    return {
      title: 'UNIT ASSIGNMENT',
      rows,
      keys: [['nav', 'select a unit'], ['select', 'dispatch'], [null, 'TAB for the next ticket']],
    };
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

    if (k === 'Escape') {
      if (this.record) { this.record = null; return true; }
      if (this.draft) { this.draft = null; return true; }
      if (this.screen !== SCREENS.MENU) { this.go(SCREENS.MENU); return true; }
      return false;                      // game.js reads this as "step back"
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

    switch (this.screen) {
      case SCREENS.ACCOUNT:
        if (this.record) {
          if (k === 'n' || k === 'N') { this._startTicketFrom(this.record); return true; }
          return true;
        }
        return this._typing(k);
      case SCREENS.OUTAGE:
        if (this.draft) {
          if (k === 'h' || k === 'H') { this.draft.hazard = !this.draft.hazard; return true; }
          return true;
        }
        if (k === 'n' || k === 'N') { this.newTicket(); return true; }
        return true;
      case SCREENS.DISPATCH:
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
    if (k === 'Backspace') { this.input = this.input.slice(0, -1); return true; }
    if (k.length === 1 && /[A-Za-z\s\-.,#]/.test(k)) {
      this.input = (this.input + k).toUpperCase().slice(0, 40);
      return true;
    }
    return true;
  }

  /** RETURN, or a click on a row. */
  activate(id = null) {
    const items = this._items();
    const item = id ? items.find((r) => r.id === id) : items[this.cursor];
    if (id && item) this.cursor = items.indexOf(item);

    switch (this.screen) {
      case SCREENS.MENU: {
        if (!item) return;
        this.go(item.id.split(':')[1]);
        return;
      }
      case SCREENS.ACCOUNT: {
        if (this.record) return;
        if (!this.results.length || !item) {
          this.results = this.sys.database.search(this.input);
          this.cursor = 0;
          if (!this.results.length) this.toast('NO RECORDS MATCH');
          return;
        }
        this.openRecord(item.id.split(':')[1]);
        return;
      }
      case SCREENS.OUTAGE: {
        if (this.draft) {
          if (item) this.draft.cause = item.id.split(':')[1];
          this.commitTicket();
          return;
        }
        if (!item) return;
        this.ticket = this.sys.outages.byId.get(item.id.split(':')[1]) || null;
        this.go(SCREENS.DISPATCH, true);
        return;
      }
      case SCREENS.DISPATCH: {
        if (!item) return;
        this.dispatchTo(item.id.split(':')[1]);
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
  openRecord(id) {
    const r = this.sys.database.get(id);
    if (!r) return;
    this.record = r;
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
    this.newTicket(record);
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
    this.cursor = 0;
    this.toast(`${t.id} OPENED`);
  }

  dispatchTo(crewId) {
    const ticket = this.ticket || this.sys.outages.unassigned()[0];
    if (!ticket) return;
    const rec = this.sys.dispatcher.recommend(ticket.id).find((r) => r.crew.id === crewId);
    if (rec && !rec.free) { this.toast(`${crewId} IS NOT AVAILABLE`); return; }
    const res = this.sys.dispatcher.send(crewId, ticket.id);
    this.toast(res.ok ? `${crewId} DISPATCHED — ETA ${res.eta} MIN` : res.reason);
    if (res.ok) { this.ticket = null; this.cursor = 0; }
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
