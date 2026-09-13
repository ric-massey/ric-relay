"use strict";

/* CROSSFIRE — WHAT THE PAGE LOADS
   ─────────────────────────────────────────────────────────────────────────────
   Every harness in here boots the game the same way: run the modules the page
   pulls in, then run the inline script, all inside one `vm` sandbox. Each of
   them used to name those modules itself — `survey-hud.js` here, `menu.js`
   there, and an assertion in six files that the HUD is loaded before the inline
   script because the inline script captures the global once at boot.

   Six copies of one fact is six places to forget. Splitting a module out of
   index.html meant editing every harness that had never heard of it, and a
   harness that had not heard of it did not fail loudly — it ran the game with
   one module missing and reported whatever that broke as a game bug.

   So the page is asked. `<script src="…">` tags are read out of index.html in
   the order the browser would run them, and that order is the order they run
   here. Adding a module to the game adds it to every harness and to none of
   their source.

   What is skipped is named, not guessed: the networking and account layers want
   a real browser (`RTCPeerConnection`, `fetch`, a Supabase client) and none of
   them is what any of these files is about. A harness that wants one can ask
   for it. */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DIR = path.join(__dirname, "..");

/* The multiplayer and account layers. Stubbed rather than loaded, the same way
   they were before this file existed — the difference is that the list is here,
   once, instead of being implied by what six harnesses happened to name. */
const OFF_BY_DEFAULT = ["net.js", "config.js", "cloud.js"];

const html = () => fs.readFileSync(path.join(DIR, "index.html"), "utf8");

/* The inline game script: the first `<script>` with no `src`. */
function inlineOf(markup) {
  const m = [...markup.matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
  )][0];
  if (!m) throw new Error("index.html has no inline game script");
  return m[1];
}

/* Every `<script src>` the page loads before the inline script, in page order.
   Only local files — a CDN would not be a module of this game. */
function srcsOf(markup) {
  const upto = markup.slice(0, markup.search(/<script(?![^>]*\bsrc=)[^>]*>/i));
  return [...upto.matchAll(/<script[^>]*\bsrc="([^"]+)"/gi)]
    .map(m => m[1])
    .filter(s => !/^https?:|^\/\//.test(s));
}

/* Read the page once and hand back what a harness needs from it. */
function page() {
  const markup = html();
  return { html: markup, inline: inlineOf(markup), srcs: srcsOf(markup) };
}

/* Run the game into a prepared sandbox: the modules first, in the page's order,
   then the inline script. Returns the names it ran, so a harness can say so.

   `skip` adds to the default list; `with` takes something off it. Both name
   files, because a file is what the page names. */
function boot(sandbox, opts) {
  const o = opts || {};
  const skip = new Set(OFF_BY_DEFAULT.concat(o.skip || []));
  for (const name of o.with || []) skip.delete(name);

  const p = page();
  const ran = [];
  for (const src of p.srcs) {
    const name = src.split("/").pop();
    if (skip.has(name)) continue;
    vm.runInContext(fs.readFileSync(path.join(DIR, src), "utf8"),
                    sandbox, { filename: name });
    ran.push(name);
  }
  vm.runInContext(p.inline, sandbox, { filename: "index.inline.js" });
  return ran;
}

/* One module's source, for the handful of checks that read the code rather than
   run it — "this string is not drawn any more", and the like. */
const source = name => fs.readFileSync(path.join(DIR, name), "utf8");

module.exports = { DIR, page, boot, source, OFF_BY_DEFAULT };
