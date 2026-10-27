#!/usr/bin/env python3
"""Cerro Torre's own clouds: lifted out of the photo, and kept to move.

Ric, 2026-10-27: "There are some clouds on the cerro Torre that never move?
It's from the picture but the original picture should show you what the clouds
really look like. For now focus on cerro Torre and making it as realistic as
possible."

The photo (Alex Proimos, CC BY 2.0) has two clouds in it: one pouring over the
col left of the Torre, and a bank rising behind the near ridge on the right. The
left one sat partly below the sky mask, over rock, so it stayed in the picture
while the real sky moved behind it — a cloud frozen to the mountain. This:

  1. takes both clouds out of the photo. Above the ridge the sky behind them is
     a smooth fit to the clear blue around them, with the photo's own grain;
     below it, the rock is rebuilt from the rock beside it (OpenCV's shift-map
     inpainting, which copies real texture rather than smearing), with the real
     edges that showed faintly through the mist laid back over it. Where the
     ridge runs under the cloud was read off a contrast-boosted copy and drawn
     by hand (RIDGE) — the segmentation model had followed the cloud's edge,
     not the rock's.
  2. moves the sky mask down to that ridge, and remakes the overcast copy
     (scene-maps.py's flat_for, from the clean photo) and the depth map's sky.
  3. keeps the clouds themselves: each pixel unmixed into how much is cloud
     and what colour the cloud is (against the sky behind it, where that is
     known exactly; the cloud's shading carried on smoothly where rock was
     behind), saved as torre-cloud-a.png and torre-cloud-b.png. scene.js sends
     them over the cols and off the summits with the wind — the photo's real
     clouds, moving.

Run it after scene-maps.py has made the photo:

    python3 assets/weather/scenes/scene-maps.py torre
    python3 assets/weather/scenes/torre-clouds.py

It records what it read and wrote in torre-clouds.json and will not run twice
on its own output (scene-maps.py makes the photo again from the original).
Needs numpy, scipy, Pillow and OpenCV with the contrib modules
(opencv-contrib-python-headless: xphoto for the inpainting, ximgproc for the
overcast copy).
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = Path(__file__).resolve().parent
QUALITY = 88                                   # as scene-maps.py
SID = "torre"

# the left cloud's box in the full photo (4000 × 2667), and the ridge under it
# in that box's pixels, read off the photo with its local contrast boosted
LEFT = (300, 700, 1250, 1550)
RIDGE = [(150, 250), (172, 300), (205, 370), (245, 420), (290, 478), (340, 500), (395, 540), (440, 585), (490, 612),
         (540, 592), (578, 500), (600, 470), (640, 390), (660, 355), (690, 400), (705, 440), (740, 470), (770, 440),
         (800, 370), (840, 290), (900, 200), (950, 140)]
# where the left cloud is, roughly: a soft envelope in that box (its centre and size)
ENVELOPE = (430, 420, 330, 340)
# the right cloud's box: all of it is in front of sky; the near ridge cuts its foot
RIGHT = (2600, 800, 3850, 1800)


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()[:16]


def scene_maps():
    sys.dont_write_bytecode = True                      # no __pycache__ beside the photos
    spec = importlib.util.spec_from_file_location("scene_maps", HERE / "scene-maps.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cloudiness(p, env=None):
    """grey (blue barely above red), light and smooth: cloud, not sky, snow or rock"""
    L = p.mean(2)
    blue = p[..., 2] - p[..., 0]
    box = lambda a: cv2.blur(a, (9, 9))
    std = np.sqrt(np.maximum(box(L * L) - box(L) ** 2, 0))
    c = np.clip((0.55 - blue) / 0.35, 0, 1) * np.clip((L - 0.38) / 0.25, 0, 1) * np.clip((0.06 - std) / 0.04, 0, 1)
    if env is not None:
        c = c * (env > 0.25)
    c = cv2.GaussianBlur(c, (0, 0), 3)
    # only the big shapes: snow patches that pass for cloud are small
    lab, n = ndimage.label(c > 0.12)
    sizes = ndimage.sum(np.ones_like(c), lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2500])
    return c, keep


def sky_fit(p, clear):
    """the sky behind, a smooth quadratic fit to the clear blue"""
    h, w, _ = p.shape
    yy, xx = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]
    A = np.stack([np.ones_like(xx), xx, yy, xx * xx, xx * yy, yy * yy], -1)
    S = np.zeros_like(p)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A[clear], p[..., c][clear], rcond=None)
        S[..., c] = A @ coef
    return S


def grain_like(p, clear, seed):
    """noise with the photo's own grain, so a filled sky is not glassy"""
    h, w, _ = p.shape
    hp = p - cv2.GaussianBlur(p, (0, 0), 2)
    sd = hp[clear].std(0)
    g = cv2.GaussianBlur(np.random.default_rng(seed).normal(0, 1, (h, w, 3)).astype(np.float32), (0, 0), 0.7)
    return g * (sd / g.std((0, 1)))


def unmix(p, bg, inside, sky_behind, tint):
    """how much of each pixel is cloud, and the cloud's colour. Where the sky is
    behind, both come out exactly (blue sky and grey cloud pull apart); where
    rock is, the cloud's brightness is carried on smoothly from around it."""
    d = p - bg
    t = tint / np.linalg.norm(tint)
    # p - bg = u·t − a·bg, solved for (u, a) per pixel; the cloud is then (u/a)·t
    A11 = (t * t).sum()
    A12 = -(bg * t).sum(2)
    A22 = (bg * bg).sum(2)
    b1 = (d * t).sum(2)
    b2 = -(d * bg).sum(2)
    det = A11 * A22 - A12 * A12
    good = sky_behind & (inside > 0.5) & (np.abs(det) > 1e-3)
    u = np.where(good, (A22 * b1 - A12 * b2) / np.where(good, det, 1), 0)
    a = np.where(good, (A11 * b2 - A12 * b1) / np.where(good, det, 1), 0)
    bright = np.where(good & (a > 0.15), u / np.maximum(a, 1e-3), 0)
    bright = np.clip(bright, 0.5 * np.linalg.norm(tint), 1.15 * np.linalg.norm(tint))
    wgt = (good & (a > 0.15)).astype(np.float32)
    # normalised convolution: the shading where it was measured, spread smoothly
    num = cv2.GaussianBlur(bright * wgt, (0, 0), 25)
    den = cv2.GaussianBlur(wgt, (0, 0), 25)
    smooth = np.where(den > 1e-4, num / np.maximum(den, 1e-4), np.linalg.norm(tint) * 0.92)
    bright = np.where(good & (a > 0.15), bright, smooth)
    col = np.clip(bright[..., None] * t, 0, 1)
    # the share of cloud with that colour, everywhere
    v = col - bg
    a2 = ((d * v).sum(2) / np.maximum((v * v).sum(2), 1e-4))
    alpha = np.clip(np.where(good, a, a2), 0, 1) * inside
    return col, alpha


def fbm(shape, seed, scales=(20, 40, 80, 160)):
    """fractal noise 0…1: random grids at several sizes, smoothly enlarged and summed"""
    rng = np.random.default_rng(seed)
    h, w = shape
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for sc in scales:
        g = rng.random((max(2, h // sc), max(2, w // sc))).astype(np.float32)
        out += amp * cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC)
        tot += amp
        amp *= 0.6
    out /= tot
    return np.clip((out - out.mean()) / (out.std() * 4) + 0.5, 0, 1)


def erode(e, n, ragged=0.55):
    """a cut edge made a cloud's edge: where the falloff `e` (1 inside, 0 at the
    cut) meets fractal noise, wisps and gaps rather than a smooth fade — a
    smooth fade reads as a cut-out"""
    a = np.clip((e - (1 - n) * ragged) / (1 - ragged), 0, 1)
    return cv2.GaussianBlur(a * a * (3 - 2 * a), (0, 0), 3)


def cloud_only(c, keep, land=None, feather=40, seed=1):
    """where the cut-out may be cloud: the smooth cloud itself, its biggest
    piece only (snow on a ridge passes for thin cloud at its edge), and soft
    where land cut it — it is drawn away from that land, and a ridge-shaped
    edge would go with it"""
    lab, n = ndimage.label(keep)
    if n:
        big = 1 + int(np.argmax(ndimage.sum(np.ones_like(c), lab, range(1, n + 1))))
        keep = lab == big
    near = cv2.dilate(keep.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))).astype(np.float32)
    w = np.clip(c * 1.6, 0, 1) * cv2.GaussianBlur(near, (0, 0), 4)
    if land is not None:
        dist = ndimage.distance_transform_edt(~land)
        w *= erode(np.clip(dist / feather, 0, 1), fbm(c.shape, seed))
    return w


def sprite(col, alpha, name, at, size, fade_bottom=0.0):
    ys, xs = np.where(alpha > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    c, a = col[y0:y1, x0:x1].copy(), alpha[y0:y1, x0:x1].copy()
    h, w = a.shape
    # ragged at every edge of the box, not faded: it is drawn away from where it was cut
    fx = np.minimum(np.arange(w) / (w * 0.08), (w - 1 - np.arange(w)) / (w * 0.08)).clip(0, 1)
    fy = np.minimum(np.arange(h) / (h * 0.08), (h - 1 - np.arange(h)) / (h * max(0.08, fade_bottom))).clip(0, 1)
    a *= erode(fy[:, None] * fx[None, :], fbm((h, w), len(name)))
    # the thin edges keep the cloud's colour: unmixing divides by a small share
    # there and its colour goes dark or odd, which drawn faint reads as a dirty rim
    wgt = np.clip((a - 0.05) / 0.3, 0, 1)
    num = cv2.GaussianBlur(c * wgt[..., None], (0, 0), 12)
    den = cv2.GaussianBlur(wgt, (0, 0), 12)[..., None]
    smooth = np.where(den > 1e-3, num / np.maximum(den, 1e-3), c)
    c = c * wgt[..., None] + smooth * (1 - wgt[..., None])
    rgba = np.dstack([c, a])
    im = Image.fromarray((rgba * 255 + 0.5).clip(0, 255).astype(np.uint8), "RGBA")
    im = im.resize((w // 2, h // 2), Image.LANCZOS)                      # half size: it is drawn soft and grown
    im.save(HERE / name, optimize=True)
    # where it was in the photo, as shares of the photo's width and height
    # (its left, top, width and height): the page starts it there
    W0, H0 = size
    return {"file": name, "w": im.width, "h": im.height,
            "box": [round((at[0] + x0) / W0, 4), round((at[1] + y0) / H0, 4), round(w / W0, 4), round(h / H0, 4)]}


def main(args):
    rec_p = HERE / f"{SID}-clouds.json"
    rec = json.loads(rec_p.read_text()) if rec_p.exists() else {}
    if rec.get("photo_out") == sha(HERE / f"{SID}.jpg") and "--force" not in args:
        print("torre.jpg is already this script's output — run scene-maps.py torre first, or pass --force")
        return
    photo_in = sha(HERE / f"{SID}.jpg")
    P = np.asarray(Image.open(HERE / f"{SID}.jpg").convert("RGB")).astype(np.float32) / 255
    H0, W0, _ = P.shape
    sky_img = Image.open(HERE / f"{SID}-sky.png")
    sky_a = np.asarray(sky_img.getchannel("A").resize((W0, H0), Image.LANCZOS)).astype(np.float32) / 255
    out = P.copy()
    sprites = []

    # ── the left cloud, over the col ──
    X0, Y0, X1, Y1 = LEFT
    p = P[Y0:Y1, X0:X1]
    h, w, _ = p.shape
    cx, cy, rx, ry = ENVELOPE
    yy, xx = np.mgrid[0:h, 0:w]
    env = np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) ** 1.6)
    cl, keep = cloudiness(p, env)
    cm = cv2.dilate(keep.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))).astype(np.float32)
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).polygon([(0, 0), (0, 190)] + RIDGE + [(w, 0)], fill=255)
    above = cv2.GaussianBlur(np.asarray(im).astype(np.float32) / 255, (0, 0), 1.2)
    clear = ((p[..., 2] - p[..., 0]) > 0.5) & (cm < 0.5) & (above > 0.99)
    S = sky_fit(p, clear)
    skyfill = S + grain_like(p, clear, 7)
    # the rock behind, from rock only: the sky above the ridge is no source
    unknown = ((cm > 0.5) | (above > 0.02)).astype(np.uint8)
    src = (np.where(above[..., None] > 0.5, skyfill, p) * 255).clip(0, 255).astype(np.uint8)
    filled = np.zeros_like(src)
    cv2.xphoto.inpaint(cv2.cvtColor(src, cv2.COLOR_RGB2BGR), (1 - unknown).astype(np.uint8), filled, cv2.xphoto.INPAINT_SHIFTMAP)
    rock = cv2.cvtColor(filled, cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    below = cv2.erode((above < 0.02).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
    below = cv2.GaussianBlur(below, (0, 0), 3)[..., None]
    detail = np.clip((p - cv2.GaussianBlur(p, (0, 0), 3)).mean(2, keepdims=True), -0.08, 0.08) * below
    rock = np.clip(rock + detail, 0, 1)
    bg = above[..., None] * skyfill + (1 - above[..., None]) * rock
    k = cv2.GaussianBlur(cm, (0, 0), 6)[..., None]
    out[Y0:Y1, X0:X1] = p * (1 - k) + bg * k
    # the sky now reaches the ridge
    sky_a[Y0:Y1, X0:X1] = np.where(k[..., 0] > 0.02, above * k[..., 0] + sky_a[Y0:Y1, X0:X1] * (1 - k[..., 0]), sky_a[Y0:Y1, X0:X1])
    tint = np.array([0.944, 0.936, 0.911], np.float32)                     # the cloud's lit side, measured
    col, alpha = unmix(p, np.clip(bg, 0, 1), cm, above > 0.5, tint)
    sprites.append(sprite(col, alpha * cloud_only(cl, keep, land=above < 0.5, feather=60, seed=3), f"{SID}-cloud-a.png", LEFT[:2], (W0, H0)))

    # ── the right cloud, rising behind the near ridge ──
    X0, Y0, X1, Y1 = RIGHT
    p = P[Y0:Y1, X0:X1]
    cl, keep = cloudiness(p)
    sa = sky_a[Y0:Y1, X0:X1]
    cm = cv2.dilate(keep.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))).astype(np.float32) * (sa > 0.5)
    clear = ((p[..., 2] - p[..., 0]) > 0.5) & (cm < 0.5) & (sa > 0.99)
    S = sky_fit(p, clear)
    skyfill = S + grain_like(p, clear, 11)
    k = cv2.GaussianBlur(cm, (0, 0), 6)[..., None] * sa[..., None]
    out[Y0:Y1, X0:X1] = p * (1 - k) + skyfill * k
    col, alpha = unmix(p, np.clip(S, 0, 1), cm, sa > 0.5, tint)
    sprites.append(sprite(col, alpha * cloud_only(cl, keep & (sa > 0.5), land=sa < 0.5, feather=80, seed=5), f"{SID}-cloud-b.png", RIGHT[:2], (W0, H0), fade_bottom=0.3))

    # ── write the photo, its overcast copy, the sky mask and the depth map ──
    sm = scene_maps()
    clean = Image.fromarray((out * 255 + 0.5).clip(0, 255).astype(np.uint8))
    save = lambda im, name: im.save(HERE / name, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    small = lambda im: im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
    save(clean, f"{SID}.jpg"); save(small(clean), f"{SID}-1600.jpg")
    flat = sm.flat_for(clean, sky_a)
    save(flat, f"{SID}-flat.jpg"); save(small(flat), f"{SID}-flat-1600.jpg")
    mw, mh = sky_img.size
    a_img = Image.fromarray((sky_a * 255 + 0.5).clip(0, 255).astype(np.uint8)).resize((mw, mh), Image.LANCZOS)
    Image.merge("LA", (Image.new("L", (mw, mh), 255), a_img)).save(HERE / f"{SID}-sky.png", optimize=True)
    dpath = HERE / f"{SID}-depth.png"
    dm = Image.open(dpath).convert("L")
    land = 1 - np.asarray(a_img.resize(dm.size, Image.LANCZOS)).astype(np.float32) / 255
    d = np.asarray(dm).astype(np.float32) * (land > 0.5)
    Image.fromarray(d.clip(0, 255).astype(np.uint8)).save(dpath, optimize=True)
    rec = {"photo_in": photo_in, "photo_out": sha(HERE / f"{SID}.jpg"), "sprites": sprites}
    rec_p.write_text(json.dumps(rec, indent=1) + "\n")
    for s in sprites:
        print(f"{s['file']:22} {s['w']}×{s['h']}  {(HERE / s['file']).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
