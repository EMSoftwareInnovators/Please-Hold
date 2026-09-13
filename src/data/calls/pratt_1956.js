/* ============================================================
   pratt_1956 -- the call that takes the explanation away.

   The brief asks for a moment where the player can ask "what year
   do you think it is" and be told "1956", and for that moment to
   be backed by evidence rather than left as a stunt. So:

     * Ed Pratt's line sounds like 1956 -- narrow band, carbon
       distortion, mains hum (audio.js, line: 'era1956').
     * He gives his telephone number in exchange-name format
       (MArrow Hill 4-1-1-2), which stopped being how anyone said
       a number around here in the sixties.
     * He is on a PARTY LINE and says so without being asked.
     * He names the pole Halloran is standing next to. The tag
       Halloran read out loud an hour ago -- WCPL-441-56 -- is a
       pole Pratt watched them set.
     * The account WH-00318 surfaces in the file with a service
       date of 06/1954, which is what Mrs. Holbrook said.

   None of that is a jump scare. It is an accumulation, and the
   player assembles it themselves out of things they wrote down.

   The EVP told them not to tell him what year it is. They can.
   ============================================================ */
export default {
  id: 'pratt_1956',
  caller: {
    id: 'pratt',
    name: 'ED PRATT',
    display: '———',
    number: 'MA 4-1112',
    account: 'WH-00318',
    voice: 'ott',
    line: 'era1956',
    era: 1956,
  },
  category: 'story',
  priority: 100,
  debt: 3,
  rings: 14,
  ring: 'ringBell',
  schedule: { type: 'beat', beat: 7 },
  hold: { patience: 240, longHold: 60, onReturnNode: 'back_from_hold' },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hello — hello, is that the power company? This is Ed Pratt out on the Row.", stage: 'the line is narrow and hot, like a voice through a tin wall' },
        { text: "I'm sorry to ring you at this hour. I wouldn't, only it's been dark since supper and the neighbors are all out too." },
      ],
      next: 'greet',
    },

    greet: {
      speaker: 'player',
      choices: [
        { text: "Wright County Power and Light, dispatch. Say your name again for me?", goto: 'name', effects: [{ op: 'trust', delta: 1 }] },
        { text: "The Row. Tannery Row?", goto: 'the_row', effects: [{ op: 'flag', name: 'pratt_row_connected' }] },
        { text: "Go ahead, Mr. Pratt.", goto: 'name' },
      ],
    },

    the_row: {
      speaker: 'caller',
      lines: [
        { text: "That's it. Number twenty-seven. The Holbrooks are thirty-one, they're two down from me." },
        { text: "Is Alma the one that called you? She said she was going to. She's got the only telephone that works half the time." },
      ],
      effects: [
        { op: 'flag', name: 'pratt_named_holbrook' },
        { op: 'remember', key: 'alma_holbrook' },
        { op: 'log', text: 'PRATT E - 27 TANNERY ROW - names HOLBROOK at 31 - corroborates earlier call', kind: 'anomaly' },
      ],
      next: 'name',
    },

    name: {
      speaker: 'caller',
      lines: [
        { text: "Pratt. Edward Pratt. P-R-A-T-T." },
        { text: "You can reach me back at MArrow Hill four, one one two — but I'd leave it a while, the Kerrs are on the line and Dorothy talks." },
      ],
      effects: [
        { op: 'flag', name: 'pratt_gave_exchange_number' },
        { op: 'remember', key: 'party_line' },
        { op: 'log', text: 'PRATT E - gives number as "MArrow Hill 4-1112" - exchange-name format - states PARTY LINE', kind: 'anomaly' },
      ],
      next: 'first_wrongness',
    },

    first_wrongness: {
      speaker: 'player',
      choices: [
        {
          text: "You're on a party line?",
          goto: 'party_line',
          effects: [{ op: 'flag', name: 'asked_about_party_line' }],
        },
        {
          text: "Say that number again — MArrow Hill four?",
          goto: 'exchange',
          effects: [{ op: 'flag', name: 'asked_about_exchange' }],
        },
        { text: "What's out at your place, Mr. Pratt? Whole house?", goto: 'the_outage' },
      ],
    },

    party_line: {
      speaker: 'caller',
      lines: [
        { text: "Four of us on it. Us, the Kerrs, the Holbrooks and the Vaughn place." },
        { text: "Two longs and a short is us. You get used to counting." },
        { text: "Why, has somebody been complaining? Dorothy will have been complaining.", stage: 'amused' },
      ],
      next: 'the_outage',
    },

    exchange: {
      speaker: 'caller',
      lines: [
        { text: "MArrow Hill four — one one two. Same as it's always been." },
        { text: "You want me to spell the exchange? M-A, capital M, capital A. That's how it's printed on the book." },
      ],
      next: 'the_outage',
    },

    the_outage: {
      speaker: 'caller',
      lines: [
        { text: "Whole house, and the Kerrs and the Holbrooks the same. We're all off the same line down the Row." },
        { text: "And I'll tell you where it is, too, because I watched them set that pole and I've been saying it was in a bad spot for two years." },
      ],
      next: 'the_pole_offer',
    },

    /* The corroboration. If the player logged Halloran's tag, they can put
       the two things together out loud. If they did not, Pratt says it anyway
       and the player is left to remember it on their own. */
    the_pole_offer: {
      speaker: 'player',
      choices: [
        {
          text: "Which pole, Mr. Pratt?",
          goto: 'the_pole',
        },
        {
          text: "Is it the one at the turn? Tag number four forty-one?",
          goto: 'the_pole_confirmed',
          requires: { flags: ['pole_tag_1956'] },
          effects: [
            { op: 'flag', name: 'connected_the_pole' },
            { op: 'log', text: 'PRATT E independently names pole 441 - same tag T7 read at Bethel Pike', kind: 'anomaly' },
          ],
        },
      ],
    },

    the_pole_confirmed: {
      speaker: 'caller',
      lines: [
        { text: "Four forty-one, that's the one. How'd you know that?", stage: 'pleased, not suspicious' },
        { text: "They set it this spring. There's a fellow — there's a fellow still out there working on it, I can see his lights from the porch." },
        { text: "Been out there an hour. Big truck. I've never seen a truck like it." },
      ],
      effects: [
        { op: 'flag', name: 'pratt_sees_halloran' },
        { op: 'log', text: 'PRATT E reports a crew AT pole 441 with lights. T7 is at that pole.', kind: 'anomaly' },
        { op: 'horror', event: 'flicker', args: { duration: 2.0 } },
      ],
      next: 'the_question_setup',
    },

    the_pole: {
      speaker: 'caller',
      lines: [
        { text: "The one at the turn, before the river. They set it this spring." },
        { text: "There's a man out there on it right now, matter of fact. I can see his lights from the porch." },
        { text: "Been an hour. That's a big truck for a little pole." },
      ],
      effects: [
        { op: 'flag', name: 'pratt_sees_halloran' },
        { op: 'horror', event: 'flicker', args: { duration: 2.0 } },
      ],
      next: 'the_question_setup',
    },

    the_question_setup: {
      speaker: 'caller',
      lines: [
        { text: "Anyhow. You'll send somebody?" },
        { text: "I know it's a holiday weekend coming and everybody wants off." },
      ],
      next: 'the_question',
    },

    /* The question, and the answer the whole night has been walking toward. */
    the_question: {
      speaker: 'player',
      choices: [
        {
          text: "Mr. Pratt — what year do you think it is?",
          goto: 'the_answer',
          effects: [
            { op: 'flag', name: 'asked_the_year' },
            { op: 'log', text: 'Asked PRATT E what year it is.', kind: 'anomaly' },
          ],
        },
        {
          text: "What holiday weekend, Mr. Pratt?",
          goto: 'the_holiday',
          once: true,
          effects: [{ op: 'flag', name: 'asked_the_holiday' }],
        },
        {
          text: "Somebody's already out there. That's our crew on your pole.",
          goto: 'the_crew_answer',
          requires: { flags: ['pratt_sees_halloran'] },
          once: true,
          effects: [{ op: 'flag', name: 'told_pratt_about_crew' }],
        },
        {
          text: "I'll send somebody. Goodnight, Mr. Pratt.",
          goto: 'declined',
          effects: [{ op: 'flag', name: 'declined_to_ask' }],
        },
      ],
    },

    the_holiday: {
      speaker: 'caller',
      lines: [
        { text: "Decoration Day. Monday." },
        { text: "...You call it Memorial Day now, I suppose. My daughter corrects me on that." },
      ],
      effects: [{ op: 'flag', name: 'pratt_decoration_day' }],
      next: 'the_question',
    },

    the_crew_answer: {
      speaker: 'caller',
      lines: [
        { text: "That's yours? Well, that's fast work." },
        { text: "...He's not moving, though. He's been stood at the base of it the whole while with his hand on it." },
        { text: "Like he's listening to it.", stage: 'and Halloran is, right now, on channel one' },
      ],
      effects: [{ op: 'flag', name: 'pratt_halloran_still' }],
      next: 'the_question',
    },

    the_answer: {
      speaker: 'caller',
      lines: [
        { text: "...What year do I think it is.", stage: 'more puzzled than offended', pause: 1.2 },
        { text: "Well — fifty-six." },
        { text: "Nineteen fifty-six. Son, are you all right? Is this a — have you been at it a long while tonight?", pause: 1.0 },
      ],
      effects: [
        { op: 'flag', name: 'pratt_said_1956' },
        { op: 'flag', name: 'temporal_confirmed' },
        { op: 'log', text: 'PRATT E states the year is 1956.', kind: 'anomaly' },
        { op: 'account.corrupt', id: 'WH-00318', kind: 'reveal' },
        { op: 'horror', event: 'crtGlitch', args: { severity: 0.8, duration: 3.4 } },
        { op: 'horror', event: 'clockDrift', args: { minutes: -14 } },
      ],
      next: 'after_answer',
    },

    after_answer: {
      speaker: 'player',
      choices: [
        {
          text: "Mr. Pratt, it's 1999.",
          goto: 'told_him',
          effects: [
            { op: 'flag', name: 'told_pratt_the_year' },
            { op: 'flag', name: 'broke_the_warning' },
            { op: 'log', text: 'Told PRATT E the year. The line advised against this.', kind: 'warn' },
          ],
        },
        {
          text: "...No. No, I'm fine. Long night, that's all.",
          goto: 'kept_it',
          effects: [
            { op: 'flag', name: 'kept_the_year_from_pratt' },
            { op: 'trust', delta: 1 },
          ],
        },
        {
          text: "Mr. Pratt, who's the president?",
          goto: 'eisenhower',
          once: true,
          effects: [{ op: 'flag', name: 'asked_president' }],
        },
      ],
    },

    eisenhower: {
      speaker: 'caller',
      lines: [
        { text: "Eisenhower.", stage: 'without a pause, the way you answer what day it is' },
        { text: "...Now I know you're having me on." },
      ],
      effects: [{ op: 'flag', name: 'pratt_eisenhower' }],
      next: 'after_answer',
    },

    told_him: {
      speaker: 'caller',
      lines: [
        { text: "", stage: 'the hum on the line gets louder', pause: 1.6 },
        { text: "That isn't funny." },
        { text: "That isn't — my wife is asleep in the next room. My wife is asleep in the next room and she is thirty-one years old.", stage: 'not angry. frightened.' },
        { text: "Why would you say a thing like that to a man.", pause: 1.4 },
      ],
      effects: [
        { op: 'flag', name: 'pratt_frightened' },
        { op: 'horror', event: 'degrade', args: { amount: 0.6, duration: 9 } },
      ],
      next: 'ending_told',
    },

    kept_it: {
      speaker: 'caller',
      lines: [
        { text: "Long night. I know about those." },
        { text: "You get yourself a cup of something. And send a fellow out when you can — we'll keep." },
        { text: "We've kept this long.", stage: 'he means nothing by it' },
      ],
      effects: [{ op: 'flag', name: 'pratt_calm' }],
      next: 'ending_kept',
    },

    declined: {
      speaker: 'caller',
      lines: [
        { text: "Goodnight to you. And thank you." },
        { text: "It's a comfort, somebody being there at this hour." },
      ],
      next: 'ending_kept',
    },

    ending_told: {
      speaker: 'caller',
      lines: [
        { text: "— I have to go. The lights just came up.", pause: 0.9 },
        { text: "The lights just came up and I didn't hear a truck.", stage: 'and then the carrier drops', pause: 1.6 },
      ],
      effects: [
        { op: 'sound', name: 'lineDrop' },
        { op: 'log', text: 'PRATT E - line dropped. No ANI. No trunk record.', kind: 'anomaly' },
        { op: 'beat', to: 8 },
      ],
      end: true,
    },

    ending_kept: {
      speaker: 'caller',
      lines: [
        { text: "Goodnight." },
        { text: "— oh, and if he's still out there at the pole, tell him he's stood in the wet.", pause: 1.2 },
        { text: "Tell him that. It matters.", stage: 'the carrier drops mid-word', pause: 1.4 },
      ],
      effects: [
        { op: 'sound', name: 'lineDrop' },
        { op: 'flag', name: 'pratt_warned_about_halloran' },
        { op: 'log', text: 'PRATT E - line dropped. No ANI. No trunk record.', kind: 'anomaly' },
        { op: 'beat', to: 8 },
      ],
      end: true,
    },

    back_from_hold: {
      speaker: 'caller',
      lines: [
        { text: "Hello? Hello, operator?", stage: 'operator' },
        { text: "...Oh. There you are. I thought you'd cut me off." },
      ],
      effects: [{ op: 'flag', name: 'pratt_said_operator' }],
      next: 'the_outage',
    },
  },
};
