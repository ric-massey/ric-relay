#!/usr/bin/env python3
"""Give every title in entertainment-data.js its facts, and then its face.

Two stages, deliberately separated, because they have different costs and
different rules.

  STAGE 1 — FACTS. No key, no account, nothing to sign up for.
    Wikipedia finds the article, Wikidata answers the questions: year, runtime,
    director, genre, IMDb id — and, crucially, the TMDB id. Wikidata is CC0, so
    there is nothing to attribute and nothing to be careful about. The one-line
    synopsis comes from the Wikipedia extract (CC BY-SA, credited on the page).

  STAGE 2 — ART. Needs a free TMDB key in the Keychain.
    By the time this runs, stage 1 has already handed it the exact TMDB id, so
    there is no searching and no guessing: it fetches that film's poster and
    downloads it into assets/posters/. TMDB's terms allow this with attribution,
    which the pages carry.

Why not just search TMDB by title? Because "Greater" is three films and
"Obsession" is nine, and a fuzzy title match puts a stranger's poster on Ric's
list. Wikidata's id is an identity, not a guess. It also means an ambiguous
title is settled ONCE, by hand, on the row — and both stages then agree forever.

House rules this follows, same as pull-apex.py:
  * The API key lives in the Keychain, never in the repo.
  * Anything typed in by hand wins. Set `wd` or `tmdb` on a row yourself and
    neither stage will second-guess it.
  * A re-run is cheap: a row that already has its facts is skipped unless
    --refresh says otherwise, and the file is written as it goes, so stopping
    halfway loses nothing.
  * What it is not sure about is REPORTED, not silently taken.

Stdlib only — the site has no build step and no dependencies.

Usage:
    python3 projects/entertainment/pull-entertainment.py            # both stages
    python3 projects/entertainment/pull-entertainment.py --facts    # stage 1 only
    python3 projects/entertainment/pull-entertainment.py --art      # stage 2 only
    python3 projects/entertainment/pull-entertainment.py --dry-run
    python3 projects/entertainment/pull-entertainment.py --only goodfellas
    python3 projects/entertainment/pull-entertainment.py --limit 20

Stage 2 setup, once:
    # free key, 2 minutes, no card: https://www.themoviedb.org/settings/api
    security add-generic-password -s tmdb -a ricmassey -U -w
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
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

WIKI = "https://en.wikipedia.org"
WD = "https://www.wikidata.org"
TMDB_API = "https://api.themoviedb.org/3"
TMDB_IMG = "https://image.tmdb.org/t/p"

# w342 is what a 152px tile needs on a 2x screen. w780 backdrops are pulled only
# for starred titles, which are the only ones the billboard ever shows.
POSTER_SIZE = "w342"
BACKDROP_SIZE = "w780"

KEYCHAIN_SERVICE = "tmdb"
KEYCHAIN_ACCOUNT = "ricmassey"

# Wikimedia asks for a real User-Agent that says who to contact. Being a good
# citizen of an API nobody charges us for is the whole price of admission.
UA = "RicsWebsite-entertainment/1.0 (https://ricmassey.com; rmbuster82@gmail.com)"

PAUSE = 0.12          # polite with Wikimedia; TMDB allows far more

# What counts as "yes, that article is the thing on Ric's list". Anything else
# — a song, a person, a disambiguation page — is a miss, not a match.
FILMISH = {
    "Q11424":    "film",
    "Q202866":   "animated film",
    "Q24869":    "feature film",
    "Q506240":   "television film",
    "Q24856":    "film series",
    "Q5398426":  "television series",
    "Q1259759":  "miniseries",
    "Q581714":   "animated series",
    "Q117467246": "animated television series",
    "Q15416":    "television programme",
    "Q7725310":  "series of creative works",
    "Q20937557": "series",
    "Q3464665":  "television season",
    "Q1366112":  "documentary film",
    "Q93204":    "documentary",
}

# Wikidata's genres run to a dozen per film and get very specific: "police
# procedural film", "comedy of remarriage", "techno-thriller". The page has room
# for three, and a filter menu is useless if it lists "Action", "Action comedy",
# "Action thriller" and "Science fiction action" as four separate things.
#
# So each entry is (what to look for, what to call it). A label is reduced to
# every canonical genre it contains — "science fiction action" is both — in this
# order, most recognisable first. The canonical name is what gets stored, never
# the label that matched.
GENRE_ORDER = [
    ("action", "Action"), ("adventure", "Adventure"),
    ("science fiction", "Science fiction"), ("sci-fi", "Science fiction"),
    ("horror", "Horror"), ("thriller", "Thriller"), ("crime", "Crime"),
    ("comedy", "Comedy"), ("drama", "Drama"),
    ("romantic", "Romance"), ("romance", "Romance"),
    ("fantasy", "Fantasy"), ("animated", "Animation"), ("animation", "Animation"),
    ("documentary", "Documentary"), ("western", "Western"), ("war", "War"),
    ("musical", "Musical"), ("mystery", "Mystery"), ("superhero", "Superhero"),
    ("heist", "Heist"), ("spy", "Spy"), ("disaster", "Disaster"),
    ("martial arts", "Martial arts"), ("zombie", "Zombie"), ("slasher", "Slasher"),
    ("gangster", "Gangster"), ("noir", "Film noir"),
    ("biographical", "Biographical"), ("biopic", "Biographical"),
    ("historical", "Historical"), ("period", "Historical"),
    ("sports", "Sports"), ("teen", "Teen"),
    ("children", "Family"), ("family", "Family"),
    ("survival", "Survival"), ("road movie", "Road movie"),
]

class Failed(Exception):
    """Something we cannot fix by trying again."""


# A python.org install ships certifi but only wires it up when someone runs
# "Install Certificates.command", which nobody remembers to do — so urllib gets
# CERTIFICATE_VERIFY_FAILED on every https call while curl in the same shell is
# perfectly happy. Rather than touching the Python install, find the bundle
# ourselves. ssl.create_default_context() is still the fallback, so this works
# unchanged anywhere the certs are already set up.
def ssl_context() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


SSL = ssl_context()


# ── the wire ───────────────────────────────────────────────────────────────

def get_json(url: str, tries: int = 3) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=25, context=SSL) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {}
            if e.code in (429, 503) and attempt < tries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise Failed(f"HTTP {e.code} for {url.split('?')[0]}") from None
        except urllib.error.URLError as e:
            if attempt < tries - 1:
                time.sleep(1.5)
                continue
            raise Failed(f"could not reach {url.split('/')[2]}: {e.reason}") from None
        finally:
            time.sleep(PAUSE)
    return {}


def download(url: str, dest: Path) -> bool:
    """Fetch one image into the repo. False if it was already there."""
    if dest.exists() and dest.stat().st_size > 0:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=40, context=SSL) as r, tmp.open("wb") as f:
            f.write(r.read())
    except Exception as e:                     # a missing poster is not fatal
        tmp.unlink(missing_ok=True)
        print(f"      ! image failed ({e})")
        return False
    tmp.replace(dest)
    time.sleep(PAUSE)
    return True


# ── the data file ──────────────────────────────────────────────────────────
#
# The file is JS, not JSON, and hand-editable on purpose — so it is read with a
# parser that tolerates what a person types, and written back in exactly the
# format the page's own Export button produces. Those two have to agree or every
# run fights the last export.

ROW = re.compile(r"\{[^{}]*\}", re.S)
FIELD = re.compile(r"(\w+)\s*:\s*(\"(?:[^\"\\]|\\.)*\"|true|false|-?\d+(?:\.\d+)?)")
GENRES = re.compile(r"genres\s*:\s*(\[[^\]]*\])")

# Order matters: this is the order fields are written back out in, and it has to
# match FIELDS in assets/entertainment-room.js.
FIELDS = ["id", "title", "status", "count", "series", "where", "pick", "note",
          "seen", "wd", "wdok", "tmdb", "imdb", "year", "runtime", "genres", "director",
          "overview", "rating", "poster", "backdrop",
          "streams", "rents", "checked"]


def read_rows() -> tuple[str, list[dict]]:
    text = DATA.read_text()
    cut = text.index("window.ENTERTAINMENT_DATA")
    head = text[:cut].rstrip()
    rows = []
    for m in ROW.finditer(text[cut:]):
        chunk = m.group(0)
        row = {k: json.loads(v) for k, v in FIELD.findall(chunk)}
        g = GENRES.search(chunk)
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
    DATA.write_text(f"{head}\nwindow.ENTERTAINMENT_DATA = [\n" + "\n".join(out) + "\n];\n")


# ── stage 1: who is this film ──────────────────────────────────────────────

ARTICLES = re.compile(r"^(the|a|an)\s+", re.I)
NOISE = re.compile(r"[^a-z0-9 ]+")
PAREN = re.compile(r"\s*\((?:all|\d+\s*-\s*\d+)\)\s*$", re.I)


def normal(s: str) -> str:
    """For SEARCHING: punctuation and case gone, leading article gone."""
    return NOISE.sub("", ARTICLES.sub("", s.strip().lower())).strip()


def exact(s: str) -> str:
    """For MATCHING: punctuation and case gone, article KEPT.

    Stripping the article on both sides was a real bug: it made "Heat" equal
    "The Heat" and "The Others" equal "Others", and both of those are different
    films that Ric owns opinions about. An article is part of a title.
    """
    return NOISE.sub("", s.strip().lower()).strip()


def plain(title: str) -> str:
    """A franchise row names a series, not a film — search the series name."""
    return PAREN.sub("", title).strip()


DISAMBIG = re.compile(r"\s*\([^)]*\)\s*$")
# "(2016 film)" — Wikipedia only dates a disambiguator when several films share
# the name, which is the one case worth a second pair of eyes.
YEAR_DISAMBIG = re.compile(r"\(\s*\d{4}\b[^)]*\)\s*$")


def bare(name: str) -> str:
    """An article title with Wikipedia's "(2016 film)" taken off the end."""
    return exact(DISAMBIG.sub("", name))


def claims(entity: dict, prop: str) -> list:
    out = []
    for s in entity.get("claims", {}).get(prop, []):
        dv = s["mainsnak"].get("datavalue", {}).get("value")
        if isinstance(dv, dict):
            out.append(dv.get("id") or dv.get("time") or dv.get("amount") or dv)
        elif dv is not None:
            out.append(dv)
    return out


def summary(title: str) -> dict:
    slug = urllib.parse.quote(title.replace(" ", "_"), safe="")
    return get_json(f"{WIKI}/api/rest_v1/page/summary/{slug}")


def search_titles(title: str) -> list[str]:
    """Ask Wikipedia for candidate articles, film-flavoured."""
    q = urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": f"{title} film",
        "srlimit": 5, "format": "json",
    })
    hits = get_json(f"{WIKI}/w/api.php?{q}").get("query", {}).get("search", [])
    return [h["title"] for h in hits]


def entity(qid: str) -> dict:
    d = get_json(f"{WD}/wiki/Special:EntityData/{qid}.json")
    return (d.get("entities") or {}).get(qid) or {}


def labels(qids: list[str]) -> dict:
    """Resolve Q-ids to English labels, 50 at a time."""
    out = {}
    qids = [q for q in qids if q]
    for i in range(0, len(qids), 50):
        batch = "|".join(qids[i:i + 50])
        q = urllib.parse.urlencode({
            "action": "wbgetentities", "ids": batch,
            "props": "labels", "languages": "en", "format": "json",
        })
        got = get_json(f"{WD}/w/api.php?{q}").get("entities", {})
        for k, v in got.items():
            lab = (v.get("labels") or {}).get("en") or {}
            if lab.get("value"):
                out[k] = lab["value"]
    return out


def tidy_genre(label: str) -> str:
    g = re.sub(r"\s+(film|movie|series)s?$", "", label.strip(), flags=re.I)
    return g[:1].upper() + g[1:]


def rank_genres(names: list[str]) -> list[str]:
    """Three recognisable genres beat twelve precise ones."""
    low = [n.lower() for n in names]
    seen, ranked = set(), []
    for needle, canon in GENRE_ORDER:
        if canon in seen:
            continue
        if any(needle in n for n in low):
            seen.add(canon)
            ranked.append(canon)
        if len(ranked) == 3:
            break
    if not ranked:                             # nothing on the list — take what there is
        ranked = [tidy_genre(n) for n in names[:2]]
    return ranked[:3]


def tidy_existing(rows: list[dict], head: str, dry: bool) -> int:
    """Re-normalise genres already in the file, with no network.

    The canonical names changed once (compound labels like "Action comedy" were
    being stored whole), and re-asking Wikidata for 363 titles to fix a naming
    rule would be rude and slow. A label already on a row still contains the
    words the rule reads, so the rule can simply be applied again.
    """
    hit = 0
    for r in rows:
        g = r.get("genres")
        if not g:
            continue
        fixed = rank_genres(g)
        if fixed != g:
            print(f"  {r['title']}: {g} → {fixed}")
            if not dry:
                r["genres"] = fixed
            hit += 1
    if hit and not dry:
        write_rows(head, rows)
    print(f"\n{hit} rows re-normalised{' (dry run)' if dry else ''}")
    return hit


def identify(row: dict, refresh: bool = False) -> tuple[dict | None, str, list[str]]:
    """Find the Wikidata item for one row. Returns (entity, article, tried)."""
    want = plain(row["title"])
    tried: list[str] = []

    # `wdok` marks an id a HUMAN chose — typed on the row, or picked in the
    # page's chooser. That is never second-guessed. An id this script worked out
    # on its own is just its best guess, and --refresh is exactly the request to
    # guess again with better rules. Conflating the two meant a re-run could
    # only ever re-confirm its own mistakes.
    if row.get("wd") and (row.get("wdok") or not refresh):
        return entity(row["wd"]), want, tried

    candidates = [want]
    s = summary(want)
    if s.get("type") == "disambiguation" or not s.get("wikibase_item"):
        candidates = []
    for c in search_titles(want):
        if c not in candidates:
            candidates.append(c)

    for name in candidates[:6]:
        tried.append(name)
        s = summary(name) if name != want or not s.get("wikibase_item") else s
        qid = s.get("wikibase_item")
        if not qid:
            continue
        ent = entity(qid)
        if not ent:
            continue
        kinds = claims(ent, "P31")
        if not any(k in FILMISH for k in kinds):
            continue
        # The names have to actually MATCH, once Wikipedia's disambiguator is
        # off the end: "The Equalizer (film)" is the Equalizer, but "Defining
        # Moments" is not "Moments" and "The Greater Good" is not "Greater".
        # Anything looser than equality and a one-word title on this list — and
        # there are a lot of them — quietly collects somebody else's film.
        label = (ent.get("labels", {}).get("en") or {}).get("value", name)
        if not any(bare(x) == exact(want) for x in (label, name)):
            continue
        ent["_article"] = name
        ent["_extract"] = s.get("extract") or ""
        # Which disambiguator Wikipedia used says how risky the match is, and
        # the difference matters: "(film)" only separates the film from a novel
        # or a song, which is no risk at all, while "(2016 film)" means there is
        # MORE THAN ONE FILM of that name and Wikipedia had to pick by year.
        # Flagging the first kind too — as this did at first — buries the real
        # cases under a hundred correct ones, and a list nobody reads is worse
        # than no list.
        ent["_ambiguous"] = bool(YEAR_DISAMBIG.search(name))
        return ent, name, tried
    return None, "", tried


def facts_from(ent: dict) -> tuple[dict, list[str]]:
    """The handful of fields the pages can show, plus ids to resolve later."""
    out: dict = {"wd": ent["id"]}
    dates = [d for d in claims(ent, "P577") if isinstance(d, str)]
    years = sorted(int(d[1:5]) for d in dates if d[1:5].isdigit())
    if years:
        out["year"] = years[0]
    mins = claims(ent, "P2047")
    if mins:
        try:
            out["runtime"] = int(float(str(mins[0]).lstrip("+")))
        except ValueError:
            pass
    imdb = claims(ent, "P345")
    if imdb:
        out["imdb"] = imdb[0]
    tm = claims(ent, "P4947")
    if tm:
        out["tmdb"] = int(tm[0]) if str(tm[0]).isdigit() else tm[0]
    extract = (ent.get("_extract") or "").strip()
    if extract:
        # One or two sentences is a tile's worth; the rest is an essay.
        bits = re.split(r"(?<=[.!?])\s+", extract)
        out["overview"] = " ".join(bits[:2]).strip()
    pending = claims(ent, "P57") + claims(ent, "P136")
    return out, [q for q in pending if isinstance(q, str) and q.startswith("Q")]


def stage_facts(rows: list[dict], head: str, args) -> int:
    todo = [r for r in rows
            if (args.only is None or r["id"] in args.only)
            and (not r.get("wd") or (args.refresh and not r.get("wdok")))]
    if args.limit:
        todo = todo[:args.limit]
    print(f"STAGE 1 · facts — {len(todo)} of {len(rows)} titles to look up"
          f"{' (dry run)' if args.dry_run else ''}\n")

    unsure: list[tuple[dict, list[str]]] = []
    check: list[tuple[str, str, int | str]] = []
    done = 0

    for i, row in enumerate(todo, 1):
        head_line = f"[{i:>3}/{len(todo)}] {row['title']}"
        try:
            ent, article, tried = identify(row, args.refresh)
        except Failed as e:
            print(f"{head_line}\n      ! {e}")
            continue
        if not ent:
            print(f"{head_line}\n      ? no film article matched")
            unsure.append((row, tried))
            continue

        got, qids = facts_from(ent)
        names = labels(qids)
        directors = [names[q] for q in claims(ent, "P57") if q in names]
        genre_names = [names[q] for q in claims(ent, "P136") if q in names]
        if directors:
            got["director"] = ", ".join(directors[:2])
        if genre_names:
            got["genres"] = rank_genres(genre_names)

        if ent.get("_ambiguous"):
            check.append((row["title"], article, got.get("year", "????")))
        print(f"{head_line}\n      {'~' if ent.get('_ambiguous') else '✓'} {article} ({got.get('year', '????')})"
              f"{' · ' + got['director'] if got.get('director') else ''}"
              f"{' · tmdb ' + str(got['tmdb']) if got.get('tmdb') else ' · no tmdb id'}")
        if not args.dry_run:
            row.update(got)
            done += 1
            if done % 10 == 0:                 # write as we go; stopping loses nothing
                write_rows(head, rows)

    if not args.dry_run and done:
        write_rows(head, rows)
    print(f"\n{done} identified"
          f"{' · nothing written (dry run)' if args.dry_run else ''}")

    if unsure:
        print(f"\n{len(unsure)} left alone — settle these by hand, then re-run:\n")
        for row, tried in unsure:
            print(f"  {row['title']}")
            if tried:
                print(f"      looked at: {', '.join(tried[:4])}")
        print("\n  Find the right one on wikidata.org and put its id on the row —\n"
              "  `wd: \"Q42047\"` — then run this again. A hand-set id is never\n"
              "  overwritten, and stage 2 reads the TMDB id straight off it.")

    if check:
        print(f"\n{len(check)} matched on an ambiguous name — worth Ric's eye (~ above):\n")
        for title, article, year in check:
            print(f"  “{title}” → {article} ({year})")
        print("\n  These are exact title matches, but Wikipedia keeps more than one\n"
              "  thing under that name. If one is the wrong film, put the right\n"
              "  `wd:` id on the row and re-run.")
    return done


# ── stage 2: the art ───────────────────────────────────────────────────────

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
        raise Failed("no `security` command — stage 2 wants macOS.") from None
    if found.returncode != 0 or not found.stdout.strip():
        raise Failed(
            "no TMDB key in the Keychain, so there is no art to fetch.\n"
            "Stage 1 has already filled in the facts and the TMDB ids; the\n"
            "posters need a free key:\n"
            "    https://www.themoviedb.org/settings/api\n" + add)
    return found.stdout.strip()


def stage_art(rows: list[dict], head: str, args) -> int:
    try:
        key = api_key()
    except Failed as e:
        print(f"STAGE 2 · art — skipped.\n\n{e}")
        return 0

    todo = [r for r in rows
            if (args.only is None or r["id"] in args.only)
            and r.get("tmdb") and (args.refresh or not r.get("poster"))]
    if args.limit:
        todo = todo[:args.limit]
    print(f"\nSTAGE 2 · art — {len(todo)} posters to fetch"
          f"{' (dry run)' if args.dry_run else ''}\n")

    got = 0
    for i, row in enumerate(todo, 1):
        line = f"[{i:>3}/{len(todo)}] {row['title']}"
        try:
            m = get_json(f"{TMDB_API}/movie/{row['tmdb']}?api_key={key}")
        except Failed as e:
            print(f"{line}\n      ! {str(e).replace(key, '‹key›')}")
            continue
        if not m or not m.get("poster_path"):
            print(f"{line}\n      — no poster on TMDB")
            continue
        if args.dry_run:
            print(f"{line}\n      ✓ would fetch {m['poster_path']}")
            got += 1
            continue

        if download(f"{TMDB_IMG}/{POSTER_SIZE}{m['poster_path']}", POSTERS / f"{row['id']}.jpg"):
            print(f"{line}\n      ✓ poster")
        row["poster"] = True
        if not row.get("overview") and m.get("overview"):
            row["overview"] = m["overview"].strip()
        if m.get("vote_average"):
            row["rating"] = round(m["vote_average"], 1)
        # The billboard only ever shows starred titles, so that is the only
        # place a 780px-wide image earns its bytes.
        if row.get("pick") and m.get("backdrop_path"):
            if download(f"{TMDB_IMG}/{BACKDROP_SIZE}{m['backdrop_path']}", BACKDROPS / f"{row['id']}.jpg"):
                print("      ✓ backdrop")
            row["backdrop"] = True
        got += 1
        if got % 10 == 0:
            write_rows(head, rows)

    if not args.dry_run and got:
        write_rows(head, rows)
    print(f"\n{got} with art"
          f"{' · nothing written (dry run)' if args.dry_run else ''}")
    return got


# ── stage 3: where it is streaming ─────────────────────────────────────────
#
# This is the one fact on the page with a shelf life — things leave Hulu every
# month — so it is kept apart from the art on purpose. Posters are fetched once
# and never change; availability wants re-running every week or two, and doing
# that should not re-download 363 images.
#
# It is stored rather than resolved live because the site is static: a page
# cannot ask TMDB without carrying the key, and a key in a public repo is not a
# key. So the answer is written down WITH THE DATE IT WAS TRUE, the page shows
# that date, and a stale answer is visibly stale instead of quietly wrong.

# TMDB's provider names are the legal ones, not the ones anybody says out loud.
PROVIDER_NAMES = {
    "amazon prime video": "Prime Video",
    "amazon video": "Buy",
    "apple tv plus": "Apple TV+",
    "apple tv": "Buy",
    "disney plus": "Disney+",
    "hbo max": "Max",
    "paramount plus": "Paramount+",
    "paramount plus premium": "Paramount+",
    "peacock premium": "Peacock",
    "peacock premium plus": "Peacock",
    "pluto tv": "Pluto TV",
    "tubi tv": "Tubi",
    "starz": "Starz",
    "netflix standard with advertisements": "Netflix",
    "hulu": "Hulu",
    "plex": "Plex",
    "plex channel": "Plex",
    "youtube": "Buy",
    "google play movies": "Buy",
    "fandango at home": "Buy",
    "microsoft store": "Buy",
}


def provider_name(raw: str) -> str:
    key = raw.strip().lower()
    if key in PROVIDER_NAMES:
        return PROVIDER_NAMES[key]
    # "Max Amazon Channel", "Starz Apple TV Channel" — a reseller of the same
    # thing. Say the thing.
    base = re.sub(r"\s+(amazon|apple tv|roku)\s+channel$", "", key)
    if base in PROVIDER_NAMES:
        return PROVIDER_NAMES[base]
    out = re.sub(r"\s+plus$", "+", base)
    out = re.sub(r"\s+(premium|with ads|standard).*$", "", out)
    return out.title().replace("Tv", "TV").replace("Hbo", "HBO")


def stage_where(rows: list[dict], head: str, args) -> int:
    try:
        key = api_key()
    except Failed as e:
        print(f"\nSTAGE 3 · streaming — skipped.\n\n{e}")
        return 0

    todo = [r for r in rows
            if (args.only is None or r["id"] in args.only)
            and r.get("tmdb") and (args.refresh or not r.get("checked"))]
    if args.limit:
        todo = todo[:args.limit]
    print(f"\nSTAGE 3 · streaming — checking {len(todo)}"
          f"{' (dry run)' if args.dry_run else ''}\n")

    today_str = time.strftime("%Y-%m-%d")
    got = 0
    for i, row in enumerate(todo, 1):
        line = f"[{i:>3}/{len(todo)}] {row['title']}"
        try:
            d = get_json(f"{TMDB_API}/movie/{row['tmdb']}/watch/providers?api_key={key}")
        except Failed as e:
            print(f"{line}\n      ! {str(e).replace(key, '‹key›')}")
            continue
        us = (d.get("results") or {}).get("US") or {}

        def names(bucket):
            seen, out = set(), []
            for p in us.get(bucket) or []:
                n = provider_name(p.get("provider_name", ""))
                if n and n not in seen:
                    seen.add(n)
                    out.append(n)
            return out

        flat = names("flatrate") + names("free") + names("ads")
        paid = names("rent") + names("buy")
        # Dedupe across the two: if it streams, renting it is not news.
        paid = [p for p in paid if p not in flat]

        if args.dry_run:
            print(f"{line}\n      ✓ {', '.join(flat) or '—'}"
                  f"{' · rent: ' + ', '.join(paid[:3]) if paid else ''}")
            got += 1
            continue

        row["streams"] = flat[:4]
        row["rents"] = paid[:3]
        row["checked"] = today_str
        print(f"{line}\n      ✓ {', '.join(flat) or 'not streaming'}"
              f"{' · rent: ' + ', '.join(paid[:3]) if paid else ''}")
        got += 1
        if got % 15 == 0:
            write_rows(head, rows)

    if not args.dry_run and got:
        write_rows(head, rows)
    print(f"\n{got} checked{' · nothing written (dry run)' if args.dry_run else ''}")
    return got


# ── the run ────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--facts", action="store_true", help="stage 1 only (no key needed)")
    ap.add_argument("--art", action="store_true", help="stage 2 only (needs the TMDB key)")
    ap.add_argument("--where", action="store_true",
                    help="stage 3 only — refresh where things are streaming (needs the key)")
    ap.add_argument("--refresh", action="store_true", help="re-ask about rows already filled in")
    ap.add_argument("--dry-run", action="store_true", help="say what would change, write nothing")
    ap.add_argument("--only", metavar="ID", action="append", help="just this row id (repeatable)")
    ap.add_argument("--limit", type=int, help="stop after this many (for a first look)")
    ap.add_argument("--tidy-genres", action="store_true",
                    help="re-apply the genre naming rule to rows already filled in, offline")
    args = ap.parse_args()

    head, rows = read_rows()
    if args.tidy_genres:
        tidy_existing(rows, head, args.dry_run)
        return 0
    every = not (args.facts or args.art or args.where)

    if args.facts or every:
        stage_facts(rows, head, args)
    if args.art or every:
        stage_art(rows, head, args)
    if args.where or every:
        stage_where(rows, head, args)
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
