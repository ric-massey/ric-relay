#!/usr/bin/env python3
"""What is where in each scene photo — the maps scene.js draws weather and life into.

  <id>-sky.png      where the sky is: cloud, stars, the sun and moon go there
  <id>-water.png    where the water is: it ripples, glitters and takes the rain
  <id>-lights.json  the city's windows and tower tops: lit at night, the tops red
  <id>-depth.png    how far away each pixel is (near white, far black): haze and
                    fog by real distance, cloud shadows on the ground, lightning
  <id>-shore.png    on a beach, the band either side of the waterline and the way
                    to the sea (RG) — the page pulls the photo's own water and
                    foam up the sand with each wave and lets it slide back
  <id>-flat.jpg     the photo as it would look under an overcast sky — its hard
                    sun shadows lifted, highlights tamed — cross-faded in as the
                    sky greys over (Ric: "what else can you do to improve it?")

Ric, 2026-10-25: "we need to make the pictures feel real so the ocean will have
the water moving the city will have lights flickering and on."

Ric, 2026-10-25: "if its cloudy the picture should have it be cloudy". To put a
sky in a photograph, and not over its mountains, the page has to know which
pixels are sky.

Where the sky is: a trained scene-segmentation model, not a colour rule (Ric,
2026-10-25: "there is mistakes on the mountains and stuff where there is sky
where there should be mountains … it needs to be phenominal"). The colour rules
that came first called Montreal's far horizon and four tower tops sky, swallowed
the lake's snowy summit and a ridge on Cerro Torre, and grew every edge two
pixels into the rock. Now:
  1. SegFormer-B5 trained on ADE20K (nvidia/segformer-b5-finetuned-ade-640-640,
     150 scene classes, sky among them) reads the whole photo for context and
     overlapping 640 px tiles at full size for detail, run once, here, offline.
     Nothing it makes is shown: it only says which pixels are sky.
  2. Only sky joined to the top edge counts (a lake's reflection is not sky),
     and nothing below the photo's FLOOR.
  3. The model hedges in deep notches between peaks, so its sky grows into
     neighbouring pixels the colour of the sky beside them (blue, and not
     darker: snow, cloud and twigs stay out). On the beach, sky-blue gaps
     inside the mangrove's canopy are sky too (HOLES).
  4. The edge is snapped to the photo's own pixels with a colour-guided filter
     (He, Sun & Tang) inside a narrow band round the model's edge, and a
     luminance key keeps anything clearly darker than the sky beside it —
     twigs, wires, antennas a pixel or two wide, too fine for the model.
  5. Colour decontamination: a pixel on a ridge is part rock, part the photo's
     blue sky. With another sky behind it that blue showed as a halo, so the
     photo itself is rebuilt with the old sky's colour taken out of its edge
     pixels — what professional sky replacement does. The photo is made again
     from the original on Commons each run (cached in .scene-cache/,
     gitignored), so this never compounds. Only pixels that are mostly land
     are cleaned: dividing by a small share of land turned noise into a white
     line along Montreal's skyline.
The mask is <id>-sky.png at the photo's full size, white, sky in alpha.

    python3 assets/weather/scenes/scene-maps.py            # every scene photo
    python3 assets/weather/scenes/scene-maps.py torre      # one

Needs numpy, scipy, Pillow, OpenCV, PyTorch and transformers (the model, about
340 MB, downloads once into the Hugging Face cache). Rerun it when a photo
changes. To check a mask, composite the photo over a dark sky and look along
every edge at full size — a thumbnail hides exactly the mistakes that matter.
--sheet writes check images to the scratch folder you name.
"""
import sys
from pathlib import Path

import json

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".scene-cache"
WIDTH = 800          # the water, depth and plant maps' width
PHOTO = 3000         # the scene photos' long side (and a 1600 copy for phones: <id>-1600.jpg)
MASK = 2000          # the sky mask's width

# the photos' originals on Commons, and the JPEG quality each is saved at
SOURCES = {
    "forest": ("Bois Raquet, in the High Fens – Eifel Nature Park (DSCF6655).jpg", 60),
    "mountains": ("Mountain lake, Mylgval mountain cirque, Western Caucasus.jpg", 60),
    "city": ("Montreal - QC - Skyline.jpg", 68),
    "water": ("Lake Kinney mit Mount Whitehorn.jpg", 80),
    "beach": ("Havelock Island, Mangrove tree on the beach, Andaman Islands.jpg", 80),
    "crag": ("The sandstone cliffs and spires of Colorado National Monument attract hundreds of climbers a year. (9e8ceddd-0a94-4c97-82dd-ee36edf697c7).jpg", 76),
    "torre": ("Cerro Torre (5457586054).jpg", 80),
    # Ric, 2026-10-26: "another crag picture one that shows more of the sky",
    # "one for the smokeys", "one for the rockeys"
    "cliff": ("High cliff in Lyse with climbers 1.jpg", 76),
    "smokies": ("Blue Ridge (Great Smoky Mountains, North Carolina, USA) 1.jpg", 80),
    "rockies": ("Meeker, Longs, Lady Washington.jpg", 72),
}
# the lowest the sky reaches, as a share of the height: below it is sea, lake
# or ground whatever the model thinks (a guard, not the main rule)
# gaps inside a canopy: sky-blue pixels this close (px) to the sky are sky even
# when no path of sky reaches them — the mangrove's leaves showed the photo's
# blue through every hole. Only where nothing else near the sky is blue.
HOLES = {"beach": 50}
FLOOR = {"beach": 0.6, "city": 0.45, "water": 0.66, "mountains": 0.6, "torre": 0.8, "crag": 0.4, "forest": 0.45, "cliff": 0.55, "smokies": 0.5, "rockies": 0.45}
MODEL = "nvidia/segformer-b5-finetuned-ade-640-640"
_model = None


def original(sid):
    """the photo as it was published, at 2400 px, before anything here touched it"""
    import ssl, urllib.parse, urllib.request
    CACHE.mkdir(exist_ok=True)
    out = CACHE / f"{sid}.jpg"
    if not out.exists():
        ctx = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
        ua = {"User-Agent": "RicsWebsite-scene-maps/1.0 (personal site; ricmassey.com)"}
        q = urllib.parse.urlencode({"action": "query", "titles": "File:" + SOURCES[sid][0], "prop": "imageinfo",
                                    "iiprop": "url", "iiurlwidth": PHOTO, "format": "json"})
        pg = next(iter(json.load(urllib.request.urlopen(urllib.request.Request(
            "https://commons.wikimedia.org/w/api.php?" + q, headers=ua), context=ctx))["query"]["pages"].values()))
        out.write_bytes(urllib.request.urlopen(urllib.request.Request(pg["imageinfo"][0]["thumburl"], headers=ua), context=ctx).read())
    im = Image.open(out).convert("RGB")
    im.thumbnail((PHOTO, PHOTO), Image.LANCZOS)
    clean = Image.new("RGB", im.size)              # a fresh image: no EXIF, XMP or ICC (hard rule 1)
    clean.paste(im)
    return clean


PLANTS = ("tree", "grass", "plant", "palm", "flower")


def sky_probability(im):
    """the model's chance that each pixel is sky, and that it is a plant (tree,
    grass, plant, palm, flower — what the wind moves): the whole picture for
    context, overlapping full-size tiles for detail"""
    global _model
    import torch
    from transformers import SegformerForSemanticSegmentation
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    if _model is None:
        _model = SegformerForSemanticSegmentation.from_pretrained(MODEL).to(dev).eval()
    sky_id = next(k for k, v in _model.config.id2label.items() if v == "sky")
    plant_ids = [k for k, v in _model.config.id2label.items() if v in PLANTS]
    mean, std = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225])

    def probs(img):
        a = (np.asarray(img).astype(np.float32) / 255 - mean) / std
        x = torch.tensor(a.transpose(2, 0, 1)[None], dtype=torch.float32, device=dev)
        with torch.no_grad():
            lo = _model(pixel_values=x).logits
        lo = torch.nn.functional.interpolate(lo, size=a.shape[:2], mode="bilinear", align_corners=False)
        sm = torch.softmax(lo, 1)[0]
        return torch.stack([sm[sky_id], sm[plant_ids].sum(0)]).cpu().numpy()

    W0, H0 = im.size
    s = 768 / max(W0, H0)
    small = probs(im.resize((round(W0 * s), round(H0 * s)), Image.LANCZOS))
    ctx = np.stack([np.asarray(Image.fromarray(c).resize((W0, H0), Image.BILINEAR)) for c in small])
    T, step = 640, 448
    acc, wt = np.zeros((2, H0, W0), np.float32), np.zeros((H0, W0), np.float32)
    for y in sorted(set(list(range(0, max(1, H0 - T), step)) + [max(0, H0 - T)])):
        for x in sorted(set(list(range(0, max(1, W0 - T), step)) + [max(0, W0 - T)])):
            acc[:, y:y + T, x:x + T] += probs(im.crop((x, y, x + T, y + T)))
            wt[y:y + T, x:x + T] += 1
    return 0.35 * ctx + 0.65 * acc / np.maximum(wt, 1)[None]


def guided(I, p, r, eps):
    """colour-guided filter (He, Sun & Tang 2010): p smoothed, its edges moved to
    the guide image I's edges"""
    import cv2
    box = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
    mI = [box(I[..., c]) for c in range(3)]
    mp = box(p)
    cov = np.stack([box(I[..., c] * p) - mI[c] * mp for c in range(3)], -1)
    S = np.empty(p.shape + (3, 3), np.float32)
    for i in range(3):
        for j in range(3):
            S[..., i, j] = box(I[..., i] * I[..., j]) - mI[i] * mI[j] + (eps if i == j else 0)
    a = np.linalg.solve(S, cov[..., None])[..., 0]
    b = mp - sum(a[..., c] * mI[c] for c in range(3))
    return sum(box(a[..., c]) * I[..., c] for c in range(3)) + box(b)


def mask_for(path, sid):
    """returns the mask (LA image, sky in alpha), the share that is sky, and the
    photo with its edge pixels decontaminated"""
    full = original(sid)
    im = full.resize((MASK, round(full.height * MASK / full.width)), Image.LANCZOS)
    W0, H0 = im.size
    p, plants = sky_probability(im)
    p[round(H0 * FLOOR.get(sid, 1)):] = 0
    hard = p > 0.5
    lab, _ = ndimage.label(hard)
    hard = np.isin(lab, list(set(np.unique(lab[0])) - {0}))
    # specks of land floating in the sky (a bird, noise) are sky; anything touching
    # the sides or the bottom, or bigger than a few hundred pixels, is land
    land, n = ndimage.label(~hard)
    sizes = ndimage.sum(np.ones_like(land), land, range(1, n + 1))
    edge = set(np.unique(np.concatenate([land[-1], land[:, 0], land[:, -1]])))
    hard |= np.isin(land, [i + 1 for i, sz in enumerate(sizes) if sz < 300 and i + 1 not in edge])
    # the model hedges in deep notches between peaks; grow its sky into
    # neighbouring pixels that are the colour of the sky right beside them
    # (and blue, not white: snow and cloud are both white), a few pixels at a
    # time, until nothing more joins — the notch fills, the snow does not
    import cv2
    rgb = np.asarray(im).astype(np.float32)
    for _ in range(60):
        k = cv2.GaussianBlur(hard.astype(np.float32), (0, 0), 6)
        local = np.stack([cv2.GaussianBlur(rgb[..., c] * hard, (0, 0), 6) for c in range(3)], -1) / np.maximum(k, 1e-4)[..., None]
        ring = ndimage.binary_dilation(hard, iterations=2) & ~hard
        r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        close = (np.sqrt(((rgb - local) ** 2).sum(-1)) < 16) & (rgb.mean(-1) > local.mean(-1) - 12)
        bluish = (b_ > r_ + 18) & (b_ >= g_)
        grow = ring & close & bluish & (k > 0.05)
        grow[round(H0 * FLOOR.get(sid, 1)):] = False
        if grow.sum() < 4:
            break
        hard |= grow
    if sid in HOLES:
        sky_rgb = rgb[hard].reshape(-1, 3)
        sky_rgb = sky_rgb[np.random.default_rng(1).choice(len(sky_rgb), min(20000, len(sky_rgb)), replace=False)]
        near = (ndimage.distance_transform_edt(~hard) <= HOLES[sid]) & ~hard
        r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        # as blue as the sky is, and as bright: leaves are green, bark grey
        hole = near & (b_ > r_ + 30) & (b_ > g_ + 6) & (b_ > np.percentile(sky_rgb[:, 2], 5) - 10)
        hole[round(H0 * FLOOR.get(sid, 1)):] = False
        hard |= hole
    # snap to the photo's own edges, but only near the model's edge: the guided
    # filter may move a boundary, never invent one far off (snow beside cloud)
    I = np.asarray(im).astype(np.float32) / 255
    q = np.clip(guided(I, hard.astype(np.float32), 6, 2e-4), 0, 1)
    near = ndimage.distance_transform_edt(hard) <= 10
    near &= ndimage.distance_transform_edt(~hard) <= 10
    alpha = np.where(near, q, hard.astype(np.float32))
    alpha = np.clip((alpha - 0.12) / 0.76, 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)
    alpha[round(H0 * FLOOR.get(sid, 1)):] = 0
    # a luminance key near the edge: anything clearly darker than the sky right
    # beside it is land — twigs, wires, antennas a pixel or two wide, which the
    # model is too coarse to see (the mangrove lost its twigs to the sky)
    import cv2
    sure_sky = (alpha > 0.95).astype(np.float32)
    lum = I @ np.array([0.299, 0.587, 0.114], np.float32)
    ksky = cv2.GaussianBlur(sure_sky, (0, 0), 7)
    sky_lum = cv2.GaussianBlur(lum * sure_sky, (0, 0), 7) / np.maximum(ksky, 1e-4)
    edge_zone = (ndimage.distance_transform_edt(alpha < 0.5) <= 40) & (ksky > 0.05)
    darker = np.clip((sky_lum - lum - 0.10) / 0.12, 0, 1)
    alpha = np.where(edge_zone, alpha * (1 - darker), alpha)
    # decontaminate, on the full-size photo: in edge pixels take out the old
    # sky's colour B, F = (I − αB) / (1 − α), where B is the sky's colour nearby
    import cv2
    m = Image.fromarray((alpha * 255 + 0.5).astype(np.uint8))
    alpha = np.asarray(m.resize(full.size, Image.BILINEAR)).astype(np.float32) / 255
    I = np.asarray(full).astype(np.float32) / 255
    sure = (alpha > 0.98).astype(np.float32)
    blur = lambda x: cv2.GaussianBlur(x, (0, 0), 9 * full.width / MASK)
    B = np.stack([blur(I[..., c] * sure) for c in range(3)], -1) / np.maximum(blur(sure), 1e-4)[..., None]
    # only where the pixel is mostly land: dividing by a small 1 − α turned noise
    # into a jagged white line along Montreal's skyline (seen 2026-10-25), and a
    # mostly-sky pixel is covered by the new sky anyway
    band = (alpha > 0.01) & (alpha < 0.6)
    keep = 1 - alpha
    F = (I - alpha[..., None] * B) / np.maximum(keep, 0.4)[..., None]
    out = I.copy()
    out[band] = np.clip(F[band], 0, 1)
    photo = Image.fromarray((out * 255 + 0.5).astype(np.uint8))
    mask = Image.new("LA", m.size, 255)
    mask.putalpha(m)
    # what the wind moves, at the maps' width, never in the sky
    pl = np.clip((plants - 0.35) / 0.4, 0, 1) * (1 - np.asarray(m).astype(np.float32) / 255)
    plant_png = plant_map(pl, W0, H0)
    return mask, float((alpha > 0.5).mean()), photo, plant_png, alpha


# where the water is: the rows it lies between (shares of the height), and
# either a point in it to grow from through water-coloured pixels, or "all"
# when everything in those rows is water (a lake's reflection is the colour of
# the mountains it reflects — only its place says it is water)
WATER = {
    "beach": {"rows": (0.6, 1.0), "seed": (0.85, 0.72), "kind": "turquoise"},
    "mountains": {"rows": (0.62, 0.95), "seed": (0.3, 0.8), "kind": "deep"},
    "water": {"rows": (0.657, 1.0), "all": True},
}


# where the water is: the rows it lies between (shares of the height), and
# either a point in it to grow from through water-coloured pixels, or "all"
# when everything in those rows is water (a lake's reflection is the colour of
# the mountains it reflects — only its place says it is water)
WATER = {
    "beach": {"rows": (0.6, 1.0), "seed": (0.85, 0.72), "kind": "turquoise"},
    "mountains": {"rows": (0.62, 0.95), "seed": (0.3, 0.8), "kind": "deep"},
    "water": {"rows": (0.657, 1.0), "all": True},
}


DEPTH_MODEL = "depth-anything/Depth-Anything-V2-Base-hf"
_depth = None


def depth_for(photo, sky_alpha):
    """Depth Anything V2 (run once, offline): relative inverse depth, 1 near …
    0 far, at 800 px. The sky is set to 0 (as far as there is)."""
    global _depth
    import torch
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    if _depth is None:
        _depth = (AutoImageProcessor.from_pretrained(DEPTH_MODEL), AutoModelForDepthEstimation.from_pretrained(DEPTH_MODEL).to(dev).eval())
    proc, model = _depth
    with torch.no_grad():
        d = model(**proc(images=photo, return_tensors="pt").to(dev)).predicted_depth
    d = torch.nn.functional.interpolate(d[None], size=photo.size[::-1], mode="bicubic", align_corners=False)[0, 0].cpu().numpy()
    land = 1 - sky_alpha
    lo, hi = np.percentile(d[land > 0.5], 1), np.percentile(d[land > 0.5], 99.5)
    d = np.clip((d - lo) / (hi - lo), 0, 1) * land
    h = round(photo.height * WIDTH / photo.width)
    return Image.fromarray((d * 255 + 0.5).astype(np.uint8)).resize((WIDTH, h), Image.LANCZOS)


def flat_for(photo, sky_alpha):
    """the photo under overcast light: the large-scale light (a heavily
    smoothed copy of the brightness, edges kept by a guided filter) squeezed
    towards its mean, the fine detail kept, a little cooler and less saturated"""
    import cv2
    I = np.asarray(photo).astype(np.float32) / 255
    lum = np.maximum(I @ np.array([0.299, 0.587, 0.114], np.float32), 1e-3)
    L = np.log(lum)
    base = cv2.ximgproc.guidedFilter(L, L, 24, 0.02) if hasattr(cv2, "ximgproc") else _gray_guided(L, 24, 0.02)
    land = (1 - sky_alpha) > 0.5
    m = float(np.mean(base[land]))
    base2 = m + (base - m) * 0.42 - 0.08                    # flatter, a touch darker overall
    L2 = base2 + (L - base)
    k = np.exp(L2) / lum
    out = I * k[..., None]
    g = out @ np.array([0.299, 0.587, 0.114], np.float32)
    out = g[..., None] + (out - g[..., None]) * 0.82        # less saturated
    out *= np.array([0.97, 0.99, 1.04], np.float32)          # cooler
    out = np.where(land[..., None], out, I)                  # the sky is replaced anyway
    return Image.fromarray(np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8))


def _gray_guided(I, r, eps):
    import cv2
    box = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
    mI = box(I); var = box(I * I) - mI * mI
    a = var / (var + eps); b = mI - a * mI
    return box(a) * I + box(b)


def plant_map(pl, W0, H0):
    """two things in one image: red is plant at all (the seasons colour all of
    it), green how much it sways (anchored at its foot) — kept apart because
    trees rising from the photo's bottom edge got no autumn when one weight did
    both. RGB, not alpha: a browser loses colour where alpha is 0"""
    pm = Image.fromarray((pl * 255 + 0.5).astype(np.uint8)).resize((WIDTH, round(H0 * WIDTH / W0)), Image.LANCZOS)
    sway = anchored(pm)
    return Image.merge("RGB", (pm, sway, Image.new("L", pm.size, 0)))


def anchored(pm):
    """a plant moves more the higher up it is: its roots and the foot of its
    trunk are anchored, its crown sways. Each plant pixel is weighted by how
    many plant pixels stand under it in its column (0 at the base, full by 70
    px up at the maps' width)"""
    a = np.asarray(pm).astype(np.float32) / 255
    on = a > 0.15
    run = np.zeros_like(a)
    for y in range(a.shape[0] - 2, -1, -1):
        run[y] = np.where(on[y], run[y + 1] + 1, 0)
    w = np.clip(run / 70, 0, 1)
    return Image.fromarray((a * (w * w * (3 - 2 * w)) * 255 + 0.5).astype(np.uint8))


# beaches whose swash moves: the waterline where wet sand meets the last thin
# foam, traced by eye (shares of width and height) — the water map stops at the
# deep turquoise, out past the shallows, so it cannot say where the waves run —
# and how far up and down the sand a wave runs, px at the maps' width
SHORE = {"beach": ([(0.2, 0.68), (0.235, 0.74), (0.29, 0.8), (0.37, 0.85), (0.47, 0.885),
                    (0.58, 0.915), (0.7, 0.955), (0.82, 0.99), (0.9, 1.01)], 18)}


def shore_for(sid):
    if sid not in SHORE:
        return None
    line, reach = SHORE[sid]
    w = Image.open(HERE / f"{sid}-water.png")
    W0, H0 = w.size
    pts = np.array([(x * W0, y * H0) for x, y in line], np.float32)
    yy, xx = np.mgrid[0:H0, 0:W0].astype(np.float32)
    best = np.full((H0, W0), 1e9, np.float32)
    nx, ny = np.zeros_like(best), np.zeros_like(best)
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / (dx * dx + dy * dy), 0, 1)
        d = np.hypot(xx - (x0 + t * dx), yy - (y0 + t * dy))
        L = np.hypot(dx, dy)
        closer = d < best
        best = np.where(closer, d, best)
        nx = np.where(closer, dy / L, nx)                          # the normal on the sea's side (up and right)
        ny = np.where(closer, -dx / L, ny)
    band = ndimage.gaussian_filter(np.clip(1 - best / reach, 0, 1), 1.5)
    rgb = np.dstack([(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, band * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgb)


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
    im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)   # the window grid was tuned at 1600
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
    # a tower stands well above the skyline's general line — the distant hills,
    # which are land too, are not towers and carry no lights
    base = np.median(top)
    tops = []
    for x in range(8, W0 - 8):          # every column: an antenna is a pixel wide, and it is where the light goes
        t = top[x]
        if t < H0 * 0.33 and t < base - H0 * 0.03 and t <= top[max(0, x - 40):x + 40].min() + 1:
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
    ids = args or sorted(SOURCES)
    tiles = []
    for sid in ids:
        out, share, photo, plants, sky_a = mask_for(HERE / f"{sid}.jpg", sid)
        out.save(HERE / f"{sid}-sky.png", optimize=True)
        plants.save(HERE / f"{sid}-plants.png", optimize=True)
        q = SOURCES[sid][1]
        save = lambda im, name: im.save(HERE / name, "JPEG", quality=q, optimize=True, progressive=True)
        small = lambda im: im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        flat = flat_for(photo, sky_a)
        save(photo, f"{sid}.jpg"); save(small(photo), f"{sid}-1600.jpg")
        save(flat, f"{sid}-flat.jpg"); save(small(flat), f"{sid}-flat-1600.jpg")
        depth_for(small(photo), np.asarray(Image.fromarray((sky_a * 255).astype(np.uint8)).resize((1600, round(photo.height * 1600 / photo.width)))).astype(np.float32) / 255).save(HERE / f"{sid}-depth.png", optimize=True)
        print(f"{sid:10} sky {share:5.1%}  {(HERE / f'{sid}-sky.png').stat().st_size // 1024} KB")
        wet, wshare = water_for(HERE / f"{sid}.jpg", sid)
        if wet:
            wet.save(HERE / f"{sid}-water.png", optimize=True)
            print(f"{'':10} water {wshare:5.1%}")
            sh = shore_for(sid)
            if sh:
                sh.save(HERE / f"{sid}-shore.png", optimize=True)
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
