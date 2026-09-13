/* One-frame capture, for iterating on a single view without re-running the
   whole shots sequence. Usage: node tools/shot.mjs <name> <x> <y> <z> <yaw> <pitch> */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT || 'shots';
mkdirSync(OUT, { recursive: true });
const [name = 'shot', x = 5.05, y = 1.24, z = 2.0, yaw = 0, pitch = -0.12] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://localhost:${process.env.PORT || 8080}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(([x, y, z, yaw, pitch]) => {
  const g = window.__game;
  g.interaction.handlers.get('seat')();
  const p = g.player;
  p._seatBlend = 1; p.yaw = +yaw; p.pitch = +pitch;
  p.pos.set(+x, 1.68, +z);
  if (p._seat) { p._seat.x = +x; p._seat.z = +z; p._seat.eye = +y; }
}, [x, y, z, yaw, pitch]);
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/${name}.png` });
console.log(`${OUT}/${name}.png`);
await browser.close();
