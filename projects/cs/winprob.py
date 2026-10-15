#!/usr/bin/env python3
"""Ric's team's chance of winning a round, from the state of it — and so what
each kill was worth.

    python projects/cs/winprob.py        # fit on every saved replay and print it

The state of a round at any moment is four things, all from Ric's team's side:

  men      log((alive ours + .5) / (alive theirs + .5)) — 5v5 is 0, 5v4 is
           +0.20, 2v1 is +0.51; the .5 keeps a side with nobody left finite
  planted  +1 once the bomb is down if Ric's team are T, -1 if they're CT
  econ     how much better his team bought, in $1000 a player (the average
           loadout each side carried out of the buy)
  ct       +1 when Ric's team are CT: maps lean one way

The chance is a logistic model over those (plus a constant), fitted on every
moment of every round in the saved replays — round start, every kill, the
plant — labelled with who won the round, and fitted from both teams' side of
each moment, so it says how CS rounds go rather than how Ric's team's do. It's refitted on every sync, so it
is measured on Ric's own games and moves as there are more of them; stats.js
carries the numbers it came out with, and cs.html draws the same function.
test/parity.mjs holds the two to each other.

Two states need no model: the other team all dead with no bomb to defuse is a
win, and Ric's team all dead with no bomb of theirs ticking is a loss.

A kill's value is the chance just after it minus just before: what that kill
did to his team's odds. A death of Ric's has a negative value.

Generated numbers only; nothing here is tuned by hand except the regulariser,
which only keeps a thin sample from producing a wild coefficient.
"""

import json
import math
import sys
from pathlib import Path

FEATURES = ["const", "men", "planted", "econ", "ct"]
L2 = 1.0                       # ridge on everything but the constant


def us_of(R):
    return {s["seat"] for s in R["seats"] if s.get("us")}


def plant_time(r):
    for t, kind, *_ in (r.get("bomb") or {}).get("timeline") or []:
        if kind == "planted":
            return t
    b = (r.get("bomb") or {}).get("planted")
    return b.get("t") if b else None


def econ_diff(r, us):
    ours, theirs = [], []
    for s, e in (r.get("economy") or {}).items():
        (ours if int(s) in us else theirs).append((e or {}).get("equip") or 0)
    if not ours or not theirs:
        return 0.0
    return round((sum(ours) / len(ours) - sum(theirs) / len(theirs)) / 1000, 3)


def states(R, r):
    """Every moment the round changed: [t, ours alive, theirs alive, planted].
    The first is the round's start; then one after each kill, and the plant."""
    us = us_of(R)
    fs = [f for f in r.get("fights") or [] if f.get("t") is not None and f["t"] <= r.get("dur", 1e9)]
    if fs and fs[0].get("alive_before") and None not in fs[0]["alive_before"]:
        ours, theirs = fs[0]["alive_before"]
    else:
        seats = {int(s) for s in r.get("tracks") or {}}
        ours, theirs = len(seats & us) or 5, len(seats - us) or 5
    pt = plant_time(r)
    out = [[0.0, ours, theirs, False]]
    events = [(f["t"], 0, f) for f in fs] + ([(pt, 1, None)] if pt is not None and pt <= r.get("dur", 1e9) else [])
    for t, kind, f in sorted(events, key=lambda e: (e[0], e[1])):
        if kind == 1:
            out.append([t, ours, theirs, True])
            continue
        v = f.get("victim")
        if v is None:
            continue
        if v in us:
            ours = max(0, ours - 1)
        else:
            theirs = max(0, theirs - 1)
        out.append([t, ours, theirs, pt is not None and pt <= t])
    return out


def features(ours, theirs, planted, side, econ):
    t_side = side == "T"
    return [1.0,
            math.log((ours + 0.5) / (theirs + 0.5)),
            (1.0 if t_side else -1.0) if planted else 0.0,
            econ,
            1.0 if side == "CT" else 0.0]


def chance(coef, ours, theirs, planted, side, econ):
    """Ric's team's chance of winning from this state, 0..1."""
    ours, theirs = max(0, ours), max(0, theirs)   # a kill logged after a reconnect can count past zero
    if theirs == 0 and not (planted and side == "CT"):
        return 1.0
    if ours == 0 and not (planted and side == "T"):
        return 0.0
    z = sum(c * x for c, x in zip(coef, features(ours, theirs, planted, side, econ)))
    return 1 / (1 + math.exp(-max(-30, min(30, z))))


def timeline(coef, R, r):
    """[[t, chance], ...] for the round: the start, then every change."""
    us, side = us_of(R), r.get("side")
    e = econ_diff(r, us)
    return [[t, round(chance(coef, o, th, p, side, e), 4)] for t, o, th, p in states(R, r)]


def fit(replays):
    """Logistic regression by Newton's method, ridge-regularised."""
    X, y = [], []
    for R in replays:
        us = us_of(R)
        for r in R["rounds"]:
            side = r.get("side")
            if side not in ("CT", "T") or r.get("w") is None:
                continue
            e = econ_diff(r, us)
            other = "T" if side == "CT" else "CT"
            for _t, o, th, p in states(R, r):
                if (th == 0 and not (p and side == "CT")) or (o == 0 and not (p and side == "T")):
                    continue                     # decided: nothing to learn
                # every moment twice: as Ric's team saw it, and as the other
                # team did. Without the mirror the constant learns his team's
                # record, and 5v5 starts every round at 42%.
                X.append(features(o, th, p, side, e))
                y.append(1.0 if r["w"] else 0.0)
                X.append(features(th, o, p, other, -e))
                y.append(0.0 if r["w"] else 1.0)
    k = len(FEATURES)
    w = [0.0] * k
    for _ in range(50):
        g = [0.0] * k
        H = [[0.0] * k for _ in range(k)]
        for xi, yi in zip(X, y):
            z = sum(a * b for a, b in zip(w, xi))
            p = 1 / (1 + math.exp(-max(-30, min(30, z))))
            for a in range(k):
                g[a] += (p - yi) * xi[a]
                for b in range(k):
                    H[a][b] += p * (1 - p) * xi[a] * xi[b]
        for a in range(1, k):
            g[a] += L2 * w[a]
            H[a][a] += L2
        step = _solve(H, g)
        w = [a - b for a, b in zip(w, step)]
        if max(abs(s) for s in step) < 1e-8:
            break
    return {"features": FEATURES, "coef": [round(c, 5) for c in w],
            "states": len(X) // 2, "rounds": sum(len(R["rounds"]) for R in replays)}


def _solve(A, b):
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[piv] = M[piv], M[c]
        if abs(M[c][c]) < 1e-12:
            continue
        for r in range(n):
            if r != c:
                f = M[r][c] / M[c][c]
                M[r] = [a - f * bb for a, bb in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] if abs(M[i][i]) > 1e-12 else 0.0 for i in range(n)]


def main():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import csdata
    import stats
    data = csdata.load()
    reps = [R for m in data["matches"] if m.get("replay") for R in [stats.load_replay(m["id"])] if R]
    m = fit(reps)
    print(json.dumps(m))
    for o, th in ((5, 5), (5, 4), (4, 5), (2, 1), (1, 2), (1, 1)):
        print(f"{o}v{th} even buy, T side: {chance(m['coef'], o, th, False, 'T', 0):.0%}"
              f"  · planted: {chance(m['coef'], o, th, True, 'T', 0):.0%}"
              f"  · CT side: {chance(m['coef'], o, th, False, 'CT', 0):.0%}")


if __name__ == "__main__":
    main()
