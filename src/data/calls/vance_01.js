/* ============================================================
   vance_01 -- wire down on Bethel Pike.

   The hazard call, and the first real decision of the night. A
   conductor is on the ground with a car stopped near it. This
   outranks everything in the queue including Mrs. Daley's oxygen,
   and the game does not tell the player that -- it gives them a
   frightened woman, a hazard, and a finite number of trucks.

   The call also teaches the one piece of lineman's doctrine the
   rest of the shift depends on: a downed wire is live until a
   crew says otherwise. It is posted on the notice board. Saying
   it out loud here is what makes it stick.
   ============================================================ */
export default {
  id: 'vance_01',
  caller: {
    id: 'vance',
    name: 'KRISTEN VANCE',
    display: 'VANCE K',
    number: '555-0491',
    account: 'WH-41550',
    voice: 'vance',
    line: 'clean',
    era: 1999,
  },
  category: 'hazard',
  priority: 100,
  rings: 16,
  schedule: { type: 'beat', beat: 3 },
  hold: { patience: 40, longHold: 18, onReturnNode: 'back_from_hold', trustOnTimeout: -2, timeoutFlag: 'vance_abandoned' },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "There's a wire down. There's a wire down in the road.", stage: 'fast, breathless' },
        { text: "I'm on Bethel Pike, I'm about a half mile past the Grange, and there's a line across both lanes and it's — it's moving. It's jumping around." },
      ],
      next: 'first_response',
    },

    first_response: {
      speaker: 'player',
      choices: [
        {
          text: "Are you in your vehicle right now?",
          goto: 'in_car',
          effects: [{ op: 'flag', name: 'vance_asked_safety_first' }, { op: 'trust', delta: 2 }],
        },
        {
          text: "Stay away from it. Stay in the car if you're in the car.",
          goto: 'in_car',
          effects: [{ op: 'flag', name: 'vance_asked_safety_first' }, { op: 'trust', delta: 2 }],
        },
        { text: "Okay, slow down. Where exactly on Bethel Pike?", goto: 'location_first' },
        { text: "All right, let me get your account pulled up.", goto: 'wrong_priority', once: true, effects: [{ op: 'trust', delta: -2 }] },
      ],
    },

    wrong_priority: {
      speaker: 'caller',
      lines: [
        { text: "My — I don't care about my account, there's a wire in the road!", stage: 'incredulous' },
        { text: "There's a car stopped. There's a car stopped on the other side of it and I don't think they can see it." },
      ],
      effects: [{ op: 'flag', name: 'vance_car_present' }],
      next: 'first_response',
    },

    location_first: {
      speaker: 'caller',
      lines: [
        { text: "Half mile past the Grange Hall going toward New Bethel. There's a — there's a mailbox shaped like a barn, it's right by that." },
        { text: "There's a car stopped on the other side of it. They've got their hazards on. I don't think they can see the wire." },
      ],
      effects: [{ op: 'flag', name: 'vance_car_present' }, { op: 'remember', key: 'grange_landmark' }],
      next: 'in_car',
    },

    in_car: {
      speaker: 'caller',
      lines: [
        { text: "Yes. Yes, I'm in the car, I pulled over. I'm maybe — I don't know, thirty feet back?" },
        { text: "Is that far enough? Is thirty feet far enough?" },
      ],
      next: 'safety',
    },

    safety: {
      speaker: 'player',
      choices: [
        {
          text: "Stay in the vehicle. Don't get out for any reason. It's energized until a crew tells me otherwise.",
          goto: 'safety_good',
          effects: [
            { op: 'flag', name: 'vance_safety_given' },
            { op: 'trust', delta: 2 },
            { op: 'log', text: 'VANCE K - wire down BETHEL PIKE - caller instructed to remain in vehicle', kind: 'priority' },
          ],
        },
        {
          text: "Back it up further if you can do it without getting out. Assume that wire is live.",
          goto: 'safety_good',
          effects: [{ op: 'flag', name: 'vance_safety_given' }, { op: 'trust', delta: 2 }],
        },
        {
          text: "It's probably dead if the circuit tripped, but don't touch it.",
          goto: 'safety_bad',
          effects: [
            { op: 'flag', name: 'vance_told_probably_dead' },
            { op: 'trust', delta: -1 },
            { op: 'log', text: 'Told a caller a downed conductor was probably dead. It is never probably dead.', kind: 'warn' },
          ],
        },
      ],
    },

    safety_bad: {
      speaker: 'caller',
      lines: [
        { text: "Probably." },
        { text: "You said probably." },
        { text: "Okay. Okay. I'm staying in the car anyway.", stage: 'she has decided not to trust you' },
      ],
      next: 'other_car',
    },

    safety_good: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Okay. I'm staying." },
        { text: "...What about them? The car on the other side. What about them?" },
      ],
      next: 'other_car',
    },

    other_car: {
      speaker: 'player',
      choices: [
        {
          text: "Don't get out to warn them. Use your horn. Flash your lights.",
          goto: 'horn',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'vance_horn_advice' }],
        },
        {
          text: "Have you got a phone with you? Call 911 for the road closure — I'll handle the line.",
          goto: 'nine_one_one',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'vance_911' }],
        },
        { text: "There's nothing you can do for them from there. Stay put.", goto: 'stay_put', effects: [{ op: 'trust', delta: 1 }] },
      ],
    },

    horn: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Hold on—", stage: 'the handset moves; a horn, three times, muffled' },
        { text: "They're backing up. They're backing up. Okay. Okay, good." },
      ],
      effects: [{ op: 'flag', name: 'vance_other_car_safe' }],
      next: 'dispatch_gate',
    },

    nine_one_one: {
      speaker: 'caller',
      lines: [
        { text: "I'm — yes. Yes, I've got the car phone, that's what I'm on." },
        { text: "I'll hang up and call them. Should I hang up? I don't want to hang up." },
        { text: "...No. No, you first. Tell me somebody's coming and then I'll call them." },
      ],
      next: 'dispatch_gate',
    },

    stay_put: {
      speaker: 'caller',
      lines: [
        { text: "Right. Right." },
        { text: "They're just sitting there. They're just sitting there with their hazards on." },
      ],
      next: 'dispatch_gate',
    },

    /* The gate that matters: the player has to have actually opened a ticket
       and put a truck on it before they can say a truck is coming. */
    dispatch_gate: {
      speaker: 'player',
      choices: [
        {
          text: "A crew is rolling to you now. They'll secure the line before anything else.",
          goto: 'relieved',
          requires: { anyCrewDispatched: true, outageOnFeeder: 'MH-12' },
          effects: [
            { op: 'trust', delta: 2 },
            { op: 'flag', name: 'vance_crew_confirmed' },
            { op: 'log', text: 'VANCE K - crew dispatched to wire down, caller advised', kind: 'priority' },
          ],
        },
        {
          text: "I'm putting a truck on this right now. Stay on the line with me while I do it.",
          goto: 'waiting_on_you',
          once: true,
          effects: [{ op: 'trust', delta: 1 }],
        },
        {
          text: "It's logged as a hazard. That puts it at the top.",
          goto: 'relieved',
          requires: { outageOnFeeder: 'MH-12' },
          effects: [{ op: 'trust', delta: 1 }],
        },
        { text: "I'll get to it as soon as I can.", goto: 'not_good_enough', once: true, effects: [{ op: 'trust', delta: -2 }] },
        {
          // The guaranteed exit. Every gate on this node can fail -- no crew
          // free, no ticket open -- and a hazard call must still be able to
          // end rather than strand the player mid-emergency.
          text: "I'm writing it as a hazard. That is the top of my list and I am not moving it.",
          goto: 'relieved',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'vance_promised_priority' }],
        },
      ],
      fallback: 'relieved',
    },

    waiting_on_you: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Okay. I'm here." },
        { text: "It's still moving. The wire. It — every so often it jumps and there's this sound, like a—" },
        { text: "You hear that? Did you hear that on the phone?", stage: 'she is frightened now' },
      ],
      fallback: 'dispatch_gate',
      next: 'dispatch_gate',
    },

    not_good_enough: {
      speaker: 'caller',
      lines: [
        { text: "As soon as you can." },
        { text: "There is a live power line in a public road and a car full of people forty feet from it, and you're telling me as soon as you can." },
        { text: "What's your name? I want your name.", stage: 'not a threat; she is scared and grabbing for anything solid' },
      ],
      effects: [{ op: 'flag', name: 'vance_asked_your_name' }],
      next: 'dispatch_gate',
    },

    relieved: {
      speaker: 'caller',
      lines: [
        { text: "Okay." },
        { text: "Okay. Thank you. I'm sorry I yelled. I don't — I've never seen one down before. You don't think about them until one's in the road." },
        { text: "It's so loud. Nobody tells you they're loud." },
      ],
      next: 'signoff',
    },

    signoff: {
      speaker: 'player',
      choices: [
        {
          text: "You did the right thing calling. Stay in the car until the crew waves you off.",
          goto: 'end_good',
          effects: [{ op: 'trust', delta: 1 }],
        },
        {
          text: "If it goes dark and quiet, that doesn't mean it's safe. Wait for the truck.",
          goto: 'end_good',
          effects: [{ op: 'trust', delta: 2 }, { op: 'flag', name: 'vance_full_safety_brief' }],
        },
        { text: "We've got it from here.", goto: 'end_flat' },
      ],
    },

    end_good: {
      speaker: 'caller',
      lines: [
        { text: "I will. I'm not going anywhere." },
        { text: "...Thank you. Really." },
      ],
      effects: [
        { op: 'log', text: 'VANCE K - BETHEL PIKE hazard - handled', kind: 'call' },
        { op: 'flag', name: 'vance_handled_well' },
        { op: 'beat', to: 4 },
      ],
      end: true,
    },

    end_flat: {
      speaker: 'caller',
      lines: [
        { text: "...Right. Okay." },
      ],
      effects: [
        { op: 'log', text: 'VANCE K - BETHEL PIKE hazard', kind: 'call' },
        { op: 'beat', to: 4 },
      ],
      end: true,
    },

    back_from_hold: {
      speaker: 'caller',
      lines: [
        { text: "Hello? Hello?" },
        { text: "You put me on hold. There's a wire in the road and you put me on hold.", stage: 'flat, disbelieving' },
      ],
      effects: [{ op: 'trust', delta: -2 }, { op: 'flag', name: 'vance_was_held' }],
      next: 'dispatch_gate',
    },
  },
};
