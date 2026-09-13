/* ============================================================
   evp_01 -- the call with nobody on it.

   The design brief is blunt about this one: do not print
   [SCARY STATIC] and call it done. So this call is built on the
   audio chain, not on the text. `line: 'evp'` routes every line
   through the ring-modulated, noise-bedded, band-crushed
   telephone chain in engine/audio.js, and the fragments are
   short enough that the SOUND is most of what the player gets.

   The text is written to be read the way you actually hear a bad
   line: mostly gaps, with words surfacing out of them. The gaps
   are em-dashes and they are load-bearing -- the player's brain
   fills them, and what it fills them with is worse than anything
   that could be written.

   The player can speak. Nothing responds to what they say. Every
   branch converges, because there is nobody there to branch.
   ============================================================ */
export default {
  id: 'evp_01',
  caller: {
    id: 'evp',
    name: '————',
    display: '',
    number: '',
    voice: 'whisper',
    line: 'evp',
    era: null,
  },
  category: 'anomaly',
  priority: 95,
  debt: 3,
  rings: 20,
  ring: 'ringBell',                  // the wrong ring. The set does not do this.
  schedule: { type: 'beat', beat: 6 },
  hold: { patience: 9999 },          // it will wait. It has nothing else to do.

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "———", stage: 'carrier, and under it something breathing', pause: 1.6 },
        { text: "—— ——— ——", pause: 1.2 },
      ],
      next: 'hello',
    },

    hello: {
      speaker: 'player',
      choices: [
        { text: "Wright County Power and Light. Hello?", goto: 'fragment_1' },
        { text: "Hello? I can't hear you. Is there somebody there?", goto: 'fragment_1' },
        { text: "...", spoken: "", say: false, goto: 'fragment_1', effects: [{ op: 'flag', name: 'said_nothing_to_evp' }] },
      ],
    },

    fragment_1: {
      speaker: 'caller',
      lines: [
        { text: "— hel — — — lo —", pause: 0.9 },
        { text: "— — anyone — — —", pause: 1.1 },
        { text: "— — — — hear — me — —", pause: 1.3 },
      ],
      effects: [
        { op: 'horror', event: 'crtGlitch', args: { severity: 0.5, duration: 2.4 } },
      ],
      next: 'respond_2',
    },

    respond_2: {
      speaker: 'player',
      choices: [
        { text: "I can hear you. Say again — where are you calling from?", goto: 'fragment_2', effects: [{ op: 'flag', name: 'answered_the_evp' }] },
        { text: "If you can hear me, this is the electric company. Stay on the line.", goto: 'fragment_2' },
        { text: "Check the line for a fault. Nobody's on it.", spoken: "Nobody's on it.", goto: 'fragment_2', effects: [{ op: 'flag', name: 'dismissed_the_evp' }] },
      ],
    },

    fragment_2: {
      speaker: 'caller',
      lines: [
        { text: "— — don't —", pause: 0.7 },
        { text: "— — — — tell — —", pause: 0.8 },
        { text: "— don't tell — — —", pause: 1.0 },
      ],
      effects: [
        { op: 'flag', name: 'evp_dont_tell' },
        { op: 'log', text: 'LINE 4 - no ANI - recovered fragments: "don\'t" / "tell"', kind: 'anomaly' },
      ],
      next: 'respond_3',
    },

    respond_3: {
      speaker: 'player',
      choices: [
        { text: "Don't tell who? Don't tell them what?", goto: 'fragment_3', effects: [{ op: 'flag', name: 'pressed_the_evp' }] },
        { text: "Say that again. Slowly.", goto: 'fragment_3' },
        { text: "Who is this?", goto: 'fragment_3' },
      ],
    },

    /* The warning lands whole. It is about a call that has not happened yet. */
    fragment_3: {
      speaker: 'caller',
      lines: [
        { text: "— — — what year — —", pause: 1.0 },
        { text: "— don't tell him — — — year — it —", pause: 1.2 },
        { text: "— — don't tell him what year it is —", stage: 'clear, all at once, and much closer', pause: 1.8 },
      ],
      effects: [
        { op: 'flag', name: 'evp_warning_received' },
        { op: 'log', text: 'LINE 4 - RECOVERED: "don\'t tell him what year it is"', kind: 'anomaly' },
        { op: 'horror', event: 'flicker', args: { duration: 2.6 } },
        { op: 'horror', event: 'radioBleed', args: { level: 0.5, duration: 7 } },
      ],
      next: 'final',
    },

    final: {
      speaker: 'player',
      choices: [
        { text: "Tell who? Who am I not supposed to tell?", goto: 'gone', effects: [{ op: 'flag', name: 'asked_who' }] },
        { text: "I'm going to hang up now.", goto: 'gone_hung_up', effects: [{ op: 'flag', name: 'hung_up_on_evp' }] },
        { text: "...Okay.", goto: 'gone', effects: [{ op: 'flag', name: 'agreed_with_the_evp' }] },
      ],
    },

    gone: {
      speaker: 'caller',
      lines: [
        { text: "—", stage: 'the breathing stops. Not the carrier. Only the breathing.', pause: 2.2 },
        { text: "", stage: 'dial tone', pause: 1.4 },
      ],
      effects: [
        { op: 'sound', name: 'lineDrop' },
        { op: 'beat', to: 7 },
      ],
      end: true,
    },

    gone_hung_up: {
      speaker: 'caller',
      lines: [
        { text: "— — please —", stage: 'the only word it has said without being asked', pause: 1.8 },
        { text: "", stage: 'dial tone', pause: 1.2 },
      ],
      effects: [
        { op: 'sound', name: 'lineDrop' },
        { op: 'flag', name: 'evp_said_please' },
        { op: 'beat', to: 7 },
      ],
      end: true,
    },
  },
};
