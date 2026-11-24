/* WORLD BUILDER — HOW MUCH EACH PEOPLE SETTING CHANGES A WORLD, AND HOW SOON
   ────────────────────────────────────────────────────────────────────────
   Written for the UI revamp (UI-REVAMP.md, 2026-11-24, Ric: "analize what the
   sim actually does not what it says it does … what would be the settings that
   most people would want to change"). `behaviour.mjs` measures one thing (how
   adults spend their hours) one run at a time; this measures every setting at
   once, on every core, against both that and the world's outcomes, so the page
   can be laid out by what actually matters.

   Each setting is moved half way to its far end (`other` in day.mjs) and run
   against the default world on the same seed. Read off each pair:
     Days      — share of adult hours spent differently, divided by how much
                 rerolling the seed moves them. 1 = as different as a new world.
     Outcomes  — people, births, deaths by cause, wars, elections, thefts,
                 coins and who holds them, mood, hunger, villages, factions,
                 each in units of the spread between reseeded base worlds.
   A row of 0.00 means a byte-identical world: nothing that reads the setting
   ran in that time. That is a slow setting, not a dead one — the 7-to-30-year
   check in world-builder.test.mjs is what proves every setting does something.

   Nothing here is pass/fail, and it is not in checks.mjs.

     node projects/world-builder/test/settings-impact.mjs                  # 60 days, 2 seeds
     node projects/world-builder/test/settings-impact.mjs --days=365 --seeds=1 --only=war,faith
     node projects/world-builder/test/settings-impact.mjs --json=out.json  */
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { People, other, bucket } from "./day.mjs";

const flag = (name, def) => { const hit = process.argv.find(a => a.startsWith("--" + name + "=")); return hit ? hit.slice(name.length + 3) : def; };
const DAYS = Number(flag("days", 60));
const SEEDS = Number(flag("seeds", 2));
const ONLY = flag("only", "") ? flag("only", "").split(",") : null;
const JSON_OUT = flag("json", "");
const BASE = { people: 220, map: "small", factions: 3, villages: 2, crowd: 60 };

function run(set, seed) {
  const w = People.create(Object.assign({}, BASE, set, { seed }));
  const acts = new Map(); let n = 0, mood = 0, hungry = 0;
  for (let h = 0; h < DAYS * 24; h++) {
    w.step(1);
    if (h % 24 !== 12) continue;                 // one look a day, at noon
    for (const p of w.people) {
      if (!w.adult(p)) continue;
      const a = bucket(w.activity(p)); acts.set(a, (acts.get(a) || 0) + 1); n++;
      mood += p.mood; if (p.hungry > 0) hungry++;
    }
  }
  const s = w.stats(), act = {};
  for (const [k, c] of acts) act[k] = c / n;
  return { act, o: { people: s.people, births: s.births, starved: s.starved, sick: s.sick, battle: s.battle, old: s.old, wars: s.wars,
    switched: s.switched, thefts: s.thefts, talks: s.talks, captures: s.captures, secessions: s.secessions, elections: s.elections,
    money: s.money, topShare: s.topShare, mood: n ? mood / n : 0, hungry: n ? hungry / n : 0, villages: s.villages, factions: s.factions } };
}

if (!isMainThread) {
  parentPort.on("message", j => { let r; try { r = run(j.set, j.seed); } catch (e) { r = { err: String((e && e.message) || e) }; } parentPort.postMessage(Object.assign({}, j, r)); });
} else {
  const items = People.SCHEMA.flatMap(g => g.items.map(it => Object.assign({}, it, { group: g.title })))
    .filter(it => it.key !== "seed" && it.key !== "rate" && (!ONLY || ONLY.includes(it.key)));
  const seeds = []; for (let i = 0; i < SEEDS; i++) seeds.push(11 + i * 97);
  const baseSeeds = seeds.concat([302, 399, 496, 593].slice(0, Math.max(0, 3 - seeds.length + 1)));
  const jobs = baseSeeds.map(seed => ({ key: "", seed, set: {} }));
  for (const it of items) { const v = other(it, People.DEFAULTS[it.key]); for (const seed of seeds) jobs.push({ key: it.key, seed, set: { [it.key]: v }, val: v }); }
  const out = [], N = Math.max(1, cpus().length - 1), t0 = Date.now();
  let next = 0, done = 0;
  process.stderr.write(jobs.length + " runs of " + DAYS + " days on " + N + " threads…\n");
  await new Promise(res => {
    for (let i = 0; i < Math.min(N, jobs.length); i++) {
      const w = new Worker(new URL(import.meta.url), { argv: process.argv.slice(2) });
      const feed = () => { if (next < jobs.length) w.postMessage(jobs[next++]); else w.terminate(); };
      w.on("message", r => { out.push(r); if (++done % 20 === 0) process.stderr.write(done + "/" + jobs.length + "\n"); if (done === jobs.length) res(); feed(); });
      feed();
    }
  });
  for (const e of out.filter(o => o.err)) console.log("ERROR " + e.key + ": " + e.err);
  const ok = out.filter(o => !o.err), base = ok.filter(o => o.key === "");
  const spent = (a, b) => { let t = 0; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) t += Math.abs((a[k] || 0) - (b[k] || 0)); return t / 2; };
  let noise = 0, pairs = 0;
  for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) { noise += spent(base[i].act, base[j].act); pairs++; }
  noise /= pairs;
  const OK = Object.keys(base[0].o), SD = {};
  for (const k of OK) {
    const m = base.reduce((s, b) => s + b.o[k], 0) / base.length;
    const raw = Math.sqrt(base.reduce((s, b) => s + (b.o[k] - m) ** 2, 0) / (base.length - 1));
    /* A count every base world agrees on (no wars in any) has no spread; a floor keeps
       one extra village from reading as a billion sigma. */
    SD[k] = Math.max(raw, ["topShare", "mood", "hungry"].includes(k) ? 0.01 : Math.max(0.5, 0.05 * Math.abs(m)));
  }
  const rows = items.map(it => {
    const rs = ok.filter(o => o.key === it.key); if (!rs.length) return null;
    let act = 0; const z = {};
    for (const r of rs) { const b = base.find(x => x.seed === r.seed); act += spent(r.act, b.act); for (const k of OK) z[k] = (z[k] || 0) + (r.o[k] - b.o[k]) / SD[k]; }
    act = act / rs.length / noise; for (const k of OK) z[k] /= rs.length;
    const top = Object.entries(z).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).filter(e => Math.abs(e[1]) >= 1);
    return { key: it.key, label: it.label, group: it.group, live: !!it.live, val: rs[0].val, days: act, top,
             score: Math.max(act, ...Object.values(z).map(v => Math.abs(v) / 3)) };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  console.log("\n" + DAYS + " days, " + SEEDS + " seed(s); rerolling the seed moves " + (noise * 100).toFixed(1) + "% of hours (" + ((Date.now() - t0) / 1000 | 0) + " s)\n");
  console.log(" score  days  group          setting        moved to    live  biggest outcome changes");
  for (const r of rows) console.log([r.score.toFixed(2).padStart(6), r.days.toFixed(2).padStart(5), r.group.padEnd(14), r.key.padEnd(14), String(typeof r.val === "number" ? +r.val.toFixed(3) : r.val).padEnd(11), r.live ? "live" : "    ",
    r.top.map(([k, v]) => k + (v > 0 ? "+" : "") + v.toFixed(1) + "σ").join(" ")].join(" "));
  console.log("\n" + rows.filter(r => r.score === 0).length + " settings made a byte-identical world in " + DAYS + " days.");
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(rows, null, 1));
}
