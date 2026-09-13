/* ============================================================
   interaction.js -- looking at things and using them.

   A single raycast from the center of the screen against the
   objects dress.js marked `userData.interact`. Whatever is hit
   walks up its parents until it finds the marker, so a prop can
   be as many meshes as it likes and still be one thing the
   player can use.

   Range is per-interactable, and some are `seatedOnly` -- the
   terminal is not usable while standing across the room, because
   you have to be in the chair to read it.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { bus, EVENTS } from '../engine/bus.js';

export class InteractionSystem {
  constructor({ camera, player, interactables, audio }) {
    this.camera = camera;
    this.player = player;
    this.audio = audio;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3.2;
    this.list = interactables;
    this.meshes = [];
    this.rebuild();
    this.current = null;
    this.handlers = new Map();
    this.enabled = true;
  }

  /** Re-collect the mesh list. Call after adding interactables at runtime. */
  rebuild() {
    this.meshes = [];
    for (const obj of this.list) {
      obj.traverse((o) => { if (o.isMesh) { o.userData._interactRoot = obj; this.meshes.push(o); } });
    }
  }

  /** Register what happens when the player uses a thing. */
  on(id, fn) { this.handlers.set(id, fn); return this; }

  update() {
    if (!this.enabled) { this._set(null); return; }
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    let found = null;
    for (const h of hits) {
      const root = h.object.userData._interactRoot;
      if (!root) continue;
      const spec = root.userData.interact;
      if (!spec) continue;
      if (h.distance > (spec.range ?? 2.0)) continue;
      if (spec.seatedOnly && !this.player.seated) continue;
      if (spec.standingOnly && this.player.seated) continue;
      found = { root, spec, distance: h.distance };
      break;
    }
    this._set(found);
  }

  _set(found) {
    const changed = (found && found.spec.id) !== (this.current && this.current.spec.id);
    this.current = found;
    if (changed) {
      bus.emit('ui:prompt', found ? { label: found.spec.label, verb: found.spec.verb, id: found.spec.id } : null);
    }
  }

  /** The player pressed Use. */
  activate() {
    if (!this.current) return false;
    const { spec, root } = this.current;
    const fn = this.handlers.get(spec.id);
    if (!fn) return false;
    fn(root, spec);
    return true;
  }
}
