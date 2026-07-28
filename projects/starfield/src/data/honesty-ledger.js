/* ══════════════════════════════════════════════════════════════════════
   honesty-ledger.js — what here is not real, and why.

   Scientific Standard §10. The ledger is one half of a matched pair: the
   sources screen answers "what is real, and who measured it", and this
   answers the opposite question. Shipping one without the other would
   undercut the whole promise, so both are in the slice from day one.

   Fields are the ones §10.2 requires. Tone per §10.4: here is what reality
   does, here is what we modelled, here is why — no apologising.
   ══════════════════════════════════════════════════════════════════════ */

export const LEDGER = [
  {
    id: "SF-L-001",
    title: "The Moon is where an analytic series says it is",
    system: "Ephemeris — Moon",
    classification: "approximation",
    reality:
      "The Moon's position is known to centimetres by laser ranging off the retroreflectors " +
      "Apollo and Lunokhod left on the surface.",
    implemented:
      "A 60-term truncation of the ELP-2000/82 lunar theory (Meeus ch. 47), evaluated live " +
      "in the browser.",
    reason:
      "The full JPL DE440 ephemeris is a large binary kernel. The truncated series is a few " +
      "kilobytes of arithmetic and runs on a phone.",
    magnitude:
      "About 10″ in longitude and 4″ in latitude — roughly 20 km of along-track position, " +
      "which is 0.6% of the Moon's own diameter.",
    consequence:
      "None you can see. It matters if you ever want to compare a computed eclipse time " +
      "against a published one to the second.",
    sourceIds: ["meeus"],
    introduced: "2026-07-25",
    status: "accepted",
    review: "Revisit if the game ever needs precise occultation or eclipse timing.",
  },
  {
    id: "SF-L-002",
    title: "UT1 is approximated by UTC",
    system: "Earth rotation",
    classification: "approximation",
    reality:
      "Earth's rotation wanders unpredictably. UT1 tracks the real rotation; UTC is kept " +
      "within 0.9 s of it by inserting leap seconds.",
    implemented: "Greenwich sidereal time is computed from UTC directly.",
    reason:
      "The correction (ΔUT1) is published weekly and would need a network fetch. The game " +
      "must start with no network.",
    magnitude:
      "Up to 0.9 s of rotation — 415 m of surface displacement at the equator.",
    consequence:
      "The point of Earth directly beneath you is named correctly to well under a city. " +
      "It would matter for a surface landing on Earth, which is Phase 2.",
    sourceIds: ["iers2010"],
    introduced: "2026-07-25",
    status: "accepted",
    review: "Before Earth surface landing (Phase 2).",
  },
  {
    id: "SF-L-003",
    title: "Nutation and polar motion are omitted",
    system: "Reference frames",
    classification: "model limit",
    reality:
      "Earth's axis nods by about 9″ over 18.6 years as the Moon drags on the equatorial " +
      "bulge, and the pole itself wanders several metres.",
    implemented:
      "Mean obliquity and mean equinox of date. The leading nutation term is included in the " +
      "Sun's apparent longitude only.",
    reason: "Below the visual threshold for everything the slice does.",
    magnitude: "Up to about 17″ of orientation — 0.005°.",
    consequence: "Invisible.",
    sourceIds: ["meeus", "iers2010"],
    introduced: "2026-07-25",
    status: "accepted",
    review: "If star positions are ever used for precise navigation.",
  },
  {
    id: "SF-L-004",
    title: "TDB is approximated by TT",
    system: "Time",
    classification: "approximation",
    reality:
      "Clocks on Earth's surface run at a slightly different rate from a clock at the solar " +
      "system's barycentre, because both gravity and Earth's orbital motion dilate time. The " +
      "difference oscillates with a 1.7 ms amplitude over a year.",
    implemented: "The ephemeris series are evaluated with TT where they strictly want TDB.",
    reason: "1.7 ms of time error moves the Moon about 2 mm.",
    magnitude: "≤ 1.7 ms.",
    consequence: "None. Recorded because it is a real physical effect, not a rounding.",
    sourceIds: ["meeus"],
    introduced: "2026-07-25",
    status: "accepted",
    review: "Never, realistically.",
  },
  {
    id: "SF-L-005",
    title: "The Moon's physical libration is not modelled",
    system: "Lunar orientation",
    classification: "model limit",
    reality:
      "The Moon genuinely wobbles on its axis as well as appearing to rock because of its " +
      "elliptical orbit. The physical part is small; the optical part is large.",
    implemented:
      "IAU 2009 mean rotation expressions with the periodic libration terms dropped. Optical " +
      "libration is fully present, because it comes from the orbit, which is modelled.",
    reason: "The dropped terms are a long table for an effect you cannot see.",
    magnitude: "Up to 0.03° in the pole and 0.13° in the prime meridian.",
    consequence:
      "You still see the 59% of the surface that optical libration reveals. Named surface " +
      "features are placed to within a few kilometres.",
    sourceIds: ["iau_wgccre"],
    introduced: "2026-07-25",
    status: "accepted",
    review: "Before named lunar features are placed for landing targets.",
  },
  {
    id: "SF-L-006",
    title: "Earth's daylight side is a cloud-free composite, not live weather",
    system: "Earth appearance",
    classification: "model limit",
    reality: "Earth is about two-thirds covered in cloud at any moment, and it moves.",
    implemented:
      "NASA Blue Marble Next Generation, December 2004 — a month of MODIS passes with every " +
      "cloud removed, at 2048×1024.",
    reason:
      "Live cloud imagery needs a network and a tiling service. The game must work offline, " +
      "and a dated snapshot pretending to be live would be worse than an honest composite.",
    magnitude: "All weather. The land and ocean beneath it are real.",
    consequence:
      "The Earth below you is unnaturally clear, and its seasons are December's. Snow and " +
      "vegetation are wrong for any other month.",
    sourceIds: ["blue_marble"],
    introduced: "2026-07-25",
    status: "accepted",
    review: "If a labelled, dated cloud layer is added.",
  },
  {
    id: "SF-L-007",
    title: "The star field is drawn at infinity",
    system: "Sky rendering",
    classification: "presentation aid",
    reality:
      "Every star is at a real, finite distance, and Design Bible §7.4 says every one of them " +
      "is somewhere you can go. There is no skybox in the finished game.",
    implemented:
      "For this slice the catalogued stars are *rendered* on a distant shell using their real " +
      "directions and magnitudes, with no parallax. Amended 2026-07-28: the shell is now only " +
      "a rendering choice. In the simulation, every star with a measured parallax has a real " +
      "three-dimensional position, can be selected, and can be routed to — 100 of the 9 146 " +
      "in the shipped sky. The other 9 046 have a direction and no distance, because the 1991 " +
      "catalogue this sky is built from did not carry one for them.",
    reason:
      "The whole Earth–Moon slice fits inside a 400 000 km box. The nearest star is 100 " +
      "million times further away, so drawing the sky with parallax would cost exactly as " +
      "much and look exactly the same.",
    magnitude:
      "Maximum parallax across the entire playable volume of this slice: about 0.002″ for " +
      "Proxima Centauri. Human visual acuity is 60″. So the rendering error is zero to any " +
      "observer, and stays zero until the ship leaves the solar system.",
    consequence:
      "The sky you look at and the sky you navigate by are now two representations of the " +
      "same catalogue, and they agree about direction while only one of them knows distance. " +
      "That is safe at this scale and stops being safe the moment the ship can actually cross " +
      "a light year — at which point the shell has to go rather than be stretched. The seam " +
      "is `SkyView.build()`; nothing else assumes it.",
    sourceIds: ["bsc", "hipparcos"],
    introduced: "2026-07-25",
    status: "accepted",
    review:
      "When interstellar flight arrives, or sooner if the catalogue is rebuilt with the " +
      "parallax column — that would move most of the 9 046 into the first group and make the " +
      "gap between the two representations much more visible.",
  },
  {
    id: "SF-L-008",
    title: "The observation point is a representative low orbit, not the ISS",
    system: "Start state",
    classification: "approximation",
    reality:
      "The ISS is a real object with a published, constantly updated orbit, and Design Bible " +
      "§7.3 says the game should ship recent cached elements for it.",
    implemented:
      "A representative circular orbit at ISS altitude and inclination, propagated with J2 " +
      "nodal regression. It is labelled 'representative' everywhere it appears.",
    reason:
      "Which element source may be redistributed with an open-source repository is still an " +
      "open question in the data-sources manifest. Rather than settle it by writing code, the " +
      "slice takes fallback option 3 from the vertical-slice spec and says so.",
    magnitude:
      "The orbit is the right size, shape and inclination; the station is not at the phase " +
      "the real one is at.",
    consequence:
      "Earth looks exactly as it should from 420 km. You are not looking at where the real " +
      "ISS is right now, and the HUD says so.",
    sourceIds: [],
    introduced: "2026-07-25",
    status: "provisional",
    review: "When the TLE redistribution question in Data Sources §5 is resolved.",
  },
  {
    id: "SF-L-009",
    title: "Atmospheric scattering is analytic, not a full radiative transfer",
    system: "Earth atmosphere",
    classification: "approximation",
    reality:
      "Sky colour is the sum of light scattered along every path through a stratified " +
      "atmosphere, with multiple scattering, ozone absorption and aerosols.",
    implemented:
      "Single-scattering Rayleigh with an exponential density profile and a Rayleigh phase " +
      "function, evaluated per pixel; wavelength dependence from the real 1/λ⁴ law.",
    reason: "A full transfer solve is not affordable on a phone at 30 fps.",
    magnitude:
      "The limb is slightly less bright and slightly less orange near the terminator than " +
      "reality.",
    consequence:
      "The blue line of the atmosphere is the right colour, the right thickness and in the " +
      "right place. Its brightness gradient is approximate.",
    sourceIds: [],
    introduced: "2026-07-25",
    status: "accepted",
    review: "If Earth atmospheric entry ships (Phase 2).",
  },
  {
    id: "SF-L-010",
    title: "Object markers are larger than the objects",
    system: "HUD",
    classification: "presentation aid",
    reality: "From low Earth orbit the Moon is half a degree across and the stars are points.",
    implemented:
      "Selectable markers have a minimum on-screen size and a hit area larger than the drawn " +
      "object.",
    reason: "You cannot click a body that is one pixel wide, and real scale is not negotiable.",
    magnitude: "Marker rings only. No object's geometry, position or size is changed.",
    consequence:
      "Targets stay clickable at real scale. The ring is visibly an overlay, never mistaken " +
      "for the object.",
    sourceIds: [],
    introduced: "2026-07-25",
    status: "accepted",
    review: "Never — this is the mechanism the design chose instead of enlarging bodies.",
  },
  {
    id: "SF-L-011",
    title: "Dark adaptation is estimated, not measured from the frame",
    system: "Exposure",
    classification: "approximation",
    reality:
      "The eye's dynamic range is about 14 orders of magnitude across adaptation states but " +
      "only 3–4 at any one of them, and moving between them takes minutes.",
    implemented:
      "Scene luminance is estimated analytically from what is in view — the Sun, the sunlit " +
      "fraction of Earth and its angular size, plus a disability-glare term for bright " +
      "sources just outside the frame — and exposure chases it at 12 orders of magnitude per " +
      "second toward dark and 40 toward bright. Adaptation is also capped at the brightest " +
      "state the eye reaches, because you cannot adapt to the Sun.",
    reason:
      "Reading the framebuffer back each frame to measure luminance stalls the GPU pipeline " +
      "on exactly the mobile hardware the game has to run on. The rate is Ric's call of " +
      "2026-07-28 — \"I need it to adjust almost instantly\" — and the reasoning is that a " +
      "six-second curve is not experienced as an eye adjusting at all. It is experienced as " +
      "the renderer being slow, which attributes the effect to the wrong thing and so buys " +
      "no realism at any price.",
    magnitude:
      "Time is compressed about 4 000×: real dark adaptation crosses four orders of magnitude " +
      "in 20–30 minutes, and this crosses the same range in about a third of a second. The " +
      "curve's shape and its asymmetry are real; its rate is not, and the luminance driving " +
      "it is an estimate rather than a measurement.",
    consequence:
      "Turn away from a sunlit Earth and the stars are there almost at once; look back and " +
      "they are gone faster still. Both of those happen in reality, and the ordering and the " +
      "asymmetry are faithful — only the clock is much faster. The cost is that the slow tail " +
      "of real dark adaptation, the part that takes twenty minutes and is why observers sit " +
      "in the dark before observing, is not represented at all.",
    sourceIds: [],
    introduced: "2026-07-25",
    status: "accepted",
    review: "If a compute-shader luminance histogram becomes affordable.",
  },
  {
    id: "SF-L-014",
    title: "The Milky Way is a photograph, desaturated back toward what an eye sees",
    system: "Sky — the diffuse band",
    classification: "presentation aid",
    reality:
      "The Milky Way is the unresolved light of a hundred billion stars, crossed by dust. To " +
      "a dark-adapted eye it is genuinely bright and almost completely colourless — silver " +
      "and grey, not the coloured band of a long exposure.",
    implemented:
      "ESO's GigaGalaxy Zoom all-sky panorama, downsampled hard so its own point stars average " +
      "away and only the diffuse structure survives, then desaturated to 12% of its original " +
      "colour and tone-mapped with a pedestal and a compressive knee. The catalogued stars are " +
      "drawn on top of it as real point sources.",
    reason:
      "There is no measured all-sky surface-brightness map small enough to ship, and a " +
      "generated band would be invention where a measurement exists.",
    magnitude:
      "The structure, the dust lanes and the brightness gradient toward Sagittarius are real " +
      "and correctly placed in galactic coordinates. The absolute surface brightness is set " +
      "to look right rather than measured, and almost all colour has been removed.",
    consequence:
      "The band appears as the eye dark-adapts and is invisible in daylight, which is correct. " +
      "It is a photograph underneath, which is why its colour is not to be trusted — and why " +
      "nearly all of it has been taken out.",
    sourceIds: ["eso_gigagalaxy"],
    introduced: "2026-07-26",
    status: "accepted",
    review: "If a measured all-sky surface-brightness map becomes practical to ship.",
  },
  {
    id: "SF-L-012",
    title: "Earth's surface is one global texture, not streamed terrain",
    system: "Earth appearance",
    classification: "model limit",
    reality:
      "Earth's surface has been imaged at better than a metre per pixel, and its elevation " +
      "mapped globally at 30 m.",
    implemented:
      "A single 4096×2048 global colour map — about 10 km per pixel at the equator — on a " +
      "smooth ellipsoid with no elevation at all.",
    reason:
      "Progressive terrain streaming is Phase 2 work and needs a tiling scheme, a cache and a " +
      "level-of-detail system. Shipping a bigger flat texture instead would blow the 5 MB " +
      "transfer budget and still not be enough at 420 km.",
    magnitude:
      "From 420 km the ground under you is drawn from roughly 40 texture pixels across the " +
      "whole field of view. Coastlines are in the right place; nothing smaller than a large " +
      "city is resolved, and no terrain relief exists.",
    consequence:
      "The limb, the curve, the terminator and the atmosphere are all correct. Looking " +
      "straight down is soft. Continents are recognisable; individual features are not.",
    sourceIds: ["blue_marble"],
    introduced: "2026-07-25",
    status: "accepted",
    review: "Phase 2 — Earth atmospheric entry and terrain flight.",
  },
  {
    id: "SF-L-013",
    title: "Lunar relief is quantised to 8 bits",
    system: "Moon terrain",
    classification: "model limit",
    reality:
      "LOLA has measured lunar elevation to about a metre vertically, from over six billion " +
      "laser returns.",
    implemented:
      "An 8-bit greyscale global model at 1024×512, stretched across the Moon's published " +
      "elevation range and displaced on the mesh.",
    reason: "A 16-bit or tiled elevation product is a Slice D problem, not a Slice A one.",
    magnitude:
      "256 elevation steps across a 20 km range gives 78 m of vertical quantisation, and " +
      "about 5 km per pixel horizontally.",
    consequence:
      "Large basins and the shape of the limb are real and correctly placed. Individual " +
      "craters below a few kilometres are not there yet, and landing will need better.",
    sourceIds: ["lola"],
    introduced: "2026-07-25",
    status: "accepted",
    review: "Slice D — lunar descent and landing.",
  },
  {
    id: "SF-L-015",
    title: "City lights are lifted about seventy times above their real radiance",
    system: "Earth appearance — the night side",
    classification: "presentation aid",
    reality:
      "A bright urban core seen from orbit has a luminance of roughly half a candela per " +
      "square metre — about two millionths of the sunlit side of the planet. You can see it " +
      "at all only because the eye spends twenty minutes dark-adapting on every night pass.",
    implemented:
      "The night texture is emitted at 1.4×10⁻⁴ in units of the solar constant per steradian. " +
      "Its physical value in those units is about 2×10⁻⁶.",
    reason:
      "The eye model spans four decades of adaptation where the real eye spans ten (SF-L-011), " +
      "so every luminance below 'sunlit surface' is already compressed into a much shorter " +
      "ladder. At its true radiance inside that ladder a city peaks at 9 of 255 — present in " +
      "the buffer, invisible on a screen, and a worse misrepresentation than the lift is.",
    magnitude:
      "About 70×, or 1.8 decades — the same order as the adaptation compression it compensates " +
      "for. Ordering is preserved: daylight remains roughly two thousand times brighter than " +
      "the brightest city, and the lights stay invisible until the eye is dark-adapted.",
    consequence:
      "Cross into orbital night and the cities arrive as the eye adapts, at about the contrast " +
      "an astronaut describes. The relative geography is the real measured one; the absolute " +
      "brightness is not.",
    sourceIds: ["black_marble"],
    introduced: "2026-07-26",
    status: "accepted",
    review: "If the adaptation model is ever given the eye's full range.",
  },
  {
    id: "SF-L-016",
    title: "The bodies are lit by the albedo of the texture that is actually shipped",
    system: "Lighting — surface reflectance",
    classification: "approximation",
    reality:
      "Earth's Bond albedo is 0.306, and roughly two thirds of that is cloud. The Moon's is " +
      "0.11 — about the reflectance of worn asphalt.",
    implemented:
      "Both textures were measured: mean linear reflectance weighted by cos(latitude), so an " +
      "equirectangular map's poles do not dominate the average. Blue Marble comes out at " +
      "0.0955, because it is cloudless; the lunar colour map comes out at 0.2986, because " +
      "published lunar maps are brightened to be looked at. Earth's eye model was moved to " +
      "0.0955 to match what is drawn; the Moon's texture is scaled by 0.11/0.2986 so the body " +
      "keeps its real albedo.",
    reason:
      "Exposing for one number while rendering another is how the day side came out three " +
      "stops under. Whichever of the pair is wrong is the one that gets corrected: for Earth " +
      "that is the eye model, because a cloudless planet really is that dark; for the Moon it " +
      "is the texture, because the Moon really is that dark and the picture is not.",
    magnitude:
      "3.2× on Earth's exposure and 0.37× on the Moon's rendered brightness.",
    consequence:
      "Daylit Earth is exposed for the planet on the screen rather than for a cloudy one that " +
      "is not, and the Moon is as dark as it really is — which is startling next to how bright " +
      "everyone remembers it being. Earth has no clouds at all; see SF-L-012.",
    sourceIds: ["blue_marble", "lroc_wac"],
    introduced: "2026-07-26",
    status: "accepted",
    review: "When a cloud layer arrives, Earth's figure returns toward the real Bond albedo.",
  },
  {
    id: "SF-L-017",
    title: "Gravity is four terms, and drag is not one of them",
    system: "Ship dynamics",
    classification: "model limit",
    reality:
      "A satellite in low orbit is pulled by an Earth whose gravity field is mapped to " +
      "hundreds of spherical-harmonic terms, dragged by a thermosphere whose density swings " +
      "by an order of magnitude with solar activity, pushed by sunlight, and shifted by " +
      "general relativity.",
    implemented:
      "Earth as a point mass, plus J₂ oblateness, plus the Moon and the Sun as third bodies " +
      "with their indirect terms. Integrated by classical RK4 at the simulation step.",
    reason:
      "The slice asks for gravity good enough that circular orbits stay circular, that " +
      "station-relative motion is coherent, and that transfers do not contradict the " +
      "ephemeris — and explicitly not for a research integrator. Drag in particular would " +
      "be a fiction without a thermospheric density model that tracks solar activity, and a " +
      "fiction that quietly de-orbits you is worse than an omission that does not.",
    magnitude:
      "Over one revolution the integrator holds the semi-major axis to about two metres, and " +
      "halving the step changes the answer by under two millimetres. The dropped physics is " +
      "led by drag, which at 420 km lowers the real station by a kilometre or two a day — " +
      "far more than a session, and nothing over one.",
    consequence:
      "Orbits are stable and station-keeping is exact. The orbit does not decay, so nothing " +
      "here needs re-boosting, and nothing here will teach you why the real station does.",
    sourceIds: ["iers2010", "iau_nominal"],
    introduced: "2026-07-26",
    status: "accepted",
    review: "Slice D, when atmospheric flight makes a density model necessary anyway.",
  },
  {
    id: "SF-L-018",
    title: "The ship is fiction, and its numbers are chosen rather than measured",
    system: "Ship capability",
    classification: "fictional",
    reality:
      "No vehicle has unlimited operational energy, six-degree-of-freedom thrust at three g, " +
      "and no propellant to run out of.",
    implemented:
      "30 m/s² of translational authority along any body axis, 10 rad/s² of angular " +
      "acceleration limited to 2.5 rad/s, and a precision mode at a fortieth of both. Thrust " +
      "is expressed as an acceleration because the ship has no propellant, so mass would " +
      "appear in F = ma only to cancel out again.",
    reason:
      "Design Bible §6.1 grants the ship this premise deliberately: the game is about going " +
      "and looking, not about fuel budgeting. The figures are then chosen against real " +
      "constraints — enough to hover anywhere in the slice (Earth's surface gravity is 9.8, " +
      "the Moon's 1.62), enough to change a low-orbit velocity in seconds, and low enough " +
      "that the ship still feels like it has mass. The rotational figures are frankly " +
      "generous, on Ric's direction that it should fly like a ship in a film — because what " +
      "makes a ship feel heavy is not its top turn rate but how long it takes to reach it.",
    magnitude:
      "Total. This is the one genuinely invented object in the slice.",
    consequence:
      "Everything the ship does *to* the world is real physics — real gravity, real orbits, " +
      "real relative motion. Only its ability to push is fictional, and it is labelled here " +
      "rather than hidden behind plausible-sounding engineering.",
    sourceIds: [],
    introduced: "2026-07-26",
    status: "accepted",
    review: "Never. It is the premise, not a limitation.",
  },
  {
    id: "SF-L-019",
    title: "Above Local, the stop button cancels your momentum outright",
    system: "Flight — full stop",
    classification: "fictional",
    reality:
      "Momentum does not go anywhere. Shedding 269 km/s takes a real deceleration over a " +
      "real distance, and no button changes that.",
    implemented:
      "In flight modes 2–5 the full-stop control sets the ship's velocity to that of a body " +
      "at rest in the current reference frame, in one frame, with no burn. Mode 1 (Local) is " +
      "deliberately excluded and still flies an honest braking burn at 30 m/s².",
    reason:
      "Ric, 2026-07-26: \"you should be able to stop instantly if you want\", then " +
      "immediately \"instant stop should only be a thing on 2-6\". The split is the whole " +
      "point. Above Local the honest stopping distances run to hundreds of kilometres, so a " +
      "physical brake stops being an escape hatch and becomes a countdown the player watches " +
      "— and an escape hatch that takes four minutes is not one. Local is the mode where " +
      "delicate work happens and where braking *is* the flying, so there the physics stands.",
    magnitude:
      "Total, within the modes that allow it: an unbounded acceleration for one frame. The " +
      "ship is already a declared fiction (SF-L-018); this is that same fiction reaching one " +
      "step further, and only when the player presses the key.",
    consequence:
      "It never fires on its own, and it never fires in Local. The frame discipline survives " +
      "intact — the ship is set to rest *relative to the named reference*, ω × r included, " +
      "not to zero in some frame nobody asked about, because zeroing an inertial velocity " +
      "beside the station would leave you falling away from the thing you meant to stop at. " +
      "The proximity governor and every stopping-distance readout stay honest, so the numbers " +
      "the HUD shows still describe what the ship can do without this.",
    sourceIds: [],
    introduced: "2026-07-26",
    status: "accepted",
    review:
      "If instant stop makes the proximity governor feel redundant in play, the governor is " +
      "what should be relaxed — not this. They answer different questions: the governor is " +
      "for not needing rescue, this is the rescue.",
  },
  {
    id: "SF-L-021",
    title: "Star brightness is compressed, because a screen has one twentieth of the range",
    system: "Sky — star rendering",
    classification: "approximation",
    reality:
      "Apparent brightness follows Pogson's ratio exactly: each magnitude is a factor of " +
      "2.512 in flux, so Sirius at −1.46 delivers about 1 600 times the light of a " +
      "magnitude 6.5 star at the naked-eye limit. Both are visible to a dark-adapted eye at " +
      "the same moment.",
    implemented:
      "The shader renders brightness proportional to flux^0.48 rather than to flux, which " +
      "maps that 1 600:1 range onto about 33:1 — the range a display actually has between " +
      "the threshold of visibility and white. Position, colour and the relative *ordering* " +
      "of every star are untouched; only the spacing is compressed. Disc size carries part " +
      "of the difference, as it does in the eye.",
    reason:
      "Rendering the ratio linearly does not produce a faithful sky, it produces no sky at " +
      "all: the tone curve saturated everything brighter than about magnitude 5 to the same " +
      "flat white, so eight magnitudes of real hierarchy arrived as under one and a half, " +
      "the measured B−V colours were bleached away with them, and the result read as " +
      "confetti. A compressed range that preserves order is closer to what an eye reports " +
      "than an uncompressed one that clips.",
    magnitude:
      "An exponent of 0.48. At the calibration points the error is zero by construction — " +
      "magnitude 6.5 sits at the threshold and Sirius at white — and it is largest in the " +
      "middle of the range, where a magnitude 3 star is rendered roughly four times brighter " +
      "relative to magnitude 6.5 than its flux ratio alone would give.",
    consequence:
      "Never use the rendered sky to estimate a magnitude; the catalogue value is in the " +
      "target panel and that one is the measurement. Ordering is safe: if one star looks " +
      "brighter than another here, it is brighter.",
    sourceIds: ["bsc"],
    introduced: "2026-07-28",
    status: "accepted",
    review:
      "An HDR display would need much less of this, and the exponent is a single uniform so " +
      "it can move toward 1.0 without touching anything else. Worth revisiting if the " +
      "renderer ever gets a real HDR output path.",
  },
  {
    id: "SF-L-022",
    title: "Planet positions come from a fitted approximation, not from an ephemeris",
    system: "World — planetary positions",
    classification: "approximation",
    reality:
      "The planets follow orbits known to metres. JPL's DE440 gives their positions to a " +
      "precision no game needs and no eye could check.",
    implemented:
      "Positions come from JPL's *Approximate Positions of the Planets* (Standish) — six " +
      "Keplerian elements per planet plus six rates, fitted for 1800–2050, with four extra " +
      "terms for the giants. Kepler's equation is solved by six Newton–Raphson iterations. " +
      "Earth's own heliocentric position is taken from the same element set rather than from " +
      "the Meeus solar series used elsewhere, so that subtracting the two does not leave the " +
      "difference between two theories in the answer.",
    reason:
      "The job here is a point of light in the right place. Standish states the fit as good " +
      "to roughly 10–100 arcseconds over the interval; the eye resolves about 60, and every " +
      "planet is an unresolved point from anywhere in the Earth–Moon volume. VSOP87 would " +
      "cost thousands of coefficients to move an error nobody can see.",
    magnitude:
      "Worst case around 100″ for Mercury and Mars near the ends of the fitted interval — " +
      "about one and a half eye-resolution elements, or a thirtieth of the Moon's width. " +
      "Outside 1800–2050 the error grows without bound and the elements should not be used.",
    consequence:
      "Good enough to look at, to identify, and to point at. **Not** good enough to navigate " +
      "by at close range: an approach that ended by trusting these positions to within a " +
      "planet's own radius would be trusting them past what they claim. Nothing in the slice " +
      "does that today, because no route yet terminates at a planet other than the Moon.",
    sourceIds: ["jpl-approx-planets"],
    introduced: "2026-07-28",
    status: "accepted",
    review:
      "Before any route is allowed to *arrive* at a planet rather than merely be planned to " +
      "one. That is the point at which the approximation stops being invisible.",
  },
  {
    id: "SF-L-023",
    title: "Every star is assumed to be the size of the Sun",
    system: "Navigation — stellar destinations",
    classification: "approximation",
    reality:
      "Stellar radii span more than three orders of magnitude. Betelgeuse is about 750 times " +
      "the Sun's radius; a white dwarf is about a hundredth of it.",
    implemented:
      "A star selected as a destination is given one solar radius, and its arrival standoff " +
      "is 200 of those. The record carries `assumedRadius: true` so anything displaying it " +
      "can say so.",
    reason:
      "The Bright Star Catalogue carries no radius, and deriving one from spectral type and " +
      "magnitude would be a calculation dressed up as a measurement — a guess with more " +
      "decimal places. One clearly-labelled assumption is more honest than a derived number " +
      "that invites trust it has not earned.",
    magnitude:
      "Up to a factor of ~750 on the arrival standoff. For Betelgeuse the standoff computed " +
      "here would sit well inside the star.",
    consequence:
      "Only affects where an arrival *stops*, not where the star is — the position comes " +
      "from a measured parallax and is unaffected. It matters the first time a route actually " +
      "arrives somewhere, which nothing does yet at interstellar range.",
    sourceIds: ["bsc"],
    introduced: "2026-07-28",
    status: "accepted",
    review:
      "Before interstellar arrival is real. The fix is a radius per spectral class, or better, " +
      "a catalogue that carries the measurement.",
  },
  {
    id: "SF-L-024",
    title: "The drive reaches its cruise speed in a fixed time, not at a fixed acceleration",
    system: "Flight — travel modes",
    classification: "fictional",
    reality:
      "Reaching a speed takes time proportional to that speed divided by your acceleration. " +
      "There is no arrangement of physics in which a craft reaches a tenth of a light year " +
      "per second in about a second.",
    implemented:
      "In modes 3, 4 and 5 the drive closes on whatever speed the throttle asks for in " +
      "**1.2 seconds**, whatever that speed is. Modes 1 and 2 are untouched and still " +
      "accelerate at their stated authority. The mode's `authority` is unchanged in every " +
      "mode and continues to be what the proximity governor, the stopping-distance readout " +
      "and the autopilot compute from — so approaching a world still sheds speed exactly as " +
      "it did, and nothing about braking or safety changed.",
    reason:
      "Ric, 2026-07-28: modes 3–5 should be \"almost instant… like going into lightspeed in " +
      "Star Wars\". The previous model was not merely slow, it was unreachable: dividing each " +
      "mode's top speed by its acceleration gives 5 minutes for System, **87 years** for " +
      "Interstellar and **150 million years** for Intergalactic. The two numbers had been " +
      "chosen independently and never divided into one another, so the top speed was a figure " +
      "the HUD printed and the ship could not get to. A fixed spool time also makes the ladder " +
      "legible: every mode feels the same to engage, and they differ only in where they take " +
      "you — which is the point of naming them after places rather than speeds.",
    magnitude:
      "Total, and deliberately so. At the extreme, mode 5 reaches 5×10⁵ ly/s in 1.2 s, which " +
      "is an acceleration with no physical meaning. The ship is already a declared fiction " +
      "(SF-L-018) and modes 4–5 already exceed light; this is that same fiction applied to " +
      "how quickly the drive arrives at its speed rather than to the speed itself.",
    consequence:
      "Braking, collision avoidance and the governor are unaffected, because none of them " +
      "read the spool. The honest quantity — how fast you may approach something and how far " +
      "it takes to stop — is still computed from the mode's real authority, so the ship still " +
      "cannot fly faster than it could stop from. What changed is only how quickly you get up " +
      "to a speed the governor already permits.",
    sourceIds: [],
    introduced: "2026-07-28",
    status: "accepted",
    review:
      "If the spool ever makes the ship feel weightless rather than powerful, the number to " +
      "move is SPOOL_SECONDS and nothing else. It is one constant shared by all three modes " +
      "precisely so that it stays one decision.",
  },
  {
    id: "SF-L-025",
    title: "The proximity governor only counts what is in front of you",
    system: "Flight — the proximity governor",
    classification: "simplified",
    reality:
      "Nothing here is a claim about physics. A straight line that passes a planet passes " +
      "it, and the distance that decides whether you can stop before hitting something is " +
      "the distance along your path to that thing — not the radius of a sphere drawn " +
      "around you.",
    implemented:
      "Clearance is measured along the ship's nose. A body governs your speed only if it " +
      "lies ahead of you and within ten of its own radii of your track; the distance used " +
      "is the along-track distance to its near face. With nothing ahead, the clearance is " +
      "reported as clear and the mode flies its own top speed. Contact is exempt: a body " +
      "you are already touching governs you whichever way the nose points.",
    reason:
      "Ric, 2026-07-28: modes 3–5 should engage \"like going into lightspeed in Star Wars\", " +
      "and the ship should be one you \"barely think about\". Fixing the drive's spool time " +
      "(SF-L-024) fixed mode 3 and did almost nothing for 4 and 5, because the drive was " +
      "never what held them back — the governor was. Its spindown term is linear in " +
      "clearance, so with clearance measured as a sphere the permitted speed grew only as " +
      "fast as the ship was permitted to fly: an exponential with a 32-second time " +
      "constant. Measured in the probe, mode 4 took **187 seconds** to reach top speed from " +
      "low orbit and mode 5 never reached its at all — not because anything was unsafe, but " +
      "because Earth was behind the ship and still slowing it down.",
    magnitude:
      "Large in open space and nil on an approach. From a 420 km orbit pointed at open sky, " +
      "mode 4 reaches its top speed in 1.35 s where it took 187 s, and mode 5 reaches its " +
      "at all where it previously never did; mode 3 was already there on the spool fix " +
      "alone. Pointed at Earth, the permitted speed is unchanged to the metre.",
    consequence:
      "Ric's Earth–Moon anchor moved, and this is the one place in the project where a " +
      "stated anchor has. The two minutes he gave on 2026-07-26 was the sum of two braking " +
      "curves — the governor charged you for leaving Earth as well as for arriving at the " +
      "Moon. Deleting the departure half is what makes the jump instant, so the crossing is " +
      "now about 79 s, flown and re-integrated. The half Ric actually described in words — " +
      "\"if you get close to it it needs to slow you down\" — is untouched.",
    sourceIds: [],
    introduced: "2026-07-28",
    status: "accepted",
    review:
      "Ric's call, and it is a real one: an Earth–Moon crossing in mode 4 is 79 s rather " +
      "than 120 s. If two minutes matters more than an instant jump, the departure half " +
      "goes back and the interstellar drive spools over tens of seconds again — the two " +
      "cannot both be had. The corridor width (ten radii) is the free parameter here and " +
      "is the thing to move if flying past a world at speed ever feels either hairy or " +
      "nannying.",
  },
  {
    id: "SF-L-026",
    title: "The governor also limits you to what the control loop can shed",
    system: "Flight — the proximity governor",
    classification: "honest",
    reality:
      "√(2·a·d) is the speed you can stop from in distance d — provided you brake at a " +
      "from the first instant. A proportional controller does not: it brakes at gain × " +
      "error, and the error shrinks as it works, so its response lags by 1/gain seconds " +
      "however much thrust it has.",
    implemented:
      "The permitted speed is additionally capped at gain × clearance ÷ 4, so the loop's " +
      "own lag distance always fits inside a quarter of the room available. Linear in " +
      "clearance, so it binds only close in — the last 43 km in mode 4, the last 1.25 km " +
      "in mode 3 — and every distance in the anchors is far outside that.",
    reason:
      "Found by flying it, 2026-07-28, not by reading it. Mode 5 pointed straight down from " +
      "a 420 km orbit reported \"held to 20.5 km/s\" the whole way down and hit the ground " +
      "at 71 km/s. The commanded speed was legal at every instant and the ship was never " +
      "able to *be* it: an eighth of a second at 71 km/s is nine kilometres. A governor " +
      "whose arithmetic assumes a braking law the ship does not fly is not a safety system, " +
      "it is a caption. Re-flown after the fix, the same dive settles onto the surface at " +
      "1.2 m/s.",
    magnitude:
      "None at any distance the ladder was designed around, by construction. It is a " +
      "correction to the last few seconds of an approach.",
    consequence:
      "The governor and the ship now agree about braking, so the stopping-distance readout " +
      "means what it says at every speed rather than only at slow ones.",
    sourceIds: [],
    introduced: "2026-07-28",
    status: "accepted",
    review:
      "The gain lives on SHIP.velocityGain and is read by both the loop and the governor, " +
      "so they cannot drift apart. If the loop is ever changed to brake at full authority " +
      "when the governor binds, this cap can be relaxed by exactly that much.",
  },
];

export const ledgerEntry = (id) => LEDGER.find((e) => e.id === id) || null;
export const ledgerFor = (ids = []) => ids.map(ledgerEntry).filter(Boolean);
