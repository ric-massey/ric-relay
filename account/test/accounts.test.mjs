// The `accounts` roster: Ric's list of every site account and KONDRITE pilot.
//
// Two halves, because the roster is two things. The database half is
// projects/kondrite/supabase/admin.sql — every door there is a SECURITY DEFINER
// function reading past row-level security into auth.users, so one missing
// is_admin() line hands every player's email to anybody with an account. It is
// read here as text, the way atlas/test/security.test.mjs reads ATLAS's
// migrations, because no CI run has a Postgres to try it against.
//
// The browser half is account/kondrite.js, run in a sandbox against a fake
// Supabase: player-chosen names drawn as markup, the game's session shared
// and refreshed, and what each refusal says.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const SQL = read('projects/kondrite/supabase/admin.sql');
const SCHEMA = read('projects/kondrite/supabase/schema.sql');
const CLOUD = read('projects/kondrite/cloud.js');
const ADMIN_JS = read('account/kondrite.js');

// Strip comments so a guard mentioned in prose cannot stand in for a real one.
const code = SQL.replace(/--[^\n]*/g, '');
const functions = [...code.matchAll(
  /create or replace function public\.(\w+)\(([^)]*)\)([\s\S]*?)\$\$([\s\S]*?)\$\$;/g,
)].map(([, name, params, head, body]) => ({ name, params, head, body }));

// ── the database half ──────────────────────────────────────────────────────

test('admin.sql defines the functions the page calls', () => {
  const names = functions.map((f) => f.name);
  for (const want of ['is_admin', 'admin_pilots', 'admin_rename_pilot', 'admin_wipe_save',
    'admin_clear_scores', 'admin_ban_pilot', 'admin_delete_pilot']) {
    assert.ok(names.includes(want), `admin.sql has no ${want}()`);
  }
});

test('every function is security definer with a pinned search_path', () => {
  for (const f of functions) {
    assert.match(f.head, /security definer/, `${f.name}() is not security definer`);
    assert.match(f.head, /set search_path = public/, `${f.name}() leaves search_path open`);
  }
});

test('every admin_ function asks is_admin() before it does anything', () => {
  for (const f of functions.filter((x) => x.name.startsWith('admin_'))) {
    const begin = f.body.indexOf('begin');
    assert.ok(begin >= 0, `${f.name}() is not plpgsql — it has nowhere to refuse`);
    const first = f.body.slice(begin + 5).trim();
    assert.match(first, /^if not public\.is_admin\(\) then\s+raise exception 'admins only' using errcode = '42501';/,
      `${f.name}()'s first statement is not the admin check`);
  }
});

test('anon can run none of them, and authenticated can run each', () => {
  for (const f of functions) {
    const sig = f.params.split(',').map((p) => p.trim().split(/\s+/).slice(1).join(' ')).filter(Boolean).join(', ');
    const call = `public.${f.name}(${sig})`;
    assert.ok(code.includes(`revoke all on function ${call} from public, anon;`), `no revoke for ${call}`);
    assert.ok(code.includes(`grant execute on function ${call} to authenticated;`), `no grant for ${call}`);
    assert.ok(!new RegExp(`grant[^;]*${f.name}[^;]*to[^;]*anon`).test(code), `${f.name}() is granted to anon`);
  }
});

test('nobody makes themself an admin from a browser', () => {
  assert.match(code, /alter table public\.admins enable row level security;/);
  assert.ok(!/create policy[^;]*on public\.admins[^;]*for (insert|update|delete|all)/i.test(code),
    'a write policy on admins would let any account promote itself');
  assert.match(code, /revoke insert, update, delete on public\.admins from anon, authenticated;/);
});

test('ban and delete refuse the admin themself', () => {
  for (const name of ['admin_ban_pilot', 'admin_delete_pilot']) {
    const f = functions.find((x) => x.name === name);
    assert.match(f.body, /if target = auth\.uid\(\) then\s+raise exception/, `${name}() lets Ric lock himself out`);
  }
});

test('the roster never carries a save book, only its size', () => {
  const f = functions.find((x) => x.name === 'admin_pilots');
  assert.ok(!/s\.book(?!\))/.test(f.body.replace(/length\(s\.book\)/g, '')), 'admin_pilots() returns the book itself');
});

test('a rename meets the same name rule as the game and the table', () => {
  const pilot = CLOUD.match(/ok: n => \/(.+?)\/\.test\(n\)/)[1];
  const table = SCHEMA.match(/check \(name ~ '(.+?)'\)/)[1];
  const rename = functions.find((x) => x.name === 'admin_rename_pilot').body.match(/clean !~ '(.+?)'/)[1];
  assert.equal(table, pilot, 'schema.sql and cloud.js disagree about a name');
  assert.equal(rename, pilot, 'admin_rename_pilot() and cloud.js disagree about a name');
});

test('no email address is written into the repo', () => {
  for (const [file, text] of [['admin.sql', SQL], ['kondrite.js', ADMIN_JS]]) {
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), `${file} has an email address in it`);
  }
});

test('the terminal and the page are wired together', () => {
  const index = read('index.html');
  assert.match(index, /accounts: \(\) => \{\s+setTimeout\(\(\) => \(location\.href = "account\/#people"\)/);
  const page = read('account/index.html');
  assert.match(page, /id="people"/);
  const order = ['../projects/kondrite/config.js', 'kondrite.js', 'account.js'].map((s) => page.indexOf(`src="${s}"`));
  assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2],
    'config.js, then kondrite.js, then account.js');
  assert.ok(read('EASTER_EGGS.md').includes('| `accounts` |'), 'EASTER_EGGS.md does not list `accounts`');
});

// ── the browser half ───────────────────────────────────────────────────────

test('the page calls only functions admin.sql defines, with its argument names', () => {
  const defined = Object.fromEntries(functions.map((f) => [f.name,
    f.params.split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean).sort().join(',')]));
  const calls = [...ADMIN_JS.matchAll(/fn = '(\w+)'; args = \{ ([^}]*) \}/g)];
  assert.ok(calls.length >= 5);
  for (const [, fn, args] of calls) {
    assert.ok(defined[fn] !== undefined, `kondrite.js calls ${fn}(), which admin.sql does not define`);
    const names = args.split(',').map((a) => a.split(':')[0].trim()).sort().join(',');
    assert.equal(names, defined[fn], `${fn}() is called with (${names}), defined with (${defined[fn]})`);
  }
});

test('the shared session key is the one the game writes', () => {
  const game = CLOUD.match(/const SESSION_KEY = "([^"]+)"/)[1];
  const page = ADMIN_JS.match(/const SESSION_KEY = '([^']+)'/)[1];
  assert.equal(page, game);
});

// A fake element: enough DOM for kondrite.js. Children are created the first
// time something asks for an id that the element's markup contains.
function fakeEl() {
  const el = {
    innerHTML: '', textContent: '', dataset: {}, disabled: false, value: '',
    classList: { toggle() {} }, listeners: {}, kids: {},
    addEventListener(type, fn) { (el.listeners[type] ||= []).push(fn); },
    querySelector(sel) {
      const id = (sel.match(/^#([\w-]+)$/) || [])[1];
      if (id) {
        if (!el.innerHTML.includes(`id="${id}"`)) return null;
        return (el.kids[id] ||= fakeEl());
      }
      const name = (sel.match(/data-name="([^"]+)"/) || [])[1];
      if (name) return (el.kids['name:' + name] ||= Object.assign(fakeEl(), { value: '' }));
      return null;
    },
  };
  return el;
}

function harness({ session = null, rpc = {}, now = 1_700_000_000_000, answers = {}, offline = false } = {}) {
  const store = new Map(session ? [['kondrite.account.v1', JSON.stringify(session)]] : []);
  const calls = [];
  const html = [];
  const sandbox = {
    window: { KONDRITE_CLOUD: { url: 'https://example.supabase.co', anonKey: 'sb_publishable_test' } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    CSS: { escape: (s) => s },
    confirm: () => answers.confirm ?? true,
    prompt: () => answers.prompt ?? '',
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } },
    async fetch(url, opts) {
      if (offline) throw new TypeError('Failed to fetch');
      const p = url.replace('https://example.supabase.co', '');
      const body = opts.body ? JSON.parse(opts.body) : undefined;
      calls.push({ path: p, body, auth: opts.headers.Authorization });
      const hit = Object.entries(rpc).find(([k]) => p.startsWith(k));
      const [status, json] = hit ? (typeof hit[1] === 'function' ? hit[1](body) : hit[1]) : [404, { code: 'PGRST202', message: 'no route' }];
      return { ok: status < 300, status, text: async () => (json === undefined ? '' : JSON.stringify(json)) };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(ADMIN_JS, sandbox);
  const root = fakeEl();
  const all = () => [root.innerHTML, ...Object.values(root.kids).map((k) => k.innerHTML + ' ' + k.textContent)].join('\n');
  const click = async (kd, user) => {
    const button = { dataset: { kd, user }, disabled: false };
    for (const fn of root.listeners.click) fn({ target: { closest: () => button } });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };
  return { admin: sandbox.window.KondriteAdmin, root, calls, store, all, click, html };
}

const LIVE = { access: 'a1', refresh: 'r1', userId: 'ric', email: 'r@x', name: 'ric', expires: 1_700_000_000_000 + 60_000 };
const pilot = (over = {}) => ({
  user_id: 'u1', email: 'p@x', name: 'Pilot', board_name: 'Pilot', created_at: '2026-10-01T00:00:00Z',
  last_sign_in_at: null, confirmed: true, banned_until: null, is_admin: false, has_save: false,
  save_seed: null, save_updated_at: null, save_bytes: 0, best: {}, reports: 0, ...over,
});

test('no KONDRITE session means a sign-in form, and no request at all', async () => {
  const h = harness();
  await h.admin.mount(h.root);
  assert.match(h.root.innerHTML, /id="kd-form"/);
  assert.equal(h.calls.length, 0);
});

test('a name a player chose is drawn as text, never as markup', async () => {
  const evil = '<img src=x onerror=alert(1)>';
  const h = harness({
    session: LIVE,
    rpc: { '/rest/v1/rpc/admin_pilots': [200, [pilot({ name: evil, email: `"><script>x</script>`, save_seed: '<b>' , has_save: true, best: { '<i>': 3 } })]] },
  });
  await h.admin.mount(h.root);
  const out = h.all();
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'), 'the name is not on the page at all');
  assert.ok(!/<img|<script|<b>|<i>/.test(out), 'a player-chosen string reached the page as markup');
});

test('an expired token is refreshed first, and the game\'s session is updated in its own shape', async () => {
  const h = harness({
    session: { ...LIVE, expires: 1 },
    rpc: {
      '/auth/v1/token?grant_type=refresh_token': [200, { access_token: 'a2', refresh_token: 'r2', expires_in: 3600, user: { id: 'ric', email: 'r@x', user_metadata: { name: 'ric' } } }],
      '/rest/v1/rpc/admin_pilots': [200, []],
    },
  });
  await h.admin.mount(h.root);
  assert.equal(h.calls[0].path, '/auth/v1/token?grant_type=refresh_token');
  assert.equal(h.calls[1].auth, 'Bearer a2');
  const saved = JSON.parse(h.store.get('kondrite.account.v1'));
  assert.deepEqual(Object.keys(saved).sort(), ['access', 'email', 'expires', 'name', 'refresh', 'userId']);
  assert.equal(saved.refresh, 'r2');
});

test('a refused refresh signs out; an offline one keeps the session', async () => {
  const refused = harness({ session: { ...LIVE, expires: 1 }, rpc: { '/auth/v1/token': [400, { error: 'invalid_grant' }] } });
  await refused.admin.mount(refused.root);
  assert.equal(refused.store.has('kondrite.account.v1'), false);
  assert.match(refused.root.innerHTML, /id="kd-form"/);

  const offline = harness({ session: { ...LIVE, expires: 1 }, offline: true });
  await offline.admin.mount(offline.root);
  assert.equal(JSON.parse(offline.store.get('kondrite.account.v1')).refresh, 'r1', 'a dead network signed Ric out');
  assert.match(offline.root.innerHTML, /could not reach/);
});

test('an account that is not an admin is told so, by name', async () => {
  const h = harness({ session: LIVE, rpc: { '/rest/v1/rpc/admin_pilots': [403, { code: '42501', message: 'admins only' }] } });
  await h.admin.mount(h.root);
  assert.match(h.root.innerHTML, /r@x is not a KONDRITE admin/);
  assert.match(h.root.innerHTML, /id="kd-form"/);
});

test('admin.sql not run yet says which file to run', async () => {
  const h = harness({ session: LIVE });
  await h.admin.mount(h.root);
  assert.match(h.root.innerHTML, /run <b>projects\/kondrite\/supabase\/admin\.sql<\/b>/);
});

test('search narrows by name or email and says how many', async () => {
  const h = harness({ session: LIVE, rpc: { '/rest/v1/rpc/admin_pilots': [200, [pilot(), pilot({ user_id: 'u2', name: 'Comet', email: 'c@y' })]] } });
  await h.admin.mount(h.root);
  h.admin.filter('C@Y');
  const list = h.root.kids['kd-list'].innerHTML;
  assert.ok(list.includes('Comet') && !list.includes('>Pilot<'));
  assert.equal(h.root.kids['kd-count'].textContent, '1 of 2');
  h.admin.filter('nobody');
  assert.match(h.root.kids['kd-list'].innerHTML, /no pilot matches/);
});

test('filtering before the panel is mounted does not throw', () => {
  const h = harness();
  h.admin.filter('x');
});

test('admins get no ban or delete button; banned pilots get unban', async () => {
  const h = harness({ session: LIVE, rpc: { '/rest/v1/rpc/admin_pilots': [200, [
    pilot({ user_id: 'me', is_admin: true }), pilot({ user_id: 'b', banned_until: '2099-01-01T00:00:00Z' }),
  ]] } });
  await h.admin.mount(h.root);
  const list = h.root.kids['kd-list'].innerHTML;
  assert.ok(!/data-kd="(ban|delete)" data-user="me"/.test(list));
  assert.match(list, /data-kd="unban" data-user="b"/);
  assert.match(list, /banned to/);
});

test('ban: blank means forever, a number means hours, nonsense is refused', async () => {
  const sent = [];
  const rpc = {
    '/rest/v1/rpc/admin_pilots': [200, [pilot()]],
    '/rest/v1/rpc/admin_ban_pilot': (body) => { sent.push(body); return [200, null]; },
  };
  for (const [answer, want] of [['', 24 * 365 * 100], ['48', 48], ['soon', null], ['-3', null]]) {
    const h = harness({ session: LIVE, rpc, answers: { prompt: answer } });
    await h.admin.mount(h.root);
    sent.length = 0;
    await h.click('ban', 'u1');
    assert.deepEqual(sent, want === null ? [] : [{ target: 'u1', hours: want }], `prompt "${answer}"`);
  }
});

test('a declined confirm sends nothing', async () => {
  const h = harness({ session: LIVE, answers: { confirm: false }, rpc: { '/rest/v1/rpc/admin_pilots': [200, [pilot({ has_save: true, reports: 2 })]] } });
  await h.admin.mount(h.root);
  const before = h.calls.length;
  for (const kd of ['wipe', 'scores', 'delete']) await h.click(kd, 'u1');
  assert.equal(h.calls.length, before);
});

test('rename sends what is typed in that pilot\'s box, and a taken name says so', async () => {
  const h = harness({ session: LIVE, rpc: {
    '/rest/v1/rpc/admin_pilots': [200, [pilot()]],
    '/rest/v1/rpc/admin_rename_pilot': [409, { code: '23505', message: 'that name is taken' }],
  } });
  await h.admin.mount(h.root);
  h.root.querySelector('input[data-name="u1"]').value = 'Nova';
  await h.click('rename', 'u1');
  const call = h.calls.find((c) => c.path.endsWith('admin_rename_pilot'));
  assert.deepEqual(call.body, { target: 'u1', new_name: 'Nova' });
  assert.equal(h.root.kids['kd-msg'].textContent, 'that name is taken.');
});

for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log(`\n${tests.length} passed`);
