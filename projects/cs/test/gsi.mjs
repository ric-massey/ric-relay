/* THE LIVE FEED KEEPS EVERY ROUND
   ──────────────────────────────────────────────────────────────────────────
   gsi.py's Recorder turns CS2's Game State Integration posts into one spool
   record per match. On 2026-10-20 a 12–12 Mirage came out with 23 rounds and
   20 of Ric's 21 kills: on the last round CS2 goes straight to game over, and
   the post that says so carries no `round.win_team`, so the round was never
   marked won or lost and _close() dropped it.

   This feeds the Recorder a made-up match the way CS2 posts one — including
   that last post — and checks the record. Nothing touches the real spool. */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// Windows has no python3 (the name opens the Microsoft Store); it's python there.
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

const py = spawnSync(PYTHON, ['-I', '-c', `
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(join(HERE, '..'))})
import gsi

ME, TOK = "76561190000000001", "t"
gsi.SPOOL = Path(tempfile.mkdtemp()) / "spool.jsonl"
rec = gsi.Recorder(ME, TOK, log=lambda *a: None)

def post(phase, ct, t, rnd=None, team="T", kills=0, rk=0, hp=100, money=800, total=None):
    s = {"auth": {"token": TOK},
         "map": {"name": "de_mirage", "mode": "competitive", "phase": phase,
                 "team_ct": {"score": ct}, "team_t": {"score": t}},
         "player": {"steamid": ME, "team": team,
                    "state": {"health": hp, "money": money, "equip_value": 1000,
                              "round_kills": rk, "round_killhs": 0},
                    "match_stats": {"kills": kills if total is None else total,
                                    "deaths": 0, "assists": 0, "mvps": 0, "score": 0}}}
    if rnd is not None:
        s["round"] = rnd
    rec.feed(s)

# Ric is T. Rounds alternate T, CT, T, CT... wins for T; 4 rounds, then game over.
ct = t = kills = 0
winners = ["T", "CT", "T", "T"]
for i, w in enumerate(winners):
    last = i == len(winners) - 1
    post("live", ct, t, {"phase": "freezetime"}, kills=kills)
    kills += 1
    post("live", ct, t, {"phase": "live"}, kills=kills, rk=1)
    if w == "CT": ct += 1
    else: t += 1
    if last:
        # what CS2 sends at the end: game over, the new score, no win_team
        post("gameover", ct, t, {"phase": "over"}, kills=kills, rk=1)
    else:
        post("live", ct, t, {"phase": "over", "win_team": w}, kills=kills, rk=1)

out = [json.loads(l) for l in gsi.SPOOL.read_text().splitlines()]
print(json.dumps(out))
`], { encoding: 'utf8' });

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) failed++; };

if (py.status !== 0) {
  console.log(py.stdout, py.stderr);
  process.exit(1);
}
const recs = JSON.parse(py.stdout.trim());
ok(recs.length === 1, 'one match spooled');
const r = recs[0];
ok(!r.left, 'it finished, not left');
ok(JSON.stringify(r.score) === '[3,1]', `score is Ric's 3–1 (got ${JSON.stringify(r.score)})`);
ok(r.rounds.length === 4, `all 4 rounds kept, the last one too (got ${r.rounds.length})`);
ok(JSON.stringify(r.rounds.map(x => x.won)) === '[true,false,true,true]', 'each round won or lost correctly');
const k = r.rounds.reduce((a, x) => a + (x.k || 0), 0);
ok(k === r.me.kills, `round kills add up to the match total (${k} of ${r.me.kills})`);

process.exit(failed ? 1 : 0);
