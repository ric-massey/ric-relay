#!/usr/bin/env python3
"""Keep the Captures photographs in Cloudflare R2 instead of git.

    python projects/photos/upload-photos.py           # send any new or changed photo, check each
    python projects/photos/upload-photos.py --check   # which photos R2 has, and which match
    python projects/photos/upload-photos.py --pull    # fetch every photo back into photos/
    python projects/photos/upload-photos.py --move    # one-time: stop tracking photos/ in git

photos/ is 1,325 web-optimised JPEGs, about 432 MB, and the 1,287 called
website-NNNN.jpg are 417 MB of that. GitHub Pages serves a site up to roughly a
gigabyte, the rest of the site is ~310 MB, and the album still grows - so those
were most of the ceiling.

The 38 climbing-NN.jpg stay in git: 15 MB, and page furniture rather than album
- climbing.html's hero and band, two of the front door's moving tiles and all
of projects/climbing/photos-data.js read them by path. Git also keeps
every byte forever, even after a delete. R2 has no such limit and no charge for
reading, and the Worker that already serves the climbing media and the CS
replays serves these too: GET /photo/<name> is public and immutable, PUT needs
the site password (LOG_TOKEN).

captures.html asks R2 first and falls back to the repo's copy, so nothing
breaks while both exist - which is what makes --move safe to leave until last.

photos/ on this machine stays the source. --pull rebuilds it from R2 on a
machine that has none.

The token is read from the LOG_TOKEN environment variable, else from Windows
Credential Manager under `ric-terminal/log-token`. Store it once with

    python projects/cs/creds.py set ric-terminal/log-token

(type it, press Enter, then Ctrl+Z and Enter). Never put it in a file here.

--move is the cutover and is only allowed once every photo is in R2 and reads
back byte for byte. It writes photos/.gitignore (ignore everything but itself)
and untracks the folder, keeping the files on disk. It does not commit. The
photographs stay in git's history, which is the one thing that cannot be taken
back out without a rewrite, and nothing new is added to it.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
PHOTO_DIR = REPO / "photos"
STATE = HERE / ".uploaded.json"
IGNORE = PHOTO_DIR / ".gitignore"

WORKER = os.environ.get("CS_WORKER", "https://training-log.rmbuster82.workers.dev")
CRED = "ric-terminal/log-token"
UA = "ric-terminal-photos/1 (+https://ricmassey.com)"  # Cloudflare refuses Python-urllib's own (error 1010)
TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
NAME_OK = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(jpg|jpeg|png|webp)$")
# Only the album moves. The 38 climbing-NN.jpg are 15 MB and are page furniture
# -- climbing.html's hero and band, two of the front door's moving tiles, and
# the whole of projects/climbing/photos-data.js -- so they stay in git and are
# read by path. The 1,287 website-NNNN.jpg are 417 MB and are the album; they
# are what the ceiling was made of.
ALBUM = "website-"


def token():
    if os.environ.get("LOG_TOKEN"):
        return os.environ["LOG_TOKEN"].strip()
    try:
        sys.path.insert(0, str(REPO / "projects" / "cs"))
        import creds
        return (creds.get(CRED) or "").strip() or None
    except Exception:
        return None


def ask(method, name, body=None, tok=None):
    url = f"{WORKER}/photo/{name}"
    headers = {"user-agent": UA}
    if tok:
        headers["authorization"] = "Bearer " + tok
    if body is not None:
        headers["content-type"] = TYPES.get(Path(name).suffix.lower(), "application/octet-stream")
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:                      # a dropped connection is not a refusal
        return 0, str(e).encode()


def version(data):
    return hashlib.sha1(data).hexdigest()[:10]


def files():
    if not PHOTO_DIR.is_dir():
        return []
    return sorted(p for p in PHOTO_DIR.iterdir()
                  if p.is_file() and p.name.startswith(ALBUM) and NAME_OK.match(p.name))


def read_state():
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_state(st):
    STATE.write_text(json.dumps(st, indent=1, sort_keys=True), encoding="utf-8", newline="\n")


def upload():
    tok = token()
    if not tok:
        print("r2: no token (set LOG_TOKEN or "
              "`python projects/cs/creds.py set " + CRED + "`) - photos stay in git for now")
        return 1
    sent = read_state()
    here = files()
    todo = [f for f in here if sent.get(f.name) != version(f.read_bytes())]
    print("r2: " + str(len(here)) + " photo(s) here, " + str(len(todo)) + " to send")
    n = bad = 0
    for f in todo:
        data = f.read_bytes()
        v = version(data)
        code, out = ask("PUT", f.name, data, tok)
        if code != 200:
            print("r2: " + f.name + " refused (" + str(code) + ") "
                  + out[:200].decode("utf-8", "replace"))
            bad += 1
            if code in (401, 429):
                break                            # no use hammering the throttle
            continue
        code, back = ask("GET", f.name)
        if code != 200 or back != data:
            print("r2: " + f.name + " uploaded but did not read back the same (" + str(code) + ")")
            bad += 1
            continue
        sent[f.name] = v
        n += 1
        if n % 25 == 0:
            write_state(sent)                    # a long run survives being interrupted
            print("r2: " + str(n) + "/" + str(len(todo)) + " sent")
    write_state(sent)
    print("r2: " + str(n) + " photo(s) sent" + (", " + str(bad) + " failed" if bad else ""))
    return 1 if bad else 0


def check(quiet=False):
    """{name: True if R2's copy matches the local one, False if not, None if R2 has none}."""
    out = {}
    for f in files():
        code, back = ask("GET", f.name)
        out[f.name] = None if code != 200 else (back == f.read_bytes())
    if not quiet:
        have = sum(1 for v in out.values() if v)
        missing = [k for k, v in out.items() if not v]
        print("r2: " + str(have) + " of " + str(len(out)) + " photos in R2 and matching"
              + "".join("\n  " + k + ": " + ("missing" if out[k] is None else "different")
                        for k in missing[:20])
              + ("\n  ... and " + str(len(missing) - 20) + " more" if len(missing) > 20 else ""))
    return out


def pull():
    PHOTO_DIR.mkdir(exist_ok=True)
    names = sorted(read_state()) or [f.name for f in files()]
    got = 0
    for name in names:
        code, back = ask("GET", name)
        if code == 200:
            (PHOTO_DIR / name).write_bytes(back)
            got += 1
        else:
            print("r2: " + name + " not in R2 (" + str(code) + ")")
    print("r2: " + str(got) + " photo(s) fetched into " + str(PHOTO_DIR))
    return 0


def move():
    if IGNORE.exists():
        print("r2: already moved - photos/ is not tracked")
        return 0
    state = check(quiet=True)
    missing = [k for k, v in state.items() if not v]
    if not state or missing:
        print("r2: not moving - " + str(len(missing))
              + " photo(s) not in R2 or not matching: " + ", ".join(missing[:5]))
        return 1
    IGNORE.write_text(
        "# The album lives in Cloudflare R2 (projects/photos/README.md); these copies\n"
        "# are this machine's. captures.html and the front door read them from the\n"
        "# Worker. The 38 climbing-NN.jpg stay tracked: they are page furniture for\n"
        "# climbing.html, the front door and projects/climbing/, not album.\n"
        + ALBUM + "*\n",
        encoding="utf-8", newline="\n")
    subprocess.run(["git", "rm", "-q", "--cached", "--"]
                   + ["photos/" + f.name for f in files()], cwd=REPO, check=True)
    subprocess.run(["git", "add", "--", "photos/.gitignore"], cwd=REPO, check=True)
    print("r2: " + str(len(state)) + " album photos are in R2; they are untracked"
          " (files kept) and climbing-NN.jpg stay in git. Commit to finish.")
    return 0


def main():
    if "--help" in sys.argv or "-h" in sys.argv:
        print(__doc__)
        return 0
    if "--check" in sys.argv:
        return 0 if all(check().values()) else 1
    if "--pull" in sys.argv:
        return pull()
    if "--move" in sys.argv:
        return move()
    return upload()


if __name__ == "__main__":
    sys.exit(main() or 0)
