#!/usr/bin/env python3
"""
The new Kilter (kiltergrips.com) sync — the half boardlib can't do yet.

When Kilter left Aurora in 2026 it took its logbook with it. There is no Aurora
database to download any more: the new stack is a Keycloak identity provider, a
PowerSync data layer that replicates the board's geometry and Ric's own logs, and
a REST API that answers for individual climbs. This module speaks all three and
hands pull-boards.py the same (entries, climbs, layouts, profile) that the Aurora
path produces, so board.html can't tell the two boards apart.

Nothing here writes a credential anywhere. The password arrives as an argument
(read from the Keychain by pull-boards.py); the access token lives only in memory
and never reaches the file that gets published.
"""

import base64
import json
import re
import uuid
from collections import Counter, defaultdict

import requests

IDP = "https://idp.kiltergrips.com/realms/kilter/protocol/openid-connect/token"
SYNC = "https://sync1.kiltergrips.com/sync/stream"
API = "https://portal.kiltergrips.com/api"
CLIENT_ID = "kilter"          # public Keycloak client; takes the password grant
WEB_HOST = "https://app.kiltergrips.com"

# climbConcat is a run of "h<mounting_hole_uuid>p<placement_type short_ref>".
CONCAT = re.compile(r"h(\d+)p(\d+)")


class KilterError(Exception):
    """Something went wrong that should stop the Kilter sync, loudly."""


# ── auth ────────────────────────────────────────────────────────────────────


def get_token(login, password):
    """Resource-owner password grant against the public `kilter` client."""
    r = requests.post(IDP, data={
        "grant_type": "password",
        "client_id": CLIENT_ID,
        "username": login,
        "password": password,
        "scope": "openid",
    }, timeout=30)
    if r.status_code != 200:
        try:
            why = r.json().get("error_description") or r.json().get("error")
        except Exception:
            why = f"HTTP {r.status_code}"
        raise KilterError(f"Kilter login failed for {login}: {why}")
    token = r.json().get("access_token")
    if not token:
        raise KilterError("Kilter returned no access token")
    return token


# ── PowerSync: the board's geometry and Ric's logs ──────────────────────────


def powersync_pull(token):
    """
    One-shot drain of every bucket the account can see, reassembled into tables.

    PowerSync streams newline-delimited operations that build up a set of SQLite
    tables on the client; here we replay those PUT/REMOVE ops in memory and return
    {table_name: {row_id: row_dict}}. Buckets page at ~1k ops, so we loop, moving
    each bucket's `after` marker forward until nothing reports has_more.
    """
    headers = {"Authorization": f"Token {token}", "Content-Type": "application/json"}
    client_id = str(uuid.uuid4())
    positions = {}
    tables = defaultdict(dict)

    for _round in range(120):
        body = {
            "raw_data": True, "include_checksum": True, "parameters": {},
            "client_id": client_id,
            "buckets": [{"name": b, "after": a} for b, a in positions.items()],
        }
        r = requests.post(SYNC, headers=headers, data=json.dumps(body), stream=True, timeout=180)
        if r.status_code != 200:
            raise KilterError(f"PowerSync refused the stream: HTTP {r.status_code} {r.text[:200]}")

        any_more = False
        done = False
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            msg = json.loads(line)
            if "checkpoint" in msg:
                for bucket in msg["checkpoint"].get("buckets", []):
                    positions.setdefault(bucket["bucket"], "0")
            elif "data" in msg:
                d = msg["data"]
                positions.setdefault(d["bucket"], "0")
                for op in d.get("data", []):
                    table = tables[op.get("object_type")]
                    oid = op.get("object_id")
                    if op.get("op") == "PUT":
                        row = op.get("data")
                        if isinstance(row, str):
                            row = json.loads(row)
                        table[oid] = row
                    elif op.get("op") == "REMOVE":
                        table.pop(oid, None)
                positions[d["bucket"]] = d.get("next_after") or positions[d["bucket"]]
                if d.get("has_more"):
                    any_more = True
            elif "checkpoint_complete" in msg:
                done = True
                break
        r.close()
        if done and not any_more:
            break

    return tables


# ── REST API: logs, climbs, profile ─────────────────────────────────────────


def api_get(token, path, params=None):
    r = requests.get(API + path, headers={"Authorization": f"Bearer {token}"},
                     params=params, timeout=30)
    if r.status_code != 200:
        raise KilterError(f"Kilter API {path} → HTTP {r.status_code}")
    return r.json()


def fetch_climb(token, name, climb_uuid):
    """
    A climb's holds, setter and community stats.

    The catalogue isn't listable by UUID — it's a name search — so search by the
    logged name and keep the row whose UUID matches. Names aren't unique, but the
    UUID makes the match exact.
    """
    data = api_get(token, "/climbs", {"name": name})
    for item in data.get("items", []):
        if item.get("climbUuid") == climb_uuid:
            return item
    return None


def inline_avatar(url):
    """A profile picture, brought home as a data URI so the page makes no requests."""
    if not url or not str(url).startswith("http"):
        return ""
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        if len(resp.content) > 250_000:
            return ""
        kind = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
        return f"data:{kind};base64," + base64.b64encode(resp.content).decode()
    except Exception:
        return ""


# ── building the board ──────────────────────────────────────────────────────


def build_roles(placement_types):
    """short_ref -> {name, color}, so a climb's holds light up the right colour."""
    roles = {}
    for pt in placement_types.values():
        roles[str(pt["short_ref"])] = {
            "name": pt.get("placement_type") or pt.get("id") or "middle",
            "color": "#" + (pt.get("screen_color") or "FFFFFF"),
        }
    return roles


def fit_layout(product_layouts, product_name, used, logs):
    """
    The smallest board that still holds every one of Ric's holds.

    Layouts are the same product in different sizes, and the holds share one set of
    coordinates across all of them — so the frame that fits Ric's wall is the
    smallest listed size of his product whose edges contain every hold he has
    actually climbed on. This is the Aurora path's trick, and it's what stops the
    render sprawling across a 16-wide board when his climbs live on a 12-wide one.
    """
    def valid(row):
        return (row["edge_right"] - row["edge_left"]) > 0

    cands = [(lid, r) for lid, r in product_layouts.items()
             if valid(r) and (not product_name or r.get("product_name") == product_name)]
    if not cands:
        cands = [(lid, r) for lid, r in product_layouts.items() if valid(r)]
    if not cands:
        raise KilterError("no usable Kilter layout in the geometry")

    if used:
        minx = min(x for x, _ in used); maxx = max(x for x, _ in used)
        miny = min(y for _, y in used); maxy = max(y for _, y in used)

        def contains(r):
            return (r["edge_left"] <= minx and r["edge_right"] >= maxx
                    and r["edge_bottom"] <= miny and r["edge_top"] >= maxy)

        def area(r):
            return (r["edge_right"] - r["edge_left"]) * (r["edge_top"] - r["edge_bottom"])

        fits = [c for c in cands if contains(c[1])]
        if fits:
            return min(fits, key=lambda c: area(c[1]))

    # No hold data (or nothing quite contains it): the layout he logs on most.
    counts = Counter(str(lg.get("productLayoutUuid")) for lg in logs if lg.get("productLayoutUuid"))
    for lid, _ in counts.most_common():
        for cand in cands:
            if cand[0] == lid:
                return cand
    return max(cands, key=lambda c: c[1]["edge_right"] - c[1]["edge_left"])


def sync(account, password, log=print):
    """
    Log in, pull everything, and return (entries, climbs, layouts, profile) shaped
    exactly like the Aurora path, ready for summarize() and board.html.
    """
    login = account.get("login") or account.get("username")
    token = get_token(login, password)

    log("  kilter: pulling board geometry (PowerSync)…")
    tables = powersync_pull(token)
    mounting = tables["mounting_holes"]           # uuid -> {x, y, product_name}
    grades = {str(g["difficulty_grade_id"]): g.get("boulder_difficulty") or ""
              for g in tables["difficulty_grades"].values()}
    roles = build_roles(tables["placement_types"])

    log("  kilter: downloading logbook…")
    logs = api_get(token, "/logs")
    if not isinstance(logs, list):
        raise KilterError("Kilter /logs did not return a list")

    # A climb's geometry only has to be fetched once, however many times it's logged.
    climb_details = {}
    for entry in logs:
        cu = entry.get("climbUuid")
        if cu and cu not in climb_details:
            climb_details[cu] = fetch_climb(token, entry.get("climbName") or "", cu)

    # Decode every climb's holds first (no frame yet), tracking which product the
    # holds belong to, then infer the board those holds actually sit on.
    def coord(mh_uuid):
        hole = mounting.get(str(mh_uuid))
        return (hole["x"], hole["y"], hole.get("product_name")) if hole else None

    raw_holds = {}          # uuid -> [(x, y, short_ref), ...]
    used = []               # every (x, y) Ric has touched
    products = Counter()
    for cu, detail in climb_details.items():
        if not detail:
            continue
        drawn = []
        for mh_uuid, short_ref in CONCAT.findall(detail.get("climbConcat") or ""):
            c = coord(mh_uuid)
            if c:
                drawn.append((c[0], c[1], int(short_ref)))
                used.append((c[0], c[1]))
                products[c[2]] += 1
        raw_holds[cu] = drawn

    product_name = products.most_common(1)[0][0] if products else None
    layout_id, layout_row = fit_layout(tables["product_layouts"], product_name, used, logs)
    left, right = layout_row["edge_left"], layout_row["edge_right"]
    bottom, top = layout_row["edge_bottom"], layout_row["edge_top"]

    # climbs: uuid -> {name, setter, layout, holds, note}
    climbs = {}
    for cu, detail in climb_details.items():
        if not detail:
            continue
        climbs[cu] = {
            "name": detail.get("name") or "Unnamed",
            "setter": detail.get("username") or detail.get("faUsername") or "",
            "layout": str(layout_id),
            "holds": [[x, y, r] for (x, y, r) in raw_holds.get(cu, [])
                      if left <= x <= right and bottom <= y <= top],
            "note": "",
        }

    # Ghost grid = the actual holds on this board size, from the placements for the
    # chosen layout — the unlit board that shows through behind a lit climb.
    grid = sorted({
        (mounting[str(v["mounting_hole_uuid"])]["x"], mounting[str(v["mounting_hole_uuid"])]["y"])
        for v in tables["hold_placements"].values()
        if str(v.get("product_layout_uuid")) == str(layout_id)
        and str(v.get("mounting_hole_uuid")) in mounting
    })
    grid = [[x, y] for (x, y) in grid if left <= x <= right and bottom <= y <= top]
    width, height = layout_row.get("width") or 0, layout_row.get("height") or 0
    layouts = {
        str(layout_id): {
            "name": layout_row.get("product_name") or "Kilter Board",
            "product": layout_row.get("product_name") or "Kilter Board",
            "size": f"{width} × {height}" if width and height else "",
            "frame": {"x": left, "y": bottom, "w": right - left, "h": top - bottom},
            "roles": roles,
            "grid": grid,
        }
    }

    # entries: one per log, in the shape summarize()/board.html expect.
    # A repeat is any climb whose uuid we've already seen earlier in time.
    entries = []
    seen = set()
    order = sorted(logs, key=lambda e: str(e.get("createdAt") or ""))
    for lg in order:
        cu = lg.get("climbUuid") or ""
        detail = climb_details.get(cu) or {}
        day = str(lg.get("createdAt") or "")[:10]
        angle = int(lg.get("angle") or 0)
        grade = grades.get(str(lg.get("currentDifficultyId")), "") or \
            grades.get(str(detail.get("currentDifficultyId")), "")
        ascent = bool(lg.get("topped"))
        tries = int(lg.get("attempts") or 1)
        repeat = ascent and cu in seen
        if ascent:
            seen.add(cu)
        entry = {
            "board": "kilter",
            "uuid": cu,
            "name": lg.get("climbName") or detail.get("name") or "Unnamed",
            "date": day,
            "angle": angle,
            "grade": grade,
            "loggedGrade": "",
            "communityGrade": grade,
            "ascent": ascent,
            "mirror": False,
            "benchmark": False,
            "repeat": repeat,
            "tries": tries,
            "triesTotal": tries,
            "sessions": 1,
            "comment": "",
            # difficulty id doubles as the numeric grade order (hardest, pyramid).
            "difficulty": float(lg.get("currentDifficultyId")
                                or detail.get("currentDifficultyId") or 0),
        }
        if detail:
            entry["crowd"] = detail.get("ascentCount")
            entry["quality"] = round(detail.get("qualityAverage") or 0, 2)
            entry["fa"] = detail.get("faUsername") or ""
        entries.append(entry)

    entries.sort(key=lambda e: (e["date"], e["name"]))
    profile = build_profile(token, account, logs)
    return entries, climbs, layouts, profile


def build_profile(token, account, logs):
    """The profile row: who this is, since when, and a link into the app."""
    username = account.get("username") or ""
    user_uuid = logs[0].get("userUuid") if logs else None
    account_out = {
        "username": username,
        "host": WEB_HOST,
        "profile": WEB_HOST,
        "userId": user_uuid,
    }
    if user_uuid:
        try:
            user = api_get(token, f"/users/{user_uuid}")
            account_out["displayName"] = user.get("name") or ""
            account_out["avatar"] = inline_avatar(user.get("profilePicture") or "")
            account_out["created"] = (user.get("createdAt") or "")[:10]
        except Exception:
            pass
    return account_out
