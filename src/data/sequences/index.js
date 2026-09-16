/* ============================================================
   sequences/index.js -- the authored moments of the night.

   Five of them. Everything else in this game is systems talking
   to each other; these are the parts where an author decided
   exactly what happens and in what order, and they are written
   here rather than in the orchestrator so that the orchestrator
   stays an orchestrator.

   Read them top to bottom. `{ wait: n }` is n real seconds of
   NOTHING, and those are load-bearing: the nine seconds of dark
   silence after the cascade is the part where the player wonders
   whether the game has ended, and the game needs them to wonder
   that before it tells them otherwise.
   ============================================================ */
import { CLOCK, BEAT } from '../../game/acts.js';
import { FAXES } from '../faxes.js';

const fax = (id) => FAXES.find((f) => f.id === id);

/* ============================================================
   1. THE CASCADE — the end of Act I, and not the end of anything.

   Keefe loses carrier. The building goes down. For nine seconds
   there is nothing at all, and the player is allowed to think
   the game is over -- because that is what the old build did,
   and because a night that is not over is worse.
   ============================================================ */
export const cascade = {
  id: 'cascade',
  once: true,
  steps: [
    {
      label: 'carrier lost',
      do: (c) => {
        c.audio.play('lineDrop', { volume: 0.9 });
        c.horror.fire('degrade', { amount: 0.85, duration: 14 });
      },
      wait: 1.6,
    },
    {
      label: 'the building goes',
      do: (c) => {
        /* Everything at once: this is not a brownout, it is the whole
           service going. No grid event anywhere on the map, which is the
           part the player can check, and the part they can write down. */
        c.horror.fire('cascade', { duration: 6 });
        c.power.trip(['lights', 'terminal', 'comms', 'aux'], { reason: 'no grid event' });
        c.state.set('cascade_no_grid_event', true);
        c.audio.stopLoop('holdMusic', 0.2);
      },
      wait: 2.2,
    },
    {
      label: 'silence',
      /* NINE SECONDS. Do not tune this out. The rain, the emergency
         heads, and a room the player cannot work in. */
      do: (c) => { c.audio.duck('ambience', 0.85, 1.5); },
      wait: 9,
    },
    {
      label: 'emergency lighting',
      do: (c) => {
        c.lighting.setEmergency(true);
        c.audio.play('breaker', { volume: 0.5 });
        c.audio.duck('ambience', 1.0, 2.0);
      },
      wait: 3.5,
    },
    {
      label: 'the job resumes',
      do: (c) => {
        /* And here is the transition, and it is a JOB, not a jump scare:
           the terminal is dead, the desk needs it, the panel is down the
           corridor. Nobody tells the player to be frightened. */
        c.state.advanceBeat(BEAT.BLACKOUT);
        c.tasks.start('restore_power');
        c.state.log(c.clock.stamp(), 'Building power lost. Emergency lighting only.', 'warn');
      },
      wait: 1,
    },
    {
      label: 'waiting for the walk',
      until: (c) => c.tasks.playerRoom === 'corridor',
      timeout: 240,
    },
    {
      label: 'the phone, behind you',
      do: (c) => {
        /* They are at the far end of the corridor. Their desk is forty feet
           behind them and it starts ringing, and the console they would
           need to see which line it is on has no power. */
        c.phones.ring('dispatch', { seconds: 26, display: 'UNKNOWN' });
        c.state.set('heard_desk_from_corridor', true);
      },
      wait: 5,
    },
    {
      label: 'the chair',
      do: (c) => {
        /* One lightning flash, one figure at the desk, and nothing else.
           It does not approach. It is not there on the next flash. The
           player still has a breaker to reset. */
        c.horror.fire('strike', { hard: true });
        c.haunt.arm('chair_turned', { force: true });
        c.state.set('saw_figure_in_chair', true);
      },
      wait: 2.4,
    },
    {
      label: 'and gone',
      do: (c) => { c.horror.fire('strike', { hard: true }); },
      wait: 1.2,
    },
    {
      label: 'power back',
      until: (c) => c.power.allLive,
      timeout: 420,
      onTimeout: (c) => c.power.resetAll(),
    },
    {
      label: 'act two',
      do: (c) => {
        c.lighting.setEmergency(false);
        c.phones.silenceAll();
        c.state.advanceBeat(BEAT.RESTORED);
        c.state.log(c.clock.stamp(), 'Power restored from Panel A. No fault found.', 'anomaly');
        /* The first ordinary thing to happen after the worst thing: the fax
           machine, printing a road closure update from the county. */
        c.fax.send(fax('fax_eoc'), { delay: 22 });
      },
    },
  ],
};

/* ============================================================
   2. FOUR SEVENTEEN

   The player has spent five hours learning that the switchboard
   has rules. Lines have lamps. Lamps mean callers. The scheduler
   never gives them two at once. Every one of those is true until
   0417, and then none of them is.
   ============================================================ */
export const fourSeventeen = {
  id: 'four_seventeen',
  once: true,
  steps: [
    {
      label: 'the traffic thins',
      do: (c) => {
        c.director.enabled = false;
        c.state.advanceBeat(BEAT.APPROACH);
        c.state.log(c.clock.stamp(), 'Traffic has stopped.', 'note');
      },
      wait: 14,
    },
    {
      label: 'radio stops',
      do: (c) => {
        c.radio.silence && c.radio.silence();
        c.audio.stopLoop('radioStatic', 1.5);
      },
      wait: 16,
    },
    {
      label: 'the storm eases',
      do: (c) => {
        /* The rain has been the floor of this game since 22:45. Taking it
           away is louder than anything the game could add. */
        c.audio.setLoopVolume && c.audio.setLoopVolume('rain', 0.06, 8);
        c.world.stormEase = true;
      },
      wait: 14,
    },
    {
      label: 'the hum',
      do: (c) => {
        /* With the rain gone, the ballast hum over the desk is suddenly the
           loudest thing in the building. It has been there all night. */
        c.audio.setLoopVolume && c.audio.setLoopVolume('fluorescent', 0.9, 2);
        c.state.set('the_quiet_before', true);
      },
      wait: 11,
    },
    {
      label: '0417',
      do: (c) => {
        c.clock.set(CLOCK.SEVENTEEN, { silent: true });
        c.state.advanceBeat(BEAT.SEVENTEEN);
        /* EVERY instrument. The five in the building and all six lines on
           the console, and the console shows nothing on any of them. */
        c.phones.ringAll({ seconds: 95 });
        c.phone.ringAllLines && c.phone.ringAllLines();
        for (const id of ['s417_1956', 's417_1978', 's417_1943', 's417_evp', 's417_internal']) {
          c.director.fire(id, 'four-seventeen');
        }
        c.audio.duck('ambience', 0.35, 0.5);
        c.state.set('four_seventeen_started', true);
        c.state.log('0417', 'EVERY LINE. EVERY TELEPHONE IN THE BUILDING.', 'anomaly');
      },
      wait: 6,
    },
    {
      label: 'they keep ringing',
      /* Until the player picks one up, or until it has gone on so long that
         standing there IS the answer. Nothing is resolved in five seconds. */
      until: (c) => c.phone.activeLine != null || c.state.has('answered_a_building_phone'),
      timeout: 95,
    },
    {
      label: 'the rest go quiet',
      do: (c) => {
        c.phones.silenceAll();
        c.state.set('four_seventeen_answered', true);
      },
      wait: 2,
    },
    {
      label: 'whatever they answered, finish it',
      until: (c) => c.phone.activeLine == null && !c.runner.active,
      timeout: 200,
    },
    {
      label: 'after',
      do: (c) => {
        c.phone.hangUpAll && c.phone.hangUpAll('carrier');
        c.phones.silenceAll();
        c.audio.duck('ambience', 1, 3);
        c.audio.setLoopVolume && c.audio.setLoopVolume('rain', 0.4, 10);
        c.audio.setLoopVolume && c.audio.setLoopVolume('fluorescent', 0.45, 3);
        c.state.advanceBeat(BEAT.AFTER);
        c.state.set('four_seventeen_done', true);
        c.director.enabled = true;
        c.clock.set(CLOCK.AFTER, { silent: true });
        c.state.log('0428', 'It stopped. Eleven minutes.', 'anomaly');
      },
      wait: 8,
    },
    {
      label: 'and the job comes back',
      do: (c) => {
        /* The most important thing about 0428 is that the care home is still
           on a generator. Reality resumes as an emergency. */
        c.fax.send(fax('fax_carefac'), { delay: 6 });
        c.state.advanceBeat(BEAT.CRISIS);
      },
    },
  ],
};

/* ============================================================
   3. THE KNOCK

   A call from later tonight told the player not to open the rear
   door. This is the rear door. The game does not make them obey
   and does not show them what is outside.
   ============================================================ */
export const theKnock = {
  id: 'the_knock',
  once: true,
  steps: [
    { label: 'wait a while', wait: 95 },
    {
      label: 'three knocks',
      do: (c) => {
        c.audio.play('knock', { volume: 0.9 });
        c.state.set('heard_the_knock', true);
        c.tasks.start('rear_door');
        c.state.log(c.clock.stamp(), 'Knocking at the rear employee door.', 'anomaly');
      },
      wait: 14,
    },
    {
      label: 'again',
      do: (c) => { if (!c.state.has('answered_knock')) c.audio.play('knock', { volume: 0.85 }); },
      wait: 18,
    },
    {
      label: 'and again, slower',
      do: (c) => { if (!c.state.has('answered_knock')) c.audio.play('knock', { volume: 0.8 }); },
      wait: 22,
    },
    {
      label: 'resolve',
      until: (c) => c.state.has('answered_knock') || c.state.has('ignored_knock'),
      timeout: 70,
      onTimeout: (c) => c.state.set('ignored_knock', true),
    },
    {
      label: 'what happened',
      do: (c) => {
        c.tasks.cancel();
        if (c.state.has('answered_knock')) {
          /* The door opens on the lot, the rain, and nothing. What is
             frightening is that the player now knows they were willing. */
          c.state.log(c.clock.stamp(), 'Opened the rear door. Nobody there. Lot empty.', 'anomaly');
          c.haunt.arm('exterior_truck', { force: true });
        } else {
          c.state.log(c.clock.stamp(), 'Did not open the rear door.', 'note');
        }
      },
    },
  ],
};

/* ============================================================
   4. DAWN

   The storm goes out the way a storm actually goes: not with an
   announcement, but by getting quieter than it has been for an
   hour while nobody is listening to it.
   ============================================================ */
export const dawn = {
  id: 'dawn',
  once: true,
  steps: [
    {
      label: 'the sky',
      do: (c) => {
        c.state.advanceBeat(BEAT.DAWN);
        if (c.world) c.world.dawn = 0;
        c.state.log(c.clock.stamp(), 'Wind dropping. Cells moving east.', 'note');
      },
      wait: 30,
    },
    {
      label: 'the records go',
      do: (c) => {
        /* The night takes its evidence back. Everything the terminal was
           made to believe quietly stops being true -- and the paper the
           player wrote on does not, which is the entire point of the book. */
        if (c.world) c.world.ghostFeeders = [];
        c.state.set('temporal_collapse', true);
        for (const id of ['BR-4-0112', 'MA-4-1112']) {
          c.database.remove && c.database.remove(id);
        }
        c.terminal.dirty = true;
        c.state.log(c.clock.stamp(), 'BR-01 no longer on the service display.', 'anomaly');
      },
      wait: 25,
    },
    {
      label: 'all clear',
      do: (c) => { c.fax.send(fax('fax_dawn'), { delay: 4 }); },
      wait: 40,
    },
    {
      label: 'headlights',
      do: (c) => {
        c.state.advanceBeat(BEAT.HANDBACK);
        c.clock.set(CLOCK.HANDBACK, { silent: true });
        c.state.log(c.clock.stamp(), 'Headlights in the lot. Day shift.', 'note');
        c.director.fire('dayshift', 'handback');
      },
      wait: 4,
    },
    {
      label: 'the handover',
      until: (c) => c.state.has('dayshift_done'),
      timeout: 300,
    },
    {
      label: 'one more call',
      do: (c) => {
        /* The day-shift dispatcher answers it, listens, and holds the
           receiver out. It is for the player. */
        c.director.fire('last_call', 'ending');
      },
      wait: 2,
    },
    {
      label: 'until it ends',
      until: (c) => c.state.has('shift_over') || (!c.runner.active && c.phone.activeLine == null),
      timeout: 260,
    },
    {
      label: 'six o clock',
      do: (c) => {
        c.clock.set(CLOCK.SHIFT_END, { silent: true });
        c.state.set('shift_over', true);
        c.game.endShift();
      },
    },
  ],
};

/* ============================================================
   5. THE BACKUP SET

   The desk radio goes out with a crew mid-sentence. The set that
   still works is on the shelf at the far end of the corridor,
   next to the panel, which is where the player already learned
   they cannot hear the telephone properly.
   ============================================================ */
export const backupRadio = {
  id: 'backup_radio',
  once: true,
  steps: [
    {
      label: 'the desk set dies',
      do: (c) => {
        c.audio.play('squelchClose', { volume: 0.7 });
        c.horror.fire('radioBleed', { duration: 4 });
        c.state.set('desk_radio_dead', true);
        c.tasks.start('backup_radio');
        c.state.log(c.clock.stamp(), 'Desk radio has no transmit. Using the backup set.', 'warn');
      },
      wait: 2,
    },
    {
      label: 'ordinary traffic finds you anyway',
      /* The cost of the walk, exactly as advertised: an ordinary customer
         rings the desk while the player is down the corridor. */
      do: (c) => { c.phones.ring('dispatch', { seconds: 22 }); },
      wait: 1,
    },
    {
      label: 'reach them',
      until: (c) => c.state.has('used_backup_radio'),
      timeout: 260,
      onTimeout: (c) => c.state.set('used_backup_radio', true),
    },
    {
      label: 'back to the desk',
      do: (c) => {
        c.phones.silenceAll();
        c.state.set('desk_radio_dead', false);
        c.tasks.cancel();
      },
    },
  ],
};

export const SEQUENCES = { cascade, fourSeventeen, theKnock, dawn, backupRadio };
export const SEQUENCE_BY_ID = {
  cascade,
  four_seventeen: fourSeventeen,
  the_knock: theKnock,
  dawn,
  backup_radio: backupRadio,
};
