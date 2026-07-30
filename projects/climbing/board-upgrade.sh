#!/bin/bash
# Check whether boardlib has moved on, and optionally install the newer version.
#
#   board-upgrade.sh                    # just look
#   board-upgrade.sh --install          # ask permission, then upgrade
#   board-upgrade.sh --install --force  # upgrade without asking
#
# boardlib is unofficial: it tracks an API Aurora can change without warning, so
# a broken sync is usually a stale boardlib. This is the first thing to try.
#
# Nothing new gets installed behind Ric's back. --install puts a real macOS
# dialog on screen with Accept and Decline, because this is the one piece of the
# pipeline that receives his board password — a new version of it is his call,
# not the timer's. Unanswered after five minutes counts as Decline.
#
# Exit codes: 0 up to date (or upgraded), 10 newer version available,
#             11 an upgrade was offered and declined, 1 broken.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIP="$HERE/.board-venv/bin/pip"
PY="$HERE/.board-venv/bin/python"
INSTALL=0
FORCE=0
for arg in "$@"; do
  [ "$arg" = "--install" ] && INSTALL=1
  [ "$arg" = "--force" ] && FORCE=1
done

# Ask on screen. Returns "Accept", "Decline", or "timeout"/"" if no one is there.
ask_permission() {
  local from="$1" to="$2"
  osascript <<APPLESCRIPT 2>/dev/null
set answer to display dialog "boardlib $to is available — you have $from.

boardlib is the unofficial tool that logs into your Kilter and Tension accounts to pull your logbook. Upgrading it is usually the fix when a sync breaks.

Install the new version?" ¬
    with title "Board sync" ¬
    buttons {"Decline", "Accept"} ¬
    default button "Accept" ¬
    with icon note ¬
    giving up after 300
if gave up of answer then
    return "timeout"
else
    return button returned of answer
end if
APPLESCRIPT
}

[ -x "$PY" ] || { echo "no venv — run: python3 -m venv $HERE/.board-venv"; exit 1; }

installed=$("$PY" -c "import importlib.metadata as m; print(m.version('boardlib'))" 2>/dev/null)
[ -n "$installed" ] || { echo "boardlib isn't installed in the venv"; installed="none"; }

# Asked for through `requests` — the same library, and the same bundled CA
# certificates, that boardlib uses to reach Aurora. Python's stock urllib has no
# certificate store on this Mac and would fail here for reasons unrelated to PyPI.
latest=$("$PY" - <<'PY' 2>/dev/null
import requests
print(requests.get("https://pypi.org/pypi/boardlib/json", timeout=15).json()["info"]["version"])
PY
)
[ -n "$latest" ] || latest=$(curl -fsS --max-time 15 https://pypi.org/pypi/boardlib/json 2>/dev/null \
  | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' | head -1)
[ -n "$latest" ] || { echo "couldn't reach PyPI — installed: $installed"; exit 1; }

echo "boardlib installed: $installed"
echo "boardlib on PyPI:   $latest"

if [ "$installed" = "$latest" ]; then
  echo "up to date"
  exit 0
fi

if [ $INSTALL -eq 0 ]; then
  echo "newer version available — rerun with --install to take it"
  exit 10
fi

if [ $FORCE -eq 0 ]; then
  answer=$(ask_permission "$installed" "$latest")
  case "$answer" in
    Accept)  echo "accepted by Ric" ;;
    Decline) echo "declined — staying on $installed"; exit 11 ;;
    *)       echo "no answer (nobody at the Mac) — staying on $installed"; exit 11 ;;
  esac
fi

echo "upgrading…"
# Pillow is imported by boardlib but not always declared as a dependency, so it
# is pinned to the install line rather than left to chance.
#
# pandas is held below 3.0 deliberately. boardlib groups by climb/angle/mirror
# and then reads those columns back; pandas 3 drops the grouping columns from
# groupby().apply(), so the logbook download dies on a KeyError. Letting an
# upgrade pull pandas 3 in would break the sync it is meant to repair.
"$PIP" install --quiet --upgrade boardlib Pillow "pandas>=2.2,<3" \
  || { echo "upgrade failed"; exit 1; }

now=$("$PY" -c "import importlib.metadata as m; print(m.version('boardlib'))" 2>/dev/null)
if "$HERE/.board-venv/bin/boardlib" --help >/dev/null 2>&1; then
  echo "upgraded to $now and it still runs"
  exit 0
fi
echo "upgraded to $now but boardlib won't start — check the traceback:"
"$HERE/.board-venv/bin/boardlib" --help
exit 1
