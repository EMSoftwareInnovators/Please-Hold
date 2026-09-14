/* ============================================================
   holbrook_01 -- the first call that does not add up.

   Everything about this one is ordinary except the address. A
   woman reports her power out at 31 Tannery Row, Devoe. The
   street index has a TANNERY RD in Devoe -- close, but not the
   same -- and the only account on it is a tannery that was cut
   off in 1981.

   Crucially, this is STILL EXPLAINABLE. Streets get renamed.
   Clerks mistype. Rural addresses were a mess before the county
   went to 911 numbering. The player is meant to reach for one of
   those explanations and be allowed to keep it, because the call
   that takes it away comes later and lands harder for the wait.

   She is also not frightened and not strange. She is a tired
   woman with a wood stove who is mildly annoyed that the lights
   are off. That is what makes it work.
   ============================================================ */
export default {
  id: 'holbrook_01',
  caller: {
    id: 'holbrook',
    name: 'A. HOLBROOK',
    display: 'HOLBROOK A',
    number: '555-0119',
    account: 'WH-00318',
    voice: 'daley',
    line: 'degraded',              // a slightly poorer line than the others
    era: 1956,                     // she does not know this and neither do you
  },
  category: 'anomaly',
  priority: 75,
  debt: 2,
  schedule: { type: 'beat', beat: 6 },
  hold: { patience: 110, longHold: 40, onReturnNode: 'back_from_hold' },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hello? I can hear you but you're a ways off.", stage: 'the line is thinner than the others tonight' },
        { text: "Our lights are out. The whole place. I've got the stove so we're warm, it's just dark as anything." },
      ],
      next: 'greet',
    },

    greet: {
      speaker: 'player',
      choices: [
        { text: "Wright County Power and Light. Can I get the service address?", goto: 'address', effects: [{ op: 'trust', delta: 1 }] },
        { text: "You're coming through quiet. Can you speak up for me?", goto: 'quiet', effects: [{ op: 'flag', name: 'noticed_holbrook_line' }] },
        { text: "Go ahead with the address.", goto: 'address' },
      ],
    },

    quiet: {
      speaker: 'caller',
      lines: [
        { text: "Is this better? I've got it right up against my ear." },
        { text: "It's the weather, most likely. It always goes funny in the weather." },
      ],
      next: 'address',
    },

    address: {
      speaker: 'caller',
      lines: [
        { text: "Thirty-one Tannery Row. Devoe." },
        { text: "Holbrook. H-O-L-B-R-O-O-K." },
      ],
      effects: [
        { op: 'flag', name: 'holbrook_gave_address' },
        { op: 'remember', key: 'tannery_row' },
        { op: 'log', text: 'HOLBROOK A - reports 31 TANNERY ROW, DEVOE - NOT IN STREET INDEX', kind: 'anomaly' },
      ],
      next: 'the_problem',
    },

    /* The player is expected to go to the terminal here. The choices below
       are gated on having actually searched, so the discovery is theirs. */
    the_problem: {
      speaker: 'player',
      choices: [
        {
          text: "Ma'am, I've got a Tannery Road in Devoe. I don't have a Tannery Row.",
          goto: 'the_row',
          requires: { anyLookup: true },
          effects: [
            { op: 'flag', name: 'holbrook_challenged' },
            { op: 'log', text: 'No TANNERY ROW in index. Nearest: TANNERY RD (Devoe).', kind: 'anomaly' },
          ],
        },
        {
          text: "The only account I have on Tannery is the old tannery, and it's been off since 1981.",
          goto: 'the_tannery',
          requires: { lookedUp: 'WH-39987' },
          effects: [
            { op: 'flag', name: 'holbrook_challenged' },
            { op: 'flag', name: 'found_dead_tannery' },
          ],
        },
        { text: "Let me search that. One moment.", goto: 'searching', once: true },
        { text: "Thirty-one Tannery Row. Got it.", goto: 'no_challenge', effects: [{ op: 'flag', name: 'holbrook_unchallenged' }] },
      ],
    },

    searching: {
      speaker: 'caller',
      lines: [
        { text: "Take your time." },
        { text: "It's not a long road. There's four houses on it and then it's just the river." },
      ],
      effects: [{ op: 'remember', key: 'four_houses' }],
      fallback: 'no_challenge',
      next: 'the_problem',
    },

    the_row: {
      speaker: 'caller',
      lines: [
        { text: "...Row. It's Row. It's always been Row." },
        { text: "There's a Tannery Road too, that's the one that goes out past the works. We're the Row. We're the four houses." },
        { text: "Everybody mixes it up. The mailman mixed it up for six years.", stage: 'not defensive; she has had this conversation many times' },
      ],
      effects: [{ op: 'flag', name: 'holbrook_explained_row' }],
      next: 'reconcile',
    },

    the_tannery: {
      speaker: 'caller',
      lines: [
        { text: "The works? No, the works is still there, they just don't run the second shift anymore." },
        { text: "...Off since when?" },
      ],
      effects: [{ op: 'flag', name: 'holbrook_tannery_contradiction' }],
      next: 'reconcile',
    },

    no_challenge: {
      speaker: 'caller',
      lines: [
        { text: "Thank you." },
        { text: "Will it be long, do you think? I've got the stove but the pump's electric and I can't fill the kettle." },
      ],
      next: 'ticket',
    },

    /* The escape hatch. The player is allowed to take it. */
    reconcile: {
      speaker: 'player',
      choices: [
        {
          text: "It's probably a records problem on our end. Rural addresses were a mess before 911 numbering.",
          goto: 'accepts',
          effects: [
            { op: 'flag', name: 'explained_as_records_error' },
            { op: 'log', text: 'Treated TANNERY ROW discrepancy as a records error. Reasonable.', kind: 'note' },
          ],
        },
        {
          text: "I'll write it against the nearest circuit and flag the address for the day office.",
          goto: 'accepts',
          effects: [
            { op: 'flag', name: 'flagged_address_for_day' },
            { op: 'log', text: 'HOLBROOK A - address flagged for day office verification', kind: 'note' },
          ],
        },
        {
          text: "Mrs. Holbrook — how long have you been a customer of ours?",
          goto: 'the_question',
          effects: [{ op: 'flag', name: 'asked_holbrook_how_long' }],
        },
      ],
    },

    /* The first genuinely cold moment, and it is only a date. */
    the_question: {
      speaker: 'caller',
      lines: [
        { text: "Oh, since we came on. Fifty-four." },
        { text: "We were on the co-op before that, and before that we weren't on anything. My mother cooked on wood her whole life." },
        { text: "Why? Is there something the matter with the account?" },
      ],
      effects: [
        { op: 'flag', name: 'holbrook_said_1954' },
        { op: 'remember', key: 'since_1954' },
        { op: 'log', text: 'HOLBROOK A - states service since 1954. Account WH-00318 not in active file.', kind: 'anomaly' },
      ],
      next: 'after_question',
    },

    after_question: {
      speaker: 'player',
      choices: [
        {
          text: "No, ma'am. Nothing's the matter with the account.",
          goto: 'ticket',
          effects: [{ op: 'trust', delta: 1 }],
        },
        {
          text: "Nineteen fifty-four.",
          spoken: "Nineteen fifty-four.",
          goto: 'flat_repeat',
          effects: [{ op: 'flag', name: 'repeated_1954' }],
        },
      ],
    },

    flat_repeat: {
      speaker: 'caller',
      lines: [
        { text: "That's right. June of it." },
        { text: "There's a little brass plate on the box out back with the date stamped on. My husband thought that was the finest thing he ever saw." },
        { text: "...Are you all right? You've gone very quiet.", stage: 'concerned for YOU' },
      ],
      next: 'ticket',
    },

    accepts: {
      speaker: 'caller',
      lines: [
        { text: "That's what I figured. It's always the paperwork." },
        { text: "Well, I'm not going anywhere. Send somebody when you can." },
      ],
      next: 'ticket',
    },

    ticket: {
      speaker: 'player',
      choices: [
        {
          text: "It's written up. I've put it on the Devoe circuit.",
          goto: 'close',
          effects: [
            { op: 'outage.create', feeder: 'RR-09', address: '31 TANNERY ROW', town: 'DEVOE', cause: 'UNKNOWN', customers: 4, priority: 3 },
            { op: 'flag', name: 'holbrook_ticketed' },
            { op: 'log', text: 'HOLBROOK A - TR opened against RR-09 - address unverified', kind: 'call' },
          ],
        },
        {
          text: "I've got it down. I'll be honest with you — I can't place your address on my map.",
          goto: 'honest_close',
          effects: [
            { op: 'flag', name: 'was_honest_with_holbrook' },
            { op: 'outage.create', feeder: 'RR-09', address: '31 TANNERY ROW', town: 'DEVOE', cause: 'UNKNOWN', customers: 4, priority: 3 },
          ],
        },
      ],
    },

    honest_close: {
      speaker: 'caller',
      lines: [
        { text: "You can't place it." },
        { text: "...Well. That's a new one." },
        { text: "It's the four houses past the works, before the river. It's been there longer than I have." },
        { text: "You'll find it. Somebody always finds it eventually.", stage: 'and she means nothing by it' },
      ],
      effects: [{ op: 'flag', name: 'holbrook_somebody_finds_it' }],
      next: 'close',
    },

    close: {
      speaker: 'caller',
      lines: [
        { text: "Thank you. Goodnight now." },
        { text: "...Oh — if he comes tonight, tell him to mind the low wire at the turn. It's been low for years." },
      ],
      effects: [
        { op: 'remember', key: 'low_wire_at_the_turn' },
        { op: 'flag', name: 'holbrook_done' },
        { op: 'beat', to: 7 },
      ],
      end: true,
    },

    back_from_hold: {
      speaker: 'caller',
      lines: [
        { text: "Hello? Hello?" },
        { text: "I thought I'd lost you. There wasn't any music, just the quiet.", stage: 'there was music' },
      ],
      effects: [{ op: 'flag', name: 'holbrook_no_music' }],
      next: 'ticket',
    },
  },
};
