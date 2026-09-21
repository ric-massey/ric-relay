#!/usr/bin/env python3
"""Give every title in entertainment-data.js a face and a few facts.

The room used to be typographic because there was no art to be had. There is
art to be had; the question was only ever where it loads FROM. Hard rule 4 is
about what the *page* depends on — no CDNs, no external scripts, works opened
as a static file — so a few hundred posters hotlinked at somebody else's server
is out, and a few hundred posters sitting in assets/posters/ is fine. This
script is the difference between the two: it talks to TMDB once, writes the
answers into the committed data file, and downloads the images into the repo.
After it runs the site makes no external request at all.

Same shape as pull-apex.py, for the same reasons:

  * The API key is a secret, so it lives in the Keychain and never in the repo.
  * Anything typed in by hand wins. Set `tmdb` on a row yourself and this
    script will never second-guess it — that is how the eight ambiguous titles
    get settled, and re-running must not undo the settling.
  * A re-run is cheap and safe: a row that already has its facts is skipped
    unless --refresh says otherwise, so this is ~700 requests once and a
    handful ever after.
  * A match it is not sure about is REPORTED, not silently taken. "Greater"
    is three different films and guessing at one of them puts a stranger's
    face on Ric's list.

Stdlib only — the site has no build step and no dependencies.

Setup (once):

    # free key, 2 minutes, no card: https://www.themoviedb.org/settings/api
    security add-generic-password -s tmdb -a ricmassey -U -w

Usage:

    python3 projects/entertainment/pull-tmdb.py            # fill in the gaps
    python3 projects/entertainment/pull-tmdb.py --dry-run  # say what it would do
    python3 projects/entertainment/pull-tmdb.py --refresh  # re-ask for everything
    python3 projects/entertainment/pull-tmdb.py --only the-dark-knight-trilogy
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "entertainment-data.js"
POSTERS = ROOT / "assets" / "posters"
BACKDROPS = ROOT / "assets" / "backdrops"

API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p"

# w342 is the poster size a 160-200px tile actually needs on a 2x screen.
# w780 backdrops are only pulled for the billboard, which is starred titles.
POSTER_SIZE = "w342"
BACKDROP_SIZE = "w780"

KEYCHAIN_SERVICE = "tmdb"
KEYCHAIN_ACCOUNT = "ricmassey"

# TMDB allows about 50 requests a second. We are in no hurry and would rather
# not be the reason a free key gets throttled.
PAUSE = 0.06

# A search hit has to be this close to the title we asked for before it is
# taken without comment. Below it, the row is left alone and printed at the end
# for a human to settle with a hand-set `tmdb` id.
CONFIDENT = 0.84


class Failed(Exception):
    """Something we cannot fix by trying again."""


# ── the key ────────────────────────────────────────────────────────────────

def api_key() -> str:
    """Read the TMDB key out of the Keychain. Never printed, never stored."""
    add = (f"    security add-generic-password -s {KEYCHAIN_SERVICE} "
           f"-a {KEYCHAIN_ACCOUNT} -U -w\n")
    try:
        found = subprocess.run(
            ["security", "find-generic-password",
             "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"],
            capture_output=True, text=True, check=False)
    except FileNotFoundError:
        raise Failed("no `security` command — this script wants macOS.") from None
    if found.returncode != 0:
        raise Failed(
            "no Keychain entry for TMDB. Get a free key at\n"
            "    https://www.themoviedb.org/settings/api\n"
            "then put it in the Keychain (it will prompt for the value):\n" + add)
    key = found.stdout.strip()
    if not key:
        raise Failed("the TMDB Keychain entry is empty. Add it again:\n" + add)
    return key


def scrub(text: str, key: str) -> str:
    """Never let the key reach the terminal, however it got into the output."""
    return text.replace(key, "‹key›") if key else text


# ── the wire ───────────────────────────────────────────────────────────────

def get(path: str, key: str, **params) -> dict:
    params["api_key"] = key
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise Failed("TMDB refused the key (401). Check the Keychain entry.") from None
        if e.code == 429:                      # the one case worth waiting out
            time.sleep(2)
            return get(path, key, **params)
        raise Failed(f"{path}: HTTP {e.code}") from None
    except urllib.error.URLError as e:
        raise Failed(f"could not reach TMDB: {scrub(str(e.reason), key)}") from None
    finally:
        time.sleep(PAUSE)


def download(url: str, dest: Path) -> bool:
    """Fetch one image into the repo. Returns False if it was already there."""
    if dest.exists() and dest.stat().st_size > 0:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        with urllib.request.urlopen(url, timeout=30) as r, tmp.open("wb") as f:
            f.write(r.read())
    except Exception as e:                     # a missing poster is not fatal
        tmp.unlink(missing_ok=True)
        print(f"    ! image failed ({e})")
        return False
    tmp.replace(dest)
    time.sleep(PAUSE)
    return True


# ── the data file ──────────────────────────────────────────────────────────
#
# The file is JS, not JSON, and it is hand-editable on purpose — so it is read
# with a parser that tolerates the shapes a person types, and written back in
# exactly the format the page's own Export button produces. Those two have to
# agree or every run fights the last export.

ROW = re.compile(r"\{[^{}]*\}", re.S)
FIELD = re.compile(r"(\w+)\s*:\s*(\"(?:[^\"\\]|\\.)*\"|true|false|-?\d+(?:\.\d+)?)")

# Order matters: this is the order fields are written back out in.
FIELDS = ["id", "title", "status", "count", "series", "where", "pick", "note",
          "seen", "tmdb", "year", "runtime", "genres", "director", "overview",
          "rating", "poster", "backdrop"]


def read_rows() -> tuple[str, list[dict]]:
    text = DATA.read_text()
    cut = text.index("window.ENTERTAINMENT_DATA")
    head = text[:cut].rstrip()
    rows = []
    for m in ROW.finditer(text[cut:]):
        row = {}
        for k, raw in FIELD.findall(m.group(0)):
            row[k] = json.loads(raw) if raw[0] == '"' else json.loads(raw)
        # genres is a list, which FIELD cannot see; pull it out separately
        g = re.search(r"genres\s*:\s*(\[[^\]]*\])", m.group(0))
        if g:
            row["genres"] = json.loads(g.group(1))
        if row.get("id"):
            rows.append(row)
    if not rows:
        raise Failed("parsed no rows out of entertainment-data.js — refusing to write.")
    return head, rows


def write_rows(head: str, rows: list[dict]) -> None:
    out = []
    for e in rows:
        parts = []
        for k in FIELDS:
            v = e.get(k)
            if v in (None, "", False, [], 0):
                continue
            parts.append(f"{k}: {json.dumps(v, ensure_ascii=False)}")
        for k in sorted(set(e) - set(FIELDS)):          # anything hand-added
            parts.append(f"{k}: {json.dumps(e[k], ensure_ascii=False)}")
        out.append("  { " + ", ".join(parts) + " },")
    body = "\n".join(out)
    DATA.write_text(f"{head}\nwindow.ENTERTAINMENT_DATA = [\n{body}\n];\n")


# ── matching ───────────────────────────────────────────────────────────────

ARTICLES = re.compile(r"^(the|a|an)\s+", re.I)
NOISE = re.compile(r"[^a-z0-9 ]+")


def normal(s: str) -> str:
    s = ARTICLES.sub("", s.strip().lower())
    return NOISE.sub("", s).strip()


def closeness(want: str, got: str) -> float:
    """How much of the asked-for title the answer accounts for, 0..1.

    Deliberately simple and deliberately strict about extra words: "Greater"
    against "Greater Good" should not read as a match, because on this list
    both are real and separate rows.
    """
    a, b = normal(want), normal(got)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    aw, bw = a.split(), b.split()
    shared = len(set(aw) & set(bw))
    return shared / max(len(aw), len(bw))


def franchise_query(title: str) -> str:
    """A franchise row names a series, not a film. Search the series name; the
    first entry is the one with the art everyone recognises."""
    return re.sub(r"\s*\((?:all|\d+\s*-\s*\d+)\)\s*$", "", title).strip()


def find(row: dict, key: str) -> tuple[dict | None, float]:
    """Resolve one row to a TMDB movie. Returns (movie, confidence)."""
    if row.get("tmdb"):                        # hand-set — never second-guessed
        return get(f"/movie/{row['tmdb']}", key,
                   append_to_response="credits"), 1.0

    q = franchise_query(row["title"])
    params = {"query": q, "include_adult": "false"}
    if row.get("year"):
        params["year"] = row["year"]
    hits = get("/search/movie", key, **params).get("results", [])
    if not hits:
        return None, 0.0

    # Popularity breaks ties, but only among answers that actually match the
    # words we asked for — otherwise every short title resolves to a blockbuster.
    scored = sorted(
        ((closeness(q, h.get("title", "")), h.get("popularity", 0), h) for h in hits),
        key=lambda t: (t[0], t[1]), reverse=True)
    best_score, _, best = scored[0]
    full = get(f"/movie/{best['id']}", key, append_to_response="credits")
    return full, best_score


def facts(movie: dict) -> dict:
    """The handful of fields the page can actually show."""
    crew = (movie.get("credits") or {}).get("crew") or []
    directors = [c["name"] for c in crew if c.get("job") == "Director"]
    date = movie.get("release_date") or ""
    out = {
        "tmdb": movie["id"],
        "year": int(date[:4]) if date[:4].isdigit() else None,
        "runtime": movie.get("runtime") or None,
        "genres": [g["name"] for g in movie.get("genres") or []][:3],
        "director": ", ".join(directors[:2]) or None,
        "overview": (movie.get("overview") or "").strip() or None,
        "rating": round(movie.get("vote_average") or 0, 1) or None,
    }
    return {k: v for k, v in out.items() if v}


# ── the run ────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true",
                    help="re-ask TMDB about rows that already have facts")
    ap.add_argument("--dry-run", action="store_true",
                    help="say what would change and write nothing")
    ap.add_argument("--only", metavar="ID", action="append",
                    help="just this row id (repeatable)")
    args = ap.parse_args()

    key = api_key()
    head, rows = read_rows()

    todo = [r for r in rows
            if (args.only is None or r["id"] in args.only)
            and (args.refresh or not r.get("tmdb"))]
    print(f"{len(rows)} titles · {len(todo)} to look up"
          f"{' (dry run)' if args.dry_run else ''}\n")

    unsure: list[tuple[dict, dict | None, float]] = []
    got = imgs = 0

    for i, row in enumerate(todo, 1):
        label = f"[{i:>3}/{len(todo)}] {row['title']}"
        try:
            movie, score = find(row, key)
        except Failed as e:
            print(f"{label}\n    ! {e}")
            continue

        if not movie:
            print(f"{label}\n    — nothing came back")
            unsure.append((row, None, 0.0))
            continue
        if score < CONFIDENT and not row.get("tmdb"):
            print(f"{label}\n    ? “{movie.get('title')}” "
                  f"({(movie.get('release_date') or '????')[:4]}) — too far off, left alone")
            unsure.append((row, movie, score))
            continue

        f = facts(movie)
        print(f"{label}\n    ✓ {movie.get('title')} ({f.get('year', '????')})"
              f"{' · ' + f['director'] if f.get('director') else ''}")
        if args.dry_run:
            got += 1
            continue

        row.update(f)
        if movie.get("poster_path"):
            dest = POSTERS / f"{row['id']}.jpg"
            if download(f"{IMG}/{POSTER_SIZE}{movie['poster_path']}", dest):
                imgs += 1
            if dest.exists():
                row["poster"] = True
        # The billboard only ever shows starred titles, so that is the only
        # place a 780px-wide image earns its bytes.
        if row.get("pick") and movie.get("backdrop_path"):
            dest = BACKDROPS / f"{row['id']}.jpg"
            if download(f"{IMG}/{BACKDROP_SIZE}{movie['backdrop_path']}", dest):
                imgs += 1
            if dest.exists():
                row["backdrop"] = True
        got += 1

    if not args.dry_run and got:
        write_rows(head, rows)

    print(f"\n{got} resolved · {imgs} images downloaded"
          f"{' · nothing written (dry run)' if args.dry_run else ''}")

    if unsure:
        print("\nLeft alone — settle these by hand, then re-run:\n")
        for row, movie, score in unsure:
            guess = (f"closest was “{movie.get('title')}” "
                     f"({(movie.get('release_date') or '????')[:4]}, id {movie['id']}, "
                     f"{score:.0%})" if movie else "no results at all")
            print(f"  {row['title']}\n      {guess}")
        print("\n  Pick the right one at https://www.themoviedb.org/search and put its\n"
              "  id on the row — `tmdb: 27205` — then run this again. A hand-set id\n"
              "  is never overwritten.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Failed as e:
        print(f"\n{e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nstopped — what was written is written, re-run to carry on")
        sys.exit(130)
