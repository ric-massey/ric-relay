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

  function rock(x, y, r, spin, alpha) {
    const { ctx, glow } = api;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    glow(AMBER_D, 1.3, alpha, () => {
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

    /* ── the front page ───────────────────────────────────────────────────
       Its own scene, and the reason it is not just `survey` drawn bigger:
       these dioramas were composed for a card 740 by 174, and two of their
       three elements are a **fixed pixel size** — the chart cells are 11px and
       the ship is scale 1. On a card that is most of the picture; blown up to
       a whole page they are a postage stamp in one corner and a speck in
       another, and the page measures ~85% empty. Which is what it looked like.

       So this one is composed for the space it is actually drawn in. Everything
       scales off `w` and `h`, the chart lattice spans the page rather than
       sitting in a corner, and there are enough stars to be a sky rather than a
       sprinkle. The subject is the same as the card's and should be: space
       becomes known because somebody went there. */
    title(x, y, w, h, t) {
      const { ctx, glow } = api;
      const k = Math.min(w, h) / 700;        // one scale for the whole scene

      /* Three layers of stars at three speeds. Depth is what stops a starfield
         reading as noise, and it costs two more calls. */
      stars(x, y, w, h, t * 0.04, 90, "#6f5cc4");
      stars(x, y, w, h, t * 0.10, 46, VIOLET);
      stars(x, y, w, h, t * 0.19, 18, "#cfc4ff");

      // The nebula, large and off-centre, so the page has a subject.
      const nx = x + w * 0.70, ny = y + h * 0.40;
      for (let i = 0; i < 6; i++) {
        const f = 0.30 + i * 0.13 + Math.sin(t * 0.22 + i) * 0.02;
        glow(i % 2 ? VIOLET : "#6f5cc4", 1.8, 0.26 - i * 0.032, () => {
          ctx.beginPath();
          ctx.ellipse(nx, ny, w * 0.30 * f, h * 0.34 * f, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

      /* The chart filling in, across the whole page instead of in a corner.
         Cells light in a slow diagonal sweep — a wave rather than a raster,
         because a page-wide grid ticking left to right reads as a progress bar
         and this is meant to read as ground being covered. */
      const cell = Math.max(14, Math.round(26 * k));
      const gap = Math.max(3, Math.round(5 * k));
      const step = cell + gap;
      const cols = Math.ceil(w / step) + 1, rows = Math.ceil(h / step) + 1;
      ctx.save();
      ctx.fillStyle = VIOLET;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          /* A deterministic scatter decides which cells are ever charted, so
             the lattice is a survey and not a chessboard. */
          const seed = (c * 73.13 + r * 149.7) % 1;
          if (seed > 0.42) continue;
          const phase = (c + r * 0.6) * 0.30 - t * 0.5;
          const lit = 0.5 + 0.5 * Math.sin(phase);
          /* Quieter towards the middle of the page. The lattice is texture and
             the words are the subject, and a charted cell directly behind a
             letter is the one place this reads as a loading screen rather than
             as a chart. */
          const dx = (x + c * step + cell / 2 - (x + w / 2)) / (w / 2);
          const clear = Math.min(1, Math.abs(dx) * 1.7);
          ctx.globalAlpha = (0.025 + lit * lit * 0.12) * (0.25 + clear * 0.75);
          ctx.fillRect(x + c * step, y + r * step, cell, cell);
        }
      }
      ctx.restore();

      /* One ship, crossing slowly, at a size you can see. It is the only thing
         on the page that is a *thing* rather than a texture, so it is drawn
         last and it is the brightest. */
      const px = x + w * (0.08 + ((t * 0.014) % 1) * 0.94);
      /* High on the page rather than level with the buttons: down there it was
         the brightest thing on the same line as the thing you came to press,
         and the two competed. */
      const py = y + h * 0.29 + Math.sin(t * 0.18) * h * 0.07;
      const a = Math.sin(t * 0.18 + 1.57) * 0.14;
      glow(VIOLET, 1.4, 0.13, () => {
        ctx.beginPath();
        ctx.moveTo(px - 170 * k, py - Math.sin(t * 0.18) * 8 * k);
        ctx.lineTo(px - 16 * k, py);
        ctx.stroke();
      });
      ship(px, py, a, 1.7 * k, "#cfc4ff", 0.8, 0.35);
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
