/* ============================================================
   input.js -- keyboard, mouse and pointer lock.

   Two modes, because the game has two: WORLD (pointer locked,
   WASD, look with the mouse) and UI (pointer free, the cursor
   works, keys go to whatever panel is open -- the terminal, the
   dialogue choices, the menu).

   The mode switch is explicit rather than inferred. A dispatcher
   reading a CRT is not steering, and a game that keeps stealing
   the pointer back mid-sentence is unusable.
   ============================================================ */

export const MODE = { WORLD: 'world', UI: 'ui', MENU: 'menu' };

/** Default bindings. Held in one table so a rebind screen is a small job. */
export const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  use: ['KeyE', 'Enter'],
  answer: ['KeyF'],
  hold: ['KeyH'],
  hangup: ['KeyX'],
  terminal: ['KeyT'],
  radio: ['KeyR'],
  log: ['KeyL'],
  stand: ['KeyQ'],
  pause: ['Escape'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = MODE.MENU;
    this.down = new Set();
    this.pressed = new Set();        // consumed once per frame
    this.mouse = { dx: 0, dy: 0, left: false };
    this.locked = false;
    this.listeners = { key: [], click: [] };
    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) {
        // Repeat still reaches UI panels (holding backspace in a search box).
        if (this.mode !== MODE.WORLD) this._emitKey(e);
        return;
      }
      this.down.add(e.code);
      this.pressed.add(e.code);
      this._emitKey(e);
      // Stop the browser scrolling the page out from under a locked pointer.
      if (this.mode === MODE.WORLD && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
      if (this.mode === MODE.UI && ['Tab', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.mode === MODE.WORLD) {
        for (const fn of this.listeners.click) fn({ type: 'unlock' });
      }
    });

    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      for (const fn of this.listeners.click) fn({ type: 'down', button: e.button });
    });
  }

  _emitKey(e) {
    for (const fn of this.listeners.key) fn(e);
  }

  onKey(fn) { this.listeners.key.push(fn); return this; }
  onClick(fn) { this.listeners.click.push(fn); return this; }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === MODE.WORLD) this.requestLock();
    else this.releaseLock();
  }

  requestLock() {
    if (this.locked) return;
    const p = this.canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** True while any key bound to `action` is held. */
  held(action) {
    const keys = BINDINGS[action] || [];
    return keys.some((k) => this.down.has(k));
  }
  /** True once, on the frame the key went down. */
  tapped(action) {
    const keys = BINDINGS[action] || [];
    return keys.some((k) => this.pressed.has(k));
  }

  /** The movement snapshot the player controller wants. */
  get axes() {
    return {
      forward: this.held('forward'), back: this.held('back'),
      left: this.held('left'), right: this.held('right'),
      run: this.held('run'),
    };
  }

  /** Consume this frame's accumulated deltas. */
  takeMouse() {
    const m = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0; this.mouse.dy = 0;
    return m;
  }

  endFrame() { this.pressed.clear(); }
}
