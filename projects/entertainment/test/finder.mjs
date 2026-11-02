/* The finder (assets/entertainment/finder.js) builds /tmdb/discover queries;
   the Worker (worker/tmdb.mjs, discoverParams) refuses any value it does not
   know with a 400. Two lists that have to agree — so every mood, genre,
   service, length, score, decade and sort the page can send is sent through
   the Worker's own check here, and a page filter the Worker would refuse
   goes red before it ships as a dead button. */
import { createRequire } from 'node:module';
import { discoverParams, GENRES as W_GENRES, PROVIDERS } from '../../../worker/tmdb.mjs';

const require = createRequire(import.meta.url);
const F = require('../../../assets/entertainment/finder.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const accepted = path => {
  const [p, qs] = path.split('?');
  const kind = p.split('/')[2];
  return discoverParams(kind, new URLSearchParams(qs || ''));
};

console.log('\nRULE  every filter the finder offers is one the Worker accepts');
for (const kind of ['movie', 'tv']) {
  const bad = F.GENRES[kind].filter(([id]) => !W_GENRES[kind].has(id));
  ok(!bad.length, kind + ' genres all known to the Worker' + (bad.length ? ': ' + bad.join() : ''));
  for (const [id, name] of F.GENRES[kind])
    if (!accepted(F.query({ kind, genre: id }))) ok(false, kind + ' genre ' + name + ' refused');
  for (const m of F.MOODS) {
    const mm = F.moodFor(kind, m[0]);
    if (!mm) continue;
    const path = F.query({ kind, mood: m[0] });
    ok(!!accepted(path), kind + ' mood "' + m[1] + '" → ' + path);
    ok(F.said({ kind, mood: m[0] }).length > 0, '  and says what it means: ' + F.said({ kind, mood: m[0] }));
  }
}
ok(F.SERVICES.every(([k]) => k in PROVIDERS), 'every service is one the Worker has an id for');
for (const [len] of F.LENGTHS) ok(!!accepted(F.query({ len })), 'length ' + len);
for (const [min] of F.SCORES) ok(!!accepted(F.query({ min })), 'score ' + min);
for (const era of F.ERAS) ok(!!accepted(F.query({ era })), 'decade ' + era);
for (const [sort] of F.SORTS) ok(!!accepted(F.query({ sort, on: 'netflix' })), 'sort ' + sort);

console.log('\nRULE  the picker says what it asks for, and nothing picked is no query');
ok(F.query({ kind: 'movie' }) === '', 'nothing picked asks for nothing (trending shows instead)');
ok(F.query({ kind: 'movie', sort: 'rated' }) === '/discover/movie?sort=rated', 'a sort alone is a query');
const all = F.query({ kind: 'movie', mood: 'scare', genre: 35, on: 'netflix', len: 'short', min: 7, era: 1990 }, 3);
ok(all === '/discover/movie?g=35&on=netflix&len=short&min=7&era=1990&page=3', 'a genre narrows a mood: ' + all);
const laugh = F.query({ kind: 'movie', mood: 'laugh', genre: 27 });
ok(!new URLSearchParams(laugh.split('?')[1]).has('gx'), 'and is never excluded by it (laugh + horror is horror-comedy, not nothing)');
ok(F.query({ kind: 'tv', mood: 'scare' }) === '', 'a mood shows do not have asks for nothing');
ok(F.query({ kind: 'movie', on: 'hbo-free', genre: 99999, era: 1995 }) === '', 'values it does not offer are dropped, not sent');
ok(F.said({ kind: 'movie', mood: 'laugh', on: 'max', min: 7 }) === 'Comedy · no horror · on Max · audience 70+', 'in words: ' + F.said({ kind: 'movie', mood: 'laugh', on: 'max', min: 7 }));

console.log('\n' + (failures ? failures + ' FAILURE' + (failures > 1 ? 'S' : '') : 'THE FINDER AND THE WORKER AGREE'));
process.exit(failures ? 1 : 0);
