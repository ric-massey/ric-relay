// The pictures on frontdoor.html, and where each comes from:
//
//   cs / kondrite / scale .webm + .jpg   videos of the apps running, recorded
//       straight off their own canvas by record.mjs, next to this file
//   entertainment.jpg   a wall of the room's own posters (assets/posters/)
//   Climbing's rip      a photo from photos/; Training's is drawn live from
//       the latest run (never committed — hard rule 1)
//   room-<name>.jpg     each room's first screen, for "Every room" — this file
//
// Re-run when a room changes how it looks:
//
//   python3 -m http.server 8912            (from the repo root, in another shell)
//   node assets/frontdoor/capture.mjs      (needs Playwright; PIL for the JPEGs)
import { chromium } from "playwright"; // installed globally here: NODE_PATH or a local install
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:8912/";

const ROOMS = ["orrin", "psyche", "climbing", "training", "exploration", "gaming", "workbench", "captures", "entertainment"];

const jpeg = (png, out, q, size) => execFileSync("python3", ["-c", `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
if sys.argv[4] != "-":
    w, h = map(int, sys.argv[4].split("x")); im = im.resize((w, h), Image.LANCZOS)
im.save(sys.argv[2], "JPEG", quality=int(sys.argv[3]), optimize=True, progressive=True)
`, png, out, String(q), size || "-"]);

const browser = await chromium.launch();
async function shoot(opts, url, wait, ready, out, q, size) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load" });
  await page.waitForTimeout(wait);
  if (ready) await ready(page);
  const png = out.replace(/\.jpg$/, ".png");
  await page.screenshot({ path: png });
  await ctx.close();
  jpeg(png, out, q, size);
  execFileSync("rm", [png]);
  console.log("wrote", path.relative(process.cwd(), out));
}
for (const r of ROOMS) {
  await shoot({ viewport: { width: 1440, height: 900 } }, `${r}.html`, 3500, null, path.join(HERE, `room-${r}.jpg`), 80, "640x400");
}
await browser.close();
