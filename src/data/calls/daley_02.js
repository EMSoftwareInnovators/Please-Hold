/* ============================================================
   daley_02 -- Mrs. Daley calls back.

   The whole point of this call is that she remembers. Every
   branch below reads something the player did thirty minutes of
   shift time ago: whether they caught the medical alert, whether
   they promised a priority restore, whether they were warm or
   short with her, whether they left her on hold long enough to
   count the hold music.

   None of that is hard-coded into the phone system. It is all
   `requires` blocks reading flags and caller memory, which means
   any future call can do the same thing without new engine work.
   ============================================================ */
export default {
  id: 'daley_02',
  caller: {
    id: 'daley',
    name: 'EILEEN DALEY',
    display: 'DALEY E',
    number: '555-0148',
    account: 'WH-40122',
    voice: 'daley',
    line: 'clean',
    era: 1999,
  },
  category: 'outage',
  priority: 80,
  schedule: { type: 'queued' },        // only ever fires because daley_01 scheduled it
  requires: { counter: { name: 'answered:daley_01', atLeast: 1 } },
  hold: { patience: 120, longHold: 40, onReturnNode: 'back_from_hold' },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hello — it's Eileen Daley again, on Orchard. I'm sorry, I know I just talked to you." },
      ],
      next: 'opener',
    },

    opener: {
      speaker: 'player',
      choices: [
        {
          text: "I know who you are, Mrs. Daley. Is it the battery?",
          goto: 'battery_yes',
          requires: { remembers: 'oxygen_battery' },
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'daley_recognized' }],
        },
        {
          text: "Eighteen Orchard. You don't have to introduce yourself.",
          goto: 'pleased',
          requires: { remembers: 'orchard_street' },
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'daley_recognized' }],
        },
        { text: "Go ahead, ma'am.", goto: 'neutral' },
      ],
    },

    battery_yes: {
      speaker: 'caller',
      lines: [
        { text: "...You remembered.", stage: 'quiet, and it means something' },
        { text: "Yes. It's the battery. There's a light on it that was green and now it's amber, and I don't like amber." },
        { text: "I don't want to be a bother. I know there's a whole county out there." },
      ],
      effects: [{ op: 'flag', name: 'daley_battery_amber' }],
      next: 'status_gate',
    },

    pleased: {
      speaker: 'caller',
      lines: [
        { text: "Oh — well, that's nice. That's very nice." },
        { text: "It's the machine. There's a light on it that's gone amber." },
      ],
      effects: [{ op: 'flag', name: 'daley_battery_amber' }],
      next: 'status_gate',
    },

    neutral: {
      speaker: 'caller',
      lines: [
        { text: "It's the oxygen machine. There's a light on it. It was green before and now it's amber." },
        { text: "The sticker says four hours and I don't know if amber means two or means twenty minutes. It doesn't say." },
      ],
      effects: [{ op: 'flag', name: 'daley_battery_amber' }],
      next: 'status_gate',
    },

    status_gate: {
      speaker: 'player',
      choices: [
        {
          text: "Your ticket's assigned and the truck is rolling. I can see it on the board.",
          goto: 'reassured_true',
          requires: { anyCrewDispatched: true },
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'daley_told_truth_good' }],
        },
        {
          text: "I told you I'd flag it and I did. It's marked priority, medical.",
          goto: 'reassured_true',
          requires: { flags: ['daley_priority'] },
          effects: [{ op: 'trust', delta: 2 }],
        },
        {
          text: "It's still in the queue. I'm not going to tell you it's moving when it isn't.",
          goto: 'honest_bad_news',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'daley_told_truth_bad' }],
        },
        {
          text: "Somebody's on the way.",
          goto: 'hollow',
          requires: { anyCrewDispatched: false },
          effects: [
            { op: 'trust', delta: -1 },
            { op: 'flag', name: 'lied_to_daley' },
            { op: 'log', text: 'Told DALEY a crew was en route. No crew is assigned.', kind: 'warn' },
          ],
        },
      ],
    },

    reassured_true: {
      speaker: 'caller',
      lines: [
        { text: "Oh, thank goodness. Thank you." },
        { text: "I'll stop calling you now. I promise." },
        { text: "...Can I say something? You've been very kind and I've been on this phone twice tonight and I want to say it while I'm thinking of it." },
      ],
      next: 'the_thing_she_says',
    },

    honest_bad_news: {
      speaker: 'caller',
      lines: [
        { text: "...All right." },
        { text: "No — no, I'd rather you say that. My husband used to guess at things to make me feel better and it never once worked." },
        { text: "Can I say something? While I'm thinking of it." },
      ],
      effects: [{ op: 'trust', delta: 1 }],
      next: 'the_thing_she_says',
    },

    hollow: {
      speaker: 'caller',
      lines: [
        { text: "On the way. All right. Good." },
        { text: "That's what they said in eighty-three, too, and that was a whole night.", stage: 'not accusing; just remembering' },
      ],
      next: 'the_thing_she_says',
    },

    /* The line the rest of the night is going to bend back toward. */
    the_thing_she_says: {
      speaker: 'caller',
      lines: [
        { text: "I've been on this street since nineteen sixty-one. We were one of the last ones to get put on." },
        { text: "And every time the power's gone out — every single time, forty years — somebody's picked up at that number." },
        { text: "It's the same number. Did you know that? It's never changed. Whoever's sitting there, it's the same phone." },
        { text: "I find that a comfort. I don't know why I'm telling you that.", stage: 'a little embarrassed' },
      ],
      effects: [
        { op: 'remember', key: 'same_phone_since_1961' },
        { op: 'flag', name: 'daley_said_same_phone' },
        { op: 'log', text: 'DALEY E - customer since 1961 - "it is the same phone"', kind: 'note' },
      ],
      next: 'close_choice',
    },

    close_choice: {
      speaker: 'player',
      choices: [
        {
          text: "It is the same phone. Same desk, too. I'm looking at the scratches.",
          goto: 'close_warm',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'player_noticed_the_desk' }],
        },
        {
          text: "Call me back if that light goes red. I don't care how many times.",
          goto: 'close_warm',
          effects: [{ op: 'trust', delta: 2 }, { op: 'promise', key: 'call_anytime' }],
        },
        { text: "Goodnight, Mrs. Daley.", goto: 'close_plain' },
      ],
    },

    close_warm: {
      speaker: 'caller',
      lines: [
        { text: "You're a good one. I'll tell Frances about you on Sunday." },
        { text: "Goodnight, dear. Mind the storm." },
      ],
      effects: [
        { op: 'flag', name: 'daley_arc_good' },
        { op: 'beat', to: 4 },
      ],
      end: true,
    },

    close_plain: {
      speaker: 'caller',
      lines: [
        { text: "Goodnight." },
      ],
      effects: [{ op: 'beat', to: 4 }],
      end: true,
    },

    back_from_hold: {
      speaker: 'caller',
      lines: [
        { text: "There you are. Eight notes. I counted again." },
        { text: "It's a shorter loop than you'd think.", stage: 'she is not complaining' },
      ],
      next: 'status_gate',
    },
  },
};
