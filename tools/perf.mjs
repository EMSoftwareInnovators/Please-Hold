/* ============================================================
   perf.mjs -- what the frame is being spent on.

   Reports the numbers that actually decide whether this game
   runs: how many real-time lights are in the scene, how many
   draw calls, how big the render target is, and what the frame
   rate is at each quality preset.

   The absolute frame rate here is meaningless -- this renders
   through SwiftShader in a container. The LIGHT COUNT is not
   meaningless. three.js is a forward renderer: every light is
   evaluated by every fragment of every object, so that number is
   a direct multiplier on the cost of every pixel, on every
   machine. It is the number to watch.
   ============================================================ */
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || 8080;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);

// Sit at the desk -- the view the player spends the game in.
await page.evaluate(() => {
  const g = window.__game;
  g.interaction.handlers.get('seat')();
  g.player._seatBlend = 1; g.player.yaw = 0; g.player.pitch = -0.1;
  g.renderer.adaptive = false;          // measure the preset, not the scaler
});
await page.waitForTimeout(800);

const sample = async (quality) => {
  await page.evaluate((q) => {
    const g = window.__game;
    g.settings.set('quality', q);
    g.applySettings();
    g.renderer.adaptive = false;
  }, quality);
  await page.waitForTimeout(1200);
  return page.evaluate(() => new Promise((res) => {
    const g = window.__game;
    let n = 0;
    const t0 = performance.now();
    const tick = () => {
      n++;
      if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
      else {
        let lights = 0, shadows = 0;
        g.scene.traverse((o) => { if (o.isLight) { lights++; if (o.castShadow) shadows++; } });
        const info = g.renderer.post.sceneStats;
        res({
          fps: n / ((performance.now() - t0) / 1000),
          lights, shadows,
          drawCalls: info.calls,
          tris: info.triangles,
          rt: g.renderer.stats.rt,
          samples: g.renderer.post.samples,
          pixelRatio: g.renderer.gl.getPixelRatio(),
        });
      }
    };
    requestAnimationFrame(tick);
  }));
};

console.log('preset   fps*   lights  shadows  draws   tris    render      msaa  dpr');
for (const q of ['low', 'medium', 'high']) {
  const r = await sample(q);
  console.log(
    q.padEnd(9)
    + r.fps.toFixed(1).padEnd(7)
    + String(r.lights).padEnd(8)
    + String(r.shadows).padEnd(9)
    + String(r.drawCalls).padEnd(8)
    + `${(r.tris / 1000).toFixed(1)}k`.padEnd(8)
    + r.rt.padEnd(12)
    + String(r.samples).padEnd(6)
    + r.pixelRatio,
  );
}
console.log('\n* software rendering in a container. Comparable between rows, meaningless in absolute terms.');
if (errs.length) console.log('\nERRORS:\n  ' + errs.slice(0, 5).join('\n  '));
await browser.close();
process.exit(errs.length ? 1 : 0);
