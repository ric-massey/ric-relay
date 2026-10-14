#!/usr/bin/env python3
"""Write the VALORANT room out as plain Markdown, for LLMs and anything else
that reads the site without running its JavaScript.

    python projects/val/export-llm.py

  llm/index.md        rank, career numbers, every match, how to read positions
  llm/maps/<map>.md   the map reference: every callout with its game
                      coordinates and its spot on the minimap image
  llm/<id>.md         one match in full: every round, every fight with where all
                      ten players stood (exact x, y, minimap u, v, facing,
                      nearest callout), damage by body part, buys, the spike

Generated from val-data.js and matches/<id>.js. sync.py runs it after every
pull; /llms.txt points here.
"""

import json
import math
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "llm"
SITE = "https://ricmassey.com"
QUEUES = {"competitive": "Competitive", "unrated": "Unrated", "swiftplay": "Swiftplay",
          "spikerush": "Spike Rush", "premier": "Premier", "custom": "Custom", "": "Custom"}
HOW = {"Eliminated": "elimination", "Bomb detonated": "spike detonated", "Bomb defused": "spike defused",
       "Round timer expired": "time ran out", "Surrendered": "surrender"}


def load(p, prefix):
    t = p.read_text(encoding="utf-8")
    return json.loads(t[t.index(prefix) + len(prefix):].strip().rstrip(";"))


def table(head, rows):
    return "\n".join(["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
                     + ["| " + " | ".join(str("—" if c is None else c).replace("|", "/") for c in r) + " |" for r in rows])


def mmss(t):
    return f"{int(t // 60)}:{int(t % 60):02d}"


def slug(name):
    return "".join(ch for ch in (name or "").lower() if ch.isalnum())


def facing(rad):
    return None if rad is None else f"{round(math.degrees(rad)) % 360}°"


def pos(p):
    if not p:
        return "unknown"
    s = f"{p.get('place') or 'unnamed spot'} (x {p['x']}, y {p['y']}"
    if p.get("u") is not None:
        s += f"; map {p['u']:.3f}, {p['v']:.3f}"
    if p.get("view") is not None:
        s += f"; facing {facing(p['view'])}"
    return s + ")"


def match_md(m, D, player):
    me = m["me"]
    res = {"W": "win", "L": "loss", "T": "draw"}[m["result"]]
    L = [f"# VALORANT match: {m['map']}, {m['score'][0]}–{m['score'][1]} {res}", "",
         f"- **When:** {m.get('at', '?').replace('T', ' ').replace('Z', ' UTC')}",
         f"- **Mode:** {QUEUES.get(m.get('queue'), m.get('queue'))}{' (ranked)' if m.get('ranked') else ''} · {m.get('minutes')} minutes",
         f"- **Player:** {player} (\"Ric\") as **{me.get('agent')}**, rank {me.get('tier')} at the time, started on "
         f"{'attack' if m.get('start_side') == 'ATK' else 'defense'}",
         f"- **Page:** {SITE}/val.html#match-{m['id']}"]
    if m.get("rr"):
        L.append(f"- **Rank rating:** {m['rr'].get('earned'):+} RR → {m['rr'].get('tier')} {m['rr'].get('after')} RR")
    if D:
        L += [f"- **Map reference (callouts with coordinates):** maps/{slug(m['map'])}.md",
              f"- **Minimap image:** {SITE}/projects/val/{D['minimap']}" if D.get("minimap") else "",
              f"- **Full data:** {SITE}/projects/val/matches/{m['id']}.js (JSON after the `=`)"]

    sh = me.get("shots") or {}
    L += ["", "## Ric's game", "", table(["Stat", "Value"], [
        ("Kills / deaths / assists", f"{me['k']} / {me['d']} / {me['a']}"),
        ("Average combat score (ACS)", me.get("acs")), ("Damage per round (ADR)", me.get("adr")),
        ("Damage received per round", me.get("dmg_received")),
        ("Headshot % (of hits)", me.get("hs")), ("Hits: head / body / legs", f"{sh.get('head')} / {sh.get('body')} / {sh.get('legs')}"),
        ("First bloods / first deaths", f"{me.get('fb')} / {me.get('fd')}"), ("KAST %", me.get("kast")),
        ("Multi-kill rounds", ", ".join(f"{k} {v}" for k, v in (me.get("multi") or {}).items() if v) or "none"),
        ("Spike plants / defuses", f"{me.get('plants')} / {me.get('defuses')}"),
        ("Average loadout value", me.get("avg_loadout")), ("Credits spent", me.get("spent")),
        ("Ability casts", ", ".join(f"{k.replace('Casts', '')} {v}" for k, v in (me.get("abilities") or {}).items())),
    ])]

    L += ["", "## Scoreboard", ""]
    for us in (True, False):
        rows = sorted((s for s in m["board"] if s["us"] == us), key=lambda s: -(s.get("acs") or 0))
        L += [f"**{'Ric' + chr(39) + 's team' if us else 'Opponents'} — {m['score'][0 if us else 1]} rounds**", "",
              table(["Player", "Agent", "Rank", "K", "D", "A", "ACS", "ADR", "HS%", "FB", "KAST%"],
                    [("Ric" if s["me"] else (s.get("name") or "—"), s["agent"], s.get("tier"), s["k"], s["d"], s["a"],
                      s["acs"], s["adr"], s.get("hs"), s.get("fb"), s.get("kast")) for s in rows]), ""]

    if not D:
        return "\n".join(x for x in L if x is not None) + "\n"

    seats = {s["seat"]: s for s in D["seats"]}

    def nm(i):
        s = seats.get(i)
        if not s:
            return "?"
        return "Ric" if s["me"] else (f"{s['name']} ({s['agent']})" if s.get("name") else s["agent"])

    def team(i, side):
        s = seats.get(i) or {}
        mine = s.get("us")
        return side if mine else ("DEF" if side == "ATK" else "ATK")

    L += ["## Every round", "",
          "Times are seconds into the round. Positions: game coordinates (x, y), the same "
          "point on the minimap image as fractions of its width and height (map u, v — 0,0 "
          "is the top-left corner), the direction the player was facing, and the nearest "
          "of Riot's callouts. Opponents are named by agent. \"Alive\" is Ric's team v "
          "opponents just before the kill."]
    for r in D["rounds"]:
        L += ["", f"### Round {r['n']} — Ric {'won' if r['w'] else 'lost'} on {'attack' if r['side'] == 'ATK' else 'defense'}"
                  f" · {HOW.get(r.get('result'), r.get('result'))}"
                  + (f" · {r['ceremony']}" if r.get("ceremony") and r["ceremony"] != "Default" else "")]
        if r.get("economy"):
            L += ["", table(["Player", "Side", "Loadout value", "Spent", "Credits left", "Weapon", "Shield"],
                            [(nm(int(k)), team(int(k), r["side"]), e.get("loadout"), e.get("spent"), e.get("left"),
                              e.get("weapon"), e.get("armor")) for k, e in sorted(r["economy"].items(), key=lambda x: int(x[0]))])]
        if r.get("fights"):
            L += ["", "**Fights**", ""]
            for n, f in enumerate(r["fights"], 1):
                flags = [x for x, on in (("opening kill", f.get("opening")), ("alt fire", f.get("alt_fire"))) if on]
                L.append(f"{n}. **{mmss(f['t'])}** {nm(f['killer'])} ({team(f['killer'], r['side'])}) at {pos(f.get('killer_at'))} "
                         f"killed {nm(f['victim'])} ({team(f['victim'], r['side'])}) at {pos(f.get('victim_at'))} "
                         f"with {f.get('weapon')}" + (" — " + ", ".join(flags) if flags else ""))
                det = []
                if f.get("distance_m") is not None:
                    det.append(f"{f['distance_m']} m apart")
                det.append(f"{f['alive_before'][0]}v{f['alive_before'][1]} before")
                if f.get("assisters"):
                    det.append("assists: " + ", ".join(nm(a) for a in f["assisters"]))
                if f.get("traded_after") is not None:
                    det.append(f"killer traded at {mmss(f['traded_after'])}")
                L.append("   - " + "; ".join(det))
                if f.get("exchange"):
                    L.append("   - damage between them this round: " + "; ".join(
                        f"{nm(e['from'])}→{nm(e['to'])} {e['dmg']} ({e['head']} head, {e['body']} body, {e['legs']} legs)"
                        for e in f["exchange"]))
                if f.get("snapshot"):
                    L.append("   - everyone at that moment: " + "; ".join(
                        f"{nm(p['seat'])} ({team(p['seat'], r['side'])}{', dead' if p.get('dead') else ''}) {pos(p)}"
                        for p in f["snapshot"]))
        sp = r.get("spike") or {}
        for kind in ("plant", "defuse"):
            if sp.get(kind):
                x = sp[kind]
                L += ["", f"**Spike {kind}ed** at {mmss(x['t'])} by {nm(x.get('by'))}"
                          + (f" on site {x['site']}" if x.get("site") else "") + f" at {pos(x.get('at'))}. "
                          "Everyone at that moment: " + "; ".join(f"{nm(p['seat'])} {pos(p)}" for p in x.get("players") or [])]
        if r.get("damage"):
            L += ["", "**Damage:** " + "; ".join(
                f"{nm(d['from'])}→{nm(d['to'])} {d['dmg']} ({d['head']}/{d['body']}/{d['legs']} head/body/legs)" for d in r["damage"])]
    return "\n".join(x for x in L if x is not None) + "\n"


def map_md(D):
    t = D["transform"]
    L = [f"# {D['map']} — map reference", "",
         f"Minimap image: {SITE}/projects/val/{D['minimap']}" if D.get("minimap") else "",
         "",
         "Converting game coordinates (x, y) to the minimap image (u, v as fractions of its "
         "width and height, 0,0 top-left) — VALORANT swaps the axes:",
         "",
         f"    u = y × {t['xm']} + {t['xa']}",
         f"    v = x × {t['ym']} + {t['ya']}",
         "",
         "Every callout Riot names on this map:", "",
         table(["Callout", "x", "y", "map u", "map v"],
               [(c["name"], round(c["x"]), round(c["y"]), c.get("u"), c.get("v")) for c in D.get("callouts") or []])]
    return "\n".join(L) + "\n"


def index_md(data, ms):
    player = data.get("player") or "Ric"
    n = len(ms)
    tally = Counter(m["result"] for m in ms)
    k = sum(m["me"]["k"] or 0 for m in ms)
    d = sum(m["me"]["d"] or 0 for m in ms)
    rank = data.get("rank") or {}
    L = [f"# {player} — VALORANT, every match", "",
         f"Ric Massey's VALORANT record from {SITE}/val.html, as plain text. Generated "
         f"{datetime.now().strftime('%Y-%m-%d')}. Data comes from Riot's own match details. "
         "Each match links to a full report with every fight and the exact 2D position of every "
         "player at every kill, spike plant and defuse.", "",
         "## Career", "", table(["Stat", "Value"], [
             ("Current rank", f"{rank.get('tier')} {rank.get('rr')} RR (read {rank.get('read')})" if rank else "—"),
             ("Matches", n), ("Won / lost / drawn", f"{tally['W']} / {tally['L']} / {tally['T']}"),
             ("Win rate", f"{100 * tally['W'] / n:.0f}%" if n else "—"),
             ("K/D", f"{k / d:.2f}" if d else "—"),
             ("Average ACS", round(sum(m["me"]["acs"] for m in ms) / n) if n else "—"),
         ])]
    agents = Counter(m["me"]["agent"] for m in ms)
    if agents:
        L += ["", "**Agents played:** " + ", ".join(f"{a} {c}" for a, c in agents.most_common())]
    L += ["", "## Matches (newest first)", "",
          table(["Date", "Map", "Mode", "Agent", "Score", "Result", "K-D-A", "ACS", "ADR", "HS%", "Report"],
                [((m.get("at") or "")[:16].replace("T", " "), m["map"], QUEUES.get(m.get("queue"), m.get("queue")),
                  m["me"]["agent"], f"{m['score'][0]}–{m['score'][1]}", {"W": "win", "L": "loss", "T": "draw"}[m["result"]],
                  f"{m['me']['k']}-{m['me']['d']}-{m['me']['a']}", m["me"]["acs"], m["me"]["adr"], m["me"].get("hs"),
                  f"[{m['id']}.md]({m['id']}.md)") for m in ms])]
    maps = sorted({m["map"] for m in ms})
    if maps:
        L += ["", "## Map references", "", "Callouts with exact coordinates and minimap positions: "
              + ", ".join(f"[{x}](maps/{slug(x)}.md)" for x in maps)]
    L += ["", "## Raw data", "",
          "`/projects/val/matches/<id>.js` holds each match as JSON after the `=`: `seats` "
          "(seat number, agent, `us` = Ric's team, `me` = Ric), `transform` and `callouts` for "
          "the map, and `rounds[]` with `fights[]` (killer, victim, weapon, `killer_at` / "
          "`victim_at` / `snapshot[]` positions as `{x, y, u, v, view (radians), place}`), "
          "`damage[]` (from, to, dmg, head, body, legs), `economy` per seat, and `spike`."]
    return "\n".join(L) + "\n"


def main():
    p = HERE / "val-data.js"
    if not p.exists():
        print("llm: no VALORANT data yet")
        return
    data = load(p, "window.VAL_DATA = ")
    ms = data.get("matches", [])
    (OUT / "maps").mkdir(parents=True, exist_ok=True)
    keep, keep_maps = {"index.md"}, set()
    player = data.get("player") or "Ric"
    for m in ms:
        dp = HERE / "matches" / f"{m['id']}.js"
        D = load(dp, "]=") if dp.exists() else None
        (OUT / f"{m['id']}.md").write_text(match_md(m, D, player), encoding="utf-8", newline="\n")
        keep.add(f"{m['id']}.md")
        if D and slug(D["map"]) not in keep_maps:
            (OUT / "maps" / f"{slug(D['map'])}.md").write_text(map_md(D), encoding="utf-8", newline="\n")
            keep_maps.add(slug(D["map"]))
    (OUT / "index.md").write_text(index_md(data, ms), encoding="utf-8", newline="\n")
    print(f"llm: {len(ms)} match reports, {len(keep_maps)} map references")


if __name__ == "__main__":
    main()
