/* ============================================================
   signage.js -- everything in the building that has printing on
   it, drawn to a canvas at boot.

   Wall map, safety notices, binder spines, equipment labels, the
   EXIT sign. These are the props that make a room read as a
   specific place in a specific year rather than a generic office,
   and they are cheap: a canvas, a few fonts, no asset pipeline.

   All of these return plain <canvas> elements. Swap any one of
   them for a loaded image later and nothing else changes.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { TERRITORY, SUBSTATIONS, FEEDERS, TOWNS, WATER, ROADS, OPS_CENTER } from '../data/grid.js';
import { rng } from '../engine/noise.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Paper stock: warm off-white with age blotching and a faint fiber tooth. */
function paperGround(ctx, w, h, seed = 5, base = '#e8e3d2') {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < 240; i++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.012 + r() * 0.03;
    g.addColorStop(0, `rgba(150,128,86,${a})`);
    g.addColorStop(1, 'rgba(150,128,86,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

/* ============================================================
   THE SERVICE AREA MAP
   Hangs over the dispatch desk and is also what the terminal's
   map screen draws, so the two can never disagree.
   ============================================================ */

/** Map units -> pixels, for a canvas of the given size with a margin. */
export function mapProjector(w, h, margin = 0.06) {
  const mx = w * margin, my = h * margin;
  const sx = (w - mx * 2) / TERRITORY.w;
  const sy = (h - my * 2) / TERRITORY.h;
  const s = Math.min(sx, sy);
  const ox = (w - TERRITORY.w * s) / 2;
  const oy = (h - TERRITORY.h * s) / 2;
  return {
    s,
    x: (mx_) => ox + mx_ * s,
    y: (my_) => h - oy - my_ * s,        // flip: +Y north is up
  };
}

/**
 * Draw the territory. `opts.style` is 'wall' (printed, pinned to cork) or
 * 'crt' (phosphor vector plot on the terminal). `opts.outages` highlights
 * feeders that are currently out.
 */
export function drawTerritory(ctx, w, h, opts = {}) {
  const style = opts.style || 'wall';
  const P = mapProjector(w, h);
  const crt = style === 'crt';

  const ink = crt ? '#3fe08a' : '#1a1a17';
  const faint = crt ? 'rgba(63,224,138,0.28)' : 'rgba(46,44,38,0.62)';
  const water = crt ? 'rgba(63,224,138,0.22)' : '#9fb8c4';

  if (!crt) paperGround(ctx, w, h, 11, '#bdb497');
  else { ctx.fillStyle = '#04120a'; ctx.fillRect(0, 0, w, h); }

  const line = (path, color, width, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(P.x(p[0]), P.y(p[1])) : ctx.moveTo(P.x(p[0]), P.y(p[1]))));
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // county outline
  ctx.strokeStyle = faint; ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.strokeRect(P.x(0.6), P.y(TERRITORY.h - 0.6), (TERRITORY.w - 1.2) * P.s, (TERRITORY.h - 1.2) * P.s);

  for (const wpath of WATER) line(wpath, water, Math.max(1.5, w * 0.005));
  for (const road of ROADS) line(road.path, faint, road.major ? Math.max(2.4, w * 0.005) : Math.max(1.4, w * 0.0028), road.major ? [] : [7, 6]);

  // feeders
  for (const f of FEEDERS) {
    const out = opts.outages && opts.outages.has(f.id);
    const color = out ? (crt ? '#ff6a4a' : '#9c2f20') : (crt ? '#3fe08a' : '#1f3560');
    line(f.path, color, Math.max(2.2, w * (out ? 0.0075 : 0.0055)));
    if (out) {
      // hatch the de-energized trunk so it reads at a glance
      line(f.path, crt ? 'rgba(255,106,74,0.5)' : 'rgba(184,64,47,0.5)', Math.max(3, w * 0.011), [4, 9]);
    }
    const mid = f.path[Math.max(1, Math.floor(f.path.length / 2))];
    ctx.fillStyle = out ? (crt ? '#ff8f74' : '#8f2f22') : faint;
    ctx.font = `${Math.max(8, Math.round(w * 0.016))}px ui-monospace, "DejaVu Sans Mono", monospace`;
    ctx.fillText(f.id, P.x(mid[0]) + 4, P.y(mid[1]) - 4);
  }

  // substations
  for (const s of SUBSTATIONS) {
    const x = P.x(s.x), y = P.y(s.y), r = Math.max(3.5, w * 0.009);
    ctx.strokeStyle = crt ? '#8affc0' : '#1d2c4a';
    ctx.fillStyle = crt ? '#04120a' : '#e8e3d2';
    ctx.lineWidth = Math.max(1.4, w * 0.0028);
    ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, r * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke();
    ctx.fillStyle = crt ? '#8affc0' : '#1d2c4a';
    ctx.font = `bold ${Math.max(8, Math.round(w * 0.0155))}px ui-monospace, "DejaVu Sans Mono", monospace`;
    ctx.fillText(s.id, x + r + 3, y + r - 1);
  }

  // towns
  for (const t of TOWNS) {
    const x = P.x(t.x), y = P.y(t.y);
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(x, y, t.seat ? Math.max(3, w * 0.0055) : Math.max(2, w * 0.0035), 0, 7); ctx.fill();
    ctx.font = `${t.seat ? 'bold ' : ''}${Math.max(9, Math.round(w * 0.0175))}px ui-sans-serif, "DejaVu Sans", sans-serif`;
    ctx.fillText(t.name, x + 6, y - 5);
  }

  // the building the player is standing in
  const ox = P.x(OPS_CENTER.x), oy = P.y(OPS_CENTER.y);
  ctx.strokeStyle = crt ? '#ffd166' : '#8a6b1f';
  ctx.lineWidth = Math.max(1.5, w * 0.003);
  ctx.beginPath(); ctx.arc(ox, oy, Math.max(6, w * 0.014), 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox - 9, oy); ctx.lineTo(ox + 9, oy);
  ctx.moveTo(ox, oy - 9); ctx.lineTo(ox, oy + 9); ctx.stroke();

  return P;
}

/** The printed wall map, on paper, with a title block and pin holes. */
export function wallMap(w = 1536, h = 1024) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  drawTerritory(ctx, w, h, { style: 'wall' });

  // title block, bottom right
  const bw = w * 0.30, bh = h * 0.14, bx = w - bw - w * 0.035, by = h - bh - h * 0.04;
  ctx.fillStyle = 'rgba(214,206,182,0.95)';
  ctx.strokeStyle = '#3a382f'; ctx.lineWidth = 2;
  ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#23221d';
  ctx.font = `bold ${Math.round(h * 0.030)}px ui-sans-serif, "DejaVu Sans", sans-serif`;
  ctx.fillText('WRIGHT COUNTY POWER & LIGHT', bx + 12, by + h * 0.042);
  ctx.font = `${Math.round(h * 0.022)}px ui-sans-serif, "DejaVu Sans", sans-serif`;
  ctx.fillText('DISTRIBUTION SERVICE AREA', bx + 12, by + h * 0.072);
  ctx.font = `${Math.round(h * 0.019)}px ui-monospace, "DejaVu Sans Mono", monospace`;
  ctx.fillStyle = '#4a4740';
  ctx.fillText('SHEET 1 OF 3   REV 11/97   SCALE 1:64000', bx + 12, by + h * 0.102);

  // pin holes and a dog-eared corner
  ctx.fillStyle = 'rgba(40,36,28,0.5)';
  for (const [px, py] of [[0.03, 0.035], [0.97, 0.035], [0.03, 0.965], [0.97, 0.965]]) {
    ctx.beginPath(); ctx.arc(w * px, h * py, 4, 0, 7); ctx.fill();
  }
  return c;
}

/* ============================================================
   PAPER, SIGNS AND LABELS
   ============================================================ */

/** A safety / policy notice for the corkboard. */
export function notice(lines, opts = {}) {
  const w = opts.w || 512, h = opts.h || 660;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  paperGround(ctx, w, h, opts.seed || 3, opts.stock || '#e9e4d4');
  if (opts.rule) {
    ctx.strokeStyle = 'rgba(40,60,110,0.18)';
    ctx.lineWidth = 1;
    for (let y = h * 0.22; y < h - 20; y += 26) {
      ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(w - 24, y); ctx.stroke();
    }
  }
  let y = 54;
  for (const l of lines) {
    const size = l.size || 20;
    ctx.fillStyle = l.color || '#242219';
    ctx.font = `${l.bold ? 'bold ' : ''}${size}px ${l.mono ? 'ui-monospace, "DejaVu Sans Mono", monospace' : 'ui-sans-serif, "DejaVu Sans", sans-serif'}`;
    const text = l.t || '';
    if (l.center) {
      const m = ctx.measureText(text);
      ctx.fillText(text, (w - m.width) / 2, y);
    } else {
      ctx.fillText(text, l.indent || 28, y);
    }
    y += size + (l.gap ?? 10);
  }
  return c;
}

/** Backlit EXIT sign face. */
export function exitSign(w = 256, h = 128) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1512'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ff3b23';
  ctx.font = `bold ${Math.round(h * 0.66)}px ui-sans-serif, "DejaVu Sans", sans-serif`;
  const t = 'EXIT';
  const m = ctx.measureText(t);
  ctx.fillText(t, (w - m.width) / 2, h * 0.74);
  return c;
}

/** A hand-lettered label for a piece of equipment. */
export function labelPlate(text, opts = {}) {
  const w = opts.w || 256, h = opts.h || 64;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = opts.bg || '#2b2c30'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = opts.fg || '#d8d4c6';
  ctx.font = `bold ${opts.size || Math.round(h * 0.44)}px ui-monospace, "DejaVu Sans Mono", monospace`;
  const m = ctx.measureText(text);
  ctx.fillText(text, (w - m.width) / 2, h * 0.66);
  return c;
}

/**
 * Typed or handwritten lines on paper, as a texture.
 *
 * Used for the breaker panel's schedule card, drawer labels, and the open
 * page of the paper log. `hands` marks which lines are in somebody else's
 * handwriting -- which is used exactly once in the night, and is the reason
 * this takes a per-line style at all.
 */
export function labelTexture(lines, opts = {}) {
  const w = opts.w || (opts.small ? 256 : 384);
  const h = opts.h || (opts.small ? 96 : 512);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  paperGround(ctx, w, h, opts.seed || 11, opts.stock || (opts.hand ? '#efe9d6' : '#e6e1d0'));

  let y = opts.title ? 46 : 28;
  if (opts.title) {
    ctx.fillStyle = '#1f1d17';
    ctx.font = `bold 22px ui-monospace, "DejaVu Sans Mono", monospace`;
    ctx.fillText(opts.title, 16, 28);
    ctx.strokeStyle = 'rgba(40,40,40,0.4)';
    ctx.beginPath(); ctx.moveTo(14, 34); ctx.lineTo(w - 14, 34); ctx.stroke();
  }
  if (opts.hand) {
    ctx.strokeStyle = 'rgba(40,60,110,0.16)';
    for (let ly = 40; ly < h - 10; ly += 30) {
      ctx.beginPath(); ctx.moveTo(14, ly); ctx.lineTo(w - 14, ly); ctx.stroke();
    }
    y = 62;
  }
  lines.forEach((t, i) => {
    const other = opts.hands && opts.hands[i] === 'other';
    /* Somebody else's handwriting: heavier, larger, and sloped the other way.
       It should be obvious at a glance that a different hand wrote it, from
       the shape of the line and not from a caption telling the player so. */
    ctx.save();
    if (opts.hand) {
      ctx.fillStyle = other ? '#1b1b22' : '#2a3350';
      ctx.font = `${other ? 'bold ' : ''}${other ? 21 : 15}px "Comic Sans MS", "DejaVu Sans", cursive, sans-serif`;
      ctx.translate(18, y);
      ctx.rotate(other ? 0.035 : -0.012);
      ctx.fillText(String(t).slice(0, 44), 0, 0);
    } else {
      ctx.fillStyle = '#242219';
      ctx.font = `${opts.small ? 16 : 15}px ui-monospace, "DejaVu Sans Mono", monospace`;
      ctx.fillText(String(t).slice(0, 34), 16, y);
    }
    ctx.restore();
    y += opts.hand ? 30 : (opts.small ? 22 : 24);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A wall of binder spines for the records shelving. */
export function binderSpines(count = 8, seed = 9) {
  const w = 512, h = 512;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const r = rng(seed);
  const colors = ['#5b3a2a', '#2f3f5b', '#4a4a3a', '#6b2f2f', '#2f4a3a', '#4b3f5b'];
  const years = ['1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998'];
  const sw = w / count;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.fillRect(i * sw + 1, 0, sw - 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(i * sw + 1, 0, 3, h);
    ctx.save();
    ctx.translate(i * sw + sw * 0.62, h * 0.78);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#ded6c2';
    ctx.font = `bold ${Math.round(sw * 0.30)}px ui-sans-serif, "DejaVu Sans", sans-serif`;
    ctx.fillText(`OUTAGE ${years[i % years.length]}`, 0, 0);
    ctx.restore();
  }
  return c;
}

/** Drawer label card for a file cabinet. */
export function drawerLabel(text) {
  const c = canvas(256, 48);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e4dfce'; ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = '#2a2822';
  ctx.font = 'bold 22px ui-monospace, "DejaVu Sans Mono", monospace';
  ctx.fillText(text, 10, 32);
  return c;
}
