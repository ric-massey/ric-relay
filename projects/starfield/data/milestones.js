/* ══════════════════════════════════════════════════════════════════════
   milestones.js — the distance ladder.

   ══════════════════════ EDITABLE — waypoints ═══════════════════════════
     ly     home-frame distance travelled, light-years
     title  what you have reached
     note   why it matters
     mark   optional flag the game reacts to:
              "bubble"   leaving the Local Bubble — ISM density jumps 20×
              "disk"     leaving the thin disk — the galaxy becomes a view
              "horizon"  the cosmological event horizon — the wall
              "end"      the edge of the observable universe

   Distances are real and in order. The counter no longer just climbs; it
   arrives somewhere.
   ══════════════════════════════════════════════════════════════════════ */
window.SF_MILESTONES = [
  { ly: 1,          title: "Oort cloud",            note: "the outer edge of the Sun's comets" },
  { ly: 4.246,      title: "Proxima Centauri",      note: "the nearest star" },
  { ly: 8.611,      title: "Sirius",                note: "brightest star in Earth's sky" },
  { ly: 25.04,      title: "Vega",                  note: "the star that defines magnitude zero" },
  { ly: 300,        title: "edge of the Local Bubble", note: "interstellar gas jumps 20× thicker", mark: "bubble" },
  { ly: 444,        title: "the Pleiades",          note: "a hundred million years old — infants" },
  { ly: 1000,       title: "out of the thin disk",  note: "the galaxy stops being around you and becomes a view", mark: "disk" },
  { ly: 1344,       title: "the Orion Nebula",      note: "seven hundred stars mid-assembly" },
  { ly: 2615,       title: "Deneb",                 note: "200,000 Suns, and still just a dot from home" },
  { ly: 7000,       title: "the Pillars of Creation", note: "already destroyed; the light hasn't reached Earth yet" },
  { ly: 26670,      title: "Sagittarius A*",        note: "four million solar masses at the galactic centre" },
  { ly: 105700,     title: "the far edge of the Milky Way", note: "turn around and see the whole thing" },
  { ly: 163000,     title: "the Large Magellanic Cloud", note: "a satellite galaxy, falling in" },
  { ly: 2537000,    title: "Andromeda",             note: "on a collision course with home, arriving in 4 billion years" },
  { ly: 53800000,   title: "the Virgo Cluster",     note: "two thousand galaxies; our supercluster's heart" },
  { ly: 250000000,  title: "the Great Attractor",   note: "something is pulling half a million galaxies toward it" },
  { ly: 700000000,  title: "the Boötes Void",       note: "700 million light-years of almost nothing" },
  { ly: 16000000000, title: "the cosmological event horizon", note: "past here, space grows faster than you can cross it. No engine passes this. Ever.", mark: "horizon" },
  { ly: 46500000000, title: "the edge of the observable universe", note: "there is nothing further to reach", mark: "end" },
];
