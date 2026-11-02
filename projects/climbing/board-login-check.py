#!/usr/bin/env python3
"""
Try the board login the sync uses, by hand, to tell a wrong password from a
login that no longer works at all.

    python "C:\\Claude Code Projects\\ric-relay\\projects\\climbing\\board-login-check.py"

Asks for the username and the password — the password is not shown and is
never written anywhere. Prints whether the board said yes, twice: once as the
Tension app, once the way boardlib asks (it calls itself the Kilter app). And a
fingerprint of each value — its length and 4 hex characters of a hash — which
the Boards workflow prints too, so the two can be compared without the
password appearing anywhere. Four hex characters cannot give a password away.
Standard library only, so it runs without the board venv.
"""

import getpass
import hashlib
import json
import urllib.error
import urllib.request

HOST = "https://tensionboardapp2.com"   # the same host boardlib logs into
AGENTS = {
    "as the Tension app": "Tension%20Board/1 CFNetwork/1568.100.1 Darwin/24.0.0",
    "the way the sync does": "Kilter%20Board/202 CFNetwork/1568.100.1 Darwin/24.0.0",
}


def fingerprint(value):
    """Same formula as the workflow's — keep the two in step."""
    return f"{len(value)} chars, {hashlib.sha256(('board-check:' + value).encode()).hexdigest()[:4]}"


name = input("Tension username: ").strip()
password = getpass.getpass("Tension password (not shown): ")

print(f"\nusername  {fingerprint(name)}")
print(f"password  {fingerprint(password)}"
      + ("   (starts or ends with a space!)" if password != password.strip() else ""))

for label, agent in AGENTS.items():
    body = json.dumps({"username": name, "password": password,
                       "tou": "accepted", "pp": "accepted", "ua": "app"}).encode()
    req = urllib.request.Request(HOST + "/sessions", data=body, method="POST", headers={
        "Accept": "application/json", "Content-Type": "application/json", "User-Agent": agent,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            ok = "session" in json.loads(r.read() or b"{}")
            print(f"{label}: " + ("ACCEPTED" if ok else f"answered {r.status} with no session"))
    except urllib.error.HTTPError as e:
        print(f"{label}: " + ("REJECTED" if e.code == 422 else f"HTTP {e.code}"))
    except Exception as e:
        print(f"{label}: could not reach Tension ({type(e).__name__})")
