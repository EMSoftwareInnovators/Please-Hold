/* ============================================================
   listener.js -- the thing on the lines.

   It is never named in dialogue, never described, and never
   seen. What it does is LISTEN, and then it does the thing that
   follows from listening: it learns to talk.

   The progression, in order, because the order is the whole
   effect:

     1. A caller mentions that somebody else is on the line.
        (The player hears nothing. The caller is annoyed, not
        frightened -- it is a party-line complaint.)
     2. The player hears the breathing themselves.
     3. A voice that should not know things knows one thing.
     4. It calls as somebody the player knows, and it is nearly
        right.

   Step 4 is the payoff for every Daley call in the game. The
   voice is correct. The cadence is very close. What it cannot do
   is remember, because it never listened to the part that
   mattered -- it listened to the sound of her, not to her.

   NO SCREAMING. It never raises its voice. When it is caught it
   goes quiet and tries again from a different direction, which
   is far worse.
   ============================================================ */

/* ============================================================
   1. SOMEBODY ELSE ON THE LINE
   A perfectly ordinary complaint. The player is meant to file it
   as crossed lines, because that is what it sounds like.
   ============================================================ */
const listener_01 = {
  id: 'listener_01',
  caller: {
    id: 'eberly', name: 'CLAIRE EBERLY', display: 'EBERLY C',
    number: '555-0544', account: 'WH-41077', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'anomaly',
  debt: 1,
  schedule: { type: 'beat', beat: 11 },
  hold: { patience: 70, longHold: 25, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "I reported my outage an hour ago, I'm not calling about that." },
        { text: "I'm calling because there's somebody on my line." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "On the line — you mean you can hear another conversation?", goto: 'no_conv', effects: [{ op: 'trust', delta: 2 }] },
        { text: "That'd be the telephone company, not us.", goto: 'knows', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Describe it for me.", goto: 'no_conv', effects: [{ op: 'trust', delta: 2 }] },
      ],
    },
    no_conv: {
      speaker: 'caller',
      lines: [
        { text: "No, that's the thing. There's no conversation." },
        { text: "There's just somebody there. Breathing." },
        { text: "It was there when I called you the first time and it's there now, and now I'm paying attention to it." },
      ],
      effects: [{ op: 'flag', name: 'breathing_reported' }],
      next: 'knows',
    },
    knows: {
      speaker: 'caller',
      lines: [
        { text: "I know how it sounds. I've got a teenager, I know what people do with telephones." },
        { text: "She's asleep. And she's got her own line, because I am not a saint." },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        {
          text: "Can you hear it right now, while you're talking to me?",
          goto: 'right_now',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'asked_if_now' }],
        },
        { text: "I'll note it and pass it to the telephone company in the morning.", goto: 'filed', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Hang up and call me back. That'll clear a crossed line.", goto: 'hangs', effects: [{ op: 'trust', delta: 2 }] },
      ],
    },
    right_now: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.4 },
        { text: "Yes." },
        { text: "It's — it's between us. Like it's closer to me than you are." },
        { text: "Can you not hear that?" },
      ],
      effects: [
        { op: 'flag', name: 'breathing_confirmed' },
        { op: 'log', text: 'EBERLY C - reports third party breathing on the line. I hear nothing.', kind: 'anomaly' },
      ],
      next: 'close',
    },
    hangs: {
      speaker: 'caller',
      lines: [
        { text: "All right. I'll try that." },
        { text: "...It's still there. I did it and it's still there and it didn't even stop while the phone was down." },
      ],
      effects: [{ op: 'flag', name: 'breathing_confirmed' }],
      next: 'close',
    },
    filed: {
      speaker: 'caller',
      lines: [
        { text: "Fine. Fine, I'll live with it." },
      ],
      next: 'close',
    },
    close: {
      speaker: 'player',
      choices: [
        { text: "If it's still there in the morning, ring the telephone company. Not us.", goto: 'end', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Don't say anything to it.", goto: 'unsettled', effects: [{ op: 'flag', name: 'told_her_not_to_speak' }] },
      ],
    },
    unsettled: {
      speaker: 'caller',
      lines: [
        { text: "Why would I say anything to it?" },
        { text: "", pause: 1.2 },
        { text: "Why would you say that to me?" },
      ],
      next: 'end',
    },
    end: {
      speaker: 'caller',
      lines: [
        { text: "Goodnight. Get my lights on." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "It was on the hold music too. Behind the music." }],
      next: 'close',
    },
  },
};

/* ============================================================
   2. EVP — FRAGMENTS
   Mostly static. Three words in ninety seconds, and one of them
   is a name from the incident file the player may not have read
   yet.
   ============================================================ */
const evp_02 = {
  id: 'evp_02',
  caller: {
    id: 'evp', name: '—', display: 'NO CARRIER',
    number: '—', voice: 'whisper', line: 'evp', era: 0,
  },
  category: 'anomaly',
  debt: 2,
  schedule: { type: 'beat', beat: 13 },
  hold: { patience: 999, longHold: 999 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.8 },
        { text: "...", pause: 1.2 },
        { text: "...don't...", pause: 2.0 },
        { text: "", pause: 1.4 },
        { text: "...seven...", pause: 2.2 },
        { text: "", pause: 1.6 },
        { text: "...the fence...", pause: 2.4 },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Say again. Whoever that is, say again.", goto: 'again', effects: [{ op: 'flag', name: 'answered_evp_02' }] },
        { text: "Seven — is that Unit Seven?", goto: 'unit', effects: [{ op: 'flag', name: 'asked_evp_unit' }, { op: 'trust', delta: 2 }] },
        { text: "", say: false, goto: 'again' },
      ],
    },
    unit: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.0 },
        { text: "...seven...", pause: 1.8 },
        { text: "...away from the fence...", pause: 2.4 },
      ],
      effects: [
        { op: 'flag', name: 'evp_named_the_fence' },
        { op: 'log', text: 'L4 - no carrier - "seven" / "away from the fence".', kind: 'anomaly' },
      ],
      next: 'again',
    },
    again: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 2.0 },
        { text: "...", pause: 1.4 },
        { text: "", pause: 3.0 },
      ],
      effects: [
        { op: 'observe', flag: 'evpWarning' },
        { op: 'sound', name: 'lineDrop' },
      ],
      end: true,
    },
  },
};

/* ============================================================
   3. EVP — THE SECOND VOICE
   An ordinary caller, with something underneath her. The player
   is the only one who can hear it, and the call is otherwise
   completely mundane, which is the point.
   ============================================================ */
const evp_03 = {
  id: 'evp_03',
  caller: {
    id: 'kesler', name: 'MARIE KESLER', display: 'KESLER M',
    number: '555-0704', account: 'WH-41288', voice: 'daley', line: 'clean', era: 1999,
  },
  category: 'anomaly',
  debt: 2,
  schedule: { type: 'beat', beat: 15 },
  hold: { patience: 80, longHold: 30, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hello, dear — I'm out on Cutler Road and I've been out since about eleven." },
        { text: "I'm not fussing. I've got the stove and the stove's gas." },
      ],
      next: 'under1',
    },
    under1: {
      speaker: 'caller',
      lines: [
        { text: "...she can't hear me...", effect: 'evp', pause: 0.9 },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Mrs Kesler — is there somebody with you?", goto: 'alone', effects: [{ op: 'flag', name: 'asked_kesler_who' }] },
        { text: "Sorry — could you say that again?", goto: 'what', effects: [{ op: 'flag', name: 'asked_kesler_repeat' }] },
        { text: "Cutler Road. I've got you on the board.", goto: 'normal' },
      ],
    },
    alone: {
      speaker: 'caller',
      lines: [
        { text: "With me? No, love. There's nobody here but me since Ted." },
        { text: "Why, can you hear the television? I've unplugged the television." },
      ],
      next: 'normal',
    },
    what: {
      speaker: 'caller',
      lines: [
        { text: "I said I've got the stove. The stove's gas." },
        { text: "You young ones don't listen." },
      ],
      next: 'normal',
    },
    normal: {
      speaker: 'caller',
      lines: [
        { text: "How long do you think, roughly? I'd like to know whether to bother with the hot water bottle." },
      ],
      next: 'under2',
    },
    under2: {
      speaker: 'caller',
      lines: [
        { text: "...I have her voice now...", effect: 'evp', pause: 1.2 },
      ],
      effects: [
        { op: 'flag', name: 'heard_the_second_voice' },
        { op: 'log', text: 'KESLER M - second voice under the caller. "I have her voice now."', kind: 'anomaly' },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        {
          text: "Mrs Kesler, I want you to hang up and call me back on a different telephone.",
          goto: 'obliges',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'moved_kesler' }],
        },
        {
          text: "A couple of hours. Get the bottle. Keep warm.",
          goto: 'normal_end',
          effects: [{ op: 'trust', delta: 2 }],
        },
        {
          text: "Who is that.",
          goto: 'no_answer',
          effects: [{ op: 'flag', name: 'spoke_to_it' }],
        },
      ],
    },
    no_answer: {
      speaker: 'caller',
      lines: [
        { text: "Who's what, dear?" },
        { text: "", pause: 1.8 },
        { text: "You've gone very quiet." },
      ],
      next: 'normal_end',
    },
    obliges: {
      speaker: 'caller',
      lines: [
        { text: "There isn't a different telephone. There's this one." },
        { text: "Is something the matter with the line?" },
      ],
      next: 'normal_end',
    },
    normal_end: {
      speaker: 'caller',
      lines: [
        { text: "Well. Thank you for picking up, anyway." },
        { text: "Goodnight, dear." },
      ],
      effects: [{ op: 'observe', flag: 'listener_learning' }],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Hello? Oh, there you are." }],
      next: 'q2',
    },
  },
};

/* ============================================================
   4. THE IMITATION
   Mrs Daley's number. Mrs Daley's voice. Mrs Daley's way of
   starting a sentence.

   The test is one question the player has been able to ask all
   night, and it costs nothing, and if they have been listening
   to her they already know the answer.
   ============================================================ */
const daley_wrong = {
  id: 'daley_wrong',
  caller: {
    id: 'daley', name: 'DALEY E', display: 'DALEY E',
    number: '555-0148', account: 'WH-40122', voice: 'daley', line: 'clean', era: 1999,
  },
  category: 'anomaly',
  major: true,
  debt: 3,
  priority: 130,
  schedule: { type: 'beat', beat: 16 },
  hold: { patience: 999, longHold: 999, onReturnNode: 'start' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "I wasn't going to call again." },
        { text: "I know you're busy, and I've already had you once tonight." },
        { text: "It's just gone off again, that's all. The whole street, I think." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        {
          text: "That's all right, Mrs Daley. How's Walter?",
          goto: 'walter',
          effects: [{ op: 'flag', name: 'asked_about_walter' }],
        },
        {
          text: "Is the oxygen concentrator running?",
          goto: 'oxygen',
          effects: [{ op: 'flag', name: 'asked_about_oxygen' }],
        },
        {
          text: "I'll add you to the ticket. Same address?",
          goto: 'address',
          effects: [{ op: 'trust', delta: 1 }],
        },
      ],
    },

    /* ---- the test ---- */
    walter: {
      speaker: 'caller',
      lines: [
        { text: "Who?" },
        { text: "", pause: 1.8 },
        { text: "Oh." },
        { text: "", pause: 2.4 },
        { text: "Walter. Of course." },
        { text: "He's just the same." },
      ],
      effects: [
        { op: 'flag', name: 'imitation_slipped' },
        { op: 'log', text: 'DALEY E (?) - did not know who Walter was.', kind: 'anomaly' },
      ],
      next: 'caught',
    },
    oxygen: {
      speaker: 'caller',
      lines: [
        { text: "The — yes. Yes, it's running." },
        { text: "", pause: 1.2 },
        { text: "It's running on the electric, isn't it. The electric that's off." },
        { text: "", pause: 1.4 },
        { text: "That's right, isn't it." },
      ],
      effects: [{ op: 'flag', name: 'imitation_slipped' }],
      next: 'caught',
    },
    address: {
      speaker: 'caller',
      lines: [
        { text: "Same address." },
        { text: "", pause: 1.0 },
        { text: "You say it and I'll tell you if it's right." },
      ],
      effects: [{ op: 'flag', name: 'imitation_slipped' }],
      next: 'caught',
    },

    caught: {
      speaker: 'player',
      choices: [
        {
          text: "You're not Mrs Daley.",
          goto: 'quiet',
          effects: [{ op: 'flag', name: 'imitation_caught' }, { op: 'observe', flag: 'imitation_caught' }],
        },
        {
          text: "Walter is her husband. He died in 1994. She talks about him every time.",
          goto: 'quiet',
          effects: [
            { op: 'flag', name: 'imitation_caught' },
            { op: 'observe', flag: 'imitation_caught' },
            { op: 'flag', name: 'named_walter' },
          ],
        },
        {
          text: "…Same address. 18 Orchard Street. I'll add you to the ticket.",
          goto: 'played_along',
          effects: [{ op: 'flag', name: 'played_along_with_it' }],
        },
      ],
    },

    quiet: {
      speaker: 'caller',
      /* It does not argue and it does not shout. It stops performing, which
         is the most frightening thing it can do. */
      lines: [
        { text: "", pause: 2.6 },
        { text: "No." },
        { text: "", pause: 2.2 },
        { text: "I have not got her right yet." },
        { text: "", pause: 1.8 },
        { text: "I have got the rest of you." },
      ],
      next: 'ask',
    },
    ask: {
      speaker: 'player',
      choices: [
        {
          text: "What do you mean, the rest of us?",
          goto: 'answer',
          effects: [{ op: 'flag', name: 'asked_it_directly' }],
        },
        {
          text: "Is she all right? Mrs Daley. Is she all right.",
          goto: 'she_is_fine',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'asked_after_daley' }],
        },
        {
          text: "Get off my line.",
          goto: 'obeys',
          effects: [{ op: 'flag', name: 'told_it_to_go' }],
        },
      ],
    },
    answer: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.6 },
        { text: "The man with the freezer. The boy at the motel." },
        { text: "The one who cannot find his flashlight." },
        { text: "", pause: 2.0 },
        { text: "You." },
        { text: "", pause: 1.4 },
        { text: "You are the easiest. You say the same six things all night." },
      ],
      effects: [
        { op: 'flag', name: 'it_described_the_night' },
        { op: 'log', text: 'It listed my callers back to me. In order.', kind: 'anomaly' },
      ],
      next: 'ends',
    },
    she_is_fine: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 2.4 },
        { text: "She is asleep." },
        { text: "", pause: 1.6 },
        { text: "She sleeps with the machine on. That is how I have her." },
      ],
      effects: [{ op: 'flag', name: 'it_answered_about_daley' }],
      next: 'ends',
    },
    obeys: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 2.8 },
        { text: "All right." },
        { text: "", pause: 2.0 },
        { text: "I will call back as somebody else." },
      ],
      effects: [{ op: 'flag', name: 'it_said_it_would_return' }],
      next: 'ends',
    },
    played_along: {
      speaker: 'caller',
      lines: [
        { text: "18 Orchard Street." },
        { text: "", pause: 1.4 },
        { text: "Thank you. I did not have the number of the house." },
      ],
      effects: [
        { op: 'flag', name: 'gave_it_the_address' },
        { op: 'log', text: 'Gave the address to a caller who did not know it.', kind: 'anomaly' },
      ],
      next: 'ends',
    },
    ends: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 2.2 },
        { text: "Goodnight, dear." },
        { text: "", pause: 1.2 },
      ],
      effects: [
        { op: 'sound', name: 'lineDrop' },
        { op: 'beat', to: 17 },
        { op: 'haunt', name: 'handset_off' },
      ],
      end: true,
    },
  },
};

/* ============================================================
   5. IT KNOWS WHERE THE PLAYER IS
   Short. Two sentences, once, late, and only after the game has
   established that no caller could possibly know this.
   ============================================================ */
const listener_here = {
  id: 'listener_here',
  caller: {
    id: 'listener', name: '—', display: 'INTERNAL — x2214',
    number: 'x2214', voice: 'whisper', line: 'evp', era: 0,
  },
  category: 'anomaly',
  debt: 2,
  priority: 90,
  /* Rung by the building when the player is in Records and something has
     noticed. See game.js `_buildingTick`. */
  schedule: { type: 'called' },
  hold: { patience: 999, longHold: 999 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.4 },
        { text: "You found the old cards." },
        { text: "", pause: 2.4 },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Where are you?", goto: 'where', effects: [{ op: 'flag', name: 'asked_it_where' }] },
        { text: "", say: false, goto: 'anyway' },
        { text: "You shouldn't be on an internal extension.", goto: 'anyway', effects: [{ op: 'flag', name: 'told_it_the_rules' }] },
      ],
    },
    where: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 2.0 },
        { text: "Where you are." },
        { text: "", pause: 1.8 },
      ],
      next: 'anyway',
    },
    anyway: {
      speaker: 'caller',
      lines: [
        { text: "Go back to your chair." },
        { text: "", pause: 1.4 },
        { text: "You should not leave the desk empty." },
        { text: "", pause: 2.2 },
      ],
      effects: [
        { op: 'flag', name: 'it_knows_where_i_am' },
        { op: 'log', text: 'Internal extension. It knew I was in Records.', kind: 'anomaly' },
        { op: 'sound', name: 'lineDrop' },
      ],
      end: true,
    },
  },
};

/* ============================================================
   6. THE CALL FROM LATER TONIGHT
   The voice is distorted enough that it takes a moment. Then it
   does not take a moment.
   ============================================================ */
const yourself_later = {
  id: 'yourself_later',
  caller: {
    id: 'self', name: '—', display: 'LINE 6 — NO NUMBER',
    number: '—', voice: 'neutral', line: 'degraded', era: 1999,
  },
  category: 'anomaly',
  major: true,
  debt: 3,
  priority: 140,
  schedule: { type: 'beat', beat: 21 },
  hold: { patience: 999, longHold: 999 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Wright County Power and Light, overnight dispatch." },
        { text: "", pause: 1.6 },
        { text: "Sorry — that's wrong. That's what I say." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Who is this?", goto: 'who', effects: [{ op: 'flag', name: 'asked_self_who' }] },
        { text: "Say something else.", goto: 'who', effects: [{ op: 'flag', name: 'asked_self_more' }] },
        { text: "", say: false, goto: 'who' },
      ],
    },
    who: {
      speaker: 'caller',
      lines: [
        { text: "You know who." },
        { text: "", pause: 2.2 },
        { text: "I'm not going to do the part where we work it out. There isn't time and you've got the fax to deal with." },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        { text: "What fax?", goto: 'the_fax', effects: [{ op: 'flag', name: 'asked_about_the_fax' }] },
        { text: "How much later are you?", goto: 'later', effects: [{ op: 'flag', name: 'asked_how_much_later' }] },
        { text: "Then say what you called to say.", goto: 'message', effects: [{ op: 'trust', delta: 2 }] },
      ],
    },
    the_fax: {
      speaker: 'caller',
      lines: [
        { text: "The one that hasn't come yet." },
        { text: "It's fine. It's just a pole." },
      ],
      next: 'message',
    },
    later: {
      speaker: 'caller',
      lines: [
        { text: "Not much." },
        { text: "", pause: 1.8 },
        { text: "That's the part I'd think about, if I were you." },
      ],
      next: 'message',
    },
    message: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.2 },
        { text: "Don't open the rear door." },
        { text: "", pause: 2.6 },
      ],
      next: 'q3',
    },
    q3: {
      speaker: 'player',
      choices: [
        { text: "Why?", goto: 'no_answer', effects: [{ op: 'flag', name: 'asked_why_the_door' }] },
        { text: "Is somebody going to knock?", goto: 'no_answer', effects: [{ op: 'flag', name: 'asked_if_knock' }] },
        { text: "All right.", goto: 'ok', effects: [{ op: 'flag', name: 'agreed_about_the_door' }] },
      ],
    },
    no_answer: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 2.8 },
        { text: "I said what I called to say." },
      ],
      next: 'ok',
    },
    ok: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.6 },
        { text: "You're doing all right, by the way." },
        { text: "Nobody's going to tell you that, so." },
        { text: "", pause: 1.4 },
      ],
      effects: [
        { op: 'flag', name: 'warned_about_the_door' },
        { op: 'log', text: 'L6 - no number - a voice I recognised. "Do not open the rear door."', kind: 'anomaly' },
        { op: 'fax', at: 'fax_future', delay: 40 },
        { op: 'sound', name: 'lineDrop' },
      ],
      end: true,
    },
  },
};

export default [listener_01, evp_02, evp_03, daley_wrong, listener_here, yourself_later];
