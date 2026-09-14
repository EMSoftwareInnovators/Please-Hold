/* ============================================================
   daley_01 -- Mrs. Eileen Daley, 18 Orchard Street.

   The warm one. She is eighty-one, she has been a customer since
   1961, and she will tell you about her sister. She is also on a
   medical alert for an oxygen concentrator, which the account
   record says in capital letters and which she will not bring up
   herself unless asked, because she does not want to be trouble.

   That gap -- between what the record knows and what she will
   admit -- is the whole design of this call. A player who reads
   the account handles her correctly. A player who does not has a
   pleasant conversation with an elderly woman and gets it wrong.

   She comes back later (daley_02) and remembers everything.
   ============================================================ */
export default {
  id: 'daley_01',
  caller: {
    id: 'daley',
    name: 'EILEEN DALEY',
    display: 'DALEY E',
    number: '555-0148',
    account: 'WH-40122',
    voice: 'daley',
    line: 'clean',
    era: 1999,
  },
  category: 'outage',
  priority: 70,
  schedule: { type: 'beat', beat: 2 },
  hold: { patience: 150, longHold: 40, onReturnNode: 'back_from_hold', trustOnTimeout: -1 },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "Hello? Oh — hello. I'm sorry to be calling so late.", stage: 'genuinely apologetic' },
        { text: "I wasn't going to call at all, but my neighbor said I ought to, and she's usually right about these things." },
      ],
      next: 'greet',
    },

    greet: {
      speaker: 'player',
      choices: [
        { text: "It's no trouble at all, ma'am. This is dispatch — what's going on?", goto: 'explains', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Wright County Power and Light. You're not calling late, you're calling me at work.", goto: 'explains_warm', effects: [{ op: 'trust', delta: 2 }] },
        { text: "Go ahead.", goto: 'explains_curt' },
      ],
    },

    explains_warm: {
      speaker: 'caller',
      lines: [
        { text: "Oh, that's — well, that's a nice way to put it.", stage: 'small laugh' },
        { text: "My power's off. It went off at — well, I was watching the eleven o'clock, and then I wasn't." },
      ],
      next: 'details',
    },

    explains: {
      speaker: 'caller',
      lines: [
        { text: "My power's off. It went out during the news." },
      ],
      next: 'details',
    },

    explains_curt: {
      speaker: 'caller',
      lines: [
        { text: "Oh — yes. Yes, of course. My power's off." },
        { text: "I'm sorry, I know you must be very busy tonight.", stage: 'smaller now' },
      ],
      effects: [{ op: 'trust', delta: -1 }],
      next: 'details',
    },

    /* She gives far more than is asked. That is the character, and it is also
       where the medical alert is hiding in plain sight. */
    details: {
      speaker: 'caller',
      lines: [
        { text: "It's eighteen Orchard Street. Daley. D-A-L-E-Y, like the mayor, though we're no relation, my husband used to make that joke." },
        { text: "The whole street went, I think. The Przybylskis across the way are dark too, and their dog's been going since it happened." },
        { text: "I've got candles. I'm not in the dark dark. I found the ones from when Frances stayed over at Christmas." },
      ],
      effects: [{ op: 'remember', key: 'orchard_street' }, { op: 'remember', key: 'frances' }],
      next: 'triage',
    },

    triage: {
      speaker: 'player',
      choices: [
        {
          // Only offered once the player has read the record and seen the alert.
          text: "Mrs. Daley — the account shows a medical alert. Is the concentrator running?",
          goto: 'medical',
          requires: { lookedUp: 'WH-40122' },
          effects: [
            { op: 'flag', name: 'daley_medical_caught' },
            { op: 'trust', delta: 2 },
            { op: 'log', text: 'DALEY E - MEDICAL ALERT confirmed on call', kind: 'priority' },
          ],
        },
        {
          text: "Is there anything in the house that needs power to keep you well?",
          goto: 'medical_soft',
          effects: [{ op: 'trust', delta: 1 }],
        },
        { text: "Let me get that written down. Eighteen Orchard.", goto: 'no_triage' },
        { text: "Are you all right otherwise? Warm enough?", goto: 'small_talk', once: true, effects: [{ op: 'trust', delta: 1 }] },
      ],
    },

    medical: {
      speaker: 'caller',
      lines: [
        { text: "...Oh." },
        { text: "Well. Yes. It's on the battery. It does that on its own, it's very clever." },
        { text: "It gives you four hours. It says four hours on the sticker. I've had it ninety minutes, about." },
        { text: "I didn't want to lead with that. It sounds like I'm asking to go first.", stage: 'embarrassed' },
      ],
      effects: [
        { op: 'flag', name: 'daley_oxygen_known' },
        { op: 'remember', key: 'oxygen_battery' },
      ],
      next: 'medical_response',
    },

    medical_soft: {
      speaker: 'caller',
      lines: [
        { text: "Anything that — oh. Well." },
        { text: "There's the oxygen. But it's got its own battery, so it isn't an emergency. It really isn't." },
        { text: "Four hours, the sticker says. I've used up an hour and a half of it." },
      ],
      effects: [
        { op: 'flag', name: 'daley_oxygen_known' },
        { op: 'remember', key: 'oxygen_battery' },
      ],
      next: 'medical_response',
    },

    small_talk: {
      speaker: 'caller',
      lines: [
        { text: "Oh, I'm fine. I've got the afghan. It's the one Frances made, it's very ugly and very warm." },
        { text: "Frances is my sister. She's in Ohio now. She calls on Sundays." },
        { text: "...I'm keeping you. You've got other people calling, I know you do." },
      ],
      next: 'triage',
    },

    no_triage: {
      speaker: 'caller',
      lines: [
        { text: "Eighteen Orchard. That's right." },
        { text: "Is somebody coming out, do you think? I don't need to know exactly. I just like to know a thing is happening." },
      ],
      effects: [{ op: 'flag', name: 'daley_medical_missed' }],
      next: 'ticket',
    },

    medical_response: {
      speaker: 'player',
      choices: [
        {
          text: "You are asking to go first, and you should. I'm flagging this as a priority restore.",
          goto: 'priority_set',
          effects: [
            { op: 'flag', name: 'daley_priority' },
            { op: 'trust', delta: 2 },
            { op: 'promise', key: 'priority' },
            { op: 'log', text: 'DALEY E - flagged PRIORITY RESTORE (medical)', kind: 'priority' },
          ],
        },
        {
          text: "Ninety minutes used of four. I want a crew moving before that gets close.",
          goto: 'priority_set',
          effects: [
            { op: 'flag', name: 'daley_priority' },
            { op: 'trust', delta: 2 },
            { op: 'promise', key: 'priority' },
          ],
        },
        {
          text: "If it drops below an hour, call this number back immediately. Don't wait.",
          goto: 'callback_instructed',
          effects: [
            { op: 'flag', name: 'daley_callback_instructed' },
            { op: 'trust', delta: 1 },
            { op: 'promise', key: 'callback' },
          ],
        },
        { text: "All right. I'll note it.", goto: 'ticket', effects: [{ op: 'flag', name: 'daley_noted_only' }] },
      ],
    },

    priority_set: {
      speaker: 'caller',
      lines: [
        { text: "Oh, now, I don't want to put anybody out—" },
        { text: "...but thank you. Thank you. That's — yes. All right." },
        { text: "You've got a nice way about you. Are you new? I don't think I've talked to you before." },
      ],
      effects: [{ op: 'remember', key: 'asked_if_new' }],
      next: 'ticket',
    },

    callback_instructed: {
      speaker: 'caller',
      lines: [
        { text: "Below an hour. All right. I'll watch it. I've got the clock right here on the stove, it's the only thing in the house still lit up." },
        { text: "That's a joke. The stove's gas. It's always lit up." },
      ],
      next: 'ticket',
    },

    ticket: {
      speaker: 'player',
      choices: [
        {
          text: "It's written up. Ticket's on circuit MH-11, same as your neighbors.",
          goto: 'close',
          requires: { outageOnFeeder: 'MH-11' },
          effects: [{ op: 'flag', name: 'daley_ticketed' }],
        },
        { text: "It's written up and it's in front of me. You're not going to get lost in the pile.", goto: 'close', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Someone will be out.", goto: 'close_flat' },
      ],
    },

    close: {
      speaker: 'caller',
      lines: [
        { text: "Thank you, dear. I'll let you go — you've got that whole county to worry about and I've got candles." },
        { text: "...You take care of yourself tonight. It's an awful storm." },
      ],
      effects: [
        { op: 'log', text: 'DALEY E - 18 ORCHARD ST - TR opened', kind: 'call' },
        { op: 'trust', delta: 1 },
        { op: 'schedule', call: 'daley_02', delay: 34 },
        { op: 'beat', to: 3 },
      ],
      end: true,
    },

    close_flat: {
      speaker: 'caller',
      lines: [
        { text: "All right. Thank you." },
        { text: "...Goodnight, then." },
      ],
      effects: [
        { op: 'log', text: 'DALEY E - 18 ORCHARD ST - TR opened', kind: 'call' },
        { op: 'schedule', call: 'daley_02', delay: 30 },
        { op: 'beat', to: 3 },
      ],
      end: true,
    },

    back_from_hold: {
      speaker: 'caller',
      lines: [
        { text: "Hello? Oh, there you are. I didn't mind, I was listening to the music." },
        { text: "It's the same eight notes, did you know that? Over and over. I counted them twice." },
      ],
      next: 'ticket',
    },
  },
};
