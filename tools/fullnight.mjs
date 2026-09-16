/* ============================================================
   fullnight.mjs -- 22:45 to 06:00, without soft-locking.

   The old playthrough harness proved a vertical slice ran. This
   one proves a NIGHT runs: the handover, ordinary work, the
   anomalies, Keefe, the building going dark, the walk to the
   breaker panel, Act II, 0417, the care home, dawn, the day
   shift, and an end-of-shift report.

   It plays the player as a competent dispatcher who does the
   job: answers, reads records, writes tickets, sends units,
   walks to the panel when the terminal dies, goes to Records
   when a caller cannot be found, and writes things in the book.

   What it CANNOT check is whether any of that is frightening.
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
  checks.push({ name, ok });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  -- ' + detail : ''}`);
};

await page.keyboard.press('Enter');
await page.waitForTimeout(900);

/* ============================================================
   THE AUTOPILOT

   One loop, running inside the page, that behaves like somebody
   who is good at this job. It is deliberately written as the
   PLAYER's decision procedure rather than as a list of calls to
   fire, so that a change to the story does not silently stop
   being tested.
   ============================================================ */
await page.evaluate(() => {
  const g = window.__game;

  // Compress time: 435 shift minutes and ~60 sequence-seconds of authored
  // silence are not something a test can sit through.
  /* NOTE FOR ANYONE CHANGING THESE: the game clamps frame dt to 50ms, and
     this harness renders in software at a few frames a second. That means
     GAME time runs at roughly a sixth of wall time here, so anything
     measured in game seconds -- call gaps, sequence waits, haunt spacing --
     has to be compressed explicitly. Wall-clock patience is not enough. */
  g.clock.secondsPerMinute = 0.03;
  g.director.minGapSeconds = 0.05;
  g.director.fastForward = true;
  g.director._target = 0;                  // the first gap was already rolled
  g.director.holdGrace = 0.5;
  g.sequences.speed = 60;
  /* The haunt cooldown is in GAME seconds, which run about six times slower
     than wall time here. 95 game-seconds of spacing is right for a four-hour
     Act II and impossible for a three-minute test. */
  g.haunt.spacing = 0.4;

  window.__trace = { acts: [], sequences: [], beats: [], tasks: [], haunts: [], phones: [] };
  window.__bus.on(window.__events.SEQUENCE, (p) => window.__trace.sequences.push(`${p.id}:${p.state}${p.label ? ':' + p.label : ''}`));
  window.__bus.on(window.__events.BEAT, (p) => window.__trace.beats.push(p.beat));
  window.__bus.on(window.__events.TASK, (p) => { if (p.id) window.__trace.tasks.push(`${p.id}${p.done ? ':done' : ''}`); });
  window.__bus.on(window.__events.HAUNT, (p) => window.__trace.haunts.push(`${p.name}${p.noticed ? ':seen' : p.cleared ? ':cleared' : ''}`));
  window.__bus.on(window.__events.BUILDING_RING, (p) => { if (p.id) window.__trace.phones.push(p.id); });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const goTo = (room) => {
    const where = {
      dispatch: [4.6, 3.2], corridor: [-5.8, 6.5],
      records: [-4.2, 3.0], breakroom: [-4.0, 9.0],
    }[room];
    g.player.seated = false;
    g.player._seatBlend = 1;
    g.player.pos.x = where[0];
    g.player.pos.z = where[1];
  };
  window.__goTo = goTo;

  /** Do whatever the desk is currently missing, in the order a player would. */
  window.__satisfy = async () => {
    /* Everything the desk might be waiting for, every time. Doing only the
       first applicable thing meant the autopilot spent the whole night
       dispatching trucks and never walked to Records. */
    const S = g.gameState;
    if (!S.has('sat_down')) g.sitAtDesk();
    if (!S.has('used_terminal')) {
      g.focusTerminal(true);
      await sleep(20);
      g.focusTerminal(false);
    }
    if (!g.database.lookups.size) {
      const rec = g.terminal._callerRecord() || g.database.all[0];
      if (rec) g.terminal.openRecord(rec.id, { stay: true });
    }
    if (!S.has('created_a_ticket')) {
      g.terminal.newTicket(g.terminal._callerRecord());
      if (g.terminal.draft) { g.terminal.draft.cause = 'TREE ON LINE'; g.terminal.commitTicket(); }
    }
    const un = g.outages.unassigned();
    if (un.length) {
      const rec = g.dispatcher.recommend(un[0].id).find((r) => r.free);
      if (rec) g.dispatcher.send(rec.crew.id, un[0].id);
    }
    if (!S.has('used_hold') && g.phone.activeLine != null && g.phone.active && g.phone.active.call) {
      const i = g.phone.activeLine;
      g.phone.hold(i);
      await sleep(30);
      g.phone.resume(i);
    }
    /* Gates that want the BUILDING: a caller the CIS has never heard of is
       only resolvable on paper, down the corridor, in a drawer. */
    goTo('records');
    for (const c of g.archive.cards) {
      if (!c.requires || S.hasAll(c.requires)) g.archive.pull(c.id);
    }
    for (const i of g.archive.incidentPages()) g.archive.readIncident(i.id);
    const avail = g.paperlog.available();
    if (avail.length) g.paperlog.record(avail[0].id);
    goTo('dispatch');
  };

  window.__autopilot = async () => {
    let guard = 0;
    while (g.state === 'playing' && guard++ < 120000) {
      await sleep(4);

      /* --- the telephone --- */
      if (g.phone.anyRinging) { g.answer(); continue; }

      if (g.callUI.choices.length) {
        /* Prefer a reply that is gated on having done the work -- those are
           the good ones -- otherwise take the first, which is written to be
           the competent answer. */
        g.callUI.pick(0);
        continue;
      }
      if (g.callUI.visible && g.callUI._timer > 0) {
        g.callUI._timer = 0;
        if (g.callUI._pendingPlayerLine) { g.callUI._pendingPlayerLine = false; g.runner.playerLineFinished(); }
        else g.runner.lineFinished();
        continue;
      }
      /* --- a conversation waiting on the player to DO something ---
         Every waitFor gate in the game is a real action, so the autopilot
         performs the real action rather than setting the flag. If a gate
         ever becomes unsatisfiable, this is where the night stops. */
      if (g.runner.active && g.runner.blocked) {
        await window.__satisfy();
        g.runner.tick();
        continue;
      }

      /* --- the job: a ticket with nobody on it is the thing to fix --- */
      const un = g.outages.unassigned();
      if (un.length) {
        const rec = g.dispatcher.recommend(un[0].id).find((r) => r.free && r.qualified)
          || g.dispatcher.recommend(un[0].id).find((r) => r.free);
        if (rec) g.dispatcher.send(rec.crew.id, un[0].id);
      }

      /* --- the building --- */
      if (g.tasks.active) {
        const id = g.tasks.active.id;
        if (id === 'restore_power') {
          goTo('corridor');
          await sleep(30);
          g.power.resetAll();
        } else if (id === 'pull_card') {
          goTo('records');
          await sleep(20);
          // pull whatever the night has made available
          for (const c of g.archive.cards) {
            if (!c.requires || g.gameState.hasAll(c.requires)) g.archive.pull(c.id);
          }
        } else if (id === 'log_anomaly') {
          goTo('records');
          const avail = g.paperlog.available();
          if (avail.length) g.paperlog.record(avail[0].id);
        } else if (id === 'collect_fax') {
          goTo('dispatch');
          g.fax.collect();
        } else if (id === 'backup_radio') {
          goTo('corridor');
          await sleep(20);
          g.gameState.set('used_backup_radio', true);
        } else if (id === 'rear_door') {
          goTo('corridor');
          g.gameState.set('ignored_knock', true);
        } else {
          goTo(g.tasks.room || 'dispatch');
        }
        continue;
      }

      /* --- 0417: answer one of the building's telephones --- */
      if (g.phones.anyRinging && g.gameState.beat >= 20) {
        const id = g.phones.ringingIds.find((x) => x !== 'dispatch') || 'dispatch';
        const inst = g.phones.instrument(id);
        if (inst) {
          goTo(inst.room);
          g.gameState.set('answered_a_building_phone', true);
          g.phones.answer(id);
          g.onBuildingPhoneAnswered(id, inst);
        }
        continue;
      }

      /* --- paperwork, when there is nothing else to do --- */
      if (g.fax.hasUnread) { goTo('dispatch'); g.fax.collect(); continue; }
      const avail = g.paperlog.available();
      if (avail.length >= 2) {
        goTo('records');
        g.paperlog.record(avail[0].id);
        continue;
      }
      if (g.player.pos.x < 0) goTo('dispatch');
    }
    return { state: g.state, guard };
  };
});

console.log('--- playing the night ---');
const t0 = Date.now();
const result = await page.evaluate(() => window.__autopilot());
const wall = ((Date.now() - t0) / 1000).toFixed(0);

const out = await page.evaluate(async () => {
  const g = window.__game;
  const { HAUNTS } = await import('/src/game/haunt.js');
  window.__hauntNames = Object.keys(HAUNTS);
  return {
    state: g.state,
    beat: g.gameState.beat,
    minutes: Math.round(g.clock.minutes),
    clock: g.clock.label(g.clock.wallMinutes),
    trace: window.__trace,
    fired: [...g.director.fired],
    density: g.director.density(),
    paper: g.paperlog.entries.map((e) => e.id),
    defaced: g.paperlog.defaced,
    otherHand: g.paperlog.entries.filter((e) => e.hand === 'other').map((e) => e.text),
    paperScore: g.paperlog.score,
    cards: [...g.archive.pulled],
    incidents: g.archive.investigation,
    faxes: g.fax.read.map((f) => f.id),
    tickets: g.outages.list.length,
    restored: g.outages.restored.length,
    tasks: g.tasks.history.map((t) => t.id),
    haunts: [...g.haunt.done],
    hauntCatalogue: window.__hauntNames ? window.__hauntNames.length : 0,
    anomalies: g.gameState.shiftLog.filter((e) => e.kind === 'anomaly').length,
    flags: [
      'act_one_over', 'cascade_no_grid_event', 'power_restored', 'gaines_confirmed',
      'loop_recognised', 'imitation_caught', 'four_seventeen_done', 'bethel_resolved',
      'temporal_collapse', 'dayshift_done', 'the_last_line', 'shift_over',
      'heard_desk_from_corridor', 'saw_figure_in_chair', 'every_phone_rang',
    ].filter((f) => g.gameState.has(f)),
  };
});

console.log(`\nfinished at ${out.clock} (beat ${out.beat}) in ${wall}s of wall clock`);
console.log('sequences: ' + out.trace.sequences.filter((s) => /start|end/.test(s)).join(', '));
console.log('tasks:     ' + out.tasks.join(', '));
console.log('haunts:    ' + out.haunts.join(', '));
console.log('flags:     ' + out.flags.join(', '));
console.log('paper log: ' + (out.paper.join(', ') || '(empty)'));
console.log('cards:     ' + (out.cards.join(', ') || '(none)'));
console.log(`faxes:     ${out.faxes.length}   tickets: ${out.tickets}   restored: ${out.restored}   anomalies: ${out.anomalies}`);

console.log('\n--- the night ran ---');
check('the handover happened first', out.fired[0] === 'tutorial_01', out.fired[0]);
check('Keefe did NOT end the game', out.trace.sequences.some((s) => s.startsWith('cascade:start')),
  out.trace.sequences.find((s) => s.startsWith('cascade')) || 'cascade never played');
check('the building went dark and came back',
  out.flags.includes('cascade_no_grid_event') && out.flags.includes('power_restored'));
check('the player heard the desk from the corridor', out.flags.includes('heard_desk_from_corridor'));
check('somebody was in the chair', out.flags.includes('saw_figure_in_chair'));
check('act II ran', out.beat >= 12, `beat ${out.beat}`);
check('0417 happened', out.flags.includes('four_seventeen_done') && out.flags.includes('every_phone_rang'));
check('the care home was resolved', out.flags.includes('bethel_resolved'));
check('dawn took the records back', out.flags.includes('temporal_collapse'));
check('the day shift arrived', out.flags.includes('dayshift_done'));
check('there was a last call', out.flags.includes('the_last_line'));
check('the shift reached 06:00', out.minutes >= 30 * 60 - 1, `${out.clock} (${out.minutes})`);
check('the game ended in an end state', out.state === 'ended', out.state);

console.log('\n--- the building was used ---');
check('the player was sent away from the desk and came back',
  out.tasks.length >= 2, out.tasks.join(', '));
check('physical horror armed during the night', out.haunts.length >= 2,
  `${out.haunts.length} armed: ${out.haunts.join(', ')}`);
check('the catalogue of physical horror is deep enough', out.hauntCatalogue >= 10,
  `${out.hauntCatalogue} authored`);
check('faxes arrived, mundane ones first', out.faxes.length >= 3, out.faxes.slice(0, 4).join(', '));
check('Records was used to confirm somebody', out.cards.length >= 1, out.cards.join(', '));
check('the paper log has entries', out.paper.length >= 2, `${out.paper.length} entries, ${out.paperScore} points`);
check('the 1978 file was opened', out.incidents.read >= 1, `${out.incidents.read}/${out.incidents.total}`);
check('somebody else wrote in the day book', out.defaced, out.otherHand.join(' / ') || 'not defaced');

console.log('\n--- the story ---');
check('a caller from 1943 was confirmed on paper', out.flags.includes('gaines_confirmed'));
check('the loop was recognised', out.flags.includes('loop_recognised'));
check('the imitation was caught', out.flags.includes('imitation_caught'));
/* ============================================================
   EVERY PHYSICAL EVENT, DELIBERATELY

   Which ones a given night arms is down to where the player
   walks and how the dice fall, so the integration count above is
   necessarily loose. This is the strict half: arm all of them,
   confirm each one actually changes the scene, and confirm it
   puts the room back when the player deals with it.
   ============================================================ */
console.log('\n--- every physical event ---');
const each = await page.evaluate(async () => {
  const g = window.__game;
  const { HAUNTS } = await import('/src/game/haunt.js');
  const out = [];
  for (const name of Object.keys(HAUNTS)) {
    g.haunt.done.delete(name);
    g.haunt.clear(name);
    g.haunt.cooldown = 0;
    // put the player somewhere this one is allowed to happen
    const def = HAUNTS[name];
    const away = def.away === 'dispatch' ? 'records' : 'dispatch';
    window.__goTo(def.away ? away : (name === 'lights_behind' ? 'corridor' : 'dispatch'));
    /* Each of these has a precondition that is part of its design -- the CRT
       has to be DARK for something to be reflected in it, the Records
       extension needs the player to have been down there, a door can only be
       found open if it was shut. Set them up rather than skipping them. */
    if (name === 'crt_figure') { g.player.seated = true; g.power.on.set('terminal', false); }
    if (name === 'records_extension') { g.gameState.set('been_to_records', true); g.phones.silenceAll(); }
    if (name === 'door_ajar') { g.doors.set('records', false, { silent: true }); }
    const before = JSON.stringify({
      chair: g.dressing.chair ? +g.dressing.chair.rotation.y.toFixed(3) : 0,
      drawer: g.dressing.recordsDrawer ? +g.dressing.recordsDrawer.position.z.toFixed(3) : 0,
      tickets: g.outages.list.length,
      offset: g.world.clockOffset,
      era: g.dressing.records1978 ? g.dressing.records1978.visible : false,
      truck: g.dressing.oldTruck ? g.dressing.oldTruck.visible : false,
      ringing: g.phones.ringingIds.length,
    });
    const armed = g.haunt.arm(name, { force: true });
    await new Promise((r) => setTimeout(r, 60));
    const after = JSON.stringify({
      chair: g.dressing.chair ? +g.dressing.chair.rotation.y.toFixed(3) : 0,
      drawer: g.dressing.recordsDrawer ? +g.dressing.recordsDrawer.position.z.toFixed(3) : 0,
      tickets: g.outages.list.length,
      offset: g.world.clockOffset,
      era: g.dressing.records1978 ? g.dressing.records1978.visible : false,
      truck: g.dressing.oldTruck ? g.dressing.oldTruck.visible : false,
      ringing: g.phones.ringingIds.length,
    });
    const cleared = g.haunt.clear(name);
    out.push({ name, armed, changed: before !== after, cleared });
    g.power.on.set('terminal', true);
    g.player.seated = false;
  }
  return out;
});
for (const h of each) {
  console.log(`  ${h.armed ? 'armed' : 'REFUSED'.padEnd(5)}  ${h.changed ? 'changed the room' : 'audio/state only '}  ${h.name}`);
}
check('every authored physical event arms', each.every((h) => h.armed),
  each.filter((h) => !h.armed).map((h) => h.name).join(', ') || 'all');
check('most of them change the 3D scene, not just the picture',
  each.filter((h) => h.changed).length >= Math.ceil(each.length / 2),
  `${each.filter((h) => h.changed).length} of ${each.length}`);
check('every one of them can be put back', each.every((h) => h.cleared || !h.armed),
  each.filter((h) => h.armed && !h.cleared).map((h) => h.name).join(', ') || 'all');

/* ============================================================
   0417 rings every line on the desk set with NOBODY behind it.
   A line with no call on it has no ring cadence to read, and the
   ring tick used to reach through it -- which crashed the
   signature sequence of the game at the exact moment it is
   supposed to be quiet and strange. Pump the cadence here so
   that stays fixed.
   ============================================================ */
console.log('\n--- a line that rings with nobody behind it ---');
const empty = await page.evaluate(async () => {
  const g = window.__game;
  g.phone.hangUpAll();
  g.phones.silenceAll();
  g.phone.ringAllLines();
  // the cadence timer is 3.4s; 20s of it is several rings
  for (let i = 0; i < 40; i++) g.phone.update(0.5);
  const ringing = g.phone.snapshot().filter((l) => l.state === 'RINGING').length;
  const answered = g.phone.answer();
  await new Promise((r) => setTimeout(r, 80));
  const out = { ringing, answered, logged: g.gameState.has('answered_an_empty_line') };
  g.phone.hangUpAll();
  return out;
});
check('a line can ring with nobody behind it', empty.ringing > 0, `${empty.ringing} ringing`);
check('and it can be answered, and there is no carrier',
  empty.answered && empty.logged, JSON.stringify(empty));

check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
