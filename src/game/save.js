/* ============================================================
   save.js -- checkpoint save/restore.

   PLEASE HOLD saves at story beats rather than continuously: a
   shift is a single sitting, and a mid-call save would need to
   serialize a running conversation. Each checkpoint captures the
   clock, the flags, the work (outages, crews) and the caller
   memory, which is enough to resume at the top of the next beat.
   ============================================================ */

const KEY = 'pleasehold.save.v1';

export class SaveSystem {
  constructor(game) { this.game = game; }

  /** Gather a snapshot from every system that owns persistent state. */
  snapshot(label = 'checkpoint') {
    const g = this.game;
    return {
      version: 1,
      label,
      savedAt: Date.now(),
      clock: g.clock.serialize(),
      state: g.gameState.serialize(),
      outages: g.outages.serialize(),
      crews: g.crews.serialize(),
      database: g.database.serialize(),
      director: g.director.serialize(),
      player: g.player ? g.player.serialize() : null,
    };
  }

  save(label) {
    const snap = this.snapshot(label);
    try {
      localStorage.setItem(KEY, JSON.stringify(snap));
      return true;
    } catch (err) {
      console.warn('save failed:', err);
      return false;
    }
  }

  peek() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /** Restore into the live systems. Returns false if there is nothing to load. */
  load() {
    const snap = this.peek();
    if (!snap || snap.version !== 1) return false;
    const g = this.game;
    g.clock.restore(snap.clock);
    g.gameState.restore(snap.state);
    g.outages.restore(snap.outages);
    g.crews.restore(snap.crews);
    g.database.restore(snap.database);
    g.director.restore(snap.director);
    if (snap.player && g.player) g.player.restore(snap.player);
    return true;
  }

  clear() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}
