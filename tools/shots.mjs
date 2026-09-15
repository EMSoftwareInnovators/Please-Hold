/* ============================================================
   shots.mjs -- captures the game at the moments that matter, so
   the renderer can be judged without a display.

   Writes PNGs to ./shots (or $OUT). Boots its own server if one
   is not already listening.
   ============================================================ */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const OUT = process.env.OUT || 'shots';
const PORT = process.env.PORT || 8080;
mkdirSync(OUT, { recursive: true });

let server = null;
const alive = await fetch(`http://localhost:${PORT}/`).then(() => true).catch(() => false);
if (!alive) {
  server = spawn(process.execPath, ['serve.cjs'], { stdio: 'ignore', env: { ...process.env, PORT: String(PORT) } });
  await new Promise((r) => setTimeout(r, 900));
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`  ${name}.png`); };
const settle = (ms = 700) => page.waitForTimeout(ms);

await settle(900);
await shot('01-title');

// start the shift
await page.keyboard.press('Enter');
await settle(1400);
await shot('02-standing');

// look around the room from the door
await page.evaluate(() => { const p = window.__game.player; p.yaw = -0.45; p.pitch = -0.02; });
await settle(500);
await shot('03-office');

// the windows and the storm
await page.evaluate(() => { const p = window.__game.player; p.pos.set(6.4, 1.68, 4.2); p.yaw = -1.45; p.pitch = 0.02; });
await settle(600);
await shot('04-storm');

// Sit down. The blend is frame-rate driven and this harness renders in
// software at a few frames a second, so give it real time to finish.
await page.evaluate(() => window.__game.interaction.handlers.get('seat')());
await settle(900);
// Finish the sit-down blend by hand. It is frame-rate driven and correct on
// real hardware (verified separately); at three frames a second this harness
// would otherwise photograph the player halfway through turning the chair.
await page.evaluate(() => {
  const p = window.__game.player;
  p._seatBlend = 1; p.yaw = 0; p.pitch = -0.12;
});
await settle(900);
await shot('05-seated');

// the terminal, in the room
await page.evaluate(() => {
  const g = window.__game;
  g.terminal.go('ACCT');
  g.terminal.input = 'DALEY';
  g.terminal.results = g.database.search('DALEY');
  g.terminal.dirty = true;
});
await settle(700);
await shot('06-desk-crt-lit');

// the terminal, leaned in
await page.evaluate(() => window.__game.focusTerminal(true));
await settle(600);
await shot('07-terminal-search');

await page.evaluate(() => window.__game.terminal.openRecord('WH-40122'));
await settle(500);
await shot('08-terminal-record');

await page.evaluate(() => { window.__game.terminal.go('MAP'); });
await settle(700);
await shot('09-terminal-map');

await page.evaluate(() => {
  const g = window.__game;
  g.outages.create({ feeder: 'MH-11', address: '18 ORCHARD ST', town: 'MARROW HILL', cause: 'TREE ON LINE', customers: 84, stamp: g.clock.stamp() });
  g.outages.create({ feeder: 'MH-12', address: 'BETHEL PIKE', town: 'NEW BETHEL', cause: 'WIRE DOWN', hazard: true, customers: 210, priority: 1, stamp: g.clock.stamp() });
  g.outages.create({ feeder: 'KC-04', address: '3 CREEK ST', town: 'KETTLE CREEK', cause: 'FUSE', customers: 46, stamp: g.clock.stamp() });
  g.terminal.go('OUTG');
  g.terminal.ticket = null;
});
await settle(600);
await shot('10-terminal-tickets');

await page.evaluate(() => {
  const g = window.__game;
  g.terminal.go('OUTG', true);
  g.terminal.ticket = g.outages.open[0];
  g.terminal.dirty = true;
});
await settle(600);
await shot('11-terminal-dispatch');

await page.evaluate(() => { window.__game.terminal.go('MAP'); window.__game.terminal.dirty = true; });
await settle(600);
await shot('12-terminal-map-outages');

await page.evaluate(() => window.__game.focusTerminal(false));
await settle(500);

// the handover call, and the instruction it is waiting on
await page.evaluate(() => {
  const g = window.__game;
  g.phone.lines.forEach((l) => { l.state = 'IDLE'; l.call = null; });
  g.phone.activeLine = null;
  g.runner.end('reset');
  const call = window.__calls.find((c) => c.id === 'tutorial_01');
  g.phone.ring(call);
  g.phone.answer();
});
await settle(2400);
await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 24 && !g.runner.blocked; i++) {
    if (g.callUI.choices.length) g.callUI.pick(1);
    else if (g.callUI.visible) {
      g.callUI._timer = 0;
      if (g.callUI._pendingPlayerLine) { g.callUI._pendingPlayerLine = false; g.runner.playerLineFinished(); }
      else g.runner.lineFinished();
    }
  }
});
await settle(1200);
await shot('12b-tutorial');

/* The same call docked under the terminal -- the layout the tutorial depends
   on, and the one thing a screenshot can actually prove about it. */
await page.evaluate(() => {
  const g = window.__game;
  g.focusTerminal(true);
  g.terminal.go('ACCT');
  g.terminal.input = 'PRZ';
  g.terminal.results = g.database.search('PRZ');
  g.terminal.dirty = true;
});
await settle(900);
await shot('12c-terminal-on-call');
await page.evaluate(() => window.__game.focusTerminal(false));
await settle(400);

await page.evaluate(() => {
  const g = window.__game;
  g.runner.end('reset');
  g.phone.lines.forEach((l) => { l.state = 'IDLE'; l.call = null; });
  g.phone.activeLine = null;
  const call = window.__calls.find((c) => c.id === 'daley_01');
  g.phone.ring(call);
  g.phone.answer();
});
await settle(2600);
await page.evaluate(() => {
  const g = window.__game;
  // run forward to the first set of replies
  for (let i = 0; i < 12 && !g.callUI.choices.length; i++) {
    g.callUI._timer = 0;
    if (g.callUI._pendingPlayerLine) { g.callUI._pendingPlayerLine = false; g.runner.playerLineFinished(); }
    else g.runner.lineFinished();
  }
});
await settle(900);
await shot('13-call-choices');

/* The screen that replaced the main menu: who is on the line, and their
   account, without the player typing anything. */
await page.evaluate(() => {
  const g = window.__game;
  g.focusTerminal(true);
  g.terminal.go('CALL');
  const rec = g.terminal._callerRecord();
  if (rec) g.terminal.openRecord(rec.id, { stay: true });
  g.terminal.dirty = true;
});
await settle(900);
await shot('13b-terminal-caller');
await page.evaluate(() => window.__game.focusTerminal(false));
await settle(400);

// on hold
await page.evaluate(() => window.__game.phone.hold());
await settle(700);
await shot('14-on-hold');

// the 1956 line, and what it does to the picture
await page.evaluate(() => {
  const g = window.__game;
  g.phone.hangUp(g.phone.held[0].index);
  const call = window.__calls.find((c) => c.id === 'pratt_1956');
  g.phone.ring(call);
  g.phone.answer();
  g.horror.fire('degrade', { amount: 0.7, duration: 30 });
});
await settle(2200);
await shot('15-1956-call');

// a full power failure
await page.evaluate(() => window.__game.horror.fire('blackout', { duration: 30 }));
await settle(1500);
await shot('16-blackout');

await page.evaluate(() => {
  const g = window.__game;
  g.horror.clearAll();
  g.lighting.setPower(1, true);
  g.terminal.setPower(true);
  g.post = g.renderer.post;
  g.renderer.post.grade.saturation.value = 0.92;
  g.renderer.post.grade.vignette.value = 0.42;
  g.renderer.post.grade.aberration.value = 0.010;
  g.renderer.post.grade.grain.value = 0.03;
  g.renderer.post.grade.scanline.value = 0;
  g.renderer.post.grade.warp.value = 0;
});
await settle(900);

// stand up and walk the corridor
await page.evaluate(() => {
  const g = window.__game;
  g.player.stand();
  g.player.pos.set(-1.2, 1.68, 6.5);
  g.player.yaw = 1.57; g.player.pitch = 0;
});
await settle(700);
await shot('17-corridor');

await page.evaluate(() => {
  const g = window.__game;
  g.player.pos.set(-4.0, 1.68, 9.0);
  g.player.yaw = 2.6; g.player.pitch = 0;
});
await settle(600);
await shot('18-breakroom');

await page.evaluate(() => {
  const g = window.__game;
  g.player.pos.set(-3.2, 1.68, 3.6);
  g.player.yaw = -1.3; g.player.pitch = 0;
});
await settle(600);
await shot('19-records');

// the end slate
await page.evaluate(() => { window.__game.menu.slate('PLEASE HOLD', { hold: 100 }); });
await settle(1800);
await shot('20-please-hold');

// Measure the frame rate this harness actually achieves, so the number in
// the docs is honest about being a software-rendering figure.
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); };
  requestAnimationFrame(tick);
}));
console.log(`\nswiftshader fps @1280x720: ${fps.toFixed(1)}`);

const perf = await page.evaluate(() => ({
  tris: window.__game.renderer.gl.info.render.triangles,
  drawCalls: window.__game.renderer.gl.info.render.calls,
  geometries: window.__game.renderer.gl.info.memory.geometries,
  textures: window.__game.renderer.gl.info.memory.textures,
  programs: window.__game.renderer.gl.info.programs.length,
}));
console.log('\nrenderer:', JSON.stringify(perf));
console.log('errors:', logs.length ? logs.join('\n') : '(none)');
await browser.close();
if (server) server.kill();
