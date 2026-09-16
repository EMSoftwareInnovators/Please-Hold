/* ============================================================
   night_traffic.js -- ten ordinary calls.

   These are not filler. They are the floor the rest of the game
   stands on: a player who has spent an hour telling a man that
   his freezer will hold for four hours, and being asked twice
   whether the utility is going to pay for the meat, is a player
   who knows what a normal telephone call sounds like. Everything
   frightening in this game is frightening BY COMPARISON.

   House style, the same as the existing scripts:
     * people do not answer the question they were asked
     * people talk over the dispatcher
     * people are embarrassed, or rude, or funny, or tired
     * most of them are none of those. Most of them are just
       people with no electricity at half past one.
     * nobody is quirky for the sake of it
   ============================================================ */

/* ------------------------------------------------------------------
   1. THE WELL PUMP
   No power means no water, which most customers do not think about
   until they try a tap. Rural dispatch gets this call every storm.
   ------------------------------------------------------------------ */
const hollis_well = {
  id: 'hollis_well',
  caller: {
    id: 'hollis', name: 'RAY HOLLIS', display: 'HOLLIS R',
    number: '555-0418', account: 'WH-41221', voice: 'merrick', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'random', weight: 5 },
  hold: { patience: 100, longHold: 35, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Yeah — I'm out on Stebbins Road, and I've got no water." },
        { text: "I know that's not you. I know that. But it's the pump, and the pump's electric, so it is you." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "It is, yeah. No power, no pump. Let me get your address.", goto: 'addr', effects: [{ op: 'trust', delta: 2 }] },
        { text: "How long have you been out?", goto: 'howlong', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Do you have livestock?", goto: 'stock', effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'asked_hollis_stock' }] },
      ],
    },
    stock: {
      speaker: 'caller',
      lines: [
        { text: "...Yeah. Yeah, twenty-two head." },
        { text: "That's why I'm calling, honestly. I can haul water for myself. I can't haul it for them." },
      ],
      effects: [{ op: 'flag', name: 'hollis_has_stock' }],
      next: 'addr',
    },
    howlong: {
      speaker: 'caller',
      lines: [
        { text: "Since about — hang on." },
        { text: "The clock on the stove's out, so that's no good to me. Since the big one. The big crack, an hour ago maybe." },
      ],
      next: 'addr',
    },
    addr: {
      speaker: 'caller',
      lines: [
        { text: "1490 Stebbins. Green house, the mailbox is down, that was last week, that's not the storm." },
      ],
      next: 'advise',
    },
    advise: {
      speaker: 'player',
      choices: [
        {
          text: "I've got you on the same circuit as a tree job we're already working. I'll add you to it.",
          goto: 'relieved',
          effects: [
            { op: 'trust', delta: 2 },
            { op: 'outage.create', feeder: 'RR-02', address: '1490 STEBBINS RD', town: 'FAIRHAVEN', cause: 'UNKNOWN', customers: 46 },
          ],
        },
        {
          text: "Fill anything you can from the tank while there's pressure left in it. There won't be much.",
          goto: 'practical',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'gave_hollis_the_tank_trick' }],
        },
        { text: "I can't give you a time. I can tell you you're on the list.", goto: 'list' },
      ],
    },
    practical: {
      speaker: 'caller',
      lines: [
        { text: "The pressure tank. Huh." },
        { text: "That's — yeah. That's twenty gallons I wasn't going to get." },
        { text: "You've done this before." },
      ],
      effects: [{ op: 'trust', delta: 1 }],
      next: 'end',
    },
    relieved: {
      speaker: 'caller',
      lines: [
        { text: "All right. That's something." },
        { text: "You want my number? In case." },
      ],
      next: 'end',
    },
    list: {
      speaker: 'caller',
      lines: [
        { text: "The list. Right." },
        { text: "Well. It's a list." },
      ],
      next: 'end',
    },
    end: {
      speaker: 'caller',
      lines: [
        { text: "All right. I'll let you get on. There's people worse off than a man with a dry tap." },
        { text: "Probably." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Still here. Still dry." }],
      next: 'advise',
    },
  },
};

/* ------------------------------------------------------------------
   2. THE SMELL
   The one call in the ordinary pool that is genuinely dangerous, and
   it is dangerous in a way that is not the utility's equipment. A
   dispatcher who says "we'll get to you" here is wrong.
   ------------------------------------------------------------------ */
const lattimer_smell = {
  id: 'lattimer_smell',
  caller: {
    id: 'lattimer', name: 'JUNE LATTIMER', display: 'LATTIMER J',
    number: '555-0733', account: 'WH-40688', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'outage',
  priority: 40,
  schedule: { type: 'random', weight: 4 },
  hold: { patience: 30, longHold: 12, onReturnNode: 'back', trustOnTimeout: -2 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hi — I don't know if this is you or not." },
        { text: "My power came back on about ten minutes ago and now something smells hot." },
        { text: "Not smoke. Hot. Like a hair dryer smells." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        {
          text: "Where's the smell coming from — the panel, an outlet, or a room?",
          goto: 'locate',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'triaged_the_smell' }],
        },
        {
          text: "Go and switch your main breaker off. Right now, before anything else.",
          goto: 'breaker_first',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'told_lattimer_main_off' }],
        },
        { text: "That's inside your house, so that's not our equipment.", goto: 'brushed' },
      ],
    },
    locate: {
      speaker: 'caller',
      lines: [
        { text: "It's — the grey box. In the hall. The one with the switches." },
        { text: "It's warm. The whole front of it is warm." },
      ],
      effects: [{ op: 'flag', name: 'lattimer_panel_hot' }],
      next: 'urgent',
    },
    breaker_first: {
      speaker: 'caller',
      lines: [
        { text: "Off? It just came back on." },
        { text: "...Okay. Okay, hang on." },
        { text: "It's warm. The box is warm. Is it supposed to be warm?" },
      ],
      effects: [{ op: 'flag', name: 'lattimer_panel_hot' }],
      next: 'urgent',
    },
    brushed: {
      speaker: 'caller',
      lines: [
        { text: "Right. So who do I call?" },
        { text: "It's midnight. Who do I call at midnight." },
      ],
      effects: [{ op: 'trust', delta: -2 }, { op: 'flag', name: 'brushed_off_a_hot_panel' }],
      next: 'urgent',
    },
    urgent: {
      speaker: 'player',
      choices: [
        {
          text: "Main breaker off, leave the house, and call the fire department. Not us. Them.",
          goto: 'good',
          effects: [
            { op: 'trust', delta: 3 },
            { op: 'flag', name: 'lattimer_handled_right' },
            { op: 'log', text: 'LATTIMER J - hot panel - advised main off, evacuate, FD notified.', kind: 'priority' },
          ],
        },
        {
          text: "I'll send a truck. Don't touch it, don't turn anything back on.",
          goto: 'truck',
          effects: [
            { op: 'trust', delta: 1 },
            { op: 'outage.create', feeder: 'MH-11', address: '19 ELDER ST', town: 'MARROW HILL', cause: 'SERVICE DROP', customers: 1, priority: 1, hazard: true },
          ],
        },
        { text: "Open a window and see if it clears.", goto: 'bad', effects: [{ op: 'trust', delta: -3 }, { op: 'flag', name: 'lattimer_told_to_wait' }] },
      ],
    },
    good: {
      speaker: 'caller',
      lines: [
        { text: "The fire department. For a smell." },
        { text: "...No, you're right. You're right. I'm going to get the dog." },
        { text: "Thank you. I'm sorry, I didn't know who to — thank you." },
      ],
      effects: [{ op: 'log', text: 'LATTIMER J - evacuating. FD called.', kind: 'note' }],
      end: true,
    },
    truck: {
      speaker: 'caller',
      lines: [
        { text: "How long is a truck?" },
        { text: "Because it is getting warmer, I think. Or I'm looking at it too hard." },
      ],
      end: true,
    },
    bad: {
      speaker: 'caller',
      lines: [
        { text: "Okay. A window." },
        { text: "...Okay." },
      ],
      effects: [{ op: 'log', text: 'LATTIMER J - hot service panel - advised to ventilate.', kind: 'warn' }],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "I'm still here. It still smells." }],
      next: 'urgent',
    },
  },
};

/* ------------------------------------------------------------------
   3. THE FREEZER
   A small grocery. Money, not danger. The dispatcher cannot fix it
   and both of them know it.
   ------------------------------------------------------------------ */
const okafor_freezer = {
  id: 'okafor_freezer',
  caller: {
    id: 'okafor', name: 'SAM OKAFOR — BETHEL MARKET', display: 'BETHEL MARKET',
    number: '555-0155', account: 'WH-42440', voice: 'halloran', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'random', weight: 4 },
  hold: { patience: 80, longHold: 30, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Bethel Market on the Pike. We're out." },
        { text: "I've got four upright freezers and a walk-in and about nine hundred dollars of meat in the walk-in." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Keep the walk-in shut. Don't open it to check. It'll hold longer than you think.", goto: 'holds', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'advised_walkin' }] },
        { text: "Let me get you on a ticket. New Bethel's on MH-12?", goto: 'ticket', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Is anybody in the building with you?", goto: 'alone', effects: [{ op: 'trust', delta: 1 }] },
      ],
    },
    holds: {
      speaker: 'caller',
      lines: [
        { text: "See, my brother-in-law said open it and put ice in it." },
        { text: "Every time I open it I'm letting the cold out. That's what you're saying." },
        { text: "He's a plumber. He's always got an opinion." },
      ],
      next: 'ticket',
    },
    alone: {
      speaker: 'caller',
      lines: [
        { text: "Just me. I came down when the alarm called the house." },
        { text: "I'm sitting on the checkout with a flashlight like a man in a film." },
      ],
      next: 'ticket',
    },
    ticket: {
      speaker: 'caller',
      lines: [
        { text: "I'm not going to ask you when it's coming back, because I know you don't know." },
        { text: "But if it's more than four hours I need to know, because at four hours I start calling people to come move stock." },
      ],
      next: 'estimate',
    },
    estimate: {
      speaker: 'player',
      choices: [
        {
          text: "I can't promise. But you're on the Pike, and the Pike has a wire down on it. Plan for more than four.",
          goto: 'honest',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'okafor_told_honestly' }],
        },
        { text: "We have a crew working your circuit now. I'd hope for less than four.", goto: 'hopeful', effects: [{ op: 'trust', delta: 1 }, { op: 'promise', key: 'four_hours' }] },
        { text: "I'm not allowed to give restore times.", goto: 'policy' },
      ],
    },
    honest: {
      speaker: 'caller',
      lines: [
        { text: "Okay." },
        { text: "Okay, that's — thank you. That's what I needed. Everybody's been telling me soon all night." },
        { text: "I'll start calling. Somebody's going to love me at two in the morning." },
      ],
      end: true,
    },
    hopeful: {
      speaker: 'caller',
      lines: [
        { text: "Less than four. All right, I'll hold off." },
        { text: "You'll call me if that changes? You've got the number there?" },
      ],
      effects: [{ op: 'remember', key: 'promised_under_four' }],
      end: true,
    },
    policy: {
      speaker: 'caller',
      lines: [
        { text: "No, I know. I'm not trying to get you in trouble." },
        { text: "It's just meat, right. It's just meat." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Still here. Still not opening the walk-in." }],
      next: 'estimate',
    },
  },
};

/* ------------------------------------------------------------------
   4. THE STREETLIGHTS
   A report that is actually useful: arcing on a street light circuit
   is a real clue about what is wrong upstream.
   ------------------------------------------------------------------ */
const stroud_arc = {
  id: 'stroud_arc',
  caller: {
    id: 'stroud', name: 'DEAN STROUD', display: 'STROUD D',
    number: '555-0299', account: 'WH-40310', voice: 'sikes', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'random', weight: 3 },
  hold: { patience: 70, longHold: 25, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "I'm not out. I want to say that first, because everybody's calling you about being out." },
        { text: "I'm calling because your street lights are doing something." },
        { text: "Down the whole of Calder Street they're going bright, then dim, then bright. Like they're breathing." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Breathing — in time with each other, or at random?", goto: 'together', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'asked_stroud_detail' }] },
        { text: "Any arcing? Any noise, any blue flash?", goto: 'arcing', effects: [{ op: 'trust', delta: 3 }] },
        { text: "Thanks. I'll note it.", goto: 'noted' },
      ],
    },
    together: {
      speaker: 'caller',
      lines: [
        { text: "Together. All of them at once, every couple of seconds." },
        { text: "It's honestly kind of nice. That's a weird thing to say about a power cut." },
      ],
      next: 'arcing',
    },
    arcing: {
      speaker: 'caller',
      lines: [
        { text: "There's — yeah. At the pole on the corner there's a blue bit, at the top. Little blue flashes." },
        { text: "Should I not be standing here?" },
      ],
      effects: [{ op: 'flag', name: 'stroud_arcing' }],
      next: 'advise',
    },
    noted: {
      speaker: 'caller',
      lines: [
        { text: "You'll note it." },
        { text: "Sure." },
      ],
      end: true,
    },
    advise: {
      speaker: 'player',
      choices: [
        {
          text: "Go inside. That's a fault on the primary and it can drop.",
          goto: 'inside',
          effects: [
            { op: 'trust', delta: 3 },
            { op: 'outage.create', feeder: 'MH-11', address: 'CALDER ST AT THE CORNER', town: 'CALDER', cause: 'UNKNOWN', customers: 0, priority: 2, hazard: true },
            { op: 'log', text: 'STROUD D - arcing at pole, Calder St - advised to withdraw.', kind: 'priority' },
          ],
        },
        { text: "You're fine at that distance. Don't go closer.", goto: 'inside', effects: [{ op: 'trust', delta: 1 }] },
      ],
    },
    inside: {
      speaker: 'caller',
      lines: [
        { text: "Going in. Going in." },
        { text: "It's still doing it. I can see it from the window." },
        { text: "Anyway. Thought you'd want to know before it's a bigger phone call." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Still flashing. Still blue." }],
      next: 'advise',
    },
  },
};

/* ------------------------------------------------------------------
   5. THE MAN WHO IS SURE IT IS YOUR FAULT
   It is his breaker. It is always his breaker. He is not stupid and
   he is not a joke -- he is tired and he has decided who is to blame.
   ------------------------------------------------------------------ */
const wexler_breaker = {
  id: 'wexler_breaker',
  caller: {
    id: 'wexler', name: 'GERALD WEXLER', display: 'WEXLER G',
    number: '555-0877', account: 'WH-41902', voice: 'ott', line: 'clean', era: 1999,
  },
  category: 'nuisance',
  schedule: { type: 'random', weight: 3 },
  hold: { patience: 40, longHold: 15, onReturnNode: 'back', trustOnTimeout: -1 },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "You've done something to my line." },
        { text: "Half my house is off. Half. So don't tell me it's the storm, because the storm doesn't do half." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Half is usually a lost leg — either at your panel or on our drop. Let's find out which.", goto: 'work', effects: [{ op: 'trust', delta: 3 }] },
        { text: "Which half? Give me some rooms.", goto: 'rooms', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Sir, the storm does a lot of things.", goto: 'flare', effects: [{ op: 'trust', delta: -2 }] },
      ],
    },
    flare: {
      speaker: 'caller',
      lines: [
        { text: "Don't — no. Don't do the voice. I've had the voice from your office before." },
        { text: "I pay you people ninety dollars a month." },
      ],
      next: 'rooms',
    },
    rooms: {
      speaker: 'caller',
      lines: [
        { text: "Kitchen's fine. Kitchen, the back bedroom, the garage." },
        { text: "Front of the house is dead. Front room, the hall, the bathroom, my wife's lamp." },
      ],
      next: 'work',
    },
    work: {
      speaker: 'caller',
      lines: [
        { text: "So what is it." },
      ],
      next: 'diagnose',
    },
    diagnose: {
      speaker: 'player',
      choices: [
        {
          text: "Go to your panel. There'll be a big double breaker at the top. Off, count to five, back on.",
          goto: 'tries',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'walked_wexler_through_it' }],
        },
        {
          text: "If it's our drop I need a truck. If it's your panel a truck won't help you. Humour me for one minute.",
          goto: 'tries',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'wexler_persuaded' }],
        },
        { text: "I'll put a truck on it.", goto: 'truck', effects: [{ op: 'outage.create', feeder: 'MH-12', address: '88 LARKIN AVE', town: 'MARROW HILL', cause: 'SERVICE DROP', customers: 1 }] },
      ],
    },
    tries: {
      speaker: 'caller',
      lines: [
        { text: "Hold on. I've got to put the phone down." },
        { text: "", pause: 1.6 },
        { text: "...Huh." },
        { text: "Well, now it's all on." },
      ],
      effects: [{ op: 'flag', name: 'wexler_fixed_it_himself' }],
      next: 'ending',
    },
    ending: {
      speaker: 'player',
      choices: [
        { text: "That's a tripped main. Happens when the voltage sags and comes back.", goto: 'graceful', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Good. I'll take the truck back off, then.", goto: 'graceful' },
        { text: "So it was your panel.", goto: 'sour', effects: [{ op: 'trust', delta: -1 }] },
      ],
    },
    graceful: {
      speaker: 'caller',
      lines: [
        { text: "Well." },
        { text: "I still think you did something to the line." },
        { text: "...Thank you, though." },
      ],
      end: true,
    },
    sour: {
      speaker: 'caller',
      lines: [
        { text: "Yeah. All right. Goodnight." },
      ],
      end: true,
    },
    truck: {
      speaker: 'caller',
      lines: [
        { text: "Good. That's all I wanted. A truck." },
        { text: "What time's the truck?" },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "You put me on hold. For a power cut. At my own house." }],
      next: 'diagnose',
    },
  },
};

/* ------------------------------------------------------------------
   6. THE DAIRY
   The farm call with the real deadline in it: cows have to be milked
   whether or not there is a grid.
   ------------------------------------------------------------------ */
const mccandless_dairy = {
  id: 'mccandless_dairy',
  caller: {
    id: 'mccandless', name: 'PAT McCANDLESS', display: 'McCANDLESS FARM',
    number: '555-0921', account: 'WH-42780', voice: 'daley', line: 'clean', era: 1999,
  },
  category: 'outage',
  priority: 20,
  schedule: { type: 'random', weight: 3 },
  hold: { patience: 110, longHold: 40, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "This is Pat McCandless, McCandless Farm, out past Devoe on the Ridge Road." },
        { text: "We're out, and I've got a bulk tank with eight hundred gallons in it that has to stay at thirty-eight degrees." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "Do you have a generator?", goto: 'gen', effects: [{ op: 'trust', delta: 2 }] },
        { text: "How long has the tank been without cooling?", goto: 'time', effects: [{ op: 'trust', delta: 3 }] },
        { text: "Milking parlour too?", goto: 'parlour', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'knew_about_parlour' }] },
      ],
    },
    parlour: {
      speaker: 'caller',
      lines: [
        { text: "You know farms." },
        { text: "Yes. Ninety head, and they go on at half four whether your wires are up or not." },
        { text: "Most of your people don't ask that." },
      ],
      effects: [{ op: 'trust', delta: 1 }],
      next: 'gen',
    },
    time: {
      speaker: 'caller',
      lines: [
        { text: "Hour and ten. It'll hold three, maybe four. After that it's a tanker of milk I can't sell." },
      ],
      next: 'gen',
    },
    gen: {
      speaker: 'caller',
      lines: [
        { text: "There's a PTO generator on the tractor. I can run the tank off it." },
        { text: "I can't run the tank and the parlour. It's one or the other, and at half four it's going to have to be the parlour." },
      ],
      next: 'advise',
    },
    advise: {
      speaker: 'player',
      choices: [
        {
          text: "I'll flag you as agricultural priority. That's real, it moves you up the list.",
          goto: 'priority',
          effects: [
            { op: 'trust', delta: 3 },
            { op: 'outage.create', feeder: 'RR-09', address: 'RIDGE RD — McCANDLESS FARM', town: 'DEVOE', cause: 'UNKNOWN', customers: 8, priority: 2 },
            { op: 'flag', name: 'flagged_agricultural' },
          ],
        },
        { text: "Run the tank now while you can. We may be back before half four.", goto: 'tank', effects: [{ op: 'trust', delta: 2 }] },
        { text: "I'll put you on the list with everyone else.", goto: 'list' },
      ],
    },
    priority: {
      speaker: 'caller',
      lines: [
        { text: "Agricultural priority. I didn't know that was a thing you could do." },
        { text: "Thank you. I mean it." },
      ],
      end: true,
    },
    tank: {
      speaker: 'caller',
      lines: [
        { text: "That's what I'll do. Tank now, parlour later, and pray." },
        { text: "You've been decent. Most of the night people are." },
      ],
      end: true,
    },
    list: {
      speaker: 'caller',
      lines: [
        { text: "Right you are." },
        { text: "Cows don't know about lists. That's all." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "I'm here. I've been stood in a doorway in the rain, so take your time." }],
      next: 'advise',
    },
  },
};

/* ------------------------------------------------------------------
   7. THE MOTEL
   Night porter. Sixteen rooms of people who are not his fault.
   ------------------------------------------------------------------ */
const tobin_motel = {
  id: 'tobin_motel',
  caller: {
    id: 'tobin', name: 'ANDY TOBIN — PINE REST MOTEL', display: 'PINE REST MOTEL',
    number: '555-0464', account: 'WH-41760', voice: 'boy', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'random', weight: 3 },
  hold: { patience: 70, longHold: 25, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hi, um. Pine Rest Motel, out on Route 9? We've got no power." },
        { text: "I've got sixteen rooms and fourteen of them are occupied and about six of them have come to the office to tell me about it." },
        { text: "I'm nineteen. I don't know what they want me to do." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "First thing: is your emergency lighting on in the corridors?", goto: 'egress', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'asked_tobin_egress' }] },
        { text: "You don't have to fix it. You have to tell them the truth, which is that we're working on it.", goto: 'coached', effects: [{ op: 'trust', delta: 3 }] },
        { text: "Route 9 — that's KC-04. Let me look.", goto: 'circuit', effects: [{ op: 'trust', delta: 1 }] },
      ],
    },
    egress: {
      speaker: 'caller',
      lines: [
        { text: "The green signs? Yeah, those are on. Those stayed on." },
        { text: "Is that — is that good?" },
      ],
      next: 'coached',
    },
    circuit: {
      speaker: 'caller',
      lines: [
        { text: "I don't know what KC-04 is but it sounds like you know, so that's good." },
      ],
      next: 'coached',
    },
    coached: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Okay." },
        { text: "Can I say that? That the electric company said they're working on it?" },
        { text: "Because if I say it and then it's four hours, they're going to be at the desk again." },
      ],
      next: 'advise',
    },
    advise: {
      speaker: 'player',
      choices: [
        {
          text: "Say a crew is assigned and you don't have a time. Never give them a time you don't have.",
          goto: 'good',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'taught_tobin_the_rule' }],
        },
        { text: "Tell them to go back to bed. It's two in the morning.", goto: 'blunt', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Tell them an hour.", goto: 'bad', effects: [{ op: 'trust', delta: -2 }, { op: 'flag', name: 'made_tobin_lie' }] },
      ],
    },
    good: {
      speaker: 'caller',
      lines: [
        { text: "A crew is assigned and I don't have a time." },
        { text: "...I'm writing that down. That's good. That's a good sentence." },
        { text: "Thanks. Genuinely." },
      ],
      end: true,
    },
    blunt: {
      speaker: 'caller',
      lines: [
        { text: "I am not saying that to the man in eleven." },
        { text: "But I appreciate you." },
      ],
      end: true,
    },
    bad: {
      speaker: 'caller',
      lines: [
        { text: "An hour. Okay. An hour." },
        { text: "You're sure? Because they'll come back in an hour." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Sorry — hi, yeah, still here. The man from eleven came back." }],
      next: 'advise',
    },
  },
};

/* ------------------------------------------------------------------
   8. THE FLASHLIGHT
   An old man who cannot find his torch and is embarrassed to have
   called. The call is not about the torch.
   ------------------------------------------------------------------ */
const tice_dark = {
  id: 'tice_dark',
  caller: {
    id: 'tice', name: 'WALTER TICE', display: 'TICE W',
    number: '555-0508', account: 'WH-40044', voice: 'ott', line: 'clean', era: 1999,
  },
  category: 'nuisance',
  schedule: { type: 'random', weight: 3 },
  hold: { patience: 55, longHold: 20, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "I'm sorry to bother you." },
        { text: "It's not an emergency. I want to say that at the start so you're not worrying." },
        { text: "I can't find my flashlight." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "That's all right. Are you somewhere you can sit down safely?", goto: 'sits', effects: [{ op: 'trust', delta: 3 }] },
        { text: "Do you have a telephone with a lit keypad? That's enough to get to a chair.", goto: 'practical', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'gave_tice_the_trick' }] },
        { text: "Sir, this line is for outages.", goto: 'sorry', effects: [{ op: 'trust', delta: -2 }] },
      ],
    },
    sits: {
      speaker: 'caller',
      lines: [
        { text: "I'm in my chair. I got to my chair all right." },
        { text: "It's just very dark. I've lived here forty-one years and I've never seen it this dark." },
      ],
      next: 'talk',
    },
    practical: {
      speaker: 'caller',
      lines: [
        { text: "The telephone. The little green numbers." },
        { text: "Well, I never. That's — I can see my hand." },
      ],
      next: 'talk',
    },
    sorry: {
      speaker: 'caller',
      lines: [
        { text: "Yes. Yes, of course it is. I'm sorry." },
        { text: "I'll let you go." },
      ],
      effects: [{ op: 'flag', name: 'hurried_tice_off' }],
      end: true,
    },
    talk: {
      speaker: 'caller',
      lines: [
        { text: "How long do these usually go on for?" },
        { text: "My wife used to do the candles. She had a system for it. Cellar steps, third shelf." },
        { text: "I've been on that step twice tonight and there's nothing on it." },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        {
          text: "Stay off the cellar steps in the dark. Please. Everything else can wait for daylight.",
          goto: 'agrees',
          effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'kept_tice_off_the_steps' }],
        },
        { text: "Is there anybody who could come over? A neighbour, family?", goto: 'nobody', effects: [{ op: 'trust', delta: 2 }] },
        { text: "We're working on it. It could be a few hours.", goto: 'agrees' },
      ],
    },
    nobody: {
      speaker: 'caller',
      lines: [
        { text: "There's my daughter, but she's in Elmira, and it's nearly two." },
        { text: "I'm all right. I'm just talking. You've got other people." },
      ],
      effects: [{ op: 'flag', name: 'tice_is_alone' }],
      next: 'agrees',
    },
    agrees: {
      speaker: 'caller',
      lines: [
        { text: "All right. I'll sit here then." },
        { text: "Thank you for not being short with me. Some of them are short with you." },
        { text: "Goodnight." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Hello? Oh — you came back. I thought you'd gone." }],
      next: 'q2',
    },
  },
};

/* ------------------------------------------------------------------
   9. THE TREE ON THE SERVICE DROP
   A textbook call, answered by somebody who has read the pamphlet.
   Useful contrast: not everybody is helpless.
   ------------------------------------------------------------------ */
const nakashima_drop = {
  id: 'nakashima_drop',
  caller: {
    id: 'nakashima', name: 'ERIC NAKASHIMA', display: 'NAKASHIMA E',
    number: '555-0611', account: 'WH-41404', voice: 'keefe', line: 'clean', era: 1999,
  },
  category: 'outage',
  schedule: { type: 'random', weight: 4 },
  hold: { patience: 95, longHold: 35, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "I've got a limb down on my service drop. Big limb, maybe fifteen feet." },
        { text: "The drop is holding but it's pulled the mast on the house over about twenty degrees." },
        { text: "I'm at 7 Hollow Lane, account's WH-41404, and I'm not touching any of it." },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "That is the best call I've had all night. Is the drop clear of the ground?", goto: 'clear', effects: [{ op: 'trust', delta: 3 }] },
        { text: "Mast pulled over means an electrician before we can reconnect. You'll want to know that now.", goto: 'electrician', effects: [{ op: 'trust', delta: 3 }, { op: 'flag', name: 'warned_about_mast' }] },
        { text: "Let me get a ticket open.", goto: 'ticket', effects: [{ op: 'trust', delta: 1 }] },
      ],
    },
    clear: {
      speaker: 'caller',
      lines: [
        { text: "Clear. It's about eight feet up at the low point. Nothing on the ground." },
        { text: "I've kept the dog in." },
      ],
      next: 'ticket',
    },
    electrician: {
      speaker: 'caller',
      lines: [
        { text: "...Really." },
        { text: "So even when you fix the line, I don't get power until an electrician stands the mast back up." },
        { text: "That's annoying, but I'd rather know now than at six in the morning." },
      ],
      next: 'ticket',
    },
    ticket: {
      speaker: 'caller',
      lines: [
        { text: "I'll leave the porch light switch on so your crew can tell when it's back." },
        { text: "Anything else you need from me?" },
      ],
      effects: [
        { op: 'outage.create', feeder: 'MH-14', address: '7 HOLLOW LN', town: 'MARROW HILL', cause: 'SERVICE DROP', customers: 1 },
      ],
      next: 'close',
    },
    close: {
      speaker: 'player',
      choices: [
        { text: "No. That's everything. Thank you.", goto: 'end', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Stay away from it, that's all.", goto: 'end' },
      ],
    },
    end: {
      speaker: 'caller',
      lines: [
        { text: "Will do. Good luck tonight — sounds like you've got a few of us." },
      ],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "No problem. Still here. Still not touching it." }],
      next: 'close',
    },
  },
};

/* ------------------------------------------------------------------
   10. THE ONE WHO JUST WANTS SOMEBODY THERE
   The most ordinary call in the game and, on the right night, the
   one the player remembers. She is not confused, she is not old,
   she is not a story. She is by herself in a storm.
   ------------------------------------------------------------------ */
const ambrose_alone = {
  id: 'ambrose_alone',
  caller: {
    id: 'ambrose', name: 'KAREN AMBROSE', display: 'AMBROSE K',
    number: '555-0350', account: 'WH-40977', voice: 'vance', line: 'clean', era: 1999,
  },
  category: 'nuisance',
  schedule: { type: 'random', weight: 3 },
  hold: { patience: 60, longHold: 22, onReturnNode: 'back' },
  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hi. I'm out — but I think everybody's out, so I'm not really reporting it." },
        { text: "Is that all right? Can I call and not really be reporting it?" },
      ],
      next: 'q',
    },
    q: {
      speaker: 'player',
      choices: [
        { text: "You can. I'm here anyway.", goto: 'relieved', effects: [{ op: 'trust', delta: 3 }] },
        { text: "I'll take the report either way. What's the address?", goto: 'report', effects: [{ op: 'trust', delta: 1 }] },
        { text: "I do need to keep the line clear.", goto: 'clipped', effects: [{ op: 'trust', delta: -1 }] },
      ],
    },
    relieved: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Good." },
        { text: "It's very loud here. I didn't realise how much noise the house makes until it stopped making it." },
        { text: "The fridge, mostly. You don't hear the fridge until there's no fridge." },
      ],
      next: 'chat',
    },
    report: {
      speaker: 'caller',
      lines: [
        { text: "22 Linden. Ambrose." },
        { text: "It really is fine. I've got the gas hob so I can make tea, which I have done, twice." },
      ],
      next: 'chat',
    },
    clipped: {
      speaker: 'caller',
      lines: [
        { text: "No — of course. Sorry." },
        { text: "That was silly of me." },
      ],
      effects: [{ op: 'flag', name: 'cut_ambrose_off' }],
      end: true,
    },
    chat: {
      speaker: 'caller',
      lines: [
        { text: "Can I ask — is it bad out there? Properly bad?" },
        { text: "The radio says trees down but the radio says that when a branch falls on a shed." },
      ],
      next: 'q2',
    },
    q2: {
      speaker: 'player',
      choices: [
        { text: "It's a real one. Three crews out, a lot of the county dark. But nobody's hurt.", goto: 'settled', effects: [{ op: 'trust', delta: 3 }] },
        { text: "It's a storm. It'll be over by morning and you'll have missed most of it asleep.", goto: 'settled', effects: [{ op: 'trust', delta: 2 }] },
        { text: "I've had sixty calls. You do the maths.", goto: 'settled', effects: [{ op: 'trust', delta: -1 }] },
      ],
    },
    settled: {
      speaker: 'caller',
      lines: [
        { text: "Right. Okay." },
        { text: "I'm going to go and sit with the cat and stop bothering you." },
        { text: "Thanks for picking up. That's all it was, really." },
      ],
      effects: [{ op: 'flag', name: 'ambrose_settled' }],
      end: true,
    },
    back: {
      speaker: 'caller',
      lines: [{ text: "Oh — hello again. I was listening to the music." }],
      next: 'q2',
    },
  },
};

export default [
  hollis_well, lattimer_smell, okafor_freezer, stroud_arc, wexler_breaker,
  mccandless_dairy, tobin_motel, tice_dark, nakashima_drop, ambrose_alone,
];
