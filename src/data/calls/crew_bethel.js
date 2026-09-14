/* ============================================================
   crew_bethel -- Trouble Seven, on scene at the wire down.

   This runs over the RADIO, not the telephone: `medium: 'radio'`
   tells the director to hand it straight to the runner instead of
   ringing a line. Everything else about it -- nodes, choices,
   gates, effects -- is the same format as a phone call, which is
   the whole reason the dialogue system is medium-agnostic.

   It is also the first crack. Halloran is not frightened and does
   not become frightened; he is a lineman describing hardware that
   should not be on that pole, in the flat way a man describes a
   thing he intends to write up. That flatness is what sells it.
   ============================================================ */
export default {
  id: 'crew_bethel',
  medium: 'radio',
  caller: {
    id: 'halloran',
    name: 'TROUBLE SEVEN',
    display: 'T7 HALLORAN',
    number: 'CH 1',
    voice: 'halloran',
    line: 'degraded',
    era: 1999,
  },
  category: 'crew',
  priority: 90,
  schedule: { type: 'beat', beat: 4 },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'radio',
      lines: [
        { text: "Dispatch, Trouble Seven." },
        { text: "I'm on Bethel Pike at the wire down. Line's secured, road's coned, the young lady in the Corsica is clear and gone." },
      ],
      next: 'ack',
    },

    ack: {
      speaker: 'player',
      choices: [
        { text: "Copy, Seven. Good work. What have you got?", goto: 'the_pole', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Seven, dispatch. Is it de-energized?", goto: 'deenergized' },
        { text: "Copy. Can you clear it tonight?", goto: 'the_pole' },
      ],
    },

    deenergized: {
      speaker: 'radio',
      lines: [
        { text: "It is now. Fuse was already blown at the tap, which is what I'd expect." },
        { text: "But listen, dispatch, I want to give you something for the log and I want you to write it down the way I say it." },
      ],
      next: 'the_pole',
    },

    the_pole: {
      speaker: 'radio',
      lines: [
        { text: "The span that failed isn't ours." },
        { text: "I mean it is — it's on our right of way, it's feeding our customers. But it isn't ours." },
        { text: "The conductor's copper. Bare copper, dispatch. Nobody's strung copper on distribution since before I hired on." },
      ],
      effects: [
        { op: 'flag', name: 'heard_copper_report' },
        { op: 'log', text: 'T7 reports BARE COPPER conductor on MH-12 span, Bethel Pike', kind: 'anomaly' },
      ],
      next: 'react',
    },

    react: {
      speaker: 'player',
      choices: [
        {
          text: "Say again — copper? On a 1990s rebuild?",
          goto: 'confirms_copper',
          effects: [{ op: 'flag', name: 'pressed_on_copper' }],
        },
        {
          text: "What's the pole tag say?",
          goto: 'the_tag',
          effects: [{ op: 'flag', name: 'asked_for_tag' }, { op: 'trust', delta: 1 }],
        },
        { text: "Copy. Write it up when you're back in.", goto: 'the_tag_anyway' },
      ],
    },

    confirms_copper: {
      speaker: 'radio',
      lines: [
        { text: "Copper. I've got a piece of it in my hand." },
        { text: "It's got the hardware to match. Porcelain pin insulators. Wood crossarm with a split you could put your thumb in." },
        { text: "Dispatch, this span is sixty years old and it was carrying load an hour ago." },
      ],
      next: 'the_tag',
    },

    the_tag_anyway: {
      speaker: 'radio',
      lines: [
        { text: "I'll write it up. But I'm going to read you the pole tag first, because you're going to want it in the log with a time on it." },
      ],
      next: 'the_tag',
    },

    the_tag: {
      speaker: 'radio',
      lines: [
        { text: "Tag's a stamped aluminum one. Not the plastic ones." },
        { text: "It reads: W C P L — dash — four four one — dash — five six." },
        { text: "Dispatch, our numbering doesn't go that way. Hasn't since seventy-eight.", stage: 'flat' },
        { text: "And that last block is the set year. Which would make that pole fifty-six." },
      ],
      effects: [
        { op: 'flag', name: 'pole_tag_1956' },
        { op: 'remember', key: 'pole_441_56' },
        { op: 'log', text: 'T7: pole tag WCPL-441-56. Numbering format obsolete since 1978. Set year reads 1956.', kind: 'anomaly' },
      ],
      next: 'response',
    },

    response: {
      speaker: 'player',
      choices: [
        {
          text: "Seven, is there any chance that's an old pole somebody never replaced?",
          goto: 'explains_away',
          effects: [{ op: 'flag', name: 'sought_explanation' }],
        },
        {
          text: "Read me the tag one more time. Slowly.",
          goto: 'reads_again',
          effects: [{ op: 'flag', name: 'confirmed_tag_twice' }],
        },
        {
          text: "Copy, Seven. WCPL-441-56. It's in the log with a time on it.",
          goto: 'logged',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'logged_the_tag' }],
        },
      ],
    },

    explains_away: {
      speaker: 'radio',
      lines: [
        { text: "Sure. That's what I thought too, first thirty seconds." },
        { text: "Except the rebuild on this stretch was ninety-four. I was on it. I set poles on this road myself, dispatch, and I set them with a plastic tag and aluminum conductor." },
        { text: "There shouldn't be a sixty-year-old span here because I took it down. I took it down personally.", stage: 'still flat, and that is worse' },
      ],
      effects: [{ op: 'flag', name: 'explanation_failed' }],
      next: 'closing',
    },

    reads_again: {
      speaker: 'radio',
      lines: [
        { text: "Whiskey. Charlie. Papa. Lima. Four. Four. One. Five. Six." },
        { text: "Same as it was." },
        { text: "I'm going to take a picture of it when it's light. I want somebody besides me to have seen it." },
      ],
      effects: [{ op: 'flag', name: 'explanation_failed' }],
      next: 'closing',
    },

    logged: {
      speaker: 'radio',
      lines: [
        { text: "Appreciated." },
        { text: "I'm not saying anything about it, dispatch. I'm saying there's a thing on my truck that shouldn't exist and I'd rather it be in writing than in my head." },
      ],
      next: 'closing',
    },

    closing: {
      speaker: 'radio',
      lines: [
        { text: "I've got the span down and secured. I can't restore it tonight; that's a rebuild." },
        { text: "Put me back in service and give me the next one." },
      ],
      next: 'final',
    },

    final: {
      speaker: 'player',
      choices: [
        {
          text: "Copy, Seven. You're clear. And — keep that piece of copper.",
          goto: 'end_a',
          effects: [{ op: 'flag', name: 'told_him_to_keep_it' }, { op: 'trust', delta: 1 }],
        },
        { text: "Copy. Seven's back in service.", goto: 'end_b' },
      ],
    },

    end_a: {
      speaker: 'radio',
      lines: [
        { text: "...Yeah. Yeah, I was going to." },
        { text: "Seven's clear." },
      ],
      effects: [
        { op: 'crew.status', crew: 'T7', status: 'AVAILABLE' },
        { op: 'beat', to: 6 },
      ],
      end: true,
    },

    end_b: {
      speaker: 'radio',
      lines: [
        { text: "Seven's clear." },
      ],
      effects: [
        { op: 'crew.status', crew: 'T7', status: 'AVAILABLE' },
        { op: 'beat', to: 6 },
      ],
      end: true,
    },
  },
};
