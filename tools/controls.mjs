/* ============================================================
   controls.mjs -- the input layer's regressions.

   Three things here have already gone wrong once:

   1. ESC out of the terminal put the pause menu into a loop.
      Leaving the terminal re-requests pointer lock; Chrome denies
      it for about a second after an exit; the denial was read as
      "the player asked for their cursor back" and paused the
      game; closing the menu requested it again. It is not a
      theory -- it is what the pause menu was doing.
   2. Auto-repeat reached the menu, so a held ESC toggled it many
      times a second.
   3. The terminal's screens were on F1-F6, which most laptops
      put behind an Fn chord.
   4. A docked call and the terminal both wanted the arrow keys,
      so the account search could not be submitted while anybody
      was waiting on a reply.
   ============================================================ */
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || 8080;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
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

/* A synthetic pad event is exactly what input.js hands the game when a real
   button goes down, so this tests the routing without a controller attached.
   What it cannot test is the Gamepad API itself -- see ROADMAP. */
const padPress = (code) => page.evaluate(
  (c) => window.__game.onKey({ code: c, key: c, preventDefault() {} }), code);

/* ---- 0. the title menu answers a pad ---- */
await padPress('PadDown');
const padMoved = await page.evaluate(() => window.__game.menu.sel);
await padPress('PadUp');
const padBack = await page.evaluate(() => window.__game.menu.sel);
check('the title menu answers a d-pad', padMoved === 1 && padBack === 0, `${padMoved} -> ${padBack}`);

await page.keyboard.press('Enter');
await page.waitForTimeout(900);

/* Record every state change so an oscillation is visible rather than felt. */
await page.evaluate(() => {
  const g = window.__game;
  window.__states = [];
  let last = null;
  window.__watch = setInterval(() => {
    const s = `${g.state}|${g.terminalFocused ? 'T' : '-'}|${g.menu.open || '-'}`;
    if (s !== last) { window.__states.push(s); last = s; }
  }, 16);
});

/* ---- 1. terminal screens are on the number row ---- */
await page.keyboard.press('t');
await page.waitForTimeout(900);
await page.evaluate(() => { window.__game.player._seatBlend = 1; });
check('T opens the terminal from standing', await page.evaluate(() => window.__game.terminalFocused));

for (const [key, want] of [['2', 'ACCT'], ['3', 'OUTG'], ['4', 'MAP'], ['5', 'DISP'], ['6', 'LOG'], ['1', 'MENU']]) {
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
  const got = await page.evaluate(() => window.__game.terminal.screen);
  check(`number key ${key} selects ${want}`, got === want, got);
}
// the function keys still work for anyone who has them
await page.keyboard.press('F2');
await page.waitForTimeout(120);
check('F-keys still work as aliases', (await page.evaluate(() => window.__game.terminal.screen)) === 'ACCT');
await page.keyboard.press('1');
await page.waitForTimeout(120);

/* ---- 2. ESC out of the terminal, repeatedly, must not oscillate ---- */
await page.evaluate(() => { window.__states.length = 0; });
for (let i = 0; i < 4; i++) {
  await page.keyboard.press('Escape');   // leave the terminal
  await page.waitForTimeout(450);
  await page.keyboard.press('t');        // go back in
  await page.waitForTimeout(450);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(2500);         // well past Chrome's lock cooldown

const trace = await page.evaluate(() => window.__states.slice());
const pauseFlips = trace.filter((s) => s.includes('|pause')).length;
console.log('\nstate trace:\n   ' + trace.join('\n   ') + '\n');
check('leaving the terminal never opens the pause menu', pauseFlips === 0, `${pauseFlips} pause states`);
check('the game is still playing afterwards',
  (await page.evaluate(() => window.__game.state)) === 'playing');

/* ---- 3. a held ESC must not strobe the pause menu ---- */
await page.evaluate(() => { window.__states.length = 0; });
await page.keyboard.down('Escape');
await page.waitForTimeout(1400);
await page.keyboard.up('Escape');
await page.waitForTimeout(600);
const heldTrace = await page.evaluate(() => window.__states.slice());
check('holding ESC toggles the menu once, not repeatedly',
  heldTrace.length <= 2, `${heldTrace.length} transitions: ${heldTrace.join(' -> ')}`);

await page.evaluate(() => { if (window.__game.menu.open) window.__game.menu.closePanel(); });
await page.waitForTimeout(400);

/* ---- 4. the arrow keys belong to one panel at a time ----
   Inside the terminal a docked call and a list of accounts both want the
   arrow keys. A new reply takes them, working a screen hands them back, and
   the telephone key fetches them again. Without that, either the caller is
   unanswerable or the terminal is. */
await page.evaluate(() => {
  const g = window.__game;
  // Quiet the switchboard: this section is about key routing, not calls.
  g.director.enabled = false;
  for (const l of g.phone.lines) { l.state = 'IDLE'; l.call = null; l.ringsLeft = 0; }
  g.phone.activeLine = null;
  if (!g.terminalFocused) g.focusTerminal(true);
  g.terminal.go('DISP');
  g.callUI.showChoices([{ text: 'one' }, { text: 'two' }, { text: 'three' }]);
});
await page.waitForTimeout(150);
check('a new reply takes the arrow keys', await page.evaluate(() => window.__game.callUI.focused));

await page.keyboard.press('ArrowDown');
await page.waitForTimeout(120);
check('arrows move the reply while the caller has them',
  (await page.evaluate(() => window.__game.callUI.sel)) === 1);

await page.keyboard.press('5');
await page.waitForTimeout(120);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(120);
const handover = await page.evaluate(() => ({
  focused: window.__game.callUI.focused,
  sel: window.__game.callUI.sel,
  replies: window.__game.callUI.choices.length,
}));
check('working a screen hands the arrow keys to the terminal',
  !handover.focused && handover.sel === 1, JSON.stringify(handover));
check('the replies stay on screen while the terminal has the keys',
  handover.replies === 3, `${handover.replies} replies`);

await page.keyboard.press('f');
await page.waitForTimeout(150);
check('the telephone key fetches the arrow keys back',
  await page.evaluate(() => window.__game.callUI.focused));
await page.evaluate(() => { window.__game.callUI.choices = []; window.__game.callUI.close(); });
await page.waitForTimeout(100);

/* ---- 5. written instructions name the keys the player actually has ---- */
const hints = await page.evaluate(async () => {
  const m = await import('/src/engine/controls.js');
  const t = (await import('/src/data/calls/tutorial_01.js')).default;
  const raw = Object.values(t.nodes).filter((n) => n.hint).map((n) => n.hint);
  return {
    raw,
    kbm: raw.map((h) => m.expand(h, 'kbm')),
    pad: raw.map((h) => m.expand(h, 'playstation')),
  };
});
check('no tutorial instruction names a function key',
  hints.kbm.every((h) => !/\bF[1-9]\b/.test(h)), hints.kbm.find((h) => /\bF[1-9]\b/.test(h)) || '');
check('every instruction token resolves',
  hints.kbm.every((h) => !h.includes('{')), hints.kbm.find((h) => h.includes('{')) || '');
check('instructions re-word themselves for a pad',
  hints.pad.some((h, i) => h !== hints.kbm[i]) && hints.pad.every((h) => !h.includes('{')),
  hints.pad.find((h, i) => h !== hints.kbm[i]) || '');

/* ---- 6. the pad reaches the terminal and the pause menu ---- */
await page.evaluate(() => { const g = window.__game; if (g.terminalFocused) g.focusTerminal(false); });
await page.waitForTimeout(300);
await padPress('PadSelect');
await page.waitForTimeout(400);
check('the view button opens the terminal', await page.evaluate(() => window.__game.terminalFocused));

const before = await page.evaluate(() => window.__game.terminal.screen);
await padPress('PadRB');
await page.waitForTimeout(200);
const after = await page.evaluate(() => window.__game.terminal.screen);
check('the shoulder buttons walk the screens', after !== before, `${before} -> ${after}`);

/* Back is one step at a time: LOG -> the menu screen -> out of the terminal.
   That is the same ladder Escape climbs, and the pad has to climb it too. */
await padPress('PadB');
await page.waitForTimeout(250);
const midway = await page.evaluate(() => ({
  screen: window.__game.terminal.screen, inTerminal: window.__game.terminalFocused,
}));
check('circle backs out one screen at a time',
  midway.inTerminal && midway.screen === 'MENU', JSON.stringify(midway));
await padPress('PadB');
await page.waitForTimeout(400);
check('circle steps back out of the terminal',
  !(await page.evaluate(() => window.__game.terminalFocused)));

await padPress('PadStart');
await page.waitForTimeout(400);
const paused = await page.evaluate(() => window.__game.state);
await padPress('PadStart');
await page.waitForTimeout(500);
check('the menu button pauses and unpauses',
  paused === 'paused' && (await page.evaluate(() => window.__game.state)) === 'playing',
  `${paused} -> ${await page.evaluate(() => window.__game.state)}`);

/* ---- 7. losing the pointer never pauses ---- */
await page.evaluate(() => { window.__states.length = 0; });
// A real exit, not a faked event: the browser's own cooldown after one is
// half of what produced the loop.
await page.evaluate(() => document.exitPointerLock());
await page.waitForTimeout(1200);
const loose = await page.evaluate(() => ({
  state: window.__game.state,
  menu: window.__game.menu.open,
  needs: window.__game.input.needsClickToLook,
  hintShown: !document.getElementById('lockhint').classList.contains('hidden'),
}));
check('losing the pointer lock does not pause the game',
  loose.state === 'playing' && loose.menu !== 'panel', JSON.stringify(loose));
check('the HUD says how to get the mouse back instead',
  loose.needs && loose.hintShown, JSON.stringify(loose));

await page.evaluate(() => clearInterval(window.__watch));
check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
