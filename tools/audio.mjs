/* ============================================================
   audio.mjs -- measures what the game actually sounds like.

   There is no audio device in CI, but WebAudio still runs the
   graph, so an AnalyserNode can be tapped onto a bus and read.
   This reports RMS level and the spectral balance of each
   ambience loop.

   It exists because "the audio is constant static" was a real
   bug that no amount of reading the code would have caught: the
   rain loop was steady filtered white noise, which is the
   definition of static, and it was the loudest thing in the mix.

   What to look for:
     * rain    should be BASS-HEAVY. If `high` is anywhere near
               `low`, it is hiss, not weather.
     * tone    (ballast + flyback) should be far below the rain.
     * peak    should stay under about 0.7 so the limiter is not
               working during ordinary play.
   ============================================================ */
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || 8080;
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
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

const ready = await page.evaluate(() => window.__game.audio.ready);
if (!ready) {
  console.log('NO AUDIO CONTEXT in this environment -- cannot measure.');
  await browser.close();
  process.exit(0);
}

/** Tap a node, listen for `ms`, report RMS/peak and a three-band split. */
const measure = async (what, ms = 2200) => page.evaluate(async ([what, ms]) => {
  const a = window.__game.audio;
  const ctx = a.ctx;
  const node = what === 'master' ? a.master : a.buses[what];
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  an.smoothingTimeConstant = 0;
  node.connect(an);

  const time = new Float32Array(an.fftSize);
  const freq = new Float32Array(an.frequencyBinCount);
  let sumSq = 0, n = 0, peak = 0;
  const bands = [0, 0, 0];
  let frames = 0;

  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    an.getFloatTimeDomainData(time);
    for (let i = 0; i < time.length; i++) {
      const v = time[i];
      sumSq += v * v; n++;
      const abs = Math.abs(v);
      if (abs > peak) peak = abs;
    }
    an.getFloatFrequencyData(freq);
    // bin -> Hz is i * sampleRate / fftSize
    const hzPerBin = ctx.sampleRate / an.fftSize;
    let lo = 0, mid = 0, hi = 0, nlo = 0, nmid = 0, nhi = 0;
    for (let i = 1; i < freq.length; i++) {
      const hz = i * hzPerBin;
      const lin = Math.pow(10, freq[i] / 20);
      if (hz < 500) { lo += lin; nlo++; }
      else if (hz < 3000) { mid += lin; nmid++; }
      else { hi += lin; nhi++; }
    }
    bands[0] += lo / Math.max(1, nlo);
    bands[1] += mid / Math.max(1, nmid);
    bands[2] += hi / Math.max(1, nhi);
    frames++;
    await new Promise((r) => setTimeout(r, 16));
  }
  node.disconnect(an);
  const total = bands[0] + bands[1] + bands[2] || 1;
  return {
    rms: Math.sqrt(sumSq / Math.max(1, n)),
    peak,
    low: bands[0] / total,
    mid: bands[1] / total,
    high: bands[2] / total,
  };
}, [what, ms]);

const fmt = (r) => `rms ${r.rms.toFixed(4)}  peak ${r.peak.toFixed(3)}  `
  + `low ${(r.low * 100).toFixed(0)}%  mid ${(r.mid * 100).toFixed(0)}%  high ${(r.high * 100).toFixed(0)}%`;

const results = {};

console.log('--- ambience, as the shift starts ---');
results.all = await measure('ambience');
console.log('rain + tone   ' + fmt(results.all));

await page.evaluate(() => { window.__game.audio.stopLoop('fluorescent', 0.05); window.__game.audio.stopLoop('crtWhine', 0.05); });
await page.waitForTimeout(700);
results.rain = await measure('ambience');
console.log('rain alone    ' + fmt(results.rain));

await page.evaluate(() => { window.__game.audio.stopLoop('rain', 0.05); });
await page.waitForTimeout(700);
await page.evaluate(() => {
  window.__game.audio.loop('fluorescent', { volume: 0.45 });
  window.__game.audio.loop('crtWhine', { volume: 0.30 });
});
await page.waitForTimeout(500);
results.tone = await measure('ambience');
console.log('room tone     ' + fmt(results.tone));

console.log('\n--- a voice, and whether its chain lets go ---');
const voice = await page.evaluate(async () => {
  const g = window.__game;
  const before = g.audio.liveVoices;
  for (let i = 0; i < 6; i++) {
    g.audio.speak('Wright County Power and Light, overnight dispatch.', { voice: 'keefe', line: 'era1978' });
    await new Promise((r) => setTimeout(r, 120));
  }
  const during = g.audio.liveVoices;
  await new Promise((r) => setTimeout(r, 7000));
  return { before, during, after: g.audio.liveVoices };
});
console.log(`live voice chains: before ${voice.before}, during ${voice.during}, after 7s ${voice.after}`);

console.log('\n--- verdict ---');
const checks = [];
const ok = (name, pass, detail) => { checks.push(pass); console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? '  -- ' + detail : ''}`); };
ok('rain is bass-weighted, not hiss', results.rain.low > results.rain.high * 1.5,
  `low ${(results.rain.low * 100).toFixed(0)}% vs high ${(results.rain.high * 100).toFixed(0)}%`);
ok('rain is audible at all', results.rain.rms > 0.002, `rms ${results.rain.rms.toFixed(4)}`);
ok('room tone sits well under the rain', results.tone.rms < results.rain.rms * 0.7,
  `tone ${results.tone.rms.toFixed(4)} vs rain ${results.rain.rms.toFixed(4)}`);
ok('ambience does not approach full scale', results.all.peak < 0.75, `peak ${results.all.peak.toFixed(3)}`);
ok('voice chains are released', voice.after === 0, `${voice.after} still live`);
ok('no runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close();
process.exit(checks.every(Boolean) ? 0 : 1);
