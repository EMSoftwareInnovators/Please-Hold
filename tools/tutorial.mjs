/* ============================================================
   tutorial.mjs -- plays the handover call the way a new player
   would, and asserts that every `waitFor` gate actually opens
   when the player does the thing it asked for.

   A tutorial that teaches by waiting has one failure mode that
   matters: a gate whose condition can never be satisfied, which
   strands the player with an instruction and no way out. This
   test exists to catch that.
   ============================================================ */
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || 8080;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push(ok);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  -- ' + detail : ''}`);
};

await page.keyboard.press('Enter');
await page.waitForTimeout(900);
await page.evaluate(() => {
  const g = window.__game;
  g.director.minGapSeconds = 0.05;
  window.__hints = [];
  window.__bus.on(window.__events.WAITING, ({ hint }) => { if (hint) window.__hints.push(hint); });
});

/** Run the conversation forward until it blocks on a gate, or ends. */
const runToGate = async (limit = 400) => page.evaluate(async (limit) => {
  const g = window.__game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < limit; i++) {
    if (!g.runner.active) return { done: true };
    if (g.runner.blocked) return { gate: g.runner.nodeId, hint: g.runner.hint };
    if (g.callUI.choices.length) {
      // take the reply that asks a question where there is one -- more text
      g.callUI.pick(Math.min(1, g.callUI.choices.length - 1));
    } else if (g.callUI.visible && g.callUI._timer > 0) {
      g.callUI._timer = 0;
      if (g.callUI._pendingPlayerLine) { g.callUI._pendingPlayerLine = false; g.runner.playerLineFinished(); }
      else g.runner.lineFinished();
    }
    await sleep(6);
  }
  return { stuck: true, node: g.runner.nodeId };
}, limit);

/* The phone should ring by itself -- the tutorial is beat 0. */
await page.waitForFunction(() => window.__game.phone.anyRinging, null, { timeout: 30000 }).catch(() => {});
const ringing = await page.evaluate(() => {
  const l = window.__game.phone.lines.find((x) => x.state === 'RINGING');
  return l ? l.call.id : null;
});
check('the shift opens with the handover call', ringing === 'tutorial_01', String(ringing));

await page.keyboard.press('f');
await page.waitForTimeout(400);

/* --- gate 1: sit down --- */
let g1 = await runToGate();
check('gate 1 asks the player to sit down', g1.gate === 'wait_sit', JSON.stringify(g1));
await page.evaluate(() => window.__game.interaction.handlers.get('seat')());
await page.waitForTimeout(400);

/* --- gate 2: open the terminal --- */
let g2 = await runToGate();
check('sitting down satisfies gate 1', g2.gate === 'wait_terminal', JSON.stringify(g2));
await page.evaluate(() => window.__game.focusTerminal(true));
await page.waitForTimeout(400);

/* --- gate 3: look somebody up --- */
let g3 = await runToGate();
check('opening the terminal satisfies gate 2', g3.gate === 'wait_lookup', JSON.stringify(g3));
await page.keyboard.press('F2');
for (const ch of 'PRZ') await page.keyboard.press(ch);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('the search she suggests actually finds somebody',
  await page.evaluate(() => window.__game.database.wasLookedUp('WH-40877')));

/* --- gate 4: write a ticket --- */
let g4 = await runToGate();
check('a lookup satisfies gate 3', g4.gate === 'wait_ticket', JSON.stringify(g4));
await page.keyboard.press('F3');
await page.keyboard.press('n');
await page.waitForTimeout(250);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('a ticket gets written', (await page.evaluate(() => window.__game.outages.list.length)) > 0);

/* --- gate 5: send a truck --- */
let g5 = await runToGate();
check('a ticket satisfies gate 4', g5.gate === 'wait_dispatch', JSON.stringify(g5));
await page.evaluate(() => {
  const g = window.__game;
  const t = g.outages.unassigned()[0];
  const rec = g.dispatcher.recommend(t.id).find((r) => r.free && r.qualified);
  g.dispatcher.send(rec.crew.id, t.id);
});
await page.waitForTimeout(400);

/* --- gate 6: the hold button --- */
let g6 = await runToGate();
check('a dispatch satisfies gate 5', g6.gate === 'wait_hold', JSON.stringify(g6));
await page.evaluate(() => window.__game.focusTerminal(false));
await page.keyboard.press('h');
await page.waitForTimeout(500);
const held = await page.evaluate(() => window.__game.phone.held.length);
await page.keyboard.press('h');
await page.waitForTimeout(500);
check('holding the supervisor and coming back works', held === 1
  && (await page.evaluate(() => window.__game.phone.activeLine !== null)));

/* --- and out --- */
const fin = await runToGate();
check('the handover finishes', fin.done === true, JSON.stringify(fin));

const out = await page.evaluate(() => ({
  beat: window.__game.gameState.beat,
  done: window.__game.gameState.has('tutorial_done'),
  hints: window.__hints,
  nextUp: window.__game.director.beatDue().map((c) => c.id),
}));
console.log('\nhints shown to the player:');
for (const h of out.hints) console.log('   ' + h);
console.log('');
check('the tutorial hands off to the shift', out.done && out.beat >= 1, `beat ${out.beat}`);
check('the first real call is queued behind it', out.nextUp.includes('merrick_01'), out.nextUp.join(','));
check('every gate showed an instruction', out.hints.length === 6, `${out.hints.length} hints`);
check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
