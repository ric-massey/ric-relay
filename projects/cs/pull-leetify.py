#!/usr/bin/env python3
"""Backfill the CS room from Leetify's public API.

Valve is the real source (see parse-demos.py), but Valve forgets a match after a
few weeks. Leetify parsed each demo while it still existed, so for any game whose
demo is gone, Leetify's numbers are the only record left. This pulls them in.

    python projects/cs/pull-leetify.py

No key needed for the public API. Every match it has ever seen stays in
cs-data.js, so running this regularly is what makes the archive permanent.
A match that already has a parsed demo keeps the demo's numbers; Leetify only
adds the fields a demo doesn't give (aim and utility ratings, reaction time…).
"""

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
import csdata  # noqa: E402

API = "https://api-public.cs-prod.leetify.com"
SIDE = {2: "T", 3: "CT"}


def get(path):
    req = urllib.request.Request(API + path, headers={
        "Accept": "application/json", "User-Agent": "ric-terminal-cs/1"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(5 * (attempt + 1))
                continue
            raise


def pct(x):
    """Leetify mixes 0-1 ratios and 0-100 percentages; the page wants 0-100."""
    return None if x is None else round(x * 100 if abs(x) <= 1 else x, 1)


def mine(row):
    r = lambda k: row.get(k)  # noqa: E731
    rounds = r("rounds_count") or 0
    return {
        "k": r("total_kills"), "d": r("total_deaths"), "a": r("total_assists"),
        "dmg": r("total_damage"), "adr": round(r("dpr"), 1) if r("dpr") is not None else None,
        "hsk": r("total_hs_kills"), "mvps": r("mvps"), "score": r("score"),
        "rating": r("leetify_rating"), "ct_rating": r("ct_leetify_rating"),
        "t_rating": r("t_leetify_rating"),
        "multi": [r(f"multi{i}k") or 0 for i in range(1, 6)],
        "survived": r("rounds_survived"),
        "aim": {
            "acc": pct(r("accuracy")), "acc_spotted": pct(r("accuracy_enemy_spotted")),
            "acc_head": pct(r("accuracy_head")), "spray": pct(r("spray_accuracy")),
            "preaim": r("preaim"),
            "reaction_ms": round(r("reaction_time") * 1000) if r("reaction_time") else None,
            "strafe": pct(r("counter_strafing_shots_good_ratio")),
            "shots": r("shots_fired"), "hits": r("shots_hit_foe"),
        },
        "util": {
            "smoke": r("smoke_thrown"), "flash": r("flashbang_thrown"),
            "he": r("he_thrown"), "molly": r("molotov_thrown"),
            "flash_foes": r("flashbang_hit_foe"), "flash_mates": r("flashbang_hit_friend"),
            "flash_assists": r("flash_assist"), "flash_kills": r("flashbang_leading_to_kill"),
            "blind_s": r("flashbang_hit_foe_avg_duration"),
            "he_foe_avg": r("he_foes_damage_avg"), "he_mate_avg": r("he_friends_damage_avg"),
            "unused_on_death": round(r("utility_on_death_avg") or 0),
        },
        "trades": {
            "chances": r("trade_kill_opportunities"), "tries": r("trade_kill_attempts"),
            "made": r("trade_kills_succeed"),
            "died_tradeable": r("traded_death_opportunities"),
            "avenged": r("traded_deaths_succeed"),
        },
        "rounds": rounds,
    }


def seat(row, my_team, me_id):
    """One scoreboard seat: the in-game name and the numbers. No Steam id."""
    return {
        "name": row.get("name"),
        "us": row.get("initial_team_number") == my_team,
        "me": str(row.get("steam64_id")) == me_id,
        "k": row.get("total_kills"), "d": row.get("total_deaths"),
        "a": row.get("total_assists"), "adr": round(row.get("dpr") or 0, 1),
        "hsk": row.get("total_hs_kills"), "mvps": row.get("mvps"),
        "score": row.get("score"), "rating": row.get("leetify_rating"),
    }


def main():
    acct = csdata.account()
    me_id = acct["steam64"]
    data = csdata.load()

    profile = get(f"/v3/profile?steam64_id={me_id}")
    data["leetify"] = {
        "read": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "total_matches": profile.get("total_matches"),
        "first_match": (profile.get("first_match_date") or "")[:10] or None,
        "winrate": profile.get("winrate"),
        "ranks": profile.get("ranks"),
        "rating": profile.get("rating"),
    }
    data["player"] = acct.get("display_name") or profile.get("name")

    rows = get(f"/v3/profile/matches?steam64_id={me_id}")
    added = updated = 0
    for row in rows:
        mine_row = next((s for s in row.get("stats", []) if str(s.get("steam64_id")) == me_id), None)
        if not mine_row:
            continue
        valve_id = csdata.share_code_match_id(row.get("data_source_match_id"))
        my_team = mine_row.get("initial_team_number")
        us = mine_row.get("rounds_won")
        them = mine_row.get("rounds_lost")
        if us is None or them is None:
            scores = {t["team_number"]: t["score"] for t in row.get("team_scores", [])}
            us, them = scores.get(my_team, 0), sum(v for k, v in scores.items() if k != my_team)

        probe = {"map": row.get("map_name"), "score": [us, them],
                 "me": {"k": mine_row.get("total_kills"), "d": mine_row.get("total_deaths")}}
        m = csdata.find(data, valve_id=valve_id, leetify_id=row["id"],
                        fingerprint=csdata.fingerprint_of(probe))
        fresh = m is None
        if fresh:
            m = {"id": valve_id or f"lt-{csdata.leetify_key(row['id'])}", "sources": []}
            data["matches"].append(m)
        # Never the id itself (see csdata.leetify_key).
        m["leetify_key"] = csdata.leetify_key(row["id"])
        m.pop("leetify_id", None)
        if valve_id:
            m["valve_id"] = valve_id
        if "leetify" not in m["sources"]:
            m["sources"].append("leetify")

        has_demo = "demo" in m["sources"]
        m.setdefault("at", row.get("finished_at"))
        m["mode"] = row.get("data_source")
        m["map"] = m.get("map") or row.get("map_name")
        m["start_side"] = m.get("start_side") or SIDE.get(my_team)
        stats = mine(mine_row)
        if has_demo:
            # The demo's own count wins for anything both have; Leetify fills in
            # what only it measures.
            for key, value in stats.items():
                m["me"].setdefault(key, value)
            m["me"]["aim"] = stats["aim"]
            m["me"]["util"] = {**stats["util"], **m["me"].get("util", {})}
            m["me"]["trades"] = stats["trades"]
            for key in ("rating", "ct_rating", "t_rating"):
                m["me"][key] = stats[key]
        else:
            m["score"] = [us, them]
            m["result"] = csdata.result(us, them)
            m["me"] = stats

        # Boards saved before names were kept are fetched again, once.
        if not m.get("board") or ("demo" not in m["sources"]
                                  and any("name" not in s for s in m["board"])):
            try:
                full = get(f"/v2/matches/{row['id']}")
                m["board"] = [seat(s, my_team, me_id) for s in full.get("stats", [])]
                m["banned"] = bool(full.get("has_banned_player"))
                time.sleep(0.7)
            except urllib.error.HTTPError as e:
                print(f"  scoreboard for {row['id']} unavailable ({e.code})")
        added += fresh
        updated += not fresh

    # The newest share code is where Steam's own match list (steam.py) starts
    # walking from. It lives in local state, not the published file: a share
    # code is enough to download the demo, names and all.
    codes = [r.get("data_source_match_id") for r in rows
             if (r.get("data_source_match_id") or "").startswith("CSGO-")]
    if codes:
        st = csdata.read_state()
        st.setdefault("last_code", codes[0])
        for c in codes:
            st.setdefault("codes", {})[csdata.share_code_match_id(c)] = c
        csdata.write_state(st)
    data["leetify"]["listed"] = len(rows)
    csdata.save(data)
    print(f"leetify: {len(rows)} listed, {added} new, {updated} refreshed — "
          f"{len(data['matches'])} matches in the archive")


if __name__ == "__main__":
    main()
