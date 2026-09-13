/* ============================================================
   accounts.js -- the customer master file as it stands at 22:45.

   These are the records the player can actually pull up on the
   CRT. They exist so that looking someone up FEELS like work:
   the account numbers have a format, the meter numbers are
   plausible, the service dates run back decades, and several
   records carry the kind of stale note a real utility file has.

   A few entries are load-bearing for the story. They are marked.
   Nothing else about them is special.
   ============================================================ */

export const ACCOUNTS = [
  {
    id: 'WH-40122', name: 'DALEY, EILEEN M', phone: '555-0148',
    address: '18 ORCHARD ST', town: 'MARROW HILL', feeder: 'MH-11',
    meter: '7741903', since: '04/1961', rate: 'RES-1', status: 'ACTIVE',
    notes: 'MEDICAL ALERT - OXYGEN CONCENTRATOR. PRIORITY RESTORE.',
  },
  {
    id: 'WH-40988', name: 'MERRICK, DOUGLAS R', phone: '555-0203',
    address: '402 DEPOT ST', town: 'MARROW HILL', feeder: 'MH-11',
    meter: '8120447', since: '09/1988', rate: 'RES-1', status: 'ACTIVE',
    notes: 'PAST DUE 11/98 - CLEARED 12/98.',
  },
  {
    id: 'WH-41550', name: 'VANCE, KRISTEN A', phone: '555-0491',
    address: '77 BETHEL PIKE', town: 'NEW BETHEL', feeder: 'MH-12',
    meter: '9003318', since: '06/1996', rate: 'RES-1', status: 'ACTIVE',
    notes: '',
  },
  {
    id: 'WH-39604', name: 'OTT, HARLAN', phone: '555-0776',
    address: '1190 LOWER FORD RD', town: 'KETTLE CREEK', feeder: 'KC-04',
    meter: '6650192', since: '11/1957', rate: 'RES-1', status: 'ACTIVE',
    notes: 'SERVICE DROP THROUGH TREES. TRIM REQ 05/97 - NOT SCHEDULED.',
  },
  {
    id: 'WH-42011', name: 'KETTLE CREEK FEED & GRAIN', phone: '555-0310',
    address: '3 CREEK ST', town: 'KETTLE CREEK', feeder: 'KC-04',
    meter: '8890021', since: '03/1974', rate: 'COM-3', status: 'ACTIVE',
    notes: 'THREE PHASE. GRAIN DRYER LOAD SEPT-NOV.',
  },
  {
    id: 'WH-40877', name: 'PRZYBYLSKI, T & A', phone: '555-0620',
    address: '9 QUARRY RD', town: 'CALDER', feeder: 'MH-11',
    meter: '7998412', since: '08/1983', rate: 'RES-1', status: 'ACTIVE',
    notes: '',
  },
  {
    id: 'WH-38119', name: 'FAIRHAVEN METHODIST CHURCH', phone: '555-0155',
    address: '2 CEMETERY RD', town: 'FAIRHAVEN', feeder: 'RR-02',
    meter: '5540870', since: '01/1952', rate: 'COM-1', status: 'ACTIVE',
    notes: 'BILLING TO PARSONAGE. SEE FILE.',
  },
  {
    id: 'WH-41302', name: 'SIKES, RAY D', phone: '555-0808',
    address: '31 SUMMIT ST', town: 'CALDER', feeder: 'MH-11',
    meter: '8455109', since: '02/1992', rate: 'RES-1', status: 'ACTIVE',
    notes: 'EMPLOYEE ACCOUNT.',
  },
  {
    id: 'WH-40455', name: 'BOYER, NADINE', phone: '555-0367',
    address: '55 HIGH ST', town: 'MARROW HILL', feeder: 'MH-14',
    meter: '7702288', since: '07/1979', rate: 'RES-1', status: 'ACTIVE',
    notes: 'DO NOT CALL AFTER 2100 PER CUSTOMER REQUEST.',
  },
  {
    id: 'WH-39987', name: 'DEVOE TANNERY (VACANT)', phone: '',
    address: '1 TANNERY RD', town: 'DEVOE', feeder: 'RR-09',
    meter: '6120033', since: '05/1948', rate: 'IND-2', status: 'INACTIVE',
    notes: 'SERVICE CUT 1981. POLES REMAIN. DO NOT ENERGIZE.',
  },
  {
    id: 'WH-41888', name: 'GRANGE HALL ASSN', phone: '555-0533',
    address: '14 GRANGE RD', town: 'NEW BETHEL', feeder: 'MH-12',
    meter: '8801120', since: '10/1965', rate: 'COM-1', status: 'ACTIVE',
    notes: '',
  },
  {
    id: 'WH-40201', name: 'LUNDQUIST, PER', phone: '555-0244',
    address: '806 ST HWY 9', town: 'FAIRHAVEN', feeder: 'RR-02',
    meter: '7760014', since: '12/1970', rate: 'RES-1', status: 'ACTIVE',
    notes: 'GENERATOR ON PREMISES. TRANSFER SWITCH INSPECTED 1994.',
  },

  /* ---- STORY-CRITICAL ---- */
  {
    // The suspicious call. This address is on a street that no longer
    // appears in the street index, and the record itself is a stub.
    id: 'WH-00318', name: 'HOLBROOK, A', phone: '555-0119',
    address: '31 TANNERY ROW', town: 'DEVOE', feeder: 'RR-09',
    meter: '0031801', since: '06/1954', rate: 'RES-1', status: 'ACTIVE',
    notes: '',
    storyOnly: true, hidden: true,
  },
];

/** Format of an account number, used when a new one has to be minted. */
export const ACCOUNT_PREFIX = 'WH-';
