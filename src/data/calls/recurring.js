/* ============================================================
   recurring.js -- the two people the player will recognise.

   Mrs Daley works because she comes back. These two are built on
   the same principle and pushed further: RUIZ at the Gas-N-Go
   and DENISE FERRIS out on Quarry Road each call three times
   across the night, and each of their later calls reads what the
   player actually did.

   Why this matters beyond characterisation: by 4am the player
   must be able to identify a caller from one sentence. That is a
   REQUIREMENT, not a flourish -- the imitation later in the
   night only works on somebody the player already knows by ear.

   RUIZ is also the game's window. The Gas-N-Go is on the state
   road across from the operations centre, and he can see the
   building. He is the only character who can tell the player
   what their own parking lot looks like.
   ============================================================ */

/* ============================================================
   RUIZ — GAS-N-GO, 2200 STATE HIGHWAY 9
   Call 1: annoyed. Pumps down, coolers down, a shift he cannot
   work. Ordinary commercial outage, and a bit rude.
   ============================================================ */
const ruiz_01 = {
  id: 'ruiz_01',
  caller: {
    id: 'ruiz', name: 'MARCO RUIZ — GAS-N-GO', display: 'GAS-N-GO #4',
    number: '555-0180', account: 'WH-42355', voice: 'sikes', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'beat', beat: 2 },
  hold: { patience: 65, longHold: 25, onReturnNode: 'back', trustOnTimeout: -1 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Gas-N-Go, number four, out on Nine. We're dark." },
        { text: "Pumps are down, coolers are down, the register's on a battery that's telling me it has eleven minutes." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Number four — that's the one across from the operations centre?", goto: 'across', effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'ruiz_located' }] },
        { text: "Anybody in the store?", goto: 'store', effects: [{ op: 'trust', delta: 2 }] },
        { text: "I'll take the report. Account number?", goto: 'store', effects: [{ op: 'trust', delta: 1 }] },
      ],
    },
    across: {
      speaker: 'caller',
      lines: [
        { text: "Yeah — hey, is that you? The building with the lot and the fence?" },
        { text: "Your lights are on. I'm looking at your lights right now and mine are off. How's that for a kick in the teeth." },
      ],
      effects: [{ op: 'flag', name: 'ruiz_can_see_the_building' }],
      next: 'store',
    },
    store: {
      speaker: 'caller',
      lines: [
        { text: "Two customers. Both of them wanted gas, both of them are now standing here wanting to tell me about it." },
        { text: "I can't sell them anything. The register's a paperweight and I'm not doing arithmetic on a bag." },
      ],
      next: 'advise',
    },
    advise: {
      speaker: 'player',
      choices: [
        {
          text: "Your coolers will hold to about four hours if you keep the doors shut. The frozen goes first.",
          goto: 'useful',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'helped_ruiz' }],
        },
        {
          text: "Highway 9 is on MH-12 and MH-12 has a wire down on it. You're not first.",
          goto: 'honest',
          effects: [{ op: 'trust', delta: 2 }],
        },
        { text: "I've got people with no heat. Gas pumps are further down my list.", goto: 'stung', effects: [{ op: 'trust', delta: -2 }] },
      ],
    },
    useful: {
      speaker: 'caller',
      lines: [
        { text: "Four hours." },
        { text: "All right. All right, that's a number, I can work with a number." },
        { text: "Nobody's given me a number all night." },
      ],
      next: 'end',
    },
    honest: {
      speaker: 'caller',
      lines: [
        { text: "A wire down. Like, on the ground down?" },
        { text: "...Okay, yeah, fine, that's worse than my milk." },
      ],
      next: 'end',
    },
    stung: {
      speaker: 'caller',
      lines: [
        { text: "Wow. Okay." },
        { text: "I'm not asking you to put me first, man, I'm asking you to tell me something." },
      ],
      next: 'end',
    },
    end: {
      speaker: 'caller',
      lines: [
        { text: "Whatever. I'll be here. I'm here till six." },
      ],
      effects: [
        { op: 'outage.create', feeder: 'MH-12', address: '2200 STATE HWY 9 — GAS-N-GO', town: 'MARROW HILL', cause: 'UNKNOWN', customers: 14 },
        { op: 'schedule', call: 'ruiz_02', delay: 70 },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Four minutes. I timed it. The register's dead now, by the way." }],
      next: 'advise',
    },
  },
};

/* ============================================================
   RUIZ, CALL 2
   He has calmed down, he is bored, and he is now the most useful
   person on the telephone: he can see the road, the trucks, and
   the operations centre.
   ============================================================ */
const ruiz_02 = {
  id: 'ruiz_02',
  caller: {
    id: 'ruiz', name: 'MARCO RUIZ — GAS-N-GO', display: 'GAS-N-GO #4',
    number: '555-0180', account: 'WH-42355', voice: 'sikes', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'queued' },
  hold: { patience: 90, longHold: 30, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hey. Gas-N-Go again. Don't hang up, I'm not complaining this time." },
        { text: "Your truck went past me about ten minutes ago heading north. The bucket one." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "North on Nine? That helps, actually. Thank you.", goto: 'pleased', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'ruiz_is_a_source' }] },
        { text: "Did you see which unit?", goto: 'unit', effects: [{ op: 'trust', delta: 2 }] },
        { text: "That'd be Seven. They're on a pole job up there.", goto: 'pleased', effects: [{ op: 'trust', delta: 2 }, { op: 'remember', key: 'told_ruiz_about_seven' }] },
      ],
    },
    unit: {
      speaker: 'caller',
      lines: [
        { text: "Uh — seven? There was a seven on the door." },
        { text: "Guy driving looked like he'd rather be anywhere else, which, same." },
      ],
      next: 'pleased',
    },
    pleased: {
      speaker: 'caller',
      lines: [
        { text: "It's dead here. I've had two cars in an hour and one of them was a cop who wanted to use the bathroom." },
        { text: "Coolers are holding, by the way. I did the thing you said. Doors shut." },
      ],
      next: 'ask',
    },
    ask: {
      speaker: 'player',
      choices: [
        {
          text: "Good. Do me a favour — if you see anything on the road you think we'd want, call it in.",
          goto: 'recruited',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'recruited_ruiz' }, { op: 'promise', key: 'asked_him_to_watch' }],
        },
        { text: "How's your night going otherwise?", goto: 'small', effects: [{ op: 'trust', delta: 2 }] },
        { text: "I've got to keep this line clear.", goto: 'brief' },
      ],
    },
    small: {
      speaker: 'caller',
      lines: [
        { text: "Man, it's a gas station at two in the morning in a storm." },
        { text: "I'm reading the back of a jerky packet. I know what's in jerky now. I wish I didn't." },
      ],
      next: 'recruited',
    },
    recruited: {
      speaker: 'caller',
      lines: [
        { text: "Yeah, I can do that. I'm looking at the road anyway." },
        { text: "Hey — while I've got you. Your parking lot. You've got a truck in your lot." },
      ],
      next: 'lot',
    },
    lot: {
      speaker: 'player',
      choices: [
        { text: "We don't. There's one car in the lot and it's mine.", goto: 'insists', effects: [{ op: 'flag', name: 'ruiz_truck_denied' }] },
        { text: "A truck? Ours?", goto: 'insists' },
      ],
    },
    insists: {
      speaker: 'caller',
      lines: [
        { text: "No, a — it's one of yours. A line truck. The old kind, with the boom on the back." },
        { text: "It's been there a while. I figured it was yours because who else has one." },
        { text: "It's — hang on." },
        { text: "Huh. It's not there now. Maybe I was looking at the fence." },
      ],
      effects: [
        { op: 'flag', name: 'ruiz_saw_the_truck' },
        { op: 'observe', flag: 'saw_old_truck' },
        { op: 'log', text: 'GAS-N-GO reports a line truck in our lot. Lot is empty.', kind: 'anomaly' },
      ],
      next: 'end',
    },
    brief: {
      speaker: 'caller',
      lines: [{ text: "Sure. Sorry. Go be busy." }],
      end: true,
    },
    end: {
      speaker: 'caller',
      lines: [
        { text: "Anyway. Call me if you want a coffee, I can't sell it but I can pour it." },
      ],
      effects: [{ op: 'schedule', call: 'ruiz_03', delay: 120 }],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "No worries. I've got nothing but time and jerky." }],
      next: 'ask',
    },
  },
};

/* ============================================================
   RUIZ, CALL 3
   Late. He is frightened and trying not to be, and what he is
   describing is the player's own building.
   ============================================================ */
const ruiz_03 = {
  id: 'ruiz_03',
  caller: {
    id: 'ruiz', name: 'MARCO RUIZ — GAS-N-GO', display: 'GAS-N-GO #4',
    number: '555-0180', account: 'WH-42355', voice: 'sikes', line: 'clean', era: 1999,
  },
  category: 'anomaly',
  debt: 2,
  schedule: { type: 'queued' },
  hold: { patience: 45, longHold: 18, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hey. It's Marco. Gas-N-Go." },
        { text: "You told me to call if I saw anything." },
        { text: "This is going to sound stupid." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Go ahead. I've had a night of things that sound stupid.", goto: 'tells', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Is anybody hurt?", goto: 'nobody', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Make it quick.", goto: 'tells' },
      ],
    },
    nobody: {
      speaker: 'caller',
      lines: [{ text: "No. No, nothing like that. Nobody's hurt." }],
      next: 'tells',
    },
    tells: {
      speaker: 'caller',
      lines: [
        { text: "Your building's dark." },
        { text: "It went dark like — forty minutes ago? All of it at once. And then some of it came back but not the big lights." },
        { text: "And I'm only saying this because you asked me to say things." },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        {
          text: "That's right. We lost power. I've been reading by the emergency lights.",
          goto: 'window',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'told_ruiz_about_the_power' }],
        },
        { text: "What do you mean, some of it came back?", goto: 'window', effects: [{ op: 'trust', delta: 2 }] },
      ],
    },
    window: {
      speaker: 'caller',
      lines: [
        { text: "Right, so — okay." },
        { text: "The window at the end. Not the big ones, the little one at the end of the building." },
        { text: "Somebody's been standing in it." },
      ],
      next: 'q3',
    },
    q3: {
      speaker: 'player',
      choices: [
        {
          text: "I'm the only one here, Marco.",
          goto: 'quiet',
          effects: [{ op: 'flag', name: 'ruiz_window_denied' }],
        },
        {
          text: "Which end? The end with the fence, or the road end?",
          goto: 'records_end',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'asked_ruiz_which_end' }],
        },
        { text: "That's me. I've been walking around.", goto: 'quiet' },
      ],
    },
    records_end: {
      speaker: 'caller',
      lines: [
        { text: "Fence end. The small window." },
        { text: "It's not a big thing. They're just standing there." },
      ],
      effects: [{ op: 'flag', name: 'ruiz_records_window' }],
      next: 'quiet',
    },
    quiet: {
      speaker: 'caller',
      lines: [
        { text: "Yeah." },
        { text: "Yeah, that's what I figured you'd say." },
        { text: "Look — I'm gonna lock the door here. Not because of that. It's just late." },
        { text: "You take care, man. Seriously." },
      ],
      effects: [
        { op: 'log', text: 'GAS-N-GO reports a figure in the Records window. I am alone in the building.', kind: 'anomaly' },
        { op: 'observe', flag: 'ruiz_watched_the_building' },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Still here. It's still there, if you were going to ask." }],
      next: 'q3',
    },
  },
};

/* ============================================================
   DENISE FERRIS — 41 QUARRY ROAD, CALDER
   Two children, one of them on a nebuliser. She is capable, she
   is not panicking, and she is doing arithmetic about a battery.

   She is the reason the player learns that a promise is a thing
   you can fail to keep.
   ============================================================ */
const ferris_01 = {
  id: 'ferris_01',
  caller: {
    id: 'ferris', name: 'DENISE FERRIS', display: 'FERRIS D',
    number: '555-0212', account: 'WH-40901', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'outage',
  priority: 30,
  schedule: { type: 'beat', beat: 3 },
  hold: { patience: 75, longHold: 28, onReturnNode: 'back', trustOnTimeout: -2 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hi — 41 Quarry Road, Calder. We're out." },
        { text: "I'm not going to keep you, I know you're busy. I just need to know one thing and then I'll go." },
        { text: "My son has a nebuliser. It's got a battery in it and the battery does about three hours." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        {
          text: "How old is he, and how often does he need it?",
          goto: 'details',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'asked_about_sam' }],
        },
        {
          text: "Let me put a medical flag on your account. That's a real thing, it moves you up.",
          goto: 'flagged',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'ferris_flagged' }],
        },
        { text: "Three hours should be plenty.", goto: 'plenty', effects: [{ op: 'trust', delta: -1 }] },
      ],
    },
    details: {
      speaker: 'caller',
      lines: [
        { text: "Sam's six. Twice a night usually, more if he's wound up, and he is very wound up, because the lights went out and his sister told him it was a ghost." },
        { text: "She's nine. She thinks she's funny." },
      ],
      effects: [{ op: 'flag', name: 'knows_about_sam' }],
      next: 'flagged',
    },
    plenty: {
      speaker: 'caller',
      lines: [
        { text: "Right. Plenty." },
        { text: "Is it, though? Because I don't know that, and you don't know that, because neither of us knows when it's coming back on." },
      ],
      next: 'flagged',
    },
    flagged: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Thank you." },
        { text: "Can I ask you something and you tell me the truth rather than the nice version?" },
      ],
      next: 'ask',
    },
    ask: {
      speaker: 'caller',
      lines: [
        { text: "If it's still off at five, do I put them in the car and drive to my mother's in Elmira?" },
        { text: "Because that's an hour on roads with trees down on them, and I'd rather not, but I will." },
      ],
      next: 'answer',
    },
    answer: {
      speaker: 'player',
      choices: [
        {
          text: "Don't drive tonight. Call me at four and I'll tell you honestly where we are.",
          goto: 'deal',
          effects: [
            { op: 'trust', delta: 3 },
            { op: 'promise', key: 'call_at_four' },
            { op: 'flag', name: 'ferris_deal' },
            { op: 'schedule', call: 'ferris_02', delay: 95 },
          ],
        },
        {
          text: "If it's still off at five, go. A battery you can measure beats a crew you can't.",
          goto: 'straight',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'told_ferris_to_go' }],
        },
        {
          text: "We'll have you back before five.",
          goto: 'promised',
          effects: [
            { op: 'promise', key: 'back_before_five' },
            { op: 'flag', name: 'promised_ferris_five' },
            { op: 'schedule', call: 'ferris_02', delay: 95 },
          ],
        },
      ],
    },
    deal: {
      speaker: 'caller',
      lines: [
        { text: "Four o'clock. All right. That's a deal." },
        { text: "Thank you. Genuinely — everyone else tonight has told me to stay calm and you've told me a time." },
      ],
      effects: [
        { op: 'outage.create', feeder: 'MH-11', address: '41 QUARRY RD', town: 'CALDER', cause: 'UNKNOWN', customers: 61, priority: 2 },
      ],
      end: true,
    },
    straight: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Okay, that's fair." },
        { text: "I'll get their coats out now so I'm not doing it at five in the dark." },
      ],
      effects: [
        { op: 'outage.create', feeder: 'MH-11', address: '41 QUARRY RD', town: 'CALDER', cause: 'UNKNOWN', customers: 61, priority: 2 },
        { op: 'schedule', call: 'ferris_02', delay: 110 },
      ],
      end: true,
    },
    promised: {
      speaker: 'caller',
      lines: [
        { text: "Before five." },
        { text: "You're sure? Because I'm going to stop worrying now, and I'd rather worry than be wrong." },
      ],
      effects: [
        { op: 'outage.create', feeder: 'MH-11', address: '41 QUARRY RD', town: 'CALDER', cause: 'UNKNOWN', customers: 61, priority: 2 },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "I'm here. Sam's asleep, actually. Finally." }],
      next: 'answer',
    },
  },
};

/* ============================================================
   FERRIS, CALL 2
   Around four. She is holding the player to what they said, and
   the script reads which of the three things they said.
   ============================================================ */
const ferris_02 = {
  id: 'ferris_02',
  caller: {
    id: 'ferris', name: 'DENISE FERRIS', display: 'FERRIS D',
    number: '555-0212', account: 'WH-40901', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'outage',
  priority: 40,
  schedule: { type: 'queued' },
  hold: { patience: 50, longHold: 20, onReturnNode: 'back', trustOnTimeout: -2 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "It's Denise Ferris. Quarry Road." },
      ],
      next: 'which',
    },
    which: {
      speaker: 'caller',
      lines: [
        { text: "It's four o'clock. I said I'd call, or you said you'd know by now — one of the two." },
      ],
      next: 'status',
    },
    status: {
      speaker: 'caller',
      lines: [
        { text: "Battery says forty minutes. He's used it more than usual because he's been crying, and he's been crying because he's six." },
        { text: "So. Where are we." },
      ],
      next: 'answer',
    },
    answer: {
      speaker: 'player',
      choices: [
        {
          text: "A crew is on your circuit now. It's a pole, it's two hours minimum. Go to Elmira.",
          goto: 'goes',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'ferris_sent_safely' }],
          requires: { flags: ['ferris_flagged'] },
        },
        {
          text: "I don't have a time for you and I'm not going to invent one. If you can go, go.",
          goto: 'goes',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'ferris_sent_safely' }],
        },
        {
          text: "Stay. I think we're close.",
          goto: 'stays',
          effects: [{ op: 'promise', key: 'told_her_to_stay' }, { op: 'flag', name: 'ferris_stayed' }],
        },
        {
          text: "Is there a neighbour with power? Sometimes one street is up and the next is not.",
          goto: 'neighbour',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'ferris_neighbour_idea' }],
        },
      ],
    },
    neighbour: {
      speaker: 'caller',
      lines: [
        { text: "...The Vogels. Up the hill. Their porch light's on." },
        { text: "Their porch light is on. I've been staring at this house for four hours and I never looked up the hill." },
        { text: "I'm going to put shoes on two children. Thank you. Thank you." },
      ],
      effects: [
        { op: 'flag', name: 'ferris_safe' },
        { op: 'log', text: 'FERRIS D - going to a neighbour with power. Nebuliser covered.', kind: 'note' },
        { op: 'schedule', call: 'ferris_03', delay: 70 },
      ],
      end: true,
    },
    goes: {
      speaker: 'caller',
      lines: [
        { text: "Okay." },
        { text: "Okay. I'd rather drive on a bad road than sit here doing sums." },
        { text: "Thank you for saying it straight." },
      ],
      effects: [
        { op: 'flag', name: 'ferris_safe' },
        { op: 'schedule', call: 'ferris_03', delay: 80 },
      ],
      end: true,
    },
    stays: {
      speaker: 'caller',
      lines: [
        { text: "Close." },
        { text: "All right. I'll trust you." },
        { text: "I'm going to sit up with him." },
      ],
      effects: [
        { op: 'flag', name: 'ferris_waiting' },
        { op: 'schedule', call: 'ferris_03', delay: 60 },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "I've got forty minutes of battery and you've had me on hold for some of it." }],
      next: 'answer',
    },
  },
};

/* ============================================================
   FERRIS, CALL 3
   Dawn. Whatever happened, happened, and she rings to close it
   out -- which is what people actually do.
   ============================================================ */
const ferris_03 = {
  id: 'ferris_03',
  caller: {
    id: 'ferris', name: 'DENISE FERRIS', display: 'FERRIS D',
    number: '555-0212', account: 'WH-40901', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'queued' },
  hold: { patience: 80, longHold: 30, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hi. It's Denise. I'm not reporting anything." },
      ],
      next: 'which',
    },
    which: {
      speaker: 'caller',
      lines: [
        { text: "Sam's asleep with the machine plugged in and Katie has eaten most of a box of somebody else's cereal." },
        { text: "I wanted you to know, because you were decent to me at one in the morning and again at four, and I doubt anybody ever tells you how those come out." },
      ],
      next: 'close',
    },
    close: {
      speaker: 'player',
      choices: [
        { text: "I'm glad. Thank you for calling back — nobody does.", goto: 'warm', effects: [{ op: 'trust', delta: 2 }] },
        { text: "That's what the job is. Get some sleep.", goto: 'warm', effects: [{ op: 'trust', delta: 1 }] },
      ],
    },
    warm: {
      speaker: 'caller',
      lines: [
        { text: "You too. You've been up all night as well." },
        { text: "It's getting light, have you noticed? You can see the hill." },
      ],
      effects: [{ op: 'flag', name: 'ferris_closed_out' }],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "That's all right. You're allowed." }],
      next: 'close',
    },
  },
};

export default [ruiz_01, ruiz_02, ruiz_03, ferris_01, ferris_02, ferris_03];
