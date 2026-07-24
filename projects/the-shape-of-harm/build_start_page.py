#!/usr/bin/env python3
"""Builds start.html - the front door - from scores.csv. No invented numbers."""
import csv, collections, html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
rows = list(csv.DictReader((ROOT / "scores.csv").open(encoding="utf-8")))

CRIT = {}
for r in rows:
    CRIT[r["criterion_key"]] = r["criterion"]
ORDER = ["ac", "org", "add", "wd", "oth"]
COLOR = {"ac": "#8e3127", "org": "#345675", "add": "#986820",
         "wd": "#5d3a52", "oth": "#315b4c"}

drugs = collections.OrderedDict()
for r in rows:
    d = drugs.setdefault(r["drug"], {"status": r["us_federal_status"], "c": {}})
    raw = r["score"].strip()
    d["c"][r["criterion_key"]] = {
        "s": float(raw) if raw else None,
        "lo": float(r["interval_low"]) if r["interval_low"].strip() else None,
        "hi": float(r["interval_high"]) if r["interval_high"].strip() else None,
        "g": r["evidence_grade"],
        "basis": r["evidence_basis"],
    }

# Equal-weight mean is used ONLY for row ordering, and is labelled as such.
for name, d in drugs.items():
    v = [c["s"] for c in d["c"].values() if c["s"] is not None]
    d["eq"] = sum(v) / len(v)
    d["suspended"] = [CRIT[k] for k, c in d["c"].items() if c["s"] is None]
ordered = sorted(drugs.items(), key=lambda kv: kv[1]["eq"])

STATUS_CLASS = {
    "unrestricted": "s-open", "legal 21+": "s-legal", "varies by state": "s-varies",
    "prescription": "s-rx", "illicit": "s-illicit",
}
STATUS_LABEL = {
    "unrestricted": "Sold to anyone", "legal 21+": "Legal at 21",
    "varies by state": "Depends where you are", "prescription": "Prescription only",
    "illicit": "Illegal",
}

def strip_rows():
    out = []
    for name, d in ordered:
        cls = STATUS_CLASS.get(d["status"], "s-varies")
        dots = []
        for k in ORDER:
            c = d["c"].get(k)
            if not c:
                continue
            if c["s"] is None:
                continue
            dots.append(
                f'<span class="dot" style="left:{c["s"]}%;--c:{COLOR[k]}" '
                f'title="{html.escape(CRIT[k])}: {c["s"]:.0f} of 100 '
                f'(plausible range {c["lo"]:.0f}-{c["hi"]:.0f}, evidence grade {c["g"]})">'
                f'<i></i></span>'
            )
            dots.append(
                f'<span class="rng" style="left:{c["lo"]}%;width:{max(c["hi"]-c["lo"],0.6)}%"></span>'
            )
        vals = [c["s"] for c in d["c"].values() if c["s"] is not None]
        lo, hi = min(vals), max(vals)
        susp = ""
        if d["suspended"]:
            susp = ('<span class="susp" title="Not scored - a value exists but was '
                    'withdrawn as not comparable">' +
                    ", ".join(html.escape(s.lower()) for s in d["suspended"]) +
                    ": withheld</span>")
        out.append(
            f'<div class="row">'
            f'<div class="rlab"><b>{html.escape(name)}</b>'
            f'<span class="chip {cls}">{STATUS_LABEL.get(d["status"], d["status"])}</span>'
            f'{susp}</div>'
            f'<div class="track" role="img" aria-label="{html.escape(name)}: five harm scores '
            f'spanning {lo:.0f} to {hi:.0f} out of 100">'
            f'{"".join(dots)}'
            f'<span class="span" style="left:{lo}%;width:{max(hi-lo,0.6)}%"></span>'
            f'</div></div>'
        )
    return "\n".join(out)

legend = "".join(
    f'<span class="lg"><i style="background:{COLOR[k]}"></i>{html.escape(CRIT[k])}</span>'
    for k in ORDER
)

# Numbers quoted in prose, computed not asserted.
alcohol = drugs["Alcohol"]
lsd = drugs["LSD"]
caffeine = drugs["Caffeine"]
legal_hi = max(d["eq"] for n, d in drugs.items() if d["status"] == "legal 21+")
illicit_lo = min(d["eq"] for n, d in drugs.items() if d["status"] == "illicit")

HTML = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Start here — The Shape of Harm</title>
<meta name="description" content="Thirteen drugs, five kinds of harm, and what the evidence can and cannot say. Start here.">
<link rel="canonical" href="https://shape-of-harm.netlify.app/start.html">
<style>
:root{{--paper:#f3eee4;--paper2:#e8dfcf;--ink:#1d2020;--muted:#66645f;--line:#cfc3b0;
--red:#8e3127;--green:#315b4c;--blue:#345675;--gold:#986820;--shadow:0 18px 55px rgba(39,30,20,.09)}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--paper);color:var(--ink);
font:17px/1.58 Georgia,"Times New Roman",serif}}
a{{color:#70251e;text-underline-offset:3px}}
.skip{{position:absolute;left:-9999px;top:8px;background:#fff;padding:10px;z-index:100}}
.skip:focus{{left:8px}}
.top{{position:sticky;top:0;z-index:10;background:rgba(243,238,228,.96);
backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}}
.topin{{max-width:1180px;margin:auto;padding:11px 24px;display:flex;align-items:center;gap:18px}}
.brand{{font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;
text-transform:uppercase;text-decoration:none;color:var(--ink);white-space:nowrap}}
.nav{{display:flex;gap:5px;overflow:auto}}
.nav a{{font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none;
color:var(--muted);padding:9px 10px;border-radius:999px;white-space:nowrap}}
.nav a:hover,.nav a:focus{{background:var(--paper2);color:var(--ink)}}
.wrap{{max-width:1180px;margin:auto;padding:0 24px 80px}}
.hero{{padding:64px 0 30px}}
.kicker,.eyebrow{{font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
letter-spacing:.11em;text-transform:uppercase;color:var(--red)}}
h1{{font-size:clamp(42px,6.6vw,76px);line-height:.96;letter-spacing:-.055em;margin:12px 0 18px;max-width:15ch}}
.dek{{font-size:22px;line-height:1.4;color:#3d3e3a;max-width:66ch;margin:0}}
.warn{{margin:26px 0 0;padding:18px 20px;border:1px solid #c9a08f;border-left:5px solid var(--red);
background:#fdf3ef}}
.warn b{{display:block;font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;
text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px;color:var(--red)}}
.warn p{{margin:0;font-size:16px}}
section{{padding:44px 0;border-top:1px solid var(--line)}}
h2{{font-size:clamp(28px,3.8vw,44px);line-height:1.06;letter-spacing:-.035em;margin:8px 0 16px;max-width:22ch}}
.lead{{font-size:19px;max-width:70ch}}
/* ---- signature: the spread chart ---- */
.chart{{margin:26px 0 8px;border:1px solid var(--line);background:#fffaf0;
padding:22px 20px;box-shadow:var(--shadow)}}
.legend{{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:18px;
font:11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted)}}
.lg{{display:flex;align-items:center;gap:6px}}
.lg i{{width:9px;height:9px;border-radius:50%;background:var(--ink);display:block}}
.row{{display:grid;grid-template-columns:210px 1fr;gap:16px;align-items:center;
padding:7px 0;border-bottom:1px solid #eee3d2}}
.row:last-child{{border-bottom:0}}
.rlab{{display:flex;flex-direction:column;gap:4px}}
.rlab b{{font-size:15px}}
.chip{{font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;
letter-spacing:.06em;padding:4px 7px;border:1px solid currentColor;border-radius:999px;
align-self:flex-start}}
.s-open{{color:var(--green)}} .s-legal{{color:var(--red)}} .s-varies{{color:var(--gold)}}
.s-rx{{color:var(--blue)}} .s-illicit{{color:var(--muted)}}
.susp{{font:10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--red);
letter-spacing:.03em}}
.track{{position:relative;height:30px;background:linear-gradient(90deg,#f0e7d6,#e6dac4);
border-radius:2px}}
.span{{position:absolute;top:13px;height:4px;background:rgba(29,32,32,.24);border-radius:2px}}
.rng{{position:absolute;top:11px;height:8px;background:rgba(142,49,39,.13);border-radius:4px}}
.dot{{position:absolute;top:0;height:30px;width:0}}
.dot i{{position:absolute;top:10px;left:-5px;width:10px;height:10px;border-radius:50%;
background:var(--c,var(--ink));border:1.5px solid #fffaf0;
box-shadow:0 1px 2px rgba(39,30,20,.25)}}
.axis{{display:flex;justify-content:space-between;margin-top:12px;
font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted)}}
.cap{{font-size:14px;color:var(--muted);max-width:78ch;margin:14px 0 0}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}}
.box{{border:1px solid var(--line);background:#fffaf0;padding:22px}}
.box h3{{margin:6px 0 9px;font-size:20px}}
.box p{{margin:0;font-size:15px}}
.paths{{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px}}
.path{{display:block;border:1px solid var(--line);background:#fffaf0;padding:26px;
text-decoration:none;color:var(--ink);box-shadow:var(--shadow)}}
.path:hover,.path:focus{{background:#fff;border-color:var(--red)}}
.path b{{display:block;font-size:23px;letter-spacing:-.02em;margin-bottom:8px}}
.path span{{font-size:15px;color:#3d3e3a;display:block}}
.path em{{display:block;margin-top:14px;font-style:normal;
font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;
letter-spacing:.08em;color:var(--red)}}
ul.plain{{max-width:70ch;font-size:16px}} ul.plain li{{margin:9px 0}}
footer{{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);font-size:13px;
display:flex;justify-content:space-between;gap:15px}}
@media(max-width:820px){{
  .grid2,.paths{{grid-template-columns:1fr}}
  .row{{grid-template-columns:1fr;gap:6px}}
  .rlab{{flex-direction:row;align-items:center;gap:9px}}
}}
@media(max-width:620px){{body{{font-size:16px}}.wrap{{padding:0 15px 55px}}
.topin{{padding:9px 12px}}.hero{{padding:44px 0 24px}}footer{{display:block}}}}
@media(prefers-reduced-motion:reduce){{*{{transition:none!important;animation:none!important}}}}
</style></head><body>
<a class="skip" href="#main">Skip to main content</a>
<nav class="top" aria-label="Site"><div class="topin">
<a class="brand" href="start.html">The Shape of Harm</a>
<div class="nav">
<a href="index.html">The ranking</a><a href="index.html#safety">Safety</a>
<a href="index.html#sources">Sources</a><a href="research.html">Research framework</a>
<a href="evidence.html">Evidence</a><a href="certainty.html">Certainty</a>
<a href="hardening.html">Hardening v0.8</a>
</div></div></nav>

<main id="main" class="wrap">
<header class="hero">
<div class="kicker">Start here</div>
<h1>Every drug here can hurt you. They are not equally harmful.</h1>
<p class="dek">Thirteen drugs, scored on five different kinds of harm, from published
research. The scores are rough and the ranking depends on what you think counts —
so this site shows you the working and lets you set the weights yourself.</p>
<div class="warn"><b>Read this first</b>
<p>Nothing on this site is a recommendation, and nothing here is called safe. The
lowest-scoring drug on the page has still hurt people. If you or someone close to you
is using: carry naloxone, test the supply, and don't use alone.
<a href="index.html#safety">Full safety information</a>.</p></div>
</header>

<section>
<div class="eyebrow">What the evidence looks like</div>
<h2>The harm is spread out, and the law does not track it.</h2>
<p class="lead">Each row is one drug. Each dot is one of the five kinds of harm, placed
from 0 to 100. The pale band behind each dot is the plausible range — how uncertain that
single number is. The grey bar shows how far apart a drug's five harms are from each other.</p>

<div class="chart">
<div class="legend">{legend}<span class="lg" style="color:var(--muted)">
<i style="background:#cfc3b0;border-radius:2px;width:16px;height:7px"></i>pale band =
how uncertain that score is</span></div>
{strip_rows()}
<div class="axis"><span>0 — no meaningful harm</span><span>100 — most harmful</span></div>
</div>
<p class="cap"><b>Rows are ordered by the average of the five scores. That is one choice
among many, not the answer.</b> Averaging treats "one bad night" and "damage to others"
as equally important, which is a value judgment, not a finding. Change that judgment and
the order changes — which is the entire point of
<a href="index.html">the ranking page</a>.
Where a score is marked <b>withheld</b>, a value existed but was withdrawn as not
comparable with its neighbours. A blank is never treated as a zero.</p>

<div class="grid2">
<div class="box"><h3>They differ enormously</h3>
<p>Across these five measures the scores run from {caffeine["eq"]:.0f} to
{alcohol["eq"]:.0f} on a 0–100 scale. Treating every drug on this page as one
undifferentiated category throws away almost everything the evidence says.</p></div>
<div class="box"><h3>Legal status is a poor guide</h3>
<p>The highest-scoring drug here, alcohol, is legal at 21. The lowest-scoring
controlled drug, LSD, is illegal. Legal-at-21 drugs reach {legal_hi:.0f} on this
scale; illegal ones start as low as {illicit_lo:.0f}. Whatever the law is tracking,
it is not this measurement.</p></div>
</div>
</section>

<section>
<div class="eyebrow">How to read any number here</div>
<h2>Four things worth knowing before you trust a score.</h2>
<ul class="plain">
<li><b>A score is a comparison, never a verdict.</b> 8 out of 100 does not mean safe.
It means less harmful, on these measures, than the things scored higher.</li>
<li><b>The ranges matter more than the dots.</b> Where two drugs' ranges overlap, the
evidence cannot really tell them apart. The ranking page groups drugs into bands for
exactly this reason instead of listing them 1 to 13.</li>
<li><b>"Harm" is five different things.</b> {", ".join(CRIT[k].lower() for k in ORDER)}.
A drug can be near-harmless on one and severe on another.</li>
<li><b>Someone made these judgments, and it was one person.</b> Every score, its source,
and how good that source is are published and checkable. This is a single-author project
that has not yet been independently reviewed.</li>
</ul>
</section>

<section>
<div class="eyebrow">Two ways in</div>
<h2>Where do you want to go?</h2>
<div class="paths">
<a class="path" href="index.html"><b>Show me the ranking</b>
<span>The interactive chart. Set how much each kind of harm counts to you and watch
the order change. Tap any drug for its full profile and sources.</span>
<em>Start with this one →</em></a>
<a class="path" href="hardening.html"><b>I want to check the method</b>
<span>Protocol, estimands, GRADE certainty profile, the author-side red-team register,
and the replication package. Includes what the project cannot currently support.</span>
<em>Current gate: hardening v0.8 →</em></a>
</div>
</section>

<section>
<div class="eyebrow">Status</div>
<h2>What this is, and what it is not yet.</h2>
<p class="lead">The ranking chart is a transparent single-author model, published with
its full working. The research framework alongside it is a separate, slower effort to do
one narrow question properly.</p>
<ul class="plain">
<li><b>It is not</b> a completed systematic review, a clinical recommendation, or a
population-wide safety claim.</li>
<li><b>It has not</b> been independently reviewed, prospectively registered, or run
through a full database search.</li>
<li><b>The one released estimate</b> from the evidence work is a secondary,
attribution-based outcome with very low certainty. See
<a href="certainty.html">the certainty page</a>.</li>
<li><b>Everything is checkable.</b> Data, protocols, and validators ship with the site.</li>
</ul>
</section>
</main>
<footer class="wrap"><span>The Shape of Harm · start here</span>
<span><a href="index.html">Ranking</a> · <a href="research.html">Framework</a> ·
<a href="hardening.html">Method</a></span></footer>
</body></html>
"""

(ROOT / "start.html").write_text(HTML)
print("start.html written:", len(HTML), "bytes;", len(ordered), "drugs")
