"use strict";

/* KONDRITE — MENUS AND THE HUD
   ─────────────────────────────────────────────────────────────────────────────
   The field behind the menus, the minimap, tapping the menus, the campaign
   and match HUDs, the menu in two steps, and the machines one floor down.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

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
