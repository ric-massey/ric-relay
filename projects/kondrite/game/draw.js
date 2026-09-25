"use strict";

/* KONDRITE — DRAWING
   ─────────────────────────────────────────────────────────────────────────────
   Drawing a frame, and one hull drawn the same way for everybody: ships,
   turrets, motherships, planets.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── drawing ─────────────────────────────────────────────────────────────
   Everything is hairline vector. The "glow" is a fat low-alpha pass under a
   thin bright one — cheaper than shadowBlur and it survives the letterbox
   scaling without smearing. Widths are divided by wScale so a line is the
   same thickness on screen whichever arena you're in. */
function glow(colour, width, alpha, path) {
  ctx.strokeStyle = colour;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = alpha * 0.2;
  ctx.lineWidth = (width * 3.2) / wScale;
  path();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width / wScale;
  path();
  ctx.globalAlpha = 1;
}

/* Anything near an edge is drawn at the opposite one too, or crossing the
   seam would be a ship cut in half followed by a ship appearing from
   nowhere. This is what makes a wrapping field readable: you see what's
   about to arrive before it arrives. */
function drawWrapped(x, y, r, fn) {
  fn();
  if (!mode.wrap) return;
  const w = bounds.x1 - bounds.x0, h = bounds.y1 - bounds.y0;
  const dx = x - bounds.x0 < r ? w : bounds.x1 - x < r ? -w : 0;
  const dy = y - bounds.y0 < r ? h : bounds.y1 - y < r ? -h : 0;
  if (dx) { ctx.save(); ctx.translate(dx, 0); fn(); ctx.restore(); }
  if (dy) { ctx.save(); ctx.translate(0, dy); fn(); ctx.restore(); }
  if (dx && dy) { ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); }
}

function drawArena() {
  // Endless space has no frame, and drawing one ten million units out is a
  // stroke nobody will ever see.
  if (mode.survey) return;
  // Nothing solid to draw when the edges lead back round. A dotted frame
  // says where the field is without claiming you can hit it.
  if (mode.wrap) {
    ctx.strokeStyle = "#9a7a1f";
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1 / wScale;
    ctx.setLineDash([4 / wScale, 9 / wScale]);
    ctx.strokeRect(bounds.x0, bounds.y0,
                   bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }

  // The full arena, faint — so when the wall closes you can see how much
  // room you've lost.
  if (mode.closing) {
    ctx.strokeStyle = "#9a7a1f";
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1 / wScale;
    ctx.setLineDash([10 / wScale, 10 / wScale]);
    ctx.strokeRect(0, 0, arena.w, arena.h);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  const closing = mode.closing && clock > CLOSE_DELAY;
  const pulse = closing ? 0.75 + 0.25 * Math.sin(clock * 5) : 1;
  glow(closing ? "#ff8f77" : "#ffcb42", 1.8, pulse, () => {
    ctx.beginPath();
    ctx.rect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
    ctx.stroke();
  });
}

/* ── one hull, drawn the same way for everybody ───────────────────────────
   Your ship, somebody else's and the one in the hangar are the same drawing.
   They were three copies of it, and the copies drifted: the jaws were only
   ever drawn on yours, so a scavenger's Cradle out there was a Cradle with
   its jaws missing, and it was the jaws that said what the hull was for.

   Called inside the hull's own space: the caller has translated, rotated and
   scaled to the twelve-unit outline. `w` undoes that scale for line widths.

     o.load    a colour per hold, filled; a hold with none is an empty frame.
               Left out entirely (the hangar), every hold is a frame.
     o.clawT   how recently the jaws shut, for the one hull that has them
     o.line    outline weight */
function drawHullArt(spec, colour, w, alpha, o) {
  o = o || {};
  const segs = list => {
    ctx.beginPath();
    for (const f of list) {
      ctx.moveTo(f[0][0], f[0][1]);
      ctx.lineTo(f[1][0], f[1][1]);
    }
    ctx.stroke();
  };
  /* A faint wash inside the outline. A line drawing over a starfield reads as
     a wire frame; with a little body it reads as a thing, and the holds and
     windows drawn on it read as being *on* it. */
  ctx.beginPath();
  spec.art.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.globalAlpha = alpha * 0.08;
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.globalAlpha = 1;
  // The holds, underneath the outline so the outline reads over them.
  if (spec.pods) {
    spec.pods.forEach((b, i) => {
      const c = o.load && o.load[i];
      if (c) {
        ctx.globalAlpha = alpha * 0.34;
        ctx.fillStyle = c;
        ctx.fillRect(b[0], b[1], b[2], b[3]);
        ctx.globalAlpha = 1;
      }
      glow(c || colour, (c ? 1.1 : 0.8) * w, alpha * (c ? 0.95 : 0.35), () => {
        ctx.beginPath();
        ctx.rect(b[0] + 0.4, b[1] + 0.4, b[2] - 0.8, b[3] - 0.8);
        ctx.stroke();
      });
    });
  }
  glow(colour, (o.line || 1.6) * w, alpha, () => {
    ctx.beginPath();
    spec.art.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.stroke();
  });
  /* The jaws. Out and open all the time. Ric: "its claw needs to extend out
     and you should be able to see them until you shoot". So the resting state
     is the one that reads, and firing is the jaws *closing* on something. They
     hang off the hull's own nose rather than a fixed distance from the middle. */
  if (spec.weapon === "claw") {
    const shut = Math.max(0, (o.clawT || 0) / 0.22);
    const gape = 13 - shut * 10.5;
    const base = (spec.noseX || 12) - 3;
    glow(colour, 1.7 * w, alpha * (0.75 + shut * 0.25), () => {
      for (const side of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(base - 4, side * 4);
        ctx.lineTo(base + 7, side * (4 + gape * 0.45));
        ctx.lineTo(base + 15, side * gape);
        ctx.stroke();
        // The inner tooth, so a jaw reads as a jaw and not as a fin.
        ctx.beginPath();
        ctx.moveTo(base + 7, side * (4 + gape * 0.45));
        ctx.lineTo(base + 12, side * (gape * 0.35));
        ctx.stroke();
      }
    });
  }
  // Panels, spars, masts, fins: loose strokes over the outline.
  if (spec.fins) glow(colour, 1.3 * w, alpha * 0.85, () => segs(spec.fins));
  /* Hardpoints: a barrel pointing forward from each, so a four-gun hull looks
     like one from across the screen. The third number is a longer barrel. */
  if (spec.guns) {
    glow(colour, 1.2 * w, alpha * 0.9, () => {
      ctx.beginPath();
      for (const g of spec.guns) {
        ctx.moveTo(g[0], g[1]);
        ctx.lineTo(g[0] + (g[2] || 5), g[1]);
      }
      ctx.stroke();
    });
  }
  if (spec.ribs) glow(colour, 1 * w, alpha * 0.45, () => segs(spec.ribs));
  if (spec.windows) {
    glow(colour, 1 * w, alpha * 0.8, () => {
      ctx.beginPath();
      // The third number is the window's size: a fighter's canopy is bigger
      // than a porthole.
      for (const p of spec.windows) {
        const wr = p[2] || 0.7;
        ctx.moveTo(p[0] + wr, p[1]);
        ctx.arc(p[0], p[1], wr, 0, Math.PI * 2);
      }
      ctx.stroke();
    });
  }
}

/* Which holds are full, and of what. `amounts` is material key → how much;
   `fill` is how full the ship is, nought to one. The holds fill from the
   front, and the dearest material takes the first of them, so a hauler with
   a little iridium in it shows violet before anything else. That is the
   question a pirate is asking. */
function podColours(pods, amounts, fill) {
  if (!pods || !pods.length || fill <= 0) return [];
  const have = MATERIALS.filter(m => (amounts[m.key] || 0) > 0)
                        .sort((a, b) => b.value - a.value);
  const total = have.reduce((t, m) => t + amounts[m.key], 0);
  if (!total) return [];
  const n = Math.max(1, Math.round(pods.length * Math.min(1, fill)));
  const out = [];
  for (let i = 0; i < n; i++) {
    let at = (i + 0.5) / n * total, pick = have[have.length - 1];
    for (const m of have) {
      at -= amounts[m.key];
      if (at <= 0) { pick = m; break; }
    }
    out.push(pick.colour);
  }
  return out;
}

function drawShip(s) {
  if (!s.alive) return;
  if (mode.campaign && s.kind !== "fighter") {
    if (s.kind === "mothership") drawMothership(s);
    else if (s.kind === "transport") drawTransport(s);
    else if (s.kind === "flagship") drawFlagship(s);
    else if (s.kind === "gunship") drawGunship(s);
    else if (s.kind === "turret") drawTurret(s);
    else if (s.kind === "hangar") drawHangar(s);
    else if (s.kind === "shieldgen") drawShieldGen(s);
    return;
  }
  // Blink while the respawn shield is up so nobody wastes shots on a ghost.
  const blink = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0;
  let alpha = s.invuln > 0 ? (blink ? 0.35 : 0.9) : 1;
  /* And thin while you are running silent. It is the only way the state is
     visible from the cockpit — a cloak with no tell is a button you press and
     then cannot tell whether it worked, and the last second of it going back
     to solid is the warning that it is about to end. */
  if (s.human && surv && surv.cloak > 0) {
    alpha *= 0.3 + 0.25 * Math.max(0, 1 - surv.cloak / CLOAK_TIME);
  }
  const r = SHIP_R * U * (s.sizeMul || 1);
  /* The hull's own outline. Every other mode flies the stock triangle and
     always will; Survey draws whichever of the twenty-five you bought, from the
     same polygon the roster describes it with. A hauler has to be
     unmistakable from a fighter at a glance and no amount of stats does that. */
  const spec = (mode.survey && s.spec) ? s.spec : null;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  ctx.scale(r / 12, r / 12);
  if (spec) {
    /* Your own holds fill with what you are carrying, the same way a hauler's
       do out there. */
    const load = s.human && surv
      ? podColours(spec.pods, surv.hold, holdUsed() / Math.max(1, holdCap()))
      : null;
    drawHullArt(spec, s.colour, 12 / r, alpha,
                { line: 1.7, clawT: s.clawT, load });
    // The Flagship Screen, up: a ring the next hit will spend.
    if (s.human && surv && surv.screenUp) {
      glow("#ff4dd2", 1.2 * (12 / r), 0.45 * alpha, () => {
        const ringR = Math.max(spec.noseX || 12, -(spec.tailX || -12)) * 1.3;
        ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
      });
    }
  } else {
    glow(s.colour, 1.7 * (12 / r), alpha, () => {
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-10, 8); ctx.lineTo(-6, 0); ctx.lineTo(-10, -8);
      ctx.closePath();
      ctx.stroke();
    });
  }
  if (s.thrusting && Math.random() > 0.25) {
    glow(s.colour, 1.4 * (12 / r), alpha * 0.85, () => {
      ctx.beginPath();
      ctx.moveTo(-7, 4);
      ctx.lineTo(-10 - Math.random() * 9, 0);
      ctx.lineTo(-7, -4);
      ctx.stroke();
    });
  }
  // An ace wears a hostile chevron so you can pick it out of the swarm.
  if (mode.campaign && s.ace) {
    glow("#ff3b6b", 1.3 * (12 / r), alpha, () => {
      ctx.beginPath();
      ctx.moveTo(-14, -11); ctx.lineTo(-20, 0); ctx.lineTo(-14, 11);
      ctx.stroke();
    });
  }
  // A named wingmate wears a forward chevron — the ally's answer to the ace's,
  // so a known face is findable in the fleet. Veterans burn a touch brighter.
  if (mode.campaign && s.hero && !s.ace) {
    glow("#8fe3c0", 1.2 * (12 / r), alpha * (s.veteran ? 0.95 : 0.7), () => {
      ctx.beginPath();
      ctx.moveTo(14, -10); ctx.lineTo(20, 0); ctx.lineTo(14, 10);
      ctx.stroke();
    });
  }
  ctx.restore();

  // A ring on a pilot who is running salvaged ordnance — teal shield, amber
  // rapid, orange heavy — so the buff is visible on the ship, not just the HUD.
  if (mode.campaign && (s.buffRapid > 0 || s.buffHeavy > 0)) {
    const col = s.buffHeavy > 0 ? "#ff9d5c" : "#ffe56d";
    glow(col, 1.4, 0.4 + 0.3 * Math.sin(clock * 8), () => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 1.7, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

/* The mission's capital ships. All hairline vector like everything else, sized
   off `radius` so the same shape reads at fighter scale on the minimap and at
   warship scale up close. */
function drawTransport(s) {
  const R = s.radius || 30 * U;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  glow(s.colour, 2, 1, () => {
    ctx.beginPath();
    ctx.moveTo(R * 1.15, 0);
    ctx.lineTo(R * 0.55, -R * 0.55);
    ctx.lineTo(-R * 1.0, -R * 0.55);
    ctx.lineTo(-R * 1.0, R * 0.55);
    ctx.lineTo(R * 0.55, R * 0.55);
    ctx.closePath();
    ctx.stroke();
    // cargo cells, so it reads as a hauler and not just a bigger fighter
    for (let k = 0; k < 3; k++) {
      ctx.strokeRect(-R * 0.85 + k * R * 0.52, -R * 0.34, R * 0.4, R * 0.68);
    }
  });
  if (s.thrusting && Math.random() > 0.3) {
    glow("#ffcb42", 1.6, 0.8, () => {
      ctx.beginPath();
      ctx.moveTo(-R * 1.0, -R * 0.28);
      ctx.lineTo(-R * 1.25 - Math.random() * 10, 0);
      ctx.lineTo(-R * 1.0, R * 0.28);
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawTurret(s) {
  const R = s.radius || 15 * U;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  glow(s.colour, 1.8, 1, () => {
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.moveTo(0, 0);
    ctx.lineTo(R * 2.0, 0);          // the barrel, pointed where it fires
    ctx.stroke();
  });
  ctx.restore();
}

function drawMothership(s) {
  const R = s.radius || 150 * U;
  const steel = "#c9d4e0";
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);

  // Shield bubble — a slow pulse while it holds, gone the moment it drops.
  if (s.shielded) {
    const p = 0.5 + 0.5 * Math.sin(clock * 2);
    glow("#87d8ff", 2, 0.22 + 0.24 * p, () => {
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.2, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // The hull: a long angular dreadnought wedge.
  glow(steel, 2.4, 1, () => {
    ctx.beginPath();
    ctx.moveTo(R * 1.02, 0);
    ctx.lineTo(R * 0.36, -R * 0.5);
    ctx.lineTo(-R * 0.7, -R * 0.62);
    ctx.lineTo(-R * 1.0, -R * 0.28);
    ctx.lineTo(-R * 1.0, R * 0.28);
    ctx.lineTo(-R * 0.7, R * 0.62);
    ctx.lineTo(R * 0.36, R * 0.5);
    ctx.closePath();
    ctx.stroke();
  });
  // Spine ribs down the length, so the hull has plating not just an outline.
  glow(steel, 1.1, 0.6, () => {
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(R * 0.34, k * R * 0.2);
      ctx.lineTo(-R * 0.92, k * R * 0.2);
      ctx.stroke();
    }
  });
  // Engine banks flaring off the stern.
  glow("#87d8ff", 2.2, 0.9, () => {
    for (const gy of [-0.4, 0, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(-R * 1.0, gy * R - 7);
      ctx.lineTo(-R * 1.18 - Math.random() * 9, gy * R);
      ctx.lineTo(-R * 1.0, gy * R + 7);
      ctx.stroke();
    }
  });
  // The core: red and steady behind the shield, a fast yellow throb once it is
  // exposed, and a white-hot bloom that swells as the ship comes apart.
  const dead = !s.shielded;
  const pulse = 0.55 + 0.45 * Math.sin(clock * (dead ? 7 : 3));
  glow(s.dying ? "#ffffff" : dead ? "#ffe56d" : ENEMY_COLOUR, 3, pulse, () => {
    ctx.beginPath();
    ctx.arc(-R * 0.14, 0, R * (s.dying ? 0.34 : 0.22), 0, Math.PI * 2);
    ctx.stroke();
  });
  // Breaking up: hairline splits opening across the hull, flashing white.
  if (s.dying) {
    glow("#fff", 1.6, 0.5 + 0.5 * Math.random(), () => {
      for (let k = 0; k < 5; k++) {
        const a0 = k * 1.7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * R * 0.2, Math.sin(a0) * R * 0.16);
        ctx.lineTo(Math.cos(a0) * R * (0.7 + Math.random() * 0.3),
                   Math.sin(a0) * R * (0.5 + Math.random() * 0.3));
        ctx.stroke();
      }
    });
  }
  ctx.restore();
}

// Your flagship: a friendly cruiser, teal and blockier than the enemy wedge,
// with a bright bridge and engine glow so it reads as "ours" at a glance.
function drawFlagship(s) {
  const R = s.radius || 92 * U;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  glow(s.colour, 2.4, 1, () => {
    ctx.beginPath();
    ctx.moveTo(R * 1.05, 0);
    ctx.lineTo(R * 0.5, -R * 0.42);
    ctx.lineTo(-R * 0.95, -R * 0.5);
    ctx.lineTo(-R * 1.0, -R * 0.2);
    ctx.lineTo(-R * 1.0, R * 0.2);
    ctx.lineTo(-R * 0.95, R * 0.5);
    ctx.lineTo(R * 0.5, R * 0.42);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(-R * 0.2, -R * 0.22, R * 0.5, R * 0.44);   // bridge block
  });
  glow("#ffe56d", 2, 0.85, () => {
    for (const gy of [-0.28, 0.28]) {
      ctx.beginPath();
      ctx.moveTo(-R * 1.0, gy * R - 6);
      ctx.lineTo(-R * 1.16 - Math.random() * 8, gy * R);
      ctx.lineTo(-R * 1.0, gy * R + 6);
      ctx.stroke();
    }
  });
  ctx.restore();
}

// A blockade gunship: a heavy, armoured fighter — a mini-boss silhouette.
function drawGunship(s) {
  const R = s.radius || 34 * U;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  glow(s.colour, 2.2, 1, () => {
    ctx.beginPath();
    ctx.moveTo(R * 1.1, 0);
    ctx.lineTo(R * 0.2, -R * 0.7);
    ctx.lineTo(-R * 0.8, -R * 0.55);
    ctx.lineTo(-R * 0.55, 0);
    ctx.lineTo(-R * 0.8, R * 0.55);
    ctx.lineTo(R * 0.2, R * 0.7);
    ctx.closePath();
    ctx.stroke();
    ctx.moveTo(R * 0.2, -R * 0.4); ctx.lineTo(R * 1.0, -R * 0.2);   // gun pods
    ctx.moveTo(R * 0.2, R * 0.4); ctx.lineTo(R * 1.0, R * 0.2);
    ctx.stroke();
  });
  ctx.restore();
}

// A hangar bay: an armoured box with a lit launch slot.
function drawHangar(s) {
  const R = s.radius || 26 * U;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  glow(s.colour, 2, 1, () => {
    ctx.strokeRect(-R, -R * 0.7, R * 2, R * 1.4);
  });
  glow("#fff2c0", 1.6, 0.5 + 0.3 * Math.sin(clock * 4), () => {
    ctx.beginPath();
    ctx.moveTo(R, -R * 0.4); ctx.lineTo(R, R * 0.4);          // the launch mouth
    ctx.stroke();
  });
  ctx.restore();
}

// A shield generator: a node under a small humming dome.
function drawShieldGen(s) {
  const R = s.radius || 16 * U;
  ctx.save();
  ctx.translate(s.x, s.y);
  glow(s.colour, 1.9, 0.9, () => {
    ctx.beginPath();
    ctx.arc(0, 0, R, Math.PI, 0);                            // dome
    ctx.moveTo(-R, 0); ctx.lineTo(R, 0);
    ctx.stroke();
  });
  const p = 0.4 + 0.4 * Math.sin(clock * 3 + s.x);
  glow("#cdefff", 1.4, p, () => {
    ctx.beginPath();
    ctx.arc(0, -R * 0.1, R * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

// Salvage: a slowly spinning diamond in its kind's colour, blinking out as its
// life runs down so a canister about to vanish reads as one.
function drawPickup(p) {
  const R = 12 * U;
  const spec = PICKUPS[p.kind] || { colour: "#ffe56d" };
  const fade = p.life < 3 ? clamp01(p.life / 3) : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.spin);
  glow(spec.colour, 2, (0.55 + 0.45 * Math.sin(clock * 5)) * fade, () => {
    ctx.beginPath();
    ctx.moveTo(0, -R); ctx.lineTo(R, 0); ctx.lineTo(0, R); ctx.lineTo(-R, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.moveTo(-R * 0.4, 0); ctx.lineTo(R * 0.4, 0);
    ctx.stroke();
  });
  ctx.restore();
}

/* A world. The campaign's convoy planet comes through here too and has none
   of Survey's fields on it, so every one of them has a default and the old
   blue banded disc is what you get without them.

   The bands are drawn tilted, which is most of what stops eight worlds in a
   row reading as one piece of art: a horizontal line across a circle is a
   diagram, and the same line at nine degrees is a planet turning. */
function drawPlanet(pl) {
  /* The cull has to cover the widest thing this paints, and since the name
     went onto the rim that is no longer the disc or its ring — the words sit
     at `r * 1.2` plus a little, and INHABITED sits outside them again. At the
     old margin every world over about 285 units across lost its name while
     the world itself was still on screen, which reads as a nameless planet
     rather than as a clipped label. */
  const outer = Math.max(pl.r * (pl.ring || 1), pl.r * 1.2 + 60);
  if (!onScreen(pl.x, pl.y, outer + 60)) return;
  const R = pl.r;
  const kind = pl.kind ? worldKind(pl.kind)
                       : { disc: "#9ad0ff", band: "#6fa8e6", halo: "#7fb4ff" };
  const bands = pl.bands || [-0.55, -0.2, 0.2, 0.55];
  // A rogue has nothing warming it, so it keeps its outline and loses its
  // light: the entry is the absence, and the drawing has to say so.
  const dim = pl.rogue ? 0.45 : 1;

  ctx.save();
  ctx.translate(pl.x, pl.y);

  if (!pl.rogue) {
    glow(kind.halo, 3, (0.42 + 0.14 * Math.sin(clock * 1.5)) * dim, () => {
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.06, 0, Math.PI * 2);       // atmosphere
      ctx.stroke();
    });
  }
  glow(kind.disc, 2.4, dim, () => {
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);                // the disc
    ctx.stroke();
  });

  ctx.save();
  ctx.rotate(pl.tilt || 0);
  glow(kind.band, 1.3, 0.6 * dim, () => {
    for (const f of bands) {
      const yy = f * R, half = Math.sqrt(Math.max(0, R * R - yy * yy));
      if (half < 2) continue;
      ctx.beginPath();
      ctx.moveTo(-half, yy); ctx.lineTo(half, yy);
      ctx.stroke();
    }
  });
  ctx.restore();

  // A ring, on about one world in five. Drawn as an ellipse across the tilt,
  // so a ringed world is unmistakable from a long way off.
  if (pl.ring) {
    ctx.save();
    ctx.rotate((pl.tilt || 0) * 1.6);
    glow(kind.halo, 1.4, 0.5, () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, R * pl.ring, R * pl.ring * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }
  ctx.restore();

  /* The words. A world says what it is called, and says whether anybody is
     home — floating beside it in world space rather than in a HUD label,
     because the name belongs to the place and not to the interface. Placed at
     the rim rather than the centre, or a big world would print its name
     across its own middle. */
  if (pl.name) {
    /* Round the rim, the way a station wears its own name — see `rimWord`.
       It was set flat above the world, which put the name of a two-thousand
       unit body a long way off the body at a zoom where you could see both,
       and left you matching a caption to a disc. On the rim it is attached to
       the thing.

       **Repeated on anything big.** One name on a large world is legible from
       exactly one bearing and you arrive from whichever bearing you arrive
       from — so a world wide enough to carry the word twice carries it twice,
       and the widest carry it three times. That is the whole of "bigger
       planets are easier to spot": not a bigger label, more of them. */
    const copies = R > 1300 ? 3 : R > 700 ? 2 : 1;
    /* Slow. A station's ring turns at 0.22 and reads as machinery; a world
       turning at anything like that reads as a spinning logo. This is about
       a fifth of it, and `reduceMotion` stops it dead like everything else. */
    const turn = (reduceMotion ? 0 : clock * 0.045) + (pl.tilt || 0);
    /* Outside the disc, clear of the atmosphere ring at 1.06. Sized off the
       world rather than fixed, so a small one is not shouting and a large one
       is not whispering. */
    const size = Math.max(11, Math.min(26, R * 0.045));
    rimWord(pl.name, pl.x, pl.y, R * 1.2 + 18, turn, size,
            kind.disc, 0.85 * dim, copies);
    /* And whether anybody is home, on its own course further out. Same
       rotation, so the two read as painted on the same body rather than as
       two things that happen to be near each other. */
    if (pl.inhabited) {
      rimWord("INHABITED", pl.x, pl.y, R * 1.2 + 18 + size * 1.5, turn,
              Math.max(9, size * 0.72), CASH, 0.8 * dim, copies);
    }
  }
}

function drawRock(r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.a);

  const hit = r.flash > 0;
  // A rime's bodies are ice, and they look like it. The one region whose
  // contents are a single material should be obvious from the window.
  const body = r.ice ? "#bfe8ff" : "#ffcb42";
  glow(hit ? "#fff2bf" : body, hit ? 2 : 1.5, 1, () => {
    ctx.beginPath();
    for (let i = 0; i < r.shape.length; i++) {
      const t = (i / r.shape.length) * Math.PI * 2;
      const rr = r.r * r.shape[i];
      const x = Math.cos(t) * rr, y = Math.sin(t) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  });

  // One crack per hit taken — cover you can see wearing out.
  const shown = r.maxHp - r.hp;
  if (shown > 0) {
    ctx.strokeStyle = hit ? "#fff2bf" : "#ffcb42";
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.1 / wScale;
    ctx.beginPath();
    for (let i = 0; i < shown && i < r.cracks.length; i++) {
      const c = r.cracks[i];
      ctx.moveTo(c.x1 * r.r, c.y1 * r.r);
      ctx.lineTo(c.x2 * r.r, c.y2 * r.r);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* Stars and black holes, drawn in the same hairline vector language as
   everything else — no fills anywhere except the black hole's own disc,
   which has to be solid or it isn't a hole. */
function drawHazard(h) {
  ctx.save();
  ctx.translate(h.x, h.y);

  if (h.kind === "star") {
    const spin = clock * 0.25 + h.phase;
    const fill = h.fill || "#ffe56d";
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, h.kill * 0.7, 0, Math.PI * 2);
    ctx.fill();
    glow(fill, 1.6, 1, () => {
      ctx.beginPath();
      ctx.arc(0, 0, h.kill, 0, Math.PI * 2);
      ctx.stroke();
    });
    glow(fill, 1.2, 0.55, () => {
      ctx.beginPath();
      ctx.arc(0, 0, h.kill * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Corona: spokes of two lengths, turning slowly.
    glow(fill, 1.3, 0.7, () => {
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const t = spin + (i / 12) * Math.PI * 2;
        const len = h.kill * (i % 2 ? 1.5 : 1.28);
        ctx.moveTo(Math.cos(t) * h.kill * 1.08, Math.sin(t) * h.kill * 1.08);
        ctx.lineTo(Math.cos(t) * len, Math.sin(t) * len);
      }
      ctx.stroke();
    });
  } else {
    const spin = clock * 0.6 + h.phase;
    // The hole itself: solid black, so anything behind it is genuinely gone.
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(0, 0, h.kill, 0, Math.PI * 2);
    ctx.fill();
    // Accretion ring, squashed and turning.
    ctx.save();
    ctx.rotate(spin * 0.35);
    ctx.scale(1, 0.42);
    glow("#ff8f77", 1.7, 1, () => {
      ctx.beginPath();
      ctx.arc(0, 0, h.kill * 1.85, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
    glow("#ff8f77", 1.4, 0.85, () => {
      ctx.beginPath();
      ctx.arc(0, 0, h.kill, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  ctx.restore();
}

/* Debris streaks. Drawn under everything else, and brightening as they fall,
   so the eye reads the inward flow before it reads any one speck. */
function drawMotes() {
  ctx.lineCap = "round";
  for (const m of motes) {
    const h = m.h;
    if (!onScreen(m.x, m.y, 30)) continue;
    const d = Math.hypot(h.x - m.x, h.y - m.y);
    const k = 1 - Math.min(1, d / h.reach);        // 0 at the edge, 1 at the centre
    ctx.globalAlpha = 0.18 + k * 0.7;
    ctx.strokeStyle = h.kind === "hole" ? "#ff8f77" : "#ffe56d";
    ctx.lineWidth = (0.8 + k * 1.4) / wScale;
    // Out at the edge a mote barely moves, so a pure velocity streak would be
    // invisible exactly where the boundary needs to be legible. Give it a
    // floor length and let it stretch as it accelerates inward.
    const sp = Math.hypot(m.vx, m.vy) || 1;
    const len = Math.max(7, sp * 0.05);
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - (m.vx / sp) * len, m.y - (m.vy / sp) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
