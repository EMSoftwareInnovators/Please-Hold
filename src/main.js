/* ============================================================
   main.js -- boot. Builds the game, shows the title, runs the
   frame loop, and gets out of the way.
   ============================================================ */
import { Game } from './game/game.js';
import * as dialogue from './game/dialogue.js';
import * as effects from './game/effects.js';
import * as horror from './game/horror.js';
import { CALLS } from './data/calls/index.js';
import { bus, EVENTS } from './engine/bus.js';

const $ = (id) => document.getElementById(id);

const start = async () => {
  const game = new Game();

  // Dev hooks: the browser console, and the harnesses under tools/.
  window.__game = game;
  window.__bus = bus;
  window.__events = EVENTS;
  window.__dialogue = dialogue;
  window.__effects = effects;
  window.__horror = horror;
  window.__calls = CALLS;

  const fill = $('load-fill');
  const note = $('load-note');

  try {
    await game.boot((p, label) => {
      fill.style.width = `${Math.round(p * 100)}%`;
      if (label) note.textContent = label;
    });

    $('loading').classList.add('hidden');
    game.menu.showTitle(true);

    const loop = (t) => {
      game.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    window.__ready = true;
  } catch (err) {
    console.error(err);
    window.__error = String((err && err.stack) || err);
    document.body.innerHTML =
      `<pre style="color:#ffb641;font:13px ui-monospace,monospace;padding:2rem;white-space:pre-wrap;background:#0a0907;min-height:100vh">`
      + `PLEASE HOLD failed to start.\n\n${window.__error}\n\n`
      + `Serve the folder over http:// (npm start) -- ES modules will not load from file://.</pre>`;
  }
};

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
else start();
