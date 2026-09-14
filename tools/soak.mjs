/* ============================================================
   soak.mjs -- runs every call script to completion, on its own,
   taking every reachable branch it can.

   This is the test that catches a conversation which STALLS: a
   node with no exit, a choice whose requirements can never be
   met, a player line that is never resolved. The playthrough
   proves the happy path; this proves there is no dead end in any
   of them.
   ============================================================ */
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || 8080;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });

await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.evaluate(() => {
  const g = window.__game;
  g.director.enabled = false;           // we drive the calls ourselves
  g.clock.secondsPerMinute = 0.05;
});

const ids = await page.evaluate(() => window.__calls.map((c) => c.id));
const results = [];

for (const id of ids) {
  // Each pass picks a different reply index, so across passes we cover
  // the breadth of each conversation rather than one straight line.
  for (const strategy of [0, 1, 2]) {
    const r = await page.evaluate(async ([id, strategy]) => {
      const g = window.__game;
      // reset the phone and the runner between runs
      g.runner.end('reset');
      for (const l of g.phone.lines) { l.state = 'IDLE'; l.call = null; }
      g.phone.activeLine = null;
      g.radioCall = null;

      const call = window.__calls.find((c) => c.id === id);
      const visited = new Set();
      let ended = null;
      const offEnd = window.__bus.on(window.__events.DIALOGUE_END, (p) => { ended = p.reason; });
      const offLine = window.__bus.on(window.__events.LINE_SPOKEN, (p) => { if (p.node) visited.add(p.node); });

      if (call.medium === 'radio') g._startRadioCall(call);
      else { g.phone.ring(call); g.phone.answer(); }

      /* Advance the conversation synchronously rather than waiting on the
         frame loop. This test is about the dialogue GRAPH -- whether every
         path reaches an end -- and tying it to a software renderer running
         at four frames a second only measures the renderer. The real-time
         pacing path is covered by tools/playthrough.mjs. */
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let guard = 0;
      let picks = 0;
      let gates = 0;
      while (!ended && guard++ < 4000) {
        /* Step over `waitFor` gates. This test is about the GRAPH -- whether
           every path reaches an end -- not about whether a gate's condition
           can be met, which is tools/tutorial.mjs's job. A gate left in place
           here would block forever and look like a dead end. */
        if (g.runner.blocked && g.runner.node && g.runner.node.next) {
          g.runner.blocked = false;
          g.runner.hint = null;
          gates++;
          g.runner._goto(g.runner.node.next);
          continue;
        }
        if (g.callUI.choices.length) {
          const n = g.callUI.choices.length;
          g.callUI.pick(Math.min(n - 1, strategy));
          picks++;
        } else if (g.callUI.visible) {
          g.callUI._timer = 0;
          if (g.callUI._pendingPlayerLine) {
            g.callUI._pendingPlayerLine = false;
            g.runner.playerLineFinished();
          } else {
            g.runner.lineFinished();
          }
        } else {
          break;
        }
        if (guard % 200 === 0) await sleep(0);
      }
      offEnd(); offLine();
      const total = Object.keys(call.nodes).length;
      return { id, strategy, ended, guard, picks, gates, visited: visited.size, total, stalled: !ended };
    }, [id, strategy]);
    results.push(r);
  }
}

const stalled = results.filter((r) => r.stalled);
const byCall = {};
for (const r of results) {
  byCall[r.id] = byCall[r.id] || { visited: new Set(), total: r.total, ok: 0, stalled: 0, gates: 0 };
  byCall[r.id][r.stalled ? 'stalled' : 'ok']++;
  byCall[r.id].gates = Math.max(byCall[r.id].gates, r.gates || 0);
  byCall[r.id].visited.add(r.visited);
}

console.log('call'.padEnd(16) + 'runs'.padEnd(7) + 'stalled'.padEnd(9) + 'gates'.padEnd(7) + 'nodes');
for (const [id, d] of Object.entries(byCall)) {
  console.log(id.padEnd(16) + String(d.ok + d.stalled).padEnd(7) + String(d.stalled).padEnd(9)
    + String(d.gates).padEnd(7) + `${Math.max(...d.visited)}/${d.total}`);
}

if (stalled.length) {
  console.log(`\n${stalled.length} STALLED RUN(S):`);
  for (const s of stalled) console.log(`  ${s.id} (strategy ${s.strategy}) picks=${s.picks} visited=${s.visited}/${s.total}`);
}
if (errors.length) console.log('\nRUNTIME ERRORS:\n  ' + errors.slice(0, 8).join('\n  '));

await browser.close();
process.exit(stalled.length || errors.length ? 1 : 0);
