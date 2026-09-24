#!/usr/bin/env node
"use strict";

/* KONDRITE — DOES IT SOUND ALL RIGHT
   ─────────────────────────────────────────────────────────────────────────────
   "These sounds need to not be annoying." — Ric, 2026-09-24

   Nobody can listen to a test, so this measures the things that make game
   sound grating, and holds every sound to them. Each one is rendered through
   the game's own code — the functions are lifted out of index.html, not
   re-typed — into an OfflineAudioContext, and then taken apart:

     · HARSH   energy between 2 and 5 kHz, where hearing is most sensitive.
               A bright square wave sitting there is the sound people call
               "piercing". The scatter gun measured 38% before this existed.
     · HISS    energy above 5 kHz. Raw white noise puts half of an impact
               there, and it reads as static rather than as a hit. Every
               impact was over 30% before the noise was filtered.
     · LENGTH  for anything that fires several times a second. A 0.44s beam
               at eight shots a second is a drone, which is the worst of all.
     · SAMENESS and STACKING — two renders of one sound must differ, and the
               same sound twice inside 35ms must come out once.
     · THE DIALS — a channel at zero is silence, and so is the master.

   The limits are what the sounds pass now with room to spare, not what they
   happened to measure; move a limit only because a sound was meant to change.

   Needs Playwright, like browser.js, and skips cleanly without it. */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..");
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.log("KONDRITE sound checks SKIPPED — playwright is not installed");
  process.exit(0);
}

let fails = 0;
function check(ok, why) {
  if (!ok) { console.error("  FAIL  " + why); fails++; }
  return ok;
}

const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
function grab(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error("index.html no longer has " + JSON.stringify(start));
  return html.slice(a, b);
}
const ENGINE = grab("  /* ── how loud, and which dial", "  function toggleSound() {");

// Things that happen several times a second in an ordinary fight or dig.
const FREQUENT = ["laser", "beam", "shot", "hit", "rock", "tink", "pickup", "fizz"];
const ALL = ["laser", "beam", "scatter", "seeker", "lance", "shot", "hit", "rock",
             "boom", "tink", "fizz", "warp", "thrust", "pickup", "explode",
             "start", "win", "lose"];
const LIMIT = { harsh: 20, hiss: 15, frequentMs: 200 };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
      const file = path.join(DIR, rel || "index.html");
      if (!file.startsWith(DIR)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "content-type": file.endsWith(".wav") ? "audio/wav"
                                           : file.endsWith(".js") ? "text/javascript" : "text/html" });
        res.end(buf);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:" + server.address().port + "/index.html?sounds");

  const got = await page.evaluate(async ({ ENGINE, ALL }) => {
    const RATE = 44100;
    /* One context per render, with the game's engine evaluated inside it so
       `audioCtx`, `audioMaster` and the rest resolve to this render's. */
    async function render(plays, opts) {
      opts = opts || {};
      const audioCtx = new OfflineAudioContext(1, RATE * 2, RATE);
      const audioMaster = audioCtx.createGain();
      audioMaster.gain.value = 0.24;
      audioMaster.connect(audioCtx.destination);
      let audioNoise = null;
      const soundEnabled = true;
      const audioUnlock = () => audioCtx;
      // eslint-disable-next-line no-eval
      const api = eval("(() => {" + ENGINE +
        "; return { playSfx, LASERS, laserBuffers, audioVol, sfxLast }; })()");
      Object.assign(api.audioVol, opts.vol || {});
      for (const [kind, l] of Object.entries(api.LASERS)) {
        const bytes = await (await fetch(l.file)).arrayBuffer();
        api.laserBuffers[kind] = await audioCtx.decodeAudioData(bytes);
      }
      if (opts.master != null) audioMaster.gain.value = 0.24 * opts.master;
      for (const [kind, at] of plays) {
        // An offline context's clock does not run until rendering, so each
        // play is its own suspend point on the timeline.
        if (at > 0) {
          audioCtx.suspend(at).then(() => { api.playSfx(kind, 0, true); audioCtx.resume(); });
        } else api.playSfx(kind, 0, true);
      }
      return (await audioCtx.startRendering()).getChannelData(0);
    }

    function measure(d) {
      let pk = 0, ss = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; ss += d[i] * d[i]; }
      let last = 0;
      for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > pk * 0.0316) last = i;
      const N = 2048, E = { low: 0, mid: 0, harsh: 0, hiss: 0 };
      for (let s = 0; s + N <= Math.max(N, last + 1); s += N / 2) {
        for (let k = 1; k < N / 2; k += 2) {
          let re = 0, im = 0;
          const w = 2 * Math.PI * k / N;
          for (let n = 0; n < N; n++) {
            const x = (d[s + n] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * n / N));
            re += x * Math.cos(w * n); im -= x * Math.sin(w * n);
          }
          const e = re * re + im * im, f = k * RATE / N;
          if (f < 500) E.low += e; else if (f < 2000) E.mid += e;
          else if (f < 5000) E.harsh += e; else E.hiss += e;
        }
      }
      const tot = E.low + E.mid + E.harsh + E.hiss || 1;
      return { peak: pk, energy: ss, ms: Math.round((last + 1) / RATE * 1000),
               harsh: Math.round(E.harsh / tot * 100), hiss: Math.round(E.hiss / tot * 100) };
    }

    const each = {};
    for (const kind of ALL) each[kind] = measure(await render([[kind, 0]]));
    // Two shots in one session, as a game plays them: the variation's generator
    // runs on between them, so the second must not be a copy of the first.
    const pair = await render([["laser", 0], ["laser", 0.5]]);
    const half = Math.round(0.5 * RATE);
    let differ = 0;
    for (let i = 0; i < half; i++) differ += Math.abs(pair[i] - pair[i + half]);
    /* One render, so all three share one noise buffer (it is made from
       Math.random per context, and comparing two renders compared two
       different noises — which failed about one run in five). A volley at 0,
       a single hit at 0.8, two hits 0.3 apart from 1.4. Each hit still varies
       up to 15% in level, so the limits below leave room for that and nothing
       else: an unlimited volley measures well over 3x. */
    const seq = await render([["rock", 0], ["rock", 0.01], ["rock", 0.02],
                              ["rock", 0.8], ["rock", 1.4], ["rock", 1.7]]);
    const win = (a, b) => {
      let e = 0;
      for (let i = Math.round(a * RATE); i < Math.round(b * RATE); i++) e += seq[i] * seq[i];
      return e;
    };
    const stacked = win(0, 0.5), one = win(0.8, 1.3), apart = win(1.4, 2.0);
    const muted = measure(await render([["laser", 0], ["rock", 0]], { vol: { weapons: 0, impacts: 0 } })).peak;
    const master = measure(await render([["laser", 0]], { master: 0 })).peak;
    return { each, differ, one, stacked, apart, muted, master };
  }, { ENGINE, ALL });

  for (const [kind, m] of Object.entries(got.each)) {
    check(m.peak > 0, kind + " made no sound at all");
    check(m.harsh <= LIMIT.harsh, kind + " is harsh: " + m.harsh + "% of it between 2 and 5 kHz");
    check(m.hiss <= LIMIT.hiss, kind + " is hiss: " + m.hiss + "% of it above 5 kHz");
    if (FREQUENT.includes(kind)) {
      check(m.ms <= LIMIT.frequentMs, kind + " plays several times a second and lasts " +
            m.ms + "ms — it will stack into a drone");
    }
  }
  // The miss is the commonest sound in the game; it must be the quietest.
  const loud = k => got.each[k].peak;
  check(loud("tink") < Math.min(...["laser", "hit", "rock"].map(loud)),
        "a missed round is louder than a shot or a hit");
  // The lance fires every few seconds and is allowed to be bigger than the cannon.
  check(loud("lance") > loud("laser"), "the rail lance is no bigger than the cannon");
  check(got.differ > 1, "two cannon shots came out identical — every one sounds the same");
  check(got.stacked < got.one * 1.6,
        "three rock hits inside 20ms played " + (got.stacked / got.one).toFixed(1) + "x as loud as one");
  check(got.apart > got.one * 1.4, "two rock hits 0.3s apart did not both play");
  check(got.muted === 0, "a channel turned to zero still made a sound");
  check(got.master === 0, "the master turned to zero still made a sound");

  // ── the listening booth still plays the game's sounds ────────────────────
  /* sounds/listen.html lifts the engine out of index.html at load, so a
     rename or a moved function there breaks it silently — a page of buttons
     that play nothing. Counted at the source: the audio nodes it makes. */
  const booth = await browser.newPage();
  const boothErrors = [];
  booth.on("pageerror", e => boothErrors.push(e.message));
  booth.on("response", r => { if (r.status() >= 400) boothErrors.push(r.status() + " " + r.url()); });
  await booth.addInitScript(() => {
    window.__made = { osc: 0, buf: 0 };
    const P = (window.AudioContext || window.webkitAudioContext).prototype;
    const o = P.createOscillator, b = P.createBufferSource;
    P.createOscillator = function () { window.__made.osc++; return o.apply(this, arguments); };
    P.createBufferSource = function () { window.__made.buf++; return b.apply(this, arguments); };
  });
  await booth.goto("http://127.0.0.1:" + server.address().port + "/sounds/listen.html");
  const ready = await booth.waitForFunction(() => window.__listenReady, null, { timeout: 10000 })
    .then(() => true, () => false);
  check(ready, "the listening booth did not find the game's sound code");
  if (ready) {
    await booth.locator("button.play", { hasText: "PLAY" }).nth(4).click();   // a busy fight
    await booth.waitForTimeout(1500);
    const made = await booth.evaluate(() => window.__made);
    check(made.buf > 3 && made.osc > 0,
          "the booth's busy fight made " + made.buf + " samples and " + made.osc + " tones");
  }
  check(boothErrors.length === 0, "the listening booth reported: " + boothErrors.join(" | "));
  console.log("  booth      sounds/listen.html plays the game's own engine, lasers and all");

  const worstHarsh = Object.entries(got.each).sort((a, b) => b[1].harsh - a[1].harsh)[0];
  const worstHiss = Object.entries(got.each).sort((a, b) => b[1].hiss - a[1].hiss)[0];
  console.log("  measured   " + ALL.length + " sounds · harshest " + worstHarsh[0] + " " +
              worstHarsh[1].harsh + "% (limit " + LIMIT.harsh + ") · hissiest " + worstHiss[0] +
              " " + worstHiss[1].hiss + "% (limit " + LIMIT.hiss + ")");
  console.log("  repeats    no two shots alike · a volley on one frame plays once · " +
              "every dial goes to silence");

  await browser.close();
  server.close();
  console.log(fails ? "KONDRITE sound checks FAILED (" + fails + ")" : "KONDRITE sound checks passed");
  process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
