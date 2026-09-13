# PLEASE HOLD

**A first-person narrative horror game set in the overnight dispatch office of a
rural electric utility, November 1999.**

You are the only person in the District Operations Center of Wright County Power
& Light. There is a storm across the district, three trucks for a whole county,
and a telephone that has been on that desk since 1961.

Take the call. Get the address. Confirm it against the account, not against the
caller. Open a ticket. Send a unit that is rated for the work.

Do not promise a restore time.

![the dispatch desk](docs/shots/05-seated.png)

---

## The setting is 1999. The renderer is not.

This is deliberate and it is the project's main visual rule. The world is a
1962 municipal building refurbished in 1978 and full of 1999 office equipment,
rendered with modern lighting, shadows, reflections and post-processing. There
is no vertex wobble, no affine texture warping, no fake pixelation. See
`AGENTS.md` for the full standard.

Every surface material is procedurally generated at boot — commercial loop-pile
carpet, mineral fiber ceiling tile, orange-peel drywall, waxed VCT, oak
laminate — so the game ships with no texture pack and every material can be
replaced with real art one file at a time.

---

## Engine

No engine. No build step. No framework.

* **Vanilla JavaScript**, ES modules, served as static files
* **[three.js](https://threejs.org) r169** (WebGL2), vendored at `src/vendor/three.module.js`
* Custom post-processing chain (bloom, ACES tonemap, grade, grain, vignette,
  chromatic aberration) written for this project — `src/engine/postfx.js`
* All audio synthesized at runtime with **WebAudio** — no sound files
* **Electron** for desktop builds
* **playwright-core** for the headless test harnesses

Requires a browser with WebGL2. Node 18+ only to run the static server and the
tests.

---

## Running it

```bash
npm start            # serves on http://localhost:8080
```

Then open <http://localhost:8080>.

It must be served over `http://` — browsers refuse to load ES modules from
`file://`.

### As a desktop app

```bash
npm install          # pulls electron + electron-builder (dev only)
npm run app          # run it
npm run dist         # package for the current platform
```

### Tests

```bash
npm run check        # everything: validator, boot, soak, playthrough
node tools/calls.mjs # validate every call script (no browser needed)
npm run shots        # capture screenshots to ./shots
```

---

## Controls

### Moving
| Key | |
|---|---|
| `W A S D` | walk |
| mouse | look |
| `Shift` | move quickly |
| `E` | use what you are looking at |
| `Q` | stand up from the desk |
| `Esc` | pause |

### The telephone
| Key | |
|---|---|
| `F` | answer the ringing line |
| `1` – `4` | choose a reply |
| `H` | put the caller on hold / return to a held caller |
| `X` | hang up |

A caller on hold is still there and still counting. Some will wait a long time.
Some will not, and they will remember.

### The terminal
| Key | |
|---|---|
| `T` | lean in to the CRT / step back |
| `F1` – `F6` | menu, accounts, tickets, map, dispatch, log |
| arrows | move the selection |
| `Return` | search, open a record, assign a unit |
| `Space` | open the selected account |
| `N` | open a new trouble ticket |
| `H` | (on a new ticket) mark it a hazard |
| `Esc` | back |

Several dialogue replies are only available once you have actually looked
something up. That is deliberate: you cannot confirm a service address you have
not read.

---

## What is implemented

**Systems**

| | |
|---|---|
| First-person movement | acceleration, collision, head bob, footsteps, a real seated mode at the desk |
| Interaction | center-screen raycast, per-object range, seated-only objects |
| Telephone | six line appearances, ring cadence, hook, **hold with per-caller patience**, hold music, auto-park when you pick up a second line |
| Calls | fully data-driven scripts (`src/data/calls/`), validated at boot and in CI |
| Dialogue | node graph, requirement-gated player replies, declarative effects |
| Caller memory | per-caller trust, what they told you, what you promised, hold time, hang-ups |
| Customer database | 13 accounts, search by account/name/phone/address/circuit, lookup tracking, and deliberate corruption |
| Outages | trouble tickets, causes, hazards, priority, meter counts, history |
| Service-area map | one territory definition drives the wall map *and* the CRT map |
| Dispatch | crew recommendations with ETA, skill rating and a stated reason |
| Field crews | 3 units that drive, arrive, work, and clear over the radio in real shift time |
| Radio | queued traffic, squelch, per-crew voices, interference |
| Story scheduler | beat calls, time calls, a weighted random pool, and a rhythm rule that keeps ordinary work between the strange calls |
| Horror | 13 named events from "the storm could be doing this" to events with no innocent reading |
| Environment | procedural office, storm exterior, rain volume, rain-on-glass shader, lightning, fluorescent ballast simulation |
| Audio | full synthesis: rain, thunder, ballast hum, CRT whine, ring, dial tone, DTMF, squelch, hold music, and **five telephone line treatments** |
| Game clock | shift time, and events that can lie about it |
| Save | checkpoint at every story beat |
| UI | title, options, how-to, pause, HUD, call panel, CRT reader, end-of-shift report |

**The shift** — 13 call scripts, 211 nodes, 374 lines, 159 player replies:

* four ordinary utility calls that teach the job and give the night its texture
* **Mrs. Daley**, who calls twice and remembers what you did the first time
* a hazard call that forces a real trade-off against a finite number of trucks
* a crew sequence over the radio that finds something that should not be there
* a suspicious address that still has an innocent explanation
* an EVP call built on a real audio chain, not on the words `[STATIC]`
* a caller who says the year out loud, with corroborating evidence
* the dispatcher who worked this desk in 1978

---

## What it looks like

| | |
|---|---|
| ![the office](docs/shots/03-office.png) | ![a call](docs/shots/13-call-choices.png) |
| the dispatch room at 22:45 | a caller, and four ways to answer |
| ![an account](docs/shots/08-terminal-record.png) | ![the map](docs/shots/12-terminal-map-outages.png) |
| the CRT: an account, with a medical alert | the CRT: circuits with trouble |
| ![1956](docs/shots/15-1956-call.png) | ![please hold](docs/shots/20-please-hold.png) |
| a caller whose line does not sound like 1999 | the end of the slice |

---

## Repository layout

```
index.html            the shell: canvas + UI layers
serve.cjs             zero-dependency static server
src/
  main.js             boot
  style.css           the interface
  vendor/             three.js r169 (vendored, unmodified)
  engine/             renderer, postfx, materials, textures, noise, audio, input, bus
  world/              plan, office builder, props, workstation, signage, lighting, weather, dress
  game/               clock, state, settings, save, player, interaction,
                      phone, dialogue, effects, calls, database, outages,
                      crews, dispatch, radio, horror, game
  ui/                 hud, callui, terminal, menu
  data/
    calls/            ONE FILE PER CONVERSATION  <- add dialogue here
    accounts.js       the customer master file
    crews.js          the roster
    grid.js           the service territory
tools/                headless test + capture harnesses
electron/             desktop wrapper
```

## Where the assets live

There are no binary assets yet, by design. Everything is generated:

| What | Where | How to replace |
|---|---|---|
| Surface materials | `src/engine/textures.js` recipes | add a path to `IMAGE_OVERRIDES` in `src/engine/materials.js`, or call `MaterialLibrary.override()` |
| Maps, notices, labels, clock faces | `src/world/signage.js` | each function returns a `<canvas>`; return a loaded `<img>` instead |
| Models | `src/world/props.js`, `workstation.js` | each prop is a function returning a `THREE.Group`; interaction logic is attached in `dress.js`, never baked into the mesh |
| Voices | synthesized in `src/engine/audio.js` | put a `clip:` id on any dialogue line and register the file with `audio.registerClip()` — line-by-line, no other change |
| Sound effects | `AudioEngine.play()` | same |

---

## Known limitations

See `ROADMAP.md`. The short version: this is a vertical slice. The shift does
not yet run to 06:00 — it ends on the 1978 call.

&copy; 2026 EM Software Innovators
