#!/usr/bin/env node
"use strict";

/* CROSSFIRE — IN A REAL BROWSER
   ─────────────────────────────────────────────────────────────────────────────
   Every other suite in here runs the game inside `vm` with a hand-built window
   and a canvas context whose every method is a no-op. That is what makes them
   fast enough to run on every change, and it is the right trade — but it means
   there is a whole class of bug they cannot see, because the thing that is
   wrong is the part being stubbed.

   Three of those shipped this year:

     · The page's own `<script src>` graph. The harness reads index.html and
       runs the modules itself, so a module the page does not actually load,
       or loads in the wrong order, passes every headless check.
     · Drawing. With a no-op context nothing is ever painted, so a canvas that
       had `inset: 0` and no width or height — 300×150 in the corner of a black
       page — was invisible to every test and obvious to anyone who opened it.
     · Real input. The keydown handler was swallowing `a`, `w`, space and Tab
       out of the account panel's email and password fields, because a canvas
       game preventDefaults those keys. A synthetic event into a stub DOM never
       reproduced it. Somebody typing their password did.

   So this is deliberately not a second copy of the logic tests. It asks only
   the questions that need a browser to answer: does it load, does it draw, does
   it take input, and does it come back after a reload.

   Playwright is a **test-time** dependency and the only one this project has.
   The game still ships as static files with no build step and no runtime
   dependency — see ../README.md. Install it here:

       cd test && npm run setup

   Then:  node test/browser.js          (or `npm run browser` from test/)

   Skipped with a clear message, not a failure, when Playwright is not
   installed: the fast suites are the ones that must run everywhere. */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.log("CROSSFIRE browser checks SKIPPED — playwright is not installed");
  console.log("  install it with:  cd test && npm run setup");
  process.exit(0);
}

let fails = 0;
function check(ok, why) {
  if (ok) return true;
  console.error("  FAIL  " + why);
  fails++;
  return false;
}

/* The game is static files, so a static file server is the whole of what it
   needs to be served properly. `file://` would not do: local storage is
   partitioned differently there and the reload check is about a real origin. */
const TYPES = { ".html": "text/html", ".js": "text/javascript",
                ".css": "text/css", ".json": "application/json",
                ".png": "image/png", ".svg": "image/svg+xml" };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
      const file = path.join(DIR, rel || "index.html");
      // Never outside the project, however the URL is spelled.
      if (!file.startsWith(DIR)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end("no"); }
        res.writeHead(200, {
          "content-type": TYPES[path.extname(file)] || "application/octet-stream",
          // Every check wants the file on disk, not the one from the last check.
          "cache-control": "no-store"
        });
        res.end(buf);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const server = await serve();
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port + "/index.html";

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();

  /* Anything the page says went wrong. Collected from the first navigation so
     that a module that throws on load is caught where it happens rather than
     as eight confusing failures further down. */
  const problems = [];
  page.on("pageerror", e => problems.push("threw: " + e.message));
  page.on("console", m => {
    if (m.type() === "error") problems.push("console: " + m.text());
  });
  page.on("requestfailed", r =>
    problems.push("did not load: " + r.url().split("/").pop()));

  await page.goto(base + "?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__cf, null, { timeout: 15000 });

  // ── it loads ──────────────────────────────────────────────────────────────
  /* The page's own script graph, as the browser resolved it — not as a test
     read it out of the markup. A module listed in index.html and missing from
     the directory is a 404 here and a passing suite everywhere else. */
  const mods = await page.evaluate(() => ({
    world: typeof window.CrossfireSurveyWorld,
    save:  typeof window.CrossfireSurveySave,
    hud:   typeof window.CrossfireSurveyHUD,
    menu:  typeof window.CrossfireMenu,
    tags:  [...document.querySelectorAll("script[src]")].map(s => s.getAttribute("src"))
  }));
  check(mods.world === "function", "survey-world.js did not define its global");
  check(mods.save === "function", "survey-save.js did not define its global");
  check(mods.hud && mods.hud !== "undefined", "survey-hud.js did not define its global");
  check(problems.length === 0, "the page reported: " + problems.join(" | "));
  console.log("  loads      " + mods.tags.length + " modules, all of them there · " +
              "nothing thrown, nothing logged, nothing 404");

  // ── it draws ──────────────────────────────────────────────────────────────
  /* A no-op context never painted a pixel, so no other suite has ever checked
     that the canvas is the size of the window or that anything reaches it. */
  await page.evaluate(async () => {
    window.__cf.start("survey", 1);
    await new Promise(r => setTimeout(r, 1800));
  });
  const drawn = await page.evaluate(() => {
    const c = document.getElementById("game");
    const r = c.getBoundingClientRect();
    const g = c.getContext("2d");
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) lit++;
    return { w: Math.round(r.width), h: Math.round(r.height),
             bw: c.width, bh: c.height, dpr: window.devicePixelRatio || 1,
             vw: window.innerWidth, vh: window.innerHeight,
             px: c.width * c.height, lit };
  });
  /* Not "fills the window": the stage keeps a margin and the canvas letterboxes
     itself to the game's aspect, so on a tall screen it is legitimately short.
     What is never legitimate is a replaced element left at its intrinsic
     300×150 — the exact bug this is here for — so the width is asked for, and
     the backing store is asked to match the box it is drawn into. */
  check(drawn.w > drawn.vw * 0.9,
        "the canvas is " + drawn.w + "×" + drawn.h + " in a " +
        drawn.vw + "×" + drawn.vh + " window");
  check(Math.abs(drawn.bw / drawn.dpr - drawn.w) < 2 &&
        Math.abs(drawn.bh / drawn.dpr - drawn.h) < 2,
        "the canvas draws at " + drawn.bw + "×" + drawn.bh + " into a " +
        drawn.w + "×" + drawn.h + " box at dpr " + drawn.dpr);
  check(drawn.lit > drawn.px * 0.002,
        "only " + drawn.lit + " of " + drawn.px + " pixels were painted at all");
  console.log("  draws      canvas " + drawn.w + "×" + drawn.h + " in " +
              drawn.vw + "×" + drawn.vh + " · " +
              (drawn.lit / 1000).toFixed(0) + "k pixels lit of " +
              (drawn.px / 1000).toFixed(0) + "k");

  // ── it takes typing ───────────────────────────────────────────────────────
  /* The one that shipped. A canvas game preventDefaults the keys it flies with,
     and the account panel's fields are real DOM inputs sitting over it — so
     every letter the game uses vanished out of somebody's password. Typed for
     real, through the browser's own keyboard, which is the only way this is
     reproducible at all. */
  /* Opened the way it opens, not by unhiding a div. The panel is several
     screens sharing one set of controls and the game decides which row is
     showing; reaching past that and poking `hidden` would type into a field no
     player can reach and prove nothing. */
  await page.evaluate(() => window.__cf.account());
  await page.waitForSelector("#acctEmail:visible", { timeout: 5000 });

  const SAMPLE = "a wasd pw 1234 e.f@g.co";
  for (const [sel, what] of [["#acctEmail", "email"], ["#acctPass", "password"]]) {
    await page.click(sel);
    await page.fill(sel, "");
    await page.keyboard.type(SAMPLE);
    const got = await page.$eval(sel, el => el.value);
    check(got === SAMPLE,
          "typing " + JSON.stringify(SAMPLE) + " into the " + what +
          " field left " + JSON.stringify(got));
  }
  /* And Tab still moves between them. It is one of the keys the game takes —
     battle royale follows a different ship with it — so the guard has to let it
     through here and nowhere else. */
  await page.click("#acctEmail");
  await page.keyboard.press("Tab");
  const moved = await page.evaluate(() => document.activeElement &&
                                          document.activeElement.id);
  check(moved === "acctPass",
        "Tab out of the email field went to " + JSON.stringify(moved) +
        " rather than the password");
  console.log("  typing     every key the game flies with survives both account " +
              "fields, and Tab still moves between them");
  await page.keyboard.press("Escape");

  // ── it scrolls ────────────────────────────────────────────────────────────
  /* Splitting the pages left the wheel dispatching on a state that no longer
     existed, so the record page — the one page always taller than the screen —
     could not be moved at all. A real wheel event over a real canvas. */
  const scrolled = await page.evaluate(async () => {
    const cf = window.__cf, H = window.CrossfireSurveyHUD;
    const c = document.getElementById("game"), g = c.getContext("2d");
    const hash = () => {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261;
      for (let i = 0; i < d.length; i += 97) { h ^= d[i]; h = Math.imul(h, 16777619); }
      return h >>> 0;
    };
    const s = cf.survey();
    s.docked = s.stations[0];
    cf.screen("record");
    if (H.recordOpened) H.recordOpened();
    cf.draw();
    const tall = H.recordHeight > H.recordView;
    const before = hash();
    c.dispatchEvent(new WheelEvent("wheel",
      { deltaY: 600, bubbles: true, cancelable: true }));
    cf.draw();
    return { tall, moved: before !== hash(),
             h: Math.round(H.recordHeight), v: Math.round(H.recordView) };
  });
  check(scrolled.tall,
        "the record page is " + scrolled.h + "px in a " + scrolled.v +
        "px window — there is nothing to scroll and nothing to prove");
  check(scrolled.moved, "a wheel over the record page moved nothing");
  console.log("  scrolls    the record page runs " + scrolled.h + "px in a " +
              scrolled.v + "px window, and the wheel moves it");

  // ── it takes a drag ───────────────────────────────────────────────────────
  /* The gesture, end to end, through the browser's own pointer events. The
     headless suite drives `grabAt`/`carryTo`/`dropAt` straight and so has
     always passed — which is exactly how a press on the ship page stopped
     reaching any of them: the dispatch in index.html still asked for a page
     called `inventory`, and the spares tray had moved to SHIP. Nothing could
     be dragged into a slot at all, and every test said it could. */
  const dragged = await page.evaluate(async () => {
    const cf = window.__cf, H = window.CrossfireSurveyHUD, s = cf.survey();
    const c = document.getElementById("game");
    const r = c.getBoundingClientRect();
    const scale = r.width / 1000;                       // SCREEN_W
    const pt = (x, y) => ({ clientX: r.left + x * scale, clientY: r.top + y * scale,
                            pointerId: 9, bubbles: true, cancelable: true,
                            pointerType: "mouse", isPrimary: true });
    const frame = () => new Promise(res => requestAnimationFrame(res));

    s.docked = s.stations[0];
    s.store = { layerplate: 1 };
    s.slots = [null, null, null, null];
    cf.screen("ship");
    if (H.shipOpened) H.shipOpened();
    await frame(); await frame();

    const rows = H.storeRows(), boxes = H.slotBoxes();
    if (!rows.length || !boxes.length) return { rows: rows.length, boxes: boxes.length };
    const f = { x: rows[0].x + rows[0].w / 2, y: rows[0].y + rows[0].h / 2 };
    const t = { x: boxes[0].x + boxes[0].w / 2, y: boxes[0].y + boxes[0].h / 2 };

    c.dispatchEvent(new PointerEvent("pointerdown", pt(f.x, f.y)));
    await frame();
    for (let i = 1; i <= 6; i++) {
      c.dispatchEvent(new PointerEvent("pointermove",
        pt(f.x + (t.x - f.x) * i / 6, f.y + (t.y - f.y) * i / 6)));
      await frame();
    }
    const held = H.carrying();
    c.dispatchEvent(new PointerEvent("pointerup", pt(t.x, t.y)));
    await frame(); await frame();
    return { rows: rows.length, boxes: boxes.length, held,
             fitted: s.slots[0] && s.slots[0].key, kept: s.store.layerplate || 0 };
  });
  check(dragged.rows > 0 && dragged.boxes === 4,
        "the ship page drew " + dragged.rows + " draggable parts and " +
        dragged.boxes + " slots");
  check(dragged.held === true, "moving a pressed part across the page is not a drag");
  check(dragged.fitted === "layerplate",
        "a part dragged onto a slot landed as " + JSON.stringify(dragged.fitted));
  console.log("  drags      a part picked up off the spares tray and dropped " +
              "into a slot, by pointer events alone");

  // ── it comes back ─────────────────────────────────────────────────────────
  /* A real origin, a real reload, a real local storage. The headless suites
     drive a Map standing in for one. */
  const seedBefore = await page.evaluate(async () => {
    /* Flying, not standing on a page. Survey stops its clock while a page is
       open — see `which pages stop the clock` — and the autosave runs on that
       clock, so waiting for one from the record page waits for ever. */
    window.__cf.screen("playing");
    const s = window.__cf.survey();
    s.cash = 31337;
    s.hold.iridium = 23;
    // The game's own autosave clock, not a test hook.
    await new Promise(r => setTimeout(r, 16000));
    return { seed: s.seed, cash: 31337, iridium: 23 };
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => !!window.__cf, null, { timeout: 15000 });
  const after = await page.evaluate(async () => {
    window.__cf.start("survey", 1);
    await new Promise(r => setTimeout(r, 1800));
    const s = window.__cf.survey();
    return { seed: s.seed, cash: Math.round(s.cash), iridium: s.hold.iridium };
  });
  check(after.seed === seedBefore.seed,
        "the sector changed over a reload: " + seedBefore.seed + " → " + after.seed);
  check(after.cash === seedBefore.cash && after.iridium === seedBefore.iridium,
        "the run did not come back: cash " + after.cash + ", iridium " + after.iridium);
  console.log("  resumes    same sector over a real reload, with the hold and " +
              "the purse intact");

  // ── on a phone ────────────────────────────────────────────────────────────
  /* The mode is played on phones and the interface knows it — `touchOnly` sizes
     every caption and every tap target. Nothing headless has ever laid the page
     out at 390 points across. */
  const phone = await ctx.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(base + "?debug=1", { waitUntil: "load" });
  await phone.waitForFunction(() => !!window.__cf, null, { timeout: 15000 });
  const small = await phone.evaluate(async () => {
    window.__cf.start("survey", 1);
    await new Promise(r => setTimeout(r, 1800));
    const c = document.getElementById("game");
    const r = c.getBoundingClientRect();
    window.__cf.screen("inventory");
    window.__cf.draw();
    const taps = window.__cf.taps().filter(t => t.live);
    const tiny = taps.filter(t => t.w < 30 || t.h < 24);
    return { w: Math.round(r.width), h: Math.round(r.height),
             body: document.body.scrollWidth, win: window.innerWidth,
             taps: taps.length, tiny: tiny.length };
  });
  check(small.body <= small.win + 1,
        "the page scrolls sideways on a phone: " + small.body + "px of body in " +
        small.win + "px of window");
  check(small.taps > 0, "nothing on the cargo page can be pressed on a phone");
  check(small.tiny === 0,
        small.tiny + " of " + small.taps + " controls are under a thumb's worth " +
        "of pixels at 390 across");
  console.log("  phone      390×844: canvas " + small.w + "×" + small.h +
              " · no sideways scroll · " + small.taps +
              " controls, none of them too small");

  await browser.close();
  server.close();
}

main().then(() => {
  if (fails) {
    console.error("\nCROSSFIRE browser checks FAILED (" + fails + ")");
    process.exit(1);
  }
  console.log("CROSSFIRE browser checks passed");
}).catch(e => {
  console.error("CROSSFIRE browser checks THREW\n", e);
  process.exit(1);
});
