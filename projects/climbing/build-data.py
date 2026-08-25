#!/usr/bin/env python3
"""
Turn climbs.md and todo.md into climbs-data.js, the file every climbing page reads.

Ric keeps writing the markdown by hand; this reads it and does the tidying so the
pages don't have to. Run it after editing either file:

    python3 projects/climbing/build-data.py

It prints a report of everything it couldn't make sense of. That report is the
point as much as the data is — it's the list of typos worth fixing at the source.
"""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Area names Ric has typo'd at least once. Left side is what's in the file.
AREA_ALIASES = {
    "red river gorge": "Red River Gorge",
    "dierkies lake": "Dierkies Lake",
    "dierkies lake (idaho)": "Dierkies Lake",
    "swan falls bouldering (idaho)": "Swan Falls",
    "lilly boulders": "Lilly Boulders",
    "city of rocks": "City of Rocks",
    "murtaugh": "Murtaugh",
    "the obed": "The Obed",
    "obed/clear creek": "The Obed",
    "ijams crag": "Ijams Crag",
    "lake day miguels pizza": "Miguel's Lake Day",
}

REGION_ALIASES = {
    "northern gorege": "Northern Gorge",
    "north gorge": "Northern Gorge",
    "northern gorge": "Northern Gorge",
    "muir valler": "Muir Valley",
    "muir valley": "Muir Valley",
    "natural brdge region": "Natural Bridge Region",
    "natural bridge region": "Natural Bridge Region",
    "pmrp": "PMRP",
    "miller fork": "Miller Fork",
    "north clear creek": "North Clear Creek",
    "south clear creek": "South Clear Creek",
    "lilly bluff": "Lilly Bluff",
}

WALL_ALIASES = {
    "hemlok boulder": "Hemlock Boulder",
    "hemlock boulder": "Hemlock Boulder",
    "the zoo": "The Old Zoo",
    "the old zoo": "The Old Zoo",
    "chika bonita": "Chica Bonita",
    "chica bonita": "Chica Bonita",
    "the gallery": "The Gallery",
    "the prow": "The Prow",
    "the north 40": "The North 40",
    "the shire": "The Shire",
    "pistol ridge": "Pistol Ridge",
    "tower rock": "Tower Rock",
    "military wall": "Military Wall",
    "midnight surf": "Midnight Surf",
    "drive-by crag": "Drive-By Crag",
    "practice rock": "Practice Rock",
    "piano boulder": "Piano Boulder",
    "warm-up wall": "Warm-Up Wall",
    "jr's corner": "Jr's Corner",
    "the k.b. boulder": "The K.B. Boulder",
    "bear hug area": "Bear Hug Area",
    "left of the alcove": "Left of the Alcove",
    "the dungeon": "The Dungeon",
    "dungeon": "The Dungeon",
    "global village": "Global Village",
    "emerald city": "Emerald City",
    "inner circle": "Inner Circle",
    "rasputin ledge": "Rasputin Ledge",
    "image wall": "Image Wall",
    "stephen king library": "Stephen King Library",
    "bob marley": "Bob Marley",
    "chocolate factory": "Chocolate Factory",
    "buddah wall": "Buddah Wall",
    "the midway": "The Midway",
    "midway": "The Midway",
}

# "all the friends" is not a person. Neither is "2 others".
NOT_PEOPLE = re.compile(
    r"^(?:and\s+)?(?:all\s+the\s+friends|\d+\s+others?|others?|a\s+few\s+others|"
    r"the\s+canadians?|everyone|friends)\b",
    re.I,
)

# Words that show up where a name would be, because "with" also appears in prose
# ("fell in love with midnight surf"). Anything starting with one of these is not
# a partner.
PROSE_WORDS = {
    "a", "an", "the", "my", "his", "her", "their", "our", "then", "very", "so",
    "did", "didnt", "didn't", "done", "took", "take", "hiked", "walked", "went",
    "sent", "send", "got", "had", "was", "were", "is", "are", "been", "being",
    "played", "playing", "explored", "camped", "stayed", "hung", "chilled",
    "pictures", "picture", "photos", "photo", "video", "videos", "coolest",
    "scary", "first", "second", "last", "midnight", "met", "who", "that",
    "which", "what", "when", "it", "this", "these", "those", "some", "more",
    "good", "great", "fun", "hard", "easy", "one", "two", "no", "not", "and",
    "firefighters", "firfighters", "people", "everyone", "them", "us", "me",
}

# Trailing group labels that get swept up: "Harry The Canadians" is just Harry.
TRAILING_LABEL = re.compile(r"\s+(?:the\s+)?(?:canadians?|firefighters?|crew|guys|group)\s*$", re.I)

# The same route written more than one way.
ROUTE_ALIASES = {
    "cavers": "Cavers Route",
    "cavers route": "Cavers Route",
    "amirillo sunset": "Amarillo Sunset",
    "amarillo sunset": "Amarillo Sunset",
    "mr. grey": "Mr. Grey",
    "hippocrite": "Hippocrite",
    "jack slap": "Jack Slap",
    "when doves cry": "When Doves Cry",
    "buddah's belly": "Buddah's Belly",
    "cold hard bitch": "Cold Hard Bitch",
    "gold rush": "Gold Rush",
    "the tribute": "The Tribute",
    "tribute": "The Tribute",
    "silly fingers": "Silly Fingers",
    "minor keys": "Minor Keys",
    "k.b. arete": "K.B. Arete",
    "jr's corner": "Jr's Corner",
    "tennessee jed": "Tennessee Jed",
    "slam dunk": "Slam Dunk",
    "27 years of climbing": "27 Years of Climbing",
    "father and son": "Father and Son",
    "warm and fuzzy": "Warm and Fuzzy",
    "double trouble": "Double Trouble",
    "indecent exposure": "Indecent Exposure",
    "maranda rayne": "Maranda Rayne",
    "midnight gospel": "Midnight Gospel",
    "tapeworm": "Tapeworm",
    "popeye": "Popeye",
    "eureka": "Eureka",
    "subatomic fingerlock": "Subatomic Fingerlock",
}

STYLE_WORDS = [
    ("onsight", r"\bon\s?si(?:ght|te)\b"),
    ("flash", r"\bflash(?:ed)?\b"),
    ("redpoint", r"\bredpoint(?:ed)?\b"),
    ("attempt", r"\battempt(?:s|ed)?\b"),
    ("free solo", r"\bfree\s?solo(?:ed)?\b"),
    ("top rope", r"\btop\s?rope\b|\(\s*tr\s*\)"),
    ("trad", r"\btrad\b"),
    ("mixed", r"\bmixed\b"),
    ("aid", r"\baid\b"),
]

GRADE_RE = re.compile(
    r"""^(
        5[.,]\d+\s*[a-dA-D]?(?:\s*/\s*[a-dA-D])?[+-]?   # 5.10a, 5.10c/d, 5.9+, 5,8
      | [Vv]\d+(?:\s*/\s*\d+)?[+-]?                      # V4, V2/3, V4+
      | \d+[a-dA-D](?:/[a-dA-D])?                        # bare 10a
      | 3rd\s+class
    )""",
    re.X,
)

REPEAT_RE = re.compile(r"\b(?:x\s*(\d+)|(\d+)\s*x)\b", re.I)
DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$")
PITCH_RE = re.compile(r"(\d+)\+?\s*pitch", re.I)
BOULDER_RE = re.compile(r"(\d+)\+?\s*boulder", re.I)

# The rest of the rules parse_route and parse_climbs apply. They were written
# inline until add.html needed to answer the same questions in the browser —
# they're named here so both sides read one rule, not two that drift.
UNKNOWN_RE = re.compile(r"not sure|other climbs?|dont remember|don't remember", re.I)
CLEAN_RE = re.compile(r"\bsent\b|\bsend\b", re.I)
WORKED_RE = re.compile(r"\bfalls?\b|\btakes?\b|\brapp?ed\b|\bclips?\b", re.I)
FAKE_FALL_RE = re.compile(r"\b(?:fake|practice|training)\s+falls?\b", re.I)
SENT_WORD_RE = re.compile(r"\b(?:sent|send)\s*(?:it)?\b", re.I)
PUNCT_RE = re.compile(r"[()\[\],!]+")           # keep '.' — "12.58" is a time
DASH_SPLIT_RE = re.compile(r"\s+-\s*")
WITH_RE = re.compile(r"\b(?:w/|with)\s*([^\n.!]*)", re.I)
PHOTO_RE = re.compile(r"\bpic(?:ture)?s?\b|\bphotos?\b", re.I)
VIDEO_RE = re.compile(r"\bvideos?\b", re.I)
HEADING_RE = re.compile(r"^(#{1,6})\s*(.*)$")


def normalize(name, table):
    """Map a heading to its canonical spelling, keeping unknown ones as written."""
    key = name.strip().lower().rstrip(".")
    return table.get(key, name.strip())


def parse_date(raw):
    """MM/DD/YY and MM/DD/YYYY both appear. Return ISO, or None if it isn't a date."""
    m = DATE_RE.match(raw.strip())
    if not m:
        return None
    month, day, year = (int(g) for g in m.groups())
    if year < 100:
        year += 2000
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def normalize_grade(raw):
    """Return (display, kind, sort_key). Kind is 'rope', 'boulder' or 'other'."""
    g = raw.strip().replace(",", ".").replace(" ", "")
    if re.match(r"^3rdclass$", g, re.I):
        return "3rd class", "other", 0
    if re.match(r"^[Vv]", g):
        display = "V" + g[1:]
        num = re.match(r"^V(\d+)", display)
        return display, "boulder", int(num.group(1)) if num else 0
    if re.match(r"^\d+[a-dA-D]", g):  # bare "10a" means 5.10a
        g = "5." + g
    m = re.match(r"^5\.(\d+)\s*([a-dA-D])?", g)
    if m:
        number = int(m.group(1))
        letter = (m.group(2) or "").lower()
        rank = number * 4 + (ord(letter) - ord("a") if letter else 0)
        return g.replace("5.", "5.", 1), "rope", rank
    return raw.strip(), "other", 0


def parse_route(line, report, context):
    """One route line: '⭑ Cold Hard Bitch - 5.12b (attempts)'."""
    starred = line.lstrip().startswith("⭑")
    text = line.lstrip().lstrip("⭑").strip()

    # Split on the separating dash. Requiring a space *before* it keeps
    # hyphenated names ("Wac-a-mole", "Warm-up") intact, while not requiring one
    # after it catches "Shackles -v2".
    parts = DASH_SPLIT_RE.split(text, maxsplit=1)
    name = parts[0].strip()
    rest = parts[1].strip() if len(parts) > 1 else ""

    grade = grade_kind = None
    sort_key = 0
    gm = GRADE_RE.match(rest) if rest else None
    if gm:
        grade, grade_kind, sort_key = normalize_grade(gm.group(1))
        rest = rest[gm.end():].strip()
    else:
        # Some lines forget the dash ("27 years of climbing 5.8 x2"), so look for
        # a grade anywhere and treat everything before it as the name.
        loose = re.search(r"(?<![\w.])(" + GRADE_RE.pattern.lstrip("^") + r")", text, re.X)
        if loose:
            grade, grade_kind, sort_key = normalize_grade(loose.group(1))
            name = text[:loose.start()].strip(" -")
            rest = text[loose.end():].strip()
        else:
            report["ungraded"].append(f"{context}: {line.strip()}")

    # Lines that record a day without recording a climb. Real, but not a route —
    # the pages keep them out of the ledgers and show them only on their own day.
    unknown = grade is None and bool(UNKNOWN_RE.search(text))

    blob = rest.lower()
    styles = [label for label, pattern in STYLE_WORDS if re.search(pattern, blob)]

    rm = REPEAT_RE.search(rest)
    repeats = int(rm.group(1) or rm.group(2)) if rm else 1

    # A tick log defaults to "sent" — but only a clean one counts. An explicit
    # onsight/flash/redpoint/"sent it" wins outright; otherwise a note about
    # falls, takes or bailing at a clip means he got on it, not up it.
    clean = CLEAN_RE.search(blob) or any(
        s in styles for s in ("onsight", "flash", "redpoint")
    )
    # A deliberate practice whipper isn't a failed go — don't let it read as one.
    outcome_blob = FAKE_FALL_RE.sub(" ", blob)
    worked = WORKED_RE.search(outcome_blob)
    # An explicit send wins outright — "couple attempts then a send" is a send.
    if clean:
        outcome = "sent"
    elif "attempt" in styles:
        outcome = "attempt"
    elif worked:
        outcome = "attempt"
    else:
        outcome = "sent"

    # Whatever the tags already say ("attempts", "flash", "x2") shouldn't be
    # repeated as a note; keep only the part that adds something ("2 takes").
    leftover = rest
    for _, pattern in STYLE_WORDS:
        leftover = re.sub(pattern, " ", leftover, flags=re.I)
    leftover = REPEAT_RE.sub(" ", leftover)
    leftover = SENT_WORD_RE.sub(" ", leftover)
    leftover = PUNCT_RE.sub(" ", leftover)
    leftover = re.sub(r"\s+", " ", leftover).strip(" ./-")
    if re.fullmatch(r"[\d\s]*", leftover):                     # a bare "2" says nothing
        leftover = ""

    return {
        "name": name,
        "grade": grade,
        "gradeKind": grade_kind,
        "gradeRank": sort_key,
        "styles": [s for s in styles if s != "attempt"],
        "outcome": outcome,
        "repeats": repeats,
        "star": starred,
        "unknown": unknown,
        "note": leftover or None,
    }


def parse_people(notes, report, context):
    """Pull partner names out of 'w/ Lane, randy, Adam and all the friends'.

    Bare 'with' also shows up in prose ('fell in love with midnight surf'), so
    what follows it is filtered against PROSE_WORDS rather than trusted.
    """
    people = []
    candidates = [m.group(1) for m in WITH_RE.finditer(notes)]

    for chunk in candidates:
        chunk = re.sub(r"\band\b", ",", chunk, flags=re.I)
        for piece in chunk.split(","):
            piece = TRAILING_LABEL.sub("", piece.strip(" .!\t"))
            if not piece or NOT_PEOPLE.match(piece):
                continue
            words = piece.split()
            if words[0].lower().strip(".") in PROSE_WORDS:
                continue
            # Keep leading capitalised words; stop at the first prose word.
            kept = []
            for word in words:
                if word.lower().strip(".") in PROSE_WORDS:
                    break
                if kept and not word[:1].isupper():
                    break
                kept.append(word)
            if not kept:
                continue
            name = " ".join(kept).strip(" .")
            if len(name) < 2 or len(kept) > 3 or not name[:1].isalpha():
                if piece:
                    report["odd_people"].append(f"{context}: {piece!r}")
                continue
            people.append(name.title() if name.islower() else name)

    seen, unique = set(), []
    for p in people:
        if p.lower() not in seen:
            seen.add(p.lower())
            unique.append(p)
    return unique


def merge_person_aliases(trips):
    """'Cam' and 'Cam Burns' are one person. Promote first names to the full name
    when exactly one full name starts with it."""
    everyone = {p for t in trips for p in t["people"]}
    full = [p for p in everyone if " " in p]
    alias = {}
    for short in (p for p in everyone if " " not in p):
        matches = [f for f in full if f.split()[0].lower() == short.lower()]
        if len(matches) == 1:
            alias[short] = matches[0]
    if alias:
        for t in trips:
            t["people"] = list(dict.fromkeys(alias.get(p, p) for p in t["people"]))
    return alias


def canonical_route(name):
    key = re.sub(r"[^a-z0-9' ]", "", name.lower()).strip()
    key = re.sub(r"\s+", " ", key)
    return ROUTE_ALIASES.get(key, name.strip())


def build_most_climbed(trips):
    """Group every ascent by route so the log can rank what Ric climbs most."""
    tally = {}
    for trip in trips:
        for route in trip["routes"]:
            if not route["name"] or route["unknown"]:
                continue
            key = canonical_route(route["name"]).lower()
            entry = tally.setdefault(key, {
                "name": canonical_route(route["name"]),
                "grade": route["grade"],
                "gradeKind": route["gradeKind"],
                "gradeRank": route["gradeRank"],
                "area": route["area"],
                "wall": route["wall"],
                "ascents": 0, "days": 0, "sends": 0, "attempts": 0,
                "firstDate": None, "lastDate": None, "star": False,
            })
            entry["ascents"] += route["repeats"]
            entry["days"] += 1
            if route["outcome"] == "sent":
                entry["sends"] += route["repeats"]
            else:
                entry["attempts"] += route["repeats"]
            entry["star"] = entry["star"] or route["star"]
            if not entry["grade"] and route["grade"]:
                entry["grade"] = route["grade"]
                entry["gradeKind"] = route["gradeKind"]
                entry["gradeRank"] = route["gradeRank"]
            if trip["date"]:
                if not entry["firstDate"] or trip["date"] < entry["firstDate"]:
                    entry["firstDate"] = trip["date"]
                if not entry["lastDate"] or trip["date"] > entry["lastDate"]:
                    entry["lastDate"] = trip["date"]
    ranked = sorted(tally.values(), key=lambda e: (-e["ascents"], -e["days"], e["name"]))
    return ranked


def parse_climbs(text, report):
    lines = text.split("\n")
    trips = []
    trip = None
    area = region = wall = None
    in_notes = False
    seen_first_date = False

    def flush():
        nonlocal trip
        if trip and (trip["routes"] or trip["notes"]):
            trips.append(trip)
        trip = None

    def start_trip(date, raw):
        nonlocal trip, area, region, wall, in_notes
        flush()
        area = region = wall = None
        in_notes = False
        trip = {
            "date": date, "dateRaw": raw, "area": None,
            "routes": [], "notes": "", "people": [],
            "pitches": None, "boulders": None,
        }

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line.strip():
            continue
        if line.strip() == "-":
            continue

        heading = HEADING_RE.match(line)
        if heading:
            level = len(heading.group(1))
            title = heading.group(2).strip()
            if not title:
                continue

            if title.lower().startswith("note"):
                in_notes = True
                continue
            in_notes = False

            date = parse_date(title)
            if date:
                seen_first_date = True
                start_trip(date, title)
                continue

            if level == 1:
                if title.lower() in ("climbs.md", "to-do list"):
                    continue
                if not seen_first_date:
                    # The undated block at the top: '# Area' then '## Wall'.
                    start_trip(None, "undated")
                    area = normalize(title, AREA_ALIASES)
                    trip["area"] = area
                    region = wall = None
                continue

            if level == 2:
                if trip is None:
                    start_trip(None, "undated")
                if trip["date"] is None and trip["area"]:
                    wall = normalize(title, WALL_ALIASES)  # undated: ## is the wall
                else:
                    area = normalize(title, AREA_ALIASES)
                    trip["area"] = area
                    region = wall = None
                continue

            if level == 3:
                # Might be a region (if a #### follows) or the wall itself.
                region = normalize(title, REGION_ALIASES)
                wall = normalize(title, WALL_ALIASES)
                continue

            if level >= 4:
                wall = normalize(title, WALL_ALIASES)
                continue

        if trip is None:
            continue

        if in_notes:
            trip["notes"] += line.strip() + "\n"
            continue

        context = f"{trip['dateRaw']} {area or ''}"
        route = parse_route(line, report, context)
        route["area"] = trip["area"]
        route["region"] = region if region != wall else None
        route["wall"] = wall
        trip["routes"].append(route)

    flush()

    for t in trips:
        t["notes"] = t["notes"].strip()
        context = t["dateRaw"]
        t["people"] = parse_people(t["notes"], report, context)
        pm = PITCH_RE.search(t["notes"])
        bm = BOULDER_RE.search(t["notes"])
        t["pitches"] = int(pm.group(1)) if pm else None
        t["boulders"] = int(bm.group(1)) if bm else None
        t["hasPhoto"] = bool(PHOTO_RE.search(t["notes"]))
        t["hasVideo"] = bool(VIDEO_RE.search(t["notes"]))

    dated = [t for t in trips if t["date"]]
    undated = [t for t in trips if not t["date"]]
    dated.sort(key=lambda t: t["date"], reverse=True)
    return dated + undated


def parse_todo(text, report):
    """todo.md is blocks of: '# Name - Grade Style ⭑ date result' + 2 detail lines."""
    entries = []
    block = []

    def flush():
        if not block:
            return
        header = block[0]
        starred = "⭑" in header
        header_clean = header.replace("⭑", " ")
        parts = re.split(r"\s+-\s*", header_clean, maxsplit=1)
        name = parts[0].strip()
        rest = parts[1].strip() if len(parts) > 1 else ""

        grade = kind = None
        rank = 0
        gm = GRADE_RE.match(rest)
        if gm:
            grade, kind, rank = normalize_grade(gm.group(1))
            rest = rest[gm.end():].strip()

        tick_date = None
        dm = re.search(r"(\d{1,2}/\d{1,2}/\d{2,4})", rest)
        if dm:
            tick_date = parse_date(dm.group(1))
            rest = rest.replace(dm.group(1), " ")

        result = None
        for label in ("onsight", "onsite", "redpoint", "flash", "sent"):
            if re.search(rf"\b{label}\b", rest, re.I):
                result = "onsight" if label == "onsite" else label
                break

        style = None
        for label in ("Sport", "Trad", "Boulder", "Mixed", "Aid"):
            if re.search(rf"\b{label}\b", rest, re.I):
                style = label
                break

        detail = " ".join(b.strip() for b in block[1:] if b.strip())
        pitches = length = location = None
        pm = re.search(r"(\d+)\s*pitch", detail, re.I)
        if pm:
            pitches = int(pm.group(1))
        lm = re.search(r"(\d+)\s*(?:ft|feet|dt)\b", detail, re.I)
        if lm:
            length = int(lm.group(1))
        loc = [b.strip() for b in block[1:] if b.strip()]
        if loc:
            location = loc[-1]

        if not name:
            return
        entries.append({
            "name": name, "grade": grade, "gradeKind": kind, "gradeRank": rank,
            "style": style, "done": starred, "tickDate": tick_date, "result": result,
            "pitches": pitches, "lengthFt": length, "location": location,
            "note": rest.strip(" ()-") or None,
        })
        if not grade:
            report["todo_ungraded"].append(header.strip())

    for raw_line in text.split("\n"):
        line = raw_line.rstrip()
        if line.startswith("#"):
            title = line.lstrip("#").strip()
            if not title or title.lower().startswith("to-do"):
                continue
            flush()
            block = [title]
        elif line.strip() and block:
            block.append(line)
    flush()
    return entries


def js_pattern(pattern, verbose=False):
    """A Python pattern as a JavaScript one.

    Everything here is already common syntax — the only thing JS can't read is
    re.X, so the comments and the layout whitespace come out. Whitespace inside
    a character class stays, because there it means itself.
    """
    if not verbose:
        return pattern
    out = []
    i = 0
    in_class = False
    while i < len(pattern):
        c = pattern[i]
        if c == "\\":
            out.append(pattern[i:i + 2])
            i += 2
            continue
        if c == "[":
            in_class = True
        elif c == "]":
            in_class = False
        if not in_class:
            if c == "#":
                while i < len(pattern) and pattern[i] != "\n":
                    i += 1
                continue
            if c.isspace():
                i += 1
                continue
        out.append(c)
        i += 1
    return "".join(out)


def write_vocab():
    """Hand the browser the rules this file parses by.

    add.html has to answer the same questions this script does — is that a
    grade, is that a flash, does 'x2' mean two of them — because a day typed at
    the crag has to land in the data identically to the same day typed into
    climbs.md. Two parsers is fine; two copies of the vocabulary is not, because
    a typo fixed in AREA_ALIASES here would go on being wrong over there. So the
    tables and the patterns are written out, and climb-parse.js has none of its
    own.
    """
    payload = {
        "areaAliases": AREA_ALIASES,
        "regionAliases": REGION_ALIASES,
        "wallAliases": WALL_ALIASES,
        "routeAliases": ROUTE_ALIASES,
        "styleWords": [[label, pattern] for label, pattern in STYLE_WORDS],
        "prosePeople": sorted(PROSE_WORDS),
        "patterns": {
            "grade": js_pattern(GRADE_RE.pattern, verbose=True),
            "repeat": js_pattern(REPEAT_RE.pattern),
            "date": js_pattern(DATE_RE.pattern),
            "pitch": js_pattern(PITCH_RE.pattern),
            "boulder": js_pattern(BOULDER_RE.pattern),
            "unknown": js_pattern(UNKNOWN_RE.pattern),
            "clean": js_pattern(CLEAN_RE.pattern),
            "worked": js_pattern(WORKED_RE.pattern),
            "fakeFall": js_pattern(FAKE_FALL_RE.pattern),
            "sentWord": js_pattern(SENT_WORD_RE.pattern),
            "punct": js_pattern(PUNCT_RE.pattern),
            "dashSplit": js_pattern(DASH_SPLIT_RE.pattern),
            "with": js_pattern(WITH_RE.pattern),
            "photo": js_pattern(PHOTO_RE.pattern),
            "video": js_pattern(VIDEO_RE.pattern),
            "heading": js_pattern(HEADING_RE.pattern),
            "notPeople": js_pattern(NOT_PEOPLE.pattern),
            "trailingLabel": js_pattern(TRAILING_LABEL.pattern),
        },
    }
    (HERE / "climb-vocab.js").write_text(
        "// Generated by build-data.py — the tables and patterns climbs.md is read\n"
        "// with, so climb-parse.js can read a typed-in day exactly the same way.\n"
        "window.CLIMB_VOCAB = " + json.dumps(payload, indent=1, ensure_ascii=False) + ";\n"
        "if (typeof module !== 'undefined') module.exports = window.CLIMB_VOCAB;\n",
        encoding="utf-8",
    )
    print("  vocab: climb-vocab.js")


def write_latest_banner(trips):
    """A tiny file every room loads, so the sitewide banner announces the newest
    day out and links straight to it."""
    latest = next((t for t in trips if t["date"]), None)
    if not latest:
        return

    routes = [r for r in latest["routes"] if not r["unknown"]]
    sends = [r for r in routes if r["outcome"] == "sent"]
    earlier = {t["area"] for t in trips if t["date"] and t["date"] < latest["date"]}

    if latest["area"] and latest["area"] not in earlier:
        kind, title = "new adventure", f"First time at {latest['area']}"
    elif sends:
        kind = "new routes sent"
        headline = ", ".join(dict.fromkeys(r["name"] for r in sends[:3]))
        title = f"{headline} — {latest['area']}"
    else:
        kind, title = "new climbing day", f"A day at {latest['area']}"

    bits = []
    if sends:
        bits.append(f"{len(sends)} sent")
    projects = [r for r in routes if r["outcome"] == "attempt"]
    if projects:
        bits.append(f"{len(projects)} worked")
    if latest["people"]:
        bits.append("with " + ", ".join(latest["people"]))
    description = " · ".join(bits) or "Another day on rock."

    payload = {
        "date": latest["date"],
        "kind": kind,
        "title": title,
        "description": description,
        "href": f"projects/climbing/index.html#trip-{latest['date']}",
    }
    (HERE / "latest-climb.js").write_text(
        "// Generated by build-data.py — the newest day out, for the sitewide banner.\n"
        "window.RELAY_LATEST_CLIMB = " + json.dumps(payload, indent=1, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"  banner: {kind} — {title}")


def main():
    report = {"ungraded": [], "odd_people": [], "todo_ungraded": []}

    climbs_md = (HERE / "climbs.md").read_text(encoding="utf-8")
    todo_md = (HERE / "todo.md").read_text(encoding="utf-8")

    trips = parse_climbs(climbs_md, report)
    todo = parse_todo(todo_md, report)

    aliases = merge_person_aliases(trips)
    routes = [r for t in trips for r in t["routes"] if not r["unknown"]]
    people = sorted({p for t in trips for p in t["people"]}, key=str.lower)
    areas = sorted({t["area"] for t in trips if t["area"]}, key=str.lower)
    most_climbed = build_most_climbed(trips)

    # Tie the wish list back to the log: has he been on this thing before?
    by_route = {r["name"].lower(): r for r in most_climbed}
    for item in todo:
        match = by_route.get(canonical_route(item["name"]).lower())
        item["tried"] = None if not match else {
            "ascents": match["ascents"], "days": match["days"],
            "sent": match["sends"] > 0, "lastDate": match["lastDate"],
        }

    data = {
        "generated": "build-data.py",
        "trips": trips,
        "todo": todo,
        "index": {
            "people": people,
            "areas": areas,
            "mostClimbed": most_climbed,
        },
        "stats": {
            "trips": len(trips),
            "routes": len(routes),
            "uniqueRoutes": len(most_climbed),
            "sends": sum(1 for r in routes if r["outcome"] == "sent"),
            "people": len(people),
            "areas": len(areas),
            "todoOpen": sum(1 for t in todo if not t["done"]),
            "todoDone": sum(1 for t in todo if t["done"]),
        },
    }

    out = HERE / "climbs-data.js"
    out.write_text(
        "// Generated by build-data.py from climbs.md and todo.md — do not edit by hand.\n"
        "window.CLIMBING_DATA = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    write_latest_banner(trips)
    write_vocab()

    s = data["stats"]
    print(f"wrote {out.relative_to(HERE.parent.parent)}")
    print(f"  {s['trips']} trips · {s['routes']} route entries · {s['sends']} sends")
    print(f"  {s['uniqueRoutes']} unique routes · {s['areas']} areas · {s['people']} people")
    print(f"  todo: {s['todoOpen']} open · {s['todoDone']} ticked")
    if trips and trips[0]["date"]:
        print(f"  most recent: {trips[0]['date']} — {trips[0]['area']}")
    if aliases:
        print("  merged names: " + ", ".join(f"{k}->{v}" for k, v in sorted(aliases.items())))

    print("\n--- most climbed ---")
    for entry in most_climbed[:12]:
        grade = entry["grade"] or "?"
        print(f"  {entry['ascents']:>3} ascents over {entry['days']:>2} days  "
              f"{entry['name']} ({grade}) — {entry['area']}")

    print("\n--- worth fixing in the markdown ---")
    for label, items in report.items():
        if not items:
            continue
        print(f"\n{label} ({len(items)}):")
        for item in items[:40]:
            print(f"  {item}")
        if len(items) > 40:
            print(f"  ... and {len(items) - 40} more")
    if not any(report.values()):
        print("nothing — the markdown parsed clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
