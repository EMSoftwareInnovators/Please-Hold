/* Dev-only: screenshot the office shell from a few angles so the renderer
   and materials can be judged without a display. `node tools/preview.mjs`
   (the server must be running, or use tools/shots.mjs which boots one). */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT || 'shots';
const PORT = process.env.PORT || 8080;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(`http://localhost:${PORT}/tools/preview.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 }).catch(() => {});
const err = await page.evaluate(() => window.__error);
if (err) { console.log('BOOT ERROR:\n' + err); console.log(logs.join('\n')); await browser.close(); process.exit(1); }

const views = [
  ['a-from-door', 1.4, 1.68, 6.5, -1.15, -0.05],
  ['b-desk', 5.0, 1.68, 4.2, 0.0, -0.03],
  ['c-windows', 6.5, 1.68, 4.0, -1.4, 0.0],
  ['d-corridor', -0.6, 1.68, 6.5, 1.57, 0.0],
  ['e-wide', 8.6, 1.68, 7.2, -0.9, 0.02],
  ['f-seated', 5.05, 1.24, 2.0, 0.0, -0.14],
  ['g-seated-radio', 5.05, 1.24, 2.0, -0.95, -0.22],
];
for (const [name, x, y, z, yaw, pitch] of views) {
  await page.evaluate(([x, y, z, yaw, pitch]) => {
    const c = window.__preview.r.camera;
    c.position.set(x, y, z); c.rotation.order = 'YXZ';
    c.rotation.set(pitch, yaw, 0);
  }, [x, y, z, yaw, pitch]);
  await page.waitForTimeout(260);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
const info = await page.evaluate(() => ({
  solids: window.__preview.office.solids.list.length,
  fixtures: window.__preview.lighting.fixtures.length,
  windows: window.__preview.office.windows.length,
  objects: window.__preview.scene.children.length,
  interactables: window.__preview.dressing.interactables.length,
  tris: window.__preview.r.gl.info.render.triangles,
  calls: window.__preview.r.gl.info.render.calls,
}));
console.log(JSON.stringify(info));
console.log('--- console ---\n' + (logs.slice(0, 40).join('\n') || '(clean)'));
await browser.close();
