/* ============================================================
   gear.js -- the objects the night is actually played on.

   props.js is dressing: mugs, boxes, a water cooler. Nobody has
   to find those. Everything in THIS file is a gameplay object --
   the fax, the breaker panel, the backup radio set, the paper
   log, the card index, the telephones in other rooms -- and the
   rule for all of them is the same:

     IT HAS TO READ FROM THE DOORWAY.

   A player being sent down a dark corridor to reset a breaker
   must be able to tell, from the end of the corridor and by the
   emergency lights alone, which grey box on the wall is the one
   they want. So these get stronger silhouettes, bolder colour
   breaks and more geometry than the clutter around them. That is
   not inconsistency: in a real operations centre the equipment
   IS the thing that stands out, because somebody chose it to be
   findable at three in the morning.

   Still 1999, still no intentional degradation, still no
   texture that is not generated.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { box } from './geo.js';
import { labelTexture } from './signage.js';

/* ============================================================
   THE FAX
   A late-90s plain-paper machine: a wedge, a paper tray sticking
   up at the back, an output slot at the front, a keypad, and one
   green LED that is the only thing in the room that will be lit
   when it decides to print at 04:40.
   ============================================================ */
export function faxMachine(mats) {
  const g = new THREE.Group();
  g.name = 'fax';

  const body = box(0.42, 0.13, 0.34, mats.get('beigePlastic'));
  body.position.y = 0.065;
  g.add(body);

  // the sloped control deck
  const deck = box(0.42, 0.06, 0.16, mats.get('beigePlastic'));
  deck.position.set(0, 0.155, 0.07);
  deck.rotation.x = -0.28;
  g.add(deck);

  // keypad: a 3x4 block of very small keys, which is most of the silhouette
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const k = box(0.022, 0.008, 0.018, mats.get('darkPlastic'), { tessellate: false, shadow: 'cast' });
      k.position.set(-0.13 + c * 0.028, 0.188 - r * 0.004, 0.115 - r * 0.026);
      k.rotation.x = -0.28;
      g.add(k);
    }
  }

  // paper cassette at the back, tilted up
  const tray = box(0.34, 0.012, 0.22, mats.get('greyMetal'), { shadow: 'cast' });
  tray.position.set(0, 0.22, -0.14);
  tray.rotation.x = 0.62;
  g.add(tray);
  const stack = box(0.30, 0.02, 0.19, mats.get('paper'), { shadow: 'cast' });
  stack.position.set(0, 0.235, -0.135);
  stack.rotation.x = 0.62;
  g.add(stack);

  // output slot, and the page that will be lying in it
  const page = box(0.28, 0.004, 0.20, mats.get('paper'), { shadow: 'cast' });
  page.position.set(0, 0.135, 0.20);
  page.rotation.x = -0.06;
  page.visible = false;
  page.name = 'faxPage';
  g.add(page);

  // the LED. Small, green, and the only thing that changes.
  const led = new THREE.Mesh(
    new THREE.CircleGeometry(0.006, 10),
    new THREE.MeshBasicMaterial({ color: 0x2f6b32 }),
  );
  led.name = 'faxLed';
  led.position.set(0.16, 0.176, 0.128);
  led.rotation.x = -0.28 - Math.PI / 2 + Math.PI / 2;
  led.rotation.x = -1.85;
  g.add(led);

  const handset = box(0.055, 0.04, 0.20, mats.get('beigePlastic'), { shadow: 'cast' });
  handset.position.set(-0.20, 0.155, 0.02);
  g.add(handset);

  return g;
}

/** Called by the fax system: the page in the tray, and the LED. */
export function setFaxState(faxGroup, { page = false, printing = false } = {}) {
  if (!faxGroup) return;
  const p = faxGroup.getObjectByName('faxPage');
  if (p) p.visible = !!page;
  const led = faxGroup.getObjectByName('faxLed');
  if (led) {
    led.material.color.setHex(printing ? 0xff4a2a : page ? 0x63ff7a : 0x2f6b32);
  }
}

/* ============================================================
   THE BREAKER PANEL
   A surface-mounted load centre: grey door, hinge, the schedule
   card behind a little window, and inside, two columns of
   breaker handles. A tripped handle sits in the middle. The
   player has to be able to see WHICH from across the corridor,
   so tripped handles are visibly out of line and get a red face.
   ============================================================ */
export function breakerPanel(mats, circuits) {
  const g = new THREE.Group();
  g.name = 'breakerPanel';

  const backbox = box(0.40, 0.62, 0.11, mats.get('paintedSteel'));
  g.add(backbox);

  const inner = box(0.34, 0.54, 0.02, mats.get('greyMetal'), { shadow: 'receive' });
  inner.position.z = 0.05;
  g.add(inner);

  // the bus bar down the middle
  const bus = box(0.05, 0.50, 0.012, mats.get('greyMetal'), { tessellate: false });
  bus.position.set(0, 0, 0.062);
  g.add(bus);

  const handles = new THREE.Group();
  handles.name = 'handles';
  circuits.forEach((c, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const h = new THREE.Group();
    h.name = `breaker:${c.id}`;
    const base = box(0.11, 0.055, 0.03, mats.get('darkPlastic'), { tessellate: false });
    h.add(base);
    const lever = box(0.035, 0.035, 0.022, mats.get('beigePlastic'), { tessellate: false });
    lever.name = 'lever';
    lever.position.set(side * -0.028, 0, 0.022);
    h.add(lever);
    h.position.set(side * 0.085, 0.19 - row * 0.085, 0.072);
    handles.add(h);
  });
  g.add(handles);

  // the schedule card -- typed, taped on, yellowing
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.20),
    new THREE.MeshStandardMaterial({
      map: labelTexture(circuits.map((c, i) => `${i + 1}  ${c.label}`), { title: 'PANEL A' }),
      roughness: 0.95,
    }),
  );
  card.position.set(0, -0.16, 0.063);
  g.add(card);

  // the door, hinged on the left, standing open. It was opened in a hurry.
  const doorPivot = new THREE.Group();
  doorPivot.name = 'panelDoor';
  const door = box(0.40, 0.62, 0.018, mats.get('paintedSteel'));
  door.position.x = 0.20;
  doorPivot.add(door);
  doorPivot.position.set(-0.20, 0, 0.055);
  doorPivot.rotation.y = -1.9;
  g.add(doorPivot);

  return g;
}

/** Push breaker positions into the panel. Tripped = handle centred, red. */
export function setBreakerState(panel, power) {
  if (!panel || !power) return;
  for (const [id, live] of power.on.entries()) {
    const h = panel.getObjectByName(`breaker:${id}`);
    if (!h) continue;
    const lever = h.getObjectByName('lever');
    if (!lever) continue;
    const side = h.position.x < 0 ? -1 : 1;
    lever.position.x = live ? side * -0.028 : 0;
    if (!lever.material._phOriginal) {
      lever.material = lever.material.clone();
      lever.material._phOriginal = true;
    }
    lever.material.color.setHex(live ? 0xd9d2c4 : 0xc0392b);
  }
}

/* ============================================================
   THE BACKUP BASE STATION
   The set on the shelf by the panel: a boxy transceiver with a
   big knob, a meter, and a fist mic on a hook. It is older than
   the desk set and it is the one that still works.
   ============================================================ */
export function baseStation(mats) {
  const g = new THREE.Group();
  g.name = 'baseStation';

  const body = box(0.34, 0.16, 0.26, mats.get('paintedSteel'));
  body.position.y = 0.08;
  g.add(body);

  const face = box(0.33, 0.14, 0.01, mats.get('darkPlastic'), { tessellate: false });
  face.position.set(0, 0.08, 0.131);
  g.add(face);

  // VU meter -- the thing that catches the light
  const meter = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xcfd6c8, roughness: 0.4, emissive: 0x1a2416 }),
  );
  meter.name = 'meter';
  meter.position.set(-0.08, 0.10, 0.137);
  g.add(meter);

  for (const [x, r] of [[0.06, 0.028], [0.13, 0.019]]) {
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.022, 14),
      mats.get('darkPlastic'),
    );
    knob.rotation.x = Math.PI / 2;
    knob.position.set(x, 0.07, 0.14);
    knob.castShadow = true;
    g.add(knob);
  }

  const mic = box(0.05, 0.05, 0.11, mats.get('darkPlastic'), { shadow: 'cast' });
  mic.name = 'mic';
  mic.position.set(0.20, 0.12, 0.02);
  mic.rotation.z = 0.25;
  g.add(mic);

  return g;
}

/* ============================================================
   THE PAPER LOG
   A hardbound day book on a counter, open, with a pen. The point
   is that it is OBVIOUSLY a book and obviously open: the player
   should recognise it as the thing the supervisor meant.
   ============================================================ */
export function logBook(mats) {
  const g = new THREE.Group();
  g.name = 'logBook';

  const cover = box(0.34, 0.025, 0.26, mats.get('woodTrim'));
  cover.position.y = 0.012;
  g.add(cover);

  const leftPage = box(0.16, 0.012, 0.24, mats.get('paper'), { shadow: 'receive' });
  leftPage.position.set(-0.085, 0.031, 0);
  leftPage.rotation.z = 0.02;
  g.add(leftPage);
  const rightPage = box(0.16, 0.012, 0.24, mats.get('paper'), { shadow: 'receive' });
  rightPage.position.set(0.085, 0.031, 0);
  rightPage.rotation.z = -0.02;
  g.add(rightPage);

  const written = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.23),
    new THREE.MeshStandardMaterial({ map: labelTexture([], { hand: true }), roughness: 1, transparent: true }),
  );
  written.name = 'logPage';
  written.rotation.x = -Math.PI / 2;
  written.position.set(-0.085, 0.038, 0);
  g.add(written);

  const pen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.13, 8),
    mats.get('darkPlastic'),
  );
  pen.rotation.set(Math.PI / 2, 0, 0.5);
  pen.position.set(0.10, 0.04, 0.04);
  pen.castShadow = true;
  g.add(pen);

  return g;
}

/** Re-draw the open page from the log's entries. */
export function setLogPage(bookGroup, entries) {
  const page = bookGroup && bookGroup.getObjectByName('logPage');
  if (!page) return;
  const lines = entries.slice(-9).map((e) => (
    e.hand === 'other' ? e.text : `${e.stamp}  ${e.text}`
  ));
  const hands = entries.slice(-9).map((e) => e.hand);
  if (page.material.map) page.material.map.dispose();
  page.material.map = labelTexture(lines, { hand: true, hands });
  page.material.needsUpdate = true;
}

/* ============================================================
   THE CARD INDEX
   A wooden library-card drawer unit on the Records counter. This
   is the machine the player uses to prove somebody existed in
   1943, so it gets a real silhouette and real drawer fronts.
   ============================================================ */
export function cardIndex(mats) {
  const g = new THREE.Group();
  g.name = 'cardIndex';

  const shell = box(0.52, 0.30, 0.38, mats.get('woodTrim'));
  shell.position.y = 0.15;
  g.add(shell);

  const labels = ['A-E', 'F-K', 'L-R', 'S-Z', '1940-59', '1960-83'];
  labels.forEach((text, i) => {
    const col = i % 2, rowN = Math.floor(i / 2);
    const drawer = new THREE.Group();
    drawer.name = `cardDrawer:${i}`;
    const front = box(0.24, 0.085, 0.02, mats.get('woodTrim'), { tessellate: false });
    drawer.add(front);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.10, 0.03),
      new THREE.MeshStandardMaterial({ map: labelTexture([text], { small: true }), roughness: 0.9 }),
    );
    plate.position.z = 0.012;
    drawer.add(plate);
    const pull = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 12), mats.get('brass'));
    pull.position.set(0.07, -0.02, 0.014);
    drawer.add(pull);
    drawer.position.set(-0.13 + col * 0.26, 0.255 - rowN * 0.092, 0.19);
    g.add(drawer);
  });

  return g;
}

/* ============================================================
   THE OLD LINE TRUCK
   Seen once, through a window, in a lightning flash, in a lot it
   has no business being in. Deliberately coarse -- it is a
   silhouette at thirty metres in the rain, and anything more
   detailed would invite a second look it cannot survive.
   ============================================================ */
export function oldLineTruck(mats) {
  const g = new THREE.Group();
  g.name = 'oldTruck';

  const cab = box(2.0, 1.5, 2.2, mats.get('paintedSteel'));
  cab.position.set(0, 1.35, 1.6);
  g.add(cab);
  const bed = box(2.1, 1.1, 3.6, mats.get('paintedSteel'));
  bed.position.set(0, 1.15, -1.1);
  g.add(bed);
  // the boom, stowed, which is the part that makes it a line truck
  const boom = box(0.28, 0.28, 4.2, mats.get('greyMetal'));
  boom.position.set(0, 2.0, -0.9);
  boom.rotation.x = -0.06;
  g.add(boom);
  for (const [x, z] of [[-0.95, 2.1], [0.95, 2.1], [-0.95, -1.9], [0.95, -1.9]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14), mats.get('darkPlastic'));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.55, z);
    g.add(w);
  }
  g.visible = false;
  return g;
}

/* ============================================================
   A LIGHT SWITCH
   One toggle on a plate. It needs to be findable by feel, which
   in a game means findable by the interaction prompt.
   ============================================================ */
export function lightSwitch(mats) {
  const g = new THREE.Group();
  const plate = box(0.075, 0.12, 0.008, mats.get('beigePlastic'), { tessellate: false });
  g.add(plate);
  const toggle = box(0.014, 0.03, 0.012, mats.get('beigePlastic'), { tessellate: false });
  toggle.name = 'toggle';
  toggle.position.set(0, 0.008, 0.008);
  toggle.rotation.x = -0.35;
  g.add(toggle);
  return g;
}

export function setSwitchState(sw, on) {
  const t = sw && sw.getObjectByName('toggle');
  if (t) t.rotation.x = on ? -0.35 : 0.35;
}
