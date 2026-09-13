/* ============================================================
   settings.js -- player options, persisted to localStorage.

   Kept deliberately small and flat. Anything that changes how
   the game LOOKS or SOUNDS belongs here; anything that changes
   what happens belongs in state.js.
   ============================================================ */

const KEY = 'pleasehold.settings.v1';

export const DEFAULTS = {
  masterVolume: 0.85,
  musicVolume: 0.6,
  voiceVolume: 1.0,
  mouseSensitivity: 1.0,
  invertY: false,
  renderScale: 1.0,
  filmGrain: true,
  headBob: true,
  subtitles: true,
  // Accessibility: some horror beats lean on flicker. This caps it.
  reduceFlicker: false,
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
