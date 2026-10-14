#!/usr/bin/env python3
"""One-time setup for the VALORANT room. Safe to run again.

Creates val-account.json (gitignored) if missing and puts a "VALORANT +
Terminal" shortcut on the desktop. Launch VALORANT from that shortcut and the
room keeps itself up to date while you play."""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
acct = HERE / "val-account.json"
if not acct.exists():
    acct.write_text(json.dumps({"riot_id": "RicGoneCrazy#2001", "show_others_names": False, "commit": True},
                               indent=2) + "\n", encoding="utf-8")
    print("val-account.json created")

pyw = Path(sys.executable).with_name("pythonw.exe")
icon = r"C:\Riot Games\VALORANT\live\VALORANT.exe"
lnk = Path.home() / "Desktop" / "VALORANT + Terminal.lnk"
ps = (f"$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{lnk}');"
      f"$s.TargetPath='{pyw}';$s.Arguments='\"{HERE / 'val-session.pyw'}\"';$s.WorkingDirectory='{HERE}';"
      f"$s.IconLocation='{icon},0';$s.Description='Launch VALORANT with the Terminal match tracker';$s.Save()")
r = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True)
print("Desktop -> VALORANT + Terminal.lnk" if r.returncode == 0 else f"!! shortcut: {r.stderr.strip()}")
