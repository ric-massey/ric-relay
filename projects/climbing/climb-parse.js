/* CLIMBING — reading a day the way climbs.md is read
   ────────────────────────────────────────────────────────────────────────────
   build-data.py turns climbs.md into climbs-data.js. This does the same job in
   the browser, so a day typed into add.html at a crag lands in the data
   identically to the same day typed into the markdown at a desk: the same
   grade rank, the same styles, the same repeat count, the same send-or-project
   verdict.

   It owns no vocabulary of its own. Every table and every pattern comes out of
   climb-vocab.js, which build-data.py writes from the constants it parses with
   — so a fixed typo or a new alias reaches both readers at once, and there is
   nothing here to keep in sync by hand.

       <script src="climb-vocab.js"></script>
       <script src="climb-parse.js"></script>

       ClimbParse.route('Amarillo Sunset - 5.11b (redpoint, x2)')
       ClimbParse.day(markdownBlock)      // one dated block -> a trip
       ClimbParse.compose({ ... })        // a filled-in form -> that block

   compose() and day() are inverses on purpose. add.html writes the markdown it
   would have written by hand, and everything downstream reads THAT — so what
   the page stores is the same artefact as the file, not a summary of it.

   test: node projects/climbing/test/parse-parity.js
   — which parses climbs.md with this and checks it against what the Python
   wrote, every trip, every route, every field. */
(function (root, factory) {
  const api = factory(root);
  root.ClimbParse = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  /* Looked up late rather than captured, so load order between the two files
     can't turn into a silently empty vocabulary. */
  function V() {
    const v = root.CLIMB_VOCAB;
    if (!v) throw new Error('climb-vocab.js has to load before climb-parse.js');
    return v;
  }
  const cache = {};
  function rx(key, flags) {
    const k = key + ' ' + (flags || '');
    return cache[k] || (cache[k] = new RegExp(V().patterns[key], flags));
  }
  /* The grade pattern, un-anchored, for lines that forgot the dash. */
  function looseGrade() {
    return cache.loose || (cache.loose =
      new RegExp('(?<![\\w.])(' + V().patterns.grade.replace(/^\^/, '') + ')'));
  }
  function styleList(flags) {
    const k = 'styles ' + (flags || '');
    return cache[k] || (cache[k] = V().styleWords.map(p => [p[0], new RegExp(p[1], flags)]));
  }
  function prose() {
    return cache.prose || (cache.prose = new Set(V().prosePeople));
  }

  /* Python's str.strip(chars) — trim a named set from both ends and nothing
     else. Several rules below depend on ' -' meaning exactly space-and-dash. */
  function strip(s, chars) {
    let a = 0, b = s.length;
    while (a < b && chars.indexOf(s[a]) >= 0) a++;
    while (b > a && chars.indexOf(s[b - 1]) >= 0) b--;
    return s.slice(a, b);
  }
  const titleCase = s => s.replace(/[A-Za-z]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const isLower = s => /[a-z]/.test(s) && s === s.toLowerCase();

  /* ── headings ── */
  function normalize(name, table) {
    const raw = String(name).trim();
    return table[raw.toLowerCase().replace(/\.+$/, '')] || raw;
  }

  /* MM/DD/YY and MM/DD/YYYY both appear. ISO out, or null if it isn't a date. */
  function parseDate(raw) {
    const m = rx('date').exec(String(raw).trim());
    if (!m) return null;
    const month = +m[1], day = +m[2];
    let year = +m[3];
    if (year < 100) year += 2000;
    if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
    return String(year).padStart(4, '0') + '-' +
      String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  /* ── grades ── */
  function grade(raw) {
    let g = String(raw).trim().replace(/,/g, '.').replace(/ /g, '');
    if (/^3rdclass$/i.test(g)) return { display: '3rd class', kind: 'other', rank: 0 };
    if (/^[Vv]/.test(g)) {
      const display = 'V' + g.slice(1);
      const num = /^V(\d+)/.exec(display);
      return { display: display, kind: 'boulder', rank: num ? +num[1] : 0 };
    }
    if (/^\d+[a-dA-D]/.test(g)) g = '5.' + g;   // a bare "10a" means 5.10a
    const m = /^5\.(\d+)\s*([a-dA-D])?/.exec(g);
    if (m) {
      const letter = (m[2] || '').toLowerCase();
      return { display: g, kind: 'rope', rank: +m[1] * 4 + (letter ? letter.charCodeAt(0) - 97 : 0) };
    }
    return { display: String(raw).trim(), kind: 'other', rank: 0 };
  }

  /* ── one route line ──
     'Cold Hard Bitch - 5.12b (attempts)' — and every other shape climbs.md has
     ever used for one. */
  function route(line) {
    const lead = String(line).replace(/^\s+/, '');
    const starred = lead.charAt(0) === '⭑';
    const text = lead.replace(/^⭑+/, '').trim();

    /* Split on the separating dash. Requiring a space *before* it keeps
       hyphenated names ("Wac-a-mole") intact, while not requiring one after it
       catches "Shackles -v2". */
    const dash = rx('dashSplit').exec(text);
    let name = dash ? text.slice(0, dash.index).trim() : text.trim();
    let rest = dash ? text.slice(dash.index + dash[0].length).trim() : '';

    let display = null, kind = null, rank = 0;
    const gm = rest ? rx('grade').exec(rest) : null;
    if (gm) {
      const g = grade(gm[1]);
      display = g.display; kind = g.kind; rank = g.rank;
      rest = rest.slice(gm[0].length).trim();
    } else {
      /* Some lines forget the dash ("27 years of climbing 5.8 x2"), so look for
         a grade anywhere and treat everything before it as the name. */
      const loose = looseGrade().exec(text);
      if (loose) {
        const g = grade(loose[1]);
        display = g.display; kind = g.kind; rank = g.rank;
        name = strip(text.slice(0, loose.index), ' -');
        rest = text.slice(loose.index + loose[0].length).trim();
      }
    }

    /* Lines that record a day without recording a climb. Real, but not a route
       — the pages keep them out of the ledgers. */
    const unknown = display === null && rx('unknown', 'i').test(text);

    const blob = rest.toLowerCase();
    const found = styleList().filter(s => s[1].test(blob)).map(s => s[0]);

    const rm = rx('repeat', 'i').exec(rest);
    const repeats = rm ? +(rm[1] || rm[2]) : 1;

    /* A tick log defaults to "sent" — but only a clean one counts. An explicit
       onsight/flash/redpoint/"sent it" wins outright; otherwise a note about
       falls, takes or bailing at a clip means he got on it, not up it. */
    const clean = rx('clean', 'i').test(blob) ||
      found.some(s => s === 'onsight' || s === 'flash' || s === 'redpoint');
    // A deliberate practice whipper isn't a failed go — don't read it as one.
    const worked = rx('worked', 'i').test(blob.replace(rx('fakeFall', 'gi'), ' '));
    let outcome = 'sent';
    if (clean) outcome = 'sent';
    else if (found.indexOf('attempt') >= 0) outcome = 'attempt';
    else if (worked) outcome = 'attempt';

    /* Whatever the tags already say ("attempts", "flash", "x2") shouldn't be
       repeated as a note; keep only the part that adds something ("2 takes"). */
    let leftover = rest;
    styleList('gi').forEach(s => { leftover = leftover.replace(s[1], ' '); });
    leftover = leftover.replace(rx('repeat', 'gi'), ' ');
    leftover = leftover.replace(rx('sentWord', 'gi'), ' ');
    leftover = leftover.replace(rx('punct', 'g'), ' ');
    leftover = strip(leftover.replace(/\s+/g, ' '), ' ./-');
    if (/^[\d\s]*$/.test(leftover)) leftover = '';   // a bare "2" says nothing

    return {
      name: name,
      grade: display,
      gradeKind: kind,
      gradeRank: rank,
      styles: found.filter(s => s !== 'attempt'),
      outcome: outcome,
      repeats: repeats,
      star: starred,
      unknown: unknown,
      note: leftover || null
    };
  }

  /* ── partners ──
     Bare 'with' also shows up in prose ('fell in love with midnight surf'), so
     what follows it is filtered rather than trusted. */
  function people(notes) {
    const finder = new RegExp(V().patterns.with, 'gi');
    const out = [];
    let m;
    while ((m = finder.exec(String(notes || ''))) !== null) {
      const chunk = m[1].replace(/\band\b/gi, ',');
      for (let piece of chunk.split(',')) {
        piece = strip(piece, ' .!\t').replace(rx('trailingLabel', 'i'), '');
        if (!piece || rx('notPeople', 'i').test(piece)) continue;
        const words = piece.split(/\s+/);
        if (prose().has(strip(words[0].toLowerCase(), '.'))) continue;
        // Keep leading capitalised words; stop at the first prose word.
        const kept = [];
        for (const word of words) {
          if (prose().has(strip(word.toLowerCase(), '.'))) break;
          if (kept.length && !/^[A-Z]/.test(word)) break;
          kept.push(word);
        }
        if (!kept.length) continue;
        const name = strip(kept.join(' '), ' .');
        if (name.length < 2 || kept.length > 3 || !/^[A-Za-z]/.test(name)) continue;
        out.push(isLower(name) ? titleCase(name) : name);
      }
    }
    const seen = new Set(), unique = [];
    for (const p of out) {
      if (!seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); unique.push(p); }
    }
    return unique;
  }

  /* 'Cam' and 'Cam Burns' are one person. Promote a first name to the full one
     when exactly one full name starts with it. */
  function mergeAliases(trips) {
    const everyone = new Set();
    trips.forEach(t => t.people.forEach(p => everyone.add(p)));
    const full = [...everyone].filter(p => p.indexOf(' ') >= 0);
    const alias = {};
    [...everyone].filter(p => p.indexOf(' ') < 0).forEach(short => {
      const hits = full.filter(f => f.split(' ')[0].toLowerCase() === short.toLowerCase());
      if (hits.length === 1) alias[short] = hits[0];
    });
    if (Object.keys(alias).length) {
      trips.forEach(t => {
        const seen = new Set();
        t.people = t.people.map(p => alias[p] || p)
          .filter(p => (seen.has(p) ? false : (seen.add(p), true)));
      });
    }
    return alias;
  }

  /* ── the whole file, or one day of it ──
     Headings nest area -> region -> wall and the depth varies; this works both
     out the same way build-data.py does. */
  function parse(text) {
    const trips = [];
    let trip = null, area = null, region = null, wall = null;
    let inNotes = false, seenFirstDate = false;

    const flush = () => {
      if (trip && (trip.routes.length || trip.notes)) trips.push(trip);
      trip = null;
    };
    const startTrip = (date, raw) => {
      flush();
      area = region = wall = null;
      inNotes = false;
      trip = {
        date: date, dateRaw: raw, area: null,
        routes: [], notes: '', people: [], pitches: null, boulders: null
      };
    };

    for (const rawLine of String(text).split('\n')) {
      const line = rawLine.replace(/\s+$/, '');
      if (!line.trim()) continue;
      if (line.trim() === '-') continue;

      const heading = rx('heading').exec(line);
      if (heading) {
        const level = heading[1].length;
        const title = heading[2].trim();
        if (!title) continue;

        if (title.toLowerCase().indexOf('note') === 0) { inNotes = true; continue; }
        inNotes = false;

        const date = parseDate(title);
        if (date) { seenFirstDate = true; startTrip(date, title); continue; }

        if (level === 1) {
          const low = title.toLowerCase();
          if (low === 'climbs.md' || low === 'to-do list') continue;
          if (!seenFirstDate) {
            // The undated block at the top: '# Area' then '## Wall'.
            startTrip(null, 'undated');
            area = normalize(title, V().areaAliases);
            trip.area = area;
            region = wall = null;
          }
          continue;
        }
        if (level === 2) {
          if (trip === null) startTrip(null, 'undated');
          if (trip.date === null && trip.area) {
            wall = normalize(title, V().wallAliases);   // undated: ## is the wall
          } else {
            area = normalize(title, V().areaAliases);
            trip.area = area;
            region = wall = null;
          }
          continue;
        }
        if (level === 3) {
          // Might be a region (if a #### follows) or the wall itself.
          region = normalize(title, V().regionAliases);
          wall = normalize(title, V().wallAliases);
          continue;
        }
        wall = normalize(title, V().wallAliases);
        continue;
      }

      if (trip === null) continue;
      if (inNotes) { trip.notes += line.trim() + '\n'; continue; }

      const r = route(line);
      r.area = trip.area;
      r.region = region !== wall ? region : null;
      r.wall = wall;
      trip.routes.push(r);
    }
    flush();

    for (const t of trips) {
      t.notes = t.notes.trim();
      t.people = people(t.notes);
      const pm = rx('pitch', 'i').exec(t.notes);
      const bm = rx('boulder', 'i').exec(t.notes);
      t.pitches = pm ? +pm[1] : null;
      t.boulders = bm ? +bm[1] : null;
      t.hasPhoto = rx('photo', 'i').test(t.notes);
      t.hasVideo = rx('video', 'i').test(t.notes);
    }

    const dated = trips.filter(t => t.date);
    const undated = trips.filter(t => !t.date);
    dated.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return dated.concat(undated);
  }

  /* One dated block in, one trip out — or null if it said nothing. */
  function day(text) {
    const trips = parse(text);
    return trips.length ? trips[0] : null;
  }

  /* ── writing it ──
     The exact block that would have gone in climbs.md. Routes carry their own
     wall, so a day at two sectors comes out as two headings in the order they
     were climbed. */
  function compose(d) {
    const pad = n => String(n).padStart(2, '0');
    const lines = [];
    if (d.date) {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date));
      lines.push('# ' + (iso
        ? pad(+d.date.slice(5, 7)) + '/' + pad(+d.date.slice(8, 10)) + '/' + d.date.slice(2, 4)
        : d.date));
      lines.push('-');
    }
    if (d.area) lines.push('## ' + String(d.area).trim());
    if (d.region) lines.push('### ' + String(d.region).trim());

    const wallLevel = d.region ? '#### ' : '### ';
    let current = null, started = false;
    for (const r of (d.routes || [])) {
      if (!r || !String(r.name || '').trim()) continue;
      const w = String(r.wall || '').trim();
      if (!started || w !== current) {
        if (w) lines.push(wallLevel + w);
        current = w;
        started = true;
      }
      lines.push(routeLine(r));
    }

    const notes = [];
    const who = String(d.people || '').trim();
    if (who) notes.push('w/ ' + who);
    const rest = String(d.notes || '').trim();
    if (rest) notes.push(rest);
    if (d.pitches) notes.push(d.pitches + (+d.pitches === 1 ? ' pitch' : ' pitches'));
    if (d.boulders) notes.push(d.boulders + (+d.boulders === 1 ? ' boulder' : ' boulders'));
    if (notes.length) {
      lines.push('### NOTES');
      notes.forEach(n => String(n).split('\n').forEach(l => lines.push(l)));
    }
    return lines.join('\n');
  }

  /* One route, as its line. The tags go in the order the file uses them: the
     grade, how it went, how many, then anything left to say. */
  function routeLine(r) {
    const name = String(r.name || '').trim();
    let head = (r.star ? '⭑ ' : '') + name;
    if (r.grade) head += ' - ' + String(r.grade).trim();

    const bits = [];
    const style = String(r.style || '').trim();   // onsight | flash | redpoint | ''
    const how = String(r.how || '').trim();       // trad | top rope | free solo | mixed | aid | ''
    if (style) bits.push(style);
    if (r.outcome === 'attempt') bits.push('attempts');
    const n = Math.max(1, parseInt(r.repeats, 10) || 1);
    if (n > 1) bits.push('x' + n);
    if (how) bits.push(how);
    const note = String(r.note || '').trim();
    if (note) bits.push(note);

    return bits.length ? head + ' (' + bits.join(', ') + ')' : head;
  }

  /* ── the ledger ──
     Group every ascent by route the way build-data.py ranks what he climbs
     most, so a day added from a phone folds into the same table rather than
     sitting outside it. */
  function canonicalRoute(name) {
    /* The smart quote first: a phone types ’ where climbs.md types ', and
       without this "Jr’s corner" is a different route from Jr's Corner. */
    const key = String(name).replace(rx('smartQuote', 'g'), "'")
      .toLowerCase().replace(/[^a-z0-9' ]/g, '').trim().replace(/\s+/g, ' ');
    return V().routeAliases[key] || String(name).trim();
  }

  function tally(trips, into) {
    const index = {};
    const out = (into || []).map(e => Object.assign({}, e));
    out.forEach(e => { index[canonicalRoute(e.name).toLowerCase()] = e; });
    for (const trip of trips) {
      for (const r of trip.routes) {
        if (!r.name || r.unknown) continue;
        const key = canonicalRoute(r.name).toLowerCase();
        let entry = index[key];
        if (!entry) {
          entry = {
            name: canonicalRoute(r.name), grade: r.grade, gradeKind: r.gradeKind,
            gradeRank: r.gradeRank, area: r.area, wall: r.wall,
            ascents: 0, days: 0, sends: 0, attempts: 0,
            firstDate: null, lastDate: null, star: false
          };
          index[key] = entry;
          out.push(entry);
        }
        entry.ascents += r.repeats;
        entry.days += 1;
        if (r.outcome === 'sent') entry.sends += r.repeats;
        else entry.attempts += r.repeats;
        entry.star = entry.star || r.star;
        if (!entry.grade && r.grade) {
          entry.grade = r.grade; entry.gradeKind = r.gradeKind; entry.gradeRank = r.gradeRank;
        }
        if (trip.date) {
          if (!entry.firstDate || trip.date < entry.firstDate) entry.firstDate = trip.date;
          if (!entry.lastDate || trip.date > entry.lastDate) entry.lastDate = trip.date;
        }
      }
    }
    out.sort((a, b) => (b.ascents - a.ascents) || (b.days - a.days) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out;
  }

  return {
    route: route, grade: grade, people: people, parse: parse, day: day,
    compose: compose, routeLine: routeLine, parseDate: parseDate,
    normalize: normalize, canonicalRoute: canonicalRoute, tally: tally,
    mergeAliases: mergeAliases
  };
});
