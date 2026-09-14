/* ============================================================
   keefe_1978 -- the end of the vertical slice.

   R. Keefe is the overnight dispatcher at the District Operations
   Center. So is the player. They are sitting at the same desk,
   under the same two clocks, twenty-one years apart, and neither
   of them understands that for most of this conversation.

   The scene is built so the realization is EARNED rather than
   announced. They trade details that ought to be impossible for a
   stranger to know -- the burn on the desk edge, the map sheet
   revision, the extension number printed on the card under the
   telephone's plastic window -- and each one is a thing the
   player has been able to look at all night. The player confirms
   them against the room, not against exposition.

   Keefe is not a ghost and does not behave like one. He is a
   tired man on a bad night who is being very patient with
   somebody he thinks is confused, right up until he isn't.

   The line the whole game is named for is the last thing in it.
   ============================================================ */
export default {
  id: 'keefe_1978',
  caller: {
    id: 'keefe',
    name: 'R. KEEFE',
    display: 'INTERNAL — 2240',     // the desk's own extension. It is calling itself.
    number: 'x2240',
    voice: 'keefe',
    line: 'era1978',
    era: 1978,
  },
  category: 'story',
  priority: 120,
  debt: 4,
  rings: 22,
  ring: 'ringBell',
  schedule: { type: 'beat', beat: 9 },
  hold: { patience: 9999, longHold: 30, onReturnNode: 'back_from_hold' },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Dispatch, this is Keefe. Who am I talking to?", stage: 'brisk, professional, mid-shift' },
      ],
      next: 'confused_1',
    },

    confused_1: {
      speaker: 'player',
      choices: [
        { text: "This is dispatch.", goto: 'both_dispatch', effects: [{ op: 'flag', name: 'keefe_both_dispatch' }] },
        { text: "Keefe? R. Keefe? You signed the storm procedure on my wall.", goto: 'the_notice', requires: { flags: ['read_notice_board'] }, effects: [{ op: 'flag', name: 'keefe_notice_early' }] },
        { text: "How did you get this line? This is an internal extension.", goto: 'internal' },
      ],
    },

    /* Only offered if the player has actually stood and read the notice board
       on the south wall, where R. KEEFE, SUPV signed the storm procedure in
       September 1998 -- twenty years after the man on this line typed it. */
    the_notice: {
      speaker: 'caller',
      lines: [
        { text: "I signed the — what?" },
        { text: "I wrote the storm procedure. This year. It's five lines and the last one is about downed conductors." },
        { text: "How is it on your wall? It's in my typewriter.", stage: 'and he means that literally; it is in the carriage right now' },
      ],
      effects: [
        { op: 'flag', name: 'keefe_notice_confirmed' },
        { op: 'log', text: 'Caller claims authorship of the storm procedure posted 09/14/98.', kind: 'anomaly' },
      ],
      next: 'both_dispatch',
    },

    internal: {
      speaker: 'caller',
      lines: [
        { text: "I know what it is. I dialed it." },
        { text: "I'm trying to raise the twelve-kV desk and I keep getting a ring on my own extension, which is not a thing this switchboard does." },
        { text: "So either the phone man did something clever last week, or — who is this? You're not Vogel." },
      ],
      effects: [{ op: 'flag', name: 'keefe_not_vogel' }],
      next: 'both_dispatch',
    },

    both_dispatch: {
      speaker: 'caller',
      lines: [
        { text: "You're dispatch." },
        { text: "I'm dispatch. I'm sitting at dispatch. There's one desk." },
        { text: "...All right. Is this Marrow Hill or is this the Fairhaven office? Because if Fairhaven is running a night desk again nobody told me." },
      ],
      next: 'where_are_you',
    },

    where_are_you: {
      speaker: 'player',
      choices: [
        { text: "District Operations Center. Marrow Hill.", goto: 'same_building', effects: [{ op: 'flag', name: 'keefe_same_building' }] },
        { text: "I'm in the dispatch room. North wall, map board over the desk.", goto: 'same_building', effects: [{ op: 'flag', name: 'keefe_described_room' }, { op: 'trust', delta: 1 }] },
        { text: "Mr. Keefe, what's the date?", goto: 'the_date_early', effects: [{ op: 'flag', name: 'asked_keefe_date_early' }] },
      ],
    },

    the_date_early: {
      speaker: 'caller',
      lines: [
        { text: "The — what?" },
        { text: "It's the eleventh. Look, I've got two feeders out and a man up a pole, I don't have time for—" },
        { text: "...Hold on. Hold on, you're on my extension. Where are you sitting right now? Physically. Where.", stage: 'the professionalism thins' },
      ],
      next: 'same_building',
    },

    same_building: {
      speaker: 'caller',
      lines: [
        { text: "That's where I am." },
        { text: "That's where I am, and there is nobody else in this building. I walked it at eleven. I locked the stair door myself." },
      ],
      next: 'the_test',
    },

    /* The middle of the scene: they check each other against the room.
       Every detail here is something the player can physically look at. */
    the_test: {
      speaker: 'caller',
      lines: [
        { text: "All right. All right, let's do this the short way, because I don't like it." },
        { text: "If you're at my desk, tell me what's on it." },
      ],
      next: 'the_test_choice',
    },

    the_test_choice: {
      speaker: 'player',
      choices: [
        {
          text: "There's a burn on the front edge, left of center. Somebody set a cigarette down and forgot it.",
          goto: 'the_burn',
          effects: [{ op: 'flag', name: 'keefe_burn' }, { op: 'trust', delta: 1 }],
        },
        {
          text: "Service area map, sheet one of three. Revision eleven ninety-seven.",
          goto: 'the_map',
          requires: { flags: ['examined_map_board'] },
          effects: [{ op: 'flag', name: 'keefe_map' }, { op: 'trust', delta: 1 }],
        },
        {
          text: "There's a card under the plastic on the telephone. It says DISPATCH, extension 2240.",
          goto: 'the_card',
          effects: [{ op: 'flag', name: 'keefe_card' }, { op: 'trust', delta: 2 }],
        },
        { text: "I'm not doing this.", goto: 'refuses', once: true, effects: [{ op: 'flag', name: 'keefe_refused_test' }] },
      ],
    },

    refuses: {
      speaker: 'caller',
      lines: [
        { text: "Neither am I, believe me." },
        { text: "But I've got a voice on my own extension at two in the morning and I would very much like a boring explanation for it." },
        { text: "Humor me. What's on the desk." },
      ],
      next: 'the_test_choice',
    },

    the_burn: {
      speaker: 'caller',
      lines: [
        { text: "", stage: 'a long silence with a lot of room tone in it', pause: 1.8 },
        { text: "That was me. That was — I did that in March." },
        { text: "I got written up for it.", pause: 1.0 },
      ],
      effects: [{ op: 'flag', name: 'keefe_shaken' }],
      next: 'the_map_question',
    },

    the_card: {
      speaker: 'caller',
      lines: [
        { text: "", stage: 'nothing at all for a moment', pause: 1.6 },
        { text: "I typed that card." },
        { text: "I typed that card on the Selectric in Keefe's — in MY office, because the printed ones say 2204 and it's been wrong since they moved the desk." },
        { text: "Nobody knows that. The day shift doesn't know that.", pause: 1.2 },
      ],
      effects: [{ op: 'flag', name: 'keefe_shaken' }],
      next: 'the_map_question',
    },

    the_map: {
      speaker: 'caller',
      lines: [
        { text: "Sheet one of three. That's right." },
        { text: "Revision — say that again.", pause: 0.8 },
        { text: "Mine says revision three seventy-eight. March of seventy-eight. It's the newest one there is; it came in a tube in the spring.", pause: 1.4 },
      ],
      effects: [{ op: 'flag', name: 'keefe_shaken' }, { op: 'flag', name: 'keefe_map_revision' }],
      next: 'the_map_question',
    },

    the_map_question: {
      speaker: 'player',
      choices: [
        {
          text: "Mine says revision eleven ninety-seven.",
          goto: 'the_gap',
          effects: [{ op: 'flag', name: 'told_keefe_revision' }],
        },
        {
          text: "Mr. Keefe. What year is it where you are?",
          goto: 'the_gap_direct',
          effects: [{ op: 'flag', name: 'asked_keefe_year' }],
        },
        {
          text: "Nineteen seventy-eight.",
          spoken: "Nineteen seventy-eight.",
          goto: 'the_gap_direct',
          effects: [{ op: 'flag', name: 'said_it_first' }],
        },
      ],
    },

    the_gap: {
      speaker: 'caller',
      lines: [
        { text: "Eleven ninety-seven." },
        { text: "November. Nineteen ninety-seven.", pause: 1.4 },
        { text: "...That map doesn't exist. That map hasn't been drawn.", stage: 'working it through, out loud, badly' },
      ],
      next: 'the_realization',
    },

    the_gap_direct: {
      speaker: 'caller',
      lines: [
        { text: "Seventy-eight. It's seventy-eight.", pause: 1.2 },
        { text: "Say yours." },
      ],
      next: 'say_yours',
    },

    say_yours: {
      speaker: 'player',
      choices: [
        {
          text: "Nineteen ninety-nine.",
          goto: 'the_realization',
          effects: [{ op: 'flag', name: 'told_keefe_1999' }],
        },
        {
          text: "It's November. It's late.",
          goto: 'the_realization',
          effects: [{ op: 'flag', name: 'hedged_with_keefe' }],
        },
      ],
    },

    /* The turn. He gets there first, because he has been getting there
       for longer than the player has. */
    the_realization: {
      speaker: 'caller',
      lines: [
        { text: "", stage: 'he is breathing and not talking', pause: 2.0 },
        { text: "Twenty-one years." },
        { text: "You're twenty-one years up the road from me, at my desk, on my phone." },
        { text: "...I want to tell you that I don't believe that. I want that on the record.", pause: 1.2 },
      ],
      effects: [
        { op: 'flag', name: 'keefe_realized' },
        { op: 'horror', event: 'flicker', args: { duration: 3.0 } },
        { op: 'log', text: 'INTERNAL x2240 - caller states date as 1978.', kind: 'anomaly' },
      ],
      next: 'his_turn',
    },

    his_turn: {
      speaker: 'player',
      choices: [
        {
          text: "It's on the record. I'm writing it down right now.",
          goto: 'the_admission',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'wrote_keefe_down' }],
        },
        {
          text: "I don't believe it either. But I've got a lineman holding a piece of bare copper off a pole set in 1956.",
          goto: 'the_admission_copper',
          requires: { flags: ['pole_tag_1956'] },
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'told_keefe_about_copper' }],
        },
        {
          text: "Mr. Keefe, has this happened to you before?",
          goto: 'the_admission',
          effects: [{ op: 'flag', name: 'asked_keefe_before' }],
        },
      ],
    },

    the_admission_copper: {
      speaker: 'caller',
      lines: [
        { text: "Bare copper." },
        { text: "On a pole tagged fifty-six.", pause: 1.2 },
        { text: "...Where. Where is he standing." },
      ],
      effects: [{ op: 'flag', name: 'keefe_wants_location' }],
      next: 'the_admission',
    },

    /* The line the design brief asked for, set up and paid off. */
    the_admission: {
      speaker: 'caller',
      lines: [
        { text: "I'm going to tell you something and I want you to not say anything until I've finished." },
        { text: "It isn't the first time this shift.", pause: 1.0 },
        { text: "I've had four tonight I couldn't write up. Addresses that aren't on the sheet. A woman on a party line off the Row." },
        { text: "A man asking me to send somebody out to a pole that we set two years before I was hired.", pause: 1.4 },
        { text: "We've been getting calls from 1956.", stage: 'flat, and he has been waiting all night to say it to somebody', pause: 2.0 },
      ],
      effects: [
        { op: 'flag', name: 'keefe_said_1956' },
        { op: 'log', text: 'KEEFE R (1978): "We\'ve been getting calls from 1956."', kind: 'anomaly' },
      ],
      next: 'the_answer',
    },

    the_answer: {
      speaker: 'player',
      choices: [
        {
          text: "I'm getting calls from you.",
          goto: 'the_pause',
          effects: [
            { op: 'flag', name: 'said_the_line' },
            { op: 'log', text: '"I am getting calls from you."', kind: 'anomaly' },
          ],
        },
        {
          text: "I had Ed Pratt on this line an hour ago. Twenty-seven Tannery Row.",
          goto: 'the_pause_pratt',
          requires: { flags: ['pratt_said_1956'] },
          effects: [
            { op: 'flag', name: 'said_the_line' },
            { op: 'flag', name: 'named_pratt_to_keefe' },
          ],
        },
      ],
    },

    the_pause_pratt: {
      speaker: 'caller',
      lines: [
        { text: "Pratt." },
        { text: "Ed Pratt. Twenty-seven." },
        { text: "He called me at ten forty. He asked me to send somebody to the pole at the turn.", pause: 1.6 },
        { text: "You're getting him too.", pause: 1.2 },
      ],
      effects: [{ op: 'flag', name: 'keefe_confirms_pratt' }],
      next: 'the_pause',
    },

    /* The pause the brief asks for, rendered as an actual pause. */
    the_pause: {
      speaker: 'caller',
      lines: [
        { text: "", stage: 'nothing. the hum. rain on the glass.', pause: 3.2 },
        { text: "", stage: 'he has not hung up. he is still there.', pause: 2.4 },
        { text: "...Then somebody's getting them from you.", pause: 2.0 },
      ],
      effects: [
        { op: 'flag', name: 'the_pause_happened' },
        { op: 'horror', event: 'radioBleed', args: { level: 0.9, duration: 10, from: '——', text: 'dispatch — dispatch — who is on this channel' } },
      ],
      next: 'the_last_exchange',
    },

    the_last_exchange: {
      speaker: 'player',
      choices: [
        {
          text: "Keefe — how does your shift end?",
          goto: 'the_end',
          effects: [{ op: 'flag', name: 'asked_how_it_ends' }],
        },
        {
          text: "Don't hang up. Stay on the line.",
          goto: 'the_end',
          effects: [{ op: 'flag', name: 'asked_him_to_stay' }, { op: 'trust', delta: 1 }],
        },
        {
          text: "Get out of the building.",
          goto: 'the_end',
          effects: [{ op: 'flag', name: 'told_keefe_to_leave' }],
        },
      ],
    },

    the_end: {
      speaker: 'caller',
      lines: [
        { text: "I can't hear you as well as I could." },
        { text: "There's something on the line. It's been coming up under us for a minute now, did you hear it—", pause: 1.2 },
        { text: "— the lights are going. My lights are going. Are yours—", stage: 'and the room answers him', pause: 0.8 },
      ],
      effects: [
        { op: 'horror', event: 'cascade', args: { duration: 13 } },
        { op: 'flag', name: 'cascade_started' },
      ],
      next: 'the_last_thing',
    },

    the_last_thing: {
      speaker: 'caller',
      lines: [
        { text: "— whoever you are — whoever's next —", pause: 1.0 },
        { text: "— answer it. Whatever it sounds like. Somebody has to be on the desk —", pause: 1.4 },
        { text: "— don't leave them on —", stage: 'the carrier collapses', pause: 2.0 },
      ],
      effects: [
        { op: 'flag', name: 'keefe_last_words' },
        { op: 'log', text: 'INTERNAL x2240 - carrier lost.', kind: 'anomaly' },
      ],
      next: 'the_title',
    },

    /* The slice ends here. */
    the_title: {
      speaker: 'system',
      lines: [
        { text: "", stage: '', pause: 2.6 },
        { text: "PLEASE HOLD", stage: 'title', pause: 4.0 },
      ],
      effects: [
        { op: 'flag', name: 'slice_complete' },
        { op: 'beat', to: 10 },
        { op: 'log', text: 'END OF SHIFT RECORD.', kind: 'end' },
      ],
      end: true,
    },

    back_from_hold: {
      speaker: 'caller',
      lines: [
        { text: "You put me on hold." },
        { text: "On my own extension. In my own building.", stage: 'and for the first time he laughs, briefly, at nothing funny' },
        { text: "All right. All right, I'm still here. Where were we." },
      ],
      next: 'the_test',
    },
  },
};
