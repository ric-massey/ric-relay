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
   correct in all three. */
(function () {
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
    ['board', 'Woodshed', 'projects/climbing/board.html'],
  ];

  const esc = s => String(s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const tab = ([id, label, href]) => (
    `<a href="${root}${href}"${id === here ? ' class="on" aria-current="page"' : ''}>${esc(label)}</a>`);

  document.write(
    `<div class="climbtop"><div class="inner">` +
      `<a class="brand" href="${root}index.html">RIC'S TERMINAL</a>` +
      `<a class="up" href="${root}index.html">&uarr; all rooms</a>` +
    `</div></div>` +
    `<div class="climbnav"><div class="inner">` +
      `<a class="mark" href="${root}climbing.html">Climbing</a>` +
      TABS.map(tab).join('') +
      `<a class="right" href="${root}projects/climbing/add.html">Add</a>` +
    `</div></div>`);
})();
