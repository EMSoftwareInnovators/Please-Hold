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
  /* The director now aims for a GAP measured in game seconds -- 34 to 78 of
     them in Act I -- and game time runs at a fraction of wall time in a
     software renderer. Without this the first call arrives five real minutes
     from now. See tools/pacing.mjs for what the gaps are for. */
  g.director.fastForward = true;
  g.director._target = 0;
  window.__hints = [];
  window.__shown = [];
  window.__gates = [];
  window.__bus.on(window.__events.WAITING, ({ hint, node }) => {
    if (!hint) return;
    window.__hints.push(hint);
    window.__gates.push(node);
    /* Read it NOW, not on a timer: the HUD is written synchronously in the
       same handler, and a gate the player satisfies quickly clears the line
       again within a frame or two. */
    window.__shown.push(document.getElementById('objective').textContent);
  });
});

/** Run the conversation forward until it blocks on a NEW gate, or ends.
 *
 *  `from` is the gate we are leaving. Without it this raced the frame loop:
 *  a gate whose condition the harness had just satisfied still reads as
 *  blocked until the runner ticks, and at three frames a second in software
 *  rendering that is a third of a second of reporting the old answer. So it
 *  ticks the runner itself rather than waiting to be told. */
const runToGate = async (from = null, limit = 400) => page.evaluate(async ([from, limit]) => {
  const g = window.__game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < limit; i++) {
    if (!g.runner.active) return { done: true };
    if (g.runner.blocked) {
      if (g.runner.nodeId !== from) return { gate: g.runner.nodeId, hint: g.runner.hint };
      g.runner.tick();                 // the gate may already be satisfied
      await sleep(6);
      continue;
    }
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
}, [from, limit]);

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
let g2 = await runToGate('wait_sit');
check('sitting down satisfies gate 1', g2.gate === 'wait_terminal', JSON.stringify(g2));
await page.evaluate(() => window.__game.focusTerminal(true));
await page.waitForTimeout(400);

/* --- gate 3: look somebody up --- */
let g3 = await runToGate('wait_terminal');
check('opening the terminal satisfies gate 2', g3.gate === 'wait_lookup', JSON.stringify(g3));
await page.keyboard.press('3');                 // ACCOUNTS
for (const ch of 'PRZ') await page.keyboard.press(ch);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('the search she suggests actually finds somebody',
  await page.evaluate(() => window.__game.database.wasLookedUp('WH-40877')));

/* --- gate 4: write a ticket --- */
let g4 = await runToGate('wait_lookup');
check('a lookup satisfies gate 3', g4.gate === 'wait_ticket', JSON.stringify(g4));
/* N works from wherever the player is now -- that is the point of the
   change -- so this presses it on whatever screen the lookup left them on. */
await page.keyboard.press('n');
await page.waitForTimeout(250);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('a ticket gets written', (await page.evaluate(() => window.__game.outages.list.length)) > 0);

/* --- gate 5: send a truck --- */
let g5 = await runToGate('wait_ticket');
check('a ticket satisfies gate 4', g5.gate === 'wait_dispatch', JSON.stringify(g5));
await page.evaluate(() => {
  const g = window.__game;
  const t = g.outages.unassigned()[0];
  const rec = g.dispatcher.recommend(t.id).find((r) => r.free && r.qualified);
  g.dispatcher.send(rec.crew.id, t.id);
});
await page.waitForTimeout(400);

/* --- gate 6: the hold button, WITHOUT leaving the terminal ---
   This is the thing that was broken: the call kept running while the player
   followed the instructions and there was no way to read it. */
let g6 = await runToGate('wait_dispatch');
check('a dispatch satisfies gate 5', g6.gate === 'wait_hold', JSON.stringify(g6));
check('still in the terminal for the whole tutorial',
  await page.evaluate(() => window.__game.terminalFocused));

const docked = await page.evaluate(() => {
  const crt = document.getElementById('crt').getBoundingClientRect();
  const head = document.getElementById('call-head').getBoundingClientRect();
  const text = document.getElementById('call-text');
  const frame = document.getElementById('crt-frame').getBoundingClientRect();
  return {
    callVisible: !document.getElementById('call').classList.contains('hidden'),
    text: (text.textContent || '').slice(0, 40),
    callBelowFrame: head.top >= frame.bottom - 2,
    onScreen: head.top >= 0 && head.bottom <= crt.bottom + 2,
  };
});
check('the call is readable while in the terminal', docked.callVisible && docked.text.length > 0, docked.text);
check('the call docks below the terminal rather than over it', docked.callBelowFrame && docked.onScreen, JSON.stringify(docked));

/* And the terminal gives up exactly as much room as the panel needs: with
   four replies on screen the panel is twice the height it is with none, and
   a fixed reservation put the terminal's own key line underneath it. */
const roomFor = await page.evaluate(async () => {
  const g = window.__game;
  g.callUI.showChoices([{ text: 'one' }, { text: 'two' }, { text: 'three' }, { text: 'four' }]);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const keys = document.getElementById('crt-keys').getBoundingClientRect();
  const head = document.getElementById('call-head').getBoundingClientRect();
  return { keysBottom: Math.round(keys.bottom), callTop: Math.round(head.top), clear: keys.bottom <= head.top + 2 };
});
check('the terminal makes room for however tall the call panel is',
  roomFor.clear, JSON.stringify(roomFor));

await page.keyboard.press('h');
await page.waitForTimeout(500);
const held = await page.evaluate(() => window.__game.phone.held.length);
await page.keyboard.press('h');
await page.waitForTimeout(500);
check('H holds and resumes from inside the terminal', held === 1
  && (await page.evaluate(() => window.__game.phone.activeLine !== null)));

/* --- replies can be taken from inside the terminal --- */
await page.evaluate(async () => {
  const g = window.__game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !g.callUI.choices.length && g.runner.active; i++) {
    if (g.callUI.visible && g.callUI._timer > 0) {
      g.callUI._timer = 0;
      if (g.callUI._pendingPlayerLine) { g.callUI._pendingPlayerLine = false; g.runner.playerLineFinished(); }
      else g.runner.lineFinished();
    }
    await sleep(6);
  }
});
const beforePick = await page.evaluate(() => window.__game.callUI.choices.length);
if (beforePick) {
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  const moved = await page.evaluate(() => window.__game.callUI.sel);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__game.callUI.choices.length);
  check('arrows and RETURN answer the caller from inside the terminal',
    moved === 1 && after === 0, `sel ${moved}, choices after ${after}`);
} else {
  check('arrows and RETURN answer the caller from inside the terminal', false, 'no choices appeared');
}

/* --- and out --- */
const fin = await runToGate();
check('the handover finishes', fin.done === true, JSON.stringify(fin));

const out = await page.evaluate(() => ({
  beat: window.__game.gameState.beat,
  done: window.__game.gameState.has('tutorial_done'),
  hints: window.__hints,
  gates: window.__gates,
  shown: window.__shown,
  /* Either still queued, or the director has already started ringing it --
     both mean the handover handed off. Asserting only "queued" made this a
     race against the director's own timer. */
  nextUp: [
    ...window.__game.director.beatDue().map((c) => c.id),
    ...window.__game.phone.lines.filter((l) => l.call).map((l) => l.call.id),
  ],
}));
console.log('\nhints shown to the player:');
for (const h of out.shown) console.log('   ' + h);
console.log('');
check('the tutorial hands off to the shift', out.done && out.beat >= 1, `beat ${out.beat}`);
check('the first real call is queued behind it', out.nextUp.includes('merrick_01'), out.nextUp.join(','));
/* A gate that opens before the conversation reaches it never blocks, and so
   never shows an instruction -- which is correct, not a failure. What must
   hold is that every gate the player DID hit told them what to do. */
console.log('gates hit: ' + out.gates.join(', '));
check('every gate the player hit showed an instruction',
  out.hints.length === out.gates.length && out.gates.length >= 5,
  `${out.gates.length} gates, ${out.hints.length} hints`);
/* The script writes `{hold}`; the player must read "H". A token that reaches
   the screen is worse than no hint at all. */
const unresolved = out.shown.filter((h) => /[{}]/.test(h) || !h.trim());
check('every instruction reached the screen with real key names',
  out.shown.length === out.hints.length && unresolved.length === 0,
  unresolved.length ? JSON.stringify(unresolved[0]) : `${out.shown.length} of ${out.hints.length} shown`);
const fkeys = out.shown.filter((h) => /\bF[1-9]\b/.test(h));
check('no instruction asks for a function key', fkeys.length === 0, fkeys[0] || '');
check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
