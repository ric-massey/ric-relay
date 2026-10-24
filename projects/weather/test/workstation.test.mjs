/* Weather Pro's workstation — node projects/weather/test/workstation.test.mjs
   assets/weather/workstation.js: a workspace's shape, the link that shares
   it, and what a panel's header says. What is held here is what the room's
   rules ask of it: a layout never carries a place unless the visitor adds
   one, a link from outside cannot put anything but layers on the page, and
   a panel never shows a time without saying how far it is from the shared
   one. No network, no browser. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const WS = require('../../../assets/weather/workstation.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const unb64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

console.log('\nRULE  a workspace is layers, maps and cards — never a place');
{
  const w = WS.clean({ name: 'Mine', main: 'v=35.4,-97.5,8&l=l3:ref&o=wc', panels: ['l=model&m=hrrr.refc&lat=35.4&lon=-97.5'], place: { lat: 35.4, lon: -97.5 }, cards: { order: ['sky'], hidden: ['alerts', 'afd'] } });
  ok(w.main === 'l=l3:ref&o=wc' && !/v=|35\.4/.test(JSON.stringify(w)), 'a view or a place handed in with the layers is dropped');
  ok(!('place' in w) && Object.keys(w).sort().join() === 'cards,layout,main,name,panels,sync,v', 'and nothing but the layout survives');
  ok(w.layout === 'stack' && WS.clean({ layout: 'grid' }).layout === 'grid' && WS.clean({ layout: '<b>' }).layout === 'stack', 'the maps stack or sit side by side, nothing else');
  ok(!WS.sameWorkspace({ panels: ['l=comp'], layout: 'grid' }, { panels: ['l=comp'] }), 'side by side is a change from one under another');
  ok(w.cards.order[0] === 'sky' && w.cards.order.length === WS.CARDS.length, 'cards keep the order asked, and every card is still placed');
  ok(!w.cards.hidden.includes('alerts') && w.cards.hidden.includes('afd'), 'warnings cannot be hidden; other cards can');
  ok(WS.clean({ panels: Array(9).fill('l=comp') }).panels.length === WS.MAX_PANELS, `at most ${WS.MAX_PANELS} extra maps`);
  ok(WS.cleanLayer('l=comp&o=w<script>') === null || !/script/.test(WS.cleanLayer('l=comp&o=w<script>')), 'a layer value with anything but plain words is not kept');
  ok(WS.cleanLayer('o=w') === null && WS.cleanLayer('l=l3:srv&t=2') === 'l=l3:srv&t=2', 'a layer must name what it shows');
  ok(WS.clean({ name: '<img src=x onerror=1>'.repeat(3) }).name.length <= 40 && !/[<>]/.test(WS.clean({ name: '<b>x</b>' }).name), 'a name is plain text, 40 characters at most');
}

console.log('\nRULE  the link holds no place unless the visitor adds one');
{
  const w = { name: 'Storm day', main: 'l=l3:ref&o=wcrl', panels: ['l=l3:srv&o=wc', 'l=model&o=w&m=smeso.stpe'] };
  const plain = WS.linkHash(w);
  ok(/^ws=[A-Za-z0-9_-]+$/.test(plain), 'by default: the workspace only');
  const json = unb64(plain.slice(3));
  ok(!/"v"\s*:\s*"|lat|lon|\d+\.\d+,-?\d+\.\d+/.test(json), 'with no coordinate anywhere in it');
  const withView = WS.linkHash(w, { view: '35.4,-97.5,8' });
  ok(/&v=35\.4,-97\.5,8$/.test(withView), 'ticked: the main map\'s view, to a tenth of a degree');
  ok(!/v=/.test(WS.linkHash(w, { view: '35.41234,-97.5,8' })) && !/v=/.test(WS.linkHash(w, { view: 'here' })), 'and only that — a finer view is not written');
  const at = WS.linkHash(w, { at: Date.UTC(2013, 4, 20, 20, 3, 17) });
  ok(/&at=1369080180000$/.test(at), 'the shared time, to the minute, if asked');
  const back = WS.readHash('#' + withView);
  ok(back && back.ws.name === 'Storm day' && back.ws.panels.length === 2 && back.view === '35.4,-97.5,8', 'a link reads back as it was written');
  ok(WS.readHash('#ws=bm90IGpzb24') === null && WS.readHash('#ws=' + 'A'.repeat(5000)) === null && WS.readHash('#l=comp') === null, 'anything else is not a workspace');
  const evil = Buffer.from(JSON.stringify({ name: 'x', main: 'l=comp&v=1,2,3', panels: ['javascript:alert(1)', 'l=comp'] })).toString('base64');
  const r = WS.readHash('#ws=' + evil);
  ok(r && r.ws.main === 'l=comp' && r.ws.panels.join() === 'l=comp', 'a link from outside puts only layers on the page');
}

console.log('\nRULE  two ways of writing the same layers are the same layout');
{
  ok(WS.sameLayer('l=l3:ref&s=&o=wclr&t=0', 'l=l3:ref&o=wcrl'), 'empty values, the lowest tilt, the overlays\' order');
  ok(WS.sameLayer('l=model&m=meso.stpe', 'l=model&m=smeso.stpe'), 'the browser\'s mesoanalysis standing in for the server\'s');
  ok(!WS.sameLayer('l=l3:ref&t=1', 'l=l3:ref') && !WS.sameLayer('l=model&m=gfs.h500', 'l=model&m=ecmwf.h500'), 'but another tilt or another model is not');
  const p = WS.PRESETS.find((x) => x.name === 'Severe Weather');
  ok(WS.sameWorkspace(p, { ...p, main: 'l=l3:ref&s=&o=lrcw&t=0' }) && !WS.sameWorkspace(p, { ...p, panels: p.panels.slice(1) }), 'a workspace is "changed" only when its layout is');
}

console.log('\nRULE  every map says what it shows and when, and how far from the shared time');
{
  const fmt = { time: (ms) => new Date(ms).toISOString().slice(11, 16), day: () => 'Mon', ymd: (ms) => new Date(ms).toISOString().slice(0, 10) };
  const T = Date.UTC(2026, 9, 22, 21, 0), now = Date.now;
  Date.now = () => T + 5 * 60e3;
  try {
    const obs = WS.stampText({ layer: 'TLX velocity', kind: 'observed', t: T, run: null }, null, fmt);
    ok(/observed .*21:00/.test(obs) && /5 min ago/.test(obs), `an observation: its own time, and its age (${obs})`);
    ok(!/shared time/.test(obs), 'with no shared time, the shared time is never mentioned');
    ok(/in 3 h/.test(WS.stampText({ layer: 'HRRR CAPE', kind: 'forecast', t: T + 3 * 3600e3, run: T - 3600e3 }, null, fmt)), 'a forecast against the clock says how far ahead it is');
    const fc = WS.stampText({ layer: 'HRRR CAPE', kind: 'forecast', t: T + 3 * 3600e3, run: T - 3600e3 }, T, fmt);
    ok(/run 20Z/.test(fc) && /valid .*00:00/.test(fc) && /3 h after the shared time/.test(fc), `a forecast: its run, its valid time, and the gap (${fc})`);
    ok(WS.stampText({ layer: 'GOES', kind: 'analysis', t: T, run: null }, T, fmt).indexOf('shared time') < 0, 'on the shared time, no gap is mentioned');
    ok(!/after now/.test(WS.stampText({ layer: 'R', kind: 'observed', t: T + 9 * 60e3 }, null, fmt)), 'a scan stamped ahead of the clock is never "after now"');
    ok(/loading/.test(WS.stampText({ layer: 'R', kind: 'observed', t: null }, null, fmt)), 'and one still loading says so');
  } finally { Date.now = now; }
}

console.log('\nRULE  the presets open only what the page has');
{
  const MM = require('../modelmaps.js'), MR = require('../mrms.js'), AB = require('../abi.js'), NX = require('../nexrad.js');
  const real = (s) => {
    const q = new URLSearchParams(s), l = q.get('l');
    if (l === 'model') { const [src, f] = q.get('m').split('.'); return !!MM.field(src, f); }
    if (l === 'mrms') return !!MR.PRODUCTS[q.get('r')];
    if (l === 'abi') return !!AB.PRODUCTS[q.get('g').split('.')[0]];
    if (l.startsWith('l3:')) return !!NX.PRODUCTS[l.slice(3)];
    return ['comp', 'hrrr'].includes(l);
  };
  ok(WS.PRESETS.every((p) => (!p.main || real(p.main)) && p.panels.every(real)), 'every layer a preset names is one the page can draw');
  ok(WS.PRESETS.some((p) => p.name === 'Forecast Analysis') && WS.PRESETS.some((p) => p.name === 'Severe Weather'), 'Forecast Analysis and Severe Weather, as WORKSTATION.md asked');
  const page = readFileSync(new URL('../../../weather-pro.html', import.meta.url), 'utf8');
  ok(page.indexOf('assets/weather/workstation.js') > 0 && page.indexOf('assets/weather/workstation.js') < page.indexOf('assets/weather/app.js'), 'the page loads the workstation before app.js (a link\'s layers are read before the map starts)');
  /* the workspace's controls sit in the place bar with the units (2026-10-23,
     to give the map the height); a warning still leads everything under it */
  const bar = page.slice(page.indexOf('<div class="placebar">'), page.indexOf('<div class="stormband">'));
  ok(bar.includes('id="wsbar"') && page.indexOf('id="storms"') < page.indexOf('id="radarcard"'), 'its controls are in the place bar, and a warning still comes before the map');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL WORKSTATION RULES PASS'));
process.exit(failures ? 1 : 0);
