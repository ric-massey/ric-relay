#!/usr/bin/env python3
"""How impressive a player's round was — what picks their best round to watch,
and their best game.

    python projects/cs/highlight.py            # every player's top rounds, to read

Kill count alone picks badly: two kills in a round you then die in and your
team loses look the same as two kills that win a 1v1 on an eco. What makes a
round worth watching is what the player did to it, so the score is built on
the win-chance model (winprob.py):

  impact    what their kills did to their team's chance of the round, summed
            (a kill from 37% to 60% is +0.23). This is most of the score.
  death     their own death takes back half of what it cost the team: dying
            shouldn't erase a 3K, but surviving one is better.
  clutch    last alive on their team against N, and the team won: +0.25 per
            enemy they faced. A 1v1 is +0.25, a 1v3 +0.75.
  kills     +0.06 a kill, and +0.05 for each kill within 4 s of the one
            before: a fast double reads as more than two slow ones.
  aim       +0.02 a headshot.
  eco       +0.04 a kill when they'd bought under $2,000 against a team that
            averaged $3,500 or more (not a pistol round, where nobody has).
  won       +0.10 when their team won the round.

Picked on Yallzbalz's Vertigo game, 2026-10-15: kills alone chose round 7 (2
kills, then he died and a teammate won it); he said round 11 was better (a
kill from 37% to 60% on an eco MAC-10, then winning a 1v1 with the last
kill). Kill count chose 7; this scores 11 at 1.23 and 7 at 0.42, fifth of
his rounds that game. Across all 3,446 player-rounds the top are aces and 4Ks
that won 1v3s and 1v4s.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import winprob  # noqa: E402

ECO = 2000
FOES_BOUGHT = 3500
BURST_S = 4


def round_score(coef, R, r, seat):
    """(score, facts) for one player in one round, or (None, None) if they
    weren't in it. facts says why, for a label."""
    us = winprob.us_of(R)
    mine = seat in us                        # on Ric's team?
    if str(seat) not in (r.get("tracks") or {}) and seat not in (r.get("tracks") or {}):
        return None, None
    pt, e = winprob.plant_time(r), winprob.econ_diff(r, us)
    side = r.get("side")

    def team_odds(o, th, t):                 # the player's own team's chance
        p = winprob.chance(coef, o, th, pt is not None and pt <= t, side, e)
        return p if mine else 1 - p
    # what happens after the round is decided isn't the round: the bomb going
    # off on a T who just won the 1v1 isn't a death that cost anything
    end = r.get("dur", 1e9) + 0.5
    fs = [f for f in r.get("fights") or [] if f.get("t") is not None and f["t"] <= end]
    won = bool(r.get("w")) if mine else not r.get("w")
    impact, death, kills, hs, burst, last_k, clutch, first_t = 0.0, 0.0, 0, 0, 0, None, 0, None
    key_t, key_d = None, -9.0              # their biggest kill: the moment a preview shows
    alone = None                              # enemies alive when they became last alive
    for f in fs:
        ab, a, v = f.get("alive_before"), f.get("killer"), f.get("victim")
        if not ab or None in ab or v is None:
            continue
        after = [ab[0] - (v in us), ab[1] - (v not in us)]
        d = team_odds(*after, f["t"]) - team_odds(*ab, f["t"])
        if a == seat and (v in us) != mine:   # a kill of theirs, of an enemy
            impact += d
            kills += 1
            hs += bool(f.get("headshot"))
            if last_k is not None and f["t"] - last_k <= BURST_S:
                burst += 1
            last_k = f["t"]
            first_t = f["t"] if first_t is None else first_t
            if d > key_d:
                key_t, key_d = f["t"], d
        elif v == seat:
            death += -d                       # what dying cost the team
        mates_left, foes_left = (after[0], after[1]) if mine else (after[1], after[0])
        if alone is None and mates_left == 1 and foes_left >= 1 and v != seat:
            # they're the one left if they haven't died yet
            if not any(g.get("victim") == seat and g["t"] <= f["t"] for g in fs):
                alone = foes_left
    if alone and won and not any(g.get("victim") == seat for g in fs):
        clutch = alone
    econ = r.get("economy") or {}
    buy = (econ.get(str(seat)) or {}).get("equip")
    # an eco is little money against a team that bought: a pistol round,
    # where nobody has anything, isn't one
    foes = [(e or {}).get("equip") or 0 for s_, e in econ.items() if (int(s_) in us) != mine]
    eco = buy is not None and buy < ECO and bool(foes) and sum(foes) / len(foes) >= FOES_BOUGHT
    score = (impact - 0.5 * death + 0.25 * clutch + 0.06 * kills + 0.05 * burst
             + 0.02 * hs + (0.04 * kills if eco else 0) + (0.10 if won else 0))
    return round(score, 3), {"k": kills, "hs": hs, "clutch": clutch, "impact": round(impact, 3),
                             "died": death > 0, "won": won, "eco": eco and kills > 0, "t": first_t, "key_t": key_t}


def label(f):
    """A few words on why the round was good."""
    bits = []
    if f["clutch"]:
        bits.append(f"won a 1v{f['clutch']}")
    if f["k"]:
        bits.append(f"{f['k']} kill{'s' if f['k'] != 1 else ''}" + (f", {f['hs']} HS" if f["hs"] else ""))
    if f["eco"]:
        bits.append("on an eco")
    if f["impact"]:
        # points, not %: swings in a round that goes back and forth can sum past 100
        bits.append(f"{'+' if f['impact'] >= 0 else '−'}{abs(round(f['impact'] * 100))} pts win chance")
    return " · ".join(bits)


def best_rounds(coef, R):
    """{seat: (round index, score, facts, game total)} — each player's best
    round of a game, and the sum of all their rounds' scores in it. The total
    is what ranks their games: a game is better for having many good rounds,
    not one (Yallzbalz's 18-kill Vertigo win totals 4.71 to the 3.39 of an
    11-16 Mirage loss, though that loss holds his single best round)."""
    out, total = {}, {}
    for i, r in enumerate(R["rounds"]):
        for s in R["seats"]:
            sc, f = round_score(coef, R, r, s["seat"])
            if sc is None:
                continue
            total[s["seat"]] = total.get(s["seat"], 0) + sc
            if s["seat"] not in out or sc > out[s["seat"]][1]:
                out[s["seat"]] = (i, sc, f)
    return {k: v + (round(total[k], 3),) for k, v in out.items()}


def main():
    import json
    import csdata
    import stats
    st = (csdata.HERE / "stats.js").read_text(encoding="utf-8")
    coef = json.loads(st[st.index("{"):st.rindex("}") + 1])["wp"]["coef"]
    data = csdata.load()
    who = sys.argv[1] if len(sys.argv) > 1 else None
    for m in data["matches"]:
        R = stats.load_replay(m["id"]) if m.get("replay") else None
        if not R:
            continue
        names = {s["seat"]: s.get("name") or "?" for s in R["seats"]}
        for seat, (i, sc, f, _tot) in best_rounds(coef, R).items():
            if who and names[seat] != who:
                continue
            print(f"{names[seat]:>20}  {m['map']:<11} round {i + 1:>2}  {sc:5.2f}  {label(f)}")


if __name__ == "__main__":
    main()
