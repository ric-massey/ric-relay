// site-admin — the half of ricmassey.com/admin a browser is not allowed to do.
//
// Inviting, deleting, changing an email, banning, sending a reset link and
// sending a message all need the service_role key, which bypasses every policy
// and so can never be in the repo or the page. It lives here, in the Supabase
// project, as the SUPABASE_SERVICE_ROLE_KEY every Edge Function is given.
//
// Every request is refused unless the caller's own sign-in belongs to a row in
// public.site_admins. That check is the whole lock; test/site-admin.test.mjs
// holds every action behind it.
//
// Deploy: Supabase dashboard (ATLAS project) → Edge Functions → Deploy a new
// function → Via Editor → name it `site-admin` → paste this file → Deploy.
// Secrets it reads (Edge Functions → Secrets):
//   RESEND_API_KEY   for "write my own message"
//   MAIL_FROM        e.g.  Ric Massey <ric@ricmassey.com>  (a verified domain)
//   MAIL_REPLY_TO    where replies go, e.g. your own inbox
//   SITE_URL         https://ricmassey.com   (optional; this is the default)
// admin/README.md walks through all of it.
//
// Plain JavaScript in a .ts file on purpose: Deno runs it, and Node runs the
// tests against it without a build step.

const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?ricmassey\.com$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const MAX_RECIPIENTS = 100;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cors(origin) {
  const ok = ALLOWED_ORIGINS.some((re) => re.test(origin || ''));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://ricmassey.com',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

class Refusal extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A message that reads like a person wrote it: the text as typed, and an HTML
// copy that is the same words with line breaks. No images, no tracking, no
// links added — the things filters weigh against a sender.
export function composeMail({ from, replyTo, to, subject, text }) {
  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">'
    + escHtml(text).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
    + '</div>';
  const mail = { from, to: [to], subject, text, html };
  if (replyTo) mail.reply_to = replyTo;
  return mail;
}

// deps: { admin, env, fetch } — admin is a service-role supabase client.
export function createHandler({ admin, env, fetch: fetchFn }) {
  const site = String(env.SITE_URL || 'https://ricmassey.com').replace(/\/+$/, '');

  async function callerOf(req) {
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) throw new Refusal(401, 'Sign in first.');
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data || !data.user) throw new Refusal(401, 'Sign in again.');
    const { data: row } = await admin.from('site_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (!row) throw new Refusal(403, 'Admins only.');
    return data.user;
  }

  async function userById(id) {
    if (!id || typeof id !== 'string') throw new Refusal(400, 'No account given.');
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error || !data || !data.user) throw new Refusal(404, 'No such account.');
    return data.user;
  }

  const notSelf = (me, id, what) => { if (me.id === id) throw new Refusal(400, `You can't ${what} your own account.`); };

  const actions = {
    // Everybody, with what they asked for, what they have, and the auth facts
    // (confirmed, banned, last sign-in) the database functions cannot see.
    async list() {
      const users = [];
      for (let page = 1; page < 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Refusal(500, error.message);
        users.push(...data.users);
        if (data.users.length < 1000) break;
      }
      const [req, acc, prof, adm] = await Promise.all([
        admin.from('access_requests').select('user_id,name,note,pages,status'),
        admin.from('site_access').select('user_id,page_key'),
        admin.from('profiles').select('id,username'),
        admin.from('site_admins').select('user_id'),
      ]);
      const by = (rows, key) => new Map((rows.data || []).map((r) => [r[key], r]));
      const reqs = by(req, 'user_id');
      const profs = by(prof, 'id');
      const admins = new Set((adm.data || []).map((r) => r.user_id));
      const pages = new Map();
      for (const r of acc.data || []) pages.set(r.user_id, [...(pages.get(r.user_id) || []), r.page_key]);
      return users.map((u) => {
        const r = reqs.get(u.id) || {};
        return {
          id: u.id,
          email: u.email || '',
          name: r.name || (u.user_metadata && u.user_metadata.display_name) || '',
          username: (profs.get(u.id) || {}).username || '',
          note: r.note || '',
          status: admins.has(u.id) ? 'admin' : r.status || 'pending',
          requested: r.pages || [],
          pages: (pages.get(u.id) || []).sort(),
          is_admin: admins.has(u.id),
          confirmed: !!u.email_confirmed_at,
          invited: !!u.invited_at && !u.email_confirmed_at,
          banned_until: u.banned_until || null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || null,
        };
      }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    },

    // Add somebody. Supabase sends the invite through the project's own email
    // settings; the link lands on ATLAS, which asks them to pick a password.
    async invite(_me, { email, name }) {
      const addr = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(addr)) throw new Refusal(400, 'That email does not look right.');
      const { data, error } = await admin.auth.admin.inviteUserByEmail(addr, {
        data: { display_name: String(name || '').trim().slice(0, 60) },
        redirectTo: site + '/atlas/',
      });
      if (error) throw new Refusal(400, /registered|exists/i.test(error.message) ? 'That email already has an account.' : error.message);
      if (name) await admin.from('access_requests').update({ name: String(name).trim().slice(0, 60) }).eq('user_id', data.user.id);
      return { id: data.user.id };
    },

    async update(_me, { id, email, name }) {
      const u = await userById(id);
      const patch = {};
      if (email !== undefined && String(email).trim().toLowerCase() !== u.email) {
        const addr = String(email).trim().toLowerCase();
        if (!EMAIL_RE.test(addr)) throw new Refusal(400, 'That email does not look right.');
        patch.email = addr;
        patch.email_confirm = true;
      }
      if (name !== undefined) patch.user_metadata = { ...(u.user_metadata || {}), display_name: String(name).trim().slice(0, 60) };
      if (Object.keys(patch).length) {
        const { error } = await admin.auth.admin.updateUserById(id, patch);
        if (error) throw new Refusal(400, /registered|exists/i.test(error.message) ? 'That email already has an account.' : error.message);
      }
      const row = {};
      if (patch.email) row.email = patch.email;
      if (name !== undefined) row.name = String(name).trim().slice(0, 60);
      if (Object.keys(row).length) await admin.from('access_requests').update(row).eq('user_id', id);
      return { ok: true };
    },

    async reset(_me, { id }) {
      const u = await userById(id);
      const { error } = await admin.auth.resetPasswordForEmail(u.email, { redirectTo: site + '/atlas/' });
      if (error) throw new Refusal(400, error.message);
      return { ok: true };
    },

    // A second invite for somebody who never accepted the first, or a second
    // confirmation for somebody who signed up and never clicked it.
    async resend(_me, { id }) {
      const u = await userById(id);
      if (u.email_confirmed_at) throw new Refusal(400, 'Already confirmed.');
      const { error } = u.invited_at
        ? await admin.auth.admin.inviteUserByEmail(u.email, { redirectTo: site + '/atlas/' })
        : await admin.auth.resend({ type: 'signup', email: u.email, options: { emailRedirectTo: site + '/account/' } });
      if (error) throw new Refusal(400, error.message);
      return { ok: true };
    },

    async ban(me, { id, hours }) {
      notSelf(me, id, 'ban');
      await userById(id);
      // A number, not something that coerces to one: Number(null) is 0, and 0
      // lifts a ban.
      const h = hours;
      if (typeof h !== 'number' || !Number.isInteger(h) || h < 0) throw new Refusal(400, 'Hours must be a whole number.');
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: h === 0 ? 'none' : `${h}h` });
      if (error) throw new Refusal(400, error.message);
      return { ok: true };
    },

    async delete(me, { id }) {
      notSelf(me, id, 'delete');
      await userById(id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Refusal(400, error.message);
      return { ok: true };
    },

    // Ric's own words, to one person or many. One email each, so nobody sees
    // anybody else's address. `to` is addresses rather than ids so the same
    // door serves KONDRITE's pilots, whose accounts live in another project.
    async email(_me, { to, subject, text }) {
      const list = [...new Set((Array.isArray(to) ? to : []).map((a) => String(a).trim().toLowerCase()))].filter(Boolean);
      if (!list.length) throw new Refusal(400, 'Pick at least one person.');
      if (list.length > MAX_RECIPIENTS) throw new Refusal(400, `${MAX_RECIPIENTS} people at most per send.`);
      if (list.some((a) => !EMAIL_RE.test(a))) throw new Refusal(400, 'One of those addresses does not look right.');
      const subj = String(subject || '').trim();
      const body = String(text || '').trim();
      if (!subj || subj.length > 150) throw new Refusal(400, 'A subject, up to 150 characters.');
      if (!body || body.length > 10000) throw new Refusal(400, 'A message, up to 10,000 characters.');
      if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Refusal(503, 'Email is not set up yet — see admin/README.md.');
      const res = await fetchFn('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(list.map((addr) => composeMail({
          from: env.MAIL_FROM, replyTo: env.MAIL_REPLY_TO, to: addr, subject: subj, text: body,
        }))),
      });
      if (!res.ok) {
        let msg = `Resend said ${res.status}`;
        try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (_) { /* keep the status */ }
        throw new Refusal(502, msg);
      }
      return { sent: list.length };
    },
  };

  return async function handle(req) {
    const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      if (req.method !== 'POST') throw new Refusal(405, 'POST only.');
      const me = await callerOf(req);
      let body;
      try { body = await req.json(); } catch (_) { throw new Refusal(400, 'Send JSON.'); }
      const act = body && Object.prototype.hasOwnProperty.call(actions, body.action) ? actions[body.action] : null;
      if (!act) throw new Refusal(400, 'Unknown action.');
      const out = await act(me, body);
      return new Response(JSON.stringify(out), { status: 200, headers });
    } catch (err) {
      const status = err instanceof Refusal ? err.status : 500;
      const message = err instanceof Refusal ? err.message : 'Something went wrong.';
      return new Response(JSON.stringify({ error: message }), { status, headers });
    }
  };
}

// Deno only. Node imports this file for the tests and never reaches here.
if (globalThis.Deno) {
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const env = globalThis.Deno.env.toObject();
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  globalThis.Deno.serve(createHandler({ admin, env, fetch: globalThis.fetch }));
}
