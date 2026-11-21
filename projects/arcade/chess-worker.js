/* Chess's Hard level thinks here, off the page's thread, so the board never
   freezes while it searches (2026-11-21). app.js falls back to a shorter
   search on the page itself where workers can't start (a file:// page). */
importScripts('engine.js');
self.onmessage = e => {
  // Solitaire's "winnable deals only" (2026-11-21) searches for a deal here too.
  if (e.data.kind === 'solitaire') { let deal = null; try { deal = self.ArcadeGames.Solitaire.winnable(e.data.draw, e.data.ms || 4000); } catch { deal = null; } self.postMessage({ id: e.data.id, deal }); return; }
  const { id, state, ms } = e.data;
  let move = null;
  try { move = self.ArcadeGames.Chess.think(state, ms || 2000); } catch { move = null; }
  self.postMessage({ id, move });
};
