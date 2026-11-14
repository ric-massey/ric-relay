/* The Arcade games' public, casual scoreboards. Browser-reported scores, not
   verified competitive records. No account, analytics id, IP or location is
   published. Separate D1 tables: this handler never reads visitor records. */
const FIXED = new Set(['solitaire','snake','tetris','wordle-practice',...['easy','medium','hard'].flatMap(d=>['sudoku-'+d,'mines-'+d])]);
const ORIGIN = /^(https:\/\/(www\.)?ricmassey\.com|https:\/\/ric-massey\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const ready = new WeakMap();
const DAY = 86400000;
export function validBoard(board) {
  if (FIXED.has(board)) return true;
  if (!/^wordle-\d{4}-\d{2}-\d{2}$/.test(board || '')) return false;
  const text = board.slice(7), date = Date.parse(text);
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
  if (parts.length!==2 || parts[1]!=='scores') return json({error:'not found'},404,origin);
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
  if (!['GET','POST'].includes(request.method)) return json({error:'method not allowed'},405,origin);
  if (request.method==='POST' && origin && !ORIGIN.test(origin)) return json({error:'origin refused'},403,origin);
  let body;
  if(request.method==='POST'){
    if(!/^application\/json\b/i.test(request.headers.get('content-type')||''))return json({error:'send JSON'},415,origin);
    body=await readBody(request);
    if(!body||typeof body!=='object'||Array.isArray(body)||!validBoard(body.board)||!validScore(body.board,body.score)||!/^[A-Z]{1,3}$/.test(body.initials||'')||!/^[a-zA-Z0-9-]{12,64}$/.test(body.id||''))return json({error:'invalid score'},400,origin);
    if(body.board.startsWith('wordle-')&&body.board!=='wordle-practice'&&Date.parse(body.board.slice(7))<Date.now()-2*DAY)return json({error:'this daily board is closed'},400,origin);
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
        db.prepare("DELETE FROM arcade_scores WHERE board GLOB 'wordle-????-??-??' AND at < ?").bind(now-366*DAY)
      ]);
    }
    return json({scores:await scores(env.STATS,board)},200,origin,{'cache-control':'no-store'});
  }catch{return json({error:'scoreboard temporarily unavailable'},503,origin);}
}
