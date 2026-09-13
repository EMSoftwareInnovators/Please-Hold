/* ============================================================
   radio.js -- the two-way.

   Traffic is a queue, not a conversation tree: crews key up, say
   their piece, and unkey. The player can key up in reply, which
   is how dispatching actually happens (see dispatch.js).

   Every transmission carries a real audio treatment -- squelch
   open, the voice through the radio band, squelch tail -- so the
   radio sounds like a different device from the telephone. Late
   in the shift that difference stops being reliable, which is
   why `interference` exists.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

export class RadioSystem {
  constructor({ audio, clock, state }) {
    this.audio = audio;
    this.clock = clock;
    this.state = state;
    this.queue = [];
    this.current = null;
    this.history = [];
    this.channel = 1;               // 1 = OPS, 2 = LINE, 3 = MUTUAL AID
    this.interference = 0;          // 0..1, raised by the horror director
    this.vu = 0;                    // what the needle shows
    this._timer = 0;
  }

  /**
   * Queue a transmission from a unit.
   * @param {string} from   crew id, or 'DISPATCH' for the player
   * @param {string} text
   */
  transmit(from, text, opts = {}) {
    const t = {
      from,
      text,
      at: this.clock ? this.clock.stamp() : '',
      delay: opts.delay ?? 0,
      voice: opts.voice || voiceFor(from),
      channel: opts.channel ?? this.channel,
      effect: opts.effect || null,
      id: `${from}-${this.history.length}-${Math.random().toString(36).slice(2, 7)}`,
    };
    this.queue.push(t);
    return t;
  }

  /** The player keys up. Short, and it blocks the channel while it plays. */
  keyUp(text, opts = {}) {
    return this.transmit('DISPATCH', text, { ...opts, delay: 0, voice: 'player' });
  }

  update(dt) {
    this.vu *= Math.max(0, 1 - dt * 4);
    if (this.current) {
      this._timer -= dt;
      this.vu = Math.min(1, 0.35 + Math.abs(Math.sin(this._timer * 11)) * 0.6);
      if (this._timer <= 0) this._endCurrent();
      return;
    }
    if (!this.queue.length) return;
    const next = this.queue[0];
    if (next.delay > 0) { next.delay -= dt; return; }
    this.queue.shift();
    this._begin(next);
  }

  _begin(t) {
    this.current = t;
    this.history.push(t);
    if (this.history.length > 120) this.history.shift();

    const effect = t.effect || (this.interference > 0.5 ? 'evp' : this.interference > 0.15 ? 'degraded' : 'clean');
    if (this.audio) {
      this.audio.play('squelchOpen', { volume: 0.8 });
      const spoken = this.audio.speak(t.text, {
        voice: t.voice,
        line: effect,
        bus: 'radio',
        onEnd: () => { /* timing is driven by the returned duration */ },
      });
      this._timer = (spoken && spoken.duration ? spoken.duration : estimateSeconds(t.text)) + 0.25;
      this._spoken = spoken;
    } else {
      this._timer = estimateSeconds(t.text) + 0.25;
    }
    bus.emit(EVENTS.RADIO_TRAFFIC, { ...t, state: 'begin', effect });
  }

  _endCurrent() {
    const t = this.current;
    this.current = null;
    this._spoken = null;
    if (this.audio) this.audio.play('squelchClose', { volume: 0.55 });
    bus.emit(EVENTS.RADIO_TRAFFIC, { ...t, state: 'end' });
  }

  /** Drop everything in flight -- used when the power goes. */
  silence() {
    this.queue.length = 0;
    if (this._spoken) this._spoken.stop();
    this.current = null;
    this._spoken = null;
  }

  setChannel(n) {
    this.channel = Math.max(1, Math.min(3, n));
    if (this.audio) this.audio.play('radioBeep');
    return this.channel;
  }

  get busy() { return !!this.current; }
  get lastFrom() { return this.current ? this.current.from : (this.history.length ? this.history[this.history.length - 1].from : null); }
}

function voiceFor(from) {
  return { T7: 'halloran', T12: 'sikes', L3: 'ott', DISPATCH: 'player' }[from] || 'neutral';
}

function estimateSeconds(text) {
  const words = String(text || '').trim().split(/\s+/).length;
  return Math.max(1.0, words * 0.34);
}
