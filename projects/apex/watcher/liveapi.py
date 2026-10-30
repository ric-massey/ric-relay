"""Apex's own event stream, straight from the game.

    python liveapi.py               # listen, accumulate, send
    python liveapi.py --dry         # listen and print, send nothing
    python liveapi.py --raw         # also write every event to liveapi-raw.jsonl

── the thing that changes everything ──
Respawn ship a first-party API and have since 2023. It is in the game folder:

    Apex Legends/LiveAPI/{readme.txt, events.proto, config.json, changelog.txt}

Every note in this project up to now — and the page itself — says Apex has no
API and that the three banner trackers are the only keyhole. That was wrong. It
is wrong in the README, it is wrong in AGENTS.md, and it was wrong in the
reasoning that built `pull-apex.py`. The keyhole is real for LIFETIME totals,
which genuinely are not exposed anywhere. It was never true for matches.

The game connects out to a WebSocket server on localhost and pushes events as
they happen: every shot that lands, every knock, every kill with the weapon
that did it, the placement the squad finished in, the moment the squad died.
Exact integers from the game's own state. No OCR, no calibration, no reading
digits off a scrim, no possibility of a 4 arriving as a 1.

This is also the answer to "instantly". `SquadEliminated` fires at the moment
of death, before the summary screen has even drawn.

── how it is switched on ──
One Steam launch option and a restart:

    +cl_liveapi_enabled 1

The config next to it lives in
`%USERPROFILE%\\Saved Games\\Respawn\\Apex\\assets\\temp\\live_api\\config.json`
and is already written. It sets JSON rather than protobuf, so there is no
protoc step and no generated bindings in the repo, and it turns request
handling OFF — the game talks, this listens, and nothing here can ever tell
Apex to do anything.

── anti-cheat ──
Not a question. This is Respawn's own feature, documented in their own readme,
switched on by their own command line flag. The game opens the connection
outward to a socket on loopback. Nothing attaches to the process.

── what it does NOT give ──
Lifetime career totals and the legend banner trackers. Those are menu screens,
not gameplay events, and no event in events.proto carries them. That is what
the OCR watcher in this folder is still for — see watch-apex.py. The two are
complementary now rather than alternatives: LiveAPI owns matches, OCR owns the
lifetime numbers behind the menus.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from spool import Spool

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "config.json"
RAW_LOG = HERE / "liveapi-raw.jsonl"

HOST, PORT = "127.0.0.1", 7777


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_config() -> dict:
    if not CONFIG.exists():
        sys.exit(f"No config at {CONFIG} — copy config.example.json and fill it in.")
    return json.loads(CONFIG.read_text(encoding="utf-8-sig"))


def norm(event: dict) -> tuple[str, dict]:
    """Get a (category, body) pair out of whatever shape the event arrived in.

    LiveAPI v2 can wrap each message in a `LiveAPIEvent` envelope, and the JSON
    serialiser names the inner type in a field whose spelling has moved between
    seasons. Rather than pin a version, look for the message wherever it is and
    carry on — a listener that throws on an envelope change would go silently
    deaf on a patch day, which is exactly when nobody is watching the log.
    """
    body = event
    if isinstance(event.get("gameMessage"), dict):
        body = event["gameMessage"]

    category = (
        body.get("category")
        or body.get("_type")
        or body.get("@type", "").rsplit(".", 1)[-1]
        or event.get("category", "")
    )
    return str(category), body


def player_name(p) -> str:
    return (p or {}).get("name", "") if isinstance(p, dict) else ""


class Match:
    """One match, accumulated as it happens.

    Two tallies are kept for the numbers the game also reports itself: the one
    counted here from combat events, and the one Apex sends in
    `PlayerStatChanged`. The game's own number wins wherever it exists. Counting
    events is how you get a plausible number; taking the game's stat is how you
    get the right one, and the two disagreeing is worth knowing about rather
    than papering over — a mismatch usually means an event was missed, which is
    a thing to fix rather than average away.
    """

    def __init__(self, me: str):
        self.me = me
        self.id = str(uuid.uuid4())
        self.started = now_iso()
        self.map = None
        self.playlist = None
        self.legend = None

        self.counted = Counter()          # what this file saw happen
        self.reported = {}                # what Apex said the totals were
        self.damage = 0
        self.by_weapon: dict[str, int] = defaultdict(int)

        self.place = None
        self.killed_by_weapon = None
        self.killed_by_legend = None
        self.ended = False
        # Whether his name has turned up in this match at all, in any role —
        # including purely as somebody else's victim. See attributed().
        self.saw_me = False

    def mine(self, p) -> bool:
        if player_name(p) == self.me and self.me:
            self.saw_me = True
            return True
        return False

    def stat(self, name: str) -> int | None:
        """The game's number if it gave one, otherwise the counted one."""
        if name in self.reported:
            return self.reported[name]
        return self.counted.get(name) if name in self.counted else None

    def attributed(self) -> bool:
        """Did Apex ever mention him in this match?

        The question the listener has to be able to answer about itself: a
        gamertag that does not match the name Apex uses produces a listener
        that connects, logs happily, and records nothing all night, and this is
        the only way to notice.

        Note carefully what this asks — whether his NAME appeared, not whether
        he DID anything. A match where he dropped hot, got beamed before he
        fired a shot and finished twelfth is a real match with a real placement
        and zero of everything else. That is a match worth having on the page;
        it is arguably the most honest kind. Testing for damage or kills here
        would silently discard exactly those, and the average kills-per-game
        would climb every time he had a bad drop.
        """
        return self.saw_me

    def mismatches(self) -> list[str]:
        out = []
        for name, reported in self.reported.items():
            counted = self.counted.get(name)
            if counted is not None and counted != reported:
                out.append(f"{name}: game said {reported}, saw {counted}")
        return out

    def body(self, mode: str) -> dict:
        """What goes to the Worker.

        Other players appear in nearly every event — names, positions, the
        stable `nucleusHash` that identifies an EA account across matches. None
        of it goes anywhere. The site publishes Ric's numbers; the people he
        happened to be matched against did not agree to be on it.

        The one thing kept about the player who killed him is the WEAPON and
        the LEGEND. Those are facts about the fight, they are what makes a
        death worth reading about later, and neither one identifies anybody.
        """
        return {
            "id": self.id,
            "at": now_iso(),
            "mode": mode,
            "legend": self.legend,
            "map": self.map,
            "playlist": self.playlist,

            "kills": self.stat("kills"),
            "knocks": self.stat("knockdowns"),
            "assists": self.stat("assists"),
            "revives": self.stat("revivesGiven"),
            "damage": self.damage or None,
            "place": self.place,

            "byWeapon": dict(sorted(self.by_weapon.items(), key=lambda kv: -kv[1])[:12]) or None,
            "killedByWeapon": self.killed_by_weapon,
            "killedByLegend": self.killed_by_legend,

            # Every number here came out of the game's own event stream, so
            # there is nothing to be uncertain about and no confidence to send.
            # The Worker treats an absent confidence block as "not OCR".
            "source": "liveapi",
            "notes": self.mismatches() or None,
        }


class Listener:
    def __init__(self, config: dict, dry: bool = False, raw: bool = False):
        self.config = config
        self.me = config.get("gamertag") or config.get("liveapi_name") or ""
        self.mode = config.get("mode", "br")
        self.dry = dry
        self.raw = raw
        self.match: Match | None = None
        self.seen_names: Counter = Counter()
        self.warned = False
        self.spool = Spool(
            base=config["worker"], token=config.get("token", ""),
            path=HERE / "spool.jsonl", dry=dry,
        )

    # ── plumbing ─────────────────────────────────────────────────────────────

    def log_raw(self, event: dict) -> None:
        if not self.raw:
            return
        with RAW_LOG.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, separators=(",", ":")) + "\n")

    def fresh(self) -> Match:
        self.match = Match(self.me)
        return self.match

    # ── the events ───────────────────────────────────────────────────────────

    def handle(self, category: str, body: dict) -> None:
        cat = category.lower()

        # Match lifecycle first, so that by the time names are scanned there is
        # always a match to record them against. Doing this the other way round
        # loses the very first event of a session — which, for someone who
        # started the listener after the game, is the event that would have
        # proved the match was his.
        if cat == "matchsetup":
            m = self.fresh()
            m.map = body.get("map")
            m.playlist = body.get("playlistName")
            print(f"[{now_iso()}] match starting — {m.map or '?'} / {m.playlist or '?'}")
            return

        if cat == "init":
            print(f"  connected: Apex {body.get('gameVersion', '?')} on {body.get('platform', '?')}")
            return

        if self.match is None:
            # Events before a MatchSetup — the game was already in a match when
            # the listener started. Take what is there rather than dropping the
            # match entirely; a partial match flagged as partial beats nothing.
            self.match = Match(self.me)
            self.match.map = "(joined late)"
        m = self.match

        # Track every name seen, so a misconfigured gamertag is diagnosable
        # instead of just producing a match full of zeroes. Doing it here, over
        # every role an event can carry, is also what makes `saw_me` reliable:
        # the branches below ask about specific roles and short-circuit, so his
        # name can appear in an event that never calls `mine()` on it — being
        # somebody else's victim is exactly that case, and it is the one that
        # proves the match was his.
        for key in ("player", "attacker", "victim", "awardedTo", "assistant", "revived"):
            name = player_name(body.get(key))
            if not name:
                continue
            self.seen_names[name] += 1
            if name == self.me and self.match:
                self.match.saw_me = True
        for key in ("players", "winners", "respawnedTeammates"):
            for p in body.get(key, []) or []:
                name = player_name(p)
                if not name:
                    continue
                self.seen_names[name] += 1
                if name == self.me and self.match:
                    self.match.saw_me = True

        if cat == "characterselected" and m.mine(body.get("player")):
            m.legend = (body.get("player") or {}).get("character")
            print(f"  legend: {m.legend}")

        elif cat == "playerdamaged":
            if m.mine(body.get("attacker")) and not m.mine(body.get("victim")):
                amount = int(body.get("damageInflicted") or 0)
                m.damage += amount
                weapon = body.get("weapon") or "unknown"
                m.by_weapon[weapon] += amount

        elif cat == "playerkilled":
            if m.mine(body.get("awardedTo")) or m.mine(body.get("attacker")):
                m.counted["kills"] += 1
            if m.mine(body.get("victim")):
                # His own death. Not the end of the match — he can be respawned.
                m.killed_by_weapon = body.get("weapon")
                m.killed_by_legend = (body.get("attacker") or {}).get("character")

        elif cat == "playerdowned":
            if m.mine(body.get("attacker")):
                m.counted["knockdowns"] += 1

        elif cat == "playerassist" and m.mine(body.get("assistant")):
            m.counted["assists"] += 1

        elif cat == "playerrevive" and m.mine(body.get("player")):
            m.counted["revivesGiven"] += 1

        elif cat == "playerstatchanged" and m.mine(body.get("player")):
            # The game's own running total. Authoritative — see Match.stat.
            name = body.get("statName")
            if name:
                m.reported[name] = int(body.get("newValue") or 0)

        elif cat == "squadeliminated":
            if any(m.mine(p) for p in body.get("players", [])):
                m.place = int(body.get("placement") or 0) or None
                self.finish(m, "squad eliminated")
            elif not m.attributed():
                # A squad died and none of it was his — either he is spectating,
                # or the gamertag in config.json is not the name Apex uses. The
                # second is far more likely and is otherwise invisible: the
                # listener would sit there all night looking healthy and sending
                # nothing. Say so, loudly, once per match.
                self.misattributed(body.get("players", []))

        elif cat == "matchstateend":
            if any(m.mine(p) for p in body.get("winners", [])):
                m.place = 1
            self.finish(m, "match ended")

    def misattributed(self, players: list) -> None:
        """The loudest thing this program prints.

        Nothing was attributed to him all match. Almost always the gamertag: on
        PC the name Apex uses is the EA account name, which is not necessarily
        the Xbox gamertag the rest of this project was built around, and there
        is no event that says "this one is you" to check it against.

        So print the names actually seen and stop. A silent listener looks
        identical to a working one, and that is the failure worth shouting at.
        """
        if self.warned:
            return
        self.warned = True
        seen = ", ".join(f"{n} ({c})" for n, c in self.seen_names.most_common(10))
        print("\n  !! nothing this match was attributed to you — no record sent.")
        print(f"     config.json says gamertag: {self.me!r}")
        print(f"     names Apex actually sent:  {seen or '(none)'}")
        print("     Set `gamertag` to whichever of those is you and restart the listener.\n")

    def finish(self, m: Match, why: str) -> None:
        if m.ended:
            return
        m.ended = True

        if not m.attributed():
            # Nothing of his in it. Sending a record of all-nulls would put a
            # phantom match on the page and drag every average through it.
            self.misattributed([])
            self.match = None
            return
        body = m.body(self.mode)
        self.spool.post("/apex/match", body)

        shown = {k: body[k] for k in ("kills", "knocks", "assists", "damage", "place", "legend")}
        print(f"  {why} — {shown}")
        for note in m.mismatches():
            print(f"  ! {note}")
        self.match = None

    # ── the socket ───────────────────────────────────────────────────────────

    async def serve(self, websocket) -> None:
        print(f"[{now_iso()}] Apex connected")
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    # Protobuf. The config asks for JSON; if this fires, the
                    # game was launched with an override and the config is not
                    # winning. Say so rather than silently reading nothing.
                    print("  ! binary frame — the game is sending protobuf. Set "
                          "cl_liveapi_use_protobuf 0 (see config.json).")
                    continue
                try:
                    event = json.loads(message)
                except json.JSONDecodeError:
                    continue
                self.log_raw(event)
                try:
                    self.handle(*norm(event))
                except Exception as exc:       # noqa: BLE001 — one bad event must not end the match
                    print(f"  ! {type(exc).__name__} handling event: {exc}")
        finally:
            print(f"[{now_iso()}] Apex disconnected")
            # A disconnect mid-match is the game closing or crashing. Send what
            # was accumulated rather than losing it: a match with a missing
            # placement is still a match, and Apex will not mention it again.
            if self.match and not self.match.ended:
                self.finish(self.match, "connection lost mid-match")

    async def run(self) -> None:
        # websockets 14 moved the server to `websockets.asyncio.server` and left
        # `websockets.serve` as a deprecated alias that will eventually go. Ask
        # for the new one and fall back, so this works on both sides of that
        # change rather than pinning a version that will age.
        try:
            from websockets.asyncio.server import serve
        except ImportError:
            try:
                from websockets import serve            # type: ignore[attr-defined]
            except ImportError:
                sys.exit("pip install websockets  (see requirements.txt)")

        print(f"listening on ws://{HOST}:{PORT}"
              f"{'  DRY RUN' if self.dry else '  -> ' + self.config['worker']}")
        print(f"gamertag: {self.me or '(NOT SET — see config.json)'}")
        print("\nApex needs launching with:  +cl_liveapi_enabled 1")
        print("Steam > Apex Legends > Properties > Launch Options. Restart required.\n")

        async with serve(self.serve, HOST, PORT, max_size=2 ** 22):
            await asyncio.Future()


def main() -> None:
    ap = argparse.ArgumentParser(description="Listen to Apex's LiveAPI and push matches to the site.")
    ap.add_argument("--dry", action="store_true", help="print, send nothing")
    ap.add_argument("--raw", action="store_true", help="log every event to liveapi-raw.jsonl")
    args = ap.parse_args()

    listener = Listener(load_config(), dry=args.dry, raw=args.raw)
    try:
        asyncio.run(listener.run())
    except KeyboardInterrupt:
        listener.spool.flush()
        print("\nstopped")


if __name__ == "__main__":
    main()
