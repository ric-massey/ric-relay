/* Admin — drawing. Pure functions from data to markup, nothing else: no
 * network, no state. Every string that came from a person goes through esc(),
 * because names and notes are typed by strangers. admin/test/ runs these in a
 * sandbox with hostile input. */
(() => {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const day = (t) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

  // "3d ago" for the row; the full date sits in the details.
  function ago(t, now = Date.now()) {
    if (!t) return 'Never';
    const s = Math.max(0, (now - new Date(t).getTime()) / 1000);
    if (s < 3600) return 'Just now';
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
    return day(t);
  }

  const banned = (p, now = Date.now()) => !!(p.banned_until && new Date(p.banned_until).getTime() > now);
  const forever = (p) => banned(p) && new Date(p.banned_until).getFullYear() > 2100;

  // One badge, the one that matters most.
  function badge(p) {
    if (p.is_admin) return ['Admin', 'admin'];
    if (banned(p)) return ['Banned', 'bad'];
    if (p.status === 'pending') return ['Waiting', 'warn'];
    if (p.status === 'denied') return ['Denied', 'bad'];
    if (p.invited) return ['Invited', 'muted'];
    if (p.confirmed === false) return ['Unconfirmed', 'muted'];
    return null;
  }

  const initial = (p) => esc((String(p.name || p.email || '?').trim()[0] || '?').toUpperCase());

  function matches(p, q) {
    q = String(q || '').trim().toLowerCase();
    return !q || [p.name, p.username, p.email].some((s) => String(s || '').toLowerCase().includes(q));
  }

  function inFilter(p, f) {
    if (f === 'waiting') return p.status === 'pending' && !p.is_admin && !banned(p);
    if (f === 'banned') return banned(p);
    if (f === 'active') return !banned(p) && (p.is_admin || p.status === 'approved' || p.status === undefined);
    return true;
  }

  const badgeHtml = (p) => { const b = badge(p); return b ? `<span class="badge ${b[1]}">${b[0]}</span>` : ''; };

  /* A row: checkbox, initial, name and email, badge, a short right-hand fact.
     Clicking it opens the drawer; the row itself never holds a form, so a
     redraw of the list can never throw away something being typed. `side` is
     the right-hand column (pages for the site, best score for KONDRITE). */
  function row(p, { active = false, selected = false, side = '' } = {}) {
    const id = esc(p.id);
    return `<li class="row${active ? ' active' : ''}${selected ? ' picked' : ''}" data-id="${id}">
      <div class="line">
        <label class="pick" title="Select"><input type="checkbox" data-pick="${id}"${selected ? ' checked' : ''} aria-label="Select ${esc(p.name || p.email)}"></label>
        <button type="button" class="toggle" data-open="${id}"${active ? ' aria-current="true"' : ''}>
          <span class="avatar" aria-hidden="true">${initial(p)}</span>
          <span class="who"><span class="name">${esc(p.name || p.email || 'No name')}</span><span class="email">${esc(p.email)}</span></span>
          <span class="badge-cell">${badgeHtml(p)}</span>
          <span class="side">${esc(side)}</span>
          <span class="seen">${esc(ago(p.last_sign_in_at))}</span>
          <span class="chev" aria-hidden="true"></span>
        </button>
      </div>
    </li>`;
  }

  // The list's top line: select-all, ticked when everything shown is picked.
  const listHead = (shown, picked) => `<li class="list-head">
      <label class="pick" title="Select all"><input type="checkbox" id="pick-all" aria-label="Select all shown"${shown && picked === shown ? ' checked' : ''}></label>
      <span>${picked ? `${picked} selected` : `${shown} ${shown === 1 ? 'person' : 'people'}`}</span>
    </li>`;

  // The four cards over the list. Each is also its filter.
  function stats(counts, active) {
    const card = (key, label, n, tone = '') => `<button type="button" class="stat ${tone}" data-filter="${key}" aria-pressed="${active === key}"><b>${esc(n)}</b><span>${esc(label)}</span></button>`;
    return card('all', 'Total', counts.all) + card('waiting', 'Waiting', counts.waiting, counts.waiting ? 'warn' : '')
      + card('active', 'Active', counts.active) + card('banned', 'Banned', counts.banned, counts.banned ? 'bad' : '');
  }

  const count = (people) => ({
    all: people.length,
    waiting: people.filter((p) => inFilter(p, 'waiting')).length,
    active: people.filter((p) => inFilter(p, 'active')).length,
    banned: people.filter((p) => inFilter(p, 'banned')).length,
  });

  const skeleton = (n = 6) => `<div class="list" style="list-style:none;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden" aria-busy="true" aria-label="Loading">${
    Array.from({ length: n }, (_, i) => `<div class="skel"><i class="dot"></i><div class="lines"><i style="width:${30 + ((i * 17) % 25)}%"></i><i style="width:${45 + ((i * 11) % 20)}%"></i></div></div>`).join('')}</div>`;
  const skeletonStats = () => ['Total', 'Waiting', 'Active', 'Banned'].map((l) => `<div class="stat skel-stat"><b>00</b><span>${l}</span></div>`).join('');

  const facts = (pairs) => `<dl class="facts">${pairs.filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

  const btn = (act, id, label, kind = '') => `<button type="button" class="btn ${kind}" data-act="${esc(act)}" data-id="${esc(id)}">${esc(label)}</button>`;

  // ── the site ───────────────────────────────────────────────────────────────
  /* `draft` is what Ric typed or ticked and has not saved: it wins over the
     stored value, so a redraw after any other button keeps it. */
  // Always drawn, shown only while there is something unsaved, so admin.js can
  // flip it as Ric types without redrawing the form under his cursor.
  const DIRTY = (part, on) => `<p class="dirty" data-dirty="${part}"${on ? '' : ' hidden'}>Unsaved changes</p>`;

  // The pages a person starts ticked with: what they have, plus — while they
  // are waiting — what they asked for, so approving adds.
  const storedPages = (p) => (p.status === 'pending' ? [...new Set([...(p.pages || []), ...(p.requested || [])])] : (p.pages || []));

  // Which parts of a draft differ from what is saved. Typing a value back to
  // what it was is not a change.
  function dirtyOf(p, draft = {}) {
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    return {
      profile: (draft.name !== undefined && draft.name !== (p.name || ''))
        || (draft.email !== undefined && draft.email !== (p.email || '')),
      access: !!draft.pages && !same(draft.pages, storedPages(p)),
    };
  }

  function siteDetails(p, pages, { server = true, draft = {} } = {}) {
    const id = p.id;
    const label = (k) => (pages.find((x) => x.key === k) || { label: k }).label;
    const checked = new Set(draft.pages || storedPages(p));
    const dirty = dirtyOf(p, draft);
    const accessDirty = dirty.access;
    const name = draft.name !== undefined ? draft.name : p.name;
    const email = draft.email !== undefined ? draft.email : p.email;
    const profileDirty = dirty.profile;
    const access = p.is_admin ? '<p class="hint">Admins open everything.</p>'
      : `${DIRTY('access', accessDirty)}<div class="checks">${pages.map((pg) => `<label><input type="checkbox" data-page="${esc(pg.key)}" data-for="${esc(id)}"${checked.has(pg.key) ? ' checked' : ''}> ${esc(pg.label)}</label>`).join('')}</div>
        <div class="actions">${p.status === 'pending'
          ? btn('approve', id, 'Approve', 'primary') + btn('deny', id, 'Deny', 'danger')
          : btn('access', id, 'Save access', 'primary') + (p.status === 'denied' ? '' : btn('deny', id, 'Remove access', 'danger'))}</div>`;
    const noServer = server ? '' : ' disabled title="Deploy site-admin first"';
    return `
      <section><h4>Access</h4>${access}</section>
      <section><h4>Profile</h4>${DIRTY('profile', profileDirty)}
        <div class="fields">
          <label>Name<input type="text" data-field="name" data-for="${esc(id)}" value="${esc(name)}" maxlength="60"></label>
          <label>Email<input type="email" data-field="email" data-for="${esc(id)}" value="${esc(email)}"></label>
        </div>
        <div class="actions"><button type="button" class="btn" data-act="profile" data-id="${esc(id)}"${noServer}>Save profile</button></div>
      </section>
      <section><h4>Account</h4>
        <div class="actions">
          <button type="button" class="btn" data-act="email" data-id="${esc(id)}"${noServer}>Email</button>
          <button type="button" class="btn" data-act="reset" data-id="${esc(id)}"${noServer}>Send password reset</button>
          ${p.confirmed === false ? `<button type="button" class="btn" data-act="resend" data-id="${esc(id)}"${noServer}>${p.invited ? 'Resend invite' : 'Resend confirmation'}</button>` : ''}
          ${p.is_admin ? '' : banned(p)
            ? `<button type="button" class="btn" data-act="unban" data-id="${esc(id)}"${noServer}>Unban</button>`
            : `<button type="button" class="btn danger" data-act="ban" data-id="${esc(id)}"${noServer}>Ban</button>`}
          ${p.is_admin ? '' : `<button type="button" class="btn danger" data-act="delete" data-id="${esc(id)}"${noServer}>Delete</button>`}
        </div>
      </section>
      ${facts([
        ['Joined', day(p.created_at)], ['Last sign-in', day(p.last_sign_in_at)],
        ['Username', p.username ? '@' + p.username : ''], ['Asked for', (p.requested || []).map(label).join(', ')],
        ['Banned until', banned(p) ? (forever(p) ? 'Forever' : day(p.banned_until)) : ''], ['Note', p.note],
      ])}`;
  }

  // ── KONDRITE ───────────────────────────────────────────────────────────────
  const SCORE = { survival: (v) => `Wave ${v}`, royale: (v) => `${v}s survived`, campaign: (v) => `Mission ${v}` };
  const scoreText = (best) => Object.entries(best || {}).map(([g, v]) => (SCORE[g] ? SCORE[g](v) : `${g} ${v}`));

  function pilotDetails(p, { draft = {} } = {}) {
    const id = p.id;
    const name = draft.name !== undefined ? draft.name : p.name;
    return `
      <section><h4>Profile</h4>${DIRTY('profile', dirtyOf(p, draft).profile)}
        <div class="fields"><label>Board name<input type="text" data-field="name" data-for="${esc(id)}" value="${esc(name)}" maxlength="16"></label></div>
        <div class="actions">${btn('rename', id, 'Rename')}</div>
      </section>
      <section><h4>Account</h4>
        <div class="actions">
          ${btn('email', id, 'Email')}${btn('reset', id, 'Send password reset')}
          ${p.has_save ? btn('wipe', id, 'Wipe cloud save') : ''}
          ${p.reports ? btn('scores', id, 'Clear scores') : ''}
          ${p.is_admin ? '' : banned(p) ? btn('unban', id, 'Unban') : btn('ban', id, 'Ban', 'danger')}
          ${p.is_admin ? '' : btn('delete', id, 'Delete', 'danger')}
        </div>
      </section>
      ${facts([
        ['Joined', day(p.created_at)], ['Last sign-in', day(p.last_sign_in_at)],
        ['Save', p.has_save ? `Sector ${p.save_seed} · ${Math.ceil((p.save_bytes || 0) / 1024)} KB · ${day(p.save_updated_at)}` : 'None'],
        ['Best', scoreText(p.best).join(' · ') || 'Nothing on the boards'],
        ['Reports about them', p.reports ? String(p.reports) : ''],
        ['Banned until', banned(p) ? (forever(p) ? 'Forever' : day(p.banned_until)) : ''],
      ])}`;
  }

  window.AdminView = Object.freeze({
    esc, day, ago, banned, badge, badgeHtml, initial, matches, inFilter, count, dirtyOf,
    row, listHead, stats, skeleton, skeletonStats, siteDetails, pilotDetails, scoreText,
  });
})();
