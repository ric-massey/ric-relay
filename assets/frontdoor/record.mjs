// Records one of the front door's videos straight off the app's own canvas,
// so it holds the drawing and none of the page's words. With the site served
// on :8912:
//
//   node assets/frontdoor/record.mjs cs 9
//   node assets/frontdoor/record.mjs kondrite 24
//   node assets/frontdoor/record.mjs scale 9
//
// The page runs on a made-up clock: requestAnimationFrame, performance.now
// and Date.now belong to this script, and every frame moves time on by exactly
// 1/30 s and is copied out before the next one is drawn. The first version
// recorded the canvas live (captureStream → MediaRecorder) in a headless
// browser that could not keep up, so half of KONDRITE's frames and more than
// half of How Big Everything Is's were the frame before again — the clips
// themselves stuttered, up to 1.2 s frozen, and that was the front door's
// "laggy videos" (found 2026-10-30). Now a slow machine only makes the
// recording take longer.
//
// Needs Playwright (PLAYWRIGHT=<path to its package> if it is not installed
// here) and an ffmpeg with libx264 (FF=<path>, else imageio-ffmpeg's:
// pip install imageio-ffmpeg). Writes <name>.mp4 and the <name>.jpg poster,
// which is the clip's first frame so the two line up.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
const PW = process.env.PLAYWRIGHT;
const { chromium } = await import(PW ? pathToFileURL(path.join(PW, "index.mjs")).href : "playwright");
const [name, secs] = [process.argv[2], +(process.argv[3] || 8)];
const OUT = path.dirname(fileURLToPath(import.meta.url));
const B = "http://localhost:8912/";
const FPS = 30, STEP = 1000 / FPS;
const JOBS = {
  cs: { url: "cs.html", vp: [1440, 900], wait: 3500, width: 680,
    setup: async (p) => { await p.click('[data-lmode="loop"]'); await p.waitForTimeout(800); },
    canvas: ".lprev canvas" },
  kondrite: { url: "projects/kondrite/index.html", vp: [1280, 800], wait: 6000, width: 1176,
    // The front page's run — a real ship flown by the game's own model —
    // copied out the moment it is drawn, before the menu goes over it, and
    // cropped to a window that follows the ship (from the run's own camera),
    // so the ship, its shots and the rocks are big enough to read.
    setup: async (p) => p.evaluate(() => {
      const src = document.getElementById("game"), c = document.createElement("canvas");
      const Wc = src.width, Hc = src.height, cw = Math.round(Wc * 0.46), ch = Math.round(Hc * 0.46);
      c.id = "__rec"; c.width = cw; c.height = ch; document.body.appendChild(c);
      const x = c.getContext("2d"), A = window.KondriteAttract, o = A.draw, W = A.world;
      let fx = 0.24, fy = 0.68;
      A.draw = function (...a) {
        const r = o.apply(this, a);
        const [, , w, h] = a, Z = 0.95 * Math.min(w, h) / 700;
        // where the ship is, as a fraction of the page, eased so the crop glides
        const tx = 0.24 + (W.ship.x - W.cam.x) * Z / w, ty = 0.68 + (W.ship.y - W.cam.y) * Z / h;
        fx += (tx - fx) * 0.08; fy += (ty - fy) * 0.08;
        const sx = Math.min(Wc - cw, Math.max(0, fx * Wc - cw / 2)), sy = Math.min(Hc - ch, Math.max(0, fy * Hc - ch / 2));
        x.drawImage(src, sx, sy, cw, ch, 0, 0, cw, ch);
        return r;
      };
    }),
    canvas: "#__rec" },
  scale: { url: "projects/how-big-everything-is/index.html", vp: [1440, 900], wait: 2500, width: 1536,
    setup: async (p) => { await p.getByText("START AT A QUARK", { exact: false }).click(); await p.waitForTimeout(1200);
      await p.getByText("Tour", { exact: true }).first().click(); await p.waitForTimeout(500); },
    canvas: "#view" },
};
const J = JOBS[name];
if (!J) { console.error(`record.mjs: no job "${name}" (${Object.keys(JOBS).join(", ")})`); process.exit(1); }

// the clock: free-running in real time while the page loads and is set up,
// held for the recording, where each frame is one call to __step
const CLOCK = `(() => {
  let now = 0, id = 0; const q = new Map(), base = Date.now();
  performance.now = () => now; Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => (q.set(++id, cb), id);
  window.cancelAnimationFrame = (i) => q.delete(i);
  window.__step = (ms) => { now += ms; const due = [...q.values()]; q.clear();
    for (const cb of due) try { cb(now); } catch (e) { console.error(e); } };
  const free = setInterval(() => window.__step(${STEP}), ${STEP});
  window.__hold = () => clearInterval(free);
})();`;

const ff = process.env.FF || execFileSync(process.platform === "win32" ? "py" : "python3",
  ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).trim();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fd-${name}-`));
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: J.vp[0], height: J.vp[1] }, deviceScaleFactor: 1.5 });
await ctx.addInitScript(CLOCK);
const p = await ctx.newPage();
await p.goto(B + J.url); await p.waitForTimeout(J.wait);
await J.setup(p);
await p.evaluate(() => window.__hold());
const frames = Math.round(secs * FPS);
for (let i = 0; i < frames; i++) {
  // PNG straight off the canvas, in the same task as the frame that drew it,
  // so a WebGL canvas has not been cleared yet
  const url = await p.evaluate(([sel, ms]) => { window.__step(ms); return document.querySelector(sel).toDataURL("image/png"); }, [J.canvas, STEP]);
  fs.writeFileSync(path.join(dir, `${String(i).padStart(5, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
  if (i % 60 === 0) process.stdout.write(`\r${name}: frame ${i}/${frames}`);
}
await b.close();
const mp4 = path.join(OUT, `${name}.mp4`);
execFileSync(ff, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "%05d.png"),
  "-vf", `scale='trunc(min(${J.width},iw)/2)*2':-2:flags=lanczos,format=yuv420p`,
  "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high", "-g", "60", "-movflags", "+faststart", mp4]);
execFileSync(ff, ["-y", "-loglevel", "error", "-i", mp4, "-frames:v", "1", "-q:v", "3", path.join(OUT, `${name}.jpg`)]);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\r${name}: ${frames} frames, ${fs.statSync(mp4).size} bytes`);
