/* ══════════════════════════════════════════════════════════════════════
   OFFRAMP.

   The car, the rules, the loop, and the noise.

   ── what changed, and why it had to ─────────────────────────────────
   This started as a strip of road that scrolled downward past a car
   that could only slide left and right, and there is a version of that
   which is a perfectly good game. It is not this one. The moment the
   road is allowed to *go somewhere* — to bend, to fork, to hand you
   over to another road — the car needs a heading, and once the car has
   a heading the screen has to rotate, because a top-down car that
   points in forty different directions is unreadable and unsteerable.

   So: the car is bolted to one spot on the screen facing up, and the
   world turns underneath it. You are never steered. Not on the main
   line, not through a gore, not on a ramp, not past a red light. The
   ramp is a place the tarmac goes; taking it is a thing you do with
   the steering wheel and nothing else.

   ── nobody else is here ────────────────────────────────────────────
   Traffic existed, worked, and has been deleted — the map is being
   rebuilt from a fictional region into one real corridor, and cars
   that pick exits are worth nothing until the exits are the right
   ones. Signals, queues and everything you could hit come back with
   it. Until then the road itself is the whole opponent: the barrier,
   the gore, the verge, and how fast you are taking them.

   ── the camera is on the road, not on the car ──────────────────────
   This is the decision the whole feel hangs off, and it is worth being
   explicit about because the obvious alternative is wrong.

   The obvious version: give the car a heading, let steering turn it,
   and rotate the screen to keep the car pointing up. It works, and it
   feels awful. Every flick of the wheel to slip through a gap swings
   the entire world a few degrees, so a lane change — the most ordinary
   thing you do here, several times a second — reads as the horizon
   lurching. You end up fighting the picture instead of the traffic.

   What we do instead: the camera takes the heading of the *road under
   the car*. Left and right move you across that road and nothing else,
   exactly as they did when this game was a straight strip, and the car
   is drawn bolt upright at every moment. The view turns when the road
   turns, and at no other time.

   Freeways now carry broad, design-speed curves (see FREEWAY_CURVE in
   world.js), so the picture turns slowly through the long sweep of a
   main line and more decisively on a ramp. The rotation is not scenery
   — it is the thing that tells you the road itself changed direction.

   ── and the camera does not slide either ───────────────────────────
   Same argument, one axis over. The camera sits on the road's
   centreline, not on the car: it advances with you and turns with the
   road, but it does not track you across it. Steer right and the road
   stays exactly where it is on screen while the car moves over — which
   is what it did when this was a fixed strip, and it is right for the
   same reason. A road that shifts sideways every time you change lane
   is a road you cannot read a gap in.

   `camU` is where on the cross-section the camera sits, and the only
   time it moves is at a handover: peel onto a ramp and it slides over
   the width of the carriageway you just left, because the thing it is
   centred on has changed. That pan is the exit happening.

   ── so the car is tracked, not free ────────────────────────────────
   The player carries a road, a distance along it and an offset across
   it, the same three numbers every AI car carries. It is not on rails:
   `u` is yours, and the road only ever hands you to another road at a
   gore, and only if you were in the exit lane when you crossed it.
   Nothing steers for you. But the game does know which tarmac you are
   on, and it knows because it is written down rather than inferred.
   ══════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  const R = Road, X = Raster;
  const VW = Draw.VW, VH = Draw.VH;

  /* ── the speed scale, which is not a feel setting ───────────────────
     One world pixel is 0.179 m, so one km/h is (1000/3600)/0.179 =
     1.55183 px/s. It was 1.55, which is 0.118% slow — 220 mph read as
     219.74. Nobody would ever notice, and it costs nothing to be right:
     the whole point of this corridor is that a distance in the game is
     the distance on the road. */
  const M_PER_PX = 0.179;
  const PX_PER_KMH = (1000 / 3600) / M_PER_PX;   // 1.55183
  const KMH_PER_MPH = 1.609344;
  const pxs = (kmh) => kmh * PX_PER_KMH;

  /* Top speed, in km/h because everything internal is. 292 was 181.4
     mph, so the speedometer could never show 220 however long you held
     it — not a scale error, a ceiling. The scale itself is exact: held
     at 70 mph the car covers 70.000 miles in a simulated hour. */
  const V_MAX = 220 * 1.609344, V_GRAVEL = 118;
  const LAT_MAX = 124;                   // px/s across the road, at low speed

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];

  /* Why a run ended. `traffic` and `queue` used to live here and went
     with traffic.js — nothing on this road moves but you, so the only
     things that can end a run are the geometry ones below. They come
     back with the cars. */
  const WHY = {
    barrier: ["you found the barrier", "the middle of the road is not a lane",
              "steel, and then nothing"],
    gore:    ["you split the difference", "the nose of the gore was there first",
              "on or off — not both"],
    road:    ["you left the road", "the grass is not a lane",
              "the verge ran out"],
    /* Every road on this map hands on to another one — that is what the
       perimeter loop is for. Reaching the end of one anyway means you
       drove past the last interchange on a corridor and out the far
       side, which is a thing you can do and which has to mean
       something. It used to mean the picture froze while the odometer
       kept counting. */
    end:     ["the road ran out", "that was the end of it",
              "there is nothing past here"],
  };

  const S = {
    mode: "title",
    t: 0,
    /* where the car is: a road, how far along it, how far across it.
       x, y and h are derived from those three every frame and are for
       drawing and collisions only — never write to them. */
    road: null, s: 0, u: 0, vu: 0,
    /* Which way round the road you are pointing. Traffic has carried
       this since the day it was written — a vehicle is a road, a
       direction, a distance and an offset — and the player was the one
       thing on the map nailed to `fwd`. That is why there was no way to
       reach the opposite carriageway: not because the roads lacked one,
       but because the car could not face it. */
    fwd: true,
    x: 0, y: 0, h: 0, speed: 96,
    camU: 0, camX: 0, camY: 0,
    parts: [], marks: [],
    distPx: 0, score: 0, mult: 1, combo: 0, comboT: 0,
    topSpeed: 0, exits: 0,
    shake: 0, flash: 0, wreckT: 0, why: "", cause: "road",
    gravelT: 0, newBest: false, hints: new Map(),
    onWhat: "lane", aimLane: 1,
  };

  const BEST_KEY = "offramp.best.v2";
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { best = 0; }

  const keys = new Set();
  const touch = { steer: 0, brake: false, active: false, lastX: 0 };
  let isTouch = false;

  /* ── canvas ─────────────────────────────────────────────────────────
     The buffer is a fixed 224×360 and is scaled up fractionally to fill
     whatever it is given. Integer-only scaling would waste half of a
     phone screen; the art is still nearest-neighboured either way. */
  const cvs = document.getElementById("road");
  cvs.width = VW; cvs.height = VH;
  const ctx = cvs.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  X.attach(ctx, VW, VH);

  const stage = document.getElementById("stage");
  const frame = document.getElementById("frame");
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const s = Math.max(1, Math.min(w / VW, h / VH));
    const cw = Math.round(VW * s), ch = Math.round(VH * s);
    cvs.style.width = cw + "px"; cvs.style.height = ch + "px";
    frame.style.width = cw + "px"; frame.style.height = ch + "px";
  }
  addEventListener("resize", fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  fit();

  /* ══════════════════════════════════════════════════════════════════
     sound — one engine, some tyre noise, a horn, a crash. No files.
     ══════════════════════════════════════════════════════════════════ */
  const A = { ctx: null, muted: false, ready: false };

  function audioStart() {
    if (A.ctx || A.muted) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    A.ctx = ac;
    A.master = ac.createGain(); A.master.gain.value = 0.5; A.master.connect(ac.destination);

    A.eng = ac.createGain(); A.eng.gain.value = 0;
    A.engLP = ac.createBiquadFilter(); A.engLP.type = "lowpass"; A.engLP.frequency.value = 800;
    A.eng.connect(A.engLP); A.engLP.connect(A.master);
    A.o1 = ac.createOscillator(); A.o1.type = "sawtooth"; A.o1.frequency.value = 80;
    A.o2 = ac.createOscillator(); A.o2.type = "square"; A.o2.frequency.value = 40;
    A.g1 = ac.createGain(); A.g1.gain.value = 0.6;
    A.g2 = ac.createGain(); A.g2.gain.value = 0.4;
    A.o1.connect(A.g1); A.g1.connect(A.eng);
    A.o2.connect(A.g2); A.g2.connect(A.eng);
    A.o1.start(); A.o2.start();

    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = ac.createBufferSource(); A.noise.buffer = buf; A.noise.loop = true;
    A.nBP = ac.createBiquadFilter(); A.nBP.type = "bandpass"; A.nBP.frequency.value = 1400; A.nBP.Q.value = 0.8;
    A.nG = ac.createGain(); A.nG.gain.value = 0;
    A.noise.connect(A.nBP); A.nBP.connect(A.nG); A.nG.connect(A.master);
    A.noise.start();
    A.ready = true;
  }

  function audioFrame() {
    if (!A.ready || A.muted) return;
    const ac = A.ctx, now = ac.currentTime;
    const playing = S.mode === "play";
    const v = S.speed;
    A.eng.gain.setTargetAtTime(playing ? 0.05 : 0, now, 0.08);
    A.o1.frequency.setTargetAtTime(58 + v * 0.62, now, 0.05);
    A.o2.frequency.setTargetAtTime(29 + v * 0.31, now, 0.05);
    A.engLP.frequency.setTargetAtTime(420 + v * 6, now, 0.1);
    const rough = S.gravelT > 0 ? 1 : 0;
    const scrub = Math.min(1, Math.abs(S.vu) / LAT_MAX);
    A.nG.gain.setTargetAtTime(
      playing ? (rough ? 0.062 : 0.012 + v / V_MAX * 0.02 + scrub * 0.03) : 0, now, 0.05);
    A.nBP.frequency.setTargetAtTime(rough ? 520 : 1500 + scrub * 900, now, 0.06);
  }

  function blip(type) {
    if (!A.ready || A.muted) return;
    const ac = A.ctx, now = ac.currentTime, g = ac.createGain();
    g.connect(A.master);
    if (type === "horn") {
      g.gain.value = 0; g.gain.linearRampToValueAtTime(0.16, now + 0.02);
      g.gain.setValueAtTime(0.16, now + 0.28); g.gain.linearRampToValueAtTime(0, now + 0.34);
      [370, 466].forEach((f) => {
        const o = ac.createOscillator(); o.type = "square"; o.frequency.value = f;
        o.connect(g); o.start(now); o.stop(now + 0.36);
      });
    } else if (type === "pass") {
      g.gain.value = 0.07; g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = 900;
      o.frequency.exponentialRampToValueAtTime(1500, now + 0.11);
      o.connect(g); o.start(now); o.stop(now + 0.13);
    } else if (type === "exit") {
      // two notes, up — the only unambiguously good thing that happens
      [660, 990].forEach((f, i) => {
        const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        const gg = ac.createGain(); gg.gain.value = 0;
        gg.gain.setValueAtTime(0, now + i * 0.09);
        gg.gain.linearRampToValueAtTime(0.1, now + i * 0.09 + 0.02);
        gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
        o.connect(gg); gg.connect(A.master); o.start(now + i * 0.09); o.stop(now + i * 0.09 + 0.24);
      });
    } else if (type === "crash") {
      const len = Math.floor(ac.sampleRate * 0.7);
      const b = ac.createBuffer(1, len, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      const src = ac.createBufferSource(); src.buffer = b;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
      g.gain.value = 0.5;
      src.connect(lp); lp.connect(g); src.start(now);
      const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = 180;
      o.frequency.exponentialRampToValueAtTime(38, now + 0.6);
      const og = ac.createGain(); og.gain.value = 0.22;
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      o.connect(og); og.connect(A.master); o.start(now); o.stop(now + 0.66);
    }
  }

  const muteBtn = document.getElementById("mute");
  function setMuted(m) {
    A.muted = m;
    muteBtn.setAttribute("aria-pressed", String(m));
    // the word is hidden on narrow screens by CSS; the glyph is not
    muteBtn.innerHTML = m ? '✕<span class="word"> MUTED</span>' : '♪<span class="word"> SOUND</span>';
    muteBtn.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
    if (m && A.ready) { A.eng.gain.value = 0; A.nG.gain.value = 0; }
    if (!m) audioStart();
  }
  muteBtn.addEventListener("click", () => { setMuted(!A.muted); });

  /* ══════════════════════════════════════════════════════════════════
     particles and marks — both now live in the world, not on the
     screen, because the screen is no longer a fixed window onto it
     ══════════════════════════════════════════════════════════════════ */
  const PC = Draw.partCols;
  function puff(x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const p = { x, y, life: 0, max: 0.5, size: 1, col: 0, vx: 0, vy: 0 };
      if (kind === "dust") { p.vx = rnd(-16, 16); p.vy = rnd(-16, 16); p.max = rnd(0.28, 0.6); p.col = pick(PC.dust); }
      else if (kind === "debris") { p.vx = rnd(-70, 70); p.vy = rnd(-70, 70); p.max = rnd(0.35, 0.9); p.col = pick(PC.debris); }
      else if (kind === "smoke") { p.vx = rnd(-9, 9); p.vy = rnd(-9, 9); p.max = rnd(0.9, 1.9); p.col = pick(PC.smoke); p.size = 2; }
      else { p.vx = rnd(-30, 30); p.vy = rnd(-30, 30); p.max = rnd(0.3, 0.8); p.col = pick(PC.fire); p.size = 2; }
      S.parts.push(p);
    }
    if (S.parts.length > 340) S.parts.splice(0, S.parts.length - 340);
  }

  function updateParts(dt) {
    for (const p of S.parts) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt;
    }
    if (S.parts.length) S.parts = S.parts.filter((p) => p.life < p.max);
    if (S.marks.length > 300) S.marks.splice(0, S.marks.length - 300);
  }

  function mark() {
    const c = Math.cos(S.h), s = Math.sin(S.h);
    S.marks.push({ x: S.x - c * 4 - s * 12, y: S.y + s * 4 - c * 12, h: S.h });
    S.marks.push({ x: S.x + c * 4 - s * 12, y: S.y - s * 4 - c * 12, h: S.h });
  }

  /* ══════════════════════════════════════════════════════════════════
     the car
     ══════════════════════════════════════════════════════════════════ */
  const PW = 11, PL = 26;                 // 1.97 m × 4.65 m at road scale

  function steerInput() {
    if (isTouch) return clamp(touch.steer, -1, 1);
    let s = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) s -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) s += 1;
    return s;
  }
  function throttleInput() {
    if (isTouch) return touch.brake ? -1 : 1;
    let t = 0;
    if (keys.has("ArrowUp") || keys.has("KeyW")) t += 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) t -= 1;
    return t;
  }

  /* ── where the wheels are ───────────────────────────────────────────
     Asked of the road we are on and no other, so the answer is never
     ambiguous where two roads run alongside each other. */
  function underneath(road, s, u) {
    const ramp = road.kind === "ramp";
    const e = R.edges(road, s);
    const shL = ramp ? R.RAMP_SH : R.SH_OUT, shR = ramp ? R.RAMP_SH : R.SH_OUT;
    if (!ramp && Math.abs(u) < road.med + PW / 2 - 1.5) return "barrier";
    if (!ramp && u > -(road.med + R.SH_IN)
        && u < road.med + R.SH_IN + R.innerAt(road, s)) return "shoulder";
    if (u >= e.uL && u <= e.uR) return "lane";
    if (u >= e.uL - shL && u <= e.uR + shR) return "shoulder";
    if (u >= e.uL - shL - R.VERGE && u <= e.uR + shR + R.VERGE) return "gravel";
    return "grass";
  }

  /* ── the two handovers ──────────────────────────────────────────────
     A gore, and a merge. Both keep `u` continuous by shifting it by the
     distance between the two centrelines, and both are safe to do mid-
     frame because the two roads share a heading at exactly that point —
     which is how the picture gets through a junction without a jump. */
  function handovers(prevS) {
    const road = S.road;

    if (road.kind === "freeway") {
      /* ── an exit you can only take going one way ────────────────────
         This used to test `prevS < ex.s && S.s >= ex.s`, which fires
         only while `s` is INCREASING — so a car driving the corridor
         westbound could never take any exit at all, whatever it did with
         the wheel. It was invisible while every run went one way and
         became half the game the moment the sign offered WEST.

         An exit serves the direction whose right-hand side it sits on,
         so `(ex.side > 0) === S.fwd`. And a westbound ramp lives in the
         mirrored frame: its `s` grows the way the driver is going, which
         is the way the corridor's shrinks, and its right is the
         corridor's left. Both conversions are below and both are exact
         inversions — drive in and straight back out and you land on the
         same pixel. */
      for (const ex of road.exits) {
        if (ex.ramp.dead) continue;
        if ((ex.side > 0) !== S.fwd) continue;        // serves the other direction
        const crossed = S.fwd ? (prevS < ex.s && S.s >= ex.s)
                              : (prevS > ex.s && S.s <= ex.s);
        if (!crossed) continue;
        const split = ex.side > 0
          ? ex.startU - R.LANE / 2
          : ex.startU + R.LANE / 2;
        const committed = ex.side > 0 ? S.u > split + 4 : S.u < split - 4;
        if (committed) {
          // committed: you were in the deceleration lane when it ran out.
          // camU shifts by the same amount so the picture does not jump;
          // it then pans across to the ramp under its own steam.
          if (ex.mirror) {
            S.u = ex.startU - S.u;
            S.camU = ex.startU - S.camU;
            S.s = ex.s - S.s;
          } else {
            S.u -= ex.startU;
            S.camU -= ex.startU;
            S.s -= ex.s;
          }
          S.road = ex.ramp;
          S.fwd = true;                 // a ramp always runs the way you drive it
          S.onRamp = true;
        } else if (Math.abs(S.u - split) <= 4) {
          crash("gore");                              // straddling the nose
        }
        break;
      }
      /* A closed road has no end to run out of, so the wrap has to be
         tested before the end, and the two must not share a branch: the
         last station of a beltway is `>= len - STEP` but not yet
         `>= len`, and an else-if put the ring roads in exactly that gap
         and wrecked you once a lap. */
      /* Both ends of the road are reachable now, because the car can
         face either way down it. */
      if (S.road === road && road.wrap) {
        const L = R.len(road);
        if (S.s >= L) S.s %= L;
        else if (S.s < 0) S.s += L;
      } else if (S.road === road
                 && (S.fwd ? S.s >= R.len(road) - R.STEP : S.s <= R.STEP)) {
        crash("end");
      }
    } else if (!S.fwd && S.s <= R.STEP) {
      crash("end");                        // a ramp driven backwards to its gore
    } else if (!road.merge && S.s >= R.len(road) - R.STEP) {
      crash("end");
    } else if (road.merge && S.s >= R.len(road)) {
      const m = road.merge;
      const routeType = road.routeType;
      const over = S.s - R.len(road);
      /* The exact inverse of the entry above. A mirrored ramp hands you
         back onto a corridor whose stations run the other way, so the
         overshoot is subtracted and the offset reflected. */
      if (m.mirror) {
        S.u = m.u - S.u;
        S.camU = m.u - S.camU;
        S.s = m.s - over;
        S.fwd = false;
      } else {
        S.u += m.u;
        S.camU += m.u;
        S.s = m.s + over;
        S.fwd = true;
      }
      S.road = m.into;
      S.onRamp = false;
      takeExit(routeType);
    }
  }

  function updatePlayer(dt) {
    const th = throttleInput();
    const road = S.road;

    /* ── what is under the wheels ────────────────────────────────────
       This asks the road you are TRACKED on, and that was the bug behind
       the invisible barriers. It is worth being precise about, because
       the game was drawing with one truth and killing with another.

       `underneath` knows about one road. `World.surface` asks every road
       near the point and keeps the best answer — and the renderer agrees
       with the second, because it draws every road near the camera. So
       anywhere two pavements meet without a handover firing — every
       gore, every merge taper, every stretch where a ramp runs alongside
       its parent — you could steer a pixel past your own road's verge,
       be standing in plain sight on somebody else's tarmac, and be told
       you had left the road. Sampled across the whole map: 6,655 such
       points, 6.3% of every road edge on it.

       So: ask your own road, and if it says you are in a field, ask the
       world before believing it. If the world says tarmac, it is tarmac,
       and you become that road's problem — which is what this game
       always claimed to do. The median is exempt: a barrier is not a
       surface, it is a wall, and nothing rescues you from it. */
    let what = underneath(road, S.s, S.u);
    if (what === "grass") {
      /* Only onto roads at your own height. This test could not be
         written while `elev` meant both draw layer and height: a system
         connector carries a high layer purely so it paints over the
         freeway it leaves, while physically sitting at grade for the
         quarter mile where it merges, so refusing to rescue onto
         anything "above" you condemned the merge lanes along with the
         real bridges — 1,774 lethal points where there had been 43. The
         stopgap was to do no height test at all and lean on
         World.surface's 260 px range cut to keep flyovers out, which
         works only for as long as no deck passes close overhead.

         `deck` is the real thing, per station, so the question can now
         be asked properly: a bridge above you is out of reach because it
         is a bridge, not because it happens to be far away. */
      const w = World.surface(S.x, S.y, S.hints, R.deckAt(road, S.s));
      if (w.road && w.road !== road && w.what !== "grass" && w.what !== "barrier") {
        const turn = Math.abs(((w.h - S.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        S.road = w.road; S.s = w.s; S.u = w.u;
        if (turn > Math.PI / 2) S.fwd = !S.fwd;
        S.camU = camTarget(S.road);
        what = w.what;
      }
    }
    S.onWhat = what;
    if (what === "barrier") { crash("barrier"); return; }
    if (what === "grass") { crash("road"); return; }
    const rough = what === "gravel";
    S.gravelT = rough ? S.gravelT + dt : 0;

    // throttle, brake, coast
    if (th > 0) S.speed += (56 * (1 - S.speed / V_MAX * 0.72)) * dt;
    else if (th < 0) S.speed -= 132 * dt;
    else S.speed -= 15 * dt;

    if (rough) {
      S.speed -= 30 * dt;
      if (S.speed > V_GRAVEL) S.speed -= 62 * dt;
      if (Math.random() < 26 * dt) puff(S.x, S.y, 1, "dust");
    }
    S.speed = clamp(S.speed, 0, V_MAX);
    if (S.speed > S.topSpeed) S.topSpeed = S.speed;

    /* Steering, and this is the whole of it: a sideways velocity across
       the road. Heavier the faster you are going, looser on gravel. The
       car's heading is the road's heading and is not yours to change. */
    const grip = rough ? 0.66 : 1;
    const want = steerInput() * LAT_MAX * (1 - 0.34 * (S.speed / V_MAX)) * grip;
    S.vu = lerp(S.vu, want, 1 - Math.exp(-(rough ? 7 : 13) * dt));
    /* Steering is in the CAR's frame, and `u` is in the road's. Facing
       back down the road, your right is the road's left, so both the
       offset and the distance run the other way. */
    const dir = S.fwd ? 1 : -1;
    S.u += dir * S.vu * dt;

    const step = pxs(S.speed) * dt;
    const prevS = S.s;
    S.s += dir * step;
    S.distPx += step;
    S.score += step * M_PER_PX * S.mult;

    handovers(prevS);
    if (S.mode !== "play") return;
    easeCamera(dt);
    place();

    if (th < 0 && S.speed > 90) mark();

    if (S.comboT > 0) {
      S.comboT -= dt;
      if (S.comboT <= 0) { S.combo = 0; S.mult = 1; }
    }
  }

  /* ── where the camera sits across the road ──────────────────────────
     Just inside your carriageway, ignoring any deceleration lane. This
     keeps the complete six-lane cross-section visible while leaving the
     player slightly right of centre, where a right-driving car belongs.
     Ignoring the aux lane prevents the camera drifting as an exit opens. */
  function camTarget(road) {
    if (road.kind === "ramp") return 0;
    const mine = S.fwd ? R.lanesAt(road, S.s) : road.back;
    const other = S.fwd ? road.back : R.lanesAt(road, S.s);
    const half = road.med + R.SH_IN + Math.max(mine, other) * R.LANE + R.SH_OUT;
    const room = Math.max(0, VW / 2 - half);
    const ownMiddle = road.med + R.SH_IN + mine * R.LANE / 2;
    // the far carriageway is the one that gets cropped, whichever it is
    return (S.fwd ? 1 : -1) * Math.min(room, ownMiddle);
  }

  /* road coordinates → the world, once per frame, for drawing and for
     working out what you just hit */
  function place() {
    const f = R.frame(S.road, S.s);
    S.x = f.x + Math.cos(f.h) * S.u;
    S.y = f.y - Math.sin(f.h) * S.u;
    S.h = f.h + (S.fwd ? 0 : Math.PI);
    S.camX = f.x + Math.cos(f.h) * S.camU;
    S.camY = f.y - Math.sin(f.h) * S.camU;
  }

  function easeCamera(dt) {
    const t = camTarget(S.road);
    S.camU += (t - S.camU) * (1 - Math.exp(-3.4 * dt));
  }

  /* ── the road slides under you ──────────────────────────────────────
     Only twenty miles of I-40 exist as geometry at any moment, and when
     the car nears an edge World.update() builds the next twenty and
     hands back where the car now sits on it. `s` is window-local, so it
     has to be re-based; nothing else changes, because the car's world
     position, heading and offset across the road are all identical
     either side of the swap — it is the same tarmac, freshly described.

     `hints` is cleared because every entry in it is a station index on a
     road that no longer exists. */
  function rebase(r) {
    if (!r) return;
    S.road = r.road;
    S.s = r.s;
    S.hints.clear();
    place();
  }

  /* ── there is nobody else on this road ──────────────────────────────
     Traffic was written, worked, and has been deleted. It went because
     the map is being rebuilt from a fictional region into one real
     corridor, and a car that decides which exit to take is worth
     nothing until the exits are the right exits in the right places.

     What went with it: car-following, lane changes, the exit-choosing
     AI, and a signal queue built out of a red light modelled as a
     stopped car of zero length — which is how queues assembled and
     overflowed backwards up a ramp without anybody writing that. It is
     worth rebuilding that way again.

     What went with it HERE: the separating-axis box test, contact
     detection, and pass scoring. `crash()` still exists and the barrier
     and the verge still use it, so leaving the road still ends a run;
     there is simply nothing left to hit that moves. Score currently
     comes from distance and from taking exits — see PLAN.md §2 for
     where it should come from once there is a corridor to score. */

  /* ── taking an exit ─────────────────────────────────────────────────
     Paid at the far end of the ramp, not at the gore, because until you
     are down on the new motorway you have not been anywhere — and there
     is usually a queue between the two. */
  function takeExit(routeType) {
    if (S.mode !== "play") return;
    S.exits++;
    S.score += 900 + 260 * S.exits;
    S.combo = Math.min(S.combo + 3, 12);
    S.comboT = 4;
    S.mult = 1 + S.combo * 0.15;
    blip("exit");
    flashExit(routeType);
  }

  function crash(cause) {
    if (S.mode !== "play") return;
    S.mode = "wreck";
    S.cause = cause;
    S.why = pick(WHY[cause]);
    S.wreckT = 0; S.shake = 7; S.flash = 1;
    puff(S.x, S.y, 26, "debris");
    puff(S.x, S.y, 12, "fire");
    blip("crash");
    if (A.ready) { A.eng.gain.value = 0; A.nG.gain.value = 0; }
    S.newBest = S.score > best;
    if (S.newBest) {
      best = Math.floor(S.score);
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* private mode */ }
    }
    showWreck();
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD and panels
     ══════════════════════════════════════════════════════════════════ */
  const el = (id) => document.getElementById(id);
  const hudSpeed = el("hud-speed"), hudDist = el("hud-dist"),
        hudScore = el("hud-score"), hudBest = el("hud-best"),
        cellScore = el("cell-score"), hudMile = el("hud-mile");
  const panels = { title: el("panel-title"), pause: el("panel-pause"), wreck: el("panel-wreck") };
  const fmt = (n) => Math.floor(n).toLocaleString("en-US");
  const km = () => S.distPx * M_PER_PX / 1000;
  /* Declared here rather than beside drawHud() because the units
     block below resets it at load, and `let` in a temporal dead zone
     throws — which killed the whole module silently. */
  let hudTick = -1;

  /* ── units ──────────────────────────────────────────────────────────
     This is a road in Tennessee, so miles per hour is the default and
     km/h is the option, not the other way round. The choice sticks,
     because nobody wants to set it twice. */
  const UNIT_KEY = "offramp.units";
  let units = "mph";
  try { units = localStorage.getItem(UNIT_KEY) === "kmh" ? "kmh" : "mph"; } catch (e) {}
  const unitBtn = el("units");
  function paintUnits() {
    if (unitBtn) unitBtn.textContent = units === "mph" ? "MPH" : "KM/H";
    hudTick = -1;                       // force the readouts to redraw
  }
  function setUnits(u) {
    units = u === "kmh" ? "kmh" : "mph";
    try { localStorage.setItem(UNIT_KEY, units); } catch (e) {}
    paintUnits();
  }
  if (unitBtn) unitBtn.addEventListener("click", () => setUnits(units === "mph" ? "kmh" : "mph"));
  paintUnits();

  function drawHud() {
    const tick = Math.floor(S.t * 10);
    if (tick === hudTick) return;
    hudTick = tick;
    if (units === "mph") {
      hudSpeed.innerHTML = Math.round(S.speed / KMH_PER_MPH) + "<small> mph</small>";
      hudDist.innerHTML = (km() / KMH_PER_MPH).toFixed(2) + "<small> mi</small>";
    } else {
      hudSpeed.innerHTML = Math.round(S.speed) + "<small> km/h</small>";
      hudDist.innerHTML = km().toFixed(2) + "<small> km</small>";
    }
    hudScore.textContent = fmt(S.score) + (S.mult > 1.01 ? "  ×" + S.mult.toFixed(1) : "");
    hudBest.textContent = fmt(best);
    cellScore.classList.toggle("hot", S.mult > 1.5);
    /* Where you are on the real road, which is the one number on this
       machine that a driver would recognise: mile marker and state, the
       same pair painted on the little green posts. */
    if (hudMile) {
      /* On the mainline this is exact; on a ramp or a truck stop it is
         the corridor position that structure hangs off, which is right
         to within its own half mile and never blank. */
      const px = S.road
        ? (S.road.corridor ? S.road.baseS + S.s : S.road.corridorPx)
        : null;
      const mk = px != null ? World.marker(px) : null;
      hudMile.textContent = mk
        ? `${Math.floor(mk.mile)}` + `<small> ${mk.state}</small>` : "—";
      if (mk) hudMile.innerHTML = `${Math.floor(mk.mile)}<small> ${mk.state}</small>`;
    }
  }

  const banner = el("banner");
  let bannerT = 0;
  function flashExit(routeType) {
    banner.textContent = routeType === "loop" ? "LOOP COMPLETE"
      : routeType === "signal" ? "LIGHTS TO FREEWAY"
      : routeType === "beltway" ? "BELTWAY"
      : routeType === "radial" ? "RADIAL CONNECTOR"
      : "FREEWAY CONNECTOR";
    banner.classList.add("on");
    bannerT = 1.8;
  }
  function showPanel(name) {
    for (const k in panels) panels[k].classList.toggle("on", k === name);
  }
  function showWreck() {
    el("wreck-why").textContent = S.why;
    el("w-dist").textContent = km().toFixed(2) + " km";
    el("w-score").textContent = fmt(S.score);
    el("w-top").textContent = Math.round(S.topSpeed) + " km/h";
    el("w-best").hidden = !S.newBest;
    setTimeout(() => { if (S.mode === "wreck") showPanel("wreck"); }, 900);
  }

  /* ══════════════════════════════════════════════════════════════════
     fixed-network map — drawn only when asked for

     This is the same road graph the player drives, reduced to a small
     pixel plot. It is not a second generated map and it does not alter
     the run. Opening it holds the simulation; closing it restores the
     exact mode it interrupted.
     ══════════════════════════════════════════════════════════════════ */
  const mapPanel = el("map-panel"), mapCanvas = el("map-canvas");
  const mapCtx = mapCanvas.getContext("2d", { alpha: false });
  const mapToggle = el("map-toggle"), mapClose = el("map-close");
  let mapOpen = false, mapReturnMode = "title";

  function mapLine(x0, y0, x1, y1, colour, width) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    mapCtx.fillStyle = colour;
    for (;;) {
      mapCtx.fillRect(x0 - (width >> 1), y0 - (width >> 1), width, width);
      if (x0 === x1 && y0 === y1) break;
      const e2 = err * 2;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /* ── the overview ───────────────────────────────────────────────────
     Drawn from LAT/LON, not from the world.

     The game world is I-40 developed onto a plane: every curve and every
     distance is true, and global orientation is allowed to drift,
     because you never see more than 660 px of it. Draw 2,551 miles of
     that and the road curls into a spiral. So the map uses `I40.map`,
     which is the real geography sampled every two miles — and because
     the samples are at fixed mileage, finding the car on it is a
     division rather than a search.

     This used to draw `World.roads`, which was the whole fictional
     network and is now the twenty live miles. It also read stats that
     no longer exist, and said "undefined METROS". */
  function renderMap() {
    const line = I40.map, stepPx = I40.mapStepMi * World.MILE;
    const w = mapCanvas.width, h = mapCanvas.height, pad = 10;

    let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180;
    for (const [la, lo] of line) {
      if (la < minLa) minLa = la; if (la > maxLa) maxLa = la;
      if (lo < minLo) minLo = lo; if (lo > maxLo) maxLo = lo;
    }
    // equirectangular, squeezed by cos(lat) so the shape is not stretched
    const kx = Math.cos((minLa + maxLa) / 2 * Math.PI / 180);
    const spanX = Math.max(1e-6, (maxLo - minLo) * kx), spanY = Math.max(1e-6, maxLa - minLa);
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    const mx = (lo) => (w - spanX * scale) / 2 + (lo - minLo) * kx * scale;
    const my = (la) => (h + spanY * scale) / 2 - (la - minLa) * scale;

    mapCtx.imageSmoothingEnabled = false;
    mapCtx.fillStyle = "#060b08";
    mapCtx.fillRect(0, 0, w, h);

    // the corridor
    for (let i = 1; i < line.length; i++)
      mapLine(mx(line[i - 1][1]), my(line[i - 1][0]),
              mx(line[i][1]), my(line[i][0]), "#56616a", 2);

    /* State lines, where the exit numbering resets — the one piece of
       structure this route has, and the reason exit 1 turns up eight
       times. Labelled, because "which state am I in" is most of what an
       overview of a 2,551-mile road is for. */
    mapCtx.font = "7px ui-monospace, Menlo, monospace";
    mapCtx.textAlign = "center";
    for (const st of I40.states) {
      const k = Math.round(st.startPx / stepPx);
      const p = line[Math.max(0, Math.min(line.length - 1, k))];
      if (!p) continue;
      const x = Math.round(mx(p[1])), y = Math.round(my(p[0]));
      mapCtx.fillStyle = "#7d8a94";
      mapCtx.fillRect(x, y - 5, 1, 11);
      const mid = Math.round(st.startPx / stepPx + (st.endPx - st.startPx) / stepPx / 2);
      const q = line[Math.max(0, Math.min(line.length - 1, mid))];
      if (q) {
        mapCtx.fillStyle = "#9fb0a6";
        mapCtx.fillText(st.name, Math.round(mx(q[1])), Math.round(my(q[0])) - 9);
      }
    }

    // every exit, one pixel each
    mapCtx.fillStyle = "#2f7d4e";
    for (const e of I40.exits) {
      const k = Math.round(e.px / stepPx);
      const p = line[Math.max(0, Math.min(line.length - 1, k))];
      if (p) mapCtx.fillRect(Math.round(mx(p[1])), Math.round(my(p[0])), 1, 1);
    }

    // the live window, in white: the stretch that actually exists as road
    if (S.road && S.road.corridor) {
      const k0 = Math.round(S.road.baseS / stepPx);
      const k1 = Math.round((S.road.baseS + R.len(S.road)) / stepPx);
      for (let i = Math.max(1, k0); i <= Math.min(line.length - 1, k1); i++)
        mapLine(mx(line[i - 1][1]), my(line[i - 1][0]),
                mx(line[i][1]), my(line[i][0]), "#e8e2cc", 2);
    }

    /* The player's marker is deliberately oversized: the map spans two
       and a half thousand miles and a scale-accurate car would be a
       thousandth of a pixel. */
    const corridorPx = S.road && S.road.corridor ? S.road.baseS + S.s : 0;
    const f = corridorPx / stepPx;
    const i0 = Math.max(0, Math.min(line.length - 1, Math.floor(f)));
    const i1 = Math.min(line.length - 1, i0 + 1);
    const t = f - i0;
    const la = line[i0][0] + (line[i1][0] - line[i0][0]) * t;
    const lo = line[i0][1] + (line[i1][1] - line[i0][1]) * t;
    const px = Math.round(mx(lo)), py = Math.round(my(la));
    mapCtx.fillStyle = "#1a0b08"; mapCtx.fillRect(px - 3, py - 3, 7, 7);
    mapCtx.fillStyle = "#ff6a4d"; mapCtx.fillRect(px - 2, py - 2, 5, 5);
    mapCtx.fillStyle = "#fff0d5"; mapCtx.fillRect(px, py, 1, 1);

    const mk = World.marker(corridorPx);
    const st = World.state.mapStats;
    el("map-status").innerHTML = mk
      ? `<b>■ YOU</b> · ${mk.state} MILE ${Math.floor(mk.mile)} · ` +
        `${st.route} · ${st.corridorMiles} MI · ${st.exits} EXITS`
      : `<b>■ YOU</b> · ${st.route}`;
  }

  function setMap(open) {
    if (open === mapOpen) return;
    mapOpen = open;
    mapToggle.setAttribute("aria-pressed", String(open));
    mapToggle.setAttribute("aria-label", open ? "Close freeway map" : "Open freeway map");
    if (open) {
      mapReturnMode = S.mode;
      S.mode = "map";
      keys.clear(); touch.steer = 0; touch.brake = false;
      mapPanel.hidden = false;
      renderMap();
      mapClose.focus();
    } else {
      mapPanel.hidden = true;
      if (S.mode === "map") S.mode = mapReturnMode;
      mapToggle.focus();
    }
  }

  mapToggle.addEventListener("click", () => setMap(!mapOpen));
  mapClose.addEventListener("click", () => setMap(false));
  mapPanel.addEventListener("pointerdown", (e) => e.stopPropagation());

  /* ══════════════════════════════════════════════════════════════════
     start and reset
     ══════════════════════════════════════════════════════════════════ */
  function reset(mode) {
    S.mode = mode;
    const p = World.reset();
    const map = World.state.mapStats;
    if (map) el("map-note").textContent = `${map.route} · ${map.corridorMiles} MI · ${map.exits} EXITS · ${map.stops} STOPS`;
    /* Which way you are pointing is chosen on the sign, not assumed.
       `fwd` has always existed — traffic has carried a direction since
       the day it was written, and the surface rescue can already flip
       you when you join a road facing the other way — so the title
       screen is not adding a mode, only picking a value that the whole
       game already understood. East is increasing s, which is how a
       west-to-east mainline is built. */
    S.road = p.road; S.s = p.s; S.vu = 0;
    S.fwd = heading === "E";
    S.u = R.laneU(p.road, p.s, 1, S.fwd);
    S.camU = camTarget(p.road);
    S.speed = mode === "title" ? 122 : 100;
    S.onRamp = false; S.aimLane = 1;
    S.parts.length = 0; S.marks.length = 0;
    S.distPx = 0; S.score = 0; S.mult = 1; S.combo = 0; S.comboT = 0;
    S.topSpeed = 0; S.exits = 0;
    S.shake = 0; S.flash = 0; S.wreckT = 0; S.gravelT = 0;
    S.newBest = false; S.hints.clear();
    place();
    World.update(S.x, S.y, 0.016, S.road, S.s);
    showPanel(mode === "title" ? "title" : null);
    banner.classList.remove("on");
    hudTick = -1;
  }

  /* ── the direction on the sign ──────────────────────────────────────
     "E" or "W". Held outside reset() so it survives a wreck and a
     restart: you chose a direction when you walked up to the machine,
     and R puts you back on the road you picked rather than silently
     turning you round. */
  let heading = "E";
  const dirBtns = [el("dir-west"), el("dir-east")].filter(Boolean);

  /* ── the exit you start from ────────────────────────────────────────
     Twelve hundred of them across eight states, so the list is grouped
     by state and labelled with the real exit number — which is also the
     mile marker, so "TN 383" reads as both "Papermill" and "three
     hundred and eighty-three miles into Tennessee".

     Populated once, from the corridor, because the corridor is the only
     thing that knows where the exits are. */
  const startSel = el("start-exit"), wreckSel = el("wreck-exit");
  function fillStarts() {
    /* `typeof`, not `window.I40`: the corridor is declared with `const`
       at the top level of a classic script, which creates a script-scope
       binding and NOT a property of window. Guarding on window.I40 was
       always false, so the picker silently stayed empty. */
    if (!startSel || typeof I40 === "undefined") return;
    const byState = new Map();
    for (const st of I40.states) byState.set(st.name, []);
    for (const e of I40.exits) {
      let name = null;
      for (const st of I40.states)
        if (e.px >= st.startPx - 4 * World.MILE && e.px <= st.endPx + 4 * World.MILE) name = st.name;
      if (!name) continue;
      byState.get(name).push(e);
    }
    const frag = document.createDocumentFragment();
    for (const [state, list] of byState) {
      if (!list.length) continue;
      const g = document.createElement("optgroup");
      g.label = state;
      for (const e of list) {
        const o = document.createElement("option");
        o.value = e.px;
        o.textContent = `${state} · Exit ${e.ref}`;
        g.appendChild(o);
      }
      frag.appendChild(g);
    }
    /* Clone BEFORE appending: appending a DocumentFragment empties it,
       so cloning afterwards copied nothing and the wreck panel's picker
       came up with no options in it at all. */
    const copy = wreckSel ? frag.cloneNode(true) : null;
    startSel.appendChild(frag);
    if (wreckSel) wreckSel.appendChild(copy);
    // default to Knoxville, which is the stretch this was built against
    let best = null, want = 2050 * World.MILE;
    for (const o of startSel.options)
      if (!best || Math.abs(+o.value - want) < Math.abs(+best.value - want)) best = o;
    if (best) {
      startSel.value = best.value;
      if (wreckSel) wreckSel.value = best.value;
      World.setStart(+best.value);
    }
  }
  fillStarts();

  /* Both pickers set the same thing and mirror each other, so the exit
     you chose on the sign is the one already selected when you wreck —
     and changing it there changes where R puts you back. */
  function wirePicker(sel, other) {
    if (!sel) return;
    sel.addEventListener("change", () => {
      World.setStart(+sel.value);
      if (other) other.value = sel.value;
    });
    // the panels swallow clicks to start or restart; the picker must not
    for (const ev of ["pointerdown", "click", "keydown"])
      sel.addEventListener(ev, (e) => e.stopPropagation());
  }
  wirePicker(startSel, wreckSel);
  wirePicker(wreckSel, startSel);

  function setHeading(d) {
    heading = d === "W" ? "W" : "E";
    for (const b of dirBtns) b.setAttribute("aria-checked", String(b.dataset.dir === heading));
  }

  for (const b of dirBtns) {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      setHeading(b.dataset.dir);
      if (S.mode === "title") startDriving();
    });
  }
  setHeading("E");

  function startDriving() { audioStart(); reset("play"); showPanel(null); }

  /* ══════════════════════════════════════════════════════════════════
     input
     ══════════════════════════════════════════════════════════════════ */
  const HELD = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

  addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === "KeyG") { e.preventDefault(); setMap(!mapOpen); return; }
    if (mapOpen) {
      if (e.code === "Escape") setMap(false);
      e.preventDefault();
      return;
    }
    if (HELD.has(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === "KeyM") { setMuted(!A.muted); return; }
    /* On the sign, left and right choose a direction instead of steering
       — they are the same two keys you will steer with a second later,
       which is the arcade convention and means nobody has to be told. */
    if (S.mode === "title") {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "ArrowLeft") { setHeading("W"); return; }
      if (e.code === "ArrowRight") { setHeading("E"); return; }
      startDriving();
      return;
    }
    if (e.code === "KeyP") {
      if (S.mode === "play") { S.mode = "pause"; showPanel("pause"); }
      else if (S.mode === "pause") { S.mode = "play"; showPanel(null); }
      return;
    }
    if (S.mode === "wreck" && (e.code === "KeyR" || e.code === "Enter" || e.code === "Space")) { startDriving(); return; }
    if (e.code === "KeyR" && S.mode === "play") { startDriving(); return; }
    if (e.code === "KeyH" && S.mode === "play") blip("horn");
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => {
    keys.clear(); touch.steer = 0; touch.brake = false;
    if (S.mode === "play") { S.mode = "pause"; showPanel("pause"); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && S.mode === "play") { S.mode = "pause"; showPanel("pause"); }
  });

  function markTouch() {
    if (isTouch) return;
    isTouch = true;
    document.body.classList.add("touch");
    document.querySelector("#panel-title .keys.kb").style.display = "none";
    document.querySelector("#panel-title .keys.tp").style.display = "grid";
    el("title-go").textContent = "tap to drive";
  }

  frame.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") markTouch();
    audioStart();
    if (S.mode === "title") startDriving();
    else if (S.mode === "wreck") { if (S.wreckT > 0.9) startDriving(); return; }
    else if (S.mode === "pause") { S.mode = "play"; showPanel(null); }
    touch.active = true; touch.lastX = e.clientX;
    frame.setPointerCapture?.(e.pointerId);
  });
  frame.addEventListener("pointermove", (e) => {
    if (!touch.active) return;
    const dx = e.clientX - touch.lastX;
    touch.lastX = e.clientX;
    const scale = cvs.clientWidth / VW || 1;
    touch.steer = clamp(touch.steer + (dx / scale) * 0.19, -1, 1);
  });
  const endTouch = () => { touch.active = false; touch.steer = 0; };
  frame.addEventListener("pointerup", endTouch);
  frame.addEventListener("pointercancel", endTouch);

  const brake = el("brake");
  const brakeOn = (on) => { touch.brake = on; brake.classList.toggle("on", on); };
  brake.addEventListener("pointerdown", (e) => { e.preventDefault(); markTouch(); brakeOn(true); brake.setPointerCapture?.(e.pointerId); });
  brake.addEventListener("pointerup", () => brakeOn(false));
  brake.addEventListener("pointercancel", () => brakeOn(false));
  brake.addEventListener("contextmenu", (e) => e.preventDefault());
  if (matchMedia("(any-pointer: coarse) and (any-hover: none)").matches) markTouch();

  /* ══════════════════════════════════════════════════════════════════
     attract mode

     Nobody is steering, so nothing has to: the car keeps its offset
     across a road that is already going where it goes, and drifts
     between lanes now and then so the screen isn't a still frame with
     scenery on it. It uses the same prebuilt road and will happily
     run past a real interchange.
     ══════════════════════════════════════════════════════════════════ */
  function autopilot(dt) {
    const lanes = R.laneCount(S.road, S.s, true);
    if (Math.random() < 0.4 * dt) S.aimLane = (Math.random() * lanes) | 0;
    const tu = R.laneU(S.road, S.s, Math.min(S.aimLane, lanes - 1), true);
    S.u += clamp(tu - S.u, -46 * dt, 46 * dt);
    S.s += pxs(S.speed) * dt;
    S.distPx += pxs(S.speed) * dt * 0.25;
    // the attract loop never leaves the main line, so it never wrecks
    if (S.s > R.len(S.road) - 400) reset("title");
    easeCamera(dt);
    place();
  }

  /* ══════════════════════════════════════════════════════════════════
     the loop — fixed steps, so physics does not change with framerate
     ══════════════════════════════════════════════════════════════════ */
  const STEP = 1 / 120;
  let acc = 0, last = performance.now();

  const difficulty = () => 1 - Math.exp(-km() / 6);

  function step(dt) {
    S.t += dt;
    S.shake = Math.max(0, S.shake - dt * (S.mode === "wreck" ? 9 : 14));
    S.flash = Math.max(0, S.flash - dt * 3.4);
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) banner.classList.remove("on");
    }

    if (S.mode === "title") {
      S.speed = 122;
      autopilot(dt);
      rebase(World.update(S.x, S.y, dt, S.road, S.s));
      updateParts(dt);
      return;
    }

    if (S.mode === "wreck") {
      S.wreckT += dt;
      S.speed = Math.max(0, S.speed - 240 * dt);
      S.s = Math.min(S.s + pxs(S.speed) * dt, R.len(S.road) - 2);
      easeCamera(dt);
      place();
      if (S.wreckT < 2.2 && Math.random() < 18 * dt) puff(S.x + rnd(-5, 5), S.y + rnd(-5, 5), 1, "smoke");
      if (S.wreckT < 0.8 && Math.random() < 12 * dt) puff(S.x + rnd(-4, 4), S.y + rnd(-4, 4), 1, "fire");
      rebase(World.update(S.x, S.y, dt, S.road, S.s));
      updateParts(dt);
      return;
    }

    if (S.mode !== "play") return;

    updatePlayer(dt);
    if (S.mode !== "play") return;         // updatePlayer may have ended it
    rebase(World.update(S.x, S.y, dt, S.road, S.s));
    updateParts(dt);
  }

  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 40) { step(STEP); acc -= STEP; }

    Draw.setPhase(S.distPx / 9000 + 0.06);
    const shx = S.shake > 0.05 ? rnd(-S.shake, S.shake) : 0;
    const shy = S.shake > 0.05 ? rnd(-S.shake, S.shake) : 0;
    Draw.world(S.camX + shx, S.camY + shy, S.h, S);
    drawHud();
    audioFrame();
  }

  /* A handle on the car, for when something is wrong with the road and
     you need to know where you actually are. Off unless asked for. */
  if (location.search.includes("debug")) {
    window.OFFRAMP = {
      S, R, roads: World.roads, junctions: World.junctions,
      reset, startDriving,
      surface: () => World.surface(S.x, S.y, S.hints),
      drawHud,
      /* Drive the real update by hand. requestAnimationFrame is frozen
         whenever the page is not the foreground tab, so a test that sets
         the car down and waits is a test that measures nothing. */
      step: (n) => { for (let k = 0; k < (n | 0); k++) step(STEP); },
      underneath,
    };
  }

  reset("title");
  if (location.search.includes("debug")) {
    /* Exercise the real player update and handoff—not a duplicate of
       the geometry formula—and leave the result where browser tests can
       read it without reaching into this module's private scope. */
    const failures = [];
    let checked = 0;
    for (const j of World.junctions) {
      const ramp = j.ramp, m = ramp.merge;
      if (!m) continue;
      for (let lane = 0; lane < m.lanes; lane++) {
        S.mode = "play";
        S.road = ramp;
        S.s = R.len(ramp) - 0.5;
        S.u = lane * R.LANE;
        S.vu = 0;
        S.speed = V_MAX;
        S.camU = 0;
        place();
        updatePlayer(STEP);
        const what = underneath(S.road, S.s, S.u);
        checked++;
        if (S.mode !== "play" || S.road !== m.into || what === "grass")
          failures.push({ exit: j.no, lane, mode: S.mode, what });
      }
    }
    document.documentElement.dataset.offrampMergeTest = JSON.stringify({ checked, failures });

    /* Drive a sample of local interchanges the whole way round — off the
       freeway, down the loop, along the cross street, up the entrance
       ramp and back onto the freeway. The merge test above only proves
       the last handover of each ramp; this proves the route. */
    const loopFailures = [];
    let loopsChecked = 0;
    const locals = World.junctions.filter((j) => j.local);
    for (let n = 0; n < locals.length; n += Math.max(1, Math.ceil(locals.length / 24))) {
      const j = locals[n];
      S.mode = "play"; S.road = j.from; S.s = j.s - 260; S.u = j.startU; S.vu = 0;
      S.speed = V_MAX; S.camU = 0; place();
      let seen = 0, back = false;
      for (let k = 0; k < 9000 && S.mode === "play"; k++) {
        S.speed = Math.max(S.speed, 150);
        step(STEP);
        if (S.road === j.ramp) seen |= 1;
        else if (S.road === j.street) seen |= 2;
        else if (S.road === j.onramp) seen |= 4;
        else if (seen === 7 && S.road === j.from) { back = true; break; }
      }
      loopsChecked++;
      if (!back) loopFailures.push({ exit: j.no, seen, mode: S.mode, why: S.why });
    }
    document.documentElement.dataset.offrampLoopTest =
      JSON.stringify({ checked: loopsChecked, failures: loopFailures });

    const ringFailures = [];
    let ringsChecked = 0;
    for (const ring of World.roads) {
      if (!ring.wrap) continue;
      S.mode = "play";
      S.road = ring;
      S.s = R.len(ring) - 0.5;
      S.u = R.laneU(ring, S.s, 0, true);
      S.vu = 0;
      S.speed = V_MAX;
      S.camU = camTarget(ring);
      place();
      updatePlayer(STEP);
      const what = underneath(S.road, S.s, S.u);
      ringsChecked++;
      if (S.mode !== "play" || S.road !== ring || S.s > 10 || what === "grass")
        ringFailures.push({ road: ring.routeName, mode: S.mode, s: S.s, what });
    }
    document.documentElement.dataset.offrampRingTest = JSON.stringify({ checked: ringsChecked, failures: ringFailures });
    reset("title");
  }
  drawHud();
  requestAnimationFrame(frameLoop);
})();
