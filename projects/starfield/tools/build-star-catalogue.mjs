/* ══════════════════════════════════════════════════════════════════════
   build-star-catalogue.mjs — turns the Bright Star Catalogue into the
   compact form the game ships.

   Scientific Standard §5.3 and §6: a dataset may not enter the repository
   without a recorded transform, and the processing steps have to be
   reproducible from the original. This file *is* that record. It is not
   part of the site's build — the output is committed, and the site remains
   a set of static files with no build step.

   Source
     Bright Star Catalogue, 5th Revised Edition (Hoffleit & Warren 1991)
     VizieR V/50 · http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz
     Retrieved 2026-07-28. The generated file stamps its own date from
     the source file's mtime; this line is about this script's own notes.

   Why this catalogue: it contains essentially every star a dark-adapted
   human eye can see — 9 110 entries, complete to about magnitude 6.5 —
   which is exactly the population Design Bible §15.1 is asking for and no
   more. Gaia has two billion sources; 99.99% of them are invisible to the
   naked eye and would be nine hundred megabytes of nothing to look at.

   Usage:  node tools/build-star-catalogue.mjs <bsc5.dat> <out.js>

   To reproduce from nothing, in one line:

     curl -sSL http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz | gunzip > bsc5.dat

   The raw catalogue is deliberately **not** committed under projects/: that
   tree is the deployed site, and 1.6 MB of fixed-width text nobody fetches
   would be served to every visitor forever. It lives in _project-originals/
   locally, and the command above regenerates it in a second.

   Fixed-width columns used (1-indexed, per the VizieR ReadMe):
     1–4     HR number
     5–14    Bayer / Flamsteed designation
     76–83   RA  hours, minutes, seconds (J2000)
     84–90   Dec sign, degrees, arcminutes, arcseconds (J2000)
     103–107 V magnitude
     110–114 B−V colour index
     128–147 spectral type
     162–166 trigonometric parallax, arcseconds

   Parallax is read but was missing from the first shipped build, and its
   absence turned out to matter: without it a star has a direction and no
   distance, so it can be drawn on a shell and never flown to. Only 100 of
   the 9 146 stars in the sky had a distance for exactly that reason.
   Rebuilt against bsc5.dat with this column included on 2026-07-28, that
   became **3 157** — which is what turns the catalogue from a backdrop
   into a set of places.

   Note the BSC's parallax column is itself patchy and, for the distant
   stars, badly determined — a 20% parallax error is a 20% distance error
   and the catalogue predates Hipparcos. Anything read here is honest about
   being a 1991 measurement; Gaia DR3 is the upgrade path, not a rebuild of
   this file with better intentions.
   ══════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, statSync } from "node:fs";

const [, , inPath, outPath] = process.argv;

if (!inPath || !outPath) {
  console.error("usage: node build-star-catalogue.mjs <bsc5.dat> <out.js>");
  process.exit(1);
}

/* The retrieval date was hard-coded, so every regeneration re-asserted a
   date that was true once. A file whose whole purpose is provenance must
   not do that. Taken from the source file's own modification time — the
   moment it landed on this machine. */
const RETRIEVED = new Date(statSync(inPath).mtime).toISOString().slice(0, 10);

const lines = readFileSync(inPath, "latin1").split("\n");

const stars = [];
let skipped = 0;

for (const line of lines) {
  if (line.length < 110) { skipped++; continue; }

  const raH = line.slice(75, 77).trim();
  const raM = line.slice(77, 79).trim();
  const raS = line.slice(79, 83).trim();
  const decSign = line[83];
  const decD = line.slice(84, 86).trim();
  const decM = line.slice(86, 88).trim();
  const decS = line.slice(88, 90).trim();
  const vRaw = line.slice(102, 107).trim();

  // Entries without a position are novae and other non-stellar records
  // that the catalogue keeps for numbering continuity. They are not stars
  // in the sky and are dropped rather than placed at RA 0.
  if (!raH || !decD || !vRaw) { skipped++; continue; }

  const ra = (Number(raH) + Number(raM) / 60 + Number(raS) / 3600) * 15;
  const dec = (Number(decD) + Number(decM) / 60 + Number(decS) / 3600) *
    (decSign === "-" ? -1 : 1);
  const v = Number(vRaw);

  const bvRaw = line.slice(109, 114).trim();
  const bv = bvRaw === "" ? null : Number(bvRaw);

  const hr = Number(line.slice(0, 4).trim());
  const designation = line.slice(4, 14).trim();

  /* Trigonometric parallax, arcseconds. Blank for most of the faint end,
     and that blank is kept as a blank rather than filled with a guess: a
     star whose distance nobody has measured is a star at an unknown
     distance, and the sky says so instead of placing it somewhere
     plausible. Stored in milliarcseconds to keep it an integer-ish number
     at the precision it is actually known to. */
  const plxRaw = line.length >= 166 ? line.slice(161, 166).trim() : "";
  const plxArcsec = plxRaw === "" ? null : Number(plxRaw);
  const plxMas = plxArcsec !== null && Number.isFinite(plxArcsec) && plxArcsec > 0
    ? plxArcsec * 1000
    : null;

  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(v)) {
    skipped++;
    continue;
  }

  stars.push({ ra, dec, v, bv, hr, designation, plxMas });
}

stars.sort((a, b) => a.v - b.v);

/* Precision is chosen against what can be perceived, not what a float can
   hold (Scientific Standard §6.4):
     · 4 decimal places of degrees is 0.36 arcseconds — the eye resolves 60;
     · magnitudes to 0.01 is below the catalogue's own uncertainty;
     · B−V to 0.01 is likewise finer than it is known.
   Dropping to these saves roughly a third of the file for no visible cost. */
const num = (x, dp) => Number(x.toFixed(dp));

const flat = [];
for (const s of stars) {
  flat.push(
    num(s.ra, 4), num(s.dec, 4), num(s.v, 2), s.bv === null ? 99 : num(s.bv, 2), s.hr,
    // 0 means "not measured", which is a different statement from "far
    // away" and has to survive into the runtime as its own value.
    s.plxMas === null ? 0 : num(s.plxMas, 1)
  );
}

const withParallax = stars.filter((s) => s.plxMas !== null).length;

// Designations only where the catalogue has one. Most bright stars do;
// faint ones fall back to their HR number at runtime, which is still a
// real designation (Design Bible §7.4 — every star has a name).
const names = {};
stars.forEach((s, i) => { if (s.designation) names[i] = s.designation; });

const named = Object.keys(names).length;

const out = `/* ══════════════════════════════════════════════════════════════════════
   stars-bsc.js — the naked-eye sky.

   GENERATED FILE. Do not edit by hand; regenerate with
   tools/build-star-catalogue.mjs, which records the source and transform.

   Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991),
   VizieR V/50. Retrieved ${RETRIEVED}. Positions are J2000 equatorial;
   the game precesses them to the equinox of date at load.

   ${stars.length} stars, complete to roughly magnitude 6.5 — which is to say,
   every star a dark-adapted human eye can see, and almost nothing it
   cannot. ${named} carry a Bayer or Flamsteed designation; the rest are
   identified by their HR number.

   ${withParallax} carry a trigonometric parallax and therefore a distance;
   the rest have a direction and no distance, which is why they are drawn
   on a shell and cannot be flown to. That is a gap in the 1991 catalogue,
   not in the renderer.

   Packed as a flat array of six numbers per star, sorted brightest first:
     ra (deg, J2000), dec (deg, J2000), V magnitude, B−V (99 = unknown),
     HR, parallax in milliarcseconds (0 = not measured)
   ══════════════════════════════════════════════════════════════════════ */
window.SF_STARS_BSC = {
  epoch: "J2000",
  source: "Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991), VizieR V/50",
  retrieved: "${RETRIEVED}",
  count: ${stars.length},
  stride: 6,
  fields: ["ra", "dec", "v", "bv", "hr", "plxMas"],
  names: ${JSON.stringify(names)},
  data: [
${flat.reduce((acc, n, i) => {
    const perLine = 25;
    const sep = (i + 1) % perLine === 0 ? ",\n" : ",";
    return acc + (i % perLine === 0 ? "    " : "") + n + (i === flat.length - 1 ? "" : sep);
  }, "")}
  ],
};
`;

writeFileSync(outPath, out);

const brightest = stars[0];
console.log(`${stars.length} stars written to ${outPath} (${(out.length / 1024).toFixed(0)} KB)`);
console.log(`${skipped} non-stellar or positionless records skipped`);
console.log(`${named} with a Bayer/Flamsteed designation`);
console.log(`brightest: ${brightest.designation || "HR " + brightest.hr} at V=${brightest.v}`);
console.log(`faintest:  V=${stars[stars.length - 1].v}`);
