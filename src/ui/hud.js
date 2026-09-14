/* ============================================================
   hud.js -- the heads-up layer: prompt, clock, line lamps,
   radio strip, toasts.

   It is a listener, not a driver. Everything it shows arrives on
   the bus, so no game system has to know the HUD exists and the
   HUD can be redesigned without touching a single system.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';
import { LINE_STATE } from '../game/phone.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor({ clock, settings }) {
    this.clock = clock;
    this.settings = settings;
    this.el = {
      root: $('hud'),
      prompt: $('prompt'),
      time: $('clock-time'),
      date: $('clock-date'),
      lines: $('line-list'),
      radio: $('radio-strip'),
      radioFrom: $('radio-from'),
      radioText: $('radio-text'),
      toasts: $('toasts'),
      objective: $('objective'),
      reticle: $('reticle'),
      perf: $('perf'),
    };
    this.showPerf = false;
    this._perfTimer = 0;
    this._radioTimer = 0;
    this._wire();
  }

  show(on = true) { this.el.root.classList.toggle('hidden', !on); }

  _wire() {
    bus.on('ui:prompt', (p) => {
      if (!p) { this.el.prompt.textContent = ''; return; }
      this.el.prompt.innerHTML = `<b>E</b>${escapeHtml(p.verb)} ${escapeHtml(p.label)}`;
    });

    bus.on(EVENTS.MINUTE, () => this.updateClock());

    bus.on(EVENTS.LINE_CHANGED, (p) => { if (p && p.lines) this.setLines(p.lines); });

    bus.on(EVENTS.TOAST, (p) => this.toast(p.text));

    bus.on(EVENTS.RADIO_TRAFFIC, (t) => {
      if (t.state === 'begin') {
        this.el.radioFrom.textContent = t.from === 'DISPATCH' ? 'YOU' : t.from;
        this.el.radioText.textContent = t.text;
        this.el.radio.classList.add('show');
      } else {
        this._radioTimer = 2.2;
      }
    });
  }

  updateClock() {
    const c = this.clock;
    this.el.time.textContent = c.label(c.displayMinutes);
    // Past midnight the date rolls, which is a small thing the player notices.
    const past = c.minutes >= 1440;
    this.el.date.textContent = past ? 'NOV 12 1999' : 'NOV 11 1999';
  }

  setLines(lines) {
    const html = lines.map((l) => {
      const cls = l.state === LINE_STATE.RINGING ? 'ringing'
        : l.state === LINE_STATE.ACTIVE ? 'active'
          : l.state === LINE_STATE.HOLD ? 'hold' : '';
      const who = l.state === LINE_STATE.IDLE ? '—'
        : (l.caller || 'UNKNOWN');
      const extra = l.state === LINE_STATE.HOLD ? `${l.heldSeconds}s` : '';
      return `<li class="${cls}"><span class="lamp"></span><span class="n">L${l.index + 1}</span>`
        + `<span class="who">${escapeHtml(who)}</span><span class="t">${extra}</span></li>`;
    }).join('');
    this.el.lines.innerHTML = html;
  }

  toast(text) {
    const li = document.createElement('div');
    li.className = 'toast';
    li.textContent = text;
    this.el.toasts.appendChild(li);
    setTimeout(() => {
      li.style.transition = 'opacity .4s';
      li.style.opacity = '0';
      setTimeout(() => li.remove(), 420);
    }, 4200);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
  }

  setObjective(text) { this.el.objective.textContent = text || ''; }

  /** F3. Shows what the frame is actually being spent on. */
  togglePerf() {
    this.showPerf = !this.showPerf;
    this.el.perf.classList.toggle('hidden', !this.showPerf);
  }

  /**
   * Counting lights every frame would itself cost something, so the scene is
   * only walked a few times a second.
   */
  updatePerf(renderer, scene) {
    if (!this.showPerf) return;
    this._perfTimer -= 1;
    if (this._perfTimer > 0) return;
    this._perfTimer = 20;

    let lights = 0, shadows = 0, meshes = 0;
    scene.traverse((o) => {
      if (o.isLight) { lights++; if (o.castShadow) shadows++; }
      else if (o.isMesh) meshes++;
    });
    const s = renderer.stats;
    const slow = s.fps < 45;
    this.el.perf.innerHTML =
      `<b>${s.fps.toFixed(0)} fps</b>  ${s.ms.toFixed(1)} ms` + (slow ? '  <span class="warn">(scaling)</span>' : '') + '\n'
      + `render   ${s.rt}  @${(s.scale * 100) | 0}%\n`
      + `draws    ${s.drawCalls}   tris ${(s.tris / 1000).toFixed(1)}k\n`
      + `lights   ${lights} (${shadows} shadowed)\n`
      + `meshes   ${meshes}\n`
      + `F3 to hide`;
  }
  setReticle(on) { this.el.reticle.style.display = on ? '' : 'none'; }

  update(dt) {
    if (this._radioTimer > 0) {
      this._radioTimer -= dt;
      if (this._radioTimer <= 0) this.el.radio.classList.remove('show');
    }
  }
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
