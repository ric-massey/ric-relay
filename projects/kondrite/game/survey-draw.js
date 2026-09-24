"use strict";

/* KONDRITE — SURVEY — DRAWING
   ─────────────────────────────────────────────────────────────────────────────
   Drawing the sector and the world, words around circles, what a thing is at
   a glance, what the devices leave behind, the rock of the Warrens, the
   front page line and where a ship may appear.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── drawing the sector ───────────────────────────────────────────────── */
function drawNebula(n) {
  if (!onScreen(n.x, n.y, n.r)) return;
  ctx.save();
  ctx.translate(n.x, n.y);
  const beat = reduceMotion ? 0 : Math.sin(clock * 0.4 + n.phase) * 0.06;
  // Rings rather than a fill: a filled cloud at this size is a wash over the
  // whole screen, and you still have to be able to fly through it.
  for (let i = 0; i < 7; i++) {
    const f = 0.32 + i * 0.11 + beat;
    glow(i % 2 ? NEBULA : "#6f5cc4", 2, 0.30 - i * 0.03, () => {
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const wob = 1 + Math.sin(a * 3 + i * 1.7 + n.phase) * 0.13;
        const rr = n.r * f * wob;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.74;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawWreck(w) {
  const r = 22 * w.size;
  if (!onScreen(w.x, w.y, r + 40)) return;
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(w.a);
  ctx.scale(w.size, w.size);
  // The same hull everything else in the game flies, sheared open and unlit.
  glow(w.node ? "#ffe56d" : WRECK, 1.6, w.node ? 0.75 : 0.6, () => {
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-12, 9); ctx.lineTo(-7, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, -9); ctx.lineTo(-4, -3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -6); ctx.lineTo(9, -11);
    ctx.stroke();
  });
  ctx.restore();

  if (w.beacon || w.node) {
    const pulse = 0.5 + 0.5 * Math.sin(clock * (w.node ? 1.4 : 2.6));
    glow(w.node ? "#ffe56d" : NEBULA, 2, 0.25 + pulse * 0.5, () => {
      ctx.beginPath();
      ctx.arc(w.x, w.y, r + 16 + pulse * 26, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

// The wall's markers: a corner bracket each, so four of them read as one
// square from the middle even though you can only ever see one at a time.
function drawMark(m) {
  if (!onScreen(m.x, m.y, 120)) return;
  const beat = 0.6 + 0.4 * Math.sin(clock * 2 + m.x * 0.01);
  glow("#ff8f77", 2, beat * 0.85, () => {
    ctx.beginPath();
    ctx.arc(m.x, m.y, 26, 0, Math.PI * 2);
    ctx.moveTo(m.x - 46, m.y); ctx.lineTo(m.x + 46, m.y);
    ctx.moveTo(m.x, m.y - 46); ctx.lineTo(m.x, m.y + 46);
    ctx.stroke();
  });
}

/* ── drawing the world ────────────────────────────────────────────────────
   The rule the whole mode is drawn by: if it stops you, it looks solid, and
   if it looks solid it stops you. Everything painted below is exactly the
   shape the collision uses, because the first time a player clips a hull they
   could see, they stop trusting every other edge in the sector. */

function drawGate(g) {
  if (!onScreen(g.x, g.y, GATE_R + 60)) return;
  if (g.dead) return drawDeadGate(g);
  const spin = reduceMotion ? 0 : clock * 0.6 + g.phase;
  ctx.save();
  ctx.translate(g.x, g.y);
  // Rings that fall inward, so the mouth reads as a hole rather than a ring.
  for (let i = 0; i < 5; i++) {
    const f = ((clock * 0.34 + i / 5 + g.phase) % 1);
    const r = GATE_R * (1 - f * 0.82);
    glow(i % 2 ? NEBULA : "#5ce1ff", 2, (1 - f) * 0.55, () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.82, spin, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  glow("#5ce1ff", 2.6, 0.9, () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, GATE_R * 0.2, GATE_R * 0.16, spin, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

/* The Wall's mouth. A live gate is rings falling inward and a bright centre;
   this is the same figure with the motion taken out of it and the rings broken
   — arcs with gaps, drifting apart rather than falling in, and nothing at the
   middle. It has to read as *the same kind of object* as a working gate, or
   the Wall stops being a wormhole that failed and becomes unrelated scenery. */
function drawDeadGate(g) {
  const drift = reduceMotion ? 0 : Math.sin(clock * 0.4 + g.phase) * 0.12;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.phase + drift);
  for (let i = 0; i < 4; i++) {
    const r = GATE_R * (0.42 + i * 0.2);
    // Two opposing arcs a ring, with the gaps rotating between rings, so the
    // whole figure looks unfinished rather than merely dashed.
    glow(WRECK, 1.8, 0.5 - i * 0.08, () => {
      for (const a0 of [0.35 + i * 0.7, Math.PI + 0.15 + i * 0.7]) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.82, 0, a0, a0 + 1.5 + i * 0.12);
        ctx.stroke();
      }
    });
  }
  // A collapsed centre: two struts across where the throat should be.
  glow("#ff8f77", 1.6, 0.4 + 0.2 * Math.abs(Math.sin(clock * 0.9)), () => {
    ctx.beginPath();
    ctx.moveTo(-GATE_R * 0.16, -GATE_R * 0.13);
    ctx.lineTo(GATE_R * 0.16, GATE_R * 0.13);
    ctx.moveTo(GATE_R * 0.16, -GATE_R * 0.13);
    ctx.lineTo(-GATE_R * 0.16, GATE_R * 0.13);
    ctx.stroke();
  });
  ctx.restore();
}

/* ── a word set around a circle ───────────────────────────────────────────
   Letter by letter on the curve rather than written flat across the middle.
   A ring with writing on it reads as a built thing; the same word laid over
   it reads as a label stuck to the screen — and on anything big it reads as
   a label stuck over the thing you were trying to look at.

   `copies` repeats the word evenly round the circle, which is what makes a
   big body easier to pick out: one name on something two thousand units
   across is legible from exactly one bearing, and you arrive from whichever
   bearing you arrive from.

   Radius decides which way it reads. Inside the circle — a station's ring —
   and it faces in; outside it — a world's rim — and it faces out. Both are
   the same arithmetic, so neither is a special case. */
function rimWord(word, cx, cy, rad, turn, size, colour, alpha, copies) {
  if (!word) return;
  const n = Math.max(1, copies || 1);
  /* Letters spaced by angle, so a word occupies the same arc whatever the
     body's size and a long one simply sets tighter. Capped so several copies
     cannot run into each other: each gets its share of the circle and keeps
     a fifth of it clear. */
  const arc = Math.min(Math.PI * 1.5, word.length * 0.145,
                       (Math.PI * 2 / n) * 0.8);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turn);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.font = size + 'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let c = 0; c < n; c++) {
    const base = (c / n) * Math.PI * 2;
    for (let i = 0; i < word.length; i++) {
      const t = word.length > 1 ? i / (word.length - 1) - 0.5 : 0;
      ctx.save();
      ctx.rotate(base + t * arc - Math.PI / 2);
      ctx.translate(0, -rad);
      ctx.fillText(word[i], 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawStation(st) {
  if (!onScreen(st.x, st.y, st.r + 80)) return;
  const spin = reduceMotion ? 0 : clock * 0.22 + st.phase;
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.rotate(spin);
  glow(CASH, 2, 0.85, () => {
    // A ring on three struts: legible at a glance from any distance, and
    // unmistakably not a rock.
    ctx.beginPath();
    ctx.arc(0, 0, st.r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * st.r * 0.2, Math.sin(a) * st.r * 0.2);
      ctx.lineTo(Math.cos(a) * st.r * 0.62, Math.sin(a) * st.r * 0.62);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, st.r * 0.19, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();

  /* The name, painted around the inside of the ring and turning with it. Every
     station in the sector says STATION; the one you left home from says YOUR
     STATION, because after ten hours out there the only thing you need to know
     at a glance is whether this is the one with your hangar in it.

     Set on the curve letter by letter rather than written across the middle: a
     ring with writing on it reads as a built thing, and a word laid flat over
     it reads as a label stuck to the screen. It turns with the station for the
     same reason — it is painted on. */
  const word = st.home ? "YOUR STATION" : "STATION";
  rimWord(word, st.x, st.y, st.r * 0.47,
          spin * 0.72,                  // slower than the ring, so it reads
          Math.max(9, Math.min(15, st.r * 0.1)),
          CASH, st.home ? 0.9 : 0.62, 1);

  /* And what it is still short of, worn on the outside. This is the yard's
     old ring, moved: bare ribs the whole way round, one segment of plating
     lit per part delivered, so the place you live visibly comes back
     together as the manifest empties. It is on the home station rather than
     beside it because there is one landmark off the origin now, not two.

     It goes when the sixth part goes in. A ring that stays full for the rest
     of the run is a monument, and the station has a mouth to draw instead. */
  if (st.home && !stationWhole()) {
    const done = surv.built.size, need = BUILD.length;
    ctx.save();
    ctx.translate(st.x, st.y);
    glow(WRECK, 1.6, 0.75, () => {
      ctx.beginPath();
      ctx.arc(0, 0, st.r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < need; i++) {
        const a = (i / need) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * st.r * 0.95, Math.sin(a) * st.r * 0.95);
        ctx.lineTo(Math.cos(a) * st.r * 1.5, Math.sin(a) * st.r * 1.5);
        ctx.stroke();
      }
    });
    for (let i = 0; i < done; i++) {
      const a0 = (i / need) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / need) * Math.PI * 2 - Math.PI / 2;
      glow(CASH, 3, 0.9, () => {
        ctx.beginPath();
        ctx.arc(0, 0, st.r * 1.22, a0 + 0.04, a1 - 0.04);
        ctx.stroke();
      });
    }
    ctx.restore();
    label3("SHORT OF " + (need - done) +
           (need - done === 1 ? " PART" : " PARTS"),
           st.x, st.y + st.r * 1.5 + 28, NEBULA);
  }

  // The dock ring, drawn only when you are close enough for it to mean
  // something — a permanent one would be a second circle round every station.
  const me = ships[0];
  if (me && dist2(me.x, me.y, st.x, st.y) < (SURVEY_DOCK * 2.2) ** 2) {
    glow(CASH, 1.4, 0.34 + 0.2 * Math.sin(clock * 3), () => {
      ctx.beginPath();
      ctx.arc(st.x, st.y, SURVEY_DOCK, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

function drawCache(c) {
  if (!onScreen(c.x, c.y, 120)) return;
  const sealed = c.sealed;
  const beat = 0.55 + 0.45 * Math.sin(clock * (sealed ? 1.6 : 3.4) + c.phase);
  glow(sealed ? DRONE_COLOUR : CASH, 2, sealed ? 0.5 : beat, () => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(reduceMotion ? 0 : clock * 0.5 + c.phase);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = c.r * (c.rich ? 1.35 : 1);
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });
  if (sealed) {
    // A ring of the sealing colour, so "why can't I open this" is answered
    // from further away than the sentries are visible.
    glow(DRONE_COLOUR, 1.2, 0.3, () => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r + 26 + beat * 8, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

/* A battle that is over and remembered. A stone and a name, floating where it
   happened — the only thing in the sector that is about something that
   happened rather than something that is there. Battles nobody remembered
   leave their wrecks and nothing else, which is its own kind of true. */
function drawBattle(b) {
  if (!b.over || !surv.memorials.has(b.id)) return;
  if (!onScreen(b.x, b.y, 400)) return;
  const t = clock * 0.5 + (b.phase || 0);
  ctx.save();
  ctx.translate(b.x, b.y);
  glow("#a08cff", 1.6, 0.55 + Math.sin(t) * 0.1, () => {
    // A slab, standing on nothing.
    ctx.beginPath();
    ctx.moveTo(-26, 46); ctx.lineTo(-16, -52); ctx.lineTo(16, -52);
    ctx.lineTo(26, 46); ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-40, 46); ctx.lineTo(40, 46);
    ctx.stroke();
  });
  ctx.restore();
  label3(b.name, b.x, b.y - 78, "#a08cff", 20);
  label3(factionOf(b.sides[0]).short + "  \u2020  " +
         factionOf(b.sides[1]).short, b.x, b.y + 82, "#6d5fa8", 15);
}

function drawHulk(h) {
  if (!onScreen(h.x, h.y, h.r + 40)) return;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.a);
  const dim = 0.4 + 0.6 * (h.hp / 4);
  glow(WRECK, 2, dim, () => {
    // A broken slab, drawn to its collision radius so the edge you see is the
    // edge you hit.
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const rr = h.r * (0.78 + ((i * 37) % 11) / 40);
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
        : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-h.r * 0.5, -h.r * 0.2); ctx.lineTo(h.r * 0.4, h.r * 0.3);
    ctx.stroke();
  });
  ctx.restore();
}

/* ── what it is, at a glance ─────────────────────────────────────────────
   The hull says what sort of ship it is. These say what it is *doing*, for the
   two jobs a hull cannot show on its own:

     pirate   barbs along its whole outline and a ram at the nose. Nobody else
              in the sector bolts spikes to their ship.
     patrol   a light bar that flashes red and blue at the wingtips. It is
              the police, and from any distance it looks like the police.

   An escort's mark is not drawn here. It is the line to the ship it is
   guarding, drawn in world space by `drawTraffic`. */
function drawRoleMarks(t, spec, colour, w) {
  const role = t.role || t.kind;
  if (role === "pirate") {
    glow(colour, 1.2 * w, 0.9, () => {
      ctx.beginPath();
      for (const p of spec.art) {
        const d = Math.hypot(p[0], p[1]);
        if (d < 5) continue;
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[0] + p[0] / d * 4, p[1] + p[1] / d * 4);
      }
      const nose = spec.noseX || 12;
      ctx.moveTo(nose - 2, 2.5); ctx.lineTo(nose + 5, 1.2);
      ctx.moveTo(nose - 2, -2.5); ctx.lineTo(nose + 5, -1.2);
      ctx.stroke();
    });
  } else if (role === "patrol") {
    let tip = spec.art[0];
    for (const p of spec.art) if (p[1] > tip[1]) tip = p;
    const on = Math.floor(clock * 3 + (t.phase || 0)) % 2;
    glow(on ? "#ff4d5e" : "#4d8dff", 2.4 * w, 1, () => {
      ctx.beginPath();
      const y = on ? tip[1] : -tip[1];
      ctx.arc(tip[0], y, 1.6, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

/* Somebody else's ship. Drawn from the same twenty-five outlines you can buy,
   which is most of what makes the roster feel like a world rather than a shop:
   the Drayman that passes you on a route is the Drayman in the hangar.

   Colour carries the kind — a hauler minds its own business, a patrol is on
   your side, a distress call is the one you have to decide about — and a
   distress call gets a ring that beats, because it has a clock on it and the
   whole scene is about noticing in time. */
function drawTraffic(t) {
  const spec = specOf(t);
  const r = SHIP_R * U * spec.size * (t.scale || 1);
  if (!onScreen(t.x, t.y, r * 2.5 + 80)) return;
  const colour = trafficColour(t);
  const hit = t.hit > 0;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.a);
  ctx.scale(r / 12, r / 12);
  /* What it is carrying, in its holds. See `podColours`. A convoy's hold is
     a few dozen units against a hull that could take hundreds, so how full
     it looks is measured against a working load rather than the hull's
     capacity. Otherwise every hauler in the sector would look empty. */
  const counts = {};
  for (const k of t.cargo || []) counts[k] = (counts[k] || 0) + 1;
  const load = podColours(spec.pods, counts, (t.cargo || []).length / 30);
  /* The corsair is half there while it moves into position, and only all
     there when it strikes. */
  const seen = t.boss === "corsair" && !t.shown ? 0.16 : 1;
  drawHullArt(spec, hit ? "#fff2bf" : colour, 12 / r, seen, { load });
  drawRoleMarks(t, spec, colour, 12 / r);
  /* A boss wears a second outline, a size out from its own, in the colour
     nothing else in the sector uses. */
  if (t.boss) {
    const beat = 0.55 + 0.45 * Math.sin(clock * 2.6 + (t.phase || 0));
    glow(BOSS_COLOUR, 1.4 * (12 / r), 0.35 + 0.4 * beat, () => {
      ctx.save();
      ctx.scale(1.18, 1.18);
      ctx.beginPath();
      spec.art.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });
  }
  /* ── what a working engine looks like ───────────────────────────────────
     Your ship trails burning dust and nothing else in the sector did, which is
     most of why other ships read as cut-outs sliding across the screen rather
     than as things under power. A hull big enough to need more than one engine
     gets more than one: a scout has a single throat, a hauler two, a capital
     three, spaced across its stern. Inside the ship's own transform, so they
     sit where the engines are whichever way it is pointing. */
  const throats = spec.size >= 1.5 ? 3 : spec.size >= 1.1 ? 2 : 1;
  const burn = 0.55 + 0.45 * Math.abs(Math.sin(clock * 7 + (t.phase || 0)));
  if (!t.adrift) {
    glow("#ffcb42", 1.4 * (12 / r), 0.3 + burn * 0.35, () => {
      for (let k = 0; k < throats; k++) {
        const off = throats === 1 ? 0 : (k - (throats - 1) / 2) * 6.5;
        ctx.beginPath();
        ctx.moveTo(spec.tailX, off);
        ctx.lineTo(spec.tailX - 4 - burn * 5, off);
        ctx.stroke();
      }
    });
  }
  ctx.restore();

  /* An escort is the ship on a line to somebody else. Faint, and only while
     the client is near enough to be the reason it is there, so "those two are
     guarding that one" is something you can see rather than work out. */
  if (t.role === "escort" && t.client && surv.traffic.indexOf(t.client) >= 0 &&
      Math.hypot(t.client.x - t.x, t.client.y - t.y) < 1400 * U) {
    glow(colour, 1, 0.25, () => {
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.client.x, t.client.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // The admiral's screen, as a ring that thins as it soaks.
  if (t.shield > 0) {
    const k = t.shield / (t.shieldMax || 40);
    glow(BOSS_COLOUR, 1.4 + (t.shieldFlash > 0 ? 2 : 0), 0.2 + 0.5 * k, () => {
      ctx.beginPath(); ctx.arc(t.x, t.y, r * 1.95, 0, Math.PI * 2); ctx.stroke();
    });
  }
  // The queen's beam, on a ship she is taking.
  if (t.taking && surv.traffic.indexOf(t.taking) >= 0) {
    const me = t.taking;
    glow(BOSS_COLOUR, 1.2, 0.25 + 0.15 * Math.sin(clock * 9), () => {
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(t.x + Math.cos(t.a) * r, t.y + Math.sin(t.a) * r);
      ctx.lineTo(me.x, me.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  // The corsair on its burner.
  if (t.dash > 0) {
    glow("#ff4dd2", 2.4, 0.9, () => {
      ctx.beginPath();
      ctx.moveTo(t.x - Math.cos(t.a) * r, t.y - Math.sin(t.a) * r);
      ctx.lineTo(t.x - Math.cos(t.a) * r * 3.2, t.y - Math.sin(t.a) * r * 3.2);
      ctx.stroke();
    });
  }
  // Its name, and how much of it is left. Not while the corsair is hiding.
  if (t.boss && seen === 1) {
    const top = t.y - r * 2 - 22;
    label3(t.name, t.x, top, BOSS_COLOUR, 17);
    const w = Math.max(90, r * 2.4), left = t.x - w / 2, frac = Math.max(0, t.hp / t.maxHp);
    glow(BOSS_COLOUR, 2, 0.25, () => {
      ctx.beginPath(); ctx.moveTo(left, top + 12); ctx.lineTo(left + w, top + 12); ctx.stroke();
    });
    glow(BOSS_COLOUR, 3, 0.95, () => {
      ctx.beginPath(); ctx.moveTo(left, top + 12); ctx.lineTo(left + w * frac, top + 12); ctx.stroke();
    });
  }

  if (t.kind === "distress") {
    const beat = 0.5 + 0.5 * Math.sin(clock * 4 + t.phase);
    glow("#ff8f77", 2, 0.3 + beat * 0.5, () => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 1.8 + beat * 14, 0, Math.PI * 2);
      ctx.stroke();
    });
    label3("DISTRESS  " + Math.max(0, Math.round(t.doom)) + "s",
           t.x, t.y - r * 2.2 - 14, "#ff8f77", 18);
  } else if (t.kind === "patrol" && !t.boss) {
    label3(t.angry ? "PATROL — HOSTILE" : t.shadow ? "PATROL — WATCHING" : "PATROL",
           t.x, t.y - r * 2 - 10, colour, 15);
  } else if (t.kind === "hunter") {
    const beat = 0.55 + 0.45 * Math.sin(clock * 3.6 + t.phase);
    glow(colour, 2, 0.3 + beat * 0.4, () => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 1.7 + beat * 8, 0, Math.PI * 2);
      ctx.stroke();
    });
    label3(t.grudge ? t.name : "HUNTER", t.x, t.y - r * 2 - 10, colour, 17);
  }
  /* A name, for the two kinds of ship that have earned one. Everything else out
     here is deliberately anonymous — a sector where every freighter introduces
     itself is a cast rather than a place — so a name over a hull means *this is
     one you have met*, and that is the whole of 6.5 stated on the screen without
     a page to open. */
  if (t.friend) {
    label3(t.name, t.x, t.y - r * 2 - 10, CASH, 16);
    label3("YOU HELPED THEM", t.x, t.y + r * 2 + 20, CASH, 13);
  } else if (t.adrift) {
    const beat = 0.5 + 0.5 * Math.sin(clock * 3 + t.phase);
    glow(ICE_C, 2, 0.25 + beat * 0.4, () => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * 1.7 + beat * 10, 0, Math.PI * 2);
      ctx.stroke();
    });
    label3("ADRIFT  " + Math.max(0, Math.round(t.doom)) + "s",
           t.x, t.y - r * 2.2 - 14, ICE_C, 17);
  }
}

/* A bug: a body and two beating wings, or, if she took it, the ship it was,
   small and in her colour. */
function drawBug(d) {
  if (!onScreen(d.x, d.y, 60)) return;
  const c = d.hit > 0 ? "#ffffff" : d.ally ? CASH : BOSS_COLOUR;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.a);
  if (d.hull) {
    const sp = shipSpec(d.hull);
    const k = 17 * U / Math.max(sp.noseX || 12, -(sp.tailX || -12));
    ctx.scale(k, k);
    drawHullArt(sp, c, 1 / k, 0.95);
  } else {
    const flap = 0.55 + 0.45 * Math.sin(clock * 22 + d.slot);
    const B = 1.7 * U;
    glow(c, 1.8, 1, () => {
      ctx.beginPath();
      ctx.moveTo(10 * B, 0); ctx.lineTo(-6 * B, 3 * B); ctx.lineTo(-6 * B, -3 * B);
      ctx.closePath();
      for (const side of [1, -1]) {
        ctx.moveTo(2 * B, side * 2 * B);
        ctx.lineTo(-4 * B, side * (4 + 8 * flap) * B);
        ctx.lineTo(-8 * B, side * 3 * B);
        // Feelers.
        ctx.moveTo(8 * B, side * 1 * B);
        ctx.lineTo(13 * B, side * 4 * B);
      }
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawDrone(d) {
  if (d.bug) return drawBug(d);
  if (!onScreen(d.x, d.y, 60)) return;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.a);
  const c = d.hit > 0 ? "#ffffff" : DRONE_COLOUR;
  glow(c, 2, d.awake ? 1 : 0.55, () => {
    ctx.beginPath();
    ctx.moveTo(15 * U, 0);
    ctx.lineTo(-9 * U, 10 * U);
    ctx.lineTo(-4 * U, 0);
    ctx.lineTo(-9 * U, -10 * U);
    ctx.closePath();
    ctx.stroke();
  });
  ctx.restore();
  if (d.awake) {
    const beat = 0.4 + 0.6 * Math.sin(clock * 6);
    glow(DRONE_COLOUR, 1.2, beat * 0.5, () => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 26 * U, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

/* ── what the devices leave in the world ──────────────────────────────────
   Both have to be legible from further away than they are dangerous, which is
   the only rule that matters here. A mine you cannot see until you are inside
   its radius is not a hazard, it is a dice roll; a decoy you cannot tell from
   your own ship is a decoy you cannot use on purpose.

   So a mine is a dark thing with a pip that beats faster the moment it arms,
   and a decoy is drawn as the lie it is: a ship-sized flare, burning, with a
   ring that shrinks as its fourteen seconds run out. */
function drawDevices() {
  /* The line, for the half-second it is worth drawing. It is gone by the time
     you arrive, which is right: the winch is instantaneous and what you are
     being shown is *what happened*, not a rope you are hanging from. */
  /* The burst, going out. One ring, travelling to the radius it actually
     reached and fading as it goes — drawn before the line so a grapple fired
     out of a burst sits over it rather than under. */
  if (surv.empRing) {
    const e = surv.empRing;
    const k = Math.min(1, e.t / EMP_RING_TIME);
    const r = EMP_REACH * U * k;
    glow("#87d8ff", 2.2, (1 - k) * 0.9, () => {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    // A second, thinner one just behind it, so the edge reads as a front
    // rather than as a circle that happens to be growing.
    if (k > 0.12) {
      glow("#87d8ff", 1.1, (1 - k) * 0.45, () => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, r * 0.86, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  if (surv.grappleTo) {
    const me = ships[0];
    const g = surv.grappleTo;
    const fade = Math.max(0, g.t / 0.45);
    glow(NEBULA, 1.4, fade * 0.9, () => {
      ctx.beginPath();
      ctx.moveTo(me.x, me.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
    });
    // The bite, at the far end, opening as the line goes slack.
    glow(NEBULA, 1.2, fade, () => {
      ctx.beginPath();
      ctx.arc(g.x, g.y, (5 + (1 - fade) * 10) * U, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  for (const mn of surv.mines) {
    if (!onScreen(mn.x, mn.y, 60)) continue;
    const live = mn.arm <= 0;
    const beat = 0.35 + 0.65 * Math.abs(Math.sin(clock * (live ? 5 : 1.6)));
    glow(live ? "#ffcb42" : WRECK, 1.6, live ? 0.9 : 0.5, () => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = mn.spin + k * Math.PI / 3;
        const r = 9 * U;
        if (k) ctx.lineTo(mn.x + Math.cos(a) * r, mn.y + Math.sin(a) * r);
        else ctx.moveTo(mn.x + Math.cos(a) * r, mn.y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
    });
    glow(live ? "#ff8f77" : WRECK, 1.2, beat * (live ? 0.8 : 0.3), () => {
      ctx.beginPath();
      ctx.arc(mn.x, mn.y, 3.2 * U, 0, Math.PI * 2);
      ctx.stroke();
    });
    /* The radius, faint — and drawn while it is still arming too, because the
       second and a half before it arms is exactly when you need to know how
       far away to be. Brighter once it is live and yours to worry about. */
    glow("#ffcb42", 1, live && mn.clear ? 0.18 : 0.09, () => {
      ctx.beginPath();
      ctx.arc(mn.x, mn.y, MINE_BOOM * 0.62 * U, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  for (const dc of surv.decoys) {
    if (!onScreen(dc.x, dc.y, 90)) continue;
    const left = Math.max(0, dc.life / (dc.full || DECOY_LIFE));
    const flick = 0.6 + 0.4 * Math.sin(clock * 22 + dc.spin);
    glow("#ffe56d", 2.2, Math.min(1, left * 1.4) * flick, () => {
      ctx.beginPath();
      ctx.arc(dc.x, dc.y, 13 * U, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = dc.spin + k * Math.PI / 2;
        ctx.moveTo(dc.x + Math.cos(a) * 16 * U, dc.y + Math.sin(a) * 16 * U);
        ctx.lineTo(dc.x + Math.cos(a) * 26 * U, dc.y + Math.sin(a) * 26 * U);
      }
      ctx.stroke();
    });
    glow("#ffe56d", 1, 0.3 * left, () => {
      ctx.beginPath();
      ctx.arc(dc.x, dc.y, 13 * U + 34 * U * left, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

/* A scan's returns, on the world. Each one is a ring with a word on it, so
   what came back is legible without opening anything — the point of the
   rewrite was that a scan should show you something. */
function drawEchoes() {
  for (const e of surv.echoes) {
    if (!onScreen(e.x, e.y, 120)) continue;
    const spec = { name: e.name, colour: e.colour };   // see `surveyScan`
    const fade = Math.min(1, e.t / 4);           // the last four seconds dim
    const beat = 0.6 + 0.4 * Math.sin(clock * 3 + e.x * 0.01);
    glow(spec.colour, 1.6, fade * 0.75 * beat, () => {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - 46); ctx.lineTo(e.x, e.y - 34);
      ctx.stroke();
    });
    label3(spec.name, e.x, e.y - 54, spec.colour);
  }

  // The pulse itself, expanding once to the edge of what it reached.
  if (surv.scan.flash > 0 && surv.scan.reach) {
    const f = 1 - surv.scan.flash;
    glow(NEBULA, 2, surv.scan.flash * 0.5, () => {
      ctx.beginPath();
      ctx.arc(ships[0].x, ships[0].y, surv.scan.reach * f, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

function drawSurveyShots() {
  glow(DRONE_COLOUR, 2.4, 1, () => {
    for (const b of surv.shots) {
      if (!onScreen(b.x, b.y, 20)) continue;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
    }
  });
}

/* Named `drawCash`, not `drawMotes`. It was `drawMotes` first, which is
   also the name of the engine's hazard-debris painter three thousand lines
   down — two function declarations in one scope, and the later one wins. The
   result was silent and total: loose salvage was never drawn at all, so the
   thing the whole economy is made of was invisible. */
function drawCash() {
  const lit = surv.tractorLit > 0;
  /* One pass a material rather than one pass for the lot: the colour is the
     only thing telling you whether the cloud you are flying into is ice or
     iridium, and `glow` sets the stroke once for a whole batch. Sorted so the
     rare ones are painted last and read over the common ones. */
  for (const spec of MATERIALS) {
    let any = false;
    for (const m of surv.motes) {
      if ((m.mat || "iron") === spec.key) { any = true; break; }
    }
    if (!any) continue;
    glow(spec.colour, 1.6, 1, () => {
      for (const m of surv.motes) {
        if ((m.mat || "iron") !== spec.key) continue;
        if (!onScreen(m.x, m.y, 18)) continue;
        // A denser material draws a little bigger, so a seam of the good
        // stuff is visible before you are close enough to read a colour.
        const r = (3.4 + spec.value * 0.06) * U + Math.sin(m.spin) * U;
        ctx.beginPath();
        ctx.moveTo(m.x - r, m.y); ctx.lineTo(m.x, m.y - r);
        ctx.lineTo(m.x + r, m.y); ctx.lineTo(m.x, m.y + r);
        ctx.closePath();
        ctx.stroke();
      }
    });
  }
  // The beam is drawn only while it is pulling something, so it is a fact
  // about the world rather than a permanent decoration on the ship.
  if (lit) {
    const me = ships[0];
    glow(CASH, 1, 0.22, () => {
      ctx.beginPath();
      ctx.arc(me.x, me.y, SURVEY_TRACTOR * (1 + mods().reach) * U,
              0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

/* The Leviathan. Drawn from the same local geometry `buildLeviathan` puts its
   collision discs on, so the plates and the physics cannot drift apart: two
   flanks, a bow cap, and a stern quarter left open on one side that is the
   way in. Filled dark first — a hull you can see stars through is a fence. */
function drawLeviathan(lev) {
  if (!onScreen(lev.x, lev.y, lev.len)) return;
  const half = lev.len / 2, seg = LEV_SEG;
  const wx = (u, v) => lev.x + u * lev.ca - v * lev.sa;
  const wy = (u, v) => lev.y + u * lev.sa + v * lev.ca;
  const outer = lev.flank + seg;

  /* The body, as a dark ground so the inside reads as inside rather than as
     lines drawn over the starfield. **From the outline the builder made**, not
     from a box: the hull is a shape now — broad at the transom, full through
     the after body, drawn out to a stem — and filling a rectangle over it
     painted deck across two thousand units of open space at the bow. */
  ctx.save();
  ctx.fillStyle = "#05070c";
  const box = (u0, v0, u1, v1) => {
    ctx.beginPath();
    ctx.moveTo(wx(u0, v0), wy(u0, v0));
    ctx.lineTo(wx(u1, v0), wy(u1, v0));
    ctx.lineTo(wx(u1, v1), wy(u1, v1));
    ctx.lineTo(wx(u0, v1), wy(u0, v1));
    ctx.closePath();
    ctx.fill();
  };
  if (lev.outline && lev.outline.length) {
    ctx.beginPath();
    lev.outline.forEach((pt, i) => {
      const x = wx(pt.u, pt.v), y = wy(pt.u, pt.v);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  } else {
    box(-half, -outer, half, outer);
  }
  // The sponsons, each from its own size rather than from two numbers that
  // used to be true of all six.
  for (const b of lev.bays) {
    const hw = b.hw || 470, root = b.root === undefined ? lev.flank : b.root;
    box(b.u - hw, b.side * root, b.u + hw, b.v + b.side * (b.depth || 430) * 0.45);
  }
  // And the engine throats, aft of the transom.
  if (lev.engine) {
    for (const k of [-1, 0, 1]) {
      const v0 = k * lev.engine.at;
      box(-half - lev.engine.out, v0 - lev.engine.hw, -half, v0 + lev.engine.hw);
    }
  }
  ctx.restore();

  /* Paint the full physical plate before its centre seam. Collision is a row
     of `LEV_SEG`-radius discs, so a hairline on the row's centre leaves 170
     units of solid hull invisible on either side — thirty-four screen pixels
     at the lab's opening zoom. A round, 2×radius stroke is the same capsule
     those overlapping discs make. The narrow outer pass gives the plate a
     readable edge against the dark deck. */
  /* ── plates joined into runs ───────────────────────────────────────────
     Grouped by thickness first — a plate carries its own `r`, and bow armour
     is heavier than a bulkhead — and then **chained end to end**.

     The chaining is what closes the corners. A square-ended plate drawn as its
     own little path gets a butt cap at each end, and `lineJoin` only ever
     applies *within* one path — so every chine on the ship had a wedge of
     nothing at the outside of the angle, which is the gap you can see at every
     corner. Walking the shared vertices and stroking each run as a single path
     lets the join do its job: the corner closes, and it closes to a point
     rather than to a blob, which is the whole reason for square ends. */
  const chainUp = list => {
    const runs = [];
    const left = list.slice();
    const near = (ax, ay, bx, by) => Math.abs(ax - bx) < 0.5 && Math.abs(ay - by) < 0.5;
    while (left.length) {
      const w = left.shift();
      const run = [[w.u0, w.v0], [w.u1, w.v1]];
      let grew = true;
      while (grew) {
        grew = false;
        for (let i = 0; i < left.length; i++) {
          const c = left[i];
          const head = run[0], tail = run[run.length - 1];
          if (near(c.u0, c.v0, tail[0], tail[1])) run.push([c.u1, c.v1]);
          else if (near(c.u1, c.v1, tail[0], tail[1])) run.push([c.u0, c.v0]);
          else if (near(c.u1, c.v1, head[0], head[1])) run.unshift([c.u0, c.v0]);
          else if (near(c.u0, c.v0, head[0], head[1])) run.unshift([c.u1, c.v1]);
          else continue;
          left.splice(i, 1);
          grew = true;
          break;
        }
      }
      runs.push(run);
    }
    return runs;
  };
  const byWeight = new Map();
  for (const w of lev.walls) {
    const t = w.r || seg;
    if (!byWeight.has(t)) byWeight.set(t, []);
    byWeight.get(t).push(w);
  }
  const strokeWalls = (extra) => {
    for (const [t, list] of byWeight) {
      ctx.lineWidth = t * 2 + (extra || 0);
      ctx.beginPath();
      for (const w of list) {
        ctx.moveTo(wx(w.u0, w.v0), wy(w.u0, w.v0));
        ctx.lineTo(wx(w.u1, w.v1), wy(w.u1, w.v1));
      }
      ctx.stroke();
    }
  };
  /* **A plate is not black.** The body was `#111722` on a `#05070c` deck —
     six points of brightness apart — so a wall was a black slab with a hairline
     rim, indistinguishable from the hole beside it and from the space outside
     the hull. Every other structure in the sector strokes its walls in a light
     grey and reads instantly; this one was painting the plate the colour of the
     gap.

     Three passes, light to dark, and the middle one is the plate: a rim you can
     see against the deck, a solid mid-grey body at exactly the width the
     collision discs make, and the lit seam below. */
  /* Square ends, mitred corners. A round cap puts a half-circle on the end
     of every plate, which at a chine is a blob where the design wants an
     angle — and the whole complaint about the old hull was that nothing on
     it was sharp. The discs underneath are still round; what is drawn is the
     plate they add up to. */
  ctx.save();
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  /* Shell and structure, drawn as two different things — which is the whole
     of why this stopped reading as a bundle of pipes. A frame is furniture
     inside the body and gets a dark, thin treatment; the outer shell is the
     ship's edge and gets the light.

     The deck underneath stays near-black on purpose, unlike the plan view's:
     you fly *inside* this one, and a corridor painted hull-grey is a corridor
     you cannot see your own ship against. */
  const kinds = ks => {
    const m = new Map();
    for (const [t, list] of byWeight) {
      const f = list.filter(w => ks.indexOf(w.k || "shell") >= 0);
      if (f.length) m.set(t, f);
    }
    return m;
  };
  const stroke = (set, colour, extra, alpha) => {
    ctx.strokeStyle = colour;
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.miterLimit = 24;                 // the stem is a very sharp angle
    for (const [t, list] of set) {
      ctx.lineWidth = t * 2 + (extra || 0);
      ctx.beginPath();
      for (const run of chainUp(list)) {
        run.forEach((pt, i) => {
          const x = wx(pt[0], pt[1]), y = wy(pt[0], pt[1]);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
      }
      ctx.stroke();
    }
  };
  const SHELL = ["shell", "wing", "engine", "tear", "jamb"];
  stroke(kinds(["frame"]), "#5d6a80", 10, 0.55);   // a frame's faint edge
  stroke(kinds(["frame"]), "#222b38", 0, 1);       // and its body, sunk in
  stroke(kinds(SHELL), "#8fa0ba", 18, 0.95);       // the shell's lit rim
  stroke(kinds(SHELL), "#39424f", 0, 1);           // and the plate itself
  ctx.globalAlpha = 1;
  ctx.restore();

  /* There used to be a lit seam down the centreline of every plate here. It
     is gone on Ric's call: with the shell drawn as a solid plate with its own
     rim, a bright line up the middle of it is a third edge on a two-edged
     thing, and it read as a pipe rather than as armour. */

  /* Ribs down the flanks, so the hull has a scale you can read as you pass
     it — and they have to follow the beam now rather than a constant, or they
     stand out in space where the hull has narrowed away from them. */
  const beamHere = u => {
    const o = lev.outline;
    if (!o || !o.length) return lev.flank;
    const t = Math.max(0, Math.min(1, (u + half) / lev.len));
    const i = Math.min(o.length / 2 - 1, Math.round(t * (o.length / 2 - 1)));
    return Math.abs(o[i].v);
  };
  glow("#4d5666", 1.1, 0.55, () => {
    for (let u = -half + seg; u < half - seg; u += seg * 2.6) {
      const b = beamHere(u);
      if (b < seg) continue;                        // up in the stem there is no flank
      for (const side of [-1, 1]) {
        if (side > 0 && u < lev.door[1]) continue;   // the open stern quarter
        ctx.beginPath();
        ctx.moveTo(wx(u, side * b), wy(u, side * b));
        ctx.lineTo(wx(u, side * (b + seg)), wy(u, side * (b + seg)));
        ctx.stroke();
      }
    }
  });

  /* The loose pieces. Drawn after the hull so they read as being in front of
     it and behind it rather than as part of it, and dimmer than the plates
     they came off — a shard catches less light than a hull. Position is a
     function of the clock, so this is the one thing on the Leviathan that
     moves. */
  if (lev.debris && lev.debris.length) {
    ctx.save();
    ctx.lineCap = "butt";
    for (const d of lev.debris) {
      const sw = Math.sin(clock * d.w + d.phase) * d.amp;
      const u = d.u + sw, v = d.v + Math.cos(clock * d.w * 0.7 + d.phase) * d.amp * 0.5;
      const a2 = d.a + clock * d.spin;
      const hx = Math.cos(a2) * d.len * 0.5, hy = Math.sin(a2) * d.len * 0.5;
      if (!onScreen(wx(u, v), wy(u, v), d.len)) continue;
      ctx.strokeStyle = d.heavy ? "#6c7a92" : "#4a5568";
      ctx.globalAlpha = d.heavy ? 0.8 : 0.55;
      ctx.lineWidth = d.heavy ? seg * 0.5 : seg * 0.28;
      ctx.beginPath();
      ctx.moveTo(wx(u - hx, v - hy), wy(u - hx, v - hy));
      ctx.lineTo(wx(u + hx, v + hy), wy(u + hx, v + hy));
      ctx.stroke();
    }
    ctx.restore();
  }

  /* There used to be a violet line threaded down the spine here — a lit
     route that stepped across to each doorway in turn. It is gone on Ric's
     call: the hull is the thing worth looking at, and a glowing dashed line
     drawn over it is a diagram laid on top of a ship. */
}

/* A box somebody sealed. Drawn from its own wall list, like the Leviathan, so
   what you can see is what you hit — and lit from the inside so the one gate in
   the shell reads as a way in rather than as a gap somebody left. */
/* ── the rock of the Warrens ───────────────────────────────────────────────
   **Traced, not stamped.** Every earlier version of this drew circles — the
   rock as a union of discs, the passage as a stroked line with round caps —
   and circles are what it looked like, because that is what it was. A union of
   discs has a scalloped boundary and a stroked polyline is a pipe.

   So the wall is found rather than drawn: `caveEdge` is negative inside a
   passage and positive in rock, and this walks a grid over the visible sky
   and follows the line where it crosses zero. That line is a contour of a
   noise-warped field, which means it is irregular everywhere, asymmetric
   across a passage, and has no repeated shape anywhere in it — an alcove on
   one wall with nothing opposite it, which is what the inside of a cave
   actually looks like.

   Marching squares, sixteen cases, of which the four that matter here are the
   corners and the two straights. Interpolated along each edge rather than cut
   at the midpoint, so the contour is smooth rather than stepped at the grid.

   Recomputed per frame over the screen only — about two thousand cells, each a
   field lookup — rather than cached per chunk, because the zoom changes what
   is on screen and a contour cached at one scale is the wrong resolution at
   another. */
const CAVE_GRID = 34;      // how finely the wall is traced, in world units

function drawCave() {
  if (!surv.cave || !surv.cave.length) return;
  const halfW = (SCREEN_W / 2) / cam.scale + 90;
  const halfH = (SCREEN_H / 2) / cam.scale + 90;
  const x0 = Math.floor((cam.x - halfW) / CAVE_GRID) * CAVE_GRID;
  const y0 = Math.floor((cam.y - halfH) / CAVE_GRID) * CAVE_GRID;
  const cols = Math.ceil((halfW * 2) / CAVE_GRID) + 2;
  const rows = Math.ceil((halfH * 2) / CAVE_GRID) + 2;
  if (cols * rows > 12000) return;                // absurd zoom; skip it

  /* One row of field values at a time, kept with the row above it, so the
     whole grid is never held and every point is evaluated exactly once. */
  const field = new Float32Array((cols + 1) * (rows + 1));
  let anyRock = false, anyAir = false;
  for (let j = 0; j <= rows; j++) {
    const wy = y0 + j * CAVE_GRID;
    for (let i = 0; i <= cols; i++) {
      const wx = x0 + i * CAVE_GRID;
      // Outside the region there is no rock at all, however the passages run.
      const v = caveFillAt(wx, wy) <= 0.35 ? -1e5 : caveEdge(wx, wy);
      field[j * (cols + 1) + i] = v;
      if (v > 0) anyRock = true; else anyAir = true;
    }
  }
  if (!anyRock) return;

  const tint = caveTint(cam.x, cam.y);

  /* The mass. Cell by cell: a cell with all four corners in rock is filled
     whole, and a cell the wall crosses is filled up to the wall. Squares and
     triangles — no arcs anywhere. */
  ctx.save();
  ctx.fillStyle = mixHex("#07090c", tint, 0.17);
  ctx.beginPath();
  const lerp = (ax, ay, av, bx, by, bv) => {
    const t = av / (av - bv);
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  };
  const walls = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * (cols + 1) + i;
      const a = field[k], b = field[k + 1];
      const c = field[k + cols + 2], d = field[k + cols + 1];
      const ax = x0 + i * CAVE_GRID, ay = y0 + j * CAVE_GRID;
      const bx = ax + CAVE_GRID, by = ay;
      const cx = bx, cy = ay + CAVE_GRID;
      const dx = ax, dy = cy;
      const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (code === 0) continue;
      if (code === 15) {
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy); ctx.lineTo(dx, dy);
        ctx.closePath();
        continue;
      }
      // The four edge crossings, where they exist.
      const eAB = (a > 0) !== (b > 0) ? lerp(ax, ay, a, bx, by, b) : null;
      const eBC = (b > 0) !== (c > 0) ? lerp(bx, by, b, cx, cy, c) : null;
      const eCD = (c > 0) !== (d > 0) ? lerp(cx, cy, c, dx, dy, d) : null;
      const eDA = (d > 0) !== (a > 0) ? lerp(dx, dy, d, ax, ay, a) : null;
      // The rock side of the cell, as a polygon walked corner by corner.
      const poly = [];
      const corner = (v, px, py) => { if (v > 0) poly.push([px, py]); };
      corner(a, ax, ay); if (eAB) poly.push(eAB);
      corner(b, bx, by); if (eBC) poly.push(eBC);
      corner(c, cx, cy); if (eCD) poly.push(eCD);
      corner(d, dx, dy); if (eDA) poly.push(eDA);
      if (poly.length > 2) {
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (let q = 1; q < poly.length; q++) ctx.lineTo(poly[q][0], poly[q][1]);
        ctx.closePath();
      }
      // And the wall itself: the segment between the two crossings.
      const cross = [eAB, eBC, eCD, eDA].filter(Boolean);
      if (cross.length === 2) walls.push(cross);
      else if (cross.length === 4) { walls.push([eAB, eBC]); walls.push([eCD, eDA]); }
    }
  }
  ctx.fill();
  ctx.restore();

  // The lit wall. One path of straight segments — there is not an arc in it.
  if (walls.length) {
    ctx.save();
    ctx.strokeStyle = tint;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2;
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (const [p, q] of walls) {
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawVault(v) {
  if (!onScreen(v.x, v.y, v.r * 1.6)) return;
  const wx = (u, vv) => v.x + u * v.ca - vv * v.sa;
  const wy = (u, vv) => v.y + u * v.sa + vv * v.ca;

  ctx.save();
  ctx.fillStyle = "#06080e";
  ctx.beginPath();
  const c = [[-v.r, -v.r], [v.r, -v.r], [v.r, v.r], [-v.r, v.r]];
  c.forEach((pt, i) => (i ? ctx.lineTo(wx(pt[0], pt[1]), wy(pt[0], pt[1]))
                          : ctx.moveTo(wx(pt[0], pt[1]), wy(pt[0], pt[1]))));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  glow("#7a86a0", 2.2, 0.9, () => {
    for (const w of v.walls) {
      ctx.beginPath();
      ctx.moveTo(wx(w.u0, w.v0), wy(w.u0, w.v0));
      ctx.lineTo(wx(w.u1, w.v1), wy(w.u1, w.v1));
      ctx.stroke();
    }
  });

  /* A flag on the shell, because somebody built this and the sector should be
     able to say so without a word. It is the only thing out here wearing a
     marking that big. */
  const beat = 0.35 + 0.65 * Math.abs(Math.sin(clock * 0.5 + v.phase));
  glow(NEBULA, 1.8, 0.2 + beat * 0.3, () => {
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.core * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a2 = (k / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(wx(Math.cos(a2) * v.core * 0.7, Math.sin(a2) * v.core * 0.7),
                 wy(Math.cos(a2) * v.core * 0.7, Math.sin(a2) * v.core * 0.7));
      ctx.lineTo(wx(Math.cos(a2) * v.ring * 0.92, Math.sin(a2) * v.ring * 0.92),
                 wy(Math.cos(a2) * v.ring * 0.92, Math.sin(a2) * v.ring * 0.92));
      ctx.stroke();
    }
  });
}

function drawSurveyWorld() {
  if (!surv) return;
  drawSky();
  for (const n of surv.nebulae) drawNebula(n);
  for (const g of surv.gates) drawGate(g);
  for (const p of surv.planets) drawPlanet(p);
  drawWellNames();
  for (const t of surv.traffic) drawTraffic(t);
  if (surv.leviathan) drawLeviathan(surv.leviathan);
  if (surv.vault) drawVault(surv.vault);
  drawCave();
  for (const h of surv.hulks) drawHulk(h);
  for (const b of surv.battles) drawBattle(b);
  for (const w of surv.wrecks) drawWreck(w);
  for (const st of surv.stations) drawStation(st);
  for (const c of surv.caches) drawCache(c);
  for (const d of surv.drones) drawDrone(d);
  for (const m of surv.marks) drawMark(m);
  for (const pt of surv.parts) drawPart(pt);
  for (const p of pickups) if (onScreen(p.x, p.y, 30)) drawPickup(p);
  drawDevices();
  drawCash();
  drawWarning();
  drawEchoes();
  drawSurveyShots();
}

/* Everything the interface module needs, gathered once. Both pages and the
   panel read the same object, so what the chart shows and what the panel
   shows can never disagree. */
function surveyState() {
  return {
    ship: ships[0], cam, clock, seed: surv.seed,
    hazards, planets: surv.planets, landmarks: surv.landmarks,
    contacts: surv.contacts,
    found: surv.found.size, total: SURVEY_TOTAL,
    inStar: surv.inStar, scan: surv.scan,
    /* How much this piece of sky is interfering, 0 to 1. The panel draws it as
       static: the *interface* is the instrument, so the instrument is what
       should look broken. Nothing else in the game asks for this and it is not
       a state — it is a fact about where you are, recomputed every frame. */
    grain: ships[0]
      ? Math.max(0, Math.min(1, (1 - regionScan(ships[0].x, ships[0].y)) / 0.9))
      : 0,
    /* Whether the scan has ever been pressed, so the panel can say how — and
       stop saying it the moment you do. A control nobody has been told about is
       a control that does not exist. */
    scanTaught: !!surv.t.scanned,
    /* A feature picked off the chart. One at a time, and it keeps its arrow
       until you pick another. */
    selected: surv.selected,
    // Counts down after a selection, for the flash on the chart.
    selectFlash: surv.selectFlash || 0,

    /* The two tracks, flattened for the interface. `refit` carries the tier
       and the next price so the station screen never has to do arithmetic,
       and every part carries how you would get one, so the parts page can show
       something you cannot build yet as a thing to work towards. */
    /* `cash`, not `salvage`. The rename went through the store and through
       the interface and then stopped here, on the one line that joins them —
       so the panel, the station and the inventory all read a field that was
       not there, fell back to zero, and the mode's whole economy showed as
       empty while the hold behind it filled up and stopped taking motes. */
    cash: Math.floor(surv.cash), hold: holdCap(), carried: holdUsed(),
    /* The hold, itemised, with what the station you are standing in would
       pay for each — the price is the whole reason there is more than one
       station, so it travels with the goods rather than living in the shop. */
    /* The camera, which the panel needs and has never been given. Every arrow
       that points off the edge of the screen converts a world position into a
       screen one, and to do that it needs the camera's rotation and scale —
       with neither, the module fell back to `rot: 0, scale: 1`.

       So in the rotating view every one of them pointed at the wrong sky, and
       in *both* views the "is it already on screen" test was computed at 1:1
       when Survey actually draws at about 0.72. Switching the camera from fixed
       to rotating appeared to break every arrow because it did. */
    cam: { x: cam.x, y: cam.y, rot: cam.rot, scale: cam.scale },
    materials: MATERIALS.map(m => ({
      key: m.key, name: m.name, colour: m.colour, note: m.note,
      // How you get one, for the bubble the materials panel opens.
      where: m.where || "",
      value: m.value, n: surv.hold[m.key] || 0,
      /* How short this station is of it, 0 to 1. A shortage is a price and a
         price is a reason to fly somewhere, so the number that moved the price
         travels with it — the shop can say WANTED rather than leaving you to
         notice that iron is dearer here than it was yesterday. */
      shortage: surv.docked ? shortageOf(surv.docked, m.key) : 0,
      price: surv.docked ? stationPrices(surv.docked)[m.key] : null,
      // Whether anybody here will take it. See `placeBuys`.
      buys: placeBuys(surv.docked || surv.landed).has(m.key)
    })),
    worth: (() => {
      const at = surv.docked || surv.landed;
      if (!at) return 0;
      // Only what this place takes — see `placeBuys`. A total that counted
      // cargo the shop will not touch is a number that cannot come true.
      const takes = placeBuys(at);
      const pr = surv.docked ? stationPrices(surv.docked) : null;
      return MATERIALS.reduce((t, m) => takes.has(m.key)
        ? t + (surv.hold[m.key] || 0) * (pr ? pr[m.key] : m.value) : t, 0);
    })(),
    onSell: sellHold,
    onSellOne: sellSome,
    onSellPart: sellPart,
    onSellSupply: sellSupply,
    /* How the sector feels about you, as a word. This is the *only* place it is
       ever stated, it is never a figure, and it lives on a page you open rather
       than on the flight HUD — a meter in the corner would turn a reputation
       into a score to manage. */
    /* Where you stand with each power, as words, and who is fighting whom.
       The only place any of this is ever stated, and never as a figure. */
    /* Who is out there and what each of them makes of you, in the one shape
       the interface needs: a colour so it matches the ships, a line saying who
       they are, a word for how they feel, and who they are fighting. Never a
       number — see `REP`. */
    standings: FACTIONS.map(f => ({
      key: f.key, name: f.name, short: f.short, colour: f.colour,
      note: f.note, long: f.long, standing: standingOf(f.key).name,
      says: standingOf(f.key).note,
      enemy: warPairs()[f.key] ? factionOf(warPairs()[f.key]).short : "",
      atWar: !!warPairs()[f.key]
    })),
    /* The two flags that are not powers. They are on the same board because
       "who is that red one" is the same question, and the answer is not a
       reputation — it is who they are. */
    others: [UNALIGNED, PIRATE].map(f => ({
      key: f.key, short: f.short, name: f.name, colour: f.colour,
      note: f.note, long: f.long
    })),
    war: (() => {
      const w = warPairs();
      const pair = Object.keys(w);
      if (!pair.length) return null;
      return { a: factionOf(pair[0]).short, b: factionOf(w[pair[0]]).short,
               scale: warScale().name, note: warScale().note };
    })(),
    // Who is out there, and whether any of them has decided about you.
    traffic: surv.traffic.map(t => ({ kind: t.kind, hull: t.hull,
                                      x: t.x, y: t.y, angry: !!t.angry })),
    /* Life support. Seconds rather than fractions, and the fraction alongside,
       because the bar wants one and the readout wants the other. */
    water: { left: surv.water, full: WATER_FULL,
             frac: surv.water / WATER_FULL,
             countdown: surv.water <= 0 ? Math.max(0, THIRST_GRACE - surv.thirst) : 0,
             cost: supplyCost("water"),
             /* What a full tank fetches back, exact — the shop rounds it for
                display but quotes from this, so the number on the button is
                the number you get. See `sellSupply`. */
             sellFull: supplyUnit("water") / 2,
             /* The low-tank mark. `lit` is whether the triangle is showing at
                all, `shout` is how much of its ten seconds of WARNING is left,
                0 to 1, which the panel uses to slide the mark from beside the
                word to beside the number. */
             warn: { lit: surv.alert.water.lit,
                     shout: Math.max(0, surv.alert.water.shout / 10),
                     step: surv.alert.water.step } },
    food:  { left: surv.food, full: foodCap(),
             frac: surv.food / Math.max(1, foodCap()),
             countdown: surv.food <= 0 ? Math.max(0, HUNGER_GRACE - surv.hunger) : 0,
             cost: supplyCost("food"),
             sellFull: supplyUnit("food") / 2,
             warn: { lit: surv.alert.food.lit,
                     shout: Math.max(0, surv.alert.food.shout / 10),
                     step: surv.alert.food.step } },
    /* The hull, on the same panel as the water and the food, because it is the
       same question: what does this station have to sell me before I go back
       out. `cost` is null when there is nothing to mend. */
    repair: { hull: ships[0] ? ships[0].hull : 0,
              max: ships[0] ? ships[0].maxHull : 0,
              frac: ships[0] && ships[0].maxHull
                ? ships[0].hull / ships[0].maxHull : 1,
              cost: repairCost() },
    onRepair: buyRepair,
    skimming: surv.skimming > 0,
    melting: surv.melting > 0,
    onBuySupply: buySupply,
    /* The shop's own shelves, priced and ready to draw. Everything this station
       will sell you in one list, because that is what a market is — the player
       should be reading a list of things and prices, not hunting four panels
       for the four different ways this place takes money. */
    market: (surv.docked || surv.landed) ? (() => {
      const rows = [];
      /* The shipyard used to be the first row here, on the grounds that it is
         a thing the station offers. It is a *room* the station has, though,
         and it is a tab along the top now — beside the shop itself, where the
         other rooms of a station live. A shelf lists things you can put in
         the hold. */
      /* One row a tank, not three. It used to be a QUARTER, a HALF and a
         FILL — three rows each, priced pro rata, with any slice bigger than
         the room in the tank left out so the shop did not offer the same 20%
         three times at three prices. All of that was a quantity control made
         out of buttons, and there is a quantity control now: the row says
         what a whole tank costs and you dial in how much of one you want. */
      for (const [kind, name, colour] of [["water", "WATER", ICE_C],
                                          ["food", "FOOD", "#ffcb42"]]) {
        const full = kind === "water" ? WATER_FULL : foodCap();
        /* Rounded up, not down. The row asks in whole percent and the tank
           does not hold a whole number of them, so a tank 99.93% empty
           offered 99 — and "fill it" left you 146 seconds short, every time,
           for ever. `buySupply` clamps what it pours to the room that is
           actually there, so asking for the extra percent can only ever
           round the last sliver in; it cannot overfill or overcharge. */
        const room = Math.ceil((full - surv[kind]) / full * 100);
        if (room <= 0) continue;
        /* What they have, in tankfuls, capped to the room in yours. A world
           has no shelf and no limit — it is a planet with weather on it. */
        const shelf = surv.docked ? shelfOf(surv.docked) : null;
        const onHand = shelf ? Math.floor(shelf[kind] * 100) : room;
        if (onHand <= 0) continue;
        rows.push({ kind: "supply", key: kind, name, colour, label: "FILL",
                    // Priced by the tankful; the row works out the slice.
                    tank: supplyUnit(kind), most: Math.min(room, onHand),
                    left: shelf ? Math.floor(shelf[kind] * 100) : null,
                    have: Math.round(surv[kind] / full * 100) });
      }
      /* What this particular rock is made of, sold by the people standing on
         it. A world's whole shelf, and the reason to land on one. */
      if (surv.landed && surv.landed.trades && surv.landed.stock > 0) {
        const m = matSpec(surv.landed.trades);
        const each = Math.max(1, Math.round(m.value * 1.5 *
                      (1 + depthAt(surv.landed.x, surv.landed.y))));
        const stock = Math.max(0, Math.round(surv.landed.stock || 0));
        rows.push({ kind: "local", key: m.key, name: m.name, colour: m.colour,
                    label: "BUY", cost: each, each: each,
                    most: stock, left: stock });
      }
      // The rest of the shelf is a station's: a world has no yard, no dry
      // dock and no shelf of parts.
      if (!surv.docked) return rows;
      /* The dry dock, which is the drive spar's room. Away from home every
         station mends a hull the way it always did; at home it is the first
         thing you get back, because your hull is the first thing that
         breaks. */
      const fix = surv.docked.home && !stationHas("dock") ? null : repairCost();
      if (fix != null) {
        rows.push({ kind: "repair", key: "hull", name: "HULL REPAIR",
                    colour: "#ff8f77", label: "MEND", cost: fix,
                    have: Math.round(ships[0].hull) + " / " +
                          Math.round(ships[0].maxHull) });
      }
      /* Only the ones somebody sells. A part you can only find is not on
         anybody's shelf — that is what "only find" means — and listing it here
         greyed out would be a shop advertising something it will not sell you. */
      /* And the counter, which is the fusion core's. Nothing here is
         powered without it — so a dead home station sells water and food off
         a shelf and has no counter to sell a part over. Everywhere else is
         somebody else's station, working. */
      const shelf = surv.docked.home && !stationHas("counter")
                  ? null : shelfOf(surv.docked);
      for (const m of MODULES) {
        if (!shelf) break;
        if (!sellsIt(m)) continue;
        if (m.deep > stationDepth()) continue;
        // Only what is actually on the shelf this delivery. See `rollShelf`.
        const left = (shelf && shelf.parts[m.key]) || 0;
        if (left <= 0) continue;
        rows.push({ kind: "part", key: m.key, name: m.name,
                    colour: "#a08cff", label: "BUY", cost: m.cost,
                    most: left, left: left,
                    cat: m.cat, rarity: m.rarity, note: m.note,
                    weight: partWeight(m.key),
                    owned: storeCount(m.key) });
      }
      return rows;
    })() : [],
    /* `qty` means whatever the row's quantity control meant: a percentage of
       a tank, a count of parts, a count of units off a world. A door and a
       hull repair have no quantity and ignore it. */
    onBuyRow: (kind, key, qty) => {
      if (kind === "supply") return buySupply(key, (qty || 0) / 100);
      if (kind === "local") return buyLocal(qty || 1);
      if (kind === "repair") return buyRepair();
      if (kind === "part") {
        // One at a time, because that is the call that checks the hold and
        // the purse; the loop simply stops when one of them says no.
        let got = false;
        for (let i = 0; i < (qty || 1); i++) {
          if (!buyModule(key)) break;
          got = true;
        }
        return got;
      }
      if (kind === "ships") {
        if (!hangarOpen()) return false;
        state = "hangar";
        surveyHUD && surveyHUD.hangarOpened && surveyHUD.hangarOpened(surveyState());
        return true;
      }
      return false;
    },
    /* The world under you, if it is one you can do anything with. Two separate
       facts: somebody lives here, and there is air here. A world can be either
       or both, and the two of them are the difference between buying water and
       working for it. */
    landed: surv.landed && {
      name: surv.landed.name, kind: surv.landed.kind, r: surv.landed.r,
      colour: worldKind(surv.landed.kind).disc,
      air: !!surv.landed.air,
      /* What they dig here, what is left of it, and what they want for it.
         Cheaper than a station sells the same thing for, because you came to
         them — and finite, because a world is a place rather than a tap. */
      trades: surv.landed.trades ? (() => {
        const m = matSpec(surv.landed.trades);
        return { key: m.key, name: m.name, colour: m.colour, note: m.note,
                 left: Math.max(0, Math.round(surv.landed.stock || 0)),
                 price: Math.max(1, Math.round(m.value * 1.5 *
                                 (1 + depthAt(surv.landed.x, surv.landed.y)))) };
      })() : null,
      dist: Math.round(Math.hypot(surv.landed.x, surv.landed.y)),
      band: placeAt(surv.landed.x, surv.landed.y).space.name
    },
    overAir: surv.overAir && { name: surv.overAir.name },
    /* A ship that has run out, near enough to do something about. The panel
       needs to say who it is, what it would cost, and whether you can afford
       it — a prompt you cannot act on has to look like one. */
    helping: surv.helping && {
      flag: factionOf(surv.helping.faction).short,
      colour: factionOf(surv.helping.faction).colour,
      left: Math.max(0, Math.round(surv.helping.doom)),
      cost: GIVE_WATER, can: canGiveWater()
    },
    onWater: () => { giveWater(); },
    /* Who out here knows you by name, which is 6.5 made readable. Two short
       lists and never a number: a ship you helped, and a ship that got away.
       If you can say which ship it was, it happened.

       Not called `known` — that name was already taken by the gazetteer, the
       chart's list of everything you have charted, forty lines further down this
       same object. A duplicate key in an object literal is not an error in
       JavaScript; the second one simply wins, silently, and the chart or this
       board goes blank depending which way round they were written. */
    whoKnows: {
      friends: (surv.friends || []).map(f => ({
        name: f.name, faction: factionOf(f.faction).short,
        why: f.why, repaid: !!f.repaid
      })),
      grudges: (surv.grudges || []).map(g => ({ name: g.name, hp: g.hp }))
    },
    /* The named thing in reach, and the card for the one you asked about.
       `near` is what the panel offers; `lore` is what the page draws, and they
       are two fields rather than one so the card holds still while you read it. */
    near: surv.near || null,
    lore: surv.lore || null,
    onLook: () => { if (surv.near) { surv.lore = surv.near; state = "lore"; } },
    onLand: () => {
      if (!surv.landed) return;
      state = "landed";
      surveyHUD && surveyHUD.shopOpened && surveyHUD.shopOpened();
    },
    /* Buying off a world. Ten at a time, or whatever is left of the hold or of
       their stock — three taps to fill a hold beats thirty, and a world that
       runs out is a world you have to find another of. */
    onBuyLocal: buyLocal,
    // Dying, and coming back from it.
    death: surv.death,
    deaths: surv.deaths || 0,
    critical: !!(ships[0] && ships[0].hull <= 0 && !surv.death),
    lasted: Math.max(0, clock - surv.runStart),
    onRespawn: surveyRespawn,
    docked: !!surv.docked,
    /* Where the station is, so the panel can make the station itself the door.
       At one hull point the prompt line is taken by "THE NEXT HIT KILLS YOU" —
       which is the right thing for it to say and left a phone with no way into
       the shop at exactly the moment it needed one most. */
    dockAt: surv.docked ? { x: surv.docked.x, y: surv.docked.y } : null,
    /* Standing in the place the parts go. It used to mean the yard, which was
       somewhere else; it means your own station now, and it is what the panel
       and the manifest page both read to know whether the list in front of
       you is a delivery address or a reminder. */
    atHomeDock: atHomeStation(),
    /* What the ship can actually do right now, read off the four slots. The
       panel and the pages both used to ask the almanac; there is nothing to ask
       any more, and one of these is the difference between salvage that comes
       to you and salvage you have to chase one piece at a time. */
    tractor: mods().tractor ? SURVEY_TRACTOR * (1 + mods().reach) : 0,
    solar: !!mods().solar,
    warpTuned: !!mods().warp,
    canRunDark: !!mods().quiet,
    /* Every part in the game, with how you get one and whether you have it.
       The parts page lists all of them — a catalogue with holes in it is a
       catalogue you cannot plan from — so it needs the whole table, not only
       the buildable end of it. */
    parts: MODULES.map(m => ({
      key: m.key, name: m.name, cat: m.cat, rarity: m.rarity, note: m.note,
      cost: m.cost, deep: m.deep, secs: fitSeconds(m.key),
      weight: partWeight(m.key),
      get: m.get.slice(), where: m.where || "",
      buyable: sellsIt(m), craftable: craftsIt(m), findable: findsIt(m),
      bossable: has(m, "boss"),
      // Whether you have met one. See `markSeen` — it is what puts a part you
      // cannot build onto the workbench page at all.
      seen: surv.seen.has(m.key),
      owned: storeCount(m.key),
      fitted: surv.slots.some(sl => sl && sl.key === m.key)
    })),
    /* The devices fitted, in slot order: what they are, which key or thumb
       button answers to them, and how much of the wait is left. The panel
       draws one chip each — see `drawDevices` — and the chip is the only place
       a cooldown is ever stated, because it is the only place it is ever
       acted on. */
    devices: devicesFitted().map(d => ({
      slot: d.slot, key: d.key, name: d.dev.name, tag: d.dev.tag,
      cd: d.cd, cool: d.dev.cool, ready: d.cd <= 0,
      hint: DEVICE_KEYS[d.slot] && DEVICE_KEYS[d.slot].length
        ? keyLabel(DEVICE_KEYS[d.slot][0]) : ""
    })),
    onDevice: i => useDevice(i),
    /* The four slots, what is in them, and how long until it works. Every
       ship has four; that never varies and the page should never suggest it
       might. */
    slots: surv.slots.map(sl => {
      if (!sl) return null;
      const m = moduleSpec(sl.key);
      return { key: sl.key, name: m.name, cat: m.cat, rarity: m.rarity,
               note: m.note, fit: sl.fit, of: fitSeconds(sl.key) };
    }),
    /* What you own and are not flying, one row a kind — and what it is
       costing you to carry, because that is the half of the page that used to
       be invisible. `weight` is per one of them; `held` is what this row is
       taking out of the hold in total. */
    store: MODULES.filter(m => storeCount(m.key) > 0).map(m => ({
      key: m.key, name: m.name, cat: m.cat, rarity: m.rarity, note: m.note,
      n: storeCount(m.key), secs: fitSeconds(m.key),
      weight: partWeight(m.key), held: partWeight(m.key) * storeCount(m.key),
      fitted: surv.slots.some(sl => sl && sl.key === m.key),
      // What this place would give for one. See `partResale`.
      sell: partResale(m, surv.docked || surv.landed)
    })),
    // What the parts in the hold weigh, all told. The materials are the rest.
    partWeight: storeWeight(),
    /* What this station has on the shelf. Rarity decides how far out you have
       to be before anybody stocks it, which is the danger curve paying out. */
    /* `sellsIt` as well as the depth, and the missing half of that condition
       put three find-only parts on the first shelf in the game — the tractor
       beam at 340, and the warp tuner and running dark at *nothing*, because a
       part nobody sells has no price to quote. Two of the three almanac verbs,
       free, on turn one. The shelf and `buyModule` both check now: a list that
       offers what the action refuses is the same bug written twice. */
    forSale: surv.docked
      ? MODULES.filter(m => sellsIt(m) && m.deep <= stationDepth()).map(m => ({
      key: m.key, name: m.name, cat: m.cat, rarity: m.rarity, note: m.note,
      cost: m.cost, secs: fitSeconds(m.key), owned: storeCount(m.key),
      weight: partWeight(m.key),
      fitted: surv.slots.some(sl => sl && sl.key === m.key)
    })) : [],
    /* What each part actually does, so the page can total up what you are
       flying with rather than keeping its own copy of the numbers. A second
       copy of a balance table is a second table to get wrong. */
    effects: (() => {
      const out = {};
      for (const m of MODULES) out[m.key] = m.eff;
      return out;
    })(),
    /* The build book, already answered. Every build with what it wants, what
       you have of it, whether the part it eats is aboard, and — the reverse
       lookup — what each material you are carrying is an ingredient for, which
       is what turns three reactor cores from a curiosity into a lead. */
    crafts: CRAFTS.map(r => {
      const m = moduleSpec(r.out);
      const rs = craftState(r.out);
      return { key: r.out, name: m.name, cat: m.cat, rarity: m.rarity,
               note: m.note, cost: m.cost, secs: fitSeconds(r.out),
               owned: storeCount(r.out),
               fitted: surv.slots.some(sl => sl && sl.key === r.out),
               rows: rs.rows, part: rs.part, ready: rs.ready };
    }),
    usedIn: MATERIALS.reduce((o, m) => { o[m.key] = usedIn(m.key); return o; }, {}),
    onCraft: key => craft(key),
    onFit: (i, key) => fitModule(i, key),
    onPull: i => pullModule(i),
    onBuyPart: key => buyModule(key),
    objective: objective(),
    fix: objectiveFix(),
    /* Flattened for the panel: the minimap draws these as dots for as long as
       they last, which is the half of a scan that used to be missing. Anything
       a scan reaches is up to 3,885 units away and the view is about 700
       across, so before this the returns from a scan were almost all off
       screen and the button's whole answer was a line of text. */
    echoes: surv.echoes.map(e => {
      // Named and coloured when the scan was made; see `surveyScan`.
      return { kind: e.kind, x: e.x, y: e.y, t: e.t, life: ECHO_LIFE,
               name: e.name, colour: e.colour, bad: !!e.bad };
    }),
    scanReach: scanRange(),
    pins: surv.pins,
    world: surv.world,
    /* The gazetteer, plus every part lying on the floor — and the second half
       is why this is not just `surv.known`.

       A part you died carrying is written to the map by `noteKnown`, and that
       turns entries away once the gazetteer is full: `KNOWN_CAP` is 600, and a
       well-charted run reaches it. So the one marker in the mode you cannot
       afford to lose was the one being dropped, silently, and only on the runs
       that had gone well enough to fill the map — which is exactly what "it
       sometimes vanishes" looks like from the cockpit.

       `surv.dropped` is the authority and it cannot overflow: it is what the
       world spawns the part from, it survives the book, and it is a few dozen
       entries at the very most. Deduped against the gazetteer so a marker that
       *did* get written is not drawn twice. */
    known: (() => {
      const out = [...surv.known.values()];
      for (const d of surv.dropped) {
        if (surv.known.has(knownId("part", d.x, d.y))) continue;
        const spec = droppedSpec(d);
        out.push({ k: "part", x: d.x, y: d.y,
                   name: spec ? spec.name : (d.name || ""), r: 0 });
      }
      return out;
    })(),
    /* Where the parts go, for the chart to mark. It is the home station now,
       so this is the same point the chart already draws a station at — the
       mark says what the place still wants rather than where a second place
       is. */
    home: { x: HOME_STATION.x, y: HOME_STATION.y,
            built: surv.built.size, needs: BUILD.length },
    /* Where you are: whose sky, which biome, and how dangerous the two are
       together. The panel draws the first two in words and the third as a
       bar; see `drawSector`. */
    place: placeAt(ships[0] ? ships[0].x : 0, ships[0] ? ships[0].y : 0),
    /* What the chart knows about borders. BIOMES.md once kept biomes off
       the chart entirely, and Ric turned that round: a biome and a territory
       are named, and their borders are drawn *where you have mapped them*.
       `mapped` is the record ("cx,cy" → the biome and holder you saw), and
       the rest is what the chart needs to draw a cell: where its site is, and
       what each biome and each holder is called and coloured. */
    terrain: {
      mapped: surv.mapped,
      // Bumped whenever a recorded cell changes, so the chart knows to regroup.
      mappedStamp: surv.mappedStamp || 0,
      cell: REGION_CELL,
      site: (cx, cy) => WORLD.regionSite(cx, cy),
      biome: k => {
        const r = REGIONS.find(q => q.key === k);
        return r ? { name: r.name, colour: r.colour } : null;
      },
      holder: o => {
        const f = FACTIONS.find(q => q.key === o);
        if (f) return { name: f.short + " SPACE", colour: f.colour, power: true };
        const sp = WORLD.SPACES[o];
        return sp ? { name: sp.name, colour: sp.colour, power: false } : null;
      }
    },
    warn: surv.warn,
    /* `snap` is a world-space radius the chart works out from its own zoom —
       the same finger-width on screen is a very different distance when the
       map is zoomed out, and the interface is the only thing that knows the
       scale. */
    /* Lifting one, which is a separate question from placing one now that
       placing has to be armed by a button. Returns whether it found one to
       lift, so the chart knows whether the tap was spent. */
    onPinNear: (x, y, snap) => {
      const near = surv.pins.findIndex(q =>
        dist2(q.x, q.y, x, y) < (snap || 400) ** 2);
      if (near < 0) return false;
      const pin = surv.pins[near];
      askYesNo("Remove " + (pin.name ? "“" + pin.name + "”" : "this pin") +
               "?", () => {
        const i = surv.pins.indexOf(pin);
        if (i < 0) return;
        surv.pins.splice(i, 1);
        gameSound("start");
        saveSurveyBook();
      });
      return true;
    },
    /* Tapping a charted thing with nothing armed: keep an eye on it. The
       arrow it gets is permanent — that is the whole difference between this
       and a scan return, which is a pulse and fades like one. Tapping the same
       one again lets it go. */
    onSelect: (x, y, snap) => {
      let best = null, bd = (snap || 400) ** 2;
      /* Your own pins first, then anything charted. A pin is a place you
         decided mattered — the *most* likely thing you meant when you tapped
         there — and it used to be the one kind of mark on the chart you could
         not point the ship at. */
      for (const q of surv.pins) {
        const d = dist2(q.x, q.y, x, y);
        if (d > bd) continue;
        bd = d; best = { x: q.x, y: q.y, k: "pin", name: q.name || "PIN" };
      }
      for (const q of surv.known.values()) {
        const d = dist2(q.x, q.y, x, y);
        if (d > bd) continue;
        bd = d; best = q;
      }
      if (!best) return false;
      const same = surv.selected &&
                   Math.abs(surv.selected.x - best.x) < 2 &&
                   Math.abs(surv.selected.y - best.y) < 2;
      surv.selected = same ? null
        : { x: best.x, y: best.y, k: best.k,
            name: best.name || String(best.k || "").toUpperCase() };
      // It flashes where you touched it, so the chart answers the tap.
      surv.selectFlash = same ? 0 : 1;
      gameSound("start");
      chatter(surv.selected
                ? "Watching " + surv.selected.name + "."
                : "Not watching anything now.", NEBULA);
      saveSurveyBook();
      return true;
    },
    onPin: (x, y, kind, snap) => {
      if (surv.pins.length >= 200) { gameSound("hit"); return; }
      /* Nothing is placed until the prompt is answered. It used to drop the pin
         first and ask afterwards, so cancelling left an unnamed dot behind —
         and "cancel" has to mean nothing happened.

         Endless space has no place names. The only way anywhere out here gets
         one is if you say so, and the colour travels *with* the pin rather than
         being looked up from its kind later: a palette edited one day would
         otherwise repaint every mark anybody had ever made, and a mark whose
         colour changes under you is a mark you stop trusting. */
      const kinds = surveyHUD && surveyHUD.pinKinds ? surveyHUD.pinKinds() : [];
      askPin(kinds, answer => {
        if (!answer) return;
        surv.pins.push({ x, y, kind: answer.kind,
                         name: String(answer.name || "").slice(0, 24),
                         colour: pinColour(answer.kind) });
        gameSound("start");
        saveSurveyBook();
      });
    },
    manifest: BUILD.map(b => ({ key: b.key, name: b.name, clue: b.clue,
                                where: b.where, opens: b.opens,
                                service: (serviceSpec(b.opens) || {}).name,
                                have: surv.built.has(b.key),
                                carrying: surv.carrying.has(b.key) })),
    /* ── THE MARKET ───────────────────────────────────────────────────────
       What the ranging lens is for: a lens is how a station sees past its own
       dock, and what it sees is what everywhere else is paying. One row a
       material you are carrying — the board answers *where do I take this*,
       so a row for something you have not got is a row about nothing — with
       what home pays, the best standing price on the chart, and how far that
       is.

       Only at home, and only once the lens is in. Every other station in the
       sector has its own counter and its own prices and no reason to tell you
       about anybody else's. */
    payBoard: stationHas("market") && surv.docked && surv.docked.home ? (() => {
      const mine = stationPrices(surv.docked);
      const best = bestPayers();
      const me = ships[0] || { x: 0, y: 0 };
      const out = [];
      for (const m of MATERIALS) {
        const n = surv.hold[m.key] || 0;
        if (n <= 0) continue;
        const b = best[m.key];
        out.push({ key: m.key, name: m.name, colour: m.colour, n,
                   here: mine[m.key] || m.value,
                   best: b ? b.pays : null,
                   range: b ? rangeBand(Math.hypot(b.x - me.x, b.y - me.y)) : "",
                   bearing: b ? bearingTo(me, b) : null });
      }
      return out;
    })() : null,
    /* Every room of your own station, lit or dark, and what a dark one is
       waiting for. The page decides nothing: it draws what is off, the part
       that turns it on and where that part is kept. A missing row teaches
       nothing; a dark one teaches everything. */
    services: SERVICES.map(s => {
      const p = s.part ? partSpec(s.part) : null;
      return { key: s.key, name: s.name, does: s.does,
               live: stationHas(s.key),
               part: p ? p.name : null,
               clue: p ? p.clue : null,
               where: p ? p.where : null,
               carrying: !!(p && surv.carrying.has(p.key)) };
    }),
    built: surv.built.size, needs: BUILD.length,
    /* ── the long list ────────────────────────────────────────────────────
       The parts a player cannot meet, which turned out to be most of the good
       ones. Three pages each correctly refused this job: the shop will not
       advertise what it does not stock, the workbench threw out everything it
       could not build, and the almanac is a record rather than a shop. All
       three were right and the result was that nothing picked it up — so the
       best part in every category was something you could only own by
       accident, and `surv.seen`, the set whose whole purpose is "a thing you
       know exists and can plan a trip towards", could never be told about
       them.

       The test is *can this part be met near home*: anything the workbench
       lists is met, and anything a home shelf stocks is met. What is left is
       eleven — the two nobody sells, and the nine whose `deep` puts them on a
       shelf hundreds of thousands of units out. That is not a shop. It is the
       same thing the manifest is: a list of things that are somewhere else.

       Only after the gate, because before it the manifest is the list and two
       lists is no list at all. */
    longList: stationWhole()
      ? MODULES.filter(m => !craftsIt(m) && (!sellsIt(m) || m.deep > 0))
          .map(m => ({
            key: m.key, name: m.name, cat: m.cat, rarity: m.rarity,
            note: m.note,
            /* Where it is, twice: the prose if somebody wrote one — the two
               nobody sells have one — and a tag short enough to sit in a
               column beside the name.

               The tag is derived rather than written down, because `deep` is
               already an address: it is how dangerous a station's sky has to
               be before it stocks one. That used to convert into a band and a
               range; danger is the biome and the owner now, so it converts
               into the kind of place instead. A part whose depth is retuned
               cannot end up wearing a line that lies about it, which is the
               failure mode every hand-kept table in this mode has shipped at
               least once. */
            where: m.where || "",
            at: m.deep > 0 ? dangerWords(m.deep * SHELF_REACH) : "FOUND, NEVER SOLD",
            have: storeCount(m.key) > 0 || modFitted(m.key),
            seen: surv.seen.has(m.key)
          }))
      : [],
    onUndock: () => { state = "playing"; },
    builds: STATION_BUILD,
    /* The mouth, which is the sixth part and not the whole six: every
       service on this station is lit by one delivery, and this is the one
       the ablative plate lights. */
    wormhole: stationHas("mouth"),
    onJump: (x, y) => lightJump(x, y),
    /* The light drive. `run` is how far it has wound up, 0 to 1, so the panel
       can show it spooling rather than snapping on. */
    light: {
      have: !!surv.hasLight,
      cost: LIGHT_DRIVE.cost,
      name: LIGHT_DRIVE.name, does: LIGHT_DRIVE.does, blurb: LIGHT_DRIVE.blurb,
      buildable: stationWhole() && !surv.hasLight,
      afford: surv.cash >= LIGHT_DRIVE.cost,
      run: surv.lightRun ? Math.min(1, surv.lightRun / LIGHT_SPOOL) : 0,
      hit: surv.lightHit && { eta: surv.lightHit.eta, name: surv.lightHit.name,
                              what: surv.lightHit.what },
      warnAt: LIGHT_WARN
    },
    onLight: toggleLightDrive,
    onBuildLight: buildLightDrive,
    /* The roster, as the hangar sees it. Every hull with its eight numbers and
       whether you own it, fly it, or could afford it — the page does no
       arithmetic of its own, so what it shows and what buying does cannot
       drift apart. */
    ships: SHIPS.map(sh => ({
      key: sh.key, name: sh.name, category: sh.category, best: sh.best,
      note: sh.note, cost: sh.cost,
      hull: sh.hull, dmg: sh.dmg, rate: sh.rate, cargo: sh.cargo,
      speed: sh.speed, accel: sh.accel, turn: sh.turn, drag: sh.drag,
      /* And the same three in the units the sector is measured in, worked
         out here because the page does no arithmetic of its own. Ric: the
         multipliers were "a random number x" — a Needle at 2.20x meant
         nothing next to a scan that reaches 2,100u and a well 3,000 wide. */
      topSpeed: Math.round(sh.speed * MAX_SPEED),
      push: Math.round(sh.accel * THRUST),
      turnRate: Math.round(sh.turn * TURN * 180 / Math.PI),
      // Always a number here, so the page never has to know the default.
      burst: sh.burst || BURST_SIZE,
      // What actually stops this hull, and how far its outline reaches.
      hitR: sh.hitR, noseX: sh.noseX, tailX: sh.tailX, tough: !!sh.tough,
      /* The axes that are not speed and not grip. A hull that winds up slowly
         or loses its turn at speed is doing something a stat bar cannot show,
         and something a harness could not check at all while these lived only
         on the ship. See `applyRefit`. */
      spool: sh.spool || 0,
      bite: sh.bite == null ? 1 : sh.bite,
      punch: sh.punch || 0,
      ram: !!sh.ram,
      weapon: sh.weapon || null,
      shot: sh.shot, size: sh.size,
      art: sh.art, fins: sh.fins || null, guns: sh.guns || null,
      ribs: sh.ribs || null, pods: sh.pods || null, windows: sh.windows || null,
      owned: surv.owned.has(sh.key),
      flying: surv.ship === sh.key,
      afford: surv.cash >= sh.cost
    })).sort((a, b) => SHIP_CATEGORIES.indexOf(a.category) -
                       SHIP_CATEGORIES.indexOf(b.category) ||
                       a.cost - b.cost),
    /* `shipName`, not `ship`. `ship` is the ship *object* the whole panel reads
       — hull, position, heading — and calling this one `ship` too silently
       replaced it with a string, so every readout that touched it went to NaN.
       The hull bar was drawing a bar of width NaN and nothing said a word. */
    shipName: shipSpec(surv.ship).name,
    onBuyShip: buyShip,
    atHome: hangarOpen(),
    onHangar: () => {
      if (!hangarOpen()) return;
      state = "hangar";
      surveyHUD && surveyHUD.hangarOpened && surveyHUD.hangarOpened(surveyState());
    },
    onRefit: () => {
      if (surv.docked) { state = "refit"; surveyHUD && surveyHUD.refitOpened(); }
    },
    almanac: ALMANAC.map(e => ({ key: e.key, name: e.name, note: e.note,
                                 secret: e.secret, found: surv.found.has(e.key) })),
    onScan: surveyScan,
    onChart: () => { state = "chart"; surveyHUD.chartOpened(surveyState()); },
    onAlmanac: () => { state = "almanac"; },
    /* `I` and the flight panel's button reach the cargo; `G` and the strip
       reach the ship. They used to be one page and one key, which is why the
       key that meant "loadout" opened a page of ore. */
    onInventory: () => {
      state = "inventory";
      surveyHUD && surveyHUD.cargoOpened && surveyHUD.cargoOpened();
    },
    onShip: () => { state = "ship"; surveyHUD && surveyHUD.shipOpened(); },
    onRecord: () => {
      state = "record";
      surveyHUD && surveyHUD.recordOpened && surveyHUD.recordOpened();
    },
    // The loadout was always this page; it just had the cargo bolted to it.
    onLoadout: () => { state = "ship"; surveyHUD && surveyHUD.shipOpened(); },
    onCraftPage: () => { state = "craft"; surveyHUD && surveyHUD.craftOpened(); },
    /* The station's two extra rooms. Both refuse from open space for the same
       reason the shop does: they are places, and you have to be in one. */
    onStationInv: () => {
      if (!surv.docked && !surv.landed) { gameSound("hit"); return; }
      state = "stationinv";
      /* Whichever sub-page it is about to show gets its own "opened" call, so
         a scroll position left over from the last visit is reset exactly the
         way it is when the page is opened on its own. */
      const sub = surveyHUD && surveyHUD.stationTab
                ? surveyHUD.stationTab() : "ship";
      if (!surveyHUD) return;
      if (sub === "ship" && surveyHUD.shipOpened) surveyHUD.shipOpened();
      else if (sub === "craft" && surveyHUD.craftOpened) surveyHUD.craftOpened();
      else if (sub === "chart" && surveyHUD.chartOpened) {
        surveyHUD.chartOpened(surveyState());
      }
    },
    /* ── the machines in the corner ────────────────────────────────────
       Everywhere you can trade, you can play: a station's counter and an
       inhabited world's surface both have a cabinet, and a machine you can
       only find at some stations is a machine nobody finds.

       The room does no arithmetic. What it draws is this: which cabinets
       there are, whose the place is, and your best on this one — worked out
       here, said in words here, so the page cannot disagree with the book.
       See `CABINETS` and `SIM_SCORE`. */
    arcade: (() => {
      const spot = cabinetHere();
      if (!spot) return null;
      return {
        where: spot.where, owner: spot.owner, colour: spot.colour,
        pick: arcadePick,
        /* Which machine is coming up, and how far it has got. The page draws
           a boot line over that cabinet and nothing else moves. */
        booting: simBoot ? simBoot.key : null,
        /* The board of the machine you are standing in front of. It follows
           the selection rather than belonging to a cabinet, so moving along
           the row reads the next machine's people — which is what makes the
           three cabinets a room rather than three buttons. */
        board: simBoardOf(spot, (CABINETS[arcadePick] || CABINETS[0]).key),
        boardOf: (CABINETS[arcadePick] || CABINETS[0]).name,
        /* The board says a score the same way the cabinet above it does, out
           of the one table, because a board that called it WAVE 9 under a
           machine that called it 9 would be two machines. */
        say: SIM_SCORE[(CABINETS[arcadePick] || CABINETS[0]).key].say,
        youColour: PLAYERS[0].colour,
        bootAt: simBoot ? 1 - Math.max(0, simBoot.t) / SIM_BOOT : 0,
        machines: CABINETS.map(c => {
          const best = simBest(spot.id, c.key);
          return { key: c.key, name: c.name, line: c.line, art: c.art,
                   colour: c.colour,
                   cap: SIM_SCORE[c.key].cap,
                   best: best ? SIM_SCORE[c.key].say(best) : "NOT PLAYED" };
        })
      };
    })(),
    onArcade: () => {
      if (!surv.docked && !surv.landed) { gameSound("hit"); return; }
      arcadePick = 0;
      state = "arcade";
    },
    onPlaySim: key => startSim(key),
    /* The two things that used to be behind the front page's SIMULATORS door.
       A cabinet is somebody playing alone; the room also has people in it,
       and a board on the wall that other people are on.

       Top-level, beside the room's other actions, and not inside `arcade`:
       the page reads them as `st.onPeople`, and `test/survey.js` compares
       every `st.something` the interface reads against what the game
       actually sends — which is how a pair of buttons that could never have
       fired was caught before anybody pressed one. */
    onPeople: () => openWithPeople(),
    onBoard: () => openBoards(),
    // A machine that is already coming up ignores the next coin.
    simBooting: !!simBoot,
    onPickSim: i => { arcadePick = Math.max(0, Math.min(CABINETS.length - 1, i)); },
    onWormhole: () => {
      if (!stationHas("mouth")) { gameSound("hit"); return; }
      if (!surv.docked) { gameSound("hit"); return; }
      state = "wormhole";
    },
    // The nav strip's own destination for the station itself.
    onStation: () => {
      if (surv.docked) {
        state = "refit";
        surveyHUD && surveyHUD.refitOpened();
        surveyHUD && surveyHUD.marketOpened();
      }
    },
    onMissions: () => { state = "missions"; },
    onClose: () => { state = "playing"; }
  };
}

/* The world, drawn for a page to sit on. The camera, the sky, the sector and
   nothing else — no HUD, because the page has its own and two sets of readouts
   over each other is worse than none. */
function drawSurveyBehind(dt) {
  if (!surv) return;
  ctx.save();
  wScale = cam.scale;
  ctx.translate(SCREEN_W / 2, SCREEN_H / 2);
  ctx.rotate(cam.rot);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);
  drawSurveyWorld();
  for (const r of rocks) {
    if (onScreen(r.x, r.y, r.r + 20)) drawRock(r);
  }
  for (const s2 of ships) if (s2.alive) drawShip(s2);
  ctx.restore();
  drawBits();
}

/* The boss bar, across the top of the screen while a boss is after you:
   whose sky it is, the boss's name, its hull, and how far off it is. And for
   the first seconds after you cross into any boss's sky, friendly or not, a
   banner in the middle of the screen, because a line in the radio is easy to
   miss. */
function drawBossBar() {
  if (!surv.inLair && surv.leftBanner > 0 && surv.lairLeft) {
    const k = Math.min(1, surv.leftBanner / 0.6);
    text("LEAVING " + BOSS_SKY[surv.lairLeft.kind], SCREEN_W / 2, SCREEN_H * 0.3, 22,
         NEBULA, "center", k);
    text(surv.lairLeft.name, SCREEN_W / 2, SCREEN_H * 0.3 + 26, 14, NEBULA, "center", k * 0.8);
  }
  const L = surv.inLair;
  if (!L) return;
  const me = ships[0];
  const b = surv.traffic.find(t => t.lairId === L.id);
  const cx = SCREEN_W / 2;
  if (surv.lairBanner > 0) {
    const k = Math.min(1, surv.lairBanner / 0.6, (4 - surv.lairBanner) / 0.3);
    text("ENTERING " + BOSS_SKY[L.kind], cx, SCREEN_H * 0.3, 26, BOSS_COLOUR,
         "center", Math.max(0, k));
  }
  /* The bar is for a boss that is after you. Ric: "no top bar on ones that
     are friendly or neutral. if they are hostile the bar pops up." So it
     appears the moment the boss, or its crew, would come for you (entering a
     pirate's sky, or starting something with a queen) and not before. It
     fades in over a third of a second so it reads as an event. */
  const foe = !!b && (bossHostile(b) || b.angry ||
    surv.traffic.some(t => t.leadId === b.id && t.angry));
  surv.barIn = foe ? Math.min(1, (surv.barIn || 0) + 1 / 20) : 0;
  if (!foe) return;
  const fade = surv.barIn;
  const top = 26;
  const w = Math.min(440, SCREEN_W * 0.44) * (0.6 + 0.4 * fade);
  text(BOSS_SKY[L.kind] + (L.faction && L.faction !== "free" && L.faction !== "pirate"
         ? "  \u00b7  " + factionOf(L.faction).short : ""),
       cx, top, 11, BOSS_COLOUR, "center", 0.8 * fade);
  text(L.name, cx, top + 20, 17, BOSS_COLOUR, "center", fade);
  const frac = Math.max(0, b.hp / b.maxHp);
  const y = top + 32;
  glow(BOSS_COLOUR, 5, 0.22 * fade, () => {
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
  });
  glow(BOSS_COLOUR, 5, 0.95 * fade, () => {
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - w / 2 + w * frac, y); ctx.stroke();
  });
  const far = Math.hypot(b.x - me.x, b.y - me.y);
  text(far < 1000 ? Math.round(far) + "u" : (far / 1000).toFixed(1) + "k",
       cx + w / 2 + 10, y + 4, 11, BOSS_COLOUR, "left", 0.8 * fade);
}

function drawSurveyPanel(dt) {
  if (!surv || !surveyHUD) return;
  surveyHUD.drawPanel(surveyState(), dt);
  drawBossBar();
  /* Radio used to be drawn here, on two lines above the status strip. It is in
     the notification stack now — see `chatter` — so there is nothing left for
     this function to add and the bottom of the screen is the hull bar and
     nothing else. */
}

/* The title row says where you got to, if you have been before. A mode that
   remembers should say so on the way in, not once you are already inside. */
/* ── what the front page says about your sector ───────────────────────────
   The title asks the book one question — is there a sector, and how much of
   it have you written down — and the title is drawn sixty times a second. The
   book is up to half a megabyte of JSON and reading it decodes a fog bitfield,
   so asking per frame would put a parse of the whole save inside the render
   loop, which is the kind of cost that shows up as a stutter on the one screen
   a new player judges the game on.

   So it is read once and kept. The answer can only change in two places — a
   run ending back at the title, and the wipe — and both throw it away. */
let titleCard = null;
const forgetTitleCard = () => { titleCard = null; };

function titleSurvey() {
  if (titleCard) return titleCard;
  const b = loadSurveyBook();
  const started = !!(b && b.seed);
  const found = (b && b.found && b.found.length) || 0;
  /* `started` is the book having a seed, not the blurb having a separator in
     it. A sector you have flown for ten minutes without logging anything is
     still a sector, and a front page that offered to BEGIN one would be
     lying about what its own button does. */
  titleCard = {
    started,
    head: started ? "CONTINUE THE SECTOR" : "BEGIN THE SURVEY",
    /* Short. This sits under the one button on the front page, and the
       front page is not where the game explains itself — a count is a fact
       about your sector and earns its line; a sentence about what Survey is
       does not. */
    sub: started
      ? (found ? found + " LOGGED" : "where you left it")
      : "one pilot, one chart"
  };
  return titleCard;
}

function surveyBlurb() {
  const b = loadSurveyBook();
  if (!b.seed || !b.found.length) return MODES.survey.blurb.toUpperCase();
  /* How many, never out of how many. The book used to say 31 / 34, which
     tells a player at the far end of twenty hours that there are exactly three
     strange things left — and the whole design of the last tier is that those
     three break rules the game spent twenty hours teaching. A countdown to them
     makes them a checklist to finish rather than something to run into. */
  return b.found.length + " LOGGED \u00b7 CONTINUE THE SECTOR";
}

function spotIsClear(x, y) {
  const r = SHIP_R * U;
  if (rocks.some(k => gap2(x, y, k.x, k.y) < (k.r + 95 * U) ** 2)) return false;
  if (ships.some(s => s.alive && gap2(x, y, s.x, s.y) < (r * 3) ** 2)) return false;
  // Respawning inside a gravity well is a death sentence you didn't earn.
  if (hazards.some(h => hazardActive(h) &&
                      dist2(x, y, h.x, h.y) < (h.kill + 220) ** 2)) return false;
  /* Nor inside a world. This never mattered while a planet was 200 units
     across and there was no reason to spawn near one; a planet can be 3,600
     units across now, and appearing inside one is appearing inside a wall. */
  if (mode.survey && surv &&
      surv.planets.some(pl => dist2(x, y, pl.x, pl.y) < (pl.r + r + 200) ** 2)) {
    return false;
  }
  // Nor inside anything somebody built. See `inBuilt`.
  if (mode.survey && inBuilt(x, y, r + 200)) return false;
  return x > bounds.x0 + r && x < bounds.x1 - r &&
         y > bounds.y0 + r && y < bounds.y1 - r;
}

/* ── where a ship is allowed to appear ────────────────────────────────────
   A spawn has three rules, and they are not equally negotiable.

     inside the wall     — outside it is unreachable, and the old code could
                           land you there because the spawn ring belongs to
                           the full map, not to whatever the wall has shrunk
                           to. Hard rule.
     clear of a hazard   — a sun or a black hole is instant death you did not
                           earn. Hard rule.
     not inside a rock   — the negotiable one, because it is the only one
                           where something else can move instead.

   The old version searched eighty points, and if none of them was clear it
   returned whichever had been least bad — a point that could be inside a rock
   or inside a kill radius — and the caller would then place the ship there
   anyway after three seconds rather than bench a player. That is where
   spawning inside an asteroid came from. Now the search only ever returns a
   point satisfying the two hard rules, and if it cannot find one that is also
   clear of rocks, the rocks are what give way. */
/* Clear of a hazard means clear of its *pull*, not of the ball in the middle.
   A star kills within 46 and pulls from 380; the black holes pull from 520 and
   650. Measuring the spawn rule from the kill radius put every "legal" spawn
   deep inside a well, so the ship was hauled in during the two and a half
   seconds it was invulnerable and died the instant that ran out — which is
   indistinguishable, from the seat, from spawning on top of a sun. Audited:
   every ship found inside a kill radius had arrived there that way.

   Late on, a shrunk arena may have no point outside every well. Then this
   falls back through worse options in order, and the last of them still keeps
   its distance from anything lethal. */
const SPAWN_KILL_MARGIN = 140;

function wellGapAt(x, y) {        // negative means inside the pull
  let gap = Infinity;
  for (const h of hazards) {
    if (hazardActive(h)) gap = Math.min(gap, Math.hypot(x - h.x, y - h.y) - h.reach);
  }
  return gap;
}

function killGapAt(x, y) {
  let gap = Infinity;
  for (const h of hazards) {
    if (hazardActive(h)) gap = Math.min(gap, Math.hypot(x - h.x, y - h.y) - h.kill);
  }
  return gap;
}

function rockGapAt(x, y) {
  let gap = Infinity;
  for (const r of rocks) gap = Math.min(gap, Math.sqrt(gap2(x, y, r.x, r.y)) - r.r);
  return gap;
}

function shipGapAt(x, y, self) {
  let gap = Infinity;
  for (const s of ships) {
    if (s !== self && s.alive) gap = Math.min(gap, Math.sqrt(gap2(x, y, s.x, s.y)));
  }
  return gap;
}

// Anything overlapping the spot a ship is about to occupy is destroyed rather
// than spawned inside. This is the same end a rock meets at the wall, and it
// only ever runs when every candidate point was under one.
function clearRocksAt(x, y, radius) {
  let any = false;
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    if (gap2(x, y, r.x, r.y) < (r.r + radius) ** 2) {
      burst(r.x, r.y, "#ffcb42", 8, 130 * U);
      rocks.splice(i, 1);
      any = true;
    }
  }
  // One crunch for the lot: they all go on the same frame.
  if (any) gameSound("rock", x, y);
}

function respawnPoint(ship) {
  // Campaign reinforcements fly in from their own side of the map, not from a
  // ring round the middle — a fresh enemy appearing amidships would be a ship
  // teleporting into your six. Yours enter behind you, theirs from their line.
  if (mode.campaign) return campaignSpawnPoint(ship);
  const cx = (bounds.x0 + bounds.x1) / 2;
  const cy = (bounds.y0 + bounds.y1) / 2;
  const r = SHIP_R * U;
  const room = Math.min(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  // Never wider than the arena can actually hold, or every candidate is
  // rejected for being outside a wall that has closed past the margin.
  const margin = Math.max(r + 1, Math.min(90 * U, room * 0.22));
  const facing = (x, y) => Math.atan2(cy - y, cx - x);

  const inside = (x, y) =>
    x > bounds.x0 + margin && x < bounds.x1 - margin &&
    y > bounds.y0 + margin && y < bounds.y1 - margin;

  /* The ring point first, then the middle, then a spread of random points and
     a coarse grid. The grid is what makes this reliable rather than lucky: a
     small arena late in a match can be mostly rock, and random sampling alone
     can miss the one gap that exists. */
  const tries = [];
  const ring = spawnPoint(ship.id, players);
  tries.push({ x: ring.x, y: ring.y, a: ring.a });
  tries.push({ x: cx, y: cy });
  for (let i = 0; i < 90; i++) {
    tries.push({ x: rand(bounds.x0 + margin, bounds.x1 - margin),
                 y: rand(bounds.y0 + margin, bounds.y1 - margin) });
  }
  for (let gx = 0; gx <= 6; gx++) {
    for (let gy = 0; gy <= 5; gy++) {
      tries.push({ x: bounds.x0 + margin + (bounds.x1 - bounds.x0 - 2 * margin) * gx / 6,
                   y: bounds.y0 + margin + (bounds.y1 - bounds.y0 - 2 * margin) * gy / 5 });
    }
  }

  const legal = tries.filter(p => inside(p.x, p.y));
  const scored = legal.map(p => ({
    p,
    well: wellGapAt(p.x, p.y),
    kill: killGapAt(p.x, p.y),
    room: Math.min(rockGapAt(p.x, p.y), shipGapAt(p.x, p.y, ship))
  }));
  const pickBy = (list, key) =>
    list.reduce((best, c) => (best === null || c[key] > best[key] ? c : best), null);
  const out = c => ({ x: c.p.x, y: c.p.y,
                      a: c.p.a != null ? c.p.a : facing(c.p.x, c.p.y) });

  // Best case: out of every well, and nothing in the way. Nothing is disturbed.
  const free = scored.filter(c => c.well >= 0 &&
                                  c.room > Math.max(95 * U, r * 3));
  if (free.length) return out(pickBy(free, "room"));

  /* From here something has to give, and it is always the rocks — never the
     wall, and never the distance from a hazard. */
  const outOfWells = scored.filter(c => c.well >= 0);
  const safeEnough = scored.filter(c => c.kill >= SPAWN_KILL_MARGIN);
  const chosen = outOfWells.length ? pickBy(outOfWells, "room")
               : safeEnough.length ? pickBy(safeEnough, "well")
               : scored.length     ? pickBy(scored, "kill")
               : { p: { x: cx, y: cy } };
  clearRocksAt(chosen.p.x, chosen.p.y, Math.max(95 * U, r * 3));
  return out(chosen);
}
