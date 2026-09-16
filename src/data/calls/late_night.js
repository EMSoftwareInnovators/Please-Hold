/* ============================================================
   late_night.js -- the crisis, the crews, 4:17, and the morning.

   The single most important thing in this file is BETHEL HOUSE.
   While the building is coming apart, thirty-one people in a
   nursing home are on a generator with four hours of fuel in it,
   and that is a real problem with a real answer that the player
   can actually get right. The supernatural does not replace the
   job. It happens at the same time as the job, and the player
   only has one pair of hands.

   Then 0417, which is five fragments of one event arriving on
   five different telephones, and the player can only pick up
   one.

   Then the morning, which the game has to earn.
   ============================================================ */

/* ============================================================
   BETHEL HOUSE — THE REAL EMERGENCY
   ============================================================ */
const bethel_01 = {
  id: 'bethel_01',
  caller: {
    id: 'okonkwo', name: 'B. OKONKWO, RN — BETHEL HOUSE', display: 'BETHEL HOUSE',
    number: '555-0990', account: 'WH-41102', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'story',
  priority: 200,
  major: true,
  schedule: { type: 'beat', beat: 17 },
  hold: { patience: 200, longHold: 70, onReturnNode: 'back', trustOnTimeout: -3 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "This is Bethel House, the skilled nursing facility on the Pike. I sent you a fax and I don't know if anybody reads those." },
        { text: "We've been on generator since ten to two. I have thirty-one residents and about four hours of diesel." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        {
          text: "I read it. Six concentrators and two on suction. Tell me what changed.",
          goto: 'respected',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'read_the_bethel_fax' }],
          requires: { flags: ['carefac_fax'] },
        },
        { text: "Four hours from now, or four hours from ten to two?", goto: 'maths', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'did_the_bethel_maths' }] },
        { text: "Have you got a fuel supplier?", goto: 'supplier', effects: [{ op: 'trust', delta: 2 }] },
        { text: "You're on the list. I've got the whole county out.", goto: 'brushed', effects: [{ op: 'trust', delta: -2 }] },
      ],
    },
    respected: {
      speaker: 'caller',
      lines: [
        { text: "Oh — thank God. Somebody read it." },
        { text: "What's changed is the generator's running hotter than it should and I have a maintenance man who is seventy and honest, and he says he doesn't like it." },
      ],
      next: 'supplier',
    },
    maths: {
      speaker: 'caller',
      lines: [
        { text: "From ten to two. So call it two and a half hours now, and that's if nothing else comes on." },
        { text: "You're the first person tonight who asked me that instead of writing down four." },
      ],
      effects: [{ op: 'flag', name: 'bethel_real_number' }],
      next: 'supplier',
    },
    brushed: {
      speaker: 'caller',
      lines: [
        { text: "I understand that. I do." },
        { text: "I need you to understand that if that generator stops, I have six people whose oxygen stops with it, and I cannot carry six people." },
      ],
      next: 'supplier',
    },
    supplier: {
      speaker: 'caller',
      lines: [
        { text: "I have called the fuel company four times. It rings out. I think there's one man on and he's driving." },
        { text: "What I actually need from you is to know whether the power is coming back before the diesel runs out, because if it isn't I have to start moving people, and moving people at four in the morning kills some of them." },
      ],
      next: 'decide',
    },
    decide: {
      speaker: 'player',
      choices: [
        {
          text: "I'm going to send a crew to your feeder now. MH-12. It's a wire down and it's fixable.",
          goto: 'dispatching',
          effects: [
            { op: 'trust', delta: 3 },
            { op: 'flag', name: 'bethel_promised_crew' },
            { op: 'outage.create', id: 'TR-BETHEL', feeder: 'MH-12', address: '1100 BETHEL PIKE — BETHEL HOUSE', town: 'NEW BETHEL', cause: 'WIRE DOWN', customers: 210, priority: 1, hazard: true },
          ],
        },
        {
          text: "Don't move anybody yet. Give me twenty minutes and I'll have you a real answer.",
          goto: 'twenty',
          effects: [{ op: 'trust', delta: 3 }, { op: 'promise', key: 'twenty_minutes' }, { op: 'flag', name: 'bethel_twenty' }],
        },
        {
          text: "I can't promise the power. Start making the calls to move them now, while you have fuel.",
          goto: 'honest',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'bethel_told_to_move' }],
        },
      ],
    },
    dispatching: {
      speaker: 'caller',
      lines: [
        { text: "A crew. Right. Okay." },
        { text: "How long does a wire down take? Roughly. I won't hold you to it, I just need to know if it's a one-hour thing or a five-hour thing." },
      ],
      next: 'gate',
    },
    twenty: {
      speaker: 'caller',
      lines: [
        { text: "Twenty minutes. All right. I'll hold off on the phone tree." },
        { text: "You'll call me. You will actually call me." },
      ],
      next: 'gate',
    },
    honest: {
      speaker: 'caller',
      lines: [
        { text: "Okay." },
        { text: "Okay, that's — that is the answer I was afraid of and I would rather have it now than at half five." },
        { text: "I'm going to start ringing families." },
      ],
      next: 'gate',
    },

    /* The gate: it is not enough to say a crew is coming. Send one. */
    gate: {
      speaker: 'caller',
      waitFor: { anyCrewDispatched: true },
      hint: 'SEND A UNIT TO BETHEL PIKE — the ticket is on screen 2',
      next: 'sent',
    },
    sent: {
      speaker: 'caller',
      lines: [
        { text: "I can hear you doing something, which is more than I've had all night." },
        { text: "I'll tell you what I'm going to do. I'm going to go round and check everybody, and then I'm going to sit by this telephone." },
      ],
      effects: [
        { op: 'flag', name: 'bethel_crew_sent' },
        { op: 'log', text: 'BETHEL HOUSE - 31 residents, generator, unit dispatched.', kind: 'priority' },
        { op: 'schedule', call: 'bethel_02', delay: 45 },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [
        { text: "I'm here. I've been here." },
        { text: "The generator's still going. That's the headline." },
      ],
      next: 'decide',
    },
  },
};

const bethel_02 = {
  id: 'bethel_02',
  caller: {
    id: 'okonkwo', name: 'B. OKONKWO, RN — BETHEL HOUSE', display: 'BETHEL HOUSE',
    number: '555-0990', account: 'WH-41102', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'story',
  priority: 200,
  schedule: { type: 'queued' },
  hold: { patience: 150, longHold: 50, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "It's Bethel House." },
        { text: "The lights came back nine minutes ago." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "That'll be Twelve on the Pike. They got the wire cleared.", goto: 'thanks', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Is the generator off? Let it cool before you shut it down.", goto: 'careful', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'bethel_generator_advice' }] },
        { text: "Good. I'll close your ticket.", goto: 'thanks' },
      ],
    },
    careful: {
      speaker: 'caller',
      lines: [
        { text: "He's doing that now. He said the same thing you did, word for word, and he'll be pleased somebody agrees with him." },
      ],
      next: 'thanks',
    },
    thanks: {
      speaker: 'caller',
      lines: [
        { text: "I want to say something and then I'll let you go, because I know you've got a night." },
        { text: "I have been a night nurse for nineteen years and the utility has never once told me the truth about a restoration time." },
        { text: "You did. Twice." },
        { text: "Whoever you are — thank you. Go home when they let you." },
      ],
      effects: [
        { op: 'flag', name: 'bethel_resolved' },
        { op: 'log', text: 'BETHEL HOUSE restored. 31 residents. Generator secured.', kind: 'note' },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "It's fine. Take your time. We have light." }],
      next: 'q',
    },
  },
};

/* ============================================================
   THE CREWS
   Three conversations that are only about the job, until they
   are not. Halloran is the one whose father is in the incident
   file; nobody says so.
   ============================================================ */
const crew_halloran_late = {
  id: 'crew_halloran_late',
  caller: { id: 'halloran', name: 'UNIT 7 — HALLORAN', display: 'UNIT 7', voice: 'halloran', line: 'inside', era: 1999 },
  medium: 'radio',
  category: 'crew',
  schedule: { type: 'beat', beat: 12 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Dispatch, Seven. We're clear of the Orchard Street job. Pole's stood, primary's up, we're picking up tools." },
        { text: "Tell whoever writes the tickets that the address on that one was wrong by two houses. Not a complaint. Just tell them." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Copy that. I'll note it. You all right for another one?", goto: 'tired', effects: [{ op: 'trust', delta: 2 }] },
        { text: "How's the road up there?", goto: 'road', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Seven, copy. Stand by.", goto: 'tired' },
      ],
    },
    road: {
      speaker: 'caller',
      lines: [
        { text: "Road's bad. There's water across it by the creamery — the old creamery, where it goes to dirt." },
        { text: "I'd keep Twelve off it. Sikes drives like he's late for something." },
      ],
      effects: [{ op: 'flag', name: 'halloran_mentioned_creamery' }],
      next: 'tired',
    },
    tired: {
      speaker: 'caller',
      lines: [
        { text: "I'm good for another. I'm good for four more, I just don't want four more." },
        { text: "Dispatch — one thing. That circuit you had on the board earlier. BR something." },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        { text: "BR-01. It came up on the display. It's not a circuit.", goto: 'quiet', effects: [{ op: 'flag', name: 'told_halloran_br01' }] },
        { text: "Console fault. Engineering's problem.", goto: 'quiet' },
        { text: "Why?", goto: 'why', effects: [{ op: 'trust', delta: 2 }] },
      ],
    },
    why: {
      speaker: 'caller',
      lines: [
        { text: "No reason." },
        { text: "", pause: 1.4 },
        { text: "My old man worked that circuit. That's all. It's not a thing." },
      ],
      effects: [{ op: 'flag', name: 'halloran_father' }],
      next: 'quiet',
    },
    quiet: {
      speaker: 'caller',
      lines: [
        { text: "Copy. Seven clear." },
      ],
      end: true,
    },
  },
};

const crew_sikes_wrong_road = {
  id: 'crew_sikes_wrong_road',
  caller: { id: 'sikes', name: 'UNIT 12 — SIKES', display: 'UNIT 12', voice: 'sikes', line: 'inside', era: 1999 },
  medium: 'radio',
  category: 'anomaly',
  debt: 2,
  schedule: { type: 'beat', beat: 15 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Dispatch, Twelve." },
        { text: "I'm going to ask you something and I want you to just answer it." },
        { text: "Where am I?" },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "You're on County Road 18, south end. That's where I sent you.", goto: 'no', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Twelve, say again?", goto: 'again' },
        { text: "What can you see?", goto: 'sees', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'asked_sikes_what' }] },
      ],
    },
    again: {
      speaker: 'caller',
      lines: [
        { text: "I said where am I. On your map. What does your map say I'm on." },
      ],
      next: 'sees',
    },
    no: {
      speaker: 'caller',
      lines: [
        { text: "Yeah. That's what I thought you'd say." },
      ],
      next: 'sees',
    },
    sees: {
      speaker: 'caller',
      lines: [
        { text: "I'm on a road with a substation on it." },
        { text: "Fenced yard, three transformers, control house with the door off. It's not on my map and it's not on the county map in the glovebox." },
        { text: "The sign on the fence says Blackridge." },
      ],
      effects: [
        { op: 'flag', name: 'sikes_found_blackridge' },
        { op: 'log', text: 'UNIT 12 reports a substation at Blackridge. Not on any map I have.', kind: 'anomaly' },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        {
          text: "Twelve, get back in the truck and drive out the way you came in.",
          goto: 'leaves',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'pulled_sikes_out' }],
        },
        {
          text: "Is there anybody there?",
          goto: 'anybody',
          effects: [{ op: 'flag', name: 'asked_sikes_anybody' }],
        },
        {
          text: "Stay away from the fence.",
          goto: 'fence',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'said_the_fence_line' }],
        },
      ],
    },
    fence: {
      speaker: 'caller',
      lines: [
        { text: "...Why'd you say it like that." },
        { text: "I'm in the truck. I'm in the truck, dispatch." },
      ],
      next: 'leaves',
    },
    anybody: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.6 },
        { text: "The yard lights are on." },
        { text: "That yard has no service. There's no drop to it. I'm looking at where the drop would be and there isn't one." },
      ],
      effects: [{ op: 'flag', name: 'sikes_yard_lights' }],
      next: 'leaves',
    },
    leaves: {
      speaker: 'caller',
      lines: [
        { text: "Coming out. Dispatch — do me a favour and don't send me back up here." },
        { text: "Twelve clear." },
      ],
      effects: [
        { op: 'flag', name: 'sikes_left_blackridge' },
        /* And now the desk set stops transmitting, which puts the player at
           the far end of the corridor with their telephone behind them. */
        { op: 'flag', name: 'crew_needs_backup_set' },
      ],
      end: true,
    },
  },
};

const crew_ott_refuses = {
  id: 'crew_ott_refuses',
  caller: { id: 'ott', name: 'LINE 3 — OTT', display: 'LINE 3', voice: 'ott', line: 'inside', era: 1999 },
  medium: 'radio',
  category: 'crew',
  schedule: { type: 'beat', beat: 18 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Dispatch, Line Three. I'm awake, I'm dressed, and I'm not going." },
        { text: "You've got me down for the Blackridge job. There is no Blackridge job. There is no Blackridge." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "I didn't write that ticket.", goto: 'somebody', effects: [{ op: 'flag', name: 'denied_the_ticket' }] },
        { text: "You're right. I'm cancelling it.", goto: 'relieved', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'cancelled_blackridge' }] },
        { text: "Three, it's on my board. Somebody put it there.", goto: 'somebody', effects: [{ op: 'trust', delta: 1 }] },
      ],
    },
    somebody: {
      speaker: 'caller',
      lines: [
        { text: "Somebody." },
        { text: "You're on your own in that building. I've worked that desk. There's nobody to be somebody." },
      ],
      next: 'relieved',
    },
    relieved: {
      speaker: 'caller',
      lines: [
        { text: "I'll tell you what I told the last one who tried to send a truck up there." },
        { text: "I've been on this system thirty-one years. I've seen that circuit come up on a console twice." },
        { text: "Both times somebody had a bad night." },
        { text: "Three's going back to bed. Call me for something real." },
      ],
      effects: [
        { op: 'flag', name: 'ott_refused_blackridge' },
        { op: 'log', text: 'LINE 3 refused the Blackridge assignment. He has seen BR-01 before.', kind: 'anomaly' },
      ],
      end: true,
    },
  },
};

/* ============================================================
   0417 — FIVE FRAGMENTS OF ONE EVENT

   All five ring at once, on five different instruments. The
   player can answer exactly one. Each is a piece of the same
   eleven minutes seen from a different year, and none of them is
   a complete explanation.
   ============================================================ */
const fragment = (id, caller, lineKind, lines, flag) => ({
  id,
  caller: { ...caller, line: lineKind },
  category: 'anomaly',
  debt: 0,
  priority: 150,
  /* Fired by the 0417 sequence, not by another script. */
  schedule: { type: 'called' },
  hold: { patience: 999, longHold: 999 },
  entry: 'start',
  nodes: {
    start: { speaker: 'caller', lines, next: 'q' },
    q: {
      speaker: 'player',
      choices: [
        { text: "I'm here. Go ahead.", goto: 'more', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Say again — all of it.", goto: 'more' },
        { text: "", say: false, goto: 'more' },
      ],
    },
    more: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.4 },
        { text: "It is seventeen minutes past four." },
        { text: "", pause: 1.8 },
      ],
      effects: [
        { op: 'flag', name: flag },
        { op: 'log', text: `0417 - ${caller.name} - answered.`, kind: 'anomaly' },
        { op: 'sound', name: 'lineDrop' },
      ],
      end: true,
    },
  },
});

const s417_1956 = fragment('s417_1956',
  { id: 'pratt', name: 'E. PRATT', display: 'LINE 1 — MA 4-1112', number: 'MA 4-1112', voice: 'ott', era: 1956 },
  'era1956',
  [
    { text: "It's the crossed line again. It's every telephone on the Row." },
    { text: "There's a woman shouting about smoke and a man saying a number over and over." },
    { text: "And there's somebody counting. Can you hear him counting?" },
  ],
  'answered_1956_fragment');

const s417_1978 = fragment('s417_1978',
  { id: 'keefe', name: 'R. KEEFE', display: "SUPERVISOR'S DESK", number: 'x2240', voice: 'keefe', era: 1978 },
  'era1978',
  [
    { text: "All six. Every lamp on the board at once, and there aren't six calls in the county." },
    { text: "I've got Walter on the radio and I'm telling him to get his men off the fence and he can't hear me." },
    { text: "You can hear me. Why can you hear me and he can't." },
  ],
  'answered_1978_fragment');

const s417_1943 = fragment('s417_1943',
  { id: 'gaines', name: 'H. GAINES', display: 'RECORDS — x2214', number: 'BR 4-0112', voice: 'ott', era: 1943 },
  'era1956',
  [
    { text: "Two long and one short. That's mine. That's my ring." },
    { text: "Everybody on the ridge has picked up at once. All four of us, and the Kesslers, and somebody who isn't on our line at all." },
    { text: "There's a light in the substation yard and there shouldn't be, it's not built yet." },
  ],
  'answered_1943_fragment');

const s417_evp = fragment('s417_evp',
  { id: 'evp', name: '—', display: 'BREAK ROOM — x2219', number: '—', voice: 'whisper', era: 0 },
  'evp',
  [
    { text: "", pause: 1.2 },
    { text: "...all of you at once...", pause: 1.8 },
    { text: "...that is how it is done...", pause: 2.2 },
    { text: "...say something so I have it...", pause: 2.0 },
  ],
  'answered_evp_fragment');

const s417_internal = fragment('s417_internal',
  { id: 'self', name: '—', display: 'CORRIDOR — x2222', number: 'x2222', voice: 'neutral', era: 1999 },
  'degraded',
  [
    { text: "Don't stay on this one." },
    { text: "It's learning the room. Every voice it gets, it keeps." },
    { text: "Put it down. Write down what you heard and put it down." },
  ],
  'answered_self_fragment');

/* ============================================================
   THE MORNING
   ============================================================ */
const dayshift = {
  id: 'dayshift',
  caller: {
    id: 'reyes', name: 'M. REYES — DAY SHIFT', display: 'INTERNAL — LOBBY',
    number: 'x2200', voice: 'vance', line: 'inside', era: 1999,
  },
  category: 'story',
  priority: 250,
  schedule: { type: 'called' },      // the dawn sequence rings it
  hold: { patience: 999, longHold: 999 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Morning. It's Reyes, I'm in the lobby, the front door's being stupid again." },
        { text: "You look rough. That's not an insult, I've looked rough." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "It was a night.", goto: 'night', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Everything's in the log. All of it.", goto: 'log', effects: [{ op: 'flag', name: 'pointed_at_the_log' }] },
        { text: "Has anything strange ever happened to you on this desk?", goto: 'asked', effects: [{ op: 'flag', name: 'asked_reyes' }] },
      ],
    },
    night: {
      speaker: 'caller',
      lines: [
        { text: "Storm nights always are. I did the last one and I still think about it." },
        { text: "Board looks — okay, actually. You did all right." },
      ],
      next: 'handover',
    },
    log: {
      speaker: 'caller',
      lines: [
        { text: "I'll read it. I actually do read it, whatever Gloria says." },
        { text: "Anything I need for the day crews?" },
      ],
      next: 'handover',
    },
    asked: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.4 },
        { text: "Define strange." },
        { text: "", pause: 1.2 },
        { text: "...Yeah. Once. I put it in the book and then I took the week off." },
        { text: "The book's the right thing to do. Whatever it was." },
      ],
      effects: [{ op: 'flag', name: 'reyes_knows' }],
      next: 'handover',
    },
    handover: {
      speaker: 'caller',
      lines: [
        { text: "Right. Give me the board and go home." },
        { text: "Seriously — go home. Drive slow, there's still water on Nine." },
      ],
      effects: [{ op: 'flag', name: 'dayshift_done' }],
      end: true,
    },
  },
};

const last_call = {
  id: 'last_call',
  caller: {
    id: 'last', name: '—', display: 'LINE 1',
    number: '—', voice: 'ott', line: 'era1956', era: 0,
  },
  category: 'story',
  priority: 255,
  major: true,
  schedule: { type: 'called' },      // the dawn sequence rings it
  hold: { patience: 999, longHold: 999 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      /* Reyes answered it, listened, and held the receiver out without a
         word. That is staged in the sequence; this is what is on it. */
      lines: [
        { text: "", pause: 1.6 },
        { text: "Is that the one who was on all night?" },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "It is.", goto: 'good', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Who's asking?", goto: 'good', effects: [{ op: 'flag', name: 'asked_who_at_the_end' }] },
        { text: "", say: false, goto: 'good' },
      ],
    },
    good: {
      speaker: 'caller',
      lines: [
        { text: "Good." },
        { text: "", pause: 1.8 },
        { text: "I wanted to get you before you went." },
      ],
      next: 'final',
    },
    final: {
      speaker: 'caller',
      lines: [
        { text: "", pause: 1.6 },
        { text: "Thank you for not putting me on hold." },
        { text: "", pause: 2.4 },
      ],
      effects: [
        { op: 'flag', name: 'the_last_line' },
        { op: 'sound', name: 'lineDrop' },
        { op: 'log', text: 'Last call of the shift. 0558.', kind: 'anomaly' },
      ],
      end: true,
    },
  },
};

export default [
  bethel_01, bethel_02,
  crew_halloran_late, crew_sikes_wrong_road, crew_ott_refuses,
  s417_1956, s417_1978, s417_1943, s417_evp, s417_internal,
  dayshift, last_call,
];
