"""CS2 Game State Integration: Valve's live feed, straight out of the game.

CS2 reads every gamestate_integration_*.cfg in its cfg folder and POSTs the
game's state to the address in it whenever something changes. It is the CS
equivalent of Apex's LiveAPI: first-party numbers, not a reading of the screen.

What it tells us is Ric's own view only — his team, his kills, his money,
the score, who won each round. Nobody else's name or id is ever in the payload
we keep (CS2 only describes the spectated player when Ric is dead, and those
snapshots are thrown away).

A match is written to the spool the moment the scoreboard says game over, and
merge() folds the spool into cs-data.js. The spool is append-only: nothing is
lost if the merge, the repo or the machine falls over in between.
"""

import json
import socket
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import csdata

SPOOL = csdata.HERE / ".gsi-spool.jsonl"
PORT = 3010
KEEP_MODES = {"competitive", "premier", "scrimcomp2v2", "casual"}
CFG_NAME = "gamestate_integration_ric_terminal.cfg"


def cfg_text(token):
    return f'''"Ric's Terminal - CS room"
{{
  "uri"       "http://127.0.0.1:{PORT}/"
  "timeout"   "5.0"
  "buffer"    "0.5"
  "throttle"  "0.5"
  "heartbeat" "30.0"
  "auth"      {{ "token" "{token}" }}
  "data"
  {{
    "provider"            "1"
    "map"                 "1"
    "round"               "1"
    "player_id"           "1"
    "player_state"        "1"
    "player_match_stats"  "1"
  }}
}}
'''


class Recorder:
    def __init__(self, me, token, log=print):
        self.me, self.token, self.log = me, token, log
        self.match = None
        self.lock = threading.Lock()

    # One match at a time. A new map name, or the menu, closes the old one.
    def feed(self, s):
        if (s.get("auth") or {}).get("token") != self.token:
            return
        with self.lock:
            mp = s.get("map")
            if not mp:
                self._close(left=True)
                return
            if self.match and self.match["map"] != mp.get("name"):
                self._close(left=True)
            if mp.get("mode") not in KEEP_MODES:
                return
            if not self.match:
                if mp.get("phase") not in ("warmup", "live"):
                    return
                self.match = {"map": mp.get("name"), "mode": mp.get("mode"),
                              "began": _now(), "rounds": {}, "team": None, "me": None}
            m = self.match
            pl = s.get("player") or {}
            mine = str(pl.get("steamid")) == self.me
            if mine:
                m["team"] = pl.get("team") or m["team"]
                if pl.get("match_stats"):
                    m["me"] = dict(pl["match_stats"])
            rnd = s.get("round") or {}
            n = (mp.get("team_ct") or {}).get("score", 0) + (mp.get("team_t") or {}).get("score", 0)
            if mp.get("phase") == "live" and rnd.get("phase") in ("freezetime", "live") and mine:
                cur = m["rounds"].setdefault(n + 1, {})
                st = pl.get("state") or {}
                if rnd.get("phase") == "freezetime":
                    cur["money"] = st.get("money")
                cur["equip"] = max(cur.get("equip") or 0, st.get("equip_value") or 0)
                cur["k"] = st.get("round_kills", 0)
                cur["hsk"] = st.get("round_killhs", 0)
                cur["dead"] = (st.get("health") or 0) == 0
                cur["side"] = m["team"]
            if rnd.get("phase") == "over" and rnd.get("win_team"):
                # `n` already counts the round just won, so it IS this round.
                cur = m["rounds"].setdefault(n, {})
                if "won" not in cur:
                    side = cur.get("side") or m["team"]
                    cur["side"] = side
                    cur["won"] = rnd["win_team"] == side
                    if mine:
                        st = pl.get("state") or {}
                        cur["k"] = st.get("round_kills", cur.get("k", 0))
                        cur["hsk"] = st.get("round_killhs", cur.get("hsk", 0))
                        cur["dead"] = (st.get("health") or 0) == 0
            # The score is the other witness. The last round of a match goes
            # straight to game over, and that post has no round.win_team
            # (2026-10-20: a 12-12 came out with 23 rounds), so when one side's
            # score goes up by one, that side won round n.
            ct = (mp.get("team_ct") or {}).get("score", 0)
            t = (mp.get("team_t") or {}).get("score", 0)
            was = m.get("seen")
            if was and (ct - was[0], t - was[1]) in ((1, 0), (0, 1)):
                cur = m["rounds"].setdefault(n, {})
                if "won" not in cur:
                    side = cur.get("side") or m["team"]
                    cur["side"] = side
                    cur["won"] = ("CT" if ct > was[0] else "T") == side
            m["seen"] = (ct, t)
            if mp.get("phase") == "gameover":
                us, them = (ct, t) if m["team"] == "CT" else (t, ct)
                m["score"] = [us, them]
                self._close(left=False)

    def _close(self, left):
        m, self.match = self.match, None
        if not m or not m.get("me") or not m.get("team"):
            return
        rounds = [m["rounds"][k] for k in sorted(m["rounds"]) if "won" in m["rounds"][k]]
        if not rounds:
            return
        rec = {
            "at": _now(), "began": m["began"], "map": m["map"], "mode": m["mode"],
            "left": left, "score": m.get("score") or [sum(r["won"] for r in rounds),
                                                      sum(not r["won"] for r in rounds)],
            "me": m["me"], "rounds": rounds,
        }
        with SPOOL.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(rec) + "\n")
        self.log(f"gsi: {rec['map']} {rec['score'][0]}-{rec['score'][1]} "
                 f"{'(left early)' if left else ''} spooled")

    def flush(self):
        with self.lock:
            self._close(left=True)


def serve(recorder):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            try:
                body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
                recorder.feed(json.loads(body or b"{}"))
            except Exception as e:  # never let one odd payload kill the listener
                recorder.log(f"gsi: bad payload — {e}")
            self.send_response(200)
            self.end_headers()

        def log_message(self, *a):
            pass

    class Exclusive(ThreadingHTTPServer):
        # http.server turns SO_REUSEADDR on, and on Windows that lets a second
        # process bind the same port — so a second session would never notice
        # the first. Exclusive use makes the second bind fail, as it should.
        allow_reuse_address = False

        def server_bind(self):
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            super().server_bind()

    httpd = Exclusive(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def merge(data=None):
    """Fold finished spool records into cs-data.js. A record is matched to a
    Leetify or demo row on map + score + Ric's K/D; if none exists yet it
    becomes the row, and they join it later on the same fingerprint."""
    if not SPOOL.exists():
        return 0
    own = data is None
    data = data or csdata.load()
    added = 0
    for line in SPOOL.read_text(encoding="utf-8").splitlines():
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        if rec.get("left"):
            continue   # abandoned and disconnected games aren't results
        me = rec["me"]
        probe = {"map": rec["map"], "score": rec["score"],
                 "me": {"k": me.get("kills"), "d": me.get("deaths")}}
        m = csdata.find(data, fingerprint=csdata.fingerprint_of(probe))
        if m and "gsi" in m["sources"]:
            continue
        if m is None:
            m = {"id": "gsi-" + rec["at"].replace(":", "").replace("-", "")[:15],
                 "sources": [], "at": rec["at"], "mode": rec["mode"], "map": rec["map"],
                 "score": rec["score"], "result": csdata.result(*rec["score"]),
                 "me": {"k": me.get("kills"), "d": me.get("deaths"), "a": me.get("assists"),
                        "mvps": me.get("mvps"), "score": me.get("score"),
                        "rounds": len(rec["rounds"])}}
            data["matches"].append(m)
            added += 1
        m["sources"].append("gsi")
        m.setdefault("start_side", rec["rounds"][0].get("side"))
        # Money and loadout per round are the one thing only GSI sees.
        econ = [{"money": r.get("money"), "equip": r.get("equip")} for r in rec["rounds"]]
        m["economy"] = econ
        if not m.get("rounds"):
            m["rounds"] = [{"w": r["won"], "side": r.get("side"), "k": r.get("k", 0),
                            "dead": r.get("dead", False)} for r in rec["rounds"]]
    if own:
        csdata.save(data)
    return added


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


if __name__ == "__main__":
    # Run the listener on its own (for testing): Ctrl+C to stop.
    acct = csdata.account()
    rec = Recorder(acct["steam64"], acct.get("gsi_token", ""))
    serve(rec)
    print(f"listening on 127.0.0.1:{PORT}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        rec.flush()
