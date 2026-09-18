/* TRAINING — the section's own nav bar
   ────────────────────────────────────────────────────────────────────────────
   Four pages at two depths: training.html is at the root, the rest live in
   projects/training/. Hand-copying a <nav> into all four is how three of them
   end up right and one quietly points at a page that moved — so the bar is
   built once, here, and each page says only which tab it is on.

       <script src="assets/training-nav.js" data-nav="home"></script>

   Depth is read off this script's own src rather than location.pathname,
   because the dev server, a file:// open and the deployed site disagree about
   what the path looks like, and the script's URL is the one thing correct in
   all three. Same reasoning, same shape, as assets/climbing-nav.js — if you fix
   a bug in one, look at the other.

   There is no owner-only tab here. The climbing bar has Add because logging a
   climb is a page; in training everything Ric writes is a tick or a note on a
   day he is already looking at, so signing in changes what the tabs CONTAIN,
   never which tabs exist. That is why this file needs no token check. */
(function (global) {
  const me = document.currentScript;
  const here = me.dataset.nav || '';

  /* "…/assets/training-nav.js" → "…/" — the site root, however we got here. */
  const root = me.src.replace(/assets\/training-nav\.js.*$/, '');

  const TABS = [
    ['home',     'Home',     'training.html'],
    ['calendar', 'Calendar', 'projects/training/calendar.html'],
    ['workouts', 'Workouts', 'projects/training/workouts.html'],
    ['trips',    'Trips',    'projects/training/trips.html'],
    ['history',  'History',  'projects/training/history.html'],
  ];

  const esc = s => String(s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const tab = ([id, label, href]) =>
    `<a href="${root}${href}"${id === here ? ' class="on" aria-current="page"' : ''}>${esc(label)}</a>`;

  document.write(
    `<div class="traintop"><div class="inner">` +
      `<a class="brand" href="${root}index.html">RIC'S TERMINAL</a>` +
      `<a class="up" href="${root}index.html">&uarr; all rooms</a>` +
    `</div></div>` +
    `<div class="trainnav"><div class="inner" id="trainnavinner">` +
      `<a class="mark" href="${root}training.html">Training</a>` +
      TABS.map(tab).join('') +
    `</div></div>`);

  /* Under 820px the bar scrolls sideways, so arriving on History put you on a
     page whose own tab was off the right edge — the bar said "Home" while you
     were looking at the log. Nudge the current tab into view. Instant, not
     smooth: a bar that slides on load looks like something failed to settle. */
  function showCurrent() {
    const el = document.getElementById('trainnavinner');
    const on = el && el.querySelector('a.on');
    if (!on || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, on.offsetLeft + on.offsetWidth - el.clientWidth + 16);
  }

  global.TrainNav = { showCurrent };
  requestAnimationFrame(showCurrent);
})(window);
