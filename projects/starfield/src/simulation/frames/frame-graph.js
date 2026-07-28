/* ══════════════════════════════════════════════════════════════════════
   frame-graph.js — reference frames, and the transforms between them.

   Technical Architecture §6.1–§6.2. A position without a frame is invalid
   scientific data (Scientific Standard §6.2), so in this codebase a state
   is always {frame, position, velocity} and converting it is an explicit
   call, never an assumption.

   The rule that matters most, and the one that is easiest to get wrong:
   **changing position without the corresponding velocity basis is a
   critical bug** (§6.2). A frame that rotates or moves changes velocity as
   well as position, and the ω × r term below is exactly that correction.
   Leave it out and the ship gains free energy every time it crosses a
   frame boundary.

   Convention for every node: `at(t)` describes the CHILD frame as seen
   FROM ITS PARENT.

     p     position of the child's origin, in parent axes, metres
     v     velocity of that origin, in parent axes, m/s
     R     rotation taking a vector in PARENT axes to CHILD axes
     omega angular velocity of the child relative to the parent,
           expressed in PARENT axes, rad/s
   ══════════════════════════════════════════════════════════════════════ */

import { add, sub, cross, apply, applyTranspose, IDENTITY, v3 } from "../core/linalg.js";

/** The identity transform — a frame that merely renames its parent. */
export const STATIC = Object.freeze({
  p: Object.freeze(v3()),
  v: Object.freeze(v3()),
  R: IDENTITY,
  omega: Object.freeze(v3()),
});

export class FrameGraph {
  constructor() {
    /** @type {Map<string, {id:string,parent:string|null,label:string,note:string,at:Function}>} */
    this.frames = new Map();
    this._cache = new Map(); // frame id → {t, transform}
  }

  /**
   * @param {object}   def
   * @param {string}   def.id
   * @param {string|null} def.parent
   * @param {string}   def.label     human name, shown in the HUD
   * @param {string}   [def.note]    what this frame is good for
   * @param {Function} [def.at]      (t) → {p,v,R,omega}; omit for a static rename
   */
  register(def) {
    if (this.frames.has(def.id)) throw new Error(`frame '${def.id}' already registered`);
    this.frames.set(def.id, { note: "", at: () => STATIC, ...def });
    return this;
  }

  get(id) {
    const f = this.frames.get(id);
    if (!f) throw new Error(`unknown frame '${id}'`);
    return f;
  }

  /** Cached child-in-parent transform. One entry per frame; time is monotonic. */
  _transform(id, t) {
    const hit = this._cache.get(id);
    if (hit && hit.t === t) return hit.transform;
    const transform = this.get(id).at(t);
    this._cache.set(id, { t, transform });
    return transform;
  }

  /** Root-ward chain of frame ids, starting at `id`. */
  _chain(id) {
    const out = [];
    let cur = id;
    const seen = new Set();
    while (cur !== null && cur !== undefined) {
      if (seen.has(cur)) throw new Error(`frame cycle at '${cur}'`);
      seen.add(cur);
      out.push(cur);
      cur = this.get(cur).parent;
    }
    return out;
  }

  /** Express a state given in a child frame in terms of its parent. */
  _liftToParent(state, t) {
    const { p, v, R, omega } = this._transform(state.frame, t);
    const posInParent = applyTranspose(R, state.position);
    const velInParent = applyTranspose(R, state.velocity);
    return {
      frame: this.get(state.frame).parent,
      position: add(posInParent, p),
      // v_parent = Rᵀv_child + v_origin + ω × r_parent
      velocity: add(add(velInParent, v), cross(omega, posInParent)),
    };
  }

  /** Express a state given in a parent frame in terms of one of its children. */
  _dropToChild(state, childId, t) {
    const { p, v, R, omega } = this._transform(childId, t);
    const rel = sub(state.position, p);
    // v_child = R(v_parent − v_origin − ω × r_parent)
    const relVel = sub(sub(state.velocity, v), cross(omega, rel));
    return {
      frame: childId,
      position: apply(R, rel),
      velocity: apply(R, relVel),
    };
  }

  /**
   * Convert a state between any two registered frames at time `t`.
   * @param {{frame:string, position:{x,y,z}, velocity:{x,y,z}}} state
   * @param {string} targetFrame
   * @param {number} t simulation time (seconds of TT since J2000)
   */
  convert(state, targetFrame, t) {
    if (state.frame === targetFrame) return { ...state };

    const up = this._chain(state.frame);
    const down = this._chain(targetFrame);
    const downSet = new Set(down);
    const meeting = up.find((id) => downSet.has(id));
    if (!meeting) {
      throw new Error(`frames '${state.frame}' and '${targetFrame}' are not connected`);
    }

    let cur = { ...state };
    for (let i = 0; up[i] !== meeting; i++) cur = this._liftToParent(cur, t);

    const descent = down.slice(0, down.indexOf(meeting)).reverse();
    for (const childId of descent) cur = this._dropToChild(cur, childId, t);

    return cur;
  }

  /** Convenience: just the position. */
  convertPosition(position, fromFrame, toFrame, t) {
    return this.convert({ frame: fromFrame, position, velocity: v3() }, toFrame, t).position;
  }

  /**
   * Rotate a direction (no translation, no velocity) between frames.
   * Used for things like "which way is the Sun" where the origin is irrelevant.
   */
  convertDirection(direction, fromFrame, toFrame, t) {
    const a = this.convert({ frame: fromFrame, position: direction, velocity: v3() }, toFrame, t);
    const o = this.convert({ frame: fromFrame, position: v3(), velocity: v3() }, toFrame, t);
    return sub(a.position, o.position);
  }
}

/* ── standard frame builders ─────────────────────────────────────────── */

/**
 * A frame that shares its parent's axes but sits at a moving point in it —
 * a body-centred inertial frame, for example Moon-centred within
 * Earth-centred.
 * @param {Function} stateAt (t) → {position, velocity} of the origin in the parent
 */
export const translatingFrame = (stateAt) => (t) => {
  const s = stateAt(t);
  return { p: s.position, v: s.velocity, R: IDENTITY, omega: v3() };
};

/**
 * A frame that shares its parent's origin but rotates in it — for example
 * Earth-fixed within Earth-centred inertial.
 * @param {Function} orientationAt (t) → {R, omega}
 */
export const rotatingFrame = (orientationAt) => (t) => {
  const o = orientationAt(t);
  return { p: v3(), v: v3(), R: o.R, omega: o.omega };
};
