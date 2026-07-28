/* ══════════════════════════════════════════════════════════════════════
   star-catalogue.js — assembling the sky from what we actually have.

   Three catalogues, each good at something different:

     · the **Bright Star Catalogue** supplies the sky — 9 096 stars,
       complete to about magnitude 6.5, which is very nearly the exact set
       a dark-adapted eye can see. Positions, magnitudes and B−V colours;
       designations for about a third of them;
     · **stars-near.js** and **stars-bright.js** — the prototype's own
       catalogues — supply what the BSC does not carry in a usable form:
       *proper names* ("Sirius", not "Alp CMa") and *measured distances*.

   So the two are merged by position. A star that appears in both gets its
   name and its distance; a star that appears only in the BSC keeps its
   catalogue designation, which is still a real name (Design Bible §7.4 —
   every star has one, a real designation where one exists).

   Nothing here invents a star. Generation against real galactic structure
   is a Phase 4 problem, and the boundary between catalogued and generated
   has to be visible to the player when it arrives.
   ══════════════════════════════════════════════════════════════════════ */

/** Two stars are the same star if they are this close, in degrees. */
const MATCH_TOLERANCE_DEG = 0.05;

/** Parsecs to light years. */
const PC_TO_LY = 3.2615638;

/**
 * @param {object} bsc    window.SF_STARS_BSC — the packed catalogue
 * @param {Array}  named  the prototype catalogues, concatenated
 * @returns {Array} stars ready for the renderer
 */
export function buildCatalogue(bsc, named = []) {
  const stars = [];

  if (bsc && bsc.data) {
    const { data, stride, names } = bsc;
    /* Parallax arrived in the second build of this file, so the column may
       or may not be there. Read it by field name rather than by a fixed
       offset: a packed file that gains a column should not be able to make
       a reader silently mis-slice the ones it already had. */
    const plxAt = (bsc.fields ?? []).indexOf("plxMas");

    for (let i = 0, n = 0; i < data.length; i += stride, n++) {
      const bv = data[i + 3];
      const plxMas = plxAt >= 0 ? data[i + plxAt] : 0;
      stars.push({
        ra: data[i],
        dec: data[i + 1],
        v: data[i + 2],
        bv: bv === 99 ? null : bv,          // 99 is the catalogue's "unknown"
        hr: data[i + 4],
        // A Bayer or Flamsteed designation where the catalogue has one,
        // otherwise the Harvard Revised number — which is also a real,
        // citable designation, not a placeholder.
        name: names[n] || `HR ${data[i + 4]}`,
        designated: !!names[n],
        // A distance only where a parallax was actually measured. Left
        // undefined otherwise, so "unknown" stays distinguishable from
        // "far" everywhere downstream.
        distanceLy: plxMas > 0 ? (1000 / plxMas) * PC_TO_LY : null,
        source: "bsc",
      });
    }
  }

  /* Fold in proper names and measured distances. The prototype's
     catalogues are small, so a linear scan per entry is fine — this runs
     once, at load. */
  const cosDec = (d) => Math.cos((d * Math.PI) / 180);

  for (const extra of named) {
    if (!Number.isFinite(extra.ra) || !Number.isFinite(extra.dec)) continue;

    let best = null, bestScore = Infinity;
    for (const s of stars) {
      // Cheap separation: right ascension converges toward the poles, so
      // it has to be scaled by cos(declination) before it is compared.
      const dDec = s.dec - extra.dec;
      if (Math.abs(dDec) > MATCH_TOLERANCE_DEG) continue;
      const dRa = (s.ra - extra.ra) * cosDec(extra.dec);
      const sep = Math.hypot(dRa, dDec);
      if (sep > MATCH_TOLERANCE_DEG) continue;

      // Position alone is not enough to identify a star, and Sirius is the
      // proof: Sirius B sits 11 arcseconds from Sirius A and is seven
      // magnitudes fainter. Matching on position alone put the white
      // dwarf's name on the brightest star in the sky. Brightness settles
      // it — two objects at the same place with very different magnitudes
      // are two different components of a binary, not one star.
      const dMag = Number.isFinite(extra.v) ? Math.abs(s.v - extra.v) : 0;
      if (dMag > 2) continue;

      const score = sep / MATCH_TOLERANCE_DEG + dMag;
      if (score < bestScore) { bestScore = score; best = s; }
    }

    const distanceLy = extra.plx > 0 ? (1000 / extra.plx) * PC_TO_LY : null;

    if (best) {
      best.name = extra.name;
      best.properName = true;
      best.distanceLy = distanceLy;
      best.spectralType = extra.sp;
      best.note = extra.note;
    } else {
      // Not in the Bright Star Catalogue at all. That is expected and
      // interesting: most of stars-near.js is red dwarfs, which are the
      // commonest stars in the galaxy and too faint for any of them to be
      // visible to the naked eye. Proxima Centauri is the nearest star to
      // the Sun and you cannot see it without a telescope.
      stars.push({
        ra: extra.ra,
        dec: extra.dec,
        v: extra.v ?? 12,
        bv: null,
        name: extra.name,
        properName: true,
        designated: true,
        distanceLy,
        spectralType: extra.sp,
        note: extra.note,
        source: "near",
      });
    }
  }

  return stars;
}

/** Counts for the sources panel and the loading stages. */
export function summarise(stars) {
  return {
    total: stars.length,
    withProperNames: stars.filter((s) => s.properName).length,
    withDistances: stars.filter((s) => s.distanceLy).length,
    nakedEye: stars.filter((s) => s.v <= 6.5).length,
    brightest: stars.reduce((a, b) => (b.v < a.v ? b : a), stars[0]),
  };
}
