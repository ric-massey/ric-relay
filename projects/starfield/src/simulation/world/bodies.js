/* ══════════════════════════════════════════════════════════════════════
   bodies.js — the identity of every object in the slice.

   Technical Architecture §4.1: immutable identity lives apart from dynamic
   state. Nothing in this file changes during a session; positions are
   computed elsewhere and joined to these records by id.

   `info` implements the progressive information model (Design Bible §12.1).
   Layer 1 exists to make you curious from a distance; the later layers are
   the reward for going. Nothing here is ever a paywall — the layers control
   presentation, not access.
   ══════════════════════════════════════════════════════════════════════ */

import { K } from "../core/units.js";

export const BODIES = [
  {
    id: "earth",
    name: "Earth",
    type: "planet",
    frame: "ECI",           // this body sits at the origin of this frame
    fixedFrame: "ECEF",
    radius: K.EARTH_RADIUS_EQ,
    polarRadius: K.EARTH_RADIUS_POLAR,
    gm: K.GM_EARTH,
    texture: {
      colour: "assets/textures/earth-color-4096.jpg",
      night: "assets/textures/earth-night-2048.jpg",
    },
    atmosphere: {
      // Scale height and surface density of the real atmosphere. Used for
      // the scattering shader and reported honestly in the info panel.
      scaleHeightM: 8500,
      surfaceDensity: 1.225,      // kg/m³
      surfacePressurePa: 101325,
      visualTopM: 100000,         // the Kármán line, a convention not a shell
      composition: "78% N₂, 21% O₂, 0.9% Ar, 0.04% CO₂",
      cls: "M",
    },
    info: {
      hook: "The only place anyone has ever come from.",
      distant:
        "A rocky planet 12 742 km across, with liquid water on 71% of its surface and an " +
        "atmosphere thick enough to scatter blue light. You are inside its gravity well right now.",
      targeted:
        "Surface gravity 9.81 m/s². One rotation every 23 h 56 m 04 s — four minutes short of " +
        "a day, because in a day it also has to catch up with its own orbit around the Sun. " +
        "It is moving at 29.8 km/s around the Sun and you are moving with it.",
      approach:
        "The blue line at the edge is the whole atmosphere. It is about 100 km thick against " +
        "a 6 371 km radius — the same proportion as the skin on an apple. Almost all of the " +
        "air is in the bottom 16 km of it.",
      local:
        "The terminator you can see is not a line. It is a band a few hundred kilometres wide, " +
        "because the Sun is half a degree across rather than a point, and because air bends " +
        "light around the curve.",
      context:
        "You are seeing it the way about 700 people ever have. Everything in every history " +
        "book happened inside that thin blue line.",
    },
    sourceIds: ["wgs84", "iers2010", "blue_marble", "black_marble"],
    ledgerIds: ["SF-L-002", "SF-L-006", "SF-L-009", "SF-L-012"],
  },

  {
    id: "moon",
    name: "the Moon",
    type: "moon",
    frame: "MCI",
    fixedFrame: "MCMF",
    radius: K.MOON_RADIUS,
    gm: K.GM_MOON,
    texture: {
      colour: "assets/textures/moon-color-1024.jpg",
      elevation: "assets/textures/moon-ldem-1024.jpg",
    },
    atmosphere: null,
    info: {
      hook: "Three days away, and the furthest anyone has been.",
      distant:
        "A rocky world 3 474 km across, one quarter of Earth's diameter, at an average of " +
        "384 400 km. It has no atmosphere, so its shadows are absolutely black.",
      targeted:
        "Surface gravity 1.62 m/s², one sixth of Earth's. It rotates exactly once per orbit, " +
        "so the same face is always turned toward you — but its orbit is elliptical and tilted, " +
        "so it rocks slightly and 59% of the surface is visible over time.",
      approach:
        "Its angular size grows the entire way. From here it is half a degree across — the " +
        "same as the Sun, which is why total eclipses work at all and why they will stop " +
        "working in a few hundred million years as it drifts away.",
      local:
        "The dark patches are maria: basalt that flooded impact basins about three billion " +
        "years ago. The bright areas are older highland crust, and they are more heavily " +
        "cratered because they have had longer to be hit.",
      context:
        "The shape you are flying over was measured by a laser altimeter in lunar orbit — " +
        "over six billion pulses fired at the surface and timed on the way back.",
    },
    sourceIds: ["meeus", "iau_wgccre", "lroc_wac", "lola"],
    ledgerIds: ["SF-L-001", "SF-L-005", "SF-L-013"],
  },

  {
    id: "sun",
    name: "the Sun",
    type: "star",
    frame: "SUN",
    fixedFrame: null,
    radius: K.SUN_RADIUS,
    gm: K.GM_SUN,
    texture: null,
    atmosphere: null,
    effectiveTempK: K.SUN_EFFECTIVE_TEMP,
    luminosityW: K.SUN_LUMINOSITY,
    info: {
      hook: "The reason anything here is lit.",
      distant:
        "A G2V star 1.39 million km across, at about 150 million km. Every photon landing on " +
        "the Earth below you left it eight minutes and twenty seconds ago.",
      targeted:
        "Effective temperature 5 772 K; output 3.828×10²⁶ W. At Earth's distance that arrives " +
        "as 1 361 watts per square metre — the number that sets how bright everything in this " +
        "scene is.",
      approach:
        "Do not look at it. In vacuum there is no atmosphere to dim it, and it is roughly " +
        "twice as bright as it is from the ground.",
      local:
        "It is not yellow. A 5 772 K blackbody is white — it looks yellow from the ground only " +
        "because the atmosphere has scattered the blue end of it away into the sky.",
      context:
        "It is about halfway through its life on the main sequence, converting six hundred " +
        "million tonnes of hydrogen a second and losing four million tonnes of that as light.",
    },
    sourceIds: ["iau_nominal", "meeus"],
    ledgerIds: [],
  },
];

export const body = (id) => BODIES.find((b) => b.id === id) || null;
