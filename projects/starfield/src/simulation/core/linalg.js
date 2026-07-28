/* ══════════════════════════════════════════════════════════════════════
   linalg.js — the small amount of linear algebra the simulation owns.

   Deliberately NOT three.js. Technical Architecture §2.1: simulation truth
   is not render geometry. Three renders in float32; every number here is a
   JavaScript double, because a metre-accurate position 1 AU from Earth
   needs ~38 bits of mantissa and float32 has 24.

   Vectors are plain {x,y,z} objects. Matrices are row-major length-9
   arrays: [m00,m01,m02, m10,m11,m12, m20,m21,m22].
   Every function is pure; nothing here allocates into a shared scratch.
   ══════════════════════════════════════════════════════════════════════ */

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const neg = (a) => ({ x: -a.x, y: -a.y, z: -a.z });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const length = (a) => Math.hypot(a.x, a.y, a.z);

export function normalize(a) {
  const L = length(a);
  return L > 0 ? scale(a, 1 / L) : v3();
}

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Angle between two vectors, radians. Uses atan2 so it stays accurate near 0 and π. */
export function angleBetween(a, b) {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}

/* ── matrices ───────────────────────────────────────────────────────── */

export const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** Apply a rotation matrix to a vector: R·v */
export function apply(m, v) {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}

/** Apply the transpose (= inverse, for a rotation): Rᵀ·v */
export function applyTranspose(m, v) {
  return {
    x: m[0] * v.x + m[3] * v.y + m[6] * v.z,
    y: m[1] * v.x + m[4] * v.y + m[7] * v.z,
    z: m[2] * v.x + m[5] * v.y + m[8] * v.z,
  };
}

/** Matrix product A·B. */
export function multiply(a, b) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] =
        a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
}

export function transpose(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

export function rotY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

export function rotZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/**
 * Build a rotation whose rows are the given orthonormal basis vectors.
 * Applying it to a vector expresses that vector in the basis.
 */
export function fromBasisRows(ex, ey, ez) {
  return [ex.x, ex.y, ex.z, ey.x, ey.y, ey.z, ez.x, ez.y, ez.z];
}

/** Largest absolute difference between two matrices — for tests. */
export function maxAbsDiff(a, b) {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

/* ── quaternions ─────────────────────────────────────────────────────
   Attitude is a quaternion rather than three Euler angles because the
   ship has six degrees of freedom and no preferred "up". Euler angles
   gimbal-lock — point straight along one axis and two of the three angles
   collapse into the same rotation — and a spacecraft that cannot be
   pointed at its own orbital pole is not a spacecraft.

   Stored as {w, x, y, z} with w the scalar part. */

export const quat = (w = 1, x = 0, y = 0, z = 0) => ({ w, x, y, z });

export const IDENTITY_QUAT = Object.freeze(quat());

/** Rotation of `angle` radians about a unit `axis`. */
export function quatFromAxisAngle(axis, angle) {
  const h = angle / 2;
  const s = Math.sin(h);
  return { w: Math.cos(h), x: axis.x * s, y: axis.y * s, z: axis.z * s };
}

/** Hamilton product: the rotation `b` followed by the rotation `a`. */
export function quatMultiply(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function quatNormalize(q) {
  const n = Math.hypot(q.w, q.x, q.y, q.z) || 1;
  return { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n };
}

export const quatConjugate = (q) => ({ w: q.w, x: -q.x, y: -q.y, z: -q.z });

/** Rotate a vector by a quaternion. */
export function quatRotate(q, v) {
  // t = 2 (q_vec × v);  v' = v + q_w t + q_vec × t
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** The body axes of an attitude, in the parent frame. */
export const quatRight = (q) => quatRotate(q, { x: 1, y: 0, z: 0 });
export const quatUp = (q) => quatRotate(q, { x: 0, y: 1, z: 0 });
/** Spacecraft convention here: the nose looks along −z, as a camera does. */
export const quatForward = (q) => quatRotate(q, { x: 0, y: 0, z: -1 });

/**
 * Integrate an attitude by an angular velocity, expressed in body axes.
 * q̇ = ½ q ⊗ ω, then renormalised — the renormalisation matters, because
 * without it the quaternion slowly stops being a rotation and the ship
 * starts to shear.
 */
export function quatIntegrate(q, omegaBody, dt) {
  const half = { w: 0, x: omegaBody.x * dt * 0.5, y: omegaBody.y * dt * 0.5, z: omegaBody.z * dt * 0.5 };
  const dq = quatMultiply(q, half);
  return quatNormalize({ w: q.w + dq.w, x: q.x + dq.x, y: q.y + dq.y, z: q.z + dq.z });
}

/** Shortest-arc rotation taking unit vector `from` to unit vector `to`. */
export function quatBetween(from, to) {
  const d = dot(from, to);
  if (d > 0.999999) return quat();
  if (d < -0.999999) {
    // Opposite directions: any perpendicular axis will do.
    let axis = cross({ x: 1, y: 0, z: 0 }, from);
    if (length(axis) < 1e-6) axis = cross({ x: 0, y: 1, z: 0 }, from);
    return quatFromAxisAngle(normalize(axis), Math.PI);
  }
  const c = cross(from, to);
  return quatNormalize({ w: 1 + d, x: c.x, y: c.y, z: c.z });
}

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/** Reduce an angle in degrees to [0, 360). */
export function wrapDeg(d) {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}
