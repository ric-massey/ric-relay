# Weather Pro as a workstation — plan, not built yet

> **TO DO — soon.** Ric (2026-10-23) asked for this to be saved and worked on "at
> some point in time soon". Nothing here is built. It is the direction for Weather
> Pro (`weather-pro.html`); `DESIGN.md` stays the source of truth for the room, and
> this note extends its §43 ("User-defined dashboards", "Shareable analysis links").
> When a piece of it ships, move it into `README.md` → "Built so far" and tick it
> off in the checklist at the bottom.

The research and recommendation below are as Ric brought them in, lightly
formatted. The checklist at the end is how it would land on this site.

## The recommendation

Build a **customizable weather workstation with optional professional presets**.
Don't build a separate interface for every profession.

The concept already works in shipping products — but there is an opportunity and a
trap: existing products already do this to varying degrees, so the advantage has to
come from making the experience substantially more coherent, accessible or efficient.

## 1. What professionals actually use

| User | Software they use | What they're usually investigating |
|---|---|---|
| Meteorologists | AWIPS, Pivotal Weather | Forecast models, observations, radar, satellite, soundings |
| Storm chasers | RadarScope, Pivotal Weather | Storm structure, rotation, instability, shear, storm movement |
| Pilots | ForeFlight, Aviation Weather Center | Visibility, ceilings, turbulence, icing, winds along flight routes |
| Marine operators | Windy.com, specialist marine systems | Wind, wave heights, swell, storms, marine forecasts |
| Farmers | WeatherLink, agricultural forecasting systems | Rainfall, soil conditions, frost, temperature, growing conditions |
| Utilities & emergency teams | DTN WeatherSentry, NWS products | Lightning, wind, severe weather, affected infrastructure |

These are examples of documented workflows, not a survey of what is most popular.

**A surprising amount of the underlying data overlaps** — radar, observations,
models, satellite, precipitation, temperature, wind. What differs is the question
asked of it. Wind shear: a chaser reads it for tornado potential, a pilot because it
can make flying dangerous, a meteorologist to understand the evolving environment.
Same atmosphere, different workflows — which makes a shared platform attractive.

## 2. Does the customizable approach already work?

- **Windy.com** — the closest general-purpose comparison: many layers, model
  comparisons, favorites, a lot of customization.
- **Pivotal Weather** — model-focused analysis; a reference for how deep Pro's
  model data should go.
- **RadarScope** — specialization done extremely well (detailed radar products).
- **DTN Weather Hub** — configurable dashboards for weather-sensitive industries;
  shows commercial use, doesn't prove demand for a new entrant.
- **NWS AWIPS** — integrates radar, satellite, observations and models in one
  configurable multi-display environment. Evidence that bringing it together is
  genuinely useful to working forecasters.

So the premise is sound.

## 3. How Pro would be built

Three primary areas:

- **Explore** — every tool, organized by **what it measures, not by profession**:
  Radar · Satellite · Models · Soundings · Observations · Lightning · Forecasts ·
  Historical.
- **Workspaces** — saved layouts plus optional presets (Severe Weather, Aviation,
  Forecast Analysis, …).
- **Customize** — add panels, change map layers, arrange charts, synchronize
  timelines, save everything.

Nobody should have to identify as a meteorologist, pilot or chaser to open a
sounding, and **presets never restrict which tools someone can reach**.

### The essential feature: synchronized tools

Open four panels — HRRR, satellite, radar, a sounding. Pick a location: all four
move to it. Change the forecast time: compatible forecast panels follow together,
while observational panels clearly show their **actual observation times**. That is
an analysis environment, not four unrelated widgets.

### A design requirement

In Pro, **model name, run time, valid time and observation timestamp sit beside the
data they describe.** Full provider attribution can live in settings; those
technical details can't — they're essential to reading the data correctly. (This
matches the room's existing rule: every number carries its source and age.)

## 4. Where to start

| Area | When | What |
|---|---|---|
| General forecasting & model analysis | **Build first** | Maps, models, observations, radar, satellite, point forecasts, soundings — the foundation for everything else |
| Severe-weather workspace | **Build early** | Strong test of radar products, soundings, storm reports, synchronized views |
| Custom workspaces | **Build into the foundation** | Save, rearrange, duplicate and share layouts as the tool set grows |
| Specialized professional presets | **Add selectively** | Aviation, marine, agriculture, emergency management need extra data and reliability; validate each before claiming professional suitability |

## 5. Verdict

| Approach | Assessment |
|---|---|
| Completely fixed professional interfaces | Too much duplicated work, too restrictive |
| Only a blank customizable dashboard | Powerful, but makes new users do too much setup |
| **Fully customizable with optional presets** | **The recommendation** |

Don't try to beat ForeFlight at aviation, RadarScope at radar and every ag platform
at once. Make Weather Pro an excellent general meteorological analysis environment
people can shape around their own work.

- **Weather** answers: *"What's happening outside?"*
- **Weather Pro** answers: *"What is happening in the atmosphere, why, and what
  might happen next?"*

The real test isn't which professions to support. It's: **can investigating the
atmosphere feel dramatically easier than opening five websites and switching
between them?** Test that exact experience with Ric's storm-chaser friend before
expanding into a dozen workspaces.

## How it would land here (checklist)

Constraints that still hold: no library or build step (hard rule 4), no place in the
repo (hard rule 1 — saved workspaces store layout, never a location; a visitor's
place stays in their own localStorage, rounded as today), no go/no-go verdicts,
warnings and storm mode stay on both pages, Pro keeps its own dark amber look.

- [ ] A panel model: each existing Pro card (radar, satellite, models, soundings,
      MRMS, lightning, record) wrapped as a panel with a common `setPlace` /
      `setTime` interface
- [ ] One shared place + time bus; forecast panels follow valid time, observation
      panels show their own time and say how far it is from the bus time
      (a first slice is in, 2026-10-23: on the one map, lightning follows the
      frame on screen and a layer switch keeps the moment — `frameTime` in
      `app.js`; README → "the review's eight")
- [ ] Model / run / valid / observed labels on every panel header
- [ ] Explore: the tool list grouped by what it measures
- [ ] Workspaces: save / rename / duplicate in localStorage; share as a link that
      carries layout + time + layers but **no coordinates** unless the visitor
      chooses to include theirs
- [ ] Presets: Forecast Analysis first, then Severe Weather; others only once validated
- [ ] Phone layout: panels stack, sync still works
- [ ] Tests in `test/` for the bus and the share-link (no coordinates leak), added to
      `.github/checks.mjs`
- [ ] Try it with the storm-chaser friend
