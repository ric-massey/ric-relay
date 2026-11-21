/* Opening names for the Chess page (2026-11-21, TODO.md "Chess: what players
   want": "Opening name as you play"). Each line is the moves that define it, in
   the short notation the move list uses; the page shows the longest line the
   game so far starts with. Common names only, as a club player would say them. */
(function (root) {
  'use strict';
  const LINES = `
e4|King's Pawn Opening
e4 e5|Open Game
e4 e5 Nf3|King's Knight Opening
e4 e5 Nf3 Nc6|King's Knight Opening
e4 e5 Nf3 Nc6 Bb5|Ruy López
e4 e5 Nf3 Nc6 Bb5 a6|Ruy López · Morphy Defence
e4 e5 Nf3 Nc6 Bb5 a6 Bxc6|Ruy López · Exchange Variation
e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7|Ruy López · Closed
e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4|Ruy López · Open
e4 e5 Nf3 Nc6 Bb5 Nf6|Ruy López · Berlin Defence
e4 e5 Nf3 Nc6 Bb5 f5|Ruy López · Schliemann Gambit
e4 e5 Nf3 Nc6 Bc4|Italian Game
e4 e5 Nf3 Nc6 Bc4 Bc5|Italian Game · Giuoco Piano
e4 e5 Nf3 Nc6 Bc4 Bc5 c3|Italian Game · Giuoco Piano, Main Line
e4 e5 Nf3 Nc6 Bc4 Bc5 b4|Evans Gambit
e4 e5 Nf3 Nc6 Bc4 Nf6|Two Knights Defence
e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5|Two Knights Defence · Knight Attack
e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7|Two Knights · Fried Liver Attack
e4 e5 Nf3 Nc6 Bc4 Be7|Hungarian Defence
e4 e5 Nf3 Nc6 d4|Scotch Game
e4 e5 Nf3 Nc6 d4 exd4 Bc4|Scotch Gambit
e4 e5 Nf3 Nc6 Nc3|Three Knights Game
e4 e5 Nf3 Nc6 Nc3 Nf6|Four Knights Game
e4 e5 Nf3 Nc6 c3|Ponziani Opening
e4 e5 Nf3 Nf6|Petrov's Defence
e4 e5 Nf3 d6|Philidor Defence
e4 e5 Nf3 f5|Latvian Gambit
e4 e5 Nf3 d5|Elephant Gambit
e4 e5 f4|King's Gambit
e4 e5 f4 exf4|King's Gambit Accepted
e4 e5 f4 Bc5|King's Gambit Declined · Classical
e4 e5 Nc3|Vienna Game
e4 e5 Bc4|Bishop's Opening
e4 e5 d4 exd4 c3|Danish Gambit
e4 e5 d4|Centre Game
e4 e5 Qh5|Wayward Queen Attack
e4 c5|Sicilian Defence
e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6|Sicilian · Najdorf
e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6|Sicilian · Dragon
e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6|Sicilian · Classical
e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6|Sicilian · Scheveningen
e4 c5 Nf3 d6|Sicilian Defence
e4 c5 Nf3 Nc6|Sicilian Defence
e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5|Sicilian · Sveshnikov
e4 c5 Nf3 e6|Sicilian Defence · French Variation
e4 c5 Nf3 Nc6 Bb5|Sicilian · Rossolimo
e4 c5 Nf3 d6 Bb5+|Sicilian · Moscow Variation
e4 c5 c3|Sicilian · Alapin
e4 c5 Nc3|Sicilian · Closed
e4 c5 d4 cxd4 c3|Smith-Morra Gambit
e4 c5 f4|Sicilian · Grand Prix Attack
e4 e6|French Defence
e4 e6 d4 d5|French Defence
e4 e6 d4 d5 e5|French · Advance
e4 e6 d4 d5 exd5|French · Exchange
e4 e6 d4 d5 Nc3|French · Paulsen
e4 e6 d4 d5 Nc3 Bb4|French · Winawer
e4 e6 d4 d5 Nc3 Nf6|French · Classical
e4 e6 d4 d5 Nd2|French · Tarrasch
e4 c6|Caro-Kann Defence
e4 c6 d4 d5 e5|Caro-Kann · Advance
e4 c6 d4 d5 exd5 cxd5|Caro-Kann · Exchange
e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5|Caro-Kann · Classical
e4 c6 d4 d5 exd5 cxd5 c4|Caro-Kann · Panov Attack
e4 d5|Scandinavian Defence
e4 d5 exd5 Qxd5|Scandinavian · Main Line
e4 d5 exd5 Nf6|Scandinavian · Modern
e4 d6|Pirc Defence
e4 d6 d4 Nf6 Nc3 g6|Pirc Defence
e4 g6|Modern Defence
e4 Nf6|Alekhine's Defence
e4 Nc6|Nimzowitsch Defence
e4 b6|Owen's Defence
e4 a6|St. George Defence
d4|Queen's Pawn Opening
d4 d5|Closed Game
d4 d5 c4|Queen's Gambit
d4 d5 c4 dxc4|Queen's Gambit Accepted
d4 d5 c4 e6|Queen's Gambit Declined
d4 d5 c4 e6 Nc3 Nf6 Bg5|Queen's Gambit Declined · Orthodox
d4 d5 c4 c6|Slav Defence
d4 d5 c4 e6 Nc3 c6|Semi-Slav Defence
d4 d5 c4 e5|Albin Countergambit
d4 d5 c4 Nc6|Chigorin Defence
d4 d5 Bf4|London System
d4 d5 Nf3 Nf6 Bf4|London System
d4 Nf6 Bf4|London System
d4 Nf6 Nf3 g6 Bf4|London System
d4 d5 Nf3|Queen's Pawn Game
d4 d5 e3|Colle System
d4 d5 Bg5|Trompowsky-style Opening
d4 Nf6 Bg5|Trompowsky Attack
d4 Nf6|Indian Defence
d4 Nf6 c4|Indian Defence
d4 Nf6 c4 e6|Indian Defence
d4 Nf6 c4 e6 Nc3 Bb4|Nimzo-Indian Defence
d4 Nf6 c4 e6 Nf3 b6|Queen's Indian Defence
d4 Nf6 c4 e6 Nf3 Bb4+|Bogo-Indian Defence
d4 Nf6 c4 e6 g3|Catalan Opening
d4 Nf6 c4 e6 g3 d5|Catalan Opening
d4 Nf6 c4 g6|King's Indian Defence
d4 Nf6 c4 g6 Nc3 Bg7 e4 d6|King's Indian · Main Line
d4 Nf6 c4 g6 Nc3 d5|Grünfeld Defence
d4 Nf6 c4 c5|Benoni Defence
d4 Nf6 c4 c5 d5 e6|Modern Benoni
d4 Nf6 c4 c5 d5 b5|Benko Gambit
d4 Nf6 c4 e5|Budapest Gambit
d4 f5|Dutch Defence
d4 f5 c4 Nf6 g3 e6|Dutch Defence · Classical
d4 f5 c4 Nf6 g3 g6|Dutch · Leningrad
d4 e5|Englund Gambit
d4 c5|Old Benoni
d4 d6|Old Indian-style Defence
d4 g6|Modern Defence
d4 e6|Horwitz Defence
c4|English Opening
c4 e5|English · Reversed Sicilian
c4 c5|English · Symmetrical
c4 Nf6|English · Anglo-Indian
c4 e6|English Opening
Nf3|Réti Opening
Nf3 d5 c4|Réti Opening
Nf3 d5 g3|King's Indian Attack
Nf3 Nf6|Zukertort Opening
f4|Bird's Opening
f4 e5|From's Gambit
g3|King's Fianchetto Opening
b3|Nimzo-Larsen Attack
b4|Polish Opening
e3|Van 't Kruijs Opening
d3|Mieses Opening
Nc3|Van Geet Opening
c3|Saragossa Opening
a3|Anderssen's Opening
g4|Grob's Attack
h4|Kádas Opening
a4|Ware Opening
Nh3|Amar Opening
f3|Barnes Opening`.trim().split('\n').map(l => { const [moves, name] = l.split('|'); return { m: moves.split(' '), name }; });
  /* moves: the game's SAN list. Returns { name, ply } for the longest named
     line the game starts with (ply = how many moves it covers), or null. */
  function opening(moves) {
    const clean = moves.map(x => x.replace(/[+#]/g, ''));
    let best = null;
    for (const line of LINES) {
      if (line.m.length > clean.length || (best && line.m.length <= best.ply)) continue;
      if (line.m.every((x, i) => x.replace(/[+#]/g, '') === clean[i])) best = { name: line.name, ply: line.m.length };
    }
    return best;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { opening, LINES };
  else root.ChessOpenings = { opening };
})(typeof globalThis !== 'undefined' ? globalThis : this);
