/* SCENE — what is behind Weather (weather.html), and the weather happening in it.
   ────────────────────────────────────────────────────────────────────────────
   Ric, 2026-10-25: "I want the background to be really cool … presets like in
   the forest, in the city, in the mountains, on the water, on the beach", then
   "scenes as in real pictures. Then weather happens in the scene."

   So a scene is a photograph (or the plain sky, which needs none), and over it
   this file plays what app.js says is overhead right now:
     rain and drizzle   streaks at the wind's slant, beads on the glass in front
     snow and sleet     flakes drifting with the wind
     fog                soft banks crossing slowly, thicker the less you can see
     cloud              the picture dims and cools as the cover rises
     storm              darker still, and lightning
     the sun            dawn, day, golden hour, dusk and night from the real
                        sunrise and sunset; stars and the moon when it is clear
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
        url: "https://commons.wikimedia.org/wiki/File:The_sandstone_cliffs_and_spires_of_Colorado_National_Monument_attract_hundreds_of_climbers_a_year._(9e8ceddd-0a94-4c97-82dd-ee36edf697c7).jpg" })
  ];
  function scenePhoto(id, name, horizon, pos, credit) {
    return { id, name, horizon, pos, credit, photo: `assets/weather/scenes/${id}.jpg`, thumb: `assets/weather/scenes/${id}-thumb.jpg` };
  }

  let scene = SCENES.find((s) => s.id === store.get("wx:scene", "sky")) || SCENES[0];
  let moving = store.get("wx:motion", true) !== false;
  let W = 0, H = 0, DPR = 1;
  let st = null;            // what is overhead, from app.js
  let fx = null;            // what that means on screen
  let parts = [], drops = [], stars = [], banks = [], wisps = [];
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
    if (!s) return { kind: "calm", phase: { name: "day", sun: 0.5 }, rain: 0, snow: 0, fog: 0, cloud: 0.3, wind: 0, dirX: 0, storm: false, stars: 0 };
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
    /* the wind's "from" direction, turned into which way things blow across the screen */
    const dirX = s.windDir == null ? 0.3 : -Math.sin(s.windDir * Math.PI / 180);
    let phase = phaseOf(s);
    /* the reading's own day or night wins over the clock: the times are a
       day's, and a reading at the edge of one should not light a dark sky */
    if (s.isDay === false && phase.name !== "night" && phase.name !== "dusk" && phase.name !== "dawn") phase = { name: "night", sun: null };
    else if (s.isDay === true && phase.name === "night") phase = { name: "day", sun: 0.5 };
    const stars = phase.name === "night" ? clamp(1 - cloud * 1.15, 0, 1) * (rain || snow ? 0 : 1) * (1 - fog) : 0;
    return { kind: k, phase, rain, snow, fog, cloud, wind, dirX, storm: k === "storm", stars };
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
      photo.style.filter = `brightness(${b.toFixed(2)}) saturate(${sat.toFixed(2)}) contrast(${(1 - f.fog * 0.25).toFixed(2)})`;
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

  /* ── the moving parts ── */
  function build() {
    const f = fx;
    const area = (W * H) / (DPR * DPR);
    const small = W / DPR < 640;
    parts = []; drops = []; stars = []; banks = []; wisps = [];
    const wx = f.dirX * clamp(f.wind / 40, 0, 1.4);            // slant, -1.4 … 1.4
    if (f.rain) {
      const n = Math.round(clamp(area / (small ? 2400 : 1700) * f.rain, 20, small ? 260 : 520));
      for (let i = 0; i < n; i++) {
        const z = Math.random();                                 // 0 far … 1 near
        parts.push({ type: "r", x: rnd(-0.2, 1.2) * W, y: rnd(0, 1) * H, z,
          len: (10 + z * 18) * DPR * (0.7 + f.rain * 0.3), v: (700 + z * 700) * DPR, vx: wx * (260 + z * 300) * DPR, a: 0.16 + z * 0.3 });
      }
      /* beads on the glass in front: a few, and now and then one runs */
      const nd = Math.round(clamp(area / 26000 * Math.min(1.2, f.rain + 0.3), 6, 34));
      for (let i = 0; i < nd; i++) drops.push(newDrop(true));
    }
    if (f.snow) {
      const n = Math.round(clamp(area / (small ? 3800 : 2600) * f.snow, 25, small ? 200 : 380));
      for (let i = 0; i < n; i++) {
        const z = Math.random();
        parts.push({ type: "s", x: rnd(0, 1) * W, y: rnd(0, 1) * H, z, r: (0.8 + z * 2.6) * DPR,
          v: (25 + z * 55) * DPR, vx: wx * (40 + z * 60) * DPR, ph: rnd(0, 6.28), a: 0.45 + z * 0.5 });
      }
    }
    if (f.stars) {
      const hz = Math.min(scene.horizon ?? 1, 0.62);
      const n = Math.round(clamp(area / 5200, 60, 260) * f.stars);
      for (let i = 0; i < n; i++) {
        const y = Math.pow(Math.random(), 1.35) * H * hz;
        stars.push({ x: rnd(0, W), y, r: (Math.random() < 0.08 ? 2 : rnd(0.8, 1.4)) * DPR, a: rnd(0.35, 0.95) * (1 - y / (H * hz)) * 0.9 + 0.1, tw: rnd(0.4, 1.6), ph: rnd(0, 6.28) });
      }
    }
    if (f.fog) {
      const n = small ? 4 : 6;
      for (let i = 0; i < n; i++) banks.push({ x: rnd(-0.3, 1) * W, y: rnd(0.25, 1) * H, w: rnd(0.7, 1.3) * W, h: rnd(0.18, 0.32) * H, v: rnd(6, 16) * DPR * (Math.random() < 0.5 ? 1 : -1) * (0.5 + clamp(f.wind / 30, 0, 1.5)) });
    }
    /* the plain sky draws its own cloud: soft wisps, more with more cover */
    if (scene.sky && f.cloud > 0.15 && !f.fog) {
      const n = Math.round(2 + f.cloud * (small ? 4 : 7));
      for (let i = 0; i < n; i++) wisps.push({ x: rnd(-0.3, 1) * W, y: rnd(0.02, 0.5) * H, w: rnd(0.35, 0.8) * W, h: rnd(0.07, 0.16) * H, v: (4 + clamp(f.wind, 0, 50) * 0.35) * DPR * (f.dirX >= 0 ? 1 : -1) * rnd(0.6, 1.2) });
    }
    nextFlash = f.storm ? performance.now() + rnd(2500, 7000) : 0;
  }
  function newDrop(anywhere) {
    const r = rnd(3, 8) * DPR;
    return { x: rnd(0, W), y: anywhere ? rnd(0, H) : rnd(-0.1, 0.4) * H, r, run: 0, trail: [], born: performance.now(), life: rnd(5000, 16000) };
  }

  /* a soft blob, made once and stamped: fog banks and the sky's wisps */
  let blob = null;
  function blobImg() {
    if (blob) return blob;
    blob = document.createElement("canvas");
    blob.width = 256; blob.height = 128;
    const b = blob.getContext("2d");
    const g = b.createRadialGradient(128, 64, 4, 128, 64, 128);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.45, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    b.fillStyle = g;
    b.setTransform(1, 0, 0, 0.5, 0, 32);
    b.beginPath(); b.arc(128, 64, 128, 0, Math.PI * 2); b.fill();
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
    if (f.phase.name !== "night" || f.stars < 0.2) return;
    const hz = Math.min(scene.horizon ?? 1, 0.6);
    const r = Math.min(W, H) * 0.028 + 6 * DPR;
    const x = W * 0.86, y = H * hz * 0.36;
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
  function makeBolt() {
    const hz = Math.min(scene.horizon ?? 1, 0.7);
    let x = rnd(0.15, 0.85) * W, y = 0;
    const pts = [[x, y]], branches = [];
    const end = H * hz * rnd(0.55, 1);
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

  function frame(now) {
    const f = fx;
    if (!f) return;
    const live = animated();
    const dt = live && lastT ? Math.min(0.06, (now - lastT) / 1000) : 0;
    lastT = now;
    ctx.clearRect(0, 0, W, H);

    drawSun(now);
    /* stars twinkle; the moon sits among them */
    if (stars.length) {
      for (const s of stars) {
        const a = live ? s.a * (0.7 + 0.3 * Math.sin(now / 1000 * s.tw + s.ph)) : s.a;
        ctx.fillStyle = `rgba(235,240,255,${(a * f.stars).toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      drawMoon();
    }
    /* the sky's own cloud, and fog: one soft shape stamped and stretched */
    const img = blobImg();
    if (wisps.length) {
      const night = f.phase.name === "night";
      const grey = f.cloud > 0.7 || f.rain ? 0.55 : 0.9;
      ctx.globalAlpha = (night ? 0.07 : 0.1 + f.cloud * 0.12) * grey;
      for (const w of wisps) {
        w.x += w.v * dt;
        if (w.v > 0 && w.x > W) w.x = -w.w; else if (w.v < 0 && w.x + w.w < 0) w.x = W;
        ctx.drawImage(img, w.x, w.y, w.w, w.h);
      }
      ctx.globalAlpha = 1;
    }
    if (banks.length) {
      ctx.globalAlpha = 0.14 + f.fog * 0.2;
      for (const b of banks) {
        b.x += b.v * dt;
        if (b.v > 0 && b.x > W) b.x = -b.w; else if (b.v < 0 && b.x + b.w < 0) b.x = W;
        ctx.drawImage(img, b.x, b.y - b.h / 2, b.w, b.h);
      }
      ctx.globalAlpha = 1;
      /* a veil low down, where fog sits */
      const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
      g.addColorStop(0, "rgba(220,228,235,0)"); g.addColorStop(1, `rgba(220,228,235,${(f.fog * 0.22).toFixed(3)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
    if (animated() && (parts.length || drops.length || stars.length || banks.length || wisps.length || fx.storm)) raf = requestAnimationFrame(loop);
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
    const next = effects(s);
    const key = JSON.stringify([scene.id, next.kind, next.phase.name, Math.round(next.rain * 10), Math.round(next.snow * 10), Math.round(next.fog * 10), Math.round(next.cloud * 10), Math.round(next.wind / 5), Math.round(next.dirX * 4), Math.round(next.stars * 5)]);
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
    /* for the tests: what a reading turns into, with no screen */
    effects
  };
  update(null);
})();
