/* ============================================================
   terminal.js -- the dispatch terminal on the CRT.

   Drawn to an offscreen canvas which is (a) the emissive texture
   on the monitor's screen mesh, so the tube genuinely lights the
   room, and (b) blitted full-size into a DOM canvas when the
   player leans in to read it. One canvas, two presentations,
   one source of truth.

   The software it is running is deliberately of its time: an
   amber character-cell application driven by function keys, with
   a status line, a command line, and no mouse. It is called
   CIS -- Customer Information System -- because that is what
   every utility in America called theirs.

   It is also the thing the horror damages. `glitch()` corrupts
   the render for a few seconds; `markStale()` makes it redraw
   what the database now says, which is how the player finds out
   a record changed while they were on the phone.
   ============================================================ */
import { STATUS } from '../game/outages.js';
import { CREW_STATUS } from '../game/crews.js';
import { drawTerritory } from '../world/signage.js';
import { bus, EVENTS } from '../engine/bus.js';

const W = 720, H = 540;                 // 4:3, character grid below
const COLS = 80, ROWS = 30;
const CH = Math.floor(W / COLS);        // 9px cell
const CV = Math.floor(H / ROWS);        // 18px cell

const AMBER = '#ffb641';
const AMBER_DIM = '#a86f1e';
const AMBER_BRIGHT = '#ffe0a8';
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

export class Terminal {
  constructor(systems) {
    this.sys = systems;              // { database, outages, crews, dispatcher, clock, state, audio, world }
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');

    this.screen = SCREENS.MENU;
    this.powered = true;
    this.dirty = true;
    this.focused = false;

    this.input = '';
    this.cursor = 0;                 // list selection
    this.scroll = 0;
    this.results = [];
    this.record = null;              // open account
    this.ticket = null;              // open outage
    this.message = '';
    this.messageUntil = 0;

    this._glitch = 0;
    this._glitchUntil = 0;
    this._blink = 0;
    this._draftTicket = null;

    // Anything that changes what the screen should say marks it dirty.
    for (const ev of [EVENTS.OUTAGE_NEW, EVENTS.OUTAGE_UPDATE, EVENTS.OUTAGE_RESTORED,
      EVENTS.DISPATCHED, EVENTS.CREW_STATUS, EVENTS.MINUTE]) {
      bus.on(ev, () => { this.dirty = true; });
    }
  }

  /* ---------------- external control ---------------- */
  setPower(on) { this.powered = on; this.dirty = true; }
  markStale() { this.dirty = true; }
  glitch(severity = 0.6, duration = 2.5) {
    this._glitch = severity;
    this._glitchUntil = performance.now() / 1000 + duration;
    this.dirty = true;
  }
  toast(text, seconds = 3) {
    this.message = text;
    this.messageUntil = performance.now() / 1000 + seconds;
    this.dirty = true;
  }

  go(screen) {
    this.screen = screen;
    this.cursor = 0;
    this.scroll = 0;
    this.input = '';
    this.dirty = true;
    bus.emit(EVENTS.TERMINAL_SCREEN, { screen });
    if (this.sys.audio) this.sys.audio.play('keyClack');
  }

  /* ============================================================
     INPUT
     Function keys switch screens; everything else is contextual.
     ============================================================ */
  handleKey(e) {
    if (!this.powered) return false;
    const k = e.key;
    this.dirty = true;
    if (this.sys.audio) this.sys.audio.play('keyClack', { volume: 0.5 });

    // global screen switches
    const fkeys = { F1: SCREENS.MENU, F2: SCREENS.ACCOUNT, F3: SCREENS.OUTAGE, F4: SCREENS.MAP, F5: SCREENS.DISPATCH, F6: SCREENS.LOG };
    if (fkeys[k]) { this.go(fkeys[k]); return true; }

    if (k === 'Escape') {
      if (this.record) { this.record = null; return true; }
      if (this.ticket) { this.ticket = null; return true; }
      if (this._draftTicket) { this._draftTicket = null; return true; }
      this.go(SCREENS.MENU);
      return true;
    }

    switch (this.screen) {
      case SCREENS.MENU: return this._keyMenu(k);
      case SCREENS.ACCOUNT: return this._keyAccount(k);
      case SCREENS.OUTAGE: return this._keyOutage(k);
      case SCREENS.DISPATCH: return this._keyDispatch(k);
      case SCREENS.MAP: return this._keyMap(k);
      case SCREENS.LOG: return this._keyLog(k);
      default: return false;
    }
  }

  _typing(k) {
    if (k === 'Backspace') { this.input = this.input.slice(0, -1); return true; }
    if (k.length === 1 && /[\w\s\-.,#]/.test(k)) { this.input = (this.input + k).toUpperCase().slice(0, 40); return true; }
    return false;
  }

  _keyMenu(k) {
    const map = { 1: SCREENS.ACCOUNT, 2: SCREENS.OUTAGE, 3: SCREENS.MAP, 4: SCREENS.DISPATCH, 5: SCREENS.LOG };
    if (map[k]) { this.go(map[k]); return true; }
    return false;
  }

  _keyAccount(k) {
    if (this.record) {
      if (k === 'n' || k === 'N') { this._startTicketFrom(this.record); return true; }
      return false;
    }
    if (k === 'Enter') {
      this.results = this.sys.database.search(this.input);
      this.cursor = 0;
      if (!this.results.length) this.toast('NO RECORDS MATCH');
      return true;
    }
    if (k === 'ArrowDown') { this.cursor = Math.min(this.results.length - 1, this.cursor + 1); return true; }
    if (k === 'ArrowUp') { this.cursor = Math.max(0, this.cursor - 1); return true; }
    if ((k === 'Tab' || k === ' ') && this.results.length) {
      this.record = this.results[this.cursor];
      this.sys.database.markLookedUp(this.record.id);
      this.sys.state.set('used_terminal_lookup', true);
      return true;
    }
    return this._typing(k);
  }

  _startTicketFrom(record) {
    this._draftTicket = {
      address: record.address, town: record.town, feeder: record.feeder,
      cause: 'UNKNOWN', customers: 1, hazard: false, account: record.id,
    };
    this.record = null;
    this.go(SCREENS.OUTAGE);
    this.toast('NEW TICKET - SELECT CAUSE, THEN ENTER');
  }

  _keyOutage(k) {
    const draft = this._draftTicket;
    if (draft) {
      const causes = ['UNKNOWN', 'FUSE', 'TREE ON LINE', 'SERVICE DROP', 'WIRE DOWN', 'BROKEN POLE', 'TRANSFORMER'];
      const i = causes.indexOf(draft.cause);
      if (k === 'ArrowDown') { draft.cause = causes[Math.min(causes.length - 1, i + 1)]; return true; }
      if (k === 'ArrowUp') { draft.cause = causes[Math.max(0, i - 1)]; return true; }
      if (k === 'h' || k === 'H') { draft.hazard = !draft.hazard; return true; }
      if (k === 'Enter') {
        const t = this.sys.outages.create({
          feeder: draft.feeder, address: draft.address, town: draft.town,
          cause: draft.cause, hazard: draft.hazard,
          priority: draft.hazard ? 1 : 3,
          reportedBy: 'DISPATCH', stamp: this.sys.clock.stamp(),
        });
        this.sys.state.log(this.sys.clock.stamp(), `${t.id} opened: ${t.address || t.feeder} (${t.cause})`, 'ticket');
        this.sys.state.set('created_a_ticket', true);
        this._draftTicket = null;
        this.toast(`${t.id} OPENED`);
        return true;
      }
      return false;
    }

    const list = this.sys.outages.open;
    if (k === 'ArrowDown') { this.cursor = Math.min(list.length - 1, this.cursor + 1); return true; }
    if (k === 'ArrowUp') { this.cursor = Math.max(0, this.cursor - 1); return true; }
    if (k === 'Enter' && list[this.cursor]) {
      this.ticket = list[this.cursor];
      this.go(SCREENS.DISPATCH);
      this.ticket = list[this.cursor];   // go() does not clear this
      return true;
    }
    if (k === 'n' || k === 'N') {
      this._draftTicket = { address: '', town: '', feeder: 'MH-11', cause: 'UNKNOWN', customers: 1, hazard: false };
      this.toast('NEW TICKET - ARROWS SET CAUSE, H HAZARD, ENTER TO OPEN');
      return true;
    }
    return false;
  }

  _keyDispatch(k) {
    const ticket = this.ticket || this.sys.outages.unassigned()[0] || null;
    if (!ticket) return false;
    const recs = this.sys.dispatcher.recommend(ticket.id);
    if (k === 'ArrowDown') { this.cursor = Math.min(recs.length - 1, this.cursor + 1); return true; }
    if (k === 'ArrowUp') { this.cursor = Math.max(0, this.cursor - 1); return true; }
    if (k === 'Enter') {
      const pick = recs[this.cursor];
      if (!pick) return true;
      if (!pick.free) { this.toast(`${pick.crew.id} IS NOT AVAILABLE`); return true; }
      const res = this.sys.dispatcher.send(pick.crew.id, ticket.id);
      this.toast(res.ok ? `${pick.crew.id} DISPATCHED - ETA ${res.eta} MIN` : res.reason);
      if (res.ok) { this.ticket = null; this.cursor = 0; }
      return true;
    }
    if (k === 'Tab') {
      const un = this.sys.outages.unassigned();
      if (un.length) {
        const i = un.indexOf(ticket);
        this.ticket = un[(i + 1) % un.length];
        this.cursor = 0;
      }
      return true;
    }
    return false;
  }

  _keyMap() { return false; }

  _keyLog(k) {
    const n = this.sys.state.shiftLog.length;
    if (k === 'ArrowDown') { this.scroll = Math.min(Math.max(0, n - 22), this.scroll + 1); return true; }
    if (k === 'ArrowUp') { this.scroll = Math.max(0, this.scroll - 1); return true; }
    return false;
  }

  /* ============================================================
     DRAWING
     ============================================================ */
  update(dt) {
    this._blink += dt;
    const now = performance.now() / 1000;
    if (this._glitch && now > this._glitchUntil) { this._glitch = 0; this.dirty = true; }
    if (this.message && now > this.messageUntil) { this.message = ''; this.dirty = true; }
    // The cursor blinks, so the screen is never truly static.
    if (this._blink > 0.5) { this._blink = 0; this.dirty = true; }
    if (this.dirty || this._glitch) { this.draw(); this.dirty = false; }
  }

  /* text helpers: everything is placed on the character grid */
  _t(col, row, text, color = AMBER) {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillText(String(text), col * CH + 4, row * CV + CV - 5);
  }
  _bar(row, text, color = BG, bg = AMBER) {
    const c = this.ctx;
    c.fillStyle = bg;
    c.fillRect(0, row * CV, W, CV);
    c.fillStyle = color;
    c.fillText(text, 4, row * CV + CV - 5);
  }
  _rule(row, color = AMBER_DIM) {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(4, row * CV + CV - 8, W - 8, 1);
  }

  draw() {
    const c = this.ctx;
    c.fillStyle = BG;
    c.fillRect(0, 0, W, H);

    if (!this.powered) {
      // A dead tube is not black: it holds a little charge for a moment.
      c.fillStyle = '#1a0f05';
      c.fillRect(0, H / 2 - 1, W, 2);
      this._scanlines();
      return;
    }

    c.font = `${CV - 5}px ui-monospace, "DejaVu Sans Mono", "Courier New", monospace`;
    c.textBaseline = 'alphabetic';

    const clock = this.sys.clock;
    const head = `WCP&L  CUSTOMER INFORMATION SYSTEM        ${clock.stamp(clock.displayMinutes)}  TERM 1`;
    this._bar(0, head.padEnd(COLS).slice(0, COLS));

    switch (this.screen) {
      case SCREENS.MENU: this._drawMenu(); break;
      case SCREENS.ACCOUNT: this._drawAccount(); break;
      case SCREENS.OUTAGE: this._drawOutage(); break;
      case SCREENS.MAP: this._drawMap(); break;
      case SCREENS.DISPATCH: this._drawDispatch(); break;
      case SCREENS.LOG: this._drawLog(); break;
      default: break;
    }

    // status line
    const open = this.sys.outages.open.length;
    const out = this.sys.outages.customersOut();
    const status = ` F1 MENU  F2 ACCT  F3 OUTG  F4 MAP  F5 DISP  F6 LOG `;
    this._bar(ROWS - 1, status.padEnd(COLS - 22).slice(0, COLS - 22) + `TR:${String(open).padStart(2)} MTRS:${String(out).padStart(5)}`);

    if (this.message) this._t(1, ROWS - 2, `* ${this.message}`, AMBER_BRIGHT);

    this._scanlines();
    if (this._glitch) this._corrupt();
  }

  _drawMenu() {
    const s = this.sys.state;
    this._t(2, 3, 'DISTRICT OPERATIONS - MARROW HILL', AMBER_BRIGHT);
    this._rule(4);
    const items = [
      ['1', 'CUSTOMER ACCOUNT INQUIRY', 'search by account, name, telephone or address'],
      ['2', 'TROUBLE TICKET FILE', 'open, review and create outage reports'],
      ['3', 'SERVICE AREA DISPLAY', 'distribution map with current trouble'],
      ['4', 'UNIT ASSIGNMENT', 'dispatch field crews'],
      ['5', 'SHIFT LOG', 'this terminal, this shift'],
    ];
    items.forEach(([key, name, desc], i) => {
      this._t(4, 6 + i * 3, `[${key}]  ${name}`, AMBER);
      this._t(9, 7 + i * 3, desc, AMBER_DIM);
    });
    this._rule(ROWS - 5);
    this._t(2, ROWS - 4, `OPERATOR: OVERNIGHT DESK        SHIFT BEGAN 2245`, AMBER_DIM);
    this._t(2, ROWS - 3, `TICKETS OPEN: ${this.sys.outages.open.length}   CREWS OUT: ${this.sys.crews.dispatchedCount()}`, AMBER_DIM);
  }

  _drawAccount() {
    if (this.record) return this._drawRecord(this.record);
    this._t(2, 2, 'CUSTOMER ACCOUNT INQUIRY', AMBER_BRIGHT);
    this._rule(3);
    this._t(2, 5, 'SEARCH:', AMBER_DIM);
    const cursor = this._blink < 0.25 ? '_' : ' ';
    this._t(10, 5, this.input + cursor, AMBER_BRIGHT);
    this._t(2, 6, 'account no / name / telephone / street / circuit', AMBER_DIM);
    this._rule(7);

    if (!this.results.length) {
      this._t(2, 9, 'ENTER A QUERY AND PRESS RETURN.', AMBER_DIM);
      this._t(2, 11, 'EXAMPLES:', AMBER_DIM);
      this._t(4, 12, 'DALEY          555-0203        WH-40988', AMBER_DIM);
      this._t(4, 13, 'ORCHARD        MH-11           MARROW HILL', AMBER_DIM);
      return;
    }
    this._t(2, 8, 'ACCT NO'.padEnd(12) + 'NAME'.padEnd(26) + 'SERVICE ADDRESS'.padEnd(22) + 'CKT', AMBER_DIM);
    this.results.slice(0, 16).forEach((r, i) => {
      const sel = i === this.cursor;
      const color = r.flagged ? RED : (sel ? AMBER_BRIGHT : AMBER);
      const row = `${sel ? '>' : ' '}${r.id.padEnd(11)}${r.name.slice(0, 25).padEnd(26)}${r.address.slice(0, 21).padEnd(22)}${r.feeder}`;
      this._t(1, 9 + i, row, color);
    });
    this._t(2, ROWS - 3, 'ARROWS SELECT   SPACE OPEN RECORD', AMBER_DIM);
  }

  _drawRecord(r) {
    this._t(2, 2, `ACCOUNT ${r.id}`, AMBER_BRIGHT);
    this._rule(3);
    const f = (label, value, color = AMBER) => value;
    const rows = [
      ['NAME', r.name],
      ['SERVICE ADDRESS', r.address],
      ['TOWN', r.town],
      ['TELEPHONE', r.phone || '—'],
      ['CIRCUIT', r.feeder],
      ['METER', r.meter || '—'],
      ['SERVICE SINCE', r.since],
      ['RATE', r.rate],
      ['STATUS', r.status],
    ];
    rows.forEach(([k, v], i) => {
      this._t(3, 5 + i, k.padEnd(18), AMBER_DIM);
      this._t(22, 5 + i, v, r.flagged && (k === 'SERVICE SINCE' || k === 'NAME') ? RED : AMBER);
    });
    this._rule(15);
    this._t(3, 16, 'ACCOUNT NOTES', AMBER_DIM);
    const notes = (r.notes || '(none)').match(/.{1,64}/g) || ['(none)'];
    notes.slice(0, 4).forEach((n, i) => {
      this._t(3, 17 + i, n, /MEDICAL|PRIORITY/.test(n) ? RED : AMBER);
    });
    if (r.duplicate) this._t(3, 22, '** DUPLICATE RECORD - SEE FILE **', RED);
    this._t(2, ROWS - 3, 'ESC BACK    N  OPEN TROUBLE TICKET FOR THIS ACCOUNT', AMBER_DIM);
  }

  _drawOutage() {
    if (this._draftTicket) return this._drawDraft();
    this._t(2, 2, 'TROUBLE TICKET FILE', AMBER_BRIGHT);
    this._rule(3);
    const list = this.sys.outages.open;
    this._t(1, 4, ' TICKET   CKT     ADDRESS'.padEnd(46) + 'CAUSE'.padEnd(15) + 'MTRS  STATUS', AMBER_DIM);
    if (!list.length) {
      this._t(3, 6, 'NO OPEN TICKETS.', AMBER_DIM);
      this._t(3, 8, 'N   OPEN A NEW TICKET', AMBER_DIM);
      return;
    }
    list.slice(this.scroll, this.scroll + 18).forEach((t, i) => {
      const sel = i + this.scroll === this.cursor;
      const color = t.hazard ? RED : (sel ? AMBER_BRIGHT : AMBER);
      const addr = (t.address || t.town || '—').slice(0, 34);
      const row = `${sel ? '>' : ' '}${t.id.padEnd(9)}${t.feeder.padEnd(8)}${addr.padEnd(36)}${t.cause.slice(0, 14).padEnd(15)}${String(t.customers).padStart(4)}  ${t.status}`;
      this._t(1, 5 + i, row, color);
      if (t.hazard) this._t(0, 5 + i, '!', RED);
    });
    this._t(2, ROWS - 3, 'ARROWS SELECT   RETURN ASSIGN A UNIT   N NEW TICKET', AMBER_DIM);
  }

  _drawDraft() {
    const d = this._draftTicket;
    this._t(2, 2, 'NEW TROUBLE TICKET', AMBER_BRIGHT);
    this._rule(3);
    const rows = [
      ['SERVICE ADDRESS', d.address || '(not set)'],
      ['TOWN', d.town || '(not set)'],
      ['CIRCUIT', d.feeder],
      ['ACCOUNT', d.account || '—'],
    ];
    rows.forEach(([k, v], i) => {
      this._t(3, 5 + i, k.padEnd(18), AMBER_DIM);
      this._t(22, 5 + i, v);
    });
    this._t(3, 11, 'CAUSE', AMBER_DIM);
    this._t(22, 11, d.cause, AMBER_BRIGHT);
    this._t(3, 13, 'HAZARD', AMBER_DIM);
    this._t(22, 13, d.hazard ? 'YES - WIRE DOWN / PUBLIC DANGER' : 'NO', d.hazard ? RED : AMBER);
    this._rule(15);
    this._t(3, 16, 'ARROWS   CHANGE CAUSE', AMBER_DIM);
    this._t(3, 17, 'H        TOGGLE HAZARD', AMBER_DIM);
    this._t(3, 18, 'RETURN   OPEN TICKET', AMBER_DIM);
    this._t(3, 19, 'ESC      CANCEL', AMBER_DIM);
  }

  _drawMap() {
    const c = this.ctx;
    this._t(2, 2, 'SERVICE AREA DISPLAY', AMBER_BRIGHT);
    const affected = this.sys.outages.affectedFeeders();
    // The map is drawn in phosphor green, like a real plotting display.
    c.save();
    c.translate(30, CV * 3);
    drawTerritory(c, W - 60, H - CV * 6, { style: 'crt', outages: affected });
    c.restore();
    // Any circuit the world says exists but the company does not.
    const ghosts = (this.sys.world && this.sys.world.ghostFeeders) || [];
    if (ghosts.length) {
      this._t(2, ROWS - 4, `UNRECOGNIZED CIRCUIT ID ON DISPLAY: ${ghosts.join(', ')}`, RED);
    }
    this._t(2, ROWS - 3, `CIRCUITS WITH TROUBLE: ${affected.size}   METERS OUT: ${this.sys.outages.customersOut()}`, AMBER_DIM);
  }

  _drawDispatch() {
    const ticket = this.ticket || this.sys.outages.unassigned()[0] || null;
    this._t(2, 2, 'UNIT ASSIGNMENT', AMBER_BRIGHT);
    this._rule(3);
    if (!ticket) {
      this._t(3, 6, 'NO UNASSIGNED TICKETS.', AMBER_DIM);
      this._drawCrewRoster(9);
      return;
    }
    this._t(3, 5, 'TICKET', AMBER_DIM); this._t(14, 5, `${ticket.id}  ${ticket.feeder}`, AMBER_BRIGHT);
    this._t(3, 6, 'LOCATION', AMBER_DIM); this._t(14, 6, `${ticket.address || '—'} ${ticket.town || ''}`);
    this._t(3, 7, 'CAUSE', AMBER_DIM); this._t(14, 7, ticket.cause, ticket.hazard ? RED : AMBER);
    if (ticket.hazard) this._t(40, 7, '** HAZARD **', RED);
    this._rule(9);

    const recs = this.sys.dispatcher.recommend(ticket.id);
    this._t(1, 10, ' UNIT   LEAD        ETA   NOTE', AMBER_DIM);
    recs.forEach((r, i) => {
      const sel = i === this.cursor;
      const color = !r.free ? AMBER_DIM : (r.qualified ? (sel ? AMBER_BRIGHT : AMBER) : RED);
      const row = `${sel ? '>' : ' '}${r.crew.id.padEnd(7)}${r.crew.lead.padEnd(12)}${String(r.eta).padStart(3)}m  ${r.note}`;
      this._t(1, 11 + i, row, color);
    });
    this._t(2, ROWS - 4, 'TAB NEXT TICKET   ARROWS SELECT UNIT   RETURN DISPATCH', AMBER_DIM);
  }

  _drawCrewRoster(startRow) {
    this._t(1, startRow, ' UNIT   LEAD        STATUS            ON', AMBER_DIM);
    this.sys.crews.crews.forEach((c, i) => {
      const color = c.status === CREW_STATUS.AVAILABLE ? GREEN : c.status === CREW_STATUS.ASLEEP ? AMBER_DIM : AMBER;
      this._t(1, startRow + 1 + i, ` ${c.id.padEnd(7)}${c.lead.padEnd(12)}${c.status.padEnd(18)}${c.ticket || '—'}`, color);
    });
  }

  _drawLog() {
    this._t(2, 2, 'SHIFT LOG', AMBER_BRIGHT);
    this._rule(3);
    const log = this.sys.state.shiftLog;
    if (!log.length) { this._t(3, 5, 'NOTHING LOGGED YET.', AMBER_DIM); return; }
    const view = log.slice(Math.max(0, log.length - 22 - this.scroll), log.length - this.scroll);
    view.forEach((e, i) => {
      const color = e.kind === 'anomaly' ? RED : e.kind === 'warn' ? RED : e.kind === 'priority' ? AMBER_BRIGHT : AMBER;
      this._t(2, 4 + i, `${(e.stamp || '----').padEnd(6)}${e.text.slice(0, 68)}`, color);
    });
    this._t(2, ROWS - 3, 'ARROWS SCROLL', AMBER_DIM);
  }

  /** Phosphor scanlines, drawn into the texture so the tube reads as a tube
   *  even from across the room. */
  _scanlines() {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    // slight bloom around the edges of the raster
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  /** Tear the raster. Used by the horror director, and only by it. */
  _corrupt() {
    const c = this.ctx;
    const sev = this._glitch;
    const bands = Math.round(3 + sev * 9);
    for (let i = 0; i < bands; i++) {
      const y = Math.random() * H;
      const h = 2 + Math.random() * 22 * sev;
      const dx = (Math.random() - 0.5) * 70 * sev;
      try {
        const slice = c.getImageData(0, y, W, h);
        c.putImageData(slice, dx, y + (Math.random() - 0.5) * 6 * sev);
      } catch { /* tainted canvas cannot happen here, but never take the shift down */ }
    }
    c.fillStyle = `rgba(255,182,65,${0.03 + sev * 0.05})`;
    c.fillRect(0, Math.random() * H, W, 1 + Math.random() * 3);
  }
}
