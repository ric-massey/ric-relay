/* The front door: every room it lists is real, and none is lost.

       node .github/test/frontdoor.mjs

   index.html builds itself from two lists in its script — POSTS (each room:
   its page, its paper, what shows through) and SHELVES (the subjects, and
   which rooms sit under each). A room in one and not the other vanishes
   without an error; a page renamed elsewhere leaves a dead card. So: every
   room on a shelf is a known room, every known room is on a shelf, every link
   and picture it names exists, the plain list for a browser without scripts
   names the same rooms, and the Log stays off (Ric, 2026-10-29). */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '  PASS' : '  FAIL'}  ${msg}`); if (!ok) fails++; };
const grab = (start, end) => { const i = html.indexOf(start); return i < 0 ? null : html.slice(i, html.indexOf(end, i) + end.length); };

const posts = eval(grab('const POSTS = [', '];').replace('const POSTS = ', '').replace(/;$/, ''));
const shelves = eval(grab('const SHELVES = [', '];').replace('const SHELVES = ', '').replace(/;$/, ''));
const extra = { 'weather-pro': 'weather-pro.html' };      // added to byId beside POSTS
const href = Object.fromEntries([...posts.map(p => [p.id, p.href]), ...Object.entries(extra)]);

const onShelf = shelves.flatMap(s => s[2]);
check(onShelf.every(id => href[id]), 'every room on a shelf is a known room' + (onShelf.filter(id => !href[id]).join(', ') ? ': ' + onShelf.filter(id => !href[id]).join(', ') : ''));
const lost = Object.keys(href).filter(id => !onShelf.includes(id) && id !== 'log');
check(!lost.length, 'every known room is on a shelf' + (lost.length ? ' — lost: ' + lost.join(', ') : ''));
check(new Set(onShelf).size === onShelf.length, 'no room is on two shelves');
const wordless = posts.filter(p => onShelf.includes(p.id) && !(p.what && p.what.trim()));
check(!wordless.length, 'every room says in a few words what it is' + (wordless.length ? ': ' + wordless.map(p => p.id).join(', ') : ''));
check(!onShelf.includes('log') && !/href="log\.html"/.test(grab('<noscript>', '</noscript>')), 'the Log is not on the front door');

const missing = Object.entries(href).filter(([, h]) => !existsSync(join(ROOT, h.split('#')[0])));
check(!missing.length, 'every room page exists' + (missing.length ? ': ' + missing.map(m => m[1]).join(', ') : ''));
const media = posts.flatMap(p => p.media.video ? [p.media.video + '.jpg', p.media.video + '.mp4'] : []);
const thumbs = [...html.matchAll(/"(assets\/frontdoor\/thumbs\/[a-z-]+\.jpg)"/g)].map(m => m[1]);
const goneMedia = [...media, ...thumbs].filter(f => !existsSync(join(ROOT, f)));
check(!goneMedia.length, 'every clip, poster frame and thumbnail exists' + (goneMedia.length ? ': ' + goneMedia.join(', ') : ''));

const plain = [...grab('<noscript>', '</noscript>').matchAll(/href="([^"]+)"/g)].map(m => m[1]);
const notPlain = onShelf.filter(id => !plain.includes(href[id]));
check(!notPlain.length, 'the plain no-script list names every room' + (notPlain.length ? ' — missing: ' + notPlain.join(', ') : ''));

const bar = [...grab('<nav class="tabbar"', '</nav>').matchAll(/href="([^"]+)"/g)].map(m => m[1]);
check(bar.length && bar.every(h => existsSync(join(ROOT, h))), "the phone bar's links exist");
check(!/docs\/mockups|<base /.test(html), 'nothing on the page points into the mockups');

console.log(fails ? `\n${fails} FAILED` : '\nfront door checks passed');
process.exit(fails ? 1 : 0);
