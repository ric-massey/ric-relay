"""Runs alongside VALORANT and only alongside it.

The desktop shortcut "VALORANT + Terminal" starts this. It launches VALORANT
through the Riot Client first (whatever happens below, the game still starts),
then runs sync.py every 30 minutes while VALORANT-Win64-Shipping.exe is open,
once more after it closes, and exits. Nothing runs between sessions.

Launched VALORANT some other way? Nothing is lost: Riot keeps the match
history, and the next session through the shortcut picks up every match since.

Log: %LOCALAPPDATA%\ric-terminal\val-session.log
"""

import os
import socket
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = "VALORANT-Win64-Shipping.exe"
RIOT = Path(os.environ.get("ProgramFiles", r"C:\Program Files")).drive + r"\Riot Games\Riot Client\RiotClientServices.exe"
SYNC_EVERY_S = 30 * 60
POLL_S = 15
QUIET = 0x08000000
LOG = Path(os.environ.get("LOCALAPPDATA", HERE)) / "ric-terminal" / "val-session.log"
LOG.parent.mkdir(parents=True, exist_ok=True)


def log(msg):
    try:
        old = LOG.read_text(encoding="utf-8").splitlines()[-2000:] if LOG.exists() else []
        LOG.write_text("\n".join(old + [f"{datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"]) + "\n", encoding="utf-8")
    except OSError:
        pass


def running():
    r = subprocess.run(["tasklist", "/FI", f"IMAGENAME eq {GAME}", "/NH"],
                       capture_output=True, text=True, creationflags=QUIET)
    return GAME.lower() in r.stdout.lower()


def sync(why):
    log(f"sync ({why})")
    try:
        r = subprocess.run([sys.executable, str(HERE / "sync.py")], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=1800, creationflags=QUIET,
                           env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        for line in (r.stdout + r.stderr).strip().splitlines():
            log("  " + line)
    except Exception as e:
        log(f"  sync failed: {e}")


def main():
    if not running():
        try:
            subprocess.Popen([RIOT, "--launch-product=valorant", "--launch-patchline=live"])
        except OSError as e:
            log(f"couldn't start VALORANT ({e}) — start it yourself; still watching")
    # one session at a time
    lock = socket.socket()
    if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
        lock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
    try:
        lock.bind(("127.0.0.1", 3011))
    except OSError:
        log("another session is already watching")
        return
    log("session started")
    for _ in range(int(600 / POLL_S)):       # the Riot Client can take a while
        if running():
            break
        time.sleep(POLL_S)
    else:
        log("VALORANT never appeared — stopping")
        return
    sync("game opened")                       # catch anything played elsewhere
    nxt = time.monotonic() + SYNC_EVERY_S
    while running():
        time.sleep(POLL_S)
        if time.monotonic() >= nxt:
            sync("30 min")
            nxt = time.monotonic() + SYNC_EVERY_S
    time.sleep(20)                            # let Riot finish writing the last match
    sync("VALORANT closed")
    log("session over")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"crashed: {e!r}")
