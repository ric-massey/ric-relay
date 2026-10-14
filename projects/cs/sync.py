#!/usr/bin/env python3
"""One pass of everything the CS room knows how to collect.

    projects/cs/.cs-venv/Scripts/python projects/cs/sync.py

cs-session.pyw runs this every 30 minutes while CS2 is open and once more when
it closes. Each step runs in its own process, so one failing (Leetify down, no
Steam key yet, a demo that won't parse) never stops the others.

  0. fetch   — the bot account downloads every demo Valve still has that we don't
  1. demos   — copy any demo (fetched or downloaded in-game) into the archive and parse it
  2. gsi     — fold matches the live listener finished into cs-data.js
  3. steam   — ask Valve's match list what's new; list demos still to download
  4. leetify — backfill and the measurements only Leetify makes
  5. llm     — rewrite stats.js (the Stats section) and the plain-text reports in llm/

Then, if anything in the room's data changed (cs-data.js, matches/, llm/, stats.js), it
commits those files and only those (on main, never mid-merge). It never pushes — on this repo a push is a
publish, and that stays Ric's call.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
PY = sys.executable
DATA = ["projects/cs/cs-data.js", "projects/cs/matches", "projects/cs/llm", "projects/cs/stats.js"]
# Run from pythonw (no console), every child would otherwise flash a window.
QUIET = {"creationflags": 0x08000000} if sys.platform == "win32" else {}


def step(name, *args, exe=None):
    r = subprocess.run([exe or PY, *args], cwd=REPO, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=1800,
                       env={**os.environ, "PYTHONIOENCODING": "utf-8", "CS_PYTHON": PY}, **QUIET)
    out = (r.stdout + r.stderr).strip()
    print(out if out else f"{name}: (no output)")
    if r.returncode:
        print(f"{name}: exited {r.returncode}")


def git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, **QUIET)


def commit():
    acct = json.loads((HERE / "cs-account.json").read_text(encoding="utf-8"))
    if not acct.get("commit", True) or os.environ.get("CS_NO_COMMIT"):
        return
    if git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() != "main":
        print("commit: not on main — left uncommitted")
        return
    gitdir = REPO / ".git"
    if any((gitdir / f).exists() for f in ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD")):
        print("commit: a merge/rebase is in progress — left uncommitted")
        return
    paths = [p for p in DATA if (REPO / p).exists()]
    if not git("status", "--porcelain", "--", *paths).stdout.strip():
        return
    git("add", "--", *paths)
    r = git("commit", "-m", "CS: sync matches", "--only", "--", *paths)
    print("commit: " + (r.stdout.splitlines()[0] if r.returncode == 0 else r.stderr.strip()))


def main():
    if (HERE / "fetcher" / "node_modules").is_dir():
        step("fetch", str(HERE / "fetcher" / "fetch-demos.mjs"), exe="node")
    step("demos", str(HERE / "parse-demos.py"))
    step("gsi", "-c", f"import sys; sys.path.insert(0, {str(HERE)!r}); import gsi; "
                      "print(f'gsi: {gsi.merge()} new match(es) from the live feed')")
    step("steam", str(HERE / "steam.py"))
    step("leetify", str(HERE / "pull-leetify.py"))
    step("llm", str(HERE / "export-llm.py"))
    commit()


if __name__ == "__main__":
    main()
