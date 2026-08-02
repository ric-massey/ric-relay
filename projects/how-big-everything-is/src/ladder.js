/* ══════════════════════════════════════════════════════════════════════
   The ladder.

   Twenty-three rungs from the smallest thing anyone has put a bound on to
   the edge of what anyone can see. Every one of them carries a real number in
   metres, and the whole exhibit is built out of those numbers and nothing
   else: the rail, the camera, the spacing on screen, the calipers, the
   light-crossing times. There is no artistic "about this big" anywhere in
   the geometry.

   THE ORDER IS STRICTLY BY SIZE. That is worth saying out loud because it
   produces one result people argue with: the largest star we have measured
   is *smaller* than the planets' orbits, so Stephenson 2-18 lands between
   the Sun and Neptune. It is not a mistake. It is the point.

   The bottom three rungs are the other thing people argue with. A quark,
   an electron and a neutrino have no measured size at all; every number
   there is an upper limit on what the apparatus could have detected, so
   their order is a fact about colliders and reactors rather than about the
   particles. Each of the three says so in its own caveat, and the sheet
   says so once for all of them.

   Some rungs are objects and some are distances — the Moon's orbit, the
   gap to the nearest star — and `dim` says which, "across" for a width and
   "away" for a one-way trip, because a distance quietly presented as an
   object is a lie by layout.

   That distinction is not decoration. Two rungs can sit almost on top of
   each other here and still not mean comparable things: the Oort Cloud's
   frame is three-quarters the width of Proxima Centauri's, which reads as
   the Sun's comets nearly touching another star, and is wrong — one of
   those numbers is a diameter and the other is a radius-length journey,
   and the comets in fact get a bit over a third of the way. Anything that
   compares two rungs has to check `dim` first.

   `size`  the labelled measurement, in metres. This is the number.
   `dim`   what that number measures, in words.
   `alt`   the same measurement in whatever unit a person actually thinks
           in. Hand-written, never converted — "380 feet" is worth more
           than "1.16 × 10² m", and only a human knows which one lands.
   `box`   [width, height] as multiples of `size`. The labelled axis is
           always exactly 1; the other is the true proportion. This is what
           makes the caliper honest — it brackets the dimension the number
           is actually about.
   `tint`  the one colour the object collapses to when it is two pixels
           wide. Below that, an object is a dot, and the dot should be the
           right colour.
   ══════════════════════════════════════════════════════════════════════ */
window.LADDER = [
  {
    id: "quark",
    name: "A quark",
    kicker: "The one thing here that cannot be alone",
    size: 8.6e-19,
    dim: "at most, across",
    alt: "and nobody has ever held one",
    box: [1, 1],
    tint: "#c9a6ff",
    lede: "Three of these make a proton, and not one of them has ever been seen on its own — not once, not by anybody.",
    fact: "That is not a gap in the equipment. The force between quarks does not weaken with distance the way every other force does; it stays roughly constant, so pulling two apart costs more and more energy until there is enough of it to make a new pair, and you end up with two ordinary particles instead of one lonely quark. This is called confinement, and it means the thing this frame is about can only ever be inferred. Its size is an upper bound like the electron's: scattering electrons off protons at HERA put the quark's radius below 0.43 × 10⁻¹⁶ cm, and dijet measurements at the LHC have since probed structure down near 10⁻²⁰ m without finding any.",
    caveat: "This sits below the electron only because the experiments that bound it happen to reach further, not because a quark is known to be smaller. Neither particle has a measured size at all; both numbers are limits on what the apparatus could have detected. Reading this rung as \"smaller than an electron\" is reading a fact about colliders as a fact about nature.",
  },
  {
    id: "electron",
    name: "An electron",
    kicker: "No parts, no edge, no size",
    size: 1e-18,
    dim: "at most, across",
    alt: "and every experiment says smaller",
    box: [1, 1],
    tint: "#bcd8ff",
    lede: "Nobody has ever measured how big an electron is, because as far as anyone can tell it does not have a size.",
    fact: "It is not small the way a grain of sand is small. Every experiment built to find an edge has come back empty, and the best of them can only say it is narrower than a billionth of a billionth of a metre. Draw it any bigger than a smudge and you have made something up. So this is a smudge, drawn at that upper limit, with a dashed edge that means <em>we do not know where this stops</em>. There is nothing drawn inside it either, and that is not an omission: an electron has charge, spin and mass and no known parts. It is the one thing on this ladder with no interior to get wrong.",
    caveat: "The neutrino on the next rung is not bigger than this in any sense anybody can defend — its bound is simply the weakest of the three. Past it, the gap to the proton is real: nearly three empty decades with nothing known in them.",
  },
  {
    id: "neutrino",
    name: "A neutrino",
    kicker: "It does not stop for anything",
    size: 2e-18,
    dim: "at most, across",
    alt: "and a hundred trillion just went through you",
    box: [1, 1],
    tint: "#8fe0b0",
    lede: "About a hundred trillion of these pass through your body every second, and essentially none of them touch you on the way.",
    fact: "It is not that a neutrino is small — the two rungs before this one are smaller still. It is that a neutrino barely participates. It has no electric charge and feels nothing but gravity and the weak force, so ordinary matter is not in its way: to stop half the neutrinos coming off the Sun you would need about a light-year of lead. The ones going through you right now were made in the Sun's core, and they left it in two and a half seconds, straight out through the whole star. The light made alongside them is still in there — it random-walks out over tens of thousands of years. Neutrinos are the only way anybody has ever looked directly at the middle of a star, because they are the only thing that comes out of it.",
    caveat: "This number is not a measurement. Like the quark and the electron beside it, a neutrino is point-like in every theory anybody uses and has never shown a size to any experiment. What is bounded here is its charge radius — how far its electric influence could reach given that its net charge is zero — from reactor antineutrino scattering, and that bound is the loosest of the three, which is the only reason this rung sits above the electron rather than below it. The order of these three is a fact about the experiments, not about the particles.",
  },
  {
    id: "proton",
    name: "A proton",
    kicker: "The first real measurement",
    size: 1.68e-15,
    dim: "across, by charge radius",
    alt: "a millionth of a billionth of a metre",
    box: [1, 1],
    tint: "#ff8f6a",
    lede: "The first thing on this ladder anybody has actually put a number on — though the number is not an edge.",
    fact: "A proton is made of quarks, and the quarks are point-like too — so this width is not a shell around anything solid. It is the distance over which the charge is spread, and what is drawn here is that spread: electron scattering gives the proton a dipole form factor, which means the charge density falls off exponentially and <em>never stops</em>. The 0.84-femtometre radius is a root-mean-square, a moment of that curve rather than a boundary, which is why the ring marking it sits well outside the bright part. Physicists spent most of the 2010s arguing about its last two digits, because two ways of measuring it disagreed by more than either one's error bars. That fight is called the proton radius puzzle, and it is mostly settled now.",
    caveat: "No quarks are drawn inside this, on purpose. There are three of them, but a quark has no position you could mark and has never been observed on its own — three coloured dots orbiting inside a circle is the same fiction as an electron orbiting a nucleus like a planet.",
  },
  {
    id: "atom",
    name: "A hydrogen atom",
    kicker: "Mostly nothing",
    size: 1.06e-10,
    dim: "across",
    alt: "about one ten-billionth of a metre",
    box: [1, 1],
    tint: "#8fb7ff",
    lede: "One proton, one electron, and an enormous amount of empty space between them.",
    fact: "The atom is 63,000 times wider than the proton at the middle of it. Blow the proton up to the size of a marble and the electron is a third of a mile away, with nothing whatsoever in between. Every solid object you have ever touched is built out of this. The reason your hand does not go through a table is not that either one is full — it is that the electrons refuse to share.",
  },
  {
    id: "dna",
    name: "DNA",
    kicker: "The instructions",
    size: 2e-9,
    dim: "wide",
    alt: "two nanometres, or twenty atoms",
    box: [1, 3.2],
    tint: "#68d8c8",
    lede: "Twenty atoms wide, and about two metres long if you pulled one cell's worth straight.",
    fact: "Every cell in your body holds roughly two metres of this, wound tight enough to fit somewhere a thousand times smaller than the width of a hair. Stretched end to end, the DNA in one person would reach past the Sun and back — dozens of times over. It is the only object on this ladder that comes with a copy of the instructions for building the person looking at it.",
  },
  {
    id: "virus",
    name: "A virus",
    kicker: "Not quite alive",
    size: 1e-7,
    dim: "across",
    alt: "smaller than the wavelength of light",
    box: [1, 1],
    tint: "#9fb08a",
    lede: "A hundred nanometres of protein shell with instructions inside — narrower than the light you would have to look at it with.",
    fact: "Visible light has a wavelength of four hundred to seven hundred nanometres, several times wider than this, so an ordinary microscope cannot make out any of its structure. That is a limit of the light and not of the lens. For most of a century it meant every picture of a virus came off an electron beam, and the colours in those were chosen by a person. It is no longer the whole story: tag a virion with something fluorescent and it shows up as a blur in about the right place, and the super-resolution methods that took the 2014 chemistry Nobel get real detail out of visible light by lighting a few molecules at a time rather than trying to out-resolve the wave. What none of them give you is what your eye would have seen.",
  },
  {
    id: "cell",
    name: "A red blood cell",
    kicker: "The smallest thing you are made of",
    size: 7.5e-6,
    dim: "across",
    alt: "a tenth the width of a hair",
    box: [1, 0.27],
    tint: "#c0392b",
    lede: "A dented disc, seven and a half microns wide, and there are about twenty-five trillion of them in you right now.",
    fact: "It is dished in the middle rather than round, which gives it more surface for its volume and lets it fold to squeeze through capillaries narrower than it is. It carries no nucleus and no DNA — it threw both away to make room for cargo. It will go around your body about 75,000 times over four months, and then it will be taken apart.",
  },
  {
    id: "you",
    name: "You",
    kicker: "Roughly the middle",
    size: 1.7,
    dim: "tall",
    alt: "five foot seven",
    box: [0.3, 1],
    tint: "#e8dcc8",
    lede: "You are about as many times bigger than a strand of DNA is wide as the Sun is bigger than you.",
    fact: "This rung is not quite the middle of the ladder, but it is close, and the near-symmetry is real: there are eighteen decades of size below you and twenty-seven above. A human being is one of the few things in the universe positioned to notice both ends. Everything smaller than a blood cell you have only ever seen a picture of; everything bigger than the Moon's orbit, the same.",
  },
  {
    id: "elephant",
    name: "An African elephant",
    kicker: "The biggest thing that walks",
    size: 6.8,
    dim: "long",
    alt: "twenty-two feet, and eleven feet at the shoulder",
    box: [1, 0.47],
    tint: "#8d8a86",
    lede: "The largest land animal alive, and about four of you end to end.",
    fact: "A bull weighs six tonnes and can hear another elephant's call from six miles away, partly through its feet — the low end of the rumble travels through the ground as well as the air. Notice how little of a jump this is. Between you and the largest animal on land is less than one decade. Between you and the tree in the next frame is nearly two.",
  },
  {
    id: "tree",
    name: "Hyperion",
    kicker: "The tallest living thing",
    size: 116,
    dim: "tall",
    alt: "380 feet",
    box: [0.26, 1],
    tint: "#7a4a34",
    lede: "A coast redwood, measured at 116 metres, and the tallest known living thing on Earth.",
    fact: "It is taller than it should be able to be. Water is pulled to the top by the tension of the column itself, and somewhere near 120 metres that column starts to break — so the tree is within a few metres of the physical ceiling for its own plumbing. Its exact location is a secret, and the park closed the area to visitors in 2022 after too many people trampled the roots looking for it.",
  },
  {
    id: "lakes",
    name: "The Great Lakes",
    kicker: "A feature you can see from orbit",
    size: 1.25e6,
    dim: "end to end",
    alt: "780 miles",
    box: [1, 0.68],
    tint: "#3d7ea6",
    lede: "Superior alone is 563 kilometres long. All five together run about 1,250 kilometres from one end to the other.",
    fact: "They hold 22,700 cubic kilometres of water — roughly a fifth of all the fresh surface water on the planet, sitting in five holes gouged out by ice that left about eleven thousand years ago. Poured out evenly over the lower 48 states it would stand nearly three metres deep. This is the first rung you could pick out from space without being told where to look.",
  },
  {
    id: "earth",
    name: "The Earth",
    kicker: "Everything anyone has ever done",
    size: 1.2742e7,
    dim: "across",
    alt: "7,918 miles",
    box: [1, 1],
    tint: "#3f7fbf",
    lede: "Twelve thousand seven hundred and forty-two kilometres across, and the only rung on this ladder anybody has ever lived on.",
    fact: "It is smoother than a billiard ball. Everest and the Mariana Trench are both about nine kilometres off the mean, which on a globe this size is less than a tenth of a percent — a bump you could not feel with a fingertip. The whole of the atmosphere, all the weather there has ever been, is a film about as thick on this as the skin on an apple.",
  },
  {
    id: "moon",
    name: "The Moon's orbit",
    kicker: "The far edge of where we have been",
    size: 7.688e8,
    dim: "across",
    alt: "477,700 miles",
    box: [1, 1],
    tint: "#8b8f9a",
    lede: "A distance, not an object: the full width of the Moon's path around the Earth.",
    fact: "Every other planet in the solar system very nearly fits in the space between the Earth and the Moon, side by side. Mercury, Venus, Mars, Jupiter, Saturn, Uranus and Neptune come to about 380,000 kilometres laid end to end, and the Moon's average distance is 384,400 — but that figure is measured centre to centre, and the two bodies' own radii eat 8,000 kilometres of it. The real gap averages about 376,000, so at an average Moon the planets are a few thousand kilometres short of fitting. They fit comfortably when the Moon is out near the far end of its orbit. Twenty-four people have crossed it. Nobody has been past this line since December 1972.",
  },
  {
    id: "sun",
    name: "The Sun",
    kicker: "Where the light comes from",
    size: 1.3914e9,
    dim: "across",
    alt: "865,000 miles",
    box: [1, 1],
    tint: "#ffc861",
    lede: "One hundred and nine Earths across, and 333,000 times their mass.",
    fact: "It is a completely ordinary star — smaller than most of the ones you can pick out by eye at night, because the ones you can pick out by eye are the show-offs. It holds 99.86 percent of all the mass in the solar system. Everything else on the next several rungs, every planet and moon and comet, is built out of what was left over.",
  },
  {
    id: "stephenson",
    name: "Stephenson 2-18",
    kicker: "The largest star we have measured",
    size: 2.99e12,
    dim: "across",
    alt: "twenty times the Earth's distance from the Sun",
    box: [1, 1],
    tint: "#d9553f",
    lede: "Two thousand one hundred and fifty times the width of the Sun. Ten billion Suns would fit inside it.",
    fact: "Put it where the Sun is and its surface would swallow Mercury, Venus, Earth, Mars, Jupiter, and reach out past the orbit of Saturn. It is not dense — a red hypergiant this size is thinner than the air in this room over most of its volume; it is a vast glowing atmosphere around a small heavy core, and it is falling apart.",
    caveat: "The size depends on the star belonging to the Stephenson 2 cluster, which is disputed. If it is a nearer foreground star it could be several times smaller. This is the biggest number with a serious paper behind it, not a settled fact.",
  },
  {
    id: "solar",
    name: "The solar system",
    kicker: "A star is smaller than its planets' orbits",
    size: 8.99e12,
    dim: "across",
    alt: "sixty times the Earth's distance from the Sun",
    box: [1, 1],
    tint: "#5f7d9e",
    lede: "Neptune's orbit, end to end — nine billion kilometres, and only three times wider than the star in the last frame.",
    fact: "Sunlight takes four hours and ten minutes to reach Neptune. The Sun itself, at this scale, is smaller than one pixel on your screen, and the planets are far smaller than that — which is the honest picture. Every diagram of the solar system you have ever seen cheated on the spacing, because the true version is a few specks of dust in an enormous amount of nothing.",
  },
  {
    id: "oort",
    name: "The Oort Cloud",
    kicker: "Where the comets come from",
    size: 2.99e16,
    dim: "across",
    alt: "a hundred thousand times the Earth's distance, in every direction",
    box: [1, 1],
    tint: "#7e8ba6",
    lede: "A shell of frozen debris wrapped around the Sun, reaching out to something like 100,000 times the Earth's distance from it.",
    fact: "Nobody has ever seen it. It is inferred from the long-period comets that fall in from every direction with orbits that all seem to turn around at about the same enormous distance, which is what a shell would look like from the inside. It is three thousand times wider than the frame you were just looking at, and it is still, technically, the Sun's.",
    caveat: "This rung is an inference and not an observation. No object has ever been detected out there; the size comes from where the long-period comets' orbits turn around, and the 100,000-AU reach drawn here is the middle of a range that runs from something like 50,000 to 200,000 depending on whose model you take. It is the least directly measured number on the ladder above the proton.",
  },
  {
    id: "proxima",
    name: "The nearest star",
    kicker: "Even the comets get only a third of the way",
    size: 4.018e16,
    dim: "away",
    alt: "forty trillion kilometres",
    box: [1, 0.14],
    tint: "#e05a4a",
    lede: "Proxima Centauri, 4.25 light-years off — and the Sun's whole cloud of comets, the frame you were just in, is three-quarters as wide as this line is long.",
    fact: "That last sentence is a trap worth walking into slowly, because the cloud is a sphere and this is a one-way trip. The Oort Cloud's <em>width</em> is three-quarters of the distance to Proxima; its <em>reach</em> — the Sun's centre out to its far edge — is half of that, about 100,000 times the Earth's distance from the Sun against Proxima's 268,000. So the comets get a bit over a third of the way and no further, and there is a clear gap between one star's territory and the next after all. The frame is drawn at the honest ratio: the cloud's radius really is 0.37 of this line. Voyager 1, the furthest thing we have ever thrown, has been going for nearly half a century and has covered about a fifteen-hundredth of it.",
  },
  {
    id: "galaxy",
    name: "The Milky Way",
    kicker: "One of a few hundred billion",
    size: 9.461e20,
    dim: "across",
    alt: "588 quadrillion miles, which is why nobody uses miles",
    box: [1, 0.45],
    tint: "#cbb489",
    lede: "A hundred thousand light-years of stars, and the last frame — the whole distance to the nearest one — is a twenty-thousandth of it.",
    fact: "There are somewhere between one and four hundred billion stars in it, and the Sun is about twenty-seven thousand light-years out from the middle, in a minor spur off one of the arms. It takes about 230 million years to go around once. The last time the Sun was where it is now, the first dinosaurs were only just appearing.",
    caveat: "A hundred thousand light-years is where the disc's stars thin out, not an edge — the Milky Way does not have one. The bright disc fades, a sparse stellar halo carries on well past it, and the dark matter goes further still. Choose a different place to stop counting and this rung is anything from 100,000 to nearly 200,000 light-years wide.",
  },
  {
    id: "localgroup",
    name: "The Local Group",
    kicker: "Our galaxy's neighbours",
    size: 9.461e22,
    dim: "across",
    alt: "a hundred Milky Ways end to end",
    box: [1, 0.75],
    tint: "#9aa6c4",
    lede: "About eighty galaxies, held together by their own gravity — but really just two big ones and a crowd of dwarfs.",
    fact: "The Milky Way and Andromeda are most of the mass here, and they are falling toward each other at about 110 kilometres a second. Whether they actually hit is no longer the settled story it was for twenty years. It turns on Andromeda's <em>sideways</em> motion, which is small, brutally hard to measure at two and a half million light-years, and the whole difference between a collision and a near miss — and a 2025 analysis using the best Gaia and Hubble numbers put the odds of a merger in the next ten billion years at not much better than a coin toss. Later work leans higher. If it does happen, almost nothing will hit anything: the stars are so far apart that the two galaxies would pass through each other like two clouds of gnats. The shapes would not survive it.",
    caveat: "The four-and-a-half-billion-year collision date you have probably seen — including on this page until recently — came from assuming Andromeda's sideways motion is near zero. Measuring it is the open problem, and until that settles, both the date and the collision itself are estimates rather than predictions.",
  },
  {
    id: "laniakea",
    name: "Laniakea",
    kicker: "The supercluster we are falling through",
    size: 4.92e24,
    dim: "across",
    alt: "five thousand Milky Ways end to end",
    box: [1, 0.8],
    tint: "#7f6fa8",
    lede: "A hundred thousand galaxies, defined in 2014 not by where they are but by which way they are moving.",
    fact: "The boundary is drawn where the flow changes direction: everything inside is drifting toward the same place, a gravitational low called the Great Attractor, and everything outside is drifting somewhere else. It is less a structure than a watershed. The name is Hawaiian for immeasurable heaven.",
    caveat: "Laniakea is not an object, and this is not the width of one. It is the region whose galaxies are all drifting the same way, drawn in 2014 out of a velocity field, and its boundary moves if you change the survey or the flow model behind it. It is also not held together: dark energy will pull this apart long before it could collapse into anything. A supercluster is a description of motion, not a thing you could arrive at the edge of.",
  },
  {
    id: "universe",
    name: "The observable universe",
    kicker: "The edge of what can be seen",
    size: 8.8e26,
    dim: "across",
    alt: "and the universe is only 13.8 billion years old",
    box: [1, 1],
    tint: "#6d7fb0",
    lede: "Ninety-three billion light-years across — not because the universe is that old, but because space has been stretching the whole time the light was in flight.",
    fact: "The universe is 13.8 billion years old, so the natural guess is that we can see 27.6 billion light-years across. But the space those photons crossed kept expanding while they crossed it, and the things that emitted them are now much further away than they were. This is the whole of what can be seen from here, today. It is not a fixed wall — the horizon creeps outward as more ancient light finishes its journey — and it is not a promise either, because the expansion is accelerating, and light setting out now from far enough away will never arrive at all. Whether there is more beyond it is not a question anybody can answer by looking. <em>There is no photograph of this frame and there cannot be one</em> — nobody has ever been outside it, and it has no outside. What is drawn is a composite of the kind the real visualizations are: galaxies reddening with distance because distance here is lookback time, filaments in the proportions the redshift surveys find, and at the rim <em>the actual thing</em> — WMAP's nine-year map of the cosmic microwave background, the oldest light there is, unwrapped from the ellipse it is usually printed as and laid back onto the shell it came off. Every other rung on this ladder grew out of the lumps in it.",
    caveat: "This is not the size of the universe. It is the size of the part close enough for light to have reached us, and the number itself comes out of a cosmological model rather than off a ruler. The universe itself may be far larger, and may be infinite. The shell is drawn at the rim for legibility, but the surface that light left sits a little inside the horizon, not on it — there were 380,000 years of opaque universe before anything could travel freely, and that is the gap. The frame is a visualization assembled from observations, not an image of the thing; there is no vantage outside this to photograph it from. The shell is real measured data (NASA / WMAP Science Team); the galaxies and filaments inside it are drawn from a seed rather than from a catalogue, and their reddening with distance is the only other physics in the picture.",
  },
];
