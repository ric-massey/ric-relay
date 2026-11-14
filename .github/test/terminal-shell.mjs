/* The terminal's shell (terminal.html): what `help` says, what Tab offers and
   what the page actually answers are three hand-kept lists, and nothing held
   them to each other. This does, without a browser — it reads the lists out
   of the page the way terminal-search.mjs reads ROOMS.

   Run: node .github/test/terminal-shell.mjs */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const page = readFileSync(join(ROOT, 'terminal.html'), 'utf8');
const door = readFileSync(join(ROOT, 'index.html'), 'utf8');

const literal = (name) => {
  const at = page.indexOf(`const ${name} = [`);
  assert.ok(at >= 0, `terminal.html declares ${name}`);
  const end = page.indexOf('];', at);
  return new Function(`return ${page.slice(page.indexOf('[', at), end + 1)}`)();
};
const HELP = literal('HELP');
const visible = literal('visibleCommands');
const ROOMS = literal('ROOMS');
const PROJECTS = literal('PROJECTS');

// the keys of the COMMANDS table, read off its source
const table = page.slice(page.indexOf('const COMMANDS = {'), page.indexOf('const out = document.getElementById("output")'));
const keys = new Set([...table.matchAll(/^      (?:"([^"]+)"|([a-z0-9]+)):/gm)].map((m) => m[1] || m[2]));
// verbs the Enter handler answers before it ever looks in COMMANDS
const HANDLED = new Set(['home', 'back', 'latest', 'recent']);
const answers = (verb) => keys.has(verb) || HANDLED.has(verb);

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

ok('every command `help` names is one the terminal answers', () => {
  for (const row of HELP.filter((r) => r.length > 1)) {
    for (const name of row[0].split(' / ')) {
      const verb = name.split(' ')[0];
      assert.ok(answers(verb), `help lists \`${name}\`, and nothing answers \`${verb}\``);
    }
  }
});

ok('a tapped command in `help` runs something real, and is the row it sits on', () => {
  for (const [name, , run] of HELP.filter((r) => r.length > 2 && r[2])) {
    assert.ok(answers(run.split(' ')[0]), `tapping \`${name}\` runs \`${run}\`, which nothing answers`);
    assert.ok(name.split(' / ').some((n) => n === run || n.startsWith(run + ' ')), `\`${name}\` runs \`${run}\`, which is a different command`);
  }
});

ok('`help` and Tab completion document the same commands', () => {
  const helped = new Set(HELP.filter((r) => r.length > 1).flatMap((r) => r[0].split(' / ').map((s) => s.replace(/ <.*$/, ''))));
  // other spellings of a documented command: completed, not listed twice
  const SYNONYMS = new Set(['help', 'commands', 'man', 'search', 'more', 'cd']);
  for (const c of visible) assert.ok(helped.has(c) || SYNONYMS.has(c), `Tab completes \`${c}\` and help never mentions it`);
  for (const c of helped) assert.ok(visible.includes(c) || c === 'help', `help lists \`${c}\` and Tab does not complete it`);
  assert.ok(visible.includes('help'));
});

ok('everything Tab completes is answered', () => {
  for (const c of visible) assert.ok(answers(c.split(' ')[0]), `Tab completes \`${c}\`, and nothing answers it`);
});

ok('no command shadows a room or a project shortcut', () => {
  // A room name is checked before COMMANDS, a project before both: a command
  // with the same name would be unreachable, or steal the room.
  const names = new Set([...ROOMS.map((r) => r.name), ...PROJECTS.flatMap((p) => [p.command, ...p.aliases])]);
  for (const k of keys) assert.ok(!names.has(k), `\`${k}\` is both a command and a room or project`);
});

ok('every row `ls`, `tree` and `projects` links to is a file here', () => {
  // A fragment or query is not part of a filename.
  for (const { href } of [...ROOMS, ...PROJECTS]) assert.ok(existsSync(join(ROOT, href.split(/[?#]/)[0])), `${href} does not exist`);
});

ok('the prompt is typeable on a phone and its answers are announced', () => {
  const input = page.match(/<input id="cmd"[^>]*>/)[0];
  // without these a phone turns `ls` into `Is` and `help` into `Help`
  for (const attr of ['autocapitalize="none"', 'autocorrect="off"', 'spellcheck="false"', 'autocomplete="off"']) {
    assert.ok(input.includes(attr), `#cmd keeps ${attr}`);
  }
  assert.match(page.match(/<div id="output"[^>]*>/)[0], /role="log"/, '#output is a log, so a screen reader hears what a command printed');
  // iOS zooms the page when an input under 16px is focused
  assert.match(page, /#cmd \{ font-size: 16px; \}/);
});

ok('the hints under the prompt run commands that exist', () => {
  const hints = [...page.matchAll(/class="cmd-hint" data-run="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hints.length >= 2, 'the /help and /ls hints are buttons');
  for (const h of hints) assert.ok(answers(h.split(' ')[0]), `a hint runs \`${h}\`, which nothing answers`);
});

ok('the front door draws the terminal\'s lines as the terminal does', () => {
  // .res is also a badge on that page; the panel's rule has to undo it
  const rule = door.match(/\.term-out a\.res \{[^}]*\}/)[0];
  for (const reset of ['display: inline', 'padding: 0', 'vertical-align: baseline']) assert.ok(rule.includes(reset), `.term-out a.res resets ${reset}`);
  assert.match(page, /indent: \+d\.style\.getPropertyValue\("--in"\)/, 'the terminal sends each line\'s hanging indent');
  assert.match(door, /l\.indent/, 'and the front door applies it');
});

console.log(`\n${n} checks passed`);
