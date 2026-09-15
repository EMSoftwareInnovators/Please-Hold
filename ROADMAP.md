# ROADMAP

Status of PLEASE HOLD as of the first vertical slice.

---

## Implemented and verified

Everything in this section was tested with the harnesses in `tools/` and the
result was checked, not assumed.

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
- [x] Static geometry merging (907 meshes → 383 draw calls)
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
- [x] Exterior: parking lot, chain-link, a three-phase pole line with sagging
      conductors and transformers, sodium yard lights, a treeline, a service truck
- [x] Storm sky shader, GPU rain volume, rain-on-glass runnel shader
- [x] Fluorescent simulation: per-fixture health, ballast chatter below 62% mains,
      120 Hz ripple, sick-green colour shift, double-strike lightning envelope

### Gameplay
- [x] Main menu, options, how-to, pause, end-of-shift report
- [x] First-person movement with collision; seated mode at the desk
- [x] Interaction system with 14 usable objects
- [x] Telephone: 6 lines, ring cadence, answer, **hold with per-caller patience
      and consequences**, auto-park, hang up, hold music
- [x] Data-driven call format with a validator that runs at boot and in CI
- [x] Requirement-gated player replies (you cannot confirm what you did not read)
- [x] Declarative effects: 20 ops covering flags, trust, memory, outages,
      accounts, scheduling, radio, crews, audio and horror
- [x] Caller memory: trust, what they told you, what you promised, hold time
- [x] Customer database with search and deliberate corruption
- [x] Outage tickets with causes, hazards, priority, meter counts and history
- [x] Service-area map on the wall **and** on the CRT, from one data source
- [x] Crew dispatch with skill matching, ETA and a stated reason per unit
- [x] Field simulation: crews drive, arrive, work and clear in shift minutes
- [x] Radio with queued traffic, squelch, per-crew voices and interference
- [x] CRT terminal: 5 screens (call, tickets+dispatch, accounts, map, log), with
      caller ID doing the lookup and dispatch folded into the ticket list —
      a whole call is 7 keypresses and no typing
- [x] Story scheduler with beat / time / random calls and a mundane-debt rhythm
- [x] 13 horror events across three escalation tiers
- [x] Checkpoint save at every story beat
- [x] **A tutorial that teaches by waiting** — `waitFor` dialogue nodes that
      hold until the player performs a real action, with an on-screen objective
- [x] **A terminal that is actually usable** — one state machine, two
      renderers (a coarse canvas for the CRT in the room, scalable DOM for
      reading), opaque takeover, locked camera, clickable rows and tabs
- [x] **A live call docked under the terminal**, with the arrow keys handed
      between the two panels so neither the caller nor the terminal can be
      locked out, the panel that has them saying so, and the terminal giving
      up exactly as much room as the panel needs
- [x] Written instructions that name the player's actual controls: hints carry
      `{action}` tokens and are expanded per input family at display time
- [x] 14 call scripts — 238 nodes, 420 lines, 169 player replies
- [x] The full slice runs start to finish: 29/29 playthrough assertions pass,
      22/22 tutorial assertions, 33/33 control assertions, 19/19 pad-only
      assertions, 21/21 audio-render assertions

---

## Partially implemented

| Thing | State |
|---|---|
| **The shift does not run to 06:00** | It ends on the 1978 call, which is the intended end of *this* slice. `GameClock` already models the full 22:45→06:00 window and `SHIFT_END` exists. |
| **Voices** | The formant synthesizer gives every line real timing, prosody and a per-character voice, and every telephone era has its own signal chain. It reads as muffled speech through a handset, not as words. The `clip:` path for real recordings is implemented but no recordings exist. |
| **Save/continue** | Checkpoints save and load correctly, but a save taken mid-call resumes at the top of the next beat rather than mid-conversation. |
| **Doors** | Room doors are geometry and are drawn ajar. They do not open. The exit door is correctly locked and solid. |
| **Crew skills** | Skill matching, "not rated for this" and the follow-up radio call are implemented. Crews never refuse a job, get tired, or go out of service on their own. |
| **The second clock** | The corridor clock carries the drift and the horror event sets it. Nothing yet forces the player to notice; it rewards a player who checks. |
| **Options** | All options apply and the panel is now navigable with a d-pad. Bindings are one table in `engine/controls.js`, which is what a rebinding UI would edit; there is no such UI yet, and no stick-sensitivity or invert-Y option for a pad. |
| **Gamepad** | The whole game is playable on a pad with no keyboard at all, including text entry (`tools/pad.mjs` proves it end to end). What has never happened is a human holding a real controller: dead zones, trigger rest values and the scheme detector are all untested against hardware. |

---

## Known problems

1. **Performance still needs confirming on real hardware.** The first build ran
   at seconds per frame on an M1 MacBook Air. The causes were found and fixed
   — 37 real-time lights cut to 7-11, static lighting baked to vertices,
   Retina 2x rendering turned off by default, MSAA made a preset, and an
   adaptive resolution scaler added — but every measurement here is still
   SwiftShader in a container. The structural numbers (lights, draw calls,
   triangles) are sound; the frame rate is not measurable from here. `F3`
   in game and `node tools/perf.mjs` report the real ones.
2. **Draw calls are ~101 from the desk, ~383 in the scene.** Props are not
   merged (they carry interaction and animation). Instancing the day-shift
   desks and the ceiling grid would help if it is still needed.
3. **The baked light cannot move.** A single fixture going dark leaves its
   baked pool on the floor. Fixtures near the player hold a real pooled light
   and flicker correctly, so this is only visible across the room during a
   brownout.
4. **No audio device in CI.** The mix is now rendered offline to real WAVs and
   measured properly (`tools/render.mjs`: envelope variation, crest factor,
   onsets per second, band split), and those files can be listened to outside
   the container — but nothing in the loop that writes the code can hear them.
   Both audio bugs so far passed the numeric checks that existed at the time.
5. The **`_updateStanding` method on `Player`** is vestigial — standing works,
   but it eases through `update()` rather than that method.
6. The **horror `degrade` and `tunnel` events restore the grade with a
   `requestAnimationFrame` loop** that does not stop if the event is re-fired
   mid-restore. Harmless today; will misbehave if two grade events overlap.
7. **The tube canvas and the DOM view are two renderers of one description.**
   They cannot disagree about content, but they can about layout — a row kind
   added to one and not styled in the other will render, plainly, in both.
8. **No controller has actually been held.** `tools/controls.mjs` drives the
   pad path with the same synthetic button events `input.js` produces, so the
   routing, the button art and the menus are covered — but there is no gamepad
   in CI, and nothing here has confirmed a real stick's dead zone, a trigger's
   resting value, or that a DualSense reports the id the scheme detector
   expects.
9. **Nothing in the building makes the player stand up.** The whole slice can
   be finished without leaving the chair, which caps how much the corridor,
   the records room and the rest of the office can ever be worth. See
   "The building at night" below for the design note.

---

## Placeholder assets

Everything generated, nothing shipped as a file:

| | Where | Replace by |
|---|---|---|
| All 15 surface materials | `src/engine/textures.js` | `IMAGE_OVERRIDES` in `materials.js` |
| Wall map, notices, EXIT sign, drawer labels, binder spines, clock face, equipment plates | `src/world/signage.js` | return an `<img>` instead of a `<canvas>` |
| All props | `src/world/props.js`, `workstation.js` | replace the builder body, keep the `userData` contract |
| All voices | formant synthesis in `src/engine/audio.js` | `clip:` on a line + `audio.registerClip()` |
| All sound effects | `AudioEngine.play()` | same |
| Favicon | generated PNG at repo root | any 32×32 |

---

## Next milestone — recommended order

### 1. Finish the night (highest value)
The slice ends at beat 10. Extend to a full 22:45→06:00 shift:
* 8–12 more ordinary calls so the random pool does not run dry (the director
  already has a time-decay fallback for this, but more traffic is the real fix)
* a second and third recurring caller with the Daley treatment
* a mid-shift lull that is genuinely quiet, because the game has not had one
* an ending that resolves the shift rather than cutting to the title

### 2. Make the two clocks matter
The mechanism is built. Give the player a reason to compare them: a call that
asks the time, a work order that will not accept a stamp, Keefe asking what
yours says.

### 3. Callers from more eras
`caller.era` exists and the audio chain supports 1956, 1978 and 1999 already.
The design calls for it to become *very apparent* that calls arrive from
different periods. Add 1943 and 1987 line treatments and two more decades of
caller.

### 4. Real voice recordings
The pipeline is finished and unused. Recording even the 30 lines of
`keefe_1978` would transform the ending. Start there, not at the beginning.

### 5. Terminal depth
* an account-history screen (the microfilm cartons in Records are a promise)
* the ability to *edit* a record, so the player can watch their own edit change
* the CALL screen should show a returning caller's previous tickets inline —
  Mrs. Daley calling back is the obvious case, and it is one query

### 6. The building at night — and getting the player out of the chair

**Not implemented. This is the design note for it.**

The desk is safe. It has a task, a screen, and a phone that tells you what to
do next. That is exactly why the horror needs the player *out* of it: the
corridor is only frightening if leaving the desk costs something, and right
now nothing ever asks them to. A player can finish the whole slice without
standing up once.

The rule that should govern all of this: **the reason to get up must come from
the job, and the cost of getting up must be the phone.** Never a locked door
that opens when a timer says so, never "go and look at the spooky thing". The
player should stand up because a caller needs something that is not at the
desk, and should feel the line ringing behind them the whole way.

Ranked by how much they earn:

1. **The log book, not the log screen.** The supervisor's line in the handover
   is already "write it down". Put a paper log on the far counter — the one
   the day shift actually uses — and make certain things only recordable
   there: the anomalies. The terminal's LOG screen holds what the terminal
   believes; the paper holds what the player saw. When those two disagree
   later, the player walked across the room to create the evidence, which is
   worth far more than being shown it. Cost: the phone can ring while you are
   at the counter, and you have to decide whether to finish the sentence.

2. **The breaker panel / the fuse cabinet.** A brownout drops the terminal or
   the lights, and it comes back by hand. This is the most natural "you must
   leave the desk NOW, with a call live" pressure in the building, and the
   horror events already simulate the failure — they just currently fix
   themselves. Put a held caller on the line first and it is a real trade.

3. **Records: the microfilm cartons.** An account older than the CIS (the 1961
   service date on Daley's record is a hook already in the data) has nothing
   on the terminal. To answer a question about it the player has to go and
   open a drawer. This is where a 1956 account SHOULD be findable on paper —
   and where the paper can say something the terminal does not. Best possible
   home for a document the player finds rather than is told.

4. **The radio base station, if it stops answering the desk mic.** A crew that
   can only be raised from the set on the far wall gets the player up with
   their back to the phone, listening to somebody describe what they are
   looking at. The radio already has per-crew voices and a queue.

5. **Coffee, cigarettes, the thermostat, the window.** The mundane one, and do
   not skip it. Gloria already mentions the thermostat lying. A player who
   gets up for nothing at all — because it is 3am and they are bored — is a
   player who has decided the room is safe, which is the state you want them
   in immediately before it is not. This wants no mechanics: just a reason to
   be standing in the wrong place at the wrong time.

What the horror gets in return, once any of those exist:
* the desk can be occupied while the player is away from it (the chair turned,
  the terminal on a screen they did not leave it on, a ticket they did not
  write, the handset off the hook)
* the phone ringing becomes a sound you walk *toward*, which is a different
  emotion from a sound you answer
* the corridor stops being scenery
* and the 1978 dispatcher at the end lands harder if the player has spent the
  night learning that this room does things when nobody is sitting in it

Supporting work this needs, in order: working doors (the records room wants to
be lockable), a light switch so darkness can be the player's own fault, and
carryable/readable paper as an interaction kind. A second floor or the
basement the conduit implies is the biggest version of this and the least
necessary.

**One constraint worth writing down now:** if the player is away from the desk
when a story beat is due, the beat must WAIT, not fire into an empty chair.
The director already holds calls for a hold-grace period; leaving the desk
should extend the same courtesy, or the game will punish the exploration it
just asked for.

### 7. The voices, one more pass
The synthesizer has consonants and transitions now, which is the difference
between beeps and speech, but it is still not a person. The next gains are:
* coarticulation — a vowel's targets should be pulled toward its neighbours
* a proper glottal pulse shape (LF model) instead of a filtered sawtooth
* per-character prosody: Merrick interrupts, Daley trails off, Ott takes his
  time. The data is already per-character; the contour is not
* and the real answer is still item 4: recordings. `clip:` on a line already
  plays one, so that is a content problem, not a code problem

### 8. Controls polish
* a rebinding UI over the `ACTIONS` table (the data is already shaped for it)
* stick sensitivity, dead zone and invert-Y in Options
* test on a real controller: dead zones, trigger rest values, and whether a
  DualSense reports an id the scheme detector recognises

### 9. Confirm the performance work on a GPU
The structural fixes are in (see Known problems 1). What remains is measurement:
run `F3` on real hardware at each preset, confirm the adaptive scaler settles
where it should, and profile the rain and wet-glass shaders, which are the
most expensive per-pixel work left and have never been measured on a GPU.

---

## Larger features from the design bible not yet started

* Multiple shifts / a campaign structure
* Supervisor calls and a chain of command
* The player character having a life outside the desk
* Consequences that carry between nights
* Any ending other than the slice cut
* Crews that can be hurt
* A written work-order system the player fills in by hand
* Weather that changes over the night
