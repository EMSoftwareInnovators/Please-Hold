/* ============================================================
   plan.js -- the floor plan of the District Operations Center,
   Wright County Power & Light, as data.

   Coordinates are meters. +X is east, +Z is south, +Y is up.
   The building was put up in 1962 and last refurbished in 1978,
   which is why the dispatch room has a drop ceiling stapled
   under a concrete deck and the corridor still has the original
   VCT and painted block.

   ADDING A ROOM: append to ROOMS and WALLS. office.js does not
   know the names of any of these; it only knows how to build a
   floor, a ceiling and a wall with holes in it.
   ============================================================ */

export const CEIL = 2.85;          // drop ceiling height in the office areas
export const CEIL_HALL = 2.70;     // the corridor's is lower -- ducts above it
export const WALL_T = 0.12;        // stud wall thickness

/** Rooms are axis-aligned rectangles: [x0, z0, x1, z1]. */
export const ROOMS = [
  {
    id: 'dispatch', label: 'DISPATCH',
    rect: [0, 0, 10, 8], h: CEIL,
    floor: 'carpet', ceiling: 'ceilingTile',
    grid: true,                      // draw a suspended-ceiling T-bar grid
  },
  {
    id: 'corridor', label: 'CORRIDOR',
    rect: [-7, 5.5, 0, 7.5], h: CEIL_HALL,
    floor: 'vct', ceiling: 'ceilingTile',
    grid: true,
  },
  {
    id: 'breakroom', label: 'BREAK ROOM',
    rect: [-6, 7.5, -2, 11], h: CEIL,
    floor: 'vct', ceiling: 'ceilingTile',
    grid: true,
  },
  {
    id: 'records', label: 'RECORDS',
    rect: [-6, 1.8, -2, 5.5], h: CEIL,
    floor: 'vct', ceiling: 'ceilingTile',
    grid: true,
  },
];

/**
 * Walls run from (x0,z0) to (x1,z1). Holes are given as a span along the
 * wall (t0..t1, meters from the start point) and a vertical span (y0..y1).
 *   kind 'door'   -> gets a frame and a reveal
 *   kind 'window' -> gets a frame, a sill, and glass
 *   kind 'open'   -> a plain cased opening
 */
export const WALLS = [
  /* ---------- dispatch room shell ---------- */
  // north wall (behind the dispatch desk)
  { a: [0, 0], b: [10, 0], mat: 'wallPaint', h: CEIL },
  // east wall -- the storm windows
  {
    a: [10, 0], b: [10, 8], mat: 'wallPaint', h: CEIL,
    holes: [
      { t0: 1.1, t1: 2.7, y0: 0.95, y1: 2.25, kind: 'window' },
      { t0: 3.2, t1: 4.8, y0: 0.95, y1: 2.25, kind: 'window' },
      { t0: 5.3, t1: 6.9, y0: 0.95, y1: 2.25, kind: 'window' },
    ],
  },
  // south wall
  { a: [10, 8], b: [0, 8], mat: 'wallPaint', h: CEIL },
  // west wall -- door out to the corridor at z 6.1..7.05
  {
    a: [0, 8], b: [0, 0], mat: 'wallPaint', h: CEIL,
    holes: [{ t0: 0.95, t1: 1.9, y0: 0, y1: 2.10, kind: 'door' }],
  },

  /* ---------- corridor ---------- */
  // north side of the corridor, with the records door
  {
    a: [-7, 5.5], b: [0, 5.5], mat: 'cinderblock', h: CEIL_HALL,
    holes: [{ t0: 2.1, t1: 3.05, y0: 0, y1: 2.10, kind: 'door' }],
  },
  // south side, with the break room door
  {
    a: [0, 7.5], b: [-7, 7.5], mat: 'cinderblock', h: CEIL_HALL,
    holes: [{ t0: 3.95, t1: 4.9, y0: 0, y1: 2.10, kind: 'door' }],
  },
  // the west end -- the exterior stair door. It does not open tonight.
  {
    a: [-7, 7.5], b: [-7, 5.5], mat: 'cinderblock', h: CEIL_HALL,
    holes: [{ t0: 0.5, t1: 1.45, y0: 0, y1: 2.10, kind: 'door', locked: true, id: 'exit_door' }],
  },

  /* ---------- break room ---------- */
  { a: [-6, 7.5], b: [-6, 11], mat: 'wallPaint', h: CEIL },
  { a: [-6, 11], b: [-2, 11], mat: 'wallPaint', h: CEIL },
  { a: [-2, 11], b: [-2, 7.5], mat: 'wallPaint', h: CEIL },

  /* ---------- records ---------- */
  { a: [-6, 5.5], b: [-6, 1.8], mat: 'wallPaint', h: CEIL },
  { a: [-6, 1.8], b: [-2, 1.8], mat: 'wallPaint', h: CEIL },
  { a: [-2, 1.8], b: [-2, 5.5], mat: 'wallPaint', h: CEIL },
];

/** Where the player starts the shift: just inside the dispatch room door. */
export const SPAWN = { x: 1.4, z: 6.5, yaw: -1.15 };

/**
 * The dispatch station. Everything that reads or writes this desk -- the
 * seated camera pose, the interactables, the props -- derives from here, so
 * moving the desk moves the whole workstation.
 */
export const DESK = {
  // main run along the north wall
  run: { x0: 2.8, x1: 7.2, z0: 0.34, z1: 1.14, top: 0.74 },
  // return wing coming south toward the room
  wing: { x0: 6.4, x1: 7.2, z0: 1.14, z1: 3.10, top: 0.74 },
  // where the chair sits and where the seated camera goes
  seat: { x: 5.05, z: 2.00, yaw: 0.0 },
  seatEye: 1.24,
  // prop anchors on the desktop
  terminal: { x: 5.05, z: 0.76, yaw: 0.0 },
  keyboard: { x: 5.05, z: 1.34, yaw: 0.0 },
  phone: { x: 3.95, z: 0.95, yaw: 0.30 },
  radio: { x: 6.80, z: 2.05, yaw: -Math.PI / 2 },
  mug: { x: 6.15, z: 1.02, yaw: 0 },
  lamp: { x: 7.00, z: 0.70, yaw: 0 },
  // the service-area map board hangs on the north wall over the desk
  board: { x: 5.05, y: 2.00, z: 0.07, w: 3.9, h: 0.95 },
};
