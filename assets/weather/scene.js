/* SCENE — what is behind Weather (weather.html), and the weather happening in it.
   ────────────────────────────────────────────────────────────────────────────
   Ric, 2026-10-25: "I want the background to be really cool … presets like in
   the forest, in the city, in the mountains, on the water, on the beach", then
   "scenes as in real pictures. Then weather happens in the scene."

   So a scene is a photograph (or the plain sky, which needs none), and in it
   this file plays what app.js says is overhead right now — in the picture, not
   over it (Ric, same day: "if its cloudy the picture should have it be cloudy
   … if its windy it should be kicking up dust"):
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
    return { id, name, horizon, pos, credit, photo: `assets/weather/scenes/${id}.jpg`, thumb: `assets/weather/scenes/${id}-thumb.jpg` };
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
        sunPos: su, moon: { alt: mo.alt, az: mo.az, fraction: ml.fraction, phase: ml.phase, limb: A.limb(t, s.lat, s.lon) } };
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
    return { kind: k, phase, rain, snow, fog, vis, cloud, wind, blow, gusty, dirX, storm: k === "storm", stars };
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
      let b = 1 - f.cloud * 0.22 - (wet ? 0.14 : 0) - (f.storm ? 0.16 : 0);
      let sat = 1 - f.cloud * 0.35 - (wet ? 0.15 : 0) - f.fog * 0.3;
      /* the land goes dark with the sky; a high moon in a clear sky gives some back */
      const m = P.moon, moonlit = m && m.alt > 0 ? m.fraction * Math.min(1, m.alt / (25 * DEG)) * (1 - f.cloud) : 0;
      b *= 1 - P.dark * (0.74 - moonlit * 0.14);
      sat *= 1 - P.dark * 0.5 + P.warm * 0.12 * (1 - P.dark);
      photo.style.filter = `brightness(${b.toFixed(2)}) saturate(${sat.toFixed(2)})`;
      waterCv.style.filter = photo.style.filter;
    } else {
      photo.style.backgroundImage = "";
      photo.style.filter = "";
    }
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
        if (kind === "photo") { m.w = m.img.naturalWidth; m.h = m.img.naturalHeight; return done(); }
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
      m.img.src = kind === "photo" ? sc.photo : `assets/weather/scenes/${sc.id}-${kind}.png`;
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

  /* what the wind picks up in each picture. Rain lays dust, sand, grit and
     lying snow: in the wet only spray and leaves still blow. While it snows, everything
     blowing is snow. `peaks` are summits (shares of the photo) that stream
     spindrift in a wind — Cerro Torre, Torre Egger, Punta Herron and Standhardt. */
  /* scenes with water that moves, and with a town's light at night */
  const WET = new Set(["beach", "mountains", "water"]);
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
    if (sky && f.cloud > 0.04) {
      /* cloud goes by at the wind's speed: a still day creeps, a gale races
         ("if its windy and cloudy you see the clouds move") */
      const drift = (4 + clamp(f.wind, 0, 100) * 0.9) * DPR * dir;
      /* two layers each covering `each` overlap to cover 1 − (1 − each)² of
         the sky: sized so together they cover what the reading says */
      const each = 1 - Math.sqrt(1 - Math.min(0.97, f.cloud));
      layers.far = { img: tex(each, L.lo, L.hi, 0.8, { soft: 0.16, shift: 97 }), off: rnd(0, W), v: drift * 0.55 };
      layers.near = { img: tex(each, L.lo, L.hi, 0.95, { soft: 0.1, flip: true }), off: rnd(0, W), v: drift };
      layers.over = clamp((f.cloud - 0.6) / 0.35, 0, 1) * (f.storm ? 1 : 0.96);
      layers.overCol = L.mid;
    }
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
        layers.water = { mask: wm, mr, img: ph.img, pr, y0, y1, pts, caps: [], rings: [],
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
    nextFlash = f.storm ? performance.now() + rnd(800, 3000) : 0;
  }
  function newMote(g, b, dir, anywhere) {
    const z = Math.random();
    return { x: anywhere ? rnd(0, W) : dir > 0 ? -rnd(0, 0.2) * W : W * rnd(1, 1.2), y: H * rnd(g.kind === "leaves" ? 0.3 : 0.55, 1.02), z,
      v: (220 + z * 620) * DPR * (0.45 + b * 0.8) * dir, lift: rnd(-30, 10) * DPR, len: rnd(8, 40) * (0.4 + z) * DPR * (0.5 + b),
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
      [-6, [24, 30, 80], [190, 90, 90], 0.85], [-12, [6, 10, 30], [24, 30, 64], 0.95], [-18, [3, 6, 18], [10, 16, 36], 0.97]];
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
  function drawSunIn(s) {
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
    s.rotate(eastLeft() ? -P / 2 - m.limb : -P / 2 + m.limb);
    s.fillStyle = `rgba(150,165,200,${(0.1 * bright).toFixed(3)})`;      // the dark part, faintly (earthshine)
    s.beginPath(); s.arc(0, 0, r, 0, P * 2); s.fill();
    /* the lit part: the half-disc on the bright side, closed by the terminator,
       an ellipse that bulges into it while a crescent and away once gibbous */
    const k = m.fraction, rx = r * (1 - 2 * k);
    s.fillStyle = `rgba(240,243,252,${(0.95 * bright).toFixed(3)})`;
    s.beginPath();
    for (let i = 0; i <= 24; i++) { const a = -P / 2 + P * i / 24; s.lineTo(r * Math.cos(a), r * Math.sin(a)); }
    for (let i = 0; i <= 24; i++) { const a = P / 2 - P * i / 24; s.lineTo(rx * Math.cos(a), r * Math.sin(a)); }
    s.closePath(); s.fill();
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
    return { pts, branches, hit: [x, depth] };
  }

  /* the sky, drawn into its own canvas and cut to the photo's sky there: its
     colour for the hour, stars, the moon, the sun, then the cloud — so cloud
     covers them as it would, and none of it ever crosses a mountain */
  function drawSky(dt, t, live) {
    const m = scene.sky ? null : maskOf(scene);
    if (!scene.sky && !m) return;
    if (!skyCv) skyCv = document.createElement("canvas");
    if (skyCv.width !== W || skyCv.height !== H) { skyCv.width = W; skyCv.height = H; }
    const s = skyCv.getContext("2d");
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    s.clearRect(0, 0, W, H);
    const band = layers.skyH || H * 0.6;
    skyWash(s, band);
    if (stars.length) {
      for (const p of stars) {
        const a = live ? p.a * (0.7 + 0.3 * Math.sin(t * p.tw + p.ph)) : p.a;
        s.fillStyle = `rgba(235,240,255,${(a * fx.stars).toFixed(3)})`;
        s.fillRect(p.x, p.y, p.r, p.r);
      }
    }
    drawMoonIn(s);
    drawSunIn(s);
    if (layers.near) {
      if (layers.over > 0) { s.fillStyle = rgba(layers.overCol, layers.over); s.fillRect(0, 0, W, H); }
      for (const l of [layers.far, layers.near]) {
        l.off += l.v * dt;
        tiled(s, l.img, l.off, 0, W * (l === layers.far ? 1.5 : 2.1), band * 1.08);
      }
    }
    if (m) {
      const r = coverRect(m.w, m.h);
      s.globalCompositeOperation = "destination-in";
      s.drawImage(m.img, r.x, r.y, r.w, r.h);
      s.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(skyCv, 0, 0);
  }

  /* ── the picture's own life ──
     Ric, 2026-10-25: "we need to make the pictures feel real so the ocean will
     have the water moving the city will have lights flickering and on. the idea
     is to make it as realistic as possible."

     Water: the photo's water is redrawn a thin strip at a time, each strip
     shifted by two slow waves — a few pixels far off, more close up, more in
     wind and rain — so the sea and the lakes' reflections move. Cut to the water
     map, on the canvas that carries the photo's filter. */
  function drawWater(t) {
    const w = layers.water;
    wctx.clearRect(0, 0, W, H);
    if (!w) return;
    const img = w.img, r = w.pr, iw = img.naturalWidth, ih = img.naturalHeight;
    const hb = Math.max(2, Math.round(2 * DPR)), span = Math.max(1, w.y1 - w.y0), rough = w.rough;
    for (let y = Math.floor(w.y0); y < w.y1; y += hb) {
      const u = (y - w.y0) / span, f = 0.3 + u;                      // 0 far … 1 near
      const A = DPR * (0.35 + rough * 3.2) * (0.25 + u * 1.2);
      const q = y / DPR / f;
      const dx = A * (Math.sin(t * (1.1 + rough) + q * 0.13) + 0.55 * Math.sin(t * (1.9 + rough * 1.4) + q * 0.29 + 2));
      const dy = A * 0.4 * Math.sin(t * (1.4 + rough) + q * 0.21 + 1);
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
    if (!f) return;
    const live = animated();
    const dt = live && lastT ? Math.min(0.06, (now - lastT) / 1000) : 0;
    lastT = now;
    ctx.clearRect(0, 0, W, H);
    const t = now / 1000;
    /* the wind comes in gusts: everything it carries thickens and thins */
    const gust = live ? 0.72 + 0.28 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1) + (f.gusty ? 0.25 * Math.max(0, Math.sin(t * 0.23)) : 0) : 0.85;

    drawWater(t);
    drawSky(dt, t, live);
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
    if (layers.fog) {
      const fg = layers.fog, band = layers.skyH || H * 0.5;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(fg.col, fg.far));
      g.addColorStop(clamp(band / H, 0.05, 0.9), rgba(fg.col, fg.far));
      g.addColorStop(1, rgba(fg.col, fg.near));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      fg.off += fg.v * dt;
      ctx.globalAlpha = clamp((fg.far - fg.near) * 0.7 + fg.near * 0.3, 0, 0.8);
      tiled(ctx, fg.img, fg.off, band * 0.6, W * 1.6, H * 0.75);
      tiled(ctx, fg.img, -fg.off * 0.6 + W * 0.4, band * 0.85, W * 2.2, H * 0.6);
      ctx.globalAlpha = 1;
    }
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
    /* rain and snow */
    if (parts.length) {
      const lit = 1 - f.phase.dark * 0.45;                         // rain and snow catch less light at night
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(210,225,245,1)";
      for (const p of parts) {
        if (p.type === "r") {
          p.x += p.vx * dt; p.y += p.v * dt;
          if (p.y - p.len > H) { p.y = -rnd(0, 0.2) * H; p.x = rnd(-0.2, 1.2) * W; }
          if (p.x < -0.25 * W) p.x += 1.45 * W; else if (p.x > 1.25 * W) p.x -= 1.45 * W;
          const k = p.len / Math.hypot(p.vx, p.v);
          ctx.globalAlpha = p.a * lit;
          ctx.lineWidth = (0.7 + p.z * 0.9) * DPR;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * k, p.y - p.v * k); ctx.stroke();
        } else {
          p.ph += dt * (0.8 + p.z);
          p.x += (p.vx + Math.sin(p.ph) * 14 * DPR) * dt; p.y += p.v * dt;
          if (p.y - p.r > H) { p.y = -p.r * 2; p.x = rnd(0, W); }
          if (p.x < -10) p.x += W + 20; else if (p.x > W + 10) p.x -= W + 20;
          ctx.globalAlpha = p.a * lit;
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
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
        if (p.x > W * 1.1 || p.x < -W * 0.1 || p.y < H * 0.2 || p.y > H * 1.05) { dust[i] = newMote(g, f.blow, dir, false); continue; }
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
        if (bolt && e < 260) {
          /* where it lands, the ground lights */
          const [hx, hy] = bolt.hit, R = 90 * DPR;
          const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, R);
          gl.addColorStop(0, `rgba(220,228,255,${e < 70 || (e > 130 && e < 210) ? 0.55 : 0.2})`); gl.addColorStop(1, "rgba(220,228,255,0)");
          ctx.fillStyle = gl; ctx.fillRect(hx - R, hy - R, R * 2, R * 2);
          ctx.strokeStyle = `rgba(235,240,255,${e < 70 || (e > 130 && e < 210) ? 0.95 : 0.35})`;
          ctx.shadowColor = "rgba(190,200,255,.9)"; ctx.shadowBlur = 14 * DPR;
          for (const [pts, w] of [[bolt.pts, 2.2], ...bolt.branches.map((b) => [b, 1.1])]) {
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
    if (animated() && (parts.length || drops.length || stars.length || dust.length || plume.length || layers.near || layers.deck || layers.fog || layers.sheet || layers.water || (layers.city && fx.phase.dark > 0.18) || fx.storm)) raf = requestAnimationFrame(loop);
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
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
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
