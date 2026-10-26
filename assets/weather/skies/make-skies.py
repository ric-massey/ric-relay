#!/usr/bin/env python3
"""Real skies for Weather's scenes: time-lapse footage cut into seamless loops.

Ric, 2026-10-25: "i dont want people to be able to tell they are ai generated.
and they have to move" — so the sky behind each scene is real footage of a real
sky, chosen by the weather and the hour, not a drawing and not a generated
image. These are freely licensed time-lapses from Wikimedia Commons (public
domain or CC BY, never share-alike), credited in the page's settings sheet and
in SKIES below.

For each sky this script:
  - downloads the clip's 1080p copy from Commons into .sky-cache/ (gitignored)
  - keeps one continuous stretch of it (`start`–`end`, seconds; some clips have
    cuts) and only the sky (`crop`: top and bottom as shares of the height)
  - makes it loop with no jump: the last second is cross-faded into the first
  - doubles the frame rate by motion interpolation, so the page can play it at
    half speed (clouds in a time-lapse race) and still move smoothly
  - writes <id>.webm (VP9) and <id>.mp4 (H.264, for Safari that cannot play
    VP9), 1280 px wide, no sound, and <id>.jpg — the first frame, for a still
    sky when motion is off — and skies.json, each sky's size and credit

    python3 assets/weather/skies/make-skies.py          # every sky
    python3 assets/weather/skies/make-skies.py rain     # one

Needs ffmpeg (brew install ffmpeg), OpenCV and numpy.
"""
import json
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".sky-cache"
WIDTH = 1280
CTX = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
UA = {"User-Agent": "RicsWebsite-skies/1.0 (personal site; ricmassey.com)"}

SKIES = {
    "fair": {"title": "Clouds transformations.webm", "start": 0.5, "end": 24.2, "crop": (0.0, 1.0),
             "by": "Igor da Bari", "licence": "CC BY 4.0"},
    "clear": {"title": "2020-04-29 timelapse-nuages-Belfort.webm", "start": 12.0, "end": 27.0, "crop": (0.0, 0.74),
              "by": "Thomas Bresson", "licence": "CC BY 4.0"},
    "grey": {"title": "Clouds (time lapse).webm", "start": 0.5, "end": 22.0, "crop": (0.0, 1.0),
             "by": "YouTube channel Editor", "licence": "CC BY 3.0"},
    "rain": {"title": "Cloudy sunset on the edge of small town. HD 1080p Timelapse (video).webm", "start": 0.2, "end": 10.6, "crop": (0.0, 0.62),
             "by": "Sparkus Design", "licence": "CC BY 2.0"},
    "storm": {"title": "Orage en Alsace dans la nuit du 1er juin - Colmar vers 18h30 le 31 mai.webm", "start": 0.7, "end": 8.3, "crop": (0.0, 0.74),
              "by": "France 3 Grand Est", "licence": "CC BY 3.0"},
    "sunset": {"title": "Clouds transformation.webm", "start": 5.0, "end": 16.8, "crop": (0.0, 0.56),
               "by": "Igor da Bari", "licence": "CC BY 4.0"},
    "dusk": {"title": "Second Glow (video).webm", "start": 2.0, "end": 11.5, "crop": (0.0, 1.0),
             "by": "John Fowler", "licence": "CC BY 2.0"},
}


def api(**p):
    p["format"] = "json"
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), context=CTX, timeout=60))


def fetch(title):
    CACHE.mkdir(exist_ok=True)
    out = CACHE / (re.sub(r"[^A-Za-z0-9]+", "_", title)[:60] + ".webm")
    if out.exists():
        return out
    pg = next(iter(api(action="query", titles="File:" + title, prop="videoinfo", viprop="url|derivatives")["query"]["pages"].values()))
    vi = pg["videoinfo"][0]
    ders = sorted((d for d in vi.get("derivatives", []) if d.get("type", "").startswith("video/webm") and d.get("height", 0) <= 1080),
                  key=lambda d: d.get("height", 0))
    src = ders[-1]["src"] if ders else vi["url"]
    out.write_bytes(urllib.request.urlopen(urllib.request.Request(src, headers=UA), context=CTX, timeout=600).read())
    return out


def make(sid, s):
    src = fetch(s["title"])
    cap = cv2.VideoCapture(str(src))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    a, b = int(s["start"] * fps), int(s["end"] * fps)
    frames, k = [], 0
    while True:
        ok, fr = cap.read()
        if not ok or k >= b:
            break
        if k >= a:
            h = fr.shape[0]
            fr = fr[round(h * s["crop"][0]):round(h * s["crop"][1])]
            oh = round(fr.shape[0] * WIDTH / fr.shape[1] / 2) * 2
            frames.append(cv2.resize(fr, (WIDTH, oh), interpolation=cv2.INTER_AREA))
        k += 1
    n, K = len(frames), int(fps)
    assert n > 3 * K, f"{sid}: too short ({n} frames)"
    # seamless: the loop is frames 0 … n−K−1, its first K blended from the last K
    loop = frames[:n - K]
    for j in range(K):
        t = j / K
        loop[j] = cv2.addWeighted(frames[n - K + j], 1 - t, frames[j], t, 0)
    tmp = Path(tempfile.mkdtemp())
    for i, fr in enumerate(loop):
        cv2.imwrite(str(tmp / f"{i:05d}.png"), fr)
    cv2.imwrite(str(HERE / f"{sid}.jpg"), loop[0], [cv2.IMWRITE_JPEG_QUALITY, 82])
    interp = f"minterpolate=fps={int(round(fps)) * 2}:mi_mode=mci:mc_mode=aobmc:vsbmc=1"
    ins = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(tmp / "%05d.png"), "-vf", interp, "-an"]
    subprocess.run(ins + ["-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1", "-pix_fmt", "yuv420p", str(HERE / f"{sid}.webm")], check=True)
    subprocess.run(ins + ["-c:v", "libx264", "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(HERE / f"{sid}.mp4")], check=True)
    shutil.rmtree(tmp)
    # what the page needs to know about it, credit included (skies.json)
    meta_path = HERE / "skies.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta[sid] = {"w": WIDTH, "h": int(loop[0].shape[0]), "seconds": round(len(loop) / fps, 1), "title": s["title"].rsplit(".", 1)[0],
                 "url": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(s["title"].replace(" ", "_")), "by": s["by"], "licence": s["licence"]}
    meta_path.write_text(json.dumps(dict(sorted(meta.items())), indent=1) + "\n")
    sizes = " ".join(f"{e} {(HERE / f'{sid}.{e}').stat().st_size // 1024} KB" for e in ("webm", "mp4", "jpg"))
    print(f"{sid:7} {len(loop) / fps:5.1f}s loop  {WIDTH}x{loop[0].shape[0]}  {sizes}")


if __name__ == "__main__":
    for sid in sys.argv[1:] or SKIES:
        make(sid, SKIES[sid])
