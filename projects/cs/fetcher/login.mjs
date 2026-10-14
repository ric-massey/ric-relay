// One-time sign-in for the demo bot. Run it yourself, in a terminal:
//
//     node projects/cs/fetcher/login.mjs
//
// It asks for the BOT account's username, password and Steam Guard code,
// signs in once, and saves only the long-lived login token Steam hands back —
// into Windows Credential Manager (ric-terminal/cs-bot), never a file. The
// password is used for this one sign-in and then forgotten. Run it again if
// fetch-demos.mjs ever says the token was refused.
//
// Use the BOT account, never your main one: signing your main account into
// Valve's game coordinator from here would kick you out of your own game.

import SteamUser from "steam-user";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CREDS = path.join(HERE, "..", "creds.py");

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // echo nothing while the password is typed
      rl._writeToOutput = (s) => { if (!rl._muted) rl.output.write(s); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(answer.trim()); });
    if (hidden) rl._muted = true;
  });
}

const accountName = await ask("Bot account username: ");
const password = await ask("Bot account password (hidden): ", true);

const user = new SteamUser({ renewRefreshTokens: true });
user.on("steamGuard", async (domain, callback) => {
  callback(await ask(domain ? `Steam Guard code emailed to ${domain}: ` : "Steam Guard code from the app: "));
});
// Two things have to happen before we're done: the token saved, and CS2 in
// the bot's library (it's free; Valve's game coordinator ignores accounts
// that don't own it). Either can arrive first.
let saved = false, licensed = false;
const finish = () => {
  if (!saved || !licensed) return;
  console.log("Done. The bot is ready; the next CS2 session downloads your demos.");
  user.logOff();
  setTimeout(() => process.exit(0), 500);
};
user.on("refreshToken", (token) => {
  const r = spawnSync(process.env.CS_PYTHON || "python", [CREDS, "set", "ric-terminal/cs-bot"], { input: token });
  if (r.status !== 0) {
    console.error("Couldn't save the token to Credential Manager:", String(r.stderr));
    process.exit(1);
  }
  console.log("Signed in. Token saved to Credential Manager as ric-terminal/cs-bot.");
  saved = true;
  finish();
});
user.on("loggedOn", () => {
  // ownsApp needs a licence cache this script doesn't keep; asking for a free
  // licence you already have is harmless, so just ask.
  user.requestFreeLicense([730], (err) => {
    if (err) console.log(`Couldn't add CS2 automatically (${err.message}) — add it on the Store page, then you're done.`);
    else console.log("Counter-Strike 2 added to the bot's library.");
    licensed = true;
    finish();
  });
});
user.on("error", (e) => { console.error("Sign-in failed:", e.message); process.exit(1); });
user.logOn({ accountName, password });
