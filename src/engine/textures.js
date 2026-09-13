/* ============================================================
   textures.js -- procedural PBR texture generation.

   Every surface in the office gets a real albedo / normal /
   roughness set generated at boot from tiling noise. This is
   NOT a stylistic choice about looking old: the game is set in
   1999, the renderer is not from 1999. The goal is convincing
   commercial-interior materials -- loop-pile carpet, mineral
   fiber ceiling tile, orange-peel drywall, worn VCT -- without
   shipping a texture pack.

   Each recipe is a single function evaluated per texel that
   returns color, height and roughness at once, so one pass over
   the image produces all three maps. Normals are derived from
   the height field with a Sobel filter afterward.

   REPLACING THESE WITH REAL ART: see materials.js. A recipe can
   be swapped for a loaded image without touching any other
   module -- nothing downstream knows how a texture was made.
   ============================================================ */
import { ValueNoise, Worley, clamp01, smoothstep, mix } from './noise.js';

/* ---------- shared noise fields (seeded once, reused) ---------- */
const N = {
  fine: new ValueNoise(1337, 256),
  mid: new ValueNoise(90210, 256),
  coarse: new ValueNoise(4242, 256),
  grime: new ValueNoise(7777, 256),
};
const W = {
  fleck: new Worley(31, 48),
  cell: new Worley(52, 16),
  pit: new Worley(88, 64),
};

/* ---------- helpers ---------- */
const hexToRgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

/** Blend toward a color by t. */
function tint(c, target, t) {
  return [mix(c[0], target[0], t), mix(c[1], target[1], t), mix(c[2], target[2], t)];
}

/** Distance to the nearest line of a grid with `n` divisions, in UV units. */
function gridLine(u, n) {
  const f = u * n;
  const d = Math.abs(f - Math.round(f)) / n;
  return d;
}

/* ============================================================
   RECIPES
   Each returns { c:[r,g,b] 0-255, h: height 0-1, r: roughness 0-1 }.
   ============================================================ */
export const RECIPES = {
  /* Commercial loop-pile carpet: dark slate blue with a pepper fleck.
     The kind that is in every utility office built before 1985. */
  carpet(u, v) {
    const nap = N.fine.fbm(u, v, 96, 4);
    const clump = N.mid.fbm(u, v, 24, 4);
    const fleck = W.fleck.at(u, v);
    let c = [44, 48, 58];
    c = tint(c, [62, 68, 80], clump * 0.7);
    c = tint(c, [26, 28, 34], nap * 0.5);
    // scattered lighter fibers
    if (fleck < 0.22) c = tint(c, [118, 120, 126], (0.22 - fleck) * 2.6);
    // traffic wear along the desk run
    const wear = smoothstep(0.35, 0.65, N.coarse.fbm(u, v, 3, 3));
    c = tint(c, [70, 74, 84], wear * 0.22);
    return { c, h: nap * 0.65 + clump * 0.35, r: 0.93 - wear * 0.05 };
  },

  /* Mineral fiber acoustic ceiling tile -- fissured, perforated, jaundiced
     by thirty years of cigarette smoke near the edges. */
  ceilingTile(u, v) {
    // Mineral fiber board is a PALE, low-contrast surface. Push the fissures
    // and pinholes and it stops reading as ceiling and starts reading as
    // asphalt, which is exactly what happened the first time.
    const fissure = N.mid.ridge(u, v, 22, 3);
    const pin = W.pit.at(u, v);
    const stain = N.grime.fbm(u, v, 2, 3);
    let c = [196, 192, 180];
    const f = smoothstep(0.70, 0.95, fissure);
    c = tint(c, [178, 174, 162], f);
    const holes = smoothstep(0.22, 0.08, pin);
    c = tint(c, [168, 164, 152], holes * 0.5);
    // nicotine and old water staining, kept broad and faint
    c = tint(c, [190, 176, 146], smoothstep(0.62, 1.0, stain) * 0.35);
    return { c, h: 1 - f * 0.35 - holes * 0.25, r: 0.95 };
  },

  /* Painted drywall with a light orange-peel spray texture. Institutional
     pale green -- the color every municipal building was painted in 1974. */
  wallPaint(u, v) {
    const peel = N.fine.fbm(u, v, 64, 4);
    const roll = N.mid.fbm(u, v, 8, 3);
    const scuff = N.grime.fbm(u, v, 5, 4);
    let c = [139, 144, 131];
    c = tint(c, [124, 129, 117], peel * 0.55);
    c = tint(c, [150, 155, 142], roll * 0.3);
    c = tint(c, [108, 110, 100], smoothstep(0.66, 1.0, scuff) * 0.35);
    return { c, h: peel * 0.8 + roll * 0.2, r: 0.82 + peel * 0.08 };
  },

  /* Painted concrete block. Heavy mortar grid, thick latex paint that has
     pooled in the block face pores. */
  cinderblock(u, v) {
    // 2 courses tall, 1 block wide per tile, running bond
    const courses = 2, blocks = 1;
    const row = Math.floor(v * courses);
    const offset = row % 2 ? 0.5 / blocks : 0;
    const bu = u + offset;
    const mortarV = gridLine(v, courses);
    const mortarU = gridLine(bu, blocks);
    const mortar = smoothstep(0.012, 0.004, Math.min(mortarU, mortarV));
    const pore = N.fine.fbm(u, v, 80, 4);
    const blotch = N.mid.fbm(u, v, 6, 3);
    let c = [140, 138, 128];
    c = tint(c, [158, 156, 145], pore * 0.5);
    c = tint(c, [182, 180, 170], blotch * 0.25);
    c = tint(c, [138, 136, 128], mortar);          // recessed mortar joint
    const h = (1 - mortar * 0.85) * (0.55 + pore * 0.45);
    return { c, h, r: 0.88 + mortar * 0.08 };
  },

  /* Vinyl composition tile: 12" squares, terrazzo-style chip pattern,
     waxed and buffed so it takes a reflection. */
  vct(u, v) {
    const tiles = 4;
    const joint = smoothstep(0.006, 0.002, Math.min(gridLine(u, tiles), gridLine(v, tiles)));
    const chip = W.fleck.at(u, v);
    const chip2 = W.cell.at(u, v);
    const grime = N.grime.fbm(u, v, 4, 4);
    let c = [162, 158, 147];
    if (chip < 0.30) c = tint(c, [120, 122, 128], (0.30 - chip) * 2.2);
    if (chip2 < 0.18) c = tint(c, [152, 138, 116], (0.18 - chip2) * 2.6);
    c = tint(c, [168, 164, 152], grime * 0.30);
    c = tint(c, [96, 94, 88], joint * 0.8);
    // buffed wax: low roughness on the tile face, dull in the joints
    const r = 0.26 + grime * 0.22 + joint * 0.5;
    return { c, h: 1 - joint * 0.6, r };
  },

  /* Oak-look desk laminate. Not real wood -- 1980s office furniture
     laminate, which is a photograph of wood under a satin clearcoat. */
  deskLaminate(u, v) {
    // stretch the grain along U
    // Grain runs along U and is squashed hard across V, which is what makes
    // a wood texture read as boards instead of noise.
    const grain = N.fine.ridge(u, v * 9.0, 2, 5);
    const ring = N.mid.fbm(u, v * 4.0, 2, 4);
    const pore = N.fine.fbm(u, v, 48, 3);
    let c = [112, 80, 50];
    c = tint(c, [74, 49, 27], smoothstep(0.40, 0.92, grain) * 0.8);
    c = tint(c, [136, 101, 64], ring * 0.4);
    c = tint(c, [98, 70, 43], pore * 0.16);
    // clearcoat: fairly smooth, micro-scratched
    const scratch = smoothstep(0.90, 1.0, N.coarse.ridge(u, v, 40, 2));
    return { c, h: grain * 0.5 + pore * 0.5, r: 0.46 + scratch * 0.16 + pore * 0.06 };
  },

  /* Darker wood for trim, the map board frame and the supervisor's door. */
  woodTrim(u, v) {
    const grain = N.mid.ridge(u, v * 6.0, 3, 5);
    const pore = N.fine.fbm(u, v, 48, 3);
    let c = [66, 43, 27];
    c = tint(c, [42, 26, 15], smoothstep(0.38, 0.88, grain) * 0.85);
    c = tint(c, [84, 57, 36], pore * 0.28);
    return { c, h: grain * 0.6 + pore * 0.4, r: 0.42 + pore * 0.1 };
  },

  /* Enameled steel: filing cabinets, lockers, the radio rack. Putty beige,
     lightly brushed, chipped at the edges (the chipping is in the model UVs). */
  paintedSteel(u, v) {
    const brush = N.fine.fbm(u * 0.05, v, 128, 3);
    const dent = N.coarse.fbm(u, v, 8, 3);
    const chip = W.pit.at(u, v);
    let c = [126, 123, 113];
    c = tint(c, [142, 138, 128], brush * 0.4);
    c = tint(c, [170, 166, 156], dent * 0.2);
    if (chip < 0.10) c = tint(c, [92, 86, 78], (0.10 - chip) * 4);  // paint chips to primer
    return { c, h: 0.6 + dent * 0.4, r: 0.44 + brush * 0.14 };
  },

  /* Cold-rolled / galvanized metal for conduit, the ceiling grid and racks. */
  greyMetal(u, v) {
    const brush = N.fine.fbm(u * 0.04, v, 160, 3);
    const spangle = W.cell.at(u, v);
    let c = [128, 130, 134];
    c = tint(c, [108, 110, 115], brush * 0.5);
    c = tint(c, [148, 150, 156], smoothstep(0.5, 0.0, spangle) * 0.3);
    return { c, h: 0.5 + brush * 0.5, r: 0.36 + brush * 0.2 };
  },

  /* 1999 computer beige. Pebbled ABS, yellowed unevenly by UV and heat. */
  beigePlastic(u, v) {
    // Injection-molded ABS has a very fine, very shallow stipple. Overstate it
    // and the monitor turns into a noise field, which is exactly what happens
    // if the pebble is allowed to modulate albedo as well as height.
    const pebble = W.pit.at(u, v);
    const yellow = N.coarse.fbm(u, v, 2, 3);
    let c = [166, 159, 133];
    c = tint(c, [158, 151, 126], pebble * 0.18);
    c = tint(c, [160, 146, 108], smoothstep(0.35, 0.9, yellow) * 0.5);
    return { c, h: 0.5 + pebble * 0.5, r: 0.60 + yellow * 0.10 };
  },

  /* Dark ABS for the telephone, handset and radio console. */
  darkPlastic(u, v) {
    const pebble = W.pit.at(u, v);
    const wear = N.grime.fbm(u, v, 4, 3);
    let c = [36, 37, 40];
    c = tint(c, [30, 31, 34], pebble * 0.25);
    c = tint(c, [54, 54, 57], smoothstep(0.62, 1.0, wear) * 0.4);   // handled shine
    return { c, h: 0.5 + pebble * 0.5, r: 0.52 + pebble * 0.08 - wear * 0.12 };
  },

  /* Cork map board -- the service-area map is pinned to this. */
  corkboard(u, v) {
    const grain = W.fleck.at(u, v);
    const chunk = N.fine.fbm(u, v, 56, 4);
    let c = [124, 92, 55];
    c = tint(c, [98, 70, 40], smoothstep(0.45, 0.05, grain) * 0.55);
    c = tint(c, [142, 108, 68], chunk * 0.3);
    return { c, h: chunk, r: 0.92 };
  },

  /* Aged office paper for notices, work orders and the binder spines. */
  paper(u, v) {
    const fiber = N.fine.fbm(u, v, 140, 3);
    const age = N.coarse.fbm(u, v, 3, 3);
    let c = [198, 193, 176];
    c = tint(c, [212, 205, 182], fiber * 0.35);
    c = tint(c, [204, 188, 150], smoothstep(0.45, 1.0, age) * 0.55);
    return { c, h: fiber, r: 0.94 };
  },

  /* Poured concrete -- stairwell, back hallway, equipment room. */
  concrete(u, v) {
    const agg = W.fleck.at(u, v);
    const blotch = N.mid.fbm(u, v, 5, 4);
    const crack = smoothstep(0.93, 1.0, N.coarse.ridge(u, v, 6, 3));
    let c = [112, 111, 107];
    c = tint(c, [118, 118, 114], blotch * 0.45);
    c = tint(c, [158, 157, 152], smoothstep(0.4, 0.1, agg) * 0.3);
    c = tint(c, [88, 88, 86], crack);
    return { c, h: (1 - crack) * (0.5 + blotch * 0.5), r: 0.86 + blotch * 0.08 };
  },

  /* Rubber anti-fatigue mat under the dispatch chair. */
  rubberMat(u, v) {
    const stud = W.cell.at(u, v);
    const s = smoothstep(0.45, 0.25, stud);
    let c = [30, 31, 33];
    c = tint(c, [46, 47, 50], s * 0.7);
    return { c, h: s, r: 0.82 };
  },
};

/* ============================================================
   BAKING
   ============================================================ */

/** Make a canvas of the given size (works in browser and OffscreenCanvas). */
function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/**
 * Evaluate a recipe into albedo / normal / roughness canvases.
 * Returns plain canvases; materials.js wraps them in THREE textures.
 */
export function bake(name, size = 512, normalStrength = 2.0) {
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`textures: no recipe named "${name}"`);

  const albedo = makeCanvas(size);
  const rough = makeCanvas(size);
  const normal = makeCanvas(size);
  const aCtx = albedo.getContext('2d', { willReadFrequently: true });
  const rCtx = rough.getContext('2d', { willReadFrequently: true });
  const nCtx = normal.getContext('2d', { willReadFrequently: true });

  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const nImg = nCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const s = recipe((x + 0.5) * inv, (y + 0.5) * inv);
      const o = i * 4;
      aImg.data[o] = clamp01(s.c[0] / 255) * 255;
      aImg.data[o + 1] = clamp01(s.c[1] / 255) * 255;
      aImg.data[o + 2] = clamp01(s.c[2] / 255) * 255;
      aImg.data[o + 3] = 255;
      const rv = clamp01(s.r) * 255;
      rImg.data[o] = rv; rImg.data[o + 1] = rv; rImg.data[o + 2] = rv; rImg.data[o + 3] = 255;
      height[i] = clamp01(s.h);
    }
  }

  // Sobel the height field into a tangent-space normal map (OpenGL, +Y up).
  const at = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * normalStrength, ny = -dy * normalStrength, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const o = (y * size + x) * 4;
      nImg.data[o] = (nx * 0.5 + 0.5) * 255;
      nImg.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      nImg.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      nImg.data[o + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  return { albedo, normal, rough };
}

export const RECIPE_NAMES = Object.keys(RECIPES);
