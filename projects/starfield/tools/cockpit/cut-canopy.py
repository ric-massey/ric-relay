"""Cut the glass out of a cockpit reference image.

The frame is given as strut centre-lines with a width — a band that only
has to *contain* the real strut, which is far more forgiving than tracing
edges. GrabCut then decides, inside that band, which pixels are metal and
which are painted space: it fits colour models to each and adds a
smoothness term, so the boundary comes out coherent instead of chasing
every wisp of nebula the way a pure gradient watershed does.

Two deliberate biases:

  · the cockpit is symmetric, so only the left half is traced and it is
    mirrored — nothing hand-placed can drift out of symmetry;
  · the cut runs slightly *into* the struts, and the edge is softly
    feathered. Over-cutting thins a strut imperceptibly; under-cutting
    leaves a sliver of painted nebula, which is a fake view of space. The
    feather is honest besides: a canopy strut this close to the eye is out
    of focus in any real cockpit.
"""
from PIL import Image
import numpy as np, cv2, os, sys, json

SRC = "/Users/ricmassey/RicsWebsite/projects/starfield/docs/UI:cockpit visuals "

def build(cfg, out):
    im = np.asarray(Image.open(os.path.join(SRC, cfg["file"])).convert("RGB"))
    H, W, _ = im.shape
    P = lambda pt: (int(W * pt[0] / 100), int(H * pt[1] / 100))

    # Paint out the HUD baked into the reference. Most of it sits on glass
    # and is cut away for free; whatever lands on a strut has to go, because
    # a painted "HULL: 96%" is a fabricated readout nothing here can back up.
    erase = np.zeros((H, W), np.uint8)
    for x0, y0, x1, y1 in cfg.get("erase", []):
        cv2.rectangle(erase, P((x0, y0)), P((x1, y1)), 255, -1)
    if erase.any():
        im = cv2.inpaint(im, erase, 6, cv2.INPAINT_TELEA)

    zone = np.zeros((H, W), np.uint8)
    def stroke(path, wpc):
        pts = [P(p) for p in path]
        for a, b in zip(pts, pts[1:]):
            cv2.line(zone, a, b, 255, max(2, int(W * wpc / 100)), cv2.LINE_AA)
    for s in cfg["struts"]:
        stroke(s["path"], s["w"])
        if s.get("mirror", True):
            stroke([[100 - x, y] for x, y in s["path"]], s["w"])
    def fill(poly):
        cv2.fillPoly(zone, [np.array([P(p) for p in poly], np.int32)], 255)
    for poly in cfg.get("solids", []):
        fill(poly)
    for poly in cfg.get("solids_m", []):      # mirrored like the struts
        fill(poly)
        fill([[100 - x, y] for x, y in poly])
    zone = (zone > 127).astype(np.uint8) * 255

    k = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n * 2 + 1,) * 2)
    inner = max(2, int(W * cfg.get("core", 0.5) / 100))
    outer = max(2, int(W * cfg.get("halo", 1.3) / 100))

    gc = np.full((H, W), cv2.GC_BGD, np.uint8)
    gc[cv2.dilate(zone, k(outer)) == 255] = cv2.GC_PR_BGD
    gc[zone == 255] = cv2.GC_PR_FGD
    gc[cv2.erode(zone, k(inner)) == 255] = cv2.GC_FGD

    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(im, gc, None, bgd, fgd, cfg.get("iters", 5), cv2.GC_INIT_WITH_MASK)
    structure = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # Drop specks: isolated blobs of "metal" out in the glass are nebula the
    # colour model liked, not structure.
    n, lab, stats, _ = cv2.connectedComponentsWithStats(structure, 8)
    keep = np.zeros_like(structure)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= (W * H) * 0.0008:
            keep[lab == i] = 255
    structure = keep

    shave = int(W * cfg.get("shave", 0.18) / 100)
    if shave:
        structure = cv2.erode(structure, k(shave))
    alpha = cv2.GaussianBlur(structure, (0, 0), cfg.get("feather", 2.4))

    Image.fromarray(np.dstack([im, alpha]).astype(np.uint8)).save(out)
    green = np.zeros_like(im); green[:, :, 1] = 255
    a = alpha[..., None] / 255.0
    Image.fromarray((im * a + green * (1 - a)).astype(np.uint8)).save(out.replace(".png", "_ongreen.png"))
    print(f"{out}: glass {100*(alpha<128).mean():.1f}%")

for tag, c in json.load(open(sys.argv[1])).items():
    build(c, f"{tag}.png")
