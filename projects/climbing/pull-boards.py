#!/usr/bin/env python3
"""
Pull Ric's Kilter and Tension logbooks and turn them into board-data.js.

This is the board equivalent of build-data.py. The difference: nobody writes the
source by hand. The boards already know every climb, every attempt and every
angle — this asks them, and does the arithmetic the page shouldn't have to.

    python3 projects/climbing/pull-boards.py            # both boards
    python3 projects/climbing/pull-boards.py kilter     # just one

Credentials never live in this repo. Usernames sit in board-accounts.json
(gitignored); passwords sit in the macOS Keychain and are handed to boardlib
through its own environment variable, so they never touch disk, argv or `ps`.

Boardlib is unofficial — Aurora can change the API underneath it. When that
happens this script fails loudly rather than writing a half-empty page.
"""

import csv
import json
import os
import sqlite3
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".board-cache"
VENV_BIN = HERE / ".board-venv" / "bin"
ACCOUNTS = HERE / "board-accounts.json"
OUT = HERE / "board-data.js"

# Keychain service name per board. Add yours with:
#   security add-generic-password -s board-sync-kilter -a <username> -w
KEYCHAIN_SERVICE = "board-sync-{board}"

# Hold roles are named per board in the database, but the app draws feet smaller
# than hands, and so do we.
FOOT_ROLES = {"foot"}

# Where each board lives on the web. There is no public profile page — every
# /users/<id> route wants a session — so these links land on the app itself, and
# open the native app instead of the browser wherever the phone knows to.
WEB_HOSTS = {
    "kilter": "https://kilterboardapp.com",
    "tension": "https://tensionboardapp2.com",
}


class Failed(Exception):
    """Something went wrong that should stop the sync rather than half-write it."""


class Misconfigured(Failed):
    """A missing username, password or venv — no amount of retrying will help.

    Exits 2 rather than 1 so the weekly job knows not to bother upgrading
    boardlib and trying again.
    """


# ── credentials ────────────────────────────────────────────────────────────


def load_accounts():
    if not ACCOUNTS.exists():
        raise Misconfigured(
            f"no {ACCOUNTS.name}. Copy board-accounts.example.json to "
            f"{ACCOUNTS.name} and put your board usernames in it."
        )
    accounts = json.loads(ACCOUNTS.read_text(encoding="utf-8"))["boards"]
    for entry in accounts:
        if not entry.get("username"):
            raise Misconfigured(f"{entry.get('board')} has no username in {ACCOUNTS.name}")
    return accounts


def keychain_password(board, username, account=None):
    """
    The Keychain label and the board login are allowed to differ.

    Boards accept either a username or an email to log in, and finding out which
    one an account wants shouldn't mean re-storing the password. `keychain` in
    board-accounts.json pins the label; `username` is what gets sent to the board.
    """
    service = KEYCHAIN_SERVICE.format(board=board)
    account = account or username
    found = subprocess.run(
        ["security", "find-generic-password", "-s", service, "-a", account, "-w"],
        capture_output=True,
        text=True,
    )
    if found.returncode != 0:
        raise Misconfigured(
            f"no Keychain password for {board} ({account}). Store it with:\n"
            f"    security add-generic-password -s {service} -a {account} -w"
        )
    return found.stdout.strip()


# ── boardlib ───────────────────────────────────────────────────────────────


def scrub(text, secret):
    """Never let a password reach a log file, however it got into the output."""
    if secret and text:
        return text.replace(secret, "********")
    return text


def boardlib(args, password, board):
    """Run boardlib with the password supplied the way boardlib expects it."""
    env = dict(os.environ)
    env[f"{board.upper()}_PASSWORD"] = password
    exe = VENV_BIN / "boardlib"
    if not exe.exists():
        raise Misconfigured(
            "boardlib isn't installed. Create the local venv with:\n"
            "    python3 -m venv projects/climbing/.board-venv\n"
            '    projects/climbing/.board-venv/bin/pip install boardlib Pillow "pandas>=2.2,<3"'
        )
    run = subprocess.run([str(exe), *args], env=env, capture_output=True, text=True)
    if run.returncode != 0:
        # Whatever boardlib printed on its way down ends up in the weekly log.
        # It has no reason to echo the password, but the log is written
        # unattended and read later, so don't rely on that.
        tail = scrub(run.stderr or run.stdout, password).strip().splitlines()
        raise Failed(f"boardlib {args[0]} failed for {board}:\n    " + "\n    ".join(tail[-4:]))
    return run.stdout


def inline_avatar(url):
    """
    Bring the profile picture home as a data URI.

    Every room page is a static file that makes no outside requests, and a
    profile picture is not worth breaking that for — so the bytes get baked into
    board-data.js instead of hotlinked off Aurora's CDN.
    """
    if not url or not url.startswith("http"):
        return ""
    try:
        import base64

        import requests

        response = requests.get(url, timeout=20)
        response.raise_for_status()
        if len(response.content) > 250_000:
            return ""
        kind = response.headers.get("Content-Type", "image/jpeg").split(";")[0]
        return f"data:{kind};base64," + base64.b64encode(response.content).decode()
    except Exception:
        return ""


def authenticate(board, username, password):
    """Log in once and keep the session; everything else runs off the token."""
    import boardlib.api.aurora as aurora

    try:
        return aurora.login(board, username, password)
    except ValueError as err:
        raise Misconfigured(f"{board} rejected {username}: {err}") from err


def account_info(board, session, username):
    """
    Ask the board who this account is, so the page can show a real profile
    rather than a name typed into a config file.

    Best-effort on purpose: the logbook is the point, and a profile card is not
    worth failing a sync over. The session token deliberately stays out of the
    returned dict — this goes into a file that gets published.
    """
    import boardlib.api.aurora as aurora

    host = WEB_HOSTS.get(board, "")
    # The session carries an id and a token, not a display handle.
    username = session.get("username") or username
    account = {"username": username, "host": host, "profile": host, "userId": None}
    try:
        user_id = session.get("user_id")
        account["userId"] = user_id
        if user_id:
            # /users/<id> needs a session, so it's a link for Ric on his own
            # devices — where the app claims the domain, it opens the app.
            account["profile"] = f"{host}/users/{user_id}"
        try:
            user = aurora.get_user(board, session.get("token"), user_id)["user"]
            account["displayName"] = user.get("name") or ""
            account["created"] = (user.get("created_at") or "")[:10]
            account["avatar"] = inline_avatar(user.get("avatar_image") or "")
        except Exception:
            pass
    except Exception as err:
        print(f"  (couldn't read the profile: {type(err).__name__}) ")
    return account


def sync_board(board, username, password, token):
    """
    Refresh the shared climb database, then download the logbook.

    The database goes through boardlib's CLI, which handles the APK extraction
    and delta sync. The logbook does not: boardlib's CLI strips the climb UUID
    out of its CSV, and without it there is no way to know which climb a row
    refers to — the names alone aren't unique. So the logbook comes from the
    Python API, which keeps the UUID, and the CSV is written here as a cache.
    """
    import boardlib.api.aurora as aurora

    CACHE.mkdir(exist_ok=True)
    db_path = CACHE / f"{board}.db"
    csv_path = CACHE / f"{board}-logbook.csv"

    print(f"  {board}: syncing database…", flush=True)
    boardlib(["database", board, str(db_path), "-u", username], password, board)

    print(f"  {board}: downloading logbook…", flush=True)
    frame = aurora.logbook_entries(board, token, str(db_path))
    records = frame.to_dict(orient="records")

    if records:
        with csv_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(records[0].keys()))
            writer.writeheader()
            writer.writerows(records)

    return db_path, records


# ── the board itself ───────────────────────────────────────────────────────


def parse_frames(frames):
    """'p1100r15p1103r15' -> [(placement_id, role_id), ...]"""
    holds = []
    for chunk in frames.split("p"):
        if not chunk or "r" not in chunk:
            continue
        placement, _, role = chunk.partition("r")
        if placement.isdigit() and role.isdigit():
            holds.append((int(placement), int(role)))
    return holds


def board_geometry(conn, layout_ids, used_placements):
    """
    Work out which physical board to draw each layout on.

    A layout (say "Kilter Board Original") comes in sizes, and the logbook never
    says which one is bolted to Ric's wall. So infer it: the smallest listed size
    whose edges contain every hold he has actually climbed on. That way the render
    frames his board, not the biggest board anyone owns.
    """
    layouts = {}
    for layout_id in sorted(layout_ids):
        row = conn.execute(
            "SELECT l.name, l.product_id, p.name FROM layouts l "
            "JOIN products p ON p.id = l.product_id WHERE l.id = ?",
            (layout_id,),
        ).fetchone()
        if not row:
            continue
        layout_name, product_id, product_name = row

        placements = {
            pid: (x, y)
            for pid, x, y in conn.execute(
                "SELECT pl.id, h.x, h.y FROM placements pl "
                "JOIN holes h ON h.id = pl.hole_id WHERE pl.layout_id = ?",
                (layout_id,),
            )
        }
        mine = [placements[p] for p in used_placements.get(layout_id, ()) if p in placements]

        sizes = conn.execute(
            "SELECT name, edge_left, edge_right, edge_bottom, edge_top FROM product_sizes "
            "WHERE product_id = ? AND is_listed = 1",
            (product_id,),
        ).fetchall()

        def fits(size):
            _, left, right, bottom, top = size
            return all(left <= x <= right and bottom <= y <= top for x, y in mine)

        candidates = [s for s in sizes if fits(s)] if mine else list(sizes)
        if not candidates:
            candidates = list(sizes)
        # Smallest board that still holds every climb he's logged.
        name, left, right, bottom, top = min(
            candidates, key=lambda s: (s[2] - s[1]) * (s[4] - s[3])
        )

        roles = {
            str(rid): {"name": rname, "color": "#" + color}
            for rid, rname, color in conn.execute(
                "SELECT id, name, screen_color FROM placement_roles WHERE product_id = ?",
                (product_id,),
            )
        }

        layouts[str(layout_id)] = {
            "name": layout_name,
            "product": product_name,
            "size": name,
            "frame": {"x": left, "y": bottom, "w": right - left, "h": top - bottom},
            "roles": roles,
            # Every hold on the wall, so the unlit board shows through behind a climb.
            "grid": sorted(
                [x, y]
                for x, y in placements.values()
                if left <= x <= right and bottom <= y <= top
            ),
        }
    return layouts


def grade_table(conn):
    return {
        difficulty: boulder
        for difficulty, boulder in conn.execute(
            "SELECT difficulty, boulder_name FROM difficulty_grades"
        )
    }


# ── reading a logbook ──────────────────────────────────────────────────────


def truthy(value):
    return str(value).strip().lower() in {"1", "true", "yes", "t"}


def read_logbook(board, db_path, records, report):
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    grades = grade_table(conn)

    entries = []
    climbs = {}
    used_placements = defaultdict(set)
    layout_ids = set()

    if True:
        for row in records:
            # climb_angle_uuid is "<climb uuid>-<angle>"; climb_uuid is there too
            # on ascent rows, so prefer it and fall back to splitting.
            angle_uuid = str(row.get("climb_angle_uuid") or "")
            uuid = str(row.get("climb_uuid") or "") or (
                angle_uuid.rsplit("-", 1)[0] if angle_uuid else ""
            )
            name = row.get("climb_name") or "Unnamed"
            day = str(row.get("date") or "")[:10]
            if not day:
                report["undated"].append(f"{board}: {name}")
                continue

            try:
                angle = int(float(row.get("angle") or 0))
            except ValueError:
                angle = 0

            climb = conn.execute(
                "SELECT layout_id, setter_username, frames, description "
                "FROM climbs WHERE uuid = ? COLLATE NOCASE",
                (uuid,),
            ).fetchone()

            if climb and uuid not in climbs:
                layout_id, setter, frames, description = climb
                layout_ids.add(layout_id)
                holds = parse_frames(frames)
                placements = {
                    pid: (x, y)
                    for pid, x, y in conn.execute(
                        "SELECT pl.id, h.x, h.y FROM placements pl "
                        "JOIN holes h ON h.id = pl.hole_id WHERE pl.layout_id = ?",
                        (layout_id,),
                    )
                }
                drawn = []
                for placement_id, role_id in holds:
                    if placement_id in placements:
                        x, y = placements[placement_id]
                        drawn.append([x, y, role_id])
                        used_placements[layout_id].add(placement_id)
                climbs[uuid] = {
                    "name": name,
                    "setter": setter,
                    "layout": str(layout_id),
                    "holds": drawn,
                    "note": (description or "").strip()[:280],
                }
            elif not climb:
                report["unmatched"].append(f"{board}: {name}")

            # What the crowd thinks of it, at this angle.
            community = conn.execute(
                "SELECT display_difficulty, benchmark_difficulty, ascensionist_count, "
                "quality_average, fa_username FROM climb_stats "
                "WHERE climb_uuid = ? COLLATE NOCASE AND angle = ?",
                (uuid, angle),
            ).fetchone()

            logged = (row.get("logged_grade") or "").strip()
            displayed = (row.get("displayed_grade") or "").strip()

            entry = {
                "board": board,
                "uuid": uuid,
                "name": name,
                "date": day,
                "angle": angle,
                "grade": displayed or logged,
                "loggedGrade": logged,
                "ascent": truthy(row.get("is_ascent")),
                "mirror": truthy(row.get("is_mirror")),
                "benchmark": truthy(row.get("is_benchmark")),
                "repeat": truthy(row.get("is_repeat")),
                "tries": int(float(row.get("tries") or 1)),
                "triesTotal": int(float(row.get("tries_total") or 0)),
                "sessions": int(float(row.get("sessions_count") or 1)),
                "comment": (row.get("comment") or "").strip(),
            }
            if community:
                difficulty, benchmark, ascents, quality, fa = community
                entry["difficulty"] = round(difficulty, 2)
                entry["communityGrade"] = grades.get(int(round(difficulty)), "")
                entry["isBenchmarkGrade"] = benchmark is not None
                entry["crowd"] = ascents
                entry["quality"] = round(quality, 2)
                entry["fa"] = fa
            entries.append(entry)

    layouts = board_geometry(conn, layout_ids, used_placements)
    conn.close()
    entries.sort(key=lambda e: (e["date"], e["name"]))
    return entries, climbs, layouts


# ── the numbers worth showing ──────────────────────────────────────────────


def summarize(entries):
    """
    Board stats are not crag stats. A session is a day, a send is an ascent, and
    the interesting axis — the one rock doesn't have — is angle.
    """
    sends = [e for e in entries if e["ascent"]]
    days = sorted({e["date"] for e in entries})
    graded = [e for e in sends if e.get("difficulty")]

    hardest = max(graded, key=lambda e: e["difficulty"], default=None)
    grind = max(entries, key=lambda e: e["triesTotal"], default=None)

    by_angle = defaultdict(lambda: {"sends": 0, "attempts": 0, "hardest": None})
    for entry in entries:
        bucket = by_angle[entry["angle"]]
        bucket["attempts"] += 1
        if entry["ascent"]:
            bucket["sends"] += 1
            if entry.get("difficulty") and (
                bucket["hardest"] is None
                or entry["difficulty"] > bucket["hardest"]["difficulty"]
            ):
                bucket["hardest"] = {
                    "difficulty": entry["difficulty"],
                    "grade": entry.get("communityGrade") or entry["grade"],
                    "name": entry["name"],
                    "date": entry["date"],
                }

    pyramid = Counter(
        e.get("communityGrade") or e["grade"] for e in sends if (e.get("communityGrade") or e["grade"])
    )
    order = {}
    for entry in sends:
        label = entry.get("communityGrade") or entry["grade"]
        if label and entry.get("difficulty"):
            order.setdefault(label, entry["difficulty"])

    # Sessions per month, for the activity strip.
    months = Counter(day[:7] for day in days)

    return {
        "sessions": len(days),
        "firstSession": days[0] if days else None,
        "lastSession": days[-1] if days else None,
        "entries": len(entries),
        "sends": len(sends),
        "flashes": sum(1 for e in sends if e["tries"] == 1 and not e["repeat"]),
        "uniqueSends": len({e["uuid"] for e in sends}),
        "benchmarks": len({e["uuid"] for e in sends if e["benchmark"]}),
        "totalTries": sum(e["tries"] for e in entries),
        "hardest": None
        if not hardest
        else {
            "grade": hardest.get("communityGrade") or hardest["grade"],
            "name": hardest["name"],
            "angle": hardest["angle"],
            "date": hardest["date"],
            "uuid": hardest["uuid"],
        },
        "grind": None
        if not grind or grind["triesTotal"] < 2
        else {
            "name": grind["name"],
            "tries": grind["triesTotal"],
            "sessions": grind["sessions"],
            "angle": grind["angle"],
            "sent": grind["ascent"],
            "uuid": grind["uuid"],
        },
        "angles": {
            str(angle): data for angle, data in sorted(by_angle.items())
        },
        "pyramid": [
            {"grade": grade, "count": count, "order": order.get(grade, 0)}
            for grade, count in sorted(pyramid.items(), key=lambda kv: order.get(kv[0], 0))
        ],
        "months": [{"month": m, "sessions": c} for m, c in sorted(months.items())],
    }


# A climb nobody has repeated is noise, not a route. Thirty ascents is where the
# board's library stops being one-offs and starts being things worth finding.
CATALOGUE_MIN_ASCENTS = 30


def catalogue_geometry(board_data):
    """
    Which board to build the library for: the one Ric actually climbs on.

    Taken from the logbook sync, which already worked out his layout and size —
    so the library only ever contains climbs that physically fit his wall.
    """
    if not board_data:
        return None
    layouts = board_data.get("layouts") or {}
    if not layouts:
        return None
    # The layout he has logged the most climbs on, if he somehow has more than one.
    counts = Counter(
        climb.get("layout") for climb in (board_data.get("climbs") or {}).values()
    )
    layout_id = counts.most_common(1)[0][0] if counts else next(iter(layouts))
    layout = layouts.get(str(layout_id)) or next(iter(layouts.values()))
    return int(layout_id), layout["frame"]


def build_catalogue(board, db_path, layout_id, frame, minimum=CATALOGUE_MIN_ASCENTS):
    """
    The browsable library: every climb on Ric's board that people actually climb.

    Shipped as its own file because it is megabytes and the logbook is kilobytes.
    board.html only fetches it if you open the "All climbs" view, and the weekly
    sync doesn't touch it — the library moves slowly, and rewriting a multi-MB
    file into git every week would bloat the history for nothing.

    Records are positional arrays rather than objects: at ten thousand climbs,
    JSON key names are most of the file.
    """
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    grades = grade_table(conn)

    placements = {
        pid: (x, y)
        for pid, x, y in conn.execute(
            "SELECT pl.id, h.x, h.y FROM placements pl "
            "JOIN holes h ON h.id = pl.hole_id WHERE pl.layout_id = ?",
            (layout_id,),
        )
    }

    left, bottom = frame["x"], frame["y"]
    right, top = left + frame["w"], bottom + frame["h"]

    rows = conn.execute(
        "SELECT c.uuid, c.name, c.setter_username, c.frames, s.angle, "
        "       s.display_difficulty, s.ascensionist_count, s.quality_average, "
        "       s.benchmark_difficulty "
        "FROM climbs c JOIN climb_stats s ON s.climb_uuid = c.uuid "
        "WHERE c.layout_id = ? AND c.is_listed = 1 AND c.is_draft = 0 "
        "  AND c.frames_count = 1 "
        "  AND c.edge_left >= ? AND c.edge_right <= ? "
        "  AND c.edge_bottom >= ? AND c.edge_top <= ? "
        "  AND s.ascensionist_count >= ? "
        "ORDER BY s.ascensionist_count DESC",
        (layout_id, left, right, bottom, top, minimum),
    ).fetchall()
    conn.close()

    climbs = {}
    order = []
    for uuid, name, setter, frames, angle, difficulty, ascents, quality, benchmark in rows:
        key = uuid.lower()
        if key not in climbs:
            holds = []
            for placement_id, role_id in parse_frames(frames):
                if placement_id in placements:
                    x, y = placements[placement_id]
                    holds.extend((x, y, role_id))
            if not holds:
                continue
            climbs[key] = [name, setter, holds, []]
            order.append(key)
        climbs[key][3].append(
            [angle, round(difficulty, 1), ascents, round(quality, 2), 1 if benchmark else 0]
        )

    return {
        "board": board,
        "layout": str(layout_id),
        "minAscents": minimum,
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        # difficulty -> "6b/V4", so the page can label a grade without the database.
        "grades": {str(k): v for k, v in grades.items()},
        # uuid -> [name, setter, [x,y,role, ...], [[angle, difficulty, ascents, quality, benchmark], ...]]
        "climbs": {key: climbs[key] for key in order},
    }


def write_catalogue(board, catalogue):
    out = HERE / f"board-catalogue-{board}.js"
    out.write_text(
        f"// Generated by pull-boards.py --catalogue — every {board} climb on Ric's board\n"
        f"// with at least {catalogue['minAscents']} ascents. Loaded on demand, not on page load.\n"
        "window.BOARD_CATALOGUE = window.BOARD_CATALOGUE || {};\n"
        f"window.BOARD_CATALOGUE[{json.dumps(board)}] = "
        + json.dumps(catalogue, separators=(",", ":"), ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )
    size = out.stat().st_size / 1_000_000
    print(
        f"  library: {len(catalogue['climbs']):,} climbs "
        f"(≥{catalogue['minAscents']} ascents) → {out.name} ({size:.1f} MB)"
    )


def write_data(boards, report):
    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "pull-boards.py",
        "boards": boards,
    }
    OUT.write_text(
        "// Generated by pull-boards.py from the Kilter and Tension logbooks — do not edit by hand.\n"
        "window.BOARD_DATA = " + json.dumps(payload, indent=1, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    size = OUT.stat().st_size / 1024
    print(f"\nwrote {OUT.relative_to(HERE.parent.parent)} ({size:.0f} KB)")


def main(argv):
    args = [a.lower() for a in argv[1:]]
    catalogue_only = "--catalogue-only" in args
    with_catalogue = catalogue_only or "--catalogue" in args
    wanted = {a for a in args if not a.startswith("-")}
    try:
        accounts = load_accounts()
    except Failed as err:
        print(f"error: {err}", file=sys.stderr)
        return 2 if isinstance(err, Misconfigured) else 1

    accounts = [a for a in accounts if not wanted or a["board"].lower() in wanted]
    if not accounts:
        print(f"error: no configured board matches {', '.join(wanted)}", file=sys.stderr)
        return 2

    report = {"undated": [], "unmatched": []}
    boards = {}
    existing = {}
    if OUT.exists():
        # Keep boards we aren't syncing this run instead of dropping them.
        text = OUT.read_text(encoding="utf-8")
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                existing = json.loads(text[start : end + 1]).get("boards", {})
            except json.JSONDecodeError:
                existing = {}
    boards.update(existing)

    failures = []
    only_misconfigured = True
    for account in accounts:
        board = account["board"]
        label = account.get("label") or board.title()
        print(f"\n{label} ({account['username']})")

        # Rebuilding the library needs no login — the climb database is public,
        # and it's already on disk from the last sync.
        if catalogue_only:
            db_path = CACHE / f"{board}.db"
            if not db_path.exists():
                print(f"  ! no {db_path.name} yet — run a normal sync first")
                failures.append(board)
                continue
            geometry = catalogue_geometry(boards.get(board))
            if not geometry:
                print("  ! don't know which board this is yet — run a normal sync first")
                failures.append(board)
                continue
            layout_id, frame = geometry
            write_catalogue(board, build_catalogue(board, db_path, layout_id, frame))
            continue

        try:
            password = keychain_password(
                board, account["username"], account.get("keychain")
            )
            if board == "kilter":
                # Kilter left Aurora — its own stack (Keycloak + PowerSync + a REST
                # API) is a different animal, so it lives in its own module.
                import kilter_v2

                try:
                    entries, climbs, layouts, profile = kilter_v2.sync(account, password)
                except kilter_v2.KilterError as err:
                    raise Failed(str(err)) from err
            else:
                session = authenticate(board, account["username"], password)
                profile = account_info(board, session, account["username"])
                db_path, records = sync_board(
                    board, account["username"], password, session.get("token")
                )
                entries, climbs, layouts = read_logbook(board, db_path, records, report)
        except Failed as err:
            print(f"  ! {err}")
            failures.append(board)
            only_misconfigured &= isinstance(err, Misconfigured)
            continue

        stats = summarize(entries)
        boards[board] = {
            "label": label,
            "account": profile,
            "layouts": layouts,
            "climbs": climbs,
            "entries": entries,
            "stats": stats,
        }
        print(
            f"  {stats['entries']} logbook rows · {stats['sends']} sends · "
            f"{stats['sessions']} sessions"
        )
        if stats["hardest"]:
            h = stats["hardest"]
            print(f"  hardest: {h['grade']} {h['name']} at {h['angle']}° ({h['date']})")
        if stats["grind"]:
            g = stats["grind"]
            verb = "sent after" if g["sent"] else "still open after"
            print(f"  longest project: {g['name']} — {verb} {g['tries']} tries")

        # The browsable library is built from the Aurora SQLite database. Kilter
        # doesn't have one — its catalogue would come from the REST search — so it
        # skips this step and simply has no "All climbs" view for now.
        if with_catalogue and board != "kilter":
            geometry = catalogue_geometry(boards[board])
            if geometry:
                layout_id, frame = geometry
                write_catalogue(board, build_catalogue(board, db_path, layout_id, frame))

    if not boards:
        print("\nnothing written — every board failed", file=sys.stderr)
        return 2 if only_misconfigured else 1

    write_data(boards, report)

    for label, items in report.items():
        if items:
            print(f"\n{label} ({len(items)}):")
            for item in items[:20]:
                print(f"  {item}")
            if len(items) > 20:
                print(f"  ... and {len(items) - 20} more")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
