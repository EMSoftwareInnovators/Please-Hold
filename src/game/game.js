/* ============================================================
   game.js -- the orchestrator.

   This file OWNS NOTHING. It builds the systems, wires them to
   each other and to the presentation layer, routes input, and
   runs the frame. Every rule about how the game behaves lives in
   the system that owns it: the phone owns hold, the director owns
   what rings, the horror director owns what the building does.

   Keeping this file thin is the whole architectural bet. If a
   feature can only be added by editing game.js, it has probably
   been designed wrong.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';

import { Renderer } from '../engine/renderer.js';
import { PRESETS, PRESET_ORDER, guessPreset } from '../engine/quality.js';
import { MaterialLibrary } from '../engine/materials.js';
import { AudioEngine } from '../engine/audio.js';
import { Input, MODE } from '../engine/input.js';
import { bus, EVENTS } from '../engine/bus.js';

import { Office } from '../world/office.js';
import { Lighting } from '../world/lighting.js';
import { dressBuilding } from '../world/dress.js';
import { Rain, WetGlass, StormSky, buildExterior } from '../world/weather.js';
import { setClock } from '../world/props.js';
import { mergeStatics } from '../world/geo.js';
import { bakeStaticLight, setBakedPower } from '../world/bake.js';
import { SPAWN, DESK } from '../world/plan.js';

import { GameClock, SHIFT_START } from './clock.js';
import { GameState } from './state.js';
import { Settings } from './settings.js';
import { SaveSystem } from './save.js';
import { CustomerDatabase } from './database.js';
import { OutageRegistry } from './outages.js';
import { RadioSystem } from './radio.js';
import { CrewManager } from './crews.js';
import { Dispatcher } from './dispatch.js';
import { PhoneSystem } from './phone.js';
import { DialogueRunner } from './dialogue.js';
import { EffectResolver } from './effects.js';
import { CallLibrary, CallDirector } from './calls.js';
import { HorrorDirector } from './horror.js';
import { Player } from './player.js';
import { InteractionSystem } from './interaction.js';

import { Terminal, SCREENS } from '../ui/terminal.js';
import { HUD } from '../ui/hud.js';
import { CallUI } from '../ui/callui.js';
import { Menu } from '../ui/menu.js';

import { CALLS } from '../data/calls/index.js';

export const STATE = { BOOT: 'boot', TITLE: 'title', PLAYING: 'playing', PAUSED: 'paused', ENDED: 'ended' };

export class Game {
  constructor() {
    this.state = STATE.BOOT;
    this.clock = new GameClock({ start: SHIFT_START });
    this.gameState = new GameState();
    this.settings = new Settings();
    this.time = 0;
    this.terminalFocused = false;
    this.radioCall = null;
    this._last = 0;
    this._accum = 0;
  }

  /* ============================================================
     BOOT
     ============================================================ */
  async boot(onProgress = () => {}) {
    const canvas = document.getElementById('screen');

    // Pick a budget before anything is built. Every expensive decision below
    // reads from it; see src/engine/quality.js.
    if (!this.settings.get('quality')) this.settings.set('quality', guessPreset());
    this.qualityName = this.settings.get('quality');
    this.quality = PRESETS[this.qualityName] || PRESETS.medium;

    this.renderer = new Renderer(canvas, {
      ...this.quality,
      pixelRatio: this.settings.get('pixelRatio') ?? this.quality.pixelRatio,
    });
    this.renderer.adaptive = this.settings.get('adaptiveQuality') !== false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);

    onProgress(0.05, 'generating materials');
    this.mats = new MaterialLibrary(this.renderer.gl);
    await this.mats.warm((p, name) => onProgress(0.05 + p * 0.45, `baking ${name}`));

    onProgress(0.55, 'building the office');
    this.office = new Office(this.scene, this.mats).build();
    this.dressing = dressBuilding(this.scene, this.mats, this.office);
    this.world = { clockOffset: 0, ghostFeeders: [] };

    onProgress(0.70, 'putting the storm outside');
    buildExterior(this.scene, this.mats);
    this.sky = new StormSky(this.scene, this.quality.skyOctaves);
    this.rain = new Rain(this.scene, { x: 26, y: 0, z: 6, w: 64, h: 22, d: 64 }, this.quality.rainDrops);
    this.wetGlass = new WetGlass(this.quality.glassDetail).applyTo(this.scene);

    onProgress(0.80, 'turning the lights on');
    this.lighting = new Lighting(this.scene, this.mats, this.office, {
      poolSize: this.quality.lightPool,
      shadows: this.quality.shadows,
    }).build();
    this.lighting.reduceFlicker = this.settings.get('reduceFlicker');
    this.lighting.setFocus(DESK.seat.x, 2.6, DESK.seat.z);
    this.lighting.update(0, 0.016);

    // Collapse the static shell into one draw call per material. The office
    // is several hundred boxes that will never move; drawing them one at a
    // time costs a great deal and buys nothing.
    onProgress(0.84, 'merging static geometry');
    const merged = mergeStatics(this.scene);
    console.log(`static merge: ${merged.before} meshes -> ${merged.after}`);
    this.mergeStats = merged;

    onProgress(0.86, 'wiring the desk');
    this._buildSystems();

    // Every fixture in the building, evaluated once into vertex colors. This
    // is what lets the light pool stay small without the far half of the
    // office going black. See world/bake.js.
    onProgress(0.90, 'baking the ceiling lights');
    const baked = bakeStaticLight(this.scene, this.lighting.fixtures, this.office.solids.list);
    this.bakedMaterials = baked.materials;
    console.log(`static light bake: ${baked.meshes} meshes, ${baked.verts} verts, ${baked.ms}ms`);
    this.bakeStats = baked;

    onProgress(0.93, 'capturing reflections');
    this.renderer.captureEnvironment(this.scene, new THREE.Vector3(DESK.seat.x, 1.5, DESK.seat.z + 1.2), 128);

    onProgress(1.0, 'ready');
    this.state = STATE.TITLE;
    return this;
  }

  _buildSystems() {
    const canvas = this.renderer.canvas;

    /* ---- services ---- */
    this.audio = new AudioEngine(this.settings);
    this.database = new CustomerDatabase();
    this.outages = new OutageRegistry();
    this.radio = new RadioSystem({ audio: this.audio, clock: this.clock, state: this.gameState });
    this.crews = new CrewManager({ clock: this.clock, outages: this.outages, radio: this.radio });
    this.dispatcher = new Dispatcher({
      crews: this.crews, outages: this.outages, radio: this.radio,
      clock: this.clock, state: this.gameState,
    });

    /* ---- conversation ---- */
    this.runner = new DialogueRunner({
      state: this.gameState, clock: this.clock, outages: this.outages,
      crews: this.crews, database: this.database, audio: this.audio,
      effects: null,   // set just below; the resolver needs the runner
    });

    this.library = new CallLibrary();
    this.library.registerAll(CALLS);
    if (this.library.problems.length) {
      console.error(`${this.library.problems.length} call script problem(s):`, this.library.problems);
    }

    this.phone = new PhoneSystem({
      audio: this.audio, clock: this.clock, state: this.gameState,
      runner: this.runner, effects: null,
    });

    this.director = new CallDirector({
      library: this.library, phone: this.phone, state: this.gameState, clock: this.clock,
      outages: this.outages, crews: this.crews, database: this.database,
      onRadioCall: (call) => this._startRadioCall(call),
      isBusy: () => !!this.radioCall,
    });

    /* ---- terminal (needed by horror, so built before it) ---- */
    this.terminal = new Terminal({
      database: this.database, outages: this.outages, crews: this.crews,
      dispatcher: this.dispatcher, clock: this.clock, state: this.gameState,
      audio: this.audio, world: this.world,
    });

    this.horror = new HorrorDirector({
      lighting: this.lighting, post: this.renderer.post, audio: this.audio,
      clock: this.clock, state: this.gameState, phone: this.phone, radio: this.radio,
      database: this.database, outages: this.outages, terminal: this.terminal,
      world: this.world,
    });

    /* ---- the effect resolver closes the loop ---- */
    this.effects = new EffectResolver({
      state: this.gameState, clock: this.clock, outages: this.outages,
      crews: this.crews, database: this.database, director: this.director,
      radio: this.radio, audio: this.audio, horror: this.horror, phone: this.phone,
    });
    this.runner.deps.effects = this.effects;
    this.phone.effects = this.effects;

    /* ---- player ---- */
    this.player = new Player({
      camera: this.renderer.camera, solids: this.office.solids.list,
      settings: this.settings, audio: this.audio, spawn: SPAWN,
    });
    this.interaction = new InteractionSystem({
      camera: this.renderer.camera, player: this.player,
      interactables: this.dressing.interactables, audio: this.audio,
    });
    this._wireInteractions();

    /* ---- presentation ---- */
    this.input = new Input(canvas);
    this.hud = new HUD({ clock: this.clock, settings: this.settings });
    this.callUI = new CallUI({
      runner: this.runner, audio: this.audio, settings: this.settings, phone: this.phone,
    });
    this.save = new SaveSystem(this);
    this.menu = new Menu({
      settings: this.settings, save: this.save,
      actions: {
        start: () => this.startShift(),
        continue: () => this.startShift({ load: true }),
        resume: () => this.resume(),
        applySettings: () => this.applySettings(),
      },
    });

    /* ---- the CRT's screen texture ---- */
    const crt = this.dressing.crt;
    const tex = new THREE.CanvasTexture(this.terminal.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    crt.userData.screenMaterial.map = tex;
    crt.userData.screenMaterial.emissiveMap = tex;
    crt.userData.screenMaterial.emissiveIntensity = 0.78;
    crt.userData.screenMaterial.needsUpdate = true;
    this._screenTexture = tex;
    this.crtDisplay = document.getElementById('crt-canvas');
    this.crtCtx = this.crtDisplay.getContext('2d');

    this._wireEvents();
    this._wireKeys();
  }

  /* ============================================================
     WIRING
     ============================================================ */
  _wireInteractions() {
    const I = this.interaction;
    const S = this.gameState;

    I.on('seat', () => {
      this.player.sit({ x: DESK.seat.x, z: DESK.seat.z, yaw: DESK.seat.yaw, eye: DESK.seatEye });
      S.set('sat_down', true);
      this.hud.setObjective('');
    });

    I.on('terminal', () => this.focusTerminal(true));

    I.on('phone', () => {
      if (this.phone.anyRinging) this.answer();
      else if (this.phone.held.length) this.phone.resume(this.phone.held[0].index);
      else bus.emit(EVENTS.TOAST, { text: 'DIAL TONE' });
    });

    I.on('radio', () => {
      const n = this.radio.setChannel(this.radio.channel % 3 + 1);
      bus.emit(EVENTS.TOAST, { text: `RADIO CHANNEL ${n}` });
    });

    I.on('mapboard', () => {
      S.set('examined_map_board', true);
      bus.emit(EVENTS.TOAST, { text: 'SERVICE AREA MAP — SHEET 1 OF 3, REV 11/97' });
    });

    I.on('corkboard', () => {
      S.set('read_notice_board', true);
      this.menu.panel('notice', `
        <h2>NOTICE BOARD</h2>
        <h3>STORM PROCEDURE</h3>
        <p>1. Log every call. No exceptions.<br>
           2. Confirm service address against the account, not the caller.<br>
           3. One crew per ticket.<br>
           4. Do not promise a restore time.<br>
           5. If the line is down, it is live.</p>
        <p style="color:#8a7a5e">Posted 09/14/98 &mdash; R. KEEFE, SUPV</p>
        <h3>OVERNIGHT ROSTER</h3>
        <p>DISPATCH &mdash; 1 (you)<br>
           TROUBLE 7 &mdash; HALLORAN<br>
           TROUBLE 12 &mdash; SIKES / DAY<br>
           LINE 3 &mdash; ON CALL</p>
        <h3>SAFETY</h3>
        <p>Days since lost-time injury: <b>212</b></p>
      `);
      this.setMode('ui');
    });

    I.on('clock_dispatch', () => {
      bus.emit(EVENTS.TOAST, { text: `WALL CLOCK READS ${this.clock.label(this.clock.displayMinutes)}` });
      S.set('checked_clock_dispatch', true);
    });
    I.on('clock_corridor', () => {
      const t = this.clock.displayMinutes + (this.world.clockOffset || 0);
      bus.emit(EVENTS.TOAST, { text: `CORRIDOR CLOCK READS ${this.clock.label(t)}` });
      S.set('checked_clock_corridor', true);
      if (this.world.clockOffset) S.set('noticed_clocks_disagree', true);
    });

    I.on('logbook', () => {
      const log = this.gameState.shiftLog.slice(-24);
      this.menu.panel('log', `<h2>SHIFT LOG</h2>`
        + (log.length
          ? `<p style="line-height:1.8">${log.map((e) => `<b>${e.stamp || '----'}</b> &nbsp; ${escapeText(e.text)}`).join('<br>')}</p>`
          : `<p>Nothing logged yet. The shift has just started.</p>`));
      this.setMode('ui');
    });

    I.on('coffee', () => bus.emit(EVENTS.TOAST, { text: 'THE POT HAS BEEN ON SINCE THE DAY SHIFT' }));
    I.on('vending', () => bus.emit(EVENTS.TOAST, { text: 'OUT OF ORDER SINCE AUGUST. THE LIGHT STILL WORKS.' }));
    I.on('files_dispatch', () => bus.emit(EVENTS.TOAST, { text: 'ACCOUNT FILES — EVERYTHING IN HERE IS ALSO ON THE TERMINAL' }));
    I.on('files_records', () => bus.emit(EVENTS.TOAST, { text: 'OUTAGE HISTORY 1978 — PRESENT' }));
    I.on('microfilm_box', () => {
      S.set('saw_microfilm', true);
      bus.emit(EVENTS.TOAST, { text: 'MICROFILM CARTONS — 1956 TO 1962. THE READER IS GONE.' });
    });
  }

  _wireEvents() {
    // A call ended: tell the phone (or close out the radio conversation).
    bus.on(EVENTS.DIALOGUE_END, ({ reason }) => {
      if (this.radioCall) {
        const call = this.radioCall;
        this.radioCall = null;
        this.audio.play('squelchClose', { volume: 0.5 });
        bus.emit(EVENTS.CALL_END, { call, reason, medium: 'radio' });
      } else {
        this.phone.callEnded(reason);
      }
      // Checkpoint at every story beat boundary.
      this.save.save(`beat ${this.gameState.beat}`);
      if (this.gameState.has('slice_complete')) this.endSlice();
    });

    bus.on(EVENTS.BEAT, ({ beat }) => {
      this.hud.toast(`—`);
      if (beat === 2) this.hud.setObjective('');
    });

    bus.on(EVENTS.RING, () => {
      if (!this.player.seated) this.hud.setObjective('THE PHONE IS RINGING');
    });
    bus.on(EVENTS.ANSWERED, () => this.hud.setObjective(''));

    bus.on(EVENTS.POWER, ({ level }) => {
      if (this._screenTexture) this._screenTexture.needsUpdate = true;
      if (level < 0.05) this.audio.stopLoop('crtWhine', 0.2);
      else if (!this.audio.isLooping('crtWhine') && this.state === STATE.PLAYING) {
        this.audio.loop('crtWhine', { volume: 0.35 });
      }
    });
  }

  _wireKeys() {
    this.input.onKey((e) => this.onKey(e));
    this.input.onClick((c) => {
      if (c.type === 'unlock' && this.state === STATE.PLAYING && !this.terminalFocused && this.menu.open === null) {
        this.pause();
      }
    });
  }

  /* ============================================================
     KEY ROUTING
     ============================================================ */
  onKey(e) {
    // Menus and panels swallow everything while they are open.
    if (this.menu.open) {
      if (this.menu.handleKey(e)) { e.preventDefault(); return; }
      if (this.menu.open === 'panel' && e.key === 'Escape') { this.menu.closePanel(); return; }
      return;
    }
    if (this.state !== STATE.PLAYING) return;

    // The terminal takes the keyboard while the player is leaning into it.
    if (this.terminalFocused) {
      if (e.code === 'KeyT' && !this.terminal.input) { this.focusTerminal(false); e.preventDefault(); return; }
      if (e.key === 'Escape' && this.terminal.screen === SCREENS.MENU) { this.focusTerminal(false); return; }
      if (this.terminal.handleKey(e)) e.preventDefault();
      return;
    }

    switch (e.code) {
      case 'F3': this.hud.togglePerf(); e.preventDefault(); break;
      case 'Escape': this.pause(); break;
      case 'KeyF': this.answer(); break;
      case 'KeyH': this.toggleHold(); break;
      case 'KeyX': this.hangUp(); break;
      case 'KeyQ': if (this.player.seated) this.player.stand(); break;
      case 'KeyT': if (this.player.seated) this.focusTerminal(true); break;
      case 'KeyE': this.interaction.activate(); break;
      case 'Enter':
        if (this.callUI.choices.length) this.callUI.pick();
        else this.interaction.activate();
        break;
      case 'ArrowUp': if (this.callUI.choices.length) { this.callUI.move(-1); e.preventDefault(); } break;
      case 'ArrowDown': if (this.callUI.choices.length) { this.callUI.move(1); e.preventDefault(); } break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': {
        const i = Number(e.code.slice(5)) - 1;
        if (this.callUI.choices.length > i) this.callUI.pick(i);
        break;
      }
      default: break;
    }
  }

  /* ============================================================
     ACTIONS
     ============================================================ */
  answer() {
    if (this.phone.anyRinging) {
      this.phone.answer();
      this.audio.duck('ambience', 0.42);
    } else if (this.phone.held.length) {
      this.phone.resume(this.phone.held[0].index);
    }
  }

  toggleHold() {
    if (this.phone.activeLine != null) this.phone.hold();
    else if (this.phone.held.length) this.phone.resume(this.phone.held[0].index);
  }

  hangUp() {
    if (this.radioCall) { this.runner.end('player'); return; }
    if (this.phone.activeLine != null) {
      this.phone.hangUp();
      this.audio.duck('ambience', 1.0);
    }
  }

  _startRadioCall(call) {
    if (this.phone.activeLine != null) return false;
    this.radioCall = call;
    this.audio.play('squelchOpen', { volume: 0.8 });
    bus.emit(EVENTS.ANSWERED, { line: -1, call, medium: 'radio' });
    this.runner.start(call);
    return true;
  }

  focusTerminal(on) {
    if (on && !this.player.seated) {
      this.player.sit({ x: DESK.seat.x, z: DESK.seat.z, yaw: DESK.seat.yaw, eye: DESK.seatEye });
    }
    this.terminalFocused = on;
    document.getElementById('crt').classList.toggle('hidden', !on);
    this.hud.setReticle(!on);
    this.setMode(on ? 'ui' : 'world');
    if (on) {
      this.gameState.set('used_terminal', true);
      this.audio.play('keyClack');
    }
  }

  setMode(mode) {
    if (mode === 'world') this.input.setMode(MODE.WORLD);
    else this.input.setMode(MODE.UI);
  }

  applySettings() {
    this.audio.applySettings();

    const name = this.settings.get('quality') || 'medium';
    const preset = PRESETS[name] || PRESETS.medium;
    if (name !== this.qualityName) {
      this.qualityName = name;
      this.quality = preset;
      this.lighting.setPoolSize(preset.lightPool, preset.shadows);
    }
    this.renderer.setPreset({
      ...preset,
      pixelRatio: this.settings.get('pixelRatio') ?? preset.pixelRatio,
    });
    this.renderer.adaptive = this.settings.get('adaptiveQuality') !== false;

    this.lighting.reduceFlicker = this.settings.get('reduceFlicker');
    const g = this.renderer.post.grade;
    g.grain.value = this.settings.get('filmGrain') ? 0.030 : 0.0;
  }

  /* ============================================================
     LIFECYCLE
     ============================================================ */
  async startShift({ load = false } = {}) {
    await this.audio.init();
    this.applySettings();

    if (load) {
      this.save.load();
    } else {
      this.gameState.reset();
      this.clock.set(SHIFT_START, { silent: true });
      this.outages.list.length = 0;
      this.outages.byId.clear();
      this.director.queue.length = 0;
      this.director.fired.clear();
      this.director.mundaneDebt = 0;
      this.save.clear();
    }

    this.menu.showTitle(false);
    this.hud.show(true);
    this.hud.updateClock();
    this.hud.setLines(this.phone.snapshot());
    this.hud.setObjective('SIT AT THE DISPATCH DESK');
    this.state = STATE.PLAYING;
    this.clock.start();
    this.setMode('world');

    // The room comes up to sound. Levels are relative to the ambience bus,
    // which the player controls separately from master.
    const tone = this.settings.get('roomTone') === false ? 0 : 1;
    this.audio.loop('rain', { volume: 0.55 });
    this.audio.loop('fluorescent', { volume: 0.45 * tone });
    this.audio.loop('crtWhine', { volume: 0.30 * tone });

    this.gameState.log(this.clock.stamp(), 'Shift began. Storm across the district.', 'note');
    bus.emit(EVENTS.SHIFT_START, {});
    this.save.save('shift start');
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.clock.stop();
    this.menu.pause();
    this.setMode('ui');
  }

  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAYING;
    this.clock.start();
    this.setMode(this.terminalFocused ? 'ui' : 'world');
  }

  async endSlice() {
    if (this.state === STATE.ENDED) return;
    this.state = STATE.ENDED;
    this.clock.stop();
    this.callUI.close();
    this.hud.show(false);
    this.setMode('ui');
    this.audio.stopAllVoices();
    this.audio.stopLoop('fluorescent', 1.2);
    this.audio.stopLoop('crtWhine', 0.8);
    this.audio.duck('ambience', 0.25, 2.0);
    await this.menu.slate('PLEASE HOLD', { hold: 6000 });
    this.menu.hideSlate();
    this.horror.clearAll();
    this.menu.report(this.gameState, this.clock, this.outages);
    this.save.save('slice complete');
  }

  /* ============================================================
     FRAME
     ============================================================ */
  frame(nowMs) {
    const now = nowMs / 1000;
    let dt = this._last ? now - this._last : 0.016;
    this._last = now;
    const frameMs = Math.min(200, dt * 1000);
    dt = Math.min(0.05, dt);           // a tab that was backgrounded must not teleport the shift
    this.time += dt;

    this.renderer.resize();

    if (this.state === STATE.PLAYING) {
      // input -> player
      const m = this.input.takeMouse();
      if (!this.terminalFocused) this.player.look(m.dx, m.dy);
      this.player.update(dt, this.terminalFocused ? null : this.input.axes);
      this.interaction.enabled = !this.terminalFocused;
      this.interaction.update();

      // sim
      this.clock.update(dt);
      this.phone.update(dt);
      this.director.update(dt);
      this.radio.update(dt);
      this.horror.update(dt);
      this.callUI.update(dt);

      // The field advances on shift MINUTES, not frames. Step through every
      // minute that elapsed, so a slow frame -- or a horror event that moves
      // the clock -- cannot skip a crew's drive time.
      const minute = Math.floor(this.clock.minutes);
      if (this._lastMinute == null) this._lastMinute = minute;
      if (minute > this._lastMinute) {
        const steps = Math.min(240, minute - this._lastMinute);
        for (let i = 0; i < steps; i++) this.crews.tick(this._lastMinute + i + 1);
        this._lastMinute = minute;
      } else if (minute < this._lastMinute) {
        this._lastMinute = minute;      // the clock went backwards on purpose
      }

      this.hud.update(dt);
      this.hud.setLines(this.phone.snapshot());
    } else if (this.state === STATE.PAUSED || this.state === STATE.ENDED) {
      this.callUI.update(0);
    }

    // The baked light is part of the mains, so it dims with them.
    if (this.bakedMaterials && this.lighting) {
      const p = this.lighting.power;
      if (Math.abs(p - (this._lastBakedPower ?? -1)) > 0.01) {
        setBakedPower(this.bakedMaterials, p);
        this._lastBakedPower = p;
      }
    }

    // presentation always runs, so the title screen is a live room.
    // The light pool follows the camera, so only the fixtures the player is
    // actually under are real lights. See lighting.js.
    const cam = this.renderer.camera.position;
    this.lighting.setFocus(cam.x, 2.6, cam.z);
    this.lighting.update(this.time, dt);
    this.rain.update(this.time);
    const flash = this.lighting.lightningFlash || 0;
    this.wetGlass.update(this.time, flash);
    this.sky.update(this.time, flash);
    this._updateWorldObjects(dt);
    this.terminal.update(dt);
    if (this._screenTexture) this._screenTexture.needsUpdate = true;
    if (this.terminalFocused) this._blitTerminal();

    this.renderer.render(this.scene, this.time, frameMs);
    if (this.hud) this.hud.updatePerf(this.renderer, this.scene);
    this.input.endFrame();
  }

  /** Clocks, CRT glow, the radio needle -- the room reacting to the sim. */
  _updateWorldObjects(dt) {
    const disp = this.clock.displayMinutes;
    const secs = (this.clock.minutes % 1) * 60;
    const clocks = this.dressing.clocks;
    if (clocks[0]) setClock(clocks[0], disp, secs);
    // The corridor clock carries the drift. When they disagree, they disagree
    // in the room, not in a cutscene.
    if (clocks[1]) setClock(clocks[1], disp + (this.world.clockOffset || 0), secs);

    const crt = this.dressing.crt;
    if (crt && crt.userData.glow) {
      const on = this.terminal.powered ? 1 : 0;
      const target = on * (0.9 + Math.sin(this.time * 13) * 0.04) * this.lighting.power;
      crt.userData.glow.intensity += (target * 1.05 - crt.userData.glow.intensity) * Math.min(1, dt * 6);
      crt.userData.screenMaterial.emissiveIntensity = 0.78 * on;
    }

    // telephone lamps mirror the line state
    const phoneProp = this.dressing.phone;
    if (phoneProp && phoneProp.userData.lineLampMats) {
      const snap = this.phone.lines;
      phoneProp.userData.lineLampMats.forEach((mat, i) => {
        const l = snap[i];
        if (!l) return;
        let v = 0;
        if (l.state === 'RINGING') v = (Math.floor(this.time * 2.4) % 2) ? 2.4 : 0.15;
        else if (l.state === 'ACTIVE') v = 1.8;
        else if (l.state === 'HOLD') v = (Math.floor(this.time * 1.1) % 2) ? 1.4 : 0.1;
        mat.emissiveIntensity += (v - mat.emissiveIntensity) * Math.min(1, dt * 14);
      });
      const held = this.phone.held.length > 0;
      const hm = phoneProp.userData.holdMat;
      hm.emissiveIntensity += ((held ? 1.6 : 0) - hm.emissiveIntensity) * Math.min(1, dt * 10);
    }

    // radio VU needle and transmit lamp
    const radioProp = this.dressing.radio;
    if (radioProp && radioProp.userData.vuNeedle) {
      const v = this.radio.vu;
      radioProp.userData.vuNeedle.rotation.z = (-0.7 + v * 1.4);
      const tx = radioProp.userData.txMat;
      tx.emissiveIntensity += (((this.radio.busy && this.radio.lastFrom === 'DISPATCH') ? 2.0 : 0) - tx.emissiveIntensity) * Math.min(1, dt * 12);
    }
  }

  /** Copy the terminal canvas into the full-screen reader. */
  _blitTerminal() {
    const src = this.terminal.canvas;
    this.crtCtx.drawImage(src, 0, 0, this.crtDisplay.width, this.crtDisplay.height);
  }
}

function escapeText(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
