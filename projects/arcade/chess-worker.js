/* Chess's Hard level thinks here, off the page's thread, so the board never
   freezes while it searches (2026-11-21). app.js falls back to a shorter
   search on the page itself where workers can't start (a file:// page). */
importScripts('engine.js');
self.onmessage = e => {
  const { id, state, ms } = e.data;
  let move = null;
  try { move = self.ArcadeGames.Chess.think(state, ms || 2000); } catch { move = null; }
  self.postMessage({ id, move });
};
