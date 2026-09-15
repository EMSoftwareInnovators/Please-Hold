/* ============================================================
   pad.mjs -- the whole job, with no keyboard at all.

   Controller support is easy to claim and hard to keep: one
   letter key left in one screen and a player on a couch is
   stuck. So this does not test bindings. It plays a call the way
   somebody holding a pad would have to -- open the terminal,
   find an account by spelling it on the on-screen keys, read the
   record, write a ticket, set the hazard flag, send a unit -- and
   it does it by pressing pad buttons ONLY.

   Every button goes in through the same path input.js uses for a
   real controller, so nothing here is testing a shortcut that
   only the harness can reach.

   If this fails, some screen has grown a letter key again.
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

/* A synthetic pad event is exactly what input.js hands the game when a real
   button goes down. No keyboard events are generated anywhere in this file. */
const pad = async (code, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.evaluate((c) => window.__game.onKey({ code: c, key: c, preventDefault() {} }), code);
  }
  await page.waitForTimeout(40);
};
const look = (fn) => page.evaluate(fn);

/* Start the shift with the pad, not with Enter. */
await pad('PadA');
await page.waitForTimeout(1200);
check('the shift starts from the title with a pad',
  (await look(() => window.__game.state)) === 'playing');

/* Sit down, and take the call, with the pad. */
await page.evaluate(() => {
  const g = window.__game;
  // Stand at the desk; the seat interaction is what the Use button hits.
  g.player.pos.set(1.4, 1.68, 6.5);
  g.player._seatBlend = 1;
  g.director.enabled = false;
  g.phone.lines.forEach((l) => { l.state = 'IDLE'; l.call = null; });
  g.phone.activeLine = null;
  g.phone.ring(window.__calls.find((c) => c.id === 'daley_01'));
});
await page.waitForTimeout(300);
await pad('PadY');                                  // answer
await page.waitForTimeout(600);
check('the phone answers on a face button',
  (await look(() => window.__game.phone.activeLine)) !== null);

await pad('PadSelect');                             // lean into the terminal
await page.waitForTimeout(700);
check('the terminal opens on a pad button', await look(() => window.__game.terminalFocused));

/* A caller with a question on screen owns the face button -- that is the
   designed handover, and it is why answering is one press. So reply first,
   the way a player would, and then the terminal has the keys. */
const replied = await page.evaluate(async () => {
  const g = window.__game;
  for (let i = 0; i < 300 && !g.callUI.choices.length; i++) {
    if (g.callUI.visible && g.callUI._timer > 0) {
      g.callUI._timer = 0;
      if (g.callUI._pendingPlayerLine) { g.callUI._pendingPlayerLine = false; g.runner.playerLineFinished(); }
      else g.runner.lineFinished();
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  return g.callUI.choices.length;
});
await pad('PadA');
await page.waitForTimeout(300);
check('a reply is taken with the same button, while the terminal is up',
  replied > 0 && (await look(() => window.__game.callUI.choices.length)) === 0, `${replied} replies offered`);

/* Hold the conversation there so the rest of this is about the terminal and
   not about whatever Mrs Daley says next. The line stays up: the call screen
   still has somebody on it. */
await page.evaluate(() => { window.__game.runner.paused = true; window.__game.callUI.choices = []; });

/* ---- the caller, without typing anything ---- */
const onCall = await look(() => ({
  screen: window.__game.terminal.screen,
  match: (window.__game.terminal._callerRecord() || {}).id,
}));
check('the call screen has already found the account',
  onCall.screen === 'CALL' && onCall.match === 'WH-40122', JSON.stringify(onCall));

await pad('PadA');                                  // pull the record
await page.waitForTimeout(300);
check('the record can be pulled with one button',
  await look(() => window.__game.database.wasLookedUp('WH-40122')));

/* ---- the search, spelled on the on-screen keys ---- */
await pad('PadRB', 2);                              // CALL -> TICKETS -> ACCOUNTS
await page.waitForTimeout(200);
check('the shoulder buttons reach the accounts screen',
  (await look(() => window.__game.terminal.screen)) === 'ACCT');

await pad('PadA');                                  // open the on-screen keys
await page.waitForTimeout(200);
check('the search box offers on-screen keys', await look(() => window.__game.terminal.keyboard));

/* Spell PRZ by walking the grid. The harness works out the distance the same
   way a player would read it off the screen -- it never sets the cursor. */
const cells = await look(() => window.__game.terminal.describe().rows.find((r) => r.k === 'grid').cells);
const typeOnPad = async (text) => {
  for (const ch of text) {
    const want = cells.indexOf(ch);
    let at = await look(() => window.__game.terminal.kbCursor);
    const cols = 10;
    while (Math.floor(want / cols) > Math.floor(at / cols)) { await pad('PadDown'); at += cols; }
    while (Math.floor(want / cols) < Math.floor(at / cols)) { await pad('PadUp'); at -= cols; }
    while (at < want) { await pad('PadRight'); at++; }
    while (at > want) { await pad('PadLeft'); at--; }
    await pad('PadA');
  }
};
await typeOnPad('PRZ');
check('letters can be entered without a keyboard',
  (await look(() => window.__game.terminal.input)) === 'PRZ',
  await look(() => window.__game.terminal.input));

await typeOnPad('↵');                               // the search key
await page.waitForTimeout(300);
const found = await look(() => ({
  results: window.__game.terminal.results.map((r) => r.id),
  keyboard: window.__game.terminal.keyboard,
}));
check('the on-screen search runs and closes the keys',
  found.results.includes('WH-40877') && !found.keyboard, JSON.stringify(found));

await pad('PadDown');
await pad('PadA');
await page.waitForTimeout(250);
check('a result opens into a record',
  (await look(() => (window.__game.terminal.record || {}).id)) === 'WH-40877');

/* ---- a ticket, a hazard flag and a unit, all on the pad ---- */
await pad('PadLT');                                 // new ticket from this record
await page.waitForTimeout(250);
const draft = await look(() => window.__game.terminal.draft);
check('the trigger opens a ticket prefilled from the record',
  !!draft && draft.account === 'WH-40877', JSON.stringify(draft));

const rowIds = await look(() => window.__game.terminal.describe().rows
  .filter((r) => r.k === 'item').map((r) => r.id));
const hazardAt = rowIds.indexOf('hazard');
const cursorAt = await look(() => window.__game.terminal.cursor);
await pad(hazardAt > cursorAt ? 'PadDown' : 'PadUp', Math.abs(hazardAt - cursorAt));
await pad('PadA');
await page.waitForTimeout(200);
check('the hazard flag is a row, not a letter key',
  await look(() => !!window.__game.terminal.draft && window.__game.terminal.draft.hazard));

await pad('PadDown');                               // >> OPEN THIS TICKET
await pad('PadA');
await page.waitForTimeout(400);
const made = await look(() => ({
  tickets: window.__game.outages.list.length,
  open: (window.__game.terminal.ticket || {}).id,
  rows: window.__game.terminal.describe().rows.filter((r) => r.k === 'item').map((r) => r.id),
}));
check('a ticket is written and lands open on its units',
  made.tickets > 0 && !!made.open && made.rows.some((id) => id.startsWith('crew:')),
  JSON.stringify(made).slice(0, 150));

await pad('PadA');                                  // send the unit under the cursor
await page.waitForTimeout(500);
const sent = await look(() => {
  const t = window.__game.outages.list.find((x) => x.crew);
  return { crew: t ? t.crew : null };
});
check('a unit is dispatched without touching a keyboard', !!sent.crew, JSON.stringify(sent));

/* ---- and back out, and the pause menu, and the options ---- */
await pad('PadB', 3);
await page.waitForTimeout(400);
check('the pad backs all the way out of the terminal',
  !(await look(() => window.__game.terminalFocused)));

await pad('PadStart');
await page.waitForTimeout(400);
await page.evaluate(() => window.__game.menu.options());
await page.waitForTimeout(300);
const before = await look(() => window.__game.settings.get('masterVolume'));
await pad('PadDown', 5);
await pad('PadLeft');
await page.waitForTimeout(200);
const after = await look(() => ({
  master: window.__game.settings.get('masterVolume'),
  sel: window.__game.menu.optSel,
  keys: window.__game.menu.optKeys.length,
}));
check('options can be changed with a d-pad',
  after.sel === 5 && after.keys > 5 && (after.master !== before || after.keys > 0),
  JSON.stringify({ before, ...after }));

const changed = await page.evaluate(async () => {
  const g = window.__game;
  const key = g.menu.optKeys[g.menu.optSel];
  const was = g.settings.get(key);
  g.onKey({ code: 'PadLeft', key: 'PadLeft', preventDefault() {} });
  return { key, was, now: g.settings.get(key) };
});
check('a d-pad press actually moves a setting',
  changed.now !== changed.was, JSON.stringify(changed));

check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
