/* ============================================================
   callui.js -- the conversation panel.

   Presents whatever the DialogueRunner emits and reports the
   player's choice back. It owns the pacing of a line: the text
   appears, the audio engine speaks it, and when BOTH the audio
   and the minimum read time are done it tells the runner to move
   on. That is why a long line is never cut off by a fast voice
   and a short line never sits there for five seconds.

   `effect` on a line drives both the audio chain and the CSS
   class, so a 1956 line looks different from an EVP fragment
   without the writer doing anything but naming the line kind.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';
import { escapeHtml } from './hud.js';
import { label as controlLabel } from '../engine/controls.js';

const $ = (id) => document.getElementById(id);

export class CallUI {
  constructor({ runner, audio, settings, phone, input }) {
    this.runner = runner;
    this.audio = audio;
    this.settings = settings;
    this.phone = phone;
    this.input = input;
    this.el = {
      root: $('call'),
      head: $('call-head'),
      who: $('call-who'),
      meta: $('call-meta'),
      stage: $('call-stage'),
      text: $('call-text'),
      choices: $('call-choices'),
      keys: $('call-keys'),
    };
    /** Set by game.js: the number row belongs to the terminal while it is up. */
    this.docked = false;
    /**
     * Who the arrow keys belong to. A new set of replies takes them, because
     * somebody is waiting; touching the terminal hands them back, because the
     * player is clearly doing something else. Only meaningful while docked --
     * out in the room the panel is the only thing on screen.
     */
    this.focused = true;
    this.visible = false;
    this.sel = 0;
    this.choices = [];
    this._speaking = null;
    this._timer = 0;
    this._pendingPlayerLine = false;
    this._wire();
  }

  _wire() {
    bus.on(EVENTS.ANSWERED, ({ call }) => this.open(call));
    bus.on(EVENTS.LINE_SPOKEN, (p) => this.showLine(p));
    bus.on(EVENTS.CHOICES, (p) => this.showChoices(p.choices));
    bus.on(EVENTS.DIALOGUE_END, () => this.close());
    bus.on(EVENTS.HOLD, () => this.close(true));
    bus.on(EVENTS.RESUME, ({ call }) => this.open(call));

    this.el.choices.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      this.setFocused(true);
      this.pick(Number(li.dataset.i));
    });
  }

  /**
   * Tell the terminal how much room this panel needs.
   *
   * The panel is bottom-anchored inside a full-screen layer, so its own box
   * is the whole viewport and useless to measure; what matters is where its
   * top edge lands. Measured on the next frame, after layout.
   */
  _measure() {
    if (this._measuring) return;
    this._measuring = true;
    requestAnimationFrame(() => {
      this._measuring = false;
      const cabinet = document.getElementById('cabinet');
      if (!cabinet) return;
      if (!this.visible) { cabinet.style.removeProperty('--call-h'); return; }
      const top = this.el.head.getBoundingClientRect().top;
      const h = Math.max(0, Math.round(cabinet.getBoundingClientRect().bottom - top));
      cabinet.style.setProperty('--call-h', `${h}px`);
    });
  }

  open(call) {
    this.visible = true;
    this.el.root.classList.remove('hidden');
    const c = call.caller || {};
    this.el.who.textContent = c.display || c.name || 'CALLER';
    const bits = [];
    if (c.number) bits.push(c.number);
    if (call.medium === 'radio') bits.push('CHANNEL 1');
    else bits.push(`LINE ${(this.phone.activeLine ?? 0) + 1}`);
    this.el.meta.textContent = bits.join('  ·  ');
    this.el.choices.innerHTML = '';
    this.choices = [];
    this.renderKeys();
    this._measure();
  }

  close(held = false) {
    this.visible = false;
    this.el.root.classList.add('hidden');
    this.choices = [];
    this.el.choices.innerHTML = '';
    if (this._speaking) { this._speaking.stop(); this._speaking = null; }
    this._timer = 0;
    this._pendingPlayerLine = false;
    this._measure();
  }

  /** Render and speak one line. */
  showLine(p) {
    if (!this.visible) this.open(p.call);
    this.el.stage.textContent = p.stage ? `(${p.stage})` : '';
    this.el.text.textContent = p.text || '';
    this.el.text.className = '';
    if (p.isPlayer) this.el.text.classList.add('player');
    else if (p.effect && p.effect !== 'clean') this.el.text.classList.add(p.effect);
    this.el.choices.innerHTML = '';
    this.choices = [];

    if (this._speaking) this._speaking.stop();
    this._pendingPlayerLine = !!p.isPlayer;

    // An empty line is a beat of silence, not a mistake -- several scripts
    // use one deliberately, and it should be allowed to just sit there.
    const speakable = (p.text || '').replace(/[—\s.]/g, '').length > 0;
    const speed = this.settings ? this.settings.get('textSpeed') : 1;
    const minRead = Math.max(0.6, (p.text || '').length * 0.028 / Math.max(0.35, speed));

    if (speakable && this.audio) {
      this._speaking = this.audio.speak(p.text, {
        voice: p.voice,
        line: p.effect,
        clip: p.clip,
        bus: p.speaker === 'radio' ? 'radio' : 'voice',
      });
      this._timer = Math.max(this._speaking.duration, minRead) + (p.pause ?? 0.25);
    } else {
      this._timer = (p.pause ?? 0.25) + (speakable ? minRead : 0.9);
    }
    this._measure();
  }

  showChoices(list) {
    this.choices = list;
    this.sel = 0;
    // Somebody has just asked the player a question. Whatever they were doing
    // in the terminal, the reply list gets the keys first.
    this.focused = true;
    this.el.root.classList.remove('unfocused');
    // The number is only a shortcut when the terminal is not holding the
    // number row; the marker and the selection work either way.
    const showNumbers = !this.docked;
    this.el.choices.innerHTML = list.map((c, i) => (
      `<li data-i="${i}" class="${i === 0 ? 'sel' : ''}">`
      + `<span class="mark">\u25b8</span>`
      + (showNumbers ? `<span class="n">${i + 1}</span>` : '')
      + `<span>${escapeHtml(c.text)}</span></li>`
    )).join('');
    this.renderKeys();
    this._measure();
  }

  /** The key line under the panel, in whatever the player is holding. */
  renderKeys() {
    if (!this.el.keys) return;
    const scheme = this.input ? this.input.scheme : 'kbm';
    const g = (a) => controlLabel(a, scheme);
    const bits = [];
    if (this.choices.length) {
      if (this.docked && !this.focused) {
        bits.push([g('answer'), 'come back to the caller']);
      } else {
        bits.push([g('nav'), 'choose a reply']);
        bits.push([g('select'), 'say it']);
        if (!this.docked) bits.push(['1-4', 'reply directly']);
      }
    }
    bits.push([g('hold'), 'hold']);
    bits.push([g('hangup'), 'hang up']);
    bits.push([g('terminal'), this.docked ? 'back to the room' : 'terminal']);
    this.el.keys.innerHTML = bits.map(([k, what]) => (
      `<span><b>${escapeHtml(k)}</b>${escapeHtml(what)}</span>`
    )).join('');
  }

  /**
   * Hand the arrow keys to the panel or to the terminal. The panel says which
   * it is: focused, it explains how to reply; unfocused, it explains how to
   * get back to the caller.
   */
  setFocused(on) {
    if (this.focused === on) return;
    this.focused = on;
    this.el.root.classList.toggle('unfocused', !on);
    this.renderKeys();
  }

  move(d) {
    if (!this.choices.length) return;
    this.sel = (this.sel + d + this.choices.length) % this.choices.length;
    [...this.el.choices.children].forEach((li, i) => li.classList.toggle('sel', i === this.sel));
  }

  /** Called when the terminal opens or closes: it changes the key hints. */
  setDocked(on) {
    if (this.docked === on) return;
    this.docked = on;
    if (this.choices.length) this.showChoices(this.choices);
    else this.renderKeys();
  }

  pick(index = this.sel) {
    if (!this.choices.length) return false;
    const i = Math.max(0, Math.min(this.choices.length - 1, index));
    this.el.choices.innerHTML = '';
    const ok = this.runner.choose(i);
    this.choices = [];
    return ok;
  }

  /** Drives line pacing. */
  update(dt) {
    if (!this.visible || this._timer <= 0) return;
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = 0;
    if (this._pendingPlayerLine) {
      this._pendingPlayerLine = false;
      this.runner.playerLineFinished();
    } else {
      this.runner.lineFinished();
    }
  }
}
