/* The CS page and its Python scripts must agree.
   ────────────────────────────────────────────────────────────────────────────
   Three things are written twice, once for the browser and once for the plain
   text export, and nothing else would notice them drifting apart:

   1. The bomb. bombAt() in cs.html and bomb_state() in export-llm.py replay a
      round's bomb timeline to any moment (3.2 s plant, 40 s fuse, 5 / 10 s
      defuse). Every committed replay is replayed by both, at every quarter
      second and either side of every event and every timer edge, and the
      states must match.
   2. The packed tracks. pack_tracks() in csdata.py writes positions as steps;
      unpackTracks() in cs.html and unpack_tracks() in csdata.py undo it. Both
      must give the same positions for every committed replay, and packing
      must round-trip a made-up round to within a game unit.
   3. The odds. wpTimeline() in cs.html and timeline() in winprob.py turn a
      round into Ric's team's chance of winning it, start to finish, with the
      model stats.js carries. Every round of every replay, both ways, must
      give the same moments and the same chances.

   The page's functions are cut out of cs.html itself, so this tests the code
   that ships, not a copy of it. */

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// Windows has no python3 (the name opens the Microsoft Store); it's python there.
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const CS = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(CS, '..', '..');
const page = readFileSync(join(ROOT, 'cs.html'), 'utf8');

// cut a function out of the page: from its first line to its closing brace
const cut = (start, end) => {
  const a = page.indexOf(start); assert.ok(a >= 0, `cs.html no longer has ${start}`);
  const b = page.indexOf(end, a); assert.ok(b >= 0, `cs.html: no end for ${start}`);
  return page.slice(a, b + end.length);
};
const bombSrc = cut('const PLANT_S', '    return s;\n  }');
const unpackSrc = cut('function unpackTracks(R) {', '    return R;\n  }');
const { bombAt, unpackTracks } = new Function(`${bombSrc}\n${unpackSrc}\nreturn { bombAt, unpackTracks };`)();
// the odds: the page's functions, run with the model stats.js carries
const statsText = readFileSync(join(CS, 'stats.js'), 'utf8');
const WPM = JSON.parse(statsText.slice(statsText.indexOf('{'), statsText.lastIndexOf('}') + 1)).wp;
assert.ok(WPM && WPM.coef, 'stats.js carries no win model (wp)');
const wpSrc = cut('  function wpChance(', 'after[1], p, r.side, e)];\n  }');
const { wpTimeline } = new Function('WP', `${wpSrc}\nreturn { wpTimeline };`)(WPM);

const files = readdirSync(join(CS, 'matches')).filter((f) => f.endsWith('.js')).sort();
const read = (f) => { const t = readFileSync(join(CS, 'matches', f), 'utf8'); return JSON.parse(t.slice(t.indexOf(']=') + 2).trim().replace(/;$/, '')); };

// the same moments for both sides: every quarter second, and just either side
// of each event and each timer running out
function moments(r) {
  const ts = new Set();
  for (let t = 0; t <= (r.dur || 0) + 1; t += 0.25) ts.add(+t.toFixed(2));
  for (const [et] of (r.bomb && r.bomb.timeline) || [])
    for (const dt of [0, 3.2, 5, 10, 40]) for (const e of [-0.01, 0, 0.01]) ts.add(+(et + dt + e).toFixed(2));
  for (const f of r.fights || []) for (const e of [-0.01, 0, 0.01]) ts.add(+(f.t + e).toFixed(2));
  return [...ts].filter((t) => t >= 0).sort((a, b) => a - b);
}
const norm = (s) => JSON.stringify({
  carrier: s.carrier ?? null,
  ground: s.ground ? [s.ground.x ?? s.ground[0], s.ground.y ?? s.ground[1]] : null,
  planting: s.planting ? (s.planting.seat ?? s.planting[1]) : null,
  planted: s.planted == null ? null : (typeof s.planted === 'object' ? s.planted.t : s.planted),
  defusing: s.defusing ? (Array.isArray(s.defusing) ? [s.defusing[1], s.defusing[2]] : [s.defusing.seat, s.defusing.kit]) : null,
  defused: s.defused == null ? null : (typeof s.defused === 'object' ? s.defused.seat : s.defused),
  exploded: s.exploded == null ? null : (typeof s.exploded === 'object' ? s.exploded.t : s.exploded),
});

// what the browser says
const jsBomb = {}, jsTracks = {}, asks = {}, jsOdds = {};
for (const f of files) {
  const R = read(f);
  asks[f] = R.rounds.map(moments);
  jsBomb[f] = R.rounds.map((r, i) => asks[f][i].map((t) => norm(bombAt(r, t))));
  jsOdds[f] = R.rounds.map((r) => wpTimeline(R, r));
  jsTracks[f] = JSON.stringify(unpackTracks(R).rounds.map((r) => r.tracks));
}

// what Python says, for the same files and moments
const py = spawnSync(PYTHON, ['-I', '-c', `
import sys, json, importlib.util
sys.path.insert(0, ${JSON.stringify(CS)})
import csdata, winprob
st = open(csdata.HERE / "stats.js", encoding="utf-8").read()
WPM = json.loads(st[st.index("{"):st.rindex("}") + 1])["wp"]
spec = importlib.util.spec_from_file_location("export_llm", ${JSON.stringify(join(CS, 'export-llm.py'))})
ex = importlib.util.module_from_spec(spec); spec.loader.exec_module(ex)
asks = json.load(sys.stdin)
out = {"bomb": {}, "tracks": {}, "odds": {}}
for f, per_round in asks.items():
    text = open(csdata.MATCH_DIR / f, encoding="utf-8").read()
    R = json.loads(text[text.index("]=") + 2:].strip().rstrip(";"))
    out["bomb"][f] = [[ex.bomb_state(r, t) for t in ts] for r, ts in zip(R["rounds"], per_round)]
    out["odds"][f] = [winprob.timeline(WPM["coef"], R, r) for r in R["rounds"]]
    out["tracks"][f] = [r["tracks"] for r in csdata.unpack_tracks(R)["rounds"]]
# packing round-trips: a made-up round with gaps, a death and a respawn
fake = {"stride": 3, "rounds": [{"tracks": {"0": [1001, -2003, 10, 1100, -1990, 12, None, None, None, -5, 7, 0, 3, 3, 3, None, None, None],
                                           "1": [None, None, None, 0, 0, 0, None, None, None, None, None, None, None, None, None, None, None, None]}}]}
import copy
back = csdata.unpack_tracks(csdata.pack_tracks(copy.deepcopy(fake)))
out["fake"] = [fake["rounds"][0]["tracks"], back["rounds"][0]["tracks"]]
json.dump(out, sys.stdout)
`], { input: JSON.stringify(asks), encoding: 'utf8', maxBuffer: 1 << 30 });
assert.equal(py.status, 0, py.stderr);
const P = JSON.parse(py.stdout);

let n = 0;
for (const f of files) {
  P.bomb[f].forEach((states, ri) => states.forEach((s, j) => {
    n++;
    assert.equal(norm(s), jsBomb[f][ri][j], `${f} round ${ri + 1} at ${asks[f][ri][j]} s: the page and the export disagree about the bomb`);
  }));
  assert.equal(JSON.stringify(P.tracks[f].map((t) => Object.fromEntries(Object.entries(t)))), jsTracks[f], `${f}: unpacked tracks differ between cs.html and csdata.py`);
}
const [orig, back] = P.fake;
for (const k of Object.keys(orig)) {
  assert.equal(back[k].length, orig[k].length, `seat ${k}: packed track came back a different length`);
  orig[k].forEach((v, i) => assert.ok(v === null ? back[k][i] === null : Math.abs(v - back[k][i]) <= 1, `seat ${k} [${i}]: ${v} came back ${back[k][i]}`));
}
let nOdds = 0;
for (const f of files) P.odds[f].forEach((py, ri) => {
  const js = jsOdds[f][ri];
  assert.equal(js.length, py.length, `${f} round ${ri + 1}: the page sees ${js.length} moments in the odds, the export ${py.length}`);
  py.forEach(([t, p], j) => {
    nOdds++;
    assert.ok(Math.abs(js[j][0] - t) < 1e-6, `${f} round ${ri + 1}: odds moment ${j} at ${js[j][0]} s on the page, ${t} s in Python`);
    assert.ok(Math.abs(js[j][1] - p) <= 2e-4, `${f} round ${ri + 1} at ${t} s: the page says ${js[j][1]}, winprob.py says ${p}`);
  });
});
console.log(`cs parity: ${nOdds} win-chance moments agree; ${n} bomb moments over ${files.length} replays agree; packed tracks match`);
