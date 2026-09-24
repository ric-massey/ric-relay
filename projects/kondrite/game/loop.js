"use strict";

/* KONDRITE — THE LOOP
   ─────────────────────────────────────────────────────────────────────────────
   The frame loop, and keeping the host alive in the background.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── loop ────────────────────────────────────────────────────────────── */
const STEP = 1 / 60;      // longest slice of world time simulated in one go
const CATCHUP = 1.0;      // longest backlog worth replaying, in seconds

// The three states a match can be in. Only the first one moves, but a guest
// has to be told about all three.
const inMatch = () =>
  state === "playing" || state === "paused" || state === "menu" || state === "over" ||
  // A settings screen reached from a pause is still a paused match: the host
  // has to keep talking while somebody is fiddling with their controls.
  ((state === "controls" || state === "thumb") &&
   (backFrom === "paused" || backFrom === "menu"));

let last = performance.now();

/* One turn of the world. Everything is simulated in slices no longer than
   STEP: a gap of a whole second stepped in one lump would fling ships
   straight through rocks, and clamping it to a single small step instead
   would run the match in slow motion while everyone else's clock ran on. So
   the gap is replayed at ordinary speed. At a normal frame rate this is one
   slice of about 16ms, exactly as it was before. */
function tick(now, painting) {
  const elapsed = Math.max(0, (now - last) / 1000);
  last = now;
  // The gamepad is a snapshot, so it is read once here — menus included,
  // because a pad presses those too.
  readGamepad();
  // Beyond CATCHUP the world simply skips. A laptop that was asleep for
  // ten minutes should not spend ten minutes catching up.
  const span = Math.min(elapsed, CATCHUP);

  if (worldRunning()) {
    if (state === "playing") readLocalInput();
    else if (net.role === "host") readSimulationInput();
    // A mission can drop into slow motion for a beat — the mothership's core
    // going up. The clock the timer runs on is real, so slow motion ends when
    // it should no matter the frame rate; only the world advances slower.
    if (slowTimer > 0) { slowTimer -= span; if (slowTimer <= 0) slowScale = 1; }
    const worldSpan = span * (mode.campaign ? slowScale : 1);
    const slices = Math.max(1, Math.ceil(worldSpan / STEP)), dt = worldSpan / slices;
    for (let i = 0; i < slices; i++) {
      // A guest never simulates the world — it coasts what the host last
      // said and flies its own ship. The host runs the one real simulation.
      if (net.role === "guest") guestCoast(dt); else update(dt);
      if (!worldRunning()) break;
    }
  }

  // The network keeps talking after the world stops. A snapshot carries the
  // state and the result, so a paused or finished match reaches the guests —
  // stopping the moment the host stopped playing left them flying around a
  // match that had already been won. Once per turn, not once per slice: a
  // replayed second must not fire off a second's worth of snapshots at once.
  if (net.on && inMatch()) netPump(span);

  if (painting) render(span);
}

function frame(now) {
  tick(now, true);
  requestAnimationFrame(frame);
}

/* ── keeping the host alive in the background ─────────────────────────────
   A hidden tab gets no animation frames at all, and its timers are throttled
   to about one a second. For a solo game that just paused, that's fine. For
   the host it isn't: the host IS the match, and everyone else freezes with
   it. A timer inside a worker keeps its own clock, so the loop carries on
   while the host reads their email.

   The worker is a few lines of inline script, built the first time it's
   needed and never before — nothing is fetched, and a page that is only ever
   played locally never makes one. If the browser won't allow it, an ordinary
   throttled interval takes over; the match then advances in one-second
   catch-up bursts rather than smoothly, which is worse but still alive. */
const bgTicker = (() => {
  const SRC = "let h=0;onmessage=e=>{clearInterval(h);" +
              "if(e.data)h=setInterval(()=>postMessage(0),e.data)}";
  let worker, tried = false, timer = 0, running = false;

  function beat() {
    // Runs until the match is properly over and everyone has been told —
    // which is why this waits for the match to be left, not merely stopped.
    if (!net.on || !inMatch()) { stop(); return; }
    tick(performance.now(), false);
  }

  function stop() {
    if (!running) return;
    running = false;
    if (worker) worker.postMessage(0);
    if (timer) { clearInterval(timer); timer = 0; }
  }

  return {
    start() {
      if (running || !net.on) return;
      running = true;
      if (!tried) {
        tried = true;
        try {
          worker = new Worker(URL.createObjectURL(
            new Blob([SRC], { type: "text/javascript" })));
          worker.onmessage = beat;
        } catch (_) { worker = null; }
      }
      if (worker) worker.postMessage(16);
      else timer = setInterval(beat, 16);
    },
    stop
  };
})();

/* The same trick, for anything else that must keep its own time in a tab
   nobody is looking at. The lobby needs it as much as the match does: a host
   who switches tabs to send somebody the link is exactly the host who is
   waiting for a knock, and a throttled two-second heartbeat misses people
   entirely rather than merely running slowly. */
function makeTicker(fn, ms) {
  const SRC = "let h=0;onmessage=e=>{clearInterval(h);" +
              "if(e.data)h=setInterval(()=>postMessage(0),e.data)}";
  let worker = null, timer = 0, on = false;
  return {
    start() {
      if (on) return;
      on = true;
      try {
        worker = new Worker(URL.createObjectURL(
          new Blob([SRC], { type: "text/javascript" })));
        worker.onmessage = fn;
        worker.postMessage(ms);
      } catch (_) {
        worker = null;
        timer = setInterval(fn, ms);
      }
    },
    stop() {
      if (!on) return;
      on = false;
      if (worker) { worker.postMessage(0); worker.terminate(); worker = null; }
      if (timer) { clearInterval(timer); timer = 0; }
    }
  };
}

/* On-screen controls. Pointer events rather than touch events, so a stylus
   or a touchscreen laptop works the same, and pointer capture means sliding
   your thumb off a button still releases it. */
addEventListener("pointerdown", e => {
  if (e.pointerType === "touch") {
    const first = !document.body.classList.contains("touch");
    document.body.classList.add("touch");
    // The first touch is also how a laptop with a touchscreen becomes a
    // phone as far as the layout is concerned, so the question of which way
    // up it is has to be asked again here.
    if (first) checkOrientation();
  }
}, { once: false });

/* The stick. The knob follows your thumb out to the edge of the ring and no
   further, so the ring is an honest picture of how far there is to push. */
function stickTo(e) {
  const r = stickEl.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  const reach = r.width * 0.42;
  const d = Math.hypot(dx, dy);
  stick.mag = Math.min(1, d / reach);
  // Right in the middle there is no direction to be pushing in, so the last
  // one stands rather than snapping to whatever rounding says.
  if (d > 1) stick.ang = Math.atan2(dy, dx);
  stick.on = stick.mag > 0.22;      // dead zone, or a resting thumb steers
  const k = d > reach ? reach / d : 1;
  knobEl.style.transform =
    "translate(" + (dx * k).toFixed(1) + "px, " + (dy * k).toFixed(1) + "px)";
}

stickEl.addEventListener("pointerdown", e => {
  if (arranging) return;
  stick.pid = e.pointerId;
  grab(stickEl, e.pointerId);
  stickEl.classList.add("down");
  stickTo(e);
  e.preventDefault();
});
stickEl.addEventListener("pointermove", e => {
  if (arranging || stick.pid !== e.pointerId) return;
  stickTo(e);
  e.preventDefault();
});
const stickOff = e => { if (stick.pid === e.pointerId) stickRelease(); };
stickEl.addEventListener("pointerup", stickOff);
stickEl.addEventListener("pointercancel", stickOff);

// The hold buttons, and the pause — which is on the pad rather than on
// the canvas because the canvas corner it used to live in is now somewhere a
// player is entitled to have put their gun.
for (const el of [leftEl, rightEl, accelEl, gasEl, revEl, fireEl]) {
  el.addEventListener("pointerdown", e => {
    if (arranging) return;
    touch[el.dataset.hold] = true;
    el.classList.add("down");
    grab(el, e.pointerId);
    e.preventDefault();
  });
  const off = () => { touch[el.dataset.hold] = false; el.classList.remove("down"); };
  el.addEventListener("pointerup", off);
  el.addEventListener("pointercancel", off);
}
/* The device buttons. A press, not a hold — and it fires on `pointerdown`
   rather than on a click, because every other control on this pad answers the
   moment the thumb lands and a device that waited for the lift would feel
   broken beside them. */
for (const el of devEls) {
  el.addEventListener("pointerdown", e => {
    if (arranging) return;
    const i = +el.dataset.dev;
    if (useDevice(i)) {
      el.classList.add("down");
      setTimeout(() => el.classList.remove("down"), 140);
    }
    grab(el, e.pointerId);
    e.preventDefault();
  });
  const off = () => el.classList.remove("down");
  el.addEventListener("pointerup", off);
  el.addEventListener("pointercancel", off);
}

pauseEl.addEventListener("click", e => {
  if (arranging) return;
  pauseHere();
  e.preventDefault();
});

/* Laying the pad out. On the thumb-controls screen every piece is a thing
   you drag, and it is the real control being dragged — you are looking at
   the size and the reach you will actually be flying with, not a diagram. */
for (const [key, el] of PAD_PARTS) {
  el.addEventListener("pointerdown", e => {
    if (!arranging) return;
    const r = el.getBoundingClientRect();
    padDrag = { key, el, pid: e.pointerId,
                dx: e.clientX - (r.left + r.width / 2),
                dy: e.clientY - (r.top + r.height / 2) };
    grab(el, e.pointerId);
    el.classList.add("held");
    e.preventDefault();
  });
  el.addEventListener("pointermove", e => {
    if (!padDrag || padDrag.pid !== e.pointerId) return;
    const r = padEl.getBoundingClientRect();
    padCfg.pos[key] = padClamp(el, (e.clientX - padDrag.dx - r.left) / r.width,
                                   (e.clientY - padDrag.dy - r.top) / r.height);
    el.style.left = (padCfg.pos[key].x * 100) + "%";
    el.style.top = (padCfg.pos[key].y * 100) + "%";
    e.preventDefault();
  });
  const drop = e => {
    if (!padDrag || padDrag.pid !== e.pointerId) return;
    padDrag = null;
    el.classList.remove("held");
    padSave();
  };
  el.addEventListener("pointerup", drop);
  el.addEventListener("pointercancel", drop);
}
