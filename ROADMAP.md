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
- [x] Input with world / UI mode separation and pointer lock

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
- [x] CRT terminal: 6 screens (menu, accounts, tickets, map, dispatch, log)
- [x] Story scheduler with beat / time / random calls and a mundane-debt rhythm
- [x] 13 horror events across three escalation tiers
- [x] Checkpoint save at every story beat
- [x] 13 call scripts — 211 nodes, 374 lines, 159 player replies
- [x] The full slice runs start to finish: 23/23 playthrough assertions pass

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
| **Options** | All options apply. Key rebinding is a table in `input.js` but has no UI. |

---

## Known problems

1. **Performance is unverified on real hardware.** Everything here was rendered
   through SwiftShader in a headless container at 0.3–3.7 fps. That number says
   nothing useful about a GPU. The obvious optimisation (static merging) is
   done; shadow casters are capped at two. Someone needs to run it on a real
   machine and profile it.
2. **Draw calls are still ~383.** Props are not merged (they carry interaction
   and animation). Instancing the day-shift desks and the ceiling grid would
   help.
3. **No audio device in CI**, so the WebAudio graph is built and exercised but
   never actually *heard* by a test. The line-effect chains are verified to
   construct and connect; their sound is unverified.
4. The **`_updateStanding` method on `Player`** is vestigial — standing works,
   but it eases through `update()` rather than that method.
5. The **horror `degrade` and `tunnel` events restore the grade with a
   `requestAnimationFrame` loop** that does not stop if the event is re-fired
   mid-restore. Harmless today; will misbehave if two grade events overlap.
6. **Mouse input in the terminal is not wired.** The CRT is keyboard-only, which
   is period-correct but means a player who reaches for the mouse gets nothing.

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
The slice ends at beat 9. Extend to a full 22:45→06:00 shift:
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
* mouse support
* an account-history screen (the microfilm cartons in Records are a promise)
* the ability to *edit* a record, so the player can watch their own edit change

### 6. The building at night
* working doors, with the records room lockable
* a light-switch interaction, so darkness can be the player's own fault
* a second floor or a basement for the equipment room the conduit implies

### 7. Performance pass on real hardware
Instance the ceiling grid and the day desks; consider a single shadow-casting
light; profile the rain and glass shaders, which are the most expensive things
in the frame and were never measured on a GPU.

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
