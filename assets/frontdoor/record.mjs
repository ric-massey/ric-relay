// Records one of the front door's videos straight off the app's own canvas
// (canvas.captureStream → MediaRecorder), so it holds the drawing and none of
// the page's words. With the site served on :8912:
//
//   node assets/frontdoor/record.mjs cs 9
//   node assets/frontdoor/record.mjs kondrite 24
//   node assets/frontdoor/record.mjs scale 9
//
// The page plays the .mp4, not this .webm: MediaRecorder's file has no
// duration or seek index (so every loop hitches) and VP9 is decoded in
// software on Safari. Make it with the ffmpeg that ships in imageio-ffmpeg:
//
//   FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
//   $FF -i scale.webm -an -vf "scale='trunc(min(1536,iw)/2)*2':-2:flags=lanczos,fps=30,format=yuv420p" \
//       -c:v libx264 -preset slow -crf 23 -profile:v high -g 60 -movflags +faststart scale.mp4
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const [name, secs] = [process.argv[2], +(process.argv[3] || 8)];
const OUT = path.dirname(fileURLToPath(import.meta.url));
const B = "http://localhost:8912/";
const JOBS = {
  cs: { url: "cs.html", vp: [1440, 900], wait: 3500,
    setup: async (p) => { await p.click('[data-lmode="loop"]'); await p.waitForTimeout(800); },
    canvas: ".lprev canvas" },
  kondrite: { url: "projects/kondrite/index.html", vp: [1280, 800], wait: 6000,
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
  scale: { url: "projects/how-big-everything-is/index.html", vp: [1440, 900], wait: 2500,
    setup: async (p) => { await p.getByText("START AT A QUARK", { exact: false }).click(); await p.waitForTimeout(1200);
      await p.getByText("Tour", { exact: true }).first().click(); await p.waitForTimeout(500); },
    canvas: "#view" },
};
const J = JOBS[name];
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await (await b.newContext({ viewport: { width: J.vp[0], height: J.vp[1] }, deviceScaleFactor: 1.5 })).newPage();
await p.goto(B + J.url); await p.waitForTimeout(J.wait);
await J.setup(p);
await p.evaluate(([sel, ms]) => new Promise((done) => {
  const cv = document.querySelector(sel), st = cv.captureStream(30);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const rec = new MediaRecorder(st, { mimeType: mime, videoBitsPerSecond: 2_200_000 }), parts = [];
  rec.ondataavailable = (e) => parts.push(e.data);
  rec.onstop = async () => {
    const buf = new Uint8Array(await new Blob(parts, { type: "video/webm" }).arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    window.__b64 = btoa(s); window.__poster = cv.toDataURL("image/jpeg", 0.85); done();
  };
  rec.start(); setTimeout(() => rec.stop(), ms);
}), [J.canvas, secs * 1000]);
const len = await p.evaluate(() => window.__b64.length); let b64 = "";
for (let i = 0; i < len; i += 2_000_000) b64 += await p.evaluate(([a, c]) => window.__b64.slice(a, a + c), [i, 2_000_000]);
fs.writeFileSync(`${OUT}/${name}.webm`, Buffer.from(b64, "base64"));
const poster = await p.evaluate(() => window.__poster);
fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(poster.split(",")[1], "base64"));
console.log(name, fs.statSync(`${OUT}/${name}.webm`).size, "bytes");
await b.close();
