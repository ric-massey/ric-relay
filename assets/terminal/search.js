/* THE TERMINAL'S SEARCH ENGINE
   ────────────────────────────────────────────────────────────────────────────
   `find` used to be a substring test over fourteen rooms and eleven projects:
   "find denzel" found nothing, "find climing" found nothing, and "find red
   river" found nothing although seventy days of the climbing log are there.
   Ric (2026-10-30): "We need to make the search engine in terminal
   phenominal". So this indexes the whole site and ranks it:

     · every room, project and public page (pages.js, generated from the pages'
       own <title>, description and headings by build-pages.mjs);
     · the climbing log — every day out, every route, the to-do list — and the
       board sends; every film on the Entertainment list; every CS match; the
       front door's notes and its "new" list;
     · typo-tolerant: a word four letters or longer may be one edit off
       (Damerau, so a swapped pair counts once), eight or longer two;
     · plurals and -ing / -ed fold together ("sends" finds "sent"'s day by
       "send"), a hand-kept synonym table covers the words people type when
       they don't know the room's name ("film" → entertainment);
     · the last word matches as a prefix, so results firm up while typing;
     · every word has to match somewhere; when no result has them all, the
       best partial matches are shown and labelled as partial;
     · in:<room>, type:<kind>, "quoted phrases" and -excluded words.

   No dependencies, no network: the index is built in the browser from files
   the site already serves. It is a UMD module so .github/test/terminal-
   search.mjs runs the same code against the real data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TerminalSearch = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ─── text ─────────────────────────────────────────────
  const fold = (s) => String(s == null ? "" : s)
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[’‘`´]/g, "'").replace(/&/g, " and ");

  // A word: letters and digits, with a dot kept between two of them so a grade
  // ("5.11b") or a version stays one token. Apostrophes go ("ric's" → "rics").
  const WORD = /[a-z0-9]+(?:[.'][a-z0-9]+)*/g;
  const clean = (w) => w.replace(/'/g, "");

  /* Light stemming, English only and deliberately timid: the cost of a wrong
     fold ("news" → "new") is a stray result, the cost of none is "sends"
     missing "send". */
  function stem(w) {
    if (w.length <= 3 || /\d/.test(w)) return w;
    // "movies" → "movie" but "studies" → "study": short ones keep the e
    if (w.endsWith("ies") && w.length > 4) return w.length <= 6 ? w.slice(0, -1) : w.slice(0, -3) + "y";
    if (/(ss|us|is)$/.test(w)) return w;
    if (/(sh|ch|x|z)es$/.test(w)) return w.slice(0, -2);
    if (w.endsWith("ing") && w.length > 5) return undouble(w.slice(0, -3));
    if (w.endsWith("ed") && w.length > 4) return undouble(w.slice(0, -2));
    if (w.endsWith("s")) return w.slice(0, -1);
    return w;
  }
  const undouble = (w) => /([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss)$/.test(w) ? w.slice(0, -1) : w;

  /* Every token in a string. A hyphenated or underscored run also gives its
     joined form, so "counter-strike" is found by "counterstrike" and
     "de_train" by "detrain" as well as by its parts. */
  function tokens(s) {
    const out = [];
    for (const run of fold(s).split(/\s+/)) {
      const parts = run.match(WORD);
      if (!parts) continue;
      for (const p of parts) out.push(clean(p));
      if (parts.length > 1 && /[-_]/.test(run)) out.push(parts.map(clean).join(""));
    }
    return out;
  }

  // Optimal string alignment distance, cut off at `max`.
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const n = b.length;
    let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
        if (v < best) best = v;
      }
      if (best > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[n];
  }

  /* What people type when they don't know what a room is called. Each group
     is one idea; a query word in a group also matches the others at a
     discount. Keep it to words a visitor would actually use. */
  const SYNONYMS = [
    ["film", "movie", "cinema", "watch", "watched", "watchlist", "queue", "show", "entertainment", "tv"],
    ["climb", "climbing", "route", "crag", "send", "boulder", "bouldering", "sport", "trad", "rope", "pitch"],
    ["board", "kilter", "tension", "woodshed", "hangboard"],
    ["run", "running", "training", "workout", "strava", "marathon", "race", "mile"],
    ["weather", "forecast", "radar", "wx"],
    ["photo", "photograph", "picture", "camera", "captures"],
    ["game", "gaming", "arcade", "play", "playable"],
    ["space", "star", "universe", "physics", "relativity", "spacetime", "cosmos"],
    ["cs", "cs2", "counterstrike", "counter", "csgo", "match", "deathmatch"],
    ["valorant", "val", "riot"],
    ["mind", "psyche", "psychology", "mental", "mood", "bipolar", "brain"],
    ["orrin", "ai", "agent", "cognition"],
    ["map", "atlas", "pin", "places"],
    ["trial", "study", "studies", "clinical", "research"],
    ["drive", "highway", "interstate", "road", "car", "i40"],
    ["note", "transmission", "update", "news", "latest", "new"],
    ["home", "front", "door", "frontdoor"],
  ];
  const SYN = new Map();
  for (const group of SYNONYMS) {
    const stems = group.map(stem);
    for (const s of stems) SYN.set(s, [...new Set([...(SYN.get(s) || []), ...stems])].filter((x) => x !== s));
  }

  // Words with no meaning in a search — dropped unless they are all there is.
  const STOP = new Set("a an and are at be by for from how i in into is it its me my of on or the this to was what when where which who with ric rics".split(" "));

  /* A word that names a kind of thing narrows to that kind rather than being
     searched for: "denzel films", "red river routes". Only when there are
     other words — "films" alone still finds the Entertainment room. */
  const KIND_WORDS = {
    film: "film", movie: "film",
    route: "route", climb: "route", send: "route", boulder: "route",
    day: "day", trip: "day", outing: "day",
    match: "match",
    page: "page", project: "project", room: "room",
    note: "note", todo: "todo",
  };
  // Not "game": the arcade's games are projects, so "arcade games" must not
  // turn into a search of CS matches. Not "show" either — "show me" is not a
  // request for television.
  const KINDS = {
    room: { label: "room", prior: 1.7 },
    project: { label: "project", prior: 1.6 },
    page: { label: "page", prior: 1.4 },
    day: { label: "climbing day", prior: 0.95 },
    route: { label: "route", prior: 1.05 },
    todo: { label: "to-do", prior: 0.95 },
    board: { label: "board send", prior: 0.95 },
    film: { label: "film", prior: 1.0 },
    match: { label: "cs match", prior: 0.9 },
    note: { label: "note", prior: 0.9 },
    new: { label: "new", prior: 1.2 },
  };
  // ─── the index ────────────────────────────────────────
  // Field weights: what a word in that field is worth.
  // `tags` are words a doc should answer to that are never shown ("film" on
  // every film), so they never turn up in a result's excerpt.
  const W = { title: 10, keys: 7, tags: 5, sub: 4, body: 2, text: 1 };

  /* Docs in, index out. A doc is
       { kind, title, href, sub?, keys?, body?, text?, room?, date?, boost?, id? }
     where keys/body/text are strings (or arrays of them). Two docs with the
     same href are folded into one, the first keeping its title — so a room's
     own page, its "new" entry and its project card are one result, not three. */
  function build(docs) {
    const byHref = new Map(), list = [];
    for (const d of docs) {
      if (!d || !d.title) continue;
      const doc = { ...d, keys: flat(d.keys), tags: flat(d.tags), body: flat(d.body), text: flat(d.text) };
      const key = doc.href ? doc.href.replace(/^\.\//, "") : null;
      const prev = key && byHref.get(key);
      if (prev && !doc.keep) {
        // Fold the newcomer's words into the first doc, below its title.
        prev.keys = [prev.keys, doc.title, doc.keys].filter(Boolean).join(" ");
        prev.body = [prev.body, doc.sub, doc.body].filter(Boolean).join(" · ");
        prev.text = [prev.text, doc.text].filter(Boolean).join(" ");
        continue;
      }
      if (key) byHref.set(key, doc);
      list.push(doc);
    }
    const vocab = new Map(); // token -> Map(docIndex -> best field weight)
    list.forEach((doc, i) => {
      doc.i = i;
      doc.hay = fold([doc.title, doc.sub, doc.keys, doc.tags, doc.body, doc.text].filter(Boolean).join(" \u0001 "));
      for (const f of ["title", "keys", "tags", "sub", "body", "text"]) {
        for (const t of tokens(doc[f])) {
          let post = vocab.get(t);
          if (!post) vocab.set(t, (post = new Map()));
          if ((post.get(i) || 0) < W[f]) post.set(i, W[f]);
        }
      }
    });
    const words = [...vocab.keys()].map((t) => ({ t, s: stem(t) }));
    const byStem = new Map();
    for (const w of words) (byStem.get(w.s) || byStem.set(w.s, []).get(w.s)).push(w.t);
    return { docs: list, vocab, words, byStem };
  }
  const flat = (v) => Array.isArray(v) ? v.filter(Boolean).join(" · ") : (v || "");

  // ─── the query ────────────────────────────────────────
  /* "red river -bouldering in:climbing "fox fire" type:route" →
     { terms, phrases, not, room, kind } */
  function parse(q, opts) {
    const out = { terms: [], phrases: [], not: [], room: null, kind: null, kindSoft: null, raw: String(q || "") };
    let rest = fold(q).replace(/"([^"]+)"/g, (_, p) => { out.phrases.push(p.trim()); out.terms.push(...tokens(p)); return " "; });
    for (const part of rest.split(/\s+/).filter(Boolean)) {
      const f = part.match(/^(in|room|type|is|kind):(.+)$/);
      if (f) {
        if (f[1] === "in" || f[1] === "room") out.room = (opts && opts.roomAlias && opts.roomAlias(f[2])) || f[2].replace(/^\//, "");
        else out.kind = KIND_WORDS[stem(f[2])] || stem(f[2]);
        continue;
      }
      if (part.startsWith("-") && part.length > 1) { out.not.push(...tokens(part.slice(1))); continue; }
      out.terms.push(...tokens(part));
    }
    const meaningful = out.terms.filter((t) => !STOP.has(t));
    if (meaningful.length) out.terms = meaningful;
    // one letter of a word still being typed ("amarillo s") is not a word yet
    const words = out.terms.filter((t) => t.length > 1 || /d/.test(t));
    if (words.length) out.terms = words;
    if (!out.kind && out.terms.length > 1) {
      const i = out.terms.findIndex((t) => KIND_WORDS[stem(t)]);
      if (i >= 0) { out.kindSoft = KIND_WORDS[stem(out.terms[i])]; out.terms.splice(i, 1); }
    }
    return out;
  }

  /* Every vocabulary word one query word reaches, with how good a match it
     is. `last` is the final word of the query, which is allowed to be the
     start of a word — what you get while you are still typing it. */
  function reach(index, q, last) {
    const hits = new Map();
    const add = (t, quality) => { if ((hits.get(t) || 0) < quality) hits.set(t, quality); };
    const s = stem(q);
    if (index.vocab.has(q)) add(q, 1);
    for (const t of index.byStem.get(s) || []) add(t, 0.95);
    for (const syn of SYN.get(s) || []) for (const t of index.byStem.get(syn) || []) add(t, 0.4);
    /* A word typed in full that the site has is meant as that word. Being
       the start of a longer one, sitting inside one, or one letter off one
       then counts for much less: "obed" is the Obed before it is "Obediah",
       and "mood" is the mood model before it is "moon" or "food". */
    const whole = index.byStem.has(s);
    const maxD = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
    for (const { t } of index.words) {
      if (t === q) continue;
      if (q.length >= 2 && t.startsWith(q)) add(t, whole ? 0.3 : last ? 0.85 : 0.5);
      else if (q.length >= 4 && t.length > q.length && t.includes(q)) add(t, whole ? 0.15 : 0.42);
      else if (maxD && !/^\d/.test(q)) {
        const d = distance(q, t, maxD);
        if (d <= maxD) add(t, whole ? 0.12 : d === 1 ? 0.6 : 0.42);
        // a typo in the word still being typed: "climi" → "climbing"
        else if (last && !whole && q.length >= 4 && t.length > q.length && distance(q, t.slice(0, q.length), 1) <= 1) add(t, 0.45);
      }
    }
    return hits;
  }

  function search(index, query, opts) {
    opts = opts || {};
    const t0 = now();
    const q = parse(query, opts);
    const limit = opts.limit || 50;
    if (!q.terms.length && !q.phrases.length && !q.room && !q.kind) return { query: q, results: [], partial: false, ms: 0 };

    const N = index.docs.length;
    const reaches = q.terms.map((term, k) => reach(index, term, k === q.terms.length - 1));
    const perTerm = reaches.map((hits) => {
      const score = new Map();
      for (const [t, quality] of hits) {
        for (const [i, w] of index.vocab.get(t)) {
          const v = quality * w;
          if ((score.get(i) || 0) < v) score.set(i, v);
        }
      }
      return score;
    });

    // A rarer word says more: weight each term by how few docs it reaches.
    const weightOf = perTerm.map((m) => 1 + Math.log(1 + N / (1 + m.size)) / 4);
    const banned = new Set();
    for (const t of q.not) for (const [x] of reach(index, t, false)) for (const [i] of index.vocab.get(x)) banned.add(i);

    const roomOf = (d) => (d.room || "").replace(/^\//, "");
    const pass = (d) => !banned.has(d.i)
      && (!q.room || roomOf(d) === q.room || d.title === "/" + q.room)
      && (!q.kind || d.kind === q.kind)
      && q.phrases.every((p) => d.hay.includes(p));

    const scored = [];
    const consider = q.terms.length ? new Set(perTerm.flatMap((m) => [...m.keys()])) : index.docs.map((d) => d.i);
    const phrase = q.terms.join(" ");
    const lone = q.terms.length === 1 && !!KIND_WORDS[stem(q.terms[0])];
    for (const i of consider) {
      const d = index.docs[i];
      if (!pass(d)) continue;
      let sum = 0, hit = 0;
      perTerm.forEach((m, k) => { const v = m.get(i); if (v) { sum += v * weightOf[k]; hit++; } });
      if (q.terms.length && !hit) continue;
      const title = fold(d.title).replace(/^\//, "");
      let s = sum * (KINDS[d.kind] ? KINDS[d.kind].prior : 1) * (d.boost || 1);
      if (phrase && title === phrase) s *= 2.4;
      else if (phrase && title.startsWith(phrase)) s *= 1.7;
      else if (phrase.length > 3 && title.includes(phrase)) s *= 1.4;
      if (q.terms.length > 1 && phrase && d.hay.includes(phrase)) s *= 1.3;
      if (q.kindSoft && d.kind === q.kindSoft) s *= 2;
      // One word that names a kind of thing ("films", "routes") asks for the
      // place those things live before any one of them.
      if (lone && (d.kind === "room" || d.kind === "project" || d.kind === "page")) s *= 2.5;
      if (d.date) { const age = (Date.now() - Date.parse(d.date)) / 864e5; if (age >= 0) s *= 1 + 0.12 * Math.exp(-age / 120); }
      scored.push({ doc: d, score: s, hit });
    }
    const need = q.terms.length;
    let pool = scored.filter((r) => r.hit === need);
    // A kind word narrows outright when anything of that kind matched —
    // "denzel films" is films — and only leans when nothing did.
    if (q.kindSoft && pool.some((r) => r.doc.kind === q.kindSoft)) pool = pool.filter((r) => r.doc.kind === q.kindSoft);
    let partial = false;
    if (!pool.length && need > 1) {
      pool = scored.filter((r) => r.hit >= Math.ceil(need / 2));
      partial = pool.length > 0;
    }
    pool.sort((a, b) => b.score - a.score || (b.doc.date || "").localeCompare(a.doc.date || "") || a.doc.title.localeCompare(b.doc.title));
    const reached = new Set(reaches.flatMap((m) => [...m.keys()]));
    const results = pool.slice(0, limit).map((r) => ({ ...r, snippet: snippet(r.doc, reached) }));
    return { query: q, results, partial, total: pool.length, ms: now() - t0 };
  }
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  /* The words to light up in a result, and the line of text that best shows
     why it matched when the title alone does not. Marks are character ranges
     into the returned strings. */
  function snippet(doc, reached) {
    const marksIn = (s) => {
      const marks = [];
      const f = fold(s);
      // fold() can change length (& → and); fall back to no marks if it does
      if (f.length !== String(s).length) return marks;
      WORD.lastIndex = 0;
      let m;
      while ((m = WORD.exec(f))) if (reached.has(clean(m[0]))) marks.push([m.index, m.index + m[0].length]);
      return marks;
    };
    const titleMarks = marksIn(doc.title);
    let line = null, lineMarks = [], field = null;
    const covered = new Set(titleMarks.map(([a, b]) => clean(fold(doc.title).slice(a, b))));
    for (const f of ["sub", "keys", "body", "text"]) {
      const s = doc[f];
      if (!s) continue;
      const marks = marksIn(s);
      const fresh = marks.filter(([a, b]) => !covered.has(clean(fold(s).slice(a, b))));
      if (!fresh.length) continue;
      // a window of ~90 characters around the first new match
      const [a] = fresh[0];
      const from = Math.max(0, s.lastIndexOf(" ", Math.max(0, a - 30)) + 1);
      let to = Math.min(s.length, from + 90);
      if (to < s.length) { const sp = s.lastIndexOf(" ", to); if (sp > a) to = sp; }
      line = (from > 0 ? "…" : "") + s.slice(from, to) + (to < s.length ? "…" : "");
      const shift = (from > 0 ? 1 : 0) - from;
      lineMarks = marks.filter(([x, y]) => x >= from && y <= to).map(([x, y]) => [x + shift, y + shift]);
      field = f;
      break;
    }
    return { titleMarks, line, lineMarks, field };
  }

  /* When nothing matches: the closest real words, as a query to try. */
  function suggest(index, query) {
    const q = parse(query);
    let changed = false;
    const fixed = q.terms.map((term) => {
      if (index.vocab.has(term) || index.byStem.has(stem(term)) || term.length < 3) return term;
      let best = null;
      for (const { t } of index.words) {
        const d = distance(term, t, 2);
        if (d > 2) continue;
        const df = index.vocab.get(t).size;
        if (!best || d < best.d || (d === best.d && df > best.df)) best = { t, d, df };
      }
      if (best) { changed = true; return best.t; }
      return term;
    });
    return changed ? fixed.join(" ") : null;
  }

  // ─── the site's data, as docs ─────────────────────────
  // Each takes the global a data file defines and returns docs; each is
  // forgiving, because a data file that changes shape should cost its own
  // results, never the whole search.
  const pretty = (iso) => {
    const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
    return isNaN(d) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const from = {
    climbing(D) {
      const docs = [];
      const routes = new Map();
      for (const t of (D && D.trips) || []) {
        if (!t.date) continue;
        const rs = t.routes || [];
        docs.push({
          kind: "day", id: "day-" + t.date, date: t.date, room: "climbing",
          title: `${t.area || "A day out"} · ${pretty(t.date)}`,
          sub: rs.filter((r) => r.name && !r.unknown).map((r) => `${r.name} ${r.grade || ""}`.trim()).join(", "),
          tags: "climbing day out", keys: [(t.people || []).join(" "), [...new Set(rs.map((r) => r.wall).filter(Boolean))].join(" "), [...new Set(rs.map((r) => r.region).filter(Boolean))].join(" ")],
          body: t.note || "",
          href: `projects/climbing/index.html#trip-${t.date}`, keep: true,
        });
        for (const r of rs) {
          if (!r.name || r.unknown) continue;
          const key = fold(r.name).replace(/[^a-z0-9]+/g, "");
          const e = routes.get(key) || { name: r.name, grade: r.grade, wall: r.wall, area: r.area || t.area, region: r.region, days: [], sends: 0, n: 0 };
          e.days.push(t.date); e.n += r.repeats || 1;
          if (r.outcome === "sent") e.sends++;
          routes.set(key, e);
        }
      }
      for (const e of routes.values()) {
        const last = e.days.sort().slice(-1)[0];
        docs.push({
          kind: "route", id: "route-" + e.name, date: last, room: "climbing",
          title: e.name,
          sub: [e.grade, e.wall, e.area].filter(Boolean).join(" · "),
          tags: "climbing route", keys: [e.region, e.sends ? "sent" : "project"].filter(Boolean),
          body: `${e.n}× over ${e.days.length} day${e.days.length === 1 ? "" : "s"}${e.sends ? "" : ", not sent yet"}`,
          href: `projects/climbing/index.html#trip-${last}`, keep: true,
        });
      }
      for (const r of (D && D.todo) || []) {
        if (!r.name) continue;
        docs.push({
          kind: "todo", id: "todo-" + r.name, room: "climbing",
          title: r.name,
          sub: [r.grade, r.style, r.location].filter(Boolean).join(" · "),
          tags: "climbing to-do", keys: [r.done ? "ticked" : "open"],
          body: r.note || "",
          href: "projects/climbing/list.html", keep: true,
        });
      }
      return docs;
    },
    boards(D) {
      const docs = [];
      for (const [board, B] of Object.entries((D && D.boards) || {})) {
        // One result per problem, however many nights it was climbed.
        const byName = new Map();
        for (const e of (B && B.entries) || []) {
          if (!e.name) continue;
          const k = e.uuid || e.name;
          const prev = byName.get(k);
          if (!prev || (e.date || "") > (prev.e.date || "")) byName.set(k, { e, n: (prev ? prev.n : 0) + 1, sent: (prev && prev.sent) || !!e.ascent });
          else { prev.n++; prev.sent = prev.sent || !!e.ascent; }
        }
        const name = board[0].toUpperCase() + board.slice(1);
        for (const { e, n, sent } of byName.values()) {
          docs.push({
            kind: "board", id: `${board}-${e.uuid || e.name}`, date: e.date, room: "climbing",
            title: e.name,
            sub: [name, e.grade, e.angle != null ? `${e.angle}°` : "", e.date ? pretty(e.date) : "", n > 1 ? `${n} sessions` : ""].filter(Boolean).join(" · "),
            tags: "climbing board", keys: [board, e.benchmark ? "benchmark" : "", sent ? "sent" : "project"],
            body: e.comment || "",
            href: `projects/climbing/board.html#${board}`, keep: true,
          });
        }
      }
      return docs;
    },
    films(D) {
      const rows = Array.isArray(D) ? D : (D && (D.rows || D.titles)) || [];
      return rows.filter((r) => r && r.title && !r.removed).map((r) => ({
        kind: "film", id: "film-" + (r.id || r.title), room: "entertainment",
        title: r.title,
        sub: [r.year, r.director, r.status === "watchlist" ? "on the watchlist" : "watched"].filter(Boolean).join(" · "),
        tags: "film movie", keys: [(r.genres || []).join(" "), r.status === "watchlist" ? "queue watchlist" : "watched", (r.cast || []).slice(0, 8).join(" · ")],
        text: r.overview || "",
        href: `entertainment-library.html#q=${encodeURIComponent(r.title)}`, keep: true,
      }));
    },
    cs(D) {
      const map = (m) => String(m || "").replace(/^(de|cs|ar)_/, "").replace(/(^|_)(\w)/g, (_, s, c) => (s ? " " : "") + c.toUpperCase());
      return ((D && D.matches) || []).filter((m) => m && m.id).map((m) => {
        const me = m.me || {};
        const date = (m.at || "").slice(0, 10);
        const score = Array.isArray(m.score) ? m.score.join("–") : "";
        return {
          kind: "match", id: "cs-" + m.id, date, room: "cs",
          title: `${map(m.map)} ${score}${m.result ? ` (${m.result === "W" ? "win" : m.result === "L" ? "loss" : "draw"})` : ""}`,
          sub: [date ? pretty(date) : "", me.k != null ? `${me.k}–${me.d}–${me.a}` : "", me.adr != null ? `${me.adr} ADR` : ""].filter(Boolean).join(" · "),
          tags: "match counter-strike cs2", keys: [m.map, String(m.mode || "").replace(/_/g, " ")],
          href: `cs.html#match-${encodeURIComponent(m.id)}`, keep: true,
        };
      });
    },
    latest(list) {
      return (list || []).filter((x) => x && x.title && x.href).map((x) => ({
        kind: "new", title: x.title, sub: x.kind, body: x.description, date: x.date, room: x.room, href: x.href,
      }));
    },
    notes(list) {
      return (list || []).filter((n) => n && n.text).map((n, i) => {
        const text = String(n.text);
        const first = text.split(/(?<=[.!?])\s/)[0];
        return {
          kind: "note", id: "note-" + i, date: n.date, title: first.length > 70 ? first.slice(0, 68).replace(/\s+\S*$/, "") + "…" : first,
          sub: n.date ? pretty(n.date) : "", body: text, href: null, note: n,
        };
      });
    },
  };

  return { build, search, suggest, parse, tokens, stem, distance, fold, from, KINDS };
});
