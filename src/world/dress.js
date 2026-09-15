/* ============================================================
   dress.js -- furnishes the building.

   This is the only module that knows where things ARE. Props
   know how to build themselves; the plan knows the shell; this
   puts one inside the other and hands back the handful of
   objects the game systems need to talk to.

   Interactables are declared here too, as `userData.interact`,
   so adding a new thing the player can use is a one-line change
   next to the prop that represents it.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { box, cylinder, deg } from './geo.js';
import { DESK, CEIL, CEIL_HALL } from './plan.js';
import { dispatchDesk, crtMonitor, keyboard, telephone, radioConsole } from './workstation.js';
import {
  officeChair, fileCabinet, shelfUnit, mapBoard, wallClock, deskLamp, mug, paperStack,
  wastebasket, cardboardBox, waterCooler, coffeeMaker, vendingMachine, wallNotice,
  exitSignProp, conduitRun, wallPlate,
} from './props.js';
import { notice } from './signage.js';

/** Mark an object as usable and record it. */
function usable(list, obj, spec) {
  obj.userData.interact = spec;
  list.push(obj);
  return obj;
}

export function dressBuilding(scene, mats, office) {
  const root = new THREE.Group();
  root.name = 'dressing';
  scene.add(root);

  const interactables = [];
  const out = { root, interactables, clocks: [] };
  const solids = office.solids;

  /* ============================================================
     DISPATCH ROOM -- the room that gets the detail budget
     ============================================================ */

  const desk = dispatchDesk(mats, DESK);
  root.add(desk);
  solids.add(DESK.run.x0, DESK.run.z0, DESK.run.x1, DESK.run.z1, DESK.run.top, 'desk');
  solids.add(DESK.wing.x0, DESK.wing.z0, DESK.wing.x1, DESK.wing.z1, DESK.wing.top, 'desk');
  out.desk = desk;

  // --- the terminal ---
  const crt = crtMonitor(mats);
  crt.position.set(DESK.terminal.x, DESK.run.top, DESK.terminal.z);
  crt.rotation.y = DESK.terminal.yaw;            // screen faces +Z, i.e. the chair
  root.add(crt);
  // Not seated-only: using the computer is what SITS you at it. Making the
  // chair a prerequisite the player had to discover first was the main
  // reason the terminal felt like a puzzle.
  usable(interactables, crt, {
    id: 'terminal', label: 'DISPATCH TERMINAL', verb: 'Sit at', range: 2.2,
  });
  out.crt = crt;

  const kbd = keyboard(mats);
  kbd.position.set(DESK.keyboard.x, DESK.run.top + 0.001, DESK.keyboard.z);
  kbd.rotation.y = 0;
  root.add(kbd);
  usable(interactables, kbd, {
    id: 'terminal', label: 'DISPATCH TERMINAL', verb: 'Sit at', range: 2.2,
  });
  out.keyboard = kbd;

  // --- the telephone ---
  const phone = telephone(mats);
  phone.position.set(DESK.phone.x, DESK.run.top, DESK.phone.z);
  phone.rotation.y = DESK.phone.yaw;
  root.add(phone);
  usable(interactables, phone, {
    id: 'phone', label: 'TELEPHONE', verb: 'Answer', range: 1.6,
  });
  out.phone = phone;

  // --- the radio ---
  const radio = radioConsole(mats);
  radio.position.set(DESK.radio.x, DESK.wing.top, DESK.radio.z);
  radio.rotation.y = DESK.radio.yaw;
  root.add(radio);
  usable(interactables, radio, {
    id: 'radio', label: 'FIELD RADIO', verb: 'Use', range: 1.6,
  });
  out.radio = radio;

  // --- the chair ---
  const chair = officeChair(mats, { yaw: Math.PI + 0.12 });
  chair.position.set(DESK.seat.x + 0.06, 0, DESK.seat.z + 0.28);
  root.add(chair);
  usable(interactables, chair, {
    id: 'seat', label: 'DISPATCH DESK', verb: 'Sit at', seatedVerb: 'Stand up from', range: 1.9,
  });
  out.chair = chair;

  // --- desk clutter ---
  const lamp = deskLamp(mats);
  lamp.position.set(DESK.lamp.x, DESK.run.top, DESK.lamp.z);
  lamp.rotation.y = -2.2;
  root.add(lamp);
  out.deskLamp = lamp;

  const cup = mug(mats);
  cup.position.set(DESK.mug.x, DESK.run.top, DESK.mug.z);
  root.add(cup);

  const stack = paperStack(mats, 16, { seed: 8 });
  stack.position.set(DESK.run.x0 + 0.42, DESK.run.top, DESK.run.z0 + 0.42);
  stack.rotation.y = 0.16;
  root.add(stack);

  const logbook = paperStack(mats, 5, { seed: 12 });
  logbook.position.set(DESK.wing.x0 + 0.38, DESK.wing.top, DESK.wing.z0 + 0.95);
  logbook.rotation.y = -0.4;
  root.add(logbook);
  usable(interactables, logbook, {
    id: 'logbook', label: 'SHIFT LOG', verb: 'Read', range: 1.4,
  });

  // --- the map board, over the desk on the north wall ---
  const board = mapBoard(mats, DESK.board);
  board.position.set(DESK.board.x, DESK.board.y, DESK.board.z);
  root.add(board);
  usable(interactables, board, {
    id: 'mapboard', label: 'SERVICE AREA MAP', verb: 'Examine', range: 2.2,
  });
  out.mapBoard = board;

  // --- clocks. There are two in this building, and that will matter. ---
  const clockA = wallClock(mats, { id: 'dispatch' });
  clockA.position.set(8.85, 2.30, 0.10);
  root.add(clockA);
  out.clocks.push(clockA);
  usable(interactables, clockA, { id: 'clock_dispatch', label: 'WALL CLOCK', verb: 'Check', range: 2.6 });

  // --- filing along the west wall ---
  for (let i = 0; i < 3; i++) {
    const fc = fileCabinet(mats, ['ACCTS A-F', 'ACCTS G-L', 'ACCTS M-R', 'ACCTS S-Z']);
    fc.position.set(0.42, 0, 1.1 + i * 0.52);
    fc.rotation.y = Math.PI / 2;
    root.add(fc);
    solids.addObject(fc, 'cabinet');
    if (i === 1) usable(interactables, fc, { id: 'files_dispatch', label: 'ACCOUNT FILES', verb: 'Open', range: 1.5 });
  }

  // --- two day-shift desks, cold ---
  for (const [dx, dz, yaw, seed] of [[2.35, 5.40, 0.1, 3], [7.55, 5.40, -0.1, 6]]) {
    const d = new THREE.Group();
    const top = mats.get('deskLaminate');
    const steel = mats.get('paintedSteel');
    d.add(box(1.6, 0.026, 0.78, top, { pos: [0, 0.727, 0] }));
    d.add(box(1.61, 0.034, 0.79, mats.get('darkPlastic'), { pos: [0, 0.710, 0] }));
    for (const sx of [-0.76, 0.76]) d.add(box(0.032, 0.68, 0.72, steel, { pos: [sx, 0.35, 0] }));
    d.add(box(1.5, 0.42, 0.018, steel, { pos: [0, 0.44, -0.34] }));
    // These two are dark all night, so they get no light of their own.
    const m = crtMonitor(mats, { glow: false });
    m.position.set(-0.30, 0.74, -0.12);
    m.rotation.y = 0.2;
    d.add(m);
    const k = keyboard(mats);
    k.position.set(-0.26, 0.741, 0.22);
    k.rotation.y = 0.15;
    d.add(k);
    const dayPapers = paperStack(mats, 9, { seed });
    dayPapers.position.set(0.48, 0.74, 0.05);
    dayPapers.rotation.y = 0.2;
    d.add(dayPapers);
    d.position.set(dx, 0, dz);
    d.rotation.y = yaw;
    root.add(d);
    solids.addObject(d, 'desk');

    const c = officeChair(mats, { yaw: Math.PI * 0.9 });
    c.position.set(dx + 0.1, 0, dz + 0.92);
    root.add(c);
  }

  // --- the corner with the coffee ---
  const credenza = box(1.5, 0.88, 0.55, mats.get('paintedSteel'), { pos: [0, 0.44, 0] });
  const credGroup = new THREE.Group();
  credGroup.add(credenza);
  credGroup.add(box(1.54, 0.03, 0.58, mats.get('deskLaminate'), { pos: [0, 0.90, 0] }));
  credGroup.position.set(2.2, 0, 7.62);
  root.add(credGroup);
  solids.addObject(credGroup, 'credenza');

  const coffee = coffeeMaker(mats);
  coffee.position.set(1.95, 0.915, 7.60);
  coffee.rotation.y = 0.1;
  root.add(coffee);
  usable(interactables, coffee, { id: 'coffee', label: 'COFFEE MAKER', verb: 'Pour', range: 1.4 });

  const cooler = waterCooler(mats);
  cooler.position.set(9.5, 0, 7.5);
  cooler.rotation.y = -0.7;
  root.add(cooler);
  solids.addObject(cooler, 'cooler');

  const bin = wastebasket(mats);
  bin.position.set(DESK.wing.x1 + 0.32, 0, DESK.wing.z1 + 0.28);
  root.add(bin);

  // A stack of boxes nobody ever got around to filing.
  for (const [bx, by, bz, label, h, yaw] of [
    [9.30, 0.00, 1.20, 'FORMS 1994-96', 0.31, 0.05],
    [9.28, 0.31, 1.18, 'XMAS - OFFICE', 0.28, 0.31],
  ]) {
    const cb = cardboardBox(mats, { label, h });
    cb.position.set(bx, by, bz);
    cb.rotation.y = yaw;
    root.add(cb);
  }

  // --- the corkboard on the south wall ---
  const notices = [
    notice([
      { t: 'SAFETY IS A CONDITION', bold: true, size: 30, center: true, gap: 16 },
      { t: 'OF EMPLOYMENT', bold: true, size: 30, center: true, gap: 34 },
      { t: 'DAYS SINCE LOST-TIME', size: 19, center: true, gap: 8 },
      { t: 'INJURY:  212', bold: true, size: 46, center: true, gap: 30 },
      { t: 'WRIGHT COUNTY POWER & LIGHT', size: 14, center: true },
    ], { seed: 4 }),
    notice([
      { t: 'STORM PROCEDURE', bold: true, size: 26, gap: 18 },
      { t: '1. LOG EVERY CALL. NO EXCEPTIONS.', size: 17, mono: true },
      { t: '2. CONFIRM SERVICE ADDRESS AGAINST', size: 17, mono: true, gap: 2 },
      { t: '   THE ACCOUNT, NOT THE CALLER.', size: 17, mono: true },
      { t: '3. ONE CREW PER TICKET.', size: 17, mono: true },
      { t: '4. DO NOT PROMISE A RESTORE TIME.', size: 17, mono: true },
      { t: '5. IF THE LINE IS DOWN, IT IS LIVE.', size: 17, mono: true, gap: 24 },
      { t: 'POSTED 09/14/98 - R. KEEFE, SUPV', size: 14, mono: true },
    ], { seed: 7, rule: true }),
    notice([
      { t: 'OVERNIGHT ROSTER', bold: true, size: 24, gap: 18 },
      { t: 'DISPATCH .......... 1 (YOU)', size: 17, mono: true },
      { t: 'TROUBLE 7 ......... HALLORAN', size: 17, mono: true },
      { t: 'TROUBLE 12 ........ SIKES / DAY', size: 17, mono: true },
      { t: 'LINE 3 ............ ON CALL', size: 17, mono: true, gap: 22 },
      { t: 'SUPV REACHABLE AT HOME', size: 15, mono: true },
      { t: 'AFTER 0100 ONLY IF FATAL', size: 15, mono: true },
    ], { seed: 9 }),
  ];
  const cork = box(2.9, 1.15, 0.028, mats.get('corkboard'), { pos: [0, 0, 0] });
  const corkGroup = new THREE.Group();
  corkGroup.add(cork);
  notices.forEach((n, i) => {
    const sheet = wallNotice(n, 0.60, 0.78);
    sheet.position.set(-0.98 + i * 0.98, 0.0, 0.02);
    sheet.rotation.z = (i - 1) * 0.02;
    corkGroup.add(sheet);
  });
  corkGroup.position.set(5.6, 1.62, 7.9);
  corkGroup.rotation.y = Math.PI;
  root.add(corkGroup);
  usable(interactables, corkGroup, { id: 'corkboard', label: 'NOTICE BOARD', verb: 'Read', range: 2.0 });

  // --- electrical trim: conduit, plates, thermostat ---
  const conduit = conduitRun(mats, 8.4, { box: true });
  conduit.position.set(5.0, CEIL - 0.16, 0.14);
  root.add(conduit);
  const therm = wallPlate(mats, 'thermostat');
  therm.position.set(0.07, 1.46, 4.2);
  therm.rotation.y = Math.PI / 2;
  root.add(therm);
  for (const [sx, sz, ry] of [[0.07, 6.9, Math.PI / 2], [9.93, 3.0, -Math.PI / 2]]) {
    const sw = wallPlate(mats, 'switch');
    sw.position.set(sx, 1.22, sz);
    sw.rotation.y = ry;
    root.add(sw);
  }
  for (const [ox, oz, ry] of [[3.0, 0.07, 0], [8.0, 7.93, Math.PI], [0.07, 2.2, Math.PI / 2]]) {
    const o = wallPlate(mats, 'outlet');
    o.position.set(ox, 0.34, oz);
    o.rotation.y = ry;
    root.add(o);
  }

  /* ============================================================
     CORRIDOR
     ============================================================ */
  const exitA = exitSignProp(mats);
  exitA.position.set(-0.9, CEIL_HALL - 0.28, 6.5);
  exitA.rotation.y = Math.PI / 2;
  root.add(exitA);

  const exitB = exitSignProp(mats);
  exitB.position.set(-6.6, CEIL_HALL - 0.28, 6.5);
  exitB.rotation.y = -Math.PI / 2;
  root.add(exitB);

  const clockB = wallClock(mats, { id: 'corridor' });
  clockB.position.set(-3.4, 2.16, 5.62);
  clockB.rotation.y = Math.PI;
  root.add(clockB);
  out.clocks.push(clockB);
  usable(interactables, clockB, { id: 'clock_corridor', label: 'WALL CLOCK', verb: 'Check', range: 2.6 });

  const hallConduit = conduitRun(mats, 6.4, { box: true });
  hallConduit.position.set(-3.5, CEIL_HALL - 0.14, 5.66);
  root.add(hallConduit);

  {
    const n = notice([
      { t: 'IN CASE OF FIRE', bold: true, size: 28, center: true, gap: 20 },
      { t: 'DO NOT USE ELEVATOR', size: 20, center: true, gap: 14 },
      { t: 'THIS BUILDING HAS NO ELEVATOR', size: 15, center: true, color: '#6a6152' },
    ], { seed: 15 });
    const s = wallNotice(n, 0.42, 0.54);
    s.position.set(-1.6, 1.62, 5.57);
    s.rotation.y = Math.PI;
    root.add(s);
  }

  /* ============================================================
     BREAK ROOM
     ============================================================ */
  const vend = vendingMachine(mats);
  vend.position.set(-2.7, 0, 10.5);
  vend.rotation.y = Math.PI;
  root.add(vend);
  solids.addObject(vend, 'vending');
  out.vending = vend;
  usable(interactables, vend, { id: 'vending', label: 'VENDING MACHINE', verb: 'Examine', range: 1.6 });

  {
    const t = new THREE.Group();
    t.add(box(1.3, 0.04, 0.78, mats.get('deskLaminate'), { pos: [0, 0.74, 0] }));
    t.add(cylinder(0.05, 0.05, 0.72, mats.get('greyMetal'), { pos: [0, 0.36, 0], seg: 10 }));
    t.add(cylinder(0.30, 0.32, 0.03, mats.get('greyMetal'), { pos: [0, 0.015, 0], seg: 16 }));
    t.position.set(-4.2, 0, 9.4);
    root.add(t);
    solids.addObject(t, 'table');
    for (const [cx, cz, ry] of [[-4.2, 8.6, 0], [-4.2, 10.2, Math.PI]]) {
      const c = new THREE.Group();
      c.add(box(0.42, 0.05, 0.42, mats.get('darkPlastic'), { pos: [0, 0.45, 0] }));
      c.add(box(0.42, 0.44, 0.05, mats.get('darkPlastic'), { pos: [0, 0.68, -0.19] }));
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        c.add(cylinder(0.016, 0.016, 0.45, mats.get('greyMetal'), { pos: [lx, 0.225, lz], seg: 8 }));
      }
      c.position.set(cx, 0, cz);
      c.rotation.y = ry;
      root.add(c);
    }
  }
  // counter with a sink
  {
    const c = new THREE.Group();
    c.add(box(2.0, 0.86, 0.60, mats.get('paintedSteel'), { pos: [0, 0.43, 0] }));
    c.add(box(2.04, 0.035, 0.64, mats.get('deskLaminate'), { pos: [0, 0.88, 0] }));
    c.add(box(0.44, 0.02, 0.36, mats.get('greyMetal'), { pos: [0.42, 0.878, 0] }));
    c.add(cylinder(0.014, 0.014, 0.26, mats.get('chrome'), { pos: [0.42, 1.01, -0.20], seg: 10 }));
    c.position.set(-4.0, 0, 7.85);
    root.add(c);
    solids.addObject(c, 'counter');
  }

  /* ============================================================
     RECORDS
     ============================================================ */
  for (let i = 0; i < 3; i++) {
    const s = shelfUnit(mats);
    s.position.set(-5.4, 0, 2.5 + i * 0.9);
    s.rotation.y = Math.PI / 2;
    root.add(s);
    solids.addObject(s, 'shelf');
  }
  for (let i = 0; i < 2; i++) {
    const fc = fileCabinet(mats, ['1978-1981', '1982-1986', '1987-1991', '1992-']);
    fc.position.set(-2.5, 0, 2.4 + i * 0.52);
    fc.rotation.y = -Math.PI / 2;
    root.add(fc);
    solids.addObject(fc, 'cabinet');
    if (i === 0) usable(interactables, fc, { id: 'files_records', label: 'OUTAGE HISTORY', verb: 'Open', range: 1.5 });
  }
  {
    const cb = cardboardBox(mats, { label: 'MICROFILM 1956-62', h: 0.30 });
    cb.position.set(-3.6, 0, 4.8);
    cb.rotation.y = -0.4;
    root.add(cb);
    usable(interactables, cb, { id: 'microfilm_box', label: 'MICROFILM CARTONS', verb: 'Examine', range: 1.4 });
  }

  return out;
}
