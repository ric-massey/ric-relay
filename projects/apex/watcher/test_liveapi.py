"""A fake Apex, so the listener can be proved right without playing a match.

    .venv\\Scripts\\python test_liveapi.py

Replays a realistic match into the real `Listener` — the same accumulator, the
same event handlers, the same code that builds the record — and checks what
comes out the other end. Nothing is mocked except the game and the network.

Why this exists rather than "play a game and see": a match is fifteen minutes
and cannot be re-run with one event changed. The interesting cases here — the
game's own stat disagreeing with the counted one, a death that is not the end
of the match because a teammate respawns you, a connection dropping mid-fight —
are all things that happen rarely and matter every time. Waiting to observe
each one in the wild is not a test plan.

What this CANNOT tell us, and no amount of local testing will: the exact JSON
shape Apex actually emits, and whether public matchmaking permits LiveAPI at
all. Those need one real match with `liveapi.py --raw`. The events below are
built from events.proto, which is Respawn's own file, so the field names are
right — but the envelope around them is an educated guess until a real one
lands in liveapi-raw.jsonl.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import liveapi  # noqa: E402


ME = "RicGoneCrazy"
THEM = "SomeOtherPlayer"


def player(name: str, character: str = "Caustic", health: int = 100) -> dict:
    return {
        "name": name, "teamId": 3 if name == ME else 7, "character": character,
        "currentHealth": health, "maxHealth": 100, "shieldHealth": 50,
        "nucleusHash": "hash-" + name, "squadIndex": 1,
    }


def ev(category: str, **fields) -> str:
    return json.dumps({"category": category, "timestamp": 1756000000, **fields})


# One match, in the order Apex would send it.
MATCH = [
    ev("init", gameVersion="v29.1", platform="PC"),
    ev("matchSetup", map="Storm Point", playlistName="Battle Royale - Ranked"),
    ev("characterSelected", player=player(ME, "Alter")),
    ev("gameStateChanged", state="Playing"),

    # A fight he wins: two hits, a knock, a kill.
    ev("playerDamaged", attacker=player(ME, "Alter"), victim=player(THEM),
       weapon="R-301 Carbine", damageInflicted=45),
    ev("playerDamaged", attacker=player(ME, "Alter"), victim=player(THEM),
       weapon="R-301 Carbine", damageInflicted=55),
    ev("playerDowned", attacker=player(ME, "Alter"), victim=player(THEM), weapon="R-301 Carbine"),
    ev("playerKilled", attacker=player(ME, "Alter"), victim=player(THEM),
       awardedTo=player(ME, "Alter"), weapon="R-301 Carbine"),

    # Apex's own running totals arrive separately, and are authoritative.
    ev("playerStatChanged", player=player(ME, "Alter"), statName="knockdowns", newValue=1),
    ev("playerStatChanged", player=player(ME, "Alter"), statName="kills", newValue=1),

    # A second fight, different gun.
    ev("playerDamaged", attacker=player(ME, "Alter"), victim=player("ThirdParty"),
       weapon="Peacekeeper", damageInflicted=90),
    ev("playerAssist", assistant=player(ME, "Alter"), victim=player("ThirdParty"),
       weapon="Peacekeeper"),

    # Somebody takes him down.
    ev("playerKilled", attacker=player("Nemesis", "Bloodhound"), victim=player(ME, "Alter"),
       awardedTo=player("Nemesis", "Bloodhound"), weapon="Wingman"),

    # The squad goes with him.
    ev("squadEliminated", players=[player(ME, "Alter")], placement=4),
]


class Collector(liveapi.Spool):
    """A Spool that keeps records instead of sending them."""

    def __init__(self):
        self.sent: list[dict] = []

    def post(self, path: str, body: dict) -> None:
        self.sent.append({"path": path, "body": body})

    def flush(self) -> None:
        pass


def check(label: str, got, want) -> bool:
    ok = got == want
    print(f"  {'PASS' if ok else 'FAIL'}  {label}: got {got!r}" + ("" if ok else f", wanted {want!r}"))
    return ok


async def replay(events: list[str], me: str = ME) -> list[dict]:
    """Push events through the real Listener, via the real handler."""
    listener = liveapi.Listener(
        {"worker": "http://example.invalid", "token": "x", "gamertag": me, "mode": "ranked"},
        dry=True,
    )
    listener.spool = Collector()
    for raw in events:
        listener.handle(*liveapi.norm(json.loads(raw)))
    return listener.spool.sent


async def main() -> int:
    failures = 0

    print("\na whole match, start to squad wipe")
    sent = await replay(MATCH)
    if not check("one record sent", len(sent), 1):
        print("\n  nothing to check against — stopping")
        return 1

    body = sent[0]["body"]
    failures += not check("endpoint", sent[0]["path"], "/apex/match")
    failures += not check("legend", body["legend"], "Alter")
    failures += not check("map", body["map"], "Storm Point")
    failures += not check("kills", body["kills"], 1)
    failures += not check("knocks", body["knocks"], 1)
    failures += not check("assists", body["assists"], 1)
    failures += not check("damage", body["damage"], 190)
    failures += not check("place", body["place"], 4)
    failures += not check("killed by weapon", body["killedByWeapon"], "Wingman")
    failures += not check("killed by legend", body["killedByLegend"], "Bloodhound")
    failures += not check("source", body["source"], "liveapi")
    failures += not check("damage by weapon", body["byWeapon"],
                          {"R-301 Carbine": 100, "Peacekeeper": 90})
    failures += not check("no mismatch notes", body["notes"], None)

    print("\nthe enemy's damage is never counted as his")
    sent = await replay([
        ev("matchSetup", map="World's Edge", playlistName="Battle Royale"),
        ev("playerDamaged", attacker=player(THEM), victim=player(ME),
           weapon="Flatline", damageInflicted=75),
        ev("squadEliminated", players=[player(ME)], placement=12),
    ])
    failures += not check("damage stays empty", sent[0]["body"]["damage"], None)
    failures += not check("placement still read", sent[0]["body"]["place"], 12)

    print("\nthe game disagreeing with the count is reported, not hidden")
    sent = await replay([
        ev("matchSetup", map="Olympus", playlistName="Battle Royale"),
        ev("playerKilled", attacker=player(ME), victim=player(THEM),
           awardedTo=player(ME), weapon="Volt"),
        # Apex says three. We only saw one — two events were missed.
        ev("playerStatChanged", player=player(ME), statName="kills", newValue=3),
        ev("squadEliminated", players=[player(ME)], placement=2),
    ])
    body = sent[0]["body"]
    failures += not check("the game's number wins", body["kills"], 3)
    failures += not check("the disagreement is recorded", body["notes"],
                          ["kills: game said 3, saw 1"])

    print("\na win comes through MatchStateEnd, not a placement")
    sent = await replay([
        ev("matchSetup", map="Broken Moon", playlistName="Battle Royale"),
        ev("playerStatChanged", player=player(ME), statName="kills", newValue=5),
        ev("matchStateEnd", state="Postmatch", winners=[player(ME)]),
    ])
    failures += not check("placement is 1", sent[0]["body"]["place"], 1)

    print("\nhis own death is not the end of the match — he can be respawned")
    sent = await replay([
        ev("matchSetup", map="Storm Point", playlistName="Battle Royale"),
        ev("playerKilled", attacker=player("Nemesis"), victim=player(ME), weapon="Hemlok"),
        ev("playerRespawnTeam", player=player("Teammate"), respawnedTeammates=[player(ME)]),
        ev("playerDamaged", attacker=player(ME), victim=player(THEM),
           weapon="Mozambique", damageInflicted=30),
        ev("squadEliminated", players=[player(ME)], placement=6),
    ])
    body = sent[0]["body"]
    failures += not check("only one record", len(sent), 1)
    failures += not check("damage after the respawn counts", body["damage"], 30)
    failures += not check("placement is the real one", body["place"], 6)

    print("\na match already running when the listener starts is still captured")
    sent = await replay([
        ev("playerDamaged", attacker=player(ME), victim=player(THEM),
           weapon="Havoc", damageInflicted=60),
        ev("squadEliminated", players=[player(ME)], placement=9),
    ])
    failures += not check("recorded anyway", sent[0]["body"]["damage"], 60)
    failures += not check("marked as joined late", sent[0]["body"]["map"], "(joined late)")

    print("\na wrong gamertag sends nothing and says so, rather than a phantom match")
    # The worst failure this program has: it connects, logs happily, and records
    # nothing all night. A record of all-nulls would be worse still — it would
    # put a phantom match on the page and drag every average through it. So the
    # rule is send nothing, and shout.
    sent = await replay(MATCH, me="WrongName")
    failures += not check("no record sent", len(sent), 0)

    print("\nthe envelope shape does not matter")
    sent = await replay([
        json.dumps({"gameMessage": {"category": "matchSetup", "map": "Kings Canyon"}}),
        json.dumps({"gameMessage": {"_type": "squadEliminated",
                                    "players": [player(ME)], "placement": 3}}),
    ])
    failures += not check("wrapped events are unwrapped", sent[0]["body"]["place"], 3)
    failures += not check("and still carry the map", sent[0]["body"]["map"], "Kings Canyon")

    print(f"\n{'all passed' if not failures else str(failures) + ' FAILED'}\n")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
