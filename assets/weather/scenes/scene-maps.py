#!/usr/bin/env python3
"""What is where in each scene photo — the maps scene.js draws weather and life into.

  <id>-sky.png      where the sky is: cloud, stars, the sun and moon go there
  <id>-water.png    where the water is: it ripples, glitters and takes the rain
  <id>-lights.json  the city's windows and tower tops: lit at night, the tops red

Ric, 2026-10-25: "we need to make the pictures feel real so the ocean will have
the water moving the city will have lights flickering and on."

Ric, 2026-10-25: "if its cloudy the picture should have it be cloudy". To put
cloud in a photograph's sky, and not over its mountains, the page has to know
which pixels are sky. This finds them once, here, and writes <id>-sky.png: the
photo at 800 px wide, white, with the sky in its alpha channel.

A pixel is sky when it looks like sky (blue, or bright and grey-white like
cloud and haze) AND it joins up with the top edge of the picture through other
sky. That second rule keeps a blue lake, a white glacier or a pale wall from
being called sky. The sky is then grown by two pixels into the land and the
edge softened, because the photo's own blue runs right up to every ridge: a
mask that stopped exactly there left a blue fringe round each one under grey
cloud (seen on Cerro Torre, 2026-10-25).

    python3 assets/weather/scenes/scene-maps.py            # every scene photo
    python3 assets/weather/scenes/scene-maps.py torre      # one

Needs numpy, scipy and Pillow. Rerun it when a photo changes; check the result
with --sheet, which writes sky-check.jpg to the scratch folder you name.
"""
import sys
from pathlib import Path

import json

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = Path(__file__).resolve().parent
WIDTH = 800

# a few photos need a nudge: how pale a "white" pixel must be before it counts
# as cloud or haze rather than snow or rock (0-255 brightness). Cerro Torre's
# summit snow is as white as any cloud, so there only blue counts as sky.
WHITE = {"torre": 999, "mountains": 200, "water": 185}
# how much bluer than red a pixel must be: the city's glass towers are blue too
BLUE = {"city": 22}
# how strongly coloured blue sky must be: Cerro Torre's shaded summit snow is a
# pale blue, its sky a deep one
BLUE_SAT = {"torre": 0.4}
# the lowest the sky reaches, as a share of the height: below it is sea, lake
# or ground however blue it is (the beach's sea touches its sky at the horizon)
# how many pixels the sky is grown into the land (see above); the beach's
# mangrove is all thin branches, which growing and smoothing swallowed, so cloud
# drew over its leaves
GROW = {"beach": 0}
FLOOR = {"beach": 0.6, "city": 0.4, "water": 0.66, "mountains": 0.55, "torre": 0.75, "crag": 0.35, "forest": 0.4}


def mask_for(path, sid):
    im = Image.open(path).convert("RGB")
    h = round(im.height * WIDTH / im.width)
    a = np.asarray(im.resize((WIDTH, h), Image.LANCZOS)).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    v = a.max(axis=2)
    sat = (v - a.min(axis=2)) / np.maximum(v, 1)
    blue = (b > r + BLUE.get(sid, 12)) & (b >= g - 4) & (v > 95) & (sat >= BLUE_SAT.get(sid, 0))
    white = (sat < 0.16) & (v > WHITE.get(sid, 190))
    cand = blue | white
    cand[round(h * FLOOR.get(sid, 1)):] = False
    # join up with the top edge, through sky only
    lab, _ = ndimage.label(cand)
    top = set(np.unique(lab[0])) - {0}
    sky = np.isin(lab, list(top))
    # fill pin-holes (a bird, a speck of cloud shadow), drop crumbs
    grow = GROW.get(sid, 2)
    if grow:
        sky = ndimage.binary_closing(sky, iterations=2)
        sky = ndimage.binary_opening(sky, iterations=1)
        sky = ndimage.binary_dilation(sky, iterations=grow)
    m = Image.fromarray((sky * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    out = Image.new("LA", m.size, 255)
    out.putalpha(m)
    return out, sky.mean()


# where the water is: the rows it lies between (shares of the height), and
# either a point in it to grow from through water-coloured pixels, or "all"
# when everything in those rows is water (a lake's reflection is the colour of
# the mountains it reflects — only its place says it is water)
WATER = {
    "beach": {"rows": (0.6, 1.0), "seed": (0.85, 0.72), "kind": "turquoise"},
    "mountains": {"rows": (0.62, 0.95), "seed": (0.3, 0.8), "kind": "deep"},
    "water": {"rows": (0.657, 1.0), "all": True},
}


def water_for(path, sid):
    spec = WATER.get(sid)
    if not spec:
        return None, 0
    im = Image.open(path).convert("RGB")
    h = round(im.height * WIDTH / im.width)
    a = np.asarray(im.resize((WIDTH, h), Image.LANCZOS)).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    rows = np.zeros((h, WIDTH), bool)
    rows[round(h * spec["rows"][0]):round(h * spec["rows"][1])] = True
    if spec.get("all"):
        wet = rows
    else:
        if spec["kind"] == "turquoise":
            cand = (b > r + 25) & (g > r + 10)
        else:
            cand = (b > r + 12) & (a.max(axis=2) < 170)
        cand &= rows
        lab, _ = ndimage.label(cand)
        seed = lab[round(h * spec["seed"][1]), round(WIDTH * spec["seed"][0])]
        assert seed, f"{sid}: the water seed is not on water"
        wet = lab == seed
        wet = ndimage.binary_closing(wet, iterations=3)
        wet = ndimage.binary_fill_holes(wet)
        wet = ndimage.binary_erosion(wet, iterations=1)   # keep off the shore's first pixel
    m = Image.fromarray((wet * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    out = Image.new("LA", m.size, 255)
    out.putalpha(m)
    return out, wet.mean()


# the city's lights: a window is a small spot darker than the facade round it,
# on a building (not sky, not trees, above the foreground); the towers' tops are
# where the skyline peaks. Positions are shares of the photo's width and height.
LIGHTS = {"city": {"rows": (0.12, 0.86)}}


def lights_for(path, sid, sky_png):
    spec = LIGHTS.get(sid)
    if not spec:
        return None
    im = Image.open(path).convert("RGB")
    W0, H0 = im.size
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    grey = a.mean(axis=2)
    sky = np.asarray(Image.open(sky_png).getchannel("A").resize((W0, H0))) > 20
    # leaves, spring's yellow-green included
    tree = ((g > r + 8) & (g > b + 4)) | ((g > b + 22) & (g >= r - 6))
    tree = ndimage.binary_dilation(ndimage.binary_opening(tree, iterations=1), iterations=5)
    rows = np.zeros(grey.shape, bool)
    rows[round(H0 * spec["rows"][0]):round(H0 * spec["rows"][1])] = True
    building = rows & ~ndimage.binary_dilation(sky, iterations=4) & ~tree
    local = ndimage.uniform_filter(grey, 9)
    spot = building & (grey < local - 14)
    # one light per little neighbourhood: the darkest spot in each 5 px cell
    rng = np.random.default_rng(7)
    pts = []
    ys, xs = np.nonzero(spot)
    cells = {}
    for y, x in zip(ys, xs):
        k = (y // 5, x // 5)
        d = local[y, x] - grey[y, x]
        if k not in cells or d > cells[k][2]:
            cells[k] = (x, y, d)
    for x, y, d in cells.values():
        pts.append([round(x / W0, 4), round(y / H0, 4)])
    rng.shuffle(pts)
    # the skyline's peaks: the first land row in each column, its local tops
    top = np.argmax(~sky, axis=0).astype(float)
    tops = []
    for x in range(8, W0 - 8, 4):
        t = top[x]
        if t < H0 * 0.33 and t <= top[max(0, x - 40):x + 40].min() + 1:
            if not tops or x - tops[-1][0] > 40:
                tops.append((x, t))
    tops = sorted(tops, key=lambda p: p[1])[:8]
    return {"windows": pts[:3200], "tops": [[round(x / W0, 4), round((t + 2) / H0, 4)] for x, t in tops]}


def main(args):
    sheet = None
    if "--sheet" in args:
        i = args.index("--sheet")
        sheet = Path(args[i + 1])
        args = args[:i] + args[i + 2:]
    ids = args or sorted(p.stem for p in HERE.glob("*.jpg") if not p.stem.endswith("-thumb"))
    tiles = []
    for sid in ids:
        out, share = mask_for(HERE / f"{sid}.jpg", sid)
        out.save(HERE / f"{sid}-sky.png", optimize=True)
        print(f"{sid:10} sky {share:5.1%}  {(HERE / f'{sid}-sky.png').stat().st_size // 1024} KB")
        wet, wshare = water_for(HERE / f"{sid}.jpg", sid)
        if wet:
            wet.save(HERE / f"{sid}-water.png", optimize=True)
            print(f"{'':10} water {wshare:5.1%}")
        lit = lights_for(HERE / f"{sid}.jpg", sid, HERE / f"{sid}-sky.png")
        if lit:
            (HERE / f"{sid}-lights.json").write_text(json.dumps(lit, separators=(",", ":")) + "\n")
            print(f"{'':10} {len(lit['windows'])} windows, {len(lit['tops'])} tower tops")
            if sheet:
                ph = Image.open(HERE / f"{sid}.jpg").convert("RGB")
                d = ImageDraw.Draw(ph)
                for x, y in lit["windows"]:
                    d.rectangle((x * ph.width - 1, y * ph.height - 1, x * ph.width + 1, y * ph.height + 1), fill=(255, 200, 60))
                for x, y in lit["tops"]:
                    d.ellipse((x * ph.width - 5, y * ph.height - 5, x * ph.width + 5, y * ph.height + 5), fill=(255, 0, 0))
                ph.save(sheet / f"{sid}-lights-check.jpg", quality=85)
        if sheet and wet:
            photo = Image.open(HERE / f"{sid}.jpg").convert("RGB").resize(wet.size)
            cyan = Image.new("RGB", wet.size, (0, 255, 255))
            Image.composite(Image.blend(photo, cyan, 0.5), photo, wet.getchannel("A")).save(sheet / f"{sid}-water-check.jpg", quality=85)
        if sheet:
            photo = Image.open(HERE / f"{sid}.jpg").convert("RGB").resize(out.size)
            red = Image.new("RGB", out.size, (255, 0, 80))
            tiles.append(Image.composite(Image.blend(photo, red, 0.55), photo, out.getchannel("A")))
    if sheet and tiles:
        w, h = tiles[0].size
        cols = 3
        S = Image.new("RGB", (w * cols, h * ((len(tiles) + cols - 1) // cols)))
        for i, t in enumerate(tiles):
            S.paste(t.resize((w, h)), ((i % cols) * w, (i // cols) * h))
        S.save(sheet / "sky-check.jpg", quality=85)


if __name__ == "__main__":
    main(sys.argv[1:])
