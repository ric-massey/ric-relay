"""Talk to Riot the way the VALORANT client itself does — through the Riot
Client that is already running and signed in on this machine.

No password, no key and no token is ever stored. Each run reads the Riot
Client's lockfile (a port and a one-time local password it writes while it's
open), asks the client for a short-lived access token, uses it for a few GETs,
and forgets it. If the Riot Client isn't running there is nothing to read and
the watcher simply waits for the next session.

Read-only: every call here is a GET for Ric's own match history, match
details and rank. Nothing is written to Riot.

These are the client's own endpoints, not Riot's public developer API (which
has no personal keys for VALORANT). Riot doesn't support them for third
parties; they read no game memory. See README.md.
"""

import base64
import json
import os
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path

LOCAL = Path(os.environ.get("LOCALAPPDATA", ""))
LOCKFILE = LOCAL / "Riot Games" / "Riot Client" / "Config" / "lockfile"
SHOOTER_LOG = LOCAL / "VALORANT" / "Saved" / "Logs" / "ShooterGame.log"

# The platform blob every client request carries (Windows, 64-bit).
PLATFORM = base64.b64encode(json.dumps({
    "platformType": "PC", "platformOS": "Windows",
    "platformOSVersion": "10.0.19042.1.256.64bit", "platformChipset": "Unknown",
}).encode()).decode()


class NotRunning(Exception):
    pass


def _local_ctx():
    # The Riot Client serves 127.0.0.1 with a self-signed certificate. Skipping
    # verification is only ever done for this loopback call.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def session():
    """Return a Session, or raise NotRunning."""
    try:
        name, pid, port, password, proto = LOCKFILE.read_text().strip().split(":")
    except (FileNotFoundError, ValueError):
        raise NotRunning("Riot Client isn't running")
    basic = base64.b64encode(f"riot:{password}".encode()).decode()
    req = urllib.request.Request(f"https://127.0.0.1:{port}/entitlements/v1/token",
                                 headers={"Authorization": f"Basic {basic}"})
    try:
        with urllib.request.urlopen(req, context=_local_ctx(), timeout=10) as r:
            ent = json.load(r)
    except urllib.error.HTTPError as e:
        # 404 here means the client is up (often just in the tray) but nobody
        # is signed in to it yet
        raise NotRunning("Riot Client is open but not signed in" if e.code == 404
                         else f"Riot Client answered {e.code}")
    except Exception as e:
        raise NotRunning(f"Riot Client didn't answer ({e.__class__.__name__})")
    if not ent.get("accessToken"):
        raise NotRunning("Riot Client is open but not signed in")
    shard, version = _from_log()
    return Session(ent["accessToken"], ent["token"], ent["subject"], shard, version)


def _from_log():
    """Region shard and client version, from the game's own log."""
    shard, version = "na", None
    try:
        text = SHOOTER_LOG.read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return shard, version
    m = re.search(r"https://pd\.(\w+)\.a\.pvp\.net", text)
    if m:
        shard = m.group(1)
    m = re.search(r"CI server version: (release-[\d.]+)-shipping-(\d+)-(\d+)", text)
    if m:
        version = f"{m.group(1)}-shipping-{m.group(2)}-{m.group(3)}"
    return shard, version


class Session:
    def __init__(self, access, entitlement, puuid, shard, version):
        self._h = {"Authorization": f"Bearer {access}", "X-Riot-Entitlements-JWT": entitlement,
                   "X-Riot-ClientPlatform": PLATFORM, "User-Agent": "ric-terminal-val/1"}
        if version:
            self._h["X-Riot-ClientVersion"] = version
        self.puuid, self.shard = puuid, shard

    def get(self, path):
        req = urllib.request.Request(f"https://pd.{self.shard}.a.pvp.net{path}", headers=self._h)
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)

    def history(self, start=0, end=20):
        return self.get(f"/match-history/v1/history/{self.puuid}?startIndex={start}&endIndex={end}")

    def match(self, match_id):
        return self.get(f"/match-details/v1/matches/{match_id}")

    def mmr(self):
        return self.get(f"/mmr/v1/players/{self.puuid}")
