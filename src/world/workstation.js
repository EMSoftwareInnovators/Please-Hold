/* ============================================================
   workstation.js -- the dispatch desk and everything on it.

   The player spends most of the game looking at these four
   objects, so they get the detail budget: real bezels, real
   chamfers, individual keycaps, a coiled handset cord, lamps
   that other systems can actually drive.

   Anything another system needs to touch is hung on userData
   with a stable name -- `screenMaterial`, `lineLamps`, `handset`,
   `vuNeedle` -- so the phone system and the terminal never reach
   into the model's structure. Swap the model, keep the names,
   and nothing downstream breaks.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { box, bevelBox, cylinder, boxUV, planeUV } from './geo.js';
import { labelPlate } from './signage.js';
import { rng } from '../engine/noise.js';

const texFrom = (canvas, srgb = true) => {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
};

/* ============================================================
   THE DESK -- an L of 1978 steel-and-laminate office furniture
   ============================================================ */
export function dispatchDesk(mats, DESK) {
  const g = new THREE.Group();
  g.name = 'dispatch-desk';
  const top = mats.get('deskLaminate');
  const steel = mats.get('paintedSteel');
  const edge = mats.get('darkPlastic');

  const slab = (r) => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    // 30mm core with a black T-mold edge band, which is exactly how these
    // desks were built and is the detail your eye uses to date them.
    // The top is built long-axis-first and then turned, so the woodgrain
    // always runs the length of the slab instead of across it.
    if (w >= d) {
      g.add(box(w, 0.026, d, top, { pos: [cx, r.top - 0.013, cz] }));
    } else {
      const turned = box(d, 0.026, w, top, { pos: [cx, r.top - 0.013, cz] });
      turned.rotation.y = Math.PI / 2;
      g.add(turned);
    }
    g.add(box(w + 0.008, 0.034, d + 0.008, edge, { pos: [cx, r.top - 0.030, cz] }));
    // modesty panel + a pair of end panels
    g.add(box(w - 0.10, 0.42, 0.018, steel, { pos: [cx, r.top - 0.30, r.z0 + 0.04] }));
    for (const x of [r.x0 + 0.03, r.x1 - 0.03]) {
      g.add(box(0.032, r.top - 0.06, d - 0.06, steel, { pos: [x, (r.top - 0.06) / 2 + 0.06, cz] }));
      g.add(box(0.06, 0.055, d - 0.02, edge, { pos: [x, 0.028, cz] }));   // leveler foot rail
    }
  };
  slab(DESK.run);
  slab(DESK.wing);

  // Drawer pedestal under the main run: three drawers, brushed pulls.
  const px = DESK.run.x0 + 0.62, pz = (DESK.run.z0 + DESK.run.z1) / 2;
  const pedW = 0.42, pedD = DESK.run.z1 - DESK.run.z0 - 0.10, pedH = DESK.run.top - 0.08;
  g.add(box(pedW, pedH, pedD, steel, { pos: [px, pedH / 2 + 0.04, pz] }));
  for (let i = 0; i < 3; i++) {
    const y = 0.18 + i * 0.20;
    g.add(box(pedW + 0.006, 0.185, 0.014, steel, { pos: [px, y, pz - pedD / 2 - 0.008] }));
    g.add(box(0.16, 0.018, 0.026, mats.get('chrome'), { pos: [px, y, pz - pedD / 2 - 0.024] }));
  }

  // Grommet + a cable bundle dropping behind the desk. Cheap, very convincing.
  const grommet = cylinder(0.035, 0.035, 0.012, mats.get('black'), {
    pos: [DESK.run.x1 - 0.55, DESK.run.top + 0.002, DESK.run.z0 + 0.18], seg: 14, shadow: 'none',
  });
  g.add(grommet);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(DESK.run.x1 - 0.55, DESK.run.top - 0.02, DESK.run.z0 + 0.18),
    new THREE.Vector3(DESK.run.x1 - 0.54, DESK.run.top - 0.36, DESK.run.z0 + 0.10),
    new THREE.Vector3(DESK.run.x1 - 0.50, 0.10, DESK.run.z0 + 0.02),
    new THREE.Vector3(DESK.run.x1 - 0.42, 0.03, DESK.run.z0 - 0.06),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.013, 6, false), mats.get('rubberBlack'));
  cable.castShadow = true;
  g.add(cable);

  return g;
}

/* ============================================================
   THE CRT -- a 15" beige monitor, 1997 vintage
   ============================================================ */
export function crtMonitor(mats, opts = {}) {
  const g = new THREE.Group();
  g.name = 'crt-monitor';
  const shell = mats.get('beigePlastic');

  const W = 0.40, H = 0.325, D = 0.44;     // overall envelope; the visible
                                          // screen inside the bezel is 4:3
  const BEZEL = 0.046;                      // width of the plastic frame
  const FRONT = D / 2;                      // z of the bezel face
  const CY = 0.075 + H / 2;                 // center height of the tube

  // --- rear can: a box pinched toward the back, like a real deflection yoke
  const canL = D - 0.10;
  const can = new THREE.Mesh(boxUV(new THREE.BoxGeometry(W - 0.03, H - 0.03, canL), W, H, canL), shell);
  {
    const pos = can.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) < 0) { pos.setX(i, pos.getX(i) * 0.60); pos.setY(i, pos.getY(i) * 0.58); }
    }
    can.geometry.computeVertexNormals();
  }
  can.position.set(0, CY, FRONT - 0.055 - canL / 2);
  can.castShadow = can.receiveShadow = true;
  g.add(can);

  // --- bezel: four slabs framing the glass, so the tube sits recessed
  const inW = W - BEZEL * 2, inH = H - BEZEL * 2;
  const bz = FRONT - 0.028;
  g.add(box(W, BEZEL, 0.056, shell, { pos: [0, CY + inH / 2 + BEZEL / 2, bz] }));
  g.add(box(W, BEZEL + 0.022, 0.056, shell, { pos: [0, CY - inH / 2 - (BEZEL + 0.022) / 2, bz] }));
  g.add(box(BEZEL, H, 0.056, shell, { pos: [-inW / 2 - BEZEL / 2, CY, bz] }));
  g.add(box(BEZEL, H, 0.056, shell, { pos: [inW / 2 + BEZEL / 2, CY, bz] }));

  // --- vent slots across the top of the can
  for (let i = 0; i < 8; i++) {
    g.add(box(W * 0.52, 0.003, 0.010, mats.get('black'), {
      pos: [0, CY + (H - 0.03) / 2 + 0.001, FRONT - 0.12 - i * 0.026], shadow: 'none',
    }));
  }

  // --- tilt/swivel base
  g.add(cylinder(0.135, 0.155, 0.038, shell, { pos: [0, 0.019, FRONT - 0.20], seg: 22 }));
  g.add(cylinder(0.055, 0.060, 0.045, shell, { pos: [0, 0.052, FRONT - 0.20], seg: 16, shadow: 'none' }));

  // --- the screen: a shallow dome, because a 1997 tube is not flat and the
  //     curve is what makes the glow and the reflection sit right
  const glassGeo = new THREE.PlaneGeometry(inW, inH, 20, 20);
  {
    const pos = glassGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (inW / 2), y = pos.getY(i) / (inH / 2);
      pos.setZ(i, (1 - Math.min(1, x * x * 0.6 + y * y * 0.6)) * 0.014);
    }
    glassGeo.computeVertexNormals();
  }
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x07090a,
    // Rougher than real glass on purpose: a mirror-smooth tube puts a
    // hard reflection of the ceiling troffer dead centre of the screen and
    // makes the terminal unreadable from the chair.
    roughness: 0.38,
    metalness: 0,
    emissive: 0xffffff,
    emissiveIntensity: 0,      // terminal.js raises this when the CRT is on
  });
  const screen = new THREE.Mesh(glassGeo, screenMat);
  screen.position.set(0, CY, FRONT - 0.030);
  screen.name = 'crt-screen';
  screen.userData.noReflect = true;
  g.add(screen);

  // --- brand plate, power lamp, and the two adjustment knobs
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.105, 0.016),
    new THREE.MeshStandardMaterial({
      map: texFrom(labelPlate('VECTRONIX  DM-1500', { bg: '#9d967c', fg: '#2f2c24', size: 26 })),
      roughness: 0.7,
    }),
  );
  plate.position.set(-0.095, CY - inH / 2 - 0.028, FRONT + 0.001);
  g.add(plate);

  const ledMat = new THREE.MeshStandardMaterial({ color: 0x1d5a2a, emissive: 0x2bff6a, emissiveIntensity: 2.2, roughness: 0.3 });
  const led = cylinder(0.005, 0.005, 0.005, ledMat, {
    pos: [0.145, CY - inH / 2 - 0.028, FRONT], rot: [Math.PI / 2, 0, 0], seg: 10, shadow: 'none',
  });
  g.add(led);
  for (let i = 0; i < 2; i++) {
    g.add(cylinder(0.010, 0.010, 0.012, mats.get('darkPlastic'), {
      pos: [0.045 + i * 0.030, CY - inH / 2 - 0.028, FRONT - 0.002],
      rot: [Math.PI / 2, 0, 0], seg: 12, shadow: 'none',
    }));
  }

  // --- the glow the tube throws into the room; terminal.js drives it
  const glow = new THREE.PointLight(0xbfe9c8, 0, 2.8, 2.0);
  glow.position.set(0, CY, FRONT + 0.18);
  g.add(glow);

  g.userData.animated = true;          // the tube, its glow and its lamp all move
  g.userData.screenMaterial = screenMat;
  g.userData.screenMesh = screen;
  g.userData.glow = glow;
  g.userData.powerLed = led;
  g.userData.screenSize = { w: inW, h: inH };
  if (opts.yaw) g.rotation.y = opts.yaw;
  return g;
}

/* ============================================================
   KEYBOARD -- individual keycaps, instanced
   ============================================================ */
export function keyboard(mats) {
  const g = new THREE.Group();
  g.name = 'keyboard';
  const shell = mats.get('beigePlastic');
  const W = 0.46, D = 0.17;
  g.add(bevelBox(W, 0.028, D, shell, 0.006, { pos: [0, 0.014, 0] }));
  // wedge: back edge sits higher, like every real keyboard
  g.rotation.x = -0.06;

  const capMat = new THREE.MeshStandardMaterial({ color: 0xcdc6ac, roughness: 0.66, metalness: 0 });
  const rows = [
    { n: 13, y: -0.055, w: 0.028 },
    { n: 13, y: -0.023, w: 0.028 },
    { n: 12, y: 0.009, w: 0.030 },
    { n: 11, y: 0.041, w: 0.033 },
  ];
  let total = 0;
  for (const r of rows) total += r.n;
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), capMat, total + 1);
  caps.castShadow = true;
  const m = new THREE.Matrix4();
  let i = 0;
  for (const r of rows) {
    const span = r.n * r.w;
    for (let k = 0; k < r.n; k++) {
      const x = -span / 2 + r.w * (k + 0.5);
      m.compose(
        new THREE.Vector3(x, 0.034, r.y),
        new THREE.Quaternion(),
        new THREE.Vector3(r.w - 0.005, 0.010, 0.026),
      );
      caps.setMatrixAt(i++, m);
    }
  }
  // space bar
  m.compose(new THREE.Vector3(0, 0.034, 0.070), new THREE.Quaternion(), new THREE.Vector3(0.17, 0.010, 0.024));
  caps.setMatrixAt(i++, m);
  caps.count = i;
  caps.instanceMatrix.needsUpdate = true;
  g.add(caps);

  // coiled-ish cable off the back
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.016, -D / 2),
    new THREE.Vector3(0.05, 0.014, -D / 2 - 0.10),
    new THREE.Vector3(0.14, 0.010, -D / 2 - 0.16),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.005, 5, false), mats.get('beigePlastic'));
  g.add(cable);
  return g;
}

/* ============================================================
   THE TELEPHONE -- a six-line business set
   ============================================================ */
export function telephone(mats) {
  const g = new THREE.Group();
  g.name = 'telephone';
  const shell = mats.get('darkPlastic');
  const W = 0.235, D = 0.235, H = 0.062;

  // wedge body
  g.add(bevelBox(W, H, D, shell, 0.008, { pos: [0, H / 2, 0] }));
  g.add(box(W - 0.02, 0.022, D * 0.44, shell, { pos: [0, H + 0.010, D * 0.20], rot: [-0.16, 0, 0] }));

  // keypad: 12 keys, slightly proud, light grey
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x6e7076, roughness: 0.55 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      g.add(box(0.020, 0.006, 0.014, keyMat, {
        pos: [-0.030 + c * 0.030, H + 0.005, -0.012 + r * 0.021], shadow: 'none',
      }));
    }
  }

  // line appearance buttons with their lamps. The phone system drives these.
  const lampMats = [];
  const lineLamps = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.082 + (i % 3) * 0.026;
    const z = 0.062 + Math.floor(i / 3) * 0.024;
    g.add(box(0.021, 0.005, 0.016, keyMat, { pos: [x, H + 0.0045, z], shadow: 'none' }));
    const lm = new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: 0xff7a1a, emissiveIntensity: 0, roughness: 0.35 });
    const lamp = box(0.013, 0.003, 0.005, lm, { pos: [x, H + 0.0085, z - 0.008], shadow: 'none' });
    g.add(lamp);
    lampMats.push(lm);
    lineLamps.push(lamp);
  }

  // HOLD button -- red, and the one the whole game is named after
  const holdMat = new THREE.MeshStandardMaterial({ color: 0x8c2a20, emissive: 0xff2a12, emissiveIntensity: 0, roughness: 0.4 });
  const hold = box(0.040, 0.006, 0.018, holdMat, { pos: [0.072, H + 0.005, 0.070], shadow: 'none' });
  hold.name = 'hold-button';
  g.add(hold);

  // handset in its cradle
  const handset = new THREE.Group();
  handset.name = 'handset';
  const hs = mats.get('darkPlastic');
  handset.add(bevelBox(0.052, 0.030, 0.195, hs, 0.010, { pos: [0, 0, 0] }));
  for (const z of [-0.082, 0.082]) {
    handset.add(bevelBox(0.058, 0.046, 0.052, hs, 0.012, { pos: [0, 0.008, z] }));
    const grille = new THREE.Mesh(new THREE.CircleGeometry(0.019, 18), mats.get('black'));
    grille.rotation.x = -Math.PI / 2;
    grille.position.set(0, 0.031, z);
    handset.add(grille);
  }
  handset.position.set(-0.085, H + 0.030, 0);
  handset.rotation.z = 0.04;
  g.add(handset);

  // coiled cord: a helix swept along a short arc
  {
    const pts = [];
    const turns = 11, N = 160;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const along = -0.085 + t * 0.075;
      const sag = Math.sin(t * Math.PI) * 0.055;
      const a = t * Math.PI * 2 * turns;
      pts.push(new THREE.Vector3(
        along + Math.cos(a) * 0.016,
        H + 0.018 - sag + Math.sin(a) * 0.016,
        -0.105 - t * 0.02,
      ));
    }
    const cord = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 190, 0.0042, 5, false),
      mats.get('rubberBlack'),
    );
    cord.castShadow = true;
    g.add(cord);
  }

  // the printed card under the plastic window, with the desk's own number
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(0.075, 0.020),
    new THREE.MeshStandardMaterial({ map: texFrom(labelPlate('DISPATCH  x2240', { bg: '#ddd7c2', fg: '#2c2a24', size: 24 })), roughness: 0.6 }),
  );
  card.rotation.x = -Math.PI / 2;
  card.position.set(0.070, H + 0.0035, 0.028);
  g.add(card);

  g.userData.animated = true;          // line lamps and the hold button
  g.userData.lineLamps = lineLamps;
  g.userData.lineLampMats = lampMats;
  g.userData.holdMat = holdMat;
  g.userData.handset = handset;
  g.userData.handsetHome = handset.position.clone();
  return g;
}

/* ============================================================
   RADIO CONSOLE -- the link to the field crews
   ============================================================ */
export function radioConsole(mats) {
  const g = new THREE.Group();
  g.name = 'radio-console';
  const face = mats.get('paintedSteel');
  const W = 0.34, H = 0.20, D = 0.26;

  g.add(bevelBox(W, H, D, face, 0.010, { pos: [0, H / 2, 0] }));
  // raked front panel
  const panel = box(W - 0.03, 0.155, 0.016, mats.get('darkPlastic'), {
    pos: [0, H * 0.56, D / 2 - 0.01], rot: [-0.30, 0, 0],
  });
  g.add(panel);

  // speaker grille: a punched pattern, instanced
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0c, roughness: 0.9 });
  const holes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 6), holeMat, 88);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.30, 0, 0));
  let i = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 11; c++) {
      const lx = -0.072 + c * 0.0145;
      const ly = -0.048 + r * 0.0135;
      m.compose(
        new THREE.Vector3(lx, H * 0.56 + ly * Math.cos(0.30) + 0.012, D / 2 + 0.001 + ly * Math.sin(0.30)),
        q, new THREE.Vector3(1, 1, 1),
      );
      holes.setMatrixAt(i++, m);
    }
  }
  holes.count = i;
  holes.instanceMatrix.needsUpdate = true;
  g.add(holes);

  // channel selector + volume, with real knob skirts
  const knob = (x) => {
    const k = new THREE.Group();
    k.add(cylinder(0.020, 0.023, 0.020, mats.get('darkPlastic'), { seg: 18, shadow: 'cast' }));
    const mark = box(0.0035, 0.021, 0.016, mats.get('whitePaint'), { pos: [0, 0.001, 0.012], shadow: 'none' });
    k.add(mark);
    k.position.set(x, H * 0.56 - 0.052, D / 2 + 0.026);
    k.rotation.x = -0.30 + Math.PI / 2;
    return k;
  };
  const chanKnob = knob(0.086);
  g.add(chanKnob, knob(-0.086));

  // VU meter: a lit window with a needle the radio system moves
  const meterFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.085, 0.036),
    new THREE.MeshStandardMaterial({ color: 0xd9d2b0, emissive: 0xffd9a0, emissiveIntensity: 0.35, roughness: 0.5 }),
  );
  meterFace.position.set(0, H * 0.56 + 0.052, D / 2 + 0.006);
  meterFace.rotation.x = -0.30;
  g.add(meterFace);
  const needle = box(0.0022, 0.030, 0.002, mats.get('black'), { shadow: 'none' });
  needle.position.set(0, H * 0.56 + 0.046, D / 2 + 0.009);
  needle.rotation.x = -0.30;
  needle.geometry.translate(0, 0.015, 0);   // pivot at the bottom
  g.add(needle);

  // transmit lamp
  const txMat = new THREE.MeshStandardMaterial({ color: 0x7a1c14, emissive: 0xff2a12, emissiveIntensity: 0, roughness: 0.35 });
  const tx = cylinder(0.007, 0.007, 0.006, txMat, {
    pos: [-0.052, H * 0.56 + 0.052, D / 2 + 0.008], rot: [Math.PI / 2 - 0.30, 0, 0], seg: 10, shadow: 'none',
  });
  g.add(tx);

  // desk microphone on a chrome gooseneck
  const mic = new THREE.Group();
  mic.name = 'radio-mic';
  mic.add(cylinder(0.042, 0.050, 0.014, mats.get('greyMetal'), { pos: [0, 0.007, 0], seg: 18 }));
  const neck = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.012, 0), new THREE.Vector3(0, 0.10, 0.01),
    new THREE.Vector3(0.005, 0.17, 0.05), new THREE.Vector3(0.01, 0.195, 0.10),
  ]);
  mic.add(new THREE.Mesh(new THREE.TubeGeometry(neck, 16, 0.006, 6, false), mats.get('chrome')));
  const head = cylinder(0.024, 0.024, 0.030, mats.get('darkPlastic'), {
    pos: [0.012, 0.198, 0.115], rot: [1.2, 0, 0], seg: 16,
  });
  mic.add(head);
  mic.position.set(-0.20, 0, 0.02);
  g.add(mic);

  g.userData.animated = true;          // VU needle and transmit lamp
  g.userData.vuNeedle = needle;
  g.userData.txMat = txMat;
  g.userData.meterFace = meterFace;
  g.userData.chanKnob = chanKnob;
  return g;
}
