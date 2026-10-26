/* SCENE — what is behind Weather (weather.html), and the weather happening in it.
   ────────────────────────────────────────────────────────────────────────────
   Ric, 2026-10-25: "I want the background to be really cool … presets like in
   the forest, in the city, in the mountains, on the water, on the beach", then
   "scenes as in real pictures. Then weather happens in the scene."

   So a scene is a photograph (or the plain sky, which needs none), and in it
   this file plays what app.js says is overhead right now — in the picture, not
   over it (Ric, same day: "if its cloudy the picture should have it be cloudy
   … if its windy it should be kicking up dust"):
     the sky            real time-lapse footage, by the weather and the hour
                        (skies/, make-skies.py) — the drawn sky below is for a
                        clear night and for when footage cannot play
     cloud              fills the photo's own sky (its <id>-sky.png mask):
                        drifting cloud, then from 60% a grey ceiling until the
                        blue is gone; thick, wet cloud comes down over the tops
     rain and drizzle   streaks at the wind's slant, a grey veil in the air,
                        beads on the glass in front
     snow and sleet     flakes drifting with the wind, a white veil
     fog                each part lost by its distance at the measured visibility
                        — a haze, a ghost, or white only when it is that thick
     wind               from 18 km/h, what the ground gives up blows across it
                        — dust, sand, grit, spray, leaves; spindrift streams off
                        Cerro Torre's summits; rain lays the dust, snow blows
     storm              darker still, and strokes down through open sky to the land
     the photo itself   on the GPU: plants sway, near things shift as you move,
                        water ripples, the swash runs up the beach, leaves turn
                        with the season, wet ground shines, snow lies
     the night          a real Milky Way and the real moon; real lightning
     day and night      from the sun's real height at the place (astro.js): the
                        sky's colour, the land's light, stars as it darkens; the
                        sun and moon drawn where they are, the moon at its phase
   It never invents weather: with no reading (the whole-US view) it is calm.

   The picture is never the forecast's source and says nothing a card does not.
   Nothing here is fetched from anywhere but this site, nothing is sent, and the
   only thing kept is the visitor's choice (scene, moving or still) in their own
   localStorage.

   Cost: one canvas under the page, drawn at most 30 times a second, at most
   1.5× the screen's pixels, paused while the tab is hidden. "Moving weather"
   off, or the system's reduced-motion setting, draws a single still frame and
   no lightning.

   ── adding a scene ──
   Put the photo in assets/weather/scenes/<id>.jpg (about 1600 px on the long
   side, ~250 KB, metadata stripped — AGENTS.md hard rule 1), a small copy as
   <id>-thumb.jpg, and add one line to SCENES with its credit. Licences must
   allow reuse with credit; the credit shows in the settings sheet. */
(() => {
  "use strict";
  const root = document.getElementById("scene");
  if (!root) return;
  const photo = root.querySelector(".photo"), tint = root.querySelector(".tint"),
    cv = root.querySelector("canvas"), flashEl = root.querySelector(".flash");
  /* the photo's water, redrawn moving (drawWater): its own canvas between the
     photo and the light, carrying the photo's filter so it darkens with it */
  /* the same photo under overcast light (<id>-flat.jpg, scene-maps.py), faded
     in as the sky greys over and once the sun is down: no direct sun, no hard
     shadows — under a storm sky the rock no longer looks sunlit */
  const flatEl = document.createElement("div");
  flatEl.className = "photo flat";
  root.insertBefore(flatEl, photo.nextSibling);
  const waterCv = document.createElement("canvas");
  waterCv.className = "water";
  root.insertBefore(waterCv, tint);
  const wctx = waterCv.getContext("2d");
  const ctx = cv.getContext("2d");
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  /* `horizon` is where the sky ends in the picture, as a share of its height
     from the top: stars, the moon and lightning bolts stay above it. `sky:
     true` is the picture-less scene, which draws its own clouds and sun. */
  /* a big screen gets the 3000 px photo, a phone the 1600 px copy */
  const BIG = Math.max(screen.width || 0, screen.height || 0) * (window.devicePixelRatio || 1) > 1900;
  const SCENES = [
    { id: "sky", name: "Sky", sky: true, horizon: 1, say: "The sky's own colour, and the weather in it." },
    /* the photos: all from Wikimedia Commons, public domain or CC BY (never
       share-alike), resized to 1600 px and re-encoded with no metadata.
       `pos` keeps the subject in frame when a phone crops the sides. */
    scenePhoto("forest", "Forest", 0.1, "center",
      { title: "Bois Raquet, High Fens", by: "Trougnouf (Benoit Brummer)", licence: "CC BY 4.0",
        url: "https://commons.wikimedia.org/wiki/File:Bois_Raquet,_in_the_High_Fens_%E2%80%93_Eifel_Nature_Park_(DSCF6655).jpg" }),
    scenePhoto("mountains", "Mountains", 0.35, "45% center",
      { title: "Mylgval cirque, Western Caucasus", by: "Vyacheslav Argenberg", licence: "CC BY 4.0",
        url: "https://commons.wikimedia.org/wiki/File:Mountain_lake,_Mylgval_mountain_cirque,_Western_Caucasus.jpg" }),
    scenePhoto("city", "City", 0.3, "60% center",
      { title: "Montreal skyline", by: "Taxiarchos228", licence: "CC BY 3.0",
        url: "https://commons.wikimedia.org/wiki/File:Montreal_-_QC_-_Skyline.jpg" }),
    scenePhoto("water", "On the water", 0.35, "center",
      { title: "Lake Kinney and Mount Whitehorn", by: "Florian Fuchs", licence: "CC BY 3.0",
        url: "https://commons.wikimedia.org/wiki/File:Lake_Kinney_mit_Mount_Whitehorn.jpg" }),
    scenePhoto("beach", "Beach", 0.62, "center",
      { title: "Havelock Island, Andaman Islands", by: "Vyacheslav Argenberg", licence: "CC BY 4.0",
        url: "https://commons.wikimedia.org/wiki/File:Havelock_Island,_Mangrove_tree_on_the_beach,_Andaman_Islands.jpg" }),
    scenePhoto("crag", "At the crag", 0.1, "66% center",
      { title: "Colorado National Monument", by: "Victoria Stauffenberg, NPS", licence: "public domain",
        url: "https://commons.wikimedia.org/wiki/File:The_sandstone_cliffs_and_spires_of_Colorado_National_Monument_attract_hundreds_of_climbers_a_year._(9e8ceddd-0a94-4c97-82dd-ee36edf697c7).jpg" }),
    /* Ric, 2026-10-25: "cerro torre … what the weather would be like there if it
       was like the weather of where you are" — which is what every scene does */
    scenePhoto("torre", "Cerro Torre", 0.35, "38% center",
      { title: "Cerro Torre", by: "Alex Proimos", licence: "CC BY 2.0",
        url: "https://commons.wikimedia.org/wiki/File:Cerro_Torre_(5457586054).jpg" })
  ];
  function scenePhoto(id, name, horizon, pos, credit) {
    return { id, name, horizon, pos, credit, photo: `assets/weather/scenes/${id}${BIG ? "" : "-1600"}.jpg`, thumb: `assets/weather/scenes/${id}-thumb.jpg` };
  }

  let scene = SCENES.find((s) => s.id === store.get("wx:scene", "sky")) || SCENES[0];
  let moving = store.get("wx:motion", true) !== false;
  let W = 0, H = 0, DPR = 1;
  let st = null;            // what is overhead, from app.js
  let fx = null;            // what that means on screen
  let parts = [], drops = [], stars = [];
  let forced = null;        // WxScene.preview: a weather to look at that is not happening
  let raf = 0, lastT = 0, nextFlash = 0, flashT = -1, bolt = null;

  const animated = () => moving && !reduced.matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ── the light: from the sun's real height at the place ──
     Ric, 2026-10-25: "night and day needs to be implemented … the moon also
     needs to be what it is based on the location. and the sun." With the place
     (astro.js) the light follows the sun's altitude: day above 10°, golden hour
     to 0°, the twilights to −12°, night below — `dark` and `warm` change
     smoothly through them, so dusk comes on as it does outside. The sun and the
     moon (its phase, and its lit side turned as it looks from that latitude) are
     drawn where they are. Without a place it falls back on the day's times. */
  const DEG = Math.PI / 180;
  function phaseOf(s) {
    if (s && Number.isFinite(s.lat) && Number.isFinite(s.lon) && window.WxAstro) {
      const t = Number.isFinite(s.at) ? s.at : Date.now();
      const A = window.WxAstro, su = A.sun(t, s.lat, s.lon), mo = A.moon(t, s.lat, s.lon), ml = A.moonLight(t);
      const elev = su.alt / DEG;
      const morning = Math.sin(su.az) > 0;                       // the sun in the east
      const name = elev >= 10 ? "day" : elev >= 0 ? (morning ? "dawn" : "golden") : elev >= -12 ? (morning ? "dawn" : "dusk") : "night";
      return { name, elev, sun: null, at: t, lat: s.lat,
        dark: clamp((2 - elev) / 16, 0, 1),                      // 0 by day … 1 from 14° below
        warm: clamp(1 - Math.abs(elev - 1) / 10, 0, 1),          // the low sun's colour, most at sunrise and sunset
        sunPos: su, moon: { alt: mo.alt, az: mo.az, pa: mo.pa, fraction: ml.fraction, phase: ml.phase, limb: A.limb(t, s.lat, s.lon) } };
    }
    return phaseByClock(s);
  }
  function phaseByClock(s) {
    const now = Date.now() / 1000;
    const shape = (p) => Object.assign(p, { dark: p.name === "night" ? 1 : p.name === "dawn" || p.name === "dusk" ? 0.6 : 0, warm: p.name === "golden" ? 0.7 : p.name === "dawn" || p.name === "dusk" ? 0.8 : 0 });
    if (!s || !s.rise || !s.set) return shape({ name: s && s.isDay === false ? "night" : "day", sun: 0.5 });
    const M = 60;
    if (now < s.rise - 40 * M || now > s.set + 45 * M) return shape({ name: "night", sun: null });
    if (now < s.rise + 50 * M) return shape({ name: "dawn", sun: 0 });
    if (now > s.set) return shape({ name: "dusk", sun: 1 });
    const sun = (now - s.rise) / (s.set - s.rise);
    return shape({ name: now > s.set - 80 * M ? "golden" : "day", sun });
  }

  /* ── what the reading means on screen ── */
  function effects(s) {
    if (!s) return { kind: "calm", phase: { name: "day", sun: 0.5 }, rain: 0, snow: 0, fog: 0, cloud: 0.3, wind: 0, blow: 0, gusty: false, dirX: 0, storm: false, stars: 0 };
    const k = s.kind;
    const rate = Math.max(0, s.rate || 0);
    const wetK = k === "rain" || k === "drizzle" || k === "storm" || k === "sleet";
    /* how hard it comes down: a rate when there is one, the kind when the rate says 0 */
    const level = (r) => r >= 7.6 ? 1.6 : r >= 2.5 ? 1 : r >= 0.5 ? 0.6 : r > 0 ? 0.35 : 0;
    const rain = wetK ? Math.max(level(rate), k === "drizzle" ? 0.25 : k === "storm" ? 0.9 : 0.45) : 0;
    const snow = k === "snow" ? Math.max(level(rate) * 0.9, 0.5) : k === "sleet" ? 0.35 : 0;
    /* fog is how far you can see, not the word for it: a fog report with no
       distance is taken as 800 m. `fog` is how much a thing 1 km off is lost
       (Koschmieder: what is left is e^(−3.9·d/V)); the scene works out each
       part of the picture from its own distance (DEPTH). Past 10 km, none. */
    const vis = s.vis == null ? (k === "fog" ? 800 : 20000) : Math.max(20, s.vis);
    const fog = vis >= 10000 ? 0 : 1 - Math.exp(-3.912 * 1000 / vis);
    const cloud = clamp((s.cloud == null ? (k === "cloudy" ? 90 : k === "partly" ? 45 : k === "clear" ? 5 : 80) : s.cloud) / 100, 0, 1);
    const wind = Math.max(0, s.wind || 0);                       // km/h
    /* what the wind picks up: nothing below a breeze of 18 km/h (11 mph),
       everything it can carry by 60 (37 mph); a gust counts for most of itself */
    const gust = Math.max(0, s.gust || 0);
    const blow = clamp((Math.max(wind, gust * 0.85) - 18) / 42, 0, 1);
    const gusty = gust > wind + 12;
    /* the wind's "from" direction, turned into which way things blow across the screen */
    const dirX = s.windDir == null ? 0.3 : -Math.sin(s.windDir * Math.PI / 180);
    let phase = phaseOf(s);
    /* without a place, the reading's own day or night wins over the clock: the
       times are a day's, and a reading at the edge of one should not light a dark sky */
    if (phase.elev == null) {
      if (s.isDay === false && phase.name !== "night" && phase.name !== "dusk" && phase.name !== "dawn") phase = phaseByClock(null), phase = Object.assign(phase, { name: "night", dark: 1, warm: 0 });
      else if (s.isDay === true && phase.name === "night") phase = Object.assign(phaseByClock(null), { name: "day" });
    }
    /* stars come out as the sky darkens, under clear sky only */
    const stars = clamp((phase.dark - 0.55) / 0.4, 0, 1) * clamp(1 - cloud * 1.15, 0, 1) * (rain || snow ? 0 : 1) * (1 - fog);
    return { kind: k, phase, rain, snow, fog, vis, cloud, wind, windDir: s.windDir, blow, gusty, dirX, storm: k === "storm", stars };
  }

  /* how much the light is overcast light: grey cloud, rain, snow, fog, a storm,
     or the sun below the horizon */
  function overcast(f) {
    const P = f.phase, sunDown = P.elev != null ? clamp((3 - P.elev) / 8, 0, 1) : P.dark;
    return Math.max(clamp((f.cloud - 0.55) / 0.35, 0, 1), f.rain || f.snow || f.storm ? 1 : 0, clamp((f.fog - 0.2) / 0.3, 0, 1), sunDown);
  }
  /* ── the picture: a filter and a colour over it ── */
  function paintStill() {
    const f = fx;
    const ph = f.phase.name;
    root.dataset.phase = ph;
    root.dataset.scene = scene.id;
    root.classList.toggle("hasphoto", !!scene.photo);
    if (scene.photo) {
      const want = `url("${scene.photo}")`;
      if (photo.style.backgroundImage !== want) photo.style.backgroundImage = want;
      photo.style.backgroundPosition = scene.pos || "center";
      /* daylight on the picture: the more cloud, the flatter and darker; the
         lower the sun, the darker; a storm darker still */
      const wet = f.rain || f.snow, P = f.phase;
      /* the overcast photo (flatEl) carries most of what cloud does to the light
         now; this only takes the edge off, or a bright day reads as dusk */
      let b = 1 - f.cloud * 0.1 - (wet ? 0.12 : 0) - (f.storm ? 0.16 : 0);
      let sat = 1 - f.cloud * 0.35 - (wet ? 0.15 : 0) - f.fog * 0.3;
      /* the land goes dark with the sky; a high moon in a clear sky gives some back */
      const m = P.moon, moonlit = m && m.alt > 0 ? m.fraction * Math.min(1, m.alt / (25 * DEG)) * (1 - f.cloud) : 0;
      b *= 1 - P.dark * (0.74 - moonlit * 0.14);
      sat *= 1 - P.dark * 0.5 + P.warm * 0.12 * (1 - P.dark);
      photo.style.filter = `brightness(${b.toFixed(2)}) saturate(${sat.toFixed(2)})`;
      waterCv.style.filter = flatEl.style.filter = glCv.style.filter = photo.style.filter;
      const fw = `url("assets/weather/scenes/${scene.id}-flat${BIG ? "" : "-1600"}.jpg")`;
      if (flatEl.style.backgroundImage !== fw) flatEl.style.backgroundImage = fw;
      flatEl.style.backgroundPosition = photo.style.backgroundPosition;
      flatEl.style.opacity = overcast(f).toFixed(2);
    } else {
      photo.style.backgroundImage = flatEl.style.backgroundImage = "";
      photo.style.filter = flatEl.style.filter = "";
      flatEl.style.opacity = "0";
    }
    grain.style.opacity = (0.26 + f.phase.dark * 0.22).toFixed(2);       // a camera's noise rises in the dark
    /* the colour of the light on the land: the low sun's warmth (less under
       cloud), the blue of twilight and night, the grey of a wet day */
    const P = f.phase, wa = P.warm * (1 - P.dark * 0.6) * (1 - f.cloud * 0.7), nb = P.dark;
    const grey = (f.cloud > 0.6 || f.rain || f.snow) && nb < 0.5 ? 0.12 : 0;
    tint.style.backgroundImage = [
      nb > 0.02 && `linear-gradient(180deg, rgba(4,10,40,${(nb * 0.45).toFixed(3)}), rgba(10,20,60,${(nb * 0.3).toFixed(3)}))`,
      wa > 0.02 && `linear-gradient(180deg, rgba(255,170,80,${(wa * 0.06).toFixed(3)}), rgba(255,130,60,${(wa * 0.24).toFixed(3)}) 75%, rgba(255,120,50,${(wa * 0.28).toFixed(3)}))`,
      grey && `linear-gradient(180deg, rgba(120,140,160,${grey}), rgba(60,75,95,${grey * 0.8}))`
    ].filter(Boolean).join(",") || "none";
  }

  /* ── where the sky is in the photo ──
     Ric, 2026-10-25: "if its cloudy the picture should have it be cloudy if its
     raining it should be raining … if its foggy it should have fog if its windy
     it should be kicking up dust". So the weather is drawn INTO the picture, not
     laid over it as a dimmer. <id>-sky.png (scene-maps.py) is the photo at 800 px
     with its sky in the alpha channel: cloud fills the sky through it, stars and
     the moon go only where it is sky, and a bolt comes down only through sky.
     The plain Sky scene is all sky. */
  function posOf(p) {
    const t = String(p || "center").split(/\s+/);
    const one = (v, d) => v == null ? d : /%$/.test(v) ? parseFloat(v) / 100 : ({ left: 0, top: 0, center: 0.5, right: 1, bottom: 1 })[v] ?? d;
    return [one(t[0], 0.5), one(t[1], 0.5)];
  }
  /* where the photo lands on the canvas: background-size cover at the scene's
     `pos`, then the .photo layer's scale(1.04) about its centre (weather.css) */
  function coverRect(iw, ih) {
    const s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
    const [px, py] = posOf(scene.pos), k = 1.04;
    const x = (W - dw) * px, y = (H - dh) * py;
    return { x: W / 2 + (x - W / 2) * k, y: H / 2 + (y - H / 2) * k, w: dw * k, h: dh * k };
  }
  const photoRect = () => { const m = maskOf(scene); return m ? coverRect(m.w, m.h) : coverRect(3, 2); };
  /* a scene's maps (scene-maps.py), each loaded once and the scene rebuilt
     when it lands: <id>-sky.png, <id>-water.png (images whose alpha says where),
     <id>-lights.json, and the photo itself for redrawing its water */
  const maps = {};
  function mapOf(sc, kind) {
    const key = `${sc.id}-${kind}`;
    let m = maps[key];
    if (!m) {
      m = maps[key] = { img: new Image(), data: null, w: 0, h: 0 };
      const done = () => { if (scene === sc && fx) { lastKey = ""; update(st); } };
      if (kind === "lights") {
        fetch(`assets/weather/scenes/${sc.id}-lights.json`).then((r) => r.ok ? r.json() : null)
          .then((j) => { if (j) { m.json = j; m.w = 1; done(); } }).catch(() => {});
        return null;
      }
      m.img.onload = () => {
        if (kind === "photo" || kind === "flat") { m.w = m.img.naturalWidth; m.h = m.img.naturalHeight; return done(); }
        try {
          const c = document.createElement("canvas");
          c.width = m.img.naturalWidth; c.height = m.img.naturalHeight;
          const x = c.getContext("2d");
          x.drawImage(m.img, 0, 0);
          m.data = x.getImageData(0, 0, c.width, c.height).data;
          m.w = c.width; m.h = c.height;
          if (kind === "water") waterStats(m);
        } catch (e) { m.data = null; }
        done();
      };
      m.img.src = kind === "photo" ? sc.photo : kind === "flat" ? `assets/weather/scenes/${sc.id}-flat${BIG ? "" : "-1600"}.jpg` : `assets/weather/scenes/${sc.id}-${kind}.png`;
    }
    return m.w ? m : null;
  }
  const maskOf = (sc) => sc.sky || !sc.photo ? null : mapOf(sc, "sky");
  /* where the water lies, and points on it for glints, whitecaps and rings */
  function waterStats(m) {
    let top = m.h, bottom = 0;
    const pts = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.data[(y * m.w + x) * 4 + 3] < 200) continue;
      if (y < top) top = y;
      bottom = y;
      if (Math.random() < 0.03) pts.push([x / m.w, y / m.h]);
    }
    m.top = top / m.h; m.bottom = (bottom + 1) / m.h; m.pts = pts;
  }
  /* how much the canvas pixel x, y is sky, 0 … 1 */
  function skyAt(x, y) {
    if (scene.sky) return y < H ? 1 : 0;
    const m = maskOf(scene);
    if (!m) return 0;
    const r = coverRect(m.w, m.h);
    const u = Math.floor((x - r.x) / r.w * m.w), v = Math.floor((y - r.y) / r.h * m.h);
    if (u < 0 || v < 0 || u >= m.w || v >= m.h) return 0;
    return m.data[(v * m.w + u) * 4 + 3] / 255;
  }
  /* how far down from the top the sky runs at x */
  function skyDepth(x) {
    const step = Math.max(4, H / 150);
    let y = 0;
    while (y < H && skyAt(x, y) > 0.5) y += step;
    return y;
  }

  /* ── cloud, fog and blown dust are one texture: tileable noise, made once ── */
  const NW = 320, NH = 160;
  let field = null, sorted = null, spread = 0.1;
  function noise() {
    if (field) return field;
    field = new Float32Array(NW * NH);
    let amp = 1, tot = 0;
    for (let o = 0; o < 5; o++) {
      const gx = 3 << o, gy = Math.max(2, gx >> 1);
      const g = new Float32Array(gx * gy);
      for (let i = 0; i < g.length; i++) g[i] = Math.random();
      for (let y = 0; y < NH; y++) {
        const py = y / NH * gy, y0 = Math.floor(py), ty = py - y0, sy = ty * ty * (3 - 2 * ty);
        const r0 = (y0 % gy) * gx, r1 = ((y0 + 1) % gy) * gx;
        for (let x = 0; x < NW; x++) {
          const px = x / NW * gx, x0 = Math.floor(px), tx = px - x0, sx = tx * tx * (3 - 2 * tx);
          const a = x0 % gx, b = (x0 + 1) % gx;
          const top = g[r0 + a] + (g[r0 + b] - g[r0 + a]) * sx, bot = g[r1 + a] + (g[r1 + b] - g[r1 + a]) * sx;
          field[y * NW + x] += (top + (bot - top) * sy) * amp;
        }
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < field.length; i++) field[i] /= tot;
    sorted = Float32Array.from(field).sort();
    /* how much it varies, so a cloud's soft edge is the same share of the
       texture whatever the noise came out as (a fixed width blurred 10% cover
       into haze over the whole sky) */
    spread = sorted[Math.floor(sorted.length * 0.84)] - sorted[Math.floor(sorted.length * 0.16)];
    return field;
  }
  /* a texture from the noise with `cover` of it filled: thick parts `lo`, thin
     edges `hi`, alpha up to `a`. `fade` bakes in [top, bottom] shares of the
     height that fade to nothing; `shift` and `flip` keep two layers from being
     the same shape; `soft` is the edge's width as a share of the noise's own
     spread. Tileable left to right. */
  function tex(cover, lo, hi, a, { fade = null, soft = 0.3, shift = 0, flip = false } = {}) {
    const n = noise();
    const t = sorted[clamp(Math.floor((1 - cover) * sorted.length), 0, sorted.length - 1)];
    const sw = soft * spread, deep = spread * 0.9;
    const c = document.createElement("canvas");
    c.width = NW; c.height = NH;
    const x = c.getContext("2d"), im = x.createImageData(NW, NH), d = im.data;
    for (let y = 0; y < NH; y++) {
      const fy = y / (NH - 1);
      let f = 1;
      if (fade && fade[0] && fy < fade[0]) f = fy / fade[0];
      if (fade && fade[1] && fy > 1 - fade[1]) f = Math.min(f, (1 - fy) / fade[1]);
      const row = (flip ? NH - 1 - y : y) * NW;
      for (let u = 0; u < NW; u++) {
        const v = n[row + (u + shift) % NW];
        const al = clamp((v - t + sw) / (2 * sw), 0, 1);
        const thick = clamp((v - t) / deep, 0, 1);
        const i = (y * NW + u) * 4;
        d[i] = hi[0] + (lo[0] - hi[0]) * thick;
        d[i + 1] = hi[1] + (lo[1] - hi[1]) * thick;
        d[i + 2] = hi[2] + (lo[2] - hi[2]) * thick;
        d[i + 3] = 255 * al * a * f;
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  /* draw a texture side by side across the canvas from `off` */
  function tiled(c, img, off, y, w, h) {
    for (let x = ((off % w) + w) % w - w; x < c.canvas.width; x += w) c.drawImage(img, x, y, w, h);
  }
  const shade = (c, k) => c.map((v) => Math.round(clamp(v * k, 0, 255)));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
  /* the colour of cloud and fog in this light and this weather */
  function light(f) {
    const ph = f.phase.name;
    const warm = ph === "golden" || ph === "dawn" || ph === "dusk";
    /* by the sun's height when there is one: an overcast night is a dim grey
       glow (towns, the moon behind it), not black */
    const k = f.phase.elev != null ? 0.34 + 0.66 * (1 - f.phase.dark) - (f.phase.warm > 0.3 && f.phase.dark < 0.5 ? 0.08 : 0)
      : ph === "night" ? 0.34 : ph === "dawn" || ph === "dusk" ? 0.55 : ph === "golden" ? 0.92 : 1;
    const grey = f.storm ? 0.42 : f.rain || f.snow ? 0.64 : f.cloud > 0.85 ? 0.78 : f.cloud > 0.6 ? 0.9 : 1;
    let hi = [255, 255, 255], lo = [192, 200, 214];
    if (warm) { hi = [255, 210, 176]; lo = [170, 146, 160]; }
    if (ph === "night") { hi = [150, 158, 182]; lo = [100, 106, 128]; }
    /* over a city at night the cloud's underside takes the streets' orange */
    if (GLOW[scene.id] && f.phase.dark > 0.3) {
      const t = (f.phase.dark - 0.3) / 0.7 * 0.6;
      hi = hi.map((v, i) => v + (GLOW[scene.id][i] - v) * t); lo = lo.map((v, i) => v + (GLOW[scene.id][i] * 0.75 - v) * t);
    }
    hi = shade(hi, k * grey); lo = shade(lo, k * grey * (f.storm ? 0.7 : 0.88));
    return { hi, lo, mid: hi.map((v, i) => Math.round((v + lo[i]) / 2)),
      fog: shade(ph === "night" ? [70, 78, 94] : warm ? [214, 196, 192] : [218, 224, 230], ph === "night" ? 1 : k * (f.rain ? 0.85 : 1)) };
  }

  /* ── clouds ──
     Ric, 2026-10-25: "the clouds … doesnt look realistic so spend more time
     making it look good". The first clouds were one blurred noise stretched
     across the sky with flat colour. These are:
       shapes   swirled noise (fractal noise whose coordinates are themselves
                pushed about by noise), made once — billowy heaps for fair
                cumulus, broad lumpy sheets for overcast, thin streaks for cirrus
       light    each texture lit for the moment: thick middles are the dim flat
                bases you see from below, thin edges and the side towards the
                sun bright; at sunset the undersides go orange and pink, at
                night they take the moon's grey or a city's orange
       place    drawn on a plane overhead in perspective — big above you, small
                and crowded towards the horizon, fading into its haze — and
                carried by the wind across and towards or away from you */
  const CN = 384;
  let cloudF = null, cloudQ = null, cloudSpread = 0.12;
  function lattices(n, g0) {
    const out = [];
    for (let o = 0, g = g0; o < n; o++, g *= 2) { const v = new Float32Array(g * g); for (let i = 0; i < v.length; i++) v[i] = Math.random(); out.push({ g, v }); }
    return out;
  }
  function fbmAt(L, u, v) {
    let sum = 0, amp = 1, tot = 0;
    for (const { g, v: a } of L) {
      const x = u * g, y = v * g, x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const xa = ((x0 % g) + g) % g, xb = (xa + 1) % g, ya = ((y0 % g) + g) % g, yb = (ya + 1) % g;
      const p = a[ya * g + xa], q = a[ya * g + xb], r = a[yb * g + xa], s = a[yb * g + xb];
      const top = p + (q - p) * sx, bot = r + (s - r) * sx;
      sum += (top + (bot - top) * sy) * amp; tot += amp; amp *= 0.5;
    }
    return sum / tot;
  }
  function cloudField() {
    if (cloudF) return cloudF;
    const base = lattices(6, 3), wx = lattices(3, 2), wy = lattices(3, 2);
    cloudF = new Float32Array(CN * CN);
    for (let y = 0; y < CN; y++) for (let x = 0; x < CN; x++) {
      const u = x / CN, v = y / CN;
      const du = (fbmAt(wx, u, v) - 0.5) * 0.35, dv = (fbmAt(wy, u, v) - 0.5) * 0.35;
      cloudF[y * CN + x] = fbmAt(base, ((u + du) % 1 + 1) % 1, ((v + dv) % 1 + 1) % 1);
    }
    cloudQ = Float32Array.from(cloudF).sort();
    cloudSpread = cloudQ[Math.floor(CN * CN * 0.84)] - cloudQ[Math.floor(CN * CN * 0.16)];
    return cloudF;
  }
  /* a cloud texture: `kind` cumulus | stratus | cirrus, `cover` 0…1, coloured
     from `lit` (thin, sunward) to `base` (thick, the underside), the sun to the
     left (−1) or right (+1) */
  function cloudTex(kind, cover, lit, base, sunX, alphaMax) {
    const F = cloudField(), c = document.createElement("canvas");
    c.width = c.height = CN;
    const x2 = c.getContext("2d"), im = x2.createImageData(CN, CN), d = im.data;
    const W8 = (v) => ((v % CN) + CN) % CN, raw = (x, y) => F[W8(y) * CN + W8(x)];
    /* cumulus get a finer billowing on top of their shape — the same field at
       twice the scale, folded so it puffs (1 − |2n − 1|) — the cauliflower edge
       a heap has; cirrus are the field squeezed four times top to bottom (whole
       numbers, so it still tiles), long thin strands */
    const at = kind === "cirrus" ? (x, y) => raw(x, y * 4)
      : kind === "cumulus" ? (x, y) => raw(x, y) + 0.16 * cloudSpread * (1 - Math.abs(2 * raw(x * 2, y * 2) - 1) - 0.5)
      : raw;
    const t = cloudQ[clamp(Math.floor((1 - cover) * cloudQ.length), 0, cloudQ.length - 1)];
    const S = cloudSpread, soft = (kind === "cumulus" ? 0.14 : kind === "cirrus" ? 0.5 : 0.7) * S;
    const lx = Math.round(sunX * 5);
    for (let y = 0; y < CN; y++) for (let x = 0; x < CN; x++) {
      const n = at(x, y);
      let a = clamp((n - t + soft) / (2 * soft), 0, 1);
      a = a * a * (3 - 2 * a);
      if (a <= 0.002) continue;
      const dens = clamp((n - t) / (S * 0.9), 0, 1);
      /* lower on the screen is nearer the horizon, where you see a heap's side:
         with cloud above it on the screen a pixel is in the heap's lower part,
         its base, and dim; the sunward side and the thin edges catch the light */
      const above = clamp((at(x + lx, y - 5) - t) / (S * 0.9), 0, 1);
      let sh;
      if (kind === "cumulus") sh = clamp(0.12 + above * 0.55 + dens * 0.3 - (1 - dens) * 0.2, 0, 1);
      else if (kind === "stratus") sh = clamp(0.45 + (n - t) / S * 0.35 + above * 0.15, 0, 1);
      else sh = 0.15;
      const i = (y * CN + x) * 4;
      d[i] = lit[0] + (base[0] - lit[0]) * sh;
      d[i + 1] = lit[1] + (base[1] - lit[1]) * sh;
      d[i + 2] = lit[2] + (base[2] - lit[2]) * sh;
      d[i + 3] = 255 * Math.min(1, a * (kind === "stratus" ? 1.25 : 1)) * alphaMax;
    }
    x2.putImageData(im, 0, 0);
    return c;
  }
  /* the colour of cloud for the sun's height and the weather: the lit side and
     the underside */
  function cloudColours(f) {
    const P = f.phase, e = P.elev ?? (P.name === "night" ? -20 : P.name === "day" ? 30 : P.name === "golden" ? 6 : -3);
    const K = [[12, [255, 255, 255], [176, 186, 202]], [4, [255, 232, 196], [178, 170, 184]], [0, [255, 176, 112], [158, 116, 132]],
      [-4, [232, 138, 120], [104, 86, 112]], [-9, [120, 104, 140], [52, 54, 80]], [-14, [62, 68, 92], [30, 34, 48]]];
    let lit = K[K.length - 1][1], base = K[K.length - 1][2];
    if (e >= K[0][0]) { lit = K[0][1]; base = K[0][2]; }
    else for (let i = 0; i < K.length - 1; i++) {
      const [e0, l0, b0] = K[i], [e1, l1, b1] = K[i + 1];
      if (e <= e0 && e >= e1) { const k = (e0 - e) / (e0 - e1); lit = l0.map((v, j) => v + (l1[j] - v) * k); base = b0.map((v, j) => v + (b1[j] - v) * k); break; }
    }
    /* a full moon lights cloud a little; a city's streets light its underside */
    if (P.dark > 0.6 && P.moon && P.moon.alt > 0) { const m = P.moon.fraction * 0.35 * (P.dark - 0.6) / 0.4; lit = lit.map((v, j) => v + ([150, 160, 186][j] - v) * m); }
    if (GLOW[scene.id] && P.dark > 0.3) { const g = (P.dark - 0.3) / 0.7 * 0.55; base = base.map((v, j) => v + (GLOW[scene.id][j] * 0.62 - v) * g); lit = lit.map((v, j) => v + (GLOW[scene.id][j] * 0.75 - v) * g * 0.6); }
    /* wet and heavy cloud is greyer and darker; a storm's is darkest */
    const wet = f.storm ? 0.45 : f.rain || f.snow ? 0.66 : f.cloud > 0.85 ? 0.82 : 1;
    const flat = f.storm || f.rain || f.snow ? 0.55 : f.cloud > 0.85 ? 0.35 : 0;   // overcast light is flat: lit and base closer
    lit = lit.map((v, j) => (v + (base[j] - v) * flat * 0.6) * wet);
    base = base.map((v) => v * wet * (f.storm ? 0.8 : 1));
    return { lit: lit.map(Math.round), base: base.map(Math.round) };
  }
  /* build the cloud layers for this reading */
  function buildClouds(f, hy) {
    const C = cloudColours(f), P = f.phase;
    let sunX = 0;
    const sp = P.sunPos && P.sunPos.alt > -0.1 ? skyPoint(P.sunPos.az, Math.max(0, P.sunPos.alt)) : null;
    if (sp) sunX = clamp((sp.x - W / 2) / (W / 2), -1, 1);
    /* the wind carries them: across the screen, and towards or away from you */
    const view = (P.lat ?? 1) >= 0 ? Math.PI : 0, to = ((f.windDir ?? 270) + 180) * DEG;
    const speed = 0.5 + clamp(f.wind, 0, 110) * 0.12;                 // texture px a second
    const vu = -speed * f.dirX, vv = -speed * Math.cos(to - view);
    const wet = f.rain || f.snow || f.storm;
    /* a photo looks at the far sky, near its horizon, where cloud is small — the
       photos' own clouds are; the plain Sky looks straight up */
    const z = scene.sky ? 1 : 0.5;
    const out = [];
    /* high cirrus on a fair day */
    if (!wet && f.cloud > 0.08 && f.cloud < 0.7 && P.dark < 0.85) {
      out.push({ img: cloudTex("cirrus", 0.22, C.lit, C.lit.map((v) => v * 0.92), sunX, 0.22), s0: 1.7 * z * W / CN, offU: rnd(0, CN), offV: rnd(0, CN), vu: vu * 0.5, vv: vv * 0.5, alpha: 1 });
    }
    /* a ceiling once it is mostly cloudy: the whole sky, lit unevenly, moving */
    if (f.cloud > 0.7) {
      out.push({ img: cloudTex("stratus", 1, C.lit, C.base, sunX, 1), s0: 1.5 * z * W / CN, offU: rnd(0, CN), offV: rnd(0, CN), vu: vu * 0.8, vv: vv * 0.8,
        alpha: clamp((f.cloud - 0.7) / 0.22, 0, 1) });
    }
    /* the main layer: heaps on a fair day, lumpy sheets when it is wet or grey */
    if (f.cloud > 0.03) {
      const kind = wet || f.cloud > 0.75 ? "stratus" : "cumulus";
      out.push({ img: cloudTex(kind, Math.min(0.97, f.cloud), C.lit, C.base, sunX, kind === "cumulus" ? 1 : 0.92), s0: (kind === "cumulus" ? 1.25 : 1.4) * z * W / CN,
        offU: rnd(0, CN), offV: rnd(0, CN), vu, vv, alpha: 1 });
    }
    return { layers: out, hy, haze: C.base.map((v, j) => Math.round((v + C.lit[j]) / 2)) };
  }
  /* one layer on the plane overhead: each screen row a strip of the texture,
     scaled for its distance — 1 at the top, growing towards the horizon `hy` */
  /* far rows squeeze many texture pixels into one screen pixel and shimmer
     into stripes; they read from a smaller, smoothed copy instead (each half
     the size of the last) */
  function mips(img) {
    const out = [img];
    for (let k = 1, src = img; k <= 4; k++) {
      const c = document.createElement("canvas");
      c.width = c.height = CN >> k;
      const x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(src, 0, 0, c.width, c.height);
      out.push(c); src = c;
    }
    return out;
  }
  function drawPlane(s, L, hy, dt) {
    L.offU = (L.offU + L.vu * dt) % CN; L.offV = (L.offV + L.vv * dt) % CN;
    if (!L.pats) L.pats = mips(L.img).map((m) => s.createPattern(m, "repeat"));
    const step = Math.max(2, Math.round(2 * DPR)), A0 = 1 / L.s0;
    for (let y = 0, end = Math.min(hy - step, H); y < end; y += step) {
      const d = hy - y, q = hy / d, A = A0 * q, dv = A0 * q * q, v = L.offV + A0 * hy * q;
      const lv = clamp(Math.floor(Math.log2(Math.max(A, dv * step))), 0, 4), k = 1 << lv;
      const pat = L.pats[lv];
      pat.setTransform(new DOMMatrix([k / A, 0, 0, k / dv, W / 2 - L.offU / A, y - v / dv]));
      s.fillStyle = pat;
      /* far off, cloud thins into the horizon's haze */
      const f = clamp(d / (hy * 0.35), 0, 1);
      s.globalAlpha = L.alpha * (0.08 + 0.92 * f * f * (3 - 2 * f));
      s.fillRect(0, y, W, step);
    }
    s.globalAlpha = 1;
  }

  /* what the wind picks up in each picture. Rain lays dust, sand, grit and
     lying snow: in the wet only spray and leaves still blow. While it snows, everything
     blowing is snow. `peaks` are summits (shares of the photo) that stream
     spindrift in a wind — Cerro Torre, Torre Egger, Punta Herron and Standhardt. */
  /* scenes with water that moves, and with a town's light at night */
  const WET = new Set(["beach", "mountains", "water"]);
  const SHORE = new Set(["beach"]);              // the swash runs up its sand (<id>-shore.png)
  const GLOW = { city: [255, 160, 90] };
  const GROUND = {
    crag: { kind: "dust", col: [204, 134, 92] },
    mountains: { kind: "dust", col: [182, 166, 136] },
    city: { kind: "grit", col: [176, 172, 164] },
    beach: { kind: "sand", col: [238, 220, 178] },
    water: { kind: "spray", col: [232, 242, 252] },
    forest: { kind: "leaves", col: [176, 122, 52] },
    torre: { kind: "snow", col: [246, 249, 255], peaks: [[0.375, 0.07], [0.47, 0.235], [0.6, 0.35]] }
  };
  /* how far off each picture's back and front look, km, for fog: Ric — "fog
     shouldnt be full whiteout unless thats what its like". Fog takes the far
     side first. These are apparent distances, about a third of the real ones:
     the photos already carry their own day's haze, and the e^(−3.9·d/V) rule
     is for a black target, while snow and pale rock show through far longer.
     Measured on Cerro Torre, 2026-10-25: with the real ~4 km, 8 km visibility
     (a hazy day) took 86% of it; at 1.2 km it is a haze at 8 km (44%), mostly
     gone at 2 km (90%), white under 1 km. The crag's wall stays until the fog
     is thick (15% at 2 km, 65% at 300 m). */
  const DEPTH = { sky: [2, 1], torre: [1.2, 0.35], mountains: [1, 0.1], city: [1.2, 0.15], water: [1.2, 0.04], beach: [1.8, 0.02], crag: [0.08, 0.03], forest: [0.15, 0.008] };
  const LEAVES = [[226, 160, 62], [204, 120, 44], [176, 184, 74], [238, 194, 96]];
  function blowing(f) {
    const g = GROUND[scene.id];
    if (!g || !f.blow) return null;
    if (f.snow) return { kind: "snow", col: [244, 248, 255] };
    if (f.rain && (g.kind === "dust" || g.kind === "grit" || g.kind === "sand" || g.kind === "snow")) return null;
    return g;
  }

  /* ── the moving parts ── */
  let layers = {}, dust = [], plume = [], skyCv = null, horizon = [];
  function build() {
    const f = fx;
    const area = (W * H) / (DPR * DPR);
    const small = W / DPR < 640;
    parts = []; drops = []; stars = []; dust = []; plume = []; layers = {};
    bolt = null; flashT = -1; flashEl.style.opacity = "0";             // a strike belongs to the sky it was in
    const wx = f.dirX * clamp(f.wind / 40, 0, 1.4);            // slant, -1.4 … 1.4
    const dir = f.dirX >= 0 ? 1 : -1;
    if (f.rain) {
      const n = Math.round(clamp(area / (small ? 1800 : 1250) * f.rain, 30, small ? 340 : 700));
      for (let i = 0; i < n; i++) {
        const z = Math.random();                                 // 0 far … 1 near
        parts.push({ type: "r", x: rnd(-0.2, 1.2) * W, y: rnd(0, 1) * H, z,
          len: (12 + z * 22) * DPR * (0.7 + f.rain * 0.3), v: (800 + z * 800) * DPR, vx: wx * (260 + z * 300) * DPR, a: 0.2 + z * 0.36 });
      }
      /* beads on the glass in front: a few, and now and then one runs */
      const nd = Math.round(clamp(area / 26000 * Math.min(1.2, f.rain + 0.3), 6, 34));
      for (let i = 0; i < nd; i++) drops.push(newDrop(true));
    }
    if (f.snow) {
      const n = Math.round(clamp(area / (small ? 2600 : 1800) * f.snow, 40, small ? 280 : 560));
      for (let i = 0; i < n; i++) {
        const z = Math.random();
        parts.push({ type: "s", x: rnd(0, 1) * W, y: rnd(0, 1) * H, z, r: (0.8 + z * 2.8) * DPR,
          v: (25 + z * 55) * DPR, vx: wx * (60 + z * 90) * DPR, ph: rnd(0, 6.28), a: 0.5 + z * 0.5 });
      }
    }
    const sky = scene.sky || maskOf(scene);
    if (f.stars && sky) {
      const n = Math.round(clamp(area / 5200, 60, 260) * f.stars);
      for (let i = 0, tries = 0; i < n && tries < n * 12; tries++) {
        const x = rnd(0, W), y = Math.pow(Math.random(), 1.2) * H * 0.75;
        if (skyAt(x, y) < 0.7) continue;
        stars.push({ x, y, r: (Math.random() < 0.08 ? 2 : rnd(0.8, 1.4)) * DPR, a: rnd(0.35, 0.95) * (1 - y / H) + 0.1, tw: rnd(0.4, 1.6), ph: rnd(0, 6.28) });
        i++;
      }
    }
    /* where the land's edge is across the screen, for putting the sun and moon
       at their height above it and setting them behind it */
    horizon = [];
    if (sky) for (let i = 0; i <= 32; i++) horizon.push(scene.sky ? H * 0.8 : skyDepth(W * i / 32));
    const L = light(f);
    /* cloud in the sky: two layers drifting at their own speeds, and from 60%
       cover a grey ceiling filling in behind them until the blue is gone */
    if (sky) {
      let d = 0;
      if (scene.sky) d = H * 0.8;
      else for (const y of horizon) d = Math.max(d, y);
      layers.skyH = Math.max(H * 0.25, d);
    }
    /* cloud on a plane overhead, its horizon a little below where the land
       meets the sky so it runs on behind the mountains; it goes by at the
       wind's speed ("if its windy and cloudy you see the clouds move") */
    /* the plane's horizon sits well below the screen's land line, as when you
       look up at the sky: set just under it, nearly everything you see was the
       most foreshortened part and heaps came out as streaks */
    if (sky && f.cloud > 0.03) layers.clouds = buildClouds(f, scene.sky ? H * 1.5 : Math.max(H * 0.75, layers.skyH * 2));
    /* a real sky when there is one for this weather and hour (the drawn
       clouds above stay ready in case the footage cannot play) */
    layers.sky = sky ? chooseSky(f) : null;
    /* low cloud: thick, wet cloud comes down over the tops — Cerro Torre's
       spire goes into it first. Only on photos: the plain Sky has no tops. */
    if (scene.photo) {
      const low = clamp(clamp((f.cloud - 0.72) / 0.28, 0, 1) * 0.5 + (f.rain ? 0.22 + f.rain * 0.1 : 0) + (f.snow ? 0.3 : 0) + (f.storm ? 0.2 : 0) + f.fog * 0.3, 0, 1);
      if (low > 0.05) layers.deck = { img: tex(0.84, L.lo, L.hi, 0.95, { fade: [0, 0.6], soft: 0.5, shift: 211 }), low, off: rnd(0, W), v: (3 + clamp(f.wind, 0, 100) * 0.7) * DPR * dir };
    }
    /* fog: a veil, and banks moving through it */
    if (f.fog > 0.02) {
      const [far, near] = DEPTH[scene.id] || DEPTH.sky;
      const lost = (km) => 1 - Math.exp(-3.912 * km * 1000 / f.vis);
      layers.fog = { img: tex(0.78, shade(L.fog, 0.9), L.fog, 1, { fade: [0.3, 0.2], soft: 0.9, shift: 41 }), col: L.fog,
        far: lost(far), near: lost(near), off: rnd(0, W), v: (3 + clamp(f.wind, 0, 40) * 0.6) * DPR * dir };
    }
    /* wind: what it picks up blows across the ground */
    const g = blowing(f);
    if (g) {
      const b = f.blow;
      /* dust in the air is paler than the ground it came off: the sheets are
         the ground's colour lifted towards white, or they vanish against it
         (the crag's red dust over red rock, the beach's sand over sand) */
      const air = g.col.map((v) => Math.round(v + (255 - v) * 0.3));
      if (g.kind !== "leaves") {
        layers.sheet = { img: tex(0.55, g.col, air, 0.8, { fade: [0.45, 0.15], soft: 0.7, shift: 133 }),
          off: rnd(0, W), v: (90 + b * 420) * DPR * dir, a: b * ({ dust: 0.85, grit: 0.7, sand: 0.8, spray: 0.6, snow: 0.7 })[g.kind] };
      }
      /* and a brown-out: the low air goes the colour of what it carries */
      if (g.kind === "dust" || g.kind === "sand" || g.kind === "grit") layers.haze = { col: air, a: b * 0.24 };
      const n = Math.round(b * clamp(area / 4000, 40, small ? 160 : 280) * (g.kind === "leaves" ? 0.45 : 1));
      for (let i = 0; i < n; i++) dust.push(newMote(g, b, dir, true));
      layers.blow = g;
      /* spindrift off the summits, made a few seconds ahead so a still frame has it */
      if (scene.photo && (GROUND[scene.id] || {}).peaks && (g.kind === "snow" || g.kind === "spindrift")) {
        layers.peaks = GROUND[scene.id].peaks;
        for (let t = 0; t < 6; t += 1 / 15) stepPlume(1 / 15);
      }
    }
    /* the water: the photo's own, redrawn rippling; how rough from the wind and rain */
    layers.water = null;
    if (WET.has(scene.id)) {
      const wm = mapOf(scene, "water"), ph = mapOf(scene, "photo");
      if (wm && ph && wm.pts) {
        const mr = coverRect(wm.w, wm.h), pr = coverRect(ph.w, ph.h);
        const y0 = Math.max(0, mr.y + wm.top * mr.h), y1 = Math.min(H, mr.y + wm.bottom * mr.h);
        const pts = wm.pts.map(([u, v]) => [mr.x + u * mr.w, mr.y + v * mr.h]).filter(([x, y]) => x > 0 && x < W && y > 0 && y < H)
          .map(([x, y]) => [x, y, clamp((y - y0) / Math.max(1, y1 - y0), 0, 1), rnd(2, 7), rnd(0, 6.28)]);
        const fl = overcast(f) > 0.5 && mapOf(scene, "flat");
        layers.water = { mask: wm, mr, img: fl ? fl.img : ph.img, pr, y0, y1, pts, caps: [], rings: [],
          rough: clamp(f.wind / 45, 0, 1.3) + f.rain * 0.25 + (f.storm ? 0.3 : 0) };
      }
    }
    /* the city's windows and tower tops, lit after dark */
    layers.city = null;
    const lj = GLOW[scene.id] && mapOf(scene, "lights");
    if (lj && lj.json) {
      const r = photoRect(), scale = r.w / 1600;
      /* how many are on by the local hour: most in the evening, fewest before dawn */
      const at = f.phase.at || Date.now(), lon = st && Number.isFinite(st.lon) ? st.lon : 0;
      const hour = ((new Date(at).getUTCHours() + new Date(at).getUTCMinutes() / 60 + lon / 15) % 24 + 24) % 24;
      const share = hour >= 16 && hour < 23 ? 0.72 : hour >= 23 || hour < 1 ? 0.55 : hour < 5 ? 0.32 : hour < 8 ? 0.5 : 0.62;
      const COLS = [[255, 178, 88, 0.55], [255, 204, 130, 0.18], [232, 238, 255, 0.15], [210, 255, 222, 0.08], [140, 172, 255, 0.04]];
      /* a floor of a building lights together — an office, a flat — so windows
         are grouped by height and a stretch across, and each group is on or off
         with a few exceptions in it */
      const groups = {};
      const wins = lj.json.windows.map(([u, v]) => {
        const key = `${Math.round(v * 150)}:${Math.floor(u * 28)}`;
        if (!(key in groups)) {
          let pick = Math.random(), c = COLS[0];
          for (const k of COLS) { if (pick < k[3]) { c = k; break; } pick -= k[3]; }
          groups[key] = { on: Math.random() < share, c };
        }
        const gp = groups[key], c = Math.random() < 0.8 ? gp.c : COLS[Math.floor(Math.random() * 3)];
        return { x: r.x + u * r.w, y: r.y + v * r.h, s: Math.max(1.5, scale * rnd(2.6, 4.4)), col: c.slice(0, 3),
          on: gp.on ? Math.random() < 0.86 : Math.random() < 0.1, b: rnd(0.6, 1), tv: c === COLS[4], buzz: Math.random() < 0.02, ph: rnd(0, 100) };
      }).filter((w) => w.x > -4 && w.x < W + 4 && w.y > -4 && w.y < H + 4);
      const tops = lj.json.tops.map(([u, v], i) => ({ x: r.x + u * r.w, y: r.y + v * r.h, ph: i * 0.07 }));
      layers.city = { wins, tops, share, next: 0 };
    }
    const dmx = scene.photo && mapOf(scene, "depth");
    if (dmx) dmx.spots = null;                                         // splash points are in screen pixels: remake them
    layers.haze2 = scene.photo ? buildHaze(f) : null;
    layers.shadows = scene.photo ? buildShadows(f) : null;
    nextFlash = f.storm ? performance.now() + rnd(800, 3000) : 0;
  }
  function newMote(g, b, dir, anywhere) {
    const z = Math.random();
    return { x: anywhere ? rnd(0, W) : dir > 0 ? -rnd(0, 0.2) * W : W * rnd(1, 1.2), y: H * rnd(g.kind === "leaves" ? 0.3 : 0.55, 1.02), z,
      v: (220 + z * 620) * DPR * (0.45 + b * 0.8) * dir, lift: rnd(-12, 6) * DPR, len: rnd(8, 40) * (0.4 + z) * DPR * (0.5 + b),
      a: (0.2 + z * 0.45) * rnd(0.6, 1), r: (0.8 + z * 2) * DPR, ph: rnd(0, 6.28), col: g.kind === "leaves" ? LEAVES[Math.floor(Math.random() * LEAVES.length)] : g.col };
  }
  /* each summit sends off puffs that grow and thin downwind */
  function stepPlume(dt) {
    const f = fx, pk = layers.peaks;
    if (!pk) return;
    const r = photoRect(), dir = f.dirX >= 0 ? 1 : -1;
    for (const [px, py] of pk) {
      const n = f.blow * 30 * dt, k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      for (let i = 0; i < k; i++) {
        plume.push({ x: r.x + px * r.w + rnd(-3, 3) * DPR, y: r.y + py * r.h + rnd(-2, 4) * DPR, vx: (22 + f.blow * 48) * DPR * dir * rnd(0.75, 1.25), vy: rnd(-1, 5) * DPR,
          r: rnd(3, 6) * DPR, age: 0, life: rnd(3.5, 6) });
      }
    }
    for (const p of plume) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 4 * DPR * dt; }
    plume = plume.filter((p) => p.age < p.life);
    if (plume.length > 600) plume.splice(0, plume.length - 600);
  }
  /* a raindrop's streak: soft across, brightest just behind its head */
  let streakCv = null, flakeCv = null;
  function streakImg() {
    if (streakCv) return streakCv;
    streakCv = document.createElement("canvas");
    streakCv.width = 16; streakCv.height = 128;
    const x = streakCv.getContext("2d"), im = x.createImageData(16, 128);
    for (let y = 0; y < 128; y++) for (let i = 0; i < 16; i++) {
      const across = Math.exp(-(((i - 7.5) / 3.2) ** 2)), along = Math.pow(y / 127, 1.6) * (1 - Math.max(0, (y - 118) / 10));
      const o = (y * 16 + i) * 4;
      im.data[o] = 225; im.data[o + 1] = 232; im.data[o + 2] = 242; im.data[o + 3] = 255 * across * along;
    }
    x.putImageData(im, 0, 0);
    return streakCv;
  }
  function flakeImg() {
    if (flakeCv) return flakeCv;
    flakeCv = document.createElement("canvas");
    flakeCv.width = flakeCv.height = 32;
    const x = flakeCv.getContext("2d"), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return flakeCv;
  }
  /* where nearby ground faces up, from the depth map: where rain splashes */
  function splashSpots() {
    const dm = depthField();
    if (!dm) return [];
    if (dm.spots) return dm.spots;
    const out = [], r = coverRect(dm.w, dm.h);
    for (let n = 0; n < 6000 && out.length < 500; n++) {
      const x = Math.floor(Math.random() * dm.w), y = 2 + Math.floor(Math.random() * (dm.h - 4));
      const d = dm.data[(y * dm.w + x) * 4] / 255, below = dm.data[((y + 2) * dm.w + x) * 4] / 255, above = dm.data[((y - 2) * dm.w + x) * 4] / 255;
      if (d > 0.45 && (below - above) * 30 > 0.5) out.push([r.x + (x + 0.5) / dm.w * r.w, r.y + (y + 0.5) / dm.h * r.h, d]);
    }
    return (dm.spots = out);
  }
  let splashes = [];
  function drawSplashes(dt, live, lit) {
    const f = fx;
    if (!f.rain || f.snow || !scene.photo) { splashes = []; return; }
    const spots = splashSpots();
    if (!spots.length) return;
    if (live) {
      const n = f.rain * 90 * dt;
      for (let i = 0; i < Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); i++) {
        const [x, y, d] = spots[Math.floor(Math.random() * spots.length)];
        splashes.push({ x, y, s: (1 + d * 3) * DPR, age: 0, life: rnd(0.12, 0.22) });
      }
    }
    ctx.globalCompositeOperation = "screen";
    for (const sp of splashes) {
      sp.age += dt;
      const k = sp.age / sp.life, a = (1 - k) * 0.55 * lit;
      ctx.fillStyle = `rgba(225,232,242,${a.toFixed(3)})`;
      for (let j = -2; j <= 2; j++) {                                   // a little crown of droplets thrown up and out
        const px = sp.x + j * sp.s * (0.6 + k * 1.6), py = sp.y - sp.s * (1.8 - Math.abs(j) * 0.4) * Math.sin(k * Math.PI);
        ctx.fillRect(px, py, Math.max(1, sp.s * 0.45), Math.max(1, sp.s * 0.45));
      }
    }
    ctx.globalCompositeOperation = "source-over";
    splashes = splashes.filter((sp) => sp.age < sp.life);
  }
  function newDrop(anywhere) {
    const r = rnd(3, 8) * DPR;
    return { x: rnd(0, W), y: anywhere ? rnd(0, H) : rnd(-0.1, 0.4) * H, r, run: 0, trail: [], born: performance.now(), life: rnd(5000, 16000) };
  }

  /* a soft round blob, made once: the spindrift's puffs */
  let blob = null;
  function blobImg() {
    if (blob) return blob;
    blob = document.createElement("canvas");
    blob.width = blob.height = 64;
    const b = blob.getContext("2d");
    const g = b.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
    b.fillStyle = g; b.fillRect(0, 0, 64, 64);
    return blob;
  }

  /* ── real skies ──
     Ric, 2026-10-25: "i dont want people to be able to tell they are ai
     generated. and they have to move". So by day, and whenever there is cloud,
     the sky is real time-lapse footage (assets/weather/skies/, cut into
     seamless loops by make-skies.py from freely licensed clips, credited in
     the settings sheet) — picked by the weather and the hour, cross-faded when
     either changes, run faster in a wind. The drawn sky stays for a clear
     night, where the real stars and moon belong, and if footage cannot load. */
  /* the real night: a Milky Way photograph, the moon from NASA's mosaic, and
     lightning strokes keyed out of real photographs (make-night.py, night.json) */
  let nightMeta = null;
  const nightImg = {};
  const nightPic = (file) => {
    if (!nightImg[file]) { nightImg[file] = new Image(); nightImg[file].src = `assets/weather/skies/${file}`; }
    const im = nightImg[file];
    return im.complete && im.naturalWidth ? im : null;
  };
  fetch("assets/weather/skies/night.json").then((r) => r.ok ? r.json() : null).then((j) => {
    nightMeta = j;
    if (j) { nightPic(j.moon.file); for (const b of j.bolts) nightPic(b.file); }
  }).catch(() => {});
  let skiesMeta = null;
  fetch("assets/weather/skies/skies.json").then((r) => r.ok ? r.json() : null).then((j) => { skiesMeta = j; if (fx) { lastKey = ""; update(st); } }).catch(() => {});
  const videoKind = (() => {
    const v = document.createElement("video");
    return v.canPlayType && v.canPlayType('video/webm; codecs="vp9"') ? "webm" : "mp4";
  })();
  const videos = {};
  function skyVideo(id) {
    if (videos[id]) return videos[id];
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
    v.className = "skyclip";
    v.src = `assets/weather/skies/${id}.${videoKind}`;
    v.poster = `assets/weather/skies/${id}.jpg`;
    root.appendChild(v);                                             // iOS decodes only what is in the page
    const still = new Image();
    still.src = v.poster;
    return (videos[id] = { v, still, id });
  }
  /* which real sky: the weather first, then the hour */
  function skyChoice(f) {
    if (!skiesMeta) return null;
    const P = f.phase, wet = f.rain || f.snow, cloud = f.cloud;
    let id;
    if (P.dark >= 0.85) id = cloud < 0.3 ? null : f.storm ? "storm" : f.rain ? "rain" : "grey";
    else if (P.dark >= 0.4) id = !wet && !f.storm && cloud < 0.85 ? "dusk" : f.storm ? "storm" : f.rain ? "rain" : "grey";
    else if (P.warm >= 0.45) id = !wet && !f.storm && cloud < 0.85 ? "sunset" : f.storm ? "storm" : f.rain ? "rain" : "grey";
    else id = f.storm ? "storm" : f.rain ? "rain" : f.snow || f.fog > 0.3 || cloud >= 0.7 ? "grey" : cloud >= 0.18 ? "fair" : "clear";
    return id && skiesMeta[id] ? variant(id) : null;
  }
  /* one of the clips of that kind, chosen once a visit: the same sky does not
     loop past every time the page is opened */
  const VISIT = Math.random();
  const kindOf = (id) => (skiesMeta && skiesMeta[id] && skiesMeta[id].kind) || id;
  function variant(kind) {
    const ids = Object.keys(skiesMeta).filter((k) => kindOf(k) === kind).sort();
    return ids.length ? ids[Math.floor(VISIT * ids.length) % ids.length] : kind;
  }
  /* how the footage is graded for the hour it is shown at: footage of the day
     darkened and cooled for night, warmed for a low sun */
  /* the colour a photo's camera gave its own clear sky, against the clip's: a
     fair or clear clip is nudged halfway towards it, so the footage looks shot
     on the camera that took the land under it */
  const avg = (img, w, h, mask) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, m = mask ? mask.getContext("2d").getImageData(0, 0, w, h).data : null;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (m && m[i + 3] < 230) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return n > 20 ? [r / n, g / n, b / n] : null;
  };
  const matches = {};
  function skyMatch(id) {
    const key = `${scene.id}:${id}`;
    if (key in matches) return matches[key];
    const ph = mapOf(scene, "photo"), sk = maskOf(scene), clip = videos[id];
    if (!ph || !sk || !clip || !clip.still.complete || !clip.still.naturalWidth) return null;
    try {
      const mk = document.createElement("canvas"); mk.width = 96; mk.height = 64;
      mk.getContext("2d").drawImage(sk.img, 0, 0, 96, 64);
      const a = avg(ph.img, 96, 64, mk), b = avg(clip.still, 96, 54, null);
      /* halfway (square root of the ratio), as a balance only: scaled so the
         strongest channel stays whole — a multiply can only darken */
      const k = a && b ? a.map((v, i) => clamp(Math.sqrt(v / b[i]), 0.85, 1.15)) : null;
      matches[key] = k ? k.map((v) => Math.round(255 * v / Math.max(...k))) : null;
    } catch (e) { matches[key] = null; }
    return matches[key];
  }
  function skyGrade(clip, f) {
    const P = f.phase, id = kindOf(clip);
    if (id === "sunset" || id === "dusk") return { mul: P.dark > 0.6 ? [150, 140, 170] : null, a: 1 };
    if (P.dark >= 0.85) return { mul: GLOW[scene.id] ? [70, 56, 52] : [42, 48, 70], a: 1 };
    if (P.dark >= 0.4) return { mul: [Math.round(120 - P.dark * 40), 100, 130], a: 1 };
    if (P.warm >= 0.3) return { mul: [255, Math.round(232 - P.warm * 40), Math.round(205 - P.warm * 70)], a: 1 };
    if ((id === "fair" || id === "clear") && scene.photo) return { mul: skyMatch(clip), a: 1 };
    return { mul: null, a: 1 };
  }
  function playRate(f) { return clamp(0.32 + f.wind / 55, 0.32, 1.25); }
  /* draw the sky's footage into the sky canvas, covering the sky with the
     clip's own horizon at the land line; the outgoing sky fades over 2 s */
  function drawFootage(s, band, now, live) {
    const sk = layers.sky;
    if (!sk) return false;
    const vis = (o) => {
      const v = o.v, ready = v.readyState >= 2 && v.videoWidth;
      const img = live && ready ? v : o.still.complete && o.still.naturalWidth ? o.still : ready ? v : null;
      if (!img) return null;
      return [img, img.videoWidth || img.naturalWidth, img.videoHeight || img.naturalHeight];
    };
    const draw = (o, alpha) => {
      const d = vis(o);
      if (!d || alpha <= 0) return false;
      const [img, iw, ih] = d, k = Math.max(W / iw, band / ih);
      s.globalAlpha = alpha;
      s.drawImage(img, (W - iw * k) / 2, band - ih * k, iw * k, ih * k);
      s.globalAlpha = 1;
      return true;
    };
    /* until the new sky can show, the old one stays, and the fade starts then;
       with no old one (the page has just opened) the drawn sky is under it and
       the footage fades in over that rather than snapping on */
    if (!vis(sk.cur)) { sk.since = now; return sk.from ? draw(sk.from, 1) : false; }
    const t = clamp((now - sk.since) / (sk.from ? 2000 : 1200), 0, 1);
    if (sk.from && t < 1) draw(sk.from, 1);
    const ok = draw(sk.cur, t);
    if (sk.from && t >= 1) { sk.from.v.pause(); sk.from = null; }
    if (!ok) return false;
    sk.cover = sk.from ? 1 : t;
    const g = sk.grade;
    if (g.mul) {
      s.globalCompositeOperation = "multiply";
      s.fillStyle = rgba(g.mul, 1);
      s.fillRect(0, 0, W, band);
      s.globalCompositeOperation = "source-over";
    }
    /* below the clip's horizon there is no footage: the sky carries on in
       the colour of the clip's lowest row, under the mountains anyway */
    return true;
  }
  function chooseSky(f) {
    const id = skyChoice(f);
    const prev = layers.sky || lastSky;
    if (!id) { if (prev) { prev.cur.v.pause(); if (prev.from) prev.from.v.pause(); } lastSky = null; return null; }
    const cur = skyVideo(id), sk = { cur, from: null, since: performance.now(), grade: skyGrade(id, f), id };
    if (prev && prev.id !== id) { sk.from = prev.cur; }
    else if (prev) { sk.from = prev.from; sk.since = prev.since; }
    const v = cur.v;
    v.playbackRate = playRate(f);
    if (animated()) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause();
    lastSky = sk;
    return sk;
  }
  let lastSky = null;

  /* ── the sky itself: its colour, the sun, the moon, the stars ──
     Where a thing in the sky lands on the picture: the view faces the equator
     (south in the north, north in the south) and spans 180°, so the sun rises
     at the left edge and sets at the right in the north, the other way round in
     the south. Altitude rises from the land's edge under it (`horizon`) to the
     top of the screen at about 65°. Anything below the edge is behind the land
     and the mask hides it — the sun and moon set behind the ridges. The picture's
     camera pointed somewhere we cannot know; this is the sky in front of you. */
  function skyPoint(az, altR) {
    if (!horizon.length) return null;
    const view = (fx.phase.lat ?? 1) >= 0 ? Math.PI : 0;
    const d = Math.atan2(Math.sin(az - view), Math.cos(az - view));
    if (Math.abs(d) > Math.PI / 2 + 0.15) return null;
    const x = W / 2 + d / Math.PI * W;
    const i = clamp(Math.round(x / W * 32), 0, 32), hy = horizon[i] || H * 0.5;
    return { x, y: hy - clamp(altR / (65 * DEG), -0.3, 1) * hy * 0.94 };
  }
  /* screen east is left when you face south, right when you face north */
  const eastLeft = () => (fx.phase.lat ?? 1) >= 0;

  /* the sky's colour through the day: nothing over the photo's own blue by day;
     low sun, twilight and night replace it, horizon warm, overhead deepening */
  function skyWash(s, band) {
    const P = fx.phase;
    if (P.dark < 0.02 && P.warm < 0.05) return;
    const e = P.elev ?? (P.name === "night" ? -20 : P.name === "day" ? 30 : -3);
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    /* colours by the sun's height: golden, sunset, twilight, night */
    const stops = [[10, [120, 160, 220], [255, 196, 120], 0.25], [0, [70, 90, 170], [255, 140, 80], 0.55],
      [-6, [24, 30, 80], [190, 90, 90], 0.9], [-12, [6, 10, 30], [24, 30, 64], 1], [-18, [3, 6, 18], [10, 16, 36], 1]];   // fully opaque by night: the photo's own daytime clouds must not show through
    let top = stops[stops.length - 1][1], low = stops[stops.length - 1][2], a = stops[stops.length - 1][3];
    if (e >= stops[0][0]) { const t = clamp((e - 10) / 6, 0, 1); top = stops[0][1]; low = stops[0][2]; a = stops[0][3] * (1 - t); }
    else for (let i = 0; i < stops.length - 1; i++) {
      const [e0, t0, l0, a0] = stops[i], [e1, t1, l1, a1] = stops[i + 1];
      if (e <= e0 && e >= e1) { const t = (e0 - e) / (e0 - e1); top = mix(t0, t1, t); low = mix(l0, l1, t); a = a0 + (a1 - a0) * t; break; }
    }
    if (a <= 0.01) return;
    const g = s.createLinearGradient(0, 0, 0, band);
    /* a city's sky never goes black low down: its own light glows on the haze */
    if (GLOW[scene.id] && P.dark > 0.3) low = mix(low, shade(GLOW[scene.id], 0.5), (P.dark - 0.3) * 0.8);
    g.addColorStop(0, rgba(top, a)); g.addColorStop(0.65, rgba(mix(top, low, 0.45), a)); g.addColorStop(1, rgba(low, a));
    s.fillStyle = g;
    s.fillRect(0, 0, W, H);
  }
  function drawSunIn(s, real) {
    const P = fx.phase;
    let x, y, altR;
    if (P.sunPos) {
      altR = P.sunPos.alt;
      if (altR < -2 * DEG) return;
      const p = skyPoint(P.sunPos.az, altR);
      if (!p) return;
      ({ x, y } = p);
    } else {
      /* no place: across the top from left at sunrise to right at sunset */
      if (!scene.sky || P.sun == null) return;
      const k = clamp(P.sun, 0, 1);
      x = W * (0.08 + k * 0.84); y = H * (0.3 - Math.sin(k * Math.PI) * 0.24); altR = Math.sin(k * Math.PI) * 50 * DEG;
    }
    const low = clamp(1 - altR / (12 * DEG), 0, 1);               // reddens near the horizon
    const R = Math.min(W, H) * 0.42, r = Math.min(W, H) * 0.018 + 5 * DPR;
    const glow = s.createRadialGradient(x, y, 0, x, y, R);
    glow.addColorStop(0, `rgba(255,${Math.round(240 - low * 70)},${Math.round(200 - low * 110)},${0.5 - low * 0.05})`);
    glow.addColorStop(0.07, `rgba(255,${Math.round(225 - low * 80)},${Math.round(170 - low * 100)},${0.3})`);
    glow.addColorStop(1, "rgba(255,200,140,0)");
    s.fillStyle = glow; s.fillRect(x - R, y - R, R * 2, R * 2);
    if (real) {
      /* over real footage the sun is what a camera sees: a blown-out glare
         with no edge, not a disc (a disc read as a moon) */
      const b = s.createRadialGradient(x, y, 0, x, y, r * 4);
      b.addColorStop(0, "rgba(255,255,250,1)"); b.addColorStop(0.05, "rgba(255,253,240,.9)"); b.addColorStop(0.16, "rgba(255,248,226,.42)"); b.addColorStop(0.45, "rgba(255,240,210,.12)"); b.addColorStop(1, "rgba(255,240,210,0)");
      s.globalCompositeOperation = "lighter";
      s.fillStyle = b; s.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      s.globalCompositeOperation = "source-over";
      return;
    }
    s.fillStyle = `rgb(255,${Math.round(250 - low * 60)},${Math.round(232 - low * 120)})`;
    s.beginPath(); s.arc(x, y, r, 0, Math.PI * 2); s.fill();
  }
  /* the moon at its real phase, its lit side turned as it looks from here */
  function drawMoonIn(s) {
    const P = fx.phase, m = P.moon;
    if (!m) {
      /* no place: the phase from the date, top right, at night */
      if (P.name !== "night" || fx.stars < 0.2) return;
      return moonDisc(s, W * 0.86, H * 0.12, Math.min(W, H) * 0.028 + 6 * DPR, legacyMoon(), 1);
    }
    if (m.alt < -1 * DEG || m.fraction < 0.02) return;
    const p = skyPoint(m.az, m.alt);
    if (!p) return;
    /* by day the moon is a pale ghost; it brightens as the sky darkens */
    const bright = 0.35 + 0.65 * P.dark;
    moonDisc(s, p.x, p.y, Math.min(W, H) * 0.028 + 6 * DPR, m, bright);
  }
  function legacyMoon() {
    const age = (((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588853 + 29.530588853) % 29.530588853 / 29.530588853;
    return { fraction: (1 - Math.cos(age * 2 * Math.PI)) / 2, limb: age < 0.5 ? -Math.PI / 2 : Math.PI / 2 };
  }
  function moonDisc(s, x, y, r, m, bright) {
    const P = Math.PI;
    if (fx.phase.dark > 0.3) {
      const glow = s.createRadialGradient(x, y, r, x, y, r * 7);
      glow.addColorStop(0, `rgba(210,225,255,${(0.18 * m.fraction * bright).toFixed(3)})`); glow.addColorStop(1, "rgba(210,225,255,0)");
      s.fillStyle = glow; s.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    }
    s.save();
    s.translate(x, y);
    /* turn so the lit side (local +x) points along the bright limb: `limb` is
       from straight up towards the sky's east */
    const turn = eastLeft() ? -P / 2 - m.limb : -P / 2 + m.limb;
    /* the photograph's north turned to the sky's north here: the moon stands
       on its head from the southern hemisphere */
    const pic = nightMeta && nightPic(nightMeta.moon.file), north = m.pa == null ? 0 : eastLeft() ? -m.pa : P + m.pa;
    if (pic) { s.rotate(north); s.globalAlpha = 0.07 * bright; s.drawImage(pic, -r, -r, 2 * r, 2 * r); s.globalAlpha = 1; s.rotate(-north); }
    s.rotate(turn);
    if (!pic) {
      s.fillStyle = `rgba(150,165,200,${(0.1 * bright).toFixed(3)})`;      // the dark part, faintly (earthshine)
      s.beginPath(); s.arc(0, 0, r, 0, P * 2); s.fill();
    }
    /* the lit part: the half-disc on the bright side, closed by the terminator,
       an ellipse that bulges into it while a crescent and away once gibbous */
    const k = m.fraction, rx = r * (1 - 2 * k);
    s.beginPath();
    for (let i = 0; i <= 24; i++) { const a = -P / 2 + P * i / 24; s.lineTo(r * Math.cos(a), r * Math.sin(a)); }
    for (let i = 0; i <= 24; i++) { const a = P / 2 - P * i / 24; s.lineTo(rx * Math.cos(a), r * Math.sin(a)); }
    s.closePath();
    if (pic) {
      s.clip();
      s.rotate(-turn + north);
      s.globalAlpha = 0.97 * bright;
      s.drawImage(pic, -r, -r, 2 * r, 2 * r);
      s.globalAlpha = 1;
    } else {
      s.fillStyle = `rgba(240,243,252,${(0.95 * bright).toFixed(3)})`;
      s.fill();
    }
    s.restore();
  }
  /* a strike: from the cloud down through open sky to the land's edge, where
     it lands; with no open sky worth the name, the flash alone */
  function makeBolt() {
    let x = 0, depth = 0;
    for (let i = 0; i < 10 && depth < H * 0.16; i++) { x = rnd(0.1, 0.9) * W; depth = scene.sky ? H * rnd(0.6, 0.85) : skyDepth(x); }
    if (depth < H * 0.16) return null;
    const top = layers.deck ? 0 : rnd(0, 0.06) * H;
    let y = top;
    const pts = [[x, y]], branches = [];
    while (y < depth) {
      x += rnd(-26, 26) * DPR; y = Math.min(depth, y + rnd(12, 30) * DPR);
      pts.push([x, y]);
      if (Math.random() < 0.14 && y < depth * 0.8) {
        const b = [[x, y]]; let bx = x, by = y;
        for (let i = 0; i < 6; i++) { bx += rnd(-30, 30) * DPR; by += rnd(10, 24) * DPR; b.push([bx, by]); }
        branches.push(b);
      }
    }
    const sprites = nightMeta ? nightMeta.bolts.filter((b) => nightPic(b.file)) : [];
    const sprite = sprites.length ? sprites[Math.floor(Math.random() * sprites.length)] : null;
    return { pts, branches, hit: [x, depth], top, sprite, flip: Math.random() < 0.5 };
  }

  /* the sky, drawn into its own canvas and cut to the photo's sky there: its
     colour for the hour, stars, the moon, the sun, then the cloud — so cloud
     covers them as it would, and none of it ever crosses a mountain */
  function drawSky(dt, t, live, now) {
    const m = scene.sky ? null : maskOf(scene);
    if (!scene.sky && !m) return;
    if (!skyCv) skyCv = document.createElement("canvas");
    if (skyCv.width !== W || skyCv.height !== H) { skyCv.width = W; skyCv.height = H; }
    const s = skyCv.getContext("2d");
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    s.clearRect(0, 0, W, H);
    const band = layers.skyH || H * 0.6;
    /* footage first; the drawn sky only where there is none */
    const fb = scene.sky ? H : Math.min(H, band * 1.04);
    /* the drawn sky goes under footage that is still fading in over nothing */
    const fading = layers.sky && !layers.sky.from && (layers.sky.cover ?? 0) < 1;
    if (fading) { skyWash(s, band); if (layers.clouds) for (const L of layers.clouds.layers) drawPlane(s, L, layers.clouds.hy, dt); }
    const real = drawFootage(s, fb, now, live);
    if (!real) skyWash(s, band);
    const sky = nightMeta && fx.stars > 0.02 && !real && nightPic(nightMeta.stars.file);
    if (sky) {
      /* the Milky Way, faint over a city: its own light hides most of it */
      const k = Math.max(W / sky.naturalWidth, band / sky.naturalHeight);
      s.globalAlpha = fx.stars * (GLOW[scene.id] ? 0.35 : 0.95);
      s.drawImage(sky, (W - sky.naturalWidth * k) / 2, band - sky.naturalHeight * k, sky.naturalWidth * k, sky.naturalHeight * k);
      s.globalAlpha = 1;
    } else if (stars.length && !real) {
      for (const p of stars) {
        const a = live ? p.a * (0.7 + 0.3 * Math.sin(t * p.tw + p.ph)) : p.a;
        s.fillStyle = `rgba(235,240,255,${(a * fx.stars).toFixed(3)})`;
        s.fillRect(p.x, p.y, p.r, p.r);
      }
    }
    if (!real) drawMoonIn(s);
    /* no sun drawn over footage: the footage is lit by its own, and every drawn
       sun on a real sky read as a moon. The drawn sky keeps its sun. */
    if (!real) drawSunIn(s, false);
    /* a real stroke, drawn into the sky so the land in front hides its foot
       when it falls behind a ridge */
    if (bolt && bolt.sprite && flashT >= 0) {
      const e = performance.now() - flashT;
      if (e < 300) {
        const b = bolt.sprite, im = nightPic(b.file), h = Math.max(20, bolt.hit[1] - bolt.top) * 1.04, w = b.w * h / b.h;
        s.save();
        s.globalCompositeOperation = "lighter";
        s.globalAlpha = e < 70 || (e > 130 && e < 220) ? 1 : 0.35;
        s.translate(bolt.hit[0], bolt.top);
        if (bolt.flip) s.scale(-1, 1);
        s.drawImage(im, -w / 2, 0, w, h);
        s.restore();
      }
    }
    if (layers.clouds && !real && !fading) {
      const c = layers.clouds;
      for (const L of c.layers) drawPlane(s, L, c.hy, dt);
    }
    if (m) {
      const r = coverRect(m.w, m.h);
      s.globalCompositeOperation = "destination-in";
      s.drawImage(m.img, r.x, r.y, r.w, r.h);
      s.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(skyCv, 0, 0);
  }

  /* ── distance ──
     Each photo's depth map (<id>-depth.png, Depth Anything V2 run once offline
     by scene-maps.py: near white, far black, the sky black) makes the air
     behave by real distance:
       haze and fog   each pixel loses e^(−3.9·d/V) of itself to the air — the
                      far ridges first; even a clear day hazes the farthest a
                      little blue; rain and snow thicken the air by their rate
       cloud shadows  on a sunny, partly cloudy day the clouds' shadows cross
                      the land, the cloud field laid on the ground in
                      perspective and moving with the wind
       lightning      a strike lights the near land more than the far
     DEPTH (above) turns the map's 0…1 into kilometres for each picture. */
  function depthField() {
    const dm = mapOf(scene, "depth");
    if (!dm || !dm.data) return null;
    if (dm.km && dm.km.scene === scene.id) return dm;
    const [far, near] = DEPTH[scene.id] || DEPTH.sky;
    const n = dm.w * dm.h, km = new Float32Array(n), land = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = dm.data[i * 4] / 255;
      land[i] = v > 0.004 ? 1 : 0;
      km[i] = v > 0.004 ? 1 / (v / near + (1 - v) / far) : far * 2.5;   // linear in 1/distance, as disparity is
    }
    dm.km = { scene: scene.id, km, land };
    return dm;
  }
  /* how far you can see, metres: the report, then what rain or snow does to it */
  function seeing(f) {
    let V = f.vis >= 10000 ? 40000 : f.vis;
    if (f.rain) V = Math.min(V, clamp(14000 / (1 + f.rain * 2.2), 1800, 14000));
    if (f.snow) V = Math.min(V, clamp(5000 / (0.4 + f.snow * 1.6), 700, 6000));
    return V;
  }
  /* the air between you and each pixel, as an image the size of the depth map */
  function buildHaze(f) {
    const dm = depthField();
    if (!dm) return null;
    const { km, land } = dm.km, V = seeing(f), L = light(f);
    /* the sky behind the land takes the haze of the land's far edge, a little
       lighter (the footage keeps some of its own air): laid on at the sky's
       own great distance it hid the footage behind grey; left off, the ridges
       stood as flat grey cut-outs against a clear sky. In real fog, all of it. */
    const [far] = DEPTH[scene.id] || DEPTH.sky;
    const clear = V >= 30000;
    /* a clear day's distance is faintly blue; fog and rain are their own grey */
    const col = clear ? shade([186, 202, 226], 1 - f.phase.dark * 0.8) : L.fog;
    const cap = clear ? 0.32 : 1;
    const skyA = Math.min(cap, 1 - Math.exp(-3.912 * far * 1000 / V)) * (V < 1500 ? 1 : 0.72);
    const c = document.createElement("canvas");
    c.width = dm.w; c.height = dm.h;
    const x = c.getContext("2d"), im = x.createImageData(dm.w, dm.h), d = im.data;
    let any = 0;
    for (let i = 0; i < km.length; i++) {
      const a = land[i] ? Math.min(cap, 1 - Math.exp(-3.912 * km[i] * 1000 / V)) : skyA;
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = a * 255;
      any = Math.max(any, a);
    }
    if (any < 0.02) return null;
    x.putImageData(im, 0, 0);
    return { cv: c, w: dm.w, h: dm.h };
  }
  /* cloud shadows: the cloud field on the ground, a texel 30 m, seen in
     perspective (a pixel's ground position from its distance and how far off
     centre it is), moving with the wind at three times its speed so the eye
     catches it */
  function buildShadows(f) {
    const P = f.phase, dm = depthField();
    if (!dm || f.rain || f.snow || f.storm || f.fog > 0.3 || f.cloud < 0.08 || f.cloud > 0.9) return null;
    const sun = P.sunPos ? P.sunPos.alt / DEG : P.dark < 0.3 ? 40 : -1;
    if (sun < 3 || P.dark > 0.25) return null;
    const step = 2, w = Math.floor(dm.w / step), h = Math.floor(dm.h / step);
    const { km, land } = dm.km, gx = new Float32Array(w * h), gy = new Float32Array(w * h), lw = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = y * step * dm.w + x * step, i = y * w + x, d = km[j];
      gx[i] = (x / w - 0.5) * 1.15 * d / 0.03;
      gy[i] = d / 0.03;
      lw[i] = land[j];
    }
    cloudField();
    const t = cloudQ[clamp(Math.floor((1 - f.cloud) * cloudQ.length), 0, cloudQ.length - 1)];
    const to = ((f.windDir ?? 270) + 180) * DEG, view = (P.lat ?? 1) >= 0 ? Math.PI : 0;
    const sp = 3 * Math.max(4, f.wind) / 3600 / 0.03;                  // texels a second
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return { cv: c, ctx: c.getContext("2d"), w, h, gx, gy, lw, t, soft: cloudSpread * 0.35,
      vu: -sp * f.dirX, vv: -sp * Math.cos(to - view), u: rnd(0, CN), v: rnd(0, CN), next: 0,
      k: 0.32 * clamp((sun - 3) / 12, 0, 1) * (1 - f.cloud * 0.5) };
  }
  function drawShadows(now, live) {
    const s = layers.shadows;
    if (!s) return;
    if (!s.drawn || (live && now >= s.next)) {
      const dt = s.last ? (now - s.last) / 1000 : 0;
      s.last = now; s.next = now + 110; s.drawn = true;
      s.u += s.vu * dt; s.v += s.vv * dt;
      const im = s.ctx.createImageData(s.w, s.h), d = im.data, F = cloudF, lo = s.t - s.soft, span = 2 * s.soft;
      for (let i = 0; i < s.gx.length; i++) {
        if (!s.lw[i]) continue;
        const x = ((Math.floor(s.gx[i] + s.u) % CN) + CN) % CN, y = ((Math.floor(s.gy[i] + s.v) % CN) + CN) % CN;
        let a = (F[y * CN + x] - lo) / span;
        a = a < 0 ? 0 : a > 1 ? 1 : a * a * (3 - 2 * a);
        d[i * 4] = 10; d[i * 4 + 1] = 14; d[i * 4 + 2] = 24; d[i * 4 + 3] = a * s.k * 255;   // shade, barely blue: a blue overlay read as a tint
      }
      s.ctx.putImageData(im, 0, 0);
    }
    const r = coverRect(s.w, s.h);
    ctx.drawImage(s.cv, r.x, r.y, r.w, r.h);
  }
  /* the stroke again, over the haze and the rain — a bolt is the brightest
     thing in the sky, and drawn only under them it showed as a faint thread —
     with a glow round it, and cut to the sky so a ridge still hides its foot */
  let boltCv = null;
  function drawBoltOver() {
    if (!bolt || !bolt.sprite || flashT < 0) return;
    const e = performance.now() - flashT;
    if (e >= 300) return;
    const m = scene.sky ? null : maskOf(scene), im = nightPic(bolt.sprite.file);
    if (!im) return;
    if (!boltCv) boltCv = document.createElement("canvas");
    if (boltCv.width !== W || boltCv.height !== H) { boltCv.width = W; boltCv.height = H; }
    const b = boltCv.getContext("2d"), h = Math.max(20, bolt.hit[1] - bolt.top) * 1.04, w = bolt.sprite.w * h / bolt.sprite.h;
    b.globalCompositeOperation = "source-over"; b.clearRect(0, 0, W, H);
    b.save(); b.translate(bolt.hit[0], bolt.top); if (bolt.flip) b.scale(-1, 1);
    b.globalAlpha = 0.35; b.drawImage(im, -w * 0.56, -h * 0.03, w * 1.12, h * 1.06);   // the glow: a larger, fainter copy
    b.globalAlpha = 1; b.globalCompositeOperation = "lighter"; b.drawImage(im, -w / 2, 0, w, h); b.drawImage(im, -w / 2, 0, w, h);
    b.restore();
    if (m) {
      const r = coverRect(m.w, m.h);
      b.globalCompositeOperation = "destination-in";
      b.drawImage(m.img, r.x, r.y, r.w, r.h);
      b.globalCompositeOperation = "source-over";
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = e < 70 || (e > 130 && e < 220) ? 0.9 : 0.3;
    ctx.drawImage(boltCv, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  function drawHaze() {
    const h = layers.haze2;
    if (!h) return;
    const r = coverRect(h.w, h.h);
    ctx.drawImage(h.cv, r.x, r.y, r.w, r.h);
  }
  /* the land a flash lights: near more than far */
  function nearLight() {
    const dm = depthField();
    if (!dm) return null;
    if (dm.flash) return dm.flash;
    const c = document.createElement("canvas");
    c.width = dm.w; c.height = dm.h;
    const x = c.getContext("2d"), im = x.createImageData(dm.w, dm.h), d = im.data;
    for (let i = 0; i < dm.w * dm.h; i++) {
      const v = dm.data[i * 4] / 255;
      d[i * 4] = 225; d[i * 4 + 1] = 232; d[i * 4 + 2] = 255; d[i * 4 + 3] = v > 0.004 ? (0.25 + 0.75 * Math.pow(v, 0.7)) * 255 : 0;
    }
    x.putImageData(im, 0, 0);
    return (dm.flash = { cv: c, w: dm.w, h: dm.h });
  }

  /* ── one camera ──
     A real photograph has grain all through it and its corners fall off a
     little; the photo and the footage came from different cameras, so one
     grain and one vignette go over the whole picture (CSS blend modes, above
     everything in the scene), the grain moving like a video's. */
  const grain = document.createElement("div"), vignette = document.createElement("div");
  grain.className = "grain"; vignette.className = "vignette";
  root.appendChild(vignette); root.appendChild(grain);
  (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d"), im = x.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 70;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
  })();
  let grainT = 0;
  function moveGrain(now, live) {
    if (!live || now - grainT < 42) return;
    grainT = now;
    grain.style.backgroundPosition = `${Math.floor(Math.random() * 256)}px ${Math.floor(Math.random() * 256)}px`;
  }

  /* ── the photo on the GPU ──
     Ric, 2026-10-25: "do it all": plants that move in the wind, a little depth
     when you move, the water, wet and snowy ground, the seasons. All of it is
     the photo's own pixels moved or relit, per pixel, by a small WebGL program
     (no library: the browser's own) reading the maps scene-maps.py made:
       depth   near things shift against far ones as the pointer or the phone
               moves (parallax); far ridges and the sky stay put, so the sky's
               mask still fits them; and where the ground faces up (depth
               falling away fast up the screen) wet shines and snow lies
       plants  trees, grass and palms sway in a gusting field that moves with
               the wind — more the nearer and the windier; in autumn their
               green turns gold and rust, in winter dull brown (only for the
               trees that turn: SEASONS below; by the visitor's own hemisphere)
       water   the ripples, folded in here from the 2D water layer
     plus the cross-fade to the overcast photo. The CSS photo stays underneath
     and is all a browser without WebGL shows. */
  const glCv = document.createElement("canvas");
  glCv.className = "glphoto";
  root.insertBefore(glCv, waterCv);
  let gl = null;
  try { gl = glCv.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false }); } catch (e) { gl = null; }
  const VS = "attribute vec2 aPos; varying vec2 vPos; void main(){ vPos = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";
  const FS = `precision mediump float;
varying vec2 vPos;
uniform sampler2D uPhoto, uFlat, uDepth, uPlants, uWater, uShore;
uniform vec4 uRect; uniform vec2 uRes, uPar, uWind, uTexel, uDTexel;
uniform float uT, uFlatMix, uSway, uRipple, uWet, uSnow, uAutumn, uBare, uSwash, uWetSand, uDPR;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  vec2 s = vec2(vPos.x * uRes.x, (1.0 - vPos.y) * uRes.y);
  vec2 uv = (s - uRect.xy) / uRect.zw;
  float d = texture2D(uDepth, uv).r;
  uv -= uPar * max(0.0, d - 0.18);
  vec2 pp = texture2D(uPlants, uv).rg;                 // r: plant at all (for its colour), g: how much it sways
  float p = pp.g;
  if (p > 0.01 && uSway > 0.0) {
    vec2 q = uv * vec2(38.0, 26.0);
    float gust = 0.55 + 0.45 * noise(vec2(uv.x * 3.0 - uT * 0.35 * uWind.x, uT * 0.21));
    float w = (noise(q + vec2(uT * 1.7, 0.0)) - 0.5) + 0.6 * (noise(q * 2.3 - vec2(uT * 2.9, uT * 0.7)) - 0.5);
    float a = p * uSway * gust * (1.0 + 2.0 * d);
    uv += a * vec2((w + 0.3 * uWind.x) * uTexel.x, w * 0.35 * uTexel.y);
  }
  vec3 sh = texture2D(uShore, uv).rgb;
  if (sh.b > 0.01 && uSwash > 0.0) uv += (sh.rg * 2.0 - 1.0) * sh.b * uSwash * uDTexel * 8.0;
  float wa = texture2D(uWater, uv).a;
  if (wa > 0.01 && uRipple > 0.0) {
    /* the waves are measured on the screen, about 50 px long near and shorter
       far off (the old 2D strips' formula): measured on the photo they came out
       a few pixels long and banded the shallows like a blind */
    float f = 0.3 + d, q = s.y / uDPR / f, A = wa * uRipple * uDPR * (0.25 + 1.2 * d);
    uv.x += A / uRect.z * (sin(uT * 1.1 + q * 0.13) + 0.55 * sin(uT * 1.9 + q * 0.29 + 2.0));
    uv.y += A / uRect.w * 0.4 * sin(uT * 1.4 + q * 0.21 + 1.0);
  }
  vec3 c = texture2D(uPhoto, uv).rgb;
  if (uFlatMix > 0.001) c = mix(c, texture2D(uFlat, uv).rgb, uFlatMix);
  c *= 1.0 - sh.b * uWetSand * 0.16;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  /* a leaf: greener than blue, and not redder than green — spring's
     yellow-greens included, bark and trunks (red over green) left alone */
  float green = clamp((c.g - c.b) * 5.0, 0.0, 1.0) * clamp(1.0 - (c.r - c.g) * 6.0, 0.0, 1.0) * pp.r;
  if (uAutumn > 0.0) {
    vec3 gold = vec3(lum * 1.38, lum * 1.0, lum * 0.32), rust = vec3(lum * 1.35, lum * 0.62, lum * 0.24);
    c = mix(c, mix(gold, rust, noise(uv * 70.0)), uAutumn * green);
  }
  if (uBare > 0.0) c = mix(c, vec3(lum * 0.98, lum * 0.86, lum * 0.7), uBare * green);
  float up = clamp((texture2D(uDepth, uv + vec2(0.0, 2.0 * uDTexel.y)).r - texture2D(uDepth, uv - vec2(0.0, 2.0 * uDTexel.y)).r) * 30.0, 0.0, 1.0);
  if (uWet > 0.0) {
    c = mix(c, c * c * 1.15, uWet * 0.45);
    c += uWet * up * 0.07 * vec3(0.85, 0.9, 1.0);
  }
  if (uSnow > 0.0) {
    float n = noise(uv * vec2(260.0, 190.0)) * 0.5 + noise(uv * 45.0) * 0.5;
    float sn = clamp((up * 1.5 + lum * 0.4 - 0.45) * 2.2 + (n - 0.5) * 0.9, 0.0, 1.0) * uSnow;
    c = mix(c, vec3(0.92, 0.94, 0.98) * (0.72 + 0.4 * lum), sn);
  }
  gl_FragColor = vec4(c, 1.0);
}`;
  const G = gl && (() => {
    const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    try {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "aPos");
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = {};
      for (const n of ["uPhoto", "uFlat", "uDepth", "uPlants", "uWater", "uShore", "uSwash", "uWetSand", "uDPR", "uRect", "uRes", "uPar", "uWind", "uTexel", "uDTexel", "uT", "uFlatMix", "uSway", "uRipple", "uWet", "uSnow", "uAutumn", "uBare"]) U[n] = gl.getUniformLocation(pr, n);
      const units = ["uPhoto", "uFlat", "uDepth", "uPlants", "uWater", "uShore"], tex = {}, src = {};
      units.forEach((n, i) => {
        tex[n] = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[n]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        gl.uniform1i(U[n], i);
      });
      /* hand a texture its image once, and again only if the image changes */
      const put = (n, img) => {
        const i = units.indexOf(n);
        if (!img || src[n] === img.src) return;
        src[n] = img.src;
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[n]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      };
      const clear = (n) => { const i = units.indexOf(n); if (!src[n]) return; src[n] = null; gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[n]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); };
      return { U, put, clear, ready: false };
    } catch (e) { console.warn("scene: the GPU layer is off, the plain photo shows", e); return null; }
  })();
  if (gl && G) glCv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); G.lost = true; root.classList.remove("gl-on"); });

  /* which trees turn: the city's maples and the meadow grass yes; the
     spruce, the pines, the tropics, the bare rock no */
  const SEASONS = { city: 1, mountains: 0.6 };
  /* autumn and winter by the visitor's own hemisphere and the day of the year */
  function season() {
    const lat = st && Number.isFinite(st.lat) ? st.lat : 45;
    const at = (fx && fx.phase.at) || Date.now();
    const d0 = new Date(at), start = Date.UTC(d0.getUTCFullYear(), 0, 1);
    let doy = (at - start) / 864e5;
    if (lat < 0) doy = (doy + 182.6) % 365.25;
    if (Math.abs(lat) < 23.5) return { autumn: 0, bare: 0 };                 // the tropics keep their green
    const bump = (x, c, w) => Math.max(0, 1 - Math.abs(x - c) / w);
    const autumn = bump(doy, 290, 32);                                         // peak mid-October
    const bare = doy > 318 || doy < 95 ? 1 : doy <= 330 ? (doy - 318) / 12 : doy < 110 ? (110 - doy) / 15 : 0;
    return { autumn: Math.min(1, autumn * 1.3), bare: Math.max(0, Math.min(1, bare)) };
  }
  /* the pointer or the phone's tilt, eased: how far the near things shift */
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { par.tx = (e.clientX / innerWidth - 0.5); par.ty = (e.clientY / innerHeight - 0.5); } }, { passive: true });
  addEventListener("deviceorientation", (e) => {
    if (e.gamma == null) return;
    par.tx = clamp(e.gamma / 30, -1, 1) * 0.5; par.ty = clamp((e.beta - 45) / 30, -1, 1) * 0.5;
  }, { passive: true });

  function glActive() { return !!(G && !G.lost && scene.photo && mapOf(scene, "photo")); }
  function drawGL(t, dt, live) {
    if (!glActive()) { root.classList.remove("gl-on"); return false; }
    const f = fx, ph = mapOf(scene, "photo"), fl = mapOf(scene, "flat"), U = G.U;
    const dm = mapOf(scene, "depth"), pm = mapOf(scene, "plants"), wm = WET.has(scene.id) ? mapOf(scene, "water") : null;
    G.put("uPhoto", ph.img);
    fl ? G.put("uFlat", fl.img) : G.clear("uFlat");
    dm ? G.put("uDepth", dm.img) : G.clear("uDepth");
    pm ? G.put("uPlants", pm.img) : G.clear("uPlants");
    wm ? G.put("uWater", wm.img) : G.clear("uWater");
    const sm = SHORE.has(scene.id) ? mapOf(scene, "shore") : null;
    sm ? G.put("uShore", sm.img) : G.clear("uShore");
    /* the swash: a wave runs up the sand fast and slides back slowly, about
       every nine seconds and never quite the same; further in a wind, and the
       sand it leaves stays dark a moment */
    const sp = (t / 9 + 0.12 * Math.sin(t * 0.13) + 1) % 1, run = sp < 0.3 ? sp / 0.3 : 1 - (sp - 0.3) / 0.7;
    const swash = run * run * (3 - 2 * run);
    gl.uniform1f(U.uSwash, sm && live ? swash * (0.7 + clamp(f.wind / 45, 0, 0.8)) : 0);
    gl.uniform1f(U.uWetSand, sm ? (live ? (1 - swash) * 0.9 : 0.5) : 0);
    if (glCv.width !== W || glCv.height !== H) { glCv.width = W; glCv.height = H; gl.viewport(0, 0, W, H); }
    const r = coverRect(ph.w, ph.h);
    /* ease towards where the pointer is; still when motion is off */
    const k = live ? Math.min(1, dt * 3) : 1;
    par.x += ((live ? par.tx : 0) - par.x) * k; par.y += ((live ? par.ty : 0) - par.y) * k;
    const se = SEASONS[scene.id] ? season() : { autumn: 0, bare: 0 };
    const amt = SEASONS[scene.id] || 0;
    gl.uniform4f(U.uRect, r.x, r.y, r.w, r.h);
    gl.uniform2f(U.uRes, W, H);
    gl.uniform2f(U.uPar, par.x * 0.012, par.y * 0.008);
    gl.uniform2f(U.uWind, f.dirX >= 0 ? 1 : -1, 0);
    gl.uniform2f(U.uTexel, 1 / ph.w, 1 / ph.h);
    gl.uniform2f(U.uDTexel, dm ? 1 / dm.w : 0, dm ? 1 / dm.h : 0);
    gl.uniform1f(U.uT, live ? t : 0);
    gl.uniform1f(U.uFlatMix, fl ? overcast(f) : 0);
    gl.uniform1f(U.uSway, live ? clamp(0.6 + f.wind / 7, 0.6, 9) * (ph.w / 1600) : 0);
    gl.uniform1f(U.uRipple, live ? 0.35 + (layers.water ? layers.water.rough : 0) * 3.2 : 0);
    gl.uniform1f(U.uDPR, DPR);
    gl.uniform1f(U.uWet, f.rain ? clamp(0.5 + f.rain * 0.5, 0, 1) : 0);
    gl.uniform1f(U.uSnow, f.snow ? clamp(0.45 + f.snow * 0.4, 0, 1) : 0);
    gl.uniform1f(U.uAutumn, se.autumn * amt);
    gl.uniform1f(U.uBare, se.bare * amt);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    root.classList.add("gl-on");
    return true;
  }

  /* ── the picture's own life ──
     Ric, 2026-10-25: "we need to make the pictures feel real so the ocean will
     have the water moving the city will have lights flickering and on. the idea
     is to make it as realistic as possible."

     Water: the photo's water is redrawn a thin strip at a time, each strip
     shifted by two slow waves — a few pixels far off, more close up, more in
     wind and rain — so the sea and the lakes' reflections move. Cut to the water
     map, on the canvas that carries the photo's filter. */
  /* how far a strip of water at row y is pushed, across and up, at time t */
  function wave(w, y, t) {
    const span = Math.max(1, w.y1 - w.y0), rough = w.rough;
    const u = (y - w.y0) / span, f = 0.3 + u;                        // 0 far … 1 near
    const A = DPR * (0.35 + rough * 3.2) * (0.25 + u * 1.2);
    const q = y / DPR / f;
    return [A * (Math.sin(t * (1.1 + rough) + q * 0.13) + 0.55 * Math.sin(t * (1.9 + rough * 1.4) + q * 0.29 + 2)),
      A * 0.4 * Math.sin(t * (1.4 + rough) + q * 0.21 + 1)];
  }
  /* a still lake is a mirror: the sky above it — its colour, its cloud, the
     stars, the moon — drawn upside down about the shore and rippled with the
     water, over the photo's own reflection of a sky that is not there now */
  const MIRROR = { water: 0.657 };
  function drawMirror(t) {
    const w = layers.water, m = MIRROR[scene.id];
    if (!w || m == null || !skyCv) return;
    const r = w.pr, ay = r.y + m * r.h;
    const hb = Math.max(3, Math.round(3 * DPR));
    ctx.globalAlpha = 0.72 * (1 - clamp(w.rough / 1.3, 0, 0.6));     // a rough lake mirrors less
    for (let y = Math.max(Math.floor(ay), 0); y < Math.min(H, w.y1); y += hb) {
      const [dx] = wave(w, y, t), sy = 2 * ay - y;                     // the sky row this one mirrors
      if (sy < 0) break;
      ctx.drawImage(skyCv, 0, Math.max(0, sy - hb), W, hb, dx, y, W, hb);
    }
    ctx.globalAlpha = 1;
  }
  function drawWater(t) {
    const w = layers.water;
    wctx.clearRect(0, 0, W, H);
    if (!w || root.classList.contains("gl-on")) return;                // the GPU layer ripples the water itself
    const img = w.img, r = w.pr, iw = img.naturalWidth, ih = img.naturalHeight;
    const hb = Math.max(2, Math.round(2 * DPR));
    for (let y = Math.floor(w.y0); y < w.y1; y += hb) {
      const [dx, dy] = wave(w, y, t);
      const sy = (y + dy - r.y) / r.h * ih;
      if (sy < 0 || sy >= ih) continue;
      wctx.drawImage(img, 0, sy, iw, Math.max(1, hb / r.h * ih), r.x + dx, y, r.w, hb);
    }
    wctx.globalCompositeOperation = "destination-in";
    wctx.drawImage(w.mask.img, w.mr.x, w.mr.y, w.mr.w, w.mr.h);
    wctx.globalCompositeOperation = "source-over";
  }

  /* on the water: the sun's or moon's glitter, thickest in a path under it when
     it is in view; whitecaps in a wind; rings where rain lands */
  function waterLife(t, dt, live) {
    const w = layers.water;
    if (!w || !w.pts.length) return;
    const f = fx, P = f.phase;
    let src = null;
    if (P.sunPos ? P.sunPos.alt > 0 : P.dark < 0.3) {
      src = { p: P.sunPos && skyPoint(P.sunPos.az, P.sunPos.alt), k: (1 - f.cloud * 0.92) * (1 - f.fog), col: P.warm > 0.3 ? [255, 196, 130] : [255, 252, 238] };
    } else if (P.moon && P.moon.alt > 0 && P.dark > 0.5) {
      src = { p: skyPoint(P.moon.az, P.moon.alt), k: P.moon.fraction * (1 - f.cloud) * (1 - f.fog) * 0.85, col: [214, 226, 255] };
    }
    ctx.globalCompositeOperation = "lighter";
    if (src && src.k > 0.04) {
      for (const g of w.pts) {
        const path = src.p ? Math.exp(-(((g[0] - src.p.x) / (W * 0.07 * (0.6 + g[2]))) ** 2)) : 0;
        const tw = Math.sin(t * g[3] + g[4]);
        const cut = 0.93 - path * 0.45;
        if (tw < cut) continue;
        const a = (tw - cut) / (1 - cut) * src.k * (0.25 + path * 0.9);
        const len = (2 + g[2] * 5) * DPR * (0.6 + path);
        ctx.fillStyle = rgba(src.col, Math.min(1, a));
        ctx.fillRect(g[0] - len / 2, g[1], len, Math.max(1, DPR * (0.7 + g[2] * 0.6)));
      }
    }
    ctx.globalCompositeOperation = "source-over";
    if (!live) return;
    const pick = () => w.pts[Math.floor(Math.random() * w.pts.length)];
    /* whitecaps from about 28 km/h (17 mph), more the harder it blows */
    if (f.wind > 28) {
      const n = (f.wind - 28) / 30 * 7 * dt;
      for (let i = 0; i < Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); i++) { const g = pick(); w.caps.push({ x: g[0], y: g[1], u: g[2], age: 0, life: rnd(0.7, 1.6) }); }
    }
    /* rain: a ring for each drop that lands */
    if (f.rain) {
      const n = f.rain * 45 * dt;
      for (let i = 0; i < Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); i++) { const g = pick(); w.rings.push({ x: g[0], y: g[1], u: g[2], age: 0, life: rnd(0.5, 0.9) }); }
    }
    const lit = 1 - P.dark * 0.65;
    for (const c of w.caps) {
      c.age += dt;
      const a = Math.sin(Math.min(1, c.age / c.life) * Math.PI) * 0.7 * lit, rx = (2 + c.u * 6) * DPR;
      ctx.fillStyle = `rgba(245,250,255,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, rx * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = Math.max(1, DPR * 0.8);
    for (const r of w.rings) {
      r.age += dt;
      const k = r.age / r.life, rx = (1 + k * 9 * (0.3 + r.u)) * DPR;
      ctx.strokeStyle = `rgba(225,235,250,${((1 - k) * 0.4 * lit).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rx, rx * 0.25 * (0.4 + r.u), 0, 0, Math.PI * 2); ctx.stroke();
    }
    w.caps = w.caps.filter((c) => c.age < c.life);
    w.rings = w.rings.filter((r) => r.age < r.life);
  }

  /* the city after dark: windows come on as the light goes — most in the
     evening, fewer through the night — one goes off or on every second or so,
     a few flicker (a television's blue, a failing tube), the towers' tops blink
     red for aircraft, and the streets' orange glows low in the air */
  function cityLights(t, dt, live, now) {
    const c = layers.city;
    if (!c) return;
    const f = fx, k = clamp((f.phase.dark - 0.18) / 0.45, 0, 1);
    if (k <= 0) return;
    if (live && now > c.next) {
      const w = c.wins[Math.floor(Math.random() * c.wins.length)];
      if (w) w.on = w.on ? Math.random() > c.share * 0.9 : Math.random() < c.share * 1.1;
      c.next = now + rnd(400, 1600);
    }
    ctx.globalCompositeOperation = "lighter";
    /* the streets' glow, low in the air */
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, "rgba(255,150,70,0)"); g.addColorStop(1, `rgba(255,150,70,${(0.12 * k).toFixed(3)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const w of c.wins) {
      if (!w.on) continue;
      let a = k * w.b;
      if (w.tv) a *= 0.45 + 0.55 * Math.abs(Math.sin(t * 7.3 + w.ph) * Math.sin(t * 2.9 + w.ph * 1.7));
      if (w.buzz && Math.sin(t * 23 + w.ph) > 0.6 && Math.sin(t * 0.7 + w.ph) > 0.3) a *= 0.25;
      ctx.fillStyle = rgba(w.col, a);
      ctx.fillRect(w.x - w.s / 2, w.y - w.s * 0.6, w.s, w.s * 1.2);
      if (w.b > 0.8) { ctx.fillStyle = rgba(w.col, a * 0.16); ctx.fillRect(w.x - w.s * 1.6, w.y - w.s * 1.6, w.s * 3.2, w.s * 3.2); }
    }
    /* aircraft warning lights: red, on together for a beat, then off */
    for (const tp of c.tops) {
      const on = ((t + tp.ph) % 1.5) < 0.75;
      if (!on) continue;
      const R = 7 * DPR, gl = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, R);
      gl.addColorStop(0, `rgba(255,40,30,${(0.95 * k).toFixed(3)})`); gl.addColorStop(0.25, `rgba(255,30,20,${(0.45 * k).toFixed(3)})`); gl.addColorStop(1, "rgba(255,20,10,0)");
      ctx.fillStyle = gl; ctx.fillRect(tp.x - R, tp.y - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function frame(now) {
    const f = fx;
    /* nothing to draw into until the scene has a size (a tab opened hidden) */
    if (!f || !W || !H) return;
    const live = animated();
    const dt = live && lastT ? Math.min(0.06, (now - lastT) / 1000) : 0;
    lastT = now;
    ctx.clearRect(0, 0, W, H);
    const t = now / 1000;
    /* the wind comes in gusts: everything it carries thickens and thins */
    moveGrain(now, live);
    const gust = live ? 0.72 + 0.28 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1) + (f.gusty ? 0.25 * Math.max(0, Math.sin(t * 0.23)) : 0) : 0.85;

    drawGL(t, dt, live);
    drawWater(t);
    drawSky(dt, t, live, now);
    drawShadows(now, live);
    drawMirror(t);
    waterLife(t, dt, live);
    cityLights(t, dt, live, now);
    /* spindrift streaming off the summits */
    if (plume.length || layers.peaks) {
      if (live) stepPlume(dt);
      const img = blobImg();
      /* each puff drawn long and low, so together they read as a banner */
      for (const p of plume) {
        ctx.globalAlpha = 0.55 * (1 - p.age / p.life) * Math.min(1, p.age * 4) * gust * (1 - f.phase.dark * 0.7);
        ctx.drawImage(img, p.x - p.r * 2.4, p.y - p.r, p.r * 4.8, p.r * 2);
      }
      ctx.globalAlpha = 1;
    }
    /* low cloud over the tops */
    if (layers.deck) {
      const d = layers.deck, r = photoRect();
      const base = Math.max(H * 0.12, r.y + r.h * (scene.horizon ?? 0.35) * (0.4 + d.low * 0.75));
      d.off += d.v * dt;
      ctx.globalAlpha = 0.3 + d.low * 0.65;
      tiled(ctx, d.img, d.off, -H * 0.05, W * 1.8, base + H * 0.05);
      ctx.globalAlpha = 1;
    }
    /* rain and snow put a veil in the air, the far side of the picture first */
    if (f.rain || f.snow) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      const c = f.snow ? shade([232, 238, 246], 1 - f.phase.dark * 0.75) : shade([128, 140, 156], 1 - f.phase.dark * 0.7);
      const a = Math.min(0.32, (f.rain + f.snow) * 0.16);
      g.addColorStop(0, rgba(c, a)); g.addColorStop(0.55, rgba(c, a * 0.9)); g.addColorStop(1, rgba(c, a * 0.35));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    /* fog: each part of the picture lost by as much as its distance says —
       the sky and the far side first, the near ground last — and banks
       moving through between them */
    drawHaze();
    if (layers.fog) {
      const fg = layers.fog, band = layers.skyH || H * 0.5;
      /* the depth map does it pixel by pixel; without one, by height */
      if (!layers.haze2) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, rgba(fg.col, fg.far));
        g.addColorStop(clamp(band / H, 0.05, 0.9), rgba(fg.col, fg.far));
        g.addColorStop(1, rgba(fg.col, fg.near));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      fg.off += fg.v * dt;
      ctx.globalAlpha = clamp((fg.far - fg.near) * 0.7 + fg.near * 0.3, 0, 0.8);
      tiled(ctx, fg.img, fg.off, band * 0.6, W * 1.6, H * 0.75);
      tiled(ctx, fg.img, -fg.off * 0.6 + W * 0.4, band * 0.85, W * 2.2, H * 0.6);
      ctx.globalAlpha = 1;
    }
    drawBoltOver();
    /* wind: the low air hazed with what it carries, and sheets of it moving */
    if (layers.haze) {
      const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
      g.addColorStop(0, rgba(layers.haze.col, 0)); g.addColorStop(1, rgba(shade(layers.haze.col, 1 - f.phase.dark * 0.7), layers.haze.a * gust));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (layers.sheet) {
      const s = layers.sheet;
      s.off += s.v * dt;
      ctx.globalAlpha = s.a * gust * (1 - f.phase.dark * 0.65);
      tiled(ctx, s.img, s.off, H * 0.52, W * 1.4, H * 0.5);
      tiled(ctx, s.img, s.off * 1.6 + W * 0.3, H * 0.7, W * 0.9, H * 0.32);
      ctx.globalAlpha = 1;
    }
    /* rain and snow, as a camera records them: far drops fine and many, near
       ones wide, soft and almost clear (out of focus in front of the lens);
       drawn to lighten what is behind, so rain shows against dark rock and all
       but vanishes against a bright sky. Snow the same: near flakes big blurs. */
    if (parts.length) {
      const lit = 1 - f.phase.dark * 0.45;                         // rain and snow catch less light at night
      const streak = streakImg(), flake = flakeImg();
      ctx.globalCompositeOperation = "screen";
      for (const p of parts) {
        if (p.type === "r") {
          p.x += p.vx * dt; p.y += p.v * dt;
          if (p.y - p.len > H) { p.y = -rnd(0, 0.2) * H; p.x = rnd(-0.2, 1.2) * W; }
          if (p.x < -0.25 * W) p.x += 1.45 * W; else if (p.x > 1.25 * W) p.x -= 1.45 * W;
          const near = p.z > 0.88, wdt = (near ? 5 + (p.z - 0.88) * 60 : 0.7 + p.z * 1.4) * DPR;
          const len = p.len * (near ? 2.4 : 1), ang = Math.atan2(p.vx, p.v);
          ctx.globalAlpha = (near ? 0.07 : p.a * (0.55 + p.z * 0.6)) * lit;
          ctx.setTransform(Math.cos(ang), -Math.sin(ang), Math.sin(ang), Math.cos(ang), p.x, p.y);
          ctx.drawImage(streak, -wdt / 2, -len, wdt, len);
        } else {
          p.ph += dt * (0.8 + p.z);
          p.x += (p.vx + Math.sin(p.ph) * 14 * DPR) * dt; p.y += p.v * dt;
          if (p.y - p.r > H) { p.y = -p.r * 2; p.x = rnd(0, W); }
          if (p.x < -10) p.x += W + 20; else if (p.x > W + 10) p.x -= W + 20;
          const near = p.z > 0.9, r = near ? p.r * 4 : p.r * 1.6;
          ctx.globalAlpha = (near ? 0.18 : p.a) * lit;
          ctx.drawImage(flake, p.x - r, p.y - r, r * 2, r * 2);
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      drawSplashes(dt, live, lit);
    }
    /* what the wind carries, mote by mote: streaks of dust, sand, grit, spray
       and snow; leaves tumble */
    if (dust.length) {
      const g = layers.blow, dir = f.dirX >= 0 ? 1 : -1;
      ctx.lineCap = "round";
      for (let i = 0; i < dust.length; i++) {
        const p = dust[i];
        p.ph += dt * 3;
        p.x += p.v * gust * dt; p.y += (p.lift + Math.sin(p.ph) * 12 * DPR) * dt;
        /* dust stays near the ground: risen into the sky it read as flocks of birds */
        if (p.x > W * 1.1 || p.x < -W * 0.1 || p.y < H * (g.kind === "leaves" ? 0.2 : 0.48) || p.y > H * 1.05) { dust[i] = newMote(g, f.blow, dir, false); continue; }
        ctx.globalAlpha = p.a * gust * (1 - f.phase.dark * 0.6);
        if (g.kind === "leaves") {
          ctx.fillStyle = rgba(p.col, 1);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph);
          ctx.beginPath(); ctx.ellipse(0, 0, (5 + p.z * 6) * DPR, (2.4 + p.z * 3) * DPR * Math.abs(Math.cos(p.ph * 0.7)) + 0.8 * DPR, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          /* a grain, and behind it a trail that fades to nothing */
          const tx = p.x - p.len * dir, ty = p.y - (p.lift + Math.sin(p.ph) * 12 * DPR) * p.len / Math.abs(p.v);
          const tr = ctx.createLinearGradient(p.x, p.y, tx, ty);
          tr.addColorStop(0, rgba(p.col, 0.9)); tr.addColorStop(1, rgba(p.col, 0));
          ctx.strokeStyle = tr;
          ctx.lineWidth = p.r;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.fillStyle = rgba(p.col, 1);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.75, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    /* beads on the glass: a dark rim and a bright fleck, and now and then one runs */
    if (drops.length) {
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        if (live) {
          if (!d.run && Math.random() < dt * 0.05 * (d.r / (5 * DPR))) d.run = rnd(60, 160) * DPR;
          if (d.run) {
            d.y += d.run * dt; d.x += Math.sin(d.y / (9 * DPR)) * 0.3 * DPR;
            d.trail.push([d.x, d.y]); if (d.trail.length > 40) d.trail.shift();
            d.r = Math.max(1.6 * DPR, d.r - dt * 0.6 * DPR);
          }
          if (d.y - d.r > H || now - d.born > d.life * (d.run ? 3 : 1)) { drops[i] = newDrop(false); continue; }
        }
        if (d.trail.length > 2) {
          ctx.strokeStyle = "rgba(220,235,255,.10)"; ctx.lineWidth = d.r * 0.55;
          ctx.beginPath(); ctx.moveTo(d.trail[0][0], d.trail[0][1]);
          for (const [x, y] of d.trail) ctx.lineTo(x, y);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(200,220,245,.07)";
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 1.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(235,244,255,.34)"; ctx.lineWidth = Math.max(1, d.r * 0.16);
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.88, d.r, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.beginPath(); ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.38, Math.max(0.8 * DPR, d.r * 0.2), 0, Math.PI * 2); ctx.fill();
      }
    }
    /* lightning: the sky lights, and most times a stroke comes down to the
       land ("if its raining and lighting there is lightning strikes"); brighter
       against a dark sky. Never with Moving weather off or reduced motion. */
    if (f.storm && live) {
      if (nextFlash && now >= nextFlash) {
        flashT = now; bolt = Math.random() < 0.8 ? makeBolt() : null;
        nextFlash = now + (Math.random() < 0.25 ? rnd(600, 1500) : rnd(3000, 9000));   // strokes come in runs
      }
      if (flashT >= 0) {
        const e = now - flashT, k = 0.75 + f.phase.dark * 0.45;
        /* two quick pulses, the way a stroke flickers */
        const a = (e < 70 ? 0.55 : e < 130 ? 0.12 : e < 210 ? 0.4 : Math.max(0, 0.4 - (e - 210) / 500)) * k;
        flashEl.style.opacity = Math.min(0.85, a).toFixed(3);
        const nl = nearLight();
        if (nl && a > 0.02) {
          const r = coverRect(nl.w, nl.h);
          ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(0.3, a * 0.45);
          ctx.drawImage(nl.cv, r.x, r.y, r.w, r.h);
          ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        }
        if (bolt && e < 260) {
          /* where it lands, the ground lights */
          const [hx, hy] = bolt.hit, R = 90 * DPR;
          const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, R);
          gl.addColorStop(0, `rgba(220,228,255,${e < 70 || (e > 130 && e < 210) ? 0.55 : 0.2})`); gl.addColorStop(1, "rgba(220,228,255,0)");
          ctx.fillStyle = gl; ctx.fillRect(hx - R, hy - R, R * 2, R * 2);
          ctx.strokeStyle = `rgba(235,240,255,${e < 70 || (e > 130 && e < 210) ? 0.95 : 0.35})`;
          ctx.shadowColor = "rgba(190,200,255,.9)"; ctx.shadowBlur = 14 * DPR;
          /* drawn strokes only if the real ones could not load */
          for (const [pts, w] of bolt.sprite ? [] : [[bolt.pts, 2.2], ...bolt.branches.map((b) => [b, 1.1])]) {
            ctx.lineWidth = w * DPR; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
            for (const [x, y] of pts) ctx.lineTo(x, y);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
        }
        if (e > 1100) { flashT = -1; bolt = null; flashEl.style.opacity = "0"; }
      }
    }
  }

  /* ── running ── */
  const STEP = 1000 / 30;
  function loop(now) {
    raf = 0;
    if (document.hidden || !animated() || !fx) return;
    if (now - lastT >= STEP - 2) frame(now);
    raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    lastT = 0;
    if (!fx) return;
    frame(performance.now());
    if (animated() && (parts.length || drops.length || stars.length || dust.length || plume.length || layers.clouds || layers.sky || layers.shadows || glActive() || layers.deck || layers.fog || layers.sheet || layers.water || (layers.city && fx.phase.dark > 0.18) || fx.storm)) raf = requestAnimationFrame(loop);
    if (!animated()) flashEl.style.opacity = "0";
  }
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(innerWidth * DPR), h = Math.round(innerHeight * DPR);
    /* a phone's address bar showing and hiding changes the height a little: not worth a rebuild */
    if (w === W && Math.abs(h - H) < 120 * DPR) return false;
    W = cv.width = waterCv.width = w; H = cv.height = waterCv.height = h;
    return true;
  }
  let resizeT = 0;
  addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (size() && fx) { build(); kick(); } }, 150); });
  document.addEventListener("visibilitychange", () => {
    /* a hidden tab plays no sky */
    const v = layers && layers.sky && layers.sky.cur.v;
    if (v) { if (document.hidden) v.pause(); else if (animated()) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } }
    if (!document.hidden) kick();
  });
  reduced.addEventListener && reduced.addEventListener("change", () => { if (fx) { build(); kick(); } });

  /* the same reading again (app.js redraws often) changes nothing on screen */
  let lastKey = "";
  function update(s) {
    st = s;
    const next = effects(forced || s);
    const key = JSON.stringify([scene.id, next.kind, next.phase.name, Math.round(next.rain * 10), Math.round(next.snow * 10), Math.round(next.fog * 10), Math.round(next.cloud * 10), Math.round(next.wind / 5), Math.round(next.blow * 5), next.gusty, Math.round(next.dirX * 4), Math.round(next.stars * 5), Math.round(next.phase.dark * 10), Math.round(next.phase.warm * 5)]);
    fx = next;
    paintStill();
    if (key === lastKey && W) return;
    lastKey = key;
    size();
    build();
    kick();
  }
  /* the light moves on its own: the sun and moon move a quarter of a degree a
     minute, so dawn, golden hour and dusk come on without a reload */
  setInterval(() => { if (st !== undefined) update(st); }, 60e3);

  window.WxScene = {
    SCENES,
    current: () => scene,
    use(id) {
      scene = SCENES.find((s) => s.id === id) || SCENES[0];
      store.set("wx:scene", scene.id);
      lastKey = "";
      update(st);
    },
    motion(on) {
      if (on === undefined) return moving;
      moving = !!on;
      store.set("wx:motion", moving);
      lastKey = "";
      update(st);
      return moving;
    },
    update,
    /* the real sky on screen now, for its credit in the settings sheet */
    skyCredit: () => layers && layers.sky && skiesMeta ? skiesMeta[layers.sky.id] : null,
    /* to look at a weather that is not happening, from the console:
         WxScene.preview({ kind: "rain", cloud: 95, wind: 50, windDir: 270 })
       kinds: clear partly cloudy fog drizzle rain storm sleet snow; wind and
       gust in km/h; vis in metres; isDay: false for tonight, or at: a time in
       ms; lat/lon for another place. preview(null) goes back to the real
       reading. The page never calls it — the scene only ever shows the
       reading (header) — and nothing about it is kept. */
    preview(s) {
      forced = null;
      if (s) {
        /* the place is the real one unless given; `at` (ms) picks the time —
           without one, isDay: false finds tonight's darkest hour and isDay:
           true today's highest sun, so a preview shows that sky here */
        const here = st && Number.isFinite(st.lat) ? { lat: st.lat, lon: st.lon } : {};
        forced = Object.assign({ cloud: null, wind: 0 }, here, s);
        if (!Number.isFinite(forced.at) && Number.isFinite(forced.lat) && window.WxAstro && s.isDay != null) {
          let best = Date.now(), score = -Infinity;
          for (let h = 0; h < 24; h += 0.25) {
            const t = Date.now() + h * 3600e3, a = WxAstro.sun(t, forced.lat, forced.lon).alt;
            const v = s.isDay ? a : -a;
            if (v > score) { score = v; best = t; }
          }
          forced.at = best;
        }
      }
      lastKey = "";
      update(st);
    },
    /* for the tests: what a reading turns into, with no screen */
    effects
  };
  update(null);
})();
