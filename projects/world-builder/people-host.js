/* WORLD BUILDER — THE PEOPLE ENGINE'S KEEPER
   ────────────────────────────────────────────────────────────────────────
   TODO item 3 (2026-11-15): "run the engine in a worker and send the page
   only what it draws."

   This file holds one world, runs its clock, and answers the page. The page
   never touches a person: it asks for a frame (who is on screen, where, what
   colour), for the panel it is showing, for who is under a tap, or for a
   decision to be carried out, and gets back plain numbers and words. So the
   engine can sit on another thread — a Web Worker — and a big world no
   longer stops the page from answering a finger.

   It is written without a timer or a thread of its own. `create()` gives a
   keeper with two doors: `receive(message)` and `run(seconds, budget)`.
     · In a worker, `worker()` below feeds it messages and calls `run` in a
       loop of its own.
     · Where a worker cannot be had, the page keeps the very same keeper on
       its own thread and calls `run` once a frame, as it always did.
     · In node, the tests call both by hand.
   One code path, three places.

   Nothing here decides anything about the world. It reads, and it passes
   the page's own orders (`rule`, `order`, `declare`, `set`) to the doors the
   engine already had. Time is handed over as `advance(seconds, true)` — the
   word that nobody was changed between steps — and the engine's doors drop
   that word themselves when the page does change something.

   No dependencies; the same in a browser, a worker and node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  /* `factory` is kept so the page can write this file out again as the text
     of a worker (index.html, `keeperText`): a page opened straight from a
     folder may not load a worker from a file, but may from text it holds. */
  else { root.WBPeopleHost = factory(); root.WBPeopleHost.factory = factory; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* What one byte says about a person on screen, and what they carry. */
  /* Where a pond lies in its square and how big it is (2026-11-27): the page draws it there and a tap
     finds it there, from the same two functions, the page's copy written out from these. */
  function pondAt(i, cols, seed) { let a = ((seed | 0) * 40503 + i * 2654435761) >>> 0; a = Math.imul(a ^ (a >>> 16), 73244475) >>> 0; return [i % cols + 0.25 + (a & 1023) / 1023 * 0.5, Math.floor(i / cols) + 0.25 + ((a >>> 10) & 1023) / 1023 * 0.5]; }
  function pondR(k) { return 0.03 + k / 255 * 0.17; }   // in squares: about 15 m across to 100 m
  const FLAG = { child: 1, hit: 2, sick: 4, leader: 8, speaking: 16, harvesting: 32 };
  const GEAR = { tool: 1, weapon: 2, shield: 4, pack: 8, food: 16, load: 32, cart: 64 };
  /* The longest stretch of the world's time handed to the engine in one go
     when running flat out: a little over one step, so the keeper looks up to
     answer the page between steps however big the world is. (Handing time
     over in small pieces costs nothing since TODO 2b.) */
  const SLICE = 0.25;
  const now = () => performance.now();

  function create(People, send) {
    let world = null, rate = 1, paused = false;
    let simAcc = 0, wallAcc = 0, speed = 0;          // how fast it is really going, over the last half second
    /* How fast it went on Max, over the whole run so far (TODO 3b): world time
       and real time while the clock was on Max and not paused. The setup page
       remembers it, so the next time these settings are chosen it can say
       what the world really held rather than what its first days promised. */
    let maxSim = 0, maxWall = 0;
    let vsSig = "", fsSig = "", heldSent = -1, trackSent = -1;       // what the page was last told of villages, factions and held fields
    let frameKey = "";                               // the last frame asked for, and the step it was made at
    /* The land as the page was last sent it (TODO 15.25, pass 4): each square's crop as sent
       (`landFull`), the crop it was worked out from (`landStock`, the bits of the engine's number),
       and the holders as sent (`sentOwner`). Once the page holds a whole land, it is sent only the
       blocks of LAND_BLOCK squares a side whose crops or holders have changed since; a square's crop
       is only worked out again when the engine's number for it has changed. */
    const LAND_BLOCK = 64;
    let landFull = null, landStock = null, sentOwner = null, sentAt = -1, cropDirty = null, ownDirty = null;   // the blocks found changed
    let groundSent = 0;   // TODO 15.5d: how much of the engine's log of changed ground the page has been sent
    if (LAND_BLOCK !== 64) throw new Error("LAND_BLOCK is found by shifting by 6");
    let sorted = null, sortedSig = "";               // everybody by name, for the People list
    let trial = null;                                // the quiet test of a world (see `tryOut`)
    /* The keeper's own memory (TODO 21d, 21f, 21g). It reads the world and remembers what it has
       read; nothing here is written back into the world, and a world watched this way is the world
       unwatched (test/keeper.test.mjs, test/watching.test.mjs). */
    let until = null;                                // run until: { day, label }, then pause
    let pins = [], pauseOnPin = false;               // what the visitor keeps: [{ k: "p"|"h"|"v"|"f", id }]
    let lastEvent = -1, firsts = [], firstKinds = new Set();
    let pinRows = new Map(), pinNews = new Map(), rowDay = -1;
    let actions = [], startS = null, probsNow = null, probsHour = -1;
    /* Scratch the frames are filled into; what is sent is a copy cut to size,
       so a buffer handed across to the page is never one this still holds. */
    let cap = 0, X = null, Y = null, T = null, F = null, G = null, L = null, A = null;
    /* What the page was last sent of each house's state (TODO 22c: lived in, a fire lit) and of the year's rain. */
    let hearthSent = null, rainSent = -1;
    function room(n) {
      if (n <= cap) return;
      cap = Math.max(1024, Math.ceil(n * 1.25));
      X = new Float32Array(cap); Y = new Float32Array(cap); T = new Uint16Array(cap);
      F = new Uint8Array(cap); G = new Uint8Array(cap); L = new Float32Array(cap * 2); A = new Uint32Array(cap);
    }

    function receive(m) {
      if (!m || typeof m !== "object") return;
      if (m.t === "start") return start(m);
      if (m.t === "try") return tryOut(m);
      if (m.t === "hello") return send({ t: "hello" });
      if (m.t === "clock") {
        if ("rate" in m) rate = +m.rate || 1;
        if ("paused" in m) paused = !!m.paused;
        if ("until" in m) setUntil(m.until);
        simAcc = wallAcc = 0; speed = 0;
        return;
      }
      if (!world) return;
      if (m.t === "frame") return frame(m);
      if (m.t === "pane") return pane(m);
      if (m.t === "at") return at(m);
      if (m.t === "do") return act(m);
      if (m.t === "pins") { setPins(m.list || [], !!m.pause); return; }
    }

    function start(m) {
      world = null; trial = null; vsSig = fsSig = ""; sorted = null; sortedSig = ""; frameKey = ""; hearthSent = null; rainSent = -1;
      landFull = landStock = sentOwner = null; sentAt = -1;
      const t0 = now();
      let w;
      try { w = People.create(m.values); }
      catch (e) { send({ t: "failed", why: String((e && e.message) || e) }); return; }
      world = w;
      until = null; pins = []; pauseOnPin = false; lastEvent = w.events.length ? w.events[w.events.length - 1].id : -1;
      firsts = []; firstKinds = new Set(); pinRows = new Map(); pinNews = new Map(); rowDay = -1; actions = [];
      startS = Object.assign({}, w.settings); probsNow = null; probsHour = -1;
      rate = +w.settings.rate || 1; paused = false; simAcc = wallAcc = 0; speed = 0; maxSim = maxWall = 0;
      const fert = w.fert.slice(), ore = w.ore.slice(), ground = w.ground.slice(), shade = hillShade(w), riverTo = w.riverTo.slice(), riverW = w.riverW ? w.riverW.slice() : null, pond = w.pond ? w.pond.slice() : null;
      /* Big rivers and their fords (TODO 6d); bridges come with the villages. */
      const cross = w.cross ? w.cross.slice() : null;
      send({ t: "started", cols: w.cols, rows: w.rows, tileCapacity: w.tileCapacity, YEAR: w.YEAR, fert: fert, ore: ore, ground: ground, shade: shade, riverTo: riverTo, riverW: riverW, pond: pond, cross: cross,
             settings: Object.assign({}, w.settings), people: w.people.length, took: (now() - t0) / 1000 }, [fert.buffer, ore.buffer, ground.buffer, shade.buffer, riverTo.buffer].concat(cross ? [cross.buffer] : []));
    }

    /* ── hill shading (TODO 5) ─────────────────────────────────────────────
       How lit each square is by a sun in the north-west 45° up, from the
       slope of the land round it: Horn's gradient over the eight
       neighbours, as ArcGIS and GDAL do it. Heights are exaggerated three
       times, as small-scale maps do, so rolling ground still reads. 180 is
       flat ground; less faces away from the light, more toward it. Once a
       world: the land does not change. */
    function hillShade(w) {
      const cols = w.cols, rows = w.rows, h = w.height, out = new Uint8Array(cols * rows), cell = 250 / 3;
      const zen = Math.PI / 4, az = (360 - 315 + 90) * Math.PI / 180, cz = Math.cos(zen), sz = Math.sin(zen);
      const at = (x, y) => h[Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1), d = at(x - 1, y), f2 = at(x + 1, y), g = at(x - 1, y + 1), hh = at(x, y + 1), i = at(x + 1, y + 1);
        const dx = ((c + 2 * f2 + i) - (a + 2 * d + g)) / (8 * cell), dy = ((g + 2 * hh + i) - (a + 2 * b + c)) / (8 * cell);
        const slope = Math.atan(Math.hypot(dx, dy));
        let aspect = Math.atan2(dy, -dx); if (aspect < 0) aspect += 2 * Math.PI;
        const v = 255 * (cz * Math.cos(slope) + sz * Math.sin(slope) * Math.cos(az - aspect));
        out[y * cols + x] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      return out;
    }

    /* ── the clock ──────────────────────────────────────────────────────────
       `real` is the time since this was last called, in seconds; `budget` is
       how many milliseconds it may take before looking up. Returns true when
       it has more to do at once (running flat out), false when it can wait.

       Up to 16× the world is given exactly the time that passed. Above that
       it is given as much of the asked-for time as fits in the budget and the
       rest is dropped: the world goes slower than asked, never differently
       (README, "How fast a world can run"). At most a tenth of a second of
       real time is owed at once, so a slow machine runs slower instead of
       falling further and further behind. */
    function run(real, budget) {
      if (trial) return tryMore(budget);
      if (!world || paused || !(real > 0)) return false;
      const t0 = now(), owed = Math.min(0.1, real);
      let done = 0, more = false;
      if (rate <= 16) { done = cut(owed * rate); world.advance(done, true); watch(); }
      else {
        const want = rate >= 1000 ? Infinity : owed * rate;
        while (done < want && !paused) {
          const take = cut(Math.min(SLICE, want - done));
          world.advance(take, true); done += take;
          watch();
          if (now() - t0 >= budget) { more = done < want && !paused; break; }
        }
      }
      simAcc += done; wallAcc += real;
      if (rate >= 1000) { maxSim += done; maxWall += owed; }   // owed, not real: a page asleep in a back tab is not the world being slow
      if (wallAcc >= 0.5) { speed = simAcc / wallAcc; simAcc = wallAcc = 0; }
      return more;
    }

    const held = () => maxWall > 0 ? maxSim / maxWall : 0;

    /* ── a frame: only what is drawn ───────────────────────────────────────
       The page says where it is looking and how closely. People outside that
       (and half a screen round it, so a drag does not outrun the answer) are
       not sent at all. Things that only show close in — what somebody
       carries, who is reaping, what is being said — are worked out only then
       and only for the people in view, exactly as the page did it.

       Reading twenty thousand people is not free — about 10 ms, most of it
       waiting on memory — so two things keep frames from eating the world's
       time. A frame asked for again with nothing changed (the same view, and
       the world on the same step: every frame but five a second at 1×) is
       answered with "same" and no more. And every frame says what it cost,
       so the page can leave that many times as long before asking again. */
    /* A person's colour for a layer (TODO 21d), as a small number the page turns into a colour and
       explains in the layer's legend. GREY is "not what this layer is about". Until 2026-11-25 this
       read the world through a name it did not have in scope (`w`), so Beliefs stopped every frame. */
    const GREY = 65535;
    function tint(w, p, view) {
      if (view === "faction" || view === "land") return p.f;
      if (view === "mood") return Math.min(23, Math.max(0, Math.round(p.mood * 23)));
      if (view === "views") { const x = w.viewOf(p); return x > 0.25 ? 2 : x < -0.25 ? 1 : 0; }
      if (view === "hunger") return p.hungry > 0 ? 2 : p.food < 0.5 ? 1 : 0;        // going hungry · under half a day's food carried · fed
      if (view === "sick") return p.sick > 0 ? 1 : p.immune ? 2 : 0;               // sick · has had it · has not
      if (view === "loyal") return Math.min(23, Math.max(0, Math.round(p.loyal * 23)));
      if (view === "faith") return p.faith == null ? GREY : p.faith % 1000;
      if (view === "roads") return p.cargo && p.cargo.amount > 0 ? (p.cargo.what === "food" ? 1 : 2) : p.job === "trader" ? 3 : GREY;
      if (view === "war") return p.job === "soldier" ? p.f : GREY;
      return Math.min(23, Math.round(Math.sqrt(Math.min(1, p.coins / 40)) * 23));
    }
    function gearOf(w, p) {
      let g = 0;
      for (const it of w.equipment(p)) if (it.equipped && GEAR[it.key]) g |= GEAR[it.key];
      if (p.cargo && p.cargo.amount > 0) g |= p.cargo.what === "food" ? GEAR.food : GEAR.load;
      return g;
    }
    function frame(m) {
      const w = world, P = w.people, n = P.length, cam = m.cam, s = cam.s, began = now();
      const wantLand = !!m.land && (m.land.force || w.sceneTick - m.land.at >= 5);
      const key = [cam.x, cam.y, s, cam.w, cam.h, m.view, until ? 1 : 0, m.picked || 0, m.follow ? 1 : 0, m.pair ? m.pair.join("+") : "", w.sceneTick, m.units ? 1 : 0].join("|");
      if (key === frameKey && !m.fresh && !wantLand) { send({ t: "frame", same: true, speed: speed, rate: rate, paused: paused, held: held(), heldFor: maxWall, days: world.days }); return; }
      frameKey = key;
      const hw = cam.w / 2 / s, hh = cam.h / 2 / s, edge = 20 / s;
      /* On screen (and the 20 pixels round it the page always allowed)… */
      const sx0 = cam.x - hw - edge, sx1 = cam.x + hw + edge, sy0 = cam.y - hh - edge, sy1 = cam.y + hh + edge;
      /* …and half a screen further, for a view that has moved since it asked. */
      const x0 = sx0 - hw * 0.5, x1 = sx1 + hw * 0.5, y0 = sy0 - hh * 0.5, y1 = sy1 + hh * 0.5;
      room(n);
      const fs = w.factions, byId = w.byId, view = m.view, close = s >= 14, closer = s >= 20, pickedId = m.picked || 0;
      const focused = m.follow && pickedId ? byId.get(pickedId) : null;
      const labels = [], talking = [];
      let k = 0, links = 0, pickedLabel = null;
      for (let i = 0; i < n; i++) {
        const p = P[i], px = p.x, py = p.y;
        if (px < x0 || px > x1 || py < y0 || py > y1) continue;
        let fl = 0;
        if (p.job === "child") fl |= FLAG.child;
        if (p.hit > 0) fl |= FLAG.hit;
        if (p.sick > 0) fl |= FLAG.sick;
        if (fs[p.f].leader === p.id) fl |= FLAG.leader;
        if (p.sayT > 0) {
          if (p.say) fl |= FLAG.speaking;
          /* A gold line between two people speaking to each other, once a pair. */
          const q = byId.get(p.talkingTo);
          if (q && q.sayT > 0 && q.talkingTo === p.id && p.id < q.id) { L[links++] = px; L[links++] = py; L[links++] = q.x; L[links++] = q.y; }
        }
        const seen = px >= sx0 && px <= sx1 && py >= sy0 && py <= sy1;
        if (close && p.task === "field" && p.harvesting) fl |= FLAG.harvesting;   // at work in a field, whatever the season calls it
        X[k] = px; Y[k] = py; T[k] = tint(w, p, view); F[k] = fl; G[k] = closer ? gearOf(w, p) : 0;
        A[k] = close && w.mapLook ? w.mapLook(p) : 0;   // TODO 22: arms, armour, a horse, a bandit, a pack animal, a car
        if (seen) {
          if (p.id === pickedId) pickedLabel = { k: k, p: p };
          else if (s >= 28 && (focused ? focused.sayT > 0 && p.id === focused.talkingTo : labels.length < 12)) labels.push({ k: k, p: p });
          if (closer && (fl & FLAG.speaking)) talking.push({ k: k, p: p });
        }
        k++;
      }
      if (pickedLabel) labels.unshift(pickedLabel);
      const out = { t: "frame", n: n, k: k, x: X.slice(0, k), y: Y.slice(0, k), tint: T.slice(0, k), flags: F.slice(0, k), gear: G.slice(0, k), look: A.slice(0, k),
                    links: L.slice(0, links), view: view,
                    labels: labels.slice(0, focused ? 2 : 12).map(r => ({ k: r.k, text: r.p.job + " · " + w.activity(r.p) })),
                    speech: null, picked: null, pair: null, moves: null, marks: null, vs: null, fs: null, land: null,
                    days: w.days, season: w.season().name || "", daylight: w.season().daylight, warmth: w.season().warmth, sceneTick: w.sceneTick, speed: speed, rate: rate, paused: paused, cost: 0,
                    held: held(), heldFor: maxWall, until: until ? until.label : "" };
      /* What is being said, nearest the middle first; the page shows four. */
      if (closer) {
        if (focused) out.speech = talking.filter(r => r.p.id === focused.id || (focused.sayT > 0 && r.p.id === focused.talkingTo));
        else { talking.sort((a, b) => Math.hypot(a.p.x - cam.x, a.p.y - cam.y) - Math.hypot(b.p.x - cam.x, b.p.y - cam.y)); out.speech = talking.slice(0, 4); }
        out.speech = out.speech.map(r => { const q = byId.get(r.p.talkingTo); return { k: r.k, text: r.p.name + (q ? " → " + q.name : "") + ": " + r.p.say }; });
      }
      /* What a layer's legend needs and the frame does not otherwise carry (TODO 21d). */
      if (view === "faith" && w.faiths) {
        const seen = new Set(); for (let i = 0; i < k; i++) if (T[i] !== GREY) seen.add(T[i]);
        out.faiths = [...seen].slice(0, 12).map(id => { const fa = w.faithOf(id); return { id: id, name: fa ? fa.name : "" }; });
      }
      if (view === "war") {
        out.wars = [];
        for (const f of fs) if (f.alive) for (const o of fs) if (o.alive && o.id > f.id && f.rel[o.id] && f.rel[o.id].war) out.wars.push([f.id, o.id, f.name, o.name]);
      }
      /* TODO 22b, 22c: armies' camps, what war left in the ground, houses burning, and each house's
         state (lived in, its fire lit) when that has changed — all read, nothing worked out anew. */
      if (w.mapCamps) out.camps = w.mapCamps();
      if (w.left) { out.left = []; for (const e of w.left()) if (e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1) out.left.push([e.x, e.y, e.kind === "mine" ? 0 : e.kind === "bomb" ? 2 : 1]); }
      out.fires = []; const tNow = w.tick;
      /* TODO 22d: tanks and aircraft where they are, a bombing run over its target for the hour it flew,
         and close in, the game in the forest squares in view. */
      if (w.mapMachines) out.machines = w.mapMachines();
      if (w.sorties) { out.sorties = []; for (const r of w.sorties()) if (tNow - r.at < 1) out.sorties.push([r.f, r.kind, r.x, r.y, tNow - r.at]); }
      if (w.mapGame && s >= 300) { out.game = []; for (let ty = Math.max(0, Math.floor(sy0)); ty <= Math.min(w.rows - 1, Math.floor(sy1)); ty++) for (let tx = Math.max(0, Math.floor(sx0)); tx <= Math.min(w.cols - 1, Math.floor(sx1)); tx++) { const i = ty * w.cols + tx, g = w.mapGame(i); if (g > 0.05) out.game.push(i, g); } }
      if (w.blasts) { out.blasts = []; for (const b of w.blasts()) if (tNow - b.at < 1 && b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1) out.blasts.push([b.x, b.y, b.r, tNow - b.at]); }
      for (let i = 0; i < w.homes.length; i++) { const h = w.homes[i]; if (!h.built && h.burned > -1e9 && tNow - h.burned < 12) out.fires.push(i, (tNow - h.burned) / 12); }
      if (w.mapHearth) {
        /* And its beasts (TODO 22d): oxen in the low four bits of a second byte, horses in the high. */
        const hs = new Uint8Array(w.homes.length * 2);
        for (let i = 0; i < w.homes.length; i++) { const h = w.homes[i]; hs[i * 2] = (h.built && h.n > 0 ? 1 : 0) | (h.built && w.mapHearth(h) ? 2 : 0); hs[i * 2 + 1] = Math.min(15, h.ox || 0) | Math.min(15, h.horse || 0) << 4; }
        let same = !!hearthSent && hearthSent.length === hs.length && !m.fresh;
        for (let i = 0; same && i < hs.length; i++) if (hs[i] !== hearthSent[i]) same = false;
        if (!same) { hearthSent = hs; out.hearth = hs.slice(); }
      }
      if (pickedId) { const p = byId.get(pickedId); out.picked = p ? { id: p.id, x: p.x, y: p.y, name: p.name } : { id: pickedId, gone: true }; }
      /* Armies' units, with the page's toggle on and zoomed in (TODO 15.6b). */
      if (m.units && s >= 6 && w.units) out.units = w.units().filter(u => u.x > x0 && u.x < x1 && u.y > y0 && u.y < y1);
      if (m.pair) out.pair = m.pair.map(id => { const p = byId.get(id); return p ? [p.x, p.y] : null; });
      /* Households that moved, while their trail has not faded, and the big
         news of the last fortnight, where it happened. */
      const t = w.tick, FADE = 20 * 24;
      out.moves = w.moves.filter(v => t - v.t <= FADE).map(v => ({ age: (t - v.t) / FADE, from: v.from, to: v.to, f: v.f, why: v.why }));
      out.marks = [];
      for (let i = w.events.length - 1; i >= 0; i--) {
        const e = w.events[i], age = t - e.t;
        if (age > 14 * 24) break;
        if (e.x || e.y) out.marks.push({ kind: e.kind, x: e.x, y: e.y, age: age });
      }
      /* What is going wrong now, for the bar's count and the map's marks, and the news written since
         the page last heard, for its headline line (TODO 21d, 21f). A few dozen values. */
      /* Worked out once an hour of the world's time: what it reads changes no faster. */
      const hourNow = Math.floor(w.days * 24);
      if (hourNow !== probsHour || !probsNow) { probsHour = hourNow; probsNow = problems(); }
      out.probs = probsNow;
      if (m.since != null) {
        const ev = w.events, fresh = [];
        for (let i = ev.length - 1; i >= 0 && ev[i].id > m.since && fresh.length < 12; i--) { const e = slim(ev[i]); e.pin = pins.some(pin => concerns(ev[i], pin)); fresh.push(e); }
        out.news = fresh.reverse();
        out.lastEvent = ev.length ? ev[ev.length - 1].id : -1;
      }
      /* Villages and factions are sent whole, but only when something the map
         shows of them has changed. */
      let sig = w.villages.length + "|";
      /* How many live there, to the nearest five: the houses drawn round a village follow it (TODO 5). */
      for (const v of w.villages) sig += v.f + (v.alive ? "a" : "d") + (v.siege > 0 ? "s" : "") + Math.round((v.pop || 0) / 5) + (v.well ? "w" : "") + (v.bridge ? "b" : "") + (v.boat ? "o" : "") + (v.place || "village")[0] + Math.round((v.wall || 0) * 4) + "r" + Math.round((v.breach || 0) * 4) + (v.ditch ? (v.ditch.silted ? "D" : "d") : "");
      sig += "|" + w.homes.length;
      for (const h of w.homes) if (!h.built) sig += "," + h.id + (h.burned > -1e9 && h.work === 0 && h.goodsIn === 0 ? "x" : "") + ":" + Math.floor((h.work + h.goodsIn * 8) / Math.max(1, h.need + h.goodsNeed * 8) * 4);
      sig += "|" + w.homes.reduce((n, h) => n + (h.built ? 1 : 0), 0) + "|" + w.ruinStamp;   // ruinStamp: TODO 16, a building's stage changed
      if (m.fresh || sig !== vsSig) {
        vsSig = sig; out.vs = w.villages.map(v => ({ id: v.id, name: v.name, x: v.x, y: v.y, f: v.f, alive: v.alive, siege: v.siege > 0, pop: v.pop || 0, well: v.well ? [v.well.x, v.well.y] : null,
          bridge: v.bridge ? [v.bridge.x, v.bridge.y] : null, boat: v.boat ? [v.boat.x, v.boat.y] : null, place: v.place || "village", wall: Math.round((v.wall || 0) * 4) / 4, r: v.radius,
          breach: Math.round((v.breach || 0) * 4) / 4, ditch: v.ditch ? [v.ditch.at % w.cols + 0.5, Math.floor(v.ditch.at / w.cols) + 0.5, v.ditch.silted ? 1 : 0] : null }));
        /* The houses, with the villages (TODO 7a): where, how long and wide, which way, and whose. */
        /* And how far built (TODO 7b): 1 a finished house, less a building site. */
        const H = new Float32Array(w.homes.length * 7);
        w.homes.forEach((h, k) => { H[k * 7] = h.x; H[k * 7 + 1] = h.y; H[k * 7 + 2] = h.len; H[k * 7 + 3] = h.wid; H[k * 7 + 4] = h.ang; H[k * 7 + 5] = h.v;
          /* -1: burned, and nobody has started on it again yet (TODO 14b). */
          /* Built: 1, or 1 + how far gone and a half for stone walls (TODO 16); a burned one left a mound: -2. */
          H[k * 7 + 6] = h.built ? (h.stage > 0 ? 1 + h.stage + (h.stone ? 0.5 : 0) : 1) : h.burned > -1e9 && h.work === 0 && h.goodsIn === 0 ? (h.stage === 5 ? -2 : -1) : Math.min(0.95, (h.work + h.goodsIn * 8) / Math.max(1, h.need + h.goodsNeed * 8)); });
        out.homes = H;
        /* The other buildings (TODO 16): kind, where, size, facing, whose, how far gone, stone. */
        const bl = w.buildings(), B = new Float32Array(bl.length * 9);
        bl.forEach((b, k) => { B.set([b.k, b.x, b.y, b.len, b.wid, b.ang, b.v, b.stage, b.stone], k * 9); });
        out.bl = B;
      }
      /* Fields households hold (TODO 7c): square and house, in pairs, when they change. */
      /* Paths and roads (TODO 7d): square and kind, in pairs, when they change. */
      if (m.fresh || w.trackStamp !== trackSent) {
        trackSent = w.trackStamp;
        const T = []; for (let i = 0; i < w.track.length; i++) if (w.track[i]) T.push(i, w.track[i]);
        out.tracks = Int32Array.from(T);
      }
      if (m.fresh || w.heldStamp !== heldSent) {
        heldSent = w.heldStamp;
        const F = new Int32Array(w.held.size * 2); let k = 0;
        for (const [i, hid] of w.held) { F[k++] = i; F[k++] = hid; }
        out.fields = F;
      }
      sig = fs.length + "|";
      for (const f of fs) sig += f.leader + (f.alive ? "a" : "d");
      if (m.fresh || sig !== fsSig) { fsSig = sig; out.fs = fs.map(f => ({ id: f.id, name: f.name, colour: f.colour, alive: f.alive })); }
      /* The land: how much of each square's crop is standing, and whose it
         is. A small land is sent every few steps of the scene; a big one when
         the page asks, because it is a big thing to send. */
      const transfer = [out.x.buffer, out.y.buffer, out.tint.buffer, out.flags.buffer, out.gear.buffer, out.links.buffer, out.look.buffer];
      if (wantLand) {
        const tiles = w.cols * w.rows, fert = w.fert, stock = w.stock, capOf = w.tileCapacity;
        if (!landFull || landFull.length !== tiles) { landFull = new Uint8Array(tiles); landStock = null; }
        const full = landFull, own = w.landCode || w.owner, cols = w.cols, rows = w.rows, bits = new Int32Array(stock.buffer, stock.byteOffset, tiles);
        if (landStock && m.land.at === sentAt) {
          /* The page holds what was sent last: only the blocks that have changed since, found in
             the same pass that reads the crops. */
          const bc = Math.ceil(cols / LAND_BLOCK), nb = bc * Math.ceil(rows / LAND_BLOCK);
          if (!cropDirty || cropDirty.length !== nb) { cropDirty = new Uint8Array(nb); ownDirty = new Uint8Array(nb); }
          cropDirty.fill(0); ownDirty.fill(0);
          for (let y = 0; y < rows; y++) {
            const rb = (y >> 6) * bc;
            for (let x = 0, i = y * cols; x < cols; x++, i++) {
              if (bits[i] !== landStock[i]) {
                landStock[i] = bits[i];
                const f = fert[i], v = f > 0 ? Math.round(Math.min(1, stock[i] / (f * capOf)) * 255) : 255;
                if (v !== full[i]) { full[i] = v; cropDirty[rb + (x >> 6)] = 1; }
              }
              if (own[i] !== sentOwner[i]) ownDirty[rb + (x >> 6)] = 1;
            }
          }
          out.land = landChanges(w, full, w.sceneTick);
          transfer.push(out.land.cropB.buffer, out.land.crop.buffer, out.land.ownB.buffer, out.land.own.buffer);
        } else {
          /* The first, or the page has missed one: the whole land. */
          for (let i = 0; i < tiles; i++) { const f = fert[i]; full[i] = f > 0 ? Math.round(Math.min(1, stock[i] / (f * capOf)) * 255) : 255; }
          landStock = bits.slice(); sentOwner = own.slice();
          const send1 = full.slice(), owner = own.slice();   // TODO 24: a village's id, or a people's land outside its villages as −(2 + people × 8 + kind)
          out.land = { full: send1, owner: owner, at: w.sceneTick };
          transfer.push(send1.buffer, owner.buffer);
        }
        sentAt = w.sceneTick;
        /* This year's rain on each square, 100 an ordinary year (TODO 22c): with a whole land, and again when the year turns. */
        const yr = w.season().year;
        if (w.rainK && (out.land.full || yr !== rainSent)) { rainSent = yr; out.rain = w.rainK.slice(); transfer.push(out.rain.buffer); }
        /* Ground that has changed (TODO 15.5d: forest cleared, grown back): square, kind, how well it farms, three numbers each.
           All of it with a whole land, only what is new with an update; the page may take one twice. */
        const log = w.groundLog;
        if (log && log.length && (out.land.full || log.length > groundSent)) { out.grounds = Float32Array.from(out.land.full ? log : log.slice(groundSent)); groundSent = log.length; }
      }
      out.cost = now() - began;
      send(out, transfer);
    }

    /* The blocks found changed (`cropDirty`, `ownDirty`), sent: their crops (`cropB`, their squares
       in `crop`) and holders (`ownB`, `own`), block by block in order, each block's squares row
       by row; and the holders kept as sent are brought up to date (the crops already are). `base` is the land the page must hold to use them. */
    function landChanges(w, full, at) {
      const cols = w.cols, rows = w.rows, owner = w.landCode || w.owner, B = LAND_BLOCK, bc = Math.ceil(cols / B);
      const cropB = [], ownB = [];
      let nc = 0, no = 0;
      for (let b = 0; b < cropDirty.length; b++) {
        if (!cropDirty[b] && !ownDirty[b]) continue;
        const x0 = (b % bc) * B, y0 = Math.floor(b / bc) * B, size = (Math.min(cols, x0 + B) - x0) * (Math.min(rows, y0 + B) - y0);
        if (cropDirty[b]) { cropB.push(b); nc += size; }
        if (ownDirty[b]) { ownB.push(b); no += size; }
      }
      const crop = new Uint8Array(nc), own = new Int32Array(no);
      let k = 0;
      for (const b of cropB) {
        const x0 = (b % bc) * B, y0 = Math.floor(b / bc) * B, x1 = Math.min(cols, x0 + B), y1 = Math.min(rows, y0 + B);
        for (let y = y0; y < y1; y++) { const r = full.subarray(y * cols + x0, y * cols + x1); crop.set(r, k); k += x1 - x0; }
      }
      k = 0;
      for (const b of ownB) {
        const x0 = (b % bc) * B, y0 = Math.floor(b / bc) * B, x1 = Math.min(cols, x0 + B), y1 = Math.min(rows, y0 + B);
        for (let y = y0; y < y1; y++) { const r = owner.subarray(y * cols + x0, y * cols + x1); own.set(r, k); sentOwner.set(r, y * cols + x0); k += x1 - x0; }
      }
      return { part: true, base: sentAt, at: at, B: B, cropB: Int32Array.from(cropB), crop: crop, ownB: Int32Array.from(ownB), own: own };
    }

    /* ── run until, and pausing for what the visitor follows (TODO 21d) ─────────
       "Run until spring" stops at the first minute of spring: the time handed to the engine is cut
       so the world reaches that day's midnight and no further, and the keeper pauses. Nothing is
       made to happen and nothing is skipped: the world takes every step it would have taken. */
    const DAY_S = People.DAY_SECONDS;
    function setUntil(u) {
      if (!u || !world) { until = null; return; }
      const today = Math.floor(world.days + 1e-9);
      if (u.kind === "day") until = { day: today + 1, label: "the end of the day" };
      else if (u.kind === "year") until = { day: today + (u.days || 365), label: "a year from now" };
      else if (u.kind === "season") {
        const S = world.settings, now0 = People.seasonAt(today, S).name;
        let d = today + 1; while (d < today + 400 && People.seasonAt(d, S).name === now0) d++;
        until = { day: d, label: "the first day of " + People.seasonAt(d, S).name };
      } else until = null;
      if (until) paused = false;
    }
    /* No more of the asked-for time than reaches the stopping point. */
    function cut(seconds) {
      if (!until) return seconds;
      const left = (until.day - world.days) * DAY_S;
      return left <= 1e-6 ? 0 : Math.min(seconds, left + 1e-7);
    }
    function reached(why, text, extra) {
      paused = true;
      send(Object.assign({ t: "reached", why: why, text: text, days: world.days }, extra || {}));
    }
    /* After each piece of time: the events written since, the rows kept for pins, and whether to stop. */
    function watch() {
      const w = world, ev = w.events;
      if (ev.length && ev[ev.length - 1].id > lastEvent) {
        let i = ev.length - 1; while (i > 0 && ev[i - 1].id > lastEvent) i--;
        let stopFor = null;
        for (; i < ev.length; i++) {
          const e = ev[i];
          if (e.id <= lastEvent) continue;
          /* The first of each kind, kept here so the record dropping small events cannot lose it. */
          if (!firstKinds.has(e.kind)) { firstKinds.add(e.kind); firsts.push(slim(e)); }
          for (const pin of pins) if (concerns(e, pin)) {
            const key = pin.k + pin.id, list = pinNews.get(key) || [];
            list.push(slim(e)); if (list.length > 200) list.shift(); pinNews.set(key, list);
            if (pauseOnPin && !stopFor) stopFor = { e: e, pin: pin };
          }
        }
        lastEvent = ev[ev.length - 1].id;
        if (stopFor) reached("pin", stopFor.e.text, { event: slim(stopFor.e) });
      }
      const day = Math.floor(w.days + 1e-9);
      if (day !== rowDay) { rowDay = day; if (pins.length) keepRows(day); }
      if (until && w.days >= until.day - 1e-9) { const u = until; until = null; reached("until", "Stopped at " + u.label + "."); }
    }
    const slim = e => ({ id: e.id, kind: e.kind, f: e.f, day: Math.floor(e.t / 24), year: e.year, weight: e.weight, text: e.text, why: e.why || "", after: e.after || "", x: e.x, y: e.y });
    /* Whether an event is about something pinned. The engine records an event's faction and place,
       not which people it concerns (TODO 21f), so a person or a household is matched by the event
       naming them — which is what the record says, and all it says. */
    function members(id) {
      const w = world, p = w.byId.get(id); if (!p) return [];
      const out = [p], mate = p.partner && w.byId.get(p.partner);
      if (mate && mate.home === p.home) out.push(mate);
      if (p.wards) for (const k of p.wards) if (k.hp > 0 && w.byId.get(k.id) === k) out.push(k);
      return out;
    }
    const names = new Map();
    function named(text, name) { if (!text || !name) return false; const i = text.indexOf(name); return i >= 0 && !/[A-Za-z]/.test(text[i + name.length] || ""); }
    function concerns(e, pin) {
      const w = world;
      if (pin.k === "f") return e.f === pin.id;
      if (pin.k === "v") { const v = w.villages[pin.id]; return !!v && ((Math.abs(e.x - v.x) < 0.75 && Math.abs(e.y - v.y) < 0.75) || named(e.text, v.name)); }
      const nm = names.get(pin.k + pin.id) || [];
      return nm.some(n => named(e.text, n));
    }
    function setPins(list, pause) {
      pins = list.filter(x => x && "pvfh".includes(x.k) && Number.isFinite(+x.id)).slice(0, 40).map(x => ({ k: x.k, id: +x.id }));
      pauseOnPin = pause;
      names.clear();
      for (const pin of pins) {
        if (pin.k === "p") { const p = world && world.byId.get(pin.id); if (p) names.set("p" + pin.id, [p.name]); }
        if (pin.k === "h") names.set("h" + pin.id, members(pin.id).map(q => q.name));
      }
      for (const key of [...pinRows.keys()]) if (!pins.some(x => x.k + x.id === key)) { pinRows.delete(key); pinNews.delete(key); }
      if (world) keepRows(Math.floor(world.days + 1e-9), true);
    }
    /* A row a day for each pin, from the day it was pinned (the engine keeps rows for the whole
       world only; these are the keeper's, and say since when). */
    function keepRows(day, onlyNew) {
      const w = world;
      for (const pin of pins) {
        const key = pin.k + pin.id;
        if (onlyNew && pinRows.has(key)) continue;
        const rows = pinRows.get(key) || [];
        let r = null;
        if (pin.k === "p") { const p = w.byId.get(pin.id); r = p ? { day: day, food: p.food, hungry: p.hungry > 0 ? 1 : 0, sick: p.sick > 0 ? 1 : 0, coins: p.coins, mood: p.mood } : { day: day, gone: 1 }; }
        else if (pin.k === "h") { const m = members(pin.id); let food = 0, coins = 0, hungry = 0; for (const q of m) { food += q.food; coins += q.coins; if (q.hungry > 0) hungry++; } r = m.length ? { day: day, people: m.length, food: food, coins: coins, hungry: hungry } : { day: day, gone: 1 }; }
        else if (pin.k === "v") { const v = w.villages[pin.id]; r = v ? { day: day, people: v.pop || 0, hungry: v.hungry || 0, sick: v.sick || 0, store: w.storeDays(v), alive: v.alive ? 1 : 0 } : null; }
        else { const f = w.factions[pin.id]; r = f ? { day: day, people: f.pop || 0, loyal: f.loyal, soldiers: f.soldiers || 0, alive: f.alive ? 1 : 0 } : null; }
        if (!r) continue;
        if (rows.length && rows[rows.length - 1].day === day) rows[rows.length - 1] = r; else rows.push(r);
        if (rows.length > 600) rows.shift();
        pinRows.set(key, rows);
      }
    }
    /* What a pin is, now, in a line's worth of values. */
    function pinState(pin) {
      const w = world, key = pin.k + pin.id, out = { k: pin.k, id: pin.id, rows: pinRows.get(key) || [], news: (pinNews.get(key) || []).slice(-30) };
      if (pin.k === "p" || pin.k === "h") {
        const p = w.byId.get(pin.id);
        if (!p) { out.gone = true; out.name = (names.get(key) || [""])[0]; return out; }
        out.name = pin.k === "h" ? "The household of " + p.name : p.name;
        out.hungry = pin.k === "h" ? members(pin.id).filter(q => q.hungry > 0).length : p.hungry > 0 ? 1 : 0;
        out.sick = p.sick > 0; out.activity = w.activity(p); out.age = p.age; out.home = w.villages[p.home].name;
      } else if (pin.k === "v") {
        const v = w.villages[pin.id]; if (!v) return out;
        Object.assign(out, { name: v.name, pop: v.pop || 0, hungry: v.hungry || 0, sick: v.sick || 0, store: w.storeDays(v), alive: v.alive, siege: v.siege > 0, f: v.f });
      } else {
        const f = w.factions[pin.id]; if (!f) return out;
        Object.assign(out, { name: f.name, pop: f.pop || 0, loyal: f.loyal, alive: f.alive, soldiers: f.soldiers || 0, f: f.id });
      }
      return out;
    }
    /* What is going wrong now (TODO 21f): only states the engine holds, by its own lines where it has
       one — a famine is the engine's own (over 40% of more than eight going hungry, `note("famine")`). */
    function problems() {
      const w = world, out = [];
      for (const v of w.villages) {
        if (!v.alive) continue;
        if (v.hungry > v.pop * 0.4 && v.pop > 8) out.push({ kind: "famine", v: v.id, name: v.name, f: v.f, x: v.x, y: v.y, hungry: v.hungry, pop: v.pop, store: w.storeDays(v), price: v.priceFood });
        if (v.siege > 0) out.push({ kind: "siege", v: v.id, name: v.name, f: v.f, x: v.x, y: v.y });
        if (v.sick >= 3 && v.sick >= v.pop * 0.1) out.push({ kind: "sick", v: v.id, name: v.name, f: v.f, x: v.x, y: v.y, sick: v.sick, pop: v.pop });
      }
      const fs = w.factions;
      for (const f of fs) if (f.alive) for (const o of fs) if (o.alive && o.id > f.id && f.rel[o.id] && f.rel[o.id].war) {
        const at = w.villages.find(v => v.alive && v.f === f.id) || { x: 0, y: 0 };
        out.push({ kind: "war", a: f.id, b: o.id, an: f.name, bn: o.name, x: at.x, y: at.y });
      }
      return out;
    }

    /* ── the side panel ────────────────────────────────────────────────────
       What the tab being shown needs, as plain values. The page keeps the
       wording; this keeps the reading. */
    const collate = (typeof Intl !== "undefined" && Intl.Collator) ? new Intl.Collator().compare : (a, b) => a.localeCompare(b);
    function byName() {
      const P = world.people, sig = P.length + ":" + (P.length ? P[P.length - 1].id : 0);
      /* Names never change and ids only climb, so the order is good until
         somebody is born or dies. */
      if (sig !== sortedSig) { sorted = P.slice().sort((a, b) => collate(a.name, b.name) || a.id - b.id); sortedSig = sig; }
      return sorted;
    }
    /* A faction, short (21a: people, leader, wars and allies, loyalty), with what it knows and why a
       thing it knows of is not in use — only what `techView` records: held, forbidden, nothing here
       to make it with, still learning, or within reach. Never a reason or a date the engine did not keep. */
    function factionLook(f, name) {
      const w = world, lead = w.byId.get(f.leader);
      const rel = []; for (const o of w.factions) if (o !== f && o.alive && f.rel[o.id]) { const r = f.rel[o.id]; if (r.war || r.ally || r.trade || r.pays || r.wed) rel.push({ id: o.id, name: o.name, war: !!r.war, ally: !!r.ally, trade: !!r.trade, pays: !!r.pays, wed: !!r.wed }); }
      const own = w.villages.filter(v => v.alive && v.f === f.id);
      return { id: f.id, name: f.name, alive: f.alive, pop: f.pop || 0, soldiers: f.soldiers || 0, loyal: f.loyal, rule: f.rule, lead: lead ? { id: lead.id, name: (name(lead.id), lead.name), age: lead.age } : null,
               villages: own.map(v => ({ id: v.id, name: v.name, pop: v.pop || 0 })), rel: rel, tax: f.tax, treasury: f.treasury, yours: !!f.yours,
               faith: f.faith != null && w.faiths ? w.faithOf(f.faith) : null, gov: w.govOf ? w.govOf(f) : null, tech: w.techView ? w.techView(f.id) : null, land: f.land };
    }
    /* Anything else drawn on the map (TODO 21e): a house, another building or a ruin, a field, a
       road, a boat, a unit of an army, a news item. What it is, whose, what is in it. */
    function thingLook(pick, name) {
      const w = world;
      const whose = vid => { const v = w.villages[vid]; return v ? { v: v.id, village: v.name, f: v.f, faction: w.factions[v.f].name } : null; };
      if (pick.house != null) {
        const h = w.homes[pick.house]; if (!h) return { kind: "gone" };
        const inside = []; for (const p of w.people) if (p.dwelling === pick.house) { inside.push(p.id); name(p.id); }
        const owner = h.owner && w.byId.get(h.owner);
        if (owner) name(owner.id);
        let fields = 0; if (w.held) for (const hid of w.held.values()) if (hid === pick.house) fields++;
        return Object.assign({ kind: "house", id: pick.house, built: !!h.built, burned: h.burned > -1e9 && !h.built, stage: h.stage || 0, stone: !!h.stone, len: h.len, wid: h.wid,
                               progress: h.built ? 1 : Math.min(1, (h.work + h.goodsIn * 8) / Math.max(1, h.need + h.goodsNeed * 8)), owner: owner ? owner.id : 0, inside: inside, fields: fields }, whose(h.v));
      }
      if (pick.building != null) {
        const b = w.buildings()[pick.building]; if (!b) return { kind: "gone" };
        return Object.assign({ kind: "building", what: b.kind, stage: b.stage, stone: !!b.stone, len: b.len, wid: b.wid }, whose(b.v));
      }
      if (pick.field != null) {
        const i = pick.field, hid = w.held ? w.held.get(i) : undefined, h = hid != null ? w.homes[hid] : null, owner = h && h.owner && w.byId.get(h.owner);
        if (owner) name(owner.id);
        const f = w.fert[i];
        return Object.assign({ kind: "field", tile: i, house: hid != null ? hid : -1, owner: owner ? owner.id : 0, fert: f, crop: f > 0 ? Math.min(1, w.stock[i] / (f * w.tileCapacity)) : 0, ground: w.ground[i] }, w.owner[i] >= 0 ? whose(w.owner[i]) : {});
      }
      if (pick.road != null) { const i = pick.road; return Object.assign({ kind: "road", tile: i, road: w.track ? w.track[i] : 0 }, w.owner[i] >= 0 ? whose(w.owner[i]) : {}); }
      if (pick.boat != null) { const v = w.villages[pick.boat]; return Object.assign({ kind: "boat", alive: !!(v && v.boat) }, whose(pick.boat)); }
      /* TODO 22b: a camp outside a place an army marches on, a shell, bomb or mine in the ground, a ditch. */
      if (pick.camp) {
        const c = (w.mapCamps ? w.mapCamps() : []).find(c => c.f === pick.camp[0] && c.o === pick.camp[1]), f = w.factions[pick.camp[0]];
        if (!c) return { kind: "camp", gone: true, f: f.id, faction: f.name };
        const g = w.villages[c.goal];
        return { kind: "camp", f: f.id, faction: f.name, n: c.n, goal: g ? g.name : "", against: w.factions[c.o] ? w.factions[c.o].name : "", x: c.x, y: c.y };
      }
      if (pick.left) {
        const e = (w.left ? w.left() : []).find(e => e.x === pick.left[0] && e.y === pick.left[1]);
        if (!e) return { kind: "left", gone: true };
        return { kind: "left", what: e.kind, by: w.factions[e.f] ? w.factions[e.f].name : "", days: (w.tick - e.at) / 24, x: e.x, y: e.y };
      }
      if (pick.pond != null) { const i = pick.pond; return Object.assign({ kind: "pond", tile: i, across: Math.round(pondR(w.pond[i]) * 2 * 250) }, w.owner[i] >= 0 ? whose(w.owner[i]) : {}); }
      if (pick.ditch != null) { const v = w.villages[pick.ditch]; if (!v || !v.ditch) return { kind: "ditch", gone: true }; return Object.assign({ kind: "ditch", silted: !!v.ditch.silted, fields: v.ditch.tiles.length }, whose(v.id)); }
      if (pick.unit) {
        const us = w.units ? w.units() : []; let best = null, bd = 3;
        for (const u of us) { const d = Math.hypot(u.x - pick.unit.x, u.y - pick.unit.y); if (d < bd) { bd = d; best = u; } }
        if (!best) return { kind: "unit", gone: true };
        const f = w.factions[best.f];
        return { kind: "unit", f: best.f, faction: f.name, role: best.role, shape: best.shape, x: best.x, y: best.y,
                 army: Object.entries(f.camp || {}).filter(([k, c]) => c.goal >= 0 && f.rel[k] && f.rel[k].war).map(([k, c]) => ({ at: w.villages[c.v] ? w.villages[c.v].name : "", goal: w.villages[c.goal].name, ready: c.ready, cut: c.cut })) };
      }
      if (pick.event != null) {
        const e = w.eventById(pick.event);
        return e ? Object.assign(slim(e), { kind: "event", ekind: e.kind }) : { kind: "event", gone: true, id: pick.event };
      }
      return { kind: "gone" };
    }
    const gearNames = (w, p) => w.equipment(p).filter(g => g.equipped).map(g => g.name).join(" · ");
    /* Every faction as the panel shows it: the inspector's faction view (TODO 21e) and the
       Overview's peoples read the same thing. */
    function factionsData(m, out, name) {
      const w = world, byId = w.byId;
        out.factions = w.factions.map(f => {
          const lead = byId.get(f.leader), rel = {};
          for (const o of w.factions) if (o !== f && f.rel[o.id]) { const r = f.rel[o.id], b = o.rel[f.id] || {}; rel[o.id] = { war: !!r.war, op: r.op, ally: !!r.ally, trade: !!r.trade, pays: !!r.pays, gets: !!b.pays, wed: !!r.wed }; }
          return { id: f.id, name: f.name, colour: f.colour, alive: f.alive, pop: f.pop, soldiers: f.soldiers, rule: f.rule, tax: f.tax, harvest: f.harvest || 0, loyal: f.loyal, land: f.land,
                   treasury: f.treasury, yours: f.yours ? { tax: f.yours.tax, harvest: f.yours.harvest || 0, army: f.yours.army, relief: f.yours.relief, land: f.yours.land, unfree: f.yours.unfree || "" } : null,
                   gov: w.govOf ? w.govOf(f) : null,   // TODO 15c
                   faith: f.faith != null && w.faiths ? w.faithOf(f.faith) : null,   // TODO 15g
                   match: f.match ? Object.assign({}, f.match) : null,   // TODO 15b
                   know: w.knowOf ? w.knowOf(f) : null,   // TODO 15e
                   tech: w.techView ? w.techView(f.id) : null,   // TODO 15.9i: the research panel
                   era: f.era || "early", arms: w.armsOf ? w.armsOf(f.id).name : "",   // TODO 15d
                   held: f.alive && w.landStage ? w.landStage(f) : 0, lay: f.lay || "",   // TODO 24: how it holds land; TODO 23: how its villages are laid out
                   army: Object.entries(f.camp || {}).filter(([k, c]) => c.goal >= 0 && f.rel[k] && f.rel[k].war).map(([k, c]) => ({ at: w.villages[c.v] ? w.villages[c.v].name : "", goal: w.villages[c.goal].name, ready: c.ready, cut: c.cut })),   // TODO 15h
                   lead: lead ? { name: lead.name, age: lead.age } : null, rel: rel };
        });
        out.villages = w.villages.map(v => ({ id: v.id, name: v.name, alive: v.alive, f: v.f, x: v.x, y: v.y, pop: v.pop, tax: v.tax == null ? null : v.tax,
                                             relief: v.relief == null ? null : v.relief, taxNow: w.taxOf(v) }));
        out.history = w.history.map(r => ({ pop: r.pop }));
        /* Choosing a marriage (TODO 15.5h): every grown-up of the two peoples, the leader and their family
           first, then the unmarried, then by name. Sent only while the chooser is open. */
        const wp = m.wedPick;
        if (wp && w.factions[wp.f] && w.factions[wp.o]) {
          const list = fid => {
            const g = w.factions[fid], lead = byId.get(g.leader);
            const fam = p => lead && (p === lead || p.mum === lead.id || p.dad === lead.id || (lead.mum && p.mum === lead.mum) || (lead.dad && p.dad === lead.dad));
            return w.people.filter(p => p.hp > 0 && p.f === fid && w.adult(p))
              .map(p => ({ id: p.id, name: p.name, age: Math.floor(p.age), wed: !!p.partner, fam: !!fam(p) }))
              .sort((x, y) => (y.fam - x.fam) || (x.wed - y.wed) || x.name.localeCompare(y.name));
          };
          out.wedCands = { f: wp.f, o: wp.o, a: list(wp.f), b: list(wp.o) };
        }
    }
    function pane(m) {
      const w = world, S = w.settings, tab = m.tab, byId = w.byId;
      const out = { t: "pane", tab: tab, seq: m.seq, key: m.key, idle: !!m.idle, money: S.money, war: S.war, harvestTax: S.harvestTax || 0, total: w.people.length };
      const named = {};
      const name = id => { const p = id && byId.get(id); if (p) named[id] = p.name; return !!p; };
      if (m.exchange) { name(m.exchange.a); name(m.exchange.b); }
      if (tab === "people" && !(m.q && m.q.all)) {
        /* "Worth a look" (TODO 21f): the visitor's pins first, then short groups of people with
           something at stake, read in one pass over everybody. Never instead of the visitor's own picks. */
        out.mode = "worth";
        const hungry = [], sick = [], soldiers = [], old = [];
        let nh = 0, ns = 0, nsol = 0;
        for (const p of w.people) {
          if (p.hungry > 0) { nh++; if (hungry.length < 40) hungry.push(p); }
          if (p.sick > 0) { ns++; if (sick.length < 40) sick.push(p); }
          if (p.job === "soldier") { const h = w.villages[p.home]; if (h && Math.hypot(p.x - h.x, p.y - h.y) > 6) { nsol++; if (soldiers.length < 40) soldiers.push(p); } }
          if (old.length < 3 || p.age > old[old.length - 1].age) { old.push(p); old.sort((a, b) => b.age - a.age); if (old.length > 3) old.pop(); }
        }
        hungry.sort((a, b) => a.food - b.food);
        const row = p => ({ id: p.id, name: p.name, age: p.age, job: p.job, home: w.villages[p.home].name, f: p.f, activity: w.activity(p), hungry: p.hungry > 0, sick: p.sick > 0 });
        const leaders = w.factions.filter(f => f.alive).map(f => byId.get(f.leader)).filter(Boolean);
        out.groups = [
          { key: "hungry", title: "Going hungry", count: nh, rows: hungry.slice(0, 6).map(row) },
          { key: "sick", title: "Sick", count: ns, rows: sick.slice(0, 6).map(row) },
          { key: "leaders", title: "Leading a people", count: leaders.length, rows: leaders.slice(0, 8).map(row) },
          { key: "soldiers", title: "Soldiers away from home", count: nsol, rows: soldiers.slice(0, 6).map(row) },
          { key: "old", title: "The oldest alive", count: old.length, rows: old.map(row) },
        ];
        out.pins = pins.map(pinState);
      } else if (tab === "people") {
        const q = m.q || {}, query = String(q.search || "").trim().toLocaleLowerCase(), settlement = q.settlement, faction = q.faction, job = q.job;
        out.villages = w.villages.map(v => ({ id: v.id, name: v.name, alive: v.alive }));
        out.factions = w.factions.map(f => ({ id: f.id, name: f.name, alive: f.alive }));
        const SIZE = q.size || 60, list = byName().filter(p => byId.get(p.id) === p && p.name.toLocaleLowerCase().includes(query) &&
          (settlement === "" || settlement == null || p.home === +settlement) && (faction === "" || faction == null || p.f === +faction) && (!job || p.job === job));
        out.count = list.length; out.pages = Math.max(1, Math.ceil(list.length / SIZE));
        out.page = Math.min(Math.max(0, q.page | 0), out.pages - 1);
        out.rows = list.slice(out.page * SIZE, out.page * SIZE + SIZE).map(p => ({ id: p.id, name: p.name, age: p.age, job: p.job, home: w.villages[p.home].name,
          faction: w.factions[p.f].name, activity: w.activity(p), gear: gearNames(w, p) }));
      } else if (tab === "factions") {
        factionsData(m, out, name);
      } else if (tab === "news") {
        /* `kind`, `id`, `f` and the day were always on the event; the pane used to drop them (TODO 21f). */
        out.events = w.events.slice(-120).reverse().map(slim);
        out.problems = problems();
        if (m.q && m.q.talk) { out.chatter = w.chatter.slice(-40).reverse(); for (const c of out.chatter) { name(c.a); name(c.b); } }   // after: the chain that led to it (TODO 15.12e)   // why: the numbers the decision was made on (2026-11-23)
      } else if (tab === "talk") {
        out.chatter = w.chatter.slice(-40).reverse();
        for (const c of out.chatter) { name(c.a); name(c.b); }
      } else if (tab === "look") {
        const pick = m.picked || {};
        if (pick.village != null && w.villages[pick.village]) {
          const v = w.villages[pick.village], f = w.factions[v.f];
          out.pinned = pins.some(x => x.k === "v" && x.id === v.id);
          out.village = { id: v.id, name: v.name, f: v.f, alive: v.alive, place: v.place || "village", wall: v.wall || 0, boat: !!v.boat, bridge: !!v.bridge, well: !!v.well, pop: v.pop, hungry: v.hungry, sick: v.sick, food: v.food, goods: v.goods, wanted: v.wanted, wood: v.wood, stone: v.stone, iron: v.iron, wool: v.wool, hide: v.hide, mats: w.settings.materials !== "goods",
                          priceFood: v.priceFood, till: v.till, loyal: v.loyal, founded: v.founded, siege: v.siege, storeDays: w.storeDays(v),
                          faction: { id: f.id, name: f.name, colour: f.colour } };
        } else if (pick.faction != null && w.factions[pick.faction]) {
          out.faction = factionLook(w.factions[pick.faction], name);
          factionsData(m, out, name);
          out.pinned = pins.some(x => x.k === "f" && x.id === pick.faction);
        } else if (pick.house != null || pick.building != null || pick.field != null || pick.road != null || pick.boat != null || pick.unit || pick.event != null || pick.camp || pick.left || pick.ditch != null || pick.pond != null) {
          out.thing = thingLook(pick, name);
        } else {
          const p = pick.person ? byId.get(pick.person) : null;
          if (p) {
            const f = w.factions[p.f], home = w.villages[p.home];
            const children = [], house = [];
            /* One pass for children and for who shares the house (TODO 21e): a household view
               must not add a second walk through everybody. */
            for (const q of w.people) {
              if (q.mum === p.id || q.dad === p.id) { children.push(q.id); named[q.id] = q.name; }
              if (p.dwelling >= 0 && q.dwelling === p.dwelling && q !== p) { house.push(q); named[q.id] = q.name; }
            }
            const friends = w.tiesOf(p).filter(x => name(x[0]));
            name(p.partner); name(p.mum); name(p.dad);
            const other = p.sayT > 0 && byId.get(p.talkingTo);
            out.person = {
              id: p.id, name: p.name, age: p.age, job: p.job, f: p.f, from: p.from, partner: p.partner, mum: p.mum, dad: p.dad, kids: p.kids,
              food: p.food, coins: p.coins, goods: p.goods, mood: p.mood, loyal: p.loyal, bold: p.bold, warm: p.warm, stub: p.stub, greed: p.greed, patient: p.patient, temper: p.temper, hard: p.hard, curious: p.curious, honest: p.honest,
              rest: p.rest, alone: p.alone, fear: p.fear, hungry: p.hungry, sick: p.sick, say: p.say,
              faith: p.faith != null && w.faiths ? w.faithOf(p.faith) : null, unfree: !!p.unfree,   // TODO 15g, 15c
              life: w.lifeOf ? w.lifeOf(p) : null,   // TODO 15.11b, 15.12c to e
              cargo: p.cargo ? { what: p.cargo.what, amount: p.cargo.amount } : null,
              friends: friends, mind: w.inMind(p), mcap: p.mcap, children: children, listener: other && other.sayT > 0 && other.talkingTo === p.id ? other.id : 0,
              activity: w.activity(p), adult: w.adult(p), leans: w.leans(p), dailyNeed: w.dailyNeed(p), urgency: w.urgency(p),
              equipment: w.equipment(p), tradeCapacity: w.tradeCapacity(p), leads: f.leader === p.id,
              home: { id: home.id, name: home.name }, faction: { id: f.id, name: f.name, colour: f.colour }, bornUnder: w.factions[p.from].name,
              /* The household (TODO 21e): who shares the house, one purse and one pot — what the
                 engine holds now. Budgets over time are not kept (a new item, asked first). */
              household: (() => {
                const mem = members(p.id), all = new Map(); for (const q of mem.concat(house)) all.set(q.id, q);
                let coins = 0, food = 0, hungry = 0; for (const q of all.values()) { coins += q.coins; food += q.food; if (q.hungry > 0) hungry++; named[q.id] = q.name; }
                const h = p.dwelling >= 0 ? w.homes[p.dwelling] : null;
                let fields = 0; if (p.dwelling >= 0 && w.held) for (const hid of w.held.values()) if (hid === p.dwelling) fields++;
                return { ids: [...all.keys()], coins: coins, food: food, hungry: hungry, fields: fields, house: h ? { id: p.dwelling, built: !!h.built, stage: h.stage || 0 } : null };
              })(),
              pinNews: (pinNews.get("p" + p.id) || []).slice(-30),
              pinned: pins.some(x => x.k === "p" && x.id === p.id), pinnedHouse: pins.some(x => x.k === "h" && x.id === p.id),
            };
            if (other) named[other.id] = other.name;
          }
        }
      } else if (tab === "world" || tab === "rules") {
        /* Overview (TODO 21f) and the Rules drawer (TODO 21g). Counts are sent flat, every one the
           engine keeps (`stats()`, 400 and more), so the page can say which moved since it last looked. */
        let need = 0, stores = 0;
        for (const p of w.people) need += w.dailyNeed(p);
        for (const v of w.villages) stores += v.food;
        const st = w.stats(), flat = {};
        for (const k in st) if (typeof st[k] === "number" && Number.isFinite(st[k])) flat[k] = st[k];
        out.stats = flat; out.need = need; out.stores = stores;
        out.settings = Object.assign({}, S); out.start = startS; out.actions = actions.slice(-200);
        if (tab === "world") {
          out.history = w.history.slice(); out.problems = problems(); out.firsts = firsts.slice();
          out.events = w.events.slice(-120).reverse().map(slim);
          let oldest = null; for (const p of w.people) if (!oldest || p.age > oldest.age) oldest = p;
          out.oldest = oldest ? { id: oldest.id, name: oldest.name, age: oldest.age } : null;
          out.pins = pins.map(pinState);
          out.factions = w.factions.map(f => ({ id: f.id, name: f.name, alive: f.alive, pop: f.pop || 0 }));
        }
      }
      out.named = named;
      send(out);
    }

    /* Who or what is under a tap. */
    /* Who or what is under a tap (TODO 21e): a person, a village, a unit of an army, a boat, a house,
       another building, a held field, a road, and last the land, which opens the people who hold it.
       Read-only, and only what the page draws. */
    function at(m) {
      const w = world, x = m.x, y = m.y, hit = w.at(x, y, m.r), reply = { t: "at", seq: m.seq, person: null, village: null, thing: null };
      /* The engine gives a village everything within 1.4 squares; close in, where its houses and
         fields are drawn, that would make them untappable, so a village answers only as near as
         its marker reaches at this zoom. */
      if (hit && hit.person) reply.person = { id: hit.person.id, name: hit.person.name };
      else if (hit && hit.village && Math.hypot(hit.village.x - x, hit.village.y - y) <= Math.max(0.15, m.r)) reply.village = { id: hit.village.id };
      else {
        const inRect = (cx, cy, len, wid, ang, pad) => { const dx = x - cx, dy = y - cy, c = Math.cos(-ang), s2 = Math.sin(-ang), u = dx * c - dy * s2, v = dx * s2 + dy * c; return Math.abs(u) <= len / 2 + pad && Math.abs(v) <= wid / 2 + pad; };
        const pad = Math.min(0.3, m.r * 0.3);
        if (m.units && w.units) { for (const u of w.units()) if (Math.hypot(u.x - x, u.y - y) < Math.max(0.3, m.r)) { reply.thing = { unit: { x: u.x, y: u.y } }; break; } }
        /* TODO 22b: a camp, what war left in the ground, a ditch. */
        if (!reply.thing && w.mapCamps) for (const c of w.mapCamps()) if (Math.hypot(c.x - x, c.y - y) < Math.max(0.6, m.r)) { reply.thing = { camp: [c.f, c.o] }; break; }
        if (!reply.thing && w.left) { const L = w.left(); for (let i = 0; i < L.length; i++) if (Math.hypot(L[i].x - x, L[i].y - y) < Math.max(0.05, m.r * 0.6)) { reply.thing = { left: [L[i].x, L[i].y] }; break; } }
        if (!reply.thing) for (const v of w.villages) {
          if (!v.alive || !v.ditch) continue;
          const ax = v.ditch.at % w.cols + 0.5, ay = Math.floor(v.ditch.at / w.cols) + 0.5, dx = v.x - ax, dy = v.y - ay, L2 = dx * dx + dy * dy || 1;
          const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
          if (Math.hypot(x - (ax + u * dx), y - (ay + u * dy)) < Math.max(0.06, m.r * 0.5) && Math.hypot(x - v.x, y - v.y) > v.radius * 0.5) { reply.thing = { ditch: v.id }; break; }
        }
        if (!reply.thing) for (const v of w.villages) if (v.alive && v.boat && Math.hypot(v.boat.x - x, v.boat.y - y) < Math.max(0.15, m.r * 0.6)) { reply.thing = { boat: v.id }; break; }
        if (!reply.thing) for (let i = 0; i < w.homes.length; i++) { const h = w.homes[i]; if (inRect(h.x, h.y, h.len, h.wid, h.ang, pad)) { reply.thing = { house: i }; break; } }
        if (!reply.thing) { const bl = w.buildings(); for (let i = 0; i < bl.length; i++) { const b = bl[i]; if (inRect(b.x, b.y, b.len, b.wid, b.ang, pad)) { reply.thing = { building: i }; break; } } }
        const tx = Math.floor(x), ty = Math.floor(y);
        if (!reply.thing && tx >= 0 && ty >= 0 && tx < w.cols && ty < w.rows) {
          const i = ty * w.cols + tx;
          /* A pond (2026-11-27), where the page draws it: within its size of the point the seed puts it at. */
          if (w.pond && w.pond[i]) { const c = pondAt(i, w.cols, w.settings.seed), r = pondR(w.pond[i]); if (Math.hypot(x - c[0], y - c[1]) < r + Math.min(0.05, m.r * 0.3)) reply.thing = { pond: i }; }
          if (reply.thing) {}
          else           if (w.held && w.held.has(i)) reply.thing = { field: i };
          else if (w.track && w.track[i] === 2) reply.thing = { road: i };
          else if (w.owner[i] >= 0 && w.villages[w.owner[i]]) reply.thing = { faction: w.villages[w.owner[i]].f };
          else if (w.realm && w.realm[i] >= 0) reply.thing = { faction: w.realm[i] };   // TODO 24: a people's land outside its villages
        }
      }
      send(reply);
    }

    /* The watcher's own decisions, passed to the doors the engine has for
       them. Each reads what stands now and moves it one notch, here, so the
       page's picture being a moment old can never set a stale value. */
    /* Every change the visitor makes is written down with its moment, what it applied to and the
       value before and after (TODO 21g): the graphs mark it, and it is the one record of changes a
       save will carry (item 19, 21h) — there is not a second one. */
    function stateFor(what, a) {
      const w = world, f = w.factions[a[0]], v = w.villages[a[0]];
      if (what === "set") return w.settings[a[0]];
      if (["vtax", "vrelief", "vreset"].includes(what) && v) return what === "vrelief" ? v.relief : w.taxOf(v);
      if (!f) return null;
      if (what === "rule") return !!f.yours;
      if (f.yours && ({ ftax: "tax", fharvest: "harvest", army: "army", relief: "relief", land: "land", unfree: "unfree" })[what]) return f.yours[{ ftax: "tax", fharvest: "harvest", army: "army", relief: "relief", land: "land", unfree: "unfree" }[what]];
      if (["war", "peace", "ally", "trade", "tribute", "stop", "wed"].includes(what) && w.factions[a[1]]) { const r = f.rel[a[1]] || {}; return r.war ? "war" : r.ally ? "allied" : "peace"; }
      return null;
    }
    function act(m) {
      const w = world, a = m.a || [], what = m.what;
      const before = stateFor(what, a);
      try { return actNow(m); }
      finally {
        const f = w.factions[a[0]], v = w.villages[a[0]];
        actions.push({ day: w.days, what: what, key: what === "set" ? a[0] : "", on: what === "set" ? "world" : ["vtax", "vrelief", "vreset"].includes(what) ? (v ? v.name : "") : f ? f.name : "",
                       other: ["war", "peace", "ally", "trade", "tribute", "stop", "wed"].includes(what) && w.factions[a[1]] ? w.factions[a[1]].name : "", from: before, to: stateFor(what, a) });
        if (actions.length > 2000) actions.shift();
      }
    }
    function actNow(m) {
      const w = world, a = m.a || [], what = m.what;
      let msg = "";
      frameKey = "";                                 // whatever is done, the next frame is a new one
      const f = w.factions[a[0]], v = w.villages[a[0]];
      if (what === "rule" && f) w.rule(f.id, !f.yours);
      else if (what === "ftax" && f && f.yours) w.order(f.id, { tax: f.yours.tax + 0.02 * a[1] });
      else if (what === "fharvest" && f && f.yours) w.order(f.id, { harvest: (f.yours.harvest || 0) + 0.02 * a[1] });   // TODO 15.5t
      else if (what === "army" && f && f.yours) w.order(f.id, { army: f.yours.army + 0.02 * a[1] });
      else if (what === "relief" && f && f.yours) w.order(f.id, { relief: !f.yours.relief });
      else if (what === "land" && f && f.yours) w.order(f.id, { land: { family: "village", village: "leader", leader: "commune", commune: "family" }[f.yours.land] || "family" });
      else if (what === "unfree" && f && f.yours) w.order(f.id, { unfree: { keep: "free", free: "forbid", forbid: "keep" }[f.yours.unfree] || "keep" });   // TODO 15c
      else if (what === "vtax" && v) w.orderVillage(v.id, { tax: w.taxOf(v) + 0.02 * a[1] });
      else if (what === "vrelief" && v) w.orderVillage(v.id, { relief: v.relief == null ? true : v.relief ? false : null });
      else if (what === "vreset" && v) w.orderVillage(v.id, { tax: null, relief: null });
      else if (["war", "peace", "ally", "trade", "tribute", "stop"].includes(what) && f && w.factions[a[1]]) {
        const r = w.declare(a[0], a[1], what), o = w.factions[a[1]];
        msg = r === "refused" && what === "peace" ? o.name + " refused. Peace takes two: they want it once the war has cost them, or when they are badly outmatched."
            : r === "peace" ? "Peace with " + o.name + "." : r === "war" ? "At war with " + o.name + "."
            : r === "ally" ? "Allied with " + o.name + "." : r === "unallied" ? "The alliance with " + o.name + " is over."
            : r === "refused-ally" ? o.name + " refused. They ally only with a people they think well of."
            : r === "trade" ? "Trading free of tax with " + o.name + "." : r === "untraded" ? "The trade deal with " + o.name + " is over."
            : r === "refused-trade" ? o.name + " refused. They make a trade deal only where there is trade between you already, and with a people they do not dislike."
            : r === "paid" ? o.name + " will pay tribute." : r === "refused" && what === "tribute" ? o.name + " refused to pay, and will not forget being asked."
            : r === "asked" ? "You asked them within the month." : r === "stopped" ? "No more tribute to " + o.name + ". They will not like it." : r;
      } else if (what === "wed" && f && w.factions[a[1]]) {
        /* A marriage the watcher arranges (TODO 15.5h): the two chosen, and no refusal. */
        const r = w.declare(a[0], a[1], "wed", a[2], a[3]), o = w.factions[a[1]], pa = w.byId.get(a[2]), pb = w.byId.get(a[3]);
        msg = r === "wed" ? pa.name + " has married " + pb.name + " of " + o.name + "."
            : r === "wed-peace" ? pa.name + " has married " + pb.name + " of " + o.name + ", and the war is over."
            : r === "kin" ? "They are family to each other."
            : "Choose a grown-up of each people, both alive.";
      } else if (what === "set") w.set(a[0], a[1]);
      send({ t: "did", seq: m.seq, what: what, msg: msg });
    }

    /* ── "what can this computer run" ──────────────────────────────────────
       Not a table of machines and not a guess from how many cores there are:
       the world the visitor has set up is made, quietly, and run for a few
       seconds, and how fast it went is what is reported. It is the same
       engine, the same seed and the same first hours the real world will
       have, so the figure is that world's own. Whole days are measured where
       there is time, because a night costs far less than a day and a part of
       a day would flatter it. And where the first day is over in under a
       second it is not counted: a browser runs fresh code slowly for its
       first moments, which is a large share of so short a run and no part of
       what a world watched for minutes does (measured 2026-11-15: 400 people
       tried over their first three days said 820×, and then ran at 1,100× to
       1,700×).

       `box` is the most seconds to spend running; making the world is timed
       and reported apart ("made"), since a very big one is slow to start
       before it is slow to run. */
    function tryOut(m) {
      world = null; trial = null;
      const t0 = now();
      let w;
      try { w = People.create(m.values); }
      catch (e) { send({ t: "tried", id: m.id, failed: String((e && e.message) || e) }); return; }
      trial = { id: m.id, w: w, sim: 0, wall: 0, sim0: 0, wall0: 0, box: m.box || 3, made: (now() - t0) / 1000, people: w.people.length };
      send({ t: "tried", id: m.id, made: trial.made, people: trial.people });
    }
    function tryMore(budget) {
      const T = trial, DAY = People.DAY_SECONDS, t0 = now();
      let spent = 0;
      for (;;) {
        /* Never across midnight in one piece, so a day's end is seen exactly. */
        const left = DAY - (T.sim % DAY), take = Math.min(SLICE, left > 1e-9 ? left : DAY);
        T.w.advance(take, true); T.sim += take;
        spent = (now() - t0) / 1000;
        const wall = T.wall + spent, whole = T.sim % DAY < 1e-9 || DAY - (T.sim % DAY) < 1e-9;
        /* The first day, when it was a short one, is the warming-up. */
        if (whole && !T.sim0 && T.sim < DAY * 1.5 && wall < 1) { T.sim0 = T.sim; T.wall0 = wall; }
        if (wall >= T.box || (whole && wall - T.wall0 >= 1)) {
          trial = null;
          const counted = wall - T.wall0 >= 0.05;
          send({ t: "tried", id: T.id, done: true, made: T.made, people: T.people, days: T.sim / DAY, wall: wall,
                 speed: counted ? (T.sim - T.sim0) / (wall - T.wall0) : T.sim / Math.max(wall, 1e-6) });
          return false;
        }
        if (spent * 1000 >= budget) break;
      }
      T.wall += spent;
      return true;
    }

    return { receive: receive, run: run, get idle() { return !trial && (!world || paused); },
             /* For the tests, which hold this world equal to the engine's own. */
             get world() { return world; } };
  }

  /* Inside a worker: messages in, and a loop of its own. While the world is
     running flat out the loop comes round again at once, through a message
     to itself rather than a timer (a timer waits four milliseconds a turn,
     which at these speeds is a quarter of the time); otherwise it looks in a
     hundred and twenty times a second, and five times a second when there is
     nothing to run at all. The page's messages are taken between turns. */
  function worker(scope, People) {
    const host = create(People, (m, transfer) => scope.postMessage(m, transfer || []));
    const again = new MessageChannel();
    let last = now(), timer = 0, queued = false;
    function turn() {
      queued = false; timer = 0;
      const t = now(), real = (t - last) / 1000; last = t;
      if (host.run(real, 10)) { queued = true; again.port2.postMessage(0); }
      else timer = setTimeout(turn, host.idle ? 200 : 8);
    }
    again.port1.onmessage = turn;
    scope.onmessage = e => {
      const was = host.idle;
      host.receive(e.data);
      /* Something to run where there was nothing: start now, from now. */
      if (was && !host.idle && !queued) { clearTimeout(timer); last = now(); queued = true; again.port2.postMessage(0); }
    };
    turn();
  }

  return { create: create, worker: worker, FLAG: FLAG, GEAR: GEAR, pondAt: pondAt, pondR: pondR };
});
