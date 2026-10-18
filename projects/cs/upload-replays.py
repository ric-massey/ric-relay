#!/usr/bin/env python3
"""Keep the CS replays in Cloudflare R2 instead of git.

    python projects/cs/upload-replays.py           # send any new or changed replay, check each
    python projects/cs/upload-replays.py --check   # which replays R2 has, and which match
    python projects/cs/upload-replays.py --pull    # fetch every replay back into matches/
    python projects/cs/upload-replays.py --move    # one-time: stop tracking matches/ in git

A replay (matches/<id>.js, written by parse-demos.py) is 0.5-0.7 MB and there
will be one for every game. In git they would pass the gigabyte GitHub Pages
allows at a few hundred games, and git keeps every one forever even after a
delete. R2 has no such limit and no charge for reading, and the Worker that
already serves the climbing media serves these too: GET /cs/replay/<id> is
public, PUT needs the site password (LOG_TOKEN). cs.html asks R2 first and
falls back to the repo's copy, so nothing breaks while both exist.

matches/ on this machine stays the source: stats.py, export-llm.py and the
rest read it there. --pull rebuilds it from R2 on a machine that has none.

The token is read from the LOG_TOKEN environment variable, else from Windows
Credential Manager under `ric-terminal/log-token`. Store it once with

    python projects/cs/creds.py set ric-terminal/log-token

(type it, press Enter, then Ctrl+Z and Enter). Never put it in a file here.

--move is the cutover and is only allowed once every replay in cs-data.js is
in R2 and reads back byte for byte. It writes matches/.gitignore (ignore
everything but itself) and untracks the folder, keeping the files on disk.
It does not commit; the next sync does, or Ric. The replays stay in git's
history, which is the one thing that cannot be taken back out without a
rewrite, and nothing new is added to it.
"""

import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import csdata  # noqa: E402

WORKER = os.environ.get("CS_WORKER", "https://training-log.rmbuster82.workers.dev")
CRED = "ric-terminal/log-token"
UA = "ric-terminal-cs/1 (+https://ricmassey.com)"   # Cloudflare refuses Python-urllib's own (error 1010)
IGNORE = csdata.MATCH_DIR / ".gitignore"


def token():
    if os.environ.get("LOG_TOKEN"):
        return os.environ["LOG_TOKEN"].strip()
    try:
        import creds
        return (creds.get(CRED) or "").strip() or None
    except Exception:
        return None


def ask(method, mid, body=None, tok=None):
    url = f"{WORKER}/cs/replay/{mid}"
    headers = {"user-agent": UA}
    if tok:
        headers["authorization"] = "Bearer " + tok
    if body is not None:
        headers["content-type"] = "text/javascript; charset=utf-8"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def version(data):
    """What cs.html puts in ?v= so a re-parsed replay is a new URL."""
    return hashlib.sha1(data).hexdigest()[:10]


def files():
    return sorted(csdata.MATCH_DIR.glob("*.js"))


def upload():
    tok = token()
    if not tok:
        print(f"r2: no token (set LOG_TOKEN or `python creds.py set {CRED}`) — replays stay in git for now")
        return 0
    st = csdata.read_state()
    sent = st.setdefault("r2", {})
    n = bad = 0
    for f in files():
        data = f.read_bytes()
        v = version(data)
        if sent.get(f.stem) == v:
            continue
        code, out = ask("PUT", f.stem, data, tok)
        if code != 200:
            print(f"r2: {f.stem} refused ({code}) {out[:200].decode('utf-8', 'replace')}")
            bad += 1
            if code in (401, 429):
                break                                # no use hammering the throttle
            continue
        code, back = ask("GET", f.stem)
        if code != 200 or back != data:
            print(f"r2: {f.stem} uploaded but did not read back the same ({code})")
            bad += 1
            continue
        sent[f.stem] = v
        n += 1
    csdata.write_state(st)
    print(f"r2: {n} replay(s) sent" + (f", {bad} failed" if bad else ""))
    return 1 if bad else 0


def stamp():
    """Write each match's replay version into cs-data.js (replay_v)."""
    data = csdata.load()
    changed = False
    for m in data["matches"]:
        f = csdata.MATCH_DIR / f"{m['id']}.js"
        if m.get("replay") and f.exists():
            v = version(f.read_bytes())
            if m.get("replay_v") != v:
                m["replay_v"] = v
                changed = True
    if changed:
        csdata.save(data)


def check(quiet=False):
    """{id: True if R2's copy matches the local one, False if not, None if R2 has none}."""
    out = {}
    for m in csdata.load()["matches"]:
        if not m.get("replay"):
            continue
        f = csdata.MATCH_DIR / f"{m['id']}.js"
        code, back = ask("GET", m["id"])
        out[m["id"]] = None if code != 200 else (not f.exists() or back == f.read_bytes())
    if not quiet:
        have = sum(1 for v in out.values() if v)
        print(f"r2: {have} of {len(out)} replays in R2 and matching"
              + "".join(f"\n  {k}: {'missing' if v is None else 'different'}" for k, v in out.items() if not v))
    return out


def pull():
    csdata.MATCH_DIR.mkdir(exist_ok=True)
    got = 0
    for m in csdata.load()["matches"]:
        if not m.get("replay"):
            continue
        code, back = ask("GET", m["id"])
        if code == 200:
            (csdata.MATCH_DIR / f"{m['id']}.js").write_bytes(back)
            got += 1
        else:
            print(f"r2: {m['id']} not in R2 ({code})")
    print(f"r2: {got} replay(s) fetched into {csdata.MATCH_DIR}")


def move():
    if IGNORE.exists():
        print("r2: already moved — matches/ is not tracked")
        return 0
    state = check(quiet=True)
    missing = [k for k, v in state.items() if not v]
    if not state or missing:
        print(f"r2: not moving — {len(missing)} replay(s) not in R2 or not matching: {', '.join(missing[:5])}")
        return 1
    IGNORE.write_text("# The replays live in Cloudflare R2 (upload-replays.py); these copies are this machine's.\n*\n!.gitignore\n",
                      encoding="utf-8", newline="\n")
    repo = csdata.HERE.parent.parent
    rel = csdata.MATCH_DIR.relative_to(repo).as_posix()
    subprocess.run(["git", "rm", "-r", "-q", "--cached", "--", rel], cwd=repo, check=True)
    subprocess.run(["git", "add", "--", f"{rel}/.gitignore"], cwd=repo, check=True)
    print(f"r2: {len(state)} replays are in R2; {rel} is untracked (files kept). Commit to finish.")
    return 0


def main():
    if "--check" in sys.argv:
        return 0 if all(check().values()) else 1
    if "--pull" in sys.argv:
        return pull()
    if "--move" in sys.argv:
        return move()
    stamp()
    return upload()


if __name__ == "__main__":
    sys.exit(main() or 0)
