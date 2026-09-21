/* KONDRITE — MENU DIORAMAS
   ─────────────────────────────────────────────────────────────────────────────
   The little moving pictures behind the mode cards. Loaded like `net.js` and
   `survey-hud.js` — a script tag and one global — because index.html is already
   the biggest file in the project and five animated scenes is not a small
   tenant.

   ── why these are drawn and not filmed ──────────────────────────────────────
   The obvious way to show a player what a mode looks like is a clip. A clip
   would mean five video files in a Pages repo, a build step to record them, and
   a promise that goes stale the first time a mode changes and nobody re-records
   it. These are drawn instead, from the same primitives the game itself draws
   with, which makes them a few kilobytes, correct offline, and impossible to
   desynchronise from the game in the one way that matters: they are made of the
   same shapes.

   They are *dioramas*, not simulations. Nothing here is the real engine — a
   real match running behind a menu card would be five worlds ticking to render
   a thumbnail. Each scene is a closed-form function of one number, `t`, so a
   card that is not on screen costs nothing and a card that is costs a few dozen
   strokes. Everything moves on sines; nothing accumulates, nothing collides,
   and no scene has any state to get wrong.

   ── what each one has to say ────────────────────────────────────────────────
   A card has about two seconds of a player's attention, so each scene shows the
   one thing that mode is *for*, and never a second thing:

     survival  many rocks, one ship, shots going out       — it is you against the field
     royale    several ships and a wall that is closing    — the arena is shrinking
     campaign  a formation, and something far too big      — you are in a war with a side
     survey    quiet, a nebula, a chart filling in         — nothing is hunting you
     online    five ships abreast, a link pulsing          — other people

   Nothing here uses shadowBlur, for the same reason `glow()` doesn't.        */

(function () {
  "use strict";

  const MENU = {};

  const AMBER   = "#ffe56d";
  const AMBER_D = "#ffcb42";
  const WARN    = "#ff8f77";
  const MINT    = "#6dffbf";
  const VIOLET  = "#a08cff";
  const ICE     = "#87d8ff";
  const WRECK   = "#7d8596";

  let api = null;

  /* The attract loop's own state. The front page is not a picture of a game, it
     is a game being played — so there is a run in progress, and it has a
     position, a heading, a throttle, and everywhere it has already been. */
  MENU.flight = { x: 0, y: 0, a: -0.5, thr: 1, last: 0 };


  MENU.init = function (deps) { api = deps; return MENU; };

  /* A ship, in the only shape this game has ever drawn one. Scaled rather than
     redrawn so a diorama ship and a real ship are recognisably the same object,
     which is the entire job of a preview. */
  function ship(x, y, a, s, colour, alpha, thrust) {
    const { ctx, glow } = api;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(s, s);
    glow(colour, 1.6, alpha, () => {
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-9, 8);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-9, -8);
      ctx.closePath();
      ctx.stroke();
    });
    if (thrust) {
      glow(AMBER_D, 1.4, alpha * 0.9, () => {
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(-13 - thrust * 5, 0);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function rock(x, y, r, spin, alpha, colour) {
    const { ctx, glow } = api;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    glow(colour || AMBER_D, 1.3, alpha, () => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = r * (0.78 + ((i * 5) % 4) * 0.09);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    });
    ctx.restore();
  }

  function shot(x, y, a, len, colour) {
    const { ctx, glow } = api;
    glow(colour, 2, 1, () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
      ctx.stroke();
    });
  }

  function stars(x, y, w, h, t, n, colour) {
    const { ctx } = api;
    ctx.save();
    ctx.fillStyle = colour;
    for (let i = 0; i < n; i++) {
      // Deterministic scatter: the same star field every frame, drifting.
      const sx = x + ((i * 73.13 + t * 8) % w);
      const sy = y + ((i * 149.7) % h);
      ctx.globalAlpha = 0.18 + 0.3 * Math.abs(Math.sin(i * 2.1 + t));
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }
    ctx.restore();
  }

  /* ── the five scenes ──────────────────────────────────────────────────────
     Each takes the box it may draw in and one clock. `t` is seconds and is
     never reset, so a card looks alive the moment it appears rather than
     starting from a blank frame. */
  const SCENES = {
    survival(x, y, w, h, t) {
      const cx = x + w / 2, cy = y + h / 2;
      stars(x, y, w, h, t * 0.4, 14, "#ffe56d");
      // A field of rocks drifting across, wrapping the way the arena does.
      for (let i = 0; i < 7; i++) {
        const px = x + ((i * 137 + t * (14 + i * 3)) % (w + 60)) - 30;
        const py = y + 18 + ((i * 61) % Math.max(1, h - 36));
        rock(px, py, 8 + (i % 3) * 4, t * (0.3 + i * 0.1), 0.8);
      }
      const a = Math.sin(t * 0.7) * 0.5 - Math.PI / 2;
      ship(cx, cy + Math.sin(t * 1.1) * 8, a, 1.1, AMBER, 1, 0.6 + Math.sin(t * 9) * 0.3);
      // Rounds going out on a burst rhythm, which is how the gun actually fires.
      const phase = (t % 1.6) / 1.6;
      if (phase < 0.5) {
        for (let k = 0; k < 3; k++) {
          const d = phase * 150 + k * 16;
          shot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, a, 9, AMBER);
        }
      }
    },

    royale(x, y, w, h, t) {
      const { ctx, glow } = api;
      stars(x, y, w, h, t * 0.3, 10, "#ff8f77");

      const { size, fade } = MENU.royaleWall(t);
      const iw = w * size, ih = h * size;
      const ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;

      // Outside the wall is dead ground, so it is tinted rather than left as
      // more of the same black — the shrinking is the whole point of the card
      // and it does not read unless what is being lost looks lost.
      ctx.save();
      ctx.fillStyle = WARN;
      ctx.globalAlpha = 0.06 * fade;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#05070c";
      ctx.fillRect(ix, iy, iw, ih);
      ctx.restore();

      glow(WARN, 2, 0.85 * fade, () => { ctx.strokeRect(ix, iy, iw, ih); });

      // Four ships circling inside what is left of it.
      const cols = [AMBER, MINT, ICE, "#ffb0ee"];
      const rr = Math.min(iw, ih) * 0.3;
      for (let i = 0; i < 4; i++) {
        const a = t * (0.5 + i * 0.11) + i * 1.7;
        const px = ix + iw / 2 + Math.cos(a) * rr;
        const py = iy + ih / 2 + Math.sin(a) * rr * 0.8;
        ship(px, py, a + Math.PI / 2, 0.85, cols[i], 0.95 * fade, 0.5);
      }
    },

    campaign(x, y, w, h, t) {
      const { ctx, glow } = api;
      stars(x, y, w, h, t * 0.2, 12, "#6dffbf");
      /* The capital, filling the right of the frame. It is drawn far too big
         for the box on purpose: the mission is that this thing is bigger than
         you are. */
      const bx = x + w * 0.82;
      ctx.save();
      ctx.fillStyle = "#05070c";
      ctx.fillRect(bx - w * 0.1, y, w * 0.4, h);
      ctx.restore();
      glow(WARN, 2, 0.8, () => {
        ctx.beginPath();
        ctx.moveTo(bx - w * 0.1, y + 4);
        ctx.lineTo(x + w, y + 4);
        ctx.moveTo(bx - w * 0.1, y + h - 4);
        ctx.lineTo(x + w, y + h - 4);
        ctx.moveTo(bx - w * 0.1, y + 4);
        ctx.lineTo(bx - w * 0.16, y + h / 2);
        ctx.lineTo(bx - w * 0.1, y + h - 4);
        ctx.stroke();
      });
      for (let i = 0; i < 4; i++) {
        const yy = y + h * (0.2 + i * 0.2);
        glow(WARN, 1.2, 0.4 + 0.4 * Math.abs(Math.sin(t * 2 + i)), () => {
          ctx.beginPath();
          ctx.moveTo(bx - w * 0.08, yy);
          ctx.lineTo(bx + w * 0.02, yy);
          ctx.stroke();
        });
      }
      // A wing flying in formation, because the campaign is the mode with sides.
      for (let i = 0; i < 3; i++) {
        const px = x + w * 0.18 + i * 22 + Math.sin(t * 0.9 + i) * 5;
        const py = y + h / 2 + (i - 1) * 22 + Math.cos(t * 0.8 + i) * 4;
        ship(px, py, 0, 0.95, MINT, 1, 0.7);
      }
    },

    survey(x, y, w, h, t) {
      const { ctx, glow } = api;
      stars(x, y, w, h, t * 0.15, 22, "#a08cff");
      // A nebula, drawn as rings the way the sector draws one.
      const nx = x + w * 0.66, ny = y + h * 0.42;
      for (let i = 0; i < 4; i++) {
        const f = 0.4 + i * 0.16 + Math.sin(t * 0.4 + i) * 0.03;
        glow(i % 2 ? VIOLET : "#6f5cc4", 1.6, 0.3 - i * 0.05, () => {
          ctx.beginPath();
          ctx.ellipse(nx, ny, w * 0.2 * f, h * 0.26 * f, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
      /* The chart filling in. A grid of cells lighting up one after another is
         the mode's whole loop in one picture: space becomes known because you
         went there. */
      const cw = 11, rows = 3, cols = 6;
      ctx.save();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = ((t * 2.2) % (rows * cols + 8)) > (r * cols + c);
          ctx.fillStyle = VIOLET;
          ctx.globalAlpha = lit ? 0.34 : 0.07;
          ctx.fillRect(x + 10 + c * (cw + 2), y + h - 12 - (rows - r) * (cw + 2),
                       cw, cw);
        }
      }
      ctx.restore();
      const a = -0.5 + Math.sin(t * 0.4) * 0.35;
      ship(x + w * 0.3 + Math.cos(t * 0.35) * w * 0.1,
           y + h * 0.44 + Math.sin(t * 0.5) * h * 0.12,
           a, 1, VIOLET, 1, 0.3);
    },

    /* ── the front page: an attract loop ───────────────────────────
       Ric, twice, and both notes were right. First: *"make it look like someone
       is playong the gzme not just random shit floating"* — so this is one
       flight, not a set of unrelated drifts. A ship is being flown: it steers,
       it eases the throttle, it banks, and everything else moves because the
       ship is moving.

       Then: *"go look at the actual game … the backround initially before you
       changed stuff looked better."* Which was the real correction. The version
       in between was violet, with a lattice of charted squares — and the game
       is **amber**. Its space is sparse: a scatter of faint motes, rock drawn
       as outline and never filled, and a sun that is the one thing on screen
       with a fill in it. Nothing in the game looks like a grid of purple
       tiles. So this is the game's own palette and the game's own sun, drawn
       the way `drawHazard` draws one, and the chart lattice is gone.

       `flight` is the run in progress, which is what makes this a loop rather
       than a function of `t`. */
    title(x, y, w, h, t) {
      const { ctx, glow } = api;
      const k = Math.min(w, h) / 700;
      /* Low and left: the middle of the page is the wordmark and the buttons,
         and a ship flying under them competes with the only two things anybody
         came here to read. */
      const cx = x + w * 0.22, cy = y + h * 0.70;
      const F = MENU.flight;

      /* ── flying it ───────────────────────────────────────────────────────
         A hand on the stick rather than a spline: the heading chases a
         wandering target at a real turn rate, so the ship leans into a turn and
         comes out of it late. `dt` is clamped because this is a wall clock and
         a backgrounded tab hands back whole minutes at once. */
      const dt = Math.min(0.05, Math.max(0, t - F.last));
      F.last = t;
      if (dt > 0) {
        const want = Math.sin(t * 0.11) * 1.7 + Math.sin(t * 0.043 + 1.2) * 1.3;
        let d = want - F.a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        F.a += Math.max(-1.5 * dt, Math.min(1.5 * dt, d));
        F.thr += (((0.45 + 0.55 * Math.sin(t * 0.27)) > 0.5 ? 1 : 0.3) - F.thr) * dt * 2;
        const sp = 45 + F.thr * 175;
        F.x += Math.cos(F.a) * sp * dt;
        F.y += Math.sin(F.a) * sp * dt;
      }
      const sx = wx => cx + (wx - F.x), sy = wy => cy + (wy - F.y);
      // How much a thing may shout, given the text column down the middle.
      const clear = px => 1 - 0.62 * (1 - Math.min(1, Math.abs(px - (x + w / 2)) / (w * 0.3)));

      /* ── the sky ─────────────────────────────────────────────────────────
         Sparse, small and amber, the way the sector's own motes are — and at
         three depths, which is the parallax that says the ship is travelling
         rather than the field drifting. */
      const layer = (frac, n, colour, size, lo) => {
        const span = 1400;
        ctx.save();
        ctx.fillStyle = colour;
        for (let i = 0; i < n; i++) {
          const ox = (i * 733.7) % span, oy = (i * 941.3) % span;
          let px = (ox - F.x * frac) % span; if (px < 0) px += span;
          let py = (oy - F.y * frac) % span; if (py < 0) py += span;
          px += x - (span - w) / 2; py += y - (span - h) / 2;
          if (px < x || px > x + w || py < y || py > y + h) continue;
          ctx.globalAlpha = (lo + 0.34 * Math.abs(Math.sin(i * 2.1))) * clear(px);
          ctx.fillRect(px, py, size, size);
        }
        ctx.restore();
      };
      layer(0.05, 120, "#7a6a3a", 1.2, 0.10);
      layer(0.20, 60, AMBER_D, 1.4, 0.14);
      layer(0.52, 22, AMBER, 1.8, 0.22);

      /* ── what it is flying through ───────────────────────────────────────
         Rock, in outline, on a jittered lattice in world space — so it arrives,
         passes and is gone, and the field never runs out and never repeats in a
         way you can catch. This is the thing the front page had at the start
         and it is the thing that looked right. */
      const GRID = 200;
      const gi = Math.floor((F.x - w * 0.7) / GRID), gj = Math.floor((F.y - h * 0.7) / GRID);
      for (let j = gj - 1; j <= gj + Math.ceil(h / GRID) + 2; j++) {
        for (let i = gi - 1; i <= gi + Math.ceil(w / GRID) + 2; i++) {
          const n = ((i * 73.13 + j * 149.7) % 1 + 1) % 1;
          if (n > 0.5) continue;
          const jx = ((i * 311.7 + j * 97.3) % 1 + 1) % 1;
          const jy = ((i * 59.1 + j * 421.9) % 1 + 1) % 1;
          const px = sx(i * GRID + jx * GRID), py = sy(j * GRID + jy * GRID);
          if (px < x - 70 || px > x + w + 70 || py < y - 70 || py > y + h + 70) continue;
          rock(px, py, (7 + n * 36) * k, t * (0.1 + n) * (n > 0.25 ? 1 : -1),
               (0.22 + n * 0.5) * clear(px), AMBER_D);
        }
      }

      /* ── a sun ───────────────────────────────────────────────────────────
         Drawn the way the sector draws one — see `drawHazard`: a filled disc at
         seven tenths, a ring at the edge, another inside it, and a corona of
         twelve spokes of two lengths, turning. It is the only thing in this
         game with a fill in it and it should stay that way. */
      const sun = (wx, wy, r, fill) => {
        const px = sx(wx), py = sy(wy);
        if (px < x - r * 2 || px > x + w + r * 2 ||
            py < y - r * 2 || py > y + h + r * 2) return;
        const a = clear(px);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(px, py, r * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        glow(fill, 1.6, a, () => {
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
        });
        glow(fill, 1.2, 0.55 * a, () => {
          ctx.beginPath(); ctx.arc(px, py, r * 0.6, 0, Math.PI * 2); ctx.stroke();
        });
        glow(fill, 1.3, 0.7 * a, () => {
          ctx.beginPath();
          for (let i = 0; i < 12; i++) {
            const ang = t * 0.25 + (i / 12) * Math.PI * 2;
            const len = r * (i % 2 ? 1.5 : 1.28);
            ctx.moveTo(px + Math.cos(ang) * r * 1.08, py + Math.sin(ang) * r * 1.08);
            ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
          }
          ctx.stroke();
        });
      };
      sun(1250, -520, 58 * k, "#ffe56d");
      sun(-1750, 900, 40 * k, "#ffd76d");

      /* A black hole, out there somewhere. Solid black, because a hole that is
         not solid is not a hole — the sector's own rule. You meet it when the
         flight takes you past it, which is what makes it a place. */
      {
        const hx = sx(-600), hy = sy(-1650), r = 34 * k;
        if (hx > x - 200 && hx < x + w + 200 && hy > y - 200 && hy < y + h + 200) {
          const a = clear(hx);
          for (let i = 0; i < 3; i++) {
            glow(i ? "#ff8f77" : AMBER, 2, (0.5 - i * 0.13) * a, () => {
              ctx.beginPath();
              ctx.ellipse(hx, hy, r * (2.5 + i * 0.7), r * (0.5 + i * 0.16),
                          0.34 + Math.sin(t * 0.25) * 0.06, 0, Math.PI * 2);
              ctx.stroke();
            });
          }
          ctx.save();
          ctx.fillStyle = "#000";
          ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          glow(AMBER, 2.6, 0.85 * a, () => {
            ctx.beginPath(); ctx.arc(hx, hy, r * 1.04, 0, Math.PI * 2); ctx.stroke();
          });
        }
      }

      /* ── and the pilot ───────────────────────────────────────────────────
         Amber, like every ship you have ever flown in this game, banking into
         its turns with the thrust on when the throttle is. The only thing on
         the page that does not move relative to the page, which is exactly
         what flying one feels like. */
      ship(cx, cy, F.a, 2.2 * k, AMBER, 1, F.thr > 0.6 ? 0.5 + F.thr * 0.5 : 0);
    },

    online(x, y, w, h, t) {
      const { ctx, glow } = api;
      stars(x, y, w, h, t * 0.25, 10, "#87d8ff");
      const cols = [AMBER, MINT, ICE, "#ffb0ee", "#d8b4ea"];
      const n = 5;
      for (let i = 0; i < n; i++) {
        const px = x + w * (0.14 + i * 0.18);
        const py = y + h / 2 + Math.sin(t * 1.2 + i * 0.9) * h * 0.16;
        ship(px, py, -Math.PI / 2, 0.8, cols[i], 0.95, 0);
        // A link between neighbours, lighting up along the row: five people,
        // one match, and the connection is the mode.
        if (i < n - 1) {
          const nx2 = x + w * (0.14 + (i + 1) * 0.18);
          const ny2 = y + h / 2 + Math.sin(t * 1.2 + (i + 1) * 0.9) * h * 0.16;
          const beat = 0.2 + 0.6 * Math.max(0, Math.sin(t * 2.4 - i * 0.8));
          glow(ICE, 1.2, beat, () => {
            ctx.beginPath();
            ctx.moveTo(px + 10, py);
            ctx.lineTo(nx2 - 10, ny2);
            ctx.stroke();
          });
        }
      }
    }
  };

  /* ── the closing wall, as one number ──────────────────────────────────────
     Pulled out of the scene and exported because the two things wrong with it
     were arithmetic rather than visual, and nothing about looking at a drawing
     catches either.

     It used to inset the arena by `f` on all four sides with `f` peaking at
     0.46, which leaves `1 - 2f` — eight per cent of the card. A box that small
     is not a closing wall, it is a dot, and the four ships inside it were on top
     of each other. The floor is a fraction of the card now, not an inset, so it
     cannot be squeezed from both ends by accident.

     And it used to run on a cosine, which meant the wall opened back up every
     few seconds. The real one never does — the mode is over before it could —
     so this is a sawtooth that closes and starts again, with the last tenth of
     the cycle faded out so the reset reads as a cut rather than as the wall
     springing open.

     The end size is a compromise the header already licenses: the real wall
     stops at a fifth of its arena, and a fifth of a menu card is forty pixels
     across with four ships to fit in it. What this card has to sell is that the
     space closes, not the exact ratio it closes to. */
  const ROYALE_OPEN = 0.92;   // arena as a fraction of the card, at the start
  const ROYALE_SHUT = 0.46;   // and once it has closed

  MENU.royaleWall = function (t) {
    const cycle = ((t * 0.15) % 1 + 1) % 1;          // safe for negative clocks
    const closing = Math.min(1, cycle / 0.9);
    return {
      size: ROYALE_OPEN - (ROYALE_OPEN - ROYALE_SHUT) * closing,
      fade: cycle > 0.9 ? Math.max(0, 1 - (cycle - 0.9) / 0.1) : 1
    };
  };

  MENU.has = key => Object.prototype.hasOwnProperty.call(SCENES, key);

  /* One entry point. Clips to the card so a scene can be written without
     worrying about its own edges, paints the ground so a card is never
     transparent over whatever the menu drew behind it, and hands the scene a
     box it is allowed to fill. */
  MENU.preview = function (key, x, y, w, h, t) {
    if (!api || w < 8 || h < 8) return false;
    const scene = SCENES[key];
    if (!scene) return false;
    const { ctx } = api;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = "#05070c";
    ctx.fillRect(x, y, w, h);
    scene(x, y, w, h, t);
    ctx.restore();
    return true;
  };

  window.KondriteMenu = MENU;
})();
