/* ══════════════════════════════════════════════════════════════════════
   shadow.js — how much of the Sun can actually be seen from here?

   Scientific Standard §7.2 asks that one model answer a question for
   everybody. This is that model for a question the slice was previously
   answering twice, and inconsistently: **is it night?**

   The eye model already knew. `WorldService.markOcclusions` puts the Sun
   behind the Earth for a quarter of every orbit, so on the night side
   adaptation opened all the way and the sky came out. The *shaders* did
   not know: every surface was lit by a bare 1/r² irradiance with no test
   for whether anything was in the way, so the station stayed in full
   sunlight while the eye was fully dark-adapted for it — and rendered as a
   clipped white shape against a night sky. Orbital sunset never happened.

   The quantity here is the fraction of the Sun's *disc* that is visible,
   not a shadow/no-shadow flag, and that is not fussiness. Earth's shadow
   has a penumbra because the Sun is half a degree across rather than a
   point, and a station in low orbit takes a second or two to cross it.
   Long enough to see; far too short to fade by hand. A boolean would pop.

   Not modelled, and worth stating (Design Bible §17.4):

     · **The atmosphere.** The real shadow edge is softened and reddened by
       refraction through the air — the reason a totally eclipsed Moon is
       copper rather than black. Here the occluder is the solid body, so
       entry and exit are a fraction of a second early and nothing in the
       umbra is lit at all.
     · **Oblateness.** The shadow is cast by a sphere, not by the 21.4 km
       flattened figure the mesh is drawn with. At LEO that moves the
       terminator crossing by well under a second.
   ══════════════════════════════════════════════════════════════════════ */

import { sub, length, dot } from "../core/linalg.js";

const clamp = (x) => Math.max(-1, Math.min(1, x));

/**
 * Area of the overlap of two circles, given their radii and the distance
 * between their centres. The standard lens area — two circular segments.
 *
 * Used on the sky, in angular measure. That is a planar formula applied to
 * a sphere, which would be a real error if both circles were large; it is
 * not one here because it is only ever *evaluated* while the Sun's rim and
 * the occluder's rim overlap, and the Sun is half a degree across. Over
 * that span the occluder's limb is straight to well under a pixel, however
 * big the occluder is — and Earth from low orbit is 137° of sky.
 */
function lensArea(r1, r2, d) {
  if (d >= r1 + r2) return 0;                       // apart
  if (d <= Math.abs(r1 - r2)) {                     // one inside the other
    const r = Math.min(r1, r2);
    return Math.PI * r * r;
  }
  const a1 = Math.acos(clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)));
  const a2 = Math.acos(clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2)));
  const tri = 0.5 * Math.sqrt(
    Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2))
  );
  return r1 * r1 * a1 + r2 * r2 * a2 - tri;
}

/** Angular radius of a sphere of radius `r` seen from distance `d`. */
function angularRadius(r, d) {
  return d <= r ? Math.PI / 2 : Math.asin(r / d);
}

/**
 * The fraction of the Sun's disc visible from a point, 0…1.
 *
 * 1 is full sunlight, 0 is the umbra, and everything between is the
 * penumbra — which is also, unchanged, what a partial solar eclipse is.
 * The same function answers "is the station in Earth's shadow", "is the
 * Moon eclipsed", and "is the Sun partly covered from here", because those
 * are one question asked about different occluders.
 *
 * @param {{x,y,z}} point          where the observer is, any consistent frame
 * @param {{x,y,z}} sunPosition    the Sun's centre, same frame
 * @param {number}  sunRadius      metres
 * @param {Array<{id:string, position:{x,y,z}, radius:number}>} occluders
 * @returns {{fraction:number, occludedBy:string|null}}
 */
export function sunlitFraction(point, sunPosition, sunRadius, occluders) {
  const toSun = sub(sunPosition, point);
  const sunDistance = length(toSun);
  if (sunDistance === 0) return { fraction: 1, occludedBy: null };

  const sunAng = angularRadius(sunRadius, sunDistance);
  const sunArea = Math.PI * sunAng * sunAng;

  let visible = sunArea;
  let occludedBy = null;

  for (const body of occluders) {
    const toBody = sub(body.position, point);
    const bodyDistance = length(toBody);

    // Standing on it, or inside it: no sunlight reaches here at all.
    if (bodyDistance <= body.radius) return { fraction: 0, occludedBy: body.id };

    // A body further away than the Sun cannot get in front of it. This is
    // the test that keeps the Moon from eclipsing the Sun from the far side
    // of its own orbit.
    if (bodyDistance >= sunDistance) continue;

    const bodyAng = angularRadius(body.radius, bodyDistance);
    const sep = Math.acos(clamp(
      dot(toSun, toBody) / (sunDistance * bodyDistance)
    ));

    const covered = lensArea(sunAng, bodyAng, sep);
    if (covered <= 0) continue;

    // Overlaps are not added up: two occluders covering the same part of
    // the disc would subtract it twice. Taking the largest is exact for one
    // occluder and conservative for the pathological case of two, which in
    // this system means the Moon and the Earth in line — a solar eclipse
    // seen from inside Earth's own shadow, which cannot happen.
    const remaining = sunArea - covered;
    if (remaining < visible) {
      visible = remaining;
      occludedBy = body.id;
    }
  }

  return { fraction: Math.max(0, Math.min(1, visible / sunArea)), occludedBy };
}
