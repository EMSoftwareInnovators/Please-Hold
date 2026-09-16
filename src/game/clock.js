/* ============================================================
   clock.js -- the shift clock.

   Time is kept in MINUTES SINCE MIDNIGHT as a float, so 23:14 is
   1394. The shift starts at 22:45 and is scheduled to end at
   06:00, which is 1365 -> 1800 counting past midnight.

   One minute of shift time is `secondsPerMinute` seconds of real
   time. That number is a dial, not a constant, because several
   horror events work by lying about it: time can stall, jump,
   or (once) run backwards, and everything downstream -- the wall
   clocks, the terminal header, the call scheduler -- reads from
   here and inherits the lie.
   ============================================================ */
import { bus, EVENTS } from '../engine/bus.js';

export const SHIFT_START = 22 * 60 + 45;      // 22:45
export const SHIFT_END = 30 * 60;             // 06:00 next day

export class GameClock {
  constructor(opts = {}) {
    this.minutes = opts.start ?? SHIFT_START;
    /* 8.5 real seconds per shift minute. The shift is 22:45 -> 06:00, which
       is 435 minutes, which is a little over an hour of real time -- and the
       night now has enough calls, dispatch work, walking, paperwork and
       quiet in it to fill that honestly rather than by making the player
       wait. The vertical slice ran at 2.2 and finished in twenty minutes;
       at this rate the same content would be a third of a night. */
    this.secondsPerMinute = opts.secondsPerMinute ?? 8.5;
    this.running = false;
    this.scale = 1;                  // horror director's time-dilation dial
    this._acc = 0;
    this._lastMinute = Math.floor(this.minutes);
    /** When set, the wall clocks read this instead of the true time. */
    this.displayOffset = 0;
  }

  start() { this.running = true; }
  stop() { this.running = false; }

  update(dt) {
    if (!this.running) return;
    this._acc += dt * this.scale;
    const per = this.secondsPerMinute;
    while (this._acc >= per) {
      this._acc -= per;
      this.minutes += 1;
      bus.emit(EVENTS.MINUTE, { minutes: this.minutes, label: this.label() });
    }
  }

  /** Jump the clock. Used by the story and by things that are not the story. */
  set(minutes, { silent = false } = {}) {
    this.minutes = minutes;
    if (!silent) bus.emit(EVENTS.MINUTE, { minutes: this.minutes, label: this.label() });
  }
  advance(mins) { this.set(this.minutes + mins); }

  /** True time, 0..1439, wrapping past midnight. */
  get wallMinutes() { return ((Math.floor(this.minutes) % 1440) + 1440) % 1440; }
  /** What the CLOCKS ON THE WALL say, which is not always the same thing. */
  get displayMinutes() { return ((Math.floor(this.minutes + this.displayOffset) % 1440) + 1440) % 1440; }

  /** The date, which is 11 November 1999 until it is the 12th. */
  dateLabel() {
    return this.minutes >= 24 * 60 ? '12 NOV 1999' : '11 NOV 1999';
  }

  label(minutes = this.wallMinutes) {
    const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
    const h24 = Math.floor(m / 60), mm = m % 60;
    const h = h24 % 12 === 0 ? 12 : h24 % 12;
    const ampm = h24 < 12 ? 'AM' : 'PM';
    return `${h}:${String(mm).padStart(2, '0')} ${ampm}`;
  }

  /** 24-hour form, which is what the terminal and the work orders use. */
  stamp(minutes = this.wallMinutes) {
    const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;
  }

  /** How far into the shift we are, 0..1. */
  get progress() {
    return Math.max(0, Math.min(1, (this.minutes - SHIFT_START) / (SHIFT_END - SHIFT_START)));
  }

  serialize() { return { minutes: this.minutes, displayOffset: this.displayOffset, scale: this.scale }; }
  restore(d) { if (!d) return; this.minutes = d.minutes; this.displayOffset = d.displayOffset || 0; this.scale = d.scale ?? 1; }
}
