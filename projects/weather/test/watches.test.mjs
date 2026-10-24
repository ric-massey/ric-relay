/* Watches — node projects/weather/test/watches.test.mjs
   watches.js: each kind met or not from made-up data, the event key that
   keeps one event to one reminder, the wording that never says go or no-go,
   and a stored watch cleaned to known kinds and sane numbers. No real place:
   the "place" is a round number in open country (hard rule 1). */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../watches.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const now = Date.UTC(2026, 9, 24, 12), H = 3600e3, place = { lat: 40, lon: -100 };
const hourly = Array.from({ length: 48 }, (_, k) => ({ t: now + k * H, temp: 10 - k * 0.5, gust: k === 6 ? 70 : 20 }));

console.log('\nRULE  each kind is met, or not, from what the page already has');
{
  ok(W.check({ kind: 'rain', minutes: 30 }, { now, nowcast: { kind: 'starting', at: 20 } }).met, 'rain in 20 min meets a 30-min watch');
  ok(!W.check({ kind: 'rain', minutes: 15 }, { now, nowcast: { kind: 'starting', at: 20 } }).met, 'rain in 20 min does not meet a 15-min watch');
  ok(W.check({ kind: 'rain', minutes: 15 }, { now, nowcast: null }).known === false, 'no nowcast is "not known", never "dry"');
  /* the nowcast counts from its radar picture; six minutes old, its 35 is 29 from now */
  const late = W.check({ kind: 'rain', minutes: 30 }, { now, nowcast: { kind: 'starting', at: 35 }, radarAt: now - 6 * 60e3 });
  ok(late.met && /about 29 min/.test(late.text), `a 6-minute-old radar picture's rain at +35 min is in about 29 min from now, inside a 30-min watch (${late.text})`);
  const g = W.check({ kind: 'gust', mph: 40, hours: 24 }, { now, hourly });
  ok(g.met && g.at === now + 6 * H, '70 km/h (43 mph) gusts at hour 6 meet a 40 mph watch, and say when');
  ok(!W.check({ kind: 'gust', mph: 50, hours: 24 }, { now, hourly }).met, '43 mph does not meet a 50 mph watch');
  const c = W.check({ kind: 'cold', f: 32, hours: 24 }, { now, hourly });
  ok(c.met && c.at === now + 20 * H, 'the first hour at or below 32 °F (0 °C at hour 20) is the one named');
  ok(!W.check({ kind: 'heat', f: 95, hours: 24 }, { now, hourly }).met, 'no heat in a cooling forecast');
  ok(W.check({ kind: 'warning' }, { now, alerts: [{ event: 'Tornado Warning', id: 'a' }, { event: 'Wind Advisory' }] }).met, 'a warning in force meets the warning watch');
  ok(!W.check({ kind: 'warning' }, { now, alerts: [{ event: 'Wind Advisory' }] }).met, 'an advisory is not a warning');
  ok(W.check({ kind: 'warning' }, { now, alerts: null }).known === false, 'the NWS not answering is "not known", never "no warning"');
  const fl = [{ lat: 40.05, lon: -100, t: now - 60e3 }, { lat: 41, lon: -100, t: now - 60e3 }];
  ok(W.check({ kind: 'lightning', miles: 10, minutes: 15 }, { now, place, flashes: fl }).met, 'a flash 3 mi away in the last minute meets a 10-mile watch');
  ok(!W.check({ kind: 'lightning', miles: 2, minutes: 15 }, { now, place, flashes: fl }).met, 'not a 2-mile watch');
}

console.log('\nRULE  one event, one reminder; words that inform, never a verdict');
{
  const a = W.check({ kind: 'gust', mph: 40, hours: 24 }, { now, hourly }), b = W.check({ kind: 'gust', mph: 40, hours: 24 }, { now: now + 600e3, hourly });
  ok(a.key && a.key === b.key, 'the same forecast gust checked twice is the same event');
  const all = Object.keys(W.KINDS).map((k) => W.describe(W.clean({ kind: k }))).join(' ') + ' ' + [a, W.check({ kind: 'rain', minutes: 30 }, { now, nowcast: { kind: 'raining' } })].map((x) => x.text).join(' ');
  ok(!/\b(safe|unsafe|go\b|no-go|don't|do not|should)\b/i.test(all), 'no watch says safe, unsafe, go or should');
}

console.log('\nRULE  a stored watch is cleaned to a known kind and numbers in range');
{
  ok(W.clean({ kind: 'nonsense' }) === null, 'an unknown kind is dropped');
  const c = W.clean({ kind: 'gust', mph: 9999, hours: -5 });
  ok(c.mph === 150 && c.hours === 1, 'numbers are held to their range');
  ok(W.clean({ kind: 'cold', f: 'x' }).f === 32, 'a number that is not one takes the default');
}

console.log(failures ? `\n${failures} WATCH RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL WATCH RULES PASS');
process.exit(failures ? 1 : 0);
