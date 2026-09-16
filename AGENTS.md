# AGENTS.md — development rules for PLEASE HOLD

Read this before changing anything. These are not style preferences; several of
them are decisions that were made, reversed, and made again, and the reasons are
recorded here so they do not get re-litigated.

---

## 1. The setting is 1999. The renderer is not.

This is the single most important visual rule in the project.

**Retro describes the SETTING, not the rendering technology.**

The world is a 1962 municipal building, refurbished in 1978, full of 1999 office
equipment. The picture is modern indie horror: PBR materials, real shadows,
environment reflections, volumetric-feeling light, tasteful post.

**Never add:**

* vertex snapping or polygon wobble
* affine texture mapping
* deliberate pixelation or low-resolution buffers
* intentionally bad textures
* "PS1 filter" post-processing

**Always keep:**

* consistent texel density (UVs are authored in METERS — see `src/world/geo.js`)
* every surface carrying albedo + normal + roughness
* soft shadows on the lights the player actually looks at
* the dispatch desk and the main office getting the largest share of the detail
  budget, because that is where the player spends the game

The one exception is the CRT, which is allowed — required — to look like a CRT:
scanlines, phosphor bloom, barrel glass. That is a prop behaving correctly, not
the renderer pretending to be old.

## 2. The performance budget

The first build of this game ran at **seconds per frame on an M1 MacBook Air**.
Not because of geometry -- the office is 22k triangles and about 100 draw calls
from the desk -- but because of three decisions that are easy to make again.
Do not make them again.

### 2a. Lights are the budget. There are ten of them.

three.js is a **forward renderer**. Every light in the scene is evaluated by
every fragment of every object, every frame. The light count is a direct
multiplier on the cost of every pixel in the game.

The first build had **37**: a spot light and a fill point light inside each of
thirteen ceiling troffers, plus the exterior, the desk lamp, two exit signs, a
vending machine, and a glow light inside each of three CRTs including the two
that are switched off all night.

It now has **7 to 11**, depending on quality preset:

| | |
|---|---|
| ceiling | a POOL of 1-4 spots, lent to the nearest fixtures (`lighting.js`) |
| roaming fill | 1 point, follows the player |
| desk lamp | 1 spot |
| CRT glow | 1 point, the dispatch terminal only |
| exterior | 1 point (one of the two sodium yard lights; the other is emissive) |
| ambient | 1 hemisphere + 1 directional for the storm |

**If you add a light, subtract a light.** Before reaching for one, check
whether an emissive material plus the bloom in the post chain will do — that
is what the exit signs, the vending machine and eleven of the thirteen
troffers use, and it is free.

Never change the light COUNT per frame. Changing it forces three.js to
recompile every material in the scene. The pool fades unused slots to zero
intensity instead of removing them, and `Lighting.setPoolSize()` is a
settings-time operation only.

### 2b. The room is lit by a bake, not by lights

`world/bake.js` evaluates all thirteen fixtures once at load into a per-vertex
irradiance term, injected into the standard material's shader as
`totalEmissiveRadiance += bakedLight * diffuseColor.rgb`. Full-room lighting,
zero per-frame cost.

Two things to know before touching it:

* **It adds irradiance, it does not multiply albedo.** three's built-in
  `vertexColors` multiplies the diffuse color, which can only darken. Baking
  that way produces a uniformly black building.
* **A vertex bake is only as detailed as the mesh.** `geo.js` subdivides any
  surface over 1.2m for exactly this reason. A floor that is one quad has
  nowhere to put the light.

The bake cannot move, so it scales with the mains (`setBakedPower`) and the
pooled lights supply the flicker the player can actually watch.

### 2c. Pixel ratio defaults to 1, even on Retina

A 2x display renders four times the fragments. In a dark, grainy, heavily
post-processed game that is close to invisible and close to unaffordable. It is
an option (`Options > RESOLUTION`), not a default.

### 2d. There is an adaptive scaler, and it is not a substitute for the above

`renderer.js` watches a rolling median frame time and walks the internal render
scale down to hold the frame budget. It exists so the game degrades smoothly on
unknown hardware. It is not permission to be wasteful: it only trades
resolution, and a scene with 37 lights is still slow at 50% resolution.

### 2e. Measure, do not guess

`node tools/perf.mjs` prints lights, shadows, draw calls, triangles, render
target and frame rate at each preset. **The frame rate is meaningless** — it is
SwiftShader in a container — but the light count and the draw calls are not.
In game, **F3** shows the same numbers live.

## 3. The terminal has two renderers, and neither is a stretched bitmap

`ui/terminal.js` is a state machine that produces a `describe()` — a title, a
list of rows, and the keys that are live on this screen. Two things render it:

* **the tube** (`drawTube`) — a coarse canvas used as the emissive texture on
  the monitor in the 3D scene, so the CRT lights the room. Nobody reads it.
* **the view** (`ui/terminalview.js`) — real DOM, shown when the player leans
  in. This is what is actually read.

Because both come from the same description they cannot disagree. **Add new
kinds of screen content as row kinds, not as one-off drawing code.**

Three rules that came out of the first version being unusable:

1. **Size the UI in `cqw`, against `#cabinet`.** The first terminal drew an
   80-column character grid into a 720x540 canvas and stretched it over the
   screen: nine-pixel cells, upscaled and blurry. Text must scale with the
   window.
2. **A takeover is opaque.** The first overlay was 90% opaque over a live 3D
   room, so the storm kept moving behind the text and players read it as the
   camera drifting while they were trying to work.
3. **Column widths belong to the screen, not the stylesheet.** `COLS` in
   terminal.js is shared between a header row and its item rows so they can
   never drift apart.

While the terminal is focused the player is locked: no look, no movement. The
HUD is hidden, so anything urgent — a ringing line — must be surfaced in the
terminal's own status bar, or it is invisible.

**The screens are on the number row, 1–5.** They were on F1–F6, which most
laptops put behind an `Fn` chord — the terminal was effectively unusable
without a desktop keyboard. F1–F6 stay as aliases, and the account search
therefore does **not** accept digits. The perf overlay also lives on F3; it is
suppressed while the terminal is up for exactly that reason.

### 3a. The terminal is a tool, not a job

Every screen has to pay for the keypresses it costs. The first version had six
screens and made the player earn each call: open the terminal, switch to
accounts, type the caller's name a letter at a time, RETURN, RETURN, switch to
tickets, N, pick a cause, RETURN, switch to units, pick one, RETURN. Fifteen
inputs of clerical work, identical every call, fourteen times a night. It was
accurate to the job and it flattened the horror: by the third strange call the
player is doing data entry, and data entry is not frightening.

What it costs now: the number arrives with the call and the account arrives
with the number, so **RETURN, N, a cause, RETURN, RETURN** is a whole call —
seven presses, no typing.

Three rules came out of that:

1. **The terminal does the clerical work. The player makes the decisions.**
   Looking up an account the terminal already knows is not a decision. Which
   unit to send, whether to believe the address, whether to promise a time —
   those are decisions. Automate the first kind; never automate the second.
2. **A screen whose job is to list the other screens is not a screen.** The
   old MENU duplicated the tab strip sitting directly above it. Screen 1 is
   now the caller.
3. **Where an action ends is where the next one starts.** Writing a ticket
   leaves you on that ticket with its units open and the recommended one under
   the cursor. Nothing should ever make the player go and find the thing they
   just created.

A search field is a field, not a document: typing after a completed search
starts a NEW query. The first version appended, so a second lookup left the
player editing "DALEYPRZ" — and because the results list was non-empty, RETURN
was read as "open the selected row" and opened the *previous* search's first
hit. Any list that can go stale relative to its input needs to know which
input it belongs to; `terminal.searched` is that.

The one thing deliberately NOT automated: pulling the record is still a
keypress. Several conversations gate on the player having read the account
(`requires.lookedUp`), and the anomalies live in the detail — the meter that
reads wrong, the service date in the wrong decade. A record the player never
opened is a record they never read.

### 3b. A call docks under the terminal. It does not get hidden behind it.

The terminal used to take the whole screen, including the conversation the
tutorial was waiting on: the player was told to do something by a voice they
could no longer read. A live call now renders **below** the terminal frame
(`#cabinet.in-terminal`), and the terminal reserves room for it.

That puts two panels on screen that both want the arrow keys, so **they take
turns and the owner is visible**:

* a new set of replies takes the keys (`CallUI.showChoices`) — somebody is
  waiting;
* anything that works the terminal — a screen key, a row, a tab, the mouse —
  hands them back (`callUI.setFocused(false)`);
* the telephone key (`answer`) fetches them to the caller.

The unfocused panel dims and its key line changes to say how to get back. Do
not add a third thing that wants the arrow keys without deciding where it sits
in that order.

Inside the account search, letters are letters: `F`, `H` and `X` type instead
of working the phone, because a name with an F in it has to be typeable. Pad
buttons are unambiguous and always work.

### 3c. Every binding lives in `engine/controls.js`

One table, `ACTIONS`. Each entry lists the keys it answers to, where it sits
under the standard gamepad mapping, and what to print for it on a keyboard, an
Xbox pad and a PlayStation pad.

* **A pad button is a key.** `input.js` folds button presses into the same
  held-key set (`PadA`, `PadUp`, `PadRT`…), so game code never branches on
  whether a controller exists. Only `controls.js` and `input.js` know.
* **Never print a key name as a literal.** Ask `label(action, scheme)`, or
  write `{action}` in a string and run it through `expand()`. Tutorial hints do
  exactly that, which is why "press H, then H again" becomes "press X, then X
  again" the moment a pad is plugged in. A literal `'H'` in a UI string is a
  bug on a controller.
* **Losing the pointer lock is reported, never acted on.** Pausing on unlock is
  what produced the pause-menu loop: leaving the terminal re-requests the lock,
  Chrome denies it for about a second after an exit, the denial looked like the
  player asking for their cursor back, and closing the menu requested it again.
  The HUD says `CLICK TO LOOK AROUND` instead. `tools/controls.mjs` asserts the
  loop stays dead.
* **And the lock comes back by itself.** Treating that first refusal as final
  left the camera dead after every trip to the terminal. The exit is ours, so
  the browser will hand the lock back once its cooldown passes: `_retryLock`
  keeps asking every 0.7s instead of waiting for a click.
* **A pad button is not a key, at the edges.** Inside the game they are the
  same set, but `terminal.js` reads `e.key` and only understands keyboard
  names — so `PadA` and the d-pad fell straight through its switch and d-pad
  navigation inside the terminal never worked at all. `PAD_AS_KEY` in game.js
  substitutes the equivalent key at that boundary. Anywhere else a subsystem
  reads raw key names, expect the same bug.
* **A screen that needs a letter key is broken on a controller.** The search
  box opens on-screen keys; the hazard flag is a row; a new ticket is a row as
  well as a trigger. `tools/pad.mjs` plays a whole call with pad buttons only
  and is the guard against this coming back.
* **No full-screen layer may take pointer events.** `#call` did, and while a
  call was on screen every click in the game landed on the call panel instead
  of the canvas — so the one gesture that could have restored the lock never
  arrived. Layers are `pointer-events: none`; the panels inside them opt in.
* **Auto-repeat does not reach the game.** Only `REPEATABLE` keys (text
  editing, arrows) are forwarded while held; a held `Esc` used to toggle the
  pause menu dozens of times a second.

### 3d. Every state needs a visible way out

Sitting down was a one-way door for weeks: standing again was `Q`, `Q` was
printed nowhere during play, and the chair's own prompt still read "Sit" while
you were sitting in it. Nobody reads the how-to panel mid-shift.

So: if the game can put the player into a state, the way out of that state has
to be visible **from inside it**. The seated bar in the corner exists for that
reason, and so does `seatedVerb` on an interaction spec.

The same rule caught a quieter bug: there are two ways into the chair (using
it, and leaning into the terminal, which seats you on the way) and only one of
them recorded that it had happened, so a player who reached for the computer
first sat there being told to sit down. One way in — `game.sitAtDesk()` — for
anything a gate can wait on.

### 3e. Everything else the player can open is one panel

The breaker panel, the day book, the fax tray, the card index and the incident
file are not computers, and they deliberately do not look like one: no amber
phosphor, no scanlines, no 80 columns. They are paper and metal under a work
light, and they all render through `ui/propui.js`.

**One panel, not five.** The player has already learned up / down / select /
back from the terminal; teaching them a second set of keys for the filing
cabinet would be worse than useless. A new readable object is a `show({ id,
title, sub, rows, onPick })` call, with the same row kinds.

Two things that follow from §3d and are easy to break:

* **The head and the key hints are pinned; only the body scrolls.** A long
  service card used to push "< PUT IT BACK" off the bottom of the sheet, which
  is a state with no visible way out.
* **A document is not a list.** On a page whose only item is "put it back",
  up and down turn the page instead of jumping the cursor, and the key hints
  say "read on" rather than "choose". Cards and faxes are read, not navigated.

Blank lines in a card or a fax are **authored** — they are the layout of a
typed form — so an empty `text` row renders as a real gap, not as nothing.

## 4. Dialogue is data. Always.

Every conversation in this game is a plain object in `src/data/calls/`. Nothing
in `src/game/` knows the name of a single character.

**To add a conversation:**

1. Copy any file in `src/data/calls/`.
2. Change the `id`.
3. Add one import line to `src/data/calls/index.js` and list it in `CALLS`.

That is the whole integration. You do **not** touch `phone.js`, `calls.js`,
`dialogue.js`, or `effects.js` to add dialogue.

**Never** express story logic as nested conditionals in engine code. If a call
needs something the format cannot express, add an **op** to `src/game/effects.js`
(one case, documented in the header comment) or a **requirement key** to
`meets()` in `src/game/dialogue.js` — then use it from data.

Run `node tools/calls.mjs` after any dialogue change. It validates the graph,
every `goto`, every op name, every horror event name, every scheduled call id,
and flags unreachable nodes.

### Teaching by waiting

A node with a `waitFor` block holds the conversation until the player has
actually done something:

```js
wait_ticket: {
  speaker: 'caller',
  waitFor: { flags: ['created_a_ticket'] },
  hint: 'OPEN A TROUBLE TICKET -- F3, then N, choose a cause, then RETURN',
  next: 'ticket_done',
}
```

`waitFor` takes the same keys as a choice's `requires` (see `meets()`), so it
can wait on a lookup, an open ticket, a dispatched crew, a flag or a counter.
`hint` goes on screen as the objective until the gate opens. This is how the
handover call teaches, and any later call can use it to wait on real work.

A `waitFor` node **must** have a `next` and must not have `choices`; the
validator enforces both, because a gate with no exit strands the player with an
instruction and no way out.

### The loop trap

A reply that returns to the node it came from (`"let me check that"`,
`"bear with me"`) **must** be marked `once: true`, and its node must have at
least one reply that always progresses. Every call in the repo was written with
this bug at least once; `tools/soak.mjs` catches it.

### Sequences are data too

A multi-minute authored event — the cascade at the end of Act I, 4:17, the
knock at the rear door, dawn — is a list of steps in
`src/data/sequences/index.js`, run by `src/game/sequences.js`:

```js
{ label: 'silence', wait: 9 },
{ label: 'the chair', do: [{ op: 'haunt', id: 'chair_turned' }], wait: 4 },
{ label: 'power back', until: (ctx) => ctx.power.allLive, timeout: 240 },
```

`do` is the same effect ops the dialogue uses. `wait` is seconds. `until` is a
condition with a `timeout` so a sequence can never soft-lock the night. Give
every step a `label`: the harnesses print them, and a sequence that stalls is
diagnosed by reading the last label rather than by guessing.

**A `wait` step is allowed to be long.** The nine seconds of silence after the
building dies are the most important nine seconds in Act I, and the instinct
to fill them is wrong.

## 5. Horror is escalation, not jumpscares

`src/game/horror.js` is organised in tiers and they must stay that way:

* **Tier 1** — the storm could be doing this. Flicker, brownout, a lightning strike.
* **Tier 2** — something is wrong with the equipment. A CRT glitch, clocks
  drifting apart, the radio catching something.
* **Tier 3** — no innocent reading is left. A ringing line with nobody behind
  it, records changing while you are not looking, time going backwards.

**The game must not stay ambiguous forever.** Early events get an explanation
and the player is allowed to keep it. Later events take the explanations away
one at a time. By the end of the night, the temporal nature of what is happening
must be undeniable and stated plainly by a character.

**Never** solve a horror beat with a monster, a face at a window, or a loud
noise on a cut. The horror is: voices, impossible information, dead callers,
contradictory clocks, corrupted records, familiar voices being imitated, missing
time, and calls from other decades.

**Adding an event:** one entry in `HORROR` in `src/game/horror.js`, with
`start`/`update`/`end`. Then fire it from data: `{ op: 'horror', event: 'name' }`.

### 5a. Three kinds of horror, and they are not interchangeable

There are two directors and the difference between them is the difference
between a scare and a haunting.

* **Transient** — `src/game/horror.js`. Something happens and then it is over:
  a flicker, a brownout, a grade wobble, a burst of interference, a CRT
  glitch. It lives for a number of seconds and restores itself. Fourteen of
  these exist and they are the texture, not the event.
* **Persistent** — `src/game/haunt.js`. Something *changes and stays changed*
  until the player deals with it: the chair is turned around, the handset is
  off the hook, a drawer is open, a ticket the player did not write is on the
  console, the Records room is dressed as 1978. It is armed while the player
  is elsewhere, it is noticed by walking near it, and it can be put back by
  hand.
* **Spatial** — the subset of the above that is attached to a *place*. Each
  entry in `HAUNTS` carries a `notice` with a position and a radius, so the
  event belongs to the corridor or the Records counter rather than to the
  screen. The player finds it; it is not shown to them.

**Prefer persistent over transient.** An effect the player watches is worth
less than an object they have to walk over and touch. A flicker is deniable
five seconds later. A chair that is still facing the wrong way when you come
back with a coffee is not.

Rules for `haunt.js`:

* Only one haunt is armed at a time, and `spacing` seconds must pass between
  them. Two at once reads as a malfunction, not a presence.
* A haunt arms **while the player cannot see it** (`canArm`) and is discovered
  by proximity, never by a cut or a camera move.
* Every haunt must be reversible by the player — `clear()` — because putting
  the chair back is the interaction that makes it real.
* Nothing in `haunt.js` may touch or block the player. No chasing, no
  cornering, no damage, no hiding mechanic. See §5.

### 5b. The night has acts, and silence is content

`src/game/acts.js` is the shape of the shift. A beat number maps to an act
(`actFor`), and an act carries the pacing:

| Act | When | Gap between ordinary calls |
|---|---|---|
| I — the job | 22:45 → the 1978 call | 34–78s |
| II — the building | after the cascade | 46–105s |
| II-LULL — around three | the mid-shift lull | 95–190s |
| II-LATE — the crisis builds | before 4:17 | 40–92s |
| III — 4:17 | the signature sequence | 8–20s, and the rules are off |
| IV — dawn | after 5:00 | 60–140s |

`CLOCK` in the same file is the timetable the night is hung on: midnight, the
lull at 02:40–03:30, the traffic thinning at 04:08, **04:17**, the sky going at
05:00, headlights at 05:45, the end of shift at 06:00. Anything that needs to
happen at a time reads it from there rather than carrying its own number.

A **gap is silence** — handset down to next ring, not call start to call
start. `CALL_END` and `DIALOGUE_END` reset it. Measuring from the start of a
call means a 55-second conversation eats the pause that was supposed to follow
it, and the night turns into a call centre. That bug has been written once
already; do not write it again.

`tools/pacing.mjs` exists to fail if somebody "improves" the game by filling
it in. **The game should contain silence. Silence is a feature.** The lull
around 3 AM is authored, it is genuinely quiet, and it must not be broken with
a loud noise — the point of it is that the player relaxes.

The director's `_workload()` also widens the gap for a player who is busy:
open tickets, crews in the field, the terminal in focus, a task that has them
out of the room. Being punished for working is the same failure as being
punished for exploring.

## 6. Ordinary calls are load-bearing

Do not cut the mundane conversations to make room for more scares. They are what
the scares are measured against. A shift that is all anomaly is a shift with no
anomalies in it.

Normal callers must sound like people: they hesitate, interrupt, misunderstand,
get irritated, joke, change the subject, over-explain, apologise, and remember.
Write them as if the horror were not coming.

The director enforces this rhythm with `mundaneDebt` — a strange call raises it
and ordinary calls pay it down, so supernatural calls always land against a
floor of real work. Do not remove that mechanism; tune the numbers if needed.

## 7. The reason to get up

> ### THE REASON TO GET UP MUST COME FROM THE JOB, AND THE COST OF GETTING UP MUST BE THE PHONE.

This is a hard rule, the same weight as §1 and §5, and the entire building is
built around it.

The desk is safe. It has a task, a screen and a telephone that tells you what
to do next. That is exactly why the horror needs the player out of it — and it
is also why the player must never be *lured* out of it.

**Never** get the player up with:

* a noise in the corridor that means nothing,
* a door that unlocks because a timer said so,
* "go and look at the spooky thing",
* an objective that exists only to put them in a haunted room.

**Always** get them up with work a night dispatcher would actually do:

* the terminal is dead and the breakers are at the end of the corridor,
* a caller gave a service number the CIS has never heard of and the paper
  cards are in Records,
* the supervisor said to write anything you cannot account for in the book,
  and the book is on the Records counter,
* the fax has printed something and the fax is not at the desk,
* the desk radio has stopped transmitting and the base station is on the wall
  outside,
* it is three in the morning and the coffee is in the break room.

Those live in `src/game/tasks.js`, one entry each, as data. Anything can raise
one — a call script (`{ op: 'task', id: '...' }`), a sequence, a system.
One at a time.

### 7a. The cost is the phone, and the cost must be real

Ordinary traffic keeps ringing while a task is open. The player *will* be in
Records with the handset ringing behind them, and deciding whether to finish
the sentence is the entire mechanic. Do not soften that.

### 7b. Story beats do not fire into an empty chair

The corollary, and it is not optional: **if the player is away from the desk,
story calls WAIT.** `CallDirector.playerAway` is true whenever a task has the
player in another room, and `update()` gates beat and time calls on it.

Ordinary calls ring anyway — that is the cost. A *scripted* beat firing into
an empty room is not a cost, it is a bug: it burns the scene, and it teaches
the player that leaving the chair loses content. That is the fastest possible
way to destroy everything in this section.

### 7c. The building keeps state

Doors (`src/game/doors.js`), light switches, breakers (`src/game/power.js`),
the paper log, the pulled service cards and the collected faxes all persist
and all serialize. A door the player left open is open when they come back. A
light they turned off is off — including when something else turns it back on.

Darkness the player caused themselves is worth more than darkness the game
imposed. Let them cause it.

## 8. Architecture

Systems own their own rules. `src/game/game.js` wires them together and owns
nothing. **If a feature can only be added by editing `game.js`, it has probably
been designed wrong.**

* Systems communicate through `src/engine/bus.js`, not by holding references.
* Event names live in `EVENTS` in that file. Add yours there.
* Props expose what other systems need on `userData` under a stable name
  (`screenMaterial`, `lineLamps`, `handset`, `vuNeedle`). Swap the model, keep
  the names, and nothing downstream breaks.
* Interaction logic lives in `src/world/dress.js`, never inside a prop builder.
* Geometry is built from data (`src/world/plan.js`), not hand-placed in code.

The building added a lot of systems and none of them live in `game.js`:

| | |
|---|---|
| `game/acts.js` | the shape of the night: beats, acts, pacing, the clock timetable |
| `game/power.js` | four circuits, what trips them, what a trip does to the room |
| `game/doors.js` | door leaves and per-room lights, with state that persists |
| `game/tasks.js` | the reasons to get up (§7) |
| `game/paperlog.js` | the book on the Records counter |
| `game/archive.js` | paper service cards, ledgers and the 1978 incident file |
| `game/fax.js` | the fax machine's queue, its print head and its tray |
| `game/phones.js` | every telephone in the building, positioned, ringable |
| `game/haunt.js` | persistent and spatial horror (§5a) |
| `game/sequences.js` | the runner for authored multi-minute events |
| `world/gear.js` | the props those systems need: panel, fax, base station, log book, card index |
| `ui/propui.js` | **one** panel that renders all of them, because five bespoke UIs is five bugs |

`game.js` grew exactly what wiring requires: construction order, the
`_buildingTick` that asks the building where the player is, and the open/read
handlers the interaction system calls. If a new feature needs more than that
from `game.js`, it is in the wrong file.

### Naming

* `restore(data)` means "load a saved snapshot" on every system. If a system
  needs a domain verb that collides with that, rename the domain verb
  (`OutageRegistry.markRestored`).
* Shift time is in **minutes since midnight**, as a float. Never seconds.
* Map coordinates are in **map units** (roughly km), +X east, +Y north.
* World coordinates are in **meters**, +X east, +Z south, +Y up.

## 9. Testing

**Do not assume code works because it looks correct.** These harnesses exist
and all of them have caught real bugs:

| | |
|---|---|
| `node tools/calls.mjs` | static validation, no browser. Run it on every dialogue change. |
| `node tools/boot.mjs` | boots the real game headless and fails on any console error |
| `node tools/soak.mjs` | runs **every call script to completion on three different reply strategies** — this is what catches dead ends and infinite loops |
| `node tools/playthrough.mjs` | drives Act I with real key events and asserts 31 things about the result |
| `node tools/fullnight.mjs` | plays the **whole night** — every act, every sequence, 4:17, dawn, the ending — satisfying every `waitFor` gate with the real action, and then arms all eleven persistent events and puts them back |
| `node tools/pacing.mjs` | runs the director at real pacing in each act and measures the **silence**. It fails if the night gets filled in |
| `node tools/audio.mjs` | taps the audio buses and measures RMS, spectral balance and voice-chain leaks |
| `node tools/tutorial.mjs` | plays the handover call and asserts every `waitFor` gate opens on the right action, that the call stays readable inside the terminal, and that every instruction reaches the screen with real key names |
| `node tools/controls.mjs` | key routing: the number row, the arrow-key handover between a docked call and the terminal, pad buttons through the same path `input.js` uses, the pause-menu loop, and that the camera comes back on its own |
| `node tools/render.mjs` | renders the audio offline to real WAVs and measures the envelope. The only harness that can tell rain from static |
| `node tools/pad.mjs` | plays a whole call with pad buttons only — no keyboard event is generated anywhere in it |
| `node tools/perf.mjs` | lights, draw calls and render target at each quality preset |
| `npm run check` | all of the above except perf and shots |
| `npm run shots` | captures the game at 20 moments, so visual regressions are visible |

The harnesses render through SwiftShader at a few frames a second. **Anything
frame-rate dependent will look broken there and be fine on real hardware** —
the seated camera blend is the known example. When a harness disagrees with the
game, instrument before you "fix" anything.

**Game time in a harness runs at about a sixth of wall time.** `dt` is clamped
to 0.05s a frame and SwiftShader draws about three frames a second, so ten
wall seconds are under two game seconds. Anything measured in game seconds —
call gaps, sequence waits, haunt spacing — has to be compressed explicitly by
the harness, not waited out. `director.fastForward`, `sequences.speed` and
`haunt.spacing` exist for exactly that, and `tools/fullnight.mjs` documents the
arithmetic at the top. A harness that "hangs" is usually one that is patiently
waiting for a game minute that will arrive in six real minutes.

Never make a test pass by weakening the assertion.

## 10. Code style

Match the surrounding code.

* ES modules, no build step, no transpiler, no framework.
* Comment blocks at the top of a file explain **why the file exists and what
  decision it encodes**, not what the next line does.
* Prefer a data table over a switch; prefer a switch over an if-chain.
* No `TODO:` stubs where a working implementation is feasible. If something is
  genuinely deferred it goes in `ROADMAP.md`, not in a comment.
* Keep `src/vendor/` unmodified. If three.js needs patching, wrap it instead.

## 11. Audio

Everything is synthesized. Two rules learned the hard way:

* **Steady filtered noise is not weather, it is static.** The first rain loop
  was two band-filtered noise sources at a fixed gain, and it sounded exactly
  like a blown speaker for the entire game. Rain needs a bass-dominant wash,
  slow gusts, and discrete droplet transients — the droplets are what the ear
  uses to decide it is hearing weather. `tools/audio.mjs` asserts the rain is
  bass-weighted; if `high` approaches `low`, it has become hiss again.
* **Every line chain carries a running noise bed.** If a chain is not finished
  it runs forever and the room fills with hiss one call at a time. `speak()`
  has a hard timeout backstop and `audio.liveVoices` reports the count; the
  audio test asserts it returns to zero.

A 7.8kHz tone sits right where the ear is most sensitive. Do not put one in the
room tone. Anything in that range belongs behind `Options > ROOM TONE`.

### Two things that were wrong twice, and why

**"It sounds like static."** Both times the cause was the same: a bed of
**white** noise at a fixed gain. White noise has equal energy per hertz, so a
lowpass only tilts it — there is always hiss left on top — and a level that
never moves has no weather in it. Rain is brown noise for the wash, a pink
sheet whose level wanders on a random walk (not an LFO: an LFO is periodic and
reads as an effect), and thirty to seventy discrete impacts a second in three
sizes. **The droplets are the sound.** A rain recording with its transients
removed is static.

**"It sounds like beeps."** The first voice synthesizer cycled six vowel
colours in step with a syllable count: right rhythm, no texture. What was
missing was not filter quality, it was **consonants and transitions**. Speech
is mostly the movement between targets — formants that slide, turbulence, and
the silences in the middle of words that are stops. `engine/phonemes.js` maps
spelling onto a rough phoneme string and `speak()` plays it through three
sliding formants, a noise channel and a glottal source with jitter and
vibrato. Nothing is meant to be intelligible: every line arrives through a
300–3400Hz band, and the target is a voice you can hear the shape of and not
quite make out.

### Measure it offline, then listen

`tools/render.mjs` runs the engine in an `OfflineAudioContext`, writes WAVs to
`./audio`, and measures the **envelope** — level variation, crest factor,
onsets per second — because a spectrum genuinely cannot tell rain from static.
Assertions compare rain against the radio's inter-station hiss, which is real
static and is supposed to be.

**Then listen to the files.** Every audio bug in this project so far passed
whatever numeric check was in place at the time.

## 12. Assets

The game currently ships zero binary assets and that is a feature, not a gap —
it means every material, sign, model and voice can be replaced independently.

When real assets arrive:

* **Textures** — `IMAGE_OVERRIDES` in `src/engine/materials.js`, or
  `MaterialLibrary.override(name, {map, normalMap, roughnessMap})` before the
  world is built. Do not edit the recipes to approximate art; replace them.
* **Voices** — put `clip: 'some_id'` on a dialogue line and register the file
  with `audio.registerClip('some_id', url)`. Line-by-line. The line's timing,
  the telephone chain and the subtitle all keep working.
* **Models** — a prop builder returns a `THREE.Group`; replace the body of the
  function, keep the `userData` contract, keep the origin and the scale.
* **Never** bake game logic into a model.

Keep filenames descriptive and organised by subject, not by type.
