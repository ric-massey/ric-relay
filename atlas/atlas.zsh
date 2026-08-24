# ATLAS from the terminal: `atlas`, or `map`, from any directory.
#
# Sourced by ~/.zshrc. Lives in the repo so it is backed up and versioned along
# with the thing it opens.
#
#   atlas         start the local server if it isn't up, open the app
#   atlas live    open the deployed app at ricmassey.com instead
#   atlas stop    stop the local server
#   atlas log     follow the server log
#
# It serves the whole site repo on 8912, NOT the atlas directory on its own.
# Two reasons, and both of them bite: in production the app is at /atlas/, and
# http://localhost:8912/atlas/ is the one local address in Supabase's redirect
# allowlist — serve the atlas folder as a site root somewhere else and every
# invite and password-reset link bounces.
#
# Bound to 127.0.0.1 on purpose. A bare LAN address is not a secure context, so
# geolocation would never get a fix there anyway; test on a phone against the
# live site.

atlas() {
  local root="${ATLAS_ROOT:-$HOME/RicsWebsite}"
  local port=8912
  local log=/tmp/atlas-server.log
  local pid i

  case "$1" in
    live)
      open "https://ricmassey.com/atlas/"
      return 0
      ;;
    stop)
      pid=$(lsof -nP -tiTCP:$port -sTCP:LISTEN 2>/dev/null)
      if [[ -n $pid ]]; then
        kill $pid && print "atlas: stopped"
      else
        print "atlas: nothing serving on $port"
      fi
      return 0
      ;;
    log)
      [[ -f $log ]] && tail -f "$log" || print "atlas: no log yet"
      return 0
      ;;
    ""|open) ;;
    *)
      print -u2 "usage: atlas [live|stop|log]"
      return 1
      ;;
  esac

  if [[ ! -d $root/atlas ]]; then
    print -u2 "atlas: no $root/atlas — set ATLAS_ROOT to the site repo"
    return 1
  fi

  if ! lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    (cd "$root" && nohup python3 -m http.server $port --bind 127.0.0.1 >"$log" 2>&1 &)
    # Wait for the socket rather than racing the browser to it.
    for i in {1..40}; do
      lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1 && break
      sleep 0.1
    done
    if ! lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
      print -u2 "atlas: server didn't come up — atlas log"
      return 1
    fi
    print "atlas: serving $root on $port"
  fi

  open "http://localhost:$port/atlas/"
}

# A function rather than an alias: aliases are expanded at parse time, so
# `map` from a script that sourced this file would not exist yet.
map() { atlas "$@" }
