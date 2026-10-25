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
     fog                the picture goes pale and flat, banks moving through it
     wind               from 18 km/h, what the ground gives up blows across it
                        — dust, sand, grit, spray, leaves; spindrift streams off
                        Cerro Torre's summits; rain lays the dust, snow blows
     storm              darker still, and lightning down through open sky
     the sun            dawn, day, golden hour, dusk and night from the real
                        sunrise and sunset; stars and the moon in open sky
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

  /* ── the light: where the sun is, from the real times ── */
  function phaseOf(s) {
    const now = Date.now() / 1000;
    if (!s || !s.rise || !s.set) return { name: s && s.isDay === false ? "night" : "day", sun: 0.5 };
    const M = 60;
    if (now < s.rise - 40 * M || now > s.set + 45 * M) return { name: "night", sun: null };
    if (now < s.rise + 50 * M) return { name: "dawn", sun: 0 };
    if (now > s.set) return { name: "dusk", sun: 1 };
    const sun = (now - s.rise) / (s.set - s.rise);
    return { name: now > s.set - 80 * M ? "golden" : "day", sun };
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
    const vis = s.vis == null ? 20000 : s.vis;
    const fog = k === "fog" ? clamp(1.1 - vis / 5000, 0.45, 1) : vis < 8000 ? clamp(0.6 - vis / 16000, 0, 0.45) : 0;
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
    /* the reading's own day or night wins over the clock: the times are a
       day's, and a reading at the edge of one should not light a dark sky */
    if (s.isDay === false && phase.name !== "night" && phase.name !== "dusk" && phase.name !== "dawn") phase = { name: "night", sun: null };
    else if (s.isDay === true && phase.name === "night") phase = { name: "day", sun: 0.5 };
    const stars = phase.name === "night" ? clamp(1 - cloud * 1.15, 0, 1) * (rain || snow ? 0 : 1) * (1 - fog) : 0;
    return { kind: k, phase, rain, snow, fog, cloud, wind, blow, gusty, dirX, storm: k === "storm", stars };
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
      const wet = f.rain || f.snow;
      let b = 1 - f.cloud * 0.22 - (wet ? 0.14 : 0) - (f.storm ? 0.16 : 0);
      let sat = 1 - f.cloud * 0.35 - (wet ? 0.15 : 0) - f.fog * 0.3;
      if (ph === "golden") { b *= 0.92; sat *= 1.1; }
      if (ph === "dawn" || ph === "dusk") { b *= 0.62; sat *= 0.85; }
      if (ph === "night") { b *= 0.32; sat *= 0.55; }
      if (ph !== "night") b *= 1 + f.fog * 0.12;               // fog is bright from inside it
      photo.style.filter = `brightness(${b.toFixed(2)}) saturate(${sat.toFixed(2)}) contrast(${(1 - f.fog * 0.5).toFixed(2)})`;
    } else {
      photo.style.backgroundImage = "";
      photo.style.filter = "";
    }
    /* the colour of the light, laid over the picture (and the plain sky's gradient) */
    const tints = {
      dawn: "linear-gradient(180deg, rgba(70,60,140,.35), rgba(255,150,120,.22) 70%, rgba(255,190,140,.18))",
      golden: "linear-gradient(180deg, rgba(255,170,80,.08), rgba(255,140,60,.22) 75%, rgba(255,120,50,.26))",
      dusk: "linear-gradient(180deg, rgba(30,30,90,.45), rgba(200,90,110,.22) 75%, rgba(255,130,90,.2))",
      night: "linear-gradient(180deg, rgba(4,10,40,.45), rgba(10,20,60,.3))",
      day: f.cloud > 0.6 || f.rain || f.snow ? "linear-gradient(180deg, rgba(120,140,160,.12), rgba(60,75,95,.1))" : "none"
    };
    tint.style.backgroundImage = tints[ph] || "none";
  }

  /* ── where the sky is in the photo ──
     Ric, 2026-10-25: "if its cloudy the picture should have it be cloudy if its
     raining it should be raining … if its foggy it should have fog if its windy
     it should be kicking up dust". So the weather is drawn INTO the picture, not
     laid over it as a dimmer. <id>-sky.png (sky-masks.py) is the photo at 800 px
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
  const masks = {};
  function maskOf(sc) {
    if (sc.sky || !sc.photo) return null;
    let m = masks[sc.id];
    if (!m) {
      m = masks[sc.id] = { img: new Image(), data: null, w: 0, h: 0 };
      m.img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = m.img.naturalWidth; c.height = m.img.naturalHeight;
          const x = c.getContext("2d");
          x.drawImage(m.img, 0, 0);
          m.data = x.getImageData(0, 0, c.width, c.height).data;
          m.w = c.width; m.h = c.height;
        } catch (e) { m.data = null; }
        if (scene === sc && fx) { lastKey = ""; update(st); }
      };
      m.img.src = `assets/weather/scenes/${sc.id}-sky.png`;
    }
    return m.w ? m : null;
  }
  /* how much the canvas pixel x, y is sky, 0 … 1 */
  function skyAt(x, y) {
    if (scene.sky) return y < H * 0.8 ? 1 : 0;
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
    const k = ph === "night" ? 0.2 : ph === "dawn" || ph === "dusk" ? 0.55 : ph === "golden" ? 0.92 : 1;
    const grey = f.storm ? 0.42 : f.rain || f.snow ? 0.64 : f.cloud > 0.85 ? 0.78 : f.cloud > 0.6 ? 0.9 : 1;
    let hi = [255, 255, 255], lo = [192, 200, 214];
    if (warm) { hi = [255, 210, 176]; lo = [170, 146, 160]; }
    if (ph === "night") { hi = [160, 172, 205]; lo = [96, 106, 136]; }
    hi = shade(hi, k * grey); lo = shade(lo, k * grey * (f.storm ? 0.7 : 0.88));
    return { hi, lo, mid: hi.map((v, i) => Math.round((v + lo[i]) / 2)),
      fog: shade(ph === "night" ? [70, 78, 94] : warm ? [214, 196, 192] : [218, 224, 230], ph === "night" ? 1 : k * (f.rain ? 0.85 : 1)) };
  }

  /* what the wind picks up in each picture. Rain lays dust, sand, grit and
     lying snow: in the wet only spray and leaves still blow. While it snows, everything
     blowing is snow. `peaks` are summits (shares of the photo) that stream
     spindrift in a wind — Cerro Torre, Torre Egger, Punta Herron and Standhardt. */
  const GROUND = {
    crag: { kind: "dust", col: [204, 134, 92] },
    mountains: { kind: "dust", col: [182, 166, 136] },
    city: { kind: "grit", col: [176, 172, 164] },
    beach: { kind: "sand", col: [238, 220, 178] },
    water: { kind: "spray", col: [232, 242, 252] },
    forest: { kind: "leaves", col: [176, 122, 52] },
    torre: { kind: "snow", col: [246, 249, 255], peaks: [[0.375, 0.07], [0.47, 0.235], [0.6, 0.35]] }
  };
  const LEAVES = [[226, 160, 62], [204, 120, 44], [176, 184, 74], [238, 194, 96]];
  function blowing(f) {
    const g = GROUND[scene.id];
    if (!g || !f.blow) return null;
    if (f.snow) return { kind: "snow", col: [244, 248, 255] };
    if (f.rain && (g.kind === "dust" || g.kind === "grit" || g.kind === "sand" || g.kind === "snow")) return null;
    return g;
  }

  /* ── the moving parts ── */
  let layers = {}, dust = [], plume = [], skyCv = null, moon = null;
  function build() {
    const f = fx;
    const area = (W * H) / (DPR * DPR);
    const small = W / DPR < 640;
    parts = []; drops = []; stars = []; dust = []; plume = []; layers = {}; moon = null;
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
      /* the moon where there is open sky for it, towards the top right */
      const r = Math.min(W, H) * 0.028 + 6 * DPR;
      for (const fxp of [0.86, 0.76, 0.66, 0.16, 0.26, 0.5]) {
        const x = W * fxp, d = skyDepth(x);
        if (d > r * 6) { moon = { x, y: Math.max(r * 2.5, d * 0.35), r }; break; }
      }
    }
    const L = light(f);
    /* cloud in the sky: two layers drifting at their own speeds, and from 60%
       cover a grey ceiling filling in behind them until the blue is gone */
    if (sky && f.cloud > 0.04) {
      const drift = (5 + clamp(f.wind, 0, 90) * 0.55) * DPR * dir;
      /* two layers each covering `each` overlap to cover 1 − (1 − each)² of
         the sky: sized so together they cover what the reading says */
      const each = 1 - Math.sqrt(1 - Math.min(0.97, f.cloud));
      layers.far = { img: tex(each, L.lo, L.hi, 0.8, { soft: 0.16, shift: 97 }), off: rnd(0, W), v: drift * 0.55 };
      layers.near = { img: tex(each, L.lo, L.hi, 0.95, { soft: 0.1, flip: true }), off: rnd(0, W), v: drift };
      layers.over = clamp((f.cloud - 0.6) / 0.35, 0, 1) * (f.storm ? 1 : 0.96);
      layers.overCol = L.mid;
      /* how far down the sky goes on screen, for stretching the cloud over it */
      let d = 0;
      if (scene.sky) d = H * 0.8;
      else for (let i = 0; i <= 8; i++) d = Math.max(d, skyDepth(W * i / 8));
      layers.skyH = Math.max(H * 0.25, d);
    }
    /* low cloud: thick, wet cloud comes down over the tops — Cerro Torre's
       spire goes into it first. Only on photos: the plain Sky has no tops. */
    if (scene.photo) {
      const low = clamp(clamp((f.cloud - 0.72) / 0.28, 0, 1) * 0.5 + (f.rain ? 0.22 + f.rain * 0.1 : 0) + (f.snow ? 0.3 : 0) + (f.storm ? 0.2 : 0) + f.fog * 0.3, 0, 1);
      if (low > 0.05) layers.deck = { img: tex(0.84, L.lo, L.hi, 0.95, { fade: [0, 0.6], soft: 0.5, shift: 211 }), low, off: rnd(0, W), v: (4 + clamp(f.wind, 0, 90) * 0.4) * DPR * dir };
    }
    /* fog: a veil, and banks moving through it */
    if (f.fog > 0.02) {
      layers.fog = { img: tex(0.78, shade(L.fog, 0.9), L.fog, 1, { fade: [0.3, 0.2], soft: 0.9, shift: 41 }), col: L.fog, off: rnd(0, W), v: (3 + clamp(f.wind, 0, 40) * 0.5) * DPR * (dir || 1) };
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
    nextFlash = f.storm ? performance.now() + rnd(2500, 7000) : 0;
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

  /* the moon's phase from a known new moon (2000-01-06 18:14 UTC), 0 new … 0.5 full */
  const moonAge = () => (((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % 29.530588853 + 29.530588853) % 29.530588853 / 29.530588853;

  function drawSun(t) {
    const f = fx;
    if (!scene.sky || f.phase.sun == null || f.cloud > 0.75 || f.rain || f.snow || f.fog > 0.4) return;
    /* across the top of the page from left at sunrise to right at sunset, highest at noon */
    const s = clamp(f.phase.sun, 0, 1);
    const x = W * (0.08 + s * 0.84), y = H * (0.3 - Math.sin(s * Math.PI) * 0.24);
    const warm = f.phase.name !== "day";
    const a = (1 - f.cloud) * (warm ? 0.55 : 0.45);
    const r = Math.min(W, H) * 0.42;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, warm ? `rgba(255,200,120,${a})` : `rgba(255,244,214,${a})`);
    g.addColorStop(0.08, warm ? `rgba(255,170,90,${a * 0.6})` : `rgba(255,236,190,${a * 0.5})`);
    g.addColorStop(1, "rgba(255,220,160,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  function drawMoon() {
    const f = fx;
    if (f.phase.name !== "night" || f.stars < 0.2 || !moon) return;
    const { x, y, r } = moon;
    const glow = ctx.createRadialGradient(x, y, r, x, y, r * 7);
    glow.addColorStop(0, `rgba(210,225,255,${0.16 * f.stars})`); glow.addColorStop(1, "rgba(210,225,255,0)");
    ctx.fillStyle = glow; ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    /* the dark disc faintly, then the lit part: the lit half's edge, and back
       along the terminator — an ellipse that bulges into the dark half while
       it is a crescent and into the lit half once it is gibbous. Waxing is lit
       on the right (as seen from the northern hemisphere). */
    const age = moonAge(), lit = 1 - Math.abs(age - 0.5) * 2;      // 0 new … 1 full
    const P = Math.PI, rx = r * Math.abs(Math.cos(age * 2 * P)), crescent = lit < 0.5;
    ctx.fillStyle = `rgba(150,165,200,${0.12 * f.stars})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, P * 2); ctx.fill();
    if (lit < 0.03) return;
    ctx.fillStyle = `rgba(238,242,252,${0.94 * f.stars})`;
    ctx.beginPath();
    if (age < 0.5) { ctx.arc(x, y, r, -P / 2, P / 2, false); ctx.ellipse(x, y, rx, r, 0, P / 2, -P / 2, crescent); }
    else { ctx.arc(x, y, r, P / 2, P * 1.5, false); ctx.ellipse(x, y, rx, r, 0, -P / 2, P / 2, crescent); }
    ctx.fill();
  }
  /* a bolt comes down only through open sky; with none worth the name, the flash alone */
  function makeBolt() {
    let x = 0, depth = 0;
    for (let i = 0; i < 8 && depth < H * 0.18; i++) { x = rnd(0.12, 0.88) * W; depth = skyDepth(x); }
    if (depth < H * 0.18) return null;
    let y = 0;
    const pts = [[x, y]], branches = [];
    const end = depth * rnd(0.6, 0.95);
    while (y < end) {
      x += rnd(-28, 28) * DPR; y += rnd(14, 34) * DPR;
      pts.push([x, y]);
      if (Math.random() < 0.12) {
        const b = [[x, y]]; let bx = x, by = y;
        for (let i = 0; i < 5; i++) { bx += rnd(-30, 30) * DPR; by += rnd(10, 26) * DPR; b.push([bx, by]); }
        branches.push(b);
      }
    }
    return { pts, branches };
  }

  /* the cloud in the sky, drawn at half size into its own canvas and cut to the
     photo's sky there, so it fills the sky and never crosses a mountain */
  function drawSky(dt) {
    if (!layers.near) return;
    const m = scene.sky ? null : maskOf(scene);
    if (!scene.sky && !m) return;
    const sw = Math.ceil(W / 2), sh = Math.ceil(H / 2);
    if (!skyCv) skyCv = document.createElement("canvas");
    if (skyCv.width !== sw || skyCv.height !== sh) { skyCv.width = sw; skyCv.height = sh; }
    const s = skyCv.getContext("2d");
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    s.clearRect(0, 0, sw, sh);
    if (layers.over > 0) { s.fillStyle = rgba(layers.overCol, layers.over); s.fillRect(0, 0, sw, sh); }
    const band = layers.skyH / 2 * 1.08;
    for (const l of [layers.far, layers.near]) {
      l.off += l.v * dt / 2;
      tiled(s, l.img, l.off, 0, sw * (l === layers.far ? 1.5 : 2.1), band);
    }
    if (m) {
      const r = coverRect(m.w, m.h);
      s.globalCompositeOperation = "destination-in";
      s.drawImage(m.img, r.x / 2, r.y / 2, r.w / 2, r.h / 2);
      s.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(skyCv, 0, 0, W, H);
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

    drawSun(now);
    /* stars twinkle; the moon sits among them */
    if (stars.length) {
      for (const s of stars) {
        const a = live ? s.a * (0.7 + 0.3 * Math.sin(t * s.tw + s.ph)) : s.a;
        ctx.fillStyle = `rgba(235,240,255,${(a * f.stars).toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      drawMoon();
    }
    drawSky(dt);
    /* spindrift streaming off the summits */
    if (plume.length || layers.peaks) {
      if (live) stepPlume(dt);
      const img = blobImg();
      /* each puff drawn long and low, so together they read as a banner */
      for (const p of plume) {
        ctx.globalAlpha = 0.55 * (1 - p.age / p.life) * Math.min(1, p.age * 4) * gust;
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
      const c = f.snow ? [232, 238, 246] : f.phase.name === "night" ? [40, 46, 58] : [128, 140, 156];
      const a = Math.min(0.32, (f.rain + f.snow) * 0.16);
      g.addColorStop(0, rgba(c, a)); g.addColorStop(0.55, rgba(c, a * 0.9)); g.addColorStop(1, rgba(c, a * 0.35));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    /* fog: the picture goes into it */
    if (layers.fog) {
      const fg = layers.fog;
      ctx.fillStyle = rgba(fg.col, f.fog * 0.5);
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
      g.addColorStop(0, rgba(fg.col, 0)); g.addColorStop(1, rgba(fg.col, f.fog * 0.3));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      fg.off += fg.v * dt;
      ctx.globalAlpha = Math.min(1, f.fog * 0.85);
      tiled(ctx, fg.img, fg.off, H * 0.1, W * 1.6, H * 0.95);
      tiled(ctx, fg.img, -fg.off * 0.6 + W * 0.4, H * 0.35, W * 2.2, H * 0.7);
      ctx.globalAlpha = 1;
    }
    /* wind: the low air hazed with what it carries, and sheets of it moving */
    if (layers.haze) {
      const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
      g.addColorStop(0, rgba(layers.haze.col, 0)); g.addColorStop(1, rgba(layers.haze.col, layers.haze.a * gust));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (layers.sheet) {
      const s = layers.sheet;
      s.off += s.v * dt;
      ctx.globalAlpha = s.a * gust;
      tiled(ctx, s.img, s.off, H * 0.52, W * 1.4, H * 0.5);
      tiled(ctx, s.img, s.off * 1.6 + W * 0.3, H * 0.7, W * 0.9, H * 0.32);
      ctx.globalAlpha = 1;
    }
    /* rain and snow */
    if (parts.length) {
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(210,225,245,1)";
      for (const p of parts) {
        if (p.type === "r") {
          p.x += p.vx * dt; p.y += p.v * dt;
          if (p.y - p.len > H) { p.y = -rnd(0, 0.2) * H; p.x = rnd(-0.2, 1.2) * W; }
          if (p.x < -0.25 * W) p.x += 1.45 * W; else if (p.x > 1.25 * W) p.x -= 1.45 * W;
          const k = p.len / Math.hypot(p.vx, p.v);
          ctx.globalAlpha = p.a;
          ctx.lineWidth = (0.7 + p.z * 0.9) * DPR;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * k, p.y - p.v * k); ctx.stroke();
        } else {
          p.ph += dt * (0.8 + p.z);
          p.x += (p.vx + Math.sin(p.ph) * 14 * DPR) * dt; p.y += p.v * dt;
          if (p.y - p.r > H) { p.y = -p.r * 2; p.x = rnd(0, W); }
          if (p.x < -10) p.x += W + 20; else if (p.x > W + 10) p.x -= W + 20;
          ctx.globalAlpha = p.a;
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
        ctx.globalAlpha = p.a * gust;
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
    /* lightning: a flash of the whole picture, sometimes a bolt in the sky */
    if (f.storm && live) {
      if (nextFlash && now >= nextFlash) {
        flashT = now; bolt = Math.random() < 0.55 ? makeBolt() : null;
        nextFlash = now + rnd(4500, 13000);
      }
      if (flashT >= 0) {
        const e = now - flashT;
        /* two quick pulses, the way a stroke flickers */
        const a = e < 70 ? 0.55 : e < 130 ? 0.12 : e < 210 ? 0.4 : Math.max(0, 0.4 - (e - 210) / 500);
        flashEl.style.opacity = a.toFixed(3);
        if (bolt && e < 260) {
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
    if (animated() && (parts.length || drops.length || stars.length || dust.length || plume.length || layers.near || layers.deck || layers.fog || layers.sheet || fx.storm)) raf = requestAnimationFrame(loop);
    if (!animated()) flashEl.style.opacity = "0";
  }
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(innerWidth * DPR), h = Math.round(innerHeight * DPR);
    /* a phone's address bar showing and hiding changes the height a little: not worth a rebuild */
    if (w === W && Math.abs(h - H) < 120 * DPR) return false;
    W = cv.width = w; H = cv.height = h;
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
    const key = JSON.stringify([scene.id, next.kind, next.phase.name, Math.round(next.rain * 10), Math.round(next.snow * 10), Math.round(next.fog * 10), Math.round(next.cloud * 10), Math.round(next.wind / 5), Math.round(next.blow * 5), next.gusty, Math.round(next.dirX * 4), Math.round(next.stars * 5)]);
    fx = next;
    paintStill();
    if (key === lastKey && W) return;
    lastKey = key;
    size();
    build();
    kick();
  }
  /* the light moves on its own: dawn, golden hour and dusk come without a reload */
  setInterval(() => { if (st !== undefined) update(st); }, 5 * 60e3);

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
       gust in km/h; isDay: false for night. preview(null) goes back to the
       real reading. The page never calls it — the scene only ever shows the
       reading (header) — and nothing about it is kept. */
    preview(s) {
      forced = s ? Object.assign({ isDay: true, cloud: null, wind: 0 }, s) : null;
      lastKey = "";
      update(st);
    },
    /* for the tests: what a reading turns into, with no screen */
    effects
  };
  update(null);
})();
