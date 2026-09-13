/* CLIMBING — the tick list, merged
   ────────────────────────────────────────────────────────────────────────────
   todo.md is the archive of the list; the Worker holds everything added since,
   from a phone, through a form. This folds the second into the first so every
   page reads one list and cannot show two different counts of it.

   The same job web-trips.js does for days, done the same way on purpose:
   fetch, shape, merge, and leave the precomputed ledgers consistent.

       await WebTodo.merge(window.CLIMBING_DATA);
*/
(function (global) {
  async function fetchItems() {
    try {
      const r = await ClimbHost.fetch('/todo', { cache: 'no-store' });
      if (!r.ok) return {};
      return (await r.json()).items || {};
    } catch (e) {
      /* No signal. A tick list with only the archive on it is the right page;
         an error is not. */
      return {};
    }
  }

  /* The Worker stores crag and wall in separate fields; todo.md carried them
     as one "crag, wall" string and every page reads that shape. Written out
     here so the two kinds of entry are indistinguishable downstream. */
  function shape(it) {
    return {
      name: it.name,
      grade: it.grade || null,
      gradeKind: it.gradeKind || (/^[Vv]\d/.test(it.grade || '') ? 'boulder' : 'rope'),
      gradeRank: it.gradeRank || 0,
      style: it.style || null,
      done: it.done === true,
      tickDate: it.tickDate || null,
      result: it.result || null,
      pitches: it.pitches || null,
      lengthFt: it.lengthFt || null,
      location: [it.crag, it.wall].filter(Boolean).join(', ') || null,
      note: it.note || null,
      tried: null,
      id: it.id,
      source: 'web'
    };
  }

  const slug = (name, crag) => String(name + '-' + (crag || ''))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

  async function merge(DATA) {
    if (!DATA) return 0;
    const items = await fetchItems();
    const fresh = Object.values(items).map(shape);
    if (!fresh.length) return 0;

    DATA.todo = DATA.todo || [];

    /* A route typed into todo.md years ago and then added again through the
       form is one route. Matched on the same slug the Worker keys on, so the
       web copy wins — it is the one that can be edited. */
    const byId = {};
    fresh.forEach(f => { byId[f.id] = true; });
    const kept = DATA.todo.filter(t => {
      const crag = String(t.location || '').split(',')[0].trim();
      return !byId[slug(t.name, crag)];
    });

    DATA.todo = fresh.concat(kept);

    /* The ledger the room page reads. Recount rather than add, because the
       merge above can drop an archive row as a duplicate. */
    if (DATA.stats) {
      DATA.stats.todoOpen = DATA.todo.filter(t => !t.done).length;
      DATA.stats.todoDone = DATA.todo.filter(t => t.done).length;
    }

    /* build-data.py ties each wish back to the log — how many goes, when. A
       route added through the form has never been through that, so it is done
       here against the same table. Without it, adding a project you have spent
       four days on shows it as one you have never touched. */
    if (DATA.index && DATA.index.mostClimbed && global.ClimbParse) {
      const byRoute = {};
      DATA.index.mostClimbed.forEach(r => { byRoute[r.name.toLowerCase()] = r; });
      DATA.todo.forEach(item => {
        if (item.tried) return;
        const m = byRoute[ClimbParse.canonicalRoute(item.name).toLowerCase()];
        item.tried = m
          ? { ascents: m.ascents, days: m.days, sent: m.sends > 0, lastDate: m.lastDate }
          : null;
      });
    }
    return fresh.length;
  }

    /* host/resolved kept as names so callers need not know they moved. */
  global.WebTodo = { merge, fetchItems, shape, slug,
                     host: ClimbHost.origin, resolved: ClimbHost.resolved };
})(window);
