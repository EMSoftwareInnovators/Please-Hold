/* ============================================================
   menu.js -- title, options, how-to, pause and the end slate.

   Kept away from the game systems entirely: it takes a set of
   callbacks and calls them. Nothing in src/game/ imports this.
   ============================================================ */
const $ = (id) => document.getElementById(id);

export class Menu {
  constructor({ settings, actions, save }) {
    this.settings = settings;
    this.actions = actions;           // { start, continue, resume, quitToTitle, applySettings }
    this.save = save;
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
  handleKey(e) {
    if (this.open === 'panel') {
      if (e.key === 'Escape' || e.key === 'Enter') { this.closePanel(); return true; }
      return this.panelKind === 'options' ? this._optionsKey(e) : true;
    }
    if (this.open !== 'title') return false;
    const items = [...this.el.menu.children];
    if (e.key === 'ArrowDown') { this.sel = (this.sel + 1) % items.length; this._paint(); return true; }
    if (e.key === 'ArrowUp') { this.sel = (this.sel - 1 + items.length) % items.length; this._paint(); return true; }
    if (e.key === 'Enter') {
      const li = items[this.sel];
      if (li && !li.classList.contains('disabled')) this.activate(li.dataset.act);
      return true;
    }
    return false;
  }

  _optionsKey() { return true; }

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
    this.el.body.innerHTML = html + `<p class="close">ESC to close</p>`;
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
    this.panel('howto', `
      <h2>HOW TO WORK THE DESK</h2>
      <p>You are the overnight dispatcher at the District Operations Center. There is a
      storm across the county and you are the only person in the building.</p>

      <h3>MOVING</h3>
      <dl>
        <dt>W A S D</dt><dd>walk</dd>
        <dt>MOUSE</dt><dd>look</dd>
        <dt>SHIFT</dt><dd>move quickly</dd>
        <dt>E</dt><dd>use what you are looking at</dd>
        <dt>Q</dt><dd>stand up from the desk</dd>
      </dl>

      <h3>THE TELEPHONE</h3>
      <dl>
        <dt>F</dt><dd>answer the ringing line</dd>
        <dt>1 - 4</dt><dd>choose a reply</dd>
        <dt>H</dt><dd>put the caller on hold</dd>
        <dt>X</dt><dd>hang up</dd>
      </dl>
      <p>A caller on hold is still there, and still counting. Some of them will wait a
      long time. Some of them will not.</p>

      <h3>THE TERMINAL</h3>
      <dl>
        <dt>T</dt><dd>lean in to the CRT / step back</dd>
        <dt>F1 - F6</dt><dd>menu, accounts, tickets, map, dispatch, log</dd>
        <dt>ARROWS</dt><dd>move the selection</dd>
        <dt>RETURN</dt><dd>search, open, assign</dd>
        <dt>N</dt><dd>open a new trouble ticket</dd>
      </dl>
      <p>Look people up before you confirm anything to them. Several replies are only
      available once you have actually read the account &mdash; that is deliberate.</p>

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
    const row = (label, key, kind) => {
      const v = s.get(key);
      const shown = kind === 'bool' ? (v ? 'ON' : 'OFF') : `${Math.round(v * 100)}%`;
      return `<div class="opt"><span>${label}</span><span>
        <button data-k="${key}" data-d="-1">&lt;</button>
        <span style="display:inline-block;min-width:64px;text-align:center">${shown}</span>
        <button data-k="${key}" data-d="1">&gt;</button></span></div>`;
    };
    this.panel('options', `
      <h2>OPTIONS</h2>
      <h3>AUDIO</h3>
      ${row('MASTER', 'masterVolume')}
      ${row('VOICE', 'voiceVolume')}
      ${row('HOLD MUSIC', 'musicVolume')}
      <h3>DISPLAY</h3>
      ${row('RENDER SCALE', 'renderScale')}
      ${row('FILM GRAIN', 'filmGrain', 'bool')}
      <h3>CONTROLS</h3>
      ${row('MOUSE SENSITIVITY', 'mouseSensitivity')}
      ${row('INVERT Y', 'invertY', 'bool')}
      ${row('HEAD BOB', 'headBob', 'bool')}
      <h3>ACCESSIBILITY</h3>
      ${row('REDUCE FLICKER', 'reduceFlicker', 'bool')}
      ${row('TEXT SPEED', 'textSpeed')}
      <p style="margin-top:18px">REDUCE FLICKER caps the strobing in the power-failure
      events. The story is unchanged.</p>
    `);
    this.el.body.querySelectorAll('button[data-k]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.k, d = Number(b.dataset.d);
        const cur = s.get(k);
        if (typeof cur === 'boolean') s.set(k, !cur);
        else s.set(k, Math.max(0, Math.min(2, Math.round((cur + d * 0.1) * 100) / 100)));
        if (this.actions.applySettings) this.actions.applySettings();
        this.options();
      });
    });
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
