/* ============================================================
   archive.js -- what is in Records.

   This is the documentary half of the game. Every impossible
   thing a caller says tonight can be checked against paper, and
   the paper agrees with them. That is the whole design: the
   player is not told there is a ghost, they are handed a service
   card in somebody's 1943 handwriting and left to work out what
   it means that the man on line two just read them the number on
   it.

   THE 1978 EVENT, plainly, so the writing stays consistent:

     Blackridge is a hamlet north-west of Marrow Hill, served by
     feeder BR-01 out of the old Blackridge substation. The road
     was BELL RIDGE ROAD until the county renamed it in 1958.

     On 11 November 1978 a storm took the primary down. The night
     dispatcher, ROBERT KEEFE, worked the desk the player is
     sitting at. He sent Unit 7 -- lineman W. HALLORAN, lineman
     E. SIKES, groundman T. VANCE -- to the substation at 03:40.

     At 04:17 every recorder in the district stopped. They logged
     nothing for eleven minutes. The company called it a timing
     fault in the paper and never explained it in the file.

     One man walked back. The other two are in the incident file
     under "arc flash / equipment failure", which is not what the
     crew's own statements say. Their statements say the men were
     answering somebody who was talking to them on the line.

     Blackridge substation was decommissioned in 1979 and the
     feeder was taken off the maps. Callers still come from it.

   The surnames are not a coincidence and the player is meant to
   notice: Halloran, Sikes and Vance are on the roster tonight.
   Sons and a daughter, in the same trade, in the same county.
   Nobody in this game says that out loud.
   ============================================================ */

/* ============================================================
   SERVICE CARDS
   The drawer that predates the CIS. `confirms` sets a flag when
   the player physically pulls the card, which is how a call
   script knows the player has PROOF rather than a suspicion.
   ============================================================ */
export const SERVICE_CARDS = [
  {
    id: 'card_gaines',
    drawer: 'F-K',
    name: 'GAINES, HOWARD T.',
    address: 'BELL RIDGE RD',
    service: 'BR-4-0112',
    aliases: ['BELL RIDGE', 'BLACKRIDGE', 'GAINES'],
    confirms: 'gaines_confirmed',
    anomalous: true,
    requires: ['met_gaines'],
    lines: [
      'WRIGHT COUNTY POWER & LIGHT — SERVICE RECORD',
      'ACCOUNT  BR-4-0112',
      'NAME     GAINES, HOWARD T.',
      'SERVICE  BELL RIDGE RD, BLACKRIDGE TWP',
      'METER    A-4471  (SET 04/1939)',
      'RATE     RESIDENTIAL FARM — SCHEDULE 4',
      '',
      'NOTE 11/42  WAR PRODUCTION BOARD — DEFERRED',
      '            MAINTENANCE, POLE LINE BELL RIDGE',
      'NOTE 03/43  PARTY LINE 4 SUBSCRIBERS. RINGS 2 LONG 1 SHORT.',
      'NOTE 08/44  SERVICE DISCONTINUED. SUBSCRIBER DECEASED.',
      '            METER REMOVED. FINAL BILL WAIVED.',
    ],
    tail: 'The last two lines are in a different pen.',
  },
  {
    id: 'card_pratt',
    drawer: 'L-R',
    name: 'PRATT, EDWARD J.',
    address: 'TANNERY ROW',
    service: 'MA-4-1112',
    aliases: ['PRATT', 'TANNERY'],
    confirms: 'pratt_confirmed',
    anomalous: true,
    requires: ['pratt1956'],
    lines: [
      'WRIGHT COUNTY POWER & LIGHT — SERVICE RECORD',
      'ACCOUNT  MA-4-1112',
      'NAME     PRATT, EDWARD J.',
      'SERVICE  14 TANNERY ROW, MARROW HILL',
      'METER    C-9902  (SET 11/1951)',
      '',
      'NOTE 02/56  SUBSCRIBER REPORTS "CROSSED LINE" — HEARS',
      '            OTHER CONVERSATIONS. TELCO ADVISED.',
      'NOTE 09/56  SUBSCRIBER REPORTS SAME. TELCO ADVISED AGAIN.',
      'NOTE 11/56  ACCOUNT CLOSED — PREMISES VACANT.',
      '',
      'TANNERY ROW REMOVED FROM SERVICE MAP 1961 (URBAN RENEWAL).',
    ],
    tail: 'Somebody has underlined "hears other conversations" twice.',
  },
  {
    id: 'card_halvorsen',
    drawer: 'F-K',
    name: 'HALVORSEN VIDEO & TAN',
    address: '300 COMMERCE ST',
    service: 'WH-31088',
    aliases: ['HALVORSEN', 'COMMERCE', 'VIDEO'],
    confirms: 'halvorsen_confirmed',
    anomalous: true,
    requires: ['met_halvorsen'],
    lines: [
      'WRIGHT COUNTY POWER & LIGHT — COMMERCIAL SERVICE',
      'ACCOUNT  WH-31088',
      'NAME     HALVORSEN VIDEO & TANNING',
      'SERVICE  300 COMMERCE ST, MARROW HILL',
      'DEMAND   47 kW  — REFRIGERATION / LAMP LOAD',
      '',
      'NOTE 06/85  NEW SERVICE. 200A. INSPECTED.',
      'NOTE 02/87  SUBSCRIBER DISPUTES DEMAND CHARGE. RESOLVED.',
      'NOTE 04/91  ACCOUNT CLOSED. BUSINESS FAILED.',
      'NOTE 04/91  SERVICE TO 300 COMMERCE TRANSFERRED TO',
      '            MARROW HILL SAVINGS (BRANCH).',
    ],
    tail: 'The building is a bank. It has been a bank since you were at school.',
  },
  {
    id: 'card_keefe',
    drawer: 'F-K',
    name: 'KEEFE, ROBERT A. — EMPLOYEE',
    address: 'DISTRICT OPERATIONS',
    service: 'EMP-1140',
    aliases: ['KEEFE', 'DISPATCH', 'EMPLOYEE'],
    confirms: 'keefe_confirmed',
    anomalous: true,
    requires: ['keefe_said_1956'],
    lines: [
      'PERSONNEL — DISTRICT OPERATIONS CENTER',
      'KEEFE, ROBERT A.       BADGE 1140',
      'DISPATCHER — THIRD TRICK',
      'HIRED    04/1971',
      '',
      'NOTE 11/78  ON DUTY, NIGHT OF 11 NOVEMBER. SEE INCIDENT',
      '            FILE BR-78. STATEMENT TAKEN.',
      'NOTE 01/79  LEAVE OF ABSENCE — MEDICAL.',
      'NOTE 06/79  SEPARATED FROM COMPANY.',
      '',
      'FORWARDING ADDRESS: NONE ON FILE.',
    ],
    tail: 'Stapled to the back: a dispatch log page for 11 Nov 1978. '
      + 'The entries stop at 0417 and start again at 0428.',
  },
  {
    id: 'card_unit7',
    drawer: 'S-Z',
    name: 'UNIT 7 — CREW ASSIGNMENT 1978',
    address: 'DISTRICT OPERATIONS',
    service: 'CRW-0007',
    aliases: ['UNIT 7', 'HALLORAN', 'SIKES', 'VANCE', 'CREW'],
    confirms: 'unit7_confirmed',
    anomalous: true,
    requires: ['evpWarning'],
    lines: [
      'CREW ASSIGNMENT CARD — UNIT 7',
      'PERIOD 1976 — 1979',
      '',
      'LINEMAN    HALLORAN, WALTER J.    BADGE 0871',
      'LINEMAN    SIKES, EARL D.         BADGE 0912',
      'GROUNDMAN  VANCE, THOMAS R.       BADGE 1203',
      '',
      'NOTE 11/78  ASSIGNED BLACKRIDGE SUB 0340 11 NOV.',
      'NOTE 11/78  HALLORAN W. — RETURNED.',
      'NOTE 11/78  SIKES E. — SEE INCIDENT FILE BR-78.',
      'NOTE 11/78  VANCE T. — SEE INCIDENT FILE BR-78.',
      '',
      'UNIT 7 OUT OF SERVICE 11/78 — 03/79.',
    ],
    tail: 'Tonight’s roster has a Halloran on Unit 7, a Sikes on Twelve, '
      + 'and a Vance who called you about a wire down at midnight.',
  },
  {
    id: 'card_mercer',
    drawer: 'L-R',
    name: 'MERCER, ALICE',
    address: '9 DEPOT ST',
    service: 'MA-2-0418',
    aliases: ['MERCER', 'DEPOT', 'ALICE'],
    confirms: 'mercer_confirmed',
    anomalous: true,
    requires: ['loop_recognised'],
    lines: [
      'WRIGHT COUNTY POWER & LIGHT — SERVICE RECORD',
      'ACCOUNT  MA-2-0418',
      'NAME     MERCER, ALICE M.',
      'SERVICE  9 DEPOT ST, MARROW HILL (UPPER FLAT)',
      '',
      'NOTE 01/61  SUBSCRIBER REPORTS FLICKERING. NO FAULT FOUND.',
      'NOTE 01/61  SUBSCRIBER REPORTS BURNING SMELL. REFERRED TO',
      '            LANDLORD — INTERNAL WIRING NOT COMPANY PROPERTY.',
      'NOTE 02/61  ACCOUNT CLOSED.',
      '',
      'CLIPPING ATTACHED — MARROW HILL SENTINEL, 8 FEB 1961:',
      '"FIRE CLAIMS DEPOT ST WOMAN. Mrs Alice Mercer, 34, died',
      'in a fire at her Depot Street apartment early Tuesday.',
      'Firemen said the blaze began in the walls. A neighbour',
      'said Mrs Mercer had telephoned about smoke shortly after',
      'four o’clock in the morning."',
    ],
    tail: 'Four o’clock in the morning. It does not say 4:17. It does not have to.',
  },
  {
    id: 'card_ferris',
    drawer: 'A-E',
    name: 'FERRIS, D & M',
    address: '41 QUARRY RD',
    service: 'WH-40901',
    aliases: ['FERRIS', 'QUARRY'],
    requires: [],
    lines: [
      'WRIGHT COUNTY POWER & LIGHT — SERVICE RECORD',
      'ACCOUNT  WH-40901   (ACTIVE — SEE CIS)',
      'NAME     FERRIS, DENISE & MARK',
      'SERVICE  41 QUARRY RD, CALDER',
      '',
      'NOTE 05/94  WELL PUMP — CUSTOMER ADVISED OF LOAD.',
      'NOTE 09/97  MEDICAL — NEBULISER. PRIORITY RESTORE FLAG SET.',
      '',
      'CARD SUPERSEDED BY CIS 1984. RETAINED FOR NOTES.',
    ],
    tail: 'An ordinary card about an ordinary family, filed with the others.',
  },
  {
    id: 'card_rental',
    drawer: 'S-Z',
    name: 'TRIPLE FEATURE VIDEO',
    address: '112 COMMERCE ST',
    service: 'WH-33740',
    aliases: ['TRIPLE', 'VIDEO', 'RENTAL'],
    requires: [],
    lines: [
      'WRIGHT COUNTY POWER & LIGHT — COMMERCIAL SERVICE',
      'ACCOUNT  WH-33740',
      'NAME     TRIPLE FEATURE VIDEO',
      'SERVICE  112 COMMERCE ST, MARROW HILL',
      '',
      'NOTE 11/96  AFTER-HOURS OUTAGE. MANAGER ON SITE ALL NIGHT,',
      '            WOULD NOT LEAVE THE BUILDING. CREW NOTED IT.',
      'NOTE 03/98  ACCOUNT CLOSED. PREMISES VACANT.',
    ],
    tail: 'Somebody has written in the margin: "ask him about the back room". '
      + 'No explanation. Different pen again.',
  },
];

/* ============================================================
   OUTAGE LEDGERS
   The bound volumes on the shelf. Read for the shape of a night,
   not for a single fact.
   ============================================================ */
export const LEDGERS = [
  {
    id: 'ledger_1978',
    year: 1978,
    title: 'OUTAGE LEDGER — VOL. 14, OCT-DEC 1978',
    requires: ['keefe_said_1956'],
    lines: [
      '11 NOV 1978   STORM — DISTRICT WIDE',
      '',
      '2340  MH-11  TREE/PRIMARY        RESTORED 0115',
      '0052  RR-02  FUSE                RESTORED 0140',
      '0210  BR-01  PRIMARY DOWN, BELL RIDGE RD',
      '0340  BR-01  UNIT 7 ASSIGNED — BLACKRIDGE SUB',
      '0417  ———',
      '0428  BR-01  ———',
      '0431  BR-01  MUTUAL AID REQUESTED — COUNTY',
      '0602  BR-01  FEEDER ISOLATED. NOT RESTORED.',
      '',
      'BR-01 REMAINS ISOLATED. SEE ENGINEERING.',
      'BLACKRIDGE SUB DECOMMISSIONED 07/1979.',
    ],
    tail: 'The line at 0417 has nothing after it. Not "no event". Nothing. '
      + 'Eleven minutes of a ruled page with a dash in it.',
  },
  {
    id: 'ledger_1956',
    year: 1956,
    title: 'OUTAGE LEDGER — VOL. 3, 1956',
    requires: ['pratt_confirmed'],
    lines: [
      '14 FEB 1956   ICE',
      '',
      '0402  MA-2   PRIMARY — TANNERY ROW',
      '0417  MA-2   ———',
      '0431  MA-2   CREW REPORTS "INTERFERENCE ON SET"',
      '0510  MA-2   RESTORED',
      '',
      'DISPATCHER NOTE: SUBSCRIBERS ON TANNERY ROW REPORT',
      'HEARING THIS OFFICE ON THEIR TELEPHONES. TELCO ADVISED.',
    ],
    tail: 'The same eleven minutes. Twenty-two years earlier.',
  },
];

/* ============================================================
   THE INCIDENT FILE
   BR-78. It unlocks a page at a time, and the pages are in the
   order the company wrote them, which is not the order the truth
   happened in.
   ============================================================ */
export const INCIDENTS = [
  {
    id: 'br78_cover',
    title: 'INCIDENT FILE BR-78 — COVER SHEET',
    requires: ['keefe_said_1956'],
    flag: 'br78_opened',
    lines: [
      'WRIGHT COUNTY POWER & LIGHT',
      'INCIDENT FILE BR-78',
      'DATE OF OCCURRENCE: 11 NOVEMBER 1978',
      'LOCATION: BLACKRIDGE SUBSTATION, BELL RIDGE RD',
      '',
      'CLASSIFICATION: EMPLOYEE FATALITY (2)',
      'CAUSE OF RECORD: ARC FLASH — EQUIPMENT FAILURE',
      '',
      'DISTRIBUTION: DISTRICT MGR / SAFETY / LEGAL',
      'NOT FOR CREW CIRCULATION.',
    ],
  },
  {
    id: 'br78_statement',
    title: 'BR-78 — STATEMENT OF W. HALLORAN, LINEMAN',
    requires: ['br78_opened'],
    flag: 'br78_statement',
    lines: [
      'TAKEN 13 NOVEMBER 1978. TRANSCRIBED.',
      '',
      '"We got there about ten to four. The primary was down on',
      'the north side, on the ground, and it was live, so we were',
      'waiting on the dispatcher to get us a clearance.',
      '',
      '"Earl had the set in the truck. There was somebody on it.',
      'Not the office. I asked him who he was talking to and he',
      'said it was the office and I said no it isn’t, I can hear',
      'the office, and he said then who is it.',
      '',
      '"Tom went up to the fence to look at the yard. Earl went',
      'after him. I stayed with the truck because somebody had',
      'to be on the set.',
      '',
      '"The lights in the yard came up. All of them. That yard',
      'had no station service, it had been dead two hours.',
      '',
      '"I am not going to write down what I heard. I have told',
      'the gentleman from the office and he can write it down if',
      'he wants it in there."',
      '',
      '[NOTHING FURTHER RECORDED]',
    ],
  },
  {
    id: 'br78_recorder',
    title: 'BR-78 — RECORDER CHART, DISTRICT',
    requires: ['br78_statement'],
    flag: 'br78_recorder',
    lines: [
      'ENGINEERING MEMO — 20 NOVEMBER 1978',
      '',
      'The district recorder charts for the night of 11 November',
      'stop at 0417 and resume at 0428 on all four machines,',
      'including the machine at Kettle Creek which is on a',
      'separate clock and a separate supply.',
      '',
      'The pen positions do not drift during the interval. They',
      'resume at the value they held at 0417.',
      '',
      'The most likely explanation is a fault in the common time',
      'signal. We have been unable to identify such a fault.',
      '',
      'Recommend the interval be shown as a timing error on any',
      'chart released outside the company.',
    ],
    tail: 'Somebody has written along the bottom in pencil: '
      + '"the telephone recorder too. and that is not on our clock."',
  },
  {
    id: 'br78_keefe',
    title: 'BR-78 — STATEMENT OF R. KEEFE, DISPATCHER',
    requires: ['br78_recorder'],
    flag: 'br78_keefe',
    lines: [
      'TAKEN 14 NOVEMBER 1978.',
      '',
      '"I had Unit 7 on the radio and I had somebody on line',
      'four and I could not get rid of them. They were not a',
      'customer. They knew the crew’s names.',
      '',
      '"I told Walter to get his men away from the fence. I said',
      'it twice. He says he never heard me say it at all, and I',
      'believe him, because the recorder has it and he does not.',
      '',
      '"At seventeen minutes past four every line on my console',
      'lit up at once. All six. There is no way for that to',
      'happen. There were not six calls in the county.',
      '',
      '"I answered one of them. I am not going to say what I',
      'heard on it and I am not coming back to this building."',
      '',
      '[SEPARATED FROM COMPANY 06/1979]',
    ],
  },
  {
    id: 'br78_memo',
    title: 'BR-78 — DISTRICT MANAGER, INTERNAL',
    requires: ['br78_keefe'],
    flag: 'br78_memo',
    lines: [
      'INTERNAL — 04 JANUARY 1979',
      '',
      'BR-01 will not be rebuilt. Blackridge substation is to be',
      'decommissioned and removed from the service maps at the',
      'next revision.',
      '',
      'The subscribers on Bell Ridge Road are four in number and',
      'will be transferred to MH-14.',
      '',
      'Dispatch is to be instructed that BR-01 no longer exists.',
      'If the circuit appears on a console it is a fault in the',
      'console and is to be reported to Engineering and to nobody',
      'else.',
      '',
      'I do not want this discussed on the radio.',
    ],
    tail: 'BR-01 appeared on your console tonight.',
  },
];
