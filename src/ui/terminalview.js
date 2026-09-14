/* ============================================================
   terminalview.js -- the terminal as real DOM.

   This is what the player actually reads. It renders the same
   `describe()` description the tube canvas does, but as scalable
   text with clickable rows and an unambiguous selection.

   Everything is sized in `cqw` against #cabinet, so the type
   scales with the window instead of being a stretched 9-pixel
   bitmap. That is the entire reason this file exists.
   ============================================================ */
import { TABS } from './terminal.js';
import { drawTerritory } from '../world/signage.js';
import { escapeHtml } from './hud.js';

const $ = (id) => document.getElementById(id);

export class TerminalView {
  constructor(terminal, clock) {
    this.terminal = terminal;
    this.clock = clock;
    this.el = {
      root: $('crt'),
      title: $('crt-title'),
      clock: $('crt-clock'),
      tabs: $('crt-tabs'),
      body: $('crt-body'),
      keys: $('crt-keys'),
      toast: $('crt-toast'),
      alert: $('crt-alert'),
    };
    /** Set by game.js: what the telephone is doing. */
    this.lineAlert = null;
    /** Set by game.js: what a waiting conversation wants the player to do. */
    this.hint = null;
    this.visible = false;
    this._sig = '';
    this._wire();
  }

  _wire() {
    this.el.tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-screen]');
      if (b) this.terminal.go(b.dataset.screen);
    });
    // Hovering moves the selection, clicking activates it -- the same row
    // responds to the mouse and to the arrow keys, so neither feels bolted on.
    this.el.body.addEventListener('mousemove', (e) => {
      const r = e.target.closest('[data-id]');
      if (r) this.terminal.select(r.dataset.id);
    });
    this.el.body.addEventListener('click', (e) => {
      const r = e.target.closest('[data-id]');
      if (r) this.terminal.activate(r.dataset.id);
    });
  }

  show(on) {
    this.visible = on;
    this.el.root.classList.toggle('hidden', !on);
    if (on) { this._sig = ''; this.render(); }
  }

  /** Re-render only when something changed; this runs every frame. */
  update() {
    if (!this.visible) return;
    const t = this.terminal;
    const sig = [
      t.screen, t.cursor, t.scroll, t.input, t.message, t.powered,
      t.record ? t.record.id : '', t.ticket ? t.ticket.id : '',
      t.draft ? `${t.draft.cause}|${t.draft.hazard}` : '',
      t.dirty, this.clock.stamp(this.clock.displayMinutes),
      this.lineAlert ? `${this.lineAlert.kind}${this.lineAlert.text}` : '',
      this.hint || '',
    ].join('~');
    if (sig === this._sig) return;
    this._sig = sig;
    this.render();
  }

  render() {
    const t = this.terminal;
    const view = t.describe();

    this.el.title.textContent = view.dead ? '' : view.title;
    this.el.clock.textContent = t.powered ? this.clock.stamp(this.clock.displayMinutes) : '';
    this.el.alert.textContent = this.lineAlert ? this.lineAlert.text : '';
    this.el.alert.className = this.lineAlert ? this.lineAlert.kind : '';

    this.el.tabs.innerHTML = TABS.map((tab) => (
      `<button data-screen="${tab.screen}" class="${t.screen === tab.screen ? 'on' : ''}">`
      + `<b>${tab.key}</b>${escapeHtml(tab.label)}</button>`
    )).join('');

    if (view.dead) {
      this.el.body.innerHTML = '<div class="t-dead"></div>';
      this.el.keys.innerHTML = '';
      this.el.toast.textContent = '';
      return;
    }

    this.el.body.innerHTML = view.rows.map((r) => this._row(r)).join('');
    this._paintMap(view.rows);

    this.el.keys.innerHTML = (view.keys || []).map(([k, what]) => (
      `<span><b>${escapeHtml(k)}</b>${escapeHtml(what)}</span>`
    )).join('') + '<span class="t-back"><b>T</b>step back from the terminal</span>';

    // A tutorial hint outranks a transient toast: it is the thing the player
    // is stuck on, and it stays until they are not.
    if (this.hint) {
      this.el.toast.textContent = `> ${this.hint}`;
      this.el.toast.className = 'hint';
    } else {
      this.el.toast.textContent = t.message ? `> ${t.message}` : '';
      this.el.toast.className = '';
    }
  }

  _row(r) {
    // Column widths come from the screen description, so a header and its
    // rows always line up. `flex` shorthand is allowed as a width entry.
    const cols = (list, cw) => list.map((c, i) => {
      const w = cw && cw[i];
      const style = w ? ` style="flex:${w.includes(' ') ? w : `0 0 ${w}`}"` : '';
      return `<span class="c c${i}"${style}>${escapeHtml(c)}</span>`;
    }).join('');

    switch (r.k) {
      case 'gap': return '<div class="t-gap"></div>';
      case 'rule': return '<div class="t-rule"></div>';
      case 'head': return `<div class="t-head">${escapeHtml(r.t)}</div>`;
      case 'dim': return `<div class="t-dim">${escapeHtml(r.t)}</div>`;
      case 'note': return `<div class="t-note">${escapeHtml(r.t)}</div>`;
      case 'warn': return `<div class="t-warn">${escapeHtml(r.t || `${r.label}: ${r.value}`)}</div>`;
      case 'bright': return `<div class="t-line t-bright">${cols(r.cols || [r.t], r.cw)}</div>`;
      case 'cols': return `<div class="t-cols">${cols(r.cols, r.cw)}</div>`;
      case 'field':
        return `<div class="t-field"><span class="l">${escapeHtml(r.label)}</span>`
          + `<span class="v">${escapeHtml(r.value)}<i class="caret">_</i></span></div>`;
      case 'kv':
        return `<div class="t-kv${r.warn ? ' warn' : ''}">`
          + `<span class="l">${escapeHtml(r.label)}</span><span class="v">${escapeHtml(r.value)}</span></div>`;
      case 'map': return '<div class="t-map"><canvas></canvas></div>';
      case 'item': {
        const cls = ['t-item'];
        if (r.sel) cls.push('sel');
        if (r.warn) cls.push('warn');
        if (r.off) cls.push('off');
        if (r.good) cls.push('good');
        if (r.tone) cls.push(`tone-${r.tone}`);
        return `<div class="${cls.join(' ')}" data-id="${escapeHtml(r.id)}">`
          + `<span class="mark">></span>${cols(r.cols, r.cw)}`
          + (r.sub ? `<span class="sub">${escapeHtml(r.sub)}</span>` : '')
          + '</div>';
      }
      default:
        return `<div class="t-line${r.tone ? ` tone-${r.tone}` : ''}">`
          + `${r.cols ? cols(r.cols, r.cw) : escapeHtml(r.t || '')}</div>`;
    }
  }

  /** The map is the one screen that is a picture rather than rows. */
  _paintMap(rows) {
    const spec = rows.find((r) => r.k === 'map');
    if (!spec) return;
    const canvas = this.el.body.querySelector('.t-map canvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.max(200, Math.round(rect.height));
    canvas.width = w;
    canvas.height = h;
    drawTerritory(canvas.getContext('2d'), w, h, { style: 'crt', outages: spec.outages });
  }
}
