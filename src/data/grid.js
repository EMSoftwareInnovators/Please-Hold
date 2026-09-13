/* ============================================================
   grid.js -- Wright County Power & Light's service territory.

   This is the single source of truth for geography. The wall map,
   the terminal's map screen, the outage records, the crew travel
   times and the customer addresses all read from here, so adding
   a town means adding it once.

   Map coordinates are in "map units" (roughly kilometers) with
   +X east and +Y north. The drawing code flips Y.
   ============================================================ */

export const TERRITORY = { w: 34, h: 26, name: 'WRIGHT COUNTY' };

/** Substations. `feeders` lists the circuits that leave each one. */
export const SUBSTATIONS = [
  { id: 'MH', name: 'MARROW HILL SUB', x: 15.5, y: 13.0, kv: 69 },
  { id: 'KC', name: 'KETTLE CREEK SUB', x: 25.0, y: 18.5, kv: 69 },
  { id: 'RR', name: 'RIVER ROAD SUB', x: 8.5, y: 7.5, kv: 69 },
  { id: 'OS', name: 'OSTRANDER TAP', x: 27.5, y: 6.0, kv: 25 },
];

/**
 * Distribution feeders. `path` is the trunk as it is drawn on the map;
 * `customers` is the meter count, which is what the outage screen totals.
 */
export const FEEDERS = [
  { id: 'MH-11', sub: 'MH', customers: 1840, path: [[15.5, 13], [14.2, 15.4], [12.6, 17.2], [10.4, 18.6]] },
  { id: 'MH-12', sub: 'MH', customers: 2310, path: [[15.5, 13], [17.8, 12.2], [20.1, 11.4], [22.6, 10.2]] },
  { id: 'MH-14', sub: 'MH', customers: 960, path: [[15.5, 13], [15.1, 10.2], [14.4, 7.8], [13.9, 5.1]] },
  { id: 'KC-04', sub: 'KC', customers: 1420, path: [[25, 18.5], [23.2, 20.4], [21.0, 21.8], [18.4, 22.6]] },
  { id: 'KC-07', sub: 'KC', customers: 780, path: [[25, 18.5], [27.4, 19.6], [29.6, 20.4]] },
  { id: 'RR-02', sub: 'RR', customers: 2050, path: [[8.5, 7.5], [7.1, 9.8], [5.6, 12.1], [4.2, 14.0]] },
  { id: 'RR-09', sub: 'RR', customers: 1130, path: [[8.5, 7.5], [9.9, 5.2], [11.2, 3.1]] },
  { id: 'OS-07', sub: 'OS', customers: 410, path: [[27.5, 6], [29.2, 4.2], [30.8, 2.6]] },
];

/** Towns, for the map and for making addresses sound like places. */
export const TOWNS = [
  { name: 'MARROW HILL', x: 15.0, y: 12.2, seat: true },
  { name: 'CALDER', x: 11.4, y: 17.9, seat: false },
  { name: 'NEW BETHEL', x: 21.6, y: 10.7, seat: false },
  { name: 'KETTLE CREEK', x: 24.2, y: 19.4, seat: false },
  { name: 'OSTRANDER', x: 29.0, y: 4.6, seat: false },
  { name: 'FAIRHAVEN', x: 5.2, y: 12.8, seat: false },
  { name: 'DEVOE', x: 10.8, y: 3.6, seat: false },
];

/** Rivers and the one state highway, drawn behind everything else. */
export const WATER = [
  [[2, 21], [7, 18.5], [10.5, 15.2], [13.6, 11.4], [16.2, 7.1], [19.4, 3.2]],
];
export const ROADS = [
  { name: 'ST HWY 9', path: [[0, 11.5], [6.5, 12.2], [13.2, 12.8], [20.4, 13.6], [27.8, 14.4], [34, 15.0]], major: true },
  { name: 'CO RD 18', path: [[15.2, 0], [15.6, 6.4], [15.5, 13.0], [15.0, 19.8], [14.4, 26]], major: false },
  { name: 'KETTLE CREEK RD', path: [[19.0, 24.4], [22.4, 21.2], [25.0, 18.5], [27.0, 14.6]], major: false },
  { name: 'RIVER RD', path: [[4.0, 3.2], [6.4, 5.6], [8.5, 7.5], [11.0, 9.4]], major: false },
];

/**
 * Street names by town, used to generate and validate addresses. The
 * suspicious-call beat depends on an address that is NOT in this list.
 */
export const STREETS = {
  'MARROW HILL': ['ELM', 'WALNUT', 'CHURCH', 'DEPOT', 'HIGH', 'ORCHARD', 'MILL', 'FRONT'],
  'CALDER': ['CALDER MAIN', 'BIRCH', 'SUMMIT', 'QUARRY'],
  'NEW BETHEL': ['BETHEL PIKE', 'SYCAMORE', 'GRANGE'],
  'KETTLE CREEK': ['CREEK', 'HOLLOW', 'LOWER FORD'],
  'OSTRANDER': ['OSTRANDER MAIN', 'SILO', 'PRAIRIE'],
  'FAIRHAVEN': ['FAIRHAVEN', 'CEMETERY', 'STATE'],
  'DEVOE': ['DEVOE', 'TANNERY RD'],
};

/** Where the operations center itself sits, for crew travel times. */
export const OPS_CENTER = { x: 15.9, y: 12.6, name: 'DISTRICT OPS' };

const byId = (list) => Object.fromEntries(list.map((e) => [e.id, e]));
export const FEEDER_BY_ID = byId(FEEDERS);
export const SUB_BY_ID = byId(SUBSTATIONS);

/** Straight-line map distance, used as a stand-in for drive time. */
export function mapDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Rough minutes for a truck to get from `a` to `b` on a bad night. */
export function driveMinutes(a, b) {
  return Math.max(6, Math.round(mapDistance(a, b) * 2.6 + 4));
}

/** The midpoint of a feeder, good enough for "where is the trouble". */
export function feederCenter(id) {
  const f = FEEDER_BY_ID[id];
  if (!f) return { x: TERRITORY.w / 2, y: TERRITORY.h / 2 };
  const p = f.path[Math.floor(f.path.length / 2)];
  return { x: p[0], y: p[1] };
}
