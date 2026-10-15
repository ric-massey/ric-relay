#!/usr/bin/env python3
"""A match told in a few lines: the round that decided it, the comeback, the
clutch, the great escape and the player of the match — each one a round to
watch.

    python projects/cs/story.py [match id]     # print the stories, to read

Built from what the replay already knows: the score round by round, the
win-chance model (winprob.py) and every player's round scores (highlight.py).

  decided   the round after which the winner led for good (in a draw, the
            round that tied it)
  comeback  the winner was COMEBACK rounds or more behind at some point
  clutch    the match's best clutch won, by round score
  escape    the round won from the lowest chance the winning team had in it,
            when that was ESCAPE or under — unless it's the clutch's round
  star      player of the match: the most round score over the whole game

Each line is [kind, text, round (1-based), seconds to start watching].
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import highlight  # noqa: E402
import winprob  # noqa: E402

COMEBACK = 3
ESCAPE = 0.2


def tell(coef, R, m):
    rounds = R["rounds"]
    if not rounds:
        return []
    names = {s["seat"]: ("Ric" if s.get("me") else s.get("name") or "a player") for s in R["seats"]}
    us = winprob.us_of(R)
    team = lambda ours: "Ric's team" if ours else "the other team"   # noqa: E731
    out = []
    # the score after each round, from Ric's side
    sc, a, b = [], 0, 0
    for r in rounds:
        a, b = (a + 1, b) if r.get("w") else (a, b + 1)
        sc.append((a, b))
    fa, fb = sc[-1]
    # every player's score in every round, once
    scores = {}
    for i, r in enumerate(rounds):
        for s in R["seats"]:
            v, f = highlight.round_score(coef, R, r, s["seat"])
            if v is not None:
                scores[(i, s["seat"])] = (v, f)

    def best_in(i):
        top = max(((v, seat, f) for (j, seat), (v, f) in scores.items() if j == i), default=None, key=lambda x: x[0])
        return top

    def at(f):
        return round(max(0, (f.get("t") or 5) - 5), 1) if f else 0

    if fa != fb:
        ours = fa > fb
        lead_from = next(i for i in range(len(sc)) if all((x > y) == ours and x != y for x, y in sc[i:]))
        x, y = sc[lead_from]
        top = best_in(lead_from)
        who = f" {names[top[1]]}: {highlight.label(top[2])}." if top and top[0] > 0.3 else ""
        text = (f"{team(ours).capitalize()} led from the first round to the last.{who}" if lead_from == 0
                else f"Round {lead_from + 1} put {team(ours)} ahead for good, {max(x, y)}–{min(x, y)}.{who}")
        out.append(["decided", text, lead_from + 1, at(top[2]) if top else 0])
        # the comeback: the most the winner was ever behind
        deficit, at_i = 0, None
        for i, (x, y) in enumerate(sc):
            d = (y - x) if ours else (x - y)
            if d > deficit:
                deficit, at_i = d, i
        if deficit >= COMEBACK:
            x, y = sc[at_i]
            w_, l_ = (x, y) if ours else (y, x)
            out.append(["comeback", f"{team(ours).capitalize()} came back from {w_}–{l_} down.", at_i + 2 if at_i + 1 < len(rounds) else at_i + 1, 0])
    else:
        out.append(["decided", f"Round {len(rounds)} tied it {fa}–{fb}.", len(rounds), 0])
    # the best clutch won
    cl = max(((v, i, seat, f) for (i, seat), (v, f) in scores.items() if f["clutch"]), default=None, key=lambda x: x[0])
    if cl:
        v, i, seat, f = cl
        out.append(["clutch", f"{names[seat]} won a 1v{f['clutch']} in round {i + 1}.", i + 1, at(f)])
    # the great escape: the round won from the lowest chance
    esc = None
    for i, r in enumerate(rounds):
        tl = winprob.timeline(coef, R, r)
        won_ours = bool(r.get("w"))
        low = min((p if won_ours else 1 - p) for _t, p in tl)
        if low <= ESCAPE and (esc is None or low < esc[0]) and not (cl and cl[1] == i):
            esc = (low, i, won_ours)
    if esc:
        low, i, won_ours = esc
        # who pulled it off: the winning side's best round score in it
        top = max(((v, seat, f) for (j, seat), (v, f) in scores.items() if j == i and (seat in us) == won_ours),
                  default=None, key=lambda x: x[0])
        who = f" {names[top[1]]}: {highlight.label(top[2])}." if top and top[0] > 0.3 else ""
        out.append(["escape", f"{team(won_ours).capitalize()} won round {i + 1} from a {round(low * 100)}% chance.{who}", i + 1, at(top[2]) if top else 0])
    # player of the match
    tot = {}
    for (i, seat), (v, f) in scores.items():
        tot[seat] = tot.get(seat, 0) + v
    if tot:
        seat = max(tot, key=tot.get)
        bi = max((i for (i, s_) in scores if s_ == seat), key=lambda i: scores[(i, seat)][0])
        b = next((x for x in m.get("board") or [] if (x.get("me") and names[seat] == "Ric") or x.get("name") == names[seat]), None)
        line = f", {b['k']}-{b['d']}-{b['a']} and {round(b.get('adr') or 0)} ADR" if b else ""
        out.append(["star", f"Player of the match: {names[seat]}{line}.", bi + 1, at(scores[(bi, seat)][1])])
    return out


def main():
    import csdata
    import json
    import stats
    st = (csdata.HERE / "stats.js").read_text(encoding="utf-8")
    coef = json.loads(st[st.index("{"):st.rindex("}") + 1])["wp"]["coef"]
    want = sys.argv[1] if len(sys.argv) > 1 else None
    for m in csdata.load()["matches"]:
        if want and m["id"] != want:
            continue
        R = stats.load_replay(m["id"]) if m.get("replay") else None
        if not R:
            continue
        print(f"\n{m['map']} {m['score'][0]}:{m['score'][1]}")
        for kind, text, rnd, t in tell(coef, R, m):
            print(f"  [{kind}] {text}  (round {rnd} @ {t}s)")


if __name__ == "__main__":
    main()
