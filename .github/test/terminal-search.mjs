/* The terminal's search engine (assets/terminal/search.js), run against the
   site's real data: the rooms and projects read out of terminal.html, every
   page in pages.js, and the climbing log, boards, films and CS matches.

   The ranking cases are what a visitor would type and what they would expect
   at the top. If one goes red after a data change, look at what replaced it
   before changing the case — the case is the promise. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const S = require(join(ROOT, 'assets/terminal/search.js'));

// The data files assign to window.*; run each in one shared fake window.
const win = {};
const load = (f) => new Function('window', readFileSync(join(ROOT, f), 'utf8'))(win);
['assets/terminal/pages.js', 'projects/climbing/climbs-data.js', 'projects/climbing/board-data.js',
 'projects/entertainment/entertainment-data.js', 'projects/cs/cs-data.js'].forEach(load);

// ROOMS, PROJECTS and PAGE_ALIASES as terminal.html declares them, so the
// test searches the same rooms the terminal does.
const page = readFileSync(join(ROOT, 'terminal.html'), 'utf8');
const literal = (name, open, close) => {
  const at = page.indexOf(`const ${name} = ${open}`);
  assert.ok(at >= 0, `terminal.html declares ${name}`);
  const end = page.indexOf(`\n    ${close};`, at);
  return new Function(`return ${page.slice(page.indexOf(open, at), end + 5 + close.length)}`)();
};
const ROOMS = literal('ROOMS', '[', ']');
const PROJECTS = literal('PROJECTS', '[', ']');
const ALIASES = new Function(`return ${page.match(/const PAGE_ALIASES = (\{[^\n]*\});/)[1]}`)();
const roomAlias = (w) => (ROOMS.some((r) => r.name === w) ? w : ALIASES[w] || w);

const docs = [
  ...ROOMS.map((r) => ({ kind: 'room', title: `/${r.name}`, href: r.href, room: r.name,
    keys: [r.name, ...Object.keys(ALIASES).filter((a) => ALIASES[a] === r.name)].join(' '), body: r.desc })),
  ...PROJECTS.map((p) => ({ kind: 'project', title: p.title, href: p.href, room: roomAlias(p.room),
    keys: [p.command, ...p.aliases].join(' '), body: p.description })),
  ...win.TERMINAL_PAGES.map((p) => ({ kind: 'page', ...p })),
  ...S.from.climbing(win.CLIMBING_DATA), ...S.from.boards(win.BOARD_DATA),
  ...S.from.films(win.ENTERTAINMENT_DATA), ...S.from.cs(win.CS_DATA),
];
const index = S.build(docs);
const find = (q) => S.search(index, q, { roomAlias });
const top = (q) => (find(q).results[0] || {}).doc || {};

test('pages.js is current with the pages', () => {
  execFileSync('node', [join(ROOT, 'assets/terminal/build-pages.mjs'), '--check'], { cwd: ROOT });
});

test('every result points at a file that exists', () => {
  for (const d of index.docs) {
    if (!d.href) continue;
    const file = d.href.split(/[?#]/)[0];
    assert.ok(existsSync(join(ROOT, file)), `${d.kind} "${d.title}" → ${d.href}`);
  }
});

test('every data source contributes', () => {
  for (const kind of ['room', 'project', 'page', 'day', 'route', 'todo', 'board', 'film', 'match']) {
    assert.ok(index.docs.some((d) => d.kind === kind), `no ${kind} docs`);
  }
  // a room, its page and its "new" entry are one result, not three
  assert.equal(index.docs.filter((d) => d.href === 'weather.html').length, 1);
});

const cases = [
  ['climbing', (d) => d.title === '/climbing', 'the room'],
  ['climing', (d) => d.title === '/climbing', 'one letter missing'],
  ['clmibing', (d) => d.title === '/climbing', 'two letters swapped'],
  ['film', (d) => d.title === '/entertainment', 'a synonym for the room'],
  ['weather', (d) => d.title === '/weather', 'the room'],
  ['kondrite', (d) => d.title === 'KONDRITE', 'a project'],
  ['crossfire', (d) => d.title === 'KONDRITE', "the game's old name"],
  ['i40', (d) => d.title === 'Interstate 40', 'an alias'],
  ['mood', (d) => d.title === 'State-of-Mind Line' || d.title === '/mind', 'a word in a description, over near misses'],
  ['routes', (d) => d.title === '/climbing' || d.title === 'The Climbing Log', 'a kind word alone finds where they live'],
  ['light cones', (d) => /Light Cones/.test(d.title), 'a page by its title'],
  ['amarilo sunset', (d) => d.kind === 'route' && /amarillo sunset/i.test(d.title), 'a route, misspelled'],
  ['"fox fire"', (d) => d.title === 'Fox Fire', 'a phrase'],
  ['inception', (d) => d.kind === 'film' && d.title === 'Inception', 'a film'],
  ['incepton', (d) => d.title === 'Inception', 'a film, misspelled'],
  ['dust2', (d) => d.kind === 'match', 'a CS map'],
];
for (const [q, ok, what] of cases) {
  test(`"${q}" → ${what}`, () => {
    const d = top(q);
    assert.ok(ok(d), `top result for "${q}" was ${d.kind} "${d.title}"`);
  });
}

test('every word has to match', () => {
  const { results, partial } = find('denzel washington');
  assert.ok(!partial && results.length >= 3);
  for (const r of results) assert.match(r.doc.hay, /denzel/);
});

test('a kind word narrows to that kind', () => {
  const { results } = find('nolan films');
  assert.ok(results.length >= 3);
  assert.ok(results.every((r) => r.doc.kind === 'film'));
  assert.ok(find('obed routes').results.every((r) => r.doc.kind === 'route'));
});

test('in:, type: and minus filter', () => {
  assert.ok(find('red river in:climbing').results.every((r) => r.doc.room === 'climbing'));
  assert.ok(find('kilter type:board').results.every((r) => r.doc.kind === 'board'));
  for (const r of find('kilter -tension').results) assert.doesNotMatch(r.doc.hay, /tension/);
});

test('the last word can be half typed', () => {
  assert.equal(top('kondr').title, 'KONDRITE');
  assert.ok(find('star wa').results.some((r) => r.doc.title === 'Star Wars'));
});

test('nonsense finds nothing, and a misspelling gets a suggestion', () => {
  assert.equal(find('zzqxvw').results.length, 0);
  assert.equal(find('').results.length, 0);
  assert.equal(S.suggest(index, 'kondirtex'), 'kondrite');
});

test('matched words are marked in what is shown', () => {
  const r = find('denzel').results[0];
  const { line, lineMarks } = r.snippet;
  assert.ok(line && lineMarks.length);
  assert.ok(lineMarks.every(([a, b]) => /denzel/i.test(line.slice(a, b))));
});

test('fast enough to run on every keystroke', () => {
  const qs = ['c', 'cl', 'cli', 'clim', 'climbi', 'red river gorge', 'denzel washington films', 'amarilo', 'xqzt'];
  const t0 = performance.now();
  for (let i = 0; i < 3; i++) for (const q of qs) find(q);
  const per = (performance.now() - t0) / (qs.length * 3);
  assert.ok(per < 60, `${per.toFixed(1)} ms a search`);
});

test('the text helpers', () => {
  assert.deepEqual(S.tokens('Counter-Strike 5.11b Ric’s'), ['counter', 'strike', 'counterstrike', '5.11b', 'rics']);
  assert.equal(S.stem('sends'), 'send');
  assert.equal(S.stem('climbing'), 'climb');
  assert.equal(S.stem('running'), 'run');
  assert.equal(S.stem('movies'), 'movie');
  assert.equal(S.distance('climbing', 'clmibing', 2), 1);
});
