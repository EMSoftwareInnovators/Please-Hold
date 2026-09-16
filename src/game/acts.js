/* ============================================================
   acts.js -- the shape of the night.

   The shift is one long beat chain, but it is not one long MOOD.
   A player at 23:10 is learning a job; a player at 04:17 has
   learned it well enough to know that what is happening is not
   possible. The pacing that serves the first does not serve the
   second, so the night is divided into acts and the scheduler
   reads its gaps from here.

   ACTS ARE DERIVED FROM THE BEAT. There is no second piece of
   state to keep in sync -- `actFor(beat)` is the whole mapping,
   and a call script that advances the beat advances the act with
   it. Story scripts should use the named beat constants below
   rather than bare numbers.

   THE GAP NUMBERS ARE THE POINT. `gap` is the range, in REAL
   seconds, that the director aims to leave between ordinary
   calls. Early in the night that is half a minute to a minute
   and a half of nothing happening, which is exactly what makes
   the strange calls land. Silence is content.
   ============================================================ */

/** Named beats, so scripts stop counting on their fingers. */
export const BEAT = {
  HANDOVER: 0,          // the supervisor walks you through the desk
  FIRST_CALL: 1,
  DALEY: 2,
  HAZARD: 3,
  CREW: 4,
  DALEY_BACK: 5,
  HOLBROOK: 6,
  EVP: 7,
  PRATT: 8,
  KEEFE: 9,             // the 1978 desk, and the cascade

  /* --- Act II: the building --- */
  BLACKOUT: 10,         // the lights are out and the terminal is dead
  RESTORED: 11,         // the player has found the breaker panel
  GAINES: 12,           // 1943, and a name the CIS has never heard of
  LOOP: 13,             // the caller who keeps not getting out
  LISTENER: 14,         // something is learning how to sound like people
  LULL: 15,             // 03:00. the storm eases. nothing happens.
  IMITATION: 16,        // Mrs Daley, nearly
  CRISIS: 17,           // a care home on a generator with hours of fuel
  APPROACH: 18,         // 04:10. the traffic thins out.

  /* --- Act III: 4:17 --- */
  SEVENTEEN: 20,
  AFTER: 21,            // what is left once the ringing stops

  /* --- Act IV: dawn --- */
  DAWN: 25,
  HANDBACK: 27,         // the day shift arrives
  END: 28,
};

/**
 * `gap` -- [min, max] REAL seconds the director tries to leave between
 *          ordinary calls. The director picks a fresh target in this range
 *          after every call, so the rhythm is never metronomic.
 * `debtFloor` -- how much ordinary work has to happen between two strange
 *          calls. Higher means the anomalies are further apart.
 * `quiet` -- a multiplier applied to the gap when nothing is outstanding.
 *          The night should be allowed to go genuinely quiet.
 */
export const ACTS = [
  {
    id: 'I', name: 'THE JOB', fromBeat: BEAT.HANDOVER,
    gap: [34, 78], debtFloor: 2, quiet: 1.0,
    note: 'ordinary utility work, with something wrong underneath it',
  },
  {
    id: 'II', name: 'THE BUILDING', fromBeat: BEAT.BLACKOUT,
    gap: [46, 105], debtFloor: 2, quiet: 1.25,
    note: 'the phone is no longer the only thing in the room',
  },
  {
    id: 'II-LULL', name: 'THE LULL', fromBeat: BEAT.LULL,
    gap: [95, 190], debtFloor: 3, quiet: 1.5,
    note: 'around three. the storm eases and almost nothing happens',
  },
  {
    id: 'II-LATE', name: 'THE CRISIS', fromBeat: BEAT.CRISIS,
    gap: [40, 92], debtFloor: 1, quiet: 1.0,
    note: 'real customers in real trouble, while reality comes apart',
  },
  {
    id: 'III', name: 'FOUR SEVENTEEN', fromBeat: BEAT.SEVENTEEN,
    gap: [8, 20], debtFloor: 0, quiet: 1.0,
    note: 'every rule the switchboard taught the player, broken at once',
  },
  {
    id: 'IV', name: 'DAWN', fromBeat: BEAT.DAWN,
    gap: [60, 140], debtFloor: 1, quiet: 1.2,
    note: 'it is nearly over, and the night is taking its evidence back',
  },
];

/** Which act a beat belongs to. */
export function actFor(beat = 0) {
  let found = ACTS[0];
  for (const a of ACTS) if (beat >= a.fromBeat) found = a;
  return found;
}

/* ============================================================
   THE TIMETABLE

   Shift minutes, counted past midnight (so 04:17 is 28*60+17).
   Story calls pin themselves to these rather than to bare
   numbers, and the 4:17 sequence reads its own time from here.
   ============================================================ */
export const CLOCK = {
  SHIFT_START: 22 * 60 + 45,      // 22:45
  MIDNIGHT: 24 * 60,
  LULL_FROM: 26 * 60 + 40,        // 02:40
  LULL_TO: 27 * 60 + 30,          // 03:30
  APPROACH: 28 * 60 + 8,          // 04:08 -- the traffic starts thinning
  SEVENTEEN: 28 * 60 + 17,        // 04:17. the whole building.
  AFTER: 28 * 60 + 26,
  DAWN_LIGHT: 29 * 60,            // 05:00 -- the sky starts to go
  HANDBACK: 29 * 60 + 45,         // 05:45 -- somebody's headlights
  SHIFT_END: 30 * 60,             // 06:00
};

/** 04:17, as the game says it out loud. Seeded all over the night. */
export const SIGNATURE_TIME = '4:17';
