/* The Arcade games' public, casual scoreboards. Browser-reported scores, not
   verified competitive records. No account, analytics id, IP or location is
   published. Separate D1 tables: this handler never reads visitor records. */
/* 2026-11-21: mines-expert (30 × 16, 99 mines), and dated boards for the daily
   Sudoku puzzle and Solitaire deal beside the daily word. */
const FIXED = new Set(['solitaire','snake','tetris','wordle-practice','mines-expert','sudoku-expert',...['easy','medium','hard'].flatMap(d=>['sudoku-'+d,'mines-'+d])]);
const DATED = /^(wordle|sudoku-daily|solitaire-daily)-(\d{4}-\d{2}-\d{2})$/;
const dateOf = board => DATED.exec(board || '')?.[2] || null;
const ORIGIN = /^(https:\/\/(www\.)?ricmassey\.com|https:\/\/ric-massey\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const ready = new WeakMap();
const DAY = 86400000;
export function validBoard(board) {
  if (FIXED.has(board)) return true;
  const text = dateOf(board); if (!text) return false;
  const date = Date.parse(text);
  return Number.isFinite(date) && new Date(date).toISOString().slice(0,10) === text && date <= Date.now() && date >= Date.now() - 366 * DAY;
}
export function validScore(board, score) {
  if (!Number.isSafeInteger(score) || score < 1) return false;
  if (board === 'snake') return score <= 3970 && score % 10 === 0;
  if (board === 'tetris') return score <= 10000000;
  if (board.startsWith('wordle-')) return score <= 6;
  return score <= 86400;
}
async function ensure(db) {
  if (!ready.has(db)) ready.set(db, db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS arcade_scores (id TEXT PRIMARY KEY, board TEXT NOT NULL, initials TEXT NOT NULL, score INTEGER NOT NULL, sort_score INTEGER NOT NULL, at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS arcade_ranking ON arcade_scores(board, sort_score, at)'),
    db.prepare('CREATE TABLE IF NOT EXISTS arcade_rate (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)')
  ]).catch(e=>{ready.delete(db);throw e;}));
  return ready.get(db);
}
async function readBody(request) {
  if (Number(request.headers.get('content-length')) > 2048) return null;
  const reader = request.body?.getReader(); if (!reader) return null;
  const chunks=[]; let size=0;
  while (true) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return null;}chunks.push(value);}
  const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(all));}catch{return null;}
}
async function scores(db,board) {
  return (await db.prepare('SELECT initials, score, at FROM arcade_scores WHERE board = ? ORDER BY sort_score, at, id LIMIT 10').bind(board).all()).results;
}
export async function arcadeRoute(request, env, parts, url, {json,cors}) {
  const origin=request.headers.get('origin');
  if (parts[1]==='rooms') return roomRoute(request, env, parts, url, {json,cors});
  if (parts.length!==2 || parts[1]!=='scores') return json({error:'not found'},404,origin);
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
  if (!['GET','POST'].includes(request.method)) return json({error:'method not allowed'},405,origin);
  if (request.method==='POST' && origin && !ORIGIN.test(origin)) return json({error:'origin refused'},403,origin);
  let body;
  if(request.method==='POST'){
    if(!/^application\/json\b/i.test(request.headers.get('content-type')||''))return json({error:'send JSON'},415,origin);
    body=await readBody(request);
    if(!body||typeof body!=='object'||Array.isArray(body)||!validBoard(body.board)||!validScore(body.board,body.score)||!/^[A-Z]{1,3}$/.test(body.initials||'')||!/^[a-zA-Z0-9-]{12,64}$/.test(body.id||''))return json({error:'invalid score'},400,origin);
    if(dateOf(body.board)&&Date.parse(dateOf(body.board))<Date.now()-2*DAY)return json({error:'this daily board is closed'},400,origin);
  }
  const board=request.method==='GET'?url.searchParams.get('board'):body.board;
  if(!validBoard(board))return json({error:'unknown board'},400,origin);
  if(!env.STATS)return json({error:'scoreboard storage is not configured'},503,origin);
  try{
    const db=env.STATS;await ensure(db);
    if(request.method==='POST'){
      const now=Date.now(),minute=Math.floor(now/60000);
      // A minute-specific hash is kept for at most ten minutes to rate-limit
      // writes across isolates. The raw address is never stored or returned.
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(minute+':'+(request.headers.get('cf-connecting-ip')||'local')));
      const key=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
      await db.prepare('DELETE FROM arcade_rate WHERE expires < ?').bind(now).run();
      const rate=await db.prepare('INSERT INTO arcade_rate (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+600000).first();
      if(rate.count>10)return json({error:'too many scores — wait a minute'},429,origin,{'retry-after':'60'});
      const order=board==='snake'||board==='tetris'?-body.score:body.score;
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO arcade_scores (id,board,initials,score,sort_score,at) VALUES (?,?,?,?,?,?)').bind(body.id,board,body.initials,body.score,order,now),
        db.prepare('DELETE FROM arcade_scores WHERE board = ? AND id NOT IN (SELECT id FROM arcade_scores WHERE board = ? ORDER BY sort_score, at, id LIMIT 100)').bind(board,board),
        db.prepare("DELETE FROM arcade_scores WHERE (board GLOB 'wordle-????-??-??' OR board GLOB 'sudoku-daily-????-??-??' OR board GLOB 'solitaire-daily-????-??-??') AND at < ?").bind(now-366*DAY)
      ]);
    }
    return json({scores:await scores(env.STATS,board)},200,origin,{'cache-control':'no-store'});
  }catch{return json({error:'scoreboard temporarily unavailable'},503,origin);}
}

/* ---- Online games: Chess and Checkers with a friend (2026-11-21, Ric:
   "multiplayer for chess and checkers needs to be in"). A room is a short code
   and a list of events (moves, resign, draw offers, rematch); both browsers
   replay the same list, so they agree on the board without this Worker knowing
   the rules. Each seat holds a random token; only its SHA-256 is stored. The
   event count is a version: a write names the count it saw and is refused
   (409) if the room has moved on, so two writes can never interleave. No
   accounts, no lobby, nothing public; rooms idle for 14 days are deleted. */
const ROOM_GAMES = new Set(['chess','checkers']);
const ROOM_EVENTS = new Set(['m','resign','offer','accept','decline','again']);
const ROOM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, which read as 1 and 0
const ROOM_MAX_EVENTS = 1500, ROOM_IDLE = 14 * DAY;
const roomsReady = new WeakMap();
async function ensureRooms(db) {
  if (!roomsReady.has(db)) roomsReady.set(db, db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS arcade_rooms (code TEXT PRIMARY KEY, game TEXT NOT NULL, host_color TEXT NOT NULL, host TEXT NOT NULL, guest TEXT, events TEXT NOT NULL, n INTEGER NOT NULL, created INTEGER NOT NULL, touched INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS arcade_rooms_idle ON arcade_rooms(touched)'),
    db.prepare('CREATE TABLE IF NOT EXISTS arcade_rate (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)')
  ]).catch(e=>{roomsReady.delete(db);throw e;}));
  return roomsReady.get(db);
}
const hex = buf => Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
const sha = async text => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
function seatToken() { const b = new Uint8Array(18); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_'); }
function roomCode() { const b = new Uint8Array(4); crypto.getRandomValues(b); return Array.from(b, x => ROOM_LETTERS[x % ROOM_LETTERS.length]).join(''); }
export function validEvent(e) {
  if (!e || typeof e !== 'object' || !ROOM_EVENTS.has(e.t)) return false;
  if (e.t === 'm') return typeof e.v === 'string' && /^[a-h1-8qrbnx0-9-]{2,60}$/i.test(e.v);
  return e.v === undefined;
}
async function roomRoute(request, env, parts, url, {json,cors}) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:cors(origin)});
  const code = parts[2], action = parts[3];
  if (parts.length > 4 || (code !== undefined && !/^[A-Z]{4}$/.test(code)) || (action !== undefined && !['join','events'].includes(action))) return json({error:'not found'},404,origin);
  const isGet = request.method === 'GET', isPost = request.method === 'POST';
  if ((isGet && (!code || action)) || (isPost && code && !action) || (!isGet && !isPost)) return json({error:'method not allowed'},405,origin);
  if (isPost && origin && !ORIGIN.test(origin)) return json({error:'origin refused'},403,origin);
  let body = null;
  if (isPost) {
    if (!/^application\/json\b/i.test(request.headers.get('content-type')||'')) return json({error:'send JSON'},415,origin);
    body = await readBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'invalid request'},400,origin);
  }
  if (!env.STATS) return json({error:'game storage is not configured'},503,origin);
  const db = env.STATS, now = Date.now(), noStore = {'cache-control':'no-store'};
  try {
    await ensureRooms(db);
    if (!code) { // start a room
      if (!ROOM_GAMES.has(body.game) || !['w','b'].includes(body.color)) return json({error:'invalid game'},400,origin);
      const key = 'room:' + await sha(Math.floor(now/600000) + ':' + (request.headers.get('cf-connecting-ip')||'local'));
      await db.prepare('DELETE FROM arcade_rate WHERE expires < ?').bind(now).run();
      const rate = await db.prepare('INSERT INTO arcade_rate (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, now+600000).first();
      if (rate.count > 30) return json({error:'too many new games — wait a few minutes'},429,origin,{'retry-after':'300'});
      await db.prepare('DELETE FROM arcade_rooms WHERE touched < ?').bind(now - ROOM_IDLE).run();
      const token = seatToken(), host = await sha(token);
      for (let i = 0; i < 6; i++) {
        const c = roomCode();
        const r = await db.prepare("INSERT OR IGNORE INTO arcade_rooms (code,game,host_color,host,guest,events,n,created,touched) VALUES (?,?,?,?,NULL,'[]',0,?,?)").bind(c, body.game, body.color, host, now, now).run();
        if (r.meta?.changes) return json({code:c, token, seat:'h'},200,origin,noStore);
      }
      return json({error:'no free game codes just now'},503,origin);
    }
    const room = await db.prepare('SELECT * FROM arcade_rooms WHERE code = ?').bind(code).first();
    if (!room || room.touched < now - ROOM_IDLE) return json({error:'no such game'},404,origin,noStore);
    if (isGet) {
      const from = Math.max(0, Math.min(Number.parseInt(url.searchParams.get('from')||'0',10) || 0, room.n));
      return json({game:room.game, hostColor:room.host_color, guest:!!room.guest, n:room.n, events:JSON.parse(room.events).slice(from)},200,origin,noStore);
    }
    if (action === 'join') {
      if (room.guest) return json({error:'this game already has two players'},409,origin);
      const token = seatToken();
      const r = await db.prepare('UPDATE arcade_rooms SET guest = ?, touched = ? WHERE code = ? AND guest IS NULL').bind(await sha(token), now, code).run();
      if (!r.meta?.changes) return json({error:'this game already has two players'},409,origin);
      return json({token, seat:'g', game:room.game},200,origin,noStore);
    }
    // action === 'events': one event from a seat, at the count it last saw
    if (typeof body.token !== 'string' || body.token.length > 64 || !Number.isSafeInteger(body.n)) return json({error:'invalid request'},400,origin);
    const who = await sha(body.token), seat = who === room.host ? 'h' : room.guest && who === room.guest ? 'g' : null;
    if (!seat) return json({error:'not a player in this game'},403,origin);
    const event = {t:body.t, ...(body.v !== undefined ? {v:body.v} : {})};
    if (!validEvent(event)) return json({error:'invalid event'},400,origin);
    if (body.n !== room.n) return json({error:'the game has moved on', n:room.n},409,origin,noStore);
    if (room.n >= ROOM_MAX_EVENTS) return json({error:'this game is full'},409,origin);
    const events = JSON.parse(room.events); events.push({s:seat, ...event});
    const r = await db.prepare('UPDATE arcade_rooms SET events = ?, n = n + 1, touched = ? WHERE code = ? AND n = ?').bind(JSON.stringify(events), now, code, room.n).run();
    if (!r.meta?.changes) return json({error:'the game has moved on'},409,origin,noStore);
    return json({n:room.n+1},200,origin,noStore);
  } catch { return json({error:'games temporarily unavailable'},503,origin); }
}
