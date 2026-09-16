# ROADMAP

Status of PLEASE HOLD after the full-night pass.

The game is no longer a vertical slice. It runs 22:45 → 06:00, has an ending,
and the 1978 call — which used to be where it stopped — is now the end of
Act I.

---

## Implemented and verified

Everything in this section was tested with the harnesses in `tools/` and the
result was checked, not assumed. **Verified means verified headlessly.** See
"What has never been done" at the bottom for what that word does not cover.

### Engine
- [x] WebGL2 renderer, half-float scene target, 4x MSAA
- [x] Hand-written post chain: bright pass, two-iteration separable bloom, ACES
      tonemap, shadow lift, saturation, vignette, film grain, chromatic
      aberration, and a rolling-interference / barrel-warp mode for horror
- [x] PMREM environment capture **from the room itself**, so the waxed floor,
      the desk clearcoat and the CRT bezel reflect the actual office
- [x] Procedural PBR texture generation — 15 materials, each producing albedo,
      normal (Sobel from a height field) and roughness, all tiling
- [x] Named material library with a one-call path to replace any recipe with art
- [x] Static geometry merging (1081 meshes → 474)
- [x] Full WebAudio synthesis: no audio files ship
- [x] A speech synthesizer driven by the text: spelling -> phonemes, three
      sliding formants, fricative turbulence, stop closures and bursts,
      phrase contour with stress and question rises
- [x] Offline audio rendering and envelope measurement (`tools/render.mjs`),
      which is the only way to tell rain from static without a sound card
- [x] Input with world / UI mode separation and pointer lock, one binding
      table (`engine/controls.js`), and **gamepad support** — pad buttons fold
      into the same key set, Xbox / PlayStation button art chosen from the
      pad's own id, and every key hint on screen prints in whatever is held

### World
- [x] Data-driven floor plan: dispatch room, corridor, break room, records
- [x] Wall builder with door and window openings, casings, sills, glass, leaves
- [x] Suspended ceiling with T-bar grid; institutional two-tone paint with a
      chair rail; rubber cove base
- [x] Dispatch workstation at full detail: L-desk, drawer pedestal, cable drop,
      15" CRT with a domed tube, per-key keyboard, six-line telephone with a
      coiled cord and working lamps, radio console with a VU needle and a
      gooseneck microphone
- [x] Room dressing: filing cabinets, day-shift desks, corkboard with readable
      notices, water cooler, coffee maker, boxes, conduit, wall plates, two
      wall clocks with hands the game drives
- [x] **The building's own equipment** (`world/gear.js`): a breaker panel, a
      fax machine on its bench, a radio base station, the Records counter with
      a card index and the day book, a microfilm reader, four light switches,
      four more telephones, and a 1970s line truck in the lot
- [x] **Working doors and light switches**, with per-room state that persists
      across the night and survives a save
- [x] Exterior: parking lot, chain-link, a three-phase pole line with sagging
      conductors and transformers, sodium yard lights, a treeline, a service truck
- [x] Storm sky shader, GPU rain volume, rain-on-glass runnel shader
- [x] Fluorescent simulation: per-fixture health, ballast chatter below 62% mains,
      120 Hz ripple, sick-green colour shift, double-strike lightning envelope
- [x] **Emergency lighting**, and individual fixtures that can be killed and
      revived, so a dead building looks like a dead building

### The night
- [x] **A full 22:45 → 06:00 shift** at 8.5 real seconds per game minute —
      435 game minutes, about 62 real minutes of clock
- [x] Acts (`game/acts.js`): a beat maps to an act, and an act carries its own
      pacing, mundane-debt floor and quiet rule
- [x] **Gaps are silence** — handset down to next ring — with a real lull
      around three in the morning that nothing jumps out of
- [x] Authored multi-minute sequences as data (`data/sequences/`): the cascade
      at the end of Act I, 04:17, the knock at the rear door, dawn, and the
      backup radio
- [x] An ending: the storm clears, the day shift arrives, the end-of-shift
      report counts what the player actually did, and there is one more call
- [x] 53 call scripts — 573 nodes, 1030 lines, 390 player replies

### Out of the chair
- [x] **`tasks.js` — eight reasons to get up, every one of them the job**:
      restore the breakers, write it in the log, pull a service card, collect
      the fax, raise a crew from the base station, compare the two clocks,
      make coffee, check the rear door
- [x] The phone keeps ringing while the player is away, and **story beats do
      not** — a scripted beat waits for the chair rather than firing into it
- [x] Power (`game/power.js`): four circuits, a panel at the end of the
      corridor, and a building that comes back by hand
- [x] The paper log (`game/paperlog.js`): 16 observations that unlock only when
      the player has actually witnessed the thing, no free typing, an
      end-of-shift score — and handwriting in it that is not the player's
- [x] Records (`game/archive.js`): 8 paper service cards, 2 ledgers and a
      5-document 1978 incident file, which is where the accounts the CIS has
      never heard of turn out to exist
- [x] The fax (`game/fax.js`): mundane traffic most of the night, then a page
      dated 1978, then a page that arrives before its own timestamp and is
      right about what happens next
- [x] Five telephones in four rooms (`game/phones.js`), positioned, muffled
      through walls, and ringable individually or all at once

### Horror
- [x] 14 transient events (`game/horror.js`) across three escalation tiers
- [x] **11 persistent / spatial events** (`game/haunt.js`) that change the room
      and stay changed until the player puts them back — 7 of the 11 change the
      3D scene itself
- [x] The Listener as a presence rather than a monster: reported by a caller,
      then heard, then a familiar voice that is slightly wrong, then an
      imitation that fails a question about a person it never met
- [x] Callers from 1943, 1956, 1978 and 1987, each corroborated by paper the
      player has to go and find — not by the caller saying what year it is
- [x] A man who calls three times out of the same eleven minutes and does not
      know he has called before
- [x] **04:17**: seeded across the night, arrives on its own, and rings every
      instrument in the building at once with nothing on the terminal
- [x] No monster, no chase, no combat, no hiding, and nothing that touches or
      blocks the player

### Gameplay (from the slice, still true)
- [x] Main menu, options, how-to, pause, end-of-shift report
- [x] First-person movement with collision; seated mode at the desk, and a way
      back out of it
- [x] Telephone: 6 lines, ring cadence, answer, hold with per-caller patience
      and consequences, auto-park, hang up, hold music, and a line that rings
      with nobody behind it
- [x] Data-driven call format with a validator that runs at boot and in CI
- [x] Requirement-gated player replies (you cannot confirm what you did not read)
- [x] Declarative effects: 29 ops covering flags, trust, memory, outages,
      accounts, scheduling, radio, crews, audio, horror, faxes, haunts, power,
      building phones, tasks, observations and sequences
- [x] Caller memory: trust, what they told you, what you promised, hold time
- [x] Customer database with search and deliberate corruption
- [x] Outage tickets with causes, hazards, priority, meter counts and history
- [x] Service-area map on the wall **and** on the CRT, from one data source
- [x] Crew dispatch with skill matching, ETA and a stated reason per unit
- [x] Field simulation: crews drive, arrive, work and clear in shift minutes
- [x] Radio with queued traffic, squelch, per-crew voices and interference
- [x] CRT terminal: 5 screens, caller ID doing the lookup, dispatch folded into
      the ticket list — a whole call is 7 keypresses and no typing
- [x] One prop interface (`ui/propui.js`) for the panel, the book, the fax
      tray, the card index and the incident file, on the keys the terminal
      already taught
- [x] Checkpoint save at every story beat, now covering power, doors, tasks,
      the paper log, the archive, the fax, the phones, the haunts and any
      sequence in flight
- [x] A tutorial that teaches by waiting
- [x] Written instructions that name the player's actual controls

### Test results at the time of writing
| Harness | Result |
|---|---|
| `tools/calls.mjs` | 53 calls, 573 nodes, 1030 lines, 390 choices — all valid |
| `tools/boot.mjs` | boots clean, no console errors |
| `tools/soak.mjs` | every script to completion on three reply strategies |
| `tools/render.mjs` | 21/21 |
| `tools/tutorial.mjs` | 22/22 |
| `tools/controls.mjs` | 33/33 |
| `tools/pad.mjs` | 19/19 |
| `tools/pacing.mjs` | 9/9 |
| `tools/playthrough.mjs` | 31/31 |
| `tools/fullnight.mjs` | 30/30 |

---

## Partially implemented

| Thing | State |
|---|---|
| **Voices** | The formant synthesizer gives every line real timing, prosody and a per-character voice, and every telephone era has its own signal chain. It reads as muffled speech through a handset, not as words. The `clip:` path for real recordings is implemented and unused. |
| **Save/continue** | Checkpoints save and load correctly and now carry the whole building. A save taken mid-call still resumes at the top of the next beat rather than mid-conversation. |
| **Crew skills** | Skill matching, "not rated for this", the follow-up radio call, and one crew who refuses a job late in the night. Crews still do not get tired or go out of service on their own, and cannot be hurt. |
| **Options** | All options apply and the panel is navigable with a d-pad. Bindings are one table in `engine/controls.js`, which is what a rebinding UI would edit; there is no such UI, and no stick-sensitivity or invert-Y. `subtitles` is a setting with no UI row. |
| **Gamepad** | Playable end to end with no keyboard (`tools/pad.mjs` proves it). No human has held a real controller. |
| **Microfilm reader** | It exists in Records, it is dressed, and the card index and ledgers carry the documents. The reader itself is scenery — the paper path answers every question the game asks. |
| **The Final Rental easter egg** | One service card in the index (TRIPLE FEATURE VIDEO, 112 Commerce St, with a margin note). It rewards reading; it does nothing else. |

---

## Known problems

1. **Performance still needs confirming on real hardware.** The structural
   fixes are in — 37 real-time lights cut to 7-11, static lighting baked to
   vertices, Retina 2x off by default, MSAA behind a preset, an adaptive
   resolution scaler — but every measurement here is SwiftShader in a
   container, where the game runs at single-digit frames per second at
   1280x720 regardless of preset. The structural numbers (lights, draw calls,
   triangles) are sound; the frame rate is not measurable from here. `F3` in game and `node tools/perf.mjs` report the real ones.
2. **Merging takes the scene from 1081 meshes to 474.** The building added
   props, and props are not merged because they carry interaction and
   animation. Instancing the day-shift desks and the ceiling
   grid would help if it is still needed.
3. **The baked light cannot move.** A single fixture going dark leaves its
   baked pool on the floor. Fixtures near the player hold a real pooled light
   and flicker correctly, so this is only visible across the room during a
   brownout — and the emergency-lighting state hides most of it.
4. **No audio device in CI.** The mix is rendered offline to real WAVs and
   measured properly, and those files can be listened to outside the container
   — but nothing in the loop that writes the code can hear them. Both audio
   bugs so far passed the numeric checks that existed at the time.
5. The **`_updateStanding` method on `Player`** is vestigial.
6. The **horror `degrade` and `tunnel` events restore the grade with a
   `requestAnimationFrame` loop** that does not stop if the event is re-fired
   mid-restore.
7. **The tube canvas and the DOM view are two renderers of one description.**
   They cannot disagree about content, but they can about layout.
8. **No controller has actually been held.**
9. **Game time in a harness runs at about a sixth of wall time** (dt is clamped
   to 0.05s, SwiftShader draws ~3 fps). Every harness that waits on game
   seconds has to compress them explicitly. This is documented at the top of
   `tools/fullnight.mjs` and it has bitten three harnesses so far.

---

## What has never been done

This is the honest list, and it is the reason nothing above says "shipped".

* **Nobody has played the full night.** `tools/fullnight.mjs` drives all of it
  and asserts 30 things about the result, including that every act happens,
  every sequence completes, 4:17 rings every instrument, and the shift ends
  properly. That is not the same as a person sitting through the lull at three
  in the morning and finding out whether it is boring or whether it works.
* **Nobody has heard it.** See Known problems 4.
* **Nobody has held a pad.** See Known problems 8.
* **Nobody has measured a frame.** See Known problems 1.

---

## Placeholder assets

Everything generated, nothing shipped as a file:

| | Where | Replace by |
|---|---|---|
| All 15 surface materials | `src/engine/textures.js` | `IMAGE_OVERRIDES` in `materials.js` |
| Wall map, notices, EXIT sign, drawer labels, binder spines, clock face, equipment plates, service cards, fax pages | `src/world/signage.js` | return an `<img>` instead of a `<canvas>` |
| All props | `src/world/props.js`, `workstation.js`, `gear.js` | replace the builder body, keep the `userData` contract |
| All voices | formant synthesis in `src/engine/audio.js` | `clip:` on a line + `audio.registerClip()` |
| All sound effects | `AudioEngine.play()` | same |
| Favicon | generated PNG at repo root | any 32×32 |

---

## Next milestone — recommended order

The night exists. What it needs now is confirmation and depth, in that order.

### 1. Play it (highest value, and it is not code)
Sit down and work the whole shift on real hardware with sound. Everything
below is a guess until that has happened once. Specifically worth watching:

* is the lull restful or is it dead time?
* does the nine seconds of silence after the cascade read as "the game has
  ended", which is what it is for?
* does 4:17 last long enough to be a decision and short enough to be a scene?
* do the ordinary calls carry an hour, or do they start repeating?
* at 8.5 real seconds per game minute, is 62 minutes the right length?

The clock rate is one number in `src/game/clock.js` and the act gaps are one
table in `src/game/acts.js`. Both are meant to be tuned by someone who has
played it.

### 2. Real voice recordings
The pipeline is finished and unused. Recording `keefe_1978`, `last_call` and
the three `mercer` calls — about 60 lines — would do more for this game than
any other single piece of work. `clip:` on a line already plays one, so this
is a content problem, not a code problem.

### 3. Confirm performance on a GPU
Run `F3` at each preset on real hardware, confirm the adaptive scaler settles
where it should, and profile the rain and wet-glass shaders, which are the
most expensive per-pixel work in the game and have never been measured on a
GPU. The building added props and draw calls; that number wants a second look.

### 4. A real controller
Dead zones, trigger rest values, and whether a DualSense reports an id the
scheme detector recognises. Then stick sensitivity, dead zone and invert-Y in
Options, and a rebinding UI over the `ACTIONS` table — the data is already
shaped for it.

### 5. Consequences that outlive the night
The end-of-shift report counts the paper log, the tickets, the promises kept
and the callers who hung up. Nothing reads it afterwards. The obvious next
structure is a second shift that knows what happened on the first: a caller
who remembers being put on hold for nine minutes, a crew that will not take
your word, a supervisor who has read your log.

### 6. Terminal and Records depth
* an account-history screen, so the CIS can be *wrong* in a way the paper
  corrects
* the ability to edit a record, so the player can watch their own edit change
* the microfilm reader as a real screen rather than dressing
* the CALL screen showing a returning caller's previous tickets inline

### 7. More of the night's own content
The structure has room that the content does not yet fill:
* more ordinary traffic for the back half — Act II leans on the same pool
* a fourth era, if it can be corroborated as carefully as 1943 was
* crews that tire, go out of service, or get hurt
* more than one ending, or one that branches on the paper log

### 8. The voices, one more pass (if recordings do not happen)
* coarticulation — a vowel's targets pulled toward its neighbours
* a proper glottal pulse shape (LF model) instead of a filtered sawtooth
* per-character prosody: Merrick interrupts, Daley trails off, Ott takes his
  time. The data is already per-character; the contour is not

### 9. Art
Everything is procedural and every path to replace it exists. Start with the
signage — the wall map, the service cards and the fax pages are read closely
by the player and are the cheapest thing to upgrade.

---

## Larger features from the design bible not yet started

* Multiple shifts / a campaign structure
* The player character having a life outside the desk
* A written work-order system the player fills in by hand
* Weather that changes over the night
* A second floor, or the basement the conduit implies
