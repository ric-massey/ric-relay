"""Deciding what Apex screen is on the monitor, and reading it.

Two stages, cheap before expensive, because this runs on the machine that is
also running the game and every millisecond spent here is a millisecond the
game did not get.

  1. The gate. Shrink the frame to a 64px thumbnail and look at its brightness
     and variance. Menus and summaries are dark and flat; gameplay is not.
     A frame that fails costs about a millisecond and never touches Tesseract.
     While he is actually playing, which is nearly all of the time, this is the
     only stage that runs.

  2. The anchor. OCR one small strip where the screen's title lives and compare
     it to the phrases that screen is known by. Fuzzy, because "SQUAD
     ELIMINATED" comes back as "SOUAD ELIMINATEO" often enough that demanding
     an exact match would mean missing deaths.

Only once a screen is identified does anything read the numbers.

No model, no network, no game process. This module never sees Apex's memory,
never injects anything, and never sends it an input — it looks at the same
pixels a streamer's capture card sees, which is the same thing OBS has been
doing for a decade.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

import ocr

HERE = Path(__file__).resolve().parent

CONFIGS = {
    "digits": ocr.DIGITS,
    "digits_comma": ocr.DIGITS_COMMA,
    "place": ocr.PLACE,
    "words": ocr.WORDS,
    "clock": ocr.CLOCK,
}


@dataclass
class Frame:
    """One grab, with the geometry worked out once instead of per field."""
    image: np.ndarray
    safe: tuple[int, int, int, int]

    @classmethod
    def of(cls, image: np.ndarray) -> "Frame":
        h, w = image.shape[:2]
        return cls(image=image, safe=ocr.safe_area(w, h))

    def crop(self, box) -> np.ndarray:
        return ocr.crop(self.image, box, self.safe)


@dataclass
class Sighting:
    """What one frame turned out to be."""
    screen: str | None
    score: float = 0.0
    saw: str = ""
    fields: dict[str, ocr.Read] = field(default_factory=dict)


class Recogniser:
    def __init__(self, regions_path: Path | None = None):
        self.path = regions_path or (HERE / "regions.json")
        self.spec = json.loads(self.path.read_text(encoding="utf-8-sig"))
        self.gate_spec = self.spec.get("gate", {})
        self.screens = self.spec.get("screens", {})

    @property
    def calibrated(self) -> bool:
        return bool(self.spec.get("calibrated"))

    # ── stage one ────────────────────────────────────────────────────────────

    def interesting(self, frame: Frame) -> bool:
        """Could this frame be a menu at all?

        Deliberately generous. A false yes costs one OCR of a small strip; a
        false no costs a match that Apex will never mention again. When the
        thresholds are wrong, they should be wrong in this direction.
        """
        size = int(self.gate_spec.get("thumb", 64))
        thumb = cv2.resize(frame.image, (size, int(size * 9 / 16)), interpolation=cv2.INTER_AREA)
        if thumb.ndim == 3:
            thumb = cv2.cvtColor(thumb, cv2.COLOR_BGR2GRAY)
        mean, std = float(thumb.mean()), float(thumb.std())
        return (mean <= float(self.gate_spec.get("max_mean_brightness", 110))
                and std <= float(self.gate_spec.get("max_std_brightness", 70)))

    # ── stage two ────────────────────────────────────────────────────────────

    def identify(self, frame: Frame) -> Sighting:
        """Which known screen this is, if any.

        Every candidate is scored and the best one wins, rather than the first
        one over the line. `champion` and `match_summary` overlap in time and
        the difference between them is a win and a loss.
        """
        best = Sighting(screen=None)
        for name, spec in self.screens.items():
            for anchor in spec.get("anchors", []):
                read = ocr.read_text(frame.crop(anchor["box"]), config=ocr.WORDS)
                if not read.text:
                    continue
                for phrase in anchor.get("expect", []):
                    score = ocr.similarity(read.text, phrase)
                    if score >= float(anchor.get("min", 0.7)) and score > best.score:
                        best = Sighting(screen=name, score=round(score, 3), saw=read.text)
        return best

    # ── the numbers ──────────────────────────────────────────────────────────

    def read_fields(self, frame: Frame, screen: str) -> dict[str, ocr.Read]:
        """Read every field of a recognised screen, once.

        Once — not until it agrees with itself. Agreement is the caller's job,
        because the frames it needs to agree across have not happened yet: they
        arrive over the seconds the screen stays up. See `Watcher.collect`.
        """
        spec = self.screens.get(screen, {})
        out: dict[str, ocr.Read] = {}

        for name, f in spec.get("fields", {}).items():
            box = f["box"]
            kind = f.get("kind", "int")
            config = CONFIGS.get(f.get("config", "digits"), ocr.DIGITS)
            patch = frame.crop(box)

            if kind == "int":
                out[name] = ocr.read_int(patch, config=config)
            elif kind == "clock":
                out[name] = ocr.read_clock(patch)
            else:
                out[name] = ocr.read_text(patch, config=config)

        return out


def legend_name(raw: str) -> str | None:
    """Snap an OCR'd legend name to a real one.

    A name is a closed set of about thirty strings, so unlike a damage total it
    CAN be corrected after the fact — "CAUSTLC" is unambiguously Caustic. This
    is the one place fuzzy matching is applied to a value rather than a title,
    and it is safe precisely because the set is closed and short.

    An unknown name comes back None rather than as itself: a new legend on
    release day should show up as "the watcher does not know" rather than as a
    misspelling that then becomes a permanent row in the data.
    """
    if not raw:
        return None
    candidates = [
        "Alter", "Ash", "Ballistic", "Bangalore", "Bloodhound", "Catalyst",
        "Caustic", "Conduit", "Crypto", "Fuse", "Gibraltar", "Horizon",
        "Lifeline", "Loba", "Mad Maggie", "Mirage", "Newcastle", "Octane",
        "Pathfinder", "Rampart", "Revenant", "Seer", "Sparrow", "Valkyrie",
        "Vantage", "Wattson", "Wraith",
    ]
    best, score = None, 0.0
    for name in candidates:
        s = ocr.similarity(raw, name)
        if s > score:
            best, score = name, s
    return best if score >= 0.7 else None
