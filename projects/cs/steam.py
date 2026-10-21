#!/usr/bin/env python3
"""Ask Valve which matches Ric has played: Steam Web API, match history.

    python projects/cs/steam.py

This is Valve's own list, so it catches every competitive/premier/wingman game
whether or not Leetify ever saw it. What it returns is a share code per match —
the key to that match's demo — and nothing else. The codes stay in local state
(.cs-state.json); they are not published, because a share code is enough to
download the demo with everyone's name in it.

The useful output is the reminder: every match Valve knows about that has no
demo in the archive yet gets listed in demos/DOWNLOAD-THESE.txt, newest first,
so the demo can be saved from Watch → Your Matches before Valve deletes it.

Two secrets, both read from Windows Credential Manager — never this repo:

    cmdkey /generic:ric-terminal/steam-webapi /user:steam /pass:<your Web API key>
    cmdkey /generic:ric-terminal/cs-match-auth /user:steam /pass:<XXXX-XXXXX-XXXX>

Web API key: https://steamcommunity.com/dev/apikey
Match auth code: help.steampowered.com → Counter-Strike 2 → "Access to Your
Match History" → create authentication code.
Without them this script says so and stops; nothing else in the room needs them.
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import creds  # noqa: E402
import csdata  # noqa: E402

API = "https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1"
DEMO_DAYS = 28   # Valve's copy is gone some time after this; treat as expired
GAP_S = 1.5      # between requests: back to back, Valve answers 429 within a few codes


def credential(target):
    return creds.get(target)


class Throttled(Exception):
    pass


def next_code(key, me, auth, known):
    q = urllib.parse.urlencode({"key": key, "steamid": me, "steamidkey": auth, "knowncode": known})
    for wait in (10, 30, 60, None):
        try:
            with urllib.request.urlopen(f"{API}?{q}", timeout=30) as r:
                code = json.load(r).get("result", {}).get("nextcode")
            break
        except urllib.error.HTTPError as e:
            if e.code == 403:
                raise SystemExit("steam: the match auth code was refused — make a new one")
            if e.code == 412:
                raise SystemExit("steam: Valve doesn't recognise the last known share code")
            if e.code != 429:
                raise
            if wait is None:
                raise Throttled()
            time.sleep(wait)   # rate-limited: back off and ask again
    return None if not code or code == "n/a" else code


def main():
    acct = csdata.account()
    key = credential("ric-terminal/steam-webapi")
    auth = credential("ric-terminal/cs-match-auth")
    st = csdata.read_state()
    if not key or not auth:
        print("steam: no Web API key / match auth code in Credential Manager — skipped")
    elif not st.get("last_code"):
        print("steam: no share code to start from yet — run pull-leetify.py once")
    else:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        new = 0
        code = st["last_code"]
        throttled = False
        for i in range(200):
            if i:
                time.sleep(GAP_S)
            try:
                code = next_code(key, acct["steam64"], auth, code)
            except Throttled:
                throttled = True
                break
            if not code:
                break
            vid = csdata.share_code_match_id(code)
            st.setdefault("codes", {})[vid] = code
            st.setdefault("seen", {}).setdefault(vid, now)
            st["last_code"] = code
            new += 1
            csdata.write_state(st)   # each code as it comes: a stop later keeps these
        csdata.write_state(st)
        print(f"steam: {new} new match{'es' if new != 1 else ''} from Valve"
              + (" — Valve is rate-limiting, the rest next sync" if throttled else ""))
    remind(st)


def remind(st):
    """List what Valve still has that we haven't kept."""
    data = csdata.load()
    have = {m.get("valve_id") for m in data["matches"] if "demo" in m.get("sources", [])}
    by_vid = {m.get("valve_id"): m for m in data["matches"] if m.get("valve_id")}
    cutoff = datetime.now(timezone.utc) - timedelta(days=DEMO_DAYS)
    todo = []
    for vid in st.get("codes", {}):
        if vid in have:
            continue
        m = by_vid.get(vid) or {}
        when = m.get("at") or st.get("seen", {}).get(vid)
        try:
            t = datetime.fromisoformat(when.replace("Z", "+00:00"))
        except (AttributeError, ValueError):
            t = None
        if t and t < cutoff:
            continue
        todo.append((when or "", m.get("map") or "?", m.get("score")))
    out = csdata.HERE / "demos" / "DOWNLOAD-THESE.txt"
    out.parent.mkdir(exist_ok=True)
    if not todo:
        out.unlink(missing_ok=True)
        return
    todo.sort(reverse=True)
    lines = ["Matches Valve still has a demo for that the archive doesn't.",
             "CS2 → Watch → Your Matches → Download. The next sync keeps a copy.", ""]
    for when, mp, score in todo:
        s = f"{score[0]}-{score[1]}" if score else ""
        lines.append(f"{when[:16].replace('T', ' ')}  {mp:<12} {s}")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"steam: {len(todo)} demo{'s' if len(todo) != 1 else ''} to download — see {out.name}")


if __name__ == "__main__":
    main()
