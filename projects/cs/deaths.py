#!/usr/bin/env python3
"""Why a player died — every death, sorted into what went wrong.

    python projects/cs/deaths.py [name]     # the breakdown, to read

Kill-death ratios say how often; this says why. Every death in the saved
replays is read at the instant it happened (the replay's snapshot of all ten
players then, its damage log and its flashes) and tagged with each of these
that's true:

  flashed      the victim was blind when they died
  unseen       the killer was outside the victim's view: more than UNSEEN_DEG
               off the way they faced (CS shows about 53° either side of the
               crosshair at 16:9; the margin covers a target at the edge)
  outnumbered  two or more enemies hit them in the OUTNUMBERED_S before
  alone        nobody traded them, and no teammate alive was within
               ALONE_UNITS (about 25 m) — no one there to
  duel         none of the above: a fair fight, lost

A death can be more than one; the first in that order is its headline, the
one counted when a death needs a single answer. Deaths to the world, the
bomb or a teammate aren't tagged. no_reply notes that the victim fired
nothing in the 3 s before, as a detail.
"""

import math
import sys
from pathlib import Path

UNSEEN_DEG = 60
OUTNUMBERED_S = 5
ALONE_UNITS = 1000
ORDER = ["flashed", "unseen", "outnumbered", "alone", "duel"]
WORDS = {"flashed": "flashed", "unseen": "shot from outside their view", "outnumbered": "outnumbered",
         "alone": "died alone, untraded", "duel": "lost a fair duel"}


def why(R, r, f):
    """The tags for one death, headline first; None when it isn't a fight."""
    v, k = f.get("victim"), f.get("killer")
    if v is None or k is None or k == v:
        return None
    us = {s["seat"] for s in R["seats"] if s.get("us")}
    if (k in us) == (v in us):
        return None                              # a teamkill
    t = f["t"]
    tags = []
    for fl in r.get("flashes") or []:
        if fl[2] == v and fl[0] <= t <= fl[0] + (fl[3] or 0) + 0.2:
            tags.append("flashed")
            break
    snap = {s.get("seat"): s for s in f.get("snapshot") or []}
    yaw = (snap.get(v) or {}).get("yaw")
    va, ka = f.get("victim_at") or {}, f.get("killer_at") or {}
    if yaw is not None and None not in (va.get("x"), va.get("y"), ka.get("x"), ka.get("y")):
        bearing = math.degrees(math.atan2(ka["y"] - va["y"], ka["x"] - va["x"]))
        off = abs((bearing - yaw + 540) % 360 - 180)
        if off > UNSEEN_DEG:
            tags.append("unseen")
    hit_by = {d[1] for d in r.get("damage") or []
              if d[2] == v and d[1] is not None and d[1] != v and (d[1] in us) != (v in us) and t - OUTNUMBERED_S <= d[0] <= t}
    if len(hit_by) >= 2:
        tags.append("outnumbered")
    if f.get("traded_after") is None and va.get("x") is not None:
        mates = [s for s in snap.values() if s.get("seat") != v and (s.get("seat") in us) == (v in us)
                 and (s.get("hp") or 0) > 0 and s.get("x") is not None]
        near = min((math.hypot(s["x"] - va["x"], s["y"] - va["y"]) for s in mates), default=None)
        if near is None or near > ALONE_UNITS:
            tags.append("alone")
    if not tags:
        tags.append("duel")
    tags.sort(key=ORDER.index)
    if ((f.get("shots_before") or {}).get("victim") or 0) == 0:
        tags.append("no_reply")
    return tags


def every_death(R):
    """(round index, fight, victim seat, tags) for each death that was a fight."""
    for i, r in enumerate(R["rounds"]):
        end = (r.get("dur") or 1e9) + 0.5
        for f in r.get("fights") or []:
            if f.get("t") is None or f["t"] > end:
                continue
            tags = why(R, r, f)
            if tags:
                yield i, f, f["victim"], tags


def main():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from collections import Counter
    import csdata
    import stats
    who = sys.argv[1] if len(sys.argv) > 1 else None
    head, every, n = Counter(), Counter(), 0
    for m in csdata.load()["matches"]:
        R = stats.load_replay(m["id"]) if m.get("replay") else None
        if not R:
            continue
        names = {s["seat"]: (s.get("name") or "?") for s in R["seats"]}
        mine = {s["seat"] for s in R["seats"] if (s.get("me") if not who else s.get("name") == who)}
        for _i, _f, v, tags in every_death(R):
            if v in mine:
                n += 1
                head[tags[0]] += 1
                every.update(tags)
    print(f"{who or 'Ric'}: {n} deaths")
    for k in ORDER:
        print(f"  {WORDS[k]:<30} headline {head[k]:>3} ({100 * head[k] / max(1, n):.0f}%)   any {every[k]:>3}")
    print(f"  {'never fired back':<30} {every['no_reply']:>3}")


if __name__ == "__main__":
    main()
