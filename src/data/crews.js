/* ============================================================
   crews.js -- who is actually out there tonight.

   A small roster is deliberate. Three units for a whole county in
   a windstorm is the real constraint the job runs on, and it is
   what turns "dispatch a crew" into a decision instead of a
   button. Adding a unit here changes the difficulty of the whole
   shift, so do it on purpose.
   ============================================================ */

export const CREWS = [
  {
    id: 'T7', callsign: 'TROUBLE SEVEN', kind: 'TROUBLE',
    lead: 'HALLORAN', voice: 'halloran', size: 1,
    skills: ['FUSE', 'SERVICE', 'ASSESS'],
    // where the truck is parked at the top of the shift, in map units
    home: { x: 15.9, y: 12.6 },
    notes: 'Twenty-two years on. Will tell you what he thinks.',
  },
  {
    id: 'T12', callsign: 'TROUBLE TWELVE', kind: 'TROUBLE',
    lead: 'SIKES', voice: 'sikes', size: 2,
    skills: ['FUSE', 'SERVICE', 'ASSESS', 'TREE'],
    home: { x: 24.2, y: 19.4 },
    notes: 'Sikes and Day. Sikes talks, Day drives.',
  },
  {
    id: 'L3', callsign: 'LINE THREE', kind: 'LINE',
    lead: 'OTT', voice: 'ott', size: 4,
    skills: ['FUSE', 'SERVICE', 'ASSESS', 'TREE', 'POLE', 'PRIMARY'],
    home: { x: 8.5, y: 7.5 },
    onCall: true,                 // has to be woken up, and knows it
    notes: 'On call. Getting them out of bed costs you something.',
  },
];

/** What a job needs before a crew can clear it. */
export const SKILL_FOR_CAUSE = {
  'FUSE': 'FUSE',
  'TREE ON LINE': 'TREE',
  'BROKEN POLE': 'POLE',
  'WIRE DOWN': 'PRIMARY',
  'SERVICE DROP': 'SERVICE',
  'TRANSFORMER': 'PRIMARY',
  'UNKNOWN': 'ASSESS',
};
