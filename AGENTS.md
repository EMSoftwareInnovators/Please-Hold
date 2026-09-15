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

## 5. Horror is escalation, not jumpscares

`src/game/horror.js` is organised in tiers and they must stay that way:

* **Tier 1** — the storm could be doing this. Flicker, brownout, a lightning strike.
* **Tier 2** — something is wrong with the equipment. A CRT glitch, clocks
  drifting apart, the radio catching something.
* **Tier 3** — no innocent reading is left. A ringing line with nobody behind
  it, records changing while you are not looking, time going backwards.

**The game must not stay ambiguous forever.** Early events get an explanation
and the player is allowed to keep it. Later events take the explanations away
one at a time. By the end of a slice, the temporal nature of what is happening
must be undeniable and stated plainly by a character.

**Never** solve a horror beat with a monster, a face at a window, or a loud
noise on a cut. The horror is: voices, impossible information, dead callers,
contradictory clocks, corrupted records, familiar voices being imitated, missing
time, and calls from other decades.

**Adding an event:** one entry in `HORROR` in `src/game/horror.js`, with
`start`/`update`/`end`. Then fire it from data: `{ op: 'horror', event: 'name' }`.

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

## 7. Architecture

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

### Naming

* `restore(data)` means "load a saved snapshot" on every system. If a system
  needs a domain verb that collides with that, rename the domain verb
  (`OutageRegistry.markRestored`).
* Shift time is in **minutes since midnight**, as a float. Never seconds.
* Map coordinates are in **map units** (roughly km), +X east, +Y north.
* World coordinates are in **meters**, +X east, +Z south, +Y up.

## 8. Testing

**Do not assume code works because it looks correct.** These harnesses exist
and all of them have caught real bugs:

| | |
|---|---|
| `node tools/calls.mjs` | static validation, no browser. Run it on every dialogue change. |
| `node tools/boot.mjs` | boots the real game headless and fails on any console error |
| `node tools/soak.mjs` | runs **every call script to completion on three different reply strategies** — this is what catches dead ends and infinite loops |
| `node tools/playthrough.mjs` | drives a whole shift with real key events and asserts 29 things about the result |
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

Never make a test pass by weakening the assertion.

## 9. Code style

Match the surrounding code.

* ES modules, no build step, no transpiler, no framework.
* Comment blocks at the top of a file explain **why the file exists and what
  decision it encodes**, not what the next line does.
* Prefer a data table over a switch; prefer a switch over an if-chain.
* No `TODO:` stubs where a working implementation is feasible. If something is
  genuinely deferred it goes in `ROADMAP.md`, not in a comment.
* Keep `src/vendor/` unmodified. If three.js needs patching, wrap it instead.

## 10. Audio

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

## 11. Assets

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
