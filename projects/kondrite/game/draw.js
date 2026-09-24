"use strict";

/* KONDRITE — DRAWING
   ─────────────────────────────────────────────────────────────────────────────
   Drawing a frame, one hull drawn the same way for everybody, the field
   behind the menus, the minimap, tapping the menus, and the machines one
   floor down.

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

/* ── the field behind the menus ───────────────────────────────────────────
   A menu screen used to be words on black, which said nothing about what the
   game is. So the game idles behind them: rocks drifting, two ships flying
   around and taking the occasional shot.

   It is deliberately its own little world rather than a match left running.
   Nothing in here touches `rocks`, `ships`, `bounds` or any of the match
   state — a decoration that can put a ship in the wrong place, or leave one
   behind when a real match starts, is not worth having. It owns four arrays
   and screen coordinates, and the menus draw straight on top of it.

   Kept faint on purpose. Every menu is text over this, and text has to stay
   readable — so it is line art at low alpha over black, and the numbers below
   are chosen to keep it that way rather than to look impressive. */
/* What a menu's black actually is. See the fill in `render`. */
const MENU_INK = "#12141d";
/* And how much of the idling field you can see on it. Raised with the lift:
   the field is the only thing on the front page that moves, and at 0.24 on a
   true black it read as a few specks at the edges rather than as space. */
const DRIFT_ALPHA = 0.35;
const DRIFT_ROCKS = 9;
const DRIFT_EDGE = 90;             // spawn margin, so nothing pops in mid-screen
const stillness = window.matchMedia
  ? matchMedia("(prefers-reduced-motion: reduce)") : null;

let drift = null;

function driftRock(atEdge) {
  const size = ["big", "big", "mid", "small"][(Math.random() * 4) | 0];
  const looks = rockLooks(++rockSeq, size);
  const spec = rockSpec(size);
  const dir = rand(0, Math.PI * 2);
  const spd = rand(9, 26);
  return {
    x: atEdge ? (Math.random() < 0.5 ? -DRIFT_EDGE : SCREEN_W + DRIFT_EDGE)
              : rand(0, SCREEN_W),
    y: rand(-DRIFT_EDGE, SCREEN_H + DRIFT_EDGE),
    vx: Math.cos(dir) * spd, vy: Math.sin(dir) * spd,
    r: spec.r * 0.72, a: rand(0, Math.PI * 2), spin: rand(-0.5, 0.5),
    shape: looks.shape, flash: 0
  };
}

function driftShip(i) {
  return {
    x: rand(SCREEN_W * 0.2, SCREEN_W * 0.8), y: rand(SCREEN_H * 0.2, SCREEN_H * 0.8),
    a: rand(0, Math.PI * 2), vx: 0, vy: 0,
    colour: PLAYERS[i].colour, thrusting: false,
    tx: rand(0, SCREEN_W), ty: rand(0, SCREEN_H),
    aim: rand(2, 6), gun: rand(1, 4)
  };
}

function driftMake() {
  drift = {
    rocks: Array.from({ length: DRIFT_ROCKS }, () => driftRock(false)),
    ships: [driftShip(0), driftShip(1)],
    shots: []
  };
}

/* Wrapping with a wide margin rather than at the edge, so nothing blinks out
   of existence on the boundary of a screen somebody is reading. */
function driftWrap(o) {
  if (o.x < -DRIFT_EDGE) o.x = SCREEN_W + DRIFT_EDGE;
  if (o.x > SCREEN_W + DRIFT_EDGE) o.x = -DRIFT_EDGE;
  if (o.y < -DRIFT_EDGE) o.y = SCREEN_H + DRIFT_EDGE;
  if (o.y > SCREEN_H + DRIFT_EDGE) o.y = -DRIFT_EDGE;
}

function driftStep(dt) {
  for (const r of drift.rocks) {
    r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.spin * dt;
    if (r.flash > 0) r.flash -= dt;
    driftWrap(r);
  }

  for (const s of drift.ships) {
    /* Fly at a wandering point rather than at anything. A ship that chased
       rocks would end up circling the middle of the title, and the point of
       this is movement at the edge of attention, not a performance. */
    s.aim -= dt;
    if (s.aim <= 0) {
      s.tx = rand(0, SCREEN_W); s.ty = rand(0, SCREEN_H);
      s.aim = rand(2.5, 6);
    }
    const want = Math.atan2(s.ty - s.y, s.tx - s.x);
    let off = ((want - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    s.a += Math.max(-1.6 * dt, Math.min(1.6 * dt, off));
    // Only burn when roughly pointed the right way, which is what makes it
    // read as flying rather than sliding.
    s.thrusting = Math.abs(off) < 0.7;
    if (s.thrusting) {
      s.vx += Math.cos(s.a) * 90 * dt;
      s.vy += Math.sin(s.a) * 90 * dt;
    }
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > 130) { s.vx = (s.vx / sp) * 130; s.vy = (s.vy / sp) * 130; }
    s.vx *= 1 - 0.35 * dt; s.vy *= 1 - 0.35 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    driftWrap(s);

    s.gun -= dt;
    if (s.gun <= 0) {
      s.gun = rand(1.6, 4.5);
      drift.shots.push({ x: s.x, y: s.y, a: s.a, life: 1.5,
                         vx: Math.cos(s.a) * 300, vy: Math.sin(s.a) * 300,
                         colour: s.colour });
    }
  }

  for (let i = drift.shots.length - 1; i >= 0; i--) {
    const b = drift.shots[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    driftWrap(b);
    // A shot that never lands looks broken, and splitting rocks here would be
    // a second physics model to keep honest. So a hit marks the rock and
    // sends it back in from an edge — cause and effect, no bookkeeping.
    let hit = false;
    for (const r of drift.rocks) {
      if (Math.hypot(r.x - b.x, r.y - b.y) < r.r) {
        Object.assign(r, driftRock(true), { flash: 0.25 });
        hit = true;
        break;
      }
    }
    if (hit || b.life <= 0) drift.shots.splice(i, 1);
  }
}

function drawDrift(dt) {
  if (!drift) driftMake();
  // Asked for less motion: the field is still drawn, so a menu is not a blank
  // rectangle, but nothing moves.
  if (!(stillness && stillness.matches)) driftStep(Math.min(dt, 0.05));

  const was = wScale;
  wScale = 1;                       // menu screens draw in screen units
  ctx.save();

  for (const r of drift.rocks) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.a);
    glow(r.flash > 0 ? "#fff2bf" : "#ffcb42", 1.4, DRIFT_ALPHA, () => {
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
    ctx.restore();
  }

  for (const b of drift.shots) {
    glow(b.colour, 1.6, DRIFT_ALPHA, () => {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(b.a) * 9, b.y - Math.sin(b.a) * 9);
      ctx.stroke();
    });
  }

  for (const s of drift.ships) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    glow(s.colour, 1.5, DRIFT_ALPHA, () => {
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, -8);
      ctx.closePath();
      ctx.stroke();
    });
    if (s.thrusting && Math.random() > 0.25) {
      glow(s.colour, 1.2, DRIFT_ALPHA * 0.85, () => {
        ctx.beginPath();
        ctx.moveTo(-7, 4);
        ctx.lineTo(-10 - Math.random() * 8, 0);
        ctx.lineTo(-7, -4);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  wScale = was;
}

/* ── minimap ─────────────────────────────────────────────────────────────
   Top-right, showing the whole world at once: the wall, the hazards, every
   ship, and the rectangle of it you can actually see. On a map sixteen
   screens across this is the only way to know where anyone is. */
function drawMinimap() {
  const w = 210, h = 210 * (arena.h / arena.w);
  const x0 = SCREEN_W - w - 18, y0 = 18;
  const sx = w / arena.w, sy = h / arena.h;
  const mx = wx => x0 + wx * sx;
  const my = wy => y0 + wy * sy;

  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = "#9a7a1f";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, w, h);

  // The wall's current extent.
  const closing = clock > CLOSE_DELAY;
  ctx.strokeStyle = closing ? "#ff8f77" : "#ffcb42";
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(mx(bounds.x0), my(bounds.y0),
                 (bounds.x1 - bounds.x0) * sx, (bounds.y1 - bounds.y0) * sy);
  ctx.globalAlpha = 1;

  for (const hz of hazards) {
    if (!hazardActive(hz)) continue;
    ctx.beginPath();
    ctx.arc(mx(hz.x), my(hz.y), hz.kind === "hole" ? 3 : 4, 0, Math.PI * 2);
    if (hz.kind === "hole") {
      ctx.fillStyle = "#000"; ctx.fill();
      ctx.strokeStyle = "#ff8f77"; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.fillStyle = "#ffe56d"; ctx.fill();
    }
  }

  // What the camera can see. The minimap remains north-up while this outline
  // rotates to match the player-up main view.
  const halfW = SCREEN_W / (2 * cam.scale);
  const halfH = SCREEN_H / (2 * cam.scale);
  const c = Math.cos(cam.rot), r = Math.sin(cam.rot);
  const corners = [
    [-halfW, -halfH], [halfW, -halfH],
    [halfW, halfH], [-halfW, halfH]
  ].map(([px, py]) => ({
    x: mx(cam.x + c * px + r * py),
    y: my(cam.y - r * px + c * py)
  }));
  ctx.strokeStyle = "#ffcb42";
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;

  // In the convoy the planet is home — mark it so the player always knows
  // which way the transport is headed.
  if (mode.campaign && camp && camp.planet) {
    ctx.fillStyle = "#9ad0ff";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(mx(camp.planet.x), my(camp.planet.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (const s of ships) {
    if (s.dead) continue;
    ctx.globalAlpha = s.alive ? 1 : 0.35;
    ctx.fillStyle = s.colour;
    const rad = s.kind === "mothership" ? 7
      : s.kind === "flagship" ? 6
      : s.kind === "transport" || s.kind === "gunship" ? 5
      : s.kind === "hangar" || s.kind === "shieldgen" ? 4
      : s.id === watching ? 4 : 3;
    ctx.beginPath();
    ctx.arc(mx(s.x), my(s.y), rad, 0, Math.PI * 2);
    ctx.fill();
    if (s.id === watching) {
      ctx.strokeStyle = s.colour;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(mx(s.x), my(s.y), 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/* A round has to say what it is at a glance. The cannon is a short streak and
   always was; the parts you bolt on are told apart by shape rather than by
   colour alone, because colour is the one thing a player cannot rely on and
   because four kinds of firepower on one screen is four things to read at
   speed.

   A seeker trails, so you can see it turn. A charge is a fat head — the thing
   that is about to go off. A lance is a long hard bar. */
function drawBullet(b) {
  /* A beam is long and it is thick, and it has to read as neither of the
     other two heavy rounds on the screen: it is not a charge, which is a fat
     head with nothing behind it, and it is not a lance, which is two hard
     thin lines. It is one wide bar with a bloom on it, and at three times the
     tail of an ordinary round it is unmistakable from across a rock field —
     which matters, because the hulls that fire one are the hulls that cannot
     turn round to look. */
  const tail = b.beam ? 0.026 : b.seek ? 0.02 : b.punch ? 0.018 : 0.008;
  glow(b.colour, b.beam ? 6.5 : b.big ? 3.4 : 2.6, 1, () => {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * tail, b.y - b.vy * tail);
    ctx.stroke();
    if (b.boom) {
      // The head, drawn as a ring so it reads as a charge rather than a shot.
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5 * U, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.beam) {
      // A soft head, so the leading end reads as the cutting end.
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4.5 * U, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.punch) {
      // Doubled, a hair off the line, so a lance is visibly heavier.
      const n = Math.hypot(b.vx, b.vy) || 1;
      const nx = -b.vy / n * 2 * U, ny = b.vx / n * 2 * U;
      ctx.beginPath();
      ctx.moveTo(b.x + nx, b.y + ny);
      ctx.lineTo(b.x - b.vx * tail + nx, b.y - b.vy * tail + ny);
      ctx.moveTo(b.x - nx, b.y - ny);
      ctx.lineTo(b.x - b.vx * tail - nx, b.y - b.vy * tail - ny);
      ctx.stroke();
    }
  });
  // A seeker leaves smoke, which is most of how you tell it is tracking.
  if (b.seek && Math.random() < 0.5) {
    burst(b.x - b.vx * 0.01, b.y - b.vy * 0.01, b.colour, 1, 30 * U);
  }
}

function drawBits() {
  ctx.lineWidth = 1.4 / wScale;
  for (const p of bits) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.strokeStyle = p.colour;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const readableTextSize = size => Math.max(16, size);

function text(str, x, y, size, colour, align = "center", alpha = 1) {
  size = readableTextSize(size);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.font = size + 'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

/* ── tapping the menus ────────────────────────────────────────────────────
   Every menu here is a keypress, which is no use to a thumb. Rather than
   keep a second list of rectangles in step with the drawing, a menu line
   registers its own box as it is drawn: what you can tap is exactly what you
   can see, and a line that stops being drawn stops being tappable.

   Boxes are collected fresh each frame, and a tap runs the same code the key
   runs — there is one menu, not a keyboard one and a touch one. */
let taps = [];

function tapText(str, x, y, size, colour, act, align = "center", alpha = 1) {
  text(str, x, y, size, colour, align, alpha);
  size = readableTextSize(size);
  const w = ctx.measureText(str).width;      // text() left the font set
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  // Generous vertically: a fingertip is wider than a line of 13px type.
  pushTap({ x: left - 14, y: y - size, w: w + 28, h: size + 20, act });
}

function tapButton(label, x, y, w, h, colour, act, selected = false,
                   enabled = true) {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = enabled ? (selected ? 0.2 : 0.08) : 0.025;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = colour;
  ctx.globalAlpha = enabled ? (selected ? 1 : 0.48) : 0.18;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
  text(label, x, y + 7, 18, colour, "center", enabled ? 1 : 0.38);
  if (enabled && typeof act === "function") {
    // The label rides along. A harness that wants SOUND should be able to ask
    // for SOUND rather than guess at where on the page it was drawn — which
    // is what made the settings tests break every time the page was re-spaced.
    pushTap({ x: x - w / 2, y: y - h / 2, w, h, act, label });
  }
}

function tapAt(sx, sy) {
  // Last drawn wins, so a line drawn over another is the one you get.
  for (let i = taps.length - 1; i >= 0; i--) {
    const t = taps[i];
    if (sx >= t.x && sx <= t.x + t.w && sy >= t.y && sy <= t.y + t.h) return t;
  }
  return null;
}

function shipPip(x, y, colour, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.scale(0.62, 0.62);
  glow(colour, 2.2, alpha, () => {
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-10, 8); ctx.lineTo(-6, 0); ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.stroke();
  });
  ctx.restore();
}

const clockText = s => {
  const t = Math.max(0, Math.ceil(s));
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
};

function drawKillFeed() {
  const visible = killFeed.filter(e => e.until > clock);
  if (!visible.length) return;

  const right = SCREEN_W - 18;
  const top = 184;
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(right - 282, top - 18, 282, visible.length * 25 + 14);
  visible.forEach((e, i) => {
    const alpha = Math.min(1, (e.until - clock) * 1.6);
    text(e.source + "  ▸  " + e.victim, right - 10, top + i * 25,
         14, e.colour, "right", alpha);
  });
}

// A labelled progress/health bar for the campaign HUD.
function drawBar(x, y, w, h, frac, colour) {
  ctx.strokeStyle = "#9a7a1f";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamp01(frac)), h - 2);
}

function drawCampaignHUD() {
  // The pilots and the shared reserve pile they draw respawns from.
  const pilots = ships.filter(s => s.human);
  pilots.forEach((s, i) => {
    const y = 34 + i * 26;
    text(s.name, 24, y, 15, s.dead ? "#ffcb42" : s.colour, "left");
    if (s.dead) text("OUT", 150, y, 13, "#ffcb42", "left");
    else text("HULL " + s.hull, 150, y, 13,
              s.hull > 1 ? s.colour : "#ff8f77", "left");
    if (s.id === watching) text("▸", 12, y, 14, s.colour, "left", 0.9);
  });
  const py = 34 + pilots.length * 26 + 6;
  text("RESERVE", 24, py, 12, "#ffcb42", "left");
  for (let i = 0; i < Math.min(lives, 12); i++) {
    shipPip(98 + i * 16, py - 4, "#ffe56d", 0.85);
  }

  // The objective, dead centre, with whatever readout the level wants.
  const cx = SCREEN_W / 2;
  text(camp.objective, cx, 34, 18, "#ffe56d");
  if (camp.levelKey === "convoy") {
    drawBar(cx - 120, 44, 240, 10, camp.progress, "#87d8ff");
    text("DISTANCE " + Math.round(camp.progress * 100) + "%", cx, 74, 12, "#ffcb42");
    const t = camp.transports[0];
    if (t && !t.dead) {
      text("TRANSPORT", cx, 94, 11, "#87d8ff");
      drawBar(cx - 90, 100, 180, 8, t.hull / t.maxHull, "#87d8ff");
    }
    text("WAVE " + Math.min(camp.waveIndex, camp.waves.length) +
         " / " + camp.waves.length, cx, 126, 12, "#ff8f77");
  } else if (camp.levelKey === "raid") {
    const left = camp.transports.filter(t => !t.dead).length;
    text("TRANSPORTS LEFT   " + left + " / " + camp.transports.length,
         cx, 58, 15, "#ff9d5c");
  } else if (camp.levelKey === "mothership") {
    const m = camp.mothership;
    const hangars = camp.hangars.filter(h => !h.dead).length;
    const gens = camp.shieldGens.filter(g => !g.dead).length;
    if (hangars) {
      text("HANGAR BAYS  " + hangars + " / " + camp.hangars.length, cx, 58, 14, "#ffb347");
    } else if (m.shielded) {
      text("SHIELD GENERATORS  " + gens + " / " + camp.shieldGens.length,
           cx, 58, 14, "#87d8ff");
    } else {
      text(m.dying ? "MOTHERSHIP DOWN" : "CORE EXPOSED — KILL IT", cx, 54, 14, "#ffe56d");
      drawBar(cx - 110, 64, 220, 10, m.hull / m.maxHull, ENEMY_COLOUR);
    }
  }

  // Squad order, and the keys that give one — the pilot commands a fleet.
  if (camp.order) {
    text("WING: " + ORDER_LABEL[camp.order], cx, SCREEN_H - 40, 13, "#5fd0a0");
  }
  text("1 FOCUS   2 DEFEND   3 REGROUP", cx, SCREEN_H - 20, 11, "#ffcb42",
       "center", 0.75);

  // Radio chatter, a short scrolling log bottom-left.
  const live = comms.filter(c => c.until > clock);
  live.slice(0, 4).forEach((c, i) => {
    const a = Math.min(1, (c.until - clock) * 0.8);
    text("▸ " + c.text, 22, SCREEN_H - 92 + i * 20, 12, c.colour, "left", a * 0.9);
  });

  if (ships.filter(s => !s.dead && s.alive).length > 1) {
    text("TAB — follow next ship", 22, SCREEN_H - 8, 11, "#ffcb42", "left", 0.7);
  }
  drawMinimap();
  drawKillFeed();
}

function drawHUD(dt) {
  if (mode.survey) { drawSurveyPanel(dt); return; }
  if (mode.campaign) { drawCampaignHUD(); return; }
  if (mode.pvp) {
    // Stocks down the left, so the minimap owns the top-right corner.
    ships.forEach((s, i) => {
      const y = 34 + i * 34;
      text(s.name, 24, y, 15, s.dead ? "#ffcb42" : s.colour, "left", 1);
      // Names are wider than colour words, so the pips start further in.
      if (s.dead) {
        text("OUT", 168, y, 13, "#ffcb42", "left", 1);
      } else {
        for (let k = 0; k < s.stocks; k++) {
          shipPip(172 + k * 17, y - 5, s.colour, 0.85);
        }
        // A device reports only the hulls driven from that device. Remote
        // opponents and bots keep their damage private.
        if (s.localKeys) {
          text("HULL " + s.hull, 238, y, 12,
               s.hull > 1 ? s.colour : "#ff8f77", "left", 0.9);
        }
      }
      if (i === watching) {
        text("▸", 12, y, 14, s.colour, "left", 0.9);   // whose eyes you're using
      }
    });

    text("LAST SHIP WINS", SCREEN_W / 2, 40, 18, "#ffe56d", "center");

    // Once your stocks are gone the view belongs to someone else, and a
    // borrowed view with nothing saying so reads as a bug. Name it, in the
    // colour of the ship you are riding, for as long as you are dead.
    const meHud = ships[localSeat()];
    const seenHud = ships[watching];
    if (meHud && meHud.dead && seenHud && seenHud.id !== meHud.id) {
      text("SPECTATING — " + seenHud.name, SCREEN_W / 2, 64, 15,
           seenHud.colour, "center", 0.95);
    }

    const t = Math.max(0, CLOSE_DELAY - clock);
    if (t > 0) {
      text("WALL CLOSES IN " + Math.ceil(t), SCREEN_W / 2, SCREEN_H - 18, 14,
           "#ffcb42", "center", 0.85);
    } else if (clock < CLOSE_DELAY + CLOSE_TIME) {
      text("WALL CLOSING", SCREEN_W / 2, SCREEN_H - 18, 14, "#ff8f77", "center", 0.85);
    } else {
      text("NO MORE ROOM", SCREEN_W / 2, SCREEN_H - 18, 14, "#ff8f77", "center", 0.9);
    }
    if (ships.length > 1) {
      text("TAB — follow next ship", 22, SCREEN_H - 18, 12, "#ffcb42", "left", 1);
    }
    drawMinimap();
    drawKillFeed();
    return;
  }

  text("SCORE " + String(score).padStart(6, "0"), 22, 36, 20, "#ffe56d", "left");
  text("WAVE " + wave, SCREEN_W / 2, 36, 20, "#ffcb42");

  // Lives are one shared pile — drawn as a single row, not per-player,
  // because that's the whole point of co-op Survival.
  for (let i = 0; i < lives; i++) shipPip(SCREEN_W - 24 - i * 20, 30, "#ffe56d", 0.85);
  text("SHARED", SCREEN_W - 24, 52, 12, "#ffcb42", "right");

  if (ffCount > 0) {
    text("FRIENDLY FIRE ×" + ffCount, 22, 56, 13, "#ff8f77", "left", 0.85);
  }
}

function drawBanner() {
  if (!banner) return;
  const a = Math.min(1, banner.t * 1.8);
  // Near the top of the screen rather than across the middle, and smaller, so
  // a callout never sits over the fight it is announcing.
  text(banner.text, SCREEN_W / 2, 150, 32, banner.colour, "center", a);
  if (banner.sub) {
    text(banner.sub, SCREEN_W / 2, 176, 15, banner.colour, "center", a * 0.8);
  }
}

/* The moment the run ends for this screen. It holds over the fight that
   killed you, then fades out and hands the job to the SPECTATING line in the
   HUD — the card says the run is over, the HUD line says whose eyes these
   are. Only pvp sets `terminated`, so Survival and the campaign never see it. */
function drawTerminated() {
  if (!terminated) return;
  const a = Math.min(1, terminated.t / 0.6);
  ctx.globalAlpha = a * 0.55;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.globalAlpha = 1;
  text("YOU ARE TERMINATED", SCREEN_W / 2, SCREEN_H / 2 - 6, 52,
       "#ff6b6b", "center", a);
  const seen = ships[watching];
  const sub = seen && seen.id !== localSeat()
    ? "spectating " + seen.name + " · tab — follow another ship"
    : "no one left to watch";
  text(sub, SCREEN_W / 2, SCREEN_H / 2 + 30, 15, "#ffcb42", "center", a * 0.85);
}

/* ── the menu, in two steps ───────────────────────────────────────────────
   The front page used to be five rows: three modes, a campaign and a lobby,
   each with a line of small print under it, all competing for the same glance.
   That is a list, not a choice, and it got longer every time the game grew.

   It is two questions now. The first one — on your own, or with other people —
   is the one a player has already answered before they opened the game, so it
   costs nothing to ask and it halves what the second page has to show. The
   second page is the modes for that answer, as cards you can actually look at:
   hover one and it opens, and what is inside is the mode running.

   The same mode appears in both lanes where it honestly belongs, and reads
   differently in each — Battle Royale against bots is a different proposition
   from Battle Royale against your brother, and the card says so. */
/* ── and the machines are one floor down ──────────────────────────────────
   These two pages are the same pages they were, and they are not the front
   of the game any more. **There is one game**, and it is Survey; what is in
   here is the arcade cabinet in the corner of the station — the other three
   modes, as simulators you play for a score.

   So `survey` comes out of the solo lane, and that one removal is most of
   this change: a lane that lists the game beside three machines is exactly
   the row of peers the whole thing exists to end. The question the lanes ask
   is a real question about a machine — on your own, or with other people —
   and it was never a question about Survey, which is one pilot and one chart
   and settled. Asked before the game, it was being asked about nothing. */
const LANES = {
  solo: { name: "SOLO", colour: "#ffe56d", art: "survival",
          line: "one pilot · three machines",
          rows: ["survival", "royale", "campaign"] },
  multi: { name: "MULTIPLAYER", colour: "#87d8ff", art: "online",
           line: "at this keyboard, or across the internet",
           rows: ["survival", "royale", "campaign", "online"] }
};
const LANE_KEYS = ["solo", "multi"];

/* What each card says. `long` is the mode in one line. It was three sentences,
   and three did not fit: the card is 372 tall and the text starts 56 below the
   name at 21 a line, so the fourth line is drawn below the card's own border —
   Survey spilled onto the BACK button. A card has about two seconds of a
   player's attention and one line is what that buys.

   It is a string, or one string per lane where the mode is honestly a
   different proposition in each: Battle Royale is bots in SOLO and the people
   beside you in MULTIPLAYER, and a card that said "bots" in both would be
   lying in one of them. */
const CARDS = {
  survival: {
    name: "SURVIVAL", colour: "#ffe56d", art: "survival",
    solo: "1 PILOT", multi: "1–5 AT ONE KEYBOARD",
    long: "Endless asteroids."
  },
  royale: {
    name: "BATTLE ROYALE", colour: "#ff8f77", art: "royale",
    solo: "YOU AGAINST THE BOTS", multi: "2–5 AT ONE KEYBOARD",
    long: { solo:  "Up to 5 bots — last standing wins.",
            multi: "A wall that closes in — last ship flying wins." }
  },
  campaign: {
    name: "CAMPAIGN", colour: "#6dffbf", art: "campaign",
    solo: "1 PILOT", multi: "2-PLAYER CO-OP",
    long: "Missions instead of endlessness."
  },
  survey: {
    name: "SURVEY", colour: "#a08cff", art: "survey",
    solo: "1 PILOT — THERE IS ONE CHART", multi: null,
    long: "Exploration at its finest."
  },
  online: {
    name: "ONLINE", colour: "#87d8ff", art: "online",
    solo: null, multi: "UP TO 5, A SCREEN EACH",
    long: "Host a lobby and hand out the code, or join one, everybody on " +
          "their own device in the same match."
  }
};

/* How open each card is, 0 to 1. Animated rather than switched: a card that
   snaps to its open size reads as a layout bug, and the movement is what tells
   you the cards are one row rather than four separate buttons. */
let cardAnim = [0, 0, 0, 0];
let laneAnim = [0, 0];

function laneRows() { return LANES[modeLane].rows; }

/* A card's line, in the lane it is being read in. */
const cardLine = c =>
  typeof c.long === "string" ? c.long : (c.long[modeLane] || "");

/* Wrapping, measured against the font the text is actually drawn in — the
   card is the only place in this game with a paragraph in it, and a paragraph
   laid out against a guess at the character width is a paragraph that spills
   out of its box on somebody else's browser. */
/* One line, made to fit. The menus have a handful of captions that sit inside
   a card and are a shade wider than it — a line of type crossing the border it
   belongs inside is the kind of error you only see in a screenshot, and it does
   not stop being one when the card changes width. Shrinks rather than clips,
   and never below the readable floor: if it cannot fit at 16px it wraps
   instead, which is `wrapText`'s job. */
function fitLine(str, x, y, size, colour, align, alpha, maxW) {
  let sz = size;
  while (sz > 10) {
    ctx.font = readableTextSize(sz) +
      'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    // A context that cannot measure gets the line at its stated size rather
    // than an exception: this is a drawing helper, not a layout check.
    const m = ctx.measureText && ctx.measureText(str);
    if (!m || m.width <= maxW) break;
    sz -= 1;
  }
  text(str, x, y, sz, colour, align, alpha);
}

/* `#rrggbb` at an alpha. Canvas gradient stops need the alpha inside the
   colour — `globalAlpha` applies to the whole fill and cannot fade one end of
   one into the other. */
function tint(hex, alpha) {
  const n = parseInt(String(hex).slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," +
         (n & 255) + "," + alpha + ")";
}

function wrapText(str, size, maxW) {
  ctx.save();
  ctx.font = readableTextSize(size) +
             'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const out = [];
  let line = "";
  for (const word of String(str).split(" ")) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; }
    else line = next;
  }
  if (line) out.push(line);
  ctx.restore();
  return out;
}
