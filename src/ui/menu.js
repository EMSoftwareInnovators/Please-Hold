/* ============================================================
   menu.js -- title, options, how-to, pause and the end slate.

   Kept away from the game systems entirely: it takes a set of
   callbacks and calls them. Nothing in src/game/ imports this.
   ============================================================ */
import { label as controlLabel, isAction } from '../engine/controls.js';

const $ = (id) => document.getElementById(id);

export class Menu {
  constructor({ settings, actions, save, input }) {
    this.settings = settings;
    this.actions = actions;           // { start, continue, resume, quitToTitle, applySettings }
    this.save = save;
    this.input = input;
    this.el = {
      title: $('title'),
      menu: $('title-menu'),
      panel: $('panel'),
      body: $('panel-body'),
      fade: $('fade'),
      slate: $('slate'),
      slateText: $('slate-text'),
      cabinet: $('cabinet'),
    };
    this.sel = 0;
    this.optSel = 0;
    this.optKeys = [];
    this.open = 'title';              // 'title' | 'panel' | null
    this.panelKind = null;
    this._wire();
    this.refresh();
  }

  _wire() {
    this.el.menu.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li || li.classList.contains('disabled')) return;
      this.activate(li.dataset.act);
    });
    this.el.menu.addEventListener('mousemove', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      this.sel = [...this.el.menu.children].indexOf(li);
      this._paint();
    });
  }

  refresh() {
    const hasSave = !!(this.save && this.save.peek());
    const cont = this.el.menu.querySelector('[data-act="continue"]');
    if (cont) cont.classList.toggle('disabled', !hasSave);
    this._paint();
  }

  _paint() {
    [...this.el.menu.children].forEach((li, i) => li.classList.toggle('sel', i === this.sel));
  }

  showTitle(on = true) {
    this.el.title.classList.toggle('hidden', !on);
    this.open = on ? 'title' : null;
    if (on) this.refresh();
  }

  /* ---------------- keyboard ---------------- */
  /* Everything here asks the binding table rather than testing key names, so
     a d-pad drives the menus exactly as the arrow keys do. */
  handleKey(e) {
    if (this.open === 'panel') {
      // In Options the arrows belong to the settings, not to scrolling, and
      // confirm changes a value rather than closing the panel.
      if (this.panelKind === 'options') {
        if (isAction('cancel', e) || e.code === 'PadStart') { this.closePanel(); return true; }
        if (isAction('select', e)) { this.step(this.optKeys[this.optSel], 1); return true; }
        return this._optionsKey(e);
      }
      if (isAction('cancel', e) || isAction('select', e) || e.code === 'PadStart') {
        this.closePanel(); return true;
      }
      // The how-to is longer than the panel, and a pad has no scroll wheel.
      if (isAction('down', e)) { this._scrollPanel(1); return true; }
      if (isAction('up', e)) { this._scrollPanel(-1); return true; }
      return true;
    }
    if (this.open !== 'title') return false;
    const items = [...this.el.menu.children];
    if (isAction('down', e)) { this.sel = (this.sel + 1) % items.length; this._paint(); return true; }
    if (isAction('up', e)) { this.sel = (this.sel - 1 + items.length) % items.length; this._paint(); return true; }
    if (isAction('select', e)) {
      const li = items[this.sel];
      if (li && !li.classList.contains('disabled')) this.activate(li.dataset.act);
      return true;
    }
    return false;
  }

  _scrollPanel(dir) {
    this.el.body.scrollTop += dir * Math.max(80, this.el.body.clientHeight * 0.5);
  }

  /** Up/down pick a row, left/right change it, confirm toggles or steps up. */
  _optionsKey(e) {
    const keys = this.optKeys || [];
    if (!keys.length) return true;
    if (isAction('down', e)) { this.optSel = (this.optSel + 1) % keys.length; this._optScrollInto = true; this.options(); return true; }
    if (isAction('up', e)) { this.optSel = (this.optSel - 1 + keys.length) % keys.length; this._optScrollInto = true; this.options(); return true; }
    if (e.code === 'ArrowLeft' || e.code === 'PadLeft') { this.step(keys[this.optSel], -1); return true; }
    if (e.code === 'ArrowRight' || e.code === 'PadRight') { this.step(keys[this.optSel], 1); return true; }
    return true;
  }

  activate(act) {
    switch (act) {
      case 'start': this.actions.start(); break;
      case 'continue': this.actions.continue(); break;
      case 'howto': this.howto(); break;
      case 'options': this.options(); break;
      default: break;
    }
  }

  /* ---------------- panels ---------------- */
  panel(kind, html) {
    this.panelKind = kind;
    const back = controlLabel('cancel', this.input ? this.input.scheme : 'kbm');
    this.el.body.innerHTML = html + `<p class="close">${back} to close</p>`;
    this.el.body.scrollTop = 0;
    this.el.panel.classList.remove('hidden');
    this.open = 'panel';
  }

  closePanel() {
    this.el.panel.classList.add('hidden');
    this.panelKind = null;
    this.open = this.el.title.classList.contains('hidden') ? null : 'title';
    if (this.open === null && this.actions.resume) this.actions.resume();
  }

  howto() {
    /* The panel names actions, not keys, so it prints W/E/H on a keyboard and
       the right face buttons on whatever pad is plugged in. */
    const scheme = this.input ? this.input.scheme : 'kbm';
    const pad = scheme !== 'kbm';
    const g = (a) => controlLabel(a, scheme);
    const rows = (list) => list
      .filter(([k]) => k)
      .map(([k, what]) => `<dt>${k}</dt><dd>${what}</dd>`).join('');

    this.panel('howto', `
      <h2>HOW TO WORK THE DESK</h2>
      <p>You are the overnight dispatcher at the District Operations Center. There is a
      storm across the county and you are the only person in the building.</p>

      <h3>MOVING</h3>
      <dl>
        ${rows([
          [pad ? 'LEFT STICK' : 'W A S D', 'walk'],
          [pad ? 'RIGHT STICK' : 'MOUSE', 'look'],
          [g('run'), 'move quickly'],
          [g('use'), 'use what you are looking at'],
          [g('stand'), 'stand up from the desk'],
        ])}
      </dl>
      ${pad ? '' : '<p>Click the window to look around &mdash; the browser only lets the game '
        + 'have the mouse after a click, and the screen says so until it does.</p>'}

      <h3>THE TELEPHONE</h3>
      <dl>
        ${rows([
          [g('answer'), 'answer the ringing line, or turn back to the caller'],
          [`${g('nav')} + ${g('select')}`, 'choose a reply and say it'],
          [pad ? '' : '1 - 4', 'reply directly'],
          [g('hold'), 'put the caller on hold'],
          [g('hangup'), 'hang up'],
        ])}
      </dl>
      <p>A caller on hold is still there, and still counting. Some of them will wait a
      long time. Some of them will not.</p>

      <h3>THE TERMINAL</h3>
      <dl>
        ${rows([
          [g('terminal'), 'lean in to the CRT / step back'],
          [g('screens'), 'menu, accounts, tickets, map, dispatch, log'],
          [g('nav'), 'move the selection'],
          [g('select'), 'search, open, assign'],
          [pad ? '' : 'N', 'open a new trouble ticket'],
        ])}
      </dl>
      <p>Look people up before you confirm anything to them. Several replies are only
      available once you have actually read the account &mdash; that is deliberate.</p>
      ${pad ? '<p>No keyboard needed: the search box opens on-screen keys, and every '
        + 'other action in the terminal is a row you can move to.</p>' : ''}
      <p>A call carries on underneath the terminal so you can read it while you work.
      A new reply takes the ${pad ? 'D-PAD' : 'ARROW KEYS'}; touching a screen or a row
      gives them back to the terminal; <b>${g('answer')}</b> turns you back to the caller.</p>

      <h3>THE JOB</h3>
      <p>Take the call. Get the service address and confirm it against the account, not
      against the caller. Open a ticket. Assign a unit that is rated for the work.
      Do not promise a restore time.</p>
      <p>A wire on the ground is energized until a crew standing next to it says
      otherwise. There is no exception to that and the game does not make one.</p>
    `);
  }

  options() {
    const s = this.settings;

    /* Three row kinds: a 0..1 percentage, a boolean, and a list of named
       choices (quality, pixel ratio). All three use the same stepper, so the
       panel stays keyboard- and click-friendly without a widget library. */
    const ENUMS = {
      quality: { values: ['low', 'medium', 'high'], labels: ['LOW', 'MEDIUM', 'HIGH'] },
      pixelRatio: { values: [1, 1.5, 2], labels: ['1x', '1.5x', '2x (RETINA)'] },
    };

    const shown = (key) => {
      const v = s.get(key);
      if (ENUMS[key]) {
        const i = Math.max(0, ENUMS[key].values.indexOf(v));
        return ENUMS[key].labels[i];
      }
      if (typeof v === 'boolean') return v ? 'ON' : 'OFF';
      return `${Math.round(v * 100)}%`;
    };

    /* Every option row is addressable, because a controller has no mouse to
       click a stepper with and Options was otherwise pointer-only. */
    const keys = [];
    const row = (label, key, note) => {
      keys.push(key);
      const sel = keys.length - 1 === this.optSel;
      return `<div class="opt${sel ? ' sel' : ''}" data-opt="${key}">
      <span>${label}${note ? `<em>${note}</em>` : ''}</span>
      <span class="stepper">
        <button data-k="${key}" data-d="-1">&lt;</button>
        <span class="val">${shown(key)}</span>
        <button data-k="${key}" data-d="1">&gt;</button>
      </span></div>`;
    };

    this.panel('options', `
      <h2>OPTIONS</h2>

      <h3>DISPLAY</h3>
      ${row('QUALITY', 'quality')}
      ${row('RESOLUTION', 'pixelRatio', '1x is the default even on a Retina screen')}
      ${row('ADAPTIVE', 'adaptiveQuality', 'drop resolution automatically to hold the frame rate')}
      ${row('FILM GRAIN', 'filmGrain')}
      <p class="optnote">Press <b>F3</b> in game for frame time, draw calls and light count.</p>

      <h3>AUDIO</h3>
      ${row('MASTER', 'masterVolume')}
      ${row('RAIN &amp; ROOM', 'ambienceVolume')}
      ${row('VOICES', 'voiceVolume')}
      ${row('HOLD MUSIC', 'musicVolume')}
      ${row('ROOM TONE', 'roomTone', 'ballast hum and the CRT&rsquo;s flyback whine')}

      <h3>CONTROLS</h3>
      ${row('MOUSE SENSITIVITY', 'mouseSensitivity')}
      ${row('INVERT Y', 'invertY')}
      ${row('HEAD BOB', 'headBob')}

      <h3>ACCESSIBILITY</h3>
      ${row('REDUCE FLICKER', 'reduceFlicker', 'caps the strobing in the power-failure events')}
      ${row('TEXT SPEED', 'textSpeed')}
    `);

    this.optKeys = keys;
    this.optEnums = ENUMS;
    if (this.optSel >= keys.length) this.optSel = keys.length - 1;

    this.el.body.querySelectorAll('button[data-k]').forEach((b) => {
      b.addEventListener('click', () => {
        this.optSel = keys.indexOf(b.dataset.k);
        this.step(b.dataset.k, Number(b.dataset.d));
      });
    });
    this.el.body.querySelectorAll('[data-opt]').forEach((el) => {
      el.addEventListener('mousemove', () => {
        const i = keys.indexOf(el.dataset.opt);
        if (i >= 0 && i !== this.optSel) { this.optSel = i; this.options(); }
      });
    });
    const sel = this.el.body.querySelector('.opt.sel');
    if (sel && this._optScrollInto) { sel.scrollIntoView({ block: 'nearest' }); this._optScrollInto = false; }
  }

  /** Move one option by one step, from a click, a key or a d-pad. */
  step(key, dir) {
    const s = this.settings;
    const cur = s.get(key);
    const ENUMS = this.optEnums || {};
    if (ENUMS[key]) {
      const vals = ENUMS[key].values;
      const i = Math.max(0, vals.indexOf(cur));
      s.set(key, vals[Math.max(0, Math.min(vals.length - 1, i + dir))]);
    } else if (typeof cur === 'boolean') {
      s.set(key, !cur);
    } else {
      s.set(key, Math.max(0, Math.min(2, Math.round((cur + dir * 0.1) * 100) / 100)));
    }
    if (this.actions.applySettings) this.actions.applySettings();
    this.options();
  }

  pause() {
    this.panel('pause', `
      <h2>SHIFT PAUSED</h2>
      <p>The county is still out there.</p>
      <h3>QUICK REFERENCE</h3>
      <dl>
        <dt>F</dt><dd>answer</dd>
        <dt>H</dt><dd>hold</dd>
        <dt>X</dt><dd>hang up</dd>
        <dt>T</dt><dd>terminal</dd>
        <dt>Q</dt><dd>stand up</dd>
      </dl>
    `);
  }

  /* ---------------- transitions ---------------- */
  fade(on) { this.el.fade.classList.toggle('on', on); }
  cinema(on) { this.el.cabinet.classList.toggle('cinema', on); }

  /** The end-of-slice card. */
  slate(text, { hold = 5200 } = {}) {
    this.el.slateText.textContent = text;
    this.el.slate.classList.remove('hidden');
    requestAnimationFrame(() => this.el.slate.classList.add('show'));
    return new Promise((res) => setTimeout(res, hold));
  }
  hideSlate() {
    this.el.slate.classList.remove('show');
    setTimeout(() => this.el.slate.classList.add('hidden'), 1200);
  }

  /** The report shown when the shift ends. */
  report(state, clock, outages) {
    const flags = (list) => list.filter((f) => state.has(f)).length;
    const daley = state.caller('daley');
    const lines = [];
    lines.push(`<h2>END OF SHIFT</h2>`);
    lines.push(`<p>${clock.label(clock.wallMinutes)} &mdash; the log closes here.</p>`);
    lines.push(`<h3>THE WORK</h3>`);
    lines.push(`<dl>
      <dt>TICKETS OPENED</dt><dd>${outages.list.length}</dd>
      <dt>RESTORED</dt><dd>${outages.restored.length}</dd>
      <dt>STILL OUT</dt><dd>${outages.open.length} (${outages.customersOut()} meters)</dd>
      <dt>UNITS SENT</dt><dd>${state.count('dispatches')}</dd>
    </dl>`);
    lines.push(`<h3>THE PEOPLE</h3><dl>`);
    if (daley.calls) {
      lines.push(`<dt>MRS. DALEY</dt><dd>${daley.calls} call${daley.calls > 1 ? 's' : ''}.
        ${state.has('daley_medical_caught') ? 'You read her file and caught the oxygen.'
        : state.has('daley_oxygen_known') ? 'She told you about the oxygen. You had to ask.'
          : 'You never found out about the oxygen.'}</dd>`);
    }
    if (state.has('vance_handled_well')) lines.push(`<dt>K. VANCE</dt><dd>Stayed in the vehicle. The line was secured.</dd>`);
    else if (state.has('vance_told_probably_dead')) lines.push(`<dt>K. VANCE</dt><dd>You told her a downed conductor was probably dead.</dd>`);
    if (state.has('kid_saved')) lines.push(`<dt>LUNDQUIST</dt><dd>The garage door got opened.</dd>`);
    else if (state.has('missed_the_generator')) lines.push(`<dt>LUNDQUIST</dt><dd>A generator ran all night in a closed garage.</dd>`);
    lines.push(`</dl>`);
    lines.push(`<h3>THE OTHER THING</h3><dl>`);
    lines.push(`<dt>LOGGED</dt><dd>${state.shiftLog.filter((e) => e.kind === 'anomaly').length} entries you could not explain</dd>`);
    if (state.has('pole_tag_1956')) lines.push(`<dt>POLE 441</dt><dd>Tagged 1956. Halloran kept the copper.</dd>`);
    if (state.has('pratt_said_1956')) lines.push(`<dt>E. PRATT</dt><dd>${state.has('told_pratt_the_year') ? 'You told him what year it was.' : 'You let him keep his year.'}</dd>`);
    if (state.has('keefe_said_1956')) lines.push(`<dt>R. KEEFE</dt><dd>1978. Same desk. He asked you to answer it.</dd>`);
    lines.push(`</dl>`);
    lines.push(`<p style="margin-top:20px">This is the end of the vertical slice. The shift
      does not end at 06:00 yet &mdash; see ROADMAP.md.</p>`);
    this.panel('report', lines.join(''));
  }
}
