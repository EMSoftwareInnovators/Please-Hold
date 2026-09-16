/* ============================================================
   faxes.js -- everything that comes out of the machine.

   The order matters more than the content. The first five pages
   are county emergency management, a weather warning, a mutual
   aid notice and a roster change: paperwork that a dispatcher
   would glance at and drop on the spike. They exist so that the
   handshake tone becomes ordinary.

   Only then does anything else arrive.

   `anomalous` marks a page that should be logged as such;
   `flag` is set when the player physically collects it, so a
   conversation can know the player has the page in their hand.
   ============================================================ */

export const FAXES = [
  /* ============================================================
     ORDINARY. Five of these before anything else. This is the
     part of the design that does the work.
     ============================================================ */
  {
    id: 'fax_wx1',
    from: 'NWS BINGHAMTON — VIA COUNTY EOC',
    subject: 'SEVERE THUNDERSTORM WARNING — WRIGHT CO',
    lines: [
      'BULLETIN — IMMEDIATE BROADCAST REQUESTED',
      'SEVERE THUNDERSTORM WARNING',
      'WRIGHT COUNTY UNTIL 300 AM',
      '',
      'AT 1042 PM DOPPLER INDICATED A LINE OF SEVERE',
      'THUNDERSTORMS CAPABLE OF PRODUCING DESTRUCTIVE',
      'WINDS IN EXCESS OF 60 MPH.',
      '',
      'LOCATIONS IMPACTED INCLUDE...',
      'MARROW HILL... CALDER... NEW BETHEL... KETTLE CREEK...',
      'FAIRHAVEN... DEVOE... BELL RIDGE...',
      '',
      'PRECAUTIONARY/PREPAREDNESS ACTIONS...',
      'MOVE TO AN INTERIOR ROOM ON THE LOWEST FLOOR.',
    ],
    tail: 'Bell Ridge. The wire copy still lists it under the old name.',
  },
  {
    id: 'fax_eoc',
    from: 'WRIGHT CO EMERGENCY MANAGEMENT',
    subject: 'ROAD CLOSURES — 0100 UPDATE',
    lines: [
      'WRIGHT COUNTY EOC — SITUATION UPDATE 0100',
      '',
      'ROADS CLOSED:',
      '  CO RD 18 SOUTH — TREE ACROSS BOTH LANES',
      '  RIVER RD AT THE BRIDGE — WATER OVER ROAD',
      '  QUARRY RD — UTILITY WORK, ONE LANE',
      '',
      'SHELTERS: NONE OPEN AT THIS TIME.',
      '',
      'UTILITIES: WRIGHT CO POWER REPORTS SCATTERED',
      'OUTAGES, CREWS WORKING. NO ETR.',
      '',
      'NEXT UPDATE 0400 OR AS WARRANTED.',
    ],
  },
  {
    id: 'fax_mutual',
    from: 'SOUTHERN TIER MUTUAL AID',
    subject: 'MUTUAL AID AVAILABILITY',
    lines: [
      'MUTUAL AID — OVERNIGHT AVAILABILITY',
      '',
      'DELAWARE VALLEY CO-OP:  2 CREWS, 4 HR RESPONSE',
      'TIOGA MUNICIPAL:        1 CREW, 6 HR RESPONSE',
      'CHENANGO RURAL:         NONE — COMMITTED',
      '',
      'REQUESTS TO BE MADE THROUGH DISTRICT MANAGER',
      'ONLY. DO NOT COMMIT CREWS FROM DISPATCH.',
      '',
      'THIS SHEET SUPERSEDES THE 2200 SHEET.',
    ],
  },
  {
    id: 'fax_roster',
    from: 'DISTRICT OPERATIONS — SUPV MERRITT',
    subject: 'ROSTER CHANGE — THIRD TRICK',
    lines: [
      'ROSTER CHANGE — EFFECTIVE TONIGHT',
      '',
      'UNIT 7   HALLORAN     (NO CHANGE)',
      'UNIT 12  SIKES / DAY  (NO CHANGE)',
      'LINE 3   OTT          ON CALL — CALL OUT ONLY',
      '',
      'OTT IS ON CALL, NOT ON SHIFT. IF YOU WAKE HIM UP',
      'YOU HAD BETTER NEED HIM.',
      '',
      'COFFEE IS THE SECOND CAN, NOT THE FIRST. THE FIRST',
      'IS DECAF AND SOMEBODY PUT IT IN THE WRONG TIN.',
      '',
      '— G. MERRITT',
    ],
    tail: 'She sent this before she went home. It is the most normal thing '
      + 'that will happen tonight.',
  },
  {
    id: 'fax_meter',
    from: 'METER DEPARTMENT — DAY SHIFT',
    subject: 'ESTIMATED READS — ROUTE 4',
    lines: [
      'METER DEPT — FOR THE OVERNIGHT FILE',
      '',
      'ROUTE 4 READS ESTIMATED FOR NOVEMBER DUE TO',
      'ACCESS (DOGS). ACCOUNTS AFFECTED:',
      '',
      '  WH-40122   WH-40201   WH-40455   WH-40877',
      '  WH-41550   WH-42011',
      '',
      'NO ACTION REQUIRED BY DISPATCH.',
      'FILE AND FORGET.',
    ],
  },

  /* ============================================================
     THE OTHER ONES.
     ============================================================ */
  {
    id: 'fax_1978',
    from: '— NO HEADER —',
    subject: 'WORK ORDER — BR-01',
    anomalous: true,
    flag: 'fax_1978_read',
    lines: [
      'WRIGHT COUNTY POWER & LIGHT',
      'TROUBLE ORDER',
      '',
      'DATE      11 NOV 1978',
      'TIME      0340',
      'CIRCUIT   BR-01',
      'LOCATION  BELL RIDGE RD AT BLACKRIDGE SUB',
      'TROUBLE   PRIMARY DOWN — ENERGIZED',
      '',
      'ASSIGNED  UNIT 7',
      'DISPATCHER  R. KEEFE',
      '',
      'CLEARANCE REQUESTED: YES',
      'CLEARANCE GRANTED:   ——',
      '',
      'REMARKS: CREW WAITING ON CLEARANCE. DO NOT LET',
      'THEM APPROACH THE YARD UNTIL I HAVE IT.',
    ],
    tail: 'The paper is the right paper. The form number was discontinued '
      + 'in 1983. The machine printed it four seconds ago.',
  },
  {
    id: 'fax_gaines',
    from: 'WCPL — TRANSMITTED 0000',
    subject: 'SERVICE ORDER — GAINES, H.',
    anomalous: true,
    flag: 'fax_gaines_read',
    lines: [
      'SERVICE ORDER',
      '',
      'SUBSCRIBER  GAINES, HOWARD T.',
      'SERVICE     BELL RIDGE RD',
      'ACCOUNT     BR-4-0112',
      '',
      'TROUBLE     NO LIGHTS. SUBSCRIBER TELEPHONED',
      '            OFFICE. WOULD NOT HANG UP.',
      '',
      'DISPOSITION ————',
      '',
      'THIS ORDER HAS BEEN OPEN 20,489 DAYS.',
    ],
    tail: 'Twenty thousand four hundred and eighty-nine days is fifty-six years. '
      + 'The machine did the arithmetic itself.',
  },
  {
    id: 'fax_future',
    from: 'WCPL DISPATCH — MARROW HILL',
    subject: 'TROUBLE ORDER — MH-14',
    anomalous: true,
    flag: 'fax_predicted',
    predicts: { feeder: 'MH-14', address: 'COUNTY RD 18 AT THE CURVE', cause: 'BROKEN POLE', customers: 212 },
    lines: [
      'WRIGHT COUNTY POWER & LIGHT',
      'TROUBLE ORDER — AUTOMATIC',
      '',
      'CIRCUIT   MH-14',
      'LOCATION  COUNTY RD 18 AT THE CURVE',
      'TROUBLE   BROKEN POLE — 212 METERS',
      '',
      'REPORTED BY  DISPATCH',
      'TIME         ————',
      '',
      'THE TIMESTAMP FIELD ON THIS ORDER IS NINE MINUTES',
      'AHEAD OF THE CLOCK ON YOUR WALL.',
    ],
    tail: 'Nine minutes from now, if the machine is right, a pole comes down '
      + 'on County Road Eighteen and two hundred and twelve people lose their lights.',
  },
  {
    id: 'fax_names',
    from: '— NO HEADER —',
    subject: '— NO SUBJECT —',
    anomalous: true,
    flag: 'fax_names_read',
    lines: [
      'HALLORAN W',
      'SIKES E',
      'VANCE T',
      'KEEFE R',
      'MERCER A',
      'PRATT E',
      'GAINES H',
      '',
      '',
      'AND THE ONE AT THE DESK',
    ],
    tail: 'It is a list of everybody who has been on the telephone tonight, '
      + 'in the order you spoke to them, and then one more line.',
  },
  {
    id: 'fax_carefac',
    from: 'BETHEL HOUSE CARE FACILITY',
    subject: 'GENERATOR STATUS — URGENT',
    flag: 'carefac_fax',
    lines: [
      'BETHEL HOUSE — SKILLED NURSING',
      '1100 BETHEL PIKE, NEW BETHEL',
      'ACCOUNT WH-41102',
      '',
      'TO WRIGHT COUNTY POWER — OVERNIGHT DISPATCH',
      '',
      'WE HAVE BEEN ON GENERATOR SINCE 0148.',
      'FUEL ON HAND: APPROXIMATELY 4 HOURS AT PRESENT LOAD.',
      'RESIDENTS: 31. OXYGEN CONCENTRATORS IN USE: 6.',
      'TWO RESIDENTS ON CONTINUOUS SUCTION.',
      '',
      'WE HAVE CALLED THE FUEL SUPPLIER. NO ANSWER.',
      'PLEASE ADVISE ESTIMATED RESTORATION.',
      '',
      '— B. OKONKWO, RN, NIGHT CHARGE',
    ],
    tail: 'This one is real, and it is the most important piece of paper '
      + 'in the building.',
  },
  {
    id: 'fax_dawn',
    from: 'WRIGHT CO EMERGENCY MANAGEMENT',
    subject: 'ALL CLEAR — 0530',
    lines: [
      'WRIGHT COUNTY EOC — 0530',
      '',
      'SEVERE WEATHER HAS CLEARED THE COUNTY.',
      'NO INJURIES REPORTED. NO SHELTERS OPENED.',
      '',
      'UTILITIES REPORT RESTORATION ONGOING.',
      'CREWS WILL WORK INTO THE DAY SHIFT.',
      '',
      'THANK YOU TO OVERNIGHT STAFF.',
      '',
      'EOC RETURNING TO NORMAL OPERATIONS 0600.',
    ],
    tail: 'Thank you to overnight staff.',
  },
];

export function faxById(id) { return FAXES.find((f) => f.id === id) || null; }
