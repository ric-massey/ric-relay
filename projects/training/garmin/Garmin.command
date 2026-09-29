#!/bin/bash
# GARMIN — the button. Double-click it in Finder (or an alias of it on the
# Desktop) and your whole Garmin history goes behind the site password, where
# Claude can read it. pull-garmin.py says what it keeps and why; README.md says
# how to set it up the first time.
#
#   Garmin.command              pull and upload
#   Garmin.command --upgrade    update the Garmin library first — for when
#                               Garmin has changed its login and this broke
#
# Everything it keeps on disk (the Python venv, Garmin's session tokens, the
# day cache) is in ~/.ric-garmin, never in the repo.

set -u

# Follow a symlink back to the real file, so an `ln -s` on the Desktop works as
# well as a Finder alias does.
SRC="$0"
while [ -L "$SRC" ]; do
  L="$(readlink "$SRC")"
  case "$L" in /*) SRC="$L" ;; *) SRC="$(dirname "$SRC")/$L" ;; esac
done
HERE="$(cd "$(dirname "$SRC")" && pwd)"

STATE="$HOME/.ric-garmin"
VENV="$STATE/venv"
mkdir -p "$STATE" && chmod 700 "$STATE"

finish() {
  echo
  read -r -n 1 -s -p "Press any key to close this window."
  echo
  exit "$1"
}

UPGRADE=0
ARGS=()
for a in "$@"; do
  if [ "$a" = "--upgrade" ]; then UPGRADE=1; else ARGS+=("$a"); fi
done

# The library needs Python 3.10 or newer, and the python3 that ships with
# macOS is 3.9 — so look for a newer one before settling.
if [ ! -x "$VENV/bin/python" ]; then
  PY=""
  for p in python3.13 python3.12 python3.11 python3.10 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
    if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
      PY="$p"; break
    fi
  done
  if [ -z "$PY" ]; then
    echo "This needs Python 3.10 or newer, and this Mac only has an older one."
    echo "Install it once with:   brew install python"
    finish 1
  fi
  echo "First run: setting up the Garmin library in ~/.ric-garmin (once)…"
  "$PY" -m venv "$VENV" || finish 1
  UPGRADE=1
fi

if [ "$UPGRADE" = 1 ]; then
  "$VENV/bin/pip" install --quiet --upgrade pip garminconnect || finish 1
fi

"$VENV/bin/python" "$HERE/pull-garmin.py" ${ARGS[@]+"${ARGS[@]}"}
finish $?
