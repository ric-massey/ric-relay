"""Turning the guessed boxes in regions.json into measured ones.

The watcher is finished code around four numbers per field that nobody has
checked. Those numbers say where on the screen Apex draws a damage total, and
they were written from the standard 1080p layout without a real frame to look
at. They will be close and they will not be right, and a box that is close is a
box that reads the digit next to the one it was aiming at.

This script is how that gets fixed, once, in about ten minutes:

    python calibrate.py --shot                       # grab a frame, any time
    python calibrate.py --draw shots/<file>.png      # see where the boxes land
    python calibrate.py --pick shots/<file>.png --screen match_summary
    python calibrate.py --test shots/<file>.png --screen match_summary

`--pick` walks the fields of a screen one at a time. Drag a box around the
number, press ENTER, and it writes the box into regions.json as a fraction of
the 16:9 safe area — so the same measurement holds at 1080p, 1440p and on an
ultrawide, and never has to be taken again.

`--test` then runs the real reader over the real still and prints what came
back, which is the only honest way to know it works. If `damage` reads 1284 on
a screenshot where the game said 1284, the pipeline is done.

── this opens windows ──
`--draw`, `--pick` and `--test` put an OpenCV window on screen and wait for a
keypress. Do not run them while a match is live: at best the window steals
focus mid-fight, at worst alt-tabbing out of a fullscreen game to answer it
costs a death. `--shot` is the only one that is safe mid-session — it grabs a
frame and exits without drawing anything.

The useful frames to catch are: the match summary after a squad wipe, the
career panel, and a legend's banner in the lobby.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

import ocr
import screens

HERE = Path(__file__).resolve().parent
SHOTS = HERE / "shots"
REGIONS = HERE / "regions.json"


def load() -> dict:
    return json.loads(REGIONS.read_text(encoding="utf-8-sig"))


def save(spec: dict) -> None:
    REGIONS.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")


def grab_one() -> Path:
    """One frame off the desktop, saved. Draws nothing, steals no focus."""
    try:
        import dxcam
        cam = dxcam.create(output_color="BGR")
        frame = None
        for _ in range(20):                    # grab() returns None on no change
            frame = cam.grab()
            if frame is not None:
                break
        if frame is None:
            raise RuntimeError("duplication returned nothing — is Apex in exclusive fullscreen?")
    except Exception:                          # noqa: BLE001
        import mss
        with mss.mss() as sct:
            frame = np.array(sct.grab(sct.monitors[1]))[:, :, :3]

    SHOTS.mkdir(exist_ok=True)
    n = len(list(SHOTS.glob("*.png"))) + 1
    path = SHOTS / f"shot-{n:03d}.png"
    cv2.imwrite(str(path), frame)
    print(f"saved {path}  ({frame.shape[1]}x{frame.shape[0]})")
    return path


def fit(image: np.ndarray, limit: int = 1400) -> tuple[np.ndarray, float]:
    """Shrink a 4K screenshot to something that fits on the monitor showing it."""
    h, w = image.shape[:2]
    if w <= limit:
        return image, 1.0
    scale = limit / w
    return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA), scale


def draw(path: Path, which: str | None) -> None:
    """Every box, on the screenshot, labelled. The fastest way to see what is wrong."""
    spec = load()
    image = cv2.imread(str(path))
    if image is None:
        sys.exit(f"cannot read {path}")
    h, w = image.shape[:2]
    safe = ocr.safe_area(w, h)
    sx, sy, sw, sh = safe

    if safe != (0, 0, w, h):
        cv2.rectangle(image, (sx, sy), (sx + sw, sy + sh), (80, 80, 80), 2)

    for name, screen in spec["screens"].items():
        if which and name != which:
            continue
        for anchor in screen.get("anchors", []):
            b = anchor["box"]
            p0 = (int(sx + b[0] * sw), int(sy + b[1] * sh))
            p1 = (int(sx + b[2] * sw), int(sy + b[3] * sh))
            cv2.rectangle(image, p0, p1, (0, 200, 255), 2)
            cv2.putText(image, f"{name}:anchor", (p0[0], max(14, p0[1] - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 255), 1)
        for field, f in screen.get("fields", {}).items():
            b = f["box"]
            p0 = (int(sx + b[0] * sw), int(sy + b[1] * sh))
            p1 = (int(sx + b[2] * sw), int(sy + b[3] * sh))
            cv2.rectangle(image, p0, p1, (0, 255, 120), 2)
            cv2.putText(image, field, (p0[0], max(14, p0[1] - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 120), 1)

    shown, _ = fit(image)
    cv2.imshow("boxes - any key to close", shown)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


def pick(path: Path, which: str, only: str | None) -> None:
    """Drag a box around each field. Writes fractions of the safe area."""
    spec = load()
    if which not in spec["screens"]:
        sys.exit(f"no screen called {which} — try: {', '.join(spec['screens'])}")
    image = cv2.imread(str(path))
    if image is None:
        sys.exit(f"cannot read {path}")

    shown, scale = fit(image)
    h, w = image.shape[:2]
    sx, sy, sw, sh = ocr.safe_area(w, h)

    screen = spec["screens"][which]
    jobs: list[tuple[str, dict, int]] = []
    for i, anchor in enumerate(screen.get("anchors", [])):
        jobs.append((f"anchor[{i}]", anchor, i))
    for name, f in screen.get("fields", {}).items():
        jobs.append((name, f, -1))

    print("\ndrag a box, ENTER to accept, C to skip a field, ESC to stop\n")
    for name, holder, _ in jobs:
        if only and name != only:
            continue
        box = cv2.selectROI(f"{which}: {name}", shown, showCrosshair=False, fromCenter=False)
        cv2.destroyAllWindows()
        x, y, bw, bh = box
        if bw == 0 or bh == 0:
            print(f"  {name}: skipped")
            continue
        # Screen pixels -> full-resolution pixels -> fractions of the safe area.
        x0, y0 = x / scale, y / scale
        x1, y1 = (x + bw) / scale, (y + bh) / scale
        holder["box"] = [
            round((x0 - sx) / sw, 4), round((y0 - sy) / sh, 4),
            round((x1 - sx) / sw, 4), round((y1 - sy) / sh, 4),
        ]
        print(f"  {name}: {holder['box']}")

    spec["calibrated"] = True
    save(spec)
    print(f"\nwritten to {REGIONS.name}. Now check it actually reads:")
    print(f"    python calibrate.py --test {path} --screen {which}")


def test(path: Path, which: str | None) -> None:
    """Run the real reader over a still and print what it got.

    This is the acceptance test for the whole watcher. If the numbers printed
    here match the numbers in the screenshot, everything downstream — the vote,
    the queue, the Worker, the page — is plumbing that already works.
    """
    image = cv2.imread(str(path))
    if image is None:
        sys.exit(f"cannot read {path}")

    eye = screens.Recogniser()
    frame = screens.Frame.of(image)

    print(f"\n{path.name}  {image.shape[1]}x{image.shape[0]}  safe={frame.safe}")
    print(f"gate: {'menu-ish' if eye.interesting(frame) else 'looks like live gameplay'}")

    seen = eye.identify(frame)
    print(f"identified: {seen.screen or 'nothing'}  score={seen.score}  saw={seen.saw!r}")

    target = which or seen.screen
    if not target:
        print("\nNo screen matched. Either the anchor box is in the wrong place")
        print("(--draw to see) or the phrases in regions.json are not what this")
        print("build of Apex prints. --screen forces a read anyway.")
        return

    print(f"\nreading as {target}:")
    for name, read in eye.read_fields(frame, target).items():
        value = read.value if read.value is not None else "—"
        print(f"  {name:<10} {str(value):>8}   conf {read.conf:.2f}   raw {read.text!r}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Measure where Apex puts its numbers.")
    ap.add_argument("--shot", action="store_true", help="grab a frame and save it (safe mid-match)")
    ap.add_argument("--draw", metavar="IMAGE", help="draw the current boxes on a screenshot")
    ap.add_argument("--pick", metavar="IMAGE", help="drag new boxes on a screenshot")
    ap.add_argument("--test", metavar="IMAGE", help="read a screenshot the way the watcher would")
    ap.add_argument("--screen", help="which screen: match_summary, career, legend_banner, champion")
    ap.add_argument("--field", help="with --pick, redo just one field")
    args = ap.parse_args()

    if args.shot:
        grab_one()
    elif args.draw:
        draw(Path(args.draw), args.screen)
    elif args.pick:
        if not args.screen:
            sys.exit("--pick needs --screen")
        pick(Path(args.pick), args.screen, args.field)
    elif args.test:
        test(Path(args.test), args.screen)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
