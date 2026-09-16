/* ============================================================
   haunt.js -- horror that is still there when you look again.

   horror.js does TRANSIENT horror: a flicker, a glitch, a grade
   distortion, a burst of interference. Those are events the
   player watches, and two seconds later there is no evidence
   they happened. They are worth keeping and they are not enough.

   This file does PERSISTENT, PHYSICAL horror. A chair that is
   facing the wrong way is facing the wrong way until the player
   walks over and turns it. A handset off its cradle stays off
   its cradle. A drawer the player closed is open. The room is
   the evidence, and the player cannot make it stop by waiting.

   FIVE RULES, all of them learned the hard way in other games:

   1. NOTHING HAPPENS IN FRONT OF THE PLAYER. A haunt arms while
      the player is elsewhere and is DISCOVERED. The scare is
      recognition, not motion.
   2. THE GAME NEVER POINTS AT IT. No toast, no objective line,
      no camera cut. `notice` sets a flag when the player has
      plausibly seen the thing, and that flag only exists so the
      paper log can offer them the entry.
   3. ONE AT A TIME, AND SPACED. `cooldown` is enforced globally.
      Two of these in a row is a funhouse.
   4. THE PLAYER CAN UNDO IT. Turning the chair back is the
      point: it makes them touch the thing, which is worse.
   5. IT SURVIVES A SAVE. Anything in here is serialised.

   ADDING ONE: add a key to HAUNTS. `arm(ctx)` mutates the world,
   `clear(ctx)` puts it back, `canArm(ctx)` says when it is
   allowed. Keep `arm` cheap; it runs at an arbitrary moment.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { bus, EVENTS } from '../engine/bus.js';

/** Where the player is, coarsely. Rooms come from the floor plan. */
export function roomAt(x, z) {
  if (x >= 0 && x <= 10 && z >= 0 && z <= 8) return 'dispatch';
  if (x >= -7 && x <= 0 && z >= 5.5 && z <= 7.5) return 'corridor';
  if (x >= -6 && x <= -2 && z >= 7.5 && z <= 11) return 'breakroom';
  if (x >= -6 && x <= -2 && z >= 1.8 && z <= 5.5) return 'records';
  return 'elsewhere';
}

const DESK_XZ = { x: 4.9, z: 1.75 };
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export const HAUNTS = {
  /* ---------------------------------------------------------- THE CHAIR */
  chair_turned: {
    label: 'the chair is facing the corridor',
    away: 'dispatch',                 // arm only while the player is NOT here
    notice: { at: DESK_XZ, within: 3.2, flag: 'saw_chair_moved' },
    arm(ctx) {
      const chair = ctx.dressing.chair;
      if (!chair) return false;
      ctx._chairYaw = chair.rotation.y;
      // Turned out from the desk, toward the door to the corridor. Not
      // spun theatrically: turned, the way somebody stands up and leaves.
      chair.rotation.y = ctx._chairYaw + 2.35;
      chair.position.x -= 0.18;
      return true;
    },
    clear(ctx) {
      const chair = ctx.dressing.chair;
      if (!chair || ctx._chairYaw == null) return;
      chair.rotation.y = ctx._chairYaw;
      chair.position.x += 0.18;
    },
  },

  /* ------------------------------------------------------- THE HANDSET */
  handset_off: {
    label: 'the desk handset is off the hook',
    away: 'dispatch',
    notice: { at: DESK_XZ, within: 2.6, flag: 'saw_handset_off' },
    arm(ctx) {
      const phone = ctx.dressing.phone;
      const rest = phone && phone.getObjectByName('handset');
      if (!rest) return false;
      ctx._handset = { pos: rest.position.clone(), rot: rest.rotation.clone() };
      rest.position.x += 0.19;
      rest.position.y -= 0.035;
      rest.rotation.z = 0.22;
      // A line left open makes a sound, and the sound is what the player
      // hears before they work out what they are looking at.
      if (ctx.audio) ctx.audio.loop('offHook', { volume: 0.22 });
      return true;
    },
    clear(ctx) {
      const phone = ctx.dressing.phone;
      const rest = phone && phone.getObjectByName('handset');
      if (rest && ctx._handset) {
        rest.position.copy(ctx._handset.pos);
        rest.rotation.copy(ctx._handset.rot);
      }
      if (ctx.audio) ctx.audio.stopLoop('offHook', 0.4);
    },
  },

  /* -------------------------------------------------------- THE DRAWER */
  drawer_open: {
    label: 'a records drawer is open',
    away: 'records',
    notice: { at: { x: -5.2, z: 3.4 }, within: 3.0, flag: 'saw_drawer_open' },
    arm(ctx) {
      const d = ctx.dressing.recordsDrawer;
      if (!d) return false;
      ctx._drawer = d.position.z;
      d.position.z += 0.42;
      return true;
    },
    clear(ctx) {
      const d = ctx.dressing.recordsDrawer;
      if (d && ctx._drawer != null) d.position.z = ctx._drawer;
    },
  },

  /* ------------------------------------------------------ THE DESK WAS USED */
  desk_used: {
    label: 'the terminal is on a screen you did not leave it on',
    away: 'dispatch',
    notice: { at: DESK_XZ, within: 2.4, flag: 'saw_phantom_ticket' },
    arm(ctx) {
      if (!ctx.terminal || !ctx.outages) return false;
      // A ticket, written up properly, on a circuit that is not on the map.
      const t = ctx.outages.create({
        feeder: 'BR-01',
        address: 'BLACKRIDGE RD',
        town: 'BLACKRIDGE',
        cause: 'UNKNOWN',
        customers: 0,
        reportedBy: 'DISPATCH',
        stamp: ctx.clock.stamp(),
      });
      ctx._ticket = t && t.id;
      ctx.terminal.go('OUTG');
      ctx.terminal.ticket = t;
      ctx.terminal.dirty = true;
      if (ctx.world) ctx.world.ghostFeeders = [...(ctx.world.ghostFeeders || []), 'BR-01'];
      return true;
    },
    clear() { /* the ticket stays. that is the whole point of it. */ },
  },

  /* --------------------------------------------------- THE CRT REFLECTION */
  crt_figure: {
    label: 'there is somebody standing behind you, in the glass',
    once: true,
    requires: (ctx) => ctx.player.seated && !ctx.power.live('terminal'),
    notice: { at: DESK_XZ, within: 2.0, flag: 'saw_crt_figure', after: 1.2 },
    arm(ctx) {
      const crt = ctx.dressing.crt;
      const screen = (crt && (crt.userData.screenMesh || crt.getObjectByName('crt-screen')));
      if (!screen) return false;
      /* Drawn INTO the dark screen rather than placed in the room: it is a
         reflection, so it has to live in the glass. A shape, badly lit, at
         the distance the door is. Nothing more. */
      const geo = new THREE.PlaneGeometry(0.21, 0.30);
      const tex = figureTexture();
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const fig = new THREE.Mesh(geo, mat);
      fig.name = 'crt_reflection';
      fig.position.set(0, 0.02, 0.012);
      screen.add(fig);
      ctx._fig = fig;
      ctx._figT = 0;
      return true;
    },
    update(ctx, dt) {
      if (!ctx._fig) return;
      ctx._figT += dt;
      // Fade up over a second and a half, hold, and be gone before anybody
      // can get a good look at it.
      const t = ctx._figT;
      const o = t < 1.5 ? (t / 1.5) * 0.5 : t < 4.5 ? 0.5 : Math.max(0, 0.5 - (t - 4.5) * 1.2);
      ctx._fig.material.opacity = o;
      if (t > 5.2) return false;
      return true;
    },
    clear(ctx) {
      if (ctx._fig && ctx._fig.parent) ctx._fig.parent.remove(ctx._fig);
      ctx._fig = null;
    },
  },

  /* ------------------------------------------------- THE CORRIDOR LIGHTS */
  lights_behind: {
    label: 'the fixtures behind you are going out',
    requires: (ctx) => roomAt(ctx.player.pos.x, ctx.player.pos.z) === 'corridor',
    arm(ctx) {
      ctx._killed = [];
      ctx._lightT = 0;
      return true;
    },
    update(ctx, dt) {
      ctx._lightT += dt;
      if (ctx._lightT < 0.9) return true;
      ctx._lightT = 0;
      /* Behind, never ahead. Switching off the lights in front of the player
         is a haunted house; switching off the ones they have already walked
         under is a building losing interest in them. */
      const px = ctx.player.pos.x;
      const back = ctx.lighting.fixtures
        .filter((f) => f.position.z > 5.0 && f.position.z < 8.0)
        .filter((f) => f.position.x > px + 0.6)
        .filter((f) => !ctx._killed.includes(f));
      const next = back.sort((a, b) => a.position.x - b.position.x)[0];
      if (!next) return ctx._killed.length < 4;
      if (ctx.lighting.killFixture) ctx.lighting.killFixture(next);
      ctx._killed.push(next);
      if (ctx.audio) ctx.audio.play('ballastPop', { volume: 0.4 });
      return true;
    },
    clear(ctx) {
      for (const f of ctx._killed || []) {
        if (ctx.lighting.reviveFixture) ctx.lighting.reviveFixture(f);
      }
      ctx._killed = [];
    },
  },

  /* ------------------------------------------------- THE ROOM, EARLIER */
  records_1978: {
    label: 'Records is not the Records you left',
    once: true,
    away: 'records',
    notice: { at: { x: -4.0, z: 3.6 }, within: 4.0, flag: 'saw_records_1978', after: 0.8 },
    arm(ctx) {
      if (!ctx.dressing.recordsEra) return false;
      ctx.dressing.recordsEra(1978);
      ctx._eraT = 0;
      if (ctx.audio) ctx.audio.play('roomShift', { volume: 0.4 });
      return true;
    },
    update(ctx, dt) {
      ctx._eraT += dt;
      // It holds for as long as the player stands in it, up to a point, and
      // goes back the moment they are not looking.
      if (ctx._eraT > 26) return false;
      const here = roomAt(ctx.player.pos.x, ctx.player.pos.z) === 'records';
      if (!here && ctx._eraT > 3) return false;
      return true;
    },
    clear(ctx) {
      if (ctx.dressing.recordsEra) ctx.dressing.recordsEra(1999);
    },
  },

  /* ------------------------------------------------ THE TRUCK IN THE LOT */
  exterior_truck: {
    label: 'there is a line truck in the lot that is not ours',
    once: true,
    requires: (ctx) => roomAt(ctx.player.pos.x, ctx.player.pos.z) === 'dispatch',
    notice: { at: { x: 8.4, z: 4.0 }, within: 4.0, flag: 'saw_old_truck', after: 0.6 },
    arm(ctx) {
      if (!ctx.dressing.oldTruck) return false;
      ctx.dressing.oldTruck.visible = true;
      ctx._truckT = 0;
      if (ctx.horror) ctx.horror.fire('strike', { hard: true });
      return true;
    },
    update(ctx, dt) {
      ctx._truckT += dt;
      // Two lightning flashes. It is there for the first and gone by the
      // second, which is the only way the player is ever sure they saw it.
      if (ctx._truckT > 7.5) return false;
      if (ctx._truckT > 6.4 && ctx.dressing.oldTruck.visible) {
        ctx.dressing.oldTruck.visible = false;
        if (ctx.horror) ctx.horror.fire('strike', { hard: true });
      }
      return true;
    },
    clear(ctx) { if (ctx.dressing.oldTruck) ctx.dressing.oldTruck.visible = false; },
  },

  /* ------------------------------------------------------- THE CLOCKS */
  clocks_apart: {
    label: 'the two clocks do not agree, and stay that way',
    arm(ctx) {
      ctx.world.clockOffset = -(4 + Math.floor(Math.random() * 5));
      ctx.state.set('clocks_apart', true);
      return true;
    },
    clear(ctx) { ctx.world.clockOffset = 0; },
  },

  /* ---------------------------------------------- THE ROOM YOU JUST LEFT */
  records_extension: {
    label: 'the Records extension is calling the desk',
    requires: (ctx) => roomAt(ctx.player.pos.x, ctx.player.pos.z) !== 'records'
      && ctx.state.has('been_to_records'),
    arm(ctx) {
      if (!ctx.phones) return false;
      ctx.phones.ring('dispatch', { display: 'INTERNAL — x2214 RECORDS', seconds: 18 });
      ctx.state.set('records_called', true);
      return true;
    },
    clear() {},
  },

  /* ----------------------------------------------------- THE DOOR AGAIN */
  door_ajar: {
    label: 'a door you closed is open',
    away: 'records',
    notice: { at: { x: -1.6, z: 5.5 }, within: 3.4, flag: 'saw_door_ajar' },
    arm(ctx) {
      const door = ctx.doors && ctx.doors.get('records');
      if (!door || door.open) return false;
      ctx.doors.set('records', true, { silent: true });
      return true;
    },
    clear() {},
  },
};

/** A smudge of a person, for the CRT glass. Generated, like everything else. */
function figureTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 96);
  const grad = g.createRadialGradient(32, 40, 2, 32, 48, 42);
  grad.addColorStop(0, 'rgba(150,170,190,0.55)');
  grad.addColorStop(0.55, 'rgba(90,105,125,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  // head
  g.beginPath(); g.ellipse(32, 26, 9, 11, 0, 0, Math.PI * 2); g.fill();
  // shoulders and body, narrow -- a person standing in a doorway, not a
  // monster silhouette. The ambiguity does the work.
  g.beginPath();
  g.moveTo(16, 96); g.lineTo(20, 44); g.quadraticCurveTo(32, 34, 44, 44);
  g.lineTo(48, 96); g.closePath(); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class HauntDirector {
  constructor(systems) {
    this.sys = systems;        // dressing, lighting, player, audio, state, clock,
                               // terminal, outages, world, doors, phones, power, horror
    this.active = new Map();   // name -> instance
    this.done = new Set();
    this.cooldown = 0;
    /** Minimum real seconds between two of these, ever. */
    this.spacing = 95;
  }

  /** Can this one be armed right now? */
  canArm(name) {
    const def = HAUNTS[name];
    if (!def) return false;
    if (this.active.has(name)) return false;
    if (def.once && this.done.has(name)) return false;
    const ctx = this._ctx(name);
    if (def.away && roomAt(this.sys.player.pos.x, this.sys.player.pos.z) === def.away) return false;
    if (def.requires && !def.requires(ctx)) return false;
    return true;
  }

  /**
   * Arm one. `force` skips the global spacing, for scripted moments where
   * the timing is the author's rather than the director's.
   */
  arm(name, { force = false } = {}) {
    if (!force && this.cooldown > 0) return false;
    if (!this.canArm(name)) return false;
    const def = HAUNTS[name];
    const ctx = this._ctx(name);
    let ok = false;
    try { ok = def.arm(ctx) !== false; } catch (err) { console.error(`haunt "${name}":`, err); }
    if (!ok) return false;
    this.active.set(name, { name, def, ctx, t: 0, noticedFor: 0 });
    this.done.add(name);
    this.cooldown = this.spacing;
    this.sys.state.set(`haunt:${name}`, true);
    bus.emit(EVENTS.HAUNT, { name, label: def.label });
    return true;
  }

  /** The player has dealt with it: the chair is turned back, the drawer shut. */
  clear(name) {
    const inst = this.active.get(name);
    if (!inst) return false;
    try { inst.def.clear && inst.def.clear(inst.ctx); } catch (err) { console.error(err); }
    this.active.delete(name);
    bus.emit(EVENTS.HAUNT, { name, cleared: true });
    return true;
  }

  clearAll() { for (const name of [...this.active.keys()]) this.clear(name); }

  isActive(name) { return this.active.has(name); }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (const inst of [...this.active.values()]) {
      inst.t += dt;
      if (inst.def.update) {
        let keep = true;
        try { keep = inst.def.update(inst.ctx, dt) !== false; } catch (err) { console.error(err); keep = false; }
        if (!keep) { this.clear(inst.name); continue; }
      }
      this._notice(inst, dt);
    }
  }

  /**
   * Has the player plausibly SEEN this?
   *
   * Deliberately generous and deliberately silent: near enough, facing
   * roughly the right way, for long enough. It sets one flag, which does
   * nothing except let the paper log offer the entry. The game never says
   * "you notice the chair has moved" -- that would be the game doing the
   * player's job for them.
   */
  _notice(inst, dt) {
    const n = inst.def.notice;
    if (!n || inst.ctx.state.has(n.flag)) return;
    const p = this.sys.player;
    const d2 = dist2(p.pos, n.at);
    if (d2 > (n.within || 3) ** 2) { inst.noticedFor = 0; return; }
    // Facing: the dot of the player's forward against the direction to it.
    const dx = n.at.x - p.pos.x, dz = n.at.z - p.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const f = p.forward;
    const facing = (f.x * dx + f.z * dz) / len;
    if (facing < 0.35) { inst.noticedFor = 0; return; }
    inst.noticedFor += dt;
    if (inst.noticedFor < (n.after ?? 0.35)) return;
    inst.ctx.state.set(n.flag, true);
    bus.emit(EVENTS.HAUNT, { name: inst.name, noticed: true });
  }

  _ctx(name) {
    const inst = this.active.get(name);
    if (inst) return inst.ctx;
    return { ...this.sys, name };
  }

  serialize() {
    return { active: [...this.active.keys()], done: [...this.done] };
  }
  restore(d) {
    if (!d) return;
    this.done = new Set(d.done || []);
    // Re-arm anything that was still standing when the game was saved, so a
    // reload does not tidy the room up.
    for (const name of d.active || []) this.arm(name, { force: true });
  }
}
