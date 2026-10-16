/* Admin — Analytics. Everything the visitor counter knows, on one tab.
 *
 * The numbers come from the Worker's /stats (worker/visitors.mjs) with
 * `full=1`, and one visitor's history from /stats/visitor. The Worker lets
 * this page in on the signed-in site account: it sends the Supabase access
 * token as `x-admin-session`, and the Worker asks Supabase is_site_admin()
 * with it — the same question admin.js asks. Until the Worker carries that
 * (SITE_SUPABASE_URL in wrangler.jsonc), the site password still works, and is
 * kept under the same `ownerToken` key as assets/owner.js so signing in on the
 * training page signs in here too.
 *
 * Every string here came from a stranger's browser or from Cloudflare — paths,
 * referrers, campaign tags, city names — so all of it goes through esc().
 * Drawing is pure (window.AdminAnalytics.draw*), and admin/test runs it
 * against hostile input. */
(() => {
  'use strict';

  const HOST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? location.origin
    : 'https://training-log.rmbuster82.workers.dev';
  const ID = /^[a-z0-9-]{8,40}$/;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%';
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} },
  };

  function dur(s) {
    s = Math.round(Number(s) || 0);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
    return Math.floor(s / 3600) + 'h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + 'm';
  }
  const when = (t) => {
    if (!t) return '—';
    const d = new Date(t), now = new Date();
    const hm = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Today ' + hm;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ', ' + hm;
  };
  const who = (id) => 'Visitor ' + String(id || '').slice(0, 6);
  const pathName = (p) => (p === '/' ? '/ (terminal)' : String(p || '').startsWith('/404/') ? '404 ' + String(p).slice(4) : p);

  // ── names for things ──────────────────────────────────────────────────────
  const REFS = [
    [/(^|\.)google\./, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/duckduckgo\.com$/, 'DuckDuckGo'],
    [/(^|\.)yahoo\./, 'Yahoo'], [/(^|\.)reddit\.com$/, 'Reddit'], [/(^|\.)facebook\.com$|^fb\.me$|^l\.facebook\.com$/, 'Facebook'],
    [/(^|\.)instagram\.com$/, 'Instagram'], [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, 'X'],
    [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'], [/(^|\.)github\.com$/, 'GitHub'],
    [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'], [/(^|\.)discord(app)?\.com$/, 'Discord'],
    [/chatgpt\.com$|openai\.com$/, 'ChatGPT'], [/claude\.ai$/, 'Claude'], [/(^|\.)strava\.com$/, 'Strava'],
    [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)snapchat\.com$/, 'Snapchat'], [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  ];
  const refName = (h) => { if (!h) return 'Direct'; for (const [re, n] of REFS) if (re.test(h)) return n; return h; };
  // [name, count, hosts] — the hosts are what a click on "Google" filters to.
  const groupRefs = (list) => {
    const m = new Map();
    for (const [h, n] of list || []) {
      const k = refName(h), g = m.get(k) || [k, 0, []];
      g[1] += n; g[2].push(h || ''); m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b[1] - a[1]);
  };
  let regions = null;
  try { regions = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (_) {}
  let langs = null;
  try { langs = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (_) {}
  const flag = (c) => (/^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map((x) => 0x1f1a5 + x.charCodeAt(0))) : '');
  const countryName = (c) => (!c ? 'Unknown' : (regions && (() => { try { return regions.of(c); } catch (_) { return c; } })()) || c);
  const langName = (l) => { if (!l) return 'Unknown'; try { return (langs && langs.of(l)) || l; } catch (_) { return l; } };
  const place = (o) => {
    if (!o || !o.country) return 'Unknown place';
    return flag(o.country) + ' ' + [o.city, o.region, countryName(o.country)].filter(Boolean).join(', ');
  };
  const SCREENS = { S: 'Phone width (<600px)', M: 'Tablet width (600–1023)', L: 'Laptop width (1024–1439)', XL: 'Wide screen (1440+)' };
  const LENGTHS = ['Under 10s', '10–30s', '30s–2m', '2–5m', '5–15m', '15m+'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourName = (h) => (h % 12 || 12) + (h < 12 ? 'am' : 'pm');

  // ── drawing (pure) ────────────────────────────────────────────────────────
  // A table whose first column carries a bar: the row's share of the biggest.
  // `pick` turns a row's label into a button that filters the whole tab to it:
  // (key, row) => [field, value, words] or null.
  const pickBtn = (f, html) => (f
    ? `<button type="button" class="an-pick" data-f="${esc(f[0])}" data-fv="${esc(f[1])}" data-fl="${esc(f[2])}" title="${esc('Show only visits that ' + f[2])}">${html}</button>`
    : html);
  function bars(rows, { label = esc, head = null, cols = [], empty = 'Nothing yet.', share = false, pick = null } = {}) {
    if (!rows || !rows.length) return `<p class="an-empty">${esc(empty)}</p>`;
    const max = Math.max(...rows.map((r) => r[1]), 1);
    const sum = rows.reduce((a, r) => a + r[1], 0) || 1;
    return '<table class="an-t">' +
      (head ? '<thead><tr>' + head.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('') + '</tr></thead>' : '') +
      '<tbody>' + rows.map((r) =>
        `<tr><td class="k"><i class="fill" style="width:${((r[1] / max) * 100).toFixed(1)}%"></i><span>${pickBtn(pick && pick(r[0], r), label(r[0], r))}</span></td>` +
        cols.map((c) => `<td class="n">${c(r)}</td>`).join('') +
        `<td class="n">${share ? pct(r[1], sum) : fmt(r[1])}</td></tr>`).join('') +
      '</tbody></table>';
  }

  const PERIOD = { today: 'yesterday at this time', '7d': 'the 7 days before', '30d': 'the 30 days before', '90d': 'the 90 days before' };

  // Change against the same stretch one period back. Arrow and words, not
  // colour alone; `worse` flips which way is good (bounce rate).
  function delta(cur, prev, range, { worse = false, ratio = false } = {}) {
    if (prev == null || !PERIOD[range]) return '';
    const vs = PERIOD[range];
    if (!prev && !cur) return `<small class="an-delta">— none in ${esc(vs)} either</small>`;
    if (!prev) return `<small class="an-delta up">▲ from none, ${esc(vs)}</small>`;
    const ch = ratio ? Math.round((cur - prev) * 100) : Math.round(((cur - prev) / prev) * 100);
    if (!ch) return `<small class="an-delta">= same as ${esc(vs)}</small>`;
    const good = (ch > 0) !== worse;
    return `<small class="an-delta ${good ? 'up' : 'down'}">${ch > 0 ? '▲' : '▼'} ${Math.abs(ch)}${ratio ? ' pts' : '%'} vs ${esc(vs)}</small>`;
  }

  function kpis(d) {
    const t = d.total, m = d.more || {}, e = m.engagement || {}, p = m.prev, r = d.range;
    const ret = Math.max(0, t.visitors - t.newVisitors);
    const card = (n, l, sub = '', dl = '', id = '') => `<div class="stat an-kpi"${id ? ` id="${id}"` : ''}><b>${n}</b><span>${esc(l)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}${dl}</div>`;
    const br = (x) => (x && x.sessions ? x.bounces / x.sessions : 0);
    return '<div class="stats an-kpis">' + [
      card(fmt(t.visitors), 'Unique visitors', `${fmt(t.newVisitors)} new · ${fmt(ret)} returning`, delta(t.visitors, p && p.visitors, r)),
      card(fmt(t.sessions), 'Visits', r === 'today' ? '' : `${fmt(d.today.sessions)} today`, delta(t.sessions, p && p.sessions, r)),
      card(fmt(t.views), 'Page views', r === 'today' ? '' : `${fmt(d.today.views)} today`, delta(t.views, p && p.views, r)),
      card(fmt(d.live.count), 'Online now', d.live.count ? 'in the last 5 minutes' : 'nobody right now', '', 'an-live-kpi'),
      card(e.sessions ? (e.pagesPerSession || 0).toFixed(1) : '0', 'Pages per visit', '', delta(e.pagesPerSession || 0, p && p.pagesPerSession, r)),
      card(pct(e.bounces || 0, e.sessions || 0), 'Bounce rate', 'left after one page', p ? delta(br(e), br(p), r, { worse: true, ratio: true }) : ''),
      card(dur(e.sessionSeconds), 'Avg. time on site', 'per visit, tab in front', delta(e.sessionSeconds || 0, p && p.sessionSeconds, r)),
      card(dur(e.pageSeconds), 'Avg. time on a page', e.scroll ? `scrolled ${Math.round(e.scroll)}% down on average` : '', delta(e.pageSeconds || 0, p && p.pageSeconds, r)),
    ].join('') + '</div>';
  }

  // Every bucket in the range drawn, the empty ones too, so a quiet week reads
  // as a gap and not as nothing. Views are the bar; visitors the darker core.
  function chart(d) {
    const byB = new Map((d.series || []).map((r) => [r[0], r]));
    const off = d.tz * 60000;
    const first = Math.floor(((d.range === 'all' ? (d.since || d.now) : d.from) + off) / d.bucket);
    const last = Math.floor((d.now + off) / d.bucket);
    let cols = [];
    for (let b = first; b <= last; b++) {
      const r = byB.get(b) || [b, 0, 0, 0];
      cols.push({ at: b * d.bucket, visitors: r[1], sessions: r[2], views: r[3] });
    }
    let weekly = false;
    if (cols.length > 120) {
      weekly = true;
      const w = [];
      for (let i = 0; i < cols.length; i += 7) {
        const g = cols.slice(i, i + 7);
        w.push({ at: g[0].at, visitors: g.reduce((a, c) => a + c.visitors, 0), sessions: g.reduce((a, c) => a + c.sessions, 0), views: g.reduce((a, c) => a + c.views, 0) });
      }
      cols = w;
    }
    const hourly = d.bucket < 86400000;
    const label = (c) => (weekly ? 'Week of ' : '') + new Date(c.at).toLocaleString('en-US', hourly ? { hour: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const max = Math.max(...cols.map((c) => c.views), 1);
    const tip = (c) => `${label(c)}: ${fmt(c.visitors)} ${weekly ? 'daily visitors summed' : 'visitors'}, ${fmt(c.sessions)} visits, ${fmt(c.views)} views`;
    return {
      title: hourly ? 'Traffic by hour' : weekly ? 'Traffic by week' : 'Traffic by day',
      cols, tip,
      html: `<div class="an-chart" role="img" aria-label="${esc(`${cols.length} bars of page views and visitors`)}">` + cols.map((c, i) =>
        `<div class="an-col" tabindex="0" data-i="${i}" title="${esc(tip(c))}"><i class="v" style="height:${(c.views / max) * 100}%"></i><i class="u" style="height:${(c.visitors / max) * 100}%"></i></div>`).join('') + '</div>' +
        (cols.length ? `<div class="an-axis"><span>${esc(label(cols[0]))}</span><span>${esc(hourly ? 'now' : label(cols[cols.length - 1]))}</span></div>` : ''),
    };
  }

  // Weekday × hour in Ric's time zone. One hue, light to dark.
  function heat(list) {
    const g = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const [dd, h, n] of list || []) if (g[dd] && h >= 0 && h < 24) g[dd][h] = n;
    const max = Math.max(1, ...g.flat());
    const order = [1, 2, 3, 4, 5, 6, 0];
    return '<div class="an-heat" role="table" aria-label="Page views by weekday and hour">' +
      '<span></span>' + Array.from({ length: 24 }, (_, h) => `<span class="hh">${h % 6 ? '' : esc(hourName(h))}</span>`).join('') +
      order.map((dd) => `<span class="dd">${DAYS[dd]}</span>` + g[dd].map((n, h) =>
        `<i style="--a:${n ? (0.12 + 0.88 * (n / max)).toFixed(2) : 0}" title="${esc(`${DAYS[dd]} ${hourName(h)}: ${fmt(n)} views`)}"></i>`).join('')).join('') +
      '</div>';
  }

  const SORTS = {
    views: (p) => p.views, visitors: (p) => p.visitors, dur: (p) => p.dur, depth: (p) => p.depth,
    entries: (p) => p.entries, exits: (p) => p.exits, bounce: (p) => (p.entries ? p.bounces / p.entries : 0),
  };
  function pagesTable(pages, sort, prev = null) {
    if (!pages || !pages.length) return '<p class="an-empty">Nothing yet.</p>';
    const before = prev ? new Map(prev.pages || []) : null;
    const change = (p) => {
      const b = before.get(p.path) || 0, c = p.views - b;
      return c ? `<span class="an-d ${c > 0 ? 'up' : 'down'}">${c > 0 ? '▲' : '▼'}${fmt(Math.abs(c))}</span>` : '<span class="an-d">=</span>';
    };
    const by = SORTS[sort] || SORTS.views;
    const rows = pages.slice().sort((a, b) => by(b) - by(a));
    const max = Math.max(...rows.map((p) => p.views), 1);
    const th = (k, l) => `<th class="n"><button type="button" class="an-sort" data-sort="${k}" aria-pressed="${sort === k}">${esc(l)}</button></th>`;
    return '<div class="an-scroll"><table class="an-t an-pages"><thead><tr><th>Page</th>' +
      th('views', 'Views') + th('visitors', 'Visitors') + th('dur', 'Avg. time') + th('depth', 'Scroll') +
      th('entries', 'Entries') + th('exits', 'Exits') + th('bounce', 'Bounce') + (before ? '<th class="n">vs before</th>' : '') + '</tr></thead><tbody>' +
      rows.map((p) => `<tr><td class="k"><i class="fill" style="width:${((p.views / max) * 100).toFixed(1)}%"></i><span>${pickBtn(['path', p.path, 'saw ' + pathName(p.path)], esc(pathName(p.path)))}</span></td>` +
        `<td class="n">${fmt(p.views)}</td><td class="n">${fmt(p.visitors)}</td><td class="n">${p.dur ? dur(p.dur) : '—'}</td>` +
        `<td class="n">${p.depth ? Math.round(p.depth) + '%' : '—'}</td><td class="n">${fmt(p.entries)}</td><td class="n">${fmt(p.exits)}</td>` +
        `<td class="n">${p.entries ? pct(p.bounces, p.entries) : '—'}</td>${before ? `<td class="n">${change(p)}</td>` : ''}</tr>`).join('') +
      '</tbody></table></div>';
  }

  const trail = (pages, cap = 6) => {
    const list = (pages || []).map((p) => `<span class="an-step">${esc(pathName(p[0]))}</span>`);
    return list.slice(0, cap).join('<span class="an-arrow" aria-hidden="true">→</span>') +
      (list.length > cap ? `<span class="an-more">+${list.length - cap}</span>` : '');
  };
  const source = (s) => (s.src ? `${s.src}${s.camp ? ' / ' + s.camp : ''}` : refName(s.ref));
  const device = (o) => [o.device, o.browser, o.os].filter(Boolean).join(' · ');

  function sessionsList(list) {
    if (!list || !list.length) return '<p class="an-empty">No visits in this range.</p>';
    return '<ul class="list an-sessions">' + list.map((s) =>
      `<li class="row"><button type="button" class="an-session" data-visitor="${esc(s.visitor)}">` +
      `<span class="an-when"><b>${esc(when(s.start))}</b><span>${esc(who(s.visitor))}${s.returning ? ' · <em>returning</em>' : ' · new'}</span></span>` +
      `<span class="an-trail">${trail(s.pages)}</span>` +
      `<span class="an-meta"><span>${esc(place(s))}</span><span>${esc(device(s))}</span>` +
      `<span>from ${esc(source(s))} · ${fmt(s.views)} ${s.views === 1 ? 'page' : 'pages'} · ${esc(dur(s.dur))}</span></span>` +
      '</button></li>').join('') + '</ul>';
  }

  function regularsTable(list) {
    if (!list || !list.length) return '<p class="an-empty">Nobody yet.</p>';
    return '<div class="an-scroll"><table class="an-t"><thead><tr><th>Visitor</th><th>Where</th><th>Device</th>' +
      '<th class="n">Visits</th><th class="n">Views</th><th class="n">Time</th><th class="n">First seen</th><th class="n">Last seen</th></tr></thead><tbody>' +
      list.map((v) => `<tr><td><button type="button" class="link an-who" data-visitor="${esc(v.visitor)}">${esc(who(v.visitor))}</button></td>` +
        `<td>${esc(place(v))}</td><td>${esc(device(v))}</td><td class="n">${fmt(v.sessions)}</td><td class="n">${fmt(v.views)}</td>` +
        `<td class="n">${esc(dur(v.dur))}</td><td class="n">${esc(when(v.first))}</td><td class="n">${esc(when(v.last))}</td></tr>`).join('') +
      '</tbody></table></div>';
  }

  // A panel. `id` is what the jump bar scrolls to; `csv` adds an export button.
  const panel = (title, body, cls = '', id = '', csv = '') => `<section class="an-panel ${cls}"${id ? ` id="${id}"` : ''}>` +
    `<div class="an-head"><h3>${esc(title)}</h3>${csv ? `<button type="button" class="link an-csv" data-csv="${csv}">Download CSV</button>` : ''}</div>${body}</section>`;

  // How a filter reads in words, for its chip.
  function filterWords(f, v, label) {
    if (label) return label;
    switch (f) {
      case 'path': return 'saw ' + pathName(v);
      case 'ref': return 'came from ' + (v.split(',').map(refName)[0] || 'Direct');
      case 'country': return 'are from ' + countryName(v);
      case 'region': case 'city': return 'are from ' + (v || 'an unknown place');
      case 'device': return 'are on ' + (v || 'an unknown device');
      case 'browser': case 'os': return 'use ' + (v || 'something unknown');
      case 'lang': return 'read in ' + langName(v);
      case 'screen': return 'have a ' + (SCREENS[v] || 'unknown').toLowerCase();
      case 'src': return 'came in on the tag "' + v + '"';
      default: return f + ' = ' + v;
    }
  }

  function chips(filters, labels = {}) {
    const keys = Object.keys(filters || {});
    if (!keys.length) return '';
    return '<div class="an-chips" role="group" aria-label="Filters"><span>Only visits that</span>' +
      keys.map((k) => `<button type="button" class="an-chip" data-unfilter="${esc(k)}" aria-label="${esc('Remove filter: ' + filterWords(k, filters[k], labels[k]))}">` +
        `${esc(filterWords(k, filters[k], labels[k]))} <span aria-hidden="true">×</span></button>`).join('<span>and</span>') +
      '<button type="button" class="link" data-unfilter="*">Clear</button></div>';
  }

  function sinceStrip(si) {
    if (!si) return '';
    const at = when(si.at);
    if (!si.views) return `<p class="an-since">Nothing new since you last looked (${esc(at)}).</p>`;
    const top = (si.pages || []).map((p) => pathName(p[0])).join(', ');
    return `<p class="an-since"><b>Since you last looked</b> (${esc(at)}): ${fmt(si.sessions)} ${si.sessions === 1 ? 'visit' : 'visits'} from ` +
      `${fmt(si.visitors)} ${si.visitors === 1 ? 'person' : 'people'}, ${fmt(si.newVisitors)} new` + (top ? ` · mostly ${esc(top)}` : '') + '.</p>';
  }

  const JUMPS = [['an-top', 'Overview'], ['an-visits', 'Visits'], ['an-pages', 'Pages'], ['an-sources', 'Sources'], ['an-audience', 'Audience'], ['an-habits', 'Habits'], ['an-people', 'People']];

  function livePanel(live) {
    return live.pages.length ? bars(live.pages, { label: (p) => esc(pathName(p)), head: ['Page', 'People'] }) : '<p class="an-empty">Nobody right now.</p>';
  }

  function drawAll(d, { sort = 'views', range = '30d', ignoring = false, stamp = '', all = false, labels = {} } = {}) {
    const m = d.more || {};
    const c = chart(d);
    const missing = (d.pages || []).filter((p) => String(p[0]).startsWith('/404/')).map((p) => [String(p[0]).slice(4), p[1]]);
    const loyalty = (m.loyalty || []).reduce((acc, [k, n]) => {
      const b = k <= 1 ? '1 visit' : k === 2 ? '2 visits' : k <= 5 ? '3–5 visits' : k <= 10 ? '6–10 visits' : '11+ visits';
      acc.set(b, (acc.get(b) || 0) + n); return acc;
    }, new Map());
    const loyaltyOrder = ['1 visit', '2 visits', '3–5 visits', '6–10 visits', '11+ visits'].filter((k) => loyalty.has(k)).map((k) => [k, loyalty.get(k)]);
    const rm = new Map();
    for (const [co, rg, , n] of m.places || []) { const k = co + '|' + rg; rm.set(k, (rm.get(k) || 0) + n); }
    const regionsList = [...rm].sort((a, b) => b[1] - a[1]);
    const by = (f, words) => (k) => [f, k == null ? '' : String(k), words(k)];
    const shown = all ? m.sessions : (m.sessions || []).slice(0, 15);

    return `<nav class="an-jump" aria-label="Sections">${JUMPS.map(([id, l]) => `<button type="button" data-jump="${id}">${l}</button>`).join('')}</nav>
      <div class="an-bar" id="an-top">
        <div class="an-ranges" role="group" aria-label="Range">${[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['all', 'All time']]
          .map(([k, l]) => `<button type="button" class="an-range" data-range="${k}" aria-pressed="${range === k}">${l}</button>`).join('')}</div>
        <span class="an-stamp" id="an-stamp">${esc(stamp)}</span>
        <button type="button" class="btn" id="an-ignore" aria-pressed="${ignoring}">${ignoring ? 'This device is ignored' : 'Ignore this device'}</button>
        <button type="button" class="btn" id="an-refresh">Refresh</button>
      </div>` +
      chips(m.filters, labels) +
      sinceStrip(m.since) +
      kpis(d) +
      `<section class="an-panel"><div class="an-head"><h3>${esc(c.title)}</h3>
         <span class="an-legend"><span><i class="v"></i>Page views</span><span><i class="u"></i>Visitors</span></span></div>
         <p class="an-readout" id="an-readout" aria-live="polite">Hover or focus a bar for its numbers.</p>${c.html}</section>` +
      panel('Recent visits', sessionsList(shown) +
        ((m.sessions || []).length > 15 && !all ? `<button type="button" class="btn an-all" id="an-all">Show all ${fmt(m.sessions.length)}</button>` : ''), '', 'an-visits', 'sessions') +
      '<div class="an-grid">' +
      panel('Pages', pagesTable(m.pages, sort, m.prev) + '<p class="an-note">Click a page to see only the visits that saw it.</p>', 'wide', 'an-pages', 'pages') +
      panel('Where they went next', bars((m.flows || []).slice(0, 12).map((f) => [f, f[2]]),
        { label: (f) => `${esc(pathName(f[0]))} <span class="an-arrow">→</span> ${esc(pathName(f[1]))}`, head: ['From → to', 'Times'], empty: 'No one has gone page to page yet.' })) +
      panel('Landing pages', bars((d.entries || []).filter((p) => !String(p[0]).startsWith('/404/')),
        { label: (p) => esc(pathName(p)), head: ['First page of a visit', 'Visits'], pick: by('path', (p) => 'saw ' + pathName(p)) })) +
      panel('Where they came from', bars(groupRefs(d.referrers), { head: ['Source', 'Share'], share: true, pick: (k, r) => ['ref', r[2].join(','), 'came from ' + k] }), '', 'an-sources') +
      panel('Shared links (utm / ?ref=)', bars((m.campaigns || []).map((x) => [x, x[2]]),
        { label: (x) => esc(x[0] + (x[1] ? ' / ' + x[1] : '')), head: ['Tag', 'Visits'], pick: (x) => ['src', x[0], 'came in on the tag "' + x[0] + '"'],
          empty: 'Add ?ref=something to a link you share and it shows here.' })) +
      panel('Links clicked out', bars(m.outbound, { head: ['Site', 'Visitors', 'Clicks'], cols: [(r) => fmt(r[2])], empty: 'No one has clicked out yet.' })) +
      panel('Broken links people hit (404)', bars(missing, { head: ['Missing page', 'Views'], empty: 'None.' })) +
      panel('Countries', bars(d.countries, { label: (c2) => esc(flag(c2) + ' ' + countryName(c2)), head: ['Country', 'Visitors'], pick: by('country', (k) => 'are from ' + countryName(k)) }), '', 'an-audience') +
      panel('States & regions', bars(regionsList, { label: (k) => { const [co, rg] = String(k).split('|'); return esc(flag(co) + ' ' + (rg || 'Unknown') + ', ' + countryName(co)); },
        head: ['Region', 'Visitors'], pick: (k) => { const rg = String(k).split('|')[1] || ''; return ['region', rg, 'are from ' + (rg || 'an unknown region')]; } })) +
      panel('Cities', bars((m.places || []).map((x) => [x, x[3]]), { label: (x) => esc(place({ country: x[0], region: x[1], city: x[2] })), head: ['City', 'Visitors'],
        pick: (x) => ['city', x[2] || '', 'are from ' + (x[2] || 'an unknown city')] })) +
      panel('Devices', bars(d.devices, { head: ['Device', 'Share'], share: true, pick: by('device', (k) => 'are on ' + (k || 'an unknown device')) }) +
        bars(m.screens || [], { label: (k) => esc(SCREENS[k] || 'Unknown'), head: ['Screen', 'Share'], share: true, pick: by('screen', (k) => 'have a ' + (SCREENS[k] || 'unknown').toLowerCase()) })) +
      panel('Browsers & systems', bars(d.browsers, { head: ['Browser', 'Share'], share: true, pick: by('browser', (k) => 'use ' + k) }) +
        bars(d.os, { head: ['System', 'Share'], share: true, pick: by('os', (k) => 'use ' + k) })) +
      panel('Languages', bars(m.languages || [], { label: (k) => esc(langName(k)), head: ['Language', 'Visitors'], pick: by('lang', (k) => 'read in ' + langName(k)) })) +
      panel('Online now', `<div id="an-live-panel">${livePanel(d.live)}</div>`) +
      panel('When they come', heat(m.heat) + '<p class="an-note">Page views by weekday and hour, in this browser\'s time zone.</p>', '', 'an-habits') +
      panel('How often they come back', bars(loyaltyOrder, { head: ['Visits in range', 'Visitors'] })) +
      panel('How long a visit lasts', bars((m.lengths || []).map(([k, n]) => [LENGTHS[k] || '?', n]), { head: ['Time on site', 'Visits'] })) +
      panel('Regulars', regularsTable(m.regulars), 'wide', 'an-people', 'regulars') +
      '</div>';
  }

  function drawVisitor(v) {
    const last = (v.history || [])[0] || {};
    const facts = [
      ['First seen', when(v.first)], ['Last seen', when(v.last)], ['Visits', fmt(v.sessions)], ['Page views', fmt(v.views)],
      ['Time on site', dur(v.dur)], ['Last place', place(last)], ['Device', device(last) || '—'],
      ['Language', langName(last.lang)], ['Screen', SCREENS[last.screen] || '—'],
    ];
    return `<dl class="facts">${facts.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>` +
      `<h4>Most viewed</h4>${bars(v.pages, { label: (p) => esc(pathName(p)) })}` +
      `<h4>Every visit</h4><ol class="an-history">${(v.history || []).map((s) =>
        `<li><div class="an-hhead"><b>${esc(when(s.start))}</b><span>${esc(place(s))} · ${esc(device(s))} · from ${esc(source(s))} · ${esc(dur(s.dur))}</span></div>` +
        `<ol class="an-steps">${(s.pages || []).map((p) => `<li><span>${esc(pathName(p[0]))}</span><span class="an-dim">${p[1] ? esc(dur(p[1])) : ''}${p[2] ? ' · ' + esc(p[2]) + '% down' : ''}</span></li>`).join('')}</ol>` +
        (s.outs && s.outs.length ? `<p class="an-note">Clicked out to ${s.outs.map(esc).join(', ')}</p>` : '') +
        '</li>').join('')}</ol>`;
  }

  // ── CSV ────────────────────────────────────────────────────────────────────
  // A cell a spreadsheet would run as a formula (=, +, @) is opened with ' so
  // it stays text — paths and place names arrive from strangers.
  const cell = (v) => {
    v = v == null ? '' : String(v);
    if (/^[=+@\t]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const iso = (t) => (t ? new Date(t).toISOString() : '');
  function toCsv(kind, d) {
    const m = (d && d.more) || {};
    const T = {
      pages: [['page', 'views', 'visitors', 'avg_seconds', 'avg_scroll_pct', 'entries', 'exits', 'bounces'],
        (m.pages || []).map((p) => [p.path, p.views, p.visitors, p.dur, p.depth, p.entries, p.exits, p.bounces])],
      sessions: [['started', 'visitor', 'returning', 'pages', 'seconds', 'source', 'tag', 'country', 'region', 'city', 'device', 'browser', 'os', 'language', 'path'],
        (m.sessions || []).map((x) => [iso(x.start), x.visitor, x.returning ? 'yes' : 'no', x.views, x.dur, x.ref, x.src, x.country, x.region, x.city,
          x.device, x.browser, x.os, x.lang, (x.pages || []).map((p) => p[0]).join(' > ')])],
      regulars: [['visitor', 'visits', 'views', 'seconds', 'first_seen', 'last_seen', 'country', 'region', 'city', 'device', 'browser', 'os'],
        (m.regulars || []).map((v) => [v.visitor, v.sessions, v.views, v.dur, iso(v.first), iso(v.last), v.country, v.region, v.city, v.device, v.browser, v.os])],
    }[kind];
    if (!T) return '';
    return [T[0], ...T[1]].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  // ── wiring ────────────────────────────────────────────────────────────────
  // Refresh: the full report on opening, on any change, by the button, and
  // every FULL_EVERY while the page is in front; in between only who is
  // online (/stats/live, one tiny table). Nothing at all while it is hidden.
  // The full report reads every row in the range about forty times, and D1
  // bills rows read — this is what keeps a tab left open all day cheap.
  const LIVE_EVERY = 60 * 1000, FULL_EVERY = 5 * 60 * 1000;
  const FILTER_KEYS = ['path', 'ref', 'src', 'country', 'region', 'city', 'device', 'browser', 'os', 'lang', 'screen'];
  const RANGES = new Set(['today', '7d', '30d', '90d', 'all']);
  const S = {
    root: null, token: null, data: null, range: '30d', sort: 'views', timer: 0, on: false, visitor: null,
    state: 'loading', msg: '', info: '', all: false, filters: {}, labels: {}, lastFull: 0, sig: '',
    seen: Number(store.get('admin:seen')) || 0, seenSaved: false,
  };
  S.range = RANGES.has(store.get('admin:range')) ? store.get('admin:range') : '30d';

  // The tab, range and filters live in the address — #analytics?range=7d&path=/cs.html
  // — so a reload lands back here and a view can be bookmarked.
  function readHash() {
    const h = location.hash || '';
    if (!h.startsWith('#analytics')) return;
    const q = new URLSearchParams(h.split('?')[1] || '');
    if (RANGES.has(q.get('range'))) S.range = q.get('range');
    S.filters = {}; S.labels = {};
    for (const k of FILTER_KEYS) if (q.has(k)) S.filters[k] = q.get(k);
    for (const k of FILTER_KEYS) if (q.has(k + '.label')) S.labels[k] = q.get(k + '.label');
  }
  function writeHash() {
    const q = new URLSearchParams({ range: S.range });
    for (const k of Object.keys(S.filters)) { q.set(k, S.filters[k]); if (S.labels[k]) q.set(k + '.label', S.labels[k]); }
    history.replaceState(null, '', location.pathname + location.search + '#analytics?' + q.toString());
  }

  function myId() {
    let v = store.get('visit:id');
    if (!ID.test(v || '')) {
      v = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      store.set('visit:id', v);
    }
    return v;
  }

  async function call(path, init = {}) {
    const headers = Object.assign({}, init.headers);
    const session = S.token ? await S.token() : '';
    if (session) headers['x-admin-session'] = session;
    let r = await fetch(HOST + path, Object.assign({}, init, { headers, cache: 'no-store' }));
    const pw = store.get('ownerToken');
    if (r.status === 401 && pw) {
      delete headers['x-admin-session'];
      headers.authorization = 'Bearer ' + pw;
      r = await fetch(HOST + path, Object.assign({}, init, { headers, cache: 'no-store' }));
    }
    return r;
  }

  const stampOf = (d) => `Updated ${new Date(d.now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` +
    (d.since ? ` · counting since ${new Date(d.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '');

  function paint() {
    if (!S.on || !S.root) return;
    const R = S.root;
    if (S.state === 'loading' && !S.data) { R.innerHTML = '<div class="list empty">Loading the numbers…</div>'; return; }
    if (S.state === 'door') {
      R.innerHTML = `<form class="an-door card" id="an-door"><h2>Visitor numbers</h2>
        <p>${esc(S.msg)}</p>
        <label for="an-pw">Site password</label><input id="an-pw" type="password" autocomplete="current-password" required>
        <button class="btn primary" type="submit">Open</button><p class="error" id="an-pw-msg" role="alert"></p></form>`;
      return;
    }
    if (S.state === 'not-set-up') {
      R.innerHTML = `<p class="notice">The visitor counter's database is not switched on yet, so there is nothing to show. ` +
        'Once, from the Mac: <code>cd worker && npx wrangler@latest d1 create visitors</code>, paste the id into the ' +
        '<code>d1_databases</code> line in <code>worker/wrangler.jsonc</code>, uncomment it, and deploy. See <code>worker/README.md</code>.</p>';
      return;
    }
    if (!S.data) { R.innerHTML = `<p class="notice">${esc(S.msg || 'No numbers yet.')}</p>`; return; }
    const d = S.data;
    // Keep focus on the control that was used, across the redraw.
    const a = document.activeElement;
    const keep = a && R.contains(a) ? (a.id ? '#' + a.id : a.dataset.range ? `[data-range="${a.dataset.range}"]` : a.dataset.sort ? `[data-sort="${a.dataset.sort}"]` : '') : '';
    const y = window.scrollY;
    R.innerHTML = (S.msg ? `<p class="notice">${esc(S.msg)}</p>` : '') +
      (S.info ? `<p class="an-info">${esc(S.info)} <button type="button" class="link" id="an-unignore">Count it again</button></p>` : '') +
      drawAll(d, { sort: S.sort, range: S.range, ignoring: store.get('visit:ignore') === '1', stamp: stampOf(d), all: S.all, labels: S.labels });
    window.scrollTo(0, y);
    if (keep) { const el = R.querySelector(keep); if (el) el.focus({ preventScroll: true }); }
    const c = chart(d);
    const out = document.getElementById('an-readout');
    const chartEl = R.querySelector('.an-chart');
    if (chartEl && out) {
      const say = (e) => { const el = e.target.closest('.an-col'); if (el) out.textContent = c.tip(c.cols[+el.dataset.i]); };
      chartEl.addEventListener('mouseover', say);
      chartEl.addEventListener('focusin', say);
    }
  }

  function query() {
    const q = new URLSearchParams({ range: S.range, tz: String(-new Date().getTimezoneOffset()), full: '1', me: myId() });
    if (S.seen) q.set('seen', String(S.seen));
    for (const k of Object.keys(S.filters)) q.set(k, S.filters[k]);
    return q.toString();
  }

  function schedule() {
    clearTimeout(S.timer);
    if (S.on) S.timer = setTimeout(tick, LIVE_EVERY);
  }

  async function tick() {
    if (!S.on) return;
    if (document.visibilityState !== 'visible') return schedule();   // picked up again on visibilitychange
    if (S.state === 'door') return schedule();                        // never redraw a password half typed
    if (Date.now() - S.lastFull >= FULL_EVERY || S.state !== 'ok') return load();
    try {
      const r = await call('/stats/live');
      if (r.ok && S.data) {
        const { live, now } = await r.json();
        S.data.live = live;
        const k = document.getElementById('an-live-kpi');
        if (k) k.innerHTML = `<b>${fmt(live.count)}</b><span>Online now</span><small>${live.count ? 'in the last 5 minutes' : 'nobody right now'}</small>`;
        const lp = document.getElementById('an-live-panel');
        if (lp) lp.innerHTML = livePanel(live);
        const st = document.getElementById('an-stamp');
        if (st) st.textContent = stampOf(Object.assign({}, S.data, { now }));
      }
    } catch (_) {}
    schedule();
  }

  async function load() {
    clearTimeout(S.timer);
    if (!S.on) return;
    try {
      const r = await call('/stats?' + query());
      if (r.status === 401) {
        S.state = 'door';
        S.msg = 'The Worker did not take this admin sign-in — it may not be deployed with the admin door yet (see admin/README.md). The site password opens it too.';
      } else if (r.status === 429) {
        S.msg = 'Too many wrong passwords just now — the Worker is refusing everything for five minutes.';
      } else if (!r.ok) {
        S.msg = `The Worker answered ${r.status}.`;
      } else {
        const d = await r.json();
        if (!d.configured) { S.state = 'not-set-up'; S.data = null; }
        else {
          S.lastFull = Date.now();
          if (d.meExcluded !== (store.get('visit:ignore') === '1')) store.set('visit:ignore', d.meExcluded ? '1' : null);
          // "Since you last looked" is measured from the visit before this
          // one: stored once per page load, read from what was there before.
          if (!S.seenSaved) { store.set('admin:seen', String(d.now)); S.seenSaved = true; }
          await autoIgnore(d);
          // Same numbers as last time: change only the clock, so the page
          // does not jump under someone reading it.
          const sig = JSON.stringify(Object.assign({}, d, { now: 0, meExcluded: 0 }));
          const same = S.state === 'ok' && sig === S.sig && !S.msg;
          S.state = 'ok'; S.msg = ''; S.data = d; S.sig = sig;
          if (same) { const st = document.getElementById('an-stamp'); if (st) st.textContent = stampOf(d); return schedule(); }
        }
      }
    } catch (_) {
      S.msg = S.data ? 'Could not reach the Worker — showing the last numbers loaded.' : 'Could not reach the Worker.';
      if (!S.data) S.state = 'error';
    }
    paint();
    schedule();
  }

  // An admin's own devices are not visitors. The first time a device opens
  // this tab it is left out of the numbers, once, with a way back.
  async function autoIgnore(d) {
    if (store.get('admin:auto-ignored') === '1') return;
    store.set('admin:auto-ignored', '1');
    if (d.meExcluded) return;
    if (await exclude(myId(), true)) {
      store.set('visit:ignore', '1');
      d.meExcluded = true;
      S.info = 'This device is now left out of the numbers, because an admin uses it.';
    }
  }

  async function openVisitor(id) {
    const dlg = document.getElementById('visitor-dlg');
    if (!dlg || !ID.test(id)) return;
    S.visitor = id;
    document.getElementById('visitor-title').textContent = who(id);
    document.getElementById('visitor-body').innerHTML = '<p class="an-empty">Loading…</p>';
    const ign = document.getElementById('visitor-ignore');
    ign.hidden = true;
    if (!dlg.open) dlg.showModal();
    try {
      const r = await call('/stats/visitor?id=' + encodeURIComponent(id));
      if (!r.ok) throw new Error(`The Worker answered ${r.status}.`);
      const v = await r.json();
      if (S.visitor !== id) return;
      document.getElementById('visitor-body').innerHTML = drawVisitor(v);
      ign.hidden = false;
      ign.dataset.on = String(!v.ignored);
      ign.textContent = v.ignored ? 'Count this visitor again' : (id === myId() ? 'Ignore — this is me' : 'Ignore this visitor (it is me)');
    } catch (err) {
      document.getElementById('visitor-body').innerHTML = `<p class="error">${esc(err.message || 'Could not load.')}</p>`;
    }
  }

  async function exclude(visitor, on) {
    try {
      const r = await call('/stats/exclude', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visitor, on }) });
      return r.ok;
    } catch (_) { return false; }
  }

  function download(kind) {
    const text = toCsv(kind, S.data);
    if (!text) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = `ricmassey-${kind}-${S.range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function refilter() { S.all = false; writeHash(); S.state = S.data ? 'ok' : 'loading'; load(); }

  function wire(root) {
    root.addEventListener('click', async (e) => {
      const rg = e.target.closest('[data-range]');
      if (rg) { S.range = rg.dataset.range; store.set('admin:range', S.range); return refilter(); }
      const pk = e.target.closest('[data-f]');
      if (pk) {
        S.filters[pk.dataset.f] = pk.dataset.fv;
        S.labels[pk.dataset.f] = pk.dataset.fl;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return refilter();
      }
      const un = e.target.closest('[data-unfilter]');
      if (un) {
        if (un.dataset.unfilter === '*') { S.filters = {}; S.labels = {}; }
        else { delete S.filters[un.dataset.unfilter]; delete S.labels[un.dataset.unfilter]; }
        return refilter();
      }
      const jump = e.target.closest('[data-jump]');
      if (jump) {
        const el = document.getElementById(jump.dataset.jump);
        if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      const cv = e.target.closest('[data-csv]');
      if (cv) return download(cv.dataset.csv);
      const so = e.target.closest('[data-sort]');
      if (so) { S.sort = so.dataset.sort; return paint(); }
      const v = e.target.closest('[data-visitor]');
      if (v) return openVisitor(v.dataset.visitor);
      if (e.target.closest('#an-refresh')) { S.lastFull = 0; return load(); }
      if (e.target.closest('#an-all')) { S.all = true; return paint(); }
      if (e.target.closest('#an-unignore')) {
        S.info = '';
        if (await exclude(myId(), false)) store.set('visit:ignore', null);
        return load();
      }
      if (e.target.closest('#an-ignore')) {
        const on = store.get('visit:ignore') !== '1';
        store.set('visit:ignore', on ? '1' : null);
        S.info = '';
        paint();
        if (!(await exclude(myId(), on))) S.msg = 'Saved on this device, but the Worker did not take it — past visits from here still count.';
        return load();
      }
    });
    root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'an-door') return;
      e.preventDefault();
      const pw = document.getElementById('an-pw').value;
      const msg = document.getElementById('an-pw-msg');
      try {
        const r = await fetch(HOST + '/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) });
        if (r.status === 429) { msg.textContent = 'Locked for five minutes after too many wrong tries.'; return; }
        if (!r.ok) { msg.textContent = 'That is not it.'; return; }
        store.set('ownerToken', pw);
        S.state = 'loading';
        load();
      } catch (_) { msg.textContent = 'Could not reach the Worker.'; }
    });
    const ign = document.getElementById('visitor-ignore');
    if (ign) ign.addEventListener('click', async () => {
      const id = S.visitor, on = ign.dataset.on === 'true';
      if (!(await exclude(id, on))) return;
      if (id === myId()) store.set('visit:ignore', on ? '1' : null);
      await openVisitor(id);
      S.lastFull = 0;
      load();
    });
    const dlg = document.getElementById('visitor-dlg');
    if (dlg) dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.on) tick(); });
  }

  let wired = false;
  window.AdminAnalytics = {
    // True when the address asks for this tab (admin.js opens it on load).
    wanted: () => (location.hash || '').startsWith('#analytics'),
    show(root, token) {
      S.root = root; S.token = token;
      if (!wired) { readHash(); wire(root); wired = true; }
      const first = !S.on;
      S.on = true;
      writeHash();
      paint();
      if (first) { if (Date.now() - S.lastFull >= LIVE_EVERY) load(); else schedule(); }
    },
    hide() {
      if (S.on && (location.hash || '').startsWith('#analytics')) history.replaceState(null, '', location.pathname + location.search);
      S.on = false; clearTimeout(S.timer);
    },
    // pure, for the tests
    drawAll, drawVisitor, bars, heat, pagesTable, sessionsList, regularsTable, dur, refName, place, toCsv, filterWords, delta,
  };
})();
