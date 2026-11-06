// clusters.mjs -- one connected-component walk over the bond bits, shared by
// census.mjs and collide.mjs.
//
// It lives in its own file for one reason: census.mjs and collide.mjs both
// need it, both are scripts that run on import, and a second copy of a walk
// is a second thing that can disagree with the engine. There is one walker
// and both tools cross-check it against census(w).bondBits.
//
// Rules this file stands under:
//
//   rule 2   no cluster id is written to the world. Identity exists only in
//            the value returned here, for as long as the caller holds it.
//
//   rule 9   "Instruments are not bound by this rule. wave.mjs and the viewer
//            may read the whole world, the way a microscope sees more than a
//            molecule does." This walk reads the whole world. A cluster walk
//            inside the engine was README item 32 and was removed; this is
//            outside it, and nothing in lab.mjs imports this file.

import { neighbour, bindingEnergy, CELLS } from "./lab.mjs";
import { SETTLED, DIRECTIONS } from "./constants.mjs";

export const M = SETTLED.BOND_MODULUS;
export const valenceOf = (k) => k % M;

// Scratch, hoisted so a sample allocates nothing.
const mark  = new Int32Array(CELLS);
const stack = new Int32Array(CELLS);

// Every connected component of >= minSize bonded primitives, plus the totals
// a caller needs to check this walk against the engine's own census().
export function walk(w, minSize = 2) {
  mark.fill(-1);
  const clusters = [];
  let free = 0, occupied = 0, bondsSeen = 0;

  for (let s = 0; s < CELLS; s++) {
    if (w.kind[s] === 0) continue;
    occupied++;
    if (mark[s] !== -1) continue;

    const id = clusters.length;
    let top = 0;
    stack[top++] = s;
    mark[s] = id;
    const members = [];
    let bonds = 0, bSum = 0;

    while (top > 0) {
      const i = stack[--top];
      members.push(i);
      for (let d = 0; d < DIRECTIONS; d++) {
        if (!(w.bonds[i] & (1 << d))) continue;
        const j = neighbour(i, d);
        // Each bond counted once from the lower index -- the convention
        // census() uses for bond potential.
        if (j > i) { bonds++; bSum += bindingEnergy(w.kind[i], w.kind[j]); }
        if (mark[j] === -1) { mark[j] = id; stack[top++] = j; }
      }
    }
    bondsSeen += bonds;

    if (members.length < minSize) {
      // Below the size floor. Unmark so the next cluster does not inherit id.
      free++;
      for (const i of members) mark[i] = -2;
      continue;
    }

    const kinds = members.map((i) => w.kind[i]);
    clusters.push({
      members, bonds,
      size: members.length,
      meanB: bonds ? bSum / bonds : 0,
      species: kinds.map(valenceOf).sort((a, b) => a - b).join("-"),
      kindMin: Math.min(...kinds),
      kindMax: Math.max(...kinds),
      kindMean: kinds.reduce((a, b) => a + b, 0) / kinds.length,
    });
  }
  return { clusters, free, occupied, bondsSeen };
}
