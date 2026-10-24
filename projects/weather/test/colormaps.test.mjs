/* Colour maps — node projects/weather/test/colormaps.test.mjs
   colormaps.js: GR's .pal colour tables read the way GR2Analyst draws them
   (a two-colour entry blends to the next value, a solid one holds, a clear
   leading entry is the floor, speeds converted to knots), written back so
   they read the same, a stored table checked before it is drawn, and the
   hooks that let nexrad.js and modelmaps.js draw with it. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const CM = require('../colormaps.js');
const NX = require('../nexrad.js');
const MM = require('../modelmaps.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

console.log('\nRULE  a GR .pal table reads as GR draws it');
{
  const t = CM.parsePal(`; a reflectivity table
Product: BR
Units: DBZ
Step: 5
Color4: 0 0 0 0 0
Color: 10 0 100 200 0 150 255
SolidColor: 30 0 200 0
Color: 50 255 0 0
Color: 75 255 255 255
RF: 119 0 119`);
  ok(t.key === 'ref' && t.units === 'dBZ', '"Product: BR" is reflectivity, drawn in dBZ');
  ok(t.palette.floor === 10, 'a fully clear first entry is the floor: nothing drawn under 10');
  const s = t.palette.stops;
  ok(s[0][0] === 10 && s[0][1] === '#0064c8' && near(s[1][0], 30 - 0.001) && s[1][1] === '#0096ff', 'a two-colour entry blends from its first colour to its second, just under the next value');
  ok(s[2][1] === '#00c800' && s[3][1] === '#00c800' && near(s[3][0], 50 - 0.001), 'a solid entry holds one colour up to the next value');
  ok(s[s.length - 1][0] === 75 && s[s.length - 1][1] === '#ffffff' && t.rf === '#770077', 'the last entry ends the table; RF is read');
  const v = CM.parsePal('Product: BV\nUnits: MPH\nColor: -100 0 255 0\nColor: 0 0 0 0\nColor: 100 255 0 0');
  ok(v.key === 'vel' && near(v.palette.min, -100 / 1.150779, 1e-4) && near(v.palette.max, 86.898, 1e-3), 'a velocity table in MPH is converted to knots (100 mph = 86.9 kt)');
  const ms = CM.parsePal('Product: BV\nUnits: MPS\nColor: -40 0 255 0\nColor: 40 255 0 0');
  ok(near(ms.palette.max, 40 * 1.943844, 1e-6), 'and one in m/s too');
  let threw = 0;
  for (const bad of ['Product: BR\nColor: 10 0 0 0', 'nothing here', 'Product: BV\nUnits: FURLONGS\nColor: -1 0 0 0\nColor: 1 1 1 1']) { try { CM.parsePal(bad); } catch (e) { threw++; } }
  ok(threw === 3, 'one colour, no colours, or a speed unit it does not know is said, not guessed');
  const other = CM.parsePal('Product: XYZ\nColor: 0 0 0 0\nColor: 1 255 255 255');
  ok(other.key === null && other.palette.stops.length === 2, 'a product it does not know still reads: the editor puts it on what is open');
}

console.log('\nRULE  a table written as .pal reads back the same');
{
  for (const [key, P] of [['ref', NX.PALETTES.ref], ['vel', NX.PALETTES.vel], ['cc', NX.PALETTES.cc]]) {
    const back = CM.parsePal(CM.writePal(P, key));
    const same = back.key === key && back.palette.stops.length >= P.stops.length && P.stops.every(([v, c]) => back.palette.stops.some(([w, d]) => near(v, w, 1e-3) && d === c.toLowerCase()));
    ok(same && (P.floor == null || back.palette.floor === P.floor), `the standard ${key} table: every colour at its value${P.floor != null ? ', and its floor' : ''}`);
  }
  const t = CM.parsePal(CM.writePal({ stops: [[0, '#000000'], [10, '#ffffff']], floor: 5 }, 'zdr'));
  ok(t.palette.floor === 5 && t.palette.stops[0][0] === 5 && t.palette.stops[0][1] === '#808080', 'a floor inside the table is written at its own value, its colour blended there');
}

console.log('\nRULE  a stored table is checked before it is drawn');
{
  ok(CM.clean({ stops: [[0, '#000000'], [1, '#FFFFFF']] }).stops[1][1] === '#ffffff', 'a good table is kept, colours in lower case');
  ok(CM.clean({ stops: [[1, '#000000'], [0, '#ffffff']] }) === null, 'values that do not rise are refused');
  ok(CM.clean({ stops: [[0, 'red'], [1, '#ffffff']] }) === null || CM.clean({ stops: [[0, 'red'], [1, '#ffffff']] }).stops.length === 2, 'a colour that is not #rrggbb is dropped');
  ok(CM.clean({ stops: [[0, '#000000']] }) === null && CM.clean(null) === null && CM.clean({ stops: Array.from({ length: 300 }, (_, i) => [i, '#000000']) }) === null, 'one stop, nothing, or more than 256 is refused');
  ok(CM.clean({ stops: [[0, '#000000'], [1, '#ffffff']], floor: '<script>' }).floor === undefined, 'a floor that is not a number is left out');
  const tk = CM.ticks(-80, 80);
  ok(tk.length >= 4 && tk.length <= 7 && tk.includes(0), `round ticks across a range (${tk.join(', ')})`);
}

console.log('\nRULE  the radar and the models draw with the visitor\'s table');
{
  const mine = CM.clean({ stops: [[0.2, '#000000'], [1.05, '#ffffff']] });
  ok(NX.setCustom('cc', mine) && NX.paletteFor('cc', 'custom') === mine && NX.SCHEME_NAMES.cc.custom === 'Your colours', 'a CC table is the choice "custom"');
  ok(NX.paletteFor('cc', 'nws') === NX.PALETTES.cc, 'the standard stays the standard');
  NX.setCustom('ref', CM.clean({ stops: [[0, '#000000'], [80, '#ffffff']] }));
  ok(NX.SCHEME_NAMES.ref.custom === 'Your colours' && NX.SCHEMES.ref.contrast, 'a reflectivity table joins the three standard ones');
  NX.setCustom('cc', null); NX.setCustom('ref', null);
  ok(NX.paletteFor('cc', 'custom') === NX.PALETTES.cc && !NX.SCHEME_NAMES.ref.custom, 'taken away, the standard is back');
  ok(NX.setCustom('hca', mine) === false, 'the hydrometeor classes are categories, not a scale: no table');
  const temp = CM.clean({ stops: [[-40, '#0000ff'], [120, '#ff0000']] });
  MM.setCustom('temp', temp);
  const w = MM.table('temp').lookup(-40);
  ok(MM.palOf('temp') === temp && (w & 255) === 0 && ((w >>> 16) & 255) === 255, 'a model field draws with it: −40 °F is the table\'s blue');
  MM.setCustom('temp', null);
  ok(MM.palOf('temp') === MM.PAL.temp && MM.setCustom('ptype', temp) === false, 'and gives it back; precipitation type is categories');
}

console.log(failures ? `\n${failures} COLOUR MAP RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL COLOUR MAP RULES PASS');
process.exit(failures ? 1 : 0);
