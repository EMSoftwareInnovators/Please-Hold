/* ============================================================
   tutorial_01 -- Gloria Merritt, night supervisor, from home.

   The tutorial, and deliberately the most ordinary call in the
   game. Nothing in it is strange. That is the point: the player
   should finish this call believing they understand the job,
   because everything after it works by taking that belief apart.

   It teaches by WAITING rather than by telling. Each `waitFor`
   node holds the conversation until the player has actually done
   the thing -- sat down, opened the terminal, pulled a record,
   written a ticket, sent a truck, worked the hold button. Gloria
   does not continue until they have, and the objective line in
   the corner says what she is waiting for.

   The hold lesson is the important one. She asks the player to
   park HER, for no reason except that she wants to see them do
   it once before the night starts. Hold is the mechanic the whole
   game is named after, and this is the only time it will ever be
   free.
   ============================================================ */
export default {
  id: 'tutorial_01',
  caller: {
    id: 'merritt',
    name: 'GLORIA MERRITT',
    display: 'INTERNAL — SUPV',
    number: 'x2201',
    voice: 'vance',
    line: 'clean',
    era: 1999,
  },
  category: 'story',
  priority: 200,
  rings: 40,                   // she is not going to give up
  schedule: { type: 'beat', beat: 0 },
  hold: { patience: 9999, longHold: 25, onReturnNode: 'back_from_hold' },

  entry: 'start',
  nodes: {
    start: {
      speaker: 'caller',
      lines: [
        { text: "It's Gloria. Don't panic, nothing's wrong.", stage: 'a head cold, and most of the way to bed' },
        { text: "I said I'd ring you on your first one by yourself, so I'm ringing you. Ten minutes and then I'm asleep." },
      ],
      next: 'greet',
    },

    greet: {
      speaker: 'player',
      choices: [
        { text: "I appreciate it. I'm set up.", goto: 'sit_ask', effects: [{ op: 'trust', delta: 1 }] },
        { text: "Honestly, I'm glad you called.", goto: 'sit_ask', effects: [{ op: 'trust', delta: 1 }, { op: 'flag', name: 'admitted_nerves' }] },
        { text: "I've done the training. I'll be fine.", goto: 'sit_ask_dry' },
      ],
    },

    sit_ask_dry: {
      speaker: 'caller',
      lines: [
        { text: "Mm. Everybody's done the training." },
        { text: "Sit down anyway. Humor me." },
      ],
      next: 'wait_sit',
    },

    sit_ask: {
      speaker: 'caller',
      lines: [
        { text: "Good. First thing — are you sitting at the desk? Actually sitting." },
        { text: "You'd be amazed. Sit down." },
      ],
      next: 'wait_sit',
    },

    /* ---- 1. sit down ---- */
    wait_sit: {
      speaker: 'caller',
      waitFor: { flags: ['sat_down'] },
      hint: 'SIT AT THE DISPATCH DESK — walk to the chair and press {use}',
      next: 'terminal_ask',
    },

    terminal_ask: {
      speaker: 'caller',
      lines: [
        { text: "There you are." },
        { text: "Now the box in front of you. That's the CIS — customer information system. It's how you know who you're talking to." },
        { text: "Pull it up, or just lean into it." },
      ],
      next: 'wait_terminal',
    },

    /* ---- 2. open the terminal ---- */
    wait_terminal: {
      speaker: 'caller',
      waitFor: { flags: ['used_terminal'] },
      hint: 'OPEN THE DISPATCH TERMINAL — press {terminal}',
      next: 'lookup_ask',
    },

    lookup_ask: {
      speaker: 'caller',
      lines: [
        { text: "Accounts is the second screen along the top. Type a name, a number, a street — it isn't fussy." },
        { text: "Try somebody. Przybylski, out on Quarry Road. P-R-Z. Pull the record up and look at it." },
        { text: "I want you in the habit before it matters.", stage: 'and it is going to matter' },
      ],
      next: 'wait_lookup',
    },

    /* ---- 3. look somebody up ---- */
    wait_lookup: {
      speaker: 'caller',
      waitFor: { anyLookup: true },
      hint: 'LOOK UP AN ACCOUNT — {screenAccounts}, type a name, {select}, then {select} again to open it',
      next: 'lookup_done',
    },

    lookup_done: {
      speaker: 'caller',
      lines: [
        { text: "That's it. Name, service address, circuit, meter, and whatever the day office wrote in the notes." },
        { text: "The notes are the part people skip. Don't skip the notes." },
        { text: "Some of these people are on oxygen, and the machine doesn't care that it's two in the morning.", stage: 'and she will be right about this within the hour' },
      ],
      effects: [
        { op: 'flag', name: 'taught_notes' },
        { op: 'log', text: 'SUPV MERRITT: read the account notes.', kind: 'note' },
      ],
      next: 'ticket_ask',
    },

    ticket_ask: {
      speaker: 'caller',
      lines: [
        { text: "Right. There's an actual job waiting on you, so let's do it together." },
        { text: "Day office took a call before they went home and never wrote it up. Tree down across the primary on County Road Eighteen, south end. That's circuit MH-14." },
        { text: "Tickets is the third screen. Start a new one, pick the cause off the list, and open it." },
      ],
      effects: [{ op: 'flag', name: 'told_about_tree' }],
      next: 'wait_ticket',
    },

    /* ---- 4. write a ticket ---- */
    wait_ticket: {
      speaker: 'caller',
      waitFor: { flags: ['created_a_ticket'] },
      hint: 'OPEN A TROUBLE TICKET — {screenTickets}, then {newTicket}, choose a cause, then {select}',
      next: 'ticket_done',
    },

    ticket_done: {
      speaker: 'caller',
      lines: [
        { text: "Good. That ticket is the whole job, by the way. Everything else is paperwork about that ticket." },
        { text: "Now put somebody on it. Opening the ticket takes you to units." },
        { text: "You'll see three. Halloran in Seven, Sikes and Day in Twelve, and a line crew that is at home in bed and will let you know about it." },
      ],
      next: 'dispatch_ask',
    },

    dispatch_ask: {
      speaker: 'caller',
      lines: [
        { text: "Read the note column before you pick. It tells you if the unit's rated for the work." },
        { text: "Send a trouble truck to a pole job and you've wasted forty minutes and a man's patience." },
        { text: "Go on. Send one." },
      ],
      effects: [{ op: 'flag', name: 'taught_ratings' }],
      next: 'wait_dispatch',
    },

    /* ---- 5. send a truck ---- */
    wait_dispatch: {
      speaker: 'caller',
      waitFor: { anyCrewDispatched: true },
      hint: 'DISPATCH A UNIT — select the ticket, choose a unit, {select}',
      next: 'dispatch_done',
    },

    dispatch_done: {
      speaker: 'caller',
      lines: [
        { text: "Hear that? That's them coming back on the radio. You don't have to answer every call — they're telling you, not asking you." },
        { text: "The radio's the grey thing on your right. If you need them, key up." },
      ],
      effects: [
        { op: 'flag', name: 'taught_radio' },
        { op: 'log', text: 'SUPV MERRITT: first unit dispatched.', kind: 'note' },
      ],
      next: 'hold_ask',
    },

    /* ---- 6. the hold button ---- */
    hold_ask: {
      speaker: 'caller',
      lines: [
        { text: "One more and I'll let you go." },
        { text: "Put me on hold." },
      ],
      next: 'hold_why',
    },

    hold_why: {
      speaker: 'player',
      choices: [
        { text: "Put you on hold? Why?", goto: 'hold_because' },
        { text: "All right.", goto: 'wait_hold', effects: [{ op: 'trust', delta: 1 }] },
        { text: "I know how to use the hold button, Gloria.", goto: 'hold_because_dry' },
      ],
    },

    hold_because_dry: {
      speaker: 'caller',
      lines: [
        { text: "Then it'll take you two seconds." },
        { text: "One button puts me on it. The same one brings me back. Go." },
      ],
      next: 'wait_hold',
    },

    hold_because: {
      speaker: 'caller',
      lines: [
        { text: "Because at some point tonight you're going to have somebody on the line and a second one ringing, and you'll have to choose." },
        { text: "And I'd rather the first time you press that button it's me on the other end of it and not a woman on oxygen." },
        { text: "Go on. The hold button.", stage: 'not unkind. she has done this job.' },
      ],
      effects: [{ op: 'flag', name: 'taught_hold_why' }],
      next: 'wait_hold',
    },

    /* The tutorial's one real lesson: park somebody, and come back. */
    wait_hold: {
      speaker: 'caller',
      waitFor: { flags: ['used_hold'] },
      hint: 'PUT HER ON HOLD, THEN COME BACK — press {hold}, then {hold} again',
      next: 'hold_done',
    },

    hold_done: {
      speaker: 'caller',
      lines: [
        { text: "— and back. Good." },
        { text: "They can hear that music, you know. It's eight notes. I've had people time me on it." },
        { text: "Nobody waits forever. When somebody's been parked a while, you'll see it on the board and you'll feel it.", stage: 'you will' },
      ],
      effects: [{ op: 'flag', name: 'taught_hold' }],
      next: 'signoff',
    },

    signoff: {
      speaker: 'player',
      choices: [
        { text: "Got it. Thanks, Gloria. Go to bed.", goto: 'end_warm', effects: [{ op: 'trust', delta: 1 }] },
        { text: "What do I do if something happens I don't have a procedure for?", goto: 'the_answer', effects: [{ op: 'flag', name: 'asked_the_question' }] },
        { text: "Understood.", goto: 'end_plain' },
      ],
    },

    /* The line the rest of the night quietly bends back toward. */
    the_answer: {
      speaker: 'caller',
      lines: [
        { text: "...Write it down." },
        { text: "That's not a joke. If something happens you can't account for, you put it in the log with a time on it and you keep answering the phone." },
        { text: "The log is the only thing that's ever going to prove you were here.", pause: 0.8 },
        { text: "Okay. That got grim. It's the cold medicine.", stage: 'laughing at herself' },
      ],
      effects: [
        { op: 'flag', name: 'taught_the_log' },
        { op: 'log', text: 'SUPV MERRITT: if you cannot account for it, log it with a time.', kind: 'note' },
      ],
      next: 'end_warm',
    },

    end_warm: {
      speaker: 'caller',
      lines: [
        { text: "You'll be fine. It's a storm, not a siege." },
        { text: "Oh — and the thermostat by the records door is a lie. It's always four degrees colder than it says." },
        { text: "Goodnight." },
      ],
      effects: [
        { op: 'flag', name: 'tutorial_done' },
        { op: 'log', text: 'Handover complete. Desk is mine until 0600.', kind: 'note' },
        { op: 'beat', to: 1 },
      ],
      end: true,
    },

    end_plain: {
      speaker: 'caller',
      lines: [
        { text: "Right. Goodnight, then." },
      ],
      effects: [
        { op: 'flag', name: 'tutorial_done' },
        { op: 'log', text: 'Handover complete. Desk is mine until 0600.', kind: 'note' },
        { op: 'beat', to: 1 },
      ],
      end: true,
    },

    back_from_hold: {
      speaker: 'caller',
      lines: [
        { text: "Longer than two seconds, that." },
        { text: "But you did it. Where were we." },
      ],
      next: 'hold_done',
    },
  },
};
