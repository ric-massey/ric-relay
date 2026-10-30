"""The watcher. Sits beside Apex, reads the screens that carry numbers, and
pushes each match to the site the moment it can see it.

    python watch-apex.py            # run it
    python watch-apex.py --dry      # read and print, send nothing
    python watch-apex.py --once     # one pass, for testing

── what it does to the game ──
Nothing. It reads the desktop through the Desktop Duplication API, which is the
same path OBS uses, and it does that at four frames a second on a thread pinned
below normal priority. It never opens the game's process, never reads its
memory, never sends it an input, and never loads anything into it. There is no
overlay. Anti-cheat has nothing to object to here, because from EAC's side this
program is indistinguishable from a screen recorder — which is all it is.

The one thing it asks of the game is BORDERLESS or WINDOWED FULLSCREEN. In
exclusive fullscreen Windows hands the display to the game outright and the
duplication API returns black frames — not a bug to fix, a thing the operating
system will not do.

── why it costs nearly nothing ──
Almost every frame is thrown away by a brightness check on a 64px thumbnail
before anything expensive happens. Tesseract only runs on frames dark and flat
enough to be a menu, which is a few seconds after each match rather than the
whole session.

── why it is right more often than a single read would be ──
A summary screen stays up for seconds, so the same unchanging number gets read
many times. Misreads scatter, the truth repeats, and the value that repeats is
the one that gets sent. See `ocr.vote`.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import ocr
import screens
from spool import Spool

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "config.json"
FRAMES = HERE / "frames"          # kept crops, so a wrong number can be traced

# Four a second. The screens this reads sit still for several seconds, so this
# is already many looks at each of them, and going faster would buy nothing but
# heat on a machine that is running a game.
FPS = 4

# How long to keep looking at one summary before deciding what it said. Long
# enough for the vote to mean something, short enough that "instant" is honest.
COLLECT_SECONDS = 2.5
MIN_LOOKS = 3

# After sending a match, ignore that screen until something else has been on
# the monitor for a while. Without this the same summary is sent every frame it
# remains visible.
COOLDOWN_SECONDS = 30


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_config() -> dict:
    if not CONFIG.exists():
        sys.exit(
            f"No config at {CONFIG}\n"
            "Copy config.example.json to config.json and put your Worker URL and\n"
            "token in it. The token is the one set with `wrangler secret put APEX_TOKEN`."
        )
    return json.loads(CONFIG.read_text(encoding="utf-8-sig"))


class Grabber:
    """Frames off the desktop, by whatever route this machine supports.

    dxcam first because it is the fast one — it takes the frame the compositor
    already has instead of asking Windows to redraw the screen into a bitmap.
    mss is the fallback: slower, but it works everywhere, including over a
    remote session where duplication is not available.
    """

    def __init__(self, monitor: int = 0):
        self.mode = None
        self.cam = None
        self.sct = None
        self.mon = None
        try:
            import dxcam
            self.cam = dxcam.create(output_idx=monitor, output_color="BGR")
            if self.cam is not None:
                self.mode = "dxcam"
                return
        except Exception:                      # noqa: BLE001 - fall through and say so
            pass
        try:
            import mss
            self.sct = mss.mss()
            self.mon = self.sct.monitors[monitor + 1]
            self.mode = "mss"
        except Exception as exc:               # noqa: BLE001
            raise SystemExit(f"No way to capture the screen on this machine: {exc}")

    def grab(self) -> np.ndarray | None:
        if self.mode == "dxcam":
            return self.cam.grab()             # None when nothing changed — free
        shot = self.sct.grab(self.mon)
        return np.array(shot)[:, :, :3]


def be_polite() -> None:
    """Get out of the game's way.

    Below-normal priority means Windows hands this thread time only when the
    game does not want it. On a machine with spare cores that changes nothing;
    on one without, it is the difference between a background reader and a
    stutter. It is two lines and it is the whole answer to "will this cost me
    frames".
    """
    try:
        import psutil
        psutil.Process().nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
    except Exception:                          # noqa: BLE001 - a nicety, not a requirement
        pass


class Watcher:
    def __init__(self, config: dict, dry: bool = False):
        self.config = config
        self.dry = dry
        self.eye = screens.Recogniser()
        self.spool = Spool(
            base=config["worker"],
            token=config.get("token", ""),
            path=HERE / "spool.jsonl",
            dry=dry,
        )
        self.grabber = Grabber(config.get("monitor", 0))
        self.keep_frames = bool(config.get("keep_frames", True))
        self.last_sent: dict[str, float] = {}
        self.last_status = None

    # ── collecting ───────────────────────────────────────────────────────────

    def collect(self, first: screens.Frame, screen: str) -> dict[str, ocr.Read]:
        """Look at one screen several times and take what it said most often.

        The first frame is already in hand, so it counts as a look. The rest
        are grabbed over the next couple of seconds while the screen is still
        up. If the screen changes underneath — he skipped the summary — the
        vote runs on whatever was gathered, and comes back None-heavy rather
        than confidently wrong.
        """
        looks: list[dict[str, ocr.Read]] = [self.eye.read_fields(first, screen)]
        deadline = time.monotonic() + COLLECT_SECONDS

        while time.monotonic() < deadline:
            time.sleep(1 / FPS)
            raw = self.grabber.grab()
            if raw is None:
                continue
            frame = screens.Frame.of(raw)
            if not self.eye.interesting(frame):
                break
            again = self.eye.identify(frame)
            if again.screen != screen:
                break
            looks.append(self.eye.read_fields(frame, screen))

        names = {k for look in looks for k in look}
        voted: dict[str, ocr.Read] = {}
        for name in names:
            reads = [look[name] for look in looks if name in look]
            texts = [r for r in reads if r.value is None and r.text]
            if any(r.value is not None for r in reads):
                voted[name] = ocr.vote(reads, min_agree=2 if len(looks) >= MIN_LOOKS else 1)
            elif texts:
                # A text field — the vote is over strings, same principle.
                best = max(set(t.text for t in texts), key=lambda s: sum(1 for t in texts if t.text == s))
                conf = sum(t.conf for t in texts if t.text == best) / max(1, sum(1 for t in texts if t.text == best))
                voted[name] = ocr.Read(text=best, conf=round(conf, 3))
            else:
                voted[name] = ocr.Read(text="", conf=0.0)

        voted["_looks"] = ocr.Read(text=str(len(looks)), conf=1.0, value=len(looks))
        return voted

    # ── sending ──────────────────────────────────────────────────────────────

    def cooling(self, screen: str) -> bool:
        last = self.last_sent.get(screen, 0)
        return (time.monotonic() - last) < COOLDOWN_SECONDS

    def keep(self, frame: screens.Frame, screen: str) -> str | None:
        """Keep the frame a match was read from.

        Not to publish — this never leaves the machine. It is so that a number
        that looks wrong on the page can be checked against the exact pixels
        that produced it, months later, instead of being argued about.
        """
        if not self.keep_frames:
            return None
        try:
            import cv2
            FRAMES.mkdir(exist_ok=True)
            name = f"{now_iso().replace(':', '-')}-{screen}.jpg"
            cv2.imwrite(str(FRAMES / name), frame.image, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            return name
        except Exception:                      # noqa: BLE001
            return None

    def send_match(self, fields: dict[str, ocr.Read], frame: screens.Frame, won: bool) -> None:
        value = lambda k: fields[k].value if k in fields else None
        conf = {k: r.conf for k, r in fields.items() if r.value is not None and k != "_looks"}

        body = {
            "id": str(uuid.uuid4()),
            "at": now_iso(),
            "mode": self.config.get("mode", "br"),
            "legend": screens.legend_name(fields["legend"].text) if "legend" in fields else None,
            "kills": value("kills"),
            "assists": value("assists"),
            "knocks": value("knocks"),
            "damage": value("damage"),
            # A win is known from the champion screen, not read off a digit.
            "place": 1 if won else value("place"),
            "survival": value("survival"),
            "revives": value("revives"),
            "respawns": value("respawns"),
            "confidence": conf,
            "source": "watcher",
            "frame": self.keep(frame, "match"),
        }
        if won:
            body["confidence"]["place"] = 1.0

        self.spool.post("/apex/match", body)
        readable = {k: v for k, v in body.items() if k in ("kills", "damage", "place", "legend")}
        print(f"  match sent  {readable}  ({fields['_looks'].value} looks)")

    def send_career(self, fields: dict[str, ocr.Read]) -> None:
        stats = {k: r.value for k, r in fields.items() if r.value is not None and k != "_looks"}
        if not stats:
            return
        self.spool.post("/apex/career", {"stats": stats})
        print(f"  career sent {stats}")

    def send_legend(self, fields: dict[str, ocr.Read]) -> None:
        name = screens.legend_name(fields.get("legend", ocr.Read("", 0)).text)
        if not name:
            return
        stats = {}
        for i in (1, 2, 3):
            label = fields.get(f"tracker{i}n")
            value = fields.get(f"tracker{i}")
            if label and value and value.value is not None and label.text:
                stats[label.text.title()] = value.value
        if not stats:
            return
        self.spool.post(f"/apex/legend/{name}", {"stats": stats})
        print(f"  legend sent {name} {stats}")

    def send_status(self, state: str, screen: str | None) -> None:
        if self.last_status == (state, screen):
            return
        self.last_status = (state, screen)
        self.spool.post("/apex/status", {"state": state, "screen": screen})

    # ── the loop ─────────────────────────────────────────────────────────────

    def tick(self) -> None:
        raw = self.grabber.grab()
        if raw is None:
            return
        frame = screens.Frame.of(raw)

        if not self.eye.interesting(frame):
            self.send_status("playing", None)
            return

        seen = self.eye.identify(frame)
        if not seen.screen:
            return

        if self.cooling(seen.screen):
            return

        print(f"[{now_iso()}] {seen.screen} (match {seen.score}, saw {seen.saw!r})")
        self.send_status("lobby" if seen.screen != "match_summary" else "summary", seen.screen)

        if seen.screen == "champion":
            # Note the win and wait for the summary that follows it, which is
            # where the numbers are. The champion screen alone has none.
            self.pending_win = time.monotonic()
            self.last_sent["champion"] = time.monotonic()
            return

        fields = self.collect(frame, seen.screen)

        if seen.screen == "match_summary":
            won = (time.monotonic() - getattr(self, "pending_win", -999)) < 60
            self.send_match(fields, frame, won)
            self.pending_win = -999
        elif seen.screen == "career":
            self.send_career(fields)
        elif seen.screen == "legend_banner":
            self.send_legend(fields)

        self.last_sent[seen.screen] = time.monotonic()

    def run(self, once: bool = False) -> None:
        print(f"watching  capture={self.grabber.mode}  tesseract={ocr.tesseract_version()}"
              f"  {'DRY RUN' if self.dry else self.config['worker']}")
        if not self.eye.calibrated:
            print("\n  !! regions.json has never been calibrated. The boxes in it are\n"
                  "     estimates of where Apex puts its numbers, not measurements.\n"
                  "     Run `python calibrate.py` before trusting anything this sends.\n")
        while True:
            start = time.monotonic()
            try:
                self.tick()
            except KeyboardInterrupt:
                raise
            except Exception as exc:           # noqa: BLE001 - a bad frame must not end the session
                print(f"  ! {type(exc).__name__}: {exc}")
            if once:
                return
            time.sleep(max(0.0, 1 / FPS - (time.monotonic() - start)))


def main() -> None:
    ap = argparse.ArgumentParser(description="Watch Apex and push match stats to the site.")
    ap.add_argument("--dry", action="store_true", help="read and print, send nothing")
    ap.add_argument("--once", action="store_true", help="a single pass, then exit")
    args = ap.parse_args()

    be_polite()
    watcher = Watcher(load_config(), dry=args.dry)
    try:
        watcher.run(once=args.once)
    except KeyboardInterrupt:
        watcher.send_status("away", None)
        watcher.spool.flush()
        print("\nstopped")


if __name__ == "__main__":
    main()
