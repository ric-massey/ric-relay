"use strict";

/* KONDRITE — SURVEY — DRAWING
   ─────────────────────────────────────────────────────────────────────────────
   Drawing the sector and the world: nebulae, stations, words around circles,
   what a thing is at a glance, a working engine, what the devices leave
   behind, and the Leviathan's plates.

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

/* ── plates joined into runs ───────────────────────────────────────────────
   A wall list is stroked as chained runs rather than one segment at a time,
   and that is what closes the corners: a square-ended plate drawn as its own
   path gets a butt cap at each end and `lineJoin` only applies within one
   path, so every angle had a wedge of nothing at its outside. Walking the
   shared vertices and stroking each run as a single path lets the join do
   its job. Shared by the Leviathan and the Vault, which are built from the
   same `wall` primitive. */
function chainPlates(list) {
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
}

/* The two passes that make a wall read as a *plate* — a lit rim and a solid
   body exactly as wide as the collision discs — for a structure
   whose walls are all one kind. The Leviathan does its own, because it also
   has frames. `seg` is the disc radius, so the body is drawn at twice it:
   the drawn wall and the physical wall are the same wall. The Vault used to
   stroke a two-pixel line down the centre of a 300-unit disc row, so rounds
   stopped and sparked a hundred and fifty units short of anything visible
   and ships bounced off nothing (A3). */
function strokePlates(walls, wx, wy, seg) {
  ctx.save();
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  ctx.miterLimit = 24;
  const runs = chainPlates(walls);
  const pass = (colour, extra, alpha) => {
    ctx.strokeStyle = colour;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = seg * 2 + extra;
    ctx.beginPath();
    for (const run of runs) {
      run.forEach((pt, i) => {
        const x = wx(pt[0], pt[1]), y = wy(pt[0], pt[1]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
    }
    ctx.stroke();
  };
  pass("#8fa0ba", 18, 0.95);      // the lit rim
  pass("#39424f", 0, 1);          // the body, at the discs' width
  /* No seam. Ric took the centreline off the Leviathan's plates — a bright
     line up the middle of a two-edged thing read as a pipe — and the same
     holds here. */
  ctx.restore();
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
      for (const run of chainPlates(list)) {
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
