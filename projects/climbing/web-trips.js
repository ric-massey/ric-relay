/* CLIMBING — days logged from a phone
   ────────────────────────────────────────────────────────────────────────────
   climbs.md is the archive and is still edited by hand. add.html writes to the
   log service instead, so a day can be recorded at the crag without a build
   step. This is the one place that knows how to fetch those days and reshape
   them to look like every other trip.

   It lives in its own file because it used to live inside the deep log page,
   which meant climbing.html — the room, and the page most people actually land
   on — never learned about web days at all. A day logged at Lilly showed up in
   one of the two places it should have, and the front page quietly kept saying
   the last trip was three weeks earlier. One copy, two callers.

       await WebTrips.merge(window.CLIMBING_DATA)

   Returns the number of days merged. Safe to call when the service is down: it
   returns 0 and leaves the archive alone, because a page showing the committed
   history is right and an error page is not. */
(function (global) {
  const HOST = global.location.origin.includes('localhost')
    ? global.location.origin
    : 'https://training-log.rmbuster82.workers.dev';

  /* The log service stores what add.html collected. The rest of the site
     expects the richer shape build-data.py produces, so the gaps are filled
     with honest blanks rather than guesses — `gradeRank: 0` in particular means
     a web entry can never win "hardest", which is correct: the grade is a
     free-text string here and ranking it would be inventing precision. */
  function shape(d) {
    return {
      date: d.date,
      dateRaw: d.date,
      area: d.area || 'Climbing',
      notes: d.notes || '',
      people: d.people ? String(d.people).split(/\s*,\s*/).filter(Boolean) : [],
      pitches: 0,
      boulders: 0,
      hasPhoto: false,
      hasVideo: false,
      fromWeb: true,
      routes: (d.routes || []).map(r => ({
        name: r.name,
        grade: r.grade || '',
        gradeKind: /^[vV]/.test(r.grade || '') ? 'boulder' : 'rope',
        gradeRank: 0,
        styles: [],
        outcome: r.outcome || 'sent',
        repeats: 1,
        star: false,
        unknown: false,
        note: null,
        area: d.area || '',
        region: '',
        wall: ''
      }))
    };
  }

  async function fetchDays() {
    try {
      const r = await fetch(HOST + '/climb', { cache: 'no-store' });
      if (!r.ok) return [];
      return Object.values((await r.json()).days || {}).map(shape);
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

    /* The headline counters are precomputed by build-data.py, so they have to
       be told. Without this the room page adds the trip to the list and then
       goes on reporting a trip count that does not include it — two numbers on
       one screen disagreeing, which is worse than either being stale. */
    if (DATA.stats) {
      DATA.stats.trips = (DATA.stats.trips || 0) + fresh.length;
      DATA.stats.sends = (DATA.stats.sends || 0) +
        fresh.reduce((n, t) => n + t.routes.filter(r => r.outcome === 'sent').length, 0);
    }
    return fresh.length;
  }

  global.WebTrips = { merge, fetchDays, shape };
})(window);
