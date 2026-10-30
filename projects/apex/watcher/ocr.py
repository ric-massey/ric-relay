"""Reading numbers off Apex's own pixels.

There is no model in this file and there is not meant to be one. Everything
here is Tesseract and OpenCV doing arithmetic on a bitmap: the same frame in
gives the same answer out, forever, on a machine with no network. That is the
whole argument for doing it this way — a screen watcher that phoned a model on
every death would cost money per match, add a second of latency to the thing
whose entire point is being instant, and give a different answer on Tuesday.

What makes it accurate is not cleverness, it is repetition. A summary screen
sits on the monitor for several seconds, so the reader gets five or six looks
at the same unchanging number. OCR noise is uncorrelated between frames; the
truth is not. Take the value that shows up most often and the misreads fall
away on their own. `vote()` at the bottom is where that happens, and it is
worth more than any amount of preprocessing.

Tesseract lives outside Python. Install it once:

    winget install UB-Mannheim.TesseractOCR
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import pytesseract

# The winget package does not put tesseract.exe on PATH. Look where it actually
# lands before giving up, so a fresh machine works without anyone editing a
# config file to say something the installer already knew.
_DEFAULT_TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if not shutil.which("tesseract") and _DEFAULT_TESSERACT.exists():
    pytesseract.pytesseract.tesseract_cmd = str(_DEFAULT_TESSERACT)

# Apex draws its numbers in a condensed display face, light on a dark scrim.
# Tesseract was trained on documents: dark text, light paper, roughly 12pt at
# 300dpi. Every step in `prep()` below is about moving a game screenshot toward
# that, and none of them are decoration — dropping the upscale alone roughly
# doubles the error rate on three-digit damage.
UPSCALE = 4

DIGITS = "--psm 7 -c tessedit_char_whitelist=0123456789"
DIGITS_COMMA = "--psm 7 -c tessedit_char_whitelist=0123456789,"
# Placement reads as "#3" on the summary, and a lone digit is psm 10's job.
PLACE = "--psm 10 -c tessedit_char_whitelist=0123456789"
WORDS = "--psm 7"
# Survival time is mm:ss.
CLOCK = "--psm 7 -c tessedit_char_whitelist=0123456789:"


@dataclass
class Read:
    """One OCR result, and how much Tesseract believed it.

    `conf` is 0-1. It travels with the value all the way to the Worker and onto
    the page, because a number nobody can question is a number nobody can fix —
    and this reader will be wrong sometimes.
    """
    text: str
    conf: float
    value: int | None = None

    def __bool__(self) -> bool:
        return self.value is not None


def prep(bgr: np.ndarray, invert: bool = True) -> np.ndarray:
    """A crop of the game, turned into something Tesseract was trained on.

    `invert` is on by default because Apex UI text is light on dark and
    Tesseract wants the opposite. It is a parameter rather than a constant
    because a handful of Apex's panels flip that contrast, and finding out
    which is a job for the calibration script, not for a guess in here.
    """
    if bgr.ndim == 3:
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = bgr

    # Upscale before thresholding, not after: interpolating a binary image
    # invents staircase edges that Tesseract reads as punctuation.
    gray = cv2.resize(gray, None, fx=UPSCALE, fy=UPSCALE, interpolation=cv2.INTER_CUBIC)

    if invert:
        gray = cv2.bitwise_not(gray)

    # Otsu rather than a fixed cut. The scrim behind Apex's summary is
    # translucent, so the "background" grey is whatever the player happened to
    # die in front of — a fixed threshold works on Storm Point and fails in a
    # dark building.
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # A white margin. Tesseract's layout analysis genuinely does worse when
    # glyphs touch the edge of the image, and a crop box tight enough to
    # exclude a neighbouring number is tight enough to do that.
    return cv2.copyMakeBorder(binary, 16, 16, 16, 16, cv2.BORDER_CONSTANT, value=255)


def _confidence(data: dict) -> float:
    """Mean per-word confidence, ignoring the rows Tesseract fills with -1."""
    scores = [float(c) for c in data.get("conf", []) if str(c) not in ("-1", "")]
    if not scores:
        return 0.0
    return max(0.0, min(1.0, sum(scores) / len(scores) / 100.0))


def read_text(crop: np.ndarray, config: str = WORDS, invert: bool = True) -> Read:
    """Raw text out of one region."""
    img = prep(crop, invert=invert)
    data = pytesseract.image_to_data(img, config=config, output_type=pytesseract.Output.DICT)
    words = [w for w in data.get("text", []) if w and w.strip()]
    return Read(text=" ".join(words).strip(), conf=_confidence(data))


def read_int(crop: np.ndarray, config: str = DIGITS_COMMA, invert: bool = True) -> Read:
    """A whole number out of one region, or a Read whose value is None.

    None is a real answer and is never quietly turned into 0. A zero is a claim
    — "he did no damage" — and the page will happily average it. "I could not
    read this" is the truth when the tracker was not equipped, an overlay sat
    on the digits, or the frame was grabbed mid-fade.
    """
    r = read_text(crop, config=config, invert=invert)
    digits = re.sub(r"[^0-9]", "", r.text)
    if not digits:
        return Read(text=r.text, conf=r.conf, value=None)
    # A leading zero on a game stat is Tesseract inventing one from a glyph
    # edge; "07" is not a number Apex displays.
    return Read(text=r.text, conf=r.conf, value=int(digits))


def read_clock(crop: np.ndarray) -> Read:
    """Survival time, as seconds. Apex shows mm:ss."""
    r = read_text(crop, config=CLOCK)
    m = re.search(r"(\d{1,2})\s*:\s*(\d{2})", r.text)
    if not m:
        return Read(text=r.text, conf=r.conf, value=None)
    minutes, seconds = int(m.group(1)), int(m.group(2))
    if seconds > 59:
        return Read(text=r.text, conf=r.conf, value=None)
    return Read(text=r.text, conf=r.conf, value=minutes * 60 + seconds)


def similarity(a: str, b: str) -> float:
    """How alike two strings are, 0-1, by edit distance.

    Used for matching a screen title, never for matching a number. "SQUAD
    ELIMINATED" coming back as "SOUAD ELIMINATEO" is the normal case, not the
    broken one, and demanding an exact match there would mean the watcher
    missed the death. Numbers get no such forgiveness: there is no near-miss
    reading of a damage total, so they go through the vote instead.
    """
    a, b = a.upper().strip(), b.upper().strip()
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # Levenshtein, iterative, two rows. Small strings — this is not the
    # expensive part of any frame.
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return 1.0 - prev[-1] / max(len(a), len(b))


def vote(reads: list[Read], min_agree: int = 2) -> Read:
    """The value that showed up most often across several looks at one number.

    This is the accuracy of the whole watcher, and it is four lines long.

    A summary screen is static for seconds, so the reader gets many frames of
    the same number. A misread is a coin landing on its edge — it happens, and
    it happens differently each time. The true value is the only one that
    repeats. Requiring two agreeing reads turns "Tesseract said 1284" into
    "Tesseract said 1284 twice and 1204 once", which is a different and much
    better claim.

    Returns a Read whose conf is the share of looks that agreed, multiplied by
    what Tesseract thought of them — so a number read identically five times
    out of five arrives confident, and one that never repeated arrives as None
    rather than as a guess wearing a high score.
    """
    got = [r for r in reads if r.value is not None]
    if not got:
        return Read(text="", conf=0.0, value=None)

    counts = Counter(r.value for r in got)
    winner, hits = counts.most_common(1)[0]
    if hits < min_agree:
        return Read(text=str(winner), conf=0.0, value=None)

    agreeing = [r for r in got if r.value == winner]
    share = hits / len(got)
    tess = sum(r.conf for r in agreeing) / len(agreeing)
    return Read(text=str(winner), conf=round(share * tess, 3), value=winner)


def crop(frame: np.ndarray, box: tuple[float, float, float, float],
         safe: tuple[int, int, int, int] | None = None) -> np.ndarray:
    """Cut a normalised box out of a frame.

    Boxes are fractions of the 16:9 safe area rather than pixels, because the
    same box then works at 1080p, 1440p and on an ultrawide. Apex anchors its
    menus to a centred 16:9 region and fills the sides — so on a 21:9 monitor
    the summary screen is NOT at 40% of the screen width, it is at 40% of the
    16:9 rectangle sitting in the middle of it. `safe` is that rectangle.
    """
    h, w = frame.shape[:2]
    if safe is None:
        sx, sy, sw, sh = 0, 0, w, h
    else:
        sx, sy, sw, sh = safe

    x0 = int(sx + box[0] * sw)
    y0 = int(sy + box[1] * sh)
    x1 = int(sx + box[2] * sw)
    y1 = int(sy + box[3] * sh)

    x0, x1 = max(0, min(x0, w)), max(0, min(x1, w))
    y0, y1 = max(0, min(y0, h)), max(0, min(y1, h))
    if x1 <= x0 or y1 <= y0:
        return np.zeros((1, 1), dtype=np.uint8)
    return frame[y0:y1, x0:x1]


def safe_area(width: int, height: int) -> tuple[int, int, int, int]:
    """The centred 16:9 rectangle inside a capture of this size.

    On a 16:9 monitor this is the whole thing and costs nothing. On anything
    wider it is the difference between reading the numbers and reading the
    empty space next to them.
    """
    target = 16 / 9
    actual = width / height
    if abs(actual - target) < 0.01:
        return (0, 0, width, height)
    if actual > target:                      # wider than 16:9 — pillars either side
        sw = int(height * target)
        return ((width - sw) // 2, 0, sw, height)
    sh = int(width / target)                 # taller — bars top and bottom
    return (0, (height - sh) // 2, width, sh)


def tesseract_version() -> str:
    """Proof it is actually installed, for the startup banner and the README."""
    try:
        return str(pytesseract.get_tesseract_version())
    except Exception as exc:                 # noqa: BLE001 - reported, not handled
        return f"missing ({exc})"
