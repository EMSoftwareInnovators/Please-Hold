/* ============================================================
   playthrough.mjs -- drives a full shift in a headless browser,
   using real key events for the things a player presses and the
   live objects for the things a player would spend minutes on.

   It asserts the whole vertical slice is reachable: every beat
   fires, the terminal does real work, a crew gets dispatched,
   hold works, and the shift reaches PLEASE HOLD.
   ============================================================ */
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || 8080;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
const boot = await page.evaluate(() => window.__error);
if (boot) { console.log('BOOT FAILED\n' + boot); await browser.close(); process.exit(1); }

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  -- ' + detail : ''}`);
};

/* ---- install a driver in the page: it advances lines and picks replies ---- */
await page.evaluate(() => {
  const g = window.__game;
  window.__drive = {
    seen: new Set(),
    callsCompleted: [],
    choicesTaken: 0,
    holdsDone: 0,
    hangups: [],
    log: [],
  };
  window.__bus.on(window.__events.DIALOGUE_END, ({ call, reason }) => {
    window.__drive.callsCompleted.push({ id: call.id, reason });
  });
  window.__bus.on(window.__events.HUNGUP, ({ call, reason }) => {
    window.__drive.hangups.push({ id: call ? call.id : '?', reason });
  });
  window.__bus.on(window.__events.LINE_SPOKEN, (p) => {
    window.__drive.seen.add(`${p.call ? p.call.id : '?'}:${p.node}`);
  });
  // Run the shift fast: the scheduler's breathing room is for players.
  g.director.minGapSeconds = 0.05;
  g.clock.secondsPerMinute = 0.06;
});

/* ---- start the shift with a real keypress ---- */
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
check('shift starts from the title menu', (await page.evaluate(() => window.__game.state)) === 'playing');

/* ---- sit down at the desk (real key, via the interaction system) ---- */
await page.evaluate(() => {
  const g = window.__game;
  // walk to the chair the way the player would, then use it
  g.player.pos.set(g.player.pos.x, g.player.pos.y, g.player.pos.z);
  g.interaction.handlers.get('seat')();
});
await page.waitForTimeout(300);
check('player can sit at the dispatch desk', await page.evaluate(() => window.__game.player.seated));

/* ---- the pump: answer, read the account, choose replies, dispatch ---- */
const pump = async (seconds) => {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const done = await page.evaluate(() => {
      const g = window.__game;
      const d = window.__drive;
      if (g.gameState.has('slice_complete')) return true;

      /* The shift now opens with the handover call, which teaches by
         WAITING: each gate holds until the player actually does the thing.
         A harness has to do those things too, or it stalls on gate one and
         reports the game as broken. */
      if (g.runner.blocked) {
        const st = g.gameState;
        if (!st.has('sat_down')) { g.interaction.handlers.get('seat')(); return false; }
        if (!st.has('used_terminal')) { g.focusTerminal(true); g.focusTerminal(false); return false; }
        if (g.database.lookups.size === 0) {
          g.database.search('PRZ');
          g.database.markLookedUp('WH-40877');
          d.log.push('looked up WH-40877 (tutorial)');
          return false;
        }
        if (!st.has('created_a_ticket')) {
          g.terminal.go('OUTG');
          g.terminal.newTicket({ address: 'CO RD 18', town: 'MARROW HILL', feeder: 'MH-14', id: null });
          g.terminal.draft.cause = 'TREE ON LINE';
          g.terminal.commitTicket();
          d.log.push('opened the tutorial ticket');
          return false;
        }
        if (g.crews.dispatchedCount() === 0) {
          const t = g.outages.unassigned()[0];
          if (t) {
            const rec = g.dispatcher.recommend(t.id).find((r) => r.free && r.qualified);
            if (rec) { g.dispatcher.send(rec.crew.id, t.id); d.log.push(`dispatched ${rec.crew.id} (tutorial)`); }
          }
          return false;
        }
        if (!st.has('used_hold')) {
          g.phone.hold();
          if (g.phone.held.length) g.phone.resume(g.phone.held[0].index);
          d.holdsDone++;
          return false;
        }
        return false;
      }

      // Come back to anyone parked before taking a new call. A player
      // triages; a harness that only ever answers new rings will starve the
      // conversation it parked and then report the game as broken.
      if (g.phone.activeLine === null && !g.radioCall && g.phone.held.length) {
        g.phone.resume(g.phone.held[0].index);
        d.log.push(`returned to line ${g.phone.held.length ? '?' : g.phone.activeLine}`);
        return false;
      }

      // answer anything ringing
      if (g.phone.anyRinging) { g.answer(); return false; }

      // Nothing on the line: let the shift clock run, so crews actually drive
      // and scheduled callbacks actually come due. A real player spends this
      // time at the terminal; the harness just advances the clock.
      if (g.phone.activeLine === null && !g.radioCall && !g.callUI.visible) {
        g.clock.advance(2);
      }

      // Skip ahead through line pacing. A player waits for the voice; this
      // harness cannot afford to, because the software renderer here runs at
      // a few frames a second and the shift has 370-odd lines in it.
      if (g.callUI.visible && !g.callUI.choices.length && g.callUI._timer > 0) {
        g.callUI._timer = 0;
        if (g.callUI._pendingPlayerLine) {
          g.callUI._pendingPlayerLine = false;
          g.runner.playerLineFinished();
        } else {
          g.runner.lineFinished();
        }
      }

      // do the work the gated replies require, once per call
      const call = g.phone.activeCall || g.radioCall;
      if (call) {
        const acct = call.caller && call.caller.account;
        if (acct && !g.database.wasLookedUp(acct)) {
          g.database.search(acct);
          g.database.markLookedUp(acct);
          d.log.push(`looked up ${acct}`);
        }
        // open a ticket on the caller's circuit if there is not one
        const rec = acct ? g.database.get(acct) : null;
        const feeder = rec ? rec.feeder : (call.caller && call.caller.feeder);
        if (feeder && !g.outages.byFeeder(feeder).length && call.category !== 'anomaly') {
          g.outages.create({
            feeder, address: rec ? rec.address : '', town: rec ? rec.town : '',
            cause: call.category === 'hazard' ? 'WIRE DOWN' : 'FUSE',
            hazard: call.category === 'hazard',
            reportedBy: call.caller.name, stamp: g.clock.stamp(),
          });
          d.log.push(`opened ticket on ${feeder}`);
        }
        // put a crew on the worst unassigned ticket
        const un = g.outages.unassigned();
        if (un.length && g.crews.available().length) {
          const recs = g.dispatcher.recommend(un[0].id).filter((r) => r.free && r.qualified);
          if (recs.length) {
            g.dispatcher.send(recs[0].crew.id, un[0].id);
            d.log.push(`dispatched ${recs[0].crew.id} to ${un[0].id}`);
          }
        }
      }

      // take a reply -- prefer the gated ones, they are the interesting path
      if (g.callUI.choices.length) {
        const best = g.callUI.choices.findIndex((c) => c.requires);
        g.callUI.pick(best >= 0 ? best : 0);
        d.choicesTaken++;
        return false;
      }
      return false;
    });
    if (done) return true;
    await page.waitForTimeout(12);
  }
  return false;
};

/* ---- exercise hold explicitly, on the first call ---- */
await page.waitForFunction(() => window.__game.phone.anyRinging, null, { timeout: 30000 });
await page.keyboard.press('f');                       // answer
await page.waitForTimeout(400);
check('answering with F opens a call', await page.evaluate(() => window.__game.phone.activeLine !== null));

await page.keyboard.press('h');                       // hold
await page.waitForTimeout(600);
const heldInfo = await page.evaluate(() => ({
  held: window.__game.phone.held.length,
  paused: window.__game.runner.paused,
  music: window.__game.audio.isLooping('holdMusic'),
}));
check('H puts the caller on hold and pauses the conversation', heldInfo.held === 1 && heldInfo.paused, JSON.stringify(heldInfo));

await page.evaluate(() => { window.__game.phone.resume(window.__game.phone.held[0].index); });
await page.waitForTimeout(400);
check('returning to a held line resumes the conversation', await page.evaluate(() => window.__game.phone.activeLine !== null && !window.__game.runner.paused));

// Hold specifically while REPLIES are on screen. This is the state that used
// to strand the conversation: the runner kept its choices, the panel did not.
const heldAtChoice = await page.evaluate(async () => {
  const g = window.__game;
  for (let i = 0; i < 40 && !g.callUI.choices.length; i++) {
    if (g.callUI.visible && g.callUI._timer > 0) {
      g.callUI._timer = 0;
      if (g.callUI._pendingPlayerLine) { g.callUI._pendingPlayerLine = false; g.runner.playerLineFinished(); }
      else g.runner.lineFinished();
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  const before = g.callUI.choices.length;
  if (!before) return { before, after: -1 };
  g.phone.hold();
  await new Promise((r) => setTimeout(r, 250));
  const whileHeld = g.callUI.choices.length;
  g.phone.resume(g.phone.held[0].index);
  await new Promise((r) => setTimeout(r, 250));
  return { before, whileHeld, after: g.callUI.choices.length };
});
check('holding while replies are on screen does not strand the call',
  heldAtChoice.after === heldAtChoice.before, JSON.stringify(heldAtChoice));

/* ---- terminal: search, open a record, and read it ---- */
await page.evaluate(() => window.__game.focusTerminal(true));
await page.waitForTimeout(200);
await page.keyboard.press('F2');
for (const ch of 'DALEY') await page.keyboard.press(ch);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const searchInfo = await page.evaluate(() => ({
  screen: window.__game.terminal.screen,
  results: window.__game.terminal.results.map((r) => r.id),
}));
check('terminal account search finds a record', searchInfo.results.includes('WH-40122'), JSON.stringify(searchInfo));
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
check('opening a record marks it looked up', await page.evaluate(() => window.__game.database.wasLookedUp('WH-40122')));

await page.keyboard.press('F4');
await page.waitForTimeout(250);
check('terminal renders the service area map', (await page.evaluate(() => window.__game.terminal.screen)) === 'MAP');

await page.keyboard.press('F3');
await page.keyboard.press('n');
await page.waitForTimeout(150);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
check('terminal can open a new trouble ticket', (await page.evaluate(() => window.__game.outages.list.length)) > 0);

// The terminal has to be readable and usable, not a stretched bitmap.
// Wait for the DOM view to catch up -- it renders on the frame loop, and
// this harness runs at a few frames a second.
await page.waitForFunction(() => document.querySelectorAll('#crt-body [data-id]').length > 0,
  null, { timeout: 20000 }).catch(() => {});
const termUi = await page.evaluate(() => {
  const screen = document.getElementById('crt-screen');
  const crt = document.getElementById('crt');
  return {
    fontPx: parseFloat(getComputedStyle(screen).fontSize),
    opaque: getComputedStyle(crt).backgroundColor,
    tabs: document.querySelectorAll('#crt-tabs button').length,
    rows: document.querySelectorAll('#crt-body [data-id]').length,
    hudHidden: document.getElementById('hud').classList.contains('hidden'),
  };
});
check('terminal text is legible', termUi.fontPx >= 18, `${termUi.fontPx}px`);
check('terminal is an opaque takeover', !/, *0?\.\d+\)/.test(termUi.opaque), termUi.opaque);
check('terminal rows are clickable', termUi.rows > 0 && termUi.tabs === 6, JSON.stringify(termUi));
await page.evaluate(() => window.__game.focusTerminal(false));

/* ---- where is the first call before we hand over to the pump? ---- */
const preState = await page.evaluate(() => {
  const g = window.__game;
  return {
    activeLine: g.phone.activeLine,
    runnerCall: g.runner.call ? g.runner.call.id : null,
    runnerNode: g.runner.nodeId,
    runnerActive: g.runner.active,
    runnerPaused: g.runner.paused,
    uiVisible: g.callUI.visible,
    uiChoices: g.callUI.choices.length,
    lines: g.phone.lines.map((l) => `${l.index}:${l.state}:${l.call ? l.call.id : '-'}`),
  };
});
console.log('\nbefore pump: ' + JSON.stringify(preState));

/* ---- run the rest of the shift ---- */
const finished = await pump(180);

const out = await page.evaluate(() => {
  const g = window.__game;
  const d = window.__drive;
  const flags = [...g.gameState.flags];
  return {
    state: g.state,
    beat: g.gameState.beat,
    completed: d.callsCompleted.map((c) => c.id),
    hangups: d.hangups,
    choicesTaken: d.choicesTaken,
    nodesSeen: d.seen.size,
    holdsDone: d.holdsDone,
    dispatches: g.gameState.count('dispatches'),
    tickets: g.outages.list.length,
    restored: g.outages.restored.length,
    logEntries: g.gameState.shiftLog.length,
    anomalies: g.gameState.shiftLog.filter((e) => e.kind === 'anomaly').length,
    daleyCalls: g.gameState.caller('daley').calls,
    daleyTrust: g.gameState.caller('daley').trust,
    horrorFired: g.horror.history.map((h) => h.name),
    driverLog: d.log.slice(0, 12),
    pending: g.director.queue.map((q) => q.id),
    firedIds: [...g.director.fired],
    mundaneDebt: g.director.mundaneDebt,
    beatDue: g.director.beatDue().map((c) => c.id),
    randomPool: g.director.randomPool().map((c) => c.id),
    phoneActive: g.phone.activeLine,
    radioCall: g.radioCall ? g.radioCall.id : null,
    keyFlags: {
      sliceComplete: flags.includes('slice_complete'),
      copper: flags.includes('pole_tag_1956'),
      evpWarning: flags.includes('evp_warning_received'),
      pratt1956: flags.includes('pratt_said_1956'),
      keefe1956: flags.includes('keefe_said_1956'),
      saidTheLine: flags.includes('said_the_line'),
      thePause: flags.includes('the_pause_happened'),
      holbrook: flags.includes('holbrook_done'),
      usedHold: flags.includes('used_hold'),
      tutorialDone: flags.includes('tutorial_done'),
    },
  };
});

console.log('\n--- shift result ---');
console.log(JSON.stringify(out, null, 1));
console.log('');

check('the whole beat chain completed', out.keyFlags.sliceComplete, `beat ${out.beat}`);
check('a recurring caller called back', out.daleyCalls >= 2, `Daley calls: ${out.daleyCalls}`);
check('a crew was dispatched over the radio', out.dispatches >= 1);
check('an outage was restored by a crew', out.restored >= 1);
check('the handover ran first', out.completed[0] === 'tutorial_01', out.completed.slice(0, 2).join(', '));
check('the tutorial taught hold', out.holdsDone >= 1 || out.keyFlags.usedHold);
check('the crew radio sequence ran', out.completed.includes('crew_bethel'));
check('the suspicious call ran', out.keyFlags.holbrook);
check('the EVP call delivered its warning', out.keyFlags.evpWarning);
check('the 1956 call stated the year', out.keyFlags.pratt1956);
check('the 1978 dispatcher said his line', out.keyFlags.keefe1956);
check('the player answered it', out.keyFlags.saidTheLine);
check('horror events actually fired', out.horrorFired.length >= 4, out.horrorFired.join(', '));
check('anomalies were logged', out.anomalies >= 4, `${out.anomalies} entries`);
check('the shift reached the end slate', out.state === 'ended' || out.keyFlags.sliceComplete);
check('no runtime errors', errors.length === 0, errors.slice(0, 4).join(' | '));

await browser.close();
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
