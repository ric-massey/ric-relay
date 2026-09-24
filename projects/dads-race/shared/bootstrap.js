(async () => {
  const mount = document.getElementById('app-root');
  const bootstrapUrl = document.currentScript.src;
  const sharedBase = new URL('./', bootstrapUrl);

  if (!window.HermiscusAuth || !(await window.HermiscusAuth.requireSession())) return;
  if (!window.HermiscusAuth.ensureProfileRoute()) return;

  // Everyone runs Victoria's app (shared/original/, imported unchanged from her index.html by
  // scripts/import-original.py), with Ric's Notes screen on top (shared/notes-layer.js —
  // Victoria asked for it on every profile). Ric and Sydney can switch on Ric's race-day
  // version in Settings; then shared/ric-layer.js loads on top of that too. Her screens,
  // styles and code stay the base, so anything she adds reaches everyone. One data layer,
  // shared/data.js, under all of it.
  const RIC_VERSION = ['Ric', 'Sydney'];
  const person = window.HermiscusAuth.profileName();
  // Ric and Sydney start on Victoria's version like everyone else; the "Ric's race-day
  // version" switch in Settings turns Ric's on. Remembered on this device only.
  const ricKey = `hermiscus_use_ric_${String(person).toLowerCase()}`;
  const canChoose = RIC_VERSION.includes(person);
  let wantsRic = false;
  try { wantsRic = canChoose && localStorage.getItem(ricKey) === '1'; } catch (_) {}
  const ricVersion = canChoose && wantsRic;
  window.HERMISCUS_LAYER = ricVersion;
  const herBase = new URL('original/', sharedBase);
  const V = '?v=imp-20260924011153';
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
      "<span><b>Ric's race-day version</b><br><small>Overview, Crew Stop, Pace Dad and Prep, on top of Victoria's app.</small></span>";
    const check = box.querySelector('input');
    check.checked = wantsRic;
    check.addEventListener('change', () => {
      try {
        if (check.checked) localStorage.setItem(ricKey, '1');
        else localStorage.removeItem(ricKey);
      } catch (_) {}
      window.location.reload();
    });
    const hint = document.createElement('div');
    hint.className = 'save-hint';
    hint.textContent = "Remembered on this device. Untick for Victoria's version.";
    settings.append(title, box, hint);
  };
  // Her stylesheet, then the Notes styles for everyone, then Ric's when his version is on.
  const sheet = document.querySelector('link[rel="stylesheet"][href*="shared/styles.css"]');
  if (sheet) {
    sheet.href = new URL('styles.css' + V, herBase).href;
    const extra = ['notes.css', ...(ricVersion ? ['styles.css'] : [])].map(name => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL(name + V, sharedBase).href;
      return link;
    });
    sheet.after(...extra);
  }
  // Her start-up waits on this, so the Notes (and Ric's) layer is in place before anything is drawn.
  let release = () => {};
  window.HermiscusBeforeStart = new Promise(resolve => { release = resolve; });

  fetch(new URL('app-shell.html' + V, herBase))
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
      const ready = () => { addVersionChoice(); release(); };
      // Her functions are captured the moment her file has run, before Ric's layer replaces
      // any of them, so the layer can hand her pages back to her (HER.goPage and friends).
      const layer = () => {
        window.HERMISCUS_HER = Object.freeze({
          goPage: window.goPage, loadAppData: window.loadAppData, liveSyncTick: window.liveSyncTick,
        });
        loadScript(shared('notes-layer.js'), () => (ricVersion ? loadScript(shared('ric-layer.js'), ready) : ready()));
      };
      const start = () => loadScript(shared('ric-dashboard-logic.js'), () =>
        loadScript(shared('data.js'), () => loadScript(new URL('app.js' + V, herBase), layer)));
      if (window.HermiscusAuth.demo) loadScript(shared('demo-data.js'), start);
      else start();
    })
    .catch(error => {
      mount.innerHTML = `<main class="boot-error"><h1>Could not start the app</h1><p>${String(error.message || error)}</p></main>`;
    });
})();
