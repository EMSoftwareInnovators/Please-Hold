/* ============================================================
   propui.js -- the things in the building that are not the CRT.

   The breaker panel, the day book, the fax tray, the card index,
   the incident file. Five objects, one interface, for two
   reasons.

   1. The player has already learned one set of keys from the
      terminal -- up, down, select, back. Teaching them a second
      set for the filing cabinet would be worse than useless.
   2. Every one of these is a piece of PAPER or a PANEL that the
      player is standing in front of at arm's length. They are
      not a computer, so this deliberately does not look like
      one: no amber phosphor, no scanlines. It is a document held
      under a work light.

   The terminal is `ui/terminal.js` and stays its own thing. This
   is everything else the player can open.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';
import { label as controlLabel } from '../engine/controls.js';
import { escapeHtml } from './hud.js';

const $ = (id) => document.getElementById(id);

export class PropUI {
  constructor({ input, audio } = {}) {
    this.input = input;
    this.audio = audio;
    this.el = {
      root: $('prop'),
      title: $('prop-title'),
      sub: $('prop-sub'),
      body: $('prop-body'),
      keys: $('prop-keys'),
    };
    this.open = null;          // { id, title, sub, rows, onPick, onClose }
    this.cursor = 0;
    this._sig = '';
    this._wire();
  }

  _wire() {
    if (!this.el.body) return;
    this.el.body.addEventListener('mousemove', (e) => {
      const r = e.target.closest('[data-i]');
      if (!r) return;
      const i = Number(r.dataset.i);
      if (i !== this.cursor) { this.cursor = i; this.render(); }
    });
    this.el.body.addEventListener('click', (e) => {
      const r = e.target.closest('[data-i]');
      if (!r) return;
      this.cursor = Number(r.dataset.i);
      this.pick();
    });
  }

  get visible() { return !!this.open; }

  /**
   * Show one.
   *   rows    [{ kind, text, sub, id, disabled }] -- kind 'item' is pickable
   *   onPick  (row) => void | 'close'
   */
  show(spec) {
    this.open = spec;
    this.cursor = spec.rows.findIndex((r) => r.kind === 'item' && !r.disabled);
    if (this.cursor < 0) this.cursor = 0;
    this.el.root.classList.remove('hidden');
    this._sig = '';
    this.render();
    if (this.audio) this.audio.play(spec.sound || 'paper', { volume: 0.5 });
    bus.emit(EVENTS.TASK, { propOpen: spec.id });
  }

  close() {
    if (!this.open) return;
    const spec = this.open;
    this.open = null;
    this.el.root.classList.add('hidden');
    if (spec.onClose) spec.onClose();
    bus.emit(EVENTS.TASK, { propOpen: null });
  }

  /** Rebuild the rows in place -- used when the underlying thing changes. */
  refresh(rows, sub) {
    if (!this.open) return;
    this.open.rows = rows;
    if (sub != null) this.open.sub = sub;
    if (this.cursor >= rows.length) this.cursor = Math.max(0, rows.length - 1);
    this.render();
  }

  items() { return this.open ? this.open.rows.filter((r) => r.kind === 'item') : []; }

  move(d) {
    if (!this.open) return;
    const rows = this.open.rows;
    if (!rows.length) return;
    /* A service card or a fax page is a DOCUMENT, not a list: its only item
       is "< PUT IT BACK" at the bottom. On one of those, up and down turn
       the page instead of jumping the cursor past everything the player is
       standing there to read. */
    const body = this.el.body;
    if (this.items().length <= 1 && body && body.scrollHeight > body.clientHeight + 2) {
      const before = body.scrollTop;
      body.scrollTop = Math.max(0, Math.min(
        body.scrollHeight - body.clientHeight,
        before + d * body.clientHeight * 0.8,
      ));
      if (body.scrollTop !== before) return;
    }
    let i = this.cursor;
    for (let n = 0; n < rows.length; n++) {
      i = (i + d + rows.length) % rows.length;
      if (rows[i].kind === 'item' && !rows[i].disabled) break;
    }
    this.cursor = i;
    this.render();
  }

  pick() {
    if (!this.open) return;
    const row = this.open.rows[this.cursor];
    if (!row || row.kind !== 'item' || row.disabled) return;
    if (this.audio) this.audio.play('keyClack', { volume: 0.4 });
    const r = this.open.onPick ? this.open.onPick(row) : null;
    if (r === 'close') this.close();
  }

  /** Returns true when it swallowed the key. */
  handleKey(e) {
    if (!this.open) return false;
    const k = e.key;
    if (k === 'ArrowDown') { this.move(1); return true; }
    if (k === 'ArrowUp') { this.move(-1); return true; }
    if (k === 'Enter') { this.pick(); return true; }
    if (k === 'Escape') { this.close(); return true; }
    return true;                     // an open panel eats everything else
  }

  render() {
    if (!this.open) return;
    const spec = this.open;
    this.el.title.textContent = spec.title || '';
    this.el.sub.textContent = spec.sub || '';
    this.el.body.innerHTML = spec.rows.map((r, i) => {
      const sel = i === this.cursor && r.kind === 'item' && !r.disabled;
      switch (r.kind) {
        case 'head': return `<div class="p-head">${escapeHtml(r.text)}</div>`;
        case 'rule': return '<div class="p-rule"></div>';
        case 'gap': return '<div class="p-gap"></div>';
        case 'note': return `<div class="p-note">${escapeHtml(r.text)}</div>`;
        case 'warn': return `<div class="p-warn">${escapeHtml(r.text)}</div>`;
        case 'hand': return `<div class="p-hand${r.other ? ' other' : ''}">${escapeHtml(r.text)}</div>`;
        case 'item':
          return `<div class="p-item${sel ? ' sel' : ''}${r.disabled ? ' off' : ''}" data-i="${i}">`
            + `<span class="mark">&gt;</span><span class="t">${escapeHtml(r.text)}</span>`
            + (r.sub ? `<span class="s">${escapeHtml(r.sub)}</span>` : '')
            + '</div>';
        default:
          /* Cards and faxes are typed documents and their blank lines are
             authored. An empty div collapses to nothing, so a blank line has
             to become a real gap or the layout of the page is lost. */
          if (!r.text) return '<div class="p-gap"></div>';
          return `<div class="p-text">${escapeHtml(r.text)}</div>`;
      }
    }).join('');

    /* A drawer can hold more cards than the sheet is tall, and the cursor is
       driven by a d-pad as often as by a mouse, so it has to bring itself
       into view. */
    const sel = this.el.body.querySelector('.p-item.sel');
    if (sel && sel.scrollIntoView && this.items().length > 1) sel.scrollIntoView({ block: 'nearest' });

    const scheme = this.input ? this.input.scheme : 'kbm';
    const g = (a) => escapeHtml(controlLabel(a, scheme));
    /* On a page that scrolls and has nothing to choose between, say what the
       keys actually do here. */
    const paging = this.items().length <= 1
      && this.el.body.scrollHeight > this.el.body.clientHeight + 2;
    const keys = spec.keys || (paging
      ? [['nav', 'read on'], ['select', 'put it back'], ['cancel', 'step back']]
      : [['nav', 'choose'], ['select', 'take it'], ['cancel', 'step back']]);
    this.el.keys.innerHTML = keys
      .map(([a, what]) => `<span><b>${g(a)}</b>${escapeHtml(what)}</span>`).join('');
  }
}
