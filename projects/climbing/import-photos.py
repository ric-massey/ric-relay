#!/usr/bin/env python3
"""
Get climbing photos and videos ready for the gallery.

Drop anything into projects/climbing/photos/ and run:

    python3 projects/climbing/import-photos.py

It will:
  * convert HEIC to JPG and shrink anything wider than 1600px (sips, built into macOS)
  * stash the untouched original in _photo-originals/climbing/ (gitignored)
  * read the EXIF date so a shot can find its trip on its own
  * add a line to photos.md for anything it hasn't seen before

photos.md is yours to edit — it's where a file gets its route and caption. This
script only ever adds lines to it, so your edits are safe. Re-running is fine.

    file | date | route | caption

Then it writes photos-data.js, which gallery.html reads.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent
PHOTOS = HERE / "photos"
ORIGINALS = SITE / "_photo-originals" / "climbing"
SIDECAR = HERE / "photos.md"
MAX_WIDTH = 1600

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif"}
VIDEO_EXT = {".mp4", ".mov", ".m4v"}

# The site already carries these, used by the climbing room's hero banner.
LEGACY = sorted((SITE / "photos").glob("climbing-*.jpg"))


def sips_get(path, key):
    try:
        out = subprocess.run(["sips", "-g", key, str(path)],
                             capture_output=True, text=True, timeout=20).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    m = re.search(rf"{key}:\s*(.+)", out)
    value = m.group(1).strip() if m else None
    return None if value in (None, "<nil>", "") else value


def exif_date(path):
    """EXIF creation date as ISO, if the camera left one behind."""
    raw = sips_get(path, "creation")
    if not raw:
        return None
    m = re.match(r"(\d{4})[:\-](\d{2})[:\-](\d{2})", raw)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def optimize(path):
    """HEIC to JPG, and nothing wider than MAX_WIDTH. Returns the web-ready path."""
    suffix = path.suffix.lower()
    if suffix in VIDEO_EXT:
        return path

    target = path
    if suffix in (".heic", ".heif"):
        target = path.with_suffix(".jpg")
        ORIGINALS.mkdir(parents=True, exist_ok=True)
        subprocess.run(["sips", "-s", "format", "jpeg", str(path), "--out", str(target)],
                       capture_output=True, timeout=120)
        if target.exists():
            shutil.move(str(path), str(ORIGINALS / path.name))
            print(f"  converted {path.name} -> {target.name}")
            path = target

    width = sips_get(target, "pixelWidth")
    if width and int(width) > MAX_WIDTH:
        ORIGINALS.mkdir(parents=True, exist_ok=True)
        backup = ORIGINALS / target.name
        if not backup.exists():
            shutil.copy2(target, backup)
        subprocess.run(["sips", "-Z", str(MAX_WIDTH), str(target)],
                       capture_output=True, timeout=120)
        print(f"  resized {target.name} ({width}px -> {MAX_WIDTH}px)")
    return target


def read_sidecar():
    """Parse photos.md into {filename: {...}}, keeping whatever Ric typed."""
    entries = {}
    if not SIDECAR.exists():
        return entries
    for line in SIDECAR.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        name = parts[0]
        if not name:
            continue
        entries[name] = {
            "file": name,
            "date": parts[1] if len(parts) > 1 else "",
            "route": parts[2] if len(parts) > 2 else "",
            "caption": parts[3] if len(parts) > 3 else "",
        }
    return entries


def write_sidecar(entries):
    lines = [
        "# photos.md",
        "#",
        "# One line per photo or video. Fill in the date, the route and a caption",
        "# and the gallery picks it up — new files get a blank line added here",
        "# automatically, dated from EXIF where the camera recorded one.",
        "#",
        "#   file | date (MM/DD/YY) | route | caption",
        "",
    ]
    for name in sorted(entries, key=natural_key):
        e = entries[name]
        lines.append(f"{e['file']} | {e['date']} | {e['route']} | {e['caption']}".rstrip(" |"))
    SIDECAR.write_text("\n".join(lines) + "\n", encoding="utf-8")


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def to_iso(raw):
    """Accept 09/23/23, 9/23/2023 or an ISO date already."""
    raw = (raw or "").strip()
    if not raw:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", raw)
    if not m:
        return None
    month, day, year = (int(g) for g in m.groups())
    if year < 100:
        year += 2000
    return f"{year:04d}-{month:02d}-{day:02d}"


def nearest_trip(iso, trips, tolerance_days=1):
    """The closest trip within a day, or None. Keeps EXIF drift from losing a photo."""
    from datetime import date, timedelta
    y, m, d = (int(p) for p in iso.split("-"))
    when = date(y, m, d)
    for offset in range(1, tolerance_days + 1):
        for shifted in (when - timedelta(days=offset), when + timedelta(days=offset)):
            trip = trips.get(shifted.isoformat())
            if trip:
                return trip
    return None


def main():
    PHOTOS.mkdir(parents=True, exist_ok=True)
    sidecar = read_sidecar()

    # Anything freshly dropped in projects/climbing/photos gets optimized first.
    for path in sorted(PHOTOS.iterdir()):
        if path.is_file() and path.suffix.lower() in IMAGE_EXT | VIDEO_EXT:
            optimize(path)

    found = []
    for path in sorted(PHOTOS.iterdir(), key=lambda p: natural_key(p.name)):
        if path.is_file() and path.suffix.lower() in IMAGE_EXT | VIDEO_EXT:
            found.append((path.name, f"photos/{path.name}", path))
    for path in LEGACY:
        found.append((path.name, f"../../photos/{path.name}", path))

    added = 0
    for name, _, path in found:
        if name not in sidecar:
            sidecar[name] = {"file": name, "date": "", "route": "", "caption": ""}
            added += 1
        if not sidecar[name]["date"]:
            guess = exif_date(path)
            if guess:
                y, m, d = guess.split("-")
                sidecar[name]["date"] = f"{m}/{d}/{y[2:]}"
    write_sidecar(sidecar)

    # Match each photo to the trip it belongs to, by date.
    trips = {}
    data_js = HERE / "climbs-data.js"
    if data_js.exists():
        text = data_js.read_text(encoding="utf-8")
        blob = json.loads(text[text.index("{"):text.rindex(";")])
        for trip in blob["trips"]:
            if trip["date"]:
                trips[trip["date"]] = trip

    items = []
    for name, src, path in found:
        e = sidecar[name]
        iso = to_iso(e["date"])
        trip, approx = trips.get(iso), False
        if iso and not trip:
            # Camera clocks and timezones drift; a shot one day off is still
            # almost certainly that trip. Say so rather than assert it.
            trip = nearest_trip(iso, trips)
            approx = trip is not None
        items.append({
            "file": name,
            "src": src,
            "type": "video" if path.suffix.lower() in VIDEO_EXT else "photo",
            "date": iso,
            "route": e["route"] or None,
            "caption": e["caption"] or None,
            "area": trip["area"] if trip else None,
            "tripDate": trip["date"] if trip else None,
            "approx": approx,
            "tripRoutes": [r["name"] for r in trip["routes"]] if trip else [],
        })

    items.sort(key=lambda i: (i["date"] or "0000-00-00", natural_key(i["file"])), reverse=True)

    out = HERE / "photos-data.js"
    out.write_text(
        "// Generated by import-photos.py from photos.md — edit photos.md, not this.\n"
        "window.CLIMBING_PHOTOS = " + json.dumps(items, indent=1, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )

    dated = sum(1 for i in items if i["date"])
    matched = sum(1 for i in items if i["area"])
    labelled = sum(1 for i in items if i["route"])
    print(f"wrote {out.relative_to(SITE)}")
    print(f"  {len(items)} files · {dated} dated · {matched} matched to a trip · {labelled} named to a route")
    if added:
        print(f"  added {added} new line(s) to photos.md — fill in the route and caption")
    undated = [i["file"] for i in items if not i["date"]]
    if undated:
        print(f"  no date yet ({len(undated)}): {', '.join(undated[:8])}"
              + (" ..." if len(undated) > 8 else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
