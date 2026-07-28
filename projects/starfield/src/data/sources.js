/* ══════════════════════════════════════════════════════════════════════
   sources.js — who measured this, and with what.

   Design Bible §18.1: "credits are a feature, not a footer". The sources
   screen is content. Each entry leads with one interesting sentence about
   what the instrument did, because telling somebody that the ground they
   are hovering over was mapped by a laser firing at the Moon from orbit is
   more interesting than a licence string — and the licence string is still
   underneath for anyone who wants it.

   `gave` answers "what did this give us?" in the player's terms.
   `story` is the one sentence worth knowing.
   ══════════════════════════════════════════════════════════════════════ */

export const SOURCES = {
  meeus: {
    id: "meeus",
    name: "Astronomical Algorithms, 2nd ed.",
    owner: "Jean Meeus / Willmann-Bell",
    gave: "where the Sun and the Moon are, right now",
    story:
      "Before computers were everywhere, astronomers needed the sky in closed form — " +
      "series you could evaluate by hand. Meeus collected the best of them. The lunar " +
      "series in this game is a 60-term truncation of ELP-2000/82, and it puts the Moon " +
      "within about 20 km of where it really is.",
    citation: "Meeus, J. (1998). Astronomical Algorithms, 2nd ed. Willmann-Bell.",
    licence: "Algorithms and published series; implemented independently here.",
    retrieved: "2026-07-25",
    url: "",
  },

  iau_wgccre: {
    id: "iau_wgccre",
    name: "IAU Working Group on Cartographic Coordinates and Rotational Elements (2009)",
    owner: "International Astronomical Union",
    gave: "which way the Moon is facing",
    story:
      "Somebody has to decide where a world's prime meridian is. For the Moon the IAU " +
      "fixed it so that the mean sub-Earth point sits at longitude zero — the Moon's " +
      "coordinate system is defined by the fact that it looks at us.",
    citation:
      "Archinal, B.A. et al. (2011). Celestial Mechanics and Dynamical Astronomy 109, 101–135.",
    licence: "Published scientific report.",
    retrieved: "2026-07-25",
    url: "",
  },

  wgs84: {
    id: "wgs84",
    name: "WGS 84",
    owner: "US National Geospatial-Intelligence Agency",
    gave: "Earth's exact size and shape",
    story:
      "Earth is not a sphere: spin flattens it by 21 km between pole and equator. WGS 84 " +
      "is the ellipsoid every GPS receiver on the planet quietly agrees to use, and it is " +
      "the shape this Earth is drawn at.",
    citation: "NGA.STND.0036_1.0.0_WGS84 (2014).",
    licence: "US Government work — public domain.",
    retrieved: "2026-07-25",
    url: "",
  },

  iers2010: {
    id: "iers2010",
    name: "IERS Conventions 2010",
    owner: "International Earth Rotation and Reference Systems Service",
    gave: "Earth's gravity and rotation rate, and the leap seconds",
    story:
      "Earth's rotation is not quite constant — it is measured, not assumed, by radio " +
      "telescopes watching quasars. The IERS is the body that publishes the answer and " +
      "decides when a leap second is needed.",
    citation: "Petit, G. & Luzum, B. (eds.) (2010). IERS Technical Note No. 36.",
    licence: "Published standard.",
    retrieved: "2026-07-25",
    url: "",
  },

  blue_marble: {
    id: "blue_marble",
    name: "Blue Marble Next Generation",
    owner: "NASA Earth Observatory (Reto Stöckli, NASA GSFC)",
    gave: "the daylight side of Earth",
    story:
      "This is not a photograph. It is every cloud-free pixel MODIS saw over a month, " +
      "stitched into one impossible day — which is why the Earth below you has no weather " +
      "on it. December 2004 is the month you are looking at.",
    citation: "NASA Earth Observatory, Blue Marble Next Generation (2004).",
    licence: "NASA imagery — public domain, credit requested.",
    retrieved: "2026-07-25",
    url: "https://visibleearth.nasa.gov/collection/1484/blue-marble",
  },

  black_marble: {
    id: "black_marble",
    name: "Earth at Night (VIIRS Day/Night Band)",
    owner: "NASA Earth Observatory / NOAA",
    gave: "the city lights on the night side",
    story:
      "The VIIRS day/night band is sensitive enough to see a fishing boat's lamps from " +
      "orbit. Every point of light on the dark side of the Earth below you is somebody's " +
      "electricity.",
    citation: "NASA Earth Observatory, Earth at Night (2012), Suomi NPP / VIIRS.",
    licence: "NASA imagery — public domain, credit requested.",
    retrieved: "2026-07-25",
    url: "https://earthobservatory.nasa.gov/features/NightLights",
  },

  lroc_wac: {
    id: "lroc_wac",
    name: "LROC WAC global colour mosaic",
    owner: "NASA / GSFC / Arizona State University",
    gave: "what the Moon's surface looks like",
    story:
      "The Lunar Reconnaissance Orbiter has been photographing the Moon since 2009. Its " +
      "wide-angle camera built a mosaic of the entire surface at consistent lighting — " +
      "which is why the Moon here has no permanent shadow painted into it.",
    citation: "NASA/GSFC/Arizona State University, LRO LROC WAC mosaic.",
    licence: "NASA imagery — public domain, credit requested.",
    retrieved: "2026-07-25",
    url: "https://svs.gsfc.nasa.gov/4720",
  },

  lola: {
    id: "lola",
    name: "LOLA global lunar elevation model",
    owner: "NASA Goddard Space Flight Center / LRO",
    gave: "the Moon's actual shape — every hill and crater rim",
    story:
      "The Lunar Orbiter Laser Altimeter fires five laser pulses at the Moon 28 times a " +
      "second and times the echo. It has made over six billion measurements, and the " +
      "relief you can see on the limb of the Moon is those measurements, not artwork.",
    citation: "NASA/GSFC/LOLA, Lunar Digital Elevation Model.",
    licence: "NASA data — public domain, credit requested.",
    retrieved: "2026-07-25",
    url: "https://svs.gsfc.nasa.gov/4720",
  },

  bsc: {
    id: "bsc",
    name: "Bright Star Catalogue, 5th Revised Edition",
    owner: "Dorrit Hoffleit & Wayne Warren, Yale University Observatory",
    gave: "the sky — all 9 096 stars of it",
    story:
      "This catalogue contains almost exactly the stars a human eye can see and almost " +
      "nothing else: everything down to about magnitude 6.5. Its first edition was compiled " +
      "in 1930 and Dorrit Hoffleit kept revising it for the next seventy years, into her " +
      "nineties. Every point of light out of the canopy is one of its entries, at its " +
      "catalogued position, with its catalogued brightness and colour.",
    citation:
      "Hoffleit, D. & Warren, W.H. (1991). The Bright Star Catalogue, 5th Revised Ed. " +
      "VizieR V/50.",
    licence: "Freely distributed astronomical catalogue; no redistribution restriction.",
    retrieved: "2026-07-26",
    url: "https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50",
  },

  "jpl-approx-planets": {
    id: "jpl-approx-planets",
    name: "Approximate Positions of the Planets",
    owner: "E. M. Standish, JPL Solar System Dynamics",
    gave: "where Mercury through Neptune are",
    story:
      "The full JPL ephemeris is a numerically integrated file of hundreds of megabytes that " +
      "knows where the planets are to within metres. This is the other thing JPL publishes: " +
      "six orbital elements per planet and six rates of change, fitted so that a few lines of " +
      "arithmetic put each planet within about an arcminute of the truth for any date between " +
      "1800 and 2050. It is what lets a web page know where Jupiter is without downloading an " +
      "ephemeris — and an arcminute is close enough that no eye could tell, because from here " +
      "every one of these worlds is a point of light with no width at all.",
    citation:
      "Standish, E.M., \"Keplerian Elements for Approximate Positions of the Major Planets\", " +
      "JPL Solar System Dynamics.",
    licence: "NASA/JPL data — public domain, credit requested.",
    retrieved: "2026-07-28",
    url: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
  },

  eso_gigagalaxy: {
    id: "eso_gigagalaxy",
    name: "GigaGalaxy Zoom — the whole sky",
    owner: "ESO / Serge Brunier",
    gave: "the Milky Way",
    story:
      "One photographer spent a year carrying a camera to the Atacama and the Canaries to " +
      "shoot the entire celestial sphere, then stitched it into a single image of the sky as " +
      "it would look with no atmosphere and no light pollution. The band you can see is that " +
      "photograph, with almost all of its colour taken back out — because a long exposure sees " +
      "colour there and your eye does not.",
    citation: "ESO/S. Brunier, GigaGalaxy Zoom project (2009), eso0932a.",
    licence: "CC BY 4.0 — free to use and modify with attribution.",
    retrieved: "2026-07-26",
    url: "https://www.eso.org/public/images/eso0932a/",
  },

  hipparcos: {
    id: "hipparcos",
    name: "Hipparcos / Gaia positions and parallaxes",
    owner: "ESA",
    gave: "how far away the nearest stars are",
    story:
      "A star's distance is measured by watching it shift against the background as Earth " +
      "swings to the other side of its orbit — the shift for the nearest star is about the " +
      "width of a coin seen from three miles away. Hipparcos did this for 118 000 stars; " +
      "Gaia has done it for nearly two billion.",
    citation: "ESA, The Hipparcos and Tycho Catalogues (1997); ESA Gaia DR3 (2022).",
    licence: "ESA — free use with acknowledgement.",
    retrieved: "2026-07-25",
    url: "https://www.cosmos.esa.int/gaia",
  },

  ballesteros: {
    id: "ballesteros",
    name: "Ballesteros (2012) — colour index to temperature",
    owner: "F.J. Ballesteros, EPL 97, 34008",
    gave: "the colour of every star you can see",
    story:
      "A star's colour is measured, not guessed: photograph it through a blue filter and a " +
      "visual one, and the difference between the two brightnesses tells you its " +
      "temperature. This paper gives the formula that turns that difference into kelvin, " +
      "and the kelvin into the colour you see on the glass.",
    citation: "Ballesteros, F.J. (2012). EPL 97, 34008.",
    licence: "Published relation, implemented independently.",
    retrieved: "2026-07-26",
    url: "",
  },

  iau_nominal: {
    id: "iau_nominal",
    name: "IAU 2015 Resolution B3 nominal solar and planetary values",
    owner: "International Astronomical Union",
    gave: "the Sun's size, temperature and output",
    story:
      "The Sun's radius depends on where you decide its edge is, so in 2015 the IAU simply " +
      "defined a nominal value for everyone to share. It is not a measurement — it is an " +
      "agreement, so that two papers using 'solar radii' mean the same thing.",
    citation: "IAU 2015 Resolution B3 on nominal conversion constants.",
    licence: "Published standard.",
    retrieved: "2026-07-25",
    url: "",
  },

  threejs: {
    id: "threejs",
    name: "Three.js r185",
    owner: "Three.js Authors",
    gave: "the rendering, and nothing else",
    story:
      "The renderer is a library; the universe is not. Every position, distance and " +
      "velocity in this game is computed before Three.js ever sees it — Three renders in " +
      "32-bit floats, which cannot tell two points a kilometre apart at the Moon's distance.",
    citation: "https://threejs.org",
    licence: "MIT — vendored in projects/starfield/vendor/three/.",
    retrieved: "2026-07-25",
    url: "https://threejs.org",
  },
};

/** Look a source up by id, tolerating a missing one rather than throwing. */
export const source = (id) => SOURCES[id] || null;

/** Every source that a given list of ids refers to, in listed order. */
export const sourcesFor = (ids = []) => ids.map(source).filter(Boolean);
