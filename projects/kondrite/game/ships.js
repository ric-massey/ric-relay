"use strict";

/* KONDRITE — THE SHIPS
   ─────────────────────────────────────────────────────────────────────────────
   The roster, what each hull looks like, and what a boss looks like.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ THE SHIPS ═══════════════════════════════════════════════════════════
   Twenty-five of them, and every one is eight numbers and a silhouette.

     hull    how many hits before the last one
     guns    damage a round, and how fast the rounds come
     cargo   how much material you can carry
     speed   how fast you go
     accel   how hard the drive pushes
     turn    how fast you come about
     drag    how quickly momentum bleeds away

   The spread is the point. A Skiff is a bicycle with a scanner taped to it and
   a Tender is a building; between them every hull is a different answer to
   the same eight questions. Cargo trades against turn, guns trade against
   cargo, and speed, acceleration and drag make different kinds of fast.

   `size` is the hull's radius against the stock 12, and it does three jobs at
   once: how big it draws, how big a target it is, and — see 3.4 — how far the
   camera sits back. A ship that does not fit on the screen would be a ship you
   fly by guesswork, so the camera gives ground instead.

   The art is a polygon in the same space the stock hull uses: nose at +x,
   twelve units to the flank. `fins` are loose strokes over the top, which is
   what makes a panelled ship read as panelled rather than as a wider triangle.
   Drawn rather than described, because a hauler has to be unmistakable from a
   fighter at a glance and a paragraph of stats cannot do that. */
const SHIPS = [
  /* The drawings are not in these rows any more. See `HULL_ART` below. */
  // ── explorers: range, useful holds, and no single way to travel ─────────
  { key: "skiff", name: "SKIFF", category: "EXPLORER", best: "TURN", cost: 0,
    hull: 8, dmg: 0.8, rate: 0.75, cargo: 150, speed: 0.9,
    turn: 0.69, drag: 0.55, shot: 0.78, size: 1,
    note: "the little explorer everybody starts in" },

  // ── sport: tiny holds, hot drives, and very little forgiveness ──────────
  { key: "needle", name: "NEEDLE", category: "SPORT", best: "SPEED", cost: 900,
    hull: 4, dmg: 2.4, rate: 0.85, cargo: 30, speed: 2.2,
    turn: 1.91, drag: 0.26, punch: 7, burst: 1, shot: 1.05, size: 0.86,
    note: "quicker than it is sensible" },

  // ── couriers: acceleration first, because late cargo is worthless ──────
  { key: "kite", name: "KITE", category: "COURIER", best: "ACCEL", cost: 1600,
    hull: 6, dmg: 0.9, rate: 1, cargo: 25, speed: 2.7,
    turn: 1.55, drag: 2.6, spool: 3.4, shot: 0.92, size: 0.94,
    note: "all engine and urgent paperwork" },

  { key: "vane", name: "VANE", category: "SPORT", best: "TURN", cost: 2600,
    hull: 6, dmg: 3.6, rate: 1, cargo: 60, speed: 1.95,
    turn: 1.63, drag: 0.22, punch: 7, burst: 1, shot: 0.95, size: 0.9,
    note: "changes its mind before you do" },

  { key: "mote", name: "MOTE", category: "SPORT", best: "FIRE RATE", cost: 4200,
    hull: 9, dmg: 2.7, rate: 1.2, cargo: 90, speed: 2.05,
    turn: 1.77, drag: 0.3, punch: 7, burst: 1, shot: 1, size: 0.78,
    note: "small enough to mistake for a bad idea" },

  // ── military: armour and guns, with just enough hold for a mission ──────
  { key: "lance", name: "LANCE", category: "MILITARY", best: "PRICE", cost: 3400,
    hull: 14, dmg: 1.6, rate: 0.95, cargo: 50, speed: 1,
    turn: 1, drag: 4, shot: 1.3, size: 1.05,
    note: "a pursuit drive with a gun sight" },

  // ── commuters: quick away from a dock, civil, and easy to live with ─────
  { key: "wedge", name: "HOPPER", category: "COMMUTER", best: "ACCEL", cost: 5200,
    hull: 7, dmg: 0.6, rate: 0.75, cargo: 100, speed: 1.95,
    turn: 0.88, drag: 1.3, spool: 5.5, bite: 0.5, ram: 1, shot: 0.84, size: 1.1,
    note: "made for the short jump between stations" },

  { key: "harrier", name: "SWALLOW", category: "COMMUTER", best: "FIRE RATE", cost: 7600,
    hull: 12, dmg: 0.8, rate: 0.95, cargo: 200, speed: 2.15,
    turn: 0.98, drag: 1.45, spool: 5, bite: 0.45, ram: 1, shot: 0.78, size: 1.06,
    note: "a fast civil hull with teeth" },

  // ── utility: manoeuvrable working hulls with room for the job ───────────
  { key: "cradle", name: "CRADLE", category: "UTILITY", best: "TURN", cost: 9800,
    hull: 40, dmg: 1, rate: 0.85, cargo: 600, speed: 0.62,
    turn: 0.4, drag: 0.1, tough: 1, weapon: "claw", shot: 0.8, size: 1.24,
    note: "gets a work crew into awkward places" },

  /* The one that reads as a TIE without being one: a slab of a cockpit between
     two flat panels, and nothing else. Straight lines only — the silhouette is
     the whole joke and any curve on it would spoil the reference. */
  { key: "louvre", name: "JACKAL", category: "MILITARY", best: "DAMAGE", cost: 74000,
    hull: 26, dmg: 4.2, rate: 1.45, cargo: 75, speed: 1.55,
    /* The top of the military ladder and the most glued-down hull in the
       game. Its heading half-life is six hundredths of a second — point it
       and it is already going that way — which is the feel Ric asked the
       whole class to be built around. It stopped carrying "its old Louvre
       handling, kept exactly" two re-cuts ago; the comment outlived the
       numbers it described, which is the thing this file keeps doing. */
    turn: 1.2, drag: 12, burst: 4, shot: 2.75, size: 1.14,
    note: "four guns between two unmistakable louvers" },

  { key: "spur", name: "SPUR", category: "MILITARY", best: "VALUE", cost: 17000,
    hull: 24, dmg: 2.4, rate: 1.1, cargo: 120, speed: 1.06,
    turn: 1.12, drag: 6, shot: 1.34, size: 1.22,
    note: "a compact strike hull built around the first shot" },

  { key: "runner", name: "RUNNER", category: "COURIER", best: "CARGO", cost: 6400,
    hull: 10, dmg: 0.7, rate: 0.8, cargo: 44, speed: 2.3,
    turn: 1.35, drag: 2.3, spool: 4.2, shot: 0.8, size: 1.16,
    note: "a parcel hold with an engine behind it" },

  { key: "pannier", name: "PANNIER", category: "COMMUTER", best: "CARGO", cost: 11000,
    hull: 24, dmg: 0.72, rate: 0.85, cargo: 300, speed: 2.4,
    turn: 1.1, drag: 1.6, spool: 4.5, bite: 0.4, ram: 1, shot: 0.72, size: 1.34,
    note: "two cabins, two holds, one patient crew" },

  { key: "stride", name: "STRIDE", category: "COURIER", best: "DAMAGE", cost: 19500,
    hull: 12, dmg: 1, rate: 0.9, cargo: 35, speed: 2.5,
    turn: 1.45, drag: 2.45, spool: 3.8, shot: 0.86, size: 1.46,
    note: "the armed dispatch ship for difficult routes" },

  { key: "carrack", name: "CARRACK", category: "EXPLORER", best: "CARGO", cost: 31000,
    hull: 18, dmg: 1.2, rate: 0.95, cargo: 600, speed: 1.15,
    turn: 0.69, drag: 0.55, shot: 0.85, size: 1.62,
    note: "the long survey, done properly" },

  // ── cargo: holds first, with enough ship wrapped around them ────────────
  { key: "drayman", name: "DRAYMAN", category: "CARGO", best: "SPEED", cost: 15000,
    hull: 26, dmg: 0.8, rate: 0.7, cargo: 900, speed: 0.86,
    turn: 0.6, drag: 0.5, spool: 0.6, shot: 0.64, size: 1.7,
    note: "the quick end of moving things for money" },

  { key: "coffer", name: "COFFER", category: "CARGO", best: "DRAG", cost: 26000,
    hull: 40, dmg: 0.9, rate: 0.75, cargo: 1500, speed: 0.76,
    turn: 0.54, drag: 0.48, spool: 0.7, shot: 0.58, size: 1.88,
    note: "a safe with a drive and a great deal of momentum" },

  // ── industrial: armoured working machinery that happens to fly ─────────
  { key: "windlass", name: "WINDLASS", category: "INDUSTRIAL", best: "CARGO", cost: 42000,
    hull: 60, dmg: 1.2, rate: 0.8, cargo: 900, speed: 0.52,
    turn: 0.3, drag: 0.058, tough: 1, weapon: "beam", shot: 0.62, size: 2.05,
    note: "built round the winch" },

  { key: "granary", name: "GRANARY", category: "CARGO", best: "CARGO", cost: 63000,
    hull: 55, dmg: 1, rate: 0.8, cargo: 2400, speed: 0.66,
    turn: 0.48, drag: 0.46, spool: 0.8, shot: 0.52, size: 2.3,
    note: "the largest hold on the civilian register" },

  { key: "bastion", name: "BASTION", category: "MILITARY", best: "BURST", cost: 24000,
    hull: 30, dmg: 2.7, rate: 1.15, cargo: 300, speed: 1.1,
    turn: 1.18, drag: 7, burst: 4, shot: 1.38, size: 1.66,
    note: "armour first and everything else behind it" },

  { key: "reprisal", name: "REPRISAL", category: "MILITARY", best: "HULL", cost: 38000,
    hull: 44, dmg: 3.3, rate: 1.3, cargo: 180, speed: 1.16,
    turn: 1.28, drag: 9.5, shot: 2.5, size: 1.74,
    note: "the answer to whatever fired first" },

  { key: "ironmonger", name: "IRONMONGER", category: "INDUSTRIAL", best: "HULL", cost: 58000,
    hull: 80, dmg: 1.4, rate: 0.75, cargo: 750, speed: 0.38,
    turn: 0.24, drag: 0.045, tough: 1, weapon: "beam", shot: 0.5, size: 1.98,
    note: "a foundry that flies" },

  { key: "revenant", name: "LONGVIEW", category: "EXPLORER", best: "SPEED", cost: 86000,
    hull: 20, dmg: 1.5, rate: 1.1, cargo: 900, speed: 1.6,
    turn: 0.69, drag: 0.55, shot: 0.92, size: 2.6,
    note: "built to make the far edge come closer" },

  { key: "cathedral", name: "GANTRY", category: "INDUSTRIAL", best: "CARGO", cost: 112000,
    hull: 70, dmg: 1.3, rate: 0.78, cargo: 1300, speed: 0.46,
    turn: 0.27, drag: 0.052, tough: 1, weapon: "beam", shot: 0.56, size: 3,
    note: "a mobile yard with engines under it" },

  { key: "ossuary", name: "TENDER", category: "UTILITY", best: "CARGO", cost: 168000,
    hull: 55, dmg: 1.2, rate: 0.9, cargo: 900, speed: 0.78,
    /* Ric flew it and wanted it nearer the gunships: quicker, sharper off the
       mark, and far less adrift. Grip 2.6 puts its heading half-life at a
       quarter of a second — an order of magnitude tighter than the Cradle it
       shares a category with — which is the military feel. It stops a long way
       short of their speed on purpose; it is still a workshop. */
    turn: 0.62, drag: 2.6, tough: 1, weapon: "claw", shot: 0.7, size: 3.5,
    note: "a fleet's workshop, stores and spare hands" }
];

/* ═══ WHAT EACH ONE LOOKS LIKE ═════════════════════════════════════════════
   Ric: "make sure they look like what they should, so its easy to look at them
   and say what type of ship they are". The first set of outlines failed that:
   twenty-five arrowheads of different widths, so a Drayman hauling ore and a
   Reprisal hunting you were the same triangle at two sizes, and the only thing
   that told them apart was the colour of the flag.

   So every category has one mark that nobody else wears, and it is the first
   thing you see:

     CARGO       a small cab on a box, and the box is a grid of containers
     COMMUTER    a rounded cabin with a row of windows down each side
     COURIER     a thin nose on a big split engine block
     SPORT       a long needle, swept tail fins, a racing stripe
     MILITARY    swept wings and gun barrels pointing forward
     INDUSTRIAL  an open throat at the bow where the beam comes out, and a truss
     UTILITY     a blunt push bar across the bow, with the jaws in front of it
     EXPLORER    a sensor mast off the nose with a crossbar on it

   And every hull has windows, placed by who is aboard: one cockpit on a
   fighter, a windscreen on a hauler's cab and nothing down its hold, a
   wheelhouse row across a tug's bow, crew ports along an industrial's flank
   clear of the machinery, an observation bridge on an explorer, and rows of
   them down a commuter, because that one carries people.

   The holds are drawn (`pods`), and filled with what the ship is carrying in
   that material's colour. A laden hauler glows and an empty one is a frame,
   which is most of what a pirate needs to know and is now visible from across
   the screen.

   All of it is in the same space as before: nose at +x, twelve units to the
   flank for the stock hull, scaled by `size`. Each outline stays inside the
   box its old one had, so what a hull collides with barely moves. The outline
   is still the thing that stops you. Fins, guns, pods and windows only
   decorate it.

   `outline` takes the starboard side from nose to tail and mirrors it, and
   `pair` does the same for loose strokes, so nothing here can come out lopsided
   by a typo. */
const flip = p => [p[0], -p[1]];
const outline = (...side) =>
  side.concat(side.slice().reverse().filter(p => p[1] !== 0).map(flip));
const pair = (...segs) =>
  segs.concat(segs.filter(g => g[0][1] || g[1][1]).map(g => [flip(g[0]), flip(g[1])]));
const pairPts = (...pts) => pts.concat(pts.filter(p => p[1]).map(p => [p[0], -p[1], p[2]]));
// A hold is [x, y, w, h]. One that straddles the keel is not doubled.
const pairBox = (...boxes) => boxes.concat(boxes.filter(b => b[1] !== -b[3] / 2)
                                           .map(b => [b[0], -b[1] - b[3], b[2], b[3]]));
// The explorer's mark: a mast off the nose and a crossbar at the end of it.
const mast = (x, len, bar) => [[[x, 0], [x + len, 0]], [[x + len, -bar], [x + len, bar]]];
// The industrial mark: a truss, one X across the body.
const truss = (x0, x1, y) => [[[x0, -y], [x1, y]], [[x0, y], [x1, -y]]];
const HULL_ART = {
  // ── explorers ───────────────────────────────────────────────────────────
  skiff: {
    windows: [[5, 0, 1.3]],
    art: outline([14, 0], [-10, 8], [-6, 0]),
    fins: mast(14, 3, 2),
    pods: pairBox([-5, -2, 6, 4]) },
  carrack: {
    windows: pairPts([12, 1, 1.1], [9, 1.8, 1.1], [6, 2.4, 1.1]),
    art: outline([17, 0], [11, 3], [2, 4], [-6, 6], [-13, 6], [-16, 3]),
    fins: pair([[-4, 6], [-1, 11]], [[-9, 11], [3, 11]]).concat(mast(17, 4, 3)),
    pods: pairBox([-12, -4, 11, 8]) },
  revenant: {
    windows: pairPts([17, 1.2, 1.3], [14, 2, 1.3], [11, 2.8, 1.3], [8, 3.4, 1.3]),
    art: outline([22, 0], [16, 4], [4, 5], [-8, 9], [-17, 9], [-20, 5]),
    fins: pair([[-4, 9], [0, 16]], [[-10, 16], [8, 16]]).concat(mast(22, 5, 4)),
    guns: pairPts([8, 16], [-2, 9]),
    pods: pairBox([-17, -6, 8, 12], [-7, -4, 9, 8]) },

  // ── sport ───────────────────────────────────────────────────────────────
  needle: {
    windows: pairPts([5, 1.6, 1.1]),
    art: outline([17, 0], [-6, 4], [-11, 2]),
    fins: pair([[-2, 4], [-6, 10]], [[12, 0], [-9, 0]]) },
  vane: {
    windows: pairPts([7, 1.8, 1.2]),
    art: outline([18, 0], [2, 5], [-9, 7], [-5, 0]),
    fins: pair([[2, 5], [6, 11]], [[14, 0], [-3, 0]]) },
  mote: {
    windows: pairPts([6, 1.4, 1.1]),
    art: outline([16, 0], [-4, 3], [-9, 6], [-6, 0]),
    fins: pair([[-3, 3], [-8, 9]], [[12, 0], [-4, 0]]) },

  // ── couriers ────────────────────────────────────────────────────────────
  kite: {
    windows: [[10, 0, 1.2], [7, 0, 1.2]],
    art: outline([15, 0], [7, 3], [-3, 3], [-5, 9], [-11, 9], [-11, 0]),
    ribs: [[[-11, 0], [-5, 0]]] },
  runner: {
    windows: [[11, 0, 1.2], [8, 0, 1.2]],
    art: outline([15, 0], [10, 3], [4, 3], [4, 6], [-6, 6], [-8, 8], [-12, 8],
                 [-12, 0]),
    ribs: [[[-12, 0], [-7, 0]]],
    pods: pairBox([-5, -5, 8, 10]) },
  stride: {
    windows: [[13, 0, 1.2], [10, 0, 1.2], [7, 0, 1.2]],
    art: outline([18, 0], [10, 3], [0, 4], [-6, 9], [-14, 9], [-14, 0]),
    fins: pair([[4, 3.5], [0, 8]]),
    ribs: [[[-14, 0], [-7, 0]]] },

  // ── commuters ───────────────────────────────────────────────────────────
  wedge: {
    art: outline([16, 0], [14, 4], [9, 7], [-6, 8], [-11, 5], [-11, 0]),
    guns: pairPts([4, 8]),
    pods: [[-10, -2.5, 5, 5]],
    windows: pairPts([-4, 4.5], [0, 4.5], [4, 4.5], [8, 4]) },
  harrier: {
    art: outline([18, 0], [14, 4], [6, 6], [-4, 6], [-10, 10], [-7, 3], [-9, 0]),
    guns: pairPts([8, 5]),
    pods: [[-6, -2, 6, 4]],
    windows: pairPts([2, 3.5], [6, 3.5], [10, 3]) },
  pannier: {
    art: outline([14, 0], [11, 3], [4, 4], [4, 11], [-10, 11], [-13, 7], [-13, 0]),
    pods: pairBox([-10, 5, 12, 5]),
    windows: pairPts([-6, 2], [-2, 2], [2, 2], [7, 2]) },

  // ── military ────────────────────────────────────────────────────────────
  lance: {
    windows: [[10, 0, 1.5]],
    art: outline([18, 0], [4, 3], [-3, 8], [-8, 8], [-6, 0]),
    guns: pairPts([3, 5.5, 7]),
    ribs: [[[4, 3], [4, -3]]] },
  /* The one that reads as a TIE without being one: a slab of a cockpit between
     two flat panels, and nothing else. Straight lines only. The silhouette is
     the whole joke and any curve on it would spoil the reference. */
  louvre: {
    windows: [[3, 0, 1.6]],
    art: [[9, 0], [3, 5], [-7, 5], [-7, -5], [3, -5]],
    guns: pairPts([5, 6], [-1, 9]),
    fins: pair([[1, 5], [1, 15]], [[-6, 15], [8, 15]], [[-6, 15], [-6, -15]],
               [[8, 15], [8, -15]]) },
  spur: {
    windows: [[13, 0, 1.5]],
    art: outline([20, 0], [12, 2.5], [10, 8], [6, 8], [4, 3], [-6, 3], [-10, 7],
                 [-10, 0]),
    guns: pairPts([9, 6, 7]) },
  bastion: {
    windows: [[12, 0, 1.5], [9.5, 0, 1.5]],
    art: outline([17, 0], [11, 3], [8, 3], [6, 11], [-5, 11], [-8, 6], [-13, 6],
                 [-13, 0]),
    guns: pairPts([6, 6.5, 7], [6, 9.5, 7]),
    ribs: [[[-2, 11], [-2, -11]], [[8, 3], [8, -3]]] },
  reprisal: {
    windows: [[15, 0, 1.6], [12, 0, 1.6]],
    art: outline([20, 0], [12, 3], [12, 14], [4, 14], [-2, 5], [-10, 8], [-14, 4],
                 [-14, 0]),
    guns: pairPts([12, 12, 6], [12, 8, 6]),
    ribs: [[[-6, 6], [-6, -6]]] },

  // ── cargo ───────────────────────────────────────────────────────────────
  drayman: {
    windows: pairPts([10, 1.6, 1.2], [7.5, 2.8, 1.2]),
    art: outline([13, 0], [11, 4], [6, 5], [4, 12], [-14, 12], [-14, 0]),
    pods: pairBox([-12, 1, 7, 9], [-3, 1, 6, 9]) },
  coffer: {
    windows: pairPts([10.5, 1.5, 1.3]),
    art: outline([12, 3], [8, 6], [8, 13], [-15, 13], [-15, 0]),
    ribs: [[[8, 6], [8, -6]]],
    pods: pairBox([-13, 1, 6, 10], [-6, 1, 6, 10], [1, 1, 5, 10]) },
  granary: {
    windows: pairPts([10, 1.8, 1.4], [7.5, 3, 1.4]),
    art: outline([13, 0], [10, 4], [6, 5], [4, 16], [-18, 16], [-18, 0]),
    pods: pairBox([-16, 6, 6, 8], [-9, 6, 6, 8], [-2, 6, 5, 8])
          .concat([[-16, -4, 6, 8], [-9, -4, 6, 8], [-2, -4, 5, 8]]) },

  // ── industrial ──────────────────────────────────────────────────────────
  windlass: {
    muzzles: [[11, 0]],
    windows: pairPts([-13, 10.5, 1.4], [-9, 11, 1.4], [-5, 11.5, 1.4]),
    art: [[14, 4], [14, 10], [6, 14], [-16, 12], [-16, -12], [6, -14],
          [14, -10], [14, -4], [6, -4], [6, 4]],
    fins: [[[6, 0], [11, 0]]].concat(truss(-14, 3, 9)),
    pods: pairBox([-12, 1, 5, 6]) },
  ironmonger: {
    muzzles: [[13, 0]],
    windows: pairPts([-13, 12, 1.5], [-10, 12.5, 1.5]),
    art: [[18, 5], [18, 10], [10, 15], [-12, 15], [-16, 10], [-16, -10],
          [-12, -15], [10, -15], [18, -10], [18, -5], [8, -5], [8, 5]],
    guns: pairPts([4, 12], [-6, 13]),
    fins: [[[8, 0], [13, 0]]].concat(truss(-13, 5, 10)) },
  cathedral: {
    muzzles: [[6, 0]],
    windows: pairPts([-17, 16, 1.8], [-13, 16.5, 1.8], [-9, 17, 1.8]),
    art: [[24, 7], [24, 19], [-16, 19], [-22, 12], [-22, -12], [-16, -19],
          [24, -19], [24, -7], [0, -7], [0, 7]],
    guns: pairPts([-2, 18]),
    fins: [[[0, 0], [6, 0]]].concat(truss(-19, -3, 14),
           pair([[20, 19], [14, 7]], [[12, 19], [6, 7]])),
    pods: pairBox([6, 10, 14, 6]) },

  // ── utility ─────────────────────────────────────────────────────────────
  cradle: {
    windows: [[8, 0, 1.3]].concat(pairPts([8, 3, 1.3], [7.5, 6, 1.3])),
    art: outline([15, 5], [11, 9], [2, 11], [-6, 11], [-9, 7], [-9, 0]),
    ribs: [[[13, 6], [13, -6]]],
    pods: pairBox([-6, 1, 7, 6]) },
  ossuary: {
    windows: [[18, 0, 1.9]].concat(pairPts([18, 4, 1.9], [17, 8, 1.9], [15, 12, 1.9])),
    art: outline([26, 8], [20, 16], [8, 23], [-12, 23], [-24, 14], [-24, 0]),
    ribs: [[[23, 9], [23, -9]]],
    pods: pairBox([-18, 4, 12, 12], [-4, 4, 12, 12]) }
};


/* ═══ WHAT A BOSS LOOKS LIKE ═══════════════════════════════════════════════
   Ric: "the boss ships should look different then normal ships". A boss
   used to be a roster hull drawn bigger, which read as "a big one of those".
   Each now has an outline nothing else in the sector has, and it is drawn
   from what makes it dangerous:

     warlord   a captured warship grown into a pirate fortress: lopsided,
               trophy plating bolted down one side, a ram, and the five
               barrels of its fan across the bow
     corsair   all blade: a long forked nose on two huge burner nacelles
     admiral   a flagship: broad, a command tower, a gun deck down each side
               and the emitters of its screen
     warden    a knight: a small hard core between great diamond wings, a
               missile pod at each wingtip
     queen     a salvage barge: a crescent with her jaws in the bay at the
               front and a hold full of pods

   And how it flies is its own too. Ric: "they shouldnt fly like another
   hull. they should fly similar to those but better. weirder fighting each
   should feel like a completely different experience". So each has its own
   numbers in `BOSS_HANDLING`, and its own way of fighting in `bossFight`. */
const BOSS_ART = {
  warlord: {
    art: [[24, 0], [18, 5], [15, 11], [7, 10], [3, 17], [-6, 15], [-10, 9],
          [-19, 11], [-17, 3], [-21, -3], [-15, -8], [-9, -13], [1, -10],
          [5, -15], [12, -8], [19, -4]],
    guns: [[18, 0, 8], [17, 2.5, 7], [17, -2.5, 7], [15, 5, 6], [15, -5, 6]],
    fins: [[[24, 0], [31, 3]], [[24, 0], [31, -3]], [[3, 17], [-1, 22]],
           [[-6, 15], [-11, 21]], [[-9, -13], [-12, -19]], [[-19, 11], [-25, 13]]],
    ribs: [[[7, 10], [-6, 13]], [[-10, 9], [-10, -10]], [[1, -10], [-9, -11]],
           [[12, -8], [8, 8]]],
    pods: [[-8, 6, 9, 6], [-4, -9, 7, 5]],
    windows: [[10, 0, 1.8]] },
  corsair: {
    art: outline([26, 0], [12, 2.5], [6, 8], [11, 14], [-1, 12], [-8, 5],
                 [-17, 8], [-19, 4], [-15, 0]),
    fins: pair([[-8, 5], [-8, 9]], [[-17, 8], [-24, 8]], [[20, 0], [2, 0]]),
    guns: pairPts([9, 12, 7]),
    windows: [[15, 0, 1.6]] },
  admiral: {
    art: outline([26, 0], [21, 6], [9, 8], [5, 14], [-14, 14], [-18, 9],
                 [-24, 9], [-24, 0]),
    guns: pairPts([12, 7.5, 6], [3, 13, 6], [-5, 13, 6], [-13, 13, 6]),
    fins: [[[2, -4], [2, 4]], [[2, 4], [-8, 4]], [[-8, 4], [-8, -4]],
           [[-8, -4], [2, -4]]].concat(pair([[-18, 9], [-18, 16]], [[-22, 9], [-22, 16]])),
    ribs: [[[16, 7], [16, -7]], [[-18, 9], [-18, -9]]],
    pods: pairBox([-14, 8, 16, 4]),
    windows: [[0, 0, 1.8], [-4, 0, 1.8], [18, 0, 1.5]] },
  warden: {
    art: outline([16, 0], [8, 4], [-8, 5], [-12, 0]),
    fins: pair([[4, 5], [12, 20]], [[12, 20], [-8, 24]], [[-8, 24], [-6, 5]],
               [[2, 12], [-4, 18]]),
    guns: pairPts([10, 3, 7]),
    pods: pairBox([6, 18, 7, 4]),
    windows: [[6, 0, 1.8]],
    muzzles: [[17, 3], [17, -3]] },
  queen: {
    art: outline([8, 0], [10, 7], [26, 10], [20, 20], [4, 24], [-14, 22],
                 [-24, 12], [-26, 0]),
    fins: pair([[26, 10], [30, 5]], [[20, 20], [24, 26]], [[-2, 24], [-2, 30]],
               [[-2, 30], [8, 30]]),
    ribs: [[[8, 0], [-22, 0]]],
    pods: pairBox([-20, 3, 8, 7], [-10, 3, 8, 7], [0, 10, 8, 7], [-20, 12, 8, 6],
                  [-10, 13, 8, 7]),
    windows: pairPts([-6, 20, 1.6], [2, 20, 1.6], [10, 18, 1.6]) }
};
/* Each is its base hull pushed to an extreme, in the direction of the way it
   fights. Speed and turn against the stock hull; drag is grip.

     warlord   fast in a line and slow to turn, with almost no grip: a bull
               that slides past you when it misses and has to come about
     corsair   the fastest thing out there, and glued to where it points
     admiral   slow and stately. It does not need to chase anybody
     warden    turns on a coin, so it can always face you while it strafes
     queen     quicker than a barge has any right to be */
const BOSS_HANDLING = {
  warlord: { speed: 1.55, turn: 0.75, drag: 0.55 },
  corsair: { speed: 2.7,  turn: 2.3,  drag: 2.6, punch: 7 },
  admiral: { speed: 0.8,  turn: 0.6,  drag: 3 },
  warden:  { speed: 1.75, turn: 3.2,  drag: 12 },
  queen:   { speed: 1.05, turn: 0.95, drag: 2 }
};
const bossSpecs = {};
// A boss's hull: the base hull's numbers, the boss's own drawing.
function bossSpec(kind, hull) {
  if (bossSpecs[kind]) return bossSpecs[kind];
  const sp = Object.assign({}, shipSpec(hull), BOSS_ART[kind], BOSS_HANDLING[kind]);
  sp.accel = +(sp.speed * MAX_SPEED * sp.drag / THRUST *
               (sp.punch || SHIP_HEADROOM(sp.drag))).toFixed(3);
  const xs = sp.art.map(p => p[0]);
  sp.noseX = Math.max(...xs);
  sp.tailX = Math.min(...xs);
  const mean = sp.art.reduce((t, pt) => t + Math.hypot(pt[0], pt[1]), 0) / sp.art.length;
  sp.hitR = +(mean * 0.8).toFixed(2);
  sp.muzzles = BOSS_ART[kind].muzzles ||
    (sp.guns ? sp.guns.map(g => [g[0] + (g[2] || 5), g[1]]) : [[sp.noseX, 0]]);
  return (bossSpecs[kind] = sp);
}
// The hull a ship out there is drawn and hit as.
const specOf = t => (t.boss && BOSS_ART[t.boss]) ? bossSpec(t.boss, t.hull) : shipSpec(t.hull);
