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

## 3. Dialogue is data. Always.

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

### The loop trap

A reply that returns to the node it came from (`"let me check that"`,
`"bear with me"`) **must** be marked `once: true`, and its node must have at
least one reply that always progresses. Every call in the repo was written with
this bug at least once; `tools/soak.mjs` catches it.

## 4. Horror is escalation, not jumpscares

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

## 5. Ordinary calls are load-bearing

Do not cut the mundane conversations to make room for more scares. They are what
the scares are measured against. A shift that is all anomaly is a shift with no
anomalies in it.

Normal callers must sound like people: they hesitate, interrupt, misunderstand,
get irritated, joke, change the subject, over-explain, apologise, and remember.
Write them as if the horror were not coming.

The director enforces this rhythm with `mundaneDebt` — a strange call raises it
and ordinary calls pay it down, so supernatural calls always land against a
floor of real work. Do not remove that mechanism; tune the numbers if needed.

## 6. Architecture

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

## 7. Testing

**Do not assume code works because it looks correct.** Four harnesses exist and
all of them have caught real bugs:

| | |
|---|---|
| `node tools/calls.mjs` | static validation, no browser. Run it on every dialogue change. |
| `node tools/boot.mjs` | boots the real game headless and fails on any console error |
| `node tools/soak.mjs` | runs **every call script to completion on three different reply strategies** — this is what catches dead ends and infinite loops |
| `node tools/playthrough.mjs` | drives a whole shift with real key events and asserts 23 things about the result |
| `node tools/audio.mjs` | taps the audio buses and measures RMS, spectral balance and voice-chain leaks |
| `node tools/perf.mjs` | lights, draw calls and render target at each quality preset |
| `npm run check` | all of the above except perf and shots |
| `npm run shots` | captures the game at 20 moments, so visual regressions are visible |

The harnesses render through SwiftShader at a few frames a second. **Anything
frame-rate dependent will look broken there and be fine on real hardware** —
the seated camera blend is the known example. When a harness disagrees with the
game, instrument before you "fix" anything.

Never make a test pass by weakening the assertion.

## 8. Code style

Match the surrounding code.

* ES modules, no build step, no transpiler, no framework.
* Comment blocks at the top of a file explain **why the file exists and what
  decision it encodes**, not what the next line does.
* Prefer a data table over a switch; prefer a switch over an if-chain.
* No `TODO:` stubs where a working implementation is feasible. If something is
  genuinely deferred it goes in `ROADMAP.md`, not in a comment.
* Keep `src/vendor/` unmodified. If three.js needs patching, wrap it instead.

## 9. Audio

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

## 10. Assets

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
