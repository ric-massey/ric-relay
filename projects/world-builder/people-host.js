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
    /* Scratch the frames are filled into; what is sent is a copy cut to size,
       so a buffer handed across to the page is never one this still holds. */
    let cap = 0, X = null, Y = null, T = null, F = null, G = null, L = null;
    function room(n) {
      if (n <= cap) return;
      cap = Math.max(1024, Math.ceil(n * 1.25));
      X = new Float32Array(cap); Y = new Float32Array(cap); T = new Uint16Array(cap);
      F = new Uint8Array(cap); G = new Uint8Array(cap); L = new Float32Array(cap * 2);
    }

    function receive(m) {
      if (!m || typeof m !== "object") return;
      if (m.t === "start") return start(m);
      if (m.t === "try") return tryOut(m);
      if (m.t === "hello") return send({ t: "hello" });
      if (m.t === "clock") {
        if ("rate" in m) rate = +m.rate || 1;
        if ("paused" in m) paused = !!m.paused;
        simAcc = wallAcc = 0; speed = 0;
        return;
      }
      if (!world) return;
      if (m.t === "frame") return frame(m);
      if (m.t === "pane") return pane(m);
      if (m.t === "at") return at(m);
      if (m.t === "do") return act(m);
    }

    function start(m) {
      world = null; trial = null; vsSig = fsSig = ""; sorted = null; sortedSig = ""; frameKey = "";
      landFull = landStock = sentOwner = null; sentAt = -1;
      const t0 = now();
      let w;
      try { w = People.create(m.values); }
      catch (e) { send({ t: "failed", why: String((e && e.message) || e) }); return; }
      world = w;
      rate = +w.settings.rate || 1; paused = false; simAcc = wallAcc = 0; speed = 0; maxSim = maxWall = 0;
      const fert = w.fert.slice(), ore = w.ore.slice(), ground = w.ground.slice(), shade = hillShade(w), riverTo = w.riverTo.slice();
      /* Big rivers and their fords (TODO 6d); bridges come with the villages. */
      const cross = w.cross ? w.cross.slice() : null;
      send({ t: "started", cols: w.cols, rows: w.rows, tileCapacity: w.tileCapacity, YEAR: w.YEAR, fert: fert, ore: ore, ground: ground, shade: shade, riverTo: riverTo, cross: cross,
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
      if (rate <= 16) { done = owed * rate; world.advance(done, true); }
      else {
        const want = rate >= 1000 ? Infinity : owed * rate;
        while (done < want) {
          const take = Math.min(SLICE, want - done);
          world.advance(take, true); done += take;
          if (now() - t0 >= budget) { more = done < want; break; }
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
    function tint(p, view) {
      if (view === "faction") return p.f;
      if (view === "mood") return Math.min(23, Math.max(0, Math.round(p.mood * 23)));
      if (view === "views") { const x = w.viewOf(p); return x > 0.25 ? 2 : x < -0.25 ? 1 : 0; }
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
      const key = [cam.x, cam.y, s, cam.w, cam.h, m.view, m.picked || 0, m.follow ? 1 : 0, m.pair ? m.pair.join("+") : "", w.sceneTick].join("|");
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
        if (close && w.activity(p) === "Harvesting") fl |= FLAG.harvesting;
        X[k] = px; Y[k] = py; T[k] = tint(p, view); F[k] = fl; G[k] = closer ? gearOf(w, p) : 0;
        if (seen) {
          if (p.id === pickedId) pickedLabel = { k: k, p: p };
          else if (s >= 28 && (focused ? focused.sayT > 0 && p.id === focused.talkingTo : labels.length < 12)) labels.push({ k: k, p: p });
          if (closer && (fl & FLAG.speaking)) talking.push({ k: k, p: p });
        }
        k++;
      }
      if (pickedLabel) labels.unshift(pickedLabel);
      const out = { t: "frame", n: n, k: k, x: X.slice(0, k), y: Y.slice(0, k), tint: T.slice(0, k), flags: F.slice(0, k), gear: G.slice(0, k),
                    links: L.slice(0, links), view: view,
                    labels: labels.slice(0, focused ? 2 : 12).map(r => ({ k: r.k, text: r.p.job + " · " + w.activity(r.p) })),
                    speech: null, picked: null, pair: null, moves: null, marks: null, vs: null, fs: null, land: null,
                    days: w.days, season: w.season().name || "", sceneTick: w.sceneTick, speed: speed, rate: rate, paused: paused, cost: 0,
                    held: held(), heldFor: maxWall };
      /* What is being said, nearest the middle first; the page shows four. */
      if (closer) {
        if (focused) out.speech = talking.filter(r => r.p.id === focused.id || (focused.sayT > 0 && r.p.id === focused.talkingTo));
        else { talking.sort((a, b) => Math.hypot(a.p.x - cam.x, a.p.y - cam.y) - Math.hypot(b.p.x - cam.x, b.p.y - cam.y)); out.speech = talking.slice(0, 4); }
        out.speech = out.speech.map(r => { const q = byId.get(r.p.talkingTo); return { k: r.k, text: r.p.name + (q ? " → " + q.name : "") + ": " + r.p.say }; });
      }
      if (pickedId) { const p = byId.get(pickedId); out.picked = p ? { id: p.id, x: p.x, y: p.y, name: p.name } : { id: pickedId, gone: true }; }
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
      /* Villages and factions are sent whole, but only when something the map
         shows of them has changed. */
      let sig = w.villages.length + "|";
      /* How many live there, to the nearest five: the houses drawn round a village follow it (TODO 5). */
      for (const v of w.villages) sig += v.f + (v.alive ? "a" : "d") + (v.siege > 0 ? "s" : "") + Math.round((v.pop || 0) / 5) + (v.well ? "w" : "") + (v.bridge ? "b" : "") + (v.boat ? "o" : "") + (v.place || "village")[0] + Math.round((v.wall || 0) * 4);
      sig += "|" + w.homes.length;
      for (const h of w.homes) if (!h.built) sig += "," + h.id + (h.burned > -1e9 && h.work === 0 && h.goodsIn === 0 ? "x" : "") + ":" + Math.floor((h.work + h.goodsIn * 8) / Math.max(1, h.need + h.goodsNeed * 8) * 4);
      sig += "|" + w.homes.reduce((n, h) => n + (h.built ? 1 : 0), 0);
      if (m.fresh || sig !== vsSig) {
        vsSig = sig; out.vs = w.villages.map(v => ({ id: v.id, name: v.name, x: v.x, y: v.y, f: v.f, alive: v.alive, siege: v.siege > 0, pop: v.pop || 0, well: v.well ? [v.well.x, v.well.y] : null,
          bridge: v.bridge ? [v.bridge.x, v.bridge.y] : null, boat: v.boat ? [v.boat.x, v.boat.y] : null, place: v.place || "village", wall: Math.round((v.wall || 0) * 4) / 4, r: v.radius }));
        /* The houses, with the villages (TODO 7a): where, how long and wide, which way, and whose. */
        /* And how far built (TODO 7b): 1 a finished house, less a building site. */
        const H = new Float32Array(w.homes.length * 7);
        w.homes.forEach((h, k) => { H[k * 7] = h.x; H[k * 7 + 1] = h.y; H[k * 7 + 2] = h.len; H[k * 7 + 3] = h.wid; H[k * 7 + 4] = h.ang; H[k * 7 + 5] = h.v;
          /* -1: burned, and nobody has started on it again yet (TODO 14b). */
          H[k * 7 + 6] = h.built ? 1 : h.burned > -1e9 && h.work === 0 && h.goodsIn === 0 ? -1 : Math.min(0.95, (h.work + h.goodsIn * 8) / Math.max(1, h.need + h.goodsNeed * 8)); });
        out.homes = H;
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
      const transfer = [out.x.buffer, out.y.buffer, out.tint.buffer, out.flags.buffer, out.gear.buffer, out.links.buffer];
      if (wantLand) {
        const tiles = w.cols * w.rows, fert = w.fert, stock = w.stock, capOf = w.tileCapacity;
        if (!landFull || landFull.length !== tiles) { landFull = new Uint8Array(tiles); landStock = null; }
        const full = landFull, own = w.owner, cols = w.cols, rows = w.rows, bits = new Int32Array(stock.buffer, stock.byteOffset, tiles);
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
          const send1 = full.slice(), owner = own.slice();
          out.land = { full: send1, owner: owner, at: w.sceneTick };
          transfer.push(send1.buffer, owner.buffer);
        }
        sentAt = w.sceneTick;
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
      const cols = w.cols, rows = w.rows, owner = w.owner, B = LAND_BLOCK, bc = Math.ceil(cols / B);
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
    const gearNames = (w, p) => w.equipment(p).filter(g => g.equipped).map(g => g.name).join(" · ");
    function pane(m) {
      const w = world, S = w.settings, tab = m.tab, byId = w.byId;
      const out = { t: "pane", tab: tab, seq: m.seq, key: m.key, idle: !!m.idle, money: S.money, war: S.war, harvestTax: S.harvestTax || 0, total: w.people.length };
      const named = {};
      const name = id => { const p = id && byId.get(id); if (p) named[id] = p.name; return !!p; };
      if (m.exchange) { name(m.exchange.a); name(m.exchange.b); }
      if (tab === "people") {
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
        out.factions = w.factions.map(f => {
          const lead = byId.get(f.leader), rel = {};
          for (const o of w.factions) if (o !== f && f.rel[o.id]) { const r = f.rel[o.id], b = o.rel[f.id] || {}; rel[o.id] = { war: !!r.war, op: r.op, ally: !!r.ally, trade: !!r.trade, pays: !!r.pays, gets: !!b.pays, wed: !!r.wed }; }
          return { id: f.id, name: f.name, colour: f.colour, alive: f.alive, pop: f.pop, soldiers: f.soldiers, rule: f.rule, tax: f.tax, harvest: f.harvest || 0, loyal: f.loyal, land: f.land,
                   treasury: f.treasury, yours: f.yours ? { tax: f.yours.tax, harvest: f.yours.harvest || 0, army: f.yours.army, relief: f.yours.relief, land: f.yours.land } : null,
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
      } else if (tab === "news") {
        out.events = w.events.slice(-80).reverse().map(e => ({ weight: e.weight, x: e.x, y: e.y, year: e.year, text: e.text }));
      } else if (tab === "talk") {
        out.chatter = w.chatter.slice(-40).reverse();
        for (const c of out.chatter) { name(c.a); name(c.b); }
      } else if (tab === "look") {
        const pick = m.picked || {};
        if (pick.village != null && w.villages[pick.village]) {
          const v = w.villages[pick.village], f = w.factions[v.f];
          out.village = { id: v.id, name: v.name, f: v.f, alive: v.alive, pop: v.pop, hungry: v.hungry, sick: v.sick, food: v.food, goods: v.goods, wanted: v.wanted, wood: v.wood, stone: v.stone, iron: v.iron, wool: v.wool, hide: v.hide, mats: w.settings.materials !== "goods",
                          priceFood: v.priceFood, till: v.till, loyal: v.loyal, founded: v.founded, siege: v.siege, storeDays: w.storeDays(v),
                          faction: { name: f.name, colour: f.colour } };
        } else {
          const p = pick.person ? byId.get(pick.person) : null;
          if (p) {
            const f = w.factions[p.f], home = w.villages[p.home];
            const children = [];
            for (const q of w.people) if (q.mum === p.id || q.dad === p.id) { children.push(q.id); named[q.id] = q.name; }
            const friends = w.tiesOf(p).filter(x => name(x[0]));
            name(p.partner); name(p.mum); name(p.dad);
            const other = p.sayT > 0 && byId.get(p.talkingTo);
            out.person = {
              id: p.id, name: p.name, age: p.age, job: p.job, f: p.f, from: p.from, partner: p.partner, mum: p.mum, dad: p.dad, kids: p.kids,
              food: p.food, coins: p.coins, goods: p.goods, mood: p.mood, loyal: p.loyal, bold: p.bold, warm: p.warm, stub: p.stub, greed: p.greed, patient: p.patient, temper: p.temper, hard: p.hard, curious: p.curious, honest: p.honest,
              rest: p.rest, alone: p.alone, fear: p.fear, hungry: p.hungry, sick: p.sick, say: p.say,
              cargo: p.cargo ? { what: p.cargo.what, amount: p.cargo.amount } : null,
              friends: friends, mind: w.inMind(p), mcap: p.mcap, children: children, listener: other && other.sayT > 0 && other.talkingTo === p.id ? other.id : 0,
              activity: w.activity(p), adult: w.adult(p), leans: w.leans(p), dailyNeed: w.dailyNeed(p), urgency: w.urgency(p),
              equipment: w.equipment(p), tradeCapacity: w.tradeCapacity(p), leads: f.leader === p.id,
              home: { id: home.id, name: home.name }, faction: { name: f.name, colour: f.colour }, bornUnder: w.factions[p.from].name,
            };
            if (other) named[other.id] = other.name;
          }
        }
      } else if (tab === "world") {
        let need = 0, stores = 0;
        for (const p of w.people) need += w.dailyNeed(p);
        for (const v of w.villages) stores += v.food;
        out.stats = w.stats(); out.need = need; out.stores = stores;
        out.history = w.history.slice(); out.settings = Object.assign({}, S);
      }
      out.named = named;
      send(out);
    }

    /* Who or what is under a tap. */
    function at(m) {
      const hit = world.at(m.x, m.y, m.r);
      send({ t: "at", seq: m.seq, person: hit && hit.person ? { id: hit.person.id, name: hit.person.name } : null,
             village: hit && hit.village ? { id: hit.village.id } : null });
    }

    /* The watcher's own decisions, passed to the doors the engine has for
       them. Each reads what stands now and moves it one notch, here, so the
       page's picture being a moment old can never set a stale value. */
    function act(m) {
      const w = world, a = m.a || [], what = m.what;
      let msg = "";
      frameKey = "";                                 // whatever is done, the next frame is a new one
      const f = w.factions[a[0]], v = w.villages[a[0]];
      if (what === "rule" && f) w.rule(f.id, !f.yours);
      else if (what === "ftax" && f && f.yours) w.order(f.id, { tax: f.yours.tax + 0.02 * a[1] });
      else if (what === "fharvest" && f && f.yours) w.order(f.id, { harvest: (f.yours.harvest || 0) + 0.02 * a[1] });   // TODO 15.5t
      else if (what === "army" && f && f.yours) w.order(f.id, { army: f.yours.army + 0.02 * a[1] });
      else if (what === "relief" && f && f.yours) w.order(f.id, { relief: !f.yours.relief });
      else if (what === "land" && f && f.yours) w.order(f.id, { land: { family: "village", village: "leader", leader: "family" }[f.yours.land] || "family" });
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

  return { create: create, worker: worker, FLAG: FLAG, GEAR: GEAR };
});
