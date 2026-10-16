// The front door's pictures are the rooms themselves: every cut on
// frontdoor.html looks through the page onto a real screenshot of the page it
// opens, and every tile in "Every room" is that room's own first screen.
// This takes them all again. Run it when a room changes how it looks:
//
//   python3 -m http.server 8912            (from the repo root, in another shell)
//   node assets/frontdoor/capture.mjs      (needs Playwright; PIL for the JPEGs)
//
// It writes <name>-d.jpg (desktop, 1440×900 at 1.5×), <name>-m.jpg (phone,
// 390×844 at 2×) and room-<name>.jpg (the directory tiles, 640×400) here.
import { chromium } from "playwright"; // installed globally here: NODE_PATH or a local install
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:8912/";
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// what each cut shows. `ready` gets the page to its best first screen;
// `phone: false` means the room has no phone view worth showing (KONDRITE asks
// a phone to turn sideways), and the cut uses the desktop picture there too.
const CUTS = [
  { name: "cs", url: "cs.html", wait: 4000 },
  { name: "kondrite", url: "projects/kondrite/index.html", wait: 7000, phone: false },
  { name: "entertainment", url: "entertainment.html", wait: 4000 },
  { name: "scale", url: "projects/how-big-everything-is/index.html", wait: 2500,
    ready: async (p) => { await p.getByText("START AT A QUARK", { exact: false }).click(); await p.waitForTimeout(2500); } },
  { name: "climbing", url: "climbing.html", wait: 4000 },
];
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
for (const c of CUTS) {
  await shoot(DESK, c.url, c.wait, c.ready, path.join(HERE, `${c.name}-d.jpg`), 76);
  if (c.phone !== false) await shoot(PHONE, c.url, c.wait, c.ready, path.join(HERE, `${c.name}-m.jpg`), 76);
}
for (const r of ROOMS) {
  await shoot({ viewport: { width: 1440, height: 900 } }, `${r}.html`, 3500, null, path.join(HERE, `room-${r}.jpg`), 80, "640x400");
}
await browser.close();
