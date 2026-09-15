/* ============================================================
   render.mjs -- render the game's audio to real files.

   There is no sound card in CI, and "it sounds like static" is
   not something a spectrum plot will tell you. So this renders
   the synthesis OFFLINE -- the whole audio engine running in an
   OfflineAudioContext, faster than real time -- pulls the samples
   back out, measures them properly, and writes WAVs to ./audio
   so a person can listen to exactly what the game would play.

   The measurement that matters is the ENVELOPE, not the spectrum.
   Static and rain can have identical frequency balance; what
   separates them is that static holds one level forever and rain
   is thousands of separate impacts. So: how much does the level
   wander (cv), how far do peaks stand above the average (crest),
   and how many discrete hits are there per second (spikes).
   ============================================================ */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.env.OUT || 'audio';
const PORT = process.env.PORT || 8080;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push(ok);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  -- ' + detail : ''}`);
};

/**
 * Render one thing offline and hand back samples + measurements.
 * `build` runs inside the page with a fresh AudioEngine on an offline
 * context, and is given (engine, seconds).
 */
const render = async (label, seconds, build) => page.evaluate(async ([seconds, buildSrc]) => {
  const { AudioEngine } = await import('/src/engine/audio.js');
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.floor(rate * seconds), rate);
  const engine = new AudioEngine(window.__game.settings);
  await engine.init({ context: ctx });
  // eslint-disable-next-line no-new-func
  await new Function('engine', 'seconds', `return (${buildSrc})(engine, seconds);`)(engine, seconds);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);

  /* ---- measure ----
     3ms windows, because a drop on glass is over in ten. An 11ms window
     smears two impacts into one and reports dense rain as a smooth bed --
     which was exactly the mistake the sound itself used to make. */
  const win = 128;
  const env = [];
  let peak = 0, sumSq = 0;
  for (let i = 0; i + win <= d.length; i += win) {
    let sq = 0;
    for (let j = 0; j < win; j++) {
      const v = d[i + j];
      sq += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    sumSq += sq;
    env.push(Math.sqrt(sq / win));
  }
  const rms = Math.sqrt(sumSq / Math.max(1, d.length));
  const mean = env.reduce((a, b) => a + b, 0) / Math.max(1, env.length);
  const varn = env.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, env.length);

  /* An onset detector, not a threshold: a rise that stands above the local
     average AND is a local maximum. That counts impacts rather than counting
     "moments when it happened to be loud", which a swell also satisfies. */
  const baselineWindows = 32;            // ~90ms of history
  let onsets = 0, run = 0;
  for (let i = 1; i < env.length - 1; i++) {
    const from = Math.max(0, i - baselineWindows);
    let base = 0;
    for (let j = from; j < i; j++) base += env[j];
    base /= Math.max(1, i - from);
    const isPeak = env[i] >= env[i - 1] && env[i] > env[i + 1];
    if (isPeak && env[i] > base * 1.9 && env[i] > 0.004) {
      if (run === 0) onsets++;
      run = 3;
    } else if (run > 0) run--;
  }
  const spikes = onsets;

  /* ---- a coarse spectrum, from one FFT-free band split via filtering ----
     Cheap and good enough: compare energy above and below ~2kHz using a
     one-pole split, which is all the "is it hiss" question needs. */
  let lp = 0, hiEnergy = 0, loEnergy = 0, hiPeak = 0;
  const a = Math.exp(-2 * Math.PI * 2000 / rate);
  for (let i = 0; i < d.length; i++) {
    lp = (1 - a) * d[i] + a * lp;
    loEnergy += lp * lp;
    const hi = d[i] - lp;
    hiEnergy += hi * hi;
    const ha = Math.abs(hi);
    if (ha > hiPeak) hiPeak = ha;
  }

  /* ---- 16-bit WAV, base64 ---- */
  const bytes = new DataView(new ArrayBuffer(44 + d.length * 2));
  const str = (off, t) => { for (let i = 0; i < t.length; i++) bytes.setUint8(off + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); bytes.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true);
  bytes.setUint16(22, 1, true); bytes.setUint32(24, rate, true);
  bytes.setUint32(28, rate * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
  str(36, 'data'); bytes.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) {
    const v = Math.max(-1, Math.min(1, d[i]));
    bytes.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  let bin = '';
  const u8 = new Uint8Array(bytes.buffer);
  for (let i = 0; i < u8.length; i += 8192) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  }

  return {
    wav: btoa(bin),
    seconds,
    rms,
    peak,
    cv: mean > 0 ? Math.sqrt(varn) / mean : 0,
    crest: mean > 0 ? peak / mean : 0,
    spikesPerSecond: spikes / seconds,
    highFraction: hiEnergy / Math.max(1e-12, hiEnergy + loEnergy),
    // Energy above 2kHz is a tiny fraction of a bass-heavy mix even when the
    // top end is plainly audible, so the PEAK up there is the honest question:
    // are there transients on the glass, or is the whole thing a rumble?
    highPeak: hiPeak,
  };
}, [seconds, build.toString()]).then((r) => {
  writeFileSync(`${OUT}/${label}.wav`, Buffer.from(r.wav, 'base64'));
  delete r.wav;
  return r;
});

const fmt = (r) => `rms ${r.rms.toFixed(4)}  peak ${r.peak.toFixed(2)}  cv ${r.cv.toFixed(2)}`
  + `  crest ${r.crest.toFixed(1)}  hits/s ${r.spikesPerSecond.toFixed(1)}`
  + `  >2kHz ${(r.highFraction * 100).toFixed(1)}%/pk ${r.highPeak.toFixed(3)}`;

console.log('--- rendering ---');

const rain = await render('rain', 10, (e, s) => { e.loop('rain', { volume: 0.55, preroll: s }); });
console.log(`rain            ${fmt(rain)}`);

const staticRef = await render('static-reference', 6, (e) => { e.loop('radioStatic', { volume: 0.55 }); });
console.log(`static (ref)    ${fmt(staticRef)}`);

const room = await render('room-tone', 6, (e) => {
  e.loop('fluorescent', { volume: 0.45 });
  e.loop('crtWhine', { volume: 0.30 });
});
console.log(`room tone       ${fmt(room)}`);

const lines = [
  ['voice-daley', 'I was just sitting here and everything went off at once. The whole street, I think.', 'daley', 'clean'],
  ['voice-merrick', "I've been on hold for eleven minutes. Eleven. Is anybody actually out there?", 'merrick', 'clean'],
  ['voice-keefe-1978', 'Wright County Power and Light, overnight dispatch. Who is this?', 'keefe', 'era1978'],
  ['voice-pratt-1956', "We've been getting calls from 1956. Do you understand what I'm telling you?", 'ott', 'era1956'],
];
const voices = [];
for (const [label, text, voice, line] of lines) {
  const r = await render(label, 7, new Function('e', `
    const h = e.speak(${JSON.stringify(text)}, ${JSON.stringify({ voice, line })});
    window.__spokenFor = h.duration;
  `));
  r.words = text.split(/\s+/).length;
  r.spoken = await page.evaluate(() => window.__spokenFor);
  voices.push([label, r]);
  console.log(`${label.padEnd(16)}${fmt(r)}  ${r.spoken.toFixed(1)}s for ${r.words} words`);
}

console.log('\n--- verdict ---');

/* Rain against a known piece of static, rendered through the same path. The
   radio's inter-station hiss IS static -- it is supposed to be -- so it is the
   honest control for "does the rain still sound like that". */
check('rain moves, static does not', rain.cv > staticRef.cv * 2.2,
  `rain cv ${rain.cv.toFixed(2)} vs static ${staticRef.cv.toFixed(2)}`);
check('rain is made of discrete impacts', rain.spikesPerSecond > 6,
  `${rain.spikesPerSecond.toFixed(1)} hits/s (static: ${staticRef.spikesPerSecond.toFixed(1)})`);
check('rain peaks stand above its own bed', rain.crest > 4.5, `crest ${rain.crest.toFixed(1)}`);
check('rain is not hiss', rain.highFraction < 0.12,
  `${(rain.highFraction * 100).toFixed(1)}% above 2kHz (static: ${(staticRef.highFraction * 100).toFixed(1)}%)`);
check('but there is still glass being hit', rain.highPeak > 0.03,
  `high-band peak ${rain.highPeak.toFixed(3)}`);
check('rain is audible', rain.rms > 0.01 && rain.peak < 0.95, `rms ${rain.rms.toFixed(3)}`);
check('room tone stays under the rain', room.rms < rain.rms * 0.5,
  `${room.rms.toFixed(4)} vs ${rain.rms.toFixed(4)}`);

/* A voice has to be the opposite of a bed: it starts, it stops, it has
   syllables. A flat envelope here means a tone, not speech. */
for (const [label, r] of voices) {
  check(`${label} has speech rhythm`, r.cv > 0.55 && r.spikesPerSecond > 1.2,
    `cv ${r.cv.toFixed(2)}, ${r.spikesPerSecond.toFixed(1)} hits/s`);
}
/* Speech runs at roughly 2.2-3.2 words a second in conversation. A line that
   takes half that is a machine reading; twice is a robot. */
for (const [label, r] of voices) {
  const wps = r.words / r.spoken;
  check(`${label} is paced like speech`, wps > 1.5 && wps < 4.2, `${wps.toFixed(1)} words/sec`);
}
for (const [label, r] of voices) {
  check(`${label} does not clip`, r.peak < 0.85, `peak ${r.peak.toFixed(2)}`);
}

const telephone = voices.find(([l]) => l === 'voice-daley')[1];
check('a telephone voice sits in the telephone band', telephone.highFraction < 0.35,
  `${(telephone.highFraction * 100).toFixed(1)}% above 2kHz`);

check('no runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log(`\nwrote ${OUT}/*.wav -- listen to these, do not trust the numbers alone`);
await browser.close();
const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
