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

### 2.1 Licence compatibility

The repository is **MIT** (Design Bible §17.6). The project is free and nobody is ever
charged, but that does **not** make any asset usable:

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

- A repository-level `CREDITS` / `NOTICE` file lists every source and its required
  attribution.
- Attribution is **also reachable in-game**, from the provenance panels and the honesty
  ledger — not buried in a file only developers read.
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

**Decision needed:** shipped analytic model vs. sampled DE440 tables. Either way, DE440
should be the **truth** that regression tests compare against.

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
| 3D model | **NASA 3D Resources** ISS model | **VERIFY** — NASA 3D Resources are generally usable, but individual models vary and some are third-party. Only a *recognizable* ISS is required (slice §8.1), so a purpose-built low-poly model is a legitimate fallback that sidesteps the issue entirely. |

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

---

## 4. What the Earth–Moon slice actually needs

The minimum to build the first slice — everything else can wait:

1. **Ephemeris** for Earth, Moon, and Sun (§3.1)
2. **Earth** imagery, night lights, elevation, atmosphere model (§3.2)
3. **Moon** global DEM, imagery, feature names (§3.3)
4. **ISS** orbital elements + propagator + a recognizable model (§3.4)
5. **A bright-star catalogue** for a believable sky — the Yale BSC alone would nearly
   suffice for naked-eye fidelity (§3.5)

That is a **short and achievable list**, and every item on it has a public-domain or
near-public-domain candidate.

---

## 5. Open decisions

| # | Decision |
|---|---|
| 1 | Analytic ephemeris vs. sampled DE440 tables for the shipped runtime (§3.1) |
| 2 | Real ISS model vs. purpose-built recognizable model — the licence-free path (§3.4) |
| 3 | Star-catalogue depth and the cutoff where generation takes over (§3.5) |
| 4 | Which occurrence-rate study/studies are canonical, and how uncertainty is shown (§3.6) |
| 5 | Whether share-alike data (HYG, OpenNGC) is accepted with the §2.1 handling, or avoided |
| 6 | Texture resolution tiers and total shipped asset budget, against Bible §17.5 |

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
