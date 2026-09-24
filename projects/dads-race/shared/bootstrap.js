(async () => {
  const mount = document.getElementById('app-root');
  const bootstrapUrl = document.currentScript.src;
  const sharedBase = new URL('./', bootstrapUrl);

  if (!window.HermiscusAuth || !(await window.HermiscusAuth.requireSession())) return;
  if (!window.HermiscusAuth.ensureProfileRoute()) return;

  // Ric and Sydney run Ric's version of the app. Everyone else, and the crew directory,
  // run the original crew app exactly as it was written (shared/original/, brought in by
  // scripts/import-original.py). Both sit on the same data layer, shared/data.js.
  const RIC_VERSION = ['Ric', 'Sydney'];
  const person = window.HermiscusAuth.profileName();
  // Either of them can tick "use Victoria's version" in Settings and get her app, the same as
  // everyone else. It's remembered on this device only, and the same box switches it back.
  const originalKey = `hermiscus_use_original_${String(person).toLowerCase()}`;
  const canChoose = RIC_VERSION.includes(person);
  let wantsOriginal = false;
  try { wantsOriginal = canChoose && localStorage.getItem(originalKey) === '1'; } catch (_) {}
  const ricVersion = canChoose && !wantsOriginal;
  const appBase = ricVersion ? sharedBase : new URL('original/', sharedBase);
  const V = '?v=20260924-02';
  // Added to whichever app is running, so her code stays exactly as she wrote it.
  const addVersionChoice = () => {
    const settings = document.getElementById('page-settings');
    if (!canChoose || !settings) return;
    const title = document.createElement('div');
    title.className = 'sec-title';
    title.style.marginTop = '22px';
    title.textContent = 'App version';
    const box = document.createElement('label');
    box.className = 'card';
    box.style.cssText = 'display:flex;align-items:center;gap:12px;min-height:44px;cursor:pointer';
    box.innerHTML = '<input type="checkbox" style="width:22px;height:22px;margin:0;flex:none">' +
      "<span><b>Use Victoria's version</b><br><small>The crew app as she built it, the same one everyone else sees.</small></span>";
    const check = box.querySelector('input');
    check.checked = wantsOriginal;
    check.addEventListener('change', () => {
      try {
        if (check.checked) localStorage.setItem(originalKey, '1');
        else localStorage.removeItem(originalKey);
      } catch (_) {}
      window.location.reload();
    });
    const hint = document.createElement('div');
    hint.className = 'save-hint';
    hint.textContent = 'Remembered on this device. Untick to come back.';
    settings.append(title, box, hint);
  };
  if (!ricVersion) {
    const sheet = document.querySelector('link[rel="stylesheet"][href*="shared/styles.css"]');
    if (sheet) sheet.href = new URL('styles.css' + V, appBase).href;
  }

  fetch(new URL('app-shell.html' + V, appBase))
    .then(response => {
      if (!response.ok) throw new Error(`Unable to load the app shell (${response.status})`);
      return response.text();
    })
    .then(markup => {
      mount.innerHTML = markup;
      addVersionChoice();
      const showBootError = () => {
        mount.innerHTML = '<main class="boot-error"><h1>Could not start the app</h1><p>Reload the page or check the local server.</p></main>';
      };
      if (window.HermiscusAuth.demo) {
        // A plain, always-visible label so nobody mistakes the demo for the real plan.
        const ribbon = document.createElement('div');
        ribbon.textContent = 'DEMO · made-up race · changes stay in this browser';
        ribbon.setAttribute('role', 'note');
        ribbon.style.cssText = 'position:sticky;top:0;z-index:9999;padding:6px 12px;background:#ffb000;color:#0a0a0a;' +
          'font:700 11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.08em;text-align:center';
        document.body.prepend(ribbon);
      }
      const loadScript = (url, next) => {
        const script = document.createElement('script');
        script.src = url;
        script.onerror = showBootError;
        script.onload = next;
        document.body.appendChild(script);
      };
      const shared = name => new URL(name + V, sharedBase);
      const start = () => loadScript(shared('ric-dashboard-logic.js'), () =>
        loadScript(shared('data.js'), () => loadScript(new URL('app.js' + V, appBase))));
      if (window.HermiscusAuth.demo) loadScript(shared('demo-data.js'), start);
      else start();
    })
    .catch(error => {
      mount.innerHTML = `<main class="boot-error"><h1>Could not start the app</h1><p>${String(error.message || error)}</p></main>`;
    });
})();
