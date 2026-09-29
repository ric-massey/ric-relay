#!/usr/bin/env python3
"""GARMIN — pull the whole useful history and put it behind the password.

    projects/training/garmin/Garmin.command     the button: double-click it
    python3 projects/training/garmin/pull-garmin.py [--days N] [--since DATE] [--dry]

Logs into Garmin Connect, pulls every activity's numbers and, for every day
the watch has data, sleep, HRV, resting heart rate, stress, Body Battery,
training readiness and training status, then POSTs the lot as one JSON file to
the Worker's /garmin. A Claude session reads it back from there with its own
read-only token (see README.md beside this file).

── nothing from this goes in the repo ──
Sleep times are a nightly record of when the house is asleep, and HRV and
resting heart rate are health data. Ric chose on 2026-09-29 to keep them behind
the Worker's password rather than in this public repo. So everything this
script keeps on disk — the login tokens, the day cache, the local copy of the
export and its Python venv — lives in ~/.ric-garmin/, outside the repo, where
no `git add .` can reach it.

── credentials ──
The Garmin email and password live in the macOS Keychain, stored once:

    security add-generic-password -s garmin-connect -a YOUR@EMAIL -w

(-w with no value prompts, so the password never lands in shell history.) The
upload token is the Worker's LOG_TOKEN, from the same Keychain entry
board-tick.mjs reads. Neither is ever written anywhere else. After the first
login Garmin's own session tokens sit in ~/.ric-garmin/tokens and the password
is not sent again until they expire.

── why "unofficial" ──
Garmin has no API for individuals; this uses the `garminconnect` library, which
speaks to the same endpoints as the Garmin Connect website. When Garmin changes
its login it can break until the library catches up — `Garmin.command --upgrade`
pulls the newest version.

── what is kept ──
Every scalar Garmin returns, to a few levels deep, and not the time series
(per-minute heart rate, sleep movement, stress every three minutes): those are
most of the bytes and none of the answers. See trim(). Location fields are
dropped from everything, not because this file is public but because hard
rule 1 says coordinates do not travel, and nothing about fatigue needs them.
"""

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HOME = Path(os.environ.get("RIC_GARMIN_HOME", Path.home() / ".ric-garmin"))
TOKENS = HOME / "tokens"
CACHE = HOME / "cache.json"
EXPORT = HOME / "export.json"

WORKER = os.environ.get("GARMIN_WORKER", "https://training-log.rmbuster82.workers.dev")
GARMIN_KEYCHAIN = "garmin-connect"
LOG_KEYCHAIN = {"service": "training-log", "account": "rmbuster82"}

# Days this recent are fetched again every run: last night's sleep lands in
# the morning, and readiness and training status move through the day.
REFRESH_DAYS = 3
# Walking back through history, this many days in a row with nothing on them
# means the watch had not been bought yet. Long enough to cross a holiday with
# the watch in a drawer.
EMPTY_STREAK_STOP = 60
# Between calls. Garmin rate-limits hard and a first run is thousands of calls;
# a steady pace finishes, a burst gets the account locked out for an hour.
PAUSE_S = float(os.environ.get("GARMIN_PAUSE", "0.35"))

# ── trim ──
DROP_KEY = re.compile(
    r"(latitude|longitude|^lat$|^lon$|^lng$|lat$|lon$|location|address|gps|"
    r"polyline|geo|owner|image|url$|uuid|profilepk|profileid|displayname|"
    r"fullname|username|email)",
    re.I,
)
MAX_DEPTH = 6
MAX_DICT_LIST = 6       # short lists of records (readiness updates) survive
MAX_SCALAR_LIST = 12    # short lists of values survive; time series do not


def trim(v, depth=0):
    """Keep what answers questions, drop what is bulk or location.

    Scalars are kept. Dicts are recursed into, minus any key that names a
    place or an identity. Lists are the time series — kept only when short.
    Anything that trims down to nothing is dropped, so an absent key means
    Garmin had no value, not that one was lost."""
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if depth >= MAX_DEPTH:
        return None
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            if DROP_KEY.search(str(k)):
                continue
            t = trim(x, depth + 1)
            if t is None or t == {} or t == []:
                continue
            out[k] = t
        return out
    if isinstance(v, list):
        if not v:
            return None
        if all(isinstance(x, dict) for x in v):
            if len(v) > MAX_DICT_LIST:
                return None
        elif len(v) > MAX_SCALAR_LIST or any(isinstance(x, (list, dict)) for x in v):
            return None
        out = [t for t in (trim(x, depth + 1) for x in v) if t not in (None, {}, [])]
        return out or None
    return None


def has_data(day):
    """Whether a cached day says the watch was on a wrist."""
    s = day.get("summary") or {}
    return bool(s.get("totalSteps") or s.get("restingHeartRate") or day.get("sleep") or day.get("hrv"))


# ── plumbing ──
class Stop(Exception):
    """Something no retry will fix — say it plainly and exit."""


def keychain(*args):
    r = subprocess.run(["security", "find-generic-password", *args],
                       capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr


def garmin_login_details():
    email = os.environ.get("GARMIN_EMAIL")
    if not email:
        code, out, err = keychain("-s", GARMIN_KEYCHAIN)
        m = re.search(r'"acct"<blob>="([^"]+)"', out + err)
        if code or not m:
            raise Stop(
                "No Garmin login in the Keychain. Store it once (this prompts for the\n"
                "password, so it never lands in your shell history):\n\n"
                f"    security add-generic-password -s {GARMIN_KEYCHAIN} -a YOUR@EMAIL -w\n")
        email = m.group(1)
    if os.environ.get("GARMIN_PASSWORD"):     # the tests; the button never sets it
        return email, os.environ["GARMIN_PASSWORD"]
    code, out, _ = keychain("-s", GARMIN_KEYCHAIN, "-a", email, "-w")
    if code:
        raise Stop(f"The Keychain has no Garmin password for {email}.")
    return email, out.strip()


def log_token():
    if os.environ.get("LOG_TOKEN"):
        return os.environ["LOG_TOKEN"].strip()
    code, out, _ = keychain("-s", LOG_KEYCHAIN["service"], "-a", LOG_KEYCHAIN["account"], "-w")
    if code:
        raise Stop(
            "No site password in the Keychain. Store it once — the same one you sign in\n"
            "to the site with:\n\n"
            f"    security add-generic-password -s {LOG_KEYCHAIN['service']} "
            f"-a {LOG_KEYCHAIN['account']} -w\n")
    return out.strip()


def connect():
    try:
        from garminconnect import Garmin, GarminConnectAuthenticationError
    except ImportError:
        raise Stop("garminconnect is not installed. Run Garmin.command, which sets it up.")
    email, password = garmin_login_details()
    TOKENS.mkdir(parents=True, exist_ok=True)
    os.chmod(HOME, 0o700)
    api = Garmin(email, password,
                 prompt_mfa=lambda: input("Garmin sent you a code — type it here: ").strip())
    try:
        api.login(str(TOKENS))
    except GarminConnectAuthenticationError as e:
        raise Stop(f"Garmin refused the login: {e}\n"
                   "If the password changed, update it in the Keychain. If it is right,\n"
                   "Garmin may have changed its login — run Garmin.command --upgrade.")
    return api


def call(fn, *args):
    """One Garmin request. A rate limit stops the run (what is cached so far is
    kept and uploaded); anything else is a missing value, not a failure."""
    from garminconnect import GarminConnectTooManyRequestsError
    time.sleep(PAUSE_S)
    try:
        return fn(*args)
    except GarminConnectTooManyRequestsError:
        raise
    except Exception as e:  # a day with no HRV is a 404, and that is fine
        if "429" in str(e):
            raise GarminConnectTooManyRequestsError(str(e))
        return None


def soft(fn, *args):
    """call(), for the extras at the end: a rate limit there costs the extra,
    not the upload of everything already fetched."""
    try:
        return call(fn, *args)
    except Exception:
        return None


def load_cache():
    try:
        return json.loads(CACHE.read_text())
    except (FileNotFoundError, ValueError):
        return {"days": {}, "activities": {}}


def save_cache(cache):
    HOME.mkdir(parents=True, exist_ok=True)
    tmp = CACHE.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, separators=(",", ":")))
    tmp.replace(CACHE)


def fetch_day(api, d):
    readiness = call(api.get_training_readiness, d)
    if isinstance(readiness, list):
        readiness = sorted(readiness, key=lambda r: str(r.get("timestamp", "")))[-1:] or None
    return {k: v for k, v in {
        "summary": trim(call(api.get_user_summary, d)),
        "sleep": trim(call(api.get_sleep_data, d)),
        "hrv": trim(call(api.get_hrv_data, d)),
        "readiness": trim(readiness),
        "status": trim(call(api.get_training_status, d)),
    }.items() if v}


def pull_days(api, cache, oldest, today, limit):
    days = cache["days"]
    fresh_from = (today - dt.timedelta(days=REFRESH_DAYS - 1)).isoformat()
    streak, fetched, d = 0, 0, today
    while d >= oldest:
        iso = d.isoformat()
        if iso in days and iso < fresh_from:
            day = days[iso]
        else:
            if limit is not None and fetched >= limit:
                break
            day = fetch_day(api, iso)
            days[iso] = day
            fetched += 1
            if fetched % 20 == 0:
                save_cache(cache)
                print(f"  … {iso}  ({fetched} days fetched)", flush=True)
        streak = 0 if has_data(day) else streak + 1
        if streak >= EMPTY_STREAK_STOP:
            break
        d -= dt.timedelta(days=1)
    save_cache(cache)
    return fetched


def pull_activities(api, cache):
    known = cache["activities"]
    start, new = 0, 0
    while True:
        page = call(api.get_activities, start, 100) or []
        if not page:
            break
        fresh = 0
        for a in page:
            aid = str(a.get("activityId"))
            if aid not in known:
                fresh += 1
            known[aid] = trim(a)
        new += fresh
        if fresh == 0 and start > 0:    # the first page is always re-read, for renames
            break
        start += len(page)
    save_cache(cache)
    return new


def build(api, cache):
    days = {d: v for d, v in sorted(cache["days"].items()) if v}
    acts = sorted(cache["activities"].values(),
                  key=lambda a: str(a.get("startTimeLocal", "")))
    return {
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "garmin-connect",
        "units": "metres, seconds, metres/second, bpm — as Garmin sends them",
        "range": {"first": next(iter(days), None), "last": next(reversed(days), None)},
        "counts": {"days": len(days), "activities": len(acts)},
        "records": trim(soft(api.get_personal_record)),
        "race_predictions": trim(soft(api.get_race_predictions)),
        "days": days,
        "activities": acts,
    }


def upload(body):
    req = urllib.request.Request(WORKER + "/garmin", data=body, method="POST", headers={
        "authorization": "Bearer " + log_token(),
        "content-type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise Stop("The Worker did not accept the site password from the Keychain.")
        if e.code == 429:
            raise Stop("The Worker is locked for five minutes after wrong passwords. Try again after.")
        raise Stop(f"The Worker said {e.code}: {e.read()[:300].decode('utf-8', 'replace')}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--since", help="oldest day to fetch (YYYY-MM-DD); default: until the watch runs out")
    ap.add_argument("--days", type=int, help="fetch at most this many new days this run")
    ap.add_argument("--dry", action="store_true", help="write ~/.ric-garmin/export.json, do not upload")
    args = ap.parse_args()

    try:
        from garminconnect import GarminConnectTooManyRequestsError
    except ImportError:
        raise Stop("garminconnect is not installed. Run Garmin.command, which sets it up.")
    today = dt.date.today()
    oldest = dt.date.fromisoformat(args.since) if args.since else dt.date(2010, 1, 1)
    cache = load_cache()
    first = not cache["days"]
    api = connect()
    if first:
        print("First run: walking back through your whole history. This can take a\n"
              "while — it is paced so Garmin does not lock you out. Later runs take\n"
              "seconds. It is safe to stop and press the button again; nothing is lost.\n")

    limited = False
    try:
        print("Activities…", flush=True)
        print(f"  {pull_activities(api, cache)} new", flush=True)
        print("Days (sleep, HRV, readiness, stress, Body Battery)…", flush=True)
        print(f"  {pull_days(api, cache, oldest, today, args.days)} fetched", flush=True)
    except GarminConnectTooManyRequestsError:
        limited = True
        save_cache(cache)
        print("\nGarmin is rate-limiting. Uploading what is in so far — press the button\n"
              "again in an hour and it carries on from where it stopped.", flush=True)

    out = build(api, cache)
    body = json.dumps(out, separators=(",", ":")).encode()
    EXPORT.write_bytes(body)
    r = out["range"]
    print(f"\n{out['counts']['days']} days ({r['first']} → {r['last']}), "
          f"{out['counts']['activities']} activities, {len(body) / 1e6:.1f} MB")
    if args.dry:
        print(f"--dry: written to {EXPORT}, not uploaded.")
        return 2 if limited else 0
    res = upload(body)
    print(f"Uploaded {res.get('bytes', len(body)) / 1e6:.1f} MB at {res.get('at', '?')}. "
          "Claude can read it now.")
    return 2 if limited else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Stop as e:
        print("\n" + str(e), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nStopped. Everything fetched so far is kept; press the button again to carry on.")
        sys.exit(130)
