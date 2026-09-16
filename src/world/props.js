/* ============================================================
   props.js -- the rest of the building's furniture and clutter.

   Clutter is not decoration. An office with nothing on the desks
   reads as a level; an office with a cold mug, a box someone
   never unpacked and a binder left open reads as a place people
   left a few hours ago. That contrast is what the rest of the
   night is going to break.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { box, bevelBox, cylinder, planeUV } from './geo.js';
import { wallMap, notice, exitSign, drawerLabel, binderSpines, labelPlate } from './signage.js';
import { rng } from '../engine/noise.js';

const texFrom = (canvas, srgb = true) => {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
};
const paperMat = (canvas, opts = {}) => new THREE.MeshStandardMaterial({
  map: texFrom(canvas), roughness: opts.rough ?? 0.9, metalness: 0, ...opts.extra,
});

/* ---------------- seating ---------------- */
export function officeChair(mats, opts = {}) {
  const g = new THREE.Group();
  g.name = 'office-chair';
  const fabric = mats.get('darkFabric');
  const plastic = mats.get('black');
  const steel = mats.get('greyMetal');

  // five-star base with casters
  g.add(cylinder(0.035, 0.045, 0.05, plastic, { pos: [0, 0.055, 0], seg: 16 }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = box(0.30, 0.022, 0.045, plastic, { pos: [Math.cos(a) * 0.15, 0.048, Math.sin(a) * 0.15], rot: [0, -a, 0] });
    g.add(arm);
    const caster = cylinder(0.024, 0.024, 0.016, mats.get('rubberBlack'), {
      pos: [Math.cos(a) * 0.29, 0.024, Math.sin(a) * 0.29], rot: [Math.PI / 2, 0, 0], seg: 12,
    });
    g.add(caster);
  }
  // gas cylinder
  g.add(cylinder(0.026, 0.030, 0.24, steel, { pos: [0, 0.20, 0], seg: 14 }));
  g.add(cylinder(0.042, 0.042, 0.07, plastic, { pos: [0, 0.335, 0], seg: 14 }));
  // seat pan and back
  g.add(bevelBox(0.46, 0.085, 0.44, fabric, 0.03, { pos: [0, 0.40, 0] }));
  const back = bevelBox(0.42, 0.46, 0.075, fabric, 0.03, { pos: [0, 0.68, -0.20] });
  back.rotation.x = 0.12;
  g.add(back);
  // arms
  for (const s of [-1, 1]) {
    g.add(box(0.035, 0.19, 0.035, plastic, { pos: [s * 0.235, 0.53, -0.05] }));
    g.add(bevelBox(0.06, 0.030, 0.24, plastic, 0.008, { pos: [s * 0.235, 0.635, 0.0] }));
  }
  if (opts.yaw) g.rotation.y = opts.yaw;
  return g;
}

/* ---------------- storage ---------------- */
export function fileCabinet(mats, labels = ['A - F', 'G - L', 'M - R', 'S - Z']) {
  const g = new THREE.Group();
  g.name = 'file-cabinet';
  const steel = mats.get('paintedSteel');
  const W = 0.46, D = 0.62, H = 1.32;
  g.add(bevelBox(W, H, D, steel, 0.008, { pos: [0, H / 2, 0] }));
  g.add(box(W + 0.01, 0.035, D + 0.01, steel, { pos: [0, H + 0.014, 0] }));
  const n = labels.length;
  for (let i = 0; i < n; i++) {
    const y = 0.14 + i * ((H - 0.18) / n);
    const dh = (H - 0.18) / n - 0.014;
    /* Each drawer is its own group so that something can pull one out. A
       drawer standing open in a room the player left closed is one of the
       better things in this game; it needs a handle in the scene graph. */
    const drawer = new THREE.Group();
    drawer.name = `drawer${i}`;
    // drawer face, recessed slightly so the gap catches a shadow
    drawer.add(box(W - 0.02, dh, 0.016, steel, { pos: [0, y + dh / 2, D / 2 + 0.004] }));
    // pull
    drawer.add(box(0.15, 0.030, 0.030, mats.get('chrome'), { pos: [0, y + dh - 0.06, D / 2 + 0.022] }));
    // label card in its holder
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.022), paperMat(drawerLabel(labels[i])));
    card.position.set(0, y + dh - 0.14, D / 2 + 0.014);
    drawer.add(card);
    g.add(drawer);
  }
  return g;
}

export function shelfUnit(mats, opts = {}) {
  const g = new THREE.Group();
  const steel = mats.get('greyMetal');
  const W = opts.w || 0.92, D = 0.34, H = 1.85, shelves = 5;
  for (const s of [-1, 1]) {
    for (const d of [-1, 1]) {
      g.add(box(0.030, H, 0.030, steel, { pos: [s * (W / 2 - 0.015), H / 2, d * (D / 2 - 0.015)] }));
    }
  }
  for (let i = 0; i < shelves; i++) {
    const y = 0.12 + i * ((H - 0.2) / (shelves - 1));
    g.add(box(W, 0.020, D, steel, { pos: [0, y, 0] }));
    // binders
    const bind = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.30, D * 0.72), paperMat(binderSpines(8, 3 + i)));
    bind.position.set(0, y + 0.16, 0.01);
    bind.castShadow = bind.receiveShadow = true;
    g.add(bind);
  }
  return g;
}

/* ---------------- the map board ---------------- */
export function mapBoard(mats, spec) {
  const g = new THREE.Group();
  g.name = 'map-board';
  const { w, h } = spec;
  // A flat stained frame: at 55mm the tiling wood texture reads as noise,
  // so the frame takes a plain color and lets the map carry the detail.
  const frame = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.45, metalness: 0 });
  const fw = 0.055;
  g.add(box(w + fw * 2, fw, 0.05, frame, { pos: [0, h / 2 + fw / 2, 0] }));
  g.add(box(w + fw * 2, fw, 0.05, frame, { pos: [0, -h / 2 - fw / 2, 0] }));
  g.add(box(fw, h, 0.05, frame, { pos: [-w / 2 - fw / 2, 0, 0] }));
  g.add(box(fw, h, 0.05, frame, { pos: [w / 2 + fw / 2, 0, 0] }));
  g.add(box(w, h, 0.022, mats.get('corkboard'), { pos: [0, 0, -0.012] }));

  const map = new THREE.Mesh(
    planeUV(new THREE.PlaneGeometry(w - 0.10, h - 0.09), 1, 1),
    paperMat(wallMap(1536, 1024), { rough: 0.88 }),
  );
  map.position.set(0, 0.005, 0.003);
  map.name = 'wall-map';
  g.add(map);

  // pushpins
  const pinMats = [0xc23b2e, 0x2f6fb8, 0xd8a72c, 0x3f9e5a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, emissive: c, emissiveIntensity: 0.05 }),
  );
  const r = rng(17);
  for (let i = 0; i < 9; i++) {
    const pin = cylinder(0.007, 0.007, 0.012, pinMats[i % pinMats.length], {
      pos: [(r() - 0.5) * (w - 0.2), (r() - 0.5) * (h - 0.2), 0.012],
      rot: [Math.PI / 2, 0, 0], seg: 8, shadow: 'none',
    });
    g.add(pin);
  }
  g.userData.mapMesh = map;
  return g;
}

/* ---------------- the clock ---------------- */
/**
 * A 12" institutional wall clock. The hands are real objects that the game
 * clock drives -- which is the entire point, because later tonight one of
 * these is going to disagree with the other one.
 */
export function wallClock(mats, opts = {}) {
  const g = new THREE.Group();
  g.name = 'wall-clock';
  const R = 0.16;
  g.add(cylinder(R, R, 0.045, mats.get('paintedSteel'), { pos: [0, 0, -0.02], rot: [Math.PI / 2, 0, 0], seg: 36 }));

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 512;
  const c = faceCanvas.getContext('2d');
  c.fillStyle = '#e6e2d4'; c.beginPath(); c.arc(256, 256, 250, 0, 7); c.fill();
  c.strokeStyle = '#23221d';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const major = i % 5 === 0;
    c.lineWidth = major ? 7 : 2.5;
    const r0 = major ? 198 : 214;
    c.beginPath();
    c.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
    c.lineTo(256 + Math.cos(a) * 232, 256 + Math.sin(a) * 232);
    c.stroke();
  }
  c.fillStyle = '#23221d';
  c.font = 'bold 54px ui-sans-serif, "DejaVu Sans", sans-serif';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const t = String(i);
    const m = c.measureText(t);
    c.fillText(t, 256 + Math.cos(a) * 162 - m.width / 2, 256 + Math.sin(a) * 162 + 19);
  }
  c.font = '20px ui-sans-serif, "DejaVu Sans", sans-serif';
  c.fillStyle = '#6a6558';
  const brand = 'SIMPLEX';
  c.fillText(brand, 256 - c.measureText(brand).width / 2, 340);

  const face = new THREE.Mesh(new THREE.CircleGeometry(R - 0.012, 40), paperMat(faceCanvas, { rough: 0.75 }));
  face.position.z = 0.004;
  g.add(face);

  const handMat = mats.get('black');
  const mkHand = (len, wdt) => {
    const h = box(wdt, len, 0.004, handMat, { shadow: 'none' });
    h.geometry.translate(0, len / 2 - len * 0.18, 0);
    return h;
  };
  const hour = mkHand(0.085, 0.012);
  const minute = mkHand(0.125, 0.008);
  const second = box(0.003, 0.135, 0.003, new THREE.MeshStandardMaterial({ color: 0xb03a2a, roughness: 0.4 }), { shadow: 'none' });
  second.geometry.translate(0, 0.135 / 2 - 0.026, 0);
  hour.position.z = 0.008; minute.position.z = 0.011; second.position.z = 0.013;
  g.add(hour, minute, second);
  g.add(cylinder(0.010, 0.010, 0.006, mats.get('chrome'), { pos: [0, 0, 0.015], rot: [Math.PI / 2, 0, 0], seg: 12, shadow: 'none' }));

  // convex cover glass
  const cover = new THREE.Mesh(new THREE.CircleGeometry(R - 0.008, 40), mats.get('glass'));
  cover.position.z = 0.018;
  cover.userData.noReflect = true;
  g.add(cover);

  g.userData.animated = true;          // the hands move; never merge this
  g.userData.hands = { hour, minute, second };
  g.userData.id = opts.id || 'clock';
  return g;
}

/** Point a clock's hands at a time of day given in minutes since midnight. */
export function setClock(clock, minutes, seconds = 0) {
  const h = clock.userData.hands;
  if (!h) return;
  const m = ((minutes % 720) + 720) % 720;
  h.hour.rotation.z = -(m / 720) * Math.PI * 2;
  h.minute.rotation.z = -((m % 60) / 60) * Math.PI * 2;
  h.second.rotation.z = -((seconds % 60) / 60) * Math.PI * 2;
}

/* ---------------- small dressing ---------------- */
export function deskLamp(mats) {
  const g = new THREE.Group();
  g.name = 'desk-lamp';
  const body = mats.get('paintedSteel');
  g.add(cylinder(0.085, 0.095, 0.022, body, { pos: [0, 0.011, 0], seg: 20 }));
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0.01, 0.20, -0.01),
    new THREE.Vector3(0.04, 0.33, 0.06), new THREE.Vector3(0.06, 0.34, 0.16),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.010, 6, false), body));
  const shade = cylinder(0.045, 0.085, 0.095, body, { pos: [0.065, 0.315, 0.205], rot: [1.05, 0, 0], seg: 20, open: true });
  shade.material = body.clone();
  shade.material.side = THREE.DoubleSide;
  g.add(shade);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff0cf, emissive: 0xffd9a0, emissiveIntensity: 1.4, roughness: 0.4 });
  g.add(cylinder(0.018, 0.018, 0.03, bulbMat, { pos: [0.065, 0.315, 0.215], rot: [1.05, 0, 0], seg: 12, shadow: 'none' }));
  const light = new THREE.SpotLight(0xffd6a0, 6.0, 2.6, 0.85, 0.6, 1.8);
  light.position.set(0.065, 0.31, 0.22);
  light.target.position.set(0.12, -0.4, 0.62);
  g.add(light, light.target);
  g.userData.animated = true;          // the lamp follows the power rail
  g.userData.light = light;
  g.userData.bulbMat = bulbMat;
  return g;
}

export function mug(mats, opts = {}) {
  const g = new THREE.Group();
  const cMat = new THREE.MeshStandardMaterial({ color: opts.color ?? 0xd8d2c4, roughness: 0.38, metalness: 0 });
  g.add(cylinder(0.041, 0.036, 0.095, cMat, { pos: [0, 0.0475, 0], seg: 22 }));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 18, Math.PI * 1.25), cMat);
  handle.rotation.y = Math.PI / 2;
  handle.position.set(0.044, 0.052, 0);
  handle.castShadow = true;
  g.add(handle);
  // cold coffee, with a ring where it has evaporated down
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.036, 22),
    new THREE.MeshStandardMaterial({ color: 0x2a1b10, roughness: 0.16, metalness: 0 }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.072;
  g.add(coffee);
  return g;
}

export function paperStack(mats, n = 14, opts = {}) {
  const g = new THREE.Group();
  const r = rng(opts.seed || 4);
  const mat = mats.get('paper');
  for (let i = 0; i < n; i++) {
    const s = box(0.216, 0.0012, 0.279, mat, {
      pos: [(r() - 0.5) * 0.008, i * 0.0013, (r() - 0.5) * 0.008],
      rot: [0, (r() - 0.5) * 0.05, 0], shadow: 'receive',
    });
    g.add(s);
  }
  return g;
}

export function wastebasket(mats) {
  const g = new THREE.Group();
  const m = mats.get('greyMetal');
  const b = cylinder(0.145, 0.115, 0.33, m, { pos: [0, 0.165, 0], seg: 20, open: true });
  b.material = m.clone(); b.material.side = THREE.DoubleSide;
  g.add(b);
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.115, 20), mats.get('black')));
  const r = rng(21);
  for (let i = 0; i < 5; i++) {
    const wad = new THREE.Mesh(new THREE.IcosahedronGeometry(0.028 + r() * 0.014, 0), mats.get('paper'));
    wad.position.set((r() - 0.5) * 0.16, 0.20 + r() * 0.10, (r() - 0.5) * 0.16);
    wad.rotation.set(r() * 3, r() * 3, r() * 3);
    wad.castShadow = true;
    g.add(wad);
  }
  return g;
}

export function cardboardBox(mats, opts = {}) {
  const w = opts.w || 0.42, h = opts.h || 0.31, d = opts.d || 0.34;
  const mat = new THREE.MeshStandardMaterial({ color: 0xa88a5f, roughness: 0.94, metalness: 0 });
  const g = new THREE.Group();
  g.add(bevelBox(w, h, d, mat, 0.006, { pos: [0, h / 2, 0] }));
  // packing tape down the seam
  g.add(box(0.055, 0.0015, d + 0.002, new THREE.MeshStandardMaterial({ color: 0xbfa37a, roughness: 0.35 }), {
    pos: [0, h + 0.001, 0], shadow: 'none',
  }));
  if (opts.label) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 0.05), paperMat(labelPlate(opts.label, { bg: '#c8ab7e', fg: '#3a2c18', size: 26 })));
    card.position.set(0, h * 0.6, d / 2 + 0.002);
    g.add(card);
  }
  return g;
}

export function waterCooler(mats) {
  const g = new THREE.Group();
  const body = mats.get('beigePlastic');
  g.add(bevelBox(0.33, 0.92, 0.33, body, 0.012, { pos: [0, 0.46, 0] }));
  const jugMat = new THREE.MeshStandardMaterial({ color: 0x9fc4cf, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.55 });
  const jug = cylinder(0.13, 0.16, 0.40, jugMat, { pos: [0, 1.14, 0], seg: 22 });
  jug.userData.noReflect = true;
  g.add(jug);
  g.add(cylinder(0.055, 0.075, 0.10, jugMat, { pos: [0, 0.94, 0], seg: 18 }));
  for (const [x, col] of [[-0.055, 0x2f5fa8], [0.055, 0xa83a2f]]) {
    g.add(box(0.030, 0.055, 0.045, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }), { pos: [x, 0.62, 0.175] }));
  }
  g.add(cylinder(0.06, 0.06, 0.012, mats.get('greyMetal'), { pos: [0, 0.50, 0.14], seg: 16 }));
  return g;
}

export function coffeeMaker(mats) {
  const g = new THREE.Group();
  const body = mats.get('darkPlastic');
  g.add(bevelBox(0.20, 0.34, 0.25, body, 0.008, { pos: [0, 0.17, -0.02] }));
  g.add(box(0.20, 0.022, 0.16, mats.get('greyMetal'), { pos: [0, 0.012, 0.10] }));
  const potMat = new THREE.MeshStandardMaterial({ color: 0xcfd6da, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.35 });
  const pot = cylinder(0.072, 0.062, 0.14, potMat, { pos: [0, 0.09, 0.10], seg: 20 });
  pot.userData.noReflect = true;
  g.add(pot);
  g.add(cylinder(0.060, 0.052, 0.055, new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.2 }), { pos: [0, 0.048, 0.10], seg: 20 }));
  const onMat = new THREE.MeshStandardMaterial({ color: 0x7a1c14, emissive: 0xff3a1c, emissiveIntensity: 1.6, roughness: 0.4 });
  g.add(box(0.018, 0.007, 0.006, onMat, { pos: [0.06, 0.055, 0.055], shadow: 'none' }));
  return g;
}

export function vendingMachine(mats) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x8a2019, roughness: 0.42, metalness: 0.1 });
  const W = 0.92, H = 1.86, D = 0.78;
  g.add(bevelBox(W, H, D, body, 0.012, { pos: [0, H / 2, 0] }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.55, H * 0.62), mats.get('glass'));
  glass.position.set(-W * 0.18, H * 0.60, D / 2 + 0.004);
  glass.userData.noReflect = true;
  g.add(glass);
  // the lit product panel behind it -- this is the only light in the break room
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.55, H * 0.62),
    new THREE.MeshStandardMaterial({ color: 0xd8c99a, emissive: 0xffe9b0, emissiveIntensity: 2.2, roughness: 0.8 }),
  );
  panel.position.set(-W * 0.18, H * 0.60, D / 2 - 0.02);
  g.add(panel);
  // No real light here. A lit panel behind glass reads perfectly well as a
  // light source via emissive + bloom, and a point light in the break room
  // would be evaluated by every pixel in the building. See lighting.js.
  // selection keypad and coin return
  for (let i = 0; i < 8; i++) {
    g.add(box(0.05, 0.032, 0.014, mats.get('black'), { pos: [W * 0.26, H * 0.86 - i * 0.055, D / 2 + 0.004], shadow: 'none' }));
  }
  g.add(box(0.18, 0.10, 0.02, mats.get('black'), { pos: [W * 0.24, H * 0.30, D / 2 + 0.004] }));
  return g;
}

/** A framed notice or sign hung flat on a wall. */
export function wallNotice(canvasEl, w, h, opts = {}) {
  const g = new THREE.Group();
  const mat = paperMat(canvasEl, { rough: 0.92 });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  sheet.position.z = 0.002;
  g.add(sheet);
  if (opts.frame) {
    const f = opts.frameMat;
    const t = 0.02;
    g.add(box(w + t * 2, t, 0.018, f, { pos: [0, h / 2 + t / 2, 0] }));
    g.add(box(w + t * 2, t, 0.018, f, { pos: [0, -h / 2 - t / 2, 0] }));
    g.add(box(t, h, 0.018, f, { pos: [-w / 2 - t / 2, 0, 0] }));
    g.add(box(t, h, 0.018, f, { pos: [w / 2 + t / 2, 0, 0] }));
  }
  return g;
}

/** A lit EXIT sign -- the one warm thing in the corridor. */
export function exitSignProp(mats) {
  const g = new THREE.Group();
  g.name = 'exit-sign';
  g.add(box(0.36, 0.19, 0.055, mats.get('paintedSteel'), { pos: [0, 0, -0.03] }));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.155),
    new THREE.MeshStandardMaterial({ map: texFrom(exitSign()), emissiveMap: texFrom(exitSign()), emissive: 0xffffff, emissiveIntensity: 3.4, roughness: 0.6 }),
  );
  face.position.z = 0.001;
  g.add(face);
  // Emissive + bloom only. Two exit signs used to cost two real lights for a
  // glow that the post chain gives away for free.
  return g;
}

/** Surface-mounted conduit and a junction box -- 1962 construction detail. */
export function conduitRun(mats, length, opts = {}) {
  const g = new THREE.Group();
  const m = mats.get('greyMetal');
  const pipe = cylinder(0.016, 0.016, length, m, { rot: [0, 0, Math.PI / 2], seg: 10, shadow: 'cast' });
  g.add(pipe);
  const straps = Math.max(2, Math.round(length / 1.2));
  for (let i = 0; i < straps; i++) {
    const x = -length / 2 + (length * (i + 0.5)) / straps;
    g.add(box(0.012, 0.045, 0.028, m, { pos: [x, 0, -0.012], shadow: 'none' }));
  }
  if (opts.box) g.add(box(0.10, 0.10, 0.05, m, { pos: [length / 2 - 0.05, 0, 0] }));
  return g;
}

/** Light switch / thermostat plate. Small, but the eye checks for them. */
export function wallPlate(mats, kind = 'switch') {
  const g = new THREE.Group();
  const plate = mats.get('beigePlastic');
  if (kind === 'thermostat') {
    g.add(bevelBox(0.10, 0.13, 0.030, plate, 0.006, { pos: [0, 0, 0.015] }));
    g.add(cylinder(0.028, 0.028, 0.012, mats.get('chrome'), { pos: [0, -0.02, 0.034], rot: [Math.PI / 2, 0, 0], seg: 16, shadow: 'none' }));
  } else if (kind === 'outlet') {
    g.add(box(0.072, 0.115, 0.008, plate, { pos: [0, 0, 0.004] }));
    for (const y of [-0.026, 0.026]) {
      g.add(box(0.028, 0.036, 0.004, mats.get('black'), { pos: [0, y, 0.008], shadow: 'none' }));
    }
  } else {
    g.add(box(0.072, 0.115, 0.008, plate, { pos: [0, 0, 0.004] }));
    g.add(box(0.018, 0.040, 0.012, plate, { pos: [0, 0.004, 0.010], rot: [0.18, 0, 0], shadow: 'none' }));
  }
  return g;
}
