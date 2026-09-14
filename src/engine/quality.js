/* ============================================================
   quality.js -- what the renderer is allowed to spend.

   One table, read by the renderer, the post chain, the lighting
   pool and the rain. Every expensive decision in the project is
   listed here rather than hard-coded at its call site, so the
   cost of a preset can be read in one place and changed in one
   place.

   `pixelRatio` deliberately defaults to 1 even on Retina. At 2x a
   Retina MacBook renders four times the fragments for a picture
   that, in a dark game with film grain and a soft post chain,
   most people cannot tell apart. It is available as an option for
   machines with the headroom; it is not a default.
   ============================================================ */

export const PRESETS = {
  low: {
    label: 'LOW',
    pixelRatio: 1,
    renderScale: 0.65,
    samples: 0,            // no MSAA
    shadows: 0,            // no shadow-casting lights
    lightPool: 1,          // ceiling lights evaluated per fragment
    rainDrops: 350,
    skyOctaves: 2,
    glassDetail: 0,        // one runnel pass instead of two
    bloom: true,
  },
  medium: {
    label: 'MEDIUM',
    pixelRatio: 1,
    renderScale: 0.85,
    samples: 2,
    shadows: 1,
    lightPool: 3,
    rainDrops: 800,
    skyOctaves: 3,
    glassDetail: 1,
    bloom: true,
  },
  high: {
    label: 'HIGH',
    pixelRatio: 1,
    renderScale: 1.0,
    samples: 4,
    shadows: 1,
    lightPool: 4,
    rainDrops: 1500,
    skyOctaves: 4,
    glassDetail: 1,
    bloom: true,
  },
};

export const PRESET_ORDER = ['low', 'medium', 'high'];

/**
 * Pick a starting preset. This is a guess, not a benchmark -- the adaptive
 * scaler in renderer.js is what actually keeps the frame rate honest once
 * the game is running.
 */
export function guessPreset() {
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  if (mobile || cores <= 4) return 'low';
  if (cores <= 8) return 'medium';
  return 'medium';     // start conservative; the scaler will climb if it can
}
