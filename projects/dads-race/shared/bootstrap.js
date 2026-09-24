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
  const ricVersion = RIC_VERSION.includes(window.HermiscusAuth.profileName());
  const appBase = ricVersion ? sharedBase : new URL('original/', sharedBase);
  const V = '?v=20260924-01';
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
