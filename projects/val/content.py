"""VALORANT's own names for things, so the data can say "Jett with a Vandal at
A Main" instead of three UUIDs and two numbers.

Match details from Riot are all ids: agents, weapons, armor, maps, ranks. This
reads them once from valorant-api.com (a community mirror of the game's own
asset files), caches them locally in .content.json, and refreshes when a match
mentions something the cache doesn't know (a new agent, a new map).

It also downloads each played map's minimap into projects/val/maps/ — the page
draws fights on it — so the page itself makes no outside requests.
"""

import json
import math
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".content.json"
MAPS_DIR = HERE / "maps"
API = "https://valorant-api.com/v1"


def _get(path):
    req = urllib.request.Request(API + path, headers={"User-Agent": "ric-terminal-val/1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["data"]


def _refresh():
    agents = _get("/agents?isPlayableCharacter=true")
    weapons = _get("/weapons")
    gear = _get("/gear")
    maps = _get("/maps")
    tiers = _get("/competitivetiers")
    c = {
        "read": time.strftime("%Y-%m-%d"),
        "agents": {a["uuid"].lower(): {
            "name": a["displayName"],
            "role": (a.get("role") or {}).get("displayName"),
            "abilities": {(ab.get("slot") or "").lower(): ab["displayName"] for ab in a.get("abilities", [])},
        } for a in agents},
        "weapons": {w["uuid"].lower(): w["displayName"] for w in weapons},
        "gear": {g["uuid"].lower(): g["displayName"] for g in gear},
        "maps": {m["mapUrl"]: {
            "uuid": m["uuid"], "name": m["displayName"], "icon": m.get("displayIcon"),
            "xm": m.get("xMultiplier"), "ym": m.get("yMultiplier"),
            "xa": m.get("xScalarToAdd"), "ya": m.get("yScalarToAdd"),
            "callouts": [{"name": f"{c_['superRegionName']} {c_['regionName']}".strip()
                          if c_.get("superRegionName") not in (None, "", "Mid") else
                          ("Mid " + c_["regionName"] if c_.get("superRegionName") == "Mid" else c_["regionName"]),
                          "x": c_["location"]["x"], "y": c_["location"]["y"]}
                         for c_ in (m.get("callouts") or [])],
        } for m in maps if m.get("mapUrl")},
        # the newest episode's tier table
        "tiers": {str(t["tier"]): t["tierName"].title() for t in tiers[-1]["tiers"]},
    }
    tmp = CACHE.with_suffix(".tmp")
    tmp.write_text(json.dumps(c), encoding="utf-8", newline="\n")
    tmp.replace(CACHE)
    return c


class Content:
    def __init__(self):
        try:
            self.c = json.loads(CACHE.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError):
            self.c = _refresh()
        self._fresh = False

    def _ensure(self, table, key):
        if key and key.lower() not in self.c[table] and key not in self.c[table] and not self._fresh:
            self.c, self._fresh = _refresh(), True

    def agent(self, uuid):
        self._ensure("agents", uuid)
        return (self.c["agents"].get((uuid or "").lower()) or {}).get("name") or "Unknown agent"

    def ability(self, agent_uuid, slot):
        a = self.c["agents"].get((agent_uuid or "").lower()) or {}
        s = (slot or "").lower()
        return a.get("abilities", {}).get(s) or a.get("abilities", {}).get(s.replace("ability", "ability")) or slot

    def item(self, uuid):
        if not uuid:
            return None
        self._ensure("weapons", uuid)
        u = uuid.lower()
        return self.c["weapons"].get(u) or self.c["gear"].get(u) or None

    def tier(self, n):
        return self.c["tiers"].get(str(n), "Unrated" if not n else f"Tier {n}")

    def map(self, url):
        self._ensure("maps", url)
        return self.c["maps"].get(url)

    def place(self, map_url, x, y):
        """Nearest named callout to a point — Riot's own callout names."""
        m = self.map(map_url)
        if not m or x is None or not m["callouts"]:
            return None
        best = min(m["callouts"], key=lambda c: (c["x"] - x) ** 2 + (c["y"] - y) ** 2)
        return best["name"]

    def minimap(self, map_url):
        """Local path (relative to projects/val/) of the minimap, fetched once."""
        m = self.map(map_url)
        if not m or not m.get("icon"):
            return None
        MAPS_DIR.mkdir(exist_ok=True)
        name = "".join(ch for ch in m["name"].lower() if ch.isalnum()) + ".png"
        out = MAPS_DIR / name
        if not out.exists():
            req = urllib.request.Request(m["icon"], headers={"User-Agent": "ric-terminal-val/1"})
            with urllib.request.urlopen(req, timeout=60) as r:
                out.write_bytes(r.read())
        return f"maps/{name}"


def to_minimap(m, x, y):
    """Game (x, y) → 0..1 on the minimap image. Valorant swaps the axes."""
    return (y * m["xm"] + m["xa"], x * m["ym"] + m["ya"])


def metres(a, b):
    if not a or not b or None in (a.get("x"), b.get("x")):
        return None
    return round(math.hypot(a["x"] - b["x"], a["y"] - b["y"]) / 100, 1)
