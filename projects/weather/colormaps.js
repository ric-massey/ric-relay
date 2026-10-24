/* COLOUR MAPS — the visitor's own colour tables, and GR's .pal files
   ────────────────────────────────────────────────────────────────────────────
   Built 2026-10-24 (an outside review Ric passed on listed custom colour
   maps among the specialist depth Pro lacked). Pro already offered three
   reflectivity tables and two velocity ones (UI-REVIEW B7); this lets a
   visitor make their own for any radar product or model field, or bring
   one in the format radar people already trade: GRLevelX / GR2Analyst
   ".pal" colour tables, which RadarScope and others read too.

   A palette here is the shape nexrad.js and modelmaps.js draw with:
     { stops: [[value, '#rrggbb'], …], floor?, min, max, ticks }
   in the product's own display unit (dBZ, kt, °F, in, …). Between stops
   the colour is blended; under `floor` nothing is drawn.

   parsePal(text)   a .pal file → { key, units, palette, name, notes }.
                    "Color: v r g b [r2 g2 b2]" blends from the first colour
                    at v to the second just under the next value (with one
                    colour it blends to the next entry's); "SolidColor:" holds
                    one colour to the next value; Color4/SolidColor4 carry
                    alpha, and a leading fully clear entry becomes the floor.
                    Values are converted from the file's Units (MPH, KTS,
                    MPS, KPH, DBZ, …) to the unit Pro draws that product in.
                    Scale/Offset describe the raw data in GR and are not
                    needed here; RF, Step and the like are read and ignored.
   writePal(p, key) a palette → .pal text GR reads back
   clean(p)         a palette from storage or the editor, checked: numbers
                    ascending, colours as #rrggbb, 2 to 256 stops; null if not
   ticks(min, max)  four to seven round numbers across a range, for the key

   Pure: text in, objects out. The tables live in the visitor's browser and
   are never sent anywhere (the room's rule for what a visitor brings). */
(function (root) {
  'use strict';
  /* which radar product a .pal's "Product:" names, and the unit Pro draws it in */
  const PRODUCT = {
    ref: { names: ['BR', 'BREF', 'REF', 'BZ', 'DBZ', 'CR', 'CREF', 'REFLECTIVITY'], unit: 'dBZ' },
    vel: { names: ['BV', 'VEL', 'SRV', 'SRM', 'V', 'VELOCITY'], unit: 'kt' },
    cc: { names: ['CC', 'RHO', 'RHOHV'], unit: '' },
    zdr: { names: ['ZDR', 'ZD', 'DR'], unit: 'dB' },
    kdp: { names: ['KDP', 'KD'], unit: '°/km' },
    sw: { names: ['SW', 'WIDTH'], unit: 'kt' },
    eet: { names: ['ET', 'EET', 'TOPS'], unit: 'kft' },
    vil: { names: ['VIL', 'DVL'], unit: 'kg/m²' }
  };
  /* a file's Units → a multiplier into Pro's unit for that product */
  const TO_KT = { KTS: 1, KT: 1, KNOTS: 1, MPH: 1 / 1.150779, MPS: 1.943844, 'M/S': 1.943844, MS: 1.943844, KPH: 1 / 1.852, KMH: 1 / 1.852, 'KM/H': 1 / 1.852 };
  const keyOf = (product) => {
    const P = String(product || '').trim().toUpperCase();
    for (const [k, v] of Object.entries(PRODUCT)) if (v.names.includes(P)) return k;
    return null;
  };
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const rgbHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
  const HEX = /^#[0-9a-f]{6}$/i;

  function ticks(min, max) {
    if (!(max > min)) return [min];
    const span = max - min, raw = span / 5, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 7) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out.map((v) => +v.toFixed(6));
  }

  function clean(p) {
    if (!p || !Array.isArray(p.stops)) return null;
    const stops = p.stops.filter((s) => Array.isArray(s) && Number.isFinite(+s[0]) && HEX.test(String(s[1]))).map((s) => [+s[0], String(s[1]).toLowerCase()]);
    if (stops.length < 2 || stops.length > 256) return null;
    for (let i = 1; i < stops.length; i++) if (!(stops[i][0] > stops[i - 1][0])) return null;
    const min = stops[0][0], max = stops[stops.length - 1][0];
    const out = { stops, min, max, ticks: ticks(min, max) };
    if (Number.isFinite(+p.floor) && p.floor != null) out.floor = +p.floor;
    if (p.log && min > 0) {
      /* a log scale (rain, snow) is ticked at 1-2-5 steps, thinned to seven */
      out.log = true;
      const lt = [];
      for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) for (const m of [1, 2, 5]) { const v = +(m * 10 ** e).toPrecision(3); if (v >= min && v <= max) lt.push(v); }
      out.ticks = lt.filter((_, i) => i % Math.ceil(lt.length / 7) === 0);
    }
    return out;
  }

  function parsePal(text) {
    const entries = [], notes = [];
    let product = null, units = null, name = null, rf = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.replace(/;.*$/, '').trim();
      if (!line) continue;
      const m = /^([A-Za-z0-9]+)\s*:\s*(.*)$/.exec(line);
      if (!m) continue;
      const k = m[1].toLowerCase(), rest = m[2].trim(), n = rest.split(/[\s,]+/).map(Number);
      if (k === 'product') product = rest;
      else if (k === 'units') units = rest.toUpperCase();
      else if (k === 'name' || k === 'title') name = rest;
      else if (k === 'rf' && n.length >= 3) rf = rgbHex(n[0], n[1], n[2]);
      else if (k === 'color' || k === 'solidcolor' || k === 'color4' || k === 'solidcolor4') {
        const four = k.endsWith('4'), w = four ? 4 : 3, v = n[0];
        if (!Number.isFinite(v) || n.length < 1 + w || n.slice(1, 1 + w).some((x) => !Number.isFinite(x))) { notes.push(`skipped "${line.slice(0, 40)}"`); continue; }
        const c1 = n.slice(1, 1 + w), c2 = n.length >= 1 + 2 * w && n.slice(1 + w, 1 + 2 * w).every(Number.isFinite) ? n.slice(1 + w, 1 + 2 * w) : null;
        entries.push({ v, c1, c2, solid: k.startsWith('solid'), clear: four && c1[3] === 0 && (!c2 || c2[3] === 0) });
      } else if (!['step', 'scale', 'offset', 'decimals', 'nd', 'th', 'version'].includes(k)) notes.push(`"${m[1]}:" is not used`);
    }
    if (entries.length < 2) throw new Error('colormaps: a colour table needs two colours or more');
    entries.sort((a, b) => a.v - b.v);
    const key = keyOf(product);
    /* the file's unit into Pro's: speeds to knots; the rest are the same everywhere */
    let mul = 1;
    if ((key === 'vel' || key === 'sw') && units) {
      if (TO_KT[units] == null) throw new Error(`colormaps: velocity in "${units}" is not a unit read here (KTS, MPH, MPS or KPH)`);
      mul = TO_KT[units];
    }
    const stops = [];
    let floor = null;
    entries.forEach((e, i) => {
      const next = entries[i + 1], v = e.v * mul, nv = next ? next.v * mul : null;
      if (e.clear) { if (floor == null && !stops.length && next) floor = nv; return; }
      const a = rgbHex(e.c1[0], e.c1[1], e.c1[2]);
      stops.push([v, a]);
      if (next && (e.solid || e.c2)) {
        const b = e.solid ? a : rgbHex(e.c2[0], e.c2[1], e.c2[2]), eps = Math.min(1e-3, (nv - v) / 100);
        stops.push([nv - eps, b]);
      }
    });
    /* identical values (a solid band ending where the next begins) keep the later colour */
    const merged = [];
    for (const s of stops) { if (merged.length && !(s[0] > merged[merged.length - 1][0])) merged[merged.length - 1] = s; else merged.push(s); }
    const palette = clean({ stops: merged, floor });
    if (!palette) throw new Error('colormaps: the colour table could not be read into a palette');
    return { key, units: key ? PRODUCT[key].unit : units || '', palette, name: name || product || '', rf, notes };
  }

  function colourAt(stops, v) {
    if (v <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a), x = (h, k) => parseInt(h.slice(1 + 2 * k, 3 + 2 * k), 16);
      return rgbHex(...[0, 1, 2].map((k) => x(ca, k) + (x(cb, k) - x(ca, k)) * t));
    }
    return stops[stops.length - 1][1];
  }
  function writePal(p, key) {
    const P = PRODUCT[key], c = clean(p);
    if (!c) throw new Error('colormaps: not a palette');
    const lines = [`; written by Weather Pro (ricmassey.com/weather-pro), ${new Date().toISOString().slice(0, 10)}`];
    if (P) lines.push(`Product: ${P.names[0]}`, `Units: ${key === 'vel' || key === 'sw' ? 'KTS' : P.unit || 'NONE'}`);
    /* a floor is written as GR writes one, a clear entry just under it, and
       the colours from the floor up (parsePal reads that back as the floor) */
    let stops = c.stops;
    if (c.floor != null) {
      const f = c.floor;
      stops = c.stops.filter((s) => s[0] >= f);
      if (!stops.length || stops[0][0] > f) stops.unshift([f, colourAt(c.stops, f)]);
      lines.push(`Color4: ${+(f - 1).toFixed(4)} 0 0 0 0`);
    }
    for (const [v, h] of stops) {
      const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
      lines.push(`Color: ${+v.toFixed(4)} ${r} ${g} ${b}`);
    }
    return lines.join('\n') + '\n';
  }

  const api = { PRODUCT, keyOf, parsePal, writePal, clean, ticks, rgbHex, colourAt };
  root.ColorMaps = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
