#!/usr/bin/env python3
"""Parse CS2 match demos — Valve's own recording of a game — into the CS room.

    projects/cs/.cs-venv/Scripts/python projects/cs/parse-demos.py [demo.dem …]

With no arguments it looks in CS2's replays folder and in projects/cs/demos/
for any .dem (or .dem.bz2) it hasn't parsed yet. Each new demo is first COPIED
into `keep_demos_in` — Valve deletes its copy after a few weeks, ours stays —
then parsed into:

  * the match's row in cs-data.js: Ric's full line, every round won and lost,
    kills by weapon, opening duels, KAST, and an anonymous scoreboard;
  * matches/<id>.js: everything else, round by round — every player's position
    twice a second, every fight in full (where both stood, by callout and by
    coordinate, the damage they traded, shots, wallbangs, smokes, flashes, who
    was alive, a snapshot of all ten players at that instant), the complete
    damage log, every shot fired, every flash, the bomb, and everyone's money
    and loadout. export-llm.py turns the same file into plain text.

Players appear under their in-game names; no Steam id leaves this script.
Positions are map coordinates inside the game, not places in the world.
"""

import bz2
import json
import re
import shutil
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import csdata  # noqa: E402

TICKRATE = 64
HZ = 2                       # replay samples per second; ~400 KB a match at 2
TRADE_WINDOW_S = 5           # a death avenged inside this counts as traded
NADES = {
    "smokegrenade_detonate": "smoke", "flashbang_detonate": "flash",
    "hegrenade_detonate": "he", "inferno_startburn": "fire",
    "decoy_started": "decoy",
}


def radar_split(mapname):
    """z below which CS2 draws the lower radar (Nuke, Train, Vertigo)."""
    try:
        t = (csdata.HERE / "radar" / "radar.js").read_text(encoding="utf-8")
        cal = json.loads(t[t.index("CS_RADAR =") + len("CS_RADAR ="):].strip().rstrip(";"))
        return (cal.get(mapname) or {}).get("split")
    except (FileNotFoundError, ValueError):
        return None


def demo_dirs(acct):
    dirs = []
    cs2 = acct.get("cs2_dir")
    if cs2:
        dirs += [Path(cs2) / "game" / "csgo" / "replays", Path(cs2) / "game" / "csgo"]
    dirs.append(csdata.HERE / acct.get("demo_inbox", "demos"))
    return [d for d in dirs if d.is_dir()]


def keep_dir(acct):
    d = Path(acct.get("keep_demos_in", "demos/archive"))
    d = d if d.is_absolute() else csdata.HERE / d
    d.mkdir(parents=True, exist_ok=True)
    return d


def find_new(acct, done):
    keep = keep_dir(acct)
    found = []
    for d in demo_dirs(acct) + [keep]:
        for p in sorted(d.glob("*.dem")) + sorted(d.glob("*.dem.bz2")):
            key = p.name.removesuffix(".bz2")
            if key not in done and key not in {f.name.removesuffix(".bz2") for f in found}:
                found.append(p)
    return found


def archive(path, acct):
    """Keep our own copy before Valve's goes. CS2's replays folder is copied,
    never moved (its Watch tab lists what's in there); anything in our own
    inbox is moved, so a demo is never on disk twice."""
    keep = keep_dir(acct)
    target = keep / path.name
    if path.parent.resolve() == keep.resolve():
        return path
    inbox = (csdata.HERE / acct.get("demo_inbox", "demos")).resolve()
    if target.exists():
        if path.parent.resolve() == inbox:
            path.unlink()
    elif path.parent.resolve() == inbox:
        shutil.move(str(path), target)
    else:
        shutil.copy2(path, target)
    return target


def open_demo(path):
    if path.suffix != ".bz2":
        return path, None
    tmp = tempfile.NamedTemporaryFile(suffix=".dem", delete=False)
    with bz2.open(path) as src, tmp:
        shutil.copyfileobj(src, tmp)
    return Path(tmp.name), tmp.name


def side(team):
    try:
        team = int(team)
    except (TypeError, ValueError):
        return {"t": "T", "ct": "CT", "terrorist": "T"}.get(str(team).lower())
    return {2: "T", 3: "CT"}.get(team)


def rows(df):
    return [] if df is None or len(df) == 0 else df.to_dict("records")


def sid(v):
    try:
        return str(int(v)) if v is not None and v == v else None
    except (TypeError, ValueError):
        return None


def parse(path, me):
    from demoparser2 import DemoParser  # in .cs-venv; only this script needs it

    p = DemoParser(str(path))
    header = p.parse_header()
    mapname = header.get("map_name")

    def ev(name, **kw):
        try:
            return rows(p.parse_event(name, **kw))
        except Exception:  # an event the demo never fired
            return []

    # ── where the match itself starts: warmup rounds are not rounds ──
    live_from = 0
    for name in ("round_announce_match_start", "begin_new_match"):
        ticks = [r["tick"] for r in ev(name)]
        if ticks:
            live_from = max(live_from, max(ticks))
    ends = sorted((r for r in ev("round_end") if r["tick"] > live_from), key=lambda r: r["tick"])
    starts = sorted(r["tick"] for r in ev("round_freeze_end") if r["tick"] > live_from)
    if not ends:
        raise ValueError("no rounds after warmup")

    rounds = []
    prev_end = live_from
    for e in ends:
        st = [t for t in starts if prev_end <= t < e["tick"]]
        rounds.append({"start": st[-1] if st else prev_end, "end": e["tick"],
                       "winner": side(e.get("winner")), "reason": e.get("reason")})
        prev_end = e["tick"]

    # ── who sat where: team of every player at each round's start ──
    teams = p.parse_ticks(["team_num"], ticks=[r["start"] for r in rounds])
    team_at = defaultdict(dict)       # tick -> steamid -> side
    for r in rows(teams):
        s = sid(r.get("steamid"))
        if s and side(r.get("team_num")):
            team_at[r["tick"]][s] = side(r["team_num"])
    my_side = [team_at[r["start"]].get(me) for r in rounds]
    if not any(my_side):
        raise ValueError("Ric is not in this demo")

    # Seats: Ric's team first (Ric seat 0), then the other side, in a fixed order
    # so seat N means the same player in every round of the replay.
    first = next(i for i, s in enumerate(my_side) if s)
    lineup = team_at[rounds[first]["start"]]
    mates = sorted(s for s, t in lineup.items() if t == my_side[first] and s != me)
    foes = sorted(s for s, t in lineup.items() if t != my_side[first])
    seat_of = {me: 0}
    for s in mates + foes:
        seat_of[s] = len(seat_of)
    for tick in team_at.values():      # anyone who joined late (reconnects, subs)
        for s in sorted(tick):
            seat_of.setdefault(s, len(seat_of))
    us_ids = {me, *mates}
    for i, r in enumerate(rounds):       # a late joiner sits with whoever
        for s, t in team_at[r["start"]].items():   # shares Ric's side that round
            if s not in us_ids and s not in foes and my_side[i] and t == my_side[i]:
                us_ids.add(s)

    names = {}
    try:
        for r in rows(p.parse_player_info()):
            if sid(r.get("steamid")) and r.get("name"):
                names[sid(r["steamid"])] = r["name"]
    except Exception:
        pass

    def round_of(tick):
        for i, r in enumerate(rounds):
            if r["start"] - 30 * TICKRATE <= tick <= r["end"] + 6 * TICKRATE:
                return i
        return None

    # ── kills, damage, MVPs, grenades, bomb ──
    # last_place_name is the callout ("BombsiteA", "Palace"); if a demo build
    # doesn't carry it, fall back to plain coordinates rather than losing kills.
    deaths = (ev("player_death", player=["X", "Y", "Z", "last_place_name"])
              or ev("player_death", player=["X", "Y", "Z"]))
    hurts = ev("player_hurt")
    mvps = Counter(sid(r.get("user_steamid")) for r in ev("round_mvp") if r["tick"] > live_from)

    per = defaultdict(lambda: Counter())
    weapons = Counter()
    dmg_into = defaultdict(int)        # (round, attacker, victim) -> capped damage
    kills_by_round = defaultdict(list)
    for d in deaths:
        ri = round_of(d["tick"])
        if ri is None:
            continue
        a, v, h = sid(d.get("attacker_steamid")), sid(d.get("user_steamid")), sid(d.get("assister_steamid"))
        if v:
            per[v]["d"] += 1
        if a and a != v:
            teamkill = (a in us_ids) == (v in us_ids)
            if not teamkill:
                per[a]["k"] += 1
                per[a]["hsk"] += bool(d.get("headshot"))
                if a == me:
                    weapons[d.get("weapon") or "?"] += 1
        if h and h != a:
            per[h]["a"] += 1
        kills_by_round[ri].append(d)
    for h in hurts:
        ri = round_of(h["tick"])
        a, v = sid(h.get("attacker_steamid")), sid(h.get("user_steamid"))
        if ri is None or not a or a == v or (a in us_ids) == (v in us_ids):
            continue
        key = (ri, a, v)
        dmg_into[key] = min(100, dmg_into[key] + _n(h.get("dmg_health")))
    for (ri, a, v), n in dmg_into.items():
        per[a]["dmg"] += n

    ends = {}
    for name in ("smokegrenade_expired", "inferno_expire"):
        for r in ev(name):
            if r.get("entityid") is not None:
                ends[(name, int(r["entityid"]))] = r["tick"]
    nade_rows = []
    for name, kind in NADES.items():
        for r in ev(name):
            end = None
            if r.get("entityid") is not None:
                end = ends.get(({"smoke": "smokegrenade_expired", "fire": "inferno_expire"}.get(kind), int(r["entityid"])))
            nade_rows.append((r["tick"], kind, sid(r.get("user_steamid")), r.get("x"), r.get("y"), end))
    plants = (ev("bomb_planted", player=["X", "Y", "last_place_name"])
              or ev("bomb_planted", player=["X", "Y"]))
    defuses = ev("bomb_defused")
    explodes = ev("bomb_exploded")
    shots = ev("weapon_fire")
    blinds = ev("player_blind")

    # ── Ric's round by round ──
    n_rounds = len(rounds)
    strip, opening, kast, multi = [], Counter(), 0, [0] * 5
    score = [0, 0]
    for i, r in enumerate(rounds):
        mine_side = my_side[i]
        won = r["winner"] == mine_side if mine_side else None
        if won is not None:
            score[0 if won else 1] += 1
        ks = sorted(kills_by_round[i], key=lambda d: d["tick"])
        my_k = sum(1 for d in ks if sid(d.get("attacker_steamid")) == me
                   and sid(d.get("user_steamid")) not in us_ids)
        died = next((d for d in ks if sid(d.get("user_steamid")) == me), None)
        assisted = any(sid(d.get("assister_steamid")) == me for d in ks)
        traded = False
        if died:
            killer = sid(died.get("attacker_steamid"))
            traded = any(sid(d.get("user_steamid")) == killer and
                         0 <= d["tick"] - died["tick"] <= TRADE_WINDOW_S * TICKRATE for d in ks)
        if my_k or assisted or not died or traded:
            kast += 1
        if 1 <= my_k <= 5:
            multi[my_k - 1] += 1
        if ks:
            o = ks[0]
            if sid(o.get("attacker_steamid")) == me:
                opening["won"] += 1
            elif sid(o.get("user_steamid")) == me:
                opening["lost"] += 1
        strip.append({"w": bool(won), "side": mine_side, "k": my_k, "dead": bool(died),
                      "why": str(r["reason"]) if r["reason"] is not None else None})

    def line(s):
        c = per[s]
        return {"k": c["k"], "d": c["d"], "a": c["a"], "hsk": c["hsk"], "dmg": c["dmg"],
                "adr": round(c["dmg"] / n_rounds, 1), "mvps": mvps.get(s, 0)}

    board = []
    for s in sorted(seat_of, key=seat_of.get):
        if not any(s in t for t in team_at.values()):
            continue
        board.append({"name": names.get(s), "us": s in us_ids, "me": s == me,
                      "seat": seat_of[s], **line(s)})

    summary = {
        "map": mapname,
        "score": score,
        "result": csdata.result(*score),
        "start_side": my_side[first],
        "me": {**line(me), "rounds": n_rounds, "multi": multi,
               "kast": round(100 * kast / n_rounds, 1),
               "opening": {"won": opening["won"], "lost": opening["lost"]},
               "weapons": dict(weapons.most_common())},
        "rounds": strip,
        "board": board,
    }

    # ── the replay ──
    step = TICKRATE // HZ
    sample = []
    for r in rounds:
        sample += list(range(r["start"], r["end"] + 1, step))
    split = radar_split(mapname)
    stride = 3 if split is not None else 2
    pos = defaultdict(dict)            # tick -> seat -> (x, y[, z])
    for r in rows(p.parse_ticks(["X", "Y", "Z", "is_alive"], ticks=sample)):
        s = sid(r.get("steamid"))
        if s in seat_of and r.get("is_alive"):
            xy = (round(r["X"]), round(r["Y"]))
            pos[r["tick"]][seat_of[s]] = xy + ((round(r["Z"]),) if stride == 3 else ())

    # Everyone, at the instant of every kill: where they stood and how much HP
    # they had. This is what makes a fight readable without watching it.
    kill_ticks = sorted({d["tick"] for d in deaths if round_of(d["tick"]) is not None})
    snap = defaultdict(dict)           # tick -> seat -> {x, y, z, place, hp}
    for props in (["X", "Y", "Z", "health", "is_alive", "last_place_name", "yaw",
                   "active_weapon_name", "armor_value"],
                  ["X", "Y", "Z", "health", "is_alive", "last_place_name"],
                  ["X", "Y", "Z", "health", "is_alive"]):
        try:
            got = rows(p.parse_ticks(props, ticks=kill_ticks)) if kill_ticks else []
        except Exception:
            continue
        for r in got:
            s_ = sid(r.get("steamid"))
            if s_ in seat_of:
                snap[r["tick"]][seat_of[s_]] = {
                    "x": _i(r.get("X")), "y": _i(r.get("Y")), "z": _i(r.get("Z")),
                    "place": _place(r.get("last_place_name")),
                    "hp": _n(r.get("health")), "alive": bool(r.get("is_alive")),
                    "yaw": _i(r.get("yaw")), "weapon": _w(r.get("active_weapon_name")),
                    "armor": _i(r.get("armor_value"))}
        break

    # Money and loadout: read 20 s into the round, when the buy is done.
    econ = defaultdict(dict)           # round -> seat -> {...}
    buy_ticks = {min(r["start"] + 20 * TICKRATE, r["end"]): i for i, r in enumerate(rounds)}
    for props in (["balance", "current_equip_value", "armor_value", "has_helmet",
                   "has_defuser", "inventory"],
                  ["balance", "current_equip_value"]):
        try:
            got = rows(p.parse_ticks(props, ticks=list(buy_ticks)))
        except Exception:
            continue
        for r in got:
            s_ = sid(r.get("steamid"))
            if s_ in seat_of and r["tick"] in buy_ticks:
                inv = r.get("inventory")
                econ[buy_ticks[r["tick"]]][seat_of[s_]] = {
                    "money": _i(r.get("balance")), "equip": _i(r.get("current_equip_value")),
                    "armor": _i(r.get("armor_value")), "helmet": _b(r.get("has_helmet")),
                    "kit": _b(r.get("has_defuser")),
                    "items": [str(x) for x in inv] if inv is not None and not isinstance(inv, str) else None}
        break

    us_seats = {seat_of[s] for s in us_ids if s in seat_of}

    replay_rounds = []
    for i, r in enumerate(rounds):
        ticks = list(range(r["start"], r["end"] + 1, step))
        t0 = r["start"]
        sec = lambda t: round((t - t0) / TICKRATE, 1)  # noqa: E731
        tracks = {}
        for seat in sorted(set(seat_of.values())):
            flat, alive = [], False
            for t in ticks:
                xy = pos[t].get(seat)
                if xy:
                    alive = True
                    flat += xy
                else:
                    flat += [None] * stride
            if alive:
                tracks[seat] = flat
        kills = [[sec(d["tick"]), seat_of.get(sid(d.get("attacker_steamid"))),
                  seat_of.get(sid(d.get("user_steamid"))), d.get("weapon"), bool(d.get("headshot")),
                  _i(d.get("attacker_X")), _i(d.get("attacker_Y")),
                  _i(d.get("user_X")), _i(d.get("user_Y"))]
                 for d in sorted(kills_by_round[i], key=lambda d: d["tick"])]
        nades = [[sec(t), seat_of.get(s), kind, _i(x), _i(y), sec(e) if e else None]
                 for t, kind, s, x, y, e in sorted(nade_rows, key=lambda n: n[0])
                 if t0 - 5 * TICKRATE <= t <= r["end"]]
        plant = next(([sec(b["tick"]), _i(b.get("user_X")), _i(b.get("user_Y"))]
                      for b in plants if t0 <= b["tick"] <= r["end"]), None)

        def inr(e, t0=t0, end=r["end"]):
            return t0 - 30 * TICKRATE <= e["tick"] <= end + 6 * TICKRATE

        def seat(v):
            return seat_of.get(sid(v))

        damage = [[sec(h["tick"]), seat(h.get("attacker_steamid")), seat(h.get("user_steamid")),
                   h.get("weapon"), _n(h.get("dmg_health")), _n(h.get("dmg_armor")),
                   _hit(h.get("hitgroup")), _i(h.get("health"))]
                  for h in sorted(hurts, key=lambda h: h["tick"]) if inr(h)]
        fired = [[sec(f["tick"]), seat(f.get("user_steamid")), f.get("weapon")]
                 for f in sorted(shots, key=lambda f: f["tick"]) if inr(f)]
        flashed = [[sec(b["tick"]), seat(b.get("attacker_steamid")), seat(b.get("user_steamid")),
                    round(float(b.get("blind_duration") or 0), 2)]
                   for b in blinds if inr(b) and (b.get("blind_duration") or 0) > 0.1]

        # every fight, in full
        lineup_now = team_at[r["start"]]
        alive = {"us": sum(1 for s_ in lineup_now if s_ in us_ids),
                 "them": sum(1 for s_ in lineup_now if s_ not in us_ids)}
        fights = []
        ks = sorted(kills_by_round[i], key=lambda d: d["tick"])
        for n, d in enumerate(ks):
            a, v = seat(d.get("attacker_steamid")), seat(d.get("user_steamid"))
            t = sec(d["tick"])
            before = [alive["us"], alive["them"]]
            if v is not None:
                alive["us" if v in us_seats else "them"] -= 1
            kx, ky, kz = _i(d.get("attacker_X")), _i(d.get("attacker_Y")), _i(d.get("attacker_Z"))
            vx, vy, vz = _i(d.get("user_X")), _i(d.get("user_Y")), _i(d.get("user_Z"))
            dist = (round(((kx - vx) ** 2 + (ky - vy) ** 2 + ((kz or 0) - (vz or 0)) ** 2) ** .5)
                    if None not in (kx, ky, vx, vy) else None)
            exchange = [x for x in damage if t - 10 <= x[0] <= t and {x[1], x[2]} == {a, v}]
            traded_by = next((sec(e["tick"]) for e in ks[n + 1:]
                              if seat(e.get("user_steamid")) == a
                              and e["tick"] - d["tick"] <= TRADE_WINDOW_S * TICKRATE), None)
            sn = snap.get(d["tick"], {})
            fights.append({
                "t": t, "killer": a, "victim": v, "assister": seat(d.get("assister_steamid")),
                "flash_assist": _b(d.get("assistedflash")),
                "weapon": d.get("weapon"), "headshot": bool(d.get("headshot")),
                "wallbang": bool(d.get("penetrated")), "through_smoke": _b(d.get("thrusmoke")),
                "noscope": _b(d.get("noscope")), "killer_blind": _b(d.get("attackerblind")),
                "killer_in_air": _b(d.get("attackerinair")),
                "killer_at": {"x": kx, "y": ky, "z": kz,
                              "place": _place(d.get("attacker_last_place_name"))
                              or (sn.get(a) or {}).get("place")},
                "victim_at": {"x": vx, "y": vy, "z": vz,
                              "place": _place(d.get("user_last_place_name"))
                              or (sn.get(v) or {}).get("place")},
                "distance": dist,
                "killer_hp_after": (sn.get(a) or {}).get("hp"),
                "alive_before": before,
                "opening": n == 0,
                "traded_after": traded_by,
                "exchange": exchange,
                "shots_before": {"killer": sum(1 for f in fired if f[1] == a and t - 3 <= f[0] <= t),
                                 "victim": sum(1 for f in fired if f[1] == v and t - 3 <= f[0] <= t)},
                "snapshot": [{"seat": k_, **{f: x for f, x in v_.items() if f != "alive"}}
                             for k_, v_ in sorted(sn.items()) if v_.get("alive") or k_ == v],
            })

        bomb = {}
        b = next((b for b in plants if t0 <= b["tick"] <= r["end"]), None)
        if b:
            bomb["planted"] = {"t": sec(b["tick"]), "by": seat(b.get("user_steamid")),
                               "site": b.get("site"), "x": _i(b.get("user_X")), "y": _i(b.get("user_Y")),
                               "place": _place(b.get("user_last_place_name"))}
        b = next((b for b in defuses if t0 <= b["tick"] <= r["end"] + 6 * TICKRATE), None)
        if b:
            bomb["defused"] = {"t": sec(b["tick"]), "by": seat(b.get("user_steamid"))}
        b = next((b for b in explodes if t0 <= b["tick"] <= r["end"] + 6 * TICKRATE), None)
        if b:
            bomb["exploded"] = {"t": sec(b["tick"])}

        replay_rounds.append({"side": my_side[i], "w": strip[i]["w"], "dur": sec(r["end"]),
                              "winner": r["winner"], "reason": _reason(r["reason"]),
                              "tracks": tracks, "kills": kills, "nades": nades, "plant": plant,
                              "fights": fights, "damage": damage, "shots": fired,
                              "flashes": flashed, "bomb": bomb or None,
                              "economy": {str(k_): v_ for k_, v_ in sorted(econ[i].items())}})

    seats = [{"seat": seat_of[s], "name": names.get(s), "us": s in us_ids, "me": s == me}
             for s in sorted(seat_of, key=seat_of.get)]
    replay = {"map": mapname, "hz": HZ, "tickrate": TICKRATE, "stride": stride,
              "split": split, "seats": seats, "rounds": replay_rounds}
    return summary, replay


def _i(v):
    try:
        return None if v is None or v != v else round(v)
    except TypeError:
        return None


def _n(v):
    """A count from a demo column: blank (None or NaN) is zero."""
    try:
        return 0 if v is None or v != v else int(v)
    except (TypeError, ValueError):
        return 0


def _w(v):
    if not v or v != v:
        return None
    return str(v).replace("weapon_", "")


def _b(v):
    return None if v is None or v != v else bool(v)


def _place(v):
    """'BombsiteA' -> 'Bombsite A'. Valve's callout names are CamelCase."""
    if not v or v != v:
        return None
    return re.sub(r"(?<=[a-z])(?=[A-Z0-9])", " ", str(v))


HITGROUPS = {0: "generic", 1: "head", 2: "chest", 3: "stomach", 4: "left arm",
             5: "right arm", 6: "left leg", 7: "right leg", 8: "neck", 10: "gear"}


def _hit(v):
    if isinstance(v, str):
        return v.lower()
    try:
        return HITGROUPS.get(int(v), str(v))
    except (TypeError, ValueError):
        return None


REASONS = {1: "target bombed", 7: "bomb defused", 8: "Ts eliminated",
           9: "CTs eliminated", 10: "draw", 12: "time ran out",
           16: "T surrender", 17: "CT surrender"}


def _reason(v):
    if v is None or v != v:
        return None
    try:
        return REASONS.get(int(v), str(v))
    except (TypeError, ValueError):
        return str(v).replace("_", " ")


def write_replay(match_id, replay):
    csdata.MATCH_DIR.mkdir(exist_ok=True)
    body = json.dumps(replay, separators=(",", ":"))
    (csdata.MATCH_DIR / f"{match_id}.js").write_text(
        "// Generated by projects/cs/parse-demos.py from Valve's demo of this match.\n"
        f"(window.CS_MATCH=window.CS_MATCH||{{}})[{json.dumps(match_id)}]={body};\n",
        encoding="utf-8", newline="\n")


def ingest(path, acct, data):
    work, tmp = open_demo(path)
    try:
        summary, replay = parse(work, acct["steam64"])
    finally:
        if tmp:
            Path(tmp).unlink(missing_ok=True)
    valve_id = csdata.demo_match_id(path)
    probe = {"map": summary["map"], "score": summary["score"], "me": summary["me"]}
    m = csdata.find(data, valve_id=valve_id, fingerprint=csdata.fingerprint_of(probe))
    if m is None:
        m = {"id": valve_id or f"demo-{path.name.split('.')[0]}", "sources": []}
        data["matches"].append(m)
        m["at"] = None   # the demo carries no date; Leetify or the GSI record supplies it
    if valve_id:
        m["valve_id"] = valve_id
    if "demo" not in m["sources"]:
        m["sources"].append("demo")
    keep_me = m.get("me") or {}
    m.update({k: summary[k] for k in ("map", "score", "result", "start_side", "rounds", "board")})
    # Leetify-only measurements (aim, utility, ratings) survive the demo's line.
    m["me"] = {**keep_me, **summary["me"]}
    m["replay"] = True
    write_replay(m["id"], replay)
    return m


def main():
    acct = csdata.account()
    st = csdata.read_state()
    done = st.setdefault("parsed", {})
    if "--rebuild" in sys.argv:
        done.clear()
        paths = sorted(keep_dir(acct).glob("*.dem*"))
    else:
        paths = [Path(a) for a in sys.argv[1:]] or find_new(acct, done)
    if not paths:
        print("demos: nothing new")
        return
    data = csdata.load()
    for path in paths:
        key = path.name.removesuffix(".bz2")
        try:
            kept = archive(path, acct)
            m = ingest(kept, acct, data)
            done[key] = m["id"]
            st.get("failed", {}).pop(key, None)
            print(f"demos: {key} -> {m['map']} {m['score'][0]}-{m['score'][1]} "
                  f"({m['me']['k']}/{m['me']['d']}/{m['me']['a']})")
        except Exception as e:  # one bad demo must not stop the rest
            st.setdefault("failed", {})[key] = str(e)   # retried next run
            print(f"demos: {key} failed — {e}")
    csdata.save(data)
    csdata.write_state(st)


if __name__ == "__main__":
    main()
