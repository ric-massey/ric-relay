#!/usr/bin/env python3
"""Write the CS room out as plain Markdown, for anything that reads the site
without running its JavaScript — LLMs, search, a screen reader on a bad day.

    python projects/cs/export-llm.py

  projects/cs/llm/index.md      every match, career numbers, how to read the data
  projects/cs/llm/<id>.md       one match in full: scoreboard, every round, and
                                for demo matches every fight, every grenade, the
                                damage log, money and loadouts, 2D positions

Generated from cs-data.js and matches/<id>.js; never hand-edited. sync.py runs
it after every pull, and /llms.txt at the site root points here.
"""

import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import csdata  # noqa: E402
import stats  # noqa: E402

OUT = csdata.HERE / "llm"
SITE = "https://ricmassey.com"
MODES = {"matchmaking": "Premier", "premier": "Premier", "matchmaking_competitive": "Competitive",
         "competitive": "Competitive", "matchmaking_wingman": "Wingman", "scrimcomp2v2": "Wingman",
         "casual": "Casual", "manual_rush": "Custom"}
RANKS = ["Unranked", "Silver I", "Silver II", "Silver III", "Silver IV", "Silver Elite",
         "Silver Elite Master", "Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master",
         "Master Guardian I", "Master Guardian II", "Master Guardian Elite",
         "Distinguished Master Guardian", "Legendary Eagle", "Legendary Eagle Master",
         "Supreme Master First Class", "The Global Elite"]


UNRANKED = ("rush", "casual", "deathmatch", "custom", "retake", "armsrace", "gungame")

LABELS = {
    "acc": "Accuracy, all shots (%)", "acc_spotted": "Accuracy when enemy spotted (%)",
    "acc_head": "Head accuracy (%)", "spray": "Spray accuracy (%)",
    "preaim": "Crosshair placement error (degrees)", "reaction_ms": "Reaction time (ms)",
    "strafe": "Counter-strafed shots (%)", "shots": "Shots fired", "hits": "Shots that hit an enemy",
    "smoke": "Smokes thrown", "flash": "Flashbangs thrown", "he": "HE grenades thrown",
    "molly": "Molotovs/incendiaries thrown", "flash_foes": "Enemies flashed",
    "flash_mates": "Teammates flashed", "flash_assists": "Flash assists",
    "flash_kills": "Flashes leading to a kill", "blind_s": "Average enemy blind time (s)",
    "he_foe_avg": "Average HE damage to enemies", "he_mate_avg": "Average HE damage to teammates",
    "unused_on_death": "Average unused utility at death ($)",
    "chances": "Chances to trade a teammate", "tries": "Trade attempts", "made": "Trades made",
    "died_tradeable": "Deaths that could be traded", "avenged": "Deaths that were traded",
}


def map_name(m):
    base = (m or "?").split("_", 1)[-1] if (m or "").startswith(("de_", "cs_", "ar_")) else (m or "?")
    return {"dust2": "Dust II"}.get(base, base.replace("_", " ").title())


def when(iso):
    if not iso:
        return "date unknown"
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M UTC")


def f(v, d=1):
    return "—" if v is None else (f"{v:.{d}f}" if isinstance(v, float) else str(v))


def hltv(m):
    """HLTV rating 1.0 from the match line, the same formula as the page."""
    me = m["me"]
    rounds, mk = me.get("rounds") or sum(m["score"]), me.get("multi")
    if not rounds or me.get("k") is None or me.get("d") is None or not mk:
        return "—"
    multi = mk[0] + 4 * mk[1] + 9 * mk[2] + 16 * mk[3] + 25 * (mk[4] if len(mk) > 4 else 0)
    return f"{(me['k'] / rounds / 0.679 + 0.7 * (rounds - me['d']) / rounds / 0.317 + multi / rounds / 1.277) / 2.7:.2f}"


def rating(r):
    return "—" if r is None else f"{r * 100:+.2f}"


def bomb_state(r, t):
    """The bomb at one moment, replayed from the round's timeline. The same
    rules as bombAt() in cs.html; projects/cs/test/parity.mjs holds them
    together."""
    b = r.get("bomb") or {}
    tl = b.get("timeline") or []
    carrier = ground = planting = planted = defusing = defused = exploded = None
    for et, kind, seat, x, y, extra in tl:
        if et > t:
            break
        if kind == "pickup":
            carrier, ground = seat, None
        elif kind == "drop":
            carrier, ground = None, ((x, y) if x is not None else None)
        elif kind == "plant_start":
            planting = (et, seat)
        elif kind == "planted":
            planting, carrier, ground, planted = None, None, None, et
        elif kind == "defuse_start":
            defusing = (et, seat, bool(extra))
        elif kind == "defused":
            defusing, defused = None, seat
        elif kind == "exploded":
            exploded = et
    if not tl and (b.get("planted") or {}).get("t") is not None and b["planted"]["t"] <= t:
        planted = b["planted"]["t"]               # older data: the plant only
    dead = {f["victim"] for f in r.get("fights") or [] if f["t"] <= t}
    if planting and (t - planting[0] > 3.2 or planting[1] in dead):
        planting = None
    if defusing and (t - defusing[0] > (5 if defusing[2] else 10) or defusing[1] in dead):
        defusing = None
    if carrier in dead:
        carrier = None
    return {"carrier": carrier, "ground": ground, "planting": planting, "planted": planted,
            "defusing": defusing, "defused": defused, "exploded": exploded}


def bomb_at(r, t, nm):
    """The bomb at one moment, in words."""
    s = bomb_state(r, t)
    carrier, ground, planting, planted = s["carrier"], s["ground"], s["planting"], s["planted"]
    defusing, defused, exploded = s["defusing"], s["defused"], s["exploded"]
    if exploded is not None:
        return "exploded"
    if defused is not None:
        return f"defused by {nm(defused)}"
    if defusing:
        return (f"{nm(defusing[1])} defusing {'with' if defusing[2] else 'without'} a kit, "
                f"{max(0, 40 - (t - planted)):.1f}s on the timer")
    if planted is not None:
        return f"planted, {max(0, 40 - (t - planted)):.0f}s on the timer"
    if planting:
        return f"{nm(planting[1])} planting"
    if ground:
        return f"on the ground at ({ground[0]}, {ground[1]})"
    if carrier is not None:
        return f"carried by {nm(carrier)}"
    return None


def mmss(t):
    if t < 0:
        return "buy time"
    return f"{int(t // 60)}:{int(t % 60):02d}"


def load_replay(mid):
    p = csdata.MATCH_DIR / f"{mid}.js"
    if not p.exists():
        return None
    text = p.read_text(encoding="utf-8")
    return json.loads(text[text.index("]=") + 2:].strip().rstrip(";"))


def table(head, rows):
    out = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    out += ["| " + " | ".join(str(c).replace("|", "/") for c in r) + " |" for r in rows]
    return "\n".join(out)


def match_md(m, player):
    me, R = m["me"], load_replay(m["id"])
    res = {"W": "win", "L": "loss", "T": "draw"}[m["result"]]
    L = [f"# CS2 match: {map_name(m['map'])}, {m['score'][0]}–{m['score'][1]} {res}",
         "",
         f"- **When:** {when(m.get('at'))}",
         f"- **Mode:** {MODES.get(m.get('mode'), m.get('mode'))} · map id `{m['map']}`",
         f"- **Player:** {player} (\"Ric\"), started on "
         f"{ {'T': 'Terrorist', 'CT': 'Counter-Terrorist'}.get(m.get('start_side'), '?') } side",
         f"- **Sources:** {', '.join(m.get('sources', []))} "
         "(demo = parsed from Valve's own recording; gsi = Valve's live game feed; leetify = Leetify's parse)",
         f"- **Page:** {SITE}/cs.html#match-{m['id']}"]
    if R:
        L.append(f"- **Full 2D data:** {SITE}/projects/cs/matches/{m['id']}.js "
                 "(JSON after the `=`; schema in index.md)")
        L.append(f"- **Map reference (callouts with coordinates):** maps/{m['map']}.md")
    if m.get("banned"):
        L.append("- A player in this match was later banned.")

    # ── Ric's numbers ──
    L += ["", "## Ric's game", ""]
    rows = [("Kills / deaths / assists", f"{me.get('k')} / {me.get('d')} / {me.get('a')}"),
            ("Damage (ADR)", f"{f(me.get('dmg'))} ({f(me.get('adr'))})"),
            ("Headshot kills", me.get("hsk")), ("MVPs", me.get("mvps")),
            ("Leetify rating", rating(me.get("rating"))),
            ("Rating as CT / as T", f"{rating(me.get('ct_rating'))} / {rating(me.get('t_rating'))}"),
            ("KAST", f"{me['kast']}%" if me.get("kast") is not None else None),
            ("Rounds survived", me.get("survived")),
            ("Multi-kill rounds (1k..5k)", " / ".join(map(str, me["multi"])) if me.get("multi") else None)]
    if me.get("opening"):
        rows.append(("Opening duels won / lost", f"{me['opening']['won']} / {me['opening']['lost']}"))
    for group in ("aim", "util", "trades"):
        for k, v in (me.get(group) or {}).items():
            rows.append((LABELS.get(k, k), v))
    if me.get("weapons"):
        rows.append(("Kills by weapon", ", ".join(f"{w} {n}" for w, n in me["weapons"].items())))
    L.append(table(["Stat", "Value"], [(k, f(v)) for k, v in rows if v is not None]))

    # ── scoreboard ──
    if m.get("board"):
        L += ["", "## Scoreboard", ""]
        for us in (True, False):
            seats = sorted((s for s in m["board"] if s["us"] == us),
                           key=lambda s: -(s.get("score") or s.get("k") or 0))
            L += [f"**{'Ric' + chr(39) + 's team' if us else 'Opponents'} — {m['score'][0 if us else 1]} rounds**", ""]
            L.append(table(["Player", "K", "D", "A", "ADR", "HS kills", "MVPs", "Rating"],
                           [(("Ric (" + player + ")") if s["me"] else (s.get("name") or "?"),
                             s["k"], s["d"], s["a"], f(s.get("adr")), f(s.get("hsk")), f(s.get("mvps")),
                             rating(s.get("rating"))) for s in seats]))
            L.append("")

    # ── round strip ──
    if m.get("rounds"):
        econ = m.get("economy") or []
        L += ["## Rounds", ""]
        rr = []
        for i, r in enumerate(m["rounds"]):
            e = econ[i] if i < len(econ) else {}
            rd = R["rounds"][i] if R and i < len(R["rounds"]) else {}
            rr.append((i + 1, r.get("side") or "?", "won" if r["w"] else "lost",
                       rd.get("reason") or "—", r.get("k", 0), "died" if r.get("dead") else "survived",
                       f"${e['money']}" if e.get("money") is not None else "—",
                       f"${e['equip']}" if e.get("equip") else "—"))
        L.append(table(["Round", "Ric's side", "Result", "How", "Ric's kills", "Ric", "Ric's money", "Ric's loadout value"], rr))

    if not R:
        L += ["", "_No demo was saved for this match, so there is no fight-by-fight or 2D data. "
              "Valve deletes demos after a few weeks._"]
        return "\n".join(L) + "\n"

    # ── every round in full ──
    seats = {s["seat"]: s for s in R["seats"]}

    def nm(seat):
        if seat is None:
            return "world"
        s = seats.get(seat) or {}
        return "Ric" if s.get("me") else (s.get("name") or f"player {seat}")

    def side(seat, r):
        s = seats.get(seat) or {}
        return r["side"] if s.get("us") else ("T" if r["side"] == "CT" else "CT")

    def at(p):
        if not p:
            return "?"
        return f"{p.get('place') or 'unknown spot'} ({p.get('x')}, {p.get('y')}, {p.get('z')})"

    L += ["", "## Every round", "",
          "Times are seconds since the round went live (freeze time over). Positions are "
          "in-game map coordinates (x, y, z in Hammer units) with Valve's callout name for "
          "the spot. \"Alive\" counts are Ric's team v opponents just before the kill."]
    for i, r in enumerate(R["rounds"]):
        L += ["", f"### Round {i + 1} — Ric {'won' if r['w'] else 'lost'} as {r['side']}"
                  f"{' · ' + r['reason'] if r.get('reason') else ''} · {mmss(r['dur'])} long"]
        if r.get("economy"):
            L += ["", "**Buy** (after the buy period)", ""]
            L.append(table(["Player", "Side", "Money", "Loadout value", "Armor", "Helmet", "Kit", "Items"],
                           [(nm(int(k)), side(int(k), r), f(e.get("money")), f(e.get("equip")), f(e.get("armor")),
                             f(e.get("helmet")), f(e.get("kit")), ", ".join(e.get("items") or []) or "—")
                            for k, e in r["economy"].items()]))
        if r.get("bomb"):
            b = r["bomb"]
            parts = []
            if b.get("planted"):
                p = b["planted"]
                parts.append(f"planted at {mmss(p['t'])} by {nm(p.get('by'))} at {p.get('place') or ''} ({p.get('x')}, {p.get('y')})")
            if b.get("defused"):
                parts.append(f"defused at {mmss(b['defused']['t'])} by {nm(b['defused'].get('by'))}")
            if b.get("exploded"):
                parts.append(f"exploded at {mmss(b['exploded']['t'])}")
            if parts:
                L += ["", "**Bomb:** " + "; ".join(parts)]
            words = {"pickup": "picked up by", "drop": "dropped by", "plant_start": "plant started by",
                     "planted": "planted by", "defuse_start": "defuse started by", "defused": "defused by",
                     "exploded": "exploded"}
            if b.get("timeline"):
                L += ["", "**Bomb timeline:** " + "; ".join(
                    f"{mmss(e[0])} {words.get(e[1], e[1])}"
                    + (f" {nm(e[2])}" if e[1] != "exploded" and e[2] is not None else "")
                    + (f" at ({e[3]}, {e[4]})" if e[3] is not None and e[1] != "pickup" else "")
                    + ((" with a kit" if e[5] else " without a kit") if e[1] == "defuse_start" else "")
                    for e in b["timeline"])]

        if r.get("fights"):
            L += ["", "**Fights**", ""]
            for n, x in enumerate(r["fights"], 1):
                flags = [k for k, on in (("headshot", x.get("headshot")), ("wallbang", x.get("wallbang")),
                                         ("through smoke", x.get("through_smoke")), ("no-scope", x.get("noscope")),
                                         ("killer was flashed", x.get("killer_blind")),
                                         ("killer in the air", x.get("killer_in_air")),
                                         ("opening kill", x.get("opening"))) if on]
                line = (f"{n}. **{mmss(x['t'])}** {nm(x['killer'])} ({side(x['killer'], r) if x['killer'] is not None else '-'}) "
                        f"at {at(x.get('killer_at'))} killed {nm(x['victim'])} ({side(x['victim'], r)}) "
                        f"at {at(x.get('victim_at'))} with {x.get('weapon')}")
                if flags:
                    line += " — " + ", ".join(flags)
                L.append(line)
                det = []
                if x.get("distance") is not None:
                    det.append(f"distance {x['distance']} units")
                if x.get("alive_before"):
                    det.append(f"{x['alive_before'][0]}v{x['alive_before'][1]} before")
                if x.get("killer_hp_after") is not None:
                    det.append(f"killer on {x['killer_hp_after']} HP after")
                if x.get("assister") is not None:
                    det.append(f"assist {nm(x['assister'])}{' (flash)' if x.get('flash_assist') else ''}")
                if x.get("traded_after") is not None:
                    det.append(f"killer traded at {mmss(x['traded_after'])}")
                sb = x.get("shots_before") or {}
                det.append(f"shots in the 3 s before: killer {sb.get('killer', '?')}, victim {sb.get('victim', '?')}")
                L.append("   - " + "; ".join(det))
                if x.get("exchange"):
                    L.append("   - damage between them in the 10 s before: " + "; ".join(
                        f"{mmss(e[0])} {nm(e[1])}→{nm(e[2])} {e[4]} ({e[6] or '?'}, {e[3]})" for e in x["exchange"]))
                if x.get("snapshot"):
                    def who_at(p):
                        bits = [f"{p.get('hp')}HP"]
                        if p.get("armor"):
                            bits.append(f"{p['armor']} armor")
                        if p.get("weapon"):
                            bits.append(f"holding {p['weapon']}")
                        if p.get("yaw") is not None:
                            bits.append(f"facing {p['yaw'] % 360}°")
                        return (f"{nm(p['seat'])} ({side(p['seat'], r)}) {p.get('place') or ''} "
                                f"({p.get('x')}, {p.get('y')}, {p.get('z')}) " + ", ".join(bits))
                    L.append("   - everyone at that moment: " + "; ".join(who_at(p) for p in x["snapshot"]))
                # what was in the air when it happened
                t_ = x["t"]
                up = [n for n in r.get("nades") or []
                      if n[0] <= t_ <= (n[5] if len(n) > 5 and n[5] is not None
                                        else n[0] + {"smoke": 20, "fire": 7}.get(n[2], 0))
                      and n[2] in ("smoke", "fire")]
                blind = [f for f in r.get("flashes") or [] if f[0] <= t_ <= f[0] + f[3]]
                if up or blind:
                    L.append("   - in the air: " + "; ".join(
                        [f"{n[2]} at ({n[3]}, {n[4]}) from {nm(n[1])}" for n in up]
                        + [f"{nm(f[2])} flashed by {nm(f[1])}" for f in blind]))
                state = bomb_at(r, t_, nm)
                if state:
                    L.append("   - bomb: " + state)
        else:
            L += ["", "_No kills this round._"]

        if r.get("nades"):
            L += ["", "**Grenades:** " + "; ".join(
                f"{mmss(n[0])} {n[2]} by {nm(n[1])} at ({n[3]}, {n[4]})"
                + (f", gone at {mmss(n[5])}" if len(n) > 5 and n[5] is not None else "")
                for n in r["nades"])]
        if r.get("flashes"):
            L += ["", "**Flashed:** " + "; ".join(
                f"{mmss(t)} {nm(a)} flashed {nm(v)} {d}s" for t, a, v, d in r["flashes"])]
        if r.get("damage"):
            L += ["", "**Damage log:** " + "; ".join(
                f"{mmss(t)} {nm(a)}→{nm(v)} {hp}{('+' + str(ar) + ' armor') if ar else ''} {hit or ''} {w or ''} ({left} left)"
                .replace("  ", " ") for t, a, v, w, hp, ar, hit, left in r["damage"])]
        if r.get("shots"):
            c = Counter(nm(x[1]) for x in r["shots"] if x[1] is not None)
            L += ["", "**Shots fired:** " + ", ".join(f"{k} {n}" for k, n in c.most_common())]
    return "\n".join(L) + "\n"


SCHEMA = """## Reading the raw 2D data

Matches with a saved demo have a data file at
`/projects/cs/matches/<id>.js`. It is one JSON object after
`(window.CS_MATCH=window.CS_MATCH||{})["<id>"]=`:

- `map`, `hz` (position samples per second), `tickrate`
- `seats`: `[{seat, name, us, me}]` — `us` = Ric's team, `me` = Ric
- `rounds[]`, each with
  - `side` (Ric's side), `w` (Ric's team won), `winner`, `reason`, `dur` (seconds)
  - `tracks`: `{seat: [x0, y0, x1, y1, …]}` sampled `hz` times a second from the
    round going live (`[x, y, z, …]` when the file has `stride: 3`); `null`s while dead.
    When the file has `tracks_q`, tracks are packed: the first sample after a gap
    is a position and each later one is the step from the previous, with x and y
    divided by `tracks_q`; a track ends at its last sample, and the round's
    `samples` gives the full length. To unpack, keep a running sum and multiply
    x and y by `tracks_q`.
  - `fights[]`: `t`, `killer`, `victim`, `assister` (seats), `weapon`, `headshot`,
    `wallbang`, `through_smoke`, `noscope`, `killer_blind`, `killer_in_air`,
    `killer_at` / `victim_at` (`x, y, z, place`), `distance`, `killer_hp_after`,
    `alive_before` [Ric's team, opponents], `opening`, `traded_after`,
    `exchange` (damage rows between the two in the prior 10 s),
    `shots_before`, `snapshot` (everyone alive: seat, x, y, z, place, hp)
  - `damage[]`: `[t, attacker, victim, weapon, hp_damage, armor_damage, hitgroup, hp_left]`
  - `shots[]`: `[t, seat, weapon, yaw]` — every shot fired, and which way the gun pointed (yaw: whole degrees, absent on older replays)
  - `flashes[]`: `[t, thrower, victim, seconds_blind]`
  - `nades[]`: `[t, seat, kind, x, y]` — where each grenade went off
  - `bomb`: `planted {t, by, site, x, y, place}`, `defused {t, by}`, `exploded {t}`
  - `economy`: `{seat: {money, equip, armor, helmet, kit, items}}` after the buy
  - `kills[]`: the compact form the page draws from

Times are seconds since the round went live. Coordinates are CS2 map units.
"""


def index_md(data, matches, breakdown=""):
    player = data.get("player") or "Ric"
    L = [f"# {player} — Counter-Strike 2, every match",
         "",
         f"Ric Massey's CS2 record from {SITE}/cs.html, as plain text. Generated "
         f"{datetime.now().strftime('%Y-%m-%d')}. Each match below links to a full report.",
         "",
         "Sources: Valve's match demos (full detail, 2D positions), Valve's live game "
         "feed, and Leetify for games whose demo Valve already deleted. Other players "
         "appear under their in-game names."]
    # ranked games only, as on the page: a custom Rush would skew every average
    ranked = [m for m in matches if not any(w in (m.get("mode") or "") for w in UNRANKED)]
    n = len(ranked)
    tally = Counter(m["result"] for m in ranked)
    k = sum(m["me"].get("k") or 0 for m in ranked)
    d = sum(m["me"].get("d") or 0 for m in ranked)
    hsk = sum(m["me"].get("hsk") or 0 for m in ranked)
    L += ["", "## Career (ranked games)", "",
          table(["Stat", "Value"], [
              ("Matches", n), ("Won / lost / drawn", f"{tally['W']} / {tally['L']} / {tally['T']}"),
              ("Win rate", f"{100 * tally['W'] / n:.0f}%" if n else "—"),
              ("Kills / deaths", f"{k} / {d}"), ("K/D", f"{k / d:.2f}" if d else "—"),
              ("Headshot %", f"{100 * hsk / k:.0f}%" if k else "—"),
              ("Matches with full demo data", sum(1 for m in matches if m.get("replay")))])]
    lt = data.get("leetify") or {}
    if lt.get("rating"):
        R = lt["rating"]
        L += ["", f"**Leetify skill ratings** (read {lt.get('read')}): aim {R.get('aim', 0):.0f}/100, "
              f"positioning {R.get('positioning', 0):.0f}/100, utility {R.get('utility', 0):.0f}/100."]
    ranks = (lt.get("ranks") or {}).get("competitive") or []
    if ranks:
        L += ["", "**Competitive rank by map:** " + ", ".join(
            f"{map_name(r['map_name'])} {RANKS[r['rank']] if r['rank'] < len(RANKS) else r['rank']}" for r in ranks)
            + f". Premier rating: {(lt.get('ranks') or {}).get('premier') or 'unrated'}."]

    L += ["", "## Matches (newest first)", "",
          table(["Date", "Map", "Mode", "Score", "Result", "K-D-A", "ADR", "HLTV 1.0", "Leetify rating", "Full data", "Report"],
                [(when(m.get("at")), map_name(m["map"]), MODES.get(m.get("mode"), m.get("mode")),
                  f"{m['score'][0]}–{m['score'][1]}", {"W": "win", "L": "loss", "T": "draw"}[m["result"]],
                  f"{m['me'].get('k')}-{m['me'].get('d')}-{m['me'].get('a')}", f(m["me"].get("adr")), hltv(m),
                  rating(m["me"].get("rating")), "yes" if m.get("replay") else "no",
                  f"[{m['id']}.md]({m['id']}.md)") for m in matches])]

    by = {}
    for m in matches:
        g = by.setdefault(m["map"], Counter())
        g["n"] += 1; g[m["result"]] += 1; g["k"] += m["me"].get("k") or 0; g["d"] += m["me"].get("d") or 0
    L += ["", "## By map", "",
          table(["Map", "Played", "W-L-D", "K/D"],
                [(map_name(mp), g["n"], f"{g['W']}-{g['L']}-{g['T']}", f"{g['k'] / g['d']:.2f}" if g["d"] else "—")
                 for mp, g in sorted(by.items(), key=lambda x: -x[1]["n"])])]
    if breakdown:
        L += ["", breakdown]
    L += ["", GLOSSARY, "", SCHEMA]
    return "\n".join(L) + "\n"


# What the numbers mean: the same definitions cs.html shows behind its ⓘ buttons.
GLOSSARY = """## What the numbers mean

- **ADR**: average damage per round, the health Ric took off the enemy each round. 100 is a whole enemy's worth every round.
- **K/D**: kills divided by deaths. **HS%**: the share of kills that were headshots.
- **KAST**: the share of rounds where Ric got a kill, an assist, survived, or was traded.
- **Leetify rating** (the Rating column): how much Ric's play moved his team's chance of winning each round, averaged over the match. 0 is break-even; shown ×100, so +2.00 is roughly two points of win chance added per round.
- **Aim / positioning / utility**: Leetify's scores out of 100 across every game they have parsed. Higher is better; they are scores, not percentages.
- **Clutching / opening duels**: Leetify ratings for last-alive situations and the first fight of a round, against what is expected. 0 is break-even.
- Career numbers count ranked games only; custom and casual lobbies are listed but not averaged."""


def places(replays):
    """Valve tags every position with a callout ("Palace", "Bombsite A"). The
    average of every tagged position in Ric's demos is where that callout is —
    a map reference built from the games themselves."""
    pts = {}
    for R in replays:
        for r in R["rounds"]:
            for f in r.get("fights") or []:
                for q in (f.get("snapshot") or []) + [f.get("killer_at") or {}, f.get("victim_at") or {}]:
                    if q.get("place") and q.get("x") is not None:
                        pts.setdefault(q["place"], []).append((q["x"], q["y"]))
    out = []
    for name, xs in pts.items():
        n = len(xs)
        out.append({"name": name, "x": round(sum(x for x, _ in xs) / n), "y": round(sum(y for _, y in xs) / n),
                    "min": [min(x for x, _ in xs), min(y for _, y in xs)],
                    "max": [max(x for x, _ in xs), max(y for _, y in xs)], "seen": n})
    return sorted(out, key=lambda c: c["name"])


def map_md(mapname, ps, n_games):
    return "\n".join([
        f"# {map_name(mapname)} — map reference (`{mapname}`)", "",
        "CS2 tags every player position with a callout name. This table is built from "
        f"{n_games} of Ric's own demos on this map: each callout's centre is the average of every "
        "position tagged with it, and the box is the area those positions covered. Coordinates "
        "are CS2 map units (x east, y north).", "",
        table(["Callout", "Centre x", "Centre y", "Covers x", "Covers y", "Positions seen"],
              [(c["name"], c["x"], c["y"], f"{c['min'][0]} to {c['max'][0]}", f"{c['min'][1]} to {c['max'][1]}", c["seen"])
               for c in ps])]) + "\n"


def main():
    data = csdata.load()
    matches = [m for m in data["matches"] if m.get("me") and m.get("score")]
    OUT.mkdir(exist_ok=True)
    keep = {"index.md"}
    player = data.get("player") or "Ric"
    for m in matches:
        name = f"{m['id']}.md"
        keep.add(name)
        (OUT / name).write_text(match_md(m, player), encoding="utf-8", newline="\n")
    S = stats.write(matches)            # stats.js, the page's Stats section
    (OUT / "index.md").write_text(index_md(data, matches, stats.breakdown_md(S, map_name)),
                                  encoding="utf-8", newline="\n")
    by_map = {}
    for m in matches:
        R = load_replay(m["id"]) if m.get("replay") else None
        if R:
            by_map.setdefault(m["map"], []).append(R)
    if by_map:
        (OUT / "maps").mkdir(exist_ok=True)
    for mp, reps in by_map.items():
        (OUT / "maps" / f"{mp}.md").write_text(map_md(mp, places(reps), len(reps)), encoding="utf-8", newline="\n")
    for p in OUT.glob("*.md"):           # a match id that changed (gsi- → valve id)
        if p.name not in keep:
            p.unlink()
    print(f"llm: {len(matches)} match reports + index")


if __name__ == "__main__":
    main()
