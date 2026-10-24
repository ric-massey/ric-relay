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
    /* a loop playing: its span and how fresh its newest frame is, never the age of the frame coming round */
    const lp = WS.stampText({ layer: 'NEXRAD mosaic', kind: 'observed', t: T - 40 * 60e3, loop: { from: T - 45 * 60e3, to: T - 3 * 60e3 } }, null, fmt);
    ok(/loop 20:15–20:57/.test(lp) && /newest 8 min ago/.test(lp) && !/45 min ago|observed/.test(lp), `a loop says its span and its newest (${lp})`);
    const lf = WS.stampText({ layer: 'HRRR CAPE', kind: 'forecast', t: T + 3600e3, run: T - 3600e3, loop: { from: T, to: T + 18 * 3600e3 } }, null, fmt);
    ok(/run 20Z · loop 21:00–.*15:00/.test(lf) && !/newest/.test(lf), `a forecast loop says its run and its span (${lf})`);
    ok(/observed .*21:00/.test(WS.stampText({ layer: 'R', kind: 'observed', t: T, loop: { from: T - 3600e3, to: T } }, T, fmt)), 'with a shared time, each frame is still said by its own time');
  } finally { Date.now = now; }
}

console.log('\nRULE  the timeline tells time: a model by its forecast hour, the rest by the clock, never crowded');
{
  const fmt = { time: (ms) => new Date(ms).toISOString().slice(11, 16), day: (ms) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ms).getUTCDay()], ymd: (ms) => new Date(ms).toISOString().slice(0, 10) };
  const T = Date.UTC(2026, 9, 22, 20, 47), now = Date.now;
  Date.now = () => T + 60 * 60e3;
  try {
    /* an hour of radar every 5 minutes: 12 frames */
    const radar = Array.from({ length: 12 }, (_, i) => ({ t: T + i * 5 * 60e3 }));
    const r6 = WS.timelineMarks(radar, fmt, 6);
    ok(r6.length && r6.length <= 6, `no more labels than room for (${r6.map((m) => m.text).join(', ')})`);
    ok(r6.every((m) => /^\d\d:\d\d$/.test(m.text)), 'clock times on an observation loop');
    ok(r6.every((m) => m.i > 0 && Math.floor(radar[m.i].t / 600e3) !== Math.floor(radar[m.i - 1].t / 600e3)), 'each label is the first frame past a step boundary');
    ok(new Set(r6.map((m) => m.i)).size === r6.length, 'never two labels on one frame');
    const r2 = WS.timelineMarks(radar, fmt, 2);
    ok(r2.length <= 2 && r2.length >= 1, `a narrow bar gets fewer (${r2.map((m) => m.text).join(', ')})`);
    /* a model run, F000 to F048 hourly */
    const model = Array.from({ length: 49 }, (_, i) => ({ t: T + i * 3600e3, fh: i }));
    const m8 = WS.timelineMarks(model, fmt, 8);
    ok(m8.length <= 8 && m8.every((m) => /^F\d{3}$/.test(m.text)), `a model says forecast hours (${m8.map((m) => m.text).join(' ')})`);
    ok(m8[0].text === 'F000' && m8.every((m) => model[m.i].fh % 12 === 0), 'at the coarsest step that fits: F000, F012 …');
    /* across midnight UTC the day is said where it changes */
    const late = Array.from({ length: 8 }, (_, i) => ({ t: Date.UTC(2026, 9, 22, 22, 0) + i * 30 * 60e3 }));
    ok(WS.timelineMarks(late, fmt, 8).some((m) => /^Fri 00:00$/.test(m.text)), 'the weekday where the day changes');
    ok(WS.timelineMarks([], fmt, 6).length === 0 && WS.timelineMarks([{ t: T }], fmt, 6).length === 1, 'nothing for no frames; one frame is labelled');
  } finally { Date.now = now; }
}

console.log('\nRULE  a workspace sets the main map completely, so choosing one always ends in the same state');
{
  const def = WS.PRESETS.find((p) => p.name === 'Default');
  const d = new URLSearchParams(WS.completeLayer(def.main));
  ok(d.get('l') === 'comp' && d.get('m') === 'hrrr.refc' && d.get('s') === '' && d.get('g') === 'b13.conus.auto' && d.get('r') === 'rot60', `Default is the first-visit map: the mosaic, HRRR in the model menu, no satellite under it (${WS.completeLayer(def.main)})`);
  const marine = WS.PRESETS.find((p) => /Marine/.test(p.name));
  ok(marine && new URLSearchParams(WS.completeLayer(marine.main)).get('m') !== 'hrrr.refc' && new URLSearchParams(WS.completeLayer(def.main)).get('m') === 'hrrr.refc', 'Marine sets its own model; Default then sets HRRR back — nothing of Marine survives in the model menu');
  ok(WS.PRESETS.every((p) => Object.keys(WS.DEFAULT_MAIN).every((k) => new URLSearchParams(WS.completeLayer(p.main)).has(k))), 'every preset, completed, names every part of the main map');
  ok(new URLSearchParams(WS.completeLayer('l=model&m=gfs.h500&o=wc')).get('o') === 'wc', 'what a workspace names is kept; only the rest is filled in');
  ok(WS.sameWorkspace(def, { ...def, main: 'l=comp&s=&o=w' }), 'Default is not "changed" the moment it opens: the page\'s own way of writing the mosaic is the same map');
}

console.log('\nRULE  a map still loading, or one whose file failed, says so in its header');
{
  const fmt = { time: (ms) => new Date(ms).toISOString().slice(11, 16), day: () => 'Sun', ymd: (ms) => new Date(ms).toISOString().slice(0, 10) };
  const t = Date.now(), base = { layer: 'UKMET 500 mb', kind: 'forecast', t, run: t - 12 * 3600e3 };
  ok(/loading…$/.test(WS.stampText({ ...base, state: 'loading' }, t, fmt)), 'loading: "· loading…"');
  ok(/did not load$/.test(WS.stampText({ ...base, state: 'failed' }, t, fmt)), 'failed: "· did not load" — never a valid time over an empty map that looks like the others');
  ok(!/load/.test(WS.stampText({ ...base, state: 'ready' }, t, fmt)), 'drawn: nothing added');
}

console.log('\nRULE  every preset says what it has, and the specialist ones what they lack');
{
  ok(WS.PRESETS.every((p) => WS.PRESET_NOTES[p.name]), 'each preset has its note');
  const specialist = ['Marine', 'Fire Weather', 'Growing', 'Flying (not a briefing)', 'Severe Weather', 'Tropical', 'Winter Storm'];
  ok(specialist.every((n) => /Not here:/.test(WS.PRESET_NOTES[n] || '')), 'Marine, Fire, Growing, Flying, Severe, Tropical and Winter each name what a professional would still need');
  ok(/tides/.test(WS.PRESET_NOTES.Marine) && /RAWS/.test(WS.PRESET_NOTES['Fire Weather']) && /briefing/.test(WS.PRESET_NOTES['Flying (not a briefing)']), 'the gaps named are the real ones: tides, RAWS, an official briefing');
}

console.log('\nRULE  Compare opens the other models with the same field; Trend the runs before; neither holds a place');
{
  const has = { hrrr: ['refc', 't2m', 'h500x'], nam: ['refc', 't2m'], rap: ['refc', 't2m'], gfs: ['t2m'], ecmwf: ['t2m'], aifs: ['t2m'] };
  const hasField = (s, f) => (has[s] || []).includes(f);
  const c = WS.compareLayers('l=model&m=hrrr.refc&o=lw', hasField);
  ok(c.length === 2 && c[0].includes('m=nam.refc') && c[1].includes('m=rap.refc'), `reflectivity: NAM and RAP, storm-scale first (${c.join(' | ')})`);
  ok(c.every((x) => x.includes('o=lw')), 'each keeps the main map\'s overlays');
  const t2 = WS.compareLayers('l=model&m=gfs.t2m', hasField);
  ok(t2.length === 3 && /ecmwf/.test(t2[0]) && /aifs/.test(t2[1]) && /hrrr/.test(t2[2]), `a global model against the globals first, three at most (${t2.map((x) => x.match(/m=([a-z]+)/)[1]).join(' ')})`);
  const h2 = WS.compareLayers('l=model&m=hrrr.t2m', hasField);
  ok(/nam/.test(h2[0]) && /rap/.test(h2[1]) && /gfs/.test(h2[2]), `a storm-scale model against its own kind first (${h2.map((x) => x.match(/m=([a-z]+)/)[1]).join(' ')})`);
  ok(WS.compareLayers('l=model&m=gfs.h500x', hasField).length === 1, 'only models that have the field');
  ok(WS.compareLayers('l=comp', hasField) === null && WS.compareLayers('l=model&m=gefs.t2m', hasField) === null, 'not a model these apply to: null');
  const tr = WS.trendLayers('l=model&m=hrrr.refc');
  ok(tr.length === 3 && tr[0].includes('m=hrrr.refc.1') && tr[2].includes('m=hrrr.refc.3'), `Trend: the one before, two before, three before (${tr.join(' | ')})`);
  const tb = WS.trendLayers('l=model&m=nam.t2m.2');
  ok(tb.length === 3 && tb.some((x) => /m=nam\.t2m(&|$)/.test(x)) && !tb.some((x) => /m=nam\.t2m\.2/.test(x)), 'from an earlier run: the other three, the latest among them');
  ok([...c, ...t2, ...tr].every((x) => !/(^|&)v=/.test(x)), 'no place in any of them');
}

console.log('\nRULE  every readout card has a tab in the drawer\'s index, one short word');
{
  ok(WS.CARDS.every((c) => typeof WS.CARD_TABS[c] === 'string'), `a tab for each card (${WS.CARDS.filter((c) => !WS.CARD_TABS[c]).join(', ') || 'none missing'})`);
  ok(Object.values(WS.CARD_TABS).every((t) => /^[A-Z][a-z]+$/.test(t) && t.length <= 10), 'each is one short word');
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
  const TASKS = ['Winter Storm', 'Tropical', 'Fire Weather', 'Flying (not a briefing)', 'Morning Briefing'];
  ok(TASKS.every((n) => WS.PRESETS.some((p) => p.name === n)), `presets by the weather (UI-REVIEW-2 item 5): ${TASKS.join(', ')}`);
  ok(WS.PRESETS.every((p) => [p.main, ...p.panels].filter(Boolean).every((x) => /^[xwcfsoldrgh]*$/.test(new URLSearchParams(x).get('o') || ''))), 'every overlay a preset names is one the page has');
  ok(WS.PRESETS.find((p) => /Flying/.test(p.name)).name.includes('not a briefing'), 'the flying layout says, in its name, that it is not a briefing');
  const page = readFileSync(new URL('../../../weather-pro.html', import.meta.url), 'utf8');
  ok(page.indexOf('assets/weather/workstation.js') > 0 && page.indexOf('assets/weather/workstation.js') < page.indexOf('assets/weather/app.js'), 'the page loads the workstation before app.js (a link\'s layers are read before the map starts)');
  /* the workspace's controls sit in the place bar with the units (2026-10-23,
     to give the map the height); a warning still leads everything under it */
  const bar = page.slice(page.indexOf('<div class="placebar">'), page.indexOf('<div class="stormband">'));
  ok(bar.includes('id="wsbar"') && page.indexOf('id="storms"') < page.indexOf('id="radarcard"'), 'its controls are in the place bar, and a warning still comes before the map');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL WORKSTATION RULES PASS'));
process.exit(failures ? 1 : 0);
