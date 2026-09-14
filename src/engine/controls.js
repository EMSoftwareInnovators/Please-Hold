/* ============================================================
   controls.js -- what the player can do, and what it is called.

   One table. Every binding in the game lives here, and a pad
   button is folded into the same key set the rest of the code
   already understands: pressing A on a controller puts `PadA`
   into the held-keys set, and `confirm` lists `PadA` alongside
   `KeyE` and `Enter`. Nothing outside this file and input.js
   needs to know a controller exists.

   The UI asks `label(action, scheme)` for what to print, so a
   key hint reads "E" on a keyboard, "A" on an Xbox pad and
   "CROSS" on a PlayStation one without any screen knowing which
   is plugged in.

   FUNCTION KEYS: the terminal's screens are on 1-6, not F1-F6.
   On most laptops the function row needs an Fn chord, which made
   the terminal effectively unusable without a desktop keyboard.
   F1-F6 are kept as aliases for people who have them.
   ============================================================ */

/**
 * `keys` are what the action listens for. `pad` is where it sits under the
 * standard gamepad mapping. `label` entries are what each input family
 * should print for it.
 */
export const ACTIONS = {
  /* ---------------- moving ---------------- */
  forward: { keys: ['KeyW'], pad: [], labels: { kbm: 'W' } },
  back: { keys: ['KeyS'], pad: [], labels: { kbm: 'S' } },
  left: { keys: ['KeyA'], pad: [], labels: { kbm: 'A' } },
  right: { keys: ['KeyD'], pad: [], labels: { kbm: 'D' } },
  run: { keys: ['ShiftLeft', 'ShiftRight', 'PadLT'], pad: [6], labels: { kbm: 'SHIFT', xbox: 'LT', playstation: 'L2' } },

  /* ---------------- lists and menus ----------------
     Deliberately separate from movement: a d-pad and the arrow keys drive
     menus, the left stick and WASD drive the player. */
  up: { keys: ['ArrowUp', 'PadUp'], pad: [12], labels: { kbm: 'UP', xbox: 'D-PAD', playstation: 'D-PAD' } },
  down: { keys: ['ArrowDown', 'PadDown'], pad: [13], labels: { kbm: 'DOWN', xbox: 'D-PAD', playstation: 'D-PAD' } },
  nav: { keys: [], pad: [], labels: { kbm: 'UP / DOWN', xbox: 'D-PAD', playstation: 'D-PAD' } },

  /* ---------------- the verbs ---------------- */
  confirm: { keys: ['Enter', 'KeyE', 'PadA'], pad: [0], labels: { kbm: 'E / RETURN', xbox: 'A', playstation: 'CROSS' } },
  select: { keys: ['Enter', 'PadA'], pad: [0], labels: { kbm: 'RETURN', xbox: 'A', playstation: 'CROSS' } },
  use: { keys: ['KeyE', 'PadA'], pad: [0], labels: { kbm: 'E', xbox: 'A', playstation: 'CROSS' } },
  cancel: { keys: ['Escape', 'PadB'], pad: [1], labels: { kbm: 'ESC', xbox: 'B', playstation: 'CIRCLE' } },

  /* ---------------- the telephone ---------------- */
  answer: { keys: ['KeyF', 'PadY'], pad: [3], labels: { kbm: 'F', xbox: 'Y', playstation: 'TRIANGLE' } },
  hold: { keys: ['KeyH', 'PadX'], pad: [2], labels: { kbm: 'H', xbox: 'X', playstation: 'SQUARE' } },
  /* Hang up sits on a trigger rather than a face button on purpose: it is
     the one action in the game you must not press by accident. */
  hangup: { keys: ['KeyX', 'PadRT'], pad: [7], labels: { kbm: 'X', xbox: 'RT', playstation: 'R2' } },

  /* ---------------- the desk ---------------- */
  terminal: { keys: ['KeyT', 'PadSelect'], pad: [8], labels: { kbm: 'T', xbox: 'VIEW', playstation: 'SHARE' } },
  stand: { keys: ['KeyQ', 'PadL3'], pad: [10], labels: { kbm: 'Q', xbox: 'L3', playstation: 'L3' } },
  screenPrev: { keys: ['PadLB'], pad: [4], labels: { kbm: '1-6', xbox: 'LB', playstation: 'L1' } },
  screenNext: { keys: ['PadRB'], pad: [5], labels: { kbm: '1-6', xbox: 'RB', playstation: 'R1' } },
  screens: { keys: [], pad: [], labels: { kbm: '1 - 6', xbox: 'LB / RB', playstation: 'L1 / R1' } },
  /* Two screen jumps phrased to sit inside a sentence, because the tutorial
     has to say "go to accounts" out loud and a number key is not a shoulder
     button. These are label-only: the real bindings are `screens` above. */
  screenAccounts: { keys: [], pad: [], labels: { kbm: 'press 2', xbox: 'LB / RB to ACCOUNTS', playstation: 'L1 / R1 to ACCOUNTS' } },
  screenTickets: { keys: [], pad: [], labels: { kbm: 'press 3', xbox: 'LB / RB to TICKETS', playstation: 'L1 / R1 to TICKETS' } },
  newTicket: { keys: ['KeyN'], pad: [], labels: { kbm: 'N', xbox: 'N', playstation: 'N' } },
  hazard: { keys: ['KeyH'], pad: [], labels: { kbm: 'H', xbox: 'H', playstation: 'H' } },

  /* ---------------- system ---------------- */
  pause: { keys: ['Escape', 'PadStart'], pad: [9], labels: { kbm: 'ESC', xbox: 'MENU', playstation: 'OPTIONS' } },
  perf: { keys: ['F3'], pad: [], labels: { kbm: 'F3' } },
};

/** Standard-mapping button index -> the pad key name it produces. */
export const PAD_BUTTONS = {
  0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY',
  4: 'PadLB', 5: 'PadRB', 6: 'PadLT', 7: 'PadRT',
  8: 'PadSelect', 9: 'PadStart', 10: 'PadL3', 11: 'PadR3',
  12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight',
};

/**
 * Which family of button art a pad wants, from whatever it calls itself.
 * Order matters: Microsoft's pads say "Xbox", Sony's often say only
 * "Wireless Controller", so the explicit vendors are ruled out first.
 */
export function schemeFor(id) {
  const s = String(id || '').toLowerCase();
  if (/xbox|xinput|045e|microsoft/.test(s)) return 'xbox';
  if (/dualsense|dualshock|playstation|sony|054c/.test(s)) return 'playstation';
  if (/wireless controller/.test(s)) return 'playstation';
  // Nintendo pads swap the face buttons physically, but the standard mapping
  // still reports by position, so the Xbox layout is the correct art.
  return 'xbox';
}

/** What to print for an action on the input family currently in use. */
export function label(action, scheme = 'kbm') {
  const a = ACTIONS[action];
  if (!a) return String(action).toUpperCase();
  return a.labels[scheme] || a.labels.kbm || String(action).toUpperCase();
}

/** Does this key event mean this action? Codes and keys are both accepted,
    which is what lets a synthetic pad event ride the same path. */
export function isAction(action, e) {
  const a = ACTIONS[action];
  if (!a || !e) return false;
  return a.keys.includes(e.code) || a.keys.includes(e.key);
}

/**
 * Replaces `{action}` tokens with whatever that action is called on the
 * input family in use, so a written instruction ("press {hold}, then
 * {hold} again") reads correctly on a keyboard and on a pad without the
 * script carrying two copies of itself. Unknown tokens are left alone.
 */
const TOKEN = /\{(\w+)\}/g;
export function expand(text, scheme = 'kbm') {
  return String(text == null ? '' : text).replace(TOKEN, (m, a) => (ACTIONS[a] ? label(a, scheme) : m));
}

/** Terminal screens are 1-6; F1-F6 remain as aliases. */
export const SCREEN_KEYS = [
  ['Digit1', 'F1'], ['Digit2', 'F2'], ['Digit3', 'F3'],
  ['Digit4', 'F4'], ['Digit5', 'F5'], ['Digit6', 'F6'],
];

/**
 * Keys that should keep firing while held. Everything else ignores auto-
 * repeat: a held ESC used to toggle the pause menu dozens of times a second.
 */
export const REPEATABLE = new Set([
  'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
