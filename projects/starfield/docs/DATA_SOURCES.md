# Starfield — Data Sources Manifest

> **Status:** Working manifest; sources are *candidates* until verified and recorded<br>
> **Created:** 2026-07-25<br>
> **Governs:** every external dataset, catalogue, texture, and model the project uses.

---

## 1. Purpose

The [Scientific Standard](SCIENTIFIC_STANDARD.md) defines *how* to record a source. This
document is the **actual list**: what the project uses, where it comes from, what licence
it carries, and whether it has been verified.

It exists because a project whose entire premise is "everything is real and honestly
labelled" fails immediately if the data behind it is unsourced, misattributed, or
licensed incompatibly. Licensing in particular tends to dead-end work *late*, after the
code depending on it is written.

> ⚠️ **Every licence statement below is a starting expectation, not a verified fact.**
> Licences change, and many archives host third-party material under different terms than
> the archive itself. **Verify at acquisition time**, record what you actually found, and
> correct this document. Never rely on this file as legal authority.

---

## 2. Rules

### 2.0 Keep this in proportion

**Most of what this project needs is US Government work — NASA, USGS, NOAA — which is
public domain.** There is no copyright to clear and no permission to seek. Crediting the
source is scientific good practice (and NASA asks for it), but it is not a legal hurdle.
For the Earth–Moon slice specifically, **"say where we got it from" genuinely is the
whole obligation.**

The rules below exist for the minority of cases where that is not true: a few convenience
datasets under share-alike terms, and third-party 3D models. Both are avoidable, and the
project avoids both. Do not let §2.1 create the impression that sourcing real data is
fraught — it mostly is not.

**Two things to remember and then stop worrying:**

1. Public domain still gets a credit line — always.
2. **The NASA logo/insignia is restricted** even though NASA's imagery is not. Do not use
   the logo.

### 2.1 Licence compatibility

The repository is **MIT** (Design Bible §17.6). The project is free and nobody is ever
charged, but that does **not** by itself make any third-party asset usable:

> **The repository's licence and an asset's licence are independent questions.** Your
> licence governs what *others* may do with *your* work; it never changes what *you* may
> use. Changing the project's licence would not unlock a single restricted asset, so
> licence choice should be made on its own merits (Design Bible §17.6) and never as a
> workaround.

- **Preferred:** public domain / US Government works (NASA, USGS, NOAA) and permissive
  licences (CC0, CC BY, MIT, BSD).
- **Usable with care:** **CC BY-SA** and other share-alike terms. Share-alike on a *data
  file* generally does not infect MIT-licensed *code*, but it does constrain
  redistribution of that data and its derivatives. Keep such data in clearly-marked
  directories with their licence alongside, and record the obligation.
- **Avoid:** non-commercial-only (CC BY-NC) and no-derivatives (CC BY-ND). Even though
  nothing is sold, these are a poor fit for an open-source repository others may reuse,
  and NC terms are notoriously ambiguous.
- **Never:** unlicensed material, scraped imagery, or anything whose provenance cannot be
  established.

### 2.2 Attribution

**Where to find a licence, in practice.** The pattern is the same on almost every site:
scroll to the **page footer** and look for *Image Use Policy*, *Terms of Use*,
*Copyright*, or *Data Use Policy*. If that fails, search `<site name> image use policy`.

| Source | Where it lives |
|---|---|
| NASA | Footer → "Media Usage Guidelines" / "Images and Media". Each image page also carries a `Credit:` line — copy it verbatim. |
| USGS | Footer → "Copyrights and Credits". |
| ESA / Gaia | Footer → "Terms and Conditions". Gaia specifies exact acknowledgement text to reproduce. |
| ESO | Footer → "Copyright Notice". |
| GitHub-hosted data | `LICENSE` file in the repository root. |
| Any dataset | Its `README` or "Acknowledgements" section usually supplies the citation string to use. |

Capture four things and move on: **the licence text, the credit line, the URL, and the
date retrieved.**

- A repository-level `CREDITS` / `NOTICE` file lists every source and its required
  attribution.
- Attribution is **also reachable in-game**, from the provenance panels and the honesty
  ledger — not buried in a file only developers read.
- **Write the in-game version as content, not compliance** (Design Bible §18.1). Each
  source gets one interesting sentence about *what it gave us* and *which instrument
  measured it* — "the Moon's shape, from a laser altimeter in lunar orbit" — with the
  formal citation underneath for anyone who wants it. The obligation is satisfied as a
  by-product of writing something worth reading.
- NASA material is generally free to use, but **the NASA logo/insignia is restricted**
  and must not be used. NASA also hosts third-party copyrighted material; check per asset.

### 2.3 Acquisition and offline behaviour

- Datasets are **pre-processed and shipped**, not fetched live at runtime, so the game
  works offline (Design Bible §17.1).
- Any optional live fetch (e.g. refreshed ISS elements) must degrade cleanly to the
  shipped copy and be labelled accordingly.
- Record the **retrieval date and version** of every dataset; regenerate reproducibly.
- No scraping, and no bypassing an archive's stated access terms.

### 2.4 Record template

Every dataset gets an entry matching Scientific Standard §5.3:

```yaml
id:            moon-global-dem
name:          LRO LOLA global lunar DEM
provider:      NASA / LRO / LOLA team
url:           <exact source URL>
version:       <product version + retrieval date>
licence:       <as verified at retrieval>
attribution:   <required credit string>
frame:         <reference frame>
units:         <units, explicitly>
resolution:    <native resolution>
uncertainty:   <stated accuracy>
processing:    <what we did to it>
classification: M | C | K | P | A | F
notes:         <caveats, gaps, known issues>
```

---

## 3. Candidate sources by domain

Status legend: **NEEDED** (slice-critical) · **LATER** (post-slice) · **VERIFY** (licence
or suitability unconfirmed).

### 3.1 Solar-system ephemerides — NEEDED

| Candidate | Notes |
|---|---|
| **JPL DE440/DE441** | The reference planetary/lunar ephemeris. US Government work, freely usable. Heavyweight; likely consumed via precomputed subsets rather than full kernels in-browser. |
| **JPL SPICE kernels / Horizons** | Authoritative; good for generating verification fixtures even if not shipped. |
| **VSOP87 / ELP-2000, or Meeus algorithms** | Analytic series, tiny footprint, accuracy adequate for Earth–Moon work. Strong candidate for the shipped runtime with DE440 as the accuracy reference. |
| **JPL "Approximate Positions of the Planets" (Standish)** | **IN USE, 2026-07-28.** Six Keplerian elements plus six rates per planet, fitted 1800–2050, with four extra terms for the giants. A few lines of arithmetic per planet. |

**Decision needed:** shipped analytic model vs. sampled DE440 tables. Either way, DE440
should be the **truth** that regression tests compare against.

**Settled for the planets, 2026-07-28.** The eight major planets are placed by Standish's
approximate elements, for the reason §2.0 gives about proportion: the job is a point of
light in the right place, the fit is good to 10–100″, the eye resolves 60″, and every
planet is an unresolved point from anywhere in the Earth–Moon volume. VSOP87 would cost
thousands of coefficients to move an error nobody can see. Recorded as `SF-L-022`, whose
review condition is the thing that matters: **before any route is allowed to *arrive* at a
planet**, because that is where an arcminute stops being invisible.

One implementation note that is a correctness rule rather than a detail: Earth's own
heliocentric position is taken from **the same element set** as the planets, not from the
Meeus solar series used elsewhere in the ephemeris. Subtracting positions from two
different theories leaves the difference between the theories in the answer, which for
Mars near opposition is larger than either error alone.

### 3.2 Earth — NEEDED

| Need | Candidate | Notes |
|---|---|---|
| Surface imagery | **NASA Blue Marble Next Generation** | Public domain, monthly composites, well-suited to a globe. |
| Night lights | **NASA Black Marble / VIIRS** | For the night side. |
| Elevation | **ETOPO (NOAA)**, **SRTM (NASA/USGS)** | ETOPO global incl. bathymetry; SRTM for land detail. Public domain. |
| Atmosphere model | **US Standard Atmosphere 1976**, **NRLMSISE-00** | Published models, not datasets; implement and cite. NRLMSISE-00 for upper atmosphere. |
| Clouds (optional) | GIBS imagery | Must be labelled as a dated snapshot, not live weather (slice §14). |

### 3.3 Moon — NEEDED

| Need | Candidate | Notes |
|---|---|---|
| Global elevation | **LRO LOLA LDEM** / **SLDEM2015** | The standard global lunar DEM. NASA/USGS, public domain. SLDEM2015 merges LOLA with SELENE data. |
| Imagery | **LROC WAC global mosaic** | NASA/ASU. Verify ASU's terms. |
| Feature names | **IAU/USGS Gazetteer of Planetary Nomenclature** | Authoritative named features. |

Local detail beyond the DEM's resolution is **generated** (`P`) and labelled as such —
this is exactly the measured-global / generated-local split in Bible §7.4 and slice §10.2.

### 3.4 The station — NEEDED

| Need | Candidate | Notes |
|---|---|---|
| Orbit elements | **CelesTrak** or **Space-Track** TLEs; NASA ISS trajectory data | **VERIFY** — Space-Track requires an account and has redistribution terms; CelesTrak has its own usage terms. Cached-by-default is the decided behaviour (Bible §7.3), so redistribution of a shipped snapshot is the thing to check. |
| Propagator | **SGP4** | The standard TLE propagator; well-documented, freely implementable. |
| 3D model | **Built in-house** — decided Ric, 2026-07-25 | **No licence question.** The station is modelled for this project rather than sourced: truss, solar arrays, modules, correct proportions, recognizable silhouette. Ric: "it just has to resemble it, it doesn't have to be super high detailed, it's on a website" — and since docking does not exist, there is breathing room on close-approach detail. Owned outright, MIT-compatible by definition, smaller and faster than a detailed third-party model. |

### 3.5 Stars — LATER (Phase 4), foundational

| Candidate | Notes |
|---|---|
| **Gaia DR3 (ESA)** | The definitive modern catalogue, ~1.8 billion sources. **VERIFY** licence and required acknowledgement. Far too large to ship whole — a magnitude/distance-limited subset is required. |
| **Hipparcos / Tycho-2 (ESA)** | Smaller, bright-star focused, long-standing and easy to work with. |
| **Yale Bright Star Catalogue** | ~9,000 naked-eye stars — matches the naked-eye sky almost exactly (Visual Perception §3.3). |
| **HYG database** | Convenient merged catalogue with positions, magnitudes, names. **VERIFY** — CC BY-SA, so §2.1's share-alike handling applies. |
| Proper names | **IAU Working Group on Star Names** | The authority for official proper names. |

**Decision needed:** the catalogue cutoff — how deep the real catalogue goes before
generated stars take over (Bible §7.4).

#### The distance gap (found 2026-07-28)

The shipped `stars-bsc.js` was packed with **five** fields — ra, dec, V, B−V, HR — and
**no parallax**. The consequence went unnoticed until stars became destinations: a star
without a parallax has a direction and no distance, so it can be drawn on a shell and
never flown to. Of the 9 146 stars in the sky, **100 have a distance** and 9 046 do not,
and those hundred come from the separately-maintained named-star lists rather than from
the BSC packing at all.

`tools/build-star-catalogue.mjs` now reads the parallax column (BSC columns 162–166) and
the runtime reader consumes it **by field name rather than by fixed offset**, so a packed
file that gains a column cannot silently make a reader mis-slice the ones it already had.
Closing the gap needs `bsc5.dat` re-fetched and the catalogue rebuilt — a deliberate act,
not a side effect, and it is not done.

Two cautions for whoever does it. The BSC's parallaxes are **pre-Hipparcos**: patchy, and
badly determined for the distant stars, where a 20% parallax error is a 20% distance
error. And a rebuild would move most of those 9 046 into the "has a position" group, which
makes the gap between the rendered shell and the simulated positions much more visible —
see `SF-L-007`. Gaia DR3 is the real upgrade path; this is the cheap one.

### 3.6 Exoplanets and occurrence rates — LATER

| Need | Candidate | Notes |
|---|---|---|
| Confirmed planets | **NASA Exoplanet Archive** | The reference catalogue. Authoritative, regularly updated, versioned releases. |
| Alternative | **Open Exoplanet Catalogue** | Openly licensed, git-based, easy to consume. |
| Occurrence rates | **Published literature** (Kepler/K2/TESS occurrence-rate studies) | Not a dataset — specific values must be **transcribed with citations**, including their uncertainties (Scientific Standard §9.1). This is the input that makes generated systems statistically honest. |

⚠️ Occurrence rates are an area of **genuine active scientific disagreement**, especially
for habitable-zone terrestrial planets. Record the chosen values, their source, *and*
their stated uncertainty — and surface that uncertainty to the player rather than
presenting one estimate as settled.

### 3.7 Deep sky and the galaxy — LATER

| Need | Candidate | Notes |
|---|---|---|
| Object catalogue | **OpenNGC** | Messier/NGC/IC with modern corrections. **VERIFY** — CC BY-SA. |
| Milky Way panorama | **ESO Gigagalaxy Zoom**, **Gaia sky maps** | ESO material is typically CC BY 4.0. Used for the band's appearance, subject to the desaturation rules in Visual Perception §5. |
| Galactic structure | Published models of disc/bulge/halo and spiral arms | Drives generated star placement (Bible §7.4). |
| Constellation boundaries | **IAU** | For map overlays only, never as physical structure. |

### 3.8 Multi-wavelength data — LATER (instrument filters)

Required by the new instrument-filter feature (Visual Perception §8.1), which **must not**
fake other bands by tinting visible light:

| Band | Candidate survey |
|---|---|
| Near-infrared | **2MASS** |
| Mid/far-infrared | **WISE / AllWISE**, IRAS |
| Ultraviolet | **GALEX** |
| X-ray | **ROSAT all-sky**, Chandra archive |
| Radio / microwave | **NVSS**, **Planck** |
| Narrowband Hα | Public Hα surveys |

Most are NASA/NRAO/ESA archive products and broadly usable, but **each needs individual
verification**. For objects without coverage, the filter reports *no data* rather than
inventing an image.

### 3.9 Planetary textures — LATER

| Candidate | Notes |
|---|---|
| **USGS Astrogeology** planetary maps | Public domain, authoritative, well-documented projections. |
| **NASA/JPL Photojournal** | Public domain imagery; check per-image for third-party content. |

### 3.10 Cockpit art — IN THE REPOSITORY (2026-07-26)

`assets/cockpit/luxury.webp` and `assets/cockpit/console.webp` are the two canopy
photographs ([HUD and Cockpit §2.1](HUD_AND_COCKPIT.md)).

| | |
|---|---|
| **Origin** | Generated by Ric with Google Gemini, 2026-07-25. Originals kept in `docs/UI:cockpit visuals/`. |
| **Processing** | Glass cut to full transparency; the HUD painted into the references inpainted out. |
| **Class** | `F` — fictional. It is a spaceship cockpit; nothing about it is a measurement. |

Recorded here for the same reason as everything else in this file: so nobody has to
guess later where a file came from. Two things are worth stating plainly.

**They are art, not data.** No number is read off them and nothing scientific depends on
them, which is why they are class `F` rather than `M` — and why the readouts painted
into the originals had to be removed rather than kept as decoration.

**The rights position is not the same as for the catalogues.** These are model outputs
rather than a licensed dataset, so §2.1's compatibility question does not really apply —
but neither does the clean provenance the rest of this list has. If the repository ever
needs every asset to carry an unambiguous licence, these are the files to redraw or
replace, and the drawn canopy in `canopy.js` already renders the same cockpit without
them.

The minimum to build the first slice — everything else can wait:

1. **Ephemeris** for Earth, Moon, and Sun (§3.1)
2. **Earth** imagery, night lights, elevation, atmosphere model (§3.2)
3. **Moon** global DEM, imagery, feature names (§3.3)
4. **ISS** orbital elements + propagator + a recognizable model (§3.4)
5. **A bright-star catalogue** for a believable sky — the Yale BSC alone would nearly
   suffice for naked-eye fidelity (§3.5)

That is a **short and achievable list**, and every item on it has a public-domain or
near-public-domain candidate.

### 4.1 What is actually in the repository (Slice A, 2026-07-26)

These are shipped and in use by [`slice.html`](../slice.html). Everything else on the
list above is still outstanding.

| File | Source | Native form | What we did to it | Class | Size |
|---|---|---|---|---|---|
| `assets/textures/earth-color-4096.jpg` | NASA Earth Observatory, **Blue Marble Next Generation**, December 2004 (Reto Stöckli, NASA GSFC) | 5400×2700 JPEG, equirectangular, public domain | Resampled to 4096×2048, JPEG q68 | `M` | 1.4 MB |
| `assets/textures/earth-night-2048.jpg` | NASA Earth Observatory, **Earth at Night 2012**, Suomi NPP / VIIRS day-night band | 3600×1800 JPEG, equirectangular, public domain | Resampled to 2048×1024, JPEG q65 | `M` | 195 KB |
| `assets/textures/moon-color-1024.jpg` | NASA SVS 4720 — **LROC WAC** global colour mosaic (NASA/GSFC/ASU) | 1024×512 JPEG, simple cylindrical, public domain | Unmodified | `M` | 136 KB |
| `assets/textures/moon-ldem-1024.jpg` | NASA SVS 4720 — **LOLA** global elevation model | 1024×512 8-bit greyscale JPEG | Unmodified; mapped to the published global elevation range in the shader | `M` → `K` | 109 KB |
| `assets/textures/milkyway-galactic-1024.jpg` | **ESO GigaGalaxy Zoom** all-sky panorama (ESO/S. Brunier, eso0932a) | 6000×3000 JPEG, galactic coordinates, CC BY 4.0 | Downsampled to 1024×512 so its own point stars average out, leaving the diffuse band; desaturated and tone-mapped in the shader (ledger SF-L-014) | `M` → `A` | 128 KB |
| `data/stars-bsc.js` | **Bright Star Catalogue**, 5th Revised Ed. (Hoffleit & Warren 1991), VizieR V/50 | Fixed-width ASCII, 9 110 records | Parsed by `tools/build-star-catalogue.mjs`; 15 positionless records dropped; packed to ra/dec/V/B−V/HR at display precision | `M` | 346 KB |
| `src/simulation/world/planets.js` | **JPL, Approximate Positions of the Planets** (Standish), SSD | Published table of Keplerian elements and rates, public domain | Transcribed into source, eight planets plus Earth; Kepler solved by Newton–Raphson at runtime | `M` → `C` | 9 KB |
| `vendor/three/` | **Three.js r185.1** | ESM build | Vendored `three.module.min.js`, `three.core.min.js`, `LICENSE` | MIT | 750 KB |

Total shipped payload: **about 3.0 MB**, against the 5 MB budget in Bible §17.5.

Ephemerides are **computed, not shipped** — the Meeus series in
[`ephemeris.js`](../src/simulation/world/ephemeris.js) is a few kilobytes of arithmetic,
which is why decision 1 below is currently answered "analytic" in practice. It should
still be confirmed against DE440 fixtures before it is called settled.

**Two items on the list are deliberately not yet met:**

- **ISS orbital elements.** The slice uses a *representative* orbit instead (ledger
  SF-L-008), because whether a TLE may be redistributed inside this repository is
  decision 5 below, and code must not settle an open decision by picking one.
- **A bright-star catalogue.** The sky currently draws the prototype's 109 catalogued
  stars, which is far short of the naked-eye sky the Design Bible asks for. This is
  blocked on decision 3, not on effort.

---

## 5. Open decisions

| # | Decision |
|---|---|
| 1 | Analytic ephemeris vs. sampled DE440 tables for the shipped runtime (§3.1) |
| ~~2~~ | ~~ISS model sourcing~~ — **resolved 2026-07-25: built in-house** (§3.4) |
| ~~3a~~ | ~~Which catalogue supplies the naked-eye sky~~ — **resolved 2026-07-26: the Yale Bright Star Catalogue** (see below) |
| 3b | Where the catalogue stops and generation takes over — still open, and a Phase 4 question rather than a slice one |
| 4 | Which occurrence-rate study/studies are canonical, and how uncertainty is shown (§3.6) |
| 5 | Whether share-alike data (HYG, OpenNGC) is accepted with the §2.1 handling, or avoided — **still open, and deliberately not settled by the star work**: the BSC was chosen partly because it does not force this question |
| 6 | Texture resolution tiers and total shipped asset budget, against Bible §17.5 |

### Decision record — the naked-eye sky (Ric, 2026-07-26)

**Chosen: the Bright Star Catalogue, 5th Revised Edition** (Hoffleit & Warren 1991,
VizieR V/50) — 9 096 stars with positions, V magnitudes and B−V colours, shipped as
`data/stars-bsc.js` (346 KB).

*Options considered.* **Gaia DR3** is the definitive modern catalogue but has 1.8 billion
sources, of which essentially none are naked-eye; any usable subset is a magnitude cut,
which is the BSC by another route. **HYG** is convenient and merged, but CC BY-SA, which
would have forced decision 5. **Hipparcos/Tycho-2** would work and is ESA-licensed, but is
larger than needed for the same visible result.

*Why.* The BSC contains almost exactly the population Design Bible §15.1 asks for —
complete to about magnitude 6.5, which is the limit of a dark-adapted eye — and almost
nothing else. It is small enough to ship uncompressed, it carries B−V so star colour is a
*measurement* rather than a guess from a spectral-class string, and its licence raises no
question at all.

*What it does not settle.* Nothing about generated stars, catalogue depth beyond naked-eye,
or share-alike data. Those remain 3b and 5.

*Companion data.* The prototype's `stars-near.js` and `stars-bright.js` are retained and
merged by position, because they carry proper names and measured distances the BSC does
not. Matching is by position **and magnitude** — position alone put Sirius B's name on
Sirius. 100 stars gain a proper name and a distance this way.

---

## 6. Verification checklist

Before any dataset enters the repository:

- [ ] Licence read **at the source**, not assumed from this document
- [ ] Licence compatible with an MIT, freely-redistributed repository (§2.1)
- [ ] Required attribution string captured
- [ ] Version and retrieval date recorded
- [ ] Units, reference frame, and epoch explicitly identified
- [ ] Stated uncertainty captured
- [ ] Processing steps reproducible from the original
- [ ] Provenance classification assigned (`M`/`C`/`K`/`P`/`A`/`F`)
- [ ] Entry added to `CREDITS` and surfaced in-game
- [ ] Honesty-ledger entry added if the data is approximated, resampled, or substituted
