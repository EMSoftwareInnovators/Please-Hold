/* ============================================================
   eras.js -- callers from 1943, 1987, and a night in 1961 that
   will not finish.

   The rule these are written to: THE CALLER NEVER ANNOUNCES THE
   YEAR. Gaines does not say "I am calling from 1943". He says
   the War Production Board deferred the pole line, and asks the
   player to ring two long and one short, and calls the road by a
   name the county stopped using in 1958. The player works it out
   -- and then goes down the corridor and finds the card that
   proves it.

   That last part is the whole design. A caller who says
   something impossible is a ghost story. A caller who says
   something impossible that the filing cabinet AGREES WITH is a
   different kind of problem.
   ============================================================ */

/* ============================================================
   1943 — HOWARD GAINES, BELL RIDGE ROAD

   Wartime. Deferred maintenance, a party line, an exchange that
   still had an operator, and a farm on a road that has had a
   different name since Eisenhower.
   ============================================================ */
const gaines_1943 = {
  id: 'gaines_1943',
  caller: {
    id: 'gaines', name: 'H. GAINES', display: 'UNAVAILABLE',
    number: 'BR 4-0112', voice: 'ott', line: 'era1956', era: 1943,
  },
  category: 'anomaly',
  major: true,
  debt: 3,
  priority: 120,
  schedule: { type: 'beat', beat: 12 },
  hold: { patience: 200, longHold: 60, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Operator? I've been holding for the power company.", effect: 'era1956' },
        { text: "Hello — is that the power company or is that still the exchange?" },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "This is Wright County Power, overnight dispatch. There's no operator on this line.", goto: 'confused', effects: [{ op: 'trust', delta: 1 }] },
        { text: "You've got the power company. Go ahead.", goto: 'reports', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Who am I speaking to?", goto: 'names', effects: [{ op: 'trust', delta: 2 }] },
      ],
    },
    confused: {
      speaker: 'caller',
      lines: [
        { text: "No operator." },
        { text: "Well, that's a thing. She's usually listening. Vera. She listens." },
      ],
      next: 'reports',
    },
    names: {
      speaker: 'caller',
      lines: [
        { text: "Gaines. Howard Gaines, out on Bell Ridge." },
        { text: "The account's Bell Ridge four, oh one one two, if that's what you want." },
      ],
      effects: [
        { op: 'flag', name: 'gaines_named' },
        { op: 'log', text: 'CALLER: GAINES H, "BELL RIDGE" - acct BR-4-0112 - not in CIS.', kind: 'anomaly' },
      ],
      next: 'reports',
    },
    reports: {
      speaker: 'caller',
      lines: [
        { text: "I've got no lights. Nobody on the ridge has lights. The Hallorans haven't either, I rang them." },
        { text: "It's the line along the top. It's been wanting attention since the spring and your fellow told me it's deferred." },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        { text: "Deferred by who?", goto: 'wpb', effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'asked_gaines_deferred' }] },
        { text: "Bell Ridge. Say that road name again.", goto: 'road', effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'asked_gaines_road' }] },
        { text: "I don't have a Bell Ridge Road on my map.", goto: 'road' },
      ],
    },
    wpb: {
      speaker: 'caller',
      lines: [
        { text: "By the board. The war production people." },
        { text: "Copper's spoken for. Everything's spoken for. I'm not complaining about it, I've a boy in it, I'm just telling you why the line's the way it is." },
      ],
      effects: [{ op: 'flag', name: 'gaines_said_war' }],
      next: 'road',
    },
    road: {
      speaker: 'caller',
      lines: [
        { text: "Bell Ridge. B-E-L-L." },
        { text: "Up past the creamery, where the road goes to dirt." },
      ],
      next: 'q3',
    },
    q3: {
      speaker: 'player',
      choices: [
        {
          text: "Mr Gaines — that road hasn't been called Bell Ridge since before I was born.",
          goto: 'the_pause',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'told_gaines_the_name' }],
        },
        {
          text: "The creamery burned down. There's been nothing up there for a long time.",
          goto: 'the_pause',
          effects: [{ op: 'flag', name: 'told_gaines_the_creamery' }],
        },
        {
          text: "Give me your telephone number and I'll have somebody look at the line.",
          goto: 'number',
          effects: [{ op: 'trust', delta: 3 }],
        },
      ],
    },
    number: {
      speaker: 'caller',
      lines: [
        { text: "Bell Ridge four, oh one one two." },
        { text: "It's a party line — four of us on it. You want two long and one short, or you'll get the Kesslers and she'll talk your ear off." },
      ],
      effects: [
        { op: 'flag', name: 'gaines_party_line' },
        { op: 'log', text: 'GAINES H - party line, "two long one short" - ring code.', kind: 'anomaly' },
      ],
      next: 'the_pause',
    },
    the_pause: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.4 },
        { text: "You sound a long way off." },
        { text: "You've sounded a long way off the whole time and I've been putting it down to the line." },
      ],
      next: 'q4',
    },
    q4: {
      speaker: 'player',
      choices: [
        {
          text: "Mr Gaines, what's the date?",
          goto: 'date',
          effects: [{ op: 'flag', name: 'asked_gaines_date' }],
        },
        {
          text: "It's the line. It's a bad night. Tell me about the pole line instead.",
          goto: 'deflect',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'let_gaines_be' }],
        },
        {
          text: "I'm going to look for your account. Stay on the line.",
          goto: 'waits',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'met_gaines' }, { op: 'task', id: 'pull_card' }],
        },
      ],
    },
    date: {
      speaker: 'caller',
      lines: [
        { text: "The — it's Thursday." },
        { text: "The eleventh. November." },
        { text: "You're asking me the year." },
        { text: "", pause: 1.2 },
        { text: "I'd rather you didn't." },
      ],
      effects: [
        { op: 'flag', name: 'gaines_knows' },
        { op: 'log', text: 'GAINES H - asked for the year. Would not say it.', kind: 'anomaly' },
      ],
      next: 'waits',
    },
    deflect: {
      speaker: 'caller',
      lines: [
        { text: "The pole line. Yes." },
        { text: "Third pole past the creamery has a crack in it you can put your hand in. I've told three of you now." },
        { text: "You're the first one who's been decent about it." },
      ],
      next: 'waits',
    },
    waits: {
      speaker: 'caller',
      lines: [
        { text: "I'll wait. I've nothing else to do, it's black as pitch in here." },
      ],
      effects: [{ op: 'flag', name: 'met_gaines' }],
      next: 'wait_card',
    },

    /* The gate: the CIS has never heard of him. The card index has.
       The player has to physically go and find out. */
    wait_card: {
      speaker: 'caller',
      waitFor: { flags: ['gaines_confirmed'] },
      hint: 'FIND HIM IN RECORDS — the card index, drawer F-K',
      next: 'found',
    },
    found: {
      speaker: 'player',
      choices: [
        {
          text: "Mr Gaines. I've got your card in my hand. Bell Ridge Road, meter set in 1939.",
          goto: 'card_read',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'read_gaines_his_card' }],
        },
        {
          text: "There's a note on your card I'm not going to read to you.",
          goto: 'the_note',
          effects: [{ op: 'flag', name: 'withheld_the_note' }],
        },
      ],
    },
    card_read: {
      speaker: 'caller',
      lines: [
        { text: "That's it. That's mine." },
        { text: "So you've got me. Good." },
        { text: "Is there a note on it? There's always a note. They write everything down." },
      ],
      next: 'the_note',
    },
    the_note: {
      speaker: 'player',
      choices: [
        {
          text: "There's a note from August of '44. It says service discontinued.",
          goto: 'told',
          effects: [{ op: 'flag', name: 'told_gaines_the_note' }, { op: 'trust', delta: 1 }],
        },
        {
          text: "It says the line's deferred. That's all it says.",
          goto: 'spared',
          effects: [{ op: 'flag', name: 'spared_gaines' }, { op: 'trust', delta: 2 }],
        },
      ],
    },
    told: {
      speaker: 'caller',
      lines: [
        { text: "Discontinued." },
        { text: "", pause: 1.6 },
        { text: "Right." },
        { text: "That'll be why it's so dark, then." },
        { text: "", pause: 1.0 },
        { text: "You've been very good about it. Better than the last one." },
      ],
      effects: [
        { op: 'flag', name: 'gaines_resolved' },
        { op: 'observe', flag: 'gaines_confirmed' },
        { op: 'log', text: 'GAINES H - told him. He took it well. That is worse.', kind: 'anomaly' },
        { op: 'beat', to: 13 },
      ],
      end: true,
    },
    spared: {
      speaker: 'caller',
      lines: [
        { text: "Deferred. Well. That's the war for you." },
        { text: "You'll send somebody when you can. I know how it is." },
        { text: "Goodnight to you. Mind how you go." },
      ],
      effects: [
        { op: 'flag', name: 'gaines_resolved' },
        { op: 'log', text: 'GAINES H - did not tell him. He is waiting for a crew.', kind: 'anomaly' },
        { op: 'beat', to: 13 },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [
        { text: "You're back. I thought the line had gone." },
        { text: "The music was pleasant. I've not heard music in a while." },
      ],
      next: 'wait_card',
    },
  },
};

/* ============================================================
   1987 — KARL HALVORSEN, 300 COMMERCE STREET

   The uncomfortable one. He does not sound like the past. He
   sounds like somebody's uncle: video rental, tanning beds, a
   demand charge he is still annoyed about. The wrongness is
   entirely in the details, and the building he is calling from
   has been a bank since 1991.
   ============================================================ */
const halvorsen_1987 = {
  id: 'halvorsen_1987',
  caller: {
    id: 'halvorsen', name: 'K. HALVORSEN', display: 'HALVORSEN VIDEO',
    number: '555-0388', voice: 'merrick', line: 'era1978', era: 1987,
  },
  category: 'anomaly',
  debt: 3,
  priority: 110,
  schedule: { type: 'beat', beat: 14 },
  hold: { patience: 90, longHold: 30, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Yeah, hi — Halvorsen, 300 Commerce. Video and tanning." },
        { text: "I've got no power and I've got about four thousand dollars of tape stock in a room that is going to get very warm." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "300 Commerce. Say that again?", goto: 'repeat', effects: [{ op: 'flag', name: 'asked_halvorsen_address' }] },
        { text: "Tape stock — videotapes?", goto: 'tapes', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Let me look up the account.", goto: 'lookup', effects: [{ op: 'trust', delta: 2 }] },
      ],
    },
    tapes: {
      speaker: 'caller',
      lines: [
        { text: "Videotapes, yes. Eleven hundred of them. It's a rental store, that's the whole business." },
        { text: "And six beds in the back, and those have got ballasts in them that do not like a hard shutdown." },
      ],
      next: 'lookup',
    },
    repeat: {
      speaker: 'caller',
      lines: [
        { text: "Three hundred Commerce Street. Between the pharmacy and the place that was the shoe shop." },
        { text: "Big window. You can't miss it, there's a cutout of Schwarzenegger in it." },
      ],
      effects: [{ op: 'flag', name: 'halvorsen_described_it' }],
      next: 'lookup',
    },
    lookup: {
      speaker: 'caller',
      lines: [
        { text: "Account's — hang on, it's on the bill — WH three one oh eight eight." },
      ],
      effects: [{ op: 'flag', name: 'halvorsen_gave_account' }],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        {
          text: "That account isn't active. 300 Commerce is Marrow Hill Savings.",
          goto: 'bank',
          effects: [{ op: 'flag', name: 'told_halvorsen_bank' }],
        },
        {
          text: "The pharmacy closed. The shoe shop's been a nail place for years.",
          goto: 'bank',
          effects: [{ op: 'flag', name: 'told_halvorsen_street' }],
        },
        {
          text: "I'll take the report. Anything else on the circuit I should know?",
          goto: 'normal',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'played_it_straight_halvorsen' }],
        },
      ],
    },
    normal: {
      speaker: 'caller',
      lines: [
        { text: "The whole block's out. Pharmacy's out, the bar's out." },
        { text: "The bar being out is how you'll get calls, by the way. Nobody phones about a video store." },
      ],
      next: 'wrong',
    },
    bank: {
      speaker: 'caller',
      lines: [
        { text: "...No, it's not." },
        { text: "It's not a bank, it's my shop. I'm standing in it." },
        { text: "I've been in this unit since '85." },
      ],
      next: 'wrong',
    },
    wrong: {
      speaker: 'caller',
      lines: [
        { text: "Look, is there somebody else there? Somebody who knows the town?" },
        { text: "No offence. You sound young." },
      ],
      next: 'q3',
    },
    q3: {
      speaker: 'player',
      choices: [
        {
          text: "There's nobody else here. Mr Halvorsen — what's on the television in your window?",
          goto: 'window',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'asked_halvorsen_window' }],
        },
        {
          text: "Humour me. What year do you think it is?",
          goto: 'year',
          effects: [{ op: 'flag', name: 'asked_halvorsen_year' }],
        },
        {
          text: "I'm going to check a paper record. Give me a minute.",
          goto: 'waits',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'met_halvorsen' }, { op: 'task', id: 'pull_card' }],
        },
      ],
    },
    window: {
      speaker: 'caller',
      lines: [
        { text: "Nothing's on it, the power's out." },
        { text: "It was the Predator trailer. It's been the Predator trailer for two weeks because the kid who does the window is lazy." },
      ],
      effects: [{ op: 'flag', name: 'halvorsen_dated_himself' }],
      next: 'waits',
    },
    year: {
      speaker: 'caller',
      lines: [
        { text: "What year — what kind of question is that?" },
        { text: "It's eighty-seven. It's the eleventh of November, nineteen eighty-seven, and I have got wet stock and a dead register." },
        { text: "Why would you ask me that." },
      ],
      effects: [
        { op: 'flag', name: 'halvorsen_said_1987' },
        { op: 'log', text: 'HALVORSEN K - states date as 11 NOV 1987.', kind: 'anomaly' },
      ],
      next: 'waits',
    },
    waits: {
      speaker: 'caller',
      lines: [
        { text: "Fine. I'll hold. It's not like I can do anything else." },
      ],
      effects: [{ op: 'flag', name: 'met_halvorsen' }],
      next: 'wait_card',
    },
    wait_card: {
      speaker: 'caller',
      waitFor: { flags: ['halvorsen_confirmed'] },
      hint: 'CHECK THE PAPER — card index, drawer F-K',
      next: 'found',
    },
    found: {
      speaker: 'player',
      choices: [
        {
          text: "Mr Halvorsen. Your account closed in April of 1991. The business failed.",
          goto: 'told',
          effects: [{ op: 'flag', name: 'told_halvorsen' }],
        },
        {
          text: "I've got your card. Forty-seven kilowatts, refrigeration and lamp load. That's you.",
          goto: 'confirmed',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'confirmed_halvorsen_only' }],
        },
      ],
    },
    confirmed: {
      speaker: 'caller',
      lines: [
        { text: "Forty-seven. That's the number I argued about." },
        { text: "See, that's — thank you. Somebody in that building knows what they're doing." },
      ],
      next: 'told',
    },
    told: {
      speaker: 'caller',
      lines: [
        { text: "Failed." },
        { text: "", pause: 1.3 },
        { text: "It was the beds, wasn't it. I said the beds were a mistake. Sharon said the beds." },
        { text: "", pause: 1.0 },
        { text: "Is Sharon — no. No, don't." },
        { text: "Don't tell me anything else. I'm going to go and lock up." },
      ],
      effects: [
        { op: 'flag', name: 'halvorsen_resolved' },
        { op: 'log', text: 'HALVORSEN K - 300 Commerce - business failed 1991. He was standing in it.', kind: 'anomaly' },
        { op: 'beat', to: 15 },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Four minutes. I counted. This is why people rent from the supermarket now." }],
      next: 'wait_card',
    },
  },
};

/* ============================================================
   ALICE MERCER — THE ONE WHO KEEPS CALLING

   February 1961. She telephones about smoke upstairs, takes the
   advice, thanks the player, and hangs up. Then she does it
   again. Then she does it again, and the third time the player
   can say the thing that breaks it.

   Not a jumpscare. The horror is that she is polite every time.
   ============================================================ */
const mercer = (n) => ({
  id: `mercer_0${n}`,
  caller: {
    id: 'mercer', name: 'A. MERCER', display: n === 1 ? 'MERCER A' : 'MERCER A',
    number: 'MA 2-0418', voice: 'daley', line: 'era1956', era: 1961,
  },
  category: 'anomaly',
  debt: n === 3 ? 3 : 2,
  priority: 100 + n,
  schedule: n === 1 ? { type: 'beat', beat: 13 } : { type: 'queued' },
  hold: { patience: 120, longHold: 40, onReturnNode: 'start' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      /* The same three sentences, in the same order, every time. Word for
         word. That is the entire mechanism and it must not be varied. */
      lines: [
        { text: "There's smoke upstairs." },
        { text: "I'm sorry to telephone so late. There's smoke upstairs and I can't tell where it's coming in from." },
        { text: "It smells like when the iron's been left on." },
      ],
      next: n === 3 ? 'third' : 'q',
    },

    ...(n === 3 ? {} : { q: {
      speaker: 'player',
      choices: [
        {
          text: "Get out of the building. Now. Don't stop for anything.",
          goto: 'obeys',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: `mercer_${n}_told_out` }],
        },
        {
          text: "Is it the wall? Put your hand flat on the wall and tell me if it's warm.",
          goto: 'wall',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: `mercer_${n}_wall` }],
        },
        {
          text: "Have you called the fire department?",
          goto: 'fire',
          effects: [{ op: 'trust', delta: 2 }],
        },
      ],
    } }),
    ...(n === 3 ? {} : { wall: {
      speaker: 'caller',
      lines: [
        { text: "The wall. All right." },
        { text: "", pause: 1.0 },
        { text: "It's warm. By the stairs it's warm." },
        { text: "Oh — that's not right, is it. That's not right." },
      ],
      next: 'obeys',
    },
    fire: {
      speaker: 'caller',
      lines: [
        { text: "I telephoned you. You're the electric. It's the electric that does this." },
        { text: "The landlord said it was the electric." },
      ],
      next: 'obeys',
    } }),
    obeys: {
      speaker: 'caller',
      lines: [
        { text: "Yes. Yes, all right. I'll get my coat." },
        { text: "Thank you. You've been very kind." },
        { text: "Goodnight." },
      ],
      effects: n === 1
        ? [
          { op: 'log', text: 'MERCER A - 9 Depot St - smoke, advised to evacuate.', kind: 'priority' },
          { op: 'schedule', call: 'mercer_02', delay: 55 },
        ]
        : [
          { op: 'log', text: 'MERCER A - again. Same words. Same order.', kind: 'anomaly' },
          { op: 'flag', name: 'mercer_repeated' },
          { op: 'schedule', call: 'mercer_03', delay: 60 },
        ],
      end: true,
    },

    /* ---- the third call ---- */
    ...(n !== 3 ? {} : { third: {
      speaker: 'player',
      choices: [
        {
          text: "Mrs Mercer. You've called me twice already tonight.",
          goto: 'did_i',
          effects: [{ op: 'flag', name: 'loop_recognised' }, { op: 'observe', flag: 'loop_recognised' }],
        },
        {
          text: "Get out of the building. Now. Don't stop for anything.",
          goto: 'obeys',
          effects: [{ op: 'trust', delta: 2 }],
        },
        {
          text: "It's the same smoke, isn't it. It's always the same smoke.",
          goto: 'did_i',
          effects: [{ op: 'flag', name: 'loop_recognised' }, { op: 'observe', flag: 'loop_recognised' }],
        },
      ],
    },
    did_i: {
      speaker: 'caller',
      lines: [
        { text: "I did?" },
        { text: "", pause: 1.8 },
        { text: "...I did." },
        { text: "", pause: 1.4 },
      ],
      next: 'the_question',
    },
    the_question: {
      speaker: 'caller',
      lines: [
        { text: "Did I get out?" },
      ],
      next: 'answer',
    },
    answer: {
      speaker: 'player',
      choices: [
        {
          text: "Yes. You got out.",
          goto: 'kind_lie',
          effects: [{ op: 'flag', name: 'told_mercer_she_got_out' }, { op: 'trust', delta: 2 }],
        },
        {
          text: "No. I'm sorry. You didn't.",
          goto: 'truth',
          effects: [{ op: 'flag', name: 'told_mercer_truth' }],
        },
        {
          text: "I don't know. I only know what's on the card.",
          goto: 'honest',
          effects: [{ op: 'flag', name: 'told_mercer_honestly' }, { op: 'trust', delta: 1 }],
        },
        {
          text: "",
          say: false,
          goto: 'silence',
          effects: [{ op: 'flag', name: 'said_nothing_to_mercer' }],
        },
      ],
    },
    kind_lie: {
      speaker: 'caller',
      lines: [
        { text: "Oh, good." },
        { text: "", pause: 1.2 },
        { text: "Then why am I still on the stairs?" },
        { text: "", pause: 2.0 },
      ],
      effects: [{ op: 'log', text: 'MERCER A - told her she got out.', kind: 'anomaly' }],
      next: 'ends',
    },
    truth: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 2.2 },
        { text: "No. I didn't think so." },
        { text: "It's the stairs. I always get as far as the stairs." },
        { text: "", pause: 1.4 },
        { text: "Will you stay on until it's done? It's not long." },
      ],
      effects: [{ op: 'log', text: 'MERCER A - told her the truth. She asked me to stay on the line.', kind: 'anomaly' }],
      next: 'stay',
    },
    honest: {
      speaker: 'caller',
      lines: [
        { text: "The card." },
        { text: "There's a card, is there. With me on it." },
        { text: "", pause: 1.6 },
        { text: "That's something. I'd rather be on a card than not." },
      ],
      next: 'ends',
    },
    silence: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 2.6 },
        { text: "That's all right." },
        { text: "You don't have to say it." },
      ],
      next: 'ends',
    },
    stay: {
      speaker: 'player',
      choices: [
        {
          text: "I'll stay on.",
          goto: 'stayed',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'stayed_with_mercer' }],
        },
        {
          text: "I can't. I've got other lines.",
          goto: 'ends',
          effects: [{ op: 'flag', name: 'left_mercer' }],
        },
      ],
    },
    stayed: {
      speaker: 'caller',
      lines: [
        { text: "Thank you." },
        { text: "", pause: 2.4 },
        { text: "It's quieter with somebody there." },
        { text: "", pause: 3.0 },
      ],
      effects: [
        { op: 'flag', name: 'mercer_resolved' },
        { op: 'log', text: 'MERCER A - stayed on the line until it ended.', kind: 'anomaly' },
        { op: 'beat', to: 14 },
      ],
      end: true,
    },
    ends: {
      speaker: 'caller',
      lines: [
        { text: "I'll get my coat." },
        { text: "Thank you. You've been very kind." },
      ],
      effects: [
        { op: 'flag', name: 'mercer_resolved' },
        { op: 'beat', to: 14 },
      ],
      end: true,
    } }),
  },
});

export default [gaines_1943, halvorsen_1987, mercer(1), mercer(2), mercer(3)];
