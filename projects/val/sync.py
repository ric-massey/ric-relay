#!/usr/bin/env python3
"""One pass of the VALORANT room: pull new matches, rewrite the plain-text
export, commit the room's data files on main and push those commits, the way
the CS room's sync does. val-session.pyw runs this every 30 minutes while
VALORANT is open and once more when it closes. Each step runs in its own
process.

It used to commit and never push. That left an unpushed VALORANT commit on
main after every session, and the CS sync refuses to push while anything
outside its own data is waiting — so one VALORANT session switched off the
CS auto-publish until Ric pushed by hand (bug sweep B6-4). Ric, 2026-10-29:
"VAL pushes like CS". `"push": false` in val-account.json turns it off."""

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
PY = sys.executable
DATA = ["projects/val/val-data.js", "projects/val/matches", "projects/val/llm", "projects/val/maps"]
QUIET = {"creationflags": 0x08000000} if sys.platform == "win32" else {}


def step(*args):
    r = subprocess.run([PY, *args], cwd=REPO, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=1800, env={**os.environ, "PYTHONIOENCODING": "utf-8"}, **QUIET)
    print((r.stdout + r.stderr).strip())


def git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, **QUIET)


def commit():
    try:
        acct = json.loads((HERE / "val-account.json").read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        acct = {}
    if not acct.get("commit", True) or os.environ.get("VAL_NO_COMMIT"):
        return
    if git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() != "main":
        print("commit: not on main — left uncommitted")
        return
    if any((REPO / ".git" / f).exists() for f in ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD")):
        print("commit: a merge/rebase is in progress — left uncommitted")
        return
    paths = [p for p in DATA if (REPO / p).exists()]
    if not paths or not git("status", "--porcelain", "--", *paths).stdout.strip():
        return
    git("add", "--", *paths)
    r = git("commit", "-m", "VAL: sync matches", "--only", "--", *paths)
    print("commit: " + (r.stdout.splitlines()[0] if r.returncode == 0 else r.stderr.strip()))


def publish():
    """Push the sync's own commits, and only those: if anything else is waiting
    to go out — another room's data, Ric's own work, a merge — leave the lot
    alone and say so. The same rules as projects/cs/sync.py's publish()."""
    try:
        acct = json.loads((HERE / "val-account.json").read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        acct = {}
    if not acct.get("push", True) or not acct.get("commit", True) or os.environ.get("VAL_NO_COMMIT"):
        return
    if git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() != "main":
        return
    if git("fetch", "-q", "origin", "main").returncode:
        print("push: couldn't reach GitHub — will try again next sync")
        return
    ahead = git("rev-list", "origin/main..HEAD").stdout.split()
    if not ahead:
        return
    def ours(f):
        return any(f == p or f.startswith(p.rstrip("/") + "/") for p in DATA)
    for c in ahead:
        if len(git("rev-list", "--parents", "-n", "1", c).stdout.split()) > 2:
            print("push: a merge commit is on this branch — not pushing; push it yourself when it's ready")
            return
        files = git("diff-tree", "--no-commit-id", "--name-only", "-r", c).stdout.split()
        if not files or any(not ours(f) for f in files):
            print("push: other unpushed work is on this branch — not pushing; push it yourself when it's ready")
            return
    if git("rev-list", "HEAD..origin/main").stdout.strip():
        theirs = set(git("diff", "--name-only", "HEAD...origin/main").stdout.split())
        dirty = {line[3:].strip().strip('"').split(" -> ")[-1]
                 for line in git("status", "--porcelain").stdout.splitlines()}
        if theirs & dirty:
            print("push: GitHub changed files you're editing — not pushing; pull yourself when it's safe")
            return
        r = git("pull", "--rebase", "--autostash", "-q", "origin", "main")
        if r.returncode:
            git("rebase", "--abort")
            print("push: couldn't line up with GitHub — left for you")
            return
    r = git("push", "-q", "origin", "main")
    print(f"push: {len(ahead)} commit(s) published" if r.returncode == 0 else "push: " + r.stderr.strip())


if __name__ == "__main__":
    step(str(HERE / "pull-val.py"))
    step(str(HERE / "export-llm.py"))
    commit()
    publish()
