/* CLIMBING — the section's own nav bar
   ────────────────────────────────────────────────────────────────────────────
   Six pages sit at two different depths: climbing.html is at the root, the rest
   live in projects/climbing/. Hand-copying a <nav> into all six is how five of
   them end up right and one of them quietly points at a page that moved — so
   the bar is built once, here, and each page says only which tab it is on.

       <script src="assets/climbing-nav.js" data-nav="home"></script>

   The depth is read off this script's own src rather than off location.pathname,
   because the dev server, a file:// open and the deployed site disagree about
   what the path looks like, and the script's own URL is the one thing that is
   correct in all three.

   ── the Add tab ──
   Add used to be a small grey link pinned to the right end of the bar, shown to
   everybody — and hidden entirely under 820px by the CSS, which is the width it
   is actually used at. It is a tab now, in the row with the rest, and it only
   appears once you are signed in. Signing in happens at the bottom of the room
   page; ClimbNav.refresh() is what puts the tab there the moment it takes,
   without a reload.

   Reading the token straight out of localStorage rather than asking Owner is
   deliberate: this bar is written during parse, before owner.js has loaded on
   most of these pages, and a nav that waits for a module is a nav that visibly
   jumps a beat after the page paints. The key is the one owner.js uses, and the
   wrong answer here costs a tab — the Worker is still what says yes. */
(function (global) {
  const me = document.currentScript;
  const here = me.dataset.nav || '';

  /* "…/assets/climbing-nav.js" → "…/" — the site root, however we got here. */
  const root = me.src.replace(/assets\/climbing-nav\.js.*$/, '');

  const TABS = [
    ['home',  'Home',     'climbing.html'],
    ['log',   'Log',      'projects/climbing/index.html'],
    ['list',  'To-do',    'projects/climbing/list.html'],
    ['stats', 'Stats',    'projects/climbing/stats.html'],
    ['media', 'Media',    'projects/climbing/gallery.html'],
    ['board', 'Boards',   'projects/climbing/board.html'],
    ['add',   'Add',      'projects/climbing/add.html', true],   // owner only
  ];

  const esc = s => String(s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const signedIn = () => {
    try { return !!localStorage.getItem('ownerToken'); } catch (e) { return false; }
  };

  const tab = ([id, label, href, owner]) => {
    const cls = [id === here ? 'on' : '', owner ? 'mine' : ''].filter(Boolean).join(' ');
    return `<a href="${root}${href}"${cls ? ` class="${cls}"` : ''}` +
           `${id === here ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  };

  /* The Add tab is drawn for whoever is on it even signed out, so landing there
     from a bookmark with a stale token is a page with its own way back, not a
     bar that disagrees with where you are. */
  const bar = () =>
    `<a class="mark" href="${root}climbing.html">Climbing</a>` +
    TABS.filter(t => !t[3] || signedIn() || t[0] === here).map(tab).join('');

  document.write(
    `<div class="climbtop"><div class="inner">` +
      `<a class="brand" href="${root}index.html">RIC'S TERMINAL</a>` +
      `<a class="up" href="${root}index.html">&uarr; all rooms</a>` +
    `</div></div>` +
    `<div class="climbnav"><div class="inner" id="climbnavinner">${bar()}</div></div>`);

  /* Under 820px the bar scrolls sideways, and with the Add tab on the end that
     means arriving on Boards or Add put you on a page whose own tab was off the
     right edge — the bar said "Home" while you were looking at the woodshed.
     Nudge the current tab into view. Instant, not smooth: a bar that slides on
     load looks like something failed to settle. */
  function showCurrent() {
    const el = document.getElementById('climbnavinner');
    const on = el && el.querySelector('a.on');
    if (!on || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, on.offsetLeft + on.offsetWidth - el.clientWidth + 16);
  }

  global.ClimbNav = {
    refresh() {
      const el = document.getElementById('climbnavinner');
      if (el) { el.innerHTML = bar(); showCurrent(); }
    }
  };

  /* document.write has only just run, so the bar exists but nothing has been
     laid out yet — measure after the first frame. */
  requestAnimationFrame(showCurrent);
})(window);
