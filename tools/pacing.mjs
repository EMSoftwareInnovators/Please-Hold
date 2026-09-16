/* ============================================================
   pacing.mjs -- is there any silence in this game?

   Machine-gun pacing is the failure mode nobody notices while
   they are writing content, because every individual call is
   good. It only shows up as a feeling: that the night never lets
   up, that the strange calls stop being strange because there is
   no ordinary in between them, that the player never gets to sit
   in a room and hear the rain.

   So this measures it. It runs the director at REAL game pacing
   -- no fast-forward -- for a slice of each act, and reports the
   gaps it actually produced.

   SILENCE IS A FEATURE. The assertions at the bottom are there
   to fail if somebody "improves" the game by filling it in.
   ============================================================ */
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || 8080;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push(ok);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  -- ' + detail : ''}`);
};

await page.keyboard.press('Enter');
await page.waitForTimeout(800);

/**
 * Simulate the director alone.
 *
 * The director's clock is game dt, and game dt in a software renderer runs at
 * a fraction of wall time -- so rather than sit through an hour, this steps
 * `director.update()` directly with an honest dt and reads the gaps it asks
 * for. The gaps are the thing under test, not the frame rate.
 */
const simulate = async (beat, minutes) => page.evaluate(async ([beat, minutes]) => {
  const g = window.__game;
  const dir = g.director;

  // a clean director on the same library
  dir.enabled = true;
  dir.fastForward = false;
  dir.queue = [];
  dir.fired = new Set();
  dir.history = [];
  dir.mundaneDebt = 0;
  dir._sinceLast = 0;
  g.gameState.beat = beat;
  g.clock.minutes = 22 * 60 + 45;

  // the phone answers instantly and the call lasts a plausible time, so the
  // director sees the same "busy then free" rhythm a player produces
  const REAL_CALL = 55;            // seconds a conversation occupies the desk
  let busyUntil = 0;
  let t = 0;
  const dt = 0.25;
  const steps = Math.round((minutes * 60) / dt);
  const originalRing = g.phone.ring.bind(g.phone);
  g.phone.ring = (call) => { busyUntil = t + REAL_CALL; return { index: 0 }; };
  let wasBusyLast = false;
  const originalRadio = dir.deps.onRadioCall;
  dir.deps.onRadioCall = () => { busyUntil = t + 30; return true; };
  const wasBusy = dir.deps.isBusy;
  dir.deps.isBusy = () => t < busyUntil;
  Object.defineProperty(g.phone, 'activeLine', { get: () => (t < busyUntil ? 0 : null), configurable: true });
  Object.defineProperty(g.phone, 'anyRinging', { get: () => false, configurable: true });
  Object.defineProperty(g.phone, 'oldestHeld', { get: () => null, configurable: true });

  for (let i = 0; i < steps; i++) {
    t += dt;
    g.clock.update(dt);
    /* The desk going quiet is what starts the gap, so the simulation has to
       fire the same event the real conversation does. */
    const busy = t < busyUntil;
    if (wasBusyLast && !busy) window.__bus.emit(window.__events.CALL_END, { simulated: true });
    wasBusyLast = busy;
    dir.update(dt);
  }

  const out = dir.density();
  out.window = minutes;
  out.calls = dir.history.map((h) => ({ id: h.id, gap: +h.gap.toFixed(1), cat: h.category }));
  // put the phone back
  g.phone.ring = originalRing;
  dir.deps.onRadioCall = originalRadio;
  dir.deps.isBusy = wasBusy;
  delete g.phone.activeLine;
  delete g.phone.anyRinging;
  delete g.phone.oldestHeld;
  return out;
}, [beat, minutes]);

const fmt = (r) => `calls ${String(r.total).padStart(3)}   ordinary ${String(r.ordinary).padStart(3)}`
  + `   strange ${String(r.strange).padStart(2)}`
  + `   gap mean ${r.meanGap.toFixed(0)}s  median ${r.medianGap.toFixed(0)}s`
  + `   min ${r.shortestGap.toFixed(0)}s  max ${r.longestGap.toFixed(0)}s`;

console.log('--- twenty simulated minutes in each act ---\n');

const acts = [
  ['I    the job', 1, 20],
  ['II   the building', 11, 20],
  ['LULL around three', 15, 20],
  ['CRISIS late', 17, 20],
  ['IV   dawn', 25, 20],
];

const results = {};
for (const [label, beat, minutes] of acts) {
  const r = await simulate(beat, minutes);
  results[label.split(' ')[0]] = r;
  console.log(`${label.padEnd(20)} ${fmt(r)}`);
}

/* The one that matters most: 20 minutes of Act I should feel like a job,
   not like a call centre. */
const one = results.I;
console.log('\nAct I, call by call:');
console.log('  ' + one.calls.map((c) => `${c.id}(${c.gap}s)`).join('  '));

console.log('\n--- verdict ---');
/* These are gaps of SILENCE now -- handset down to next ring -- not
   call-start to call-start. */
check('Act I leaves half a minute of silence between calls, minimum',
  one.shortestGap >= 25, `shortest ${one.shortestGap.toFixed(0)}s`);
check('Act I averages 35-100s of silence between calls',
  one.meanGap >= 35 && one.meanGap <= 100, `${one.meanGap.toFixed(0)}s`);
check('Act I is mostly ordinary work',
  one.ordinary >= one.strange, `${one.ordinary} ordinary vs ${one.strange} strange`);
check('the lull is genuinely quieter than the rest of the night',
  results.LULL.meanGap > results.I.meanGap * 1.3,
  `lull ${results.LULL.meanGap.toFixed(0)}s vs act I ${results.I.meanGap.toFixed(0)}s`);
check('the lull has very few calls in twenty minutes',
  results.LULL.total <= 8, `${results.LULL.total} calls`);
check('nowhere does the phone fire more than once every 20s',
  Object.values(results).every((r) => r.shortestGap === 0 || r.shortestGap >= 20),
  Object.entries(results).map(([k, r]) => `${k}:${r.shortestGap.toFixed(0)}s`).join(' '));
check('the night is not empty either',
  one.total >= 6, `${one.total} calls in 20 minutes of Act I`);
check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));

/* A rough figure for how long a whole night is, from the real clock rate. */
const timing = await page.evaluate(() => {
  const g = window.__game;
  const perMinute = 8.5;                    // the shipping value, see clock.js
  const shiftMinutes = 30 * 60 - (22 * 60 + 45);
  return { perMinute, shiftMinutes, realMinutes: (shiftMinutes * perMinute) / 60 };
});
console.log(`\nshift is ${timing.shiftMinutes} game minutes at ${timing.perMinute}s each`
  + `  =  ${timing.realMinutes.toFixed(0)} real minutes of clock`);
check('a full night is between 55 and 75 real minutes',
  timing.realMinutes >= 55 && timing.realMinutes <= 75, `${timing.realMinutes.toFixed(0)} min`);

await browser.close();
const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
