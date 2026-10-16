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
  const groupRefs = (list) => {
    const m = new Map();
    for (const [h, n] of list || []) { const k = refName(h); m.set(k, (m.get(k) || 0) + n); }
    return [...m].sort((a, b) => b[1] - a[1]);
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
  function bars(rows, { label = esc, head = null, cols = [], empty = 'Nothing yet.', share = false } = {}) {
    if (!rows || !rows.length) return `<p class="an-empty">${esc(empty)}</p>`;
    const max = Math.max(...rows.map((r) => r[1]), 1);
    const sum = rows.reduce((a, r) => a + r[1], 0) || 1;
    return '<table class="an-t">' +
      (head ? '<thead><tr>' + head.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('') + '</tr></thead>' : '') +
      '<tbody>' + rows.map((r) =>
        `<tr><td class="k"><i class="fill" style="width:${((r[1] / max) * 100).toFixed(1)}%"></i><span>${label(r[0], r)}</span></td>` +
        cols.map((c) => `<td class="n">${c(r)}</td>`).join('') +
        `<td class="n">${share ? pct(r[1], sum) : fmt(r[1])}</td></tr>`).join('') +
      '</tbody></table>';
  }

  function kpis(d) {
    const t = d.total, e = (d.more && d.more.engagement) || {};
    const ret = Math.max(0, t.visitors - t.newVisitors);
    const card = (n, l, sub = '') => `<div class="stat an-kpi"><b>${n}</b><span>${esc(l)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    return '<div class="stats an-kpis">' + [
      card(fmt(t.visitors), 'Unique visitors', `${fmt(t.newVisitors)} new · ${fmt(ret)} returning`),
      card(fmt(t.sessions), 'Visits', `${fmt(d.today.sessions)} today`),
      card(fmt(t.views), 'Page views', `${fmt(d.today.views)} today`),
      card(fmt(d.live.count), 'Online now', d.live.count ? 'in the last 5 minutes' : 'nobody right now'),
      card(e.sessions ? (e.pagesPerSession || 0).toFixed(1) : '0', 'Pages per visit'),
      card(pct(e.bounces || 0, e.sessions || 0), 'Bounce rate', 'left after one page'),
      card(dur(e.sessionSeconds), 'Avg. time on site', 'per visit, tab in front'),
      card(dur(e.pageSeconds), 'Avg. time on a page', e.scroll ? `scrolled ${Math.round(e.scroll)}% down on average` : ''),
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
  function pagesTable(pages, sort) {
    if (!pages || !pages.length) return '<p class="an-empty">Nothing yet.</p>';
    const by = SORTS[sort] || SORTS.views;
    const rows = pages.slice().sort((a, b) => by(b) - by(a));
    const max = Math.max(...rows.map((p) => p.views), 1);
    const th = (k, l) => `<th class="n"><button type="button" class="an-sort" data-sort="${k}" aria-pressed="${sort === k}">${esc(l)}</button></th>`;
    return '<div class="an-scroll"><table class="an-t an-pages"><thead><tr><th>Page</th>' +
      th('views', 'Views') + th('visitors', 'Visitors') + th('dur', 'Avg. time') + th('depth', 'Scroll') +
      th('entries', 'Entries') + th('exits', 'Exits') + th('bounce', 'Bounce') + '</tr></thead><tbody>' +
      rows.map((p) => `<tr><td class="k"><i class="fill" style="width:${((p.views / max) * 100).toFixed(1)}%"></i><span>${esc(pathName(p.path))}</span></td>` +
        `<td class="n">${fmt(p.views)}</td><td class="n">${fmt(p.visitors)}</td><td class="n">${p.dur ? dur(p.dur) : '—'}</td>` +
        `<td class="n">${p.depth ? Math.round(p.depth) + '%' : '—'}</td><td class="n">${fmt(p.entries)}</td><td class="n">${fmt(p.exits)}</td>` +
        `<td class="n">${p.entries ? pct(p.bounces, p.entries) : '—'}</td></tr>`).join('') +
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

  const panel = (title, body, cls = '') => `<section class="an-panel ${cls}"><h3>${esc(title)}</h3>${body}</section>`;

  function drawAll(d, { sort = 'views', range = '30d', ignoring = false, stamp = '', all = false } = {}) {
    const m = d.more || {};
    const c = chart(d);
    const real = (d.pages || []).filter((p) => !String(p[0]).startsWith('/404/'));
    const missing = (d.pages || []).filter((p) => String(p[0]).startsWith('/404/')).map((p) => [String(p[0]).slice(4), p[1]]);
    const loyalty = (m.loyalty || []).reduce((acc, [k, n]) => {
      const b = k <= 1 ? '1 visit' : k === 2 ? '2 visits' : k <= 5 ? '3–5 visits' : k <= 10 ? '6–10 visits' : '11+ visits';
      acc.set(b, (acc.get(b) || 0) + n); return acc;
    }, new Map());
    const loyaltyOrder = ['1 visit', '2 visits', '3–5 visits', '6–10 visits', '11+ visits'].filter((k) => loyalty.has(k)).map((k) => [k, loyalty.get(k)]);
    const regionsList = [];
    const rm = new Map();
    for (const [co, rg, , n] of m.places || []) { const k = co + '|' + rg; rm.set(k, (rm.get(k) || 0) + n); }
    for (const [k, n] of rm) regionsList.push([k, n]);
    regionsList.sort((a, b) => b[1] - a[1]);

    return `<div class="an-bar">
        <div class="an-ranges" role="group" aria-label="Range">${[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['all', 'All time']]
          .map(([k, l]) => `<button type="button" class="an-range" data-range="${k}" aria-pressed="${range === k}">${l}</button>`).join('')}</div>
        <span class="an-stamp">${esc(stamp)}</span>
        <button type="button" class="btn" id="an-ignore" aria-pressed="${ignoring}">${ignoring ? 'This device is ignored' : 'Ignore this device'}</button>
        <button type="button" class="btn" id="an-refresh">Refresh</button>
      </div>` +
      kpis(d) +
      `<section class="an-panel"><div class="an-head"><h3>${esc(c.title)}</h3>
         <span class="an-legend"><span><i class="v"></i>Page views</span><span><i class="u"></i>Visitors</span></span></div>
         <p class="an-readout" id="an-readout" aria-live="polite">Hover or focus a bar for its numbers.</p>${c.html}</section>` +
      '<div class="an-grid">' +
      panel('Pages', pagesTable(m.pages, sort), 'wide') +
      panel('Where they went next', bars((m.flows || []).slice(0, 12).map((f) => [f, f[2]]),
        { label: (f) => `${esc(pathName(f[0]))} <span class="an-arrow">→</span> ${esc(pathName(f[1]))}`, head: ['From → to', 'Times'], empty: 'No one has gone page to page yet.' })) +
      panel('When they come', heat(m.heat) + '<p class="an-note">Page views by weekday and hour, in this browser\'s time zone.</p>') +
      panel('Where they came from', bars(groupRefs(d.referrers), { head: ['Source', 'Share'], share: true })) +
      panel('Shared links (utm / ?ref=)', bars((m.campaigns || []).map((x) => [x, x[2]]),
        { label: (x) => esc(x[0] + (x[1] ? ' / ' + x[1] : '')), head: ['Tag', 'Visits'], empty: 'Add ?ref=something to a link you share and it shows here.' })) +
      panel('Links clicked out', bars(m.outbound, { head: ['Site', 'Visitors', 'Clicks'], cols: [(r) => fmt(r[2])], empty: 'No one has clicked out yet.' })) +
      panel('Landing pages', bars((d.entries || []).filter((p) => !String(p[0]).startsWith('/404/')), { label: (p) => esc(pathName(p)), head: ['First page of a visit', 'Visits'] })) +
      panel('Countries', bars(d.countries, { label: (c2) => esc(flag(c2) + ' ' + countryName(c2)), head: ['Country', 'Visitors'] })) +
      panel('States & regions', bars(regionsList, { label: (k) => { const [co, rg] = String(k).split('|'); return esc(flag(co) + ' ' + (rg || 'Unknown') + ', ' + countryName(co)); }, head: ['Region', 'Visitors'] })) +
      panel('Cities', bars((m.places || []).map((x) => [x, x[3]]), { label: (x) => esc(place({ country: x[0], region: x[1], city: x[2] })), head: ['City', 'Visitors'] })) +
      panel('Devices', bars(d.devices, { head: ['Device', 'Share'], share: true }) +
        bars((m.screens || []).map(([k, n]) => [SCREENS[k] || 'Unknown', n]), { head: ['Screen', 'Share'], share: true })) +
      panel('Browsers & systems', bars(d.browsers, { head: ['Browser', 'Share'], share: true }) + bars(d.os, { head: ['System', 'Share'], share: true })) +
      panel('Languages', bars((m.languages || []).map(([k, n]) => [langName(k), n]), { head: ['Language', 'Visitors'] })) +
      panel('How often they come back', bars(loyaltyOrder, { head: ['Visits in range', 'Visitors'] })) +
      panel('How long a visit lasts', bars((m.lengths || []).map(([k, n]) => [LENGTHS[k] || '?', n]), { head: ['Time on site', 'Visits'] })) +
      panel('Online now', d.live.pages.length ? bars(d.live.pages, { label: (p) => esc(pathName(p)), head: ['Page', 'People'] }) : '<p class="an-empty">Nobody right now.</p>') +
      panel('Broken links people hit (404)', bars(missing, { head: ['Missing page', 'Views'], empty: 'None.' })) +
      panel('Regulars', regularsTable(m.regulars), 'wide') +
      panel('Recent visits', sessionsList(all ? m.sessions : (m.sessions || []).slice(0, 15)) +
        ((m.sessions || []).length > 15 && !all ? `<button type="button" class="btn an-all" id="an-all">Show all ${fmt(m.sessions.length)}</button>` : ''), 'wide') +
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

  // ── wiring ────────────────────────────────────────────────────────────────
  const S = { root: null, token: null, data: null, range: '30d', sort: 'views', timer: 0, on: false, visitor: null, state: 'loading', msg: '', all: false };
  const RANGES = new Set(['today', '7d', '30d', '90d', 'all']);
  S.range = RANGES.has(store.get('admin:range')) ? store.get('admin:range') : '30d';

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
    const stamp = `Updated ${new Date(d.now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` +
      (d.since ? ` · counting since ${new Date(d.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '');
    const y = window.scrollY;
    R.innerHTML = (S.msg ? `<p class="notice">${esc(S.msg)}</p>` : '') +
      drawAll(d, { sort: S.sort, range: S.range, ignoring: store.get('visit:ignore') === '1', stamp, all: S.all });
    window.scrollTo(0, y);
    const c = chart(d);
    const out = document.getElementById('an-readout');
    const chartEl = R.querySelector('.an-chart');
    if (chartEl && out) {
      const say = (e) => { const el = e.target.closest('.an-col'); if (el) out.textContent = c.tip(c.cols[+el.dataset.i]); };
      chartEl.addEventListener('mouseover', say);
      chartEl.addEventListener('focusin', say);
    }
  }

  async function load() {
    clearTimeout(S.timer);
    if (!S.on) return;
    const tz = -new Date().getTimezoneOffset();
    try {
      const r = await call(`/stats?range=${S.range}&tz=${tz}&full=1&me=${encodeURIComponent(myId())}`);
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
          S.state = 'ok'; S.msg = ''; S.data = d;
          if (d.meExcluded !== (store.get('visit:ignore') === '1')) store.set('visit:ignore', d.meExcluded ? '1' : null);
        }
      }
    } catch (_) {
      S.msg = S.data ? 'Could not reach the Worker — showing the last numbers loaded.' : 'Could not reach the Worker.';
      if (!S.data) S.state = 'error';
    }
    paint();
    if (S.on) S.timer = setTimeout(load, 60000);
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

  function wire(root) {
    root.addEventListener('click', async (e) => {
      const rg = e.target.closest('[data-range]');
      if (rg) { S.range = rg.dataset.range; store.set('admin:range', S.range); paint(); load(); return; }
      const so = e.target.closest('[data-sort]');
      if (so) { S.sort = so.dataset.sort; return paint(); }
      const v = e.target.closest('[data-visitor]');
      if (v) return openVisitor(v.dataset.visitor);
      if (e.target.closest('#an-refresh')) return load();
      if (e.target.closest('#an-all')) { S.all = true; return paint(); }
      if (e.target.closest('#an-ignore')) {
        const on = store.get('visit:ignore') !== '1';
        store.set('visit:ignore', on ? '1' : null);
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
      load();
    });
    const dlg = document.getElementById('visitor-dlg');
    if (dlg) dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.on) load(); });
  }

  let wired = false;
  window.AdminAnalytics = {
    show(root, token) {
      S.root = root; S.token = token;
      if (!wired) { wire(root); wired = true; }
      const first = !S.on;
      S.on = true;
      paint();
      if (first) load();
    },
    hide() { S.on = false; clearTimeout(S.timer); },
    // pure, for the tests
    drawAll, drawVisitor, bars, heat, pagesTable, sessionsList, regularsTable, dur, refName, place,
  };
})();
