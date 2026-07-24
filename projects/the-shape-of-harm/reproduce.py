#!/usr/bin/env python3
"""
reproduce.py — regenerate every headline figure in "The Shape of Harm"
from the published data files.

    python3 reproduce.py

Requires only the Python standard library. Reads scores.csv, weighting.json
and references.json from the same directory and rebuilds:

  1. the composite ranking under each weight preset
  2. the uncertainty interval for every drug, propagated from evidence grades
  3. how many pairwise comparisons are actually distinguishable
  4. the correlation with Nutt 2010 and with the Canadian MCDA 2026
  5. the rank-stability sensitivity analysis
  6. a reference and evidence-grade audit

Everything printed here should match the page. If it doesn't, the page is wrong.

A note on what this does and does not establish. Reproducibility means someone
else can get the same numbers from the same inputs. It says nothing about
whether the inputs are right. Twenty-four of the sixty cells are author
judgment, and no amount of reproducible arithmetic converts a judgment into a
measurement. This script makes the analysis checkable, not correct.
"""

import csv, json, math, random, os, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
GRADE_SD = {"M": 4.0, "P": 7.5, "J": 10.0}
BIAS_SD, N_ITER, SEED = 5.0, 20000, 7


def load():
    with open(os.path.join(HERE, "scores.csv"), encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    with open(os.path.join(HERE, "weighting.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    with open(os.path.join(HERE, "references.json"), encoding="utf-8") as f:
        refs = json.load(f)
    cols = [c["key"] for c in cfg["criteria"]]
    scores, grades, basis = defaultdict(dict), defaultdict(dict), defaultdict(dict)
    for r in rows:
        d, k = r["drug"], r["criterion_key"]
        scores[d][k] = None if r["score"] == "" else float(r["score"])
        grades[d][k] = r["evidence_grade"]
        basis[d][k] = r["evidence_basis"]
    return cols, dict(scores), dict(grades), dict(basis), cfg, refs


def composite(sc, w, cols):
    tot = ws = 0.0
    for c in cols:
        if sc[c] is None:
            continue
        tot += sc[c] * w[c]; ws += w[c]
    return tot / ws if ws else 0.0


def interval(sc, gr, w, cols, half):
    """Fully correlated propagation — the conservative direction."""
    lo = hi = ws = 0.0
    for c in cols:
        wt = w[c]
        if sc[c] is None:
            hi += 100 * wt; ws += wt; continue
        h = half[gr[c]]
        lo += max(0, sc[c] - h) * wt
        hi += min(100, sc[c] + h) * wt
        ws += wt
    return (lo / ws, hi / ws) if ws else (0.0, 0.0)


def spearman(a, b):
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v); i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2 + 1
            for k in range(i, j + 1):
                r[order[k]] = avg
            i = j + 1
        return r
    ra, rb = rank(a), rank(b)
    n = len(a)
    ma, mb = sum(ra) / n, sum(rb) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb))
    return num / den if den else 0.0


def simulate(scores, grades, w, cols, seed, correlated=True, n=N_ITER):
    rng = random.Random(seed)
    names = list(scores)
    wins = dict.fromkeys(names, 0)
    ranks = {k: [] for k in names}
    for _ in range(n):
        draw = []
        for nm in names:
            bias = rng.gauss(0, BIAS_SD) if correlated else 0.0
            tot = ws = 0.0
            for c in cols:
                v = scores[nm][c]
                if v is None:
                    continue
                x = min(100, max(0, v + bias + rng.gauss(0, GRADE_SD[grades[nm][c]])))
                tot += x * w[c]; ws += w[c]
            draw.append((tot / ws if ws else 0.0, nm))
        draw.sort(reverse=True)
        wins[draw[0][1]] += 1
        for i, (_, nm) in enumerate(draw):
            ranks[nm].append(i + 1)
    return ({k: v / n for k, v in wins.items()},
            {k: (sorted(v)[len(v) // 2], sorted(v)[int(.05 * len(v))],
                 sorted(v)[int(.95 * len(v))]) for k, v in ranks.items()})


def main():
    cols, scores, grades, basis, cfg, refs = load()
    half = {k: v for k, v in cfg["grade_half_widths"].items() if v is not None}
    half["S"] = None
    presets = cfg["weight_presets"]
    eq = presets["equal"]
    bar = "=" * 74

    print(bar); print("THE SHAPE OF HARM — reproduction"); print(bar)
    ver = cfg.get("model_version", "?")
    print(f"model {ver}: {len(scores)} substances x {len(cols)} criteria = {len(scores)*len(cols)} cells")

    # Fail loudly rather than quietly disagreeing with the page.
    expect = {"substance_count": len(scores), "criterion_count": len(cols),
              "cell_count": len(scores) * len(cols)}
    drift = {k: (cfg[k], v) for k, v in expect.items() if k in cfg and cfg[k] != v}
    susp = sum(1 for d in scores for c in cols if scores[d][c] is None)
    if cfg.get("suspended_cells") not in (None, susp):
        drift["suspended_cells"] = (cfg["suspended_cells"], susp)
    if drift:
        print("\n!! MODEL DRIFT — declared vs actual:")
        for k, (dec, act) in drift.items():
            print(f"     {k}: declared {dec}, actual {act}")
        raise SystemExit("weighting.json does not describe scores.csv")
    print(f"   {susp} suspended cell(s) — matches the declared model")

    tally = defaultdict(int)
    for d in scores:
        for c in cols:
            tally[grades[d][c]] += 1
    total = sum(tally.values())
    print("\n1. EVIDENCE GRADES")
    for g, label in [("M", "measured (drug-specific figure)"),
                     ("P", "indirect (proxy or extrapolation)"),
                     ("J", "judgment (no drug-specific number)"),
                     ("S", "suspended (no defensible value)")]:
        print(f"   {g}  {tally[g]:>2}  {tally[g]/total*100:>4.0f}%   {label}")
    print(f"   -> {tally['M']/total*100:.0f}% of cells rest on a measured value.")

    print("\n2. RANKING BY PRESET")
    for pname, w in presets.items():
        order = sorted(scores, key=lambda d: -composite(scores[d], w, cols))
        print(f"   {pname:<8} " + " · ".join(
            f"{i+1}.{d.split(' (')[0]}" for i, d in enumerate(order[:5])))

    print("\n3. COMPOSITE INTERVALS (equal weights, correlated propagation)")
    rows = sorted(((d, composite(scores[d], eq, cols),
                    interval(scores[d], grades[d], eq, cols, half)) for d in scores),
                  key=lambda r: -r[1])
    for d, pt, (lo, hi) in rows:
        flag = "  <- suspended cell" if any(scores[d][c] is None for c in cols) else ""
        print(f"   {d:<20} ~{pt:>5.1f}   [{lo:>5.1f} – {hi:>5.1f}]  width {hi-lo:>4.1f}{flag}")

    pairs = [(rows[i], rows[j]) for i in range(len(rows)) for j in range(i + 1, len(rows))]
    ov = sum(1 for a, b in pairs if a[2][0] <= b[2][1] and b[2][0] <= a[2][1])
    print(f"\n   {ov} of {len(pairs)} pairwise comparisons have overlapping intervals")
    print(f"   -> only {len(pairs)-ov} of {len(pairs)} pairs ({(len(pairs)-ov)/len(pairs)*100:.0f}%) are distinguishable")

    print("\n4. AGREEMENT WITH EXTERNAL PANELS")
    nutt = {"Alcohol": 72, "Opioids (illicit)": 55, "Methamphetamine": 33, "Cocaine": 27,
            "Tobacco (smoked)": 26, "Cannabis": 20, "Benzodiazepines": 15, "Ketamine": 15,
            "MDMA": 9, "LSD": 7, "Psilocybin": 5}
    ks = [k for k in nutt if k in scores]
    print(f"   Nutt 2010     n={len(ks):<3} rho = {spearman([composite(scores[k],eq,cols) for k in ks],[nutt[k] for k in ks]):.3f}"
          "   (calibration, not validation — Nutt informed these scores)")
    can = {"Alcohol": 79, "Tobacco (smoked)": 45, "Opioids (illicit)": 33,
           "Cocaine": 19, "Methamphetamine": 19, "Cannabis": 15}
    ks = [k for k in can if k in scores]
    print(f"   Canada 2026   n={len(ks):<3} rho = {spearman([composite(scores[k],eq,cols) for k in ks],[can[k] for k in ks]):.3f}"
          "   (fresh panel; shares authors and method)")

    print(f"\n5. RANK STABILITY ({N_ITER:,} draws, seed {SEED}, correlated errors)")
    for pname in ("equal", "self", "society"):
        wins, _ = simulate(scores, grades, presets[pname], cols, SEED, True)
        top = sorted(wins.items(), key=lambda kv: -kv[1])[:3]
        print(f"   {pname:<8} " + "  ".join(
            f"{k.split(' (')[0]} {v*100:.0f}%" for k, v in top if v >= .01))
    _, rk = simulate(scores, grades, eq, cols, SEED, True)
    print("\n   90% rank intervals, equal weights:")
    for d, _, _ in rows:
        m, lo, hi = rk[d]
        print(f"   {d:<20} median {m:>2}   [{lo}–{hi}]")

    print("\n6. REFERENCES")
    by = defaultdict(int)
    for r in refs["references"]:
        by[r["evidence_type"]] += 1
    print(f"   {refs['count']} references: " + ", ".join(f"{v} {k}" for k, v in sorted(by.items())))
    ids = {r["id"] for r in refs["references"]}
    missing = set(range(1, max(ids) + 1)) - ids
    print(f"   contiguous 1–{max(ids)}: {'yes' if not missing else 'NO, missing ' + str(sorted(missing))}")
    nv = refs.get("verified_against_source")
    if nv is not None:
        print(f"   {nv} of {refs['count']} checked against the primary source; "
              f"{refs['not_re_checked']} carry figures not independently re-checked")

    print("\n7. TIERS (complete linkage: every within-tier pair below P=90%)")
    def stats(d, w):
        num = den = vs = 0.0
        for c in cols:
            v = scores[d][c]
            if v is None:
                continue
            sd = GRADE_SD[grades[d][c]]
            num += v * w[c]; den += w[c]; vs += (w[c] ** 2) * (sd ** 2)
        return (num / den, BIAS_SD ** 2 + vs / (den ** 2)) if den else (0.0, 0.0)

    def p_above(a, b, w):
        ma, va = stats(a, w); mb, vb = stats(b, w)
        s = math.sqrt(va + vb)
        return 0.5 * (1 + math.erf((ma - mb) / (s * math.sqrt(2)))) if s > 0 else float(ma > mb)

    # Complete linkage, not adjacent-only. A tier may hold a set of drugs only if
    # EVERY pair inside it is indistinguishable at the threshold. Comparing just
    # neighbours chained A-B-C into one tier whenever each step was close, even
    # where A and C were separable -- which made the published claim that a tier
    # is a comparison the table cannot make false under most weightings.
    for pname, w in presets.items():
        order = sorted(scores, key=lambda d: -composite(scores[d], w, cols))
        tiers, cur = [], [order[0]]
        for d in order[1:]:
            if any(p_above(x, d, w) >= 0.90 for x in cur):
                tiers.append(cur); cur = []
            cur.append(d)
        tiers.append(cur)
        print(f"   {pname:<9} {len(tiers)} tiers")
        for t, g in enumerate(tiers, 1):
            print(f"      {t}. " + ", ".join(x.split(" (")[0] for x in g))

    print("\n" + bar)
    print("Reproducibility is not validity. 24 of 65 cells are author judgment;")
    print("this script makes the analysis checkable, not correct.")
    print(bar)


if __name__ == "__main__":
    main()
