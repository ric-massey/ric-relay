#!/usr/bin/env python3
"""One-time setup for the CS room's session watcher. Safe to run again.

    projects/cs/.cs-venv/Scripts/python projects/cs/install.py

  * gives the GSI listener a private token (kept in cs-account.json, gitignored)
  * drops gamestate_integration_ric_terminal.cfg into CS2's cfg folder, which is
    what makes the game send its state to the listener
  * puts a "CS2 + Terminal" shortcut on the desktop
  * prints the Steam launch option to paste — Steam's own settings are left for
    you to change, not edited behind its back
"""

import json
import secrets
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import csdata  # noqa: E402
import gsi  # noqa: E402


def main():
    acct = csdata.account()
    if not acct.get("gsi_token"):
        acct["gsi_token"] = secrets.token_hex(16)
        csdata.ACCOUNT.write_text(json.dumps(acct, indent=2) + "\n", encoding="utf-8")

    cfg_dir = Path(acct["cs2_dir"]) / "game" / "csgo" / "cfg"
    if cfg_dir.is_dir():
        (cfg_dir / gsi.CFG_NAME).write_text(gsi.cfg_text(acct["gsi_token"]), encoding="utf-8")
        print(f"GSI config  -> {cfg_dir / gsi.CFG_NAME}")
    else:
        print(f"!! CS2 cfg folder not found at {cfg_dir} — fix cs2_dir in cs-account.json")

    pyw = Path(sys.executable).with_name("pythonw.exe")
    session = csdata.HERE / "cs-session.pyw"
    desktop = Path.home() / "Desktop"
    ps = (
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut("
        f"'{desktop / 'CS2 + Terminal.lnk'}');"
        f"$s.TargetPath='{pyw}';$s.Arguments='\"{session}\"';"
        f"$s.WorkingDirectory='{csdata.HERE}';"
        "$s.IconLocation='" + str(Path(acct['cs2_dir']) / 'game' / 'bin' / 'win64' / 'cs2.exe') + ",0';"
        "$s.Description='Launch CS2 with the Terminal match tracker';$s.Save()"
    )
    r = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True)
    print("Desktop     -> CS2 + Terminal.lnk" if r.returncode == 0 else f"!! shortcut: {r.stderr.strip()}")

    print("\nSteam > Counter-Strike 2 > Properties > General > Launch Options, paste:\n")
    print(f'"{pyw}" "{session}" %command%\n')
    print("(Already have launch options? Put them after %command%.)")


if __name__ == "__main__":
    main()
