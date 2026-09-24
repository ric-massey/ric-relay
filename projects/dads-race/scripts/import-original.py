#!/usr/bin/env python3
"""Bring the sister's crew app in as shared/original/, unchanged in look.

    python3 scripts/import-original.py ~/Downloads/hermesco-deploy.zip
    python3 scripts/import-original.py path/to/index.html

Her app is one index.html. Everyone except Ric and Sydney runs it as she wrote it:
her styles, her screens, her code. The only things swapped out are the plumbing:

  - her DATA LAYER (which carries the database key) is dropped; shared/data.js
    replaces it, with sign-in headers, the offline queue and the made-up demo;
  - picking a profile goes to that person's own page instead of switching in place;
  - signing out goes through HermiscusAuth;
  - start-up asks HermiscusAuth who is signed in instead of trusting localStorage.

Every patch must match exactly once, so a new version of her app that moved one of
these fails loudly here instead of quietly running half-patched.
"""
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'shared' / 'original'


def read_source(path):
    path = pathlib.Path(path).expanduser()
    if path.suffix == '.zip':
        with zipfile.ZipFile(path) as z:
            return z.read('index.html').decode('utf-8')
    return path.read_text(encoding='utf-8')


def replace_once(text, old, new, what):
    count = text.count(old)
    if count != 1:
        sys.exit(f'import-original: expected one {what}, found {count}. Her app changed here; patch by hand.')
    return text.replace(old, new)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    html = read_source(sys.argv[1])

    styles = re.findall(r'<style[^>]*>(.*?)</style>', html, re.S)
    scripts = [body for attrs, body in re.findall(r'<script([^>]*)>(.*?)</script>', html, re.S) if 'src=' not in attrs]
    shell = re.search(r'<body[^>]*>(.*?)<script', html, re.S)
    if len(styles) != 1 or len(scripts) != 1 or not shell:
        sys.exit('import-original: expected one <style>, one inline <script> and a <body>.')
    app = scripts[0]

    # 1. Drop her data layer: it holds the database key and a seed of the real race.
    state = '/* ================= STATE ================= */'
    if app.count(state) != 1:
        sys.exit('import-original: could not find the STATE section.')
    app = app[app.index(state):]

    # 2. The directory launches each person's own page.
    app = replace_once(app, '''function enterAs(p){
  ME =''', '''const PROFILE_ROUTES = {
  Victoria:'victoria', Michelle:'michelle', Auston:'auston', Grady:'grady',
  Silas:'silas', Ric:'ric', Sydney:'sydney', Aubrey:'aubrey'
};
const SITE_ROOT_URL = new URL('../../', document.currentScript.src);
function profileRoute(name){
  const slug = PROFILE_ROUTES[name];
  return slug ? `profiles/${slug}/` : `profiles/view/?profile=${encodeURIComponent(name)}`;
}
function enterAs(p){
  if(!document.body.dataset.profile){
    window.location.href = new URL(profileRoute(p.name), SITE_ROOT_URL).href;
    return;
  }
  ME =''', 'enterAs')

    # 3. Switching profile is signing out.
    start = app.index('function switchProfile(){')
    end = app.index('\n}\n', start) + 3
    app = app[:start] + '''async function switchProfile(){
  if(getOfflineQueue().length && !window.confirm('Unsynced race changes are still on this phone. Sign out and remove them?')) return;
  stopLiveSync();
  await window.HermiscusAuth.signOut();
  window.location.replace(window.HermiscusAuth.loginUrl());
}
''' + app[end:]

    # 4. Start-up: the signed-in person (or, in the demo, the page's person).
    app = replace_once(app, '''  if(ME){ await showApp(); }
  else { await renderProfileScreen(); }''', '''  const requestedProfile = window.HermiscusAuth.profileName();
  if(requestedProfile){
    PROFILES = await dbList('profiles', 'created_at.asc');
    const profile = PROFILES.find(p=>p.name.toLowerCase()===requestedProfile.toLowerCase());
    if(!profile){
      document.getElementById('profile-grid').innerHTML = '<div class="profile-empty">Your crew profile is not ready. Ask a manager for help.</div>';
      return;
    }
    ME = {id:profile.id, name:profile.name, role:profile.role, color:profile.color, color2:profile.color2};
    localStorage.setItem('hermesco_me', JSON.stringify(ME));
    await showApp();
  } else if(window.HermiscusAuth.demo){
    await renderProfileScreen();
  }''', 'init')

    # 5. Ric's wording: the crew sheet names the plan pace by the goal it comes from.
    app = replace_once(app, "bits.push(`plan for this leg: ${fmtPace(planPace)}`);",
                       "bits.push(`${CONFIG.goal_finish_hours||18}hr pace: ${fmtPace(planPace)}`);", 'plan pace label')

    # 6. Send anything saved while offline once the signal comes back.
    app += '''
/* ================= OFFLINE SYNC (added on import) ================= */
window.addEventListener('online', async ()=>{ if(await flushOfflineQueue()) await loadAppData(); });
setInterval(()=>{ if(ME && getOfflineQueue().length && navigator.onLine) flushOfflineQueue({quiet:true}); }, 15000);
'''

    if re.search(r'eyJ[A-Za-z0-9_-]{10,}\.eyJ|[a-z0-9]{20}\.supabase\.co', app + styles[0] + shell.group(1)):
        sys.exit('import-original: a database key or address survived the import. Not writing.')

    OUT.mkdir(parents=True, exist_ok=True)
    banner = '/* Imported from the original crew app by scripts/import-original.py. Do not edit by hand. */\n'
    (OUT / 'app.js').write_text(banner + app, encoding='utf-8')
    (OUT / 'styles.css').write_text(banner + styles[0].strip() + '\n', encoding='utf-8')
    (OUT / 'app-shell.html').write_text(
        '<!-- Imported from the original crew app by scripts/import-original.py. Do not edit by hand. -->\n'
        + shell.group(1).strip() + '\n', encoding='utf-8')
    print(f'import-original: wrote {OUT.relative_to(ROOT)}/ (app.js, styles.css, app-shell.html)')


if __name__ == '__main__':
    main()
