/* ============================================================
   settings.js -- player options, persisted to localStorage.

   Kept deliberately small and flat. Anything that changes how
   the game LOOKS or SOUNDS belongs here; anything that changes
   what happens belongs in state.js.
   ============================================================ */

const KEY = 'pleasehold.settings.v1';

export const DEFAULTS = {
  // audio
  masterVolume: 0.8,
  ambienceVolume: 0.55,     // rain and room tone; the loudest thing by default
  voiceVolume: 1.0,
  musicVolume: 0.5,         // hold music
  roomTone: true,           // the ballast hum and the CRT's flyback whine

  // controls
  mouseSensitivity: 1.0,
  invertY: false,
  headBob: true,

  // display -- see src/engine/quality.js for what a preset costs
  quality: null,            // null = pick one on first run
  pixelRatio: 1,            // 1 even on Retina. Deliberate; see renderer.js.
  adaptiveQuality: true,    // let the renderer shed resolution to hold 60
  filmGrain: true,

  // accessibility
  reduceFlicker: false,     // caps the strobing in the power-failure events
  subtitles: true,
  textSpeed: 1.0,
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    this.load();
  }
  get(k) { return this.values[k]; }
  set(k, v) { this.values[k] = v; this.save(); return v; }
  reset() { this.values = { ...DEFAULTS }; this.save(); }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch { /* private mode, or no storage; defaults are fine */ }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* ignore */ }
  }
}
