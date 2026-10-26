#!/usr/bin/env python3
"""Real lightning, a real night sky and the real moon for Weather's scenes.

Ric, 2026-10-25: "do it all" — the last drawn things in the sky become real
photographs, all from Wikimedia Commons, public domain or CC BY, credited in
night.json (and the settings sheet when they show):

  bolt-<n>.png   a real lightning stroke, keyed out of its own night sky: the
                 sky's glow (a heavy blur of the photo) is taken away so only
                 the bolt is left, as light, in the alpha. Drawn added onto the
                 scene where a strike lands.
  stars.jpg      a National Park Service photograph of the Milky Way, its sky
                 only — the night sky behind a clear night's scene
  moon.png       NASA's Lunar Reconnaissance Orbiter mosaic of the near side,
                 cut round — the page lights it to the real phase

    python3 assets/weather/skies/make-night.py

Needs OpenCV, numpy and Pillow.
"""
import io
import json
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
CTX = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
UA = {"User-Agent": "RicsWebsite-night/1.0 (personal site; ricmassey.com)"}

# each bolt: the photo, and the box round one stroke (left, top, right, bottom shares)
BOLTS = [
    ("3 Near-Simultaneous Lightning Strikes on One Exposure.jpg", (0.03, 0.36, 0.32, 0.77)),
    ("3 Near-Simultaneous Lightning Strikes on One Exposure.jpg", (0.72, 0.5, 0.95, 0.77)),
    ("CG lightning strike - Flickr - Axel Rouvin.jpg", (0.25, 0.0, 0.9, 0.86)),
    ("Lightning Strikes (70479607).jpeg", (0.3, 0.52, 0.75, 0.885)),
    ("Lightning strike in the evening.jpg", (0.2, 0.15, 0.65, 0.95)),
]
STARS = ("Milky Way and starry night sky (26972689115).jpg", (0.0, 0.0, 1.0, 0.4))   # above the plants on its horizon
MOON = "Moon nearside LRO color mosaic.png"


def fetch(u):
    import time
    for k in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), context=CTX, timeout=120).read()
            time.sleep(1)
            return r
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(10 * (k + 1))
    raise SystemExit("Commons kept saying slow down: " + u)


def commons(title, width):
    q = urllib.parse.urlencode({"action": "query", "titles": "File:" + title, "prop": "imageinfo",
                                "iiprop": "url|extmetadata", "iiurlwidth": width, "format": "json"})
    pg = next(iter(json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + q))["query"]["pages"].values()))
    ii = pg["imageinfo"][0]
    m = ii["extmetadata"]
    meta = {"title": title.rsplit(".", 1)[0], "url": ii["descriptionurl"],
            "by": __import__("re").sub("<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()[:80],
            "licence": m.get("LicenseShortName", {}).get("value", "")}
    img = Image.open(io.BytesIO(fetch(ii.get("thumburl") or ii["url"])))
    return img, meta


def bolt(img, box):
    im = img.convert("RGB")
    W0, H0 = im.size
    im = im.crop((round(W0 * box[0]), round(H0 * box[1]), round(W0 * box[2]), round(H0 * box[3])))
    a = np.asarray(im).astype(np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    glow = cv2.GaussianBlur(lum, (0, 0), max(6, im.width / 60))      # the sky's own light round the bolt
    k = np.clip((lum - glow - 0.05) / 0.45, 0, 1)
    k = np.maximum(k, np.clip((lum - 0.85) / 0.15, 0, 1))            # the white-hot core stays whole
    k[k < 0.1] = 0                                                    # the sky's grain is not lightning (and it made 1 MB PNGs)
    # and nothing that is not joined to a stroke: specks the key let through
    # added up into a grainy box once the page drew the bolt bright
    n, lab, stats, _ = cv2.connectedComponentsWithStats((k > 0).astype(np.uint8), 8)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= max(60, (k > 0).sum() * 0.004)
    k = k * keep[lab]
    k = (np.round(k * 32) / 32).astype(np.float32)
    # its own colour, pulled towards a white with a little blue: the photos' skies tint them purple
    col = a * 0.35 + np.array([0.86, 0.9, 1.0], np.float32) * 0.65
    col[k == 0] = 0
    out = np.dstack([col, k])
    ys, xs = np.nonzero(k > 0.06)
    out = out[max(0, ys.min() - 4):ys.max() + 4, max(0, xs.min() - 4):xs.max() + 4]
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8))


def main():
    meta = {"bolts": [], "stars": None, "moon": None}
    cache = {}
    for i, (title, box) in enumerate(BOLTS):
        if title not in cache:
            cache[title] = commons(title, 2400)
        img, m = cache[title]
        b = bolt(img, box)
        b.thumbnail((700, 1100), Image.LANCZOS)
        b.save(HERE / f"bolt-{i}.png", optimize=True)
        meta["bolts"].append({**m, "file": f"bolt-{i}.png", "w": b.width, "h": b.height})
        print(f"bolt-{i}  {b.size}  {(HERE / f'bolt-{i}.png').stat().st_size // 1024} KB  {m['licence']}")
    img, m = commons(STARS[0], 2400)
    im = img.convert("RGB")
    W0, H0 = im.size
    im = im.crop((0, 0, W0, round(H0 * STARS[1][3])))
    clean = Image.new("RGB", im.size); clean.paste(im)                # no EXIF (hard rule 1)
    clean.thumbnail((2400, 2400), Image.LANCZOS)
    clean.save(HERE / "stars.jpg", "JPEG", quality=80, optimize=True, progressive=True)
    im = clean
    meta["stars"] = {**m, "file": "stars.jpg", "w": im.width, "h": im.height}
    print(f"stars    {im.size}  {(HERE / 'stars.jpg').stat().st_size // 1024} KB  {m['licence']}")
    img, m = commons(MOON, 1200)
    im = img.convert("RGB")
    a = np.asarray(im).astype(np.float32)
    lum = a.mean(-1)
    ys, xs = np.nonzero(lum > 55)          # the disc itself, not the dark space round its limb
    cx, cy, r = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, max(xs.max() - xs.min(), ys.max() - ys.min()) / 2
    side = int(2 * r) + 2
    disc = im.crop((int(cx - r) - 1, int(cy - r) - 1, int(cx - r) - 1 + side, int(cy - r) - 1 + side)).resize((512, 512), Image.LANCZOS)
    yy, xx = np.mgrid[0:512, 0:512]
    rr = np.hypot(xx - 255.5, yy - 255.5)
    alpha = np.clip((253 - rr) * 128, 0, 255).astype(np.uint8)   # a two-pixel edge, no more
    # what the eye sees of a full moon: grey, evenly lit to the edge, bright
    # highlands and darker seas — the mosaic is colour-stretched and darkens
    # towards its rim, so: grey, each ring divided by its own mean, levels set
    g = np.asarray(disc.convert("L")).astype(np.float32)
    ring = np.round(rr).astype(int).clip(0, 300)
    inside = rr < 248
    means = np.bincount(ring[inside], g[inside], minlength=301) / np.maximum(np.bincount(ring[inside], minlength=301), 1)
    means[232:] = means[232]                      # the last rings are mostly limb: hold them to the level inside, or the edge glows
    flat = g / np.maximum(means[ring], 1) * np.mean(g[inside])
    lo, hi = np.percentile(flat[inside], 2), np.percentile(flat[inside], 99.5)
    v = np.clip((flat - lo) / (hi - lo), 0, 1) * 0.62 + 0.33
    rgb = np.dstack([v * 252, v * 248, v * 238]).clip(0, 255).astype(np.uint8)
    out = np.dstack([rgb, alpha])
    Image.fromarray(out).save(HERE / "moon.png", optimize=True)
    meta["moon"] = {**m, "file": "moon.png"}
    print(f"moon     512  {(HERE / 'moon.png').stat().st_size // 1024} KB  {m['licence']}")
    (HERE / "night.json").write_text(json.dumps(meta, indent=1) + "\n")


if __name__ == "__main__":
    main()
