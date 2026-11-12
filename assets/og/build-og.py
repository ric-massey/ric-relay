#!/usr/bin/env python3
"""Writes the share images - assets/og/<slug>.jpg, 1200x630 each.

    python assets/og/build-og.py            write them all
    python assets/og/build-og.py --check    exit 1 if any is missing

Nobody shares a home page. The pieces people pass around are one explainer or
one game, and until 2026-11-12 every one of them had no og: tags at all - so a
link to KONDRITE or to How Big Everything Is unfurled as a bare URL, or as the
one terminal screenshot twenty-one other pages were already using.

Two kinds of card, one layout:

  * where the piece already has real art, that art is the background. The
    games have covers in assets/games/ (real in-game screenshots - AGENTS.md
    is strict about that) and the scale ladder has assets/frontdoor/scale.jpg.
  * where it does not, the background is made here from the piece's own accent
    colour. A screenshot of a page that is mostly prose is just small grey
    text; a typographic card is the honest answer and reads better at the size
    these are actually seen.

Both get the same scrim, kicker, title, line and footer, so a row of them in a
feed looks like one site.

Needs Pillow, which nothing else here needs, so it is not in the repo:

    python -m venv .og-venv && .og-venv/Scripts/python -m pip install Pillow
    .og-venv/Scripts/python assets/og/build-og.py

The fonts are read from the system (Windows) - nothing is shipped but the
finished raster. Re-run it when a piece's name or line changes; it is not in
.github/checks.mjs because it cannot run without Pillow, so --check only
reports which files are absent.
"""

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

W, H = 1200, 630
BASE = (12, 13, 16)

FONTS = Path("C:/Windows/Fonts")
F_TITLE = FONTS / "arialbd.ttf"
F_BODY = FONTS / "arial.ttf"
F_MONO = FONTS / "consolab.ttf"

# slug, page, art (or None), accent, kicker, title, line
CARDS = [
    ("kondrite", "projects/kondrite/index.html", "assets/games/kondrite.jpg", "#a08cff",
     "GAME \u00b7 NO SIGN-IN", "KONDRITE",
     "Survey an endless vector sector. Up to five ships, co-op or battle royale."),
    ("leviathan", "projects/kondrite/leviathan.html", "assets/games/kondrite.jpg", "#a08cff",
     "KONDRITE \u00b7 PLAN VIEW", "The Leviathan",
     "The biggest thing in the sector, drawn end to end."),
    ("farlight", "projects/farlight/index.html", "assets/games/farlight.jpg", "#ffcb42",
     "GAME \u00b7 FEEL PROTOTYPE", "FARLIGHT",
     "All momentum and all feel. Built to be played rather than finished."),
    ("offramp", "projects/offramp/index.html", "assets/games/offramp.jpg", "#7bd1ff",
     "GAME", "Interstate 40",
     "Drive I-40 from above, exit to exit \u2014 2,551 miles in true lane proportions."),
    ("starfield-fly", "projects/starfield/fly.html", "assets/games/starfield.jpg", "#9ad7ff",
     "GAME \u00b7 HONEST RELATIVITY", "Starfield",
     "Fly a relativistic rocket through the real solar neighbourhood."),
    ("starfield", "projects/starfield/index.html", "assets/games/starfield.jpg", "#9ad7ff",
     "HOW TO FLY", "Starfield",
     "Gears, controls, and what every number on the dash means."),
    ("siege", "projects/siege-conductor/index.html", None, "#ff6b5e",
     "A VIEWING COMPANION", "Siege Conductor",
     "The Siege of Mandalore interwoven with Revenge of the Sith, as one story."),

    ("scale", "projects/how-big-everything-is/index.html", "assets/frontdoor/scale.jpg", "#ffd27a",
     "EXPLAINER", "How Big Everything Is",
     "A scale ladder you zoom out through \u2014 a quark to the observable universe."),
    ("speed", "projects/how-speed-affects-time/index.html", None, "#8fb8ff",
     "EXPLAINER", "How Speed Affects Time",
     "Your clock stays normal. Earth's does not. Move the slider, then come home."),
    ("spacetime", "projects/spacetime/index.html", None, "#e8d9b0",
     "FOUR INTERACTIVE LESSONS", "The Geometry of Spacetime",
     "Light cones, time dilation, the loss of now, and space expanding."),
    ("spacetime-01", "projects/spacetime/01-light-cones.html", None, "#e8d9b0",
     "LESSON 1 OF 4", "Light Cones",
     "Why nothing tilts past 45\u00b0, and the shape that makes around every moment."),
    ("spacetime-02", "projects/spacetime/02-time-dilation.html", None, "#e8d9b0",
     "LESSON 2 OF 4", "Time Dilation",
     "The light clock that shows why moving clocks run slow \u2014 and the muons that prove it."),
    ("spacetime-03", "projects/spacetime/03-simultaneity.html", None, "#e8d9b0",
     "LESSON 3 OF 4", "The Loss of Now",
     "Two people moving past each other do not agree on what is happening now."),
    ("spacetime-04", "projects/spacetime/04-expansion.html", None, "#e8d9b0",
     "LESSON 4 OF 4", "Space Expanding",
     "Why every galaxy sees itself at the centre of the expansion."),
    ("criteria", "projects/autism-reflection.html", None, "#c9b8ff",
     "A REFLECTION", "The Shape of the Criteria",
     "Reading the DSM-5 autism criteria as a description of a shape."),
    ("mood", "projects/state-of-mind-line/index.html", None, "#8ad6b4",
     "MIND", "State-of-Mind Line",
     "Bipolar mood episodes against a typical baseline, over time."),

    ("weather-pro", "weather-pro.html", None, "#5bc8ff",
     "WEATHER PRO", "The atmosphere, in depth",
     "Radar volumes, satellite bands, soundings and models \u2014 read in your browser."),
]


def hexcol(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def wrap(draw, text, font, width):
    words, lines, line = text.split(), [], ""
    for w in words:
        t = (line + " " + w).strip()
        if draw.textlength(t, font=font) <= width:
            line = t
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def background(art, accent):
    from PIL import Image, ImageDraw, ImageFilter
    if art:
        src = REPO / art
        im = Image.open(src).convert("RGB")
        # cover: fill 1200x630, centre-cropped, never letterboxed
        s = max(W / im.width, H / im.height)
        im = im.resize((max(W, int(im.width * s)), max(H, int(im.height * s))), Image.LANCZOS)
        im = im.crop(((im.width - W) // 2, (im.height - H) // 2,
                      (im.width - W) // 2 + W, (im.height - H) // 2 + H))
        return im
    # no art: the accent, bloomed off the right, over the site's near-black
    im = Image.new("RGB", (W, H), BASE)
    glow = Image.new("RGB", (W, H), BASE)
    g = ImageDraw.Draw(glow)
    c = hexcol(accent)
    for i in range(14, 0, -1):
        r = 70 + i * 34
        k = (1 - i / 14) ** 2 * 0.5
        g.ellipse([int(W * 0.78) - r, int(H * 0.30) - r, int(W * 0.78) + r, int(H * 0.30) + r],
                  fill=tuple(int(BASE[j] + (c[j] - BASE[j]) * k) for j in range(3)))
    return Image.blend(im, glow.filter(ImageFilter.GaussianBlur(70)), 0.9)


def card(slug, page, art, accent, kicker, title, line):
    from PIL import Image, ImageDraw, ImageFont
    im = background(art, accent).convert("RGB")
    d = ImageDraw.Draw(im, "RGBA")

    # A scrim, so the words are readable over anything and every card in a row
    # has the same weight. It starts a third of the way down and only then
    # ramps: a flat darkening from the top edge turned the game covers into
    # black rectangles, which defeats the point of having real art at all.
    top = 0.34 if art else 0.0
    for y in range(H):
        u = (y / H - top) / (1 - top)
        k = 0.0 if u < 0 else u ** 1.35
        d.line([(0, y), (W, y)], fill=(0, 0, 0, int((10 if art else 30) + 205 * k)))

    c = hexcol(accent)
    f_kick = ImageFont.truetype(str(F_MONO), 21)
    f_title = ImageFont.truetype(str(F_TITLE), 68)
    f_line = ImageFont.truetype(str(F_BODY), 29)
    f_foot = ImageFont.truetype(str(F_MONO), 20)

    x, pad = 72, 72
    # the accent rule, which is the only thing every card shares in colour
    d.rectangle([x, H - pad - 232, x + 64, H - pad - 228], fill=c)

    y = H - pad - 206
    d.text((x, y), kicker, font=f_kick, fill=c)
    y += 38

    tl = wrap(d, title, f_title, W - x - pad)
    for t in tl[:2]:
        d.text((x, y), t, font=f_title, fill=(255, 255, 255))
        y += 76
    y += 4

    for t in wrap(d, line, f_line, W - x - pad)[:2]:
        d.text((x, y), t, font=f_line, fill=(214, 218, 226))
        y += 38

    foot = "RIC//NET  \u00b7  ricmassey.com"
    d.text((x, H - pad + 6), foot, font=f_foot, fill=(150, 156, 168))

    out = HERE / (slug + ".jpg")
    im.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    return out


OG_IMG = re.compile(
    r'[ \t]*<meta property="og:image(?::(?:width|height|alt|type))?" content="[^"]*">\r?\n')
MARK_A = "  <!-- share card: written by assets/og/build-og.py -->\n"
MARK_B = "  <!-- /share card -->\n"


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def tags(slug, page, art, accent, kicker, title, line):
    """Put the og: block on the page, or bring an existing one up to date.

    Idempotent: a block this wrote is replaced whole, a page that already had
    og tags of its own keeps its words and only has its picture swapped, and a
    page with nothing gets the lot."""
    p = REPO / page
    html = p.read_text(encoding="utf-8")
    before = html

    url = "https://ricmassey.com/" + page[:-len("index.html")] if page.endswith("index.html") \
        else "https://ricmassey.com/" + page
    img = "https://ricmassey.com/assets/og/" + slug + ".jpg"
    pic = (f'  <meta property="og:image" content="{img}">\n'
           f'  <meta property="og:image:width" content="{W}">\n'
           f'  <meta property="og:image:height" content="{H}">\n'
           f'  <meta property="og:image:alt" content="{esc(title)} — {esc(line)}">\n')

    if MARK_A in html:                                   # ours: replace it whole
        a = html.index(MARK_A)
        b = html.index(MARK_B, a) + len(MARK_B)
        html = html[:a] + block(title, line, url, pic) + html[b:]
        how = "updated"
    elif 'property="og:image"' in html:                  # theirs: swap the picture only
        first = OG_IMG.search(html)
        html = OG_IMG.sub("", html)
        html = html[:first.start()] + pic + html[first.start():]
        how = "picture swapped"
    else:                                                # nothing: insert the lot
        anchor = re.search(r'[ \t]*<meta name="viewport"[^>]*>\r?\n', html) \
            or re.search(r'[ \t]*<title>[\s\S]*?</title>\r?\n', html)
        if not anchor:
            return page, "NO ANCHOR — skipped"
        at = anchor.end()
        html = html[:at] + block(title, line, url, pic) + html[at:]
        how = "added"

    if html == before:
        return page, "already right"
    p.write_text(html, encoding="utf-8", newline="")
    return page, how


def block(title, line, url, pic):
    return (MARK_A
            + '  <meta property="og:type" content="website">\n'
            + '  <meta property="og:site_name" content="RIC//NET">\n'
            + f'  <meta property="og:title" content="{esc(title)}">\n'
            + f'  <meta property="og:description" content="{esc(line)}">\n'
            + f'  <meta property="og:url" content="{url}">\n'
            + pic
            + '  <meta name="twitter:card" content="summary_large_image">\n'
            + MARK_B)


def main():
    if "--tags" in sys.argv:
        for row in CARDS:
            page, how = tags(*row)
            print(f"  {how:16}  {page}")
        return 0
    if "--check" in sys.argv:
        missing = [s for s, *_ in CARDS if not (HERE / (s + ".jpg")).exists()]
        print(f"og: {len(CARDS) - len(missing)} of {len(CARDS)} share images present"
              + ("".join("\n  missing: " + m for m in missing) if missing else ""))
        return 1 if missing else 0
    total = 0
    for row in CARDS:
        out = card(*row)
        total += out.stat().st_size
        print(f"  {out.stat().st_size // 1024:4d} KB  assets/og/{out.name}   <- {row[1]}")
    print(f"og: {len(CARDS)} share images, {total // 1024} KB in all")
    return 0


if __name__ == "__main__":
    sys.exit(main())
