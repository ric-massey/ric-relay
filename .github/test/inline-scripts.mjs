/* EVERY INLINE SCRIPT ON THE SITE STILL PARSES
   ────────────────────────────────────────────────────────────────────────────
   The site is mostly pages whose whole program is one <script> in the HTML,
   and until 2026-09-24 nothing in this repo would notice if one of them stopped
   being JavaScript. That day an edit to the terminal put a real line break
   inside a string literal — one character — and the front door stopped
   running: no boot, no prompt, no commands, and every suite green, because no
   suite loads index.html.

   So: every committed .html file, every inline script in it, parsed and not
   run. Classic scripts through vm.Script; modules through `node --check`, which
   is the only parser node exposes for module syntax without a flag. JSON and
   templates are data, not code, and are skipped. A parse error names the file,
   the script's position on the page, and node's own message. */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const files = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean);

const NOT_CODE = /^(application\/(ld\+)?json|importmap|text\/(template|x-template|html|plain))$/i;
const tmp = mkdtempSync(join(tmpdir(), 'inline-'));
let scripts = 0, modules = 0;
const bad = [];

for (const file of files) {
  /* Comments out first, or a comment that talks about a <script> tag is read
     as one (starfield's fly.html explains why it avoids type="module", in
     words). Replaced by their own line breaks so line numbers stay true.
     Only comments outside scripts: inside one, `<!--` is just text. */
  const html = readFileSync(join(ROOT, file), 'utf8')
    .replace(/<script\b[\s\S]*?<\/script>|<!--[\s\S]*?-->/gi,
             c => c.startsWith('<!--') ? c.replace(/[^\n]/g, '') : c);
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(html))) {
    n++;
    const attrs = m[1], body = m[2];
    if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (NOT_CODE.test(type)) continue;
    const line = html.slice(0, m.index).split('\n').length;
    const where = `${file} — script ${n}, line ${line}`;
    if (/^module$/i.test(type)) {
      modules++;
      const f = join(tmp, `m${modules}.mjs`);
      writeFileSync(f, body);
      const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
      if (r.status !== 0) {
        const msg = (r.stderr || '').split('\n').find(l => /Error/.test(l)) || 'does not parse';
        bad.push(`${where}: ${msg.trim()}`);
      }
    } else {
      scripts++;
      try { new vm.Script(body, { filename: where }); }
      catch (e) { bad.push(`${where}: ${e.message}`); }
    }
  }
}
rmSync(tmp, { recursive: true, force: true });

console.log(`  parsed     ${scripts} inline scripts and ${modules} inline modules ` +
            `across ${files.length} pages`);
if (bad.length) {
  for (const b of bad) console.error('  FAIL  ' + b);
  console.log(`inline script checks FAILED (${bad.length})`);
  process.exit(1);
}
console.log('inline script checks passed');
