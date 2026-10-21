#!/usr/bin/env python3
"""The kills worth a banner: collaterals, one taps, no-scopes, wallbangs…

    python projects/cs/feats.py            # every feat in every saved demo, to read

stats.py runs this over each replay and writes what it finds into stats.js
(`feats`, and `featdefs` for the names), where the Overview's Banners and the
replay's kill feed read it. export-llm.py lists the same in llm/index.md.

Everything here is read off Valve's own demo events, nothing guessed:

  - the flags CS2 puts on every kill: headshot, penetrated (wallbang),
    through smoke, no-scope, attacker blind, attacker in the air;
  - the body part every bullet hit (player_hurt's hitgroup), so the killing
    bullet is known;
  - where both players stood (distance), Ric's health after, and every shot
    he fired, which is what tells one bullet from two.

Times in a replay are rounded to 0.1 s, and a rifle fires every 0.1 s, so two
kills at the same moment aren't automatically one bullet. A collateral is two
kills with the same gun at the same moment AND no more than one shot fired by
Ric in that moment (a shotgun's pellets are one shot, so a shotgun double
counts, as it does in game).

There is no groin hitbox in CS2: the game's hitgroups are head, neck, chest,
stomach, arms and legs, and the stomach group takes in the pelvis. So a nut
shot can't be told from any gut shot (53 of Ric's first 250 kills), and there
is no banner for it rather than one that calls every body shot a nut shot.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

LONG_M = 35          # a long shot: Ric's kills were 32 m or closer 95 times in 100 (250 kills, 2026-10-21)
UNITS_TO_M = 0.0254
QUICK_S = 1.0        # two kills inside a second
SLIVER_HP = 10
SNIPERS = {"awp", "ssg08", "scar20", "g3sg1"}
SHOTGUNS = {"nova", "xm1014", "mag7", "sawedoff"}
NADES = {"hegrenade", "inferno", "molotov", "incgrenade", "flashbang", "smokegrenade", "decoy", "world"}
KNIVES = ("knife", "bayonet")

# key, name, how it's earned — the one list; the page and the export read it
# from stats.js. Rarest-feeling first, which is the order the page shows.
FEATS = [
    ("ace", "Ace", "All five enemies in one round."),
    ("clutch", "Clutch", "Last one alive on his team against two or more, and won the round."),
    ("collat", "Collateral", "One bullet, two kills."),
    ("noscope", "No-scope", "A sniper kill without looking down the scope."),
    ("4k", "Quad", "Four kills in one round."),
    ("blind", "Blind fire", "A kill while he was flashed himself."),
    ("air", "Airborne", "A kill with both feet off the ground."),
    ("zeus", "Zapped", "A kill with the Zeus."),
    ("knife", "Knifed", "A kill with the knife."),
    ("smoke", "Through the smoke", "A kill shot through a smoke."),
    ("wallbang", "Wallbang", "A kill shot through something first: a wall, a door, a box, or another player."),
    ("nade", "Grenade", "A kill with an HE grenade."),
    ("fire", "Cooked", "A kill with a molotov or incendiary."),
    ("legs", "Kneecapped", "The killing bullet hit a leg."),
    ("sliver", "On a sliver", f"A kill with {SLIVER_HP} HP or less left."),
    ("long", "Long shot", f"A kill from {LONG_M} m or further."),
    ("3k", "Triple", "Three kills in one round."),
    ("quick", "Quick double", "Two kills inside a second (not one bullet)."),
    ("onetap", "One tap", "A full-health enemy killed by one headshot bullet (not a sniper or shotgun)."),
]
KEYS = [k for k, _, _ in FEATS]


def weapon_of(w):
    return (w or "").lower().replace("weapon_", "")


def of_round(R, r, me, us):
    """[(t, key, victim seat)] for one round: every feat of Ric's in it. A
    round's feat (a 3K, a clutch) goes on its last kill."""
    out = []
    fights = sorted((f for f in r.get("fights") or [] if f.get("t") is not None), key=lambda f: f["t"])
    damage = r.get("damage") or []
    shots = [s for s in r.get("shots") or [] if s[1] == me]
    mine = [f for f in fights if f.get("killer") == me and f.get("victim") is not None
            and f["victim"] != me and f["victim"] not in us]

    for f in mine:
        t, v, w = f["t"], f["victim"], weapon_of(f.get("weapon"))
        tags = set()
        if f.get("wallbang"):
            tags.add("wallbang")
        if f.get("through_smoke"):
            tags.add("smoke")
        if f.get("noscope"):
            tags.add("noscope")
        if f.get("killer_blind"):
            tags.add("blind")
        if f.get("killer_in_air"):
            tags.add("air")
        if w.startswith(KNIVES):
            tags.add("knife")
        elif w == "taser":
            tags.add("zeus")
        elif w == "hegrenade":
            tags.add("nade")
        elif w in ("inferno", "molotov", "incgrenade"):
            tags.add("fire")
        dist = f.get("distance")
        if dist is not None and dist * UNITS_TO_M >= LONG_M and w not in NADES:
            tags.add("long")
        hp = f.get("killer_hp_after")
        if hp is not None and 0 < hp <= SLIVER_HP:
            tags.add("sliver")
        # every bullet that hit the victim this round, up to the kill
        on_v = [d for d in damage if d[2] == v and d[0] is not None and d[0] <= t + 0.05]
        last = next((d for d in reversed(on_v) if d[1] == me), None)
        if last and w not in NADES:
            grp = (last[6] or "").lower()
            if "leg" in grp:
                tags.add("legs")
        if (f.get("headshot") and len(on_v) == 1 and on_v[0][1] == me
                and w not in SNIPERS and w not in SHOTGUNS and w not in NADES and not w.startswith(KNIVES)):
            tags.add("onetap")
        out += [(t, k, v) for k in tags]

    # two kills, one bullet
    used = set()
    for i, a in enumerate(mine):
        for b in mine[i + 1:]:
            if b["t"] - a["t"] > 0.1:
                break
            wa = weapon_of(a.get("weapon"))
            if wa != weapon_of(b.get("weapon")) or wa in NADES or wa.startswith(KNIVES) or wa == "taser":
                continue
            fired = sum(1 for s in shots if a["t"] - 0.15 <= s[0] <= b["t"] + 0.05)
            if fired <= 1:
                out.append((b["t"], "collat", b["victim"]))
                used |= {id(a), id(b)}
    # two kills inside a second, when they weren't one bullet
    for a, b in zip(mine, mine[1:]):
        if b["t"] - a["t"] <= QUICK_S and not (id(a) in used and id(b) in used):
            out.append((b["t"], "quick", b["victim"]))
            break                                   # once a round is plenty

    # the round: multi-kills and a clutch
    n = len(mine)
    if mine:
        tl, lv = mine[-1]["t"], mine[-1]["victim"]
        if n >= 5:
            out.append((tl, "ace", lv))
        elif n == 4:
            out.append((tl, "4k", lv))
        elif n == 3:
            out.append((tl, "3k", lv))
    alive_me, clutch = True, None
    for f in fights:
        if f.get("victim") == me:
            alive_me = False
        ab = f.get("alive_before")
        if not ab or None in ab or f.get("victim") is None:
            continue
        after = [ab[0] - (f["victim"] in us), ab[1] - (f["victim"] not in us)]
        if clutch is None and alive_me and after[0] == 1 and after[1] >= 1:
            clutch = (after[1], f["t"])
    if clutch and clutch[0] >= 2 and r.get("w") and alive_me:
        out.append((mine[-1]["t"], "clutch", mine[-1]["victim"]) if mine else (clutch[1], "clutch", None))
    return out


def of_match(R):
    """[[round index, t, key, victim seat]] — every feat of Ric's in a replay."""
    me = next((s["seat"] for s in R["seats"] if s.get("me")), 0)
    us = {s["seat"] for s in R["seats"] if s.get("us")}
    found = []
    for i, r in enumerate(R["rounds"]):
        found += [[i, t, k, v] for t, k, v in of_round(R, r, me, us)]
    return sorted(found, key=lambda x: (x[0], x[1], KEYS.index(x[2])))


def main():
    import csdata
    from stats import load_replay
    from collections import Counter
    data = csdata.load()
    total = Counter()
    for m in data["matches"]:
        R = m.get("replay") and load_replay(m["id"])
        if not R:
            continue
        fs = of_match(R)
        total.update(x[2] for x in fs)
        if fs:
            print(f"{m['id']} {R['map']}: " + ", ".join(f"R{i + 1} {t:.0f}s {k}" for i, t, k, _ in fs))
    print()
    for k, name, _ in FEATS:
        print(f"{name:20} {total[k]}")


if __name__ == "__main__":
    main()
