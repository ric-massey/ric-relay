import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {memoryD1,haveSqlite} from './d1-memory.mjs';
const origin='https://ricmassey.com';
const env=()=>({STATS:memoryD1(),LOG:{idFromName:n=>n,get:()=>({fetch:()=>{throw Error('Scores must not ask the owner log.');}})}});
const request=(env,board='snake',body=null,headers={})=>worker.fetch(new Request('https://example.test/arcade/scores?board='+encodeURIComponent(board),body?{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)}:{headers:{origin,...headers}}),env,{});
let sequence=0;const row=(board,score,initials='ABC')=>({id:'test-score-'+String(++sequence).padStart(10,'0'),board,score,initials});
test('public boards share scores, keep highest/fastest separate, deduplicate retries, expose only public fields',{skip:!haveSqlite},async()=>{const e=env();const r=row('snake',50);assert.equal((await request(e,'snake',r)).status,200);await request(e,'snake',r);await request(e,'snake',row('snake',120,'XYZ'));await request(e,'solitaire',row('solitaire',210));await request(e,'solitaire',row('solitaire',90));let data=await(await request(e)).json();assert.deepEqual(data.scores.map(x=>x.score),[120,50]);assert.deepEqual(Object.keys(data.scores[0]).sort(),['at','initials','score']);data=await(await request(e,'solitaire')).json();assert.deepEqual(data.scores.map(x=>x.score),[90,210]);assert(!e.STATS.raw.prepare("SELECT name FROM sqlite_master WHERE name='views'").get());});
test('scores reject unknown boards, script initials, floats, impossible ranges and malformed requests',{skip:!haveSqlite},async()=>{const e=env();for(const r of [row('../stats',10),row('snake',15),row('snake',4000),row('snake',-10),row('snake',Infinity),row('tetris',1.5),row('wordle-practice',7),row('sudoku-easy',0),row('snake',10,'<b>')])assert.equal((await request(e,'snake',r)).status,400);assert.equal((await request(e,'bad')).status,400);assert.equal((await request(e,'snake',row('snake',10),{origin:'https://elsewhere.test'})).status,403);const today='wordle-'+new Date().toISOString().slice(0,10);assert.equal((await request(e,today,row(today,3))).status,200);const bad=await worker.fetch(new Request('https://example.test/arcade/scores',{method:'POST',headers:{'content-type':'application/json'},body:'{'}),e,{});assert.equal(bad.status,400);const large=await worker.fetch(new Request('https://example.test/arcade/scores',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(2050)}),e,{});assert.equal(large.status,400);});
test('the shared write throttle spans requests; reads still work and other clients can submit',{skip:!haveSqlite},async()=>{const e=env();for(let i=0;i<10;i++)assert.equal((await request(e,'tetris',row('tetris',i+1))).status,200);assert.equal((await request(e,'tetris',row('tetris',20))).status,429);assert.equal((await request(e,'tetris')).status,200);assert.equal((await request(e,'tetris',row('tetris',30),{'cf-connecting-ip':'test-another-client'})).status,200);const data=await(await request(e,'tetris')).json();assert.equal(data.scores.length,10);assert.equal(data.scores[0].score,30);});
test('scoreboard routes are explicit, unavailable storage is honest, preflight and methods behave',async()=>{const e=env();delete e.STATS;assert.equal((await request(e)).status,503);for(const [path,method,expected]of [['scores','OPTIONS',204],['scores','DELETE',405],['nope','GET',404],['scores/extra','GET',404]]){const r=await worker.fetch(new Request('https://example.test/arcade/'+path,{method}),e,{});assert.equal(r.status,expected);}});
/* 2026-11-21: the expert minefield and the daily Sudoku/Solitaire boards. */
test('expert mines and dated daily puzzle boards are accepted; old days and made-up names are not',{skip:!haveSqlite},async()=>{const e=env(),day=new Date().toISOString().slice(0,10);for(const b of ['mines-expert','sudoku-daily-'+day,'solitaire-daily-'+day])assert.equal((await request(e,b,row(b,321))).status,200,b);const old='sudoku-daily-2020-01-01';assert.equal((await request(e,old,row(old,100))).status,400);for(const b of ['mines-insane','tetris-daily-'+day,'sudoku-daily-'+day+'x'])assert.equal((await request(e,b,row(b,100))).status,400,b);const data=await(await request(e,'mines-expert')).json();assert.deepEqual(data.scores.map(x=>x.score),[321]);});
/* 2026-11-21: online Chess and Checkers rooms (Ric: "multiplayer for chess and checkers needs to be in"). */
const room=(e,path='',body=null,headers={})=>worker.fetch(new Request('https://example.test/arcade/rooms'+path,body?{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)}:{headers:{origin,...headers}}),e,{});
test('a room: host starts, friend joins once, each seat writes in turn by version, both read the same list',{skip:!haveSqlite},async()=>{
  const e=env();const made=await(await room(e,'',{game:'chess',color:'b'})).json();assert.match(made.code,/^[A-Z]{4}$/);assert.equal(made.seat,'h');
  let st=await(await room(e,'/'+made.code)).json();assert.deepEqual([st.game,st.hostColor,st.guest,st.n,st.events],['chess','b',false,0,[]]);
  const g=await(await room(e,'/'+made.code+'/join',{})).json();assert.equal(g.seat,'g');assert.equal((await room(e,'/'+made.code+'/join',{})).status,409);
  assert.equal((await room(e,'/'+made.code+'/events',{token:g.token,n:0,t:'m',v:'e2e4'})).status,200);
  assert.equal((await room(e,'/'+made.code+'/events',{token:made.token,n:0,t:'m',v:'e7e5'})).status,409,'stale version is refused');
  assert.equal((await room(e,'/'+made.code+'/events',{token:made.token,n:1,t:'m',v:'e7e5'})).status,200);
  assert.equal((await room(e,'/'+made.code+'/events',{token:'not-a-seat',n:2,t:'resign'})).status,403);
  st=await(await room(e,'/'+made.code)).json();assert.equal(st.guest,true);assert.deepEqual(st.events,[{s:'g',t:'m',v:'e2e4'},{s:'h',t:'m',v:'e7e5'}]);
  st=await(await room(e,'/'+made.code+'?from=1')).json();assert.deepEqual(st.events,[{s:'h',t:'m',v:'e7e5'}]);
  assert(!JSON.stringify(e.STATS.raw.prepare('SELECT * FROM arcade_rooms').all()).includes(made.token),'tokens are stored hashed');
});
test('rooms refuse bad games, events, codes and methods; idle rooms expire',{skip:!haveSqlite},async()=>{
  const e=env();for(const b of [{game:'poker',color:'w'},{game:'chess',color:'x'},{}])assert.equal((await room(e,'',b)).status,400);
  const made=await(await room(e,'',{game:'checkers',color:'w'})).json();
  for(const b of [{token:made.token,n:0,t:'hack'},{token:made.token,n:0,t:'m',v:'<script>'},{token:made.token,n:0,t:'resign',v:'x'},{token:made.token,n:'0',t:'resign'}])assert.equal((await room(e,'/'+made.code+'/events',b)).status,400);
  assert.equal((await room(e,'/'+made.code+'/events',{token:made.token,n:0,t:'m',v:'9x18x27'})).status,200);
  assert.equal((await room(e,'/ZZZZ')).status,404);assert.equal((await room(e,'/abcd')).status,404);assert.equal((await room(e,'/'+made.code+'/other',{})).status,404);
  assert.equal((await worker.fetch(new Request('https://example.test/arcade/rooms/'+made.code,{method:'DELETE'}),e,{})).status,405);
  assert.equal((await room(e,'',{game:'chess',color:'w'},{origin:'https://elsewhere.test'})).status,403);
  e.STATS.raw.prepare('UPDATE arcade_rooms SET touched = 0').run();assert.equal((await room(e,'/'+made.code)).status,404);
});
