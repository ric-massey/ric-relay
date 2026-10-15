"""Runs alongside CS2 and only alongside it.

Started by CS2's Steam launch options (see README.md), so it comes up when the
game does and is gone when the game is:

    "<repo>\\projects\\cs\\.cs-venv\\Scripts\\pythonw.exe" "<repo>\\projects\\cs\\cs-session.pyw" %command%

Steam hands it the game's own command line; it starts the game with that FIRST
— whatever happens below, CS2 still launches — then:

  * listens for Valve's Game State Integration feed on 127.0.0.1:3010, so a
    match is recorded the moment the scoreboard says game over;
  * runs sync.py every 30 minutes while cs2.exe is open;
  * runs it once more after cs2.exe closes, and exits.

Run with no arguments (the desktop shortcut) it launches CS2 through Steam
instead and does the same. A second copy notices the first and just exits.

Log: %LOCALAPPDATA%\\ric-terminal\\cs-session.log
"""

import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYNC_EVERY_S = 30 * 60
POLL_S = 15
QUIET = 0x08000000  # CREATE_NO_WINDOW

LOG = Path(os.environ.get("LOCALAPPDATA", HERE)) / "ric-terminal" / "cs-session.log"
LOG.parent.mkdir(parents=True, exist_ok=True)


def log(msg):
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    try:
        # keep the log from growing forever: last ~2000 lines
        old = LOG.read_text(encoding="utf-8").splitlines()[-2000:] if LOG.exists() else []
        LOG.write_text("\n".join(old + [line]) + "\n", encoding="utf-8")
    except OSError:
        pass


def cs2_running():
    r = subprocess.run(["tasklist", "/FI", "IMAGENAME eq cs2.exe", "/NH"],
                       capture_output=True, text=True, creationflags=QUIET)
    return "cs2.exe" in r.stdout.lower()


def sync(why):
    log(f"sync ({why})")
    try:
        # each step inside has its own 30-minute limit and the fetch can run
        # twice, so the whole pass gets far longer than any one step
        r = subprocess.run([sys.executable, str(HERE / "sync.py")], capture_output=True,
                           text=True, encoding="utf-8", errors="replace",
                           timeout=4 * 3600, creationflags=QUIET,
                           env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        for line in (r.stdout + r.stderr).strip().splitlines():
            log("  " + line)
    except Exception as e:
        log(f"  sync failed: {e}")
        try:   # sync.py raises its own toasts; this is for when it never got to
            from notify import toast
            toast("CS sync failed", str(e))
        except Exception:
            pass


def main():
    # 1. The game, before anything that could possibly go wrong.
    args = sys.argv[1:]
    if args:
        subprocess.Popen(args)
    elif not cs2_running():
        os.startfile("steam://rungameid/730")

    sys.path.insert(0, str(HERE))
    try:
        import csdata
        import gsi
        acct = csdata.account()
        recorder = gsi.Recorder(acct["steam64"], acct.get("gsi_token", ""), log=log)
        gsi.serve(recorder)
    except OSError:
        log("another session already has the GSI port — leaving it to that one")
        return
    except Exception as e:
        log(f"listener not started: {e}")
        recorder = None

    started = gsi._now() if recorder else None
    # one id per play session, so a problem is toasted once, not every sync
    os.environ["CS_SESSION"] = datetime.now().strftime("%Y%m%d-%H%M%S")
    log("session started")
    # 2. Give the game a few minutes to appear (shader cache, updates…).
    for _ in range(int(300 / POLL_S)):
        if cs2_running():
            break
        time.sleep(POLL_S)
    else:
        log("cs2.exe never appeared — stopping")
        return

    while True:
        # 3. Every 30 minutes until it closes.
        next_sync = time.monotonic() + SYNC_EVERY_S
        while cs2_running():
            time.sleep(POLL_S)
            if time.monotonic() >= next_sync:
                sync("30 min")
                next_sync = time.monotonic() + SYNC_EVERY_S

        # 4. Once more on the way out.
        if recorder:
            recorder.flush()
        sync("cs2 closed")

        # 5. Valve's share code reaches Leetify a while after the match, so the
        # last game's demo usually isn't there yet when the game closes. While a
        # match the live feed saw this session has no demo, look again twice,
        # FOLLOW_UP_S apart. Back in game meanwhile: back to step 3, since this
        # process still holds the live-feed port and the next session can't.
        back = False
        for _ in range(FOLLOW_UPS):
            if not started or not missing_demos(started):
                break
            log(f"  {missing_demos(started)} match(es) still without a demo — syncing again in {FOLLOW_UP_S // 60} min")
            if not wait_unless_cs2(FOLLOW_UP_S):
                back = True
                break
            sync("follow-up")
        if not back:
            break
        log("cs2 is back — carrying on")
    log("session over")


FOLLOW_UPS, FOLLOW_UP_S = 2, 15 * 60


def wait_unless_cs2(seconds):
    """Sleep, unless the game starts again first (then False)."""
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        time.sleep(POLL_S)
        if cs2_running():
            return False
    return True


def missing_demos(since):
    """How many finished matches the live feed spooled since `since` that
    cs-data.js still has no demo for."""
    try:
        import json
        import csdata
        import gsi
        data = csdata.load()
        n = 0
        for line in gsi.SPOOL.read_text(encoding="utf-8").splitlines():
            rec = json.loads(line)
            # casual games never get a demo; waiting on one would be forever
            if rec.get("left") or rec.get("at", "") < since or rec.get("mode") == "casual":
                continue
            me = rec["me"]
            probe = {"map": rec["map"], "score": rec["score"],
                     "me": {"k": me.get("kills"), "d": me.get("deaths")}}
            m = csdata.find(data, fingerprint=csdata.fingerprint_of(probe))
            if not m or "demo" not in m.get("sources", []):
                n += 1
        return n
    except Exception as e:
        log(f"  couldn't check for missing demos: {e}")
        return 0


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"crashed: {e!r}")
