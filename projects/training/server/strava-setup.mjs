/* STRAVA — the one-time wiring
   ────────────────────────────────────────────────────────────────────────────
   Everything here happens once. After it, a run finishes, the watch syncs, and
   the session on the plan for that date ticks itself off with nobody opening
   the site.

       node projects/training/server/strava-setup.mjs authorize
       node projects/training/server/strava-setup.mjs subscribe
       node projects/training/server/strava-setup.mjs status
       node projects/training/server/strava-setup.mjs unsubscribe

   ── what is a secret and what is not ──
   The client id is not (it appears in a URL a browser visits). The client
   secret and the refresh token are, so they live in the macOS Keychain here and
   in Cloudflare secrets there, exactly like the board passwords and the Apex
   key. Nothing in this file is ever written into the repo, and this script
   never prints the client secret.

   The refresh token IS printed once, by `authorize`, because there is no other
   way to get it into `wrangler secret put`. That is a terminal on Ric's own
   machine. It is not written to a file.

   ── before running any of this ──
   Make an API application at https://www.strava.com/settings/api
     · "Authorization Callback Domain" must be exactly:  localhost
       (that is for the one-time authorize below. The webhook callback is a
       different thing and is not checked against this field.)
   Then, once:

       echo '{"client_id":"YOUR_ID"}' > projects/training/server/strava-account.json
       security add-generic-password -s strava-api -a YOUR_ID -U -w

   The second one prompts for the client secret without echoing it. Do not pass
   -w with a value on the command line: that puts the secret in your shell
   history. */

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACCOUNT = join(HERE, 'strava-account.json');
const KEYCHAIN = 'strava-api';
const PORT = 8788;

/* The deployed Worker. Change this if the workers.dev subdomain differs — it is
   the same host training.html already talks to. */
const CALLBACK = 'https://training-log.rmbuster82.workers.dev/strava';

const die = msg => { console.error('\n' + msg + '\n'); process.exit(1); };

function clientId() {
  try {
    const id = String(JSON.parse(readFileSync(ACCOUNT, 'utf8')).client_id || '').trim();
    if (id) return id;
  } catch {}
  die(`No client id. Make the file (it is gitignored):\n\n` +
      `    echo '{"client_id":"YOUR_ID"}' > ${ACCOUNT}`);
}

/* Read once, passed straight to Strava, never printed and never stored. */
function clientSecret(id) {
  try {
    return execFileSync('security',
      ['find-generic-password', '-s', KEYCHAIN, '-a', id, '-w'],
      { encoding: 'utf8' }).trim();
  } catch {
    die(`No Keychain entry for client id ${id}. Add it once — this prompts\n` +
        `without echoing, and keeps it out of your shell history:\n\n` +
        `    security add-generic-password -s ${KEYCHAIN} -a ${id} -U -w`);
  }
}

const post = async (url, body) => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
};

/* ── authorize ──────────────────────────────────────────────────────────────
   The only step that needs a browser. Strava sends the code back to localhost,
   this catches it, trades it for a refresh token and prints the commands to put
   everything into Cloudflare.

   activity:read_all rather than activity:read, so a run marked "Only You" still
   ticks its session. It does NOT mean such a run gets published: the Worker
   records a private run's existence and nothing else — no name, no distance —
   and the public feed leaves it out. Private on Strava stays private here. */
async function authorize() {
  const id = clientId();
  const secret = clientSecret(id);
  const redirect = `http://localhost:${PORT}/exchange`;
  const url = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(id)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&approval_prompt=force` +
    `&scope=activity:read_all`;

  console.log('\nOpen this, and click Authorize:\n\n  ' + url + '\n');
  console.log('Waiting for Strava to come back...');

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, `http://localhost:${PORT}`);
      if (u.pathname !== '/exchange') { res.writeHead(404).end(); return; }
      const got = u.searchParams.get('code');
      const scope = u.searchParams.get('scope') || '';
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(got
        ? '<h1>Done.</h1><p>Back to the terminal.</p>'
        : '<h1>No code came back.</h1><p>Try again.</p>');
      server.close();
      if (!got) return reject(new Error('Strava returned no code: ' + (u.searchParams.get('error') || 'unknown')));
      if (!scope.includes('activity:read_all')) {
        return reject(new Error('The activity:read_all box was not ticked — runs marked private would never tick a session. Run authorize again.'));
      }
      resolve(got);
    });
    server.listen(PORT);
    /* Unreffed, or the five minutes outlive the authorize they were guarding:
       a pending timer keeps Node's event loop alive, so the prompt does not
       come back until it fires — long after the instructions have printed, and
       looking for all the world like the script has hung. It still fires if
       nothing else is keeping the process up, which is the case it is for. */
    const bail = setTimeout(() => { server.close(); reject(new Error('Timed out after five minutes.')); }, 5 * 60 * 1000);
    bail.unref();
  }).catch(e => die(e.message));

  const r = await post('https://www.strava.com/oauth/token',
    { client_id: id, client_secret: secret, code, grant_type: 'authorization_code' });
  if (!r.ok) die('Strava refused the code exchange: ' + r.status + ' ' + JSON.stringify(r.json));

  const athlete = r.json.athlete && r.json.athlete.id;
  console.log(`
─────────────────────────────────────────────────────────────────────────────
Authorized as athlete ${athlete}.

Now put it into Cloudflare. Run these from ${HERE},
pasting the value when each one prompts:

    npx wrangler@latest secret put STRAVA_CLIENT_ID        ${id}
    npx wrangler@latest secret put STRAVA_CLIENT_SECRET    (the one in your Keychain)
    npx wrangler@latest secret put STRAVA_ATHLETE_ID       ${athlete}
    npx wrangler@latest secret put STRAVA_REFRESH_TOKEN

      ${r.json.refresh_token}

    npx wrangler@latest secret put STRAVA_VERIFY_TOKEN
      (invent a long random string; you will need the same one for "subscribe",
       so put it in the Keychain too:
         security add-generic-password -s strava-verify -a ${id} -U -w )

Then:  npx wrangler@latest deploy
And:   node projects/training/server/strava-setup.mjs subscribe

The refresh token above is a SEED. Strava rotates it, and from the first
refresh onward the live one lives in the Worker's storage, not here.

So if you ever run "authorize" again, run the STRAVA_REFRESH_TOKEN line again
too, with the new seed. Strava invalidates a refresh token the moment it hands
out its replacement, and the token the Worker is holding is not exempt: leave
the old one in place and the next sync fails, quietly, on a token that worked
this morning.
─────────────────────────────────────────────────────────────────────────────
`);
}

function verifyToken(id) {
  try {
    return execFileSync('security',
      ['find-generic-password', '-s', 'strava-verify', '-a', id, '-w'],
      { encoding: 'utf8' }).trim();
  } catch {
    die(`No verify token in the Keychain. It has to be the SAME string you gave\n` +
        `to \`wrangler secret put STRAVA_VERIFY_TOKEN\`. Store it once:\n\n` +
        `    security add-generic-password -s strava-verify -a ${id} -U -w`);
  }
}

/* ── subscribe ──────────────────────────────────────────────────────────────
   Strava calls the callback back DURING this request and expects the challenge
   echoed within two seconds, so the Worker must already be deployed with
   STRAVA_VERIFY_TOKEN set. One subscription per application — creating a second
   is an error, not a second feed. */
async function subscribe() {
  const id = clientId();
  const secret = clientSecret(id);
  const verify = verifyToken(id);

  const r = await post('https://www.strava.com/api/v3/push_subscriptions',
    { client_id: id, client_secret: secret, callback_url: CALLBACK, verify_token: verify });

  if (!r.ok) {
    die('Strava refused the subscription: ' + r.status + ' ' + JSON.stringify(r.json) +
      `\n\nThe usual causes, in order:\n` +
      `  · the Worker is not deployed yet, or STRAVA_VERIFY_TOKEN is not set on it\n` +
      `  · the token in your Keychain is not the one in Cloudflare\n` +
      `  · a subscription already exists — run \`status\`\n` +
      `  · ${CALLBACK} is wrong for your workers.dev subdomain`);
  }
  console.log(`\nSubscribed. id ${r.json.id} → ${CALLBACK}\n\nGo for a run.\n`);
}

async function status() {
  const id = clientId();
  const secret = clientSecret(id);
  const u = new URL('https://www.strava.com/api/v3/push_subscriptions');
  u.searchParams.set('client_id', id);
  u.searchParams.set('client_secret', secret);
  const r = await fetch(u);
  const j = await r.json().catch(() => []);
  if (!r.ok) die('Strava said ' + r.status + ': ' + JSON.stringify(j));
  if (!j.length) return console.log('\nNo subscription. Run `subscribe`.\n');
  for (const s of j) console.log(`\n  id ${s.id}\n  → ${s.callback_url}\n  since ${s.created_at}\n`);
}

async function unsubscribe() {
  const id = clientId();
  const secret = clientSecret(id);
  const u = new URL('https://www.strava.com/api/v3/push_subscriptions');
  u.searchParams.set('client_id', id);
  u.searchParams.set('client_secret', secret);
  const list = await (await fetch(u)).json().catch(() => []);
  if (!list.length) return console.log('\nNothing to remove.\n');
  for (const s of list) {
    const d = new URL('https://www.strava.com/api/v3/push_subscriptions/' + s.id);
    d.searchParams.set('client_id', id);
    d.searchParams.set('client_secret', secret);
    const r = await fetch(d, { method: 'DELETE' });
    console.log(r.ok ? `removed ${s.id}` : `could not remove ${s.id}: ${r.status}`);
  }
}

const cmd = process.argv[2];
const jobs = { authorize, subscribe, status, unsubscribe };
if (!jobs[cmd]) {
  console.log(`\nusage: node ${process.argv[1].split('/').pop()} <authorize|subscribe|status|unsubscribe>\n`);
  process.exit(1);
}
await jobs[cmd]();
