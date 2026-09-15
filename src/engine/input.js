/* ============================================================
   input.js -- keyboard, mouse, pointer lock and gamepads.

   Pad buttons are folded into the same key set everything else
   reads, so `held('answer')` is true whether the player pressed
   F or Y and no game code knows the difference. The table lives
   in controls.js.

   -------------------------------------------------------------
   POINTER LOCK, AND THE LOOP IT USED TO CAUSE

   Chrome refuses a pointer-lock request for about a second after
   exitPointerLock(). The first version treated any unlock while
   in world mode as "the player pressed Esc to get their cursor
   back" and paused the game. So: leave the terminal -> request
   lock -> denied by the cooldown -> unlock event -> pause menu ->
   close it -> request lock -> denied -> pause menu -> ... until
   the cooldown expired. It looked like the pause menu having a
   seizure, and that is exactly what it was.

   Losing the lock is now just a fact to report, not an event
   that changes game state. The game pauses when the player asks
   it to and at no other time; if the lock is gone, the HUD says
   so and the next click takes it back.
   ============================================================ */
import { ACTIONS, PAD_BUTTONS, SCREEN_KEYS, REPEATABLE, schemeFor } from './controls.js';

export const MODE = { WORLD: 'world', UI: 'ui', MENU: 'menu' };

/* A stick is not a key, so menu navigation off one needs an explicit edge:
   push past NAV_ON to fire, fall back under NAV_OFF before it can fire
   again, and hold it to repeat at a readable rate. */
const NAV_ON = 0.55;
const NAV_OFF = 0.35;
const NAV_DELAY = 400;      // ms before a held direction repeats
const NAV_REPEAT = 140;     // ms between repeats after that
const DEAD = 0.18;          // stick deadzone
const TRIGGER = 0.35;       // analog trigger press point
/* Chrome refuses a pointer-lock request for roughly a second after an exit.
   Asking again a little slower than that gets the camera back on its own. */
const LOCK_RETRY = 0.7;     // seconds between automatic re-lock attempts

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = MODE.MENU;
    this.down = new Set();
    this.pressed = new Set();       // consumed once per frame
    this.mouse = { dx: 0, dy: 0 };
    this.locked = false;
    this.wantsLock = false;
    /** True when we want the pointer but do not have it. The HUD says so. */
    this.lockBlocked = false;
    /** Seconds until the next automatic re-lock attempt. See _retryLock. */
    this._lockRetry = 0;
    this.listeners = { key: [], click: [] };

    /** 'kbm' until a pad is actually used, then 'xbox' or 'playstation'. */
    this.scheme = 'kbm';
    this.padId = '';
    this.padConnected = false;
    this._padIndex = -1;
    this._padDown = new Set();
    this._navAt = { up: 0, down: 0, left: 0, right: 0 };
    this._navHeld = { up: false, down: false, left: false, right: false };
    this.padLook = { x: 0, y: 0 };
    this.padMove = { x: 0, y: 0 };
    this.padSensitivity = 2.6;      // radians per second at full deflection

    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) {
        // Only editing and list keys auto-repeat. Everything else firing
        // sixty times a second is how a held ESC used to strobe the menu.
        if (this.mode !== MODE.WORLD && REPEATABLE.has(e.key)) this._emitKey(e);
        return;
      }
      this.scheme = 'kbm';
      this.down.add(e.code);
      this.pressed.add(e.code);
      this._emitKey(e);
      if (this.mode === MODE.WORLD && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
      if (this.mode === MODE.UI && ['Tab', 'Space', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'].includes(e.code)) {
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this._padDown.clear(); });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.lockBlocked = this.wantsLock && !this.locked;
      // Reported, never acted on. See the note at the top of this file.
      for (const fn of this.listeners.click) fn({ type: this.locked ? 'lock' : 'unlock' });
    });
    document.addEventListener('pointerlockerror', () => {
      this.lockBlocked = this.wantsLock;
    });

    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });

    /* A click is a user gesture, which is exactly what a denied lock is
       waiting for -- and it must count wherever it lands. Listening only on
       the canvas meant that while a call panel was on screen, every click hit
       the panel and the camera never came back. Capture phase, on the
       document, so no UI layer can swallow the one gesture we need. */
    document.addEventListener('mousedown', (e) => {
      if (this.wantsLock && !this.locked) this.requestLock();
      if (e.target === this.canvas) {
        for (const fn of this.listeners.click) fn({ type: 'down', button: e.button });
      }
    }, true);

    addEventListener('gamepadconnected', (e) => {
      this.padConnected = true;
      this.padId = (e.gamepad && e.gamepad.id) || '';
    });
    addEventListener('gamepaddisconnected', () => {
      this.padConnected = false;
      this._padDown.clear();
    });
  }

  _emitKey(e) { for (const fn of this.listeners.key) fn(e); }
  onKey(fn) { this.listeners.key.push(fn); return this; }
  onClick(fn) { this.listeners.click.push(fn); return this; }

  /* ============================================================
     MODE AND POINTER LOCK
     ============================================================ */
  setMode(mode) {
    this.mode = mode;
    this.wantsLock = mode === MODE.WORLD;
    if (this.wantsLock) { this._lockRetry = 0; this.requestLock(); }
    else { this.lockBlocked = false; this._lockRetry = 0; this.releaseLock(); }
  }

  /**
   * Getting the pointer back after the terminal closes.
   *
   * The browser refuses a lock request for about a second after an exit, and
   * that first refusal used to be the end of it: the camera stayed dead until
   * the player thought to click. Since the exit was ours (page-initiated, not
   * the player pressing Esc), the browser will hand the lock straight back
   * once the cooldown passes -- so keep asking, quietly, instead of waiting to
   * be rescued by a click.
   */
  _retryLock(dt) {
    if (!this.wantsLock || this.locked || document.pointerLockElement) {
      this._lockRetry = 0;
      return;
    }
    this._lockRetry -= dt;
    if (this._lockRetry > 0) return;
    this._lockRetry = LOCK_RETRY;
    this.requestLock();
  }

  requestLock() {
    if (this.locked || !this.wantsLock) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      // A rejected promise is the cooldown talking, not an error worth
      // surfacing. The next click will get it.
      if (p && p.catch) p.catch(() => { this.lockBlocked = true; });
    } catch { this.lockBlocked = true; }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** True when the player is in the world but the mouse is not captured. */
  get needsClickToLook() { return this.wantsLock && !this.locked; }

  /* ============================================================
     QUERIES -- actions, not keys
     ============================================================ */
  held(action) {
    const a = ACTIONS[action];
    if (!a) return false;
    return a.keys.some((k) => this.down.has(k));
  }
  tapped(action) {
    const a = ACTIONS[action];
    if (!a) return false;
    return a.keys.some((k) => this.pressed.has(k));
  }
  /** Raw key-name test, for the few places that want one specific key. */
  key(code) { return this.down.has(code); }

  /** Which terminal screen index a keypress asks for, or -1. */
  screenIndex(e) {
    for (let i = 0; i < SCREEN_KEYS.length; i++) {
      if (SCREEN_KEYS[i].includes(e.code) || SCREEN_KEYS[i].includes(e.key)) return i;
    }
    return -1;
  }

  /** The movement snapshot the player controller wants. */
  get axes() {
    let x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let z = (this.held('forward') ? 1 : 0) - (this.held('back') ? 1 : 0);
    if (!x && !z) { x = this.padMove.x; z = this.padMove.y; }
    return {
      forward: z > 0.1, back: z < -0.1, left: x < -0.1, right: x > 0.1,
      x, z, run: this.held('run'),
    };
  }

  /** Consume this frame's accumulated mouse deltas. */
  takeMouse() {
    const m = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0; this.mouse.dy = 0;
    return m;
  }

  /* ============================================================
     GAMEPAD
     Polled once a frame and folded into the key sets, so a pad
     press is indistinguishable from the keyboard downstream.
     ============================================================ */
  poll(dt) {
    this._retryLock(dt);
    this.padMove.x = 0; this.padMove.y = 0;
    this.padLook.x = 0; this.padLook.y = 0;

    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let pad = this._padIndex >= 0 ? pads[this._padIndex] : null;
    if (!pad || !pad.connected) {
      pad = null;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) { pad = pads[i]; this._padIndex = i; break; }
      }
    }
    if (!pad) {
      for (const k of this._padDown) this.down.delete(k);
      this._padDown.clear();
      return;
    }
    if (pad.id !== this.padId) { this.padId = pad.id; this.padConnected = true; }

    /* A pad the browser will not vouch for has whatever button order the
       driver felt like. Laying the standard table over it is worse than
       laying nothing over it -- it does not fail to act, it acts wrongly --
       so an unmapped pad drives menus and nothing else. */
    const standard = pad.mapping === 'standard';
    let used = false;

    const press = (name, isDown) => {
      if (isDown) {
        if (!this._padDown.has(name)) { this.pressed.add(name); this._padDown.add(name); }
        this.down.add(name);
        used = true;
      } else if (this._padDown.has(name)) {
        this._padDown.delete(name);
        this.down.delete(name);
      }
    };

    const buttons = pad.buttons || [];
    if (standard) {
      for (const [idx, name] of Object.entries(PAD_BUTTONS)) {
        const b = buttons[idx];
        if (!b) continue;
        const isDown = typeof b === 'object' ? (b.pressed || b.value > TRIGGER) : b > TRIGGER;
        press(name, isDown);
      }
    } else {
      // Unmapped: every button is a confirm, so menus still work.
      const any = buttons.some((b) => (typeof b === 'object' ? b.pressed : b > TRIGGER));
      press('PadA', any);
    }

    const ax = pad.axes || [];
    const curve = (v) => {
      const a = Math.abs(v);
      if (a < DEAD) return 0;
      const t = (a - DEAD) / (1 - DEAD);
      return Math.sign(v) * t * t;      // squared: fine control near center
    };

    // left stick moves, right stick looks
    const mx = curve(ax[0] || 0), my = curve(ax[1] || 0);
    this.padMove.x = mx;
    this.padMove.y = -my;               // stick down is +1; forward is -1
    if (mx || my) used = true;

    const lx = curve(ax[2] || 0), ly = curve(ax[3] || 0);
    if (lx || ly) {
      used = true;
      // Delivered as mouse-equivalent deltas so the look code stays one path.
      const k = this.padSensitivity * (dt || 0.016) * 520;
      this.padLook.x = lx * k;
      this.padLook.y = ly * k;
      this.mouse.dx += this.padLook.x;
      this.mouse.dy += this.padLook.y;
    }

    /* Menu navigation off the left stick, with an edge and a repeat, so a
       held stick scrolls a list at a readable rate instead of instantly. */
    const now = performance.now();
    const nav = (dir, value) => {
      const on = value > NAV_ON;
      const off = value < NAV_OFF;
      const code = { up: 'PadUp', down: 'PadDown', left: 'PadLeft', right: 'PadRight' }[dir];
      if (on) {
        if (!this._navHeld[dir]) {
          this._navHeld[dir] = true;
          this._navAt[dir] = now + NAV_DELAY;
          this.pressed.add(code);
          this.down.add(code);
          used = true;
        } else if (now >= this._navAt[dir]) {
          this._navAt[dir] = now + NAV_REPEAT;
          this.pressed.add(code);
          used = true;
        }
      } else if (off && this._navHeld[dir]) {
        this._navHeld[dir] = false;
        if (!this._padDown.has(code)) this.down.delete(code);
      }
    };
    nav('up', -(ax[1] || 0));
    nav('down', ax[1] || 0);
    nav('left', -(ax[0] || 0));
    nav('right', ax[0] || 0);

    if (used && this.scheme === 'kbm') this.scheme = schemeFor(pad.id);
  }

  /** Pad directions have to reach whatever is reading keydown events. */
  flushPadKeys(handler) {
    for (const name of this.pressed) {
      if (!name.startsWith('Pad')) continue;
      handler({ code: name, key: name, preventDefault() {}, fromPad: true });
    }
  }

  endFrame() { this.pressed.clear(); }
}
