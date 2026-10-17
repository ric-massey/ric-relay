/* Nothing tracked that .gitignore ignores. A file committed before its ignore
   rule stays tracked — and, because the site has .nojekyll, served by Pages
   even from a dot-folder. projects/kondrite/server/passthrough/.wrangler/
   cache/wrangler-account.json was (bug sweep A5-3, 2026-10-17). */
import { execFileSync } from 'node:child_process';
const out = execFileSync('git', ['ls-files', '-ci', '--exclude-standard'], { encoding: 'utf8' }).trim();
if (out) {
  console.log('FAIL  tracked but ignored — `git rm --cached` these:\n' + out);
  process.exit(1);
}
console.log('ok    nothing tracked is ignored');
