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
    if (f === 'waiting') return p.status === 'pending' && !p.is_admin;
    if (f === 'banned') return banned(p);
    if (f === 'active') return !banned(p) && (p.is_admin || p.status === 'approved' || p.status === undefined);
    return true;
  }

  /* A row: checkbox, initial, name and email, badge, a short right-hand fact,
     and a details panel that opens under it. `side` is what the right-hand
     column says (pages for the site, best score for KONDRITE). */
  function row(p, { open = false, selected = false, side = '', details = '' } = {}) {
    const b = badge(p);
    const id = esc(p.id);
    return `<li class="row${open ? ' open' : ''}" data-id="${id}">
      <div class="line">
        <label class="pick" title="Select"><input type="checkbox" data-pick="${id}"${selected ? ' checked' : ''} aria-label="Select ${esc(p.name || p.email)}"></label>
        <button type="button" class="toggle" data-toggle="${id}" aria-expanded="${open}">
          <span class="avatar" aria-hidden="true">${initial(p)}</span>
          <span class="who"><span class="name">${esc(p.name || p.email || 'No name')}</span><span class="email">${esc(p.email)}</span></span>
          <span class="badge-cell">${b ? `<span class="badge ${b[1]}">${b[0]}</span>` : ''}</span>
          <span class="side">${esc(side)}</span>
          <span class="seen">${esc(ago(p.last_sign_in_at))}</span>
          <span class="chev" aria-hidden="true"></span>
        </button>
      </div>
      ${open ? `<div class="details">${details}</div>` : ''}
    </li>`;
  }

  const facts = (pairs) => `<dl class="facts">${pairs.filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

  const btn = (act, id, label, kind = '') => `<button type="button" class="btn ${kind}" data-act="${esc(act)}" data-id="${esc(id)}">${esc(label)}</button>`;

  // ── the site ───────────────────────────────────────────────────────────────
  function siteDetails(p, pages, { server = true } = {}) {
    const id = p.id;
    const label = (k) => (pages.find((x) => x.key === k) || { label: k }).label;
    const checked = new Set(p.status === 'pending' ? [...p.pages, ...p.requested] : p.pages);
    const access = p.is_admin ? '<p class="hint">Admins open everything.</p>'
      : `<div class="checks">${pages.map((pg) => `<label><input type="checkbox" data-page="${esc(pg.key)}" data-for="${esc(id)}"${checked.has(pg.key) ? ' checked' : ''}> ${esc(pg.label)}</label>`).join('')}</div>
        <div class="actions">${p.status === 'pending'
          ? btn('approve', id, 'Approve', 'primary') + btn('deny', id, 'Deny', 'danger')
          : btn('access', id, 'Save access', 'primary') + (p.status === 'denied' ? '' : btn('deny', id, 'Remove access', 'danger'))}</div>`;
    const noServer = server ? '' : ' disabled title="Deploy site-admin first"';
    return `
      <section><h4>Access</h4>${access}</section>
      <section><h4>Profile</h4>
        <div class="fields">
          <label>Name<input type="text" data-field="name" data-for="${esc(id)}" value="${esc(p.name)}" maxlength="60"></label>
          <label>Email<input type="email" data-field="email" data-for="${esc(id)}" value="${esc(p.email)}"></label>
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

  function pilotDetails(p) {
    const id = p.id;
    return `
      <section><h4>Profile</h4>
        <div class="fields"><label>Board name<input type="text" data-field="name" data-for="${esc(id)}" value="${esc(p.name)}" maxlength="16"></label></div>
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

  window.AdminView = Object.freeze({ esc, day, ago, banned, badge, matches, inFilter, row, siteDetails, pilotDetails, scoreText });
})();
