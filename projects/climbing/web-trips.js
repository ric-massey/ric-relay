/* CLIMBING — days logged from a phone
   ────────────────────────────────────────────────────────────────────────────
   climbs.md is the archive and is still edited by hand. add.html writes to the
   log service instead, so a day can be recorded at the crag without a build
   step. This is the one place that knows how to fetch those days and put them
   into the archive's shape.

   It lives in its own file because it used to live inside the deep log page,
   which meant climbing.html — the room, and the page most people actually land
   on — never learned about web days at all. A day logged at Lilly showed up in
   one of the two places it should have, and the front page quietly kept saying
   the last trip was three weeks earlier. One copy, two callers.

       await WebTrips.merge(window.CLIMBING_DATA)

   Returns the number of days merged. Safe to call when the service is down: it
   returns 0 and leaves the archive alone, because a page showing the committed
   history is right and an error page is not.

   ── what a web day is now ──
   It used to be a thinner thing than a markdown one: no styles, no ×2, no
   sector, and `gradeRank: 0` so it could never place in "hardest". Honest, but
   it meant the same afternoon was worth less to the site for having been typed
   at the crag rather than at a desk — and the ranking blank was self-inflicted,
   because a grade is a grade whoever typed it.

   So add.html now stores the markdown block it would have written into
   climbs.md by hand, and this reads that block with climb-parse.js, the browser
   port of the parser build-data.py uses. Same grades, same ranks, same styles,
   same send-or-project rule. A web day is a markdown day that hasn't been
   filed yet — including in the ledgers below, which it now counts towards.

   Needs climb-vocab.js and climb-parse.js loaded first. */
(function (global) {
  const HOST = global.location.origin.includes('localhost')
    ? global.location.origin
    : 'https://training-log.rmbuster82.workers.dev';

  /* Days written before the page kept its markdown. They carry a name, a grade
     and an outcome and nothing else — so rather than reading them a second,
     poorer way, they are written out as the markdown they would have been and
     parsed like everything else. An old entry gets a grade rank out of it. */
  function legacyMarkdown(d) {
    return ClimbParse.compose({
      date: d.date,
      area: d.area,
      people: d.people,
      notes: d.notes,
      routes: (d.routes || []).map(r => ({
        name: r.name,
        grade: r.grade,
        // 'repeat' was a third outcome this page once offered. It meant "I have
        // been up this before", which the log records by the route appearing
        // twice — not by the ascent being something other than a send.
        outcome: r.outcome === 'attempt' ? 'attempt' : 'sent',
        repeats: 1
      }))
    });
  }

  function shape(d) {
    const trip = ClimbParse.day(d.md || legacyMarkdown(d));
    if (!trip) return null;
    if (!trip.area) trip.area = 'Climbing';
    trip.routes.forEach(r => { if (!r.area) r.area = trip.area; });
    /* The one thing the markdown can't say about itself. Pages use it to mark
       a day as logged from the crag rather than filed. */
    trip.fromWeb = true;
    return trip;
  }

  async function fetchDays() {
    try {
      const r = await fetch(HOST + '/climb', { cache: 'no-store' });
      if (!r.ok) return [];
      return Object.values((await r.json()).days || {}).map(shape).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  async function merge(DATA) {
    if (!DATA) return 0;
    const extra = await fetchDays();
    if (!extra.length) return 0;

    /* A date already in climbs.md wins — the markdown is the record of intent,
       and a web entry for the same day is the rough note that preceded it. */
    const known = new Set(DATA.trips.map(t => t.date));
    const fresh = extra.filter(t => !known.has(t.date));
    if (!fresh.length) return 0;

    DATA.trips = [...fresh, ...DATA.trips]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    /* 'Silas' typed at a crag and 'Silas Whitaker' in the archive are one
       person, and the log's people list is how you'd ever notice they weren't.
       Run over everything, so a short name meets the full ones it might be. */
    ClimbParse.mergeAliases(DATA.trips);

    /* ── the ledgers ──
       Everything below is precomputed by build-data.py, so it has to be told.
       Without this the page adds the trip to the list and then goes on
       reporting totals that don't include it — two numbers on one screen
       disagreeing, which is worse than either being stale. And a route he sent
       today would be missing from most-climbed while sitting in the day card
       directly above it. */
    if (DATA.index) {
      DATA.index.mostClimbed = ClimbParse.tally(fresh, DATA.index.mostClimbed || []);
      const people = new Set(DATA.index.people || []);
      const areas = new Set(DATA.index.areas || []);
      fresh.forEach(t => {
        t.people.forEach(p => people.add(p));
        if (t.area) areas.add(t.area);
      });
      const byName = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
      DATA.index.people = [...people].sort(byName);
      DATA.index.areas = [...areas].sort(byName);
    }

    /* ── the tick list ──
       build-data.py ties the wish list back to the log: each dream route knows
       whether he has been on it, how many goes, and when. It does that against
       the most-climbed table, which has just changed — so without this, getting
       on a project at the crag left "Dream Routes" still saying "not yet" about
       the thing he spent the afternoon on. */
    if (DATA.todo && DATA.index) {
      const byRoute = {};
      DATA.index.mostClimbed.forEach(r => { byRoute[r.name.toLowerCase()] = r; });
      DATA.todo.forEach(item => {
        const m = byRoute[ClimbParse.canonicalRoute(item.name).toLowerCase()];
        item.tried = m ? {
          ascents: m.ascents, days: m.days, sent: m.sends > 0, lastDate: m.lastDate
        } : null;
      });
    }

    if (DATA.stats) {
      /* Counted the way build-data.py counts: a line that records a day without
         recording a climb ("2 other climbs, not sure what they were") is not a
         route, and a send is one route entry rather than one lap. */
      const routes = fresh.reduce((all, t) => all.concat(t.routes.filter(r => !r.unknown)), []);
      DATA.stats.trips = (DATA.stats.trips || 0) + fresh.length;
      DATA.stats.routes = (DATA.stats.routes || 0) + routes.length;
      DATA.stats.sends = (DATA.stats.sends || 0) + routes.filter(r => r.outcome === 'sent').length;
      if (DATA.index) {
        DATA.stats.uniqueRoutes = DATA.index.mostClimbed.length;
        DATA.stats.people = DATA.index.people.length;
        DATA.stats.areas = DATA.index.areas.length;
      }
    }
    return fresh.length;
  }

  global.WebTrips = { merge, fetchDays, shape };
})(window);
