#!/usr/bin/env python3
"""One pass of the VALORANT room: pull new matches, rewrite the plain-text
export, commit the room's data files (on main, never pushes — a push is a
publish). val-session.pyw runs this every 30 minutes while VALORANT is open
and once more when it closes. Each step runs in its own process."""

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


if __name__ == "__main__":
    step(str(HERE / "pull-val.py"))
    step(str(HERE / "export-llm.py"))
    commit()
