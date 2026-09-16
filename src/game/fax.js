/* ============================================================
   fax.js -- the machine on the back counter.

   The fax exists to be boring for two hours.

   That is not a joke about pacing, it is the mechanism: a device
   that has spent the night printing mutual-aid bulletins and a
   weather warning is a device whose handshake tone, at 04:40,
   means something. If the first thing it ever printed were a
   work order from 1978, it would be a prop. Because the first
   six things it printed were county emergency management telling
   the player about road closures, the seventh is a problem.

   Pages live in src/data/faxes.js. The machine only knows how to
   receive one, make the noise, and hold it until somebody walks
   over and picks it up.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

export class FaxMachine {
  constructor({ audio, state, clock } = {}) {
    this.audio = audio;
    this.state = state;
    this.clock = clock;
    /** Pages waiting in the tray, oldest first. */
    this.tray = [];
    /** Pages the player has actually read. */
    this.read = [];
    this.printing = false;
    this._timer = 0;
    this._queue = [];
  }

  get unread() { return this.tray.length; }
  get hasUnread() { return this.tray.length > 0; }

  /**
   * Send a page. `delay` is real seconds before the machine starts, so a
   * script can put the handshake tone in the middle of a sentence rather
   * than on the punctuation.
   */
  send(page, { delay = 0 } = {}) {
    if (!page) return false;
    this._queue.push({ page, at: delay });
    return true;
  }

  update(dt) {
    if (!this._queue.length) return;
    for (const q of this._queue) q.at -= dt;
    const ready = this._queue.filter((q) => q.at <= 0);
    if (!ready.length) return;
    this._queue = this._queue.filter((q) => q.at > 0);
    for (const q of ready) this._print(q.page);
  }

  _print(page) {
    const stamp = this.clock ? this.clock.stamp() : '----';
    const doc = {
      ...page,
      received: page.received || stamp,
      id: page.id,
    };
    this.tray.push(doc);
    this.printing = true;
    this._timer = 0;
    /* The sound is the point. A 1990s thermal fax is a handshake shriek, a
       stepper motor, and then thirty seconds of a machine chewing paper --
       from the other side of the room, with your back to it. */
    if (this.audio) {
      this.audio.play('faxHandshake', { volume: 0.55 });
      this.audio.play('faxPrint', { volume: 0.5, delay: 1.4 });
    }
    if (this.state) {
      this.state.set('fax_received', true);
      this.state.bump('faxes_received');
      if (page.anomalous) this.state.set('fax_anomalous', true);
    }
    bus.emit(EVENTS.FAX, { page: doc, unread: this.tray.length });
    setTimeout(() => { this.printing = false; }, 3800);
    return doc;
  }

  /** Walk over and pick the pages up. Returns what was in the tray. */
  collect() {
    if (!this.tray.length) return [];
    const got = this.tray.slice();
    this.read.push(...got);
    this.tray.length = 0;
    for (const p of got) {
      if (p.flag && this.state) this.state.set(p.flag, true);
      if (this.state && this.clock) {
        this.state.log(this.clock.stamp(), `Fax: ${p.subject}`, p.anomalous ? 'anomaly' : 'note');
      }
    }
    bus.emit(EVENTS.FAX, { collected: got.length, unread: 0 });
    return got;
  }

  /** Everything the player has picked up, newest first -- the fax spike. */
  spike() { return this.read.slice().reverse(); }

  serialize() { return { tray: this.tray, read: this.read.map((p) => p.id) }; }
  restore(d, library) {
    if (!d) return;
    this.tray = d.tray || [];
    this.read = (d.read || []).map((id) => (library ? library.find((p) => p.id === id) : { id })).filter(Boolean);
  }
}
