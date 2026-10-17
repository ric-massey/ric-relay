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
     (if 3 or 4 turned up share codes we didn't have, 0 and 1 run again)
  5. llm     — rewrite stats.js (the Stats section) and the plain-text reports in llm/
  6. cards   — each player's link preview (p/): a page and a picture of their best round

Then, if anything in the room's data changed (cs-data.js, matches/, llm/, stats.js), it
commits those files and only those (on main, never mid-merge), then pushes
those commits so the session shows up on the site (set "push": false in
cs-account.json to stop that). It pushes only its own data commits: on this repo
a push is a publish, so anything else waiting to go out is left for Ric.

Anything that fails or is held back — a step exiting non-zero, a commit that
didn't happen, a push that was refused or skipped — is also collected and raised
as one Windows toast at the end of the run (notify.py), because under pythonw
the log is otherwise the only place it shows up.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
PY = sys.executable
DATA = ["projects/cs/cs-data.js", "projects/cs/matches", "projects/cs/llm", "projects/cs/stats.js", "projects/cs/p"]
# Run from pythonw (no console), every child would otherwise flash a window.
QUIET = {"creationflags": 0x08000000} if sys.platform == "win32" else {}
PROBLEMS = []  # one line each, toasted together at the end of the run


def problem(msg):
    print(msg)
    PROBLEMS.append(msg)


def step(name, *args, exe=None):
    try:
        r = subprocess.run([exe or PY, *args], cwd=REPO, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=1800,
                           env={**os.environ, "PYTHONIOENCODING": "utf-8", "CS_PYTHON": PY}, **QUIET)
    except (subprocess.TimeoutExpired, OSError) as e:
        # a step that hangs or won't start must not take the commit and push with it
        problem(f"{name}: {'timed out' if isinstance(e, subprocess.TimeoutExpired) else e}")
        return
    out = (r.stdout + r.stderr).strip()
    print(out if out else f"{name}: (no output)")
    if r.returncode:
        # The step's last line says what went wrong ("the bot's saved sign-in
        # was refused …"); the toast should say it too.
        last = (out.splitlines() or [""])[-1][:140]
        problem(f"{name}: exited {r.returncode}" + (f" — {last}" if last else ""))


def git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, **QUIET)


def commit():
    acct = json.loads((HERE / "cs-account.json").read_text(encoding="utf-8"))
    if not acct.get("commit", True) or os.environ.get("CS_NO_COMMIT"):
        return
    if git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() != "main":
        problem("commit: not on main — left uncommitted")
        return
    gitdir = REPO / ".git"
    if any((gitdir / f).exists() for f in ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD")):
        problem("commit: a merge/rebase is in progress — left uncommitted")
        return
    paths = [p for p in DATA if (REPO / p).exists()]
    if not git("status", "--porcelain", "--", *paths).stdout.strip():
        return
    git("add", "--", *paths)
    r = git("commit", "-m", "CS: sync matches", "--only", "--", *paths)
    if r.returncode == 0:
        print("commit: " + r.stdout.splitlines()[0])
    else:
        problem("commit: " + r.stderr.strip())


def publish():
    """Push the sync's own commits so a session shows up on the site by itself
    (Ric's call, 2026-10-14; it used to wait for him). It only ever pushes
    commits that touch nothing but this room's data: if anything else is
    waiting to go out, it leaves the lot alone and says so."""
    acct = json.loads((HERE / "cs-account.json").read_text(encoding="utf-8"))
    if not acct.get("push", True) or not acct.get("commit", True) or os.environ.get("CS_NO_COMMIT"):
        return
    if git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() != "main":
        return
    if git("fetch", "-q", "origin", "main").returncode:
        problem("push: couldn't reach GitHub — will try again next sync")
        return
    ahead = git("rev-list", "origin/main..HEAD").stdout.split()
    if not ahead:
        return
    def ours(f):
        # Whole path components: a plain prefix let projects/cs/players.json
        # through as "projects/cs/p", and cs-data.js.bak as cs-data.js.
        return any(f == p or f.startswith(p.rstrip("/") + "/") for p in DATA)
    for c in ahead:
        # A merge lists nothing in a plain diff-tree, so it would pass with
        # whatever it brought in. The sync never makes one; refuse it.
        if len(git("rev-list", "--parents", "-n", "1", c).stdout.split()) > 2:
            problem("push: a merge commit is on this branch — not pushing; push it yourself when it's ready")
            return
        files = git("diff-tree", "--no-commit-id", "--name-only", "-r", c).stdout.split()
        if not files or any(not ours(f) for f in files):
            problem("push: other unpushed work is on this branch — not pushing; push it yourself when it's ready")
            return
    if git("rev-list", "HEAD..origin/main").stdout.strip():
        # someone else pushed meanwhile: put the match commits on top of theirs.
        # The autostash puts Ric's uncommitted work back afterwards, and if a
        # file he's editing is one they changed, git leaves conflict markers in
        # it and still reports success — so in that case don't touch anything.
        theirs = set(git("diff", "--name-only", "HEAD...origin/main").stdout.split())
        dirty = {line[3:].strip().strip('"').split(" -> ")[-1]
                 for line in git("status", "--porcelain").stdout.splitlines()}
        if theirs & dirty:
            problem("push: GitHub changed files you're editing (" + ", ".join(sorted(theirs & dirty))[:120]
                    + ") — not pushing; pull yourself when it's safe")
            return
        r = git("pull", "--rebase", "--autostash", "-q", "origin", "main")
        if r.returncode:
            git("rebase", "--abort")
            problem("push: couldn't line up with GitHub (" + (r.stderr.strip().splitlines() or ["?"])[-1] + ") — left for you")
            return
    r = git("push", "-q", "origin", "main")
    if r.returncode == 0:
        print(f"push: {len(ahead)} commit(s) published")
    else:
        problem("push: " + r.stderr.strip())


def share_codes():
    try:
        return set(json.loads((HERE / ".cs-state.json").read_text(encoding="utf-8")).get("codes", {}))
    except (OSError, ValueError):
        return set()


def demos():
    if (HERE / "fetcher" / "node_modules").is_dir():
        step("fetch", str(HERE / "fetcher" / "fetch-demos.mjs"), exe="node")
    step("demos", str(HERE / "parse-demos.py"))


def main():
    codes = share_codes()
    demos()
    step("gsi", "-c", f"import sys; sys.path.insert(0, {str(HERE)!r}); import gsi; "
                      "print(f'gsi: {gsi.merge()} new match(es) from the live feed')")
    step("steam", str(HERE / "steam.py"))
    step("leetify", str(HERE / "pull-leetify.py"))
    # Steam and Leetify are where share codes come from, and they run after the
    # fetch — so a game they just found would otherwise wait a whole session for
    # its demo (2026-10-15: three games did). Go round once more if they did.
    if share_codes() - codes:
        demos()
    step("llm", str(HERE / "export-llm.py"))
    step("cards", str(HERE / "cards.py"))           # each player's link preview
    commit()
    publish()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        problem(f"sync crashed: {e!r}")
        raise
    finally:
        if PROBLEMS:
            sys.path.insert(0, str(HERE))
            from notify import toast, unseen
            new = unseen(PROBLEMS)            # each problem once per play session
            if new:
                n = len(new)
                toast(f"CS sync: {n} problem{'s' if n > 1 else ''}", "\n".join(new))
