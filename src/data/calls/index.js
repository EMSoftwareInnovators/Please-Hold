/* ============================================================
   index.js -- the call manifest.

   ADDING A CALL:
     1. write src/data/calls/<your_call>.js (copy any file here)
     2. import it below
     3. add it to CALLS

   That is the entire integration. You do not touch phone.js,
   calls.js, dialogue.js or anything in src/game/. The library
   validates every script at boot and `node tools/calls.mjs`
   checks them without launching the game.

   ES modules cannot glob without a build step, and this project
   deliberately has no build step, so the one import line is the
   price. It is also a useful place to see the whole shift at a
   glance.
   ============================================================ */
import tutorial_01 from './tutorial_01.js';
import merrick_01 from './merrick_01.js';
import daley_01 from './daley_01.js';
import daley_02 from './daley_02.js';
import vance_01 from './vance_01.js';
import crew_bethel from './crew_bethel.js';
import holbrook_01 from './holbrook_01.js';
import evp_01 from './evp_01.js';
import pratt_1956 from './pratt_1956.js';
import keefe_1978 from './keefe_1978.js';
import ordinary from './ordinary.js';

/**
 * The shift, in the order it is meant to be experienced. `schedule.type`
 * decides how each one actually reaches the player:
 *
 *   beat 0  tutorial_01    the supervisor walks you through the desk. Nothing
 *                          in it is strange, and that is the point.
 *   beat 1  merrick_01     ordinary outage. the job, for real.
 *   beat 2  daley_01       recurring caller, medical alert hidden in the file.
 *   beat 3  vance_01       hazard. the first real trade-off.
 *   beat 4  crew_bethel    radio. the first thing that does not add up.
 *   beat 5  daley_02       she calls back, and she remembers.
 *   beat 6  holbrook_01    an address that is nearly right.
 *   beat 7  evp_01         a line with nobody on it, and a warning.
 *   beat 8  pratt_1956     the year, said out loud.
 *   beat 9  keefe_1978     the desk, twenty-one years earlier.
 *
 * `ordinary` is the random pool that fills the gaps between them.
 */
export const CALLS = [
  tutorial_01,
  merrick_01,
  daley_01,
  vance_01,
  crew_bethel,
  daley_02,
  holbrook_01,
  evp_01,
  pratt_1956,
  keefe_1978,
  ...ordinary,
];

export default CALLS;
