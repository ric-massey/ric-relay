/* CLIMBING — the two parsers have to agree
   ------------------------------------------------------------------
   climbs.md is read twice: by build-data.py at a desk, and by
   climb-parse.js in a browser at a crag. The whole point of add.html
   is that a day typed into it lands in the data exactly as it would
   have if it had been typed into the markdown — so "exactly" has to
   be a thing that gets checked, not a thing that gets hoped.

   This parses the real climbs.md with the JavaScript and compares it,
   field by field, to what the Python wrote into climbs-data.js. 74
   trips, 258 routes, every key. Then it checks the round trip: a day
   composed by the page, parsed back, is the day that went in.

   Run:  node projects/climbing/test/parse-parity.js

   If it fails after a build-data.py change, climb-parse.js has fallen
   behind — the vocabulary regenerates itself, but the control flow in
   parse()/route() is hand-ported and this is what catches the drift.
   Exits non-zero on any disagreement.
*/
const fs = require('fs');
const path = require('path');

const HERE = path.join(__dirname, '..');
global.window = global.window || {};
require(path.join(HERE, 'climb-vocab.js'));
const P = require(path.join(HERE, 'climb-parse.js'));

function loadGenerated(file, key) {
  const src = fs.readFileSync(path.join(HERE, file), 'utf8');
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}') + 1;
  return JSON.parse(src.slice(start, end));
}

let failures = 0;
const rule = name => console.log('\nRULE  ' + name);
const fail = msg => { console.log('  FAIL  ' + msg); failures++; };
const pass = msg => console.log('  PASS  ' + (msg || ''));

/* ---------- the archive, both ways ---------- */

const DATA = loadGenerated('climbs-data.js');
const md = fs.readFileSync(path.join(HERE, 'climbs.md'), 'utf8');
const mine = P.parse(md);
P.mergeAliases(mine);

rule('climb-parse.js reads climbs.md into the same trips build-data.py does');
{
  if (mine.length !== DATA.trips.length) {
    fail(`${mine.length} trips here, ${DATA.trips.length} in climbs-data.js`);
  } else {
    let bad = 0;
    const TRIP_KEYS = ['date', 'dateRaw', 'area', 'notes', 'people', 'pitches',
      'boulders', 'hasPhoto', 'hasVideo'];
    const ROUTE_KEYS = ['name', 'grade', 'gradeKind', 'gradeRank', 'styles',
      'outcome', 'repeats', 'star', 'unknown', 'note', 'area', 'region', 'wall'];

    for (let i = 0; i < mine.length; i++) {
      const a = mine[i], b = DATA.trips[i];
      const where = b.date || b.dateRaw;
      for (const k of TRIP_KEYS) {
        if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
          fail(`${where} .${k}: ${JSON.stringify(a[k])} != ${JSON.stringify(b[k])}`);
          bad++;
        }
      }
      if (a.routes.length !== b.routes.length) {
        fail(`${where}: ${a.routes.length} routes here, ${b.routes.length} there`);
        bad++;
        continue;
      }
      for (let j = 0; j < a.routes.length; j++) {
        for (const k of ROUTE_KEYS) {
          if (JSON.stringify(a.routes[j][k]) !== JSON.stringify(b.routes[j][k])) {
            fail(`${where} "${b.routes[j].name}" .${k}: ` +
              `${JSON.stringify(a.routes[j][k])} != ${JSON.stringify(b.routes[j][k])}`);
            bad++;
          }
        }
      }
    }
    if (!bad) {
      const routes = mine.reduce((n, t) => n + t.routes.length, 0);
      pass(`${mine.length} trips, ${routes} routes, every field identical`);
    }
  }
}

rule('and ranks what he climbs most the same way too');
{
  const ranked = P.tally(mine, []);
  const theirs = DATA.index.mostClimbed;
  if (ranked.length !== theirs.length) {
    fail(`${ranked.length} unique routes here, ${theirs.length} there`);
  } else {
    let bad = 0;
    for (let i = 0; i < ranked.length; i++) {
      for (const k of Object.keys(theirs[i])) {
        if (JSON.stringify(ranked[i][k]) !== JSON.stringify(theirs[i][k])) {
          fail(`#${i + 1} ${theirs[i].name} .${k}: ` +
            `${JSON.stringify(ranked[i][k])} != ${JSON.stringify(theirs[i][k])}`);
          bad++;
        }
      }
    }
    if (!bad) pass(`${ranked.length} routes, same tallies and same order`);
  }
}

/* ---------- what the page writes ---------- */
/* Everything below is the add.html side: it composes markdown and the
   data comes from parsing that markdown back. If these two disagree
   the page is quietly recording something other than what it shows. */

const ROUND_TRIPS = [
  {
    name: 'an onsight',
    day: {
      date: '2026-08-25', area: 'Ijams Crag', people: 'Dorcey',
      routes: [{ name: 'Suttree', grade: '5.10b', style: 'onsight', outcome: 'sent', repeats: 1 }]
    },
    expect: { grade: '5.10b', gradeKind: 'rope', gradeRank: 41, styles: ['onsight'], outcome: 'sent', repeats: 1 }
  },
  {
    name: 'a flash',
    day: {
      date: '2026-08-25', area: 'Lilly Boulders',
      routes: [{ name: 'Popeye', grade: 'V3', style: 'flash', outcome: 'sent', repeats: 1 }]
    },
    expect: { grade: 'V3', gradeKind: 'boulder', gradeRank: 3, styles: ['flash'], outcome: 'sent', repeats: 1 }
  },
  {
    name: 'a redpoint after four goes',
    day: {
      date: '2026-08-25', area: 'Red River Gorge',
      routes: [{ name: 'Gold Rush', grade: '5.11d', style: 'redpoint', outcome: 'sent', repeats: 4 }]
    },
    expect: { grade: '5.11d', gradeRank: 47, styles: ['redpoint'], outcome: 'sent', repeats: 4 }
  },
  {
    name: 'three attempts and no send',
    day: {
      date: '2026-08-25', area: 'Red River Gorge',
      routes: [{ name: 'Tapeworm', grade: '5.12d', outcome: 'attempt', repeats: 3, star: true }]
    },
    expect: { outcome: 'attempt', repeats: 3, star: true, styles: [] }
  },
  {
    name: 'a lap on something already sent',
    day: {
      date: '2026-08-25', area: 'The Obed',
      routes: [{ name: 'Warm-Up Route', grade: '5.10b', outcome: 'sent', repeats: 2 }]
    },
    expect: { name: 'Warm-Up Route', outcome: 'sent', repeats: 2 }
  },
  {
    name: 'a trad lead with a note on it',
    day: {
      date: '2026-08-25', area: 'City of Rocks',
      routes: [{ name: 'Far Left', grade: '5.7', how: 'trad', outcome: 'sent', repeats: 1, note: 'small cams only' }]
    },
    expect: { styles: ['trad'], outcome: 'sent', note: 'small cams only' }
  },
  {
    name: 'a top rope that is not a lead tick',
    day: {
      date: '2026-08-25', area: 'Dierkies Lake',
      routes: [{ name: 'Romulus', grade: '5.10a', how: 'top rope', outcome: 'sent', repeats: 1 }]
    },
    expect: { styles: ['top rope'], outcome: 'sent' }
  }
];

rule('a day composed by the page parses back as the day that went in');
{
  let bad = 0;
  for (const c of ROUND_TRIPS) {
    const trip = P.day(P.compose(c.day));
    if (!trip) { fail(`${c.name}: composed to nothing`); bad++; continue; }
    if (trip.date !== c.day.date) {
      fail(`${c.name}: date came back ${trip.date}`); bad++;
    }
    if (trip.area !== c.day.area) {
      fail(`${c.name}: area came back ${JSON.stringify(trip.area)}`); bad++;
    }
    const r = trip.routes[0] || {};
    for (const k of Object.keys(c.expect)) {
      if (JSON.stringify(r[k]) !== JSON.stringify(c.expect[k])) {
        fail(`${c.name}: .${k} came back ${JSON.stringify(r[k])}, wanted ${JSON.stringify(c.expect[k])}`);
        bad++;
      }
    }
  }
  if (!bad) pass(`${ROUND_TRIPS.length} days, in and back out unchanged`);
}

rule('the shape of a day survives: sectors, partners, pitches');
{
  const day = {
    date: '2026-07-27', area: 'Red River Gorge', region: 'PMRP',
    people: 'Dorcey, Silas, Chayten', notes: 'impromptu trip', pitches: 3,
    routes: [
      { name: 'Maranda Rayne', grade: '5.9', wall: 'The Shire', style: 'onsight', outcome: 'sent', repeats: 1 },
      { name: 'Amarillo Sunset', grade: '5.11b', wall: 'The North 40', outcome: 'sent', repeats: 2 }
    ]
  };
  const trip = P.day(P.compose(day));
  const checks = [
    [trip.area, 'Red River Gorge', 'area'],
    [trip.routes[0].region, 'PMRP', 'first route region'],
    [trip.routes[0].wall, 'The Shire', 'first route wall'],
    [trip.routes[1].wall, 'The North 40', 'second route wall'],
    [trip.routes[1].repeats, 2, 'the x2'],
    [JSON.stringify(trip.people), '["Dorcey","Silas","Chayten"]', 'partners'],
    [trip.pitches, 3, 'pitches']
  ];
  let bad = 0;
  for (const [got, want, what] of checks) {
    if (got !== want) { fail(`${what}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`); bad++; }
  }
  if (!bad) pass('two sectors under a region, three partners, three pitches');
}

/* A route Ric has climbed before has to land on the SAME row of the
   most-climbed table, not next to it — which is the one thing a second
   spelling would quietly break. */
rule('a web day folds into the ledger rather than sitting beside it');
{
  const before = DATA.index.mostClimbed.find(e => e.name === 'Cavers Route');
  const trip = P.day(P.compose({
    date: '2026-08-25', area: 'Red River Gorge',
    routes: [{ name: 'cavers', grade: '5.2', outcome: 'sent', repeats: 1 }]
  }));
  const after = P.tally([trip], DATA.index.mostClimbed)
    .filter(e => P.canonicalRoute(e.name) === 'Cavers Route');
  if (after.length !== 1) fail(`"cavers" made ${after.length} rows, not 1`);
  else if (after[0].ascents !== before.ascents + 1) {
    fail(`ascents went ${before.ascents} -> ${after[0].ascents}`);
  } else if (after[0].lastDate !== '2026-08-25') {
    fail(`lastDate stayed ${after[0].lastDate}`);
  } else {
    pass(`"cavers" joined Cavers Route: ${before.ascents} -> ${after[0].ascents} ascents`);
  }
}

console.log('\n' + (failures ? `${failures} DISAGREEMENT${failures > 1 ? 'S' : ''}` : 'THE TWO PARSERS AGREE'));
process.exit(failures ? 1 : 0);
