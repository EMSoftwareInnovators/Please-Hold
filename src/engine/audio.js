/* ============================================================
   audio.js -- the whole sound of the building, synthesized.

   There are no audio files in this repository yet. Everything
   below is generated with WebAudio: the rain, the ballast hum,
   the ring, the dial tone, the hold music, the radio squelch,
   and the voices.

   Two things here are load-bearing for the horror and are built
   as real signal chains rather than as labels:

   1. LINE EFFECTS. Every voice goes through a telephone chain
      chosen per call: `clean` is a 300-3400Hz band; `era1978`
      adds tape flutter and 60Hz hum; `era1956` is a narrow,
      overdriven carbon-microphone sound; `evp` is noise-bedded,
      ring-modulated and gated. A caller from 1956 does not just
      SAY it is 1956 -- the line sounds like 1956.

   2. VOICES. speak() drives a small formant synthesizer from the
      text, so every line has real timing and real prosody. Each
      character has a voice profile (pitch, formant shift, rate,
      breath, gravel). When recorded dialogue arrives, a line's
      `voice:` path is played instead and NOTHING else changes --
      see `registerClip()`.
   ============================================================ */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ============================================================
   VOICE PROFILES
   Add a character here, reference it by name from a call script.
   ============================================================ */
export const VOICES = {
  neutral:   { pitch: 128, formant: 1.00, rate: 1.00, breath: 0.16, gravel: 0.10, jitter: 0.05 },
  daley:     { pitch: 196, formant: 1.14, rate: 0.84, breath: 0.30, gravel: 0.16, jitter: 0.10 },  // elderly woman, unhurried
  merrick:   { pitch: 104, formant: 0.93, rate: 1.14, breath: 0.10, gravel: 0.22, jitter: 0.04 },  // impatient man
  halloran:  { pitch: 96,  formant: 0.90, rate: 0.96, breath: 0.12, gravel: 0.34, jitter: 0.06 },  // lineman, radio
  sikes:     { pitch: 112, formant: 0.96, rate: 1.06, breath: 0.14, gravel: 0.20, jitter: 0.05 },
  vance:     { pitch: 176, formant: 1.08, rate: 1.02, breath: 0.20, gravel: 0.08, jitter: 0.06 },  // younger woman
  ott:       { pitch: 88,  formant: 0.86, rate: 0.78, breath: 0.24, gravel: 0.40, jitter: 0.12 },  // slow, heavy
  boy:       { pitch: 230, formant: 1.26, rate: 1.10, breath: 0.22, gravel: 0.05, jitter: 0.09 },
  keefe:     { pitch: 120, formant: 0.98, rate: 0.92, breath: 0.14, gravel: 0.18, jitter: 0.05 },  // the 1978 dispatcher
  whisper:   { pitch: 140, formant: 1.02, rate: 0.72, breath: 0.85, gravel: 0.30, jitter: 0.22 },
};

/* Formant pairs for a handful of vowel colors. Cycling through these in
   step with the syllables is what turns beeps into something that scans
   as speech without ever being words. */
const VOWELS = [
  [730, 1090],  // "ah"
  [530, 1840],  // "eh"
  [390, 1990],  // "ih"
  [570, 840],   // "oh"
  [440, 1020],  // "uh"
  [300, 2300],  // "ee"
];

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.clips = new Map();          // id -> AudioBuffer, for real recordings
    this.loops = new Map();
    this.buses = {};
    this._live = new Set();          // in-flight speak() chains
    this._noise = null;
    this._failed = false;
  }

  /* ---------------- setup ---------------- */

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async init() {
    if (this.ready || this._failed) return this.ready;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { this._failed = true; return false; }
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
      this._buildBuses();
      this._noise = this._makeNoiseBuffer(6.0);
      this.ready = true;
      return true;
    } catch (err) {
      console.warn('audio unavailable:', err);
      this._failed = true;
      return false;
    }
  }

  _buildBuses() {
    const ctx = this.ctx;
    const master = ctx.createGain();
    // A gentle limiter so a thunderclap on top of a ring does not clip.
    const comp = ctx.createDynamicsCompressor();
    // A safety limiter, not a mix bus compressor. The first version sat at
    // -12/6:1 and was gain-reducing on the ambience alone, which flattened
    // everything and made the whole mix breathe against the rain.
    comp.threshold.value = -3; comp.knee.value = 6; comp.ratio.value = 12;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);
    this.master = master;

    // bus -> duck -> master. Two stages on purpose: `applySettings` owns the
    // first (the player's volume) and `duck()` owns the second (the mix
    // getting out of the way of a call). One gain node for both meant every
    // settings change undid whatever the game had ducked.
    this.ducks = {};
    for (const name of ['ambience', 'sfx', 'voice', 'phone', 'radio', 'music']) {
      const g = ctx.createGain();
      const d = ctx.createGain();
      g.connect(d).connect(master);
      this.buses[name] = g;
      this.ducks[name] = d;
    }
    this.applySettings();
  }

  applySettings() {
    if (!this.ready) return;
    const s = this.settings;
    if (!s) return;
    this.master.gain.value = s.get('masterVolume');
    this.buses.music.gain.value = s.get('musicVolume');
    this.buses.voice.gain.value = s.get('voiceVolume');
    this.buses.ambience.gain.value = s.get('ambienceVolume');
    // Room tone is the ballast hum and the CRT's flyback whine. Some people
    // find a 15kHz sine genuinely painful; it is not worth forcing on anyone.
    const tone = s.get('roomTone') === false ? 0 : 1;
    for (const name of ['fluorescent', 'crtWhine']) {
      const h = this.loops.get(name);
      if (h) h.setVolume(tone * (name === 'crtWhine' ? 0.30 : 0.45));
    }
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /**
   * Noise, normalized. The first version summed white noise with an
   * un-normalized brown integrator, which drifted past full scale and sat on
   * the master compressor -- that is part of why the room sounded like a
   * blown speaker rather than like weather.
   */
  _makeNoiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0, peak = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;    // a little brown in the white
      const v = white * 0.7 + last * 2.4;
      d[i] = v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    const norm = peak > 0 ? 0.92 / peak : 1;
    for (let i = 0; i < len; i++) d[i] *= norm;
    return buf;
  }

  _noiseSource(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noise;
    s.loop = loop;
    return s;
  }

  /* ============================================================
     TELEPHONE LINE EFFECTS
     Each returns { input, output, stop() }.
     ============================================================ */
  createLineChain(kind = 'clean') {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const input = ctx.createGain();
    const output = ctx.createGain();
    const parts = [];
    const stops = [];

    // Every telephone chain starts with the band. This alone is most of
    // why a voice reads as "on the phone" instead of "in the room".
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';

    const band = {
      clean:   [300, 3400],
      degraded:[420, 2600],
      era1978: [340, 2900],
      era1956: [520, 1900],
      evp:     [260, 2100],
      inside:  [180, 4200],
    }[kind] || [300, 3400];
    hp.frequency.value = band[0];
    lp.frequency.value = band[1];

    input.connect(hp).connect(lp);
    let tail = lp;

    // Carbon-microphone / overdriven-line distortion
    if (kind === 'era1956' || kind === 'evp' || kind === 'degraded') {
      const shaper = ctx.createWaveShaper();
      const amount = kind === 'era1956' ? 22 : kind === 'evp' ? 34 : 10;
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
      }
      shaper.curve = curve;
      shaper.oversample = '2x';
      tail = tail.connect(shaper);
    }

    // Ring modulation -- the single most identifiably "wrong" voice treatment
    if (kind === 'evp') {
      const ring = ctx.createGain();
      ring.gain.value = 0;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 37;
      const depth = ctx.createGain();
      depth.gain.value = 0.85;
      osc.connect(depth).connect(ring.gain);
      const bias = ctx.createConstantSource();
      bias.offset.value = 0.35;
      bias.connect(ring.gain);
      osc.start(); bias.start();
      stops.push(() => { try { osc.stop(); bias.stop(); } catch {} });
      tail = tail.connect(ring);
    }

    // Tape flutter: a slow, shallow delay wobble. 1978 sounds like this.
    if (kind === 'era1978' || kind === 'era1956') {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = 0.006;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = kind === 'era1956' ? 4.1 : 2.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = kind === 'era1956' ? 0.0022 : 0.0013;
      lfo.connect(lfoGain).connect(delay.delayTime);
      lfo.start();
      stops.push(() => { try { lfo.stop(); } catch {} });
      tail = tail.connect(delay);
    }

    tail.connect(output);

    // --- the bed the voice sits on ---
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0;
    const bedSrc = this._noiseSource(true);
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'bandpass';
    bedFilter.frequency.value = kind === 'evp' ? 1200 : 1800;
    bedFilter.Q.value = kind === 'evp' ? 0.5 : 1.1;
    bedSrc.connect(bedFilter).connect(bedGain).connect(output);
    bedSrc.start();
    stops.push(() => { try { bedSrc.stop(); } catch {} });
    bedGain.gain.value = { clean: 0.006, degraded: 0.055, era1978: 0.030, era1956: 0.075, evp: 0.14, inside: 0.004 }[kind] ?? 0.008;

    // Mains hum, for the lines that are coming through something old.
    if (kind === 'era1978' || kind === 'era1956' || kind === 'evp') {
      const hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 60;
      const hg = ctx.createGain();
      hg.gain.value = kind === 'evp' ? 0.020 : 0.011;
      const harm = ctx.createOscillator();
      harm.type = 'sine';
      harm.frequency.value = 180;
      const hg2 = ctx.createGain();
      hg2.gain.value = 0.006;
      hum.connect(hg).connect(output);
      harm.connect(hg2).connect(output);
      hum.start(); harm.start();
      stops.push(() => { try { hum.stop(); harm.stop(); } catch {} });
    }

    return {
      input, output, kind,
      stop() { for (const s of stops) s(); },
    };
  }

  /* ============================================================
     VOICE
     ============================================================ */

  /** Register a real recording so a line plays it instead of synthesizing. */
  async registerClip(id, url) {
    if (!this.ready) return false;
    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.clips.set(id, buf);
      return true;
    } catch { return false; }
  }

  /**
   * Speak a line.
   * @param {string} text        what is being said (drives timing and prosody)
   * @param {object} opts        { voice, line, clip, emotion, rate, onEnd }
   * @returns {{stop:Function, duration:number}}
   */
  speak(text, opts = {}) {
    const profile = VOICES[opts.voice] || VOICES.neutral;
    const lineKind = opts.line || 'clean';
    // Estimate duration the same way whether we synthesize or play a clip, so
    // the UI's line pacing does not change when real audio is dropped in.
    const words = Math.max(1, (text || '').trim().split(/\s+/).length);
    const syllables = Math.max(1, Math.round(estimateSyllables(text)));
    const rate = (opts.rate || 1) * profile.rate;
    let duration = clamp(syllables * 0.20 / rate + 0.28, 0.5, 14);

    if (!this.ready) {
      const timer = setTimeout(() => opts.onEnd && opts.onEnd(), duration * 1000);
      return { stop: () => clearTimeout(timer), duration };
    }

    const ctx = this.ctx;
    const chain = this.createLineChain(lineKind);
    const dest = opts.bus === 'radio' ? this.buses.radio : this.buses.voice;
    chain.output.connect(dest);

    const stops = [() => chain.stop()];
    let ended = false;
    // Every line chain carries a continuously running noise bed. If a line
    // ends by a path that does not reach finish() -- a dropped handle, an
    // oscillator whose onended never fires -- that bed runs forever and the
    // room fills up with hiss, one call at a time. This is the backstop.
    let guard = null;
    const finish = () => {
      if (ended) return;
      ended = true;
      if (guard) clearTimeout(guard);
      // let the chain's noise bed fade rather than click off
      const g = chain.output.gain;
      g.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => { for (const s of stops) s(); }, 300);
      this._live.delete(finish);
      if (opts.onEnd) opts.onEnd();
    };

    // --- a real recording, if one exists for this line ---
    const clip = opts.clip && this.clips.get(opts.clip);
    if (clip) {
      const src = ctx.createBufferSource();
      src.buffer = clip;
      src.connect(chain.input);
      src.start();
      duration = clip.duration;
      src.onended = finish;
      stops.push(() => { try { src.stop(); } catch {} });
      guard = setTimeout(finish, (duration + 2) * 1000);
      this._live.add(finish);
      return { stop: finish, duration };
    }

    // --- otherwise, synthesize ---
    const t0 = ctx.currentTime + 0.02;
    const sylDur = (duration - 0.20) / syllables;
    const basePitch = profile.pitch * (opts.pitchScale || 1);

    // glottal source: a pulse-ish saw plus a breath bed, formant-filtered
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = 'square';
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.18 * profile.gravel;

    const breath = this._noiseSource(true);
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = 1900;
    breathFilter.Q.value = 0.7;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0;

    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 7;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 9;
    const mixF = ctx.createGain();

    osc.connect(oscGain);
    sub.connect(subGain).connect(oscGain);
    oscGain.connect(f1).connect(mixF);
    oscGain.connect(f2).connect(mixF);
    breath.connect(breathFilter).connect(breathGain).connect(mixF);
    mixF.connect(chain.input);

    // Prosody: a falling contour across the line, lifted at a question mark.
    const isQuestion = /\?\s*$/.test(text || '');
    let t = t0;
    for (let i = 0; i < syllables; i++) {
      const frac = i / Math.max(1, syllables - 1);
      const vowel = VOWELS[(i * 7 + text.length) % VOWELS.length];
      const contour = isQuestion ? (0.92 + frac * 0.28) : (1.06 - frac * 0.22);
      const jitter = 1 + (Math.random() - 0.5) * profile.jitter;
      const p = basePitch * contour * jitter;

      osc.frequency.setValueAtTime(p, t);
      sub.frequency.setValueAtTime(p * 0.5, t);
      f1.frequency.setValueAtTime(vowel[0] * profile.formant, t);
      f2.frequency.setValueAtTime(vowel[1] * profile.formant, t);

      // amplitude envelope per syllable, with a consonant-ish attack
      const a = sylDur * 0.22, d = sylDur * 0.78;
      oscGain.gain.setValueAtTime(0.0001, t);
      oscGain.gain.exponentialRampToValueAtTime(0.30, t + a);
      oscGain.gain.exponentialRampToValueAtTime(0.02, t + a + d);
      breathGain.gain.setValueAtTime(0.0001, t);
      breathGain.gain.linearRampToValueAtTime(0.05 * profile.breath, t + a * 0.6);
      breathGain.gain.linearRampToValueAtTime(0.004, t + a + d);
      t += sylDur;
    }
    oscGain.gain.setTargetAtTime(0, t, 0.04);
    breathGain.gain.setTargetAtTime(0, t, 0.04);

    osc.start(t0); sub.start(t0); breath.start(t0);
    const endAt = t + 0.18;
    osc.stop(endAt); sub.stop(endAt); breath.stop(endAt);
    stops.push(() => { try { osc.stop(); sub.stop(); breath.stop(); } catch {} });
    osc.onended = finish;
    guard = setTimeout(finish, (duration + 2) * 1000);
    this._live.add(finish);

    return { stop: finish, duration };
  }

  /* ============================================================
     ONE-SHOTS AND LOOPS
     ============================================================ */

  /** Short synthesized effects, addressed by name. */
  play(name, opts = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const bus = this.buses[opts.bus || 'sfx'];
    const vol = opts.volume ?? 1;
    const t = ctx.currentTime + (opts.delay || 0);

    const tone = (freq, dur, type = 'sine', gain = 0.2, dest = bus) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + dur + 0.02);
      return o;
    };
    const burst = (dur, freq, q, gain = 0.3, dest = bus) => {
      const s = this._noiseSource(false);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(dest);
      s.start(t); s.stop(t + dur + 0.02);
      return s;
    };

    switch (name) {
      /* --- telephone --- */
      case 'ring': {
        // A 1999 electronic set: a warbling two-tone burst, twice.
        for (const off of [0, 0.42]) {
          const o = ctx.createOscillator();
          const o2 = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'square'; o2.type = 'square';
          o.frequency.value = 1180; o2.frequency.value = 1520;
          const lfo = ctx.createOscillator();
          lfo.type = 'square'; lfo.frequency.value = 22;
          const lg = ctx.createGain(); lg.gain.value = 0.16;
          lfo.connect(lg).connect(g.gain);
          g.gain.setValueAtTime(0.0001, t + off);
          g.gain.linearRampToValueAtTime(0.20 * vol, t + off + 0.01);
          g.gain.setValueAtTime(0.20 * vol, t + off + 0.33);
          g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.37);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.6;
          o.connect(g); o2.connect(g);
          g.connect(bp).connect(this.buses.phone);
          o.start(t + off); o2.start(t + off); lfo.start(t + off);
          o.stop(t + off + 0.40); o2.stop(t + off + 0.40); lfo.stop(t + off + 0.40);
        }
        break;
      }
      case 'ringBell': {
        // The older set in the corner: a real bell, struck by a clapper.
        for (let i = 0; i < 18; i++) {
          const bt = t + i * 0.048;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = i % 2 ? 1040 : 1385;
          g.gain.setValueAtTime(0.22 * vol, bt);
          g.gain.exponentialRampToValueAtTime(0.0001, bt + 0.075);
          o.connect(g).connect(this.buses.phone);
          o.start(bt); o.stop(bt + 0.08);
        }
        break;
      }
      case 'hookUp': burst(0.05, 2600, 3, 0.30, this.buses.phone); tone(180, 0.04, 'square', 0.10, this.buses.phone); break;
      case 'hookDown': burst(0.07, 1500, 2, 0.38, this.buses.phone); tone(90, 0.09, 'square', 0.16, this.buses.phone); break;
      case 'holdClick': burst(0.028, 3200, 5, 0.22, this.buses.phone); break;
      case 'lineDrop': {
        tone(420, 0.10, 'sine', 0.14, this.buses.phone);
        burst(0.30, 900, 0.7, 0.22, this.buses.phone);
        break;
      }
      case 'dtmf': {
        const rows = [697, 770, 852, 941], cols = [1209, 1336, 1477];
        const d = opts.digit ?? 0;
        tone(rows[Math.floor(d / 3) % 4], 0.11, 'sine', 0.13, this.buses.phone);
        tone(cols[d % 3], 0.11, 'sine', 0.13, this.buses.phone);
        break;
      }

      /* --- radio --- */
      case 'squelchOpen': burst(0.09, 2400, 1.2, 0.34, this.buses.radio); break;
      case 'squelchClose': burst(0.13, 1500, 0.9, 0.30, this.buses.radio); break;
      case 'radioBeep': tone(1120, 0.07, 'square', 0.11, this.buses.radio); break;

      /* --- room --- */
      case 'thunder': {
        const dist = opts.distance ?? 0.5;    // 0 = overhead, 1 = far off
        const dur = 1.4 + dist * 3.2;
        const s = this._noiseSource(false);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1400 - dist * 900, t);
        lp.frequency.exponentialRampToValueAtTime(90, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime((0.55 - dist * 0.35) * vol, t + 0.03 + dist * 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(lp).connect(g).connect(this.buses.ambience);
        s.start(t); s.stop(t + dur + 0.1);
        break;
      }
      case 'step': burst(0.07, 320 + Math.random() * 180, 1.4, 0.10); break;
      case 'chair': burst(0.22, 240, 2.2, 0.10); tone(90, 0.18, 'sine', 0.05); break;
      case 'paper': burst(0.16, 3800, 0.8, 0.11); break;
      case 'keyClack': burst(0.035, 1800 + Math.random() * 900, 3.5, 0.09); break;
      case 'drawer': burst(0.34, 520, 1.1, 0.16); break;
      case 'breaker': tone(60, 0.20, 'square', 0.22); burst(0.10, 700, 2, 0.28); break;
      case 'crtDegauss': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
        g.gain.setValueAtTime(0.24 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g).connect(bus);
        o.start(t); o.stop(t + 1.2);
        break;
      }
      default:
        return null;
    }
    return true;
  }

  /* ---------------- loops ---------------- */

  /** Start a named ambient loop. Returns a handle with .gain and .stop(). */
  loop(name, opts = {}) {
    if (!this.ready) return null;
    if (this.loops.has(name)) return this.loops.get(name);
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = opts.volume ?? 0.5;
    const stops = [];

    const startNoise = (filterType, freq, q, gain, dest) => {
      const s = this._noiseSource(true);
      const f = ctx.createBiquadFilter();
      f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      s.connect(f).connect(g).connect(dest);
      s.start();
      stops.push(() => { try { s.stop(); } catch {} });
      return { source: s, filter: f, gain: g };
    };

    switch (name) {
      case 'rain': {
        /* Steady filtered noise is not rain. It is static, which is exactly
           what the first version of this sounded like.

           Rain has three things static does not: a low wash with almost no
           top end, slow GUSTS that move the whole level around, and discrete
           DROPLETS hitting glass. The droplets are what the ear uses to
           decide it is hearing weather, so they matter more than the bed. */

        // the wash on the roof -- almost all of the energy, almost none of
        // the brightness
        const wash = startNoise('lowpass', 420, 0.6, 0.95, out);
        // the body
        const body = startNoise('bandpass', 1150, 0.35, 0.30, out);
        // a little sheet-hiss on the glass, kept well down
        const hiss = startNoise('highpass', 3600, 0.4, 0.030, out);

        // Gusts: two slow LFOs at unrelated rates so the pattern never
        // audibly repeats.
        for (const [rate, depth, target] of [[0.043, 0.30, wash.gain.gain], [0.071, 0.10, body.gain.gain]]) {
          const lfo = ctx.createOscillator();
          lfo.type = 'sine'; lfo.frequency.value = rate;
          const amt = ctx.createGain(); amt.gain.value = depth;
          lfo.connect(amt).connect(target);
          lfo.start();
          stops.push(() => { try { lfo.stop(); } catch {} });
        }

        // Droplets on the window. Scheduled a second ahead in batches so the
        // timing is sample-accurate rather than at the mercy of setTimeout.
        const dropBus = ctx.createGain();
        dropBus.gain.value = 0.9;
        dropBus.connect(out);
        const schedule = () => {
          if (!this.loops.has('rain')) return;
          const until = ctx.currentTime + 1.2;
          while (handle._nextDrop < until) {
            const t = Math.max(ctx.currentTime, handle._nextDrop);
            const src = this._noiseSource(false);
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.value = 900 + Math.random() * 3200;
            f.Q.value = 3 + Math.random() * 7;
            const g = ctx.createGain();
            const peak = 0.05 + Math.random() * 0.16;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
            src.connect(f).connect(g).connect(dropBus);
            src.start(t); src.stop(t + 0.12);
            handle._nextDrop += 0.018 + Math.random() * 0.075;
          }
          handle._timer = setTimeout(schedule, 700);
        };
        setTimeout(() => { handle._nextDrop = ctx.currentTime + 0.1; schedule(); }, 0);
        stops.push(() => clearTimeout(handle._timer));

        out.connect(this.buses.ambience);
        break;
      }
      case 'fluorescent': {
        /* Magnetic ballast hum is 120Hz and its low harmonics, heard through
           a diffuser and a ceiling. The first version ran a sawtooth through
           a bandpass at 1400Hz with Q=4, which is not a hum -- it is a buzz,
           and it was the second loudest thing in the game. */
        for (const [freq, gain] of [[120, 0.040], [240, 0.015], [360, 0.006]]) {
          const o = ctx.createOscillator();
          o.type = 'sine'; o.frequency.value = freq;
          const g = ctx.createGain(); g.gain.value = gain;
          o.connect(g).connect(out);
          o.start();
          stops.push(() => { try { o.stop(); } catch {} });
        }
        // the faintest tube grit, rolled off hard
        const grit = startNoise('bandpass', 2200, 1.2, 0.010, out);
        grit.filter.Q.value = 1.2;
        out.connect(this.buses.ambience);
        break;
      }
      case 'crtWhine': {
        /* The 15.7kHz flyback line, and ONLY that. The first version also ran
           its subharmonic at 7.8kHz, which is squarely in the range the ear is
           most sensitive to -- that was the whine, not the flyback. Kept very
           quiet, and switchable off entirely (Options > ROOM TONE). */
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = 15734;
        const g = ctx.createGain(); g.gain.value = 0.010;
        o.connect(g).connect(out);
        o.start();
        stops.push(() => { try { o.stop(); } catch {} });
        out.connect(this.buses.ambience);
        break;
      }
      case 'dialTone': {
        for (const f of [350, 440]) {
          const o = ctx.createOscillator();
          o.type = 'sine'; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.value = 0.055;
          o.connect(g).connect(out);
          o.start();
          stops.push(() => { try { o.stop(); } catch {} });
        }
        out.connect(this.buses.phone);
        break;
      }
      case 'lineHum': {
        startNoise('bandpass', 1000, 0.4, 0.045, out);
        out.connect(this.buses.phone);
        break;
      }
      case 'holdMusic': {
        // Four bars of very cheap synthesized muzak, band-limited to the
        // phone line. Nothing in this game is funnier or bleaker.
        const notes = [392, 440, 494, 523, 494, 440, 392, 349];
        const seq = ctx.createGain();
        seq.gain.value = 0.10;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.8;
        seq.connect(bp).connect(out);
        let i = 0;
        const step = () => {
          if (!this.loops.has('holdMusic')) return;
          const tt = ctx.currentTime;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = notes[i % notes.length];
          g.gain.setValueAtTime(0.0001, tt);
          g.gain.exponentialRampToValueAtTime(0.5, tt + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.46);
          o.connect(g).connect(seq);
          o.start(tt); o.stop(tt + 0.5);
          i++;
          handle._timer = setTimeout(step, 480);
        };
        out.connect(this.buses.music);
        setTimeout(step, 10);
        stops.push(() => clearTimeout(handle._timer));
        break;
      }
      case 'radioStatic': {
        startNoise('bandpass', 1600, 0.5, 0.30, out);
        out.connect(this.buses.radio);
        break;
      }
      default:
        return null;
    }

    const handle = {
      name,
      gain: out,
      _timer: null,
      _nextDrop: 0,
      setVolume: (v, ramp = 0.2) => {
        out.gain.setTargetAtTime(v, ctx.currentTime, ramp);
      },
      stop: (fade = 0.3) => {
        out.gain.setTargetAtTime(0, ctx.currentTime, fade);
        setTimeout(() => {
          for (const s of stops) s();
          try { out.disconnect(); } catch {}
        }, fade * 3000 + 60);
        this.loops.delete(name);
      },
    };
    this.loops.set(name, handle);
    return handle;
  }

  stopLoop(name, fade) { const h = this.loops.get(name); if (h) h.stop(fade); }
  isLooping(name) { return this.loops.has(name); }

  /** Cut every voice chain in flight. Used when a shift ends or resets. */
  stopAllVoices() {
    for (const fn of [...this._live]) { try { fn(); } catch { /* ignore */ } }
    this._live.clear();
  }

  /** How many voice chains are alive. If this climbs, something is leaking. */
  get liveVoices() { return this._live.size; }

  /** Duck a bus -- used when a call is live so the room recedes. */
  duck(busName, to, ramp = 0.3) {
    if (!this.ready) return;
    const d = this.ducks[busName];
    if (d) d.gain.setTargetAtTime(to, this.ctx.currentTime, ramp);
  }
}

/** Rough syllable count. Wrong often, but consistently, which is all we need. */
export function estimateSyllables(text) {
  if (!text) return 1;
  const words = text.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
  let n = 0;
  for (const w of words) {
    const groups = w.match(/[aeiouy]+/g);
    let c = groups ? groups.length : 1;
    if (w.length > 3 && /e$/.test(w) && c > 1) c--;
    n += Math.max(1, c);
  }
  return Math.max(1, n);
}
