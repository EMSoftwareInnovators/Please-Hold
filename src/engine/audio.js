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

import { SOUNDS, lineToSegments } from './phonemes.js';

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

  /**
   * Must be called from a user gesture. Safe to call repeatedly.
   *
   * `context` lets a caller supply its own AudioContext -- in practice an
   * OfflineAudioContext, so the mix can be rendered to samples and measured
   * on a machine with no sound card at all. That is how tools/render.mjs
   * checks that the rain is rain; see the note on `preroll` in loop().
   */
  async init({ context = null } = {}) {
    if (this.ready || this._failed) return this.ready;
    try {
      if (context) {
        this.ctx = context;
      } else {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) { this._failed = true; return false; }
        this.ctx = new Ctx({ latencyHint: 'interactive' });
        if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
      }
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
  /**
   * Noise, in three colours. The colour matters more than any filter put
   * after it: white noise has equal energy per hertz, so a lowpass only bends
   * it -- there is always hiss left at the top, and hiss at the top is what
   * the ear files under "television static". Rain and room tone are built out
   * of pink and brown instead, where the energy is already where it belongs.
   *
   *   white  -- transients, fricatives, switch clicks
   *   pink   -- -3 dB/octave. Sheets of rain, tube grit, breath.
   *   brown  -- -6 dB/octave. The wash on the roof, thunder bodies.
   */
  _makeNoiseBuffer(seconds, colour = 'white') {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Paul Kellet's pink filter; b0..b6 are its running state.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let brown = 0, peak = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      let v;
      if (colour === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else if (colour === 'brown') {
        brown = (brown + 0.02 * w) / 1.02;
        v = brown * 3.5;
      } else {
        v = w;
      }
      d[i] = v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    const norm = peak > 0 ? 0.92 / peak : 1;
    for (let i = 0; i < len; i++) d[i] *= norm;
    return buf;
  }

  _noiseSource(loop = true, colour = 'white') {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseOf(colour);
    s.loop = loop;
    // A looped buffer repeats, and the ear finds the seam within about ten
    // seconds. Detuning each source slightly means two layers never line up.
    if (loop) s.playbackRate.value = 0.88 + Math.random() * 0.24;
    return s;
  }

  _noiseOf(colour) {
    if (colour === 'white') return this._noise;
    if (!this._noiseColours) this._noiseColours = new Map();
    if (!this._noiseColours.has(colour)) {
      this._noiseColours.set(colour, this._makeNoiseBuffer(6, colour));
    }
    return this._noiseColours.get(colour);
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
      /* The curve is a huge boost near zero -- that is what makes it sound
         like an overdriven carbon microphone -- so it needs the gain taken
         back out, or 1956 arrives ten times louder than 1999. */
      const comp = ctx.createGain();
      comp.gain.value = Math.min(1, 4 / (1 + amount * 0.5));
      tail = tail.connect(shaper).connect(comp);
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
    const rate = (opts.rate || 1) * profile.rate;
    // A rough figure for the no-audio path; the synthesizer replaces it with
    // the real length of the line it actually laid out.
    let duration = clamp(estimateSyllables(text) * 0.26 / rate + 0.28, 0.5, 16);

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
    /* A source-filter model, driven by the actual words.

       Three things separate this from the version that sounded like beeps,
       and none of them is the filter quality:

         1. CONSONANTS. Turbulence for the fricatives, a real closure and
            burst for the stops, damped voicing for the nasals. Silence in
            the middle of a word is a /t/, and the ear knows it.
         2. TRANSITIONS. Formants RAMP between targets instead of jumping.
            The slide is the part the ear reads as a mouth moving; a vowel
            held still is a synthesizer no matter how well it is tuned.
         3. A GLOTTAL SOURCE with a spectral tilt, jitter and vibrato, rather
            than a bare sawtooth. A perfectly steady larynx is not a person.

       Nothing here is meant to be intelligible. Every line arrives through a
       300-3400Hz telephone band; the target is a voice you can hear the shape
       of and not quite make out, which is what a handset in 1999 gave you. */
    const plan = lineToSegments(text, { rate });
    const segments = plan.segments;
    duration = clamp(plan.duration + 0.18, 0.4, 20);

    const t0 = ctx.currentTime + 0.02;
    const basePitch = profile.pitch * (opts.pitchScale || 1);
    const fScale = profile.formant;

    /* ---- the larynx ---- */
    const glottis = ctx.createOscillator();
    glottis.type = 'sawtooth';
    // Vibrato: small, slow, and never quite regular. Without it the pitch
    // reads as a test tone the moment a vowel is held for more than 100ms.
    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 4.6 + Math.random() * 1.4;
    const vibGain = ctx.createGain();
    vibGain.gain.value = basePitch * (0.006 + profile.jitter * 0.05);
    vib.connect(vibGain).connect(glottis.frequency);

    // Spectral tilt. A real glottal pulse is nothing like a sawtooth above
    // about 2kHz, and the difference is most of the buzz.
    const tilt = ctx.createBiquadFilter();
    tilt.type = 'lowpass';
    tilt.frequency.value = 2200;
    tilt.Q.value = 0.3;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.0001;
    glottis.connect(tilt).connect(voiceGain);

    // Gravel: a half-rate square under the fundamental. A worn voice is a
    // larynx that does not close cleanly, which is a subharmonic.
    const sub = ctx.createOscillator();
    sub.type = 'square';
    const subGain = ctx.createGain();
    subGain.gain.value = 0.10 * profile.gravel;
    sub.connect(subGain).connect(tilt);

    /* ---- the tract: three formants in parallel ---- */
    const formants = [
      { q: 9, gain: 1.00 },
      { q: 11, gain: 0.62 },
      { q: 13, gain: 0.28 },
    ].map((spec) => {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = spec.q;
      const g = ctx.createGain();
      g.gain.value = spec.gain;
      f.connect(g);
      return { filter: f, gain: g };
    });
    const tract = ctx.createGain();
    for (const f of formants) {
      voiceGain.connect(f.filter);
      f.gain.connect(tract);
    }
    // A little of the source straight through keeps the low end that a pure
    // parallel formant bank throws away.
    const direct = ctx.createGain();
    direct.gain.value = 0.18;
    voiceGain.connect(direct).connect(tract);

    /* ---- turbulence: fricatives, bursts and breath ---- */
    const noise = this._noiseSource(true);
    const fric = ctx.createBiquadFilter();
    fric.type = 'bandpass';
    fric.frequency.value = 4000;
    fric.Q.value = 1.4;
    const fricGain = ctx.createGain();
    fricGain.gain.value = 0.0001;
    noise.connect(fric).connect(fricGain).connect(tract);

    // Breath rides under everything, louder for a whisper or a chest cold.
    const breath = this._noiseSource(true, 'pink');
    const breathBand = ctx.createBiquadFilter();
    breathBand.type = 'bandpass';
    breathBand.frequency.value = 1700;
    breathBand.Q.value = 0.6;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.0001;
    breath.connect(breathBand).connect(breathGain).connect(tract);

    /* One trim for the whole voice. Three formants, a direct path and a
       turbulence channel all sum here, and the 1956 line chain has a
       waveshaper after it -- without this the older eras clip. */
    const trim = ctx.createGain();
    trim.gain.value = 0.42;
    tract.connect(trim).connect(chain.input);

    /* ---- schedule the line ---- */
    const TRANS = 0.035;                 // how long a formant takes to move
    let t = t0;
    // Start the tract somewhere neutral so the first sound slides in.
    for (let i = 0; i < 3; i++) {
      formants[i].filter.frequency.setValueAtTime([500, 1500, 2500][i] * fScale, t0);
    }

    for (const seg of segments) {
      const sound = seg.sound ? SOUNDS[seg.sound] : null;
      const end = t + seg.dur;

      if (!sound) {
        // A pause: let the voicing fall away rather than cutting it.
        voiceGain.gain.setTargetAtTime(0.0001, t, 0.020);
        fricGain.gain.setTargetAtTime(0.0001, t, 0.015);
        breathGain.gain.setTargetAtTime(0.0001, t, 0.030);
        t = end;
        continue;
      }

      // Formants slide to this sound's targets. This is the whole trick.
      for (let i = 0; i < 3; i++) {
        formants[i].filter.frequency.linearRampToValueAtTime(
          clamp(sound.f[i] * fScale, 90, 7000), t + TRANS);
      }

      // Pitch: contour, plus jitter, moved rather than stepped.
      const p = clamp(basePitch * seg.pitch * (1 + (Math.random() - 0.5) * profile.jitter), 60, 420);
      glottis.frequency.linearRampToValueAtTime(p, t + Math.min(0.06, seg.dur));
      sub.frequency.linearRampToValueAtTime(p * 0.5, t + Math.min(0.06, seg.dur));

      const amp = 0.34 * sound.amp;
      switch (sound.kind) {
        case 'stop': {
          /* Closure, then release. The silence is what makes it a stop --
             an instantaneous burst with no closure in front of it just
             sounds like a click in the middle of a vowel. */
          const closure = Math.min(seg.dur * 0.62, 0.055);
          voiceGain.gain.setTargetAtTime(sound.voiced ? 0.03 : 0.0001, t, 0.008);
          fricGain.gain.setValueAtTime(0.0001, t);
          const burst = t + closure;
          fric.frequency.setValueAtTime(sound.noise[0], burst);
          fric.Q.setValueAtTime(sound.noise[1], burst);
          fricGain.gain.setTargetAtTime(0.30 * sound.amp, burst, 0.004);
          fricGain.gain.setTargetAtTime(0.0001, burst + 0.018, 0.012);
          // Voicing comes back in for the next sound, slightly late: that
          // lag is what a plosive sounds like.
          voiceGain.gain.setTargetAtTime(amp, burst + 0.012, 0.018);
          break;
        }
        case 'fric': {
          fric.frequency.setValueAtTime(sound.noise[0], t);
          fric.Q.setValueAtTime(sound.noise[1], t);
          fricGain.gain.setTargetAtTime(0.26 * sound.amp, t, 0.012);
          fricGain.gain.setTargetAtTime(0.0001, end - 0.015, 0.012);
          voiceGain.gain.setTargetAtTime(sound.voiced ? amp * 0.55 : 0.002, t, 0.015);
          break;
        }
        case 'nasal': {
          // Mouth shut: quiet, dark, and no turbulence at all.
          fricGain.gain.setTargetAtTime(0.0001, t, 0.010);
          voiceGain.gain.setTargetAtTime(amp * 0.7, t, 0.020);
          break;
        }
        default: {
          // Vowels and liquids: open the larynx, shut the noise.
          fricGain.gain.setTargetAtTime(0.0001, t, 0.012);
          voiceGain.gain.setTargetAtTime(amp, t, seg.stress ? 0.014 : 0.022);
          // Let it sag before the next sound so syllables have shape.
          voiceGain.gain.setTargetAtTime(amp * 0.72, end - 0.030, 0.030);
          breathGain.gain.setTargetAtTime(0.020 * profile.breath, t, 0.030);
          break;
        }
      }
      t = end;
    }

    // Tail off. A voice that stops dead has been edited, not finished.
    voiceGain.gain.setTargetAtTime(0.0001, t, 0.035);
    fricGain.gain.setTargetAtTime(0.0001, t, 0.020);
    breathGain.gain.setTargetAtTime(0.0001, t + 0.04, 0.050);

    const endAt = t + 0.22;
    glottis.start(t0); sub.start(t0); vib.start(t0); noise.start(t0); breath.start(t0);
    glottis.stop(endAt); sub.stop(endAt); vib.stop(endAt); noise.stop(endAt); breath.stop(endAt);
    stops.push(() => {
      try { glottis.stop(); sub.stop(); vib.stop(); noise.stop(); breath.stop(); } catch {}
    });
    glottis.onended = finish;
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
      case 'switchClick': burst(0.02, 2400, 6, 0.26); tone(150, 0.03, 'square', 0.10); break;
      case 'doorOpen': { burst(0.30, 260, 1.0, 0.16); tone(70, 0.28, 'sine', 0.05); break; }
      case 'doorClose': { burst(0.12, 180, 0.9, 0.30); tone(58, 0.16, 'sine', 0.10); break; }
      case 'doorLocked': { burst(0.05, 900, 3.5, 0.24); burst(0.05, 900, 3.5, 0.18); break; }
      case 'penScratch': {
        // Six short scrapes: somebody writing four words on a ruled page.
        for (let i = 0; i < 7; i++) burst(0.035 + Math.random() * 0.02, 2600 + Math.random() * 1800, 1.1, 0.06);
        break;
      }
      case 'ballastPop': { burst(0.04, 1200, 4, 0.30); tone(120, 0.05, 'square', 0.08); break; }
      case 'roomShift': {
        /* The sound of the room being a different room: a sub drop and a
           reversed-sounding swell. Used once. */
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(34, t + 1.1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g).connect(this.master); o.start(t); o.stop(t + 1.7);
        burst(1.2, 300, 0.5, 0.10);
        break;
      }
      case 'knock': {
        /* Three on a steel fire door, from the far side. Low, flat, and with
           the corridor on it -- the player is not meant to enjoy this. */
        for (let i = 0; i < 3; i++) {
          const kt = t + i * 0.52;
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(96, kt);
          o.frequency.exponentialRampToValueAtTime(52, kt + 0.14);
          g.gain.setValueAtTime(0.34 * vol, kt);
          g.gain.exponentialRampToValueAtTime(0.0001, kt + 0.20);
          o.connect(g).connect(this.master); o.start(kt); o.stop(kt + 0.22);
          burst(0.10, 420, 1.2, 0.20);
        }
        break;
      }
      case 'faxHandshake': {
        /* CNG: 1100Hz, half a second on, three off, and then the pair of
           them negotiating. Anyone who used a fax in 1999 has this sound
           filed under "wrong number" and, tonight, under something else. */
        for (const off of [0, 3.2]) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = 1100;
          g.gain.setValueAtTime(0.0001, t + off);
          g.gain.linearRampToValueAtTime(0.16 * vol, t + off + 0.02);
          g.gain.setValueAtTime(0.16 * vol, t + off + 0.48);
          g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.52);
          o.connect(g).connect(this.buses.sfx); o.start(t + off); o.stop(t + off + 0.55);
        }
        // the answering tone, and then the modems shrieking at each other
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.type = 'sine'; o2.frequency.value = 2100;
        g2.gain.setValueAtTime(0.0001, t + 1.1);
        g2.gain.linearRampToValueAtTime(0.13 * vol, t + 1.15);
        g2.gain.setValueAtTime(0.13 * vol, t + 2.0);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
        o2.connect(g2).connect(this.buses.sfx); o2.start(t + 1.1); o2.stop(t + 2.15);
        for (let i = 0; i < 26; i++) {
          const ht = t + 2.2 + i * 0.03;
          const o3 = ctx.createOscillator(); const g3 = ctx.createGain();
          o3.type = 'square';
          o3.frequency.value = 800 + Math.random() * 2200;
          g3.gain.setValueAtTime(0.05 * vol, ht);
          g3.gain.exponentialRampToValueAtTime(0.0001, ht + 0.04);
          o3.connect(g3).connect(this.buses.sfx); o3.start(ht); o3.stop(ht + 0.05);
        }
        break;
      }
      case 'faxPrint': {
        /* The stepper motor. Twenty-two seconds of a machine chewing paper,
           compressed to five: a buzz that ratchets, with the paper feed
           under it. This is the sound that means something arrived. */
        const dur = 5.4;
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 138;
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.type = 'square'; lfo.frequency.value = 17; lg.gain.value = 0.09;
        lfo.connect(lg).connect(g.gain);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.1;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.13 * vol, t + 0.25);
        g.gain.setValueAtTime(0.13 * vol, t + dur - 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(bp).connect(g).connect(this.buses.sfx);
        o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
        for (let i = 0; i < 40; i++) {
          burst(0.02, 4200 + Math.random() * 1800, 1.4, 0.04);
        }
        break;
      }
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

    /* `handle` does not exist until after this switch, so a loop that needs
       to seed its own scheduling state leaves a callback here and it runs
       once the handle is built and registered. */
    let afterHandle = null;

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
        /* Rain, not static.

           The first two attempts both came out as television hiss, and for
           the same reason each time: a steady bed of WHITE noise. White noise
           carries as much energy at 8kHz as at 80Hz, so no amount of lowpass
           filtering removes the hiss -- it only tilts it -- and a bed whose
           level never moves has no weather in it at all.

           What the ear actually uses to decide it is hearing rain:
             1. DARKNESS      -- brown noise, rolled off twice. Rain on a flat
                                 roof is nearly all low mid.
             2. IRREGULARITY  -- the level has to wander. Not an LFO, which is
                                 periodic and reads as an effect; a random walk
                                 re-aimed every half second or so.
             3. DROPLETS      -- discrete, resonant, and LOUD relative to the
                                 bed. These are the whole thing. A recording of
                                 rain with the transients removed is static.
             4. GUSTS         -- occasional swells that move the level and the
                                 droplet density together.
           Nothing here is a steady source at a fixed gain. */

        // 1. the wash on the roof: brown, and rolled off twice
        const wash = this._noiseSource(true, 'brown');
        const wlp1 = ctx.createBiquadFilter();
        wlp1.type = 'lowpass'; wlp1.frequency.value = 480; wlp1.Q.value = 0.4;
        const wlp2 = ctx.createBiquadFilter();
        wlp2.type = 'lowpass'; wlp2.frequency.value = 700; wlp2.Q.value = 0.7;
        const whp = ctx.createBiquadFilter();
        whp.type = 'highpass'; whp.frequency.value = 70; whp.Q.value = 0.5;
        /* The wash is the FLOOR, not the sound. Every earlier version had it
           at full level, which buried the droplets and left exactly the
           featureless bed that reads as static. */
        const washGain = ctx.createGain(); washGain.gain.value = 0.42;
        wash.connect(whp).connect(wlp1).connect(wlp2).connect(washGain);
        wash.start();
        stops.push(() => { try { wash.stop(); } catch {} });

        // 2. the sheet against the glass: pink, narrow, and never steady
        const sheet = this._noiseSource(true, 'pink');
        const sbp = ctx.createBiquadFilter();
        sbp.type = 'bandpass'; sbp.frequency.value = 1250; sbp.Q.value = 0.9;
        const slp = ctx.createBiquadFilter();
        slp.type = 'lowpass'; slp.frequency.value = 3400; slp.Q.value = 0.5;
        const sheetGain = ctx.createGain(); sheetGain.gain.value = 0.16;
        sheet.connect(sbp).connect(slp).connect(sheetGain);
        sheet.start();
        stops.push(() => { try { sheet.stop(); } catch {} });

        // Both beds pass through one gust stage, so a swell moves the whole
        // weather rather than one layer of it.
        const gust = ctx.createGain(); gust.gain.value = 1;
        washGain.connect(gust);
        sheetGain.connect(gust);
        gust.connect(out);

        const dropBus = ctx.createGain();
        dropBus.gain.value = 1.0;
        dropBus.connect(out);

        /* One scheduler drives all three moving parts, a second ahead, so the
           timing is sample-accurate instead of at the mercy of setTimeout. */
        /* Three kinds of impact, because rain on a window is three sounds:
             far   -- the dense field. Individually inaudible, collectively
                      the texture that sits on top of the wash.
             tick  -- a drop on the glass. High, short, and it RINGS.
             near  -- one that hits right in front of you. Rare, loud, and the
                      reason the ear says "weather" instead of "noise".
           The first version made every drop the same size, which averages out
           to a bed -- which is to say, to static. */
        const drop = (t, kind) => {
          const src = this._noiseSource(false);
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          let peak, decay;
          if (kind === 'tick') {
            f.frequency.value = 2400 + Math.random() * 3400;
            f.Q.value = 7 + Math.random() * 11;
            peak = 0.055 + Math.random() * 0.120;
            decay = 0.007 + Math.random() * 0.018;
          } else if (kind === 'near') {
            f.frequency.value = 520 + Math.random() * 1900;
            f.Q.value = 6 + Math.random() * 9;
            peak = 0.16 + Math.random() * 0.30;
            decay = 0.045 + Math.random() * 0.110;
          } else {
            f.frequency.value = 560 + Math.random() * 1100;
            f.Q.value = 2 + Math.random() * 4;
            const r = Math.random();
            peak = 0.012 + r * r * 0.055;
            decay = 0.020 + Math.random() * 0.060;
          }
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(Math.max(0.002, peak), t + 0.0015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          src.connect(f).connect(g).connect(dropBus);
          src.start(t); src.stop(t + decay + 0.05);
        };

        /* Everything is scheduled on absolute times, which means the same
           code can run a rolling window in real time or lay down the whole
           thing at once for an offline render. `preroll` picks. */
        const schedule = () => {
          if (!handle._preroll && !this.loops.has('rain')) return;
          const now = ctx.currentTime;
          const until = now + (handle._preroll || 1.2);

          // --- gusts: a swell every few seconds, never on a beat ---
          while (handle._gustAt < until) {
            const t = Math.max(now, handle._gustAt);
            const up = 1.6 + Math.random() * 2.6;
            const down = 2.4 + Math.random() * 4.0;
            const peak = 1.0 + Math.random() * 0.55;
            const rest = 0.72 + Math.random() * 0.2;
            gust.gain.setValueAtTime(handle._gustLevel, t);
            gust.gain.linearRampToValueAtTime(peak, t + up);
            gust.gain.linearRampToValueAtTime(rest, t + up + down);
            handle._gustLevel = rest;
            handle._gustAt = t + up + down + Math.random() * 3;
            handle._density = peak;          // it rains harder in a gust
          }

          // --- the sheet wanders on its own, faster than the gusts ---
          while (handle._walkAt < until) {
            const t = Math.max(now, handle._walkAt);
            sheetGain.gain.setTargetAtTime(0.09 + Math.random() * 0.17, t, 0.25);
            handle._walkAt = t + 0.35 + Math.random() * 0.7;
          }

          // --- the dense field, and the ticks on the glass ---
          while (handle._nextDrop < until) {
            const t = Math.max(now, handle._nextDrop);
            drop(t, Math.random() < 0.30 ? 'tick' : 'far');
            // ~26-70 impacts a second, scaled by how hard it is coming down
            handle._nextDrop += (0.012 + Math.random() * 0.026) / Math.max(0.6, handle._density);
          }

          // --- and the ones that land right in front of you ---
          while (handle._nearDrop < until) {
            drop(Math.max(now, handle._nearDrop), 'near');
            handle._nearDrop += (0.10 + Math.random() * 0.26) / Math.max(0.6, handle._density);
          }
          if (!handle._preroll) handle._timer = setTimeout(schedule, 600);
        };
        /* An offline render has no setTimeout worth the name -- rendering
           finishes before any of them fire -- so `preroll` lays the whole
           window down at once and never re-arms. */
        afterHandle = () => {
          const t0 = ctx.currentTime;
          handle._nextDrop = t0 + 0.05;
          handle._nearDrop = t0 + 0.12;
          handle._gustAt = t0 + 1.2;
          handle._walkAt = t0;
          handle._density = 1;
          handle._gustLevel = 1;
          handle._preroll = opts.preroll || 0;
          schedule();
        };
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
      case 'offHook': {
        /* A handset lying on a desk with an open line under it. Dial tone at
           a distance: the two tones, muffled by the fact that nobody is
           holding it to their ear, and then the howler if it goes on. */
        for (const f of [350, 440]) {
          const o = ctx.createOscillator();
          o.type = 'sine'; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.value = 0.020;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
          o.connect(g).connect(lp).connect(out);
          o.start();
          stops.push(() => { try { o.stop(); } catch {} });
        }
        out.connect(this.buses.phone);
        break;
      }
      default:
        /* ---- a telephone ringing somewhere else in the building ----
           `ring:<id>` loops the cadence of one instrument, with a lowpass
           that stands in for the walls between it and the player. This is
           the whole basis of the breaker sequence and of 4:17: the desk
           phone, heard from the far end of the corridor. */
        if (name.startsWith('ring:')) {
          const bell = opts.kind !== 'electronic';
          const muffle = ctx.createBiquadFilter();
          muffle.type = 'lowpass';
          muffle.frequency.value = 5000;
          muffle.Q.value = 0.6;
          muffle.connect(out);
          out.connect(this.buses.phone);
          out.gain.value = opts.volume ?? 0.0001;

          const strike = (when) => {
            if (bell) {
              for (let i = 0; i < 16; i++) {
                const bt = when + i * 0.05;
                const o = ctx.createOscillator(); const g = ctx.createGain();
                o.type = 'triangle';
                o.frequency.value = i % 2 ? 1040 : 1385;
                g.gain.setValueAtTime(0.30, bt);
                g.gain.exponentialRampToValueAtTime(0.0001, bt + 0.08);
                o.connect(g).connect(muffle);
                o.start(bt); o.stop(bt + 0.09);
              }
            } else {
              const o = ctx.createOscillator(); const g = ctx.createGain();
              o.type = 'square'; o.frequency.value = 1320;
              g.gain.setValueAtTime(0.0001, when);
              g.gain.linearRampToValueAtTime(0.22, when + 0.01);
              g.gain.setValueAtTime(0.22, when + 0.34);
              g.gain.exponentialRampToValueAtTime(0.0001, when + 0.38);
              o.connect(g).connect(muffle);
              o.start(when); o.stop(when + 0.4);
            }
          };
          /* Scheduled ahead in a rolling window, like the rain, so the
             cadence is sample-accurate rather than at the mercy of a frame. */
          const schedule = () => {
            if (!this.loops.has(name)) return;
            const until = ctx.currentTime + 2.5;
            while (handle._nextRing < until) {
              strike(Math.max(ctx.currentTime, handle._nextRing));
              handle._nextRing += 2.0;               // ring, pause, ring
            }
            handle._timer = setTimeout(schedule, 1200);
          };
          afterHandle = () => {
            handle._nextRing = ctx.currentTime + 0.05;
            handle._muffle = muffle;
            schedule();
          };
          stops.push(() => clearTimeout(handle._timer));
          break;
        }
        return null;
    }

    const handle = {
      name,
      gain: out,
      _timer: null,
      _nextDrop: 0,
      _nearDrop: 0,
      _gustAt: 0,
      _walkAt: 0,
      _density: 1,
      _gustLevel: 1,
      _preroll: 0,
      _nextRing: 0,
      _muffle: null,
      /** 0 = in the room with you, 1 = through two walls and a corridor. */
      setMuffle: (k, ramp = 0.2) => {
        if (!handle._muffle) return;
        const hz = 5200 - Math.min(1, Math.max(0, k)) * 4500;
        handle._muffle.frequency.setTargetAtTime(hz, ctx.currentTime, ramp);
      },
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
    if (afterHandle) afterHandle();
    return handle;
  }

  stopLoop(name, fade) { const h = this.loops.get(name); if (h) h.stop(fade); }
  /** Ride a running loop's level -- the storm easing before 0417. */
  setLoopVolume(name, v, ramp = 1.0) {
    const h = this.loops.get(name);
    if (h && h.setVolume) h.setVolume(v, ramp);
    return !!h;
  }
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
