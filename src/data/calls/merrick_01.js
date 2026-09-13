/* ============================================================
   merrick_01 -- the first call of the shift.

   Teaching call, disguised as an annoyed man. It walks the player
   through the actual job: get the address, confirm it against the
   account rather than the caller, open a ticket, refuse to promise
   a restore time. Merrick pushes on that last one, because the
   notice board over the credenza says not to and the game wants
   the player to feel the weight of a rule the first time.
   ============================================================ */
export default {
  id: 'merrick_01',
  caller: {
    id: 'merrick',
    name: 'DOUGLAS MERRICK',
    display: 'MERRICK D',
    number: '555-0203',
    account: 'WH-40988',
    voice: 'merrick',
    line: 'clean',
    era: 1999,
  },
  category: 'outage',
  priority: 60,
  schedule: { type: 'beat', beat: 0 },
  hold: { patience: 55, longHold: 25, onReturnNode: 'back_from_hold', trustOnTimeout: -2, timeoutFlag: 'merrick_hung_up' },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Yeah — hi. Is this the — sorry, is this the power company, or did I get the answering service again?", stage: 'tired, already annoyed' },
      ],
      next: 'greet',
    },

    greet: {
      speaker: 'player',
      choices: [
        {
          text: "Wright County Power and Light, overnight dispatch. Go ahead.",
          goto: 'complain',
          effects: [{ op: 'trust', delta: 1 }],
        },
        {
          text: "This is dispatch. You've got a person, not a machine.",
          goto: 'complain_warm',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'style_warm' }],
        },
        {
          text: "Power company. What's the address?",
          spoken: "Power company. What's the address?",
          goto: 'complain_curt',
          effects: [{ op: 'trust', delta: -1 }, { op: 'flag', name: 'style_curt' }],
        },
      ],
    },

    complain_warm: {
      speaker: 'caller',
      lines: [
        { text: "Oh. Well. That's — okay, good. No offense. I called at nine and I got a recording telling me my call was important." },
        { text: "Anyway. My power's out. Whole house. Went about twenty minutes ago, maybe closer to thirty." },
      ],
      next: 'ask_address',
    },

    complain: {
      speaker: 'caller',
      lines: [
        { text: "Okay. Good. My power's out. Went about twenty minutes ago — no, longer than that, because the game was still on." },
        { text: "Whole house. The street too, I think. It's black out there." },
      ],
      next: 'ask_address',
    },

    complain_curt: {
      speaker: 'caller',
      lines: [
        { text: "...Sure. Yeah. Good evening to you too." },
        { text: "Four oh two Depot Street. Power's out. Twenty, thirty minutes. Whole street's dark." },
      ],
      effects: [{ op: 'remember', key: 'gave_address_unprompted' }],
      next: 'ask_address',
    },

    ask_address: {
      speaker: 'player',
      choices: [
        {
          text: "Can I get the service address?",
          goto: 'gives_address',
          requires: { notFlags: ['style_curt'] },
        },
        {
          text: "And your name and the address on the account?",
          goto: 'gives_address_full',
        },
        {
          text: "Let me pull it up by your phone number. One moment.",
          goto: 'pull_by_phone',
        },
      ],
    },

    pull_by_phone: {
      speaker: 'caller',
      lines: [
        { text: "It's five five five, oh two oh three. Merrick. M-E-R-R-I-C-K." },
        { text: "Four oh two Depot. Marrow Hill. Been there since eighty-eight." },
      ],
      effects: [{ op: 'remember', key: 'address' }],
      next: 'confirm_gate',
    },

    gives_address: {
      speaker: 'caller',
      lines: [
        { text: "Four oh two Depot Street. Marrow Hill." },
        { text: "Merrick. Doug Merrick." },
      ],
      effects: [{ op: 'remember', key: 'address' }],
      next: 'confirm_gate',
    },

    gives_address_full: {
      speaker: 'caller',
      lines: [
        { text: "Douglas Merrick. Four oh two Depot Street, Marrow Hill." },
        { text: "The account's in my name. Should be, anyway. It was the last time you people sent me a bill." },
      ],
      effects: [{ op: 'remember', key: 'address' }],
      next: 'confirm_gate',
    },

    /* The gate: until the player has actually opened the record on the CRT,
       the confirming reply is not available. The terminal is not decoration. */
    confirm_gate: {
      speaker: 'player',
      choices: [
        {
          text: "I've got you — 402 Depot, account WH-40988, meter 8120447. You're on circuit MH-11.",
          goto: 'confirmed',
          requires: { lookedUp: 'WH-40988' },
          effects: [
            { op: 'trust', delta: 1 },
            { op: 'flag', name: 'merrick_confirmed' },
            { op: 'log', text: 'MERRICK D - 402 DEPOT ST - confirmed against account', kind: 'call' },
          ],
        },
        {
          // once: taking a beat is fine. Taking it forever is a loop.
          text: "Bear with me — I want to confirm that against the account before I write it up.",
          goto: 'waiting_lookup',
          once: true,
        },
        {
          text: "Got it. Four oh two Depot.",
          goto: 'unconfirmed',
          effects: [{ op: 'flag', name: 'merrick_unconfirmed' }],
        },
      ],
    },

    waiting_lookup: {
      speaker: 'caller',
      lines: [
        { text: "Take your time. It's not like I'm doing anything. I'm sitting in the dark holding a phone." },
        { text: "...Sorry. That was — it's been a night. Go ahead.", stage: 'catches himself' },
      ],
      effects: [{ op: 'trust', delta: 1 }],
      fallback: 'confirm_gate',
      next: 'confirm_gate',
    },

    unconfirmed: {
      speaker: 'caller',
      lines: [
        { text: "That's it. So what happens now?" },
      ],
      next: 'ticket_gate',
    },

    confirmed: {
      speaker: 'caller',
      lines: [
        { text: "Yeah. That's me. That's — how'd you get my meter number, out of curiosity?", stage: 'briefly disarmed' },
        { text: "Never mind. Don't answer that. So what happens now?" },
      ],
      next: 'ticket_gate',
    },

    ticket_gate: {
      speaker: 'player',
      choices: [
        {
          text: "I've opened a trouble ticket on your circuit. It's in the queue.",
          goto: 'wants_eta',
          requires: { outageOnFeeder: 'MH-11' },
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'merrick_ticketed' }],
        },
        {
          text: "I'm writing it up now. Give me a second.",
          goto: 'writing_it_up',
          once: true,
        },
        {
          text: "Somebody will get to it.",
          goto: 'wants_eta',
          effects: [{ op: 'trust', delta: -1 }],
        },
      ],
    },

    writing_it_up: {
      speaker: 'caller',
      lines: [
        { text: "Fine. Fine." },
        { text: "You know my neighbor's got a generator? Runs it every storm. Sounds like a lawnmower dying. I hear it right now, actually." },
        { text: "I'm not saying I want one. I'm saying I understand him better than I did an hour ago." },
      ],
      fallback: 'wants_eta',
      next: 'ticket_gate',
    },

    wants_eta: {
      speaker: 'caller',
      lines: [
        { text: "So when's it coming back on?" },
      ],
      next: 'eta_choice',
    },

    /* The rule from the notice board, put in front of the player as a choice. */
    eta_choice: {
      speaker: 'player',
      choices: [
        {
          text: "I can't give you a time. I can tell you it's logged and a crew will be assigned.",
          goto: 'accepts_grudgingly',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'held_the_line_on_etr' }],
        },
        {
          text: "There's a line crew working the county tonight. Yours is in the order.",
          goto: 'accepts_grudgingly',
          effects: [{ op: 'trust', delta: 1 }],
        },
        {
          text: "Couple of hours, probably.",
          goto: 'promised_time',
          effects: [
            { op: 'flag', name: 'promised_merrick_etr' },
            { op: 'promise', key: 'two_hours' },
            { op: 'log', text: 'Gave MERRICK an estimated restore time. Policy says do not.', kind: 'warn' },
          ],
        },
      ],
    },

    promised_time: {
      speaker: 'caller',
      lines: [
        { text: "Couple of hours. Okay. Okay, that I can work with. Thank you." },
        { text: "I'm gonna hold you to that, you know. I'm writing it on the wall here in pen." },
        { text: "Kidding. Mostly.", stage: 'lighter than he has been all call' },
      ],
      effects: [{ op: 'trust', delta: 1 }],
      next: 'signoff',
    },

    accepts_grudgingly: {
      speaker: 'caller',
      lines: [
        { text: "Yeah, that's what the recording said too. Different words." },
        { text: "...No, I know. I know it's not you." },
        { text: "It's just the freezer, is the thing. There's a half a deer in there my brother-in-law shot and if I lose it I have to have a conversation about it." },
      ],
      next: 'signoff',
    },

    signoff: {
      speaker: 'player',
      choices: [
        {
          text: "I've got it written down. If it's still out in the morning, call us back.",
          goto: 'end_ok',
        },
        {
          text: "Keep the freezer shut. It'll hold twenty-four hours if you don't open it.",
          goto: 'end_warm',
          effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'gave_freezer_advice' }],
        },
        {
          text: "Anything else?",
          goto: 'end_ok',
        },
      ],
    },

    end_warm: {
      speaker: 'caller',
      lines: [
        { text: "Huh. Is that true?" },
        { text: "...Alright. Alright, that's the most useful thing anybody's said to me tonight. Thanks. Really." },
        { text: "Good luck out there. Sounds like it's gonna be a long one for you too." },
      ],
      effects: [
        { op: 'log', text: 'MERRICK D - TR opened - caller satisfied', kind: 'call' },
        { op: 'beat', to: 1 },
      ],
      end: true,
    },

    end_ok: {
      speaker: 'caller',
      lines: [
        { text: "Nope. That's it. Thanks." },
        { text: "...Hey. Sorry about before. The machine thing. Long night." },
      ],
      effects: [
        { op: 'log', text: 'MERRICK D - TR opened', kind: 'call' },
        { op: 'beat', to: 1 },
      ],
      end: true,
    },

    back_from_hold: {
      speaker: 'caller',
      lines: [
        { text: "—hello? Hello. I thought you'd dropped me." },
        { text: "That music, by the way. That music is a punishment.", stage: 'trying to be funny about it' },
      ],
      effects: [{ op: 'trust', delta: -1 }],
      next: 'ticket_gate',
    },
  },
};
