# Weather System — Master Design Document

*Product, UX & Technical Master Design Document · Version 1.0 · October 2026*

> **In this repo:** Ric's design document for the weather room, converted from
> the Word original on 2026-10-17 and otherwise unchanged except that the sample
> coordinate in §10.3 and the radar site in Appendix B are placeholders (hard
> rule 1: no coordinates in this repo). It is the source of truth for *what* the
> room becomes. How it is built on this site, what is built so far, and which
> provider answers each question is in [`README.md`](README.md).

> **Decisions since the original (Ric, 2026-10-21):**
> 1. **Two pages, not one.** "A page for what most people want — the forecast,
>    the 10-day — then a tab that is a button that says Pro, and that takes you to
>    Weather Pro, which has all the stuff someone chasing or studying weather
>    wants." This replaces the single-page progressive disclosure of §3 and §42.
>    Weather (`weather.html`) is the everyday page; Weather Pro
>    (`weather-pro.html`) is the map, the soundings, the models. Then, the same day:
>    "like two different products" — so they look like two apps: Weather keeps the
>    sky and opens Pro by a gold ★ Pro badge; Pro is a dark, monospaced, amber
>    instrument laid out as a map workspace. Warnings and storm mode stay on both: a
>    warning has to reach the people who never open Pro.
> 2. **No ride outlook, and no go/no-go verdicts.** "This should be information,
>    not something that could make it unsafe." §21.1's ride verdict was built and
>    removed the same day. The room shows the weather; it does not tell anyone
>    whether it is safe to do something.
> 3. **Raw NOAA data, read in the browser (Ric, 2026-10-22: "do the three", then
>    "do it").** Dual-pol radar at four tilts and the full Level II volume
>    (§11.2), MRMS rotation tracks and hail (§11.3), GOES lightning with flash
>    density and each storm's flash rate and lightning jump (§12), GOES imagery
>    — all sixteen bands, the RGB composites, the mesoscale sectors (§12) —,
>    HRRR / GFS / ECMWF / AIFS model maps with the severe composites, a
>    mesoanalysis from the HRRR's analysis hour, a time-lagged HRRR ensemble for
>    probabilities and the GEFS's mean, spread, spaghetti and chances (§13–14,
>    §17.2), and replay of one radar from the Level II archive come from NOAA's
>    and ECMWF's own files and are
>    decoded in the visitor's browser — no server of ours, nothing stored. This is
>    the backend question §27 raises, answered without one for now; see
>    `README.md`.

> Simple on the surface. Extremely deep underneath.

Purpose: Define the complete product vision and implementation architecture for a weather application that works as a fast, obvious everyday forecast while opening naturally into a serious meteorological analysis environment for radar, models, soundings, observations, severe weather, replay, and 3D visualization.

This master document combines the original product concept with the deeper architectural decisions made afterward. It is intended to be the project source of truth, not a marketing summary.

## Contents

- 1. Executive Summary
- 2. Product Vision and North Star
- 3. Product Principles
- 4. Use-Case Spectrum
- 5. Core Interaction Model
- 6. Location and Time as Global Context
- 7. Information Architecture
- 8. Everyday Home Experience
- 9. Forecast Experience
- 10. Investigative Map
- 11. Radar
- 12. Satellite and Lightning
- 13. Forecast Models
- 14. Model Variable Browser
- 15. Soundings and Hodographs
- 16. Observed vs Forecast Soundings
- 17. Model Comparison and Ensembles
- 18. Cross-Sections and Vertical Analysis
- 19. Surface Observations and Personal Weather Station
- 20. Severe Weather and Official Alerts
- 21. Outdoor and Motorcycle Decisions
- 22. Historical Replay
- 23. 3D Weather Visualization
- 24. Data Sources and Provider Strategy
- 25. Freshness, Latency, and Provenance
- 26. Storage Strategy
- 27. Backend Architecture
- 28. Client Architecture and Rendering
- 29. Data Tiling, Subsetting, and Streaming
- 30. API and Adapter Contracts
- 31. Forecast Verification and Local Correction
- 32. Accuracy Philosophy
- 33. Performance Budgets
- 34. Low-Bandwidth and Offline Behavior
- 35. Reliability and Failure Modes
- 36. Security and Privacy
- 37. Monitoring and Operations
- 38. Implementation Phases
- 39. MVP Definition
- 40. Explicit Non-Goals
- 41. Success Criteria
- 42. Major Product Decisions
- 43. Future Expansion
- 44. Final Product Principle

Note: headings are intentionally explicit so this document can be used as both a product spec and an engineering roadmap.

## 1. Executive Summary

The Weather System is one application with multiple depths. It must be immediately useful to someone who only wants to know whether it is warm, raining, windy, or safe to be outside. The same application must also allow a weather enthusiast to keep drilling into the atmosphere until they are viewing radar products, model fields, a Skew-T, a hodograph, cross-sections, observed stations, forecast disagreement, and eventually volumetric 3D data.

The design rejects the common split between a “simple weather app” and a separate “expert mode.” Instead, it uses progressive disclosure. Simple information is obvious. Advanced information is always nearby. The user gets deeper by investigating the thing they are already looking at.

The technical architecture follows the same principle. The browser receives only the data necessary for the current view. Large GRIB files, full radar volumes, and broad model grids are decoded, normalized, subsetted, tiled, and cached away from the UI thread. Performance is treated as a product requirement, not an optimization to be added later.

The application should be designed so the limiting factor is software quality rather than data access. Serious public meteorological data can support this: operational numerical models, NEXRAD Level-II radar, MRMS mosaics, satellite imagery, lightning products, official alerts, public observations, radiosondes, and a personal weather station can all feed the same system.

## 2. Product Vision and North Star

> “I want to be able to have a weather-model sounding, see local areas, see all the data the model can provide, and have it be smooth and easy to use without causing my PC to have a stroke.”

That sentence is the technical north star for the deep side. The product-level north star is slightly broader:

> “What do I need to know about the weather right now?”

The product succeeds only if both questions can be answered by the same application.

## 3. Product Principles

- Simple first. The first screen should answer everyday weather questions within seconds.
- Progressive depth. Every important surface-level item can be opened into deeper context without forcing a mode switch. *(Superseded 2026-10-21: the depth lives on its own page, Weather Pro, one tap away — see the decisions at the top.)*
- One source of context. Selected location and selected time flow through the entire application.
- Truth over confidence theater. Show observations, model output, age, uncertainty, and source. Do not present derived estimates as measurements.
- Performance is a feature. Large scientific datasets are processed server-side and delivered as small visual or numerical slices.
- Advanced does not mean cluttered. Expert capability should be organized around meteorological questions, not around hundreds of raw variable names.
- The app must remain useful outside. Mobile, poor connectivity, and fast interaction matter because weather is often checked away from a desk.
- 3D is a tool, not the product foundation. Use 3D when vertical structure communicates something that 2D, cross-sections, or soundings cannot.
- Accuracy must be measurable. Any custom weighting or local correction must be verified against observations before being presented as better.

## 4. Use-Case Spectrum

### 4.1 Everyday weather

- What is it like outside?
- What is the high and low?
- Will it rain, and when?
- What is the wind doing?
- Are there alerts?
- What will it be like tonight or tomorrow?

### 4.2 Motorcycle and outdoor decisions

- Can I ride for the next two hours?
- Is rain approaching the route?
- How strong will gusts be?
- Is lightning nearby?
- Will conditions deteriorate before I return?
- What will the weather be along the route at the time I am actually there?

### 4.3 Weather curiosity

- What is that rain cloud doing?
- Is that cell strengthening?
- What does satellite show?
- What are winds aloft doing?
- How is the atmosphere changing vertically?

### 4.4 Severe weather and storm analysis

- What does reflectivity show?
- What does velocity show?
- What do dual-pol products show?
- What is the environmental sounding?
- What does the hodograph look like?
- What are CAPE, CIN, shear, SRH, and other parameters doing?
- Do the models agree?
- Where are official warning polygons?
- How has this storm evolved over the last hour?

### 4.5 Model exploration

- Choose model, run, forecast hour, variable, and level.
- Inspect any point.
- Open a model sounding at that point.
- Compare models at the same valid time.
- Scrub time smoothly.
- Inspect a cross-section through a region or storm environment.

## 5. Core Interaction Model

> See → tap → investigate → go deeper

The user should never have to identify as a beginner or expert. Depth emerges from curiosity. A temperature card can open details. A rain statement can open radar. A radar cell can open advanced products. A point on the map can open a sounding. A sounding can open a hodograph or time evolution.

This structure allows a normal user to stop after one screen while allowing an advanced user to continue without encountering an artificial wall.

## 6. Location and Time as Global Context

### 6.1 Location is the central object

A location can be the user’s current position, home, a saved place, a clicked point, a location along a route, or a storm-centered point. Once selected, every relevant component should use it.

```
Selected location
    ↓
Weather / Radar / Models / Sounding / Satellite / Observations / History
```

### 6.2 Time is the second central object

The application should maintain a concept of selected valid time. Where data types support it, changing the time updates radar, satellite, observations, model fields, soundings, and historical context together.

The system must distinguish clearly between observation time, model initialization time, forecast hour, and valid time.

## 7. Information Architecture

The product contains several major capabilities, but they should not be presented as eight equal buttons competing for attention. The surface UI should remain task-oriented.

| Capability | Primary job | Typical entry point |
|---|---|---|
| Home | Immediate everyday answer | App launch |
| Forecast | Hourly and multi-day evolution | Home |
| Map | Spatial investigation | Home / Radar / Forecast |
| Radar | Current and historical storm structure | Home / Map |
| Satellite | Cloud and convective evolution | Map / Clouds |
| Models | Numerical forecast analysis | Map / Deep detail |
| Sounding | Vertical atmospheric profile | Selected point / Models |
| Observations | Ground truth and nearby stations | Map / Details |
| History | Replay and verification | Deep tools |

## 8. Everyday Home Experience

Home must be understandable at a glance, even if the user knows nothing about meteorology.

```
72°F
Partly cloudy
Feels like 71°

Rain: unlikely for the next 2 hours
Wind: SW 9 mph, gusting 16
Today: 76° / 54°
Alerts: none

[Hourly] [Radar] [10 Day] [Map]
```

### 8.1 Current conditions

- Temperature and feels-like
- Current condition
- Dew point and humidity
- Wind and gusts
- Pressure trend
- Precipitation status
- Visibility when relevant

### 8.2 Immediate future

The next few hours should be more prominent than a generic daily probability. Examples: “Dry for at least 3 hours” or “Rain likely 5:20–6:00 PM.”

### 8.3 Alerts

Active significant alerts should be obvious but should not turn the home page into a wall of warning text. Tapping an alert should open the official polygon, timing, source text, and affected area.

## 9. Forecast Experience

### 9.1 Hourly

The hourly view should emphasize temperature, precipitation timing, wind/gusts, and condition changes. Secondary fields can be expanded.

### 9.2 Multi-day

Provide approximately 7–10 days initially. Deeper views may expose uncertainty, ensemble spread, and model disagreement, but the default daily view should remain clean.

### 9.3 Rain timing

Rain timing is a first-class user question. When data support it, present start/end windows and confidence rather than only a single percentage.

## 10. Investigative Map

The map is the primary spatial workspace. It must remain fast enough that pan, zoom, time scrubbing, and layer changes feel immediate.

### 10.1 Base map

- Roads
- Terrain
- Administrative boundaries
- Optional imagery basemap
- Saved-location markers

### 10.2 Overlays

- Radar
- Satellite
- Lightning
- Surface observations
- Warning polygons
- Temperature
- Dew point
- Wind
- Pressure
- Precipitation
- Cloud cover
- Forecast-model fields

### 10.3 Point inspector

```
Selected point
<lat>° N, <lon>° W

Temperature 71.8°F
Dew point 63.2°F
Wind SW 11 mph
Pressure 1007.8 hPa

[Forecast] [Sounding] [Models] [Nearby observations]
```

## 11. Radar

Radar must eventually be strong enough that an enthusiast can perform real investigation rather than merely watch a colored precipitation animation.

### 11.1 Standard view

- Animated reflectivity
- Play/pause
- Timeline and frame age
- Radar site
- Zoom
- Storm motion overlays where derived responsibly

### 11.2 Advanced single-radar products

- Base reflectivity
- Base velocity
- Storm-relative velocity
- Spectrum width
- Differential reflectivity (ZDR)
- Correlation coefficient (CC)
- Differential phase / KDP-derived products where available
- Elevation tilt selection

### 11.3 Derived and mosaic products

- Composite reflectivity
- Echo tops
- Precipitation estimates
- MRMS mosaics
- Additional operational derived products as appropriate

### 11.4 Cross-sections and beam context

The user should be able to draw a line through a storm and inspect vertical radar structure. Advanced views should also be able to show radar beam height / sampling context because interpretation changes with range from the radar.

### 11.5 Scan freshness

Radar data is not instantaneous. The UI must show observation/scan time and age. If updates stall, stale imagery must be labeled rather than silently shown as current.

## 12. Satellite and Lightning

- Visible imagery
- Infrared
- Water vapor
- Useful derived satellite products
- Lightning overlay / lightning time series
- Animation using the same time-control philosophy as radar

Satellite and lightning are especially important for cloud investigation and convective development before radar signatures become obvious.

## 13. Forecast Models

The Models workspace is the core of the advanced side. The architecture must treat models as adapters rather than hard-coded special cases.

### 13.1 Initial model families

- HRRR
- RRFS / future convection-allowing NOAA systems
- GFS
- ECMWF IFS
- ECMWF AIFS
- Additional regional or ensemble systems later

### 13.2 Required model metadata

Every model visualization must clearly state: model, initialization time, forecast hour, and valid time.

```
HRRR 12Z  |  +07h  |  Valid 19Z
```

### 13.3 Time navigation

Forecast-time scrubbing should be a primary interaction. Neighboring forecast hours should be prefetched so the user can move through time without seeing repeated loading states.

## 14. Model Variable Browser

Variables should be organized by meteorological meaning first, with a raw field browser available for experts.

### 14.1 Surface

- Temperature
- Dew point
- Relative humidity
- Wind
- Gust
- Pressure
- Precipitation
- Snow
- Visibility
- Cloud cover
- Solar radiation

### 14.2 Severe / convection

- CAPE variants
- CIN
- Storm-relative helicity
- Bulk shear
- Updraft helicity
- Reflectivity
- Echo tops
- Other well-defined severe-weather diagnostics

### 14.3 Atmosphere

- Temperature
- Moisture / RH / dew point where available
- Geopotential height
- Wind
- Vertical velocity
- Vorticity
- Cloud water
- Cloud ice
- Rain
- Snow
- Graupel

### 14.4 Clouds and precipitation

- Cloud cover
- Cloud base / top where available
- Precipitation rate
- Accumulated precipitation
- Precipitation type

### 14.5 Raw

Expose every supported field with source naming and units. Raw mode should be searchable and should preserve original variable identifiers where useful.

### 14.6 Atmospheric levels

The level selector adapts to the chosen model and variable. Typical pressure levels include surface, 925, 850, 700, 500, 300, and 250 hPa, with the full supported list available when needed.

## 15. Soundings and Hodographs

Soundings are a first-class product, not a chart bolted onto the side.

### 15.1 Interaction

Click any model-map point and choose “Open Sounding.” The backend extracts the vertical column and returns a compact numerical payload.

### 15.2 Skew-T / Log-P

- Temperature
- Dew point
- Parcel trace
- Pressure levels
- Wind barbs
- Freezing and other key levels

### 15.3 Derived parameters

- SBCAPE
- MLCAPE
- MUCAPE
- CIN
- LCL
- LFC
- EL
- PWAT
- Freezing level
- Wet-bulb zero
- DCAPE
- Lapse rates
- Bulk shear
- Storm-relative helicity

### 15.4 Hodograph

The sounding view should include an interactive hodograph with meaningful depth markers such as 0–1 km, 0–3 km, and 0–6 km. Advanced options can expose storm-motion vectors and alternative calculations.

### 15.5 Time evolution

Dragging forecast time should update both Skew-T and hodograph. This is a signature interaction and should be optimized aggressively.

## 16. Observed vs Forecast Soundings

When radiosonde data is available, support side-by-side or overlaid comparison between observed and model profiles.

- Observed sounding
- Model forecast valid at observation time
- Difference / bias view
- Initialization-quality assessment
- Optional model-to-model sounding comparison

## 17. Model Comparison and Ensembles

### 17.1 Deterministic comparison

- Side-by-side two-panel
- Four-panel
- Difference field
- Point table
- Synchronized valid time

### 17.2 Ensembles

Where ensemble data is available, expose spread and probabilities instead of pretending a single deterministic forecast represents certainty.

- Probability of threshold exceedance
- Spread / percentile range
- Member view when useful
- Calibration and reliability information where available

## 18. Cross-Sections and Vertical Analysis

Cross-sections offer much of the meteorological value of 3D with far less client-side load.

Interaction: click point A, click point B, choose variable. The server extracts a vertical atmospheric slice along the path.

- Temperature / potential temperature
- Equivalent potential temperature
- Relative humidity
- Wind
- Vertical velocity
- Cloud water/ice
- Reflectivity or simulated reflectivity where available

## 19. Surface Observations and Personal Weather Station

### 19.1 Public observations

Nearby METARs, mesonets, and other quality-controlled observations should be visible on the map and available in point detail.

### 19.2 Personal station

The friend’s own weather station should become a first-class source. Its observations should be stored permanently and used for both current conditions and forecast verification.

- Temperature
- Dew point
- Humidity
- Pressure
- Wind speed/direction
- Gusts
- Precipitation
- Solar radiation
- UV
- Additional station-specific sensors

### 19.3 Quality control

- Sanity ranges
- Missing-data detection
- Timestamp validation
- Comparison with nearby stations
- Calibration offsets when justified
- Sensor-anomaly detection

A personal station should not be treated as flawless ground truth by default.

## 20. Severe Weather and Official Alerts

Official warning products must remain authoritative. The application can organize and visualize them, but it should not masquerade as a replacement warning authority.

- Tornado warnings
- Severe thunderstorm warnings
- Flash-flood warnings
- Watch and advisory polygons where appropriate
- Official text and timestamps
- Affected-area mapping
- Clear expiration / replacement handling

Advanced derived guidance may be displayed separately, with source and uncertainty clearly labeled.

## 21. Outdoor and Motorcycle Decisions

> **Removed 2026-10-21 (Ric):** "This should be information, not something that
> could make it unsafe." The room gives no ride outlook and no good/bad verdict on
> any activity. The everyday page's next-3-hours, hourly wind and alerts are the
> information; the decision stays with the person. Kept below as the original
> plan, not as work to do.

The app should answer practical questions without becoming an activity-selector dashboard.

### 21.1 Immediate ride outlook

```
Ride outlook: Good
Next 90 min: dry
Strongest gust: 18 mph
Temperature: 69–74°F
Lightning near route: none
Rain may approach return leg around 6:20 PM
```

### 21.2 Route weather

For a planned route, estimate where the rider will be at each time and sample forecast/observation information along that path. This is more useful than checking unrelated city forecasts.

- Precipitation timing
- Lightning proximity
- Wind and gusts
- Temperature
- Visibility
- Official warnings

Do not claim road-surface conditions unless reliable road-weather data are available.

## 22. Historical Replay

Historical replay turns the application into a learning and post-event analysis tool.

Select a date and time, then reconstruct the best available synchronized view of:

- Radar
- Satellite
- Lightning
- Surface observations
- Official warnings
- Model forecasts that were available at the time
- Observed and model soundings
- Personal weather-station data

The key rule: replay should show what was actually known at that time when the user chooses forecast-reconstruction mode, rather than accidentally using later model runs or revised datasets.

## 23. 3D Weather Visualization

3D is a high-value capability, but it should sit on top of a strong 2D and vertical-analysis foundation.

### 23.1 Appropriate uses

- Volumetric radar
- Storm structure
- Vertical reflectivity
- Pressure / isosurface visualization
- Moisture volumes
- Winds aloft
- Cloud fields
- Terrain interaction

### 23.2 Controls

- Altitude range
- Variable
- Threshold
- Opacity
- Time
- Model
- Vertical exaggeration
- Slice / clipping plane

### 23.3 Performance rule

Never send a full national or global atmospheric cube to the browser. Request only the geographic volume, variable, altitude range, and time currently being inspected. Prefer sparse or multiresolution representations where possible.

## 24. Data Sources and Provider Strategy

The system should combine authoritative public and professional-grade sources behind a common internal model. Exact provider choices may evolve, so provider adapters are mandatory.

| Domain | Likely source class | Use |
|---|---|---|
| Forecasts | NWS + numerical models | Everyday forecast and official forecast context |
| Convection-allowing models | HRRR / successor systems | Short-range detailed U.S. forecast |
| Global models | GFS / ECMWF IFS / AIFS | Longer-range and model comparison |
| Radar | NEXRAD Level-II / Level-III | Detailed single-radar analysis |
| Mosaic radar | MRMS | Regional multi-radar view and derived products |
| Satellite | GOES products | Cloud evolution and environmental context |
| Lightning | GOES GLM / compatible feed | Convective evolution |
| Observations | METAR / mesonet / public obs aggregators | Ground truth |
| Upper air | Radiosondes | Observed vertical profiles |
| Personal station | Station-specific API / local gateway | Hyperlocal observation and verification |

A commercial provider can be added later if it materially improves coverage, latency, convenience, or model access. The architecture should not depend on a single vendor.

## 25. Freshness, Latency, and Provenance

Different weather products have different physical and publication delays. The UI should expose age rather than hiding it.

```
Radar: 1m 14s old
Personal station: 5s old
Satellite: 2m 03s old
HRRR run: initialized 42m ago
NWS forecast: updated 18m ago
```

### 25.1 Required metadata

- Source
- Product
- Observation time
- Initialization time
- Forecast hour
- Valid time
- Received/ingested time
- Age
- Processing status

### 25.2 Stale-data policy

If a data feed stops updating, the system must mark it delayed or stale. Never present old data with a “live” appearance.

## 26. Storage Strategy

Do not duplicate the entire meteorological world. Public archives already store enormous raw datasets. Local storage should exist where it creates speed, reliability, verification, or unique product value.

### 26.1 Permanently store

- Personal weather-station observations
- User preferences and saved places
- Forecast snapshots needed for verification
- Verification metrics
- Local calibration metadata
- Selected historical-event metadata
- Derived local climatology and statistics

### 26.2 Cache temporarily

- Active radar frames / volumes
- Model tiles
- Point columns / soundings
- Cross-sections
- Recent satellite imagery
- Recent model runs
- Popular route samples

### 26.3 Fetch from authoritative archives when needed

- Large historical radar archives
- Full historical model runs
- Broad satellite archives
- Rarely used raw products

### 26.4 Storage tiers

| Tier | Purpose | Typical contents |
|---|---|---|
| Hot | Seconds/minutes access | Current radar, active tiles, current observations |
| Warm | Hours/days | Recent model runs, recent satellite, recent point extractions |
| Cold | Long-term local value | Station history, verification snapshots, replay indexes |
| External archive | Huge rarely accessed raw data | Historical NEXRAD/model/satellite source files |

## 27. Backend Architecture

```
DATA SOURCES
    │
    ├── Models
    ├── Radar / MRMS
    ├── Satellite / Lightning
    ├── Observations / Station
    └── Alerts
           ↓
INGESTION + NORMALIZATION
           ↓
DERIVATION / SUBSETTING / TILE PIPELINE
           ↓
┌──────────────┬──────────────┬──────────────┐
│ Hot cache    │ Database     │ Object store │
│ live tiles   │ metadata/obs │ chunks/files │
└──────────────┴──────────────┴──────────────┘
           ↓
          API
           ↓
       WEB / MOBILE
```

### 27.1 Ingestion responsibilities

- Discover new upstream products
- Download or stream
- Validate timestamps and completeness
- Decode source formats
- Normalize units/coordinates/metadata
- Publish internal availability events

### 27.2 Derivation responsibilities

- Generate visual tiles
- Extract point columns
- Compute soundings and cross-sections
- Generate downsampled multiresolution data
- Calculate approved derived meteorological parameters
- Store verification snapshots

## 28. Client Architecture and Rendering

The browser is a visualization and interaction client, not a scientific-file decoder of last resort.

- GPU-first maps. Use WebGL/WebGPU-capable rendering for dense raster/vector weather layers.
- Workers. Move decoding, interpolation, and secondary computation off the main UI thread when client-side work is necessary.
- Small state graph. Location, valid time, model/run, layer, and selected point should drive the UI predictably.
- Progressive resolution. Show coarse data during rapid navigation, refine when movement stops.
- Memory discipline. Use bounded caches and evict old frames/tiles aggressively.

## 29. Data Tiling, Subsetting, and Streaming

> The browser should never receive the giant source dataset when it only needs one small view.

### 29.1 Map request example

```
HRRR
Variable: temperature
Level: 500 hPa
Forecast: +04h
Bounds: current viewport
Resolution: based on zoom
```

### 29.2 Sounding request

```
Model/run + lat/lon + valid time → vertical column only
```

### 29.3 Cross-section request

```
Model/run + line A→B + valid time + selected variables → vertical slice only
```

### 29.4 Time prefetch

```
+03  [cached]
+04  [displaying]
+05  [prefetch]
+06  [prefetch if bandwidth/memory allow]
```

### 29.5 Request cancellation

If the user changes level or variable rapidly, obsolete requests must be canceled or deprioritized. The application should not spend CPU and bandwidth finishing work the user no longer wants.

## 30. API and Adapter Contracts

External providers should map to stable internal interfaces. The exact implementation language is flexible; the conceptual contract is not.

```
ModelProvider
  getRuns()
  getForecastHours(run)
  getVariables(run)
  getLevels(variable)
  getTile(request)
  getPoint(request)
  getSounding(request)
  getCrossSection(request)

RadarProvider
  getSites()
  getScans(site, timeRange)
  getProduct(site, scan, product, tilt)

ObservationProvider
  getStations(bounds)
  getLatest(station)
  getHistory(station, range)
```

Provider-specific field names, projection systems, URL patterns, authentication, and file formats should remain inside the adapter layer.

## 31. Forecast Verification and Local Correction

The personal station creates a unique opportunity: the system can measure which models actually perform best at a specific location and lead time.

### 31.1 Archive forecast snapshots

Before forecasts expire, store selected point forecasts for relevant variables and lead times.

### 31.2 Verify against observations

- Temperature MAE/RMSE/bias
- Dew-point error
- Wind-speed/direction error
- Precipitation timing
- Probability Brier score
- Threshold-event reliability

### 31.3 Segment performance

- By model
- By lead time
- By season
- By weather regime
- By variable
- By location

### 31.4 Local correction

Only after enough evidence accumulates should the system consider model weighting, bias correction, or local blending. Corrections should be versioned and continuously verified against a simple baseline.

## 32. Accuracy Philosophy

| Type | Meaning | Presentation rule |
|---|---|---|
| Observation | Sensor measurement | Show source/time/QC state |
| Analysis | Best estimate of current atmosphere | Label as analysis; not direct observation |
| Forecast | Numerical or official prediction | Show model/run/valid time |
| Derived product | Calculated from inputs | Show derivation/source lineage |
| Custom forecast | Locally corrected/blended output | Show method/version/confidence; never imply official status |

The system should prefer being explicitly uncertain over pretending to know more than the data support.

## 33. Performance Budgets

Exact targets can change after profiling, but the project should adopt measurable budgets early.

| Interaction | Target experience | Implementation implication |
|---|---|---|
| Open home | Feels immediate | Cached current forecast + skeleton UI |
| Pan/zoom map | 60-ish fps where hardware allows | GPU rendering + tile culling |
| Change model field | First useful image quickly | Low-res tile first, full-res refine |
| Scrub forecast hour | Near-instant adjacent frames | Temporal prefetch |
| Open sounding | Sub-second to a few seconds uncached | Point-column extraction/cache |
| Switch sounding time | Instant or near-instant | Prefetch adjacent columns |
| Radar animation | Smooth playback | Frame caching + bounded memory |

### 33.1 Memory

Do not keep every radar frame, model tile, sounding, and satellite image in memory. Use bounded LRU caches and separate high-value current frames from expendable history.

### 33.2 Bandwidth

Tile resolution should scale with viewport and device pixel density. Mobile clients should receive smaller payloads by default.

## 34. Low-Bandwidth and Offline Behavior

Weather is often checked on rural roads, during outdoor activity, or in storms when cellular networks are stressed. The app should degrade intelligently.

- Cache basemap around current/saved areas
- Cache latest forecast
- Cache active alerts
- Cache recent radar frames
- Optionally cache a selected model region before leaving
- Reduce tile resolution
- Disable aggressive prefetch
- Prioritize warnings and current radar over decorative layers
- Show clear age/freshness indicators

A manual low-bandwidth / chase mode can exist later, but the client should also make automatic choices based on connection quality.

## 35. Reliability and Failure Modes

### 35.1 Feed failure

If one provider fails, other independent sources should continue functioning. The app should not have one monolithic “weather failed” state.

### 35.2 Stale data

```
Radar delayed — last update 8m ago
```

### 35.3 Model gaps

If a model run is missing or late, show the previous run clearly labeled and avoid silently substituting another model.

### 35.4 Station outage

Show last observation age, station status, and fallback surrounding observations.

### 35.5 Partial rendering

If some tiles fail, keep the rest of the map usable and allow retry. Do not blank the entire layer.

## 36. Security and Privacy

- Treat saved home locations as private user data.
- Do not expose personal-station credentials to the client.
- Proxy provider credentials server-side where needed.
- Rate-limit expensive extraction endpoints.
- Validate geographic bounds, variable names, and requested ranges.
- Do not allow arbitrary file/path requests through model adapters.
- Log operational metadata without storing unnecessary precise-location history.

## 37. Monitoring and Operations

The application should monitor the data pipeline itself so stale or broken weather products are detected quickly.

- Upstream feed heartbeat
- Last successful ingest by product
- Processing latency
- Tile-generation errors
- Cache hit rate
- API latency
- Client error rate
- Model-run completeness
- Station heartbeat
- Storage growth
- Verification-job health

A small internal status page should show whether radar, models, satellite, observations, and station feeds are healthy.

## 38. Implementation Phases

### Phase 1 — Excellent normal weather

- Location system
- Current conditions
- Hourly forecast
- Daily forecast
- Rain timing
- Wind
- Alerts
- Basic radar
- Responsive UI

### Phase 2 — Investigation

- Full map
- Animated radar
- Observations
- Satellite
- Point inspector
- Saved locations
- Unified timeline

### Phase 3 — Forecast models

- One serious model first
- Run selection
- Forecast-time slider
- Variables
- Pressure levels
- Tiled rendering
- Point interrogation

### Phase 4 — Soundings

- Skew-T
- Hodograph
- Derived parameters
- Model sounding
- Time animation
- Observed-sounding comparison

### Phase 5 — Advanced meteorology

- Model comparison
- Cross-sections
- Advanced radar products
- MRMS
- Additional models
- Ensembles
- Advanced satellite

### Phase 6 — Personal station and verification

- Station ingestion
- QC
- Forecast archive
- Verification metrics
- Local bias analysis

### Phase 7 — Historical replay

- Synchronized historical radar
- Satellite
- Observations
- Warnings
- Model forecasts
- Soundings

### Phase 8 — 3D

- Regional radar volume
- Vertical clipping
- Limited model volumes
- Multiresolution data
- Only expand after profiling

## 39. MVP Definition

1. Beautiful current weather.
1. Excellent hourly forecast.
1. Daily forecast.
1. Clear rain and wind information.
1. Official alerts.
1. Fast animated radar.
1. Interactive map.
1. Point inspection.
1. One serious forecast model.
1. Model time slider.
1. Model variable and level selection.
1. Model sounding.
1. Smooth performance on ordinary hardware.

That MVP already proves the core idea: a normal weather app that opens directly into real meteorological depth.

## 40. Explicit Non-Goals

- Every weather model on Earth in v1
- Full national historical archives stored locally
- A full global 3D atmosphere as the first advanced feature
- Automatic tornado detection presented as authoritative
- Replacing official warning agencies
- Claiming a custom forecast is better before verification
- Hundreds of unorganized layers
- AI-generated meteorological conclusions with no traceable supporting data
- Client-side decoding of gigantic scientific files simply because it is technically possible

## 41. Success Criteria

| User / system | Success looks like |
|---|---|
| Normal user | Understands current weather within seconds without instructions. |
| Outdoor user | Can decide whether a weather window is suitable and understand the main hazards. |
| Weather enthusiast | Can investigate nearby clouds, storms, radar, satellite, and model evolution without immediately leaving the app. |
| Advanced user | Can access model fields, soundings, hodographs, cross-sections, observations, and radar products quickly enough that it feels like a real tool. |
| Performance | Opening advanced data does not make an ordinary computer feel overloaded. |
| Transparency | Every advanced product makes its source and time context clear. |
| Architecture | Adding a model/provider does not require rewriting the application. |
| Accuracy | Any custom correction is measured and can be compared with a baseline. |

## 42. Major Product Decisions

- ~~No hard beginner/expert mode. Use progressive disclosure.~~ Two pages: Weather for everyone, Weather Pro for the depth, one tap apart (Ric, 2026-10-21).
- Normal weather remains the front door. The deep side must never compromise basic usability.
- Location + valid time are global context. Pages are views of the same weather state, not isolated tools.
- 2D + soundings + cross-sections before 3D. They provide more utility per unit complexity and are easier to keep fast.
- Server-side scientific processing. Browsers render selected products instead of ingesting entire source datasets.
- Store value, not everything. Keep station data, verification snapshots, metadata, and useful cache; rely on authoritative archives for massive raw history.
- Provenance everywhere. Source and age are part of the product.
- Custom forecasting comes later. Verification precedes claims of improvement.

## 43. Future Expansion

> Next up for Weather Pro (2026-10-23): dashboards, synced panels and presets are
> planned in [`WORKSTATION.md`](WORKSTATION.md).

- User-defined dashboards
- Storm-centric tracked workspaces
- Favorites for model fields and sounding parameters
- Saved routes
- Shareable analysis links that preserve location/time/layers
- Collaborative storm-analysis sessions
- Native mobile wrapper if browser/PWA limitations become meaningful
- Additional station integrations
- More ensemble systems
- Terrain-aware local corrections
- Forecast skill maps
- Event catalogs for notable storms
- Optional professional/commercial datasets when they demonstrably improve the product

## 44. Final Product Principle

> Complexity should exist in the system, not in the user’s way.

A person should be able to open the app and see “72° · Partly cloudy” without knowing anything about meteorology.

The same person should be able to keep investigating until the application is showing a specific model run, forecast hour, atmospheric level, model sounding, hodograph, radar velocity, surface observations, warning polygons, cross-sections, and historical verification — without ever feeling like they left the original product.

The finished system should feel deceptively simple because the interface is organized around questions, location, and time. The depth comes from the fact that whenever the user becomes curious about something, there is another layer available.

That is the project: not a simple weather app, not a storm-chasing-only tool, and not a giant meteorology dashboard. It is an everyday weather application whose depth scales with the user.

## Appendix A — Example Interaction Flows

### A.1 “Can I ride?”

```
Open app
→ Home says dry for ~2h, gusts 16 mph
→ Tap hourly if needed
→ Tap radar if rain is nearby
→ Optional route weather for the planned ride
```

### A.2 “What is that rain cloud?”

```
Open app
→ Tap radar
→ Tap cell / location
→ Satellite + lightning
→ Advanced radar products
→ Models / sounding if curious about the environment
```

### A.3 “What is the tornado setup tonight?”

```
Open app
→ Map / models
→ HRRR severe fields
→ Select location
→ Sounding + hodograph
→ Compare models
→ Monitor observations, radar, satellite, lightning, and official warnings
```

### A.4 “Why was the forecast wrong?”

```
History
→ Select date/time
→ Load forecast that was available then
→ Compare with actual station / obs
→ View model sounding vs observed sounding
→ Check verification metrics
```

## Appendix B — Example Data Request Shapes

```
GET /api/model/tile
  model=HRRR
  run=2026-10-17T12Z
  fh=7
  variable=temperature
  level=500hPa
  z/x/y=...

GET /api/model/sounding
  model=HRRR
  run=...
  fh=7
  lat=...
  lon=...

GET /api/radar/frame
  site=KXXX
  product=velocity
  tilt=0.5
  time=...
```

Exact endpoint structure can change. The important principle is that the API carries explicit model/run/time/space context and returns only the requested subset.

## Appendix C — Source-of-Truth Checklist

- Does the normal home screen remain easy?
- Can every advanced layer identify its source and time?
- Can a user select any point and carry it across tools?
- Can time be synchronized across compatible products?
- Does the browser avoid giant raw data downloads?
- Are adjacent model times prefetched?
- Can obsolete requests be canceled?
- Can stale feeds be detected and labeled?
- Is the personal station quality-controlled?
- Are forecast corrections verified before being promoted?
- Can a new model be added through an adapter?
- Does 3D add meteorological value rather than merely spectacle?
