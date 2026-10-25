#!/usr/bin/env python3
"""Where the sky is in each scene photo — the masks scene.js draws cloud into.

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

    python3 assets/weather/scenes/sky-masks.py            # every scene photo
    python3 assets/weather/scenes/sky-masks.py torre      # one

Needs numpy, scipy and Pillow. Rerun it when a photo changes; check the result
with --sheet, which writes sky-check.jpg to the scratch folder you name.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
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
