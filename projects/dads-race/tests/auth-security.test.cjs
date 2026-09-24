const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('the terminal has an undocumented hermiscus entrance', () => {
  const terminal = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  assert.match(terminal, /hermiscus:\s*\(\)\s*=>/);
  assert.match(terminal, /projects\/dads-race\/login\.html/);
  const visible = terminal.match(/const visibleCommands = \[([^;]+)\];/s)?.[1] || '';
  assert.doesNotMatch(visible, /hermiscus/);
});

test('login collects a name and a password with browser-safe autocomplete', () => {
  const login = read('login.html');
  assert.match(login, /name="name"[^>]*autocomplete="username"/);
  assert.match(login, /type="password"[^>]*autocomplete="current-password"/);
  assert.match(login, /meta name="robots" content="noindex,nofollow,noarchive"/);
});

test('every app entry loads config and auth before bootstrap', () => {
  const entries = [
    'index.html',
    ...fs.readdirSync(path.join(root, 'profiles')).map(name => `profiles/${name}/index.html`)
  ];
  for (const entry of entries) {
    const html = read(entry);
    assert.ok(html.indexOf('config.js') < html.indexOf('auth.js'), `${entry}: config before auth`);
    assert.ok(html.indexOf('auth.js') < html.indexOf('bootstrap.js'), `${entry}: auth before app`);
  }
});

test('direct race pages require a session and canonical authenticated profile', () => {
  const bootstrap = read('shared/bootstrap.js');
  assert.match(bootstrap, /HermiscusAuth\.requireSession\(\)/);
  assert.match(bootstrap, /HermiscusAuth\.ensureProfileRoute\(\)/);
  const app = (read('shared/data.js') + read('shared/original/app.js') + read('shared/ric-layer.js'));
  assert.match(app, /requestedProfile = window\.HermiscusAuth\.profileName\(\)/);
  assert.doesNotMatch(app, /requestedProfile = document\.body\.dataset\.profile/);
});

test('database calls use the signed-in access token, never the anonymous key as bearer', () => {
  const app = (read('shared/data.js') + read('shared/original/app.js') + read('shared/ric-layer.js'));
  assert.match(app, /HermiscusAuth\.authorizedHeaders/);
  assert.doesNotMatch(app, /'Authorization':'Bearer '\+SUPABASE_KEY/);
  const auth = read('shared/auth.js');
  assert.match(auth, /Authorization: `Bearer \$\{session\.access_token\}`/);
});

test('no password or privileged Supabase key is stored in source', () => {
  const files = ['shared/config.js', 'shared/auth.js', 'shared/login.js', 'login.html'];
  const source = files.map(read).join('\n');
  assert.doesNotMatch(source, /["']role["']\s*:\s*["']service_role["']|service_role\s*[:=]/i);
  assert.doesNotMatch(source, /password\s*[:=]\s*['"][^'"]+['"]/i);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*password/i);
});

test('the publishable app source has no embedded race schedule fallback', () => {
  const app = (read('shared/data.js') + read('shared/original/app.js') + read('shared/ric-layer.js'));
  assert.match(app, /Private race details belong in Supabase behind RLS/);
  assert.doesNotMatch(app, /Start — Abingdon/);
  assert.doesNotMatch(app, /ultrapacer_url:/);
});

test('prepared SQL revokes anonymous access and applies member RLS', () => {
  const sql = read('supabase/security.sql');
  assert.match(sql, /alter table public\.splits enable row level security/i);
  assert.match(sql, /revoke all on table public\.splits from anon/i);
  assert.match(sql, /public\.is_race_member\(\)/i);
  assert.match(sql, /author = public\.current_race_member_name\(\)/i);
  assert.doesNotMatch(sql, /["']role["']\s*:\s*["']service_role["']|service_role\s*[:=]/i);
});

// The website must never carry the database key or address: it runs the demo instead.
// Everything in this folder except the git-ignored config.local.js gets published.
test('no database key or project address in any file that gets published', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /^shared\/config\.local\.js$/m, 'config.local.js must stay git-ignored');
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return [full];
  });
  const published = walk(root).filter(file => path.relative(root, file) !== path.join('shared', 'config.local.js'));
  for (const file of published) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);
    assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./, `${rel}: carries a JWT`);
    assert.doesNotMatch(text, /sb_(publishable|secret)_[A-Za-z0-9_-]{10,}/, `${rel}: carries a Supabase key`);
    assert.doesNotMatch(text, /https:\/\/[a-z0-9]{20}\.supabase\.co/, `${rel}: names the database`);
  }
});

test('the committed config is keyless and only reaches for the real one on localhost', () => {
  const config = read('shared/config.js');
  assert.doesNotMatch(config, /supabaseUrl|publishableKey/);
  assert.match(config, /localhost\|127\\\.0\\\.0\\\.1/);
  assert.match(config, /config\.local\.js/);
});

test('with no key the app runs the made-up demo, never the live database', () => {
  const auth = read('shared/auth.js');
  assert.match(auth, /const demo = !config\.supabaseUrl \|\| !config\.publishableKey/);
  const bootstrap = read('shared/bootstrap.js');
  assert.match(bootstrap, /HermiscusAuth\.demo\) loadScript\(shared\('demo-data\.js'\)/);
  const demo = read('shared/demo-data.js');
  assert.match(demo, /Everything in this file is MADE UP/);
  assert.match((read('shared/data.js') + read('shared/original/app.js') + read('shared/ric-layer.js')), /window\.HermiscusDemo\.build\(Date\.now\(\)\)/);
});

// Only Ric and Sydney run Ric's version. Everyone else runs the original crew app,
// imported unchanged in look by scripts/import-original.py.
test('only Ric and Sydney get the modified app; everyone else gets the original', () => {
  const bootstrap = read('shared/bootstrap.js');
  assert.match(bootstrap, /const RIC_VERSION = \['Ric', 'Sydney'\];/);
  assert.match(bootstrap, /new URL\('original\/', sharedBase\)/);
  assert.match(read('shared/ric-layer.js'), /const MISSION_PROFILES = \['ric','sydney'\];/);
  assert.doesNotMatch(read('shared/ric-layer.js'), /ME\.role==='Crew'\); \}/);
});

// Tapping your name: back to the crew list on the website (it must not sign you out of the
// site account), but in the real app — one login per person — it still signs out.
test('leaving a profile signs out in the real app and only goes back to the list in the demo', () => {
  const auth = read('shared/auth.js');
  const leave = auth.slice(auth.indexOf('async function leaveProfile'), auth.indexOf('window.HermiscusAuth = '));
  assert.match(leave, /if \(demo\) \{ window\.location\.assign\(directoryUrl\(\)\); return; \}/);
  assert.match(leave, /await signOut\(\);\s*window\.location\.replace\(loginUrl\(\)\);/);
  assert.match(read('shared/original/app.js'), /await window\.HermiscusAuth\.leaveProfile\(\)/);
});

test('the original app keeps its own screens and drops only its data layer', () => {
  const original = read('shared/original/app.js');
  assert.match(original, /^\/\* Imported from the original crew app/);
  assert.doesNotMatch(original, /DATA LAYER|SUPABASE_KEY|function sbHeaders|function seedLocalDB/);
  assert.match(original, /const requestedProfile = window\.HermiscusAuth\.profileName\(\)/);
  assert.match(original, /await window\.HermiscusAuth\.leaveProfile\(\)/);
  assert.doesNotMatch(original, /Start — Abingdon|ultrapacer_url:/);
  // Her screens, untouched: none of Ric's additions leak in.
  assert.doesNotMatch(original, /usesMissionShell|renderRicHomeDashboard|MISSION_PROFILES/);
});
