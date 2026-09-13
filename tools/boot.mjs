/* Boots the real game in a headless browser and reports any error.
   This is the check that catches a broken import or a bad scene reference
   before anything else is worth running. */
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || 8080;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 }).catch(() => {});

const err = await page.evaluate(() => window.__error);
const info = await page.evaluate(() => {
  if (!window.__game) return null;
  const g = window.__game;
  return {
    state: g.state,
    calls: g.library.size,
    callProblems: g.library.problems.length,
    interactables: g.dressing.interactables.length,
    solids: g.office.solids.list.length,
    fixtures: g.lighting.fixtures.length,
    accounts: g.database.all.length,
    crews: g.crews.crews.length,
    merge: g.mergeStats,
    sceneMeshes: (() => { let n = 0; g.scene.traverse((o) => { if (o.isMesh) n++; }); return n; })(),
  };
});

console.log(err ? `BOOT ERROR:\n${err}` : 'boot OK');
console.log(JSON.stringify(info, null, 1));
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); };
  requestAnimationFrame(tick);
}));
console.log(`swiftshader fps @1280x720: ${fps.toFixed(2)}`);

const bad = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
console.log('--- console errors ---\n' + (bad.join('\n') || '(none)'));
await browser.close();
process.exit(err || bad.length ? 1 : 0);
