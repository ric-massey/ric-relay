#!/usr/bin/env python3
"""A link preview for every player: the card Discord (or iMessage, or anything
that reads Open Graph) shows when someone pastes their link.

    python projects/cs/cards.py

A link to cs.html#player/<name> can't carry its own preview — everything
after # stays in the browser, so the page Discord fetches is the same for
everyone. So each player gets a small page of their own, p/<slug>.html,
with their own title, description and picture, that sends a visitor on to
cs.html#player/<name>. The picture, p/<slug>.jpg, is the moment of their
best game's best round (stats.js, scored by highlight.py): the radar at
their biggest kill, framed on the players, a gold ring on them, beside
their name and what they did.

p/cards.js tells the page which file is whose, for its "copy link" button.
Names only, like everywhere in the room: no Steam id goes near these files.
Drawing is deterministic, so a sync that changes nothing rewrites nothing.
"""

import hashlib
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))
import csdata  # noqa: E402
import highlight  # noqa: E402
import stats  # noqa: E402

OUT = csdata.HERE / "p"
ROOT = csdata.HERE.parent.parent
W, H = 1200, 630
SIDE = H                                 # the radar is a square on the left
AMBER, CT, T, INK, DIM, BG = (231, 193, 120), (93, 121, 174), (201, 162, 75), (236, 239, 242), (160, 168, 178), (11, 13, 16)
MAPS = {"de_dust2": "Dust II"}


def site():
    try:
        return "https://" + (ROOT / "CNAME").read_text(encoding="utf-8").strip()
    except OSError:
        return "https://ricmassey.com"


def font(size, bold=False):
    from PIL import ImageFont
    for f in (["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]):
        for d in ("C:/Windows/Fonts/", "/usr/share/fonts/truetype/dejavu/", "/Library/Fonts/", ""):
            try:
                return ImageFont.truetype(d + f, size)
            except OSError:
                continue
    return ImageFont.load_default()


def map_name(m):
    return MAPS.get(m) or m.split("_", 1)[-1].replace("_", " ").title()


def slugs(names):
    """A file name per player, from their name: ascii, lower case. A name with
    nothing ascii in it, or two names that come out the same, get a few hex
    of a hash of the name (of the name — nothing else is to hand)."""
    base = {n: re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")[:40] for n in names}
    seen = {}
    for b in base.values():
        seen[b] = seen.get(b, 0) + 1
    out = {}
    for n, b in base.items():
        h = hashlib.sha1(n.encode("utf-8")).hexdigest()[:6]
        out[n] = f"player-{h}" if not b else f"{b}-{h}" if seen[b] > 1 else b
    return out


def radar_cal():
    t = (csdata.HERE / "radar" / "radar.js").read_text(encoding="utf-8")
    return json.loads(t[t.index("{"):t.rindex("}") + 1])


def wrap(draw, text, fnt, width):
    lines, cur = [], ""
    for w in text.split(" "):
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=fnt) <= width or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = w
    return lines + ([cur] if cur else [])


def draw_card(path, name, R, r, ri, seat, m, facts, why, cal):
    from PIL import Image, ImageDraw
    R = csdata.unpack_tracks(json.loads(json.dumps(R)))
    r = R["rounds"][ri]                  # the unpacked round: packed tracks are steps, not places
    st, hz = R.get("stride", 2), R.get("hz", 2)
    t = facts.get("key_t") or facts.get("t") or 0
    i = int(t * hz)
    us = {s["seat"] for s in R["seats"] if s.get("us")}
    mine_us = seat in us
    pts = {}
    for s_, tr in r["tracks"].items():
        b = i * st
        if b + 1 < len(tr) and tr[b] is not None:
            pts[int(s_)] = (tr[b], tr[b + 1], tr[b + 2] if st == 3 else None)
    me = pts.get(seat)
    lower = bool(cal.get("lower") and cal.get("split") is not None and me and me[2] is not None and me[2] < cal["split"])
    img = Image.open(csdata.HERE / (cal["lower"] if lower else cal["img"])).convert("RGBA")
    px = {k: ((x - cal["x"]) / cal["scale"], (cal["y"] - y) / cal["scale"]) for k, (x, y, _z) in pts.items()}
    # the kill: where both stood come from the kill itself, exact — the
    # twice-a-second tracks often have the victim gone by that sample
    kill = next((f for f in r.get("fights") or [] if f.get("killer") == seat and abs(f["t"] - t) < 0.01), None)
    victim = kill.get("victim") if kill else None
    if kill:
        for who, at in ((seat, kill.get("killer_at")), (victim, kill.get("victim_at"))):
            if who is not None and at and at.get("x") is not None:
                px[who] = ((at["x"] - cal["x"]) / cal["scale"], (cal["y"] - at["y"]) / cal["scale"])
    # framed on everyone, at least 360 radar pixels square, kept on the radar
    xs = [p[0] for p in px.values()] or [512]
    ys = [p[1] for p in px.values()] or [512]
    size = min(1024, max(360, max(xs) - min(xs) + 160, max(ys) - min(ys) + 160))
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    x0 = max(0, min(1024 - size, cx - size / 2))
    y0 = max(0, min(1024 - size, cy - size / 2))
    k = SIDE / size
    card = Image.new("RGB", (W, H), BG)
    bg = Image.new("RGBA", (1024, 1024), (7, 9, 12, 255))
    bg.alpha_composite(img)
    card.paste(bg.crop((int(x0), int(y0), int(x0 + size), int(y0 + size))).resize((SIDE, SIDE)).convert("RGB"), (0, 0))
    d = ImageDraw.Draw(card, "RGBA")
    yaws = r.get("yaws") or {}
    # the kill itself: a red line from them to who they killed, who's crossed out
    if victim in px and seat in px:
        (ax, ay), (bx, by) = px[seat], px[victim]
        d.line([((ax - x0) * k, (ay - y0) * k), ((bx - x0) * k, (by - y0) * k)], fill=(240, 70, 60, 235), width=5)
    for s_, (rx, ry) in sorted(px.items(), key=lambda kv: kv[0] == seat):
        X, Y = (rx - x0) * k, (ry - y0) * k
        team_t = (s_ in us) == (r["side"] == "T")
        col = T if team_t else CT
        ys_ = yaws.get(str(s_)) or yaws.get(s_)
        if ys_ and i < len(ys_) and ys_[i] is not None:
            import math
            a = -ys_[i] * math.pi / 180
            d.pieslice([X - 44, Y - 44, X + 44, Y + 44], math.degrees(a) - 22, math.degrees(a) + 22, fill=col + (110,))
        if s_ == victim:
            d.line([X - 11, Y - 11, X + 11, Y + 11], fill=col, width=5)
            d.line([X + 11, Y - 11, X - 11, Y + 11], fill=col, width=5)
            continue
        d.ellipse([X - 9, Y - 9, X + 9, Y + 9], fill=col, outline=(7, 9, 12), width=2)
        if s_ == seat:
            d.ellipse([X - 19, Y - 19, X + 19, Y + 19], outline=AMBER, width=4)
    # the text side
    d.rectangle([SIDE, 0, W, H], fill=BG)
    d.rectangle([SIDE, 0, SIDE + 4, H], fill=AMBER)
    L = SIDE + 44
    d.text((L, 40), "RIC'S TERMINAL · CS2", font=font(20, True), fill=AMBER)
    nm = name if len(name) <= 18 else name[:17] + "…"
    big = 64
    while d.textlength(nm, font=font(big, True)) > W - L - 40 and big > 36:
        big -= 4
    d.text((L, 78), nm, font=font(big, True), fill=INK)
    y = 78 + big + 26
    d.text((L, y), "BEST ROUND", font=font(18, True), fill=DIM)
    y += 30
    for line in wrap(d, why[0].upper() + why[1:] if why else "", font(30, True), W - L - 40)[:3]:
        d.text((L, y), line, font=font(30, True), fill=INK)
        y += 40
    y += 10
    res = m["result"] if mine_us else {"W": "L", "L": "W", "T": "T"}[m["result"]]
    sc = m["score"] if mine_us else [m["score"][1], m["score"][0]]
    word = {"W": "win", "L": "loss", "T": "draw"}[res]
    d.text((L, y), f"{map_name(R['map'])} {sc[0]}:{sc[1]} {word} · round {ri + 1}", font=font(24), fill=DIM)
    b = next((b for b in m.get("board") or [] if b.get("name") == name), None)
    if b:
        d.text((L, y + 38), f"{b.get('k')}-{b.get('d')}-{b.get('a')} · {round(b.get('adr') or 0)} ADR that game", font=font(24), fill=DIM)
    d.text((L, H - 64), "Every game you played with Ric →", font=font(22, True), fill=AMBER)
    path.parent.mkdir(exist_ok=True)
    card.save(path, "JPEG", quality=84, optimize=True)


def page(name, slug, n_games, m, why, base):
    q = quote(name, safe="")
    title = f"{name} · {n_games} game{'s' if n_games != 1 else ''} with Ric"
    desc = (f"Best round on {map_name(m['map'])}: {why}. Watch it, and every game you played with Ric."
            if why else f"Every game {name} played with Ric.")
    e = html.escape
    url = f"{base}/projects/cs/p/{slug}.html"
    to = f"../../../cs.html#player/{q}"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<!-- Generated by projects/cs/cards.py: the link preview for one player. -->
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} — Ric's Terminal</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#e7c178">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Ric's Terminal">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(base)}/projects/cs/p/{slug}.jpg">
<meta property="og:image:width" content="{W}">
<meta property="og:image:height" content="{H}">
<meta property="og:image:alt" content="{e(name)}'s best round on the radar">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={e(to)}">
<script>location.replace({json.dumps(to)});</script>
</head><body style="margin:0;background:#0b0d10;color:#eceff2;font:16px system-ui;padding:24px">
<p><a href="{e(to)}" style="color:#e7c178">{e(name)}'s games with Ric →</a></p>
<p><a href="../../../index.html" style="color:#a0a8b2">← Ric's Terminal</a></p>
</body></html>
"""


def main():
    st = (csdata.HERE / "stats.js").read_text(encoding="utf-8")
    S = json.loads(st[st.index("{"):st.rindex("}") + 1])
    data = csdata.load()
    byid = {m["id"]: m for m in data["matches"]}
    cals, base = radar_cal(), site()
    games_of = {}
    for m in data["matches"]:
        for b in m.get("board") or []:
            if b.get("name") and not b.get("me"):
                games_of.setdefault(b["name"], 0)
                games_of[b["name"]] += 1
    best = {}
    for g, nm, rnd, sc, _t, why, *tot in S.get("best") or []:
        total = tot[0] if tot else sc
        if nm in games_of and (nm not in best or total > best[nm][3]):
            best[nm] = (S["games"][g]["id"], rnd, why, total)
    slug = slugs(sorted(games_of))
    OUT.mkdir(exist_ok=True)
    reps, written = {}, 0
    for nm, (mid, rnd, why, _tot) in sorted(best.items()):
        m = byid.get(mid)
        R = reps.get(mid) or stats.load_replay(mid)
        reps[mid] = R
        cal = cals.get(R["map"]) if R else None
        if not (m and R and cal):
            continue
        seat = next((s["seat"] for s in R["seats"] if s.get("name") == nm), None)
        r = R["rounds"][rnd - 1]
        _sc, facts = highlight.round_score(S["wp"]["coef"], R, r, seat)
        if facts is None:
            continue
        draw_card(OUT / f"{slug[nm]}.jpg", nm, R, r, rnd - 1, seat, m, facts, why, cal)
        (OUT / f"{slug[nm]}.html").write_text(page(nm, slug[nm], games_of[nm], m, why, base), encoding="utf-8", newline="\n")
        written += 1
    keep = {f"{s}.{x}" for n, s in slug.items() if n in best for x in ("jpg", "html")} | {"cards.js"}
    for p in OUT.iterdir():                  # a player who's no longer in any match
        if p.name not in keep:
            p.unlink()
    (OUT / "cards.js").write_text("// Generated by projects/cs/cards.py: which preview page is whose.\nwindow.CS_CARDS = "
                                  + json.dumps({n: slug[n] for n in sorted(best) if f"{slug[n]}.html" in keep}, ensure_ascii=False,
                                               separators=(",", ":")) + ";\n", encoding="utf-8", newline="\n")
    print(f"cards: {written} player previews")


if __name__ == "__main__":
    main()
