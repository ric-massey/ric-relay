/* CLIMBING — the bits of rendering every page in the section shares
   ────────────────────────────────────────────────────────────────────────────
   Six pages draw the same two things: a grade, and a guidebook line. They were
   each about to grow a private copy, which is exactly how the room page and the
   log page ended up disagreeing about what a grade band was.

       ClimbUI.band('5.12b')   // 'g12'
       ClimbUI.grade(r)        // <span class="g g12">5.12b</span>
       ClimbUI.row({...})      // a full guidebook line
*/
(function (global) {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Light to dark as it gets harder. The point is that a 5.9 and a 5.14 stop
     looking identical in a list you scan by grade — so it needs no key. */
  function band(g) {
    if (!g) return "easy";
    let m = /^5\.(\d+)/.exec(g);
    if (m) {
      const n = +m[1];
      return n >= 14 ? "g14" : n >= 13 ? "g13" : n >= 12 ? "g12"
           : n >= 11 ? "g11" : n >= 10 ? "g10" : "easy";
    }
    m = /^[Vv](\d+)/.exec(g);
    if (m) {
      const n = +m[1];
      return n >= 8 ? "g13" : n >= 6 ? "g12" : n >= 4 ? "g11" : n >= 3 ? "g10" : "easy";
    }
    return "easy";
  }

  /* Filled means sent, outline means he has been on it. That replaces a SENT /
     PROJECT word column — three things used to race each other to the right
     edge of every row, and the grade is the one you were reading anyway. */
  const grade = (g, sent) =>
    g ? `<span class="g ${band(g)}${sent === false ? " try" : ""}">${esc(g)}</span>` : "";

  /* name ······················ meta  grade */
  function row(o) {
    return `<div class="rt"${o.id ? ` id="${esc(o.id)}"` : ""}>` +
      `<span class="nm">${o.star ? '<span class="fav">★</span> ' : ""}${o.name}</span>` +
      `<span class="dot"></span>` +
      (o.meta ? `<span class="meta">${esc(o.meta)}</span>` : "") +
      grade(o.grade, o.sent) + `</div>`;
  }

  const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmt(iso, long) {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y) return "";
    return long ? `${d} ${MONTH[m - 1]} ${y}` : `${d} ${MONTH[m - 1]}`;
  }

  /* todo.md was typed by hand for years, so the same crag arrives spelled four
     ways — PMRP, PMPR, PRMP, "PMRP - Bears Den". Folding them is what turns a
     jump row of twenty-four crags into one of eight. The real cure is the add
     form giving him a picker; until then, every page folds the same way. */
  function crag(raw) {
    const t = String(raw || "").trim();
    const l = t.toLowerCase();
    if (/^(pmrp|pmpr|prmp)/.test(l)) return "PMRP";
    if (l.includes("gorge") && !l.includes("red river")) return "Northern Gorge";
    if (l.includes("lilly")) return "Lilly Boulders";
    if (l.includes("natural bridge")) return "Natural Bridge";
    if (l.includes("miller")) return "Miller Fork";
    if (l.includes("muir")) return "Muir Valley";
    if (l.includes("smoke bluffs") || l.includes("squamish")) return "Squamish";
    if (l.includes("canada") || l.includes("marble")) return "Marble Canyon";
    if (l.includes("sawtooth")) return "The Sawtooths";
    if (l.includes("obed")) return "The Obed";
    if (l.includes("ijams")) return "Ijams Crag";
    return t;
  }

  global.ClimbUI = { esc, band, grade, row, fmt, crag };
})(window);
