/* ============================================================
   ordinary.js -- the filler traffic, and it is not filler.

   These are drawn at random between story beats. They exist so
   that the night has a texture: a man who wants to argue about a
   bill at one in the morning, a woman whose neighbors have power
   and she does not, a kid who should not be on the phone. None of
   them advance the plot.

   That is the point. The supernatural calls are only frightening
   in contrast to a job that is otherwise boringly, specifically
   real. Cut these and the horror has nothing to be measured
   against.
   ============================================================ */

/* ------------------------------------------------------------
   1. The neighbor comparison -- teaches service drop vs feeder
   ------------------------------------------------------------ */
export const przybylski = {
  id: 'przybylski_01',
  caller: {
    id: 'przybylski', name: 'TONI PRZYBYLSKI', display: 'PRZYBYLSKI T',
    number: '555-0620', account: 'WH-40877', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'random', weight: 5 },
  hold: { patience: 90, longHold: 30, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hi — so this is going to sound like a complaint and I want to say up front it isn't one." },
        { text: "My power's out. But my neighbor's isn't. Her porch light is on. I'm looking at it right now." },
        { text: "So either she's got something I don't, or I've got something she doesn't, and either way I feel crazy." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        {
          text: "That usually means it's your service, not the circuit. Is it the whole house or part of it?",
          goto: 'partial',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'diagnosed_service_drop' }],
        },
        { text: "Have you checked your main breaker?", goto: 'breaker', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Quarry Road, right? Let me look at the circuit.", goto: 'partial', requires: { lookedUp: 'WH-40877' }, effects: [{ op: 'trust', delta: 2 }] },
        { text: "I'll write it up the same as everyone else's.", goto: 'partial', effects: [{ op: 'trust', delta: -1 }] },
      ],
    },
    breaker: {
      speaker: 'caller',
      lines: [
        { text: "I did. First thing. I'm not — I know how that sounds, but I did." },
        { text: "Although. Huh. The kitchen's got lights. The kitchen's got lights and the rest doesn't." },
      ],
      next: 'partial',
    },
    partial: {
      speaker: 'caller',
      lines: [
        { text: "It's — okay, now that you say it. The kitchen works. The kitchen and the bathroom. Everything else is dead." },
        { text: "Is that bad? That sounds bad." },
      ],
      effects: [{ op: 'flag', name: 'przybylski_partial' }],
      next: 'advise',
    },
    advise: {
      speaker: 'player',
      choices: [
        {
          text: "Half your house means one leg of your service is open. That's ours to fix, and it's a real ticket.",
          goto: 'good_end',
          effects: [
            { op: 'outage.create', feeder: 'MH-11', address: '9 QUARRY RD', town: 'CALDER', cause: 'SERVICE DROP', customers: 1, priority: 2 },
            { op: 'trust', delta: 2 },
            { op: 'log', text: 'PRZYBYLSKI T - 9 QUARRY RD - open leg on service drop', kind: 'call' },
          ],
        },
        {
          text: "Don't run anything heavy on the half that works. Not the dryer, not the well pump.",
          goto: 'good_end',
          effects: [
            { op: 'outage.create', feeder: 'MH-11', address: '9 QUARRY RD', town: 'CALDER', cause: 'SERVICE DROP', customers: 1, priority: 2 },
            { op: 'trust', delta: 2 },
            { op: 'flag', name: 'warned_about_half_service' },
          ],
        },
        { text: "I'll put you in the queue with the rest of the street.", goto: 'flat_end', effects: [{ op: 'trust', delta: -1 }] },
      ],
    },
    good_end: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Okay, that's — thank you. I really did think I was going to get told it was my fuse box." },
        { text: "I'm going to go tell my neighbor I'm not crazy. She's going to be thrilled." },
      ],
      end: true,
    },
    flat_end: {
      speaker: 'caller',
      lines: [
        { text: "But the street's not out. That's what I'm — okay. Okay, sure." },
        { text: "Thanks anyway." },
      ],
      effects: [{ op: 'trust', delta: -1 }],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Still here! Sorry. Still here." }],
      next: 'advise',
    },
  },
};

/* ------------------------------------------------------------
   2. The wrong department -- a man who wants to argue about money
   ------------------------------------------------------------ */
export const boyer = {
  id: 'boyer_01',
  caller: {
    id: 'boyer', name: 'NADINE BOYER', display: 'BOYER N',
    number: '555-0367', account: 'WH-40455', voice: 'daley', line: 'clean', era: 1999,
  },
  category: 'nuisance',
  schedule: { type: 'random', weight: 4 },
  hold: { patience: 45, longHold: 20, onReturnNode: 'back', trustOnTimeout: -1 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "I want to talk to somebody about my bill." },
        { text: "And before you tell me the office is closed — I know the office is closed. That's why I'm calling now. You people are never there when you're open either." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        {
          text: "You've reached overnight dispatch. I handle outages. I can take a message for billing.",
          goto: 'deflated',
          effects: [{ op: 'trust', delta: 1 }],
        },
        {
          text: "I can't fix a bill from here, but I'm not going to hang up on you either. What happened?",
          goto: 'the_real_thing',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'listened_to_boyer' }],
        },
        { text: "Billing opens at eight.", goto: 'angry', effects: [{ op: 'trust', delta: -2 }] },
      ],
    },
    angry: {
      speaker: 'caller',
      lines: [
        { text: "Eight o'clock. Right." },
        { text: "Do you know what I do at eight o'clock? I'm at the Kroger. I'm at the Kroger until four and then I'm asleep, because I work nights, like you." },
        { text: "That was rude of me. I'm sorry. It's been a month." },
      ],
      next: 'the_real_thing',
    },
    deflated: {
      speaker: 'caller',
      lines: [
        { text: "...Oh. Dispatch." },
        { text: "So you're the one who sends the trucks." },
        { text: "Well. That's not who I wanted but it's the first person who's answered, so." },
      ],
      next: 'the_real_thing',
    },
    the_real_thing: {
      speaker: 'caller',
      lines: [
        { text: "It's a hundred and forty dollars more than last month and nothing's different. Nothing. Same house, same everything." },
        { text: "The note on my account says don't call after nine. That's my note. I put that on there because of the collections people." },
        { text: "So you see how it is. I can't call them and they can't call me and the number goes up.", stage: 'tired rather than angry' },
      ],
      next: 'close_q',
    },
    close_q: {
      speaker: 'player',
      choices: [
        {
          text: "I'll leave a note on the account asking billing to call you between four and eight. In writing, tonight.",
          goto: 'grateful',
          effects: [
            { op: 'trust', delta: 2 },
            { op: 'promise', key: 'billing_note' },
            { op: 'log', text: 'BOYER N - requested billing callback 1600-2000 - noted on acct', kind: 'note' },
          ],
        },
        {
          text: "A jump like that in a cold month is usually a water heater or a well pump running long.",
          goto: 'thinking',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'gave_boyer_a_lead' }],
        },
        { text: "There's nothing I can do about it from here.", goto: 'flat', effects: [{ op: 'trust', delta: -1 }] },
      ],
    },
    grateful: {
      speaker: 'caller',
      lines: [
        { text: "You'll actually do that?" },
        { text: "...All right. All right, thank you. I'm going to write down that I talked to you, so when nobody calls I can say I did this part right." },
      ],
      end: true,
    },
    thinking: {
      speaker: 'caller',
      lines: [
        { text: "The water heater." },
        { text: "Huh. The water heater's been making a noise. I thought that was just what they do." },
        { text: "That's — okay. That's something to go look at. Thank you. That's more than I got out of the eight o'clock people." },
      ],
      end: true,
    },
    flat: {
      speaker: 'caller',
      lines: [
        { text: "No. I didn't think so." },
        { text: "Goodnight." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "I'm still here. I've got nothing else going on." }],
      next: 'close_q',
    },
  },
};

/* ------------------------------------------------------------
   3. The grain elevator -- a commercial account, and a joke
   ------------------------------------------------------------ */
export const grain = {
  id: 'grain_01',
  caller: {
    id: 'grain', name: 'DALE — KETTLE CREEK FEED & GRAIN', display: 'KC FEED & GRAIN',
    number: '555-0310', account: 'WH-42011', voice: 'sikes', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'random', weight: 3 },
  hold: { patience: 100, longHold: 40, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Yeah, this is Dale out at the Feed and Grain on Creek Street. We're dark." },
        { text: "Now, I'm not calling about the lights. I'm calling about the dryer." },
        { text: "There's forty ton of corn in that dryer and if it sits wet it heats up, and if it heats up I've got a different kind of phone call to make." },
      ],
      effects: [{ op: 'remember', key: 'grain_dryer' }],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        {
          text: "Three-phase commercial on KC-04. I'm marking it priority.",
          goto: 'relieved',
          requires: { lookedUp: 'WH-42011' },
          effects: [
            { op: 'outage.create', feeder: 'KC-04', address: '3 CREEK ST', town: 'KETTLE CREEK', cause: 'FUSE', customers: 46, priority: 1 },
            { op: 'trust', delta: 2 },
            { op: 'log', text: 'KC FEED & GRAIN - 3PH out - grain dryer load - PRIORITY', kind: 'priority' },
          ],
        },
        {
          text: "How long have you got before that becomes a fire?",
          goto: 'the_number',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'asked_grain_timeline' }],
        },
        { text: "I'll add it to the list.", goto: 'unimpressed', effects: [{ op: 'trust', delta: -1 }] },
      ],
    },
    the_number: {
      speaker: 'caller',
      lines: [
        { text: "Six hours. Maybe eight if it's cold, and it is cold." },
        { text: "I appreciate you asking that. Most people ask me how many light bulbs I've got out." },
      ],
      effects: [
        { op: 'outage.create', feeder: 'KC-04', address: '3 CREEK ST', town: 'KETTLE CREEK', cause: 'FUSE', customers: 46, priority: 1 },
      ],
      next: 'relieved',
    },
    unimpressed: {
      speaker: 'caller',
      lines: [
        { text: "The list. Sure." },
        { text: "Well, when the list gets to me, tell 'em to bring a shovel." },
      ],
      effects: [
        { op: 'outage.create', feeder: 'KC-04', address: '3 CREEK ST', town: 'KETTLE CREEK', cause: 'FUSE', customers: 46, priority: 3 },
      ],
      end: true,
    },
    relieved: {
      speaker: 'caller',
      lines: [
        { text: "That's what I wanted to hear." },
        { text: "Hey — when your fella gets out here, tell him the gate's chained but the chain's not locked. Everybody gets that wrong." },
        { text: "Twenty years, everybody gets that wrong.", stage: 'almost fond about it' },
      ],
      effects: [{ op: 'remember', key: 'gate_chain' }],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Still here. Corn's still wet." }],
      next: 'q',
    },
  },
};

/* ------------------------------------------------------------
   4. A kid on the phone at midnight
   ------------------------------------------------------------ */
export const kid = {
  id: 'kid_01',
  caller: {
    id: 'kid', name: 'A CHILD', display: 'LUNDQUIST P',
    number: '555-0244', account: 'WH-40201', voice: 'boy', line: 'clean', era: 1999,
  },
  category: 'nuisance',
  schedule: { type: 'random', weight: 2 },
  hold: { patience: 30, longHold: 12, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hello? Is this the electricity?", stage: 'a kid, maybe nine' },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "This is the electric company, yeah. Is a grown-up there?", goto: 'grandpa', effects: [{ op: 'trust', delta: 1 }] },
        { text: "It is. What's going on over there?", goto: 'explains', effects: [{ op: 'trust', delta: 1 }] },
        { text: "It's very late to be on the phone.", goto: 'chastened' },
      ],
    },
    chastened: {
      speaker: 'caller',
      lines: [
        { text: "...I know." },
        { text: "Grandpa's asleep in the chair and the lights went off and the generator's making the noise." },
      ],
      next: 'explains',
    },
    explains: {
      speaker: 'caller',
      lines: [
        { text: "The lights went off and Grandpa started the generator and now it's really loud and it smells." },
        { text: "He said don't wake him up unless it's a emergency. Is it a emergency?" },
      ],
      next: 'the_important_bit',
    },
    grandpa: {
      speaker: 'caller',
      lines: [
        { text: "He's asleep. He's in the chair." },
        { text: "The generator's on. It's in the garage and it smells like the mower." },
      ],
      next: 'the_important_bit',
    },
    the_important_bit: {
      speaker: 'player',
      choices: [
        {
          text: "Is the garage door open? All the way open?",
          goto: 'the_door',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'caught_the_generator' }],
        },
        {
          text: "Go wake him up. Tell him dispatch said it's okay to wake him.",
          goto: 'goes_to_wake',
          effects: [{ op: 'trust', delta: 2 }],
        },
        { text: "No, it's not an emergency. The power will come back on.", goto: 'missed_it', effects: [{ op: 'flag', name: 'missed_the_generator' }] },
      ],
    },
    the_door: {
      speaker: 'caller',
      lines: [
        { text: "...No. It's down. It's down because of the rain." },
      ],
      next: 'now_act',
    },
    now_act: {
      speaker: 'player',
      choices: [
        {
          text: "Open the garage door right now, then go wake your grandpa. Right now. Go.",
          goto: 'goes',
          effects: [
            { op: 'flag', name: 'kid_saved' },
            { op: 'trust', delta: 3 },
            { op: 'log', text: 'LUNDQUIST - generator running in closed garage - child instructed to ventilate and wake adult', kind: 'priority' },
          ],
        },
      ],
    },
    goes: {
      speaker: 'caller',
      lines: [
        { text: "Okay—", stage: 'the receiver knocks against something; running feet' },
        { text: "...", stage: 'a long pause, and then a door rolling up, and rain' },
        { text: "It's open. I'm gonna go get him." },
        { text: "Are you gonna be in trouble for talking to me?" },
      ],
      next: 'goodbye',
    },
    goes_to_wake: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Okay, I'll tell him you said." },
        { text: "Thanks, electricity." },
      ],
      end: true,
    },
    missed_it: {
      speaker: 'caller',
      lines: [
        { text: "Okay." },
        { text: "...It's really loud though." },
        { text: "Bye." },
      ],
      effects: [{ op: 'log', text: 'LUNDQUIST - child called re: generator. No follow-up given.', kind: 'warn' }],
      end: true,
    },
    goodbye: {
      speaker: 'player',
      choices: [
        { text: "No. You did exactly right. Go get him.", goto: 'end_good', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Go on. Hang up and go.", goto: 'end_good' },
      ],
    },
    end_good: {
      speaker: 'caller',
      lines: [{ text: "Okay. Bye." }],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Hello? Are you still there? The music stopped." }],
      next: 'the_important_bit',
    },
  },
};

export default [przybylski, boyer, grain, kid];
