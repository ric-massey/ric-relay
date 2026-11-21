/* Small, dependency-free rule engines. The browser and Node checks use the
   same moves: drawing a legal-looking board must never substitute for rules. */
(function (root) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const shuffle = (a, random = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const inside = (r, c, n = 8) => r >= 0 && c >= 0 && r < n && c < n;
  const side = p => p && (p === p.toUpperCase() ? 'w' : 'b');
  const other = t => t === 'w' ? 'b' : 'w';
  /* A repeatable random stream from a text seed (FNV-1a into mulberry32): the
     daily Sudoku and Solitaire deals are the same for everyone on a date. */
  const seeded = text => { let h = 2166136261; for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); let a = h >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  const Tic = {
    winner(b) { for (const l of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) if (b[l[0]] && l.every(i => b[i] === b[l[0]])) return b[l[0]]; return b.every(Boolean) ? 'draw' : null; },
    best(b, turn = 'O') {
      const terminal = Tic.winner(b); if (terminal) return { value: terminal === 'O' ? 10 : terminal === 'X' ? -10 : 0 };
      let best = { value: turn === 'O' ? -100 : 100, index: -1 };
      for (const i of [4,0,2,6,8,1,3,5,7]) if (!b[i]) { const next = b.slice(); next[i] = turn; const v = Tic.best(next, turn === 'O' ? 'X' : 'O').value; if (turn === 'O' ? v > best.value : v < best.value) best = { value: v, index: i }; }
      return best;
    },
    /* The line of three that won, for drawing the strike-through. */
    line(b) { for (const l of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) if (b[l[0]] && l.every(i => b[i] === b[l[0]])) return l; return null; },
    /* easy: takes a win it sees half the time, otherwise anywhere; medium: the
       perfect move two times in three; hard: never loses. */
    pick(b, level = 'hard', turn = 'O', random = Math.random) {
      const free = b.map((v,i) => v ? -1 : i).filter(i => i >= 0);
      if (level === 'hard' || (level === 'medium' && random() < 2/3)) return Tic.best(b, turn).index;
      if (level === 'easy' && random() < .5) for (const i of free) { const n = b.slice(); n[i] = turn; if (Tic.winner(n) === turn) return i; }
      return free[Math.floor(random() * free.length)];
    }
  };

  const Chess = {
    create() { return { b: [...'rnbqkbnrpppppppp', ...Array(32).fill(''), ...'PPPPPPPPRNBQKBNR'], turn: 'w', castle: 'KQkq', ep: -1, half: 0 }; },
    attacked(s, at, by) {
      const r = at >> 3, c = at % 8;
      for (let i = 0; i < 64; i++) {
        const p = s.b[i]; if (side(p) !== by) continue;
        const dr = r - (i >> 3), dc = c - i % 8, kind = p.toLowerCase();
        if (kind === 'p' && dr === (by === 'w' ? -1 : 1) && Math.abs(dc) === 1) return true;
        if (kind === 'n' && Math.abs(dr) * Math.abs(dc) === 2) return true;
        if (kind === 'k' && Math.max(Math.abs(dr), Math.abs(dc)) === 1) return true;
        if (['b','r','q'].includes(kind) && ((kind !== 'r' && Math.abs(dr) === Math.abs(dc) && dr) || (kind !== 'b' && (!dr !== !dc)))) {
          const sr = Math.sign(dr), sc = Math.sign(dc); let rr = (i >> 3) + sr, cc = i % 8 + sc;
          while (inside(rr, cc) && rr * 8 + cc !== at && !s.b[rr * 8 + cc]) { rr += sr; cc += sc; }
          if (rr * 8 + cc === at) return true;
        }
      }
      return false;
    },
    check(s, t = s.turn) { const k = s.b.indexOf(t === 'w' ? 'K' : 'k'); return k < 0 || Chess.attacked(s, k, other(t)); },
    pseudo(s) {
      const out = [], t = s.turn;
      const add = (from, to, extra = {}) => {
        if (s.b[to] && (side(s.b[to]) === t || s.b[to].toLowerCase() === 'k')) return;
        if (s.b[from].toLowerCase() === 'p' && (to < 8 || to >= 56)) for (const promote of ['q','r','b','n']) out.push({ from, to, promote, ...extra });
        else out.push({ from, to, ...extra });
      };
      for (let i = 0; i < 64; i++) {
        const p = s.b[i]; if (side(p) !== t) continue;
        const r = i >> 3, c = i % 8, k = p.toLowerCase(), dir = t === 'w' ? -1 : 1;
        if (k === 'p') {
          if (inside(r + dir, c) && !s.b[i + dir * 8]) {
            add(i, i + dir * 8);
            if (r === (t === 'w' ? 6 : 1) && !s.b[i + dir * 16]) add(i, i + dir * 16, { double: true });
          }
          for (const dc of [-1,1]) if (inside(r + dir, c + dc)) {
            const to = (r + dir) * 8 + c + dc;
            if (s.b[to] && side(s.b[to]) !== t) add(i, to);
            else if (to === s.ep && s.b[to - dir * 8]?.toLowerCase() === 'p') add(i, to, { enpassant: true });
          }
        } else if (k === 'n' || k === 'k') {
          const offsets = k === 'n' ? [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] : [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
          for (const [dr,dc] of offsets) if (inside(r + dr, c + dc)) add(i, (r + dr) * 8 + c + dc);
          const home = t === 'w' ? 60 : 4;
          if (k === 'k' && i === home && !Chess.check(s)) {
            for (const king of [true,false]) {
              const right = t === 'w' ? (king ? 'K' : 'Q') : (king ? 'k' : 'q'), step = king ? 1 : -1, rook = home + (king ? 3 : -4);
              if (s.castle.includes(right) && s.b[rook] === (t === 'w' ? 'R' : 'r') && [1,2,...(king ? [] : [3])].every(d => !s.b[home + d * step]) && [1,2].every(d => !Chess.attacked(s, home + step * d, other(t)))) add(i, home + step * 2, { castle: true });
            }
          }
        } else {
          const dirs = [...(k !== 'b' ? [[0,1],[0,-1],[1,0],[-1,0]] : []), ...(k !== 'r' ? [[1,1],[1,-1],[-1,1],[-1,-1]] : [])];
          for (const [dr,dc] of dirs) for (let rr = r + dr, cc = c + dc; inside(rr,cc); rr += dr, cc += dc) { const to = rr * 8 + cc; add(i,to); if (s.b[to]) break; }
        }
      }
      return out;
    },
    apply(s, m) {
      const n = { ...s, b: s.b.slice() }, p = n.b[m.from], captured = n.b[m.to], t = side(p);
      n.b[m.from] = ''; n.b[m.to] = m.promote ? (t === 'w' ? m.promote.toUpperCase() : m.promote) : p;
      if (m.enpassant) n.b[m.to + (t === 'w' ? 8 : -8)] = '';
      if (m.castle) { const king = m.to > m.from, a = m.from + (king ? 3 : -4), b = m.from + (king ? 1 : -1); n.b[b] = n.b[a]; n.b[a] = ''; }
      const revoke = chars => { for (const ch of chars) n.castle = n.castle.replace(ch, ''); };
      if (p.toLowerCase() === 'k') revoke(t === 'w' ? 'KQ' : 'kq');
      for (const [sq, flag] of [[0,'q'],[7,'k'],[56,'Q'],[63,'K']]) if (m.from === sq || m.to === sq) revoke(flag);
      n.ep = m.double ? (m.from + m.to) / 2 : -1;
      n.half = captured || p.toLowerCase() === 'p' ? 0 : s.half + 1;
      n.turn = other(s.turn); return n;
    },
    moves(s) { return Chess.pseudo(s).filter(m => !Chess.check(Chess.apply(s,m), s.turn)); },
    key(s) { const ep = s.ep >= 0 && Chess.moves(s).some(m => m.enpassant) ? s.ep : -1; return s.b.join(',') + s.turn + s.castle + ep; },
    result(s, history = []) {
      if (!Chess.moves(s).length) return Chess.check(s) ? (s.turn === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate') : 'Draw by stalemate';
      if (s.half >= 100) return 'Draw by the 50-move rule';
      if (history.filter(k => k === Chess.key(s)).length >= 3) return 'Draw by repetition';
      const men = s.b.map((p,i) => ({p:p.toLowerCase(),i})).filter(x => x.p && x.p !== 'k');
      if (!men.length || (men.length === 1 && ['b','n'].includes(men[0].p)) || (men.every(x => x.p === 'b') && new Set(men.map(x => ((x.i >> 3) + x.i % 8) % 2)).size === 1)) return 'Draw by insufficient material';
      return null;
    },
    /* Short algebraic notation for the move list: Nf3, exd5, O-O, e8=Q+, Qxf7#. */
    san(s, m) {
      const p = s.b[m.from], k = p.toLowerCase(), to = 'abcdefgh'[m.to % 8] + (8 - (m.to >> 3));
      let out;
      if (m.castle) out = m.to > m.from ? 'O-O' : 'O-O-O';
      else if (k === 'p') out = (s.b[m.to] || m.enpassant ? 'abcdefgh'[m.from % 8] + 'x' : '') + to + (m.promote ? '=' + m.promote.toUpperCase() : '');
      else {
        const twins = Chess.moves(s).filter(o => o.to === m.to && o.from !== m.from && s.b[o.from] === p);
        let dis = '';
        if (twins.length) { const file = twins.some(o => o.from % 8 === m.from % 8), rank = twins.some(o => o.from >> 3 === m.from >> 3); dis = !file ? 'abcdefgh'[m.from % 8] : !rank ? String(8 - (m.from >> 3)) : 'abcdefgh'[m.from % 8] + (8 - (m.from >> 3)); }
        out = k.toUpperCase() + dis + (s.b[m.to] ? 'x' : '') + to;
      }
      const n = Chess.apply(s, m);
      if (Chess.check(n)) out += Chess.moves(n).length ? '+' : '#';
      return out;
    },
    /* depth 1 = easy (one move ahead, a little careless), 2 = medium, 3 = hard.
       apply() copies positions shallowly, so three plies stay quick in a
       browser; leaves are scored without generating their moves. */
    /* opt.quiet: at the horizon, keep following captures (up to 4 more plies)
       so a piece left hanging isn't missed. opt.deadline: a time (ms) after
       which the search gives up by throwing Chess.TIMEOUT; think() uses both. */
    best(s, depth = 2, random = Math.random, opt = {}) {
      const value = { p:100,n:320,b:330,r:500,q:900,k:0 };
      const evaluate = n => { let v = 0; for (let i = 0; i < 64; i++) { const p = n.b[i]; if (!p) continue; const k = p.toLowerCase(), w = side(p) === 'w'; let x = value[k]; if (k !== 'k') x += 3 * (7 - Math.abs(3.5 - i % 8) - Math.abs(3.5 - (i >> 3))); if (k === 'p') x += 4 * (w ? 6 - (i >> 3) : (i >> 3) - 1); v += w ? x : -x; } return v; };
      const gain = (n, m) => (value[n.b[m.to]?.toLowerCase()] || 0) - (value[n.b[m.from].toLowerCase()] || 0) / 10 + (m.promote === 'q' ? 800 : 0);
      const order = (n, moves) => moves.sort((x,y) => gain(n,y) - gain(n,x));
      let nodes = 0;
      const tick = () => { if (opt.deadline && (++nodes & 255) === 0 && Date.now() > opt.deadline) throw Chess.TIMEOUT; };
      const calm = (n,a,b,q) => {
        tick(); const stand = evaluate(n); if (!q) return stand;
        if (n.turn === 'w') { if (stand >= b) return stand; a = Math.max(a, stand); } else { if (stand <= a) return stand; b = Math.min(b, stand); }
        let v = stand;
        for (const m of order(n, Chess.moves(n).filter(m => n.b[m.to] || m.enpassant || m.promote))) { const score = calm(Chess.apply(n,m),a,b,q-1); if (n.turn === 'w') { v = Math.max(v,score); a = Math.max(a,v); } else { v = Math.min(v,score); b = Math.min(b,v); } if (a >= b) break; }
        return v;
      };
      const search = (n,d,a,b) => {
        tick();
        if (!d) return opt.quiet ? calm(n,a,b,4) : evaluate(n);
        const moves = Chess.moves(n); if (!moves.length) return Chess.check(n) ? (n.turn === 'w' ? -100000 - d : 100000 + d) : 0;
        if (n.half >= 100) return 0;
        let v = n.turn === 'w' ? -Infinity : Infinity;
        for (const m of order(n, moves)) { const score = search(Chess.apply(n,m),d-1,a,b); if (n.turn === 'w') { v = Math.max(v,score); a = Math.max(a,v); } else { v = Math.min(v,score); b = Math.min(b,v); } if (a >= b) break; } return v;
      };
      const sign = s.turn === 'w' ? 1 : -1;
      let rootMoves = order(s, Chess.moves(s));
      if (opt.first) rootMoves = [...rootMoves.filter(m => m.from === opt.first.from && m.to === opt.first.to && m.promote === opt.first.promote), ...rootMoves.filter(m => !(m.from === opt.first.from && m.to === opt.first.to && m.promote === opt.first.promote))];
      if (opt.prune) { // a narrowing window at the root: exact best, faster, no ties kept
        let bestM, bestV = -Infinity, a = -Infinity, b = Infinity;
        for (const m of rootMoves) { const v = sign * search(Chess.apply(s,m), depth-1, sign > 0 ? Math.max(a, bestV) : a, sign < 0 ? Math.min(b, -bestV) : b); if (v > bestV) { bestV = v; bestM = m; } }
        return opt.score ? { move: bestM, v: sign * bestV } : bestM;
      }
      const scored = rootMoves.map(m => ({ m, v: search(Chess.apply(s,m), depth-1, -Infinity, Infinity) }));
      if (!scored.length) return undefined;
      scored.sort((x,y) => sign * (y.v - x.v));
      // Easy picks among moves within a pawn and a half of its best, so it slips now and then.
      const slack = depth <= 1 ? 150 : 0, near = scored.filter(x => sign * (scored[0].v - x.v) <= slack);
      return near[Math.floor(random() * near.length)].m;
    },
    TIMEOUT: { timeout: true },
    /* Hard (2026-11-21): look deeper and deeper, following captures at the
       end, until the time runs out; play the best move of the last search that
       finished. Run off the page's thread (chess-worker.js) so it never freezes it. */
    think(s, ms = 1500, maxDepth = 6) {
      const deadline = Date.now() + ms; let move = Chess.best(s, 2, Math.random, { quiet: true, prune: true });
      for (let d = 3; d <= maxDepth && Date.now() < deadline; d++) {
        try { move = Chess.best(s, d, Math.random, { quiet: true, prune: true, deadline, first: move }) || move; } catch (e) { if (e !== Chess.TIMEOUT) throw e; break; }
      }
      return move;
    },
    /* How the position stands, in centipawns from White's side (+ good for
       White), after a short search. The computer uses it to answer a draw offer. */
    score(s, depth = 2) {
      if (!Chess.moves(s).length) return Chess.check(s) ? (s.turn === 'w' ? -100000 : 100000) : 0;
      return Chess.best(s, depth, Math.random, { quiet: true, prune: true, score: true }).v;
    },
    /* A move written by a player: SAN (Nf3, exd5, O-O, e8=Q) or squares
       (e2e4, e7e8q). Returns the legal move it names, or null. */
    parse(s, text) {
      const raw = String(text || '').trim().replace(/[+#!?]+$/, ''), moves = Chess.moves(s);
      const sq = /^([a-h][1-8])-?([a-h][1-8])=?([qrbn])?$/i.exec(raw);
      if (sq) { const at = x => 'abcdefgh'.indexOf(x[0].toLowerCase()) + (8 - +x[1]) * 8, f = at(sq[1]), t = at(sq[2]), pr = (sq[3] || '').toLowerCase();
        const hit = moves.filter(m => m.from === f && m.to === t && (!m.promote || m.promote === (pr || 'q'))); if (hit.length) return hit[0]; }
      const norm = x => x.replace(/0/g, 'O').replace(/[+#]/g, '').replace(/=/g, '');
      const want = norm(raw);
      return moves.find(m => norm(Chess.san(s, m)) === want) || moves.find(m => norm(Chess.san(s, m)).toLowerCase() === want.toLowerCase() && !/^[a-h]/.test(want) === !/^[a-h]/.test(norm(Chess.san(s, m)))) || null;
    }
  };

  const Checkers = {
    create() { return { b: Array.from({length:64}, (_,i) => (((i >> 3) + i % 8) % 2 ? i < 24 ? 'b' : i >= 40 ? 'w' : '' : '')), turn:'w', chain:-1, quiet:0 }; },
    moves(s) {
      let jumps = [], steps = [];
      for (let i = 0; i < 64; i++) {
        const p = s.b[i]; if (!p || p.toLowerCase() !== s.turn || (s.chain >= 0 && s.chain !== i)) continue;
        const dirs = p === p.toUpperCase() ? [-1,1] : [s.turn === 'w' ? -1 : 1], r = i >> 3, c = i % 8;
        for (const dr of dirs) for (const dc of [-1,1]) if (inside(r+dr,c+dc)) {
          const mid = (r+dr)*8+c+dc, to = (r+2*dr)*8+c+2*dc;
          if (!s.b[mid] && s.chain < 0) steps.push({from:i,to:mid});
          if (s.b[mid] && s.b[mid].toLowerCase() !== s.turn && inside(r+2*dr,c+2*dc) && !s.b[to]) jumps.push({from:i,to,capture:mid});
        }
      }
      return jumps.length ? jumps : s.chain >= 0 ? [] : steps;
    },
    apply(s,m) {
      const n = { ...s, b: s.b.slice() }, p = n.b[m.from]; n.b[m.to] = p; n.b[m.from] = ''; if (m.capture !== undefined) n.b[m.capture] = '';
      const crowned = p === p.toLowerCase() && (m.to < 8 || m.to >= 56); if (crowned) n.b[m.to] = p.toUpperCase();
      n.quiet = m.capture !== undefined || crowned ? 0 : s.quiet + 1;
      n.chain = m.capture !== undefined && !crowned ? m.to : -1;
      if (n.chain >= 0 && Checkers.moves(n).length) return n;
      n.chain = -1; n.turn = other(s.turn); return n;
    },
    /* Alpha-beta, so a board full of kings can't stall it. Easy looks 2 plies
       and picks among near-best moves; medium 5; hard 8. */
    best(s, depth = 5, random = Math.random) {
      const evaluate = n => { let v = 0; for (let i = 0; i < 64; i++) { const p = n.b[i]; if (p) v += (p.toLowerCase() === 'w' ? 1 : -1) * (p === p.toUpperCase() ? 175 : 100 + (p === 'w' ? 7-(i>>3) : i>>3)*3); } return v; };
      const search = (n,d,a,b) => {
        const moves = Checkers.moves(n); if (!moves.length) return n.turn === 'w' ? -10000 - d : 10000 + d;
        if (d <= 0 || n.quiet >= 80) return evaluate(n);
        let v = n.turn === 'w' ? -Infinity : Infinity;
        for (const m of moves) { const next = Checkers.apply(n,m), score = search(next, next.turn === n.turn ? d : d-1, a, b); if (n.turn === 'w') { v = Math.max(v,score); a = Math.max(a,v); } else { v = Math.min(v,score); b = Math.min(b,v); } if (a >= b) break; } return v;
      };
      const sign = s.turn === 'w' ? 1 : -1;
      const scored = Checkers.moves(s).map(m => { const next = Checkers.apply(s,m); return { m, v: search(next, next.turn === s.turn ? depth : depth-1, -Infinity, Infinity) }; }).sort((x,y) => sign * (y.v - x.v));
      if (!scored.length) return undefined;
      const slack = depth <= 2 ? 60 : 0, near = scored.filter(x => sign * (scored[0].v - x.v) <= slack);
      return near[Math.floor(random() * near.length)].m;
    }
  };

  const Sudoku = {
    candidates(b,i) { if (b[i]) return []; const used = new Set(); const r = Math.floor(i/9), c = i%9; for (let j=0;j<9;j++) { used.add(b[r*9+j]); used.add(b[j*9+c]); used.add(b[(Math.floor(r/3)*3+Math.floor(j/3))*9+Math.floor(c/3)*3+j%3]); } return [1,2,3,4,5,6,7,8,9].filter(n => !used.has(n)); },
    count(board, limit = 2) {
      const b = board.slice(); let count = 0;
      const solve = () => { let at=-1, options; for(let i=0;i<81;i++) if(!b[i]) { const v = Sudoku.candidates(b,i); if (!v.length) return; if (!options || v.length < options.length) { at=i; options=v; if(v.length===1) break; } } if(at<0) {count++;return;} for(const n of options) { b[at]=n; solve(); b[at]=0; if(count>=limit)return; } }; solve(); return count;
    },
    create(difficulty = 'easy', random = Math.random) {
      if (difficulty === 'expert') return Sudoku.expert(random);
      const order = () => shuffle([0,1,2],random), rows = order().flatMap(g => order().map(i => g*3+i)), cols = order().flatMap(g => order().map(i => g*3+i)), nums=shuffle([1,2,3,4,5,6,7,8,9],random);
      const answer = rows.flatMap(r => cols.map(c => nums[(r*3+Math.floor(r/3)+c)%9])), b=answer.slice(); let left = {easy:40,medium:48,hard:54,'hard-max':64}[difficulty] || 40;
      for(const i of shuffle([...b.keys()],random)) { const n=b[i]; b[i]=0; if(Sudoku.count(b)!==1)b[i]=n;else if(!--left)break; } return {b,answer};
    },
    /* Can this be finished by singles alone: a square with one candidate, or a
       number with one place left in a row, column or box? Easy to hard can. */
    singles(board) {
      const b = board.slice(), units = [];
      for (let k=0;k<9;k++) { units.push([...Array(9)].map((_,j)=>k*9+j), [...Array(9)].map((_,j)=>j*9+k), [...Array(9)].map((_,j)=>(Math.floor(k/3)*3+Math.floor(j/3))*9+(k%3)*3+j%3)); }
      let progress = true;
      while (progress) {
        progress = false;
        for (let i=0;i<81;i++) if (!b[i]) { const c = Sudoku.candidates(b,i); if (!c.length) return false; if (c.length===1) { b[i]=c[0]; progress=true; } }
        for (const u of units) for (let n=1;n<=9;n++) { if (u.some(i=>b[i]===n)) continue; const spots=u.filter(i=>!b[i]&&Sudoku.candidates(b,i).includes(n)); if (spots.length===1) { b[spots[0]]=n; progress=true; } }
      }
      return b.every(Boolean);
    },
    /* Expert (2026-11-21, Ric picked it): as few clues as the shuffle allows, and
       not finishable by singles, so it needs pairs, pointing and the like. The
       first deal that qualifies wins; after ~1.5 s the sparsest one so far. */
    expert(random = Math.random) {
      const until = Date.now() + 1500; let best = null;
      do { const p = Sudoku.create('hard-max', random); const clues = p.b.filter(Boolean).length; if (!Sudoku.singles(p.b)) return { ...p, expert: true }; if (!best || clues < best.b.filter(Boolean).length) best = p; } while (Date.now() < until);
      return best;
    },
    valid(b) { return b.length === 81 && b.every((n,i) => n >= 1 && n <= 9 && Sudoku.candidates(b.map((v,j) => j===i?0:v),i).includes(n)); }
  };

  const Mines = {
    /* rows × cols; a square field passes one size. Saves from before 2026-11-21
       have only n, so cols/rows fall back to it. */
    create(n=9, mines=10, cols=n) { return { n,rows:n,cols,mines,b:Array(n*cols).fill(0),open:Array(n*cols).fill(false),flags:Array(n*cols).fill(false),marks:Array(n*cols).fill(false),started:false,over:false,won:false }; },
    /* A question mark (2026-11-21): a note only. It never blocks a click and never
       counts as a flag; a flag placed on it replaces it. Older saves have no marks. */
    mark(s,i){if(s.over||s.open[i]||s.flags[i])return false;s.marks=s.marks||Array(s.b.length).fill(false);s.marks[i]=!s.marks[i];return true;},
    size(s){return{rows:s.rows||s.n,cols:s.cols||s.n};},
    neighbors(s,i) {const {rows,cols}=Mines.size(s),r=Math.floor(i/cols),c=i%cols,out=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&r+dr>=0&&r+dr<rows&&c+dc>=0&&c+dc<cols)out.push((r+dr)*cols+c+dc);return out;},
    reveal(s,i,random=Math.random) {
      if(s.over || s.flags[i])return;
      if(!s.started){const safe=new Set([i,...Mines.neighbors(s,i)]),spots=shuffle([...s.b.keys()].filter(j=>!safe.has(j)),random);for(const j of spots.slice(0,s.mines))s.b[j]=-1;for(let j=0;j<s.b.length;j++)if(s.b[j]!==-1)s.b[j]=Mines.neighbors(s,j).filter(k=>s.b[k]===-1).length;s.started=true;}
      if(s.open[i]) {if(s.b[i]>0&&Mines.neighbors(s,i).filter(j=>s.flags[j]).length===s.b[i])for(const j of Mines.neighbors(s,i))if(!s.open[j]&&!s.flags[j])Mines.reveal(s,j,random);return;}
      if(s.b[i]===-1){s.open[i]=true;s.over=true;return;}
      const pending=[i];while(pending.length){const j=pending.pop();if(s.open[j]||s.flags[j])continue;s.open[j]=true;if(s.marks)s.marks[j]=false;if(!s.b[j])for(const k of Mines.neighbors(s,j))if(!s.open[k]&&!s.flags[k])pending.push(k);}
      if(s.open.filter(Boolean).length===s.b.length-s.mines){s.over=true;s.won=true;}
    },
    /* The same mines again, everything covered: "play this board again". */
    replay(s){const {rows,cols}=Mines.size(s);return{...Mines.create(rows,s.mines,cols),b:s.b.slice(),started:s.started};}
  };

  const Word = {
    feedback(guess, answer) {const colors=Array(5).fill('absent'),left=answer.split('');for(let i=0;i<5;i++)if(guess[i]===answer[i]){colors[i]='correct';left[i]='';}for(let i=0;i<5;i++)if(colors[i]!=='correct'){const j=left.indexOf(guess[i]);if(j>=0){colors[i]='present';left[j]='';}}return colors;},
    daily(answers,date=new Date().toISOString().slice(0,10)){let h=2166136261;for(const ch of date)h=Math.imul(h^ch.charCodeAt(0),16777619);return answers[(h>>>0)%answers.length];}
  };

  const Solitaire = {
    create(random=Math.random){const deck=shuffle(Array.from({length:52},(_,i)=>({rank:i%13+1,suit:Math.floor(i/13),up:false})),random),tableau=[];for(let col=0;col<7;col++){const pile=deck.splice(0,col+1);pile[col].up=true;tableau.push(pile);}return{tableau,stock:deck,waste:[],foundation:[[],[],[],[]],moves:0,score:0};},
    red:c=>c.suit===1||c.suit===2,
    /* s.draw is 1 (the scoreboard game) or 3; older saves have none and draw one. */
    draw(s){if(s.stock.length){for(let k=0;k<(s.draw||1)&&s.stock.length;k++){const c=s.stock.pop();c.up=true;s.waste.push(c);}}else if(s.waste.length){s.stock=s.waste.reverse().map(c=>({...c,up:false}));s.waste=[];Solitaire.points(s,(s.draw||1)===3?-20:-100);}else return false;s.moves++;return true;},
    /* Standard points (2026-11-21, Ric: "Standard points"), never below 0. */
    points(s,n){s.score=Math.max(0,(s.score||0)+n);},
    /* Every legal non-draw move, most useful first: home moves, then moves that
       turn over a card or empty a column, then waste to table. */
    options(s){const out=[],home=c=>({type:'foundation',col:c.suit});
      const tops=[...s.tableau.map((p,col)=>p.length?{type:'tableau',col,index:p.length-1}:null),s.waste.length?{type:'waste'}:null].filter(Boolean);
      for(const f of tops){const t=Solitaire.copyTry(s,f,home(Solitaire.pile(s,f).at(-1)));if(t)out.push({from:f,to:t,rank:3});}
      s.tableau.forEach((p,col)=>{const i=p.findIndex(c=>c.up);if(i<0)return;for(let dest=0;dest<7;dest++){if(dest===col)continue;if(i===0&&p[0].rank===13&&!s.tableau[dest].length)continue;const f={type:'tableau',col,index:i},t={type:'tableau',col:dest};if(Solitaire.copyTry(s,f,t))out.push({from:f,to:t,rank:i>0?2:1});}});
      if(s.waste.length)for(let dest=0;dest<7;dest++){const t={type:'tableau',col:dest};if(Solitaire.copyTry(s,{type:'waste'},t))out.push({from:{type:'waste'},to:t,rank:1});}
      return out.sort((a,b)=>b.rank-a.rank);},
    copyTry(s,from,to){const n=copy(s);return Solitaire.move(n,from,to)?to:null;},
    /* True when no move exists and no card in the stock or waste could ever be
       played on what is showing now. */
    stuck(s){if(Solitaire.options(s).length)return false;const cards=[...s.stock,...s.waste];const tops=s.tableau.map(p=>p.at(-1));return !cards.some(c=>c.rank===(s.foundation[c.suit].at(-1)?.rank||0)+1||tops.some(t=>t?(t.up&&t.rank===c.rank+1&&Solitaire.red(t)!==Solitaire.red(c)):c.rank===13));},
    /* Once the stock and waste are empty and every card is face up, the rest is
       just carrying cards home. One card per call, lowest first. */
    autoReady(s){return !s.stock.length&&!s.waste.length&&s.tableau.every(p=>p.every(c=>c.up))&&!Solitaire.won(s);},
    autoStep(s){let best=null;s.tableau.forEach((p,col)=>{const c=p.at(-1);if(c&&c.rank===(s.foundation[c.suit].at(-1)?.rank||0)+1&&(!best||c.rank<best.c.rank))best={c,col};});if(!best)return null;const from={type:'tableau',col:best.col,index:s.tableau[best.col].length-1},to={type:'foundation',col:best.c.suit};Solitaire.move(s,from,to);return{from,to,card:best.c};},
    pile(s,p){return p.type==='tableau'?s.tableau[p.col]:p.type==='foundation'?s.foundation[p.col]:s.waste;},
    move(s,from,to){
      if(from.type===to.type&&from.col===to.col)return false;
      const a=Solitaire.pile(s,from),b=Solitaire.pile(s,to),i=from.index??a.length-1,c=a[i];if(!c||!c.up)return false;
      if(from.type!=='tableau'&&i!==a.length-1)return false;
      const stack=a.slice(i);if(stack.some((x,j)=>!x.up||(j>0&&(stack[j-1].rank!==x.rank+1||Solitaire.red(stack[j-1])===Solitaire.red(x)))))return false;
      const top=b[b.length-1];
      if(to.type==='foundation'){if(stack.length!==1||c.suit!==to.col||c.rank!==(top?top.rank+1:1))return false;}
      else if(to.type==='tableau'){if(top?(!top.up||top.rank!==c.rank+1||Solitaire.red(top)===Solitaire.red(c)):c.rank!==13)return false;}
      else return false;
      b.push(...a.splice(i));let pts=to.type==='foundation'?10:from.type==='waste'?5:from.type==='foundation'?-15:0;if(from.type==='tableau'&&a.length&&!a[a.length-1].up){a[a.length-1].up=true;pts+=5;}Solitaire.points(s,pts);s.moves++;return true;
    },
    won:s=>s.foundation.every(p=>p.length===13),
    /* Can this deal be won? (2026-11-21, Ric picked "Winnable deals only".)
       Plays the deal out knowing every card, depth first: safe cards go home at
       once, then moves that turn a card over, then the rest, then the deck.
       Positions already seen are skipped. Returns true (won), false (every
       line tried) or null (gave up after `budget` positions: count it as no). */
    solve(s,budget=150000){
      const k=s.draw||1,id=c=>c.suit*13+c.rank-1,rk=x=>x%13+1,su=x=>(x/13)|0,red=x=>su(x)===1||su(x)===2;
      const start={t:s.tableau.map(p=>p.map(id)),d:s.tableau.map(p=>p.filter(c=>!c.up).length),st:s.stock.map(id),w:s.waste.map(id),f:s.foundation.map(p=>p.length)};
      const seen=new Set();let nodes=0;
      const clone=n=>({t:n.t.map(p=>p.slice()),d:n.d.slice(),st:n.st.slice(),w:n.w.slice(),f:n.f.slice()});
      const fits=(c,col,n)=>{const p=n.t[col];if(!p.length)return rk(c)===13;const top=p[p.length-1];return n.d[col]<p.length&&rk(top)===rk(c)+1&&red(top)!==red(c);};
      const reveal=(n,col)=>{if(n.d[col]>=n.t[col].length&&n.d[col]>0)n.d[col]=n.t[col].length-1;};
      const homeOk=(c,n)=>n.f[su(c)]===rk(c)-1;
      const safe=(c,n)=>{const r=rk(c);if(r<=2)return true;const o=red(c)?[0,3]:[1,2];return n.f[o[0]]>=r-1&&n.f[o[1]]>=r-1;};
      const settle=n=>{let again=true;while(again){again=false;for(let col=0;col<7;col++){const p=n.t[col];if(p.length&&n.d[col]<p.length){const c=p[p.length-1];if(homeOk(c,n)&&safe(c,n)){p.pop();n.f[su(c)]++;reveal(n,col);again=true;}}}if(n.w.length){const c=n.w[n.w.length-1];if(homeOk(c,n)&&safe(c,n)){n.w.pop();n.f[su(c)]++;again=true;}}}};
      const key=n=>n.f.join(',')+'|'+n.t.map((p,i)=>n.d[i]+':'+p.join('.')).sort().join('/')+'|'+n.st.join('.')+'^'+n.w.join('.');
      const go=n=>{
        settle(n);
        if(n.f.every(x=>x===13))return true;
        if(++nodes>budget)throw Solitaire.GAVE_UP;
        const kk=key(n);if(seen.has(kk))return false;seen.add(kk);
        const next=[];
        // home from a column or the waste
        for(let col=0;col<7;col++){const p=n.t[col];if(p.length&&n.d[col]<p.length&&homeOk(p[p.length-1],n)){const m=clone(n);const c=m.t[col].pop();m.f[su(c)]++;reveal(m,col);next.push([4,m]);}}
        if(n.w.length&&homeOk(n.w[n.w.length-1],n)){const m=clone(n);const c=m.w.pop();m.f[su(c)]++;next.push([3,m]);}
        // column to column: the whole face-up run, or part of it when the card it uncovers can go home
        for(let col=0;col<7;col++){const p=n.t[col];for(let i=n.d[col];i<p.length;i++){const c=p[i];
          const whole=i===n.d[col];if(!whole&&!(homeOk(p[i-1],n)))continue;
          if(whole&&i===0&&rk(c)===13)continue; // a king already at the bottom
          for(let dest=0;dest<7;dest++){if(dest===col||!fits(c,dest,n))continue;if(!n.t[dest].length&&!whole)continue;
            const m=clone(n);m.t[dest].push(...m.t[col].splice(i));reveal(m,col);next.push([whole&&i>0?5:whole?1:2,m]);if(!n.t[dest].length)break;}}}
        // waste to a column
        if(n.w.length){const c=n.w[n.w.length-1];for(let dest=0;dest<7;dest++){if(!fits(c,dest,n))continue;const m=clone(n);m.t[dest].push(m.w.pop());next.push([2,m]);if(!n.t[dest].length)break;}}
        // the deck: draw, or turn the waste over
        if(n.st.length){const m=clone(n);for(let j=0;j<k&&m.st.length;j++)m.w.push(m.st.pop());next.push([0,m]);}
        else if(n.w.length){const m=clone(n);m.st=m.w.reverse();m.w=[];next.push([-1,m]);}
        next.sort((a,b)=>b[0]-a[0]);
        for(const [,m] of next)if(go(m))return true;
        return false;
      };
      try{return go(clone(start));}catch(e){if(e===Solitaire.GAVE_UP)return null;throw e;}
    },
    GAVE_UP:{gaveUp:true},
    /* Deal until the solver wins one (or time runs out: then the last deal, marked unproven). */
    winnable(draw=1,ms=2500,random=Math.random){const until=Date.now()+ms;let s;do{s=Solitaire.create(random);s.draw=draw;if(Solitaire.solve(s)===true){s.winnable=true;return s;}}while(Date.now()<until);return s;}
  };

  const Snake = {
    create(){return{body:[{x:7,y:10},{x:6,y:10},{x:5,y:10}],dir:{x:1,y:0},queued:null,food:{x:14,y:10},score:0,over:false};},
    /* Two turns can wait, so a quick swipe-swipe (down, then left) inside one
       step isn't lost; each is checked against the direction before it.
       Turning the way you're already going does nothing. */
    turn(s,x,y){const last=s.queued2||s.queued||s.dir;if(s.queued2||(x===last.x&&y===last.y)||(x===-last.x&&y===-last.y))return;if(!s.queued)s.queued={x,y};else s.queued2={x,y};},
    /* s.wrap: through-the-walls mode; leaving one edge brings you in the other side. */
    step(s,random=Math.random){if(s.over)return;if(s.queued){s.dir=s.queued;s.queued=s.queued2||null;s.queued2=null;}const h={x:s.body[0].x+s.dir.x,y:s.body[0].y+s.dir.y};if(s.wrap){h.x=(h.x+20)%20;h.y=(h.y+20)%20;}const eat=h.x===s.food.x&&h.y===s.food.y;
      if(!inside(h.y,h.x,20)||s.body.slice(0,eat?undefined:-1).some(p=>p.x===h.x&&p.y===h.y)){s.over=true;return;}
      s.body.unshift(h);if(eat){s.score+=10;const free=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!s.body.some(p=>p.x===x&&p.y===y))free.push({x,y});if(!free.length){s.over=true;return;}s.food=free[Math.floor(random()*free.length)];}else s.body.pop();
    }
  };

  const Tetris = {
    shapes:[[[1,1,1,1]],[[2,2],[2,2]],[[0,3,0],[3,3,3]],[[0,4,4],[4,4,0]],[[5,5,0],[0,5,5]],[[6,0,0],[6,6,6]],[[0,0,7],[7,7,7]]],
    create(random=Math.random){const s={b:Array.from({length:20},()=>Array(10).fill(0)),bag:[],next:null,piece:null,x:3,y:0,score:0,lines:0,over:false};Tetris.spawn(s,random);return s;},
    take(s,random){if(!s.bag.length)s.bag=shuffle([0,1,2,3,4,5,6],random);return copy(Tetris.shapes[s.bag.pop()]);},
    fits(s,p=s.piece,x=s.x,y=s.y){return p.every((row,r)=>row.every((v,c)=>!v||(x+c>=0&&x+c<10&&y+r<20&&(y+r<0||!s.b[y+r][x+c]))));},
    /* s.next is the next piece; s.queue holds the two after it. */
    spawn(s,random=Math.random){s.queue=s.queue||[];s.piece=s.next||Tetris.take(s,random);s.next=s.queue.shift()||Tetris.take(s,random);while(s.queue.length<2)s.queue.push(Tetris.take(s,random));Tetris.place(s);},
    place(s){s.x=Math.floor((10-s.piece[0].length)/2);s.y=0;if(!Tetris.fits(s))s.over=true;},
    /* Hold swaps the falling piece with the held one (or the next piece), once per drop. */
    hold(s,random=Math.random){if(s.over||s.held)return false;const kind=Math.max(...s.piece.flat()),prev=s.hold;s.hold=kind;if(prev){s.piece=copy(Tetris.shapes[prev-1]);Tetris.place(s);}else Tetris.spawn(s,random);s.held=true;return true;},
    move(s,dx,dy){if(!s.over&&Tetris.fits(s,s.piece,s.x+dx,s.y+dy)){s.x+=dx;s.y+=dy;return true;}return false;},
    rotate(s,reverse=false){if(s.over)return false;const p=reverse?s.piece[0].map((_,c)=>s.piece.map(row=>row[s.piece[0].length-1-c])):s.piece[0].map((_,c)=>s.piece.map(row=>row[c]).reverse());for(const dx of [0,-1,1,-2,2])if(Tetris.fits(s,p,s.x+dx,s.y)){s.piece=p;s.x+=dx;return true;}return false;},
    lock(s,random=Math.random){if(s.over)return;for(let r=0;r<s.piece.length;r++)for(let c=0;c<s.piece[r].length;c++)if(s.piece[r][c]){if(s.y+r<0){s.over=true;return;}s.b[s.y+r][s.x+c]=s.piece[r][c];}
      const kept=s.b.filter(row=>!row.every(Boolean)),n=20-kept.length,level=1+Math.floor(s.lines/10);s.score+=[0,100,300,500,800][n]*level;s.lines+=n;while(kept.length<20)kept.unshift(Array(10).fill(0));s.b=kept;s.held=false;Tetris.spawn(s,random);},
    /* Rows the falling piece would complete if it locked where it is (for the flash). */
    fullRows(s){const rows=[];for(let r=0;r<20;r++){if(s.b[r].every((v,c)=>v||s.piece.some((row,pr)=>s.y+pr===r&&row[c-s.x])))rows.push(r);}return rows;},
    drop(s,random=Math.random){while(Tetris.move(s,0,1))s.score+=2;Tetris.lock(s,random);}
  };
  const api={copy,shuffle,seeded,Tic,Chess,Checkers,Sudoku,Mines,Word,Solitaire,Snake,Tetris};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArcadeGames=api;
})(typeof globalThis!=='undefined'?globalThis:this);
