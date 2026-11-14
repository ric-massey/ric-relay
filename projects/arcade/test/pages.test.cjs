const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../../..');
const ids=['solitaire','tictactoe','chess','wordle','sudoku','minesweeper','tetris','checkers','snake'];
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

test('nine games have independent, directly playable Arcade entries with three page-owned styles',()=>{
  const arcade=read('gaming.html');
  assert(!arcade.includes('projects/classics/'));
  assert(!/The Classics/i.test(arcade));
  for(const id of ids){
    assert(arcade.includes(`href="projects/${id}/index.html"`),`${id} links directly from the Arcade`);
    const page=read(`projects/${id}/index.html`);
    assert(page.includes(`data-game="${id}"`));
    assert(page.includes('<style>'),`${id} owns its look`);
    assert(page.includes('body[data-skin="1"]')&&page.includes('body[data-skin="2"]'));
    assert(page.includes('<section id="playroom" aria-'),`${id} opens on its game`);
    assert(!/Classics|catalog|lobby-title/.test(page));
    const styles=page.match(/<select id="style-switch"[^>]*>(.*?)<\/select>/s)[1];
    assert.equal((styles.match(/<option /g)||[]).length,3);
    for(const [,src] of page.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)){
      if(/^(https?:|data:)/.test(src))continue;
      assert(fs.existsSync(path.resolve(ROOT,'projects',id,src)),`${id}: ${src} exists`);
    }
    assert(fs.existsSync(path.join(ROOT,`assets/games/${id}.jpg`)));
    assert(fs.existsSync(path.join(ROOT,`assets/frontdoor/thumbs/${id}.jpg`)));
    assert.equal(page.includes('../arcade/words.js'),id==='wordle','only Wordle downloads the word dictionary');
  }
});

test('old shared links resolve only to known game pages or the Arcade',()=>{
  const page=read('projects/classics/index.html');
  const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  for(const id of ids){let result;vm.runInNewContext(script,{location:{hash:'#'+id,replace:url=>result=url}});assert.equal(result,`../${id}/index.html`);}
  for(const hash of ['','#unknown','#https://other.invalid','#../../admin/']){let result;vm.runInNewContext(script,{location:{hash,replace:url=>result=url}});assert.equal(result,'../../gaming.html');}
});

test('all 27 page palettes keep body and panel text above 4.5:1',()=>{
  const properties=s=>Object.fromEntries([...s.matchAll(/--([a-z-]+):(#[a-f\d]{3,6})\b/gi)].map(m=>[m[1],m[2]]));
  const light=h=>{if(h.length===4)h='#'+[...h.slice(1)].map(c=>c+c).join('');return h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,b,i)=>a+b*[.2126,.7152,.0722][i],0);};
  const contrast=(a,b)=>{a=light(a);b=light(b);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
  for(const id of ids){
    const page=read(`projects/${id}/index.html`),base=properties(page.match(/body\{--paper:[^}]+\}/)[0]);
    for(const skin of ['0','1','2']){
      const extra=skin==='0'?'':page.match(new RegExp('body\\[data-skin="'+skin+'"\\]\\{[^}]+\\}'))[0];
      const v={...base,...properties(extra)};
      // Minesweeper's chrome and prose sit on its panel; the teal desktop
      // carries a separately white heading, not the panel's dark ink.
      for(const text of ['ink','muted'])for(const bg of id==='minesweeper'?['panel']:['paper','panel'])assert(contrast(v[text],v[bg])>=4.5,`${id}/${skin}: ${text} on ${bg}`);
    }
  }
});

test('style changes preserve gameplay and existing scoreboard, initials and daily storage contracts',()=>{
  const app=read('projects/arcade/app.js');
  const body=app.slice(app.indexOf('  function applyStyle()'),app.indexOf('  const savedStyle='));
  assert(!/\b(start|route|cleanup|finish)\s*\(/.test(body),'changing style never starts a new game');
  assert(body.includes('drawAction()'),'canvas games redraw the existing position');
  assert(app.includes("localStorage.getItem('classics:'+k)"),'existing local records remain readable');
  assert(app.includes("'/arcade/scores'"),'all pages retain the deployed shared scoreboard');
  assert(app.includes('const id=document.body.dataset.game'),'the page determines its game, never a collection hash');
  new vm.Script(read('projects/arcade/preview.js'));
});

test('all front-door game previews use the real engines without loading game pages or the dictionary',()=>{
  const preview=read('projects/arcade/preview.js');
  assert(!/\b(fetch|iframe|XMLHttpRequest)\b/.test(preview));
  assert(!preview.includes('words.js'));
  const context={window:{},globalThis:{}};
  context.globalThis=context;
  vm.runInNewContext(read('projects/arcade/engine.js'),context);
  context.window.ArcadeGames=context.ArcadeGames;
  vm.runInNewContext(preview,context);
  const ctx=new Proxy({}, {get:(target,key)=>target[key]||(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  for(const id of ids){const state={r:()=>.42};context.window.ArcadePreview.draw(id,ctx,440,380,0,state);context.window.ArcadePreview.draw(id,ctx,440,380,5,state);assert(state.game,`${id} draws a real game state`);}
});

/* Ric, 2026-11-14: "I want those games but I want it in arcade. Next to the
   games that I have made." His own games lead the page — KONDRITE's hero
   first, then the three in beta — and the nine sit after them in the page's
   own design, not as a plainer catalogue on top. */
test('the nine sit after Ric’s own games, in the Arcade’s own design',()=>{
  const arcade=read('gaming.html');
  const at=s=>{const i=arcade.indexOf(s);assert(i>0,`${s} is on the Arcade`);return i;};
  const hero=at('<section class="hero">'), offramp=at('href="projects/offramp/index.html"'), shelf=at('<section class="rows classics"');
  assert(hero<offramp&&offramp<shelf,'KONDRITE, then the betas, then the nine');
  assert(/<h1 class="up">Kondrite<\/h1>/.test(arcade),'KONDRITE is still the page’s headline');
  const cards=arcade.slice(shelf).match(/<a class="cab up" href="projects\/(\w+)\/index.html">/g)||[];
  assert.equal(cards.length,9);
  for(const id of ids)assert(arcade.slice(shelf).includes(`href="projects/${id}/index.html"`),`${id} is on the shelf`);
  assert(!arcade.includes('class="game-grid"'),'the old grid on top of the page is gone');
});

/* Typing a game's name at the terminal opens it — one word or two. */
test('every game opens by name from the terminal',()=>{
  const term=read('terminal.html');
  for(const id of ids)assert(new RegExp(`\\["${id}", \\[`).test(term),`${id} is in PROJECTS`);
  assert(term.includes('projectLookup.get(normalizeTarget(normalizedRaw))'),'a two-word name like "tic tac toe" is tried whole');
  assert(/arcade: "gaming"/.test(term),'"arcade" opens the Arcade');
});
