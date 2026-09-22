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

# Below this many TMDB ratings, a match is worth eyeballing even when nothing
# else looks wrong with it. Every mismatch found so far has been an obscure film
# wearing a famous film's name.
OBSCURE = 60

# How many ratings a film needs before a fallback guess is worth writing down.
CONFIDENT_VOTES = 50

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
    ("comedy", "Comedy"), ("sitcom", "Comedy"), ("drama", "Drama"),
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

def get_json(url: str, tries: int = 3, headers: dict | None = None) -> dict:
    head = {"User-Agent": UA, "Accept": "application/json"}
    if headers:
        head.update(headers)
    req = urllib.request.Request(url, headers=head)
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
            if e.code == 401:
                raise Failed(
                    "TMDB refused the credential (401). The Keychain entry is there but\n"
                    "it is not being accepted — check it was copied whole, with no\n"
                    "leading or trailing characters:\n"
                    f"    security add-generic-password -s {KEYCHAIN_SERVICE} "
                    f"-a {KEYCHAIN_ACCOUNT} -U -w") from None
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

# A row is a brace pair that may contain ONE level of nested braces, because
# `parts` and `like` hold lists of little objects. The old pattern forbade any
# nesting at all — so the moment a row grew a `parts` list it stopped being a
# row, the reader silently skipped it, and the next write deleted it. That cost
# 23 rows including Star Wars before it was caught. If a field ever nests two
# deep, this has to grow again or the same thing happens.
# ── the data file ─────────────────────────────────────────────────────────
#
# The rows are STRICT JSON inside the assignment, and they are read with a JSON
# parser rather than with regular expressions. That is the whole point.
#
# This file used to be hand-shaped JS read back with a pattern per field, and
# it ate data three times: once when the reader named `genres` as the only list
# and so could not see `cast`, `streams` or `rents`; once when `parts` put
# braces inside a row and the row pattern forbade nesting, which deleted 23
# rows including Star Wars; and once when scanning a whole row for scalars
# picked up the `id` of a nested recommendation and overwrote the row's own.
#
# Every one of those was the same failure: the reader could not see a field, so
# the writer dropped it, silently. A regex has to be taught each new shape and
# fails quietly when it has not been. A JSON parser knows every shape there
# will ever be, and fails LOUDLY on anything it does not.
#
# JSON is still valid JS, so the page loads this exactly as before. It is still
# hand-editable — quoted keys and nothing else different.

FIELDS = ["id", "title", "status", "count", "series", "where", "pick", "note",
          "seen", "wd", "wdok", "tmdb", "kind", "imdb", "year", "runtime", "genres", "director",
          "overview", "rating", "cast", "parts", "like", "poster", "backdrop",
          "streams", "rents", "checked"]

ASSIGN = "window.ENTERTAINMENT_DATA"


def read_rows() -> tuple[str, list[dict]]:
    """The header comment, and the rows — parsed, never pattern-matched."""
    text = DATA.read_text()
    cut = text.index(ASSIGN)
    head = text[:cut].rstrip()
    body = text[text.index("[", cut):text.rindex("]") + 1]
    try:
        rows = json.loads(body)
    except json.JSONDecodeError as e:
        raise Failed(
            f"entertainment-data.js is not valid JSON at line {e.lineno}: {e.msg}\n"
            "The rows must be strict JSON — quoted keys, no trailing commas.\n"
            "Nothing has been read and nothing will be written.") from None

    if not isinstance(rows, list) or not rows:
        raise Failed("parsed no rows out of entertainment-data.js — refusing to write.")
    missing = [i for i, r in enumerate(rows) if not isinstance(r, dict) or not r.get("id")]
    if missing:
        raise Failed(f"{len(missing)} row(s) have no id, first at index {missing[0]}.")
    ids = [r["id"] for r in rows]
    if len(set(ids)) != len(ids):
        dupe = next(i for i in ids if ids.count(i) > 1)
        raise Failed(f"duplicate row id {dupe!r} — refusing to work on this file.")
    return head, rows


def write_rows(head: str, rows: list[dict]) -> None:
    """Write the rows, and refuse to write anything we cannot read back.

    This is the guard that makes the old failures impossible rather than just
    unlikely. Whatever the shape of the data, if serialising and re-parsing it
    does not give back exactly what we had, the file is not touched. A bug can
    still exist; it can no longer destroy anything quietly.
    """
    out = []
    for e in rows:
        ordered = {k: e[k] for k in FIELDS if k in e and e[k] not in (None, "", False, [], 0)}
        # anything hand-added that FIELDS does not know about is kept
        for k in sorted(set(e) - set(FIELDS)):
            if k != "ord":
                ordered[k] = e[k]
        try:
            out.append("  " + json.dumps(ordered, ensure_ascii=False))
        except TypeError as err:
            # Something got onto a row that is not data — a set, a date object,
            # a numpy anything. Better to stop than to write half a file.
            raise Failed(f"refusing to write: row {e.get('id')!r} holds a value "
                         f"JSON cannot represent ({err}).") from None
    text = f"{head}\n{ASSIGN} = [\n" + ",\n".join(out) + "\n];\n"

    # read it back before it goes anywhere near the disk
    body = text[text.index("[", text.index(ASSIGN)):text.rindex("]") + 1]
    try:
        back = json.loads(body)
    except json.JSONDecodeError as e:
        raise Failed(f"refusing to write: what I built is not valid JSON ({e.msg}).") from None

    expect = []
    for e in rows:
        keep = {k: v for k, v in e.items()
                if k != "ord" and v not in (None, "", False, [], 0)}
        expect.append(keep)
    if back != expect:
        bad = next((i for i, (a, b) in enumerate(zip(back, expect)) if a != b), None)
        where = f" first at row {bad} ({expect[bad].get('id')})" if bad is not None else ""
        raise Failed(
            "refusing to write: the file would not read back the same."
            f"{where}\nIn memory: {len(expect)} rows. Read back: {len(back)}.\n"
            "Nothing was written. This is the guard that exists because this\n"
            "file has silently lost data three times.")

    DATA.write_text(text)


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
        # Always ask fresh. Reusing the summary from the previous turn of this
        # loop was how "13 Hours" ended up as After Hours: Wikipedia REDIRECTS
        # "13 Hours" to "After Hours (film)", and a stale `s` meant the name of
        # one candidate got checked against the entity of another.
        s = summary(name)
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
        #
        # Checked against what the page RESOLVED to, never the name we searched
        # for. A redirect means those two can be different things, and trusting
        # the search term is how a wrong film passes a title check: "13 Hours"
        # is a redirect to After Hours, so the name matched while the entity
        # behind it did not.
        label = (ent.get("labels", {}).get("en") or {}).get("value", "")
        resolved = s.get("title") or ""
        if not any(bare(x) == exact(want) for x in (label, resolved) if x):
            continue
        ent["_article"] = resolved or name
        ent["_extract"] = s.get("extract") or ""
        # Which disambiguator Wikipedia used says how risky the match is, and
        # the difference matters: "(film)" only separates the film from a novel
        # or a song, which is no risk at all, while "(2016 film)" means there is
        # MORE THAN ONE FILM of that name and Wikipedia had to pick by year.
        # Flagging the first kind too — as this did at first — buries the real
        # cases under a hundred correct ones, and a list nobody reads is worse
        # than no list.
        ent["_ambiguous"] = bool(YEAR_DISAMBIG.search(resolved or name))
        return ent, name, tried
    return None, "", tried


def first_film_of(ent: dict) -> dict | None:
    """A franchise is not a film and has no face.

    "Mad Max", "X-Men", "Halloween" and "The Dark Knight Trilogy" all resolve to
    a series or a franchise — correctly, that IS what Ric wrote down — but a
    series carries no TMDB movie id and no poster, so those rows came out blank.
    Wikidata lists a series' films in P527 (has part). Take the earliest one:
    it is the film the whole run is named after and the image anyone recognises
    it by, which is the same policy already used for Saw and Star Wars.
    """
    parts = [q for q in claims(ent, "P527") if isinstance(q, str) and q.startswith("Q")]
    best, best_year = None, 9999
    for qid in parts[:12]:
        sub = entity(qid)
        if not sub or not any(k in FILMISH for k in claims(sub, "P31")):
            continue
        if not claims(sub, "P4947"):           # no TMDB id, no use to us
            continue
        years = sorted(int(str(d)[1:5]) for d in claims(sub, "P577")
                       if isinstance(d, str) and str(d)[1:5].isdigit())
        y = years[0] if years else 9998
        if y < best_year:
            best, best_year = sub, y
    return best


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
    tm = claims(ent, "P4947")                  # TMDB *movie* id
    tv = claims(ent, "P4983")                  # TMDB *TV series* id — different
    if tm:
        out["tmdb"] = int(tm[0]) if str(tm[0]).isdigit() else tm[0]
    elif tv:
        # A show is not a film and TMDB keeps them in separate catalogues with
        # separate id spaces. Saying which this is, is the whole fix: without
        # it, /movie/<a tv id> is a 404 and the row silently has no poster.
        out["tmdb"] = int(tv[0]) if str(tv[0]).isdigit() else tv[0]
        out["kind"] = "tv"
    extract = (ent.get("_extract") or "").strip()
    if extract:
        # One or two sentences is a tile's worth; the rest is an essay.
        bits = re.split(r"(?<=[.!?])\s+", extract)
        out["overview"] = " ".join(bits[:2]).strip()
    pending = claims(ent, "P57") + claims(ent, "P136")
    return out, [q for q in pending if isinstance(q, str) and q.startswith("Q")]


def stage_facts(rows: list[dict], head: str, args) -> int:
    # Three reasons to look a row up: it has no id yet; it has an id somebody
    # just typed on it but none of the facts that id unlocks; or --refresh is
    # asking the script to re-guess its OWN matches (never a human's).
    DERIVED = ("tmdb", "imdb", "year", "runtime", "genres", "director",
               "overview", "rating")

    def wants(r):
        # A human handed it a TMDB id directly (a film with no Wikipedia article
        # at all, like Valley Uprising). There is nothing here left to find.
        if r.get("wdok") and not r.get("wd"):
            return False
        if not r.get("wd"):
            return True
        if not (r.get("year") or r.get("tmdb")):
            return True
        return args.refresh and not r.get("wdok")

    todo = [r for r in rows
            if (args.only is None or r["id"] in args.only) and wants(r)]

    # Changing which film a row IS must throw away what the old one said, or a
    # row ends up with 2015's id and 2011's director. The page's chooser already
    # does this; an id typed straight onto a row has to as well, and the tell is
    # a Wikidata id that no longer agrees with the stored TMDB id.
    for r in todo:
        if r.get("wd") and any(r.get(k) for k in DERIVED):
            for k in DERIVED:
                r.pop(k, None)
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

        # A series that cannot be filmed: follow it to its first film.
        if not claims(ent, "P4947") and not claims(ent, "P4983"):
            sub = first_film_of(ent)
            if sub:
                sub["_extract"] = ent.get("_extract", "")
                sub["_article"] = ent.get("_article", article)
                article = f"{article} → {(sub.get('labels', {}).get('en') or {}).get('value', '?')}"
                ent = sub

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

    # Last resort: Wikidata simply does not carry a TMDB id for everything
    # (Mad Max's 1979 film, the Alien vs. Predator franchise), and without one
    # a row gets no poster and no availability however well it was identified.
    # TMDB's own catalogue is the fallback — exact title only, best-known first,
    # same rules the audit uses.
    if not args.dry_run:
        try:
            key = api_key()
        except Failed:
            key = None
        if key:
            gap = [r for r in todo if r.get("wd") and not r.get("tmdb")]
            for row in gap:
                want = exact(plain(row["title"]))
                hits = (tmdb_get("/search/movie", key, query=plain(row["title"]))
                        .get("results") or [])
                votes = lambda h: h.get("vote_count") or 0
                exact_hits = [h for h in hits if exact(h.get("title") or "") == want]
                best = max(exact_hits, key=votes, default=None)

                # An exact title match wins — but only if anyone has heard of
                # it. "Alien vs Predator" is exactly the name of a 2-rating
                # short, while the film Ric means is filed as "AVP: Alien vs.
                # Predator" and has five thousand. So when the exact match is
                # too obscure to trust, widen to any title carrying his words
                # as a whole phrase and let the ratings choose.
                if not best or votes(best) < CONFIDENT_VOTES:
                    phrase = [h for h in hits if want in exact(h.get("title") or "")]
                    wider = max(phrase, key=votes, default=None)
                    if wider and votes(wider) > votes(best or {}):
                        best = wider

                # A handful of ratings is not a confirmation. Leave it for the
                # chooser rather than writing a guess into the file.
                if not best or votes(best) < CONFIDENT_VOTES:
                    continue
                row["tmdb"] = best["id"]
                if not row.get("year"):
                    d = (best.get("release_date") or "")[:4]
                    if d.isdigit():
                        row["year"] = int(d)
                print(f"      + {row['title']}: TMDB knows it as "
                      f"{best.get('title')} ({(best.get('release_date') or '????')[:4]}), "
                      f"tmdb={best['id']}")
            if gap:
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
    if found.returncode == 0 and found.stdout.strip():
        got = found.stdout.strip()
        kind = "v4 read token" if got.startswith("eyJ") else "v3 api key"
        print(f"    (using the {kind} from the Keychain)")
        return got
    if found.returncode != 0 or not found.stdout.strip():
        raise Failed(
            "no TMDB key in the Keychain, so there is no art to fetch.\n"
            "Stage 1 has already filled in the facts and the TMDB ids; the\n"
            "posters need a free key:\n"
            "    https://www.themoviedb.org/settings/api\n" + add)
    return found.stdout.strip()


# TMDB hands out two credentials and does not say they are used differently:
# the v3 "API Key" is 32 hex characters and rides in ?api_key=, while the v4
# "Read Access Token" is a ~200-character JWT that must go in an Authorization
# header. Both work against these same v3 endpoints. Rather than make anyone
# care which one they copied, look at the shape and send it the right way.
def tmdb_get(path: str, key: str, **params) -> dict:
    if key.startswith("eyJ"):                  # v4 token — header auth
        url = f"{TMDB_API}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        return get_json(url, headers={"Authorization": "Bearer " + key})
    params["api_key"] = key                    # v3 key — query auth
    return get_json(f"{TMDB_API}{path}?{urllib.parse.urlencode(params)}")


def kind_of(row: dict) -> str:
    """"movie" or "tv" — which half of TMDB this row lives in."""
    return "tv" if row.get("kind") == "tv" else "movie"


def normalise_tmdb(d: dict, kind: str) -> dict:
    """One shape for both catalogues.

    TMDB calls the same things by different names either side of the film/TV
    line: title/name, release_date/first_air_date, runtime/episode_run_time,
    a Director in the crew vs a created_by list. Papering over that here keeps
    every caller from having to care.
    """
    if kind == "movie":
        return d
    runs = d.get("episode_run_time") or []
    return {
        **d,
        "title": d.get("name") or d.get("title"),
        "release_date": d.get("first_air_date") or "",
        "runtime": runs[0] if runs else None,
        "credits": {
            "cast": (d.get("credits") or {}).get("cast") or [],
            "crew": [{"job": "Director", "name": c.get("name")}
                     for c in (d.get("created_by") or [])],
        },
    }


def stage_art(rows: list[dict], head: str, args) -> int:
    try:
        key = api_key()
    except Failed as e:
        print(f"STAGE 2 · art — skipped.\n\n{e}")
        return 0

    todo = [r for r in rows
            if (args.only is None or r["id"] in args.only)
            and r.get("tmdb")
            and (args.refresh or not r.get("poster") or not r.get("cast"))]
    if args.limit:
        todo = todo[:args.limit]
    print(f"\nSTAGE 2 · art — {len(todo)} posters to fetch"
          f"{' (dry run)' if args.dry_run else ''}\n")

    got = 0
    for i, row in enumerate(todo, 1):
        line = f"[{i:>3}/{len(todo)}] {row['title']}"
        try:
            kind = kind_of(row)
            m = normalise_tmdb(
                tmdb_get(f"/{kind}/{row['tmdb']}", key, append_to_response="credits"),
                kind)
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

        # TMDB as the fallback source of facts, not just art. A row that came
        # through --audit --fix has nothing but an id — Wikipedia could not find
        # it, which is often WHY it was wrong — so the facts have to come from
        # here or that row stays blank forever. Anything Wikidata already
        # answered is left alone; this only fills gaps.
        if not row.get("overview") and m.get("overview"):
            row["overview"] = m["overview"].strip()
        if m.get("vote_average"):
            row["rating"] = round(m["vote_average"], 1)
        date = m.get("release_date") or ""
        if not row.get("year") and date[:4].isdigit():
            row["year"] = int(date[:4])
        if not row.get("runtime") and m.get("runtime"):
            row["runtime"] = m["runtime"]
        if not row.get("genres") and m.get("genres"):
            row["genres"] = rank_genres([g["name"] for g in m["genres"]])
        credits = m.get("credits") or {}
        if not row.get("director"):
            directors = [c["name"] for c in credits.get("crew") or []
                         if c.get("job") == "Director"]
            if directors:
                row["director"] = ", ".join(directors[:2])
        # Who is in it. Ric spotted a wrong match by remembering the film had
        # "the guy from the office" in it — a cast list makes that check
        # something you can do at a glance instead of from memory.
        if not row.get("cast"):
            actors = [c["name"] for c in (credits.get("cast") or [])[:3]]
            if actors:
                row["cast"] = actors

        # ── a franchise row is a run of films, not one film ──
        # "Saw(1-10)" and "Star Wars(all)" stand for ten and nine of them. The
        # row wears the first film's face because a series has none of its own,
        # but opening it should show the whole run — so the collection's
        # members are pulled once and stored on the row.
        if (row.get("count") or row.get("series")) and not row.get("parts"):
            coll = (m.get("belongs_to_collection") or {}).get("id")
            if coll:
                # NOT `got` — that is the loop's own counter, and shadowing
                # it made the next `got += 1` a dict plus an int.
                series = tmdb_get(f"/collection/{coll}", key)
                parts = []
                for f in series.get("parts") or []:
                    date = f.get("release_date") or ""
                    parts.append({
                        "id": f["id"],
                        "t": f.get("title") or "",
                        "y": int(date[:4]) if date[:4].isdigit() else 0,
                    })
                    if f.get("poster_path"):
                        download(f"{TMDB_IMG}/w185{f['poster_path']}",
                                 POSTERS / f"p{f['id']}.jpg")
                # Unreleased entries have no date; they sort to the end rather
                # than the front, where a 0 would put them.
                parts.sort(key=lambda x: x["y"] or 9999)
                if parts:
                    row["parts"] = parts
                    print(f"      ✓ {len(parts)} in the {series.get('name', 'collection')}")

        # ── what else is like it ──
        # A franchise row already answers "what else is there" with its own run,
        # so this is for everything else: the four TMDB reckons sit closest to
        # it. Four rather than ten because this is a hint, not a catalogue —
        # and because each one is a poster to fetch and keep.
        if not row.get("parts") and not row.get("like"):
            near = (tmdb_get(f"/{kind}/{row['tmdb']}/recommendations", key)
                    .get("results") or [])
            like = []
            for f in near[:4]:
                title = f.get("title") or f.get("name") or ""
                date = f.get("release_date") or f.get("first_air_date") or ""
                if not title:
                    continue
                like.append({
                    "id": f["id"],
                    "t": title,
                    "y": int(date[:4]) if date[:4].isdigit() else 0,
                })
                if f.get("poster_path"):
                    # w154: these are thumbnails behind a click, not artwork on
                    # a shelf, and four of them per film across 340 films adds
                    # up fast at any larger size.
                    download(f"{TMDB_IMG}/w154{f['poster_path']}",
                             POSTERS / f"p{f['id']}.jpg")
            if like:
                row["like"] = like
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

# TMDB's provider names are the contractual ones, not the ones anybody says out
# loud: "Paramount Plus Essential", "Lionsgate+ Amazon Channels", "Netflix
# Standard with Advertisements". Left alone they turn a row of buttons into a
# row of legal entities, and the same service shows up three times.
PROVIDER_NAMES = {
    "amazon prime video": "Prime Video",
    "apple tv plus": "Apple TV+",
    "disney plus": "Disney+",
    "hbo max": "Max",
    "paramount plus": "Paramount+",
    "peacock": "Peacock",
    "pluto tv": "Pluto TV",
    "tubi tv": "Tubi",
    "fubotv": "Fubo",
    "hoopla": "Hoopla",
    "kanopy": "Kanopy",
    "plex channel": "Plex",
    "plex player": "Plex",
    "amazon prime video with ads": "Prime Video",
    "amazon prime video free": "Prime Video",
    "youtube free": "YouTube",
    "youtube tv": "YouTube TV",
    "the cw": "The CW",
}

# Storefronts, not subscriptions. They all mean the same thing to a person
# standing in front of the telly: you do not have this, you can pay for it.
STOREFRONTS = {
    "amazon video", "apple tv", "apple tv store", "youtube", "google play movies",
    "fandango at home", "vudu", "microsoft store", "spectrum on demand",
    "redbox", "rakuten tv", "buy", "alamo on demand",
}

# JustWatch's own house channels are an artefact of the data, not a place to
# watch anything.
JUNK = {"justwatch tv", "justwatchtv"}


def provider_name(raw: str) -> str | None:
    """One service's everyday name, or None if it is not worth printing."""
    key = raw.strip().lower()
    # "Max Amazon Channel", "Starz Apple TV Channels" — a reseller of the same
    # thing. Say the thing.
    key = re.sub(r"\s+(amazon|apple tv|roku)\s+(premium\s+)?channels?$", "", key)
    # Tier names are not services: Essential, Premium, Basic, with Ads.
    key = re.sub(r"\s+(essential|premium|standard|basic|plus)?\s*with ads?$", "", key)
    key = re.sub(r"\s+(essential|premium|basic|showtime)$", "", key)
    key = key.strip()

    if key in JUNK or not key:
        return None
    if key in STOREFRONTS:
        return "Buy"
    if key in PROVIDER_NAMES:
        return PROVIDER_NAMES[key]
    out = re.sub(r"\s+plus$", "+", key)
    out = out.title()
    # Title-casing turns TNT into "Tnt" and truTV into "Tru TV". Acronyms and
    # trade names are not words. Substituted per WORD, not per whole string, or
    # "Youtube" gets fixed and "Youtube TV" does not.
    for wrong, right in FIXUPS:
        out = re.sub(r"\b" + re.escape(wrong) + r"\b", right, out)
    return out.strip()


# Applied to the title-cased name, word by word.
FIXUPS = [
    ("Tv", "TV"), ("Youtube", "YouTube"), ("Tnt", "TNT"), ("Tbs", "TBS"),
    ("Tru TV", "truTV"), ("Mgm", "MGM"), ("Amc", "AMC"), ("Hbo", "HBO"),
    ("Fubotv", "Fubo"), ("Fxnow", "FXNow"), ("Fx", "FX"), ("Usa", "USA"),
    ("Mtv", "MTV"), ("Pbs", "PBS"), ("Bet", "BET"), ("Cw", "CW"),
    ("Amazon Prime Video Free", "Prime Video"), ("Amazon Prime Video", "Prime Video"),
    ("Youtube Free", "YouTube"), ("Pluto", "Pluto"),
]


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
            d = tmdb_get(f"/{kind_of(row)}/{row['tmdb']}/watch/providers", key)
        except Failed as e:
            print(f"{line}\n      ! {str(e).replace(key, '‹key›')}")
            continue
        us = (d.get("results") or {}).get("US") or {}

        def names(*buckets):
            seen, out = set(), []
            for bucket in buckets:
                for p in us.get(bucket) or []:
                    n = provider_name(p.get("provider_name", ""))
                    if n and n not in seen:
                        seen.add(n)
                        out.append(n)
            return out

        flat = names("flatrate", "free", "ads")
        # Renting is only news if it does not stream, and every storefront
        # collapses to one "Buy" — three ways to pay for the same film is not
        # three answers.
        paid = [p for p in names("rent", "buy") if p not in flat]

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


# ── the audit ──────────────────────────────────────────────────────────────
#
# Checking 363 films by hand is not a plan, and spotting the wrong ones by
# noticing that 13 Hours is a war film and not a Scorsese comedy is a plan that
# depends on Ric remembering every title he has ever watched.
#
# So: a second opinion, from a different corpus. Wikidata found these by name
# through Wikipedia's search; TMDB has its own catalogue and its own idea of
# which film people mean by a given name. Where the two disagree, something is
# worth a look. Two tests, and they catch different things:
#
#   1. Does the stored film's OWN title match what Ric wrote? "13 Hours" that
#      resolves to a film called "After Hours" is wrong no matter how confident
#      anything was. This is the test that catches redirects and near-misses.
#   2. Is there a film of exactly that name that far more people have rated?
#      This is the test that catches the remakes: 2025's "Running Man" against
#      1987's, 2012's "Total Recall" against 1990's, 1932's "Scarface" against
#      1983's. Fame is not truth, but a hundredfold difference in ratings is a
#      strong hint about which one a person means.
#
# Nothing is changed without --fix, and a row Ric confirmed himself is never
# questioned — that is what `wdok` is for.

def audit_row(row: dict, key: str) -> dict | None:
    """One row's second opinion, or None if it looks fine."""
    kind = kind_of(row)
    stored = normalise_tmdb(tmdb_get(f"/{kind}/{row['tmdb']}", key), kind)
    if not stored:
        # A dead id. This used to `return None` — silently passing over the one
        # row most obviously broken, because it has no film to compare against
        # and no poster either. Unstoppable sat like this and the audit said
        # nothing at all.
        hits = [normalise_tmdb(h, kind) for h in
                (tmdb_get(f"/search/{kind}", key, query=plain(row["title"]))
                 .get("results") or [])]
        want_t = exact(plain(row["title"]))
        same_t = [h for h in hits if exact(h.get("title") or "") == want_t]
        pick = max(same_t, key=lambda h: h.get("vote_count") or 0, default=None)
        return {
            "row": row, "why": "TMDB has no film with this id",
            "stored": (f"id {row['tmdb']}", "????", 0, row["tmdb"]),
            "better": (pick.get("title"), (pick.get("release_date") or "????")[:4],
                       pick.get("vote_count") or 0, pick["id"]) if pick else None,
        }
    want = exact(plain(row["title"]))
    stored_title = exact(stored.get("title") or "")
    stored_votes = stored.get("vote_count") or 0

    hits = [normalise_tmdb(h, kind) for h in
            (tmdb_get(f"/search/{kind}", key, query=plain(row["title"]))
             .get("results") or [])]
    same = [h for h in hits if exact(h.get("title") or "") == want]
    if not same:
        # People write down the short name. "13 Hours" is filed as "13 Hours:
        # The Secret Soldiers of Benghazi", and Wikipedia has no article at that
        # short name — only a redirect to something else entirely. A title that
        # starts with what he wrote and then carries a subtitle is almost
        # certainly the film he means.
        same = [h for h in hits
                if exact(h.get("title") or "").startswith(want + " ")
                and len(want) >= 4]
    best = max(same, key=lambda h: h.get("vote_count") or 0, default=None)

    def close_enough(a: str, b: str) -> bool:
        """Two names for the same film, written down differently.

        People write the short name: "Kill Bill" for "Kill Bill: Vol. 1",
        "Talladega Nights" for the one with the ballad, "School of Rock" for
        "The School of Rock". A subtitle or a leading article is not a wrong
        film, and flagging those buries the real ones.
        """
        if a == b:
            return True
        x, y = (a, b) if len(a) <= len(b) else (b, a)
        if y.startswith(x + " ") or y.startswith(x + ":"):
            return True
        # ...and the extra words come before the name as often as after it:
        # the film is filed as "AVP: Alien vs. Predator", not "Alien vs.
        # Predator: AVP". A whole-phrase containment covers both ends.
        if x and (" " + x) in (" " + y):
            return True
        return ARTICLES.sub("", x) == ARTICLES.sub("", y)

    why = None
    if not close_enough(stored_title, want):
        why = "stored film is called something else"
    elif best and best["id"] != row["tmdb"]:
        bv, sv = best.get("vote_count") or 0, stored_votes
        # A tenfold gap is not a close call. Below that, leave it alone — a
        # flag nobody can adjudicate is just noise.
        if bv > max(sv * 10, 200):
            why = "a much better-known film has this exact name"
    if not why and stored_votes < OBSCURE:
        why = f"almost nobody has rated this ({stored_votes} ratings)"
        # ...but only offer an alternative that is genuinely better known.
        # Swapping an 8-rating film for a 10-rating one is not a fix, and
        # --fix would happily take it.
        if best and (best.get("vote_count") or 0) < max(stored_votes * 10, 200):
            best = None
    # A "suggestion" that is the film already stored is not a suggestion.
    if best and best["id"] == row["tmdb"]:
        return None
    # Nor is one that fewer people have heard of. --fix takes these without
    # asking, and it once traded a 5,139-rating AVP for a 2-rating short film
    # of the same name. A swap has to be an improvement to be offered at all.
    if best and (best.get("vote_count") or 0) <= max(stored_votes, CONFIDENT_VOTES):
        best = None
        if why == "stored film is called something else":
            why = None
    if not why:
        return None

    return {
        "row": row, "why": why,
        "stored": (stored.get("title"), (stored.get("release_date") or "????")[:4],
                   stored_votes, row["tmdb"]),
        "better": (best.get("title"), (best.get("release_date") or "????")[:4],
                   best.get("vote_count") or 0, best["id"]) if best else None,
    }


def stage_audit(rows: list[dict], head: str, args) -> int:
    try:
        key = api_key()
    except Failed as e:
        print(f"AUDIT — skipped.\n\n{e}")
        return 0

    todo = [r for r in rows
            if (args.only is None or r["id"] in args.only)
            and r.get("tmdb") and not r.get("wdok")]
    if args.limit:
        todo = todo[:args.limit]
    confirmed = sum(1 for r in rows if r.get("wdok"))
    print(f"AUDIT — second-opinion check on {len(todo)} titles"
          f"{f' ({confirmed} you already confirmed are left alone)' if confirmed else ''}\n")

    found = []
    for i, row in enumerate(todo, 1):
        if i % 25 == 0:
            print(f"    …{i}/{len(todo)}")
        try:
            hit = audit_row(row, key)
        except Failed as e:
            print(f"    ! {row['title']}: {str(e).replace(key, '‹key›')}")
            continue
        if hit:
            found.append(hit)

    if not found:
        print("\nNothing looks wrong.")
        return 0

    print(f"\n{len(found)} worth checking:\n")
    for h in found:
        st, sy, sv, sid = h["stored"]
        print(f"  “{h['row']['title']}”  — {h['why']}")
        print(f"      has: {st} ({sy})  {sv} ratings")
        if h["better"]:
            bt, by, bv, bid = h["better"]
            print(f"      try: {bt} ({by})  {bv} ratings   tmdb={bid}")
        print()

    if not args.fix:
        print("  Nothing was changed. Re-run with --fix to take every 'try' above,\n"
              "  or fix them on the page with \"Not the right film?\", which marks them\n"
              "  confirmed so this never asks again.")
        return len(found)

    # --fix takes the suggestion, and takes it WHOLE: the old facts came from
    # the old film and every one of them is now wrong.
    DERIVED = ("wd", "imdb", "year", "runtime", "genres", "director",
               "overview", "rating", "poster", "backdrop",
               "streams", "rents", "checked", "cast")
    changed = 0
    for h in found:
        if not h["better"]:
            continue
        row = h["row"]
        for k in DERIVED:
            row.pop(k, None)
        row["tmdb"] = h["better"][3]
        old_poster = POSTERS / f"{row['id']}.jpg"
        if old_poster.exists():
            old_poster.unlink()                # it is the wrong film's face
        changed += 1
    if changed:
        write_rows(head, rows)
    print(f"  {changed} switched. Now re-run with --art --where to fetch the right\n"
          f"  posters and availability for them.")
    return changed


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
    ap.add_argument("--audit", action="store_true",
                    help="second-opinion check of every match against TMDB")
    ap.add_argument("--fix", action="store_true",
                    help="with --audit, switch to the suggested film")
    ap.add_argument("--tidy-genres", action="store_true",
                    help="re-apply the genre naming rule to rows already filled in, offline")
    args = ap.parse_args()

    head, rows = read_rows()
    if args.tidy_genres:
        tidy_existing(rows, head, args.dry_run)
        return 0
    if args.audit:
        stage_audit(rows, head, args)
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
