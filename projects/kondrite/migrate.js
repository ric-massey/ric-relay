"use strict";

/* KONDRITE — carrying a save across the rename ──────────────────────────────
   The game was CROSSFIRE, and everything it has ever kept for anybody is
   filed under `crossfire.*`: the book, the keyboard, the pad, the sound, the
   room host key, the signed-in session. This moves all of it to `kondrite.*`,
   once, and then never does anything again.

   **It loads before every other module**, which is load-bearing rather than
   tidy. `cloud.js` reads the session at load and `survey-save.js` is handed
   its key names at construction, so a migration running after either of them
   would run after the value it was migrating had already been missed. The
   page's script order is read out of the markup by `test/page.js` and the
   suites boot from that order, so this is protected rather than remembered.

   **A prefix sweep, not a table of names.** The plan for this rename carried a
   table of nine keys. The code had seventeen: the book had moved from v3 to
   v4, and the pad, the name, the input mode, the mouse preference, the sound
   and the guest flag were missing from it entirely. A table is a second copy
   of the truth and this one was wrong before anybody typed it. So every key
   under `crossfire.` moves, whatever it is and whenever it was added — and a
   key added next year moves too, without anybody remembering to add it here.

   Four rules, one per key:

     new present, old gone   nothing. This already ran.
     old present, new gone   copy, read it back, then drop the old one.
     both present            the new one stands — unless it is an older book.
     neither                 nothing. A new player.

   **Read it back before dropping it.** A quota failure part-way through a copy
   with the original already deleted is the one way this loses somebody's
   sector. The copy is confirmed out of storage before the old key goes, and a
   copy that did not take leaves the original exactly where it was.

   **The book is the only key with a race.** There is no service worker in this
   game, so there is no stale cached page to fight; but a tab left open on the
   old build will autosave to the old key some seconds after another tab has
   already migrated, and that save is the newer one. Every book carries
   `savedAt`, so when both keys exist the later write wins. It costs three
   lines for the sector and nothing at all for the zoom preference, which is
   why the question is asked of every key and only books can answer it. */
(function () {
  var OLD = "crossfire.", NEW = "kondrite.";

  var store;
  try {
    store = window.localStorage;
    if (!store) return;
  } catch (_) { return; }   // private mode, a locked-down profile: nothing to do

  function get(k) { try { return store.getItem(k); } catch (_) { return null; } }
  function set(k, v) { try { store.setItem(k, v); return true; } catch (_) { return false; } }
  function drop(k) { try { store.removeItem(k); } catch (_) {} }

  /* When a value is a book, this is when it was written; everything else is
     zero. That is what makes "the later one wins" safe to ask of every key
     rather than only of the two that are books — a preference has no `savedAt`
     and so never beats anything. */
  function savedAt(v) {
    if (!v || v.charAt(0) !== "{") return 0;
    try {
      var b = JSON.parse(v);
      return (b && typeof b.savedAt === "number" && isFinite(b.savedAt))
        ? b.savedAt : 0;
    } catch (_) { return 0; }
  }

  /* Every old key, collected before anything is written — the sweep deletes as
     it goes and an index-based walk over a shrinking store skips entries. */
  var names = [];
  try {
    if (typeof store.key === "function" && typeof store.length === "number") {
      for (var i = 0; i < store.length; i++) {
        var k = store.key(i);
        if (k && k.indexOf(OLD) === 0) names.push(k);
      }
    } else {
      // Some stubs back the store with a plain object instead.
      Object.keys(store).forEach(function (k) {
        if (k.indexOf(OLD) === 0) names.push(k);
      });
    }
  } catch (_) { return; }

  for (var n = 0; n < names.length; n++) {
    var old = names[n];
    var now = NEW + old.slice(OLD.length);
    var was = get(old);
    if (was === null) continue;

    var has = get(now);
    if (has !== null) {
      /* Both. Nearly always this means the migration has already run and the
         new key is the real one; the exception is a book written by a tab
         still on the old build after it ran, which is newer and should win. */
      if (savedAt(was) <= savedAt(has)) { drop(old); continue; }
    }

    if (!set(now, was)) continue;     // out of room — leave the original alone
    if (get(now) !== was) continue;   // it did not take — same
    drop(old);
  }
})();
