/* ============================================================
   horror.js -- the events, and the rules about using them.

   Every scare in the game is a named entry in EVENTS below, fired
   by a call script with { op:'horror', event:'...' } or by the
   director at a story beat. Nothing here is a jump scare: each
   event is a thing the BUILDING does, and the building is the
   only character the player can see.

   The escalation is deliberate. Early events have an innocent
   reading -- a storm browns out the lights, a CRT in a 1962
   building glitches, a cheap wall clock runs slow. Later events
   remove the innocent reading one at a time, and the last few
   cannot be explained at all. A game that stays ambiguous
   forever has not said anything; the design brief is explicit
   about that, and so is this file.

   ADDING AN EVENT: add a key to EVENTS. `fire()` gives you every
   system and a `t` that counts seconds since the event started.
   Return false from update() when you are done.
   ============================================================ */
import { bus, EVENTS as BUS } from '../engine/bus.js';

/**
 * Each entry is { start(ctx), update(ctx, t, dt) -> bool, end(ctx) }.
 * `ctx` carries { lighting, post, audio, clock, state, phone, radio,
 *                 database, outages, terminal, world, args }.
 */
export const HORROR = {

  /* ---------- tier 1: the storm could be doing this ---------- */

  flicker: {
    duration: 2.2,
    start(c) {
      c.lighting.stutterAll(c.now, c.args.duration ?? 2.0);
      c.audio && c.audio.play('breaker', { volume: 0.4 });
    },
  },

  brownout: {
    duration: 7,
    start(c) {
      c.lighting.setPower(c.args.to ?? 0.42);
      c.audio && c.audio.play('breaker', { volume: 0.6 });
      bus.emit(BUS.POWER, { level: c.args.to ?? 0.42 });
    },
    end(c) {
      c.lighting.setPower(1);
      bus.emit(BUS.POWER, { level: 1 });
    },
  },

  blackout: {
    duration: 5.5,
    start(c) {
      c.lighting.setPower(0, true);
      c.audio && c.audio.play('breaker', { volume: 0.9 });
      c.audio && c.audio.stopLoop('fluorescent', 0.1);
      if (c.terminal) c.terminal.setPower(false);
      bus.emit(BUS.POWER, { level: 0 });
    },
    update(c, t) {
      // The emergency light over the corridor door is the only thing left.
      c.post.grade.exposure.value = 0.95 + Math.sin(t * 2) * 0.02;
      return true;
    },
    end(c) {
      c.lighting.setPower(1);
      c.audio && c.audio.loop('fluorescent', { volume: 0.5 });
      if (c.terminal) c.terminal.setPower(true);
      c.audio && c.audio.play('crtDegauss');
      bus.emit(BUS.POWER, { level: 1 });
    },
  },

  strike: {
    duration: 1.0,
    start(c) {
      c.lighting.strike(c.now, c.args.strength ?? 1.2);
      c.audio && c.audio.play('thunder', { distance: c.args.distance ?? 0.08, volume: 1 });
    },
  },

  /* ---------- tier 2: something is wrong with the equipment ---------- */

  crtGlitch: {
    duration: 3.0,
    start(c) {
      if (c.terminal) c.terminal.glitch(c.args.severity ?? 0.6, c.args.duration ?? 3.0);
      c.audio && c.audio.play('crtDegauss', { volume: 0.5 });
    },
  },

  /** The two wall clocks stop agreeing. Nobody points it out. */
  clockDrift: {
    duration: 0.1,
    start(c) {
      const by = c.args.minutes ?? -17;
      c.world.clockOffset = (c.world.clockOffset || 0) + by;
      c.state.set('saw_clock_drift', true);
    },
  },

  /** The radio picks up something that is not on the channel. */
  radioBleed: {
    duration: 9,
    start(c) {
      c.radio.interference = c.args.level ?? 0.8;
      c.audio && c.audio.loop('radioStatic', { volume: 0.18 });
      if (c.args.text) c.radio.transmit(c.args.from || '——', c.args.text, { effect: 'evp', delay: 1.4 });
    },
    end(c) {
      c.radio.interference = 0;
      c.audio && c.audio.stopLoop('radioStatic', 0.6);
    },
  },

  /* ---------- tier 3: no innocent reading is left ---------- */

  /** A line rings with nothing behind it. Answering it is the point. */
  phantomRing: {
    duration: 16,
    start(c) {
      c._line = c.phone.freeLine();
      if (!c._line) return;
      c.phone.ring({
        id: `__phantom_${Date.now()}`,
        caller: { id: 'phantom', name: '———', display: '', number: '', voice: 'whisper', line: 'evp' },
        category: 'anomaly',
        rings: 6,
        nodes: { start: { speaker: 'caller', lines: [{ text: c.args.text || '...' }], end: true } },
      });
    },
  },

  /** The grade itself starts losing signal. */
  degrade: {
    duration: 12,
    start(c) { c._from = { ...readGrade(c.post) }; },
    update(c, t) {
      const k = Math.min(1, t / 2.5) * (c.args.amount ?? 1);
      const g = c.post.grade;
      g.saturation.value = lerp(c._from.saturation, 0.28, k);
      g.vignette.value = lerp(c._from.vignette, 1.05, k);
      g.aberration.value = lerp(c._from.aberration, 0.075, k);
      g.grain.value = lerp(c._from.grain, 0.13, k);
      g.scanline.value = k * 0.85;
      g.warp.value = k * 0.055;
      return true;
    },
    end(c) { restoreGrade(c.post, c._from, 2.0); },
  },

  /** The room dims to nothing but the tube. */
  tunnel: {
    duration: 10,
    start(c) {
      c._from = { ...readGrade(c.post) };
      c.lighting.setPower(0.06);
    },
    update(c, t) {
      const k = Math.min(1, t / 3);
      c.post.grade.vignette.value = lerp(c._from.vignette, 1.5, k);
      c.post.grade.exposure.value = lerp(c._from.exposure, 0.72, k);
      return true;
    },
    end(c) {
      c.lighting.setPower(1);
      restoreGrade(c.post, c._from, 2.5);
    },
  },

  /** Records change while you are not looking at them. */
  recordRot: {
    duration: 0.1,
    start(c) {
      const ids = c.args.ids || [];
      for (const id of ids) c.database.corrupt(id, c.args.kind || 'dateshift', c.args.value);
      if (c.terminal) c.terminal.markStale();
    },
  },

  /** A feeder that is not in the system appears on the map. */
  ghostFeeder: {
    duration: 0.1,
    start(c) {
      c.world.ghostFeeders = c.world.ghostFeeders || [];
      c.world.ghostFeeders.push(c.args.feeder || 'DV-01');
      if (c.terminal) c.terminal.markStale();
      c.state.set('saw_ghost_feeder', true);
    },
  },

  /** Time stops meaning what it meant. */
  timeSlip: {
    duration: 0.1,
    start(c) {
      if (c.args.to != null) c.clock.set(c.args.to, { silent: true });
      else c.clock.advance(c.args.by ?? -22);
      c.state.set('saw_time_slip', true);
      c.audio && c.audio.play('crtDegauss', { volume: 0.35 });
    },
  },

  /** Everything at once, for the end of the slice. */
  cascade: {
    duration: 14,
    start(c) {
      c._from = { ...readGrade(c.post) };
      c.radio.interference = 1;
      c.audio && c.audio.loop('radioStatic', { volume: 0.22 });
      c.audio && c.audio.play('thunder', { distance: 0.02, volume: 1 });
      c.lighting.strike(c.now, 1.6);
    },
    update(c, t, dt) {
      const g = c.post.grade;
      // three collapsing waves, each one taking more of the picture
      const wave = Math.sin(t * 1.35) * 0.5 + 0.5;
      c.lighting.setPower(t > 11 ? 0 : 0.25 + wave * 0.55, true);
      g.saturation.value = 0.85 - Math.min(0.65, t / 14);
      g.aberration.value = 0.012 + wave * 0.09;
      g.scanline.value = Math.min(1, t / 5) * (0.4 + wave * 0.6);
      g.warp.value = Math.min(0.09, t / 90) + wave * 0.02;
      g.grain.value = 0.03 + Math.min(0.14, t / 80);
      if (Math.random() < dt * 2.2) c.lighting.stutterAll(c.now, 0.4);
      if (Math.random() < dt * 0.6) c.audio && c.audio.play('breaker', { volume: 0.3 });
      return true;
    },
    end(c) {
      c.radio.interference = 0;
      c.audio && c.audio.stopLoop('radioStatic', 0.4);
      restoreGrade(c.post, c._from, 0.1);
      c.lighting.setPower(0, true);
    },
  },
};

const lerp = (a, b, t) => a + (b - a) * t;

function readGrade(post) {
  const g = post.grade;
  return {
    saturation: g.saturation.value,
    vignette: g.vignette.value,
    aberration: g.aberration.value,
    grain: g.grain.value,
    exposure: g.exposure.value,
  };
}

function restoreGrade(post, from, seconds) {
  const g = post.grade;
  const start = readGrade(post);
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
    g.saturation.value = lerp(start.saturation, from.saturation, k);
    g.vignette.value = lerp(start.vignette, from.vignette, k);
    g.aberration.value = lerp(start.aberration, from.aberration, k);
    g.grain.value = lerp(start.grain, from.grain, k);
    g.exposure.value = lerp(start.exposure, from.exposure, k);
    g.scanline.value = lerp(g.scanline.value, 0, k);
    g.warp.value = lerp(g.warp.value, 0, k);
    if (k < 1) requestAnimationFrame(step);
  };
  step();
}

export class HorrorDirector {
  constructor(systems) {
    this.systems = systems;          // lighting, post, audio, clock, state, phone, radio, database, outages, world
    this.running = [];
    this.history = [];
  }

  /** Start a named event. Safe to call for an unknown name. */
  fire(name, args = {}) {
    const def = HORROR[name];
    if (!def) { console.warn(`horror: unknown event "${name}"`); return null; }
    const ctx = {
      ...this.systems,
      args,
      now: this.systems.clock ? performance.now() / 1000 : 0,
    };
    const inst = { name, def, ctx, t: 0, duration: args.duration ?? def.duration ?? 1 };
    try { def.start && def.start(ctx); } catch (err) { console.error(`horror "${name}" start:`, err); }
    this.running.push(inst);
    this.history.push({ name, at: Date.now() });
    if (this.systems.state) this.systems.state.set(`horror:${name}`, true);
    bus.emit(BUS.HORROR, { name, args });
    return inst;
  }

  update(dt) {
    for (let i = this.running.length - 1; i >= 0; i--) {
      const inst = this.running[i];
      inst.t += dt;
      inst.ctx.now = performance.now() / 1000;
      let keep = true;
      if (inst.def.update) {
        try { keep = inst.def.update(inst.ctx, inst.t, dt) !== false; } catch (err) { console.error(err); keep = false; }
      }
      if (!keep || inst.t >= inst.duration) {
        try { inst.def.end && inst.def.end(inst.ctx); } catch (err) { console.error(err); }
        this.running.splice(i, 1);
      }
    }
  }

  get active() { return this.running.map((r) => r.name); }

  /** Stop everything and put the picture back. Used when a shift ends. */
  clearAll() {
    for (const inst of this.running) {
      try { inst.def.end && inst.def.end(inst.ctx); } catch { /* ignore */ }
    }
    this.running.length = 0;
  }
}

export const HORROR_NAMES = Object.keys(HORROR);
