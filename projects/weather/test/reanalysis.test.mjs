/* Reanalysis — node projects/weather/test/reanalysis.test.mjs
   reanalysis.js: where each ERA5 hour is (which file, which index — the
   file names and their layout as NSF NCAR's bucket held them on
   2026-10-24), the window under a map view, the grid it paints on, and the
   chunk cache's budget. No network: the live reading was checked in the
   browser (README, round eight). The views are round numbers, not places. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../reanalysis.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const H = 3600e3;

console.log('\nRULE  every hour is found in the file and at the index ERA5 keeps it');
{
  const a = E.locate('2t', Date.UTC(2024, 8, 1, 15));
  ok(a.url.endsWith('/e5.oper.an.sfc/202409/e5.oper.an.sfc.128_167_2t.ll025sc.2024090100_2024093023.nc') && a.slice0 === 15, 'a surface field: the month\'s file, the hour of the month (15 on the 1st at 15Z)');
  ok(E.locate('2t', Date.UTC(2024, 1, 29, 23)).url.includes('2024020100_2024022923') && E.locate('2t', Date.UTC(2024, 1, 29, 23)).slice0 === 28 * 24 + 23, 'a leap February ends on the 29th');
  const z = E.locate('z', Date.UTC(2026, 6, 15, 12), 500);
  ok(z.url.endsWith('/e5.oper.an.pl/202607/e5.oper.an.pl.128_129_z.ll025sc.2026071500_2026071523.nc') && z.slice0[0] === 12 && z.slice0[1] === E.LEVELS.indexOf(500), 'a pressure level: the day\'s file, [hour, level]');
  ok(E.LEVELS.length === 37 && E.LEVELS[0] === 1 && E.LEVELS[36] === 1000, 'the 37 levels, 1 to 1000 mb, as the files hold them');
  /* precipitation: the latest 06 or 18Z forecast strictly before the hour */
  const p1 = E.locate('lsp', Date.UTC(2026, 5, 16, 6));
  ok(p1.url.includes('2026060106_2026061606') && p1.slice0[0] === 29 && p1.slice0[1] === 11, '16th 06Z is the 15th 18Z forecast\'s 12th hour, in the first half\'s file');
  const p2 = E.locate('lsp', Date.UTC(2026, 5, 1, 3));
  ok(p2.url.includes('/202605/') && p2.url.includes('2026051606_2026060106') && p2.slice0[0] === 31 && p2.slice0[1] === 8, 'the 1st at 03Z is the 31st of May\'s 18Z forecast, in May\'s second file');
  const p3 = E.locate('cp', Date.UTC(2026, 5, 20, 7));
  ok(p3.step === 1 && p3.slice0[1] === 0, 'the hour after a forecast starts is its first step');
  let threw = 0;
  for (const bad of [() => E.locate('2t', Date.UTC(1939, 11, 31)), () => E.locate('2t', Date.UTC(2020, 0, 1, 0, 30)), () => E.locate('z', Date.UTC(2020, 0, 1), 501), () => E.locate('nope', Date.UTC(2020, 0, 1))]) { try { bad(); } catch (e) { threw++; } }
  ok(threw === 4, 'before 1940, off the hour, a level it does not have and a field it does not have are each said, not guessed');
}

console.log('\nRULE  the window is the 0.25° grid under the view, padded, and the whole width across 0°');
{
  const w = E.windowOf({ s: 30, w: -110, n: 45, e: -90 }, 0);
  ok(w[0] === 180 && w[1] === 241 && w[2] === 1000 && w[3] === 1081, `rows 45°N to 30°S → ${w[0]}–${w[1]}, columns 110°W to 90°W → ${w[2]}–${w[3]}`);
  const pad = E.windowOf({ s: 30, w: -110, n: 45, e: -90 });
  ok(pad[0] < w[0] && pad[1] > w[1] && pad[2] < w[2] && pad[3] > w[3], 'padded by a quarter of the view each way');
  const across = E.windowOf({ s: 40, w: -10, n: 60, e: 20 });
  ok(across[2] === 0 && across[3] === 1440, 'a view across 0° longitude reads the whole width');
  ok(E.windowOf(null) === null, 'no view: the whole globe');
  const g = E.grid([180, 1000], [61, 81]);
  ok(g.la1 === 45 && g.lo1 === 250 && g.nx === 81 && g.ny === 61 && g.scan === 0, 'the window\'s grid starts at its own corner (45°N, 110°W), rows north to south');
}

console.log('\nRULE  the chunk cache lets the oldest go past its budget');
{
  const c = E.budget(100);
  c.set('a', Promise.resolve(new Uint8Array(60))); c.set('b', Promise.resolve(new Uint8Array(30)));
  await new Promise((r) => setTimeout(r, 0));
  c.get('a');                       // a used again: b is now the oldest
  c.set('c', Promise.resolve(new Uint8Array(40)));
  await new Promise((r) => setTimeout(r, 0));
  ok(c.has('a') && !c.has('b') && c.has('c') && c.bytes <= 100, `the least recently used goes first (${c.bytes} bytes kept)`);
  const one = E.budget(10);
  one.set('big', Promise.resolve(new Uint8Array(50)));
  await new Promise((r) => setTimeout(r, 0));
  ok(one.has('big'), 'one chunk larger than the budget is still kept while it is the only one');
  const failing = E.budget(10);
  failing.set('x', Promise.reject(new Error('gone')).catch(() => { throw new Error('gone'); }));
  await new Promise((r) => setTimeout(r, 0));
  ok(failing.bytes === 0, 'a chunk that failed counts nothing');
}

console.log(failures ? `\n${failures} REANALYSIS RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL REANALYSIS RULES PASS');
process.exit(failures ? 1 : 0);
