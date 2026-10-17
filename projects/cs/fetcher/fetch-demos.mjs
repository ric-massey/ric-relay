// Download Ric's CS2 demos without anyone pressing Download.
//
//     node projects/cs/fetcher/fetch-demos.mjs
//
// sync.py runs this first. It takes every match Valve still has a demo for
// that the archive doesn't (share codes from steam.py / pull-leetify.py, in
// .cs-state.json), signs the BOT account into Steam with the token saved by
// login.mjs, briefly "launches" CS2 as that account so Valve's game
// coordinator will talk to it, asks for each match by share code, and
// downloads the demo the answer points at into projects/cs/demos/ — where
// parse-demos.py, the very next step, picks it up.
//
// The bot never plays and never touches Ric's account. Nothing here is
// published: share codes and the token stay on this machine.

import SteamUser from "steam-user";
import GlobalOffensive from "globaloffensive";
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CS = path.join(HERE, "..");
const STATE = path.join(CS, ".cs-state.json");
const DATA = path.join(CS, "cs-data.js");
const INBOX = path.join(CS, "demos");
const DEMO_DAYS = 28;           // Valve's link lasts about a month
const PER_MATCH_MS = 20_000;
const OVERALL_MS = 10 * 60_000;

const say = (m) => console.log(`fetch: ${m}`);
// A failure exits non-zero so sync.py raises its toast — a bot that stopped
// working silently costs every replay until someone reads the log, and
// Valve's links are gone in a month. "Nothing to do" and "no bot set up"
// stay 0.
setTimeout(() => { say("gave up after 10 minutes"); process.exit(1); }, OVERALL_MS).unref();

const creds = (verb, target, input) =>
  spawnSync(process.env.CS_PYTHON || "python", [path.join(CS, "creds.py"), verb, target], { input, encoding: "utf8" });

const readJSON = (p, fallback) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } };
const state = readJSON(STATE, {});
const data = (() => {
  try { const t = readFileSync(DATA, "utf8"); return JSON.parse(t.slice(t.indexOf("=") + 1).trim().replace(/;$/, "")); }
  catch { return { matches: [] }; }
})();
const saveState = () => {
  // re-read first: never clobber what another step wrote
  const now = readJSON(STATE, {});
  now.fetched = { ...(now.fetched || {}), ...state.fetched };
  writeFileSync(STATE + ".tmp", JSON.stringify(now, null, 1));
  renameSync(STATE + ".tmp", STATE);
};

// ── what's still out there ──
const have = new Set([
  ...Object.values(state.parsed || {}),
  ...data.matches.filter((m) => (m.sources || []).includes("demo")).map((m) => m.valve_id),
]);
const when = Object.fromEntries(data.matches.filter((m) => m.valve_id).map((m) => [m.valve_id, m.at]));
const cutoff = Date.now() - DEMO_DAYS * 864e5;
state.fetched = state.fetched || {};
const todo = Object.entries(state.codes || {}).filter(([vid]) => {
  if (have.has(vid) || state.fetched[vid]?.file) return false;
  const t = Date.parse(when[vid] || (state.seen || {})[vid] || "");
  return !t || t > cutoff;
});
if (!todo.length) { say("nothing to fetch"); process.exit(0); }

const token = creds("get", "ric-terminal/cs-bot");
if (token.status !== 0 || !token.stdout) {
  say(`${todo.length} demo(s) waiting, but no bot is signed in — run fetcher/login.mjs once`);
  process.exit(0);
}

// ── sign the bot in and ask ──
const user = new SteamUser({ renewRefreshTokens: true });
const csgo = new GlobalOffensive(user);
user.on("refreshToken", (t) => creds("set", "ric-terminal/cs-bot", t));
user.on("error", (e) => {
  say(/InvalidPassword|AccessDenied|Expired|Revoked/i.test(e.message)
    ? "the bot's saved sign-in was refused — run fetcher/login.mjs again"
    : `Steam sign-in failed: ${e.message}`);
  process.exit(1);
});
user.on("loggedOn", () => user.gamesPlayed([730]));

const ask = (code) => new Promise((resolve) => {
  const done = (v) => { clearTimeout(t); csgo.removeListener("matchList", on); resolve(v); };
  const on = (matches) => done(matches && matches[0]);
  const t = setTimeout(() => done(null), PER_MATCH_MS);
  csgo.on("matchList", on);
  csgo.requestGame(code);
});

csgo.on("connectedToGC", async () => {
  mkdirSync(INBOX, { recursive: true });
  let got = 0;
  for (const [vid, code] of todo) {
    const match = await ask(code);
    const url = (match?.roundstatsall || []).map((r) => r.map).filter(Boolean).pop();
    if (!url) {
      state.fetched[vid] = { error: "no demo link (expired, or Valve didn't answer)", at: new Date().toISOString() };
      say(`${vid}: no demo link`);
      continue;
    }
    // CS2's own name for a downloaded demo starts match730_<matchid>_, which
    // is how parse-demos.py ties a demo to its match.
    const file = path.join(INBOX, `match730_${path.basename(new URL(url).pathname)}`);
    try {
      if (!existsSync(file)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await pipeline(Readable.fromWeb(res.body), createWriteStream(file + ".part"));
        renameSync(file + ".part", file);
      }
      state.fetched[vid] = { file: path.basename(file), at: new Date().toISOString() };
      got++;
      say(`${vid}: saved ${path.basename(file)}`);
    } catch (e) {
      state.fetched[vid] = { error: e.message, at: new Date().toISOString() };
      say(`${vid}: download failed — ${e.message}`);
    }
    saveState();
  }
  saveState();
  say(`${got} of ${todo.length} demo(s) downloaded`);
  user.gamesPlayed([]);
  user.logOff();
  setTimeout(() => process.exit(todo.length && !got ? 1 : 0), 1000);
});
user.logOn({ refreshToken: token.stdout.trim() });
