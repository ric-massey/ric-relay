#!/usr/bin/env python3
"""Ric's team's chance of winning a round, from the state of it — and so what
each kill was worth.

    python projects/cs/winprob.py        # fit on every saved replay, check it, print it

The state of a round at any moment is up to five things, all from Ric's team's side:

  men      log((alive ours + .5) / (alive theirs + .5)) — 5v5 is 0, 5v4 is
           +0.20, 2v1 is +0.51; the .5 keeps a side with nobody left finite
  planted  +1 once the bomb is down if Ric's team are T, -1 if they're CT
  econ     how much better his team bought, in $1000 a player (the average
           loadout each side carried out of the buy)
  ct       +1 when Ric's team are CT: maps lean one way
  rank     how much higher his team's skill groups were, in thirds of a group
           (the demo's own rank for every player, which is set before the
           match, so it says nothing about how this one went). Hidden ranks
           are skipped; with fewer than two shown on a side it is 0. It is
           kept ONLY if it makes the held-out check better (below), and the
           model lists what it uses in `uses`.

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

Is it any good? check() answers that on games the model never saw. The
matches are split into folds; each fold is predicted by a model fitted on the
others and scored against what happened. Whole matches go into a fold
together, because the moments of one round are near-copies of each other and
splitting them would let the model mark its own homework. It is scored two
ways (Brier and log loss, lower is better) against a plain table of how often
each men-alive count was won, so "better than counting heads" is a number
rather than a hope, and binned into a calibration table: of the moments it
called about 10%, how many were won.

`step` is how finely the page may show the chance: 1% once the calibration is
within two points on a few thousand held-out moments, 5% until then. Showing
12.3% from a model that can be five points out claims a precision it does not
have. The sums (rounds added, a kill's value) use the full number; only what
is printed is rounded.

Generated numbers only; nothing here is tuned by hand except the regulariser,
which keeps a thin sample from producing a wild coefficient (it pulls every
input towards "no effect", so towards an even round), and the step rule above.
"""

import json
import math
import sys
from pathlib import Path

FEATURES = ["const", "men", "planted", "econ", "ct", "rank"]
L2 = 1.0                       # ridge on everything but the constant
FOLDS = 10                     # the held-out check splits the matches this many ways
BINS = 10                      # calibration table: 0-10%, 10-20%, ...
FINE = (0.02, 2000)            # 1% steps once off by <= this, on >= this many moments

try:                           # the venv has it; a bare python falls back to loops
    import numpy as np
except ImportError:            # pragma: no cover
    np = None


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


def skill(seat):
    """A player's skill group on one scale, or None if hidden. Competitive
    (rank type 12) is groups 1-18; Premier (11) is a rating, ~1700 a group;
    anything else (wingman) is another ladder and is left out."""
    rk, kind = seat.get("rank") or 0, seat.get("rank_type")
    if not rk:
        return None
    if kind == 11:
        return rk / 1700
    if kind == 12:
        return float(rk)
    return None


def rank_diff(R):
    """How much higher Ric's team ranked, in thirds of a skill group; 0 when
    either side shows fewer than two ranks."""
    ours = [k for s in R["seats"] if s.get("us") for k in [skill(s)] if k is not None]
    theirs = [k for s in R["seats"] if not s.get("us") for k in [skill(s)] if k is not None]
    if len(ours) < 2 or len(theirs) < 2:
        return 0.0
    return round((sum(ours) / len(ours) - sum(theirs) / len(theirs)) / 3, 3)


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


def features(ours, theirs, planted, side, econ, rank=0.0):
    t_side = side == "T"
    return [1.0,
            math.log((ours + 0.5) / (theirs + 0.5)),
            (1.0 if t_side else -1.0) if planted else 0.0,
            econ,
            1.0 if side == "CT" else 0.0,
            rank]


def chance(coef, ours, theirs, planted, side, econ, rank=0.0):
    """Ric's team's chance of winning from this state, 0..1. A model fitted
    without rank has five coefficients, and zip() leaves rank out."""
    ours, theirs = max(0, ours), max(0, theirs)   # a kill logged after a reconnect can count past zero
    if theirs == 0 and not (planted and side == "CT"):
        return 1.0
    if ours == 0 and not (planted and side == "T"):
        return 0.0
    z = sum(c * x for c, x in zip(coef, features(ours, theirs, planted, side, econ, rank)))
    return 1 / (1 + math.exp(-max(-30, min(30, z))))


def timeline(coef, R, r):
    """[[t, chance], ...] for the round: the start, then every change."""
    us, side = us_of(R), r.get("side")
    e, k = econ_diff(r, us), rank_diff(R)
    return [[t, round(chance(coef, o, th, p, side, e, k), 4)] for t, o, th, p in states(R, r)]


def moments(R):
    """Every undecided moment of every round of one game, as Ric's team saw
    it: (ours, theirs, planted, side, econ, rank, won)."""
    us, k = us_of(R), rank_diff(R)
    out = []
    for r in R["rounds"]:
        side = r.get("side")
        if side not in ("CT", "T") or r.get("w") is None:
            continue
        e = econ_diff(r, us)
        for _t, o, th, p in states(R, r):
            if (th == 0 and not (p and side == "CT")) or (o == 0 and not (p and side == "T")):
                continue                     # decided: nothing to learn
            out.append((o, th, p, side, e, k, bool(r["w"])))
    return out


def _rows(replays, n_feat):
    X, y = [], []
    for R in replays:
        for o, th, p, side, e, k, won in moments(R):
            other = "T" if side == "CT" else "CT"
            # every moment twice: as Ric's team saw it, and as the other
            # team did. Without the mirror the constant learns his team's
            # record, and 5v5 starts every round at 42%.
            X.append(features(o, th, p, side, e, k)[:n_feat])
            y.append(1.0 if won else 0.0)
            X.append(features(th, o, p, other, -e, -k)[:n_feat])
            y.append(0.0 if won else 1.0)
    return X, y


def _newton(X, y, k):
    """Logistic regression by Newton's method, ridge on all but the constant."""
    if np is not None and X:
        A, b = np.array(X, dtype=float), np.array(y, dtype=float)
        reg = np.full(k, L2)
        reg[0] = 0.0
        w = np.zeros(k)
        for _ in range(50):
            p = 1 / (1 + np.exp(-np.clip(A @ w, -30, 30)))
            g = A.T @ (p - b) + reg * w
            H = (A * (p * (1 - p))[:, None]).T @ A + np.diag(reg)
            step = np.linalg.lstsq(H, g, rcond=None)[0]
            w = w - step
            if np.max(np.abs(step)) < 1e-8:
                break
        return [float(c) for c in w]
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
    return w


def fit(replays, rank=None):
    """The model, fitted on every replay, with its held-out check. rank=None
    lets the check decide whether the skill groups earn their place."""
    replays = list(replays)
    if rank is None:
        plain, ranked = check(replays, False), check(replays, True)
        rank = bool(plain and ranked and ranked["model"]["logloss"] < plain["model"]["logloss"])
        held = ranked if rank else plain
    else:
        held = check(replays, rank)
    k = len(FEATURES) - (0 if rank else 1)
    X, y = _rows(replays, k)
    w = _newton(X, y, k)
    out = {"features": FEATURES[:k], "coef": [round(c, 5) for c in w],
           "states": len(X) // 2, "rounds": sum(len(R["rounds"]) for R in replays),
           "step": 5}
    if held:
        out["check"] = held
        if held["ece"] <= FINE[0] and held["moments"] >= FINE[1]:
            out["step"] = 1
    return out


def check(replays, rank=True):
    """Score the model on games it never saw: whole matches per fold, each
    fold predicted by a fit on the others, beside a men-alive table fitted on
    the same folds."""
    replays = [R for R in replays if moments(R)]
    if len(replays) < 3:
        return None
    k = len(FEATURES) - (0 if rank else 1)
    n_folds = min(FOLDS, len(replays))
    preds = []                                   # (model, table, won)
    for f in range(n_folds):
        train = [R for i, R in enumerate(replays) if i % n_folds != f]
        test = [R for i, R in enumerate(replays) if i % n_folds == f]
        X, y = _rows(train, k)
        w = _newton(X, y, k)
        table = {}                               # (ours, theirs, our bomb down, theirs down) -> [won, seen]
        for R in train:
            for o, th, p, side, _e, _k, won in moments(R):
                for key, v in (((o, th, p and side == "T", p and side == "CT"), won),
                               ((th, o, p and side == "CT", p and side == "T"), not won)):
                    c = table.setdefault(key, [0, 0])
                    c[0] += v
                    c[1] += 1
        for R in test:
            for o, th, p, side, e, rk, won in moments(R):
                c = table.get((o, th, p and side == "T", p and side == "CT"), [0, 0])
                preds.append((chance(w, o, th, p, side, e, rk), (c[0] + 1) / (c[1] + 2), won))

    def score(i):
        n = len(preds)
        brier = sum((q[i] - q[2]) ** 2 for q in preds) / n
        ll = -sum(math.log(min(1 - 1e-6, max(1e-6, q[i] if q[2] else 1 - q[i]))) for q in preds) / n
        return {"brier": round(brier, 4), "logloss": round(ll, 4)}
    bins = []
    for b in range(BINS):
        lo, hi = b / BINS, (b + 1) / BINS
        inb = [q for q in preds if lo <= q[0] < hi or (b == BINS - 1 and q[0] >= hi)]
        if inb:
            bins.append([round(lo, 2), round(hi, 2), len(inb),
                         round(sum(q[0] for q in inb) / len(inb), 3),
                         round(sum(q[2] for q in inb) / len(inb), 3)])
    ece = sum(n * abs(said - won) for _lo, _hi, n, said, won in bins) / len(preds)
    return {"games": len(replays), "folds": n_folds, "moments": len(preds),
            "model": score(0), "table": score(1), "ece": round(ece, 4),
            # [from, to, moments, average chance it gave, share actually won]
            "bins": bins}


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
    print(json.dumps({k: v for k, v in m.items() if k != "check"}))
    c = m.get("check")
    if c:
        print(f"held out: {c['moments']} moments from {c['games']} games in {c['folds']} folds")
        print(f"  model  Brier {c['model']['brier']}  log loss {c['model']['logloss']}")
        print(f"  table  Brier {c['table']['brier']}  log loss {c['table']['logloss']}  (men alive only)")
        print(f"  calibration off by {c['ece']:.1%} on average, so shown in {m['step']}% steps")
        for lo, hi, n, said, won in c["bins"]:
            print(f"  said {lo:.0%}-{hi:.0%}: {n:5d} moments, average {said:.0%}, won {won:.0%}")
    for o, th in ((5, 5), (5, 4), (4, 5), (2, 1), (1, 2), (1, 1)):
        print(f"{o}v{th} even buy, T side: {chance(m['coef'], o, th, False, 'T', 0):.0%}"
              f"  · planted: {chance(m['coef'], o, th, True, 'T', 0):.0%}"
              f"  · CT side: {chance(m['coef'], o, th, False, 'CT', 0):.0%}")


if __name__ == "__main__":
    main()
