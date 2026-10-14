#!/usr/bin/env python3
"""Boil every saved demo down to the rounds and fights Ric was in.

    python projects/cs/stats.py

Writes `stats.js` (window.CS_STATS), which the Stats section of cs.html slices
by map and side in the browser. The replays are ~600 KB each; this is the
small file the page can afford to load whole. export-llm.py runs it on every
sync and writes the same numbers into llm/index.md.

  rounds[]  one per round played: side, won, how it ended, the opening kill,
            a clutch if Ric was last alive, his kills and damage, both teams'
            buy after the freeze time
  fights[]  every kill and death of Ric's: where both players stood (callout
            and map units), weapon, headshot/wallbang/smoke/flash, distance,
            men alive before, opening, traded
  hits[]    every bullet of damage given and taken, by hitgroup
  nades[]   every grenade Ric threw: [game, round, side, kind, x, y], where it went off
  flashes[] every flashbang of Ric's: [game, round, side, enemies blinded,
            teammates blinded, enemy seconds blind]

Generated, never hand-edited.
"""

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import csdata  # noqa: E402

OUT = csdata.HERE / "stats.js"
TRADE_S = 5                     # same window parse-demos.py uses for "traded"
UNITS_TO_M = 0.0254
NADES = {"hegrenade", "inferno", "molotov", "incgrenade", "flashbang", "smokegrenade", "decoy", "world"}


def load_replay(mid):
    p = csdata.MATCH_DIR / f"{mid}.js"
    if not p.exists():
        return None
    text = p.read_text(encoding="utf-8")
    return json.loads(text[text.index("]=") + 2:].strip().rstrip(";"))


def build(matches):
    games, rounds, fights, hits, nades, flashes = [], [], [], Counter(), [], []
    for m in matches:
        if not m.get("replay"):
            continue
        R = load_replay(m["id"])
        if not R:
            continue
        gi = len(games)
        games.append({"id": m["id"], "map": R["map"], "at": m.get("at"), "result": m["result"]})
        me = next((s["seat"] for s in R["seats"] if s.get("me")), 0)
        us = {s["seat"] for s in R["seats"] if s.get("us")}
        for n, r in enumerate(R["rounds"], 1):
            side, fs = r["side"], r.get("fights") or []
            row = {"g": gi, "n": n, "side": side, "w": bool(r["w"]), "why": r.get("reason"),
                   "pistol": n in (1, 13), "k": 0, "dmg": 0, "surv": True,
                   "first": None, "op": None, "clutch": None, "he": 0, "fire": 0}
            # buy after freeze time: Ric's, and each team's average
            econ = r.get("economy") or {}
            mine = [e.get("equip") or 0 for s, e in econ.items() if int(s) in us]
            theirs = [e.get("equip") or 0 for s, e in econ.items() if int(s) not in us]
            row["buy"] = (econ.get(str(me)) or {}).get("equip")
            row["ours"] = round(sum(mine) / len(mine)) if mine else None
            row["theirs"] = round(sum(theirs) / len(theirs)) if theirs else None
            # damage, capped at the 100 health each victim had to lose. It runs
            # a few percent under Leetify's ADR, so the page labels it as the demo's.
            took = Counter()
            for t, a, v, w, dh, _da, grp, _after in r.get("damage") or []:
                if v is None or t < 0:
                    continue
                real = max(0, min(dh or 0, 100 - took[v]))
                took[v] += real
                if a == me and v not in us:
                    row["dmg"] += real
                    if w == "hegrenade":
                        row["he"] += real
                    elif w in ("inferno", "molotov", "incgrenade"):
                        row["fire"] += real
                    if w not in NADES and grp:
                        hits[(R["map"], side, "g", grp)] += 1
                elif v == me and a is not None and a not in us and w not in NADES and grp:
                    hits[(R["map"], side, "t", grp)] += 1
            for t, s_, kind, x, y, *_ in r.get("nades") or []:
                if s_ == me and x is not None and kind in ("smoke", "flash", "he", "fire"):
                    nades.append([gi, n, side, kind, x, y])
            pops = {}                       # one flashbang blinds several people at the same tick
            for t, thrower, victim, secs in r.get("flashes") or []:
                if thrower != me or victim is None or victim == me:
                    continue
                f_ = pops.setdefault(round(t, 1), [0, 0, 0.0])
                if victim in us:
                    f_[1] += 1
                else:
                    f_[0] += 1
                    f_[2] += secs
            thrown = sum(1 for x in r.get("nades") or [] if x[1] == me and x[2] == "flash")
            for foes, mates, secs in pops.values():
                flashes.append([gi, n, side, foes, mates, round(secs, 2)])
            for _ in range(max(0, thrown - len(pops))):     # flashes that caught nobody
                flashes.append([gi, n, side, 0, 0, 0])
            alive_me = True
            for i, f in enumerate(fs):
                a, v = f.get("killer"), f.get("victim")
                if i == 0 and v is not None:
                    row["first"] = "them" if v in us else "us"
                    row["op"] = "k" if a == me and v not in us else "d" if v == me else None
                ab = f.get("alive_before") or [None, None]
                after = [ab[0] - (v in us), ab[1] - (v not in us)] if None not in ab else None
                if v == me:
                    alive_me = False
                if (row["clutch"] is None and alive_me and after and after[0] == 1 and after[1] >= 1):
                    row["clutch"] = after[1]
                mine_k = a == me and v is not None and v not in us
                if not (mine_k or v == me):
                    continue
                row["k"] += mine_k
                ka, va = f.get("killer_at") or {}, f.get("victim_at") or {}
                at_me, at_them = (ka, va) if mine_k else (va, ka)
                # a kill of Ric's is a trade when that enemy had just killed a teammate
                trade = mine_k and any(p.get("killer") == v and p.get("victim") in us and p.get("victim") != me
                                       and 0 <= f["t"] - p["t"] <= TRADE_S for p in fs[:i])
                fights.append({
                    "g": gi, "n": n, "side": side, "t": f["t"], "kind": "k" if mine_k else "d",
                    "me": at_me.get("place"), "them": at_them.get("place"),
                    "mx": at_me.get("x"), "my": at_me.get("y"), "mz": at_me.get("z"),
                    "ox": at_them.get("x"), "oy": at_them.get("y"),
                    "w": f.get("weapon"), "hs": bool(f.get("headshot")), "wall": bool(f.get("wallbang")),
                    "smoke": bool(f.get("through_smoke")), "blind": bool(f.get("killer_blind")),
                    "ns": bool(f.get("noscope")), "air": bool(f.get("killer_in_air")),
                    "fa": bool(f.get("flash_assist")),
                    "dist": round(f["distance"] * UNITS_TO_M) if f.get("distance") is not None else None,
                    "ab": ab, "op": i == 0,
                    "tr": (f.get("traded_after") is not None) if not mine_k else trade,
                    "hp": f.get("killer_hp_after") if mine_k else None,
                    "team": a in us if not mine_k else None,
                })
            row["surv"] = alive_me
            rounds.append(row)
    return {"games": games, "rounds": rounds, "fights": fights,
            "hits": [[mp, sd, d, g, c] for (mp, sd, d, g), c in sorted(hits.items())],
            "nades": nades, "flashes": flashes}


def pct(a, b):
    return f"{100 * a / b:.0f}% ({a}/{b})" if b else "—"


def breakdown_md(S, map_name):
    """The same breakdown the page's Stats section shows, as Markdown."""
    rs, fs = S["rounds"], S["fights"]
    games = S["games"]
    if not rs:
        return ""
    L = ["## Breakdown (every game with a saved demo)", "",
         f"{len(games)} games, {len(rs)} rounds, {sum(f['kind'] == 'k' for f in fs)} kills and "
         f"{sum(f['kind'] == 'd' for f in fs)} deaths of Ric's, each with the callout both players stood at.", ""]
    rows = []
    for sd in ("CT", "T"):
        x = [r for r in rs if r["side"] == sd]
        rows.append((f"Rounds won as {sd}", pct(sum(r["w"] for r in x), len(x))))
    p = [r for r in rs if r["pistol"]]
    rows.append(("Pistol rounds won", pct(sum(r["w"] for r in p), len(p))))
    op = [r for r in rs if r["op"]]
    rows.append(("Opening duels won", pct(sum(r["op"] == "k" for r in op), len(op))))
    for who, lbl in (("us", "Rounds won after Ric's team got the first kill"), ("them", "Rounds won after the enemy got the first kill")):
        x = [r for r in rs if r["first"] == who]
        rows.append((lbl, pct(sum(r["w"] for r in x), len(x))))
    rows.append(("Rounds survived", pct(sum(r["surv"] for r in rs), len(rs))))
    d = [f for f in fs if f["kind"] == "d"]
    k = [f for f in fs if f["kind"] == "k"]
    rows.append(("Deaths that were traded", pct(sum(f["tr"] for f in d), len(d))))
    rows.append(("Kills that traded a teammate", pct(sum(f["tr"] for f in k), len(k))))
    for n in range(1, 6):
        c = [r for r in rs if r["clutch"] == n]
        if c:
            rows.append((f"1v{n} clutches won", pct(sum(r["w"] for r in c), len(c))))
    kinds = Counter(n[3] for n in S.get("nades") or [])
    fl = S.get("flashes") or []
    rows.append(("Grenades thrown", f"{kinds['smoke']} smokes, {kinds['flash']} flashes, {kinds['he']} HEs, {kinds['fire']} fires"))
    rows.append(("Enemies blinded per flash", f"{sum(f[3] for f in fl) / len(fl):.2f}" if fl else "—"))
    rows.append(("Teammates blinded by Ric's flashes", sum(f[4] for f in fl)))
    rows.append(("Grenade damage (HE / fire)", f"{sum(r['he'] for r in rs)} / {sum(r['fire'] for r in rs)}"))
    L += [_table(["Stat", "Value"], rows), ""]
    for mp in sorted({g["map"] for g in games}):
        gi = {i for i, g in enumerate(games) if g["map"] == mp}
        md, mk = [f for f in d if f["g"] in gi], [f for f in k if f["g"] in gi]
        places = Counter(f["me"] or "?" for f in md)
        kills_at = Counter(f["me"] or "?" for f in mk)
        allp = sorted(set(places) | set(kills_at), key=lambda p: (-places[p], -kills_at[p]))
        L += [f"### {map_name(mp)}: where Ric dies and kills", "",
              _table(["Callout (where Ric stood)", "Deaths", "% of deaths", "Kills", "% of kills", "K/D there"],
                     [(p, places[p], f"{100 * places[p] / len(md):.0f}%" if md else "—", kills_at[p],
                       f"{100 * kills_at[p] / len(mk):.0f}%" if mk else "—",
                       f"{kills_at[p] / places[p]:.2f}" if places[p] else "—") for p in allp]), ""]
    return "\n".join(L)


def _table(head, rows):
    out = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    out += ["| " + " | ".join(str(c).replace("|", "/") for c in r) + " |" for r in rows]
    return "\n".join(out)


def write(matches):
    S = build(matches)
    OUT.write_text("window.CS_STATS = " + json.dumps(S, separators=(",", ":")) + ";\n",
                   encoding="utf-8", newline="\n")
    return S


def main():
    data = csdata.load()
    S = write([m for m in data["matches"] if m.get("me") and m.get("score")])
    print(f"stats: {len(S['games'])} games, {len(S['rounds'])} rounds, {len(S['fights'])} fights")


if __name__ == "__main__":
    main()
