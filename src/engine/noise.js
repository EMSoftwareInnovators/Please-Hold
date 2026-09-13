/* ============================================================
   noise.js -- deterministic value/cellular noise used by every
   procedural texture in the game. Everything here is seeded, so
   a given material looks identical on every machine and between
   runs; nothing depends on Math.random().

   All fields TILE over the UV range [0,1]. That is not a nicety:
   office surfaces are big, and a visible seam running down a
   corridor wall reads instantly as "video game".
   ============================================================ */

/** Small, fast, seedable PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Value noise on a lattice. `at()` takes an explicit wrap period so each
 * octave can wrap at its own frequency -- that is what makes fbm() tile
 * over UV [0,1] instead of only over the raw lattice.
 */
export class ValueNoise {
  constructor(seed = 1, period = 256) {
    this.period = period;
    const r = rng(seed);
    this.g = new Float32Array(period * period);
    for (let i = 0; i < this.g.length; i++) this.g[i] = r();
  }
  /** Raw lookup. `wrap` must be a positive integer <= period. */
  at(x, y, wrap) {
    const p = this.period;
    const w = wrap && wrap <= p ? wrap : p;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % w) + w) % w, y0 = ((yi % w) + w) % w;
    const x1 = (x0 + 1) % w, y1 = (y0 + 1) % w;
    const u = fade(xf), v = fade(yf);
    const a = lerp(this.g[y0 * p + x0], this.g[y0 * p + x1], u);
    const b = lerp(this.g[y1 * p + x0], this.g[y1 * p + x1], u);
    return lerp(a, b, v);
  }
  /**
   * Fractal sum over UV in [0,1]. `freq` is how many lattice cells span the
   * full texture at the first octave; it is rounded to an integer so the
   * result tiles. Octaves double from there.
   */
  fbm(x, y, freq = 4, octaves = 5, gain = 0.5) {
    let sum = 0, amp = 1, norm = 0, f = Math.max(1, Math.round(freq));
    for (let o = 0; o < octaves && f <= this.period; o++) {
      sum += this.at(x * f, y * f, f) * amp;
      norm += amp;
      amp *= gain; f *= 2;
    }
    return sum / norm;
  }
  /** Ridged variant -- good for scratches, grain and fibrous surfaces. */
  ridge(x, y, freq = 4, octaves = 4) {
    let sum = 0, amp = 1, norm = 0, f = Math.max(1, Math.round(freq));
    for (let o = 0; o < octaves && f <= this.period; o++) {
      sum += (1 - Math.abs(this.at(x * f, y * f, f) * 2 - 1)) * amp;
      norm += amp;
      amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }
}

/**
 * Cellular (Worley) noise, tiling over UV [0,1]. Returns normalized distance
 * to the nearest feature point -- terrazzo fleck, carpet nap, rust pitting.
 */
export class Worley {
  constructor(seed = 1, cells = 8) {
    this.cells = Math.max(1, Math.round(cells));
    const r = rng(seed);
    const n = this.cells * this.cells;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.px[i] = r(); this.py[i] = r(); }
  }
  at(x, y) {
    const c = this.cells;
    const cx = Math.floor(x * c), cy = Math.floor(y * c);
    let best = 1e9;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = ((cx + dx) % c + c) % c, gy = ((cy + dy) % c + c) % c;
        const i = gy * c + gx;
        // Feature point kept in unwrapped space so the field tiles cleanly.
        const fx = (cx + dx + this.px[i]) / c;
        const fy = (cy + dy + this.py[i]) / c;
        const ddx = fx - x, ddy = fy - y;
        const d = ddx * ddx + ddy * ddy;
        if (d < best) best = d;
      }
    }
    return Math.min(1, Math.sqrt(best) * c);
  }
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const mix = lerp;
