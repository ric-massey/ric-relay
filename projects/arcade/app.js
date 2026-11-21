/* The Arcade's nine small games share this one page runtime. Each game page
   sets body[data-game]; engine.js holds the rules. See README.md and TODO.md.

   Saving (2026-11-21): a game in progress is kept in this browser under
   classics:save:<game> and comes back when the page is opened again. Finished
   games clear their save. The daily Wordle keeps its own classics:daily:<date>
   record, as before. */
(function () {
  'use strict';
  const E = window.ArcadeGames, $ = id => document.getElementById(id);
  const GAMES = [
    {id:'solitaire',name:'Solitaire',tag:'A little patience.',sub:'Klondike · draw one or three',rules:'Build the four suit piles from Ace to King. On the table, stack cards down in alternating colors; only a King fills an empty column. Drag a card or stack, or tap it and then its destination. Tap a card twice to send it where it fits. Tap the deck to draw; tap the empty deck to recycle. Once every card is face up, the game finishes itself. There is no clock unless you want one. Draw-one wins can go on the fastest board.'},
    {id:'tictactoe',name:'Tic-tac-toe',tag:'Three makes a crowd.',sub:'You, a friend, or a very stubborn computer',rules:'Take turns placing X and O. Three in a row, column or diagonal wins. X goes first. Pick how hard the computer plays: Easy, Medium, or Hard, which never loses. Choose Two players to share the screen. Your tally is kept beside the board.'},
    {id:'chess',name:'Chess',tag:'Think a move ahead.',sub:'The whole board. All the rules.',rules:'White moves first. Tap a piece to see its legal destinations, then tap a destination. Castling, en passant and your choice of promotion are included. Checkmate wins; stalemate, threefold repetition, the 50-move rule and insufficient material draw automatically. Play the computer as White or Black at three levels, or two people share this board. Hint suggests a move.'},
    {id:'wordle',name:'Wordle',tag:'Five letters. Six chances.',sub:'A daily word, or another just for you',rules:'Find the five-letter word in six guesses. Green means the right letter in the right spot, gold means it belongs elsewhere, and gray means that copy of the letter is not in the word. Guesses must be in the word list. Everyone gets the same daily word until midnight UTC; practice is unlimited. Hard mode makes you use every letter you have found. Wins rank by fewest guesses. This is an independent Wordle-style game, with its own words.'},
    {id:'sudoku',name:'Sudoku',tag:'Everything in its place.',sub:'One solution. Take your time.',rules:'Fill every row, column and 3×3 box with 1–9, once each. Tap a square, then a number, or use your keyboard and arrow keys (N toggles notes). Notes writes small pencil marks, and placing a number clears it from the notes around it. Every generated puzzle has one solution. There is no clock unless you want one. Reveal a square or Show mistakes if you need a hand; either keeps that puzzle off the fastest-times board.'},
    {id:'minesweeper',name:'Minesweeper',tag:'Tread lightly.',sub:'A small field of calculated risks',rules:'Open every safe square. A number counts mines in its eight neighboring squares. Right-click, press and hold, or use Flag mode to flag a mine. Tap an open number with the right number of flags around it to open its remaining neighbors. Your first click and its neighbors are safe. Hit a mine and you can take the click back or play the same board again, but those games stay off the board. Fastest wins are ranked separately for each field.'},
    {id:'tetris',name:'Tetris',tag:'Make a little room.',sub:'Seven shapes. One more line.',rules:'Fill a horizontal line to clear it. Left/Right moves, Up or X rotates clockwise, Z rotates the other way, Down drops softly, Space drops all the way, and C or Shift holds a piece for later. On a phone, drag to move, tap to rotate and flick down to drop. A landed piece can still slide for half a second. A seven-piece bag keeps the shapes fair. Line clears score 100/300/500/800 × level; soft and hard drops add points. The level rises every ten lines. P pauses.'},
    {id:'checkers',name:'Checkers',tag:'Jump at the chance.',sub:'American checkers · 8 × 8',rules:'The darker side moves first, from the bottom of the board. Men move and capture diagonally forward; kings, two checkers stacked, go both ways, one square at a time. Jumps are compulsory: when one is open the pieces that can take glow, and a jump must keep going while it can. Reaching the far side crowns a king and ends that turn. Win by taking or blocking every one of the other side’s pieces. Three repeats of a position, or 80 turns without a capture or crowning, is a draw. Drag a piece or tap it and then a square. The scoresheet uses the standard square numbers, 1 to 32. The computer plays the second side at three levels.'},
    {id:'snake',name:'Snake',tag:'An appetite for trouble.',sub:'Eat. Grow. Mind the walls.',rules:'Use the arrow keys, WASD, swipe anywhere on the board, or tap the direction buttons. Eat an apple for ten points and grow one segment. The walls and your own body end the game. You cannot reverse into yourself. The pace picks up as you eat. Slow is gentler and Through walls lets you wrap around the edges; only Classic goes on the board. P pauses, and changing tabs pauses automatically.'}
  ];
  const MODES = {
    solitaire:[['draw1','Draw one'],['draw3','Draw three'],['daily','Daily deal']],
    chess:[['cpu','Vs computer · you’re White'],['cpu-black','Vs computer · you’re Black'],['two','Two players']],
    checkers:[['cpu','Vs computer'],['two','Two players']],
    tictactoe:[['cpu','Vs computer'],['two','Two players']],
    wordle:[['daily','Daily word'],['practice','Practice']],
    sudoku:[['easy','Easy'],['medium','Medium'],['hard','Hard'],['daily','Daily puzzle']],
    minesweeper:[['easy','9 × 9 · 10 mines'],['medium','12 × 12 · 25 mines'],['hard','16 × 16 · 40 mines'],['expert','Expert · 99 mines']],
    snake:[['classic','Classic'],['slow','Slow'],['walls','Through walls']],
    tetris:[]
  };
  /* How far the computer looks ahead at each level (plies), or Tic-tac-toe's style. */
  const LEVELS = {chess:{easy:1,medium:2,hard:3},checkers:{easy:2,medium:5,hard:8},tictactoe:{easy:'easy',medium:'medium',hard:'hard'}};
  const stage=$('stage'), tools=$('tools');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- state -------------------------------------------------------------
  let game=null, mode='', s=null, selected=null, history=[], keys=[], revision=0, clockStart=0, elapsed=0, clock=null, frame=null, running=false, paused=false, pending=null, eligible=true, finished=false, flagMode=false, notesMode=false, notes={}, dailyDate='', input='', promotion=null, cpuBusy=false, boardRefresh=0, lastFrame=0, accumulator=0;
  let opts={}, lastMove=null, sanList=[], hintMove=null, moved=new Set(), flash=null, particles=[], lockAt=null, lockResets=0, ticker=null, autoTimer=null, revealRow=-1, revealUntil=0, shake=false, beforeReveal=null, face='🙂', lastFinish=null, bestScore=0;

  // ---- storage -----------------------------------------------------------
  const storage={get(k,fallback=null){try{const v=localStorage.getItem('classics:'+k);return v===null?fallback:JSON.parse(v);}catch{return fallback;}},set(k,v){try{localStorage.setItem('classics:'+k,JSON.stringify(v));return true;}catch{return false;}},remove(k){try{localStorage.removeItem('classics:'+k);}catch{}}};
  const remote = location.protocol === 'file:' ? null : /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin : 'https://training-log.rmbuster82.workers.dev';
  const fmtTime=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
  const status=t=>{$('status').textContent=t;};
  const hint=t=>{$('hint').textContent=t;};
  const button=(text,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.onclick=fn;return b;};
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const saveOpts=()=>storage.set('opt:'+game.id,opts);
  const vsCpu=()=>mode==='cpu'||mode==='cpu-black';
  const action=()=>['snake','tetris'].includes(game?.id);

  // ---- clock ---------------------------------------------------------------
  /* Minesweeper always shows its clock. Solitaire and Sudoku keep time quietly
     (Ric, 2026-11-21: "solitare and sudoku dont need one") so a win can still
     make the fastest board; Show timer puts the clock back on screen. */
  function clocked(){return ['solitaire','sudoku','minesweeper'].includes(game?.id);}
  function clockShown(){return game?.id==='minesweeper'||(clocked()&&opts.showTimer);}
  function beginClock(){if(clockStart||finished)return;clockStart=Date.now();clock=setInterval(updateMetric,250);}
  function seconds(){return Math.max(1,Math.floor((elapsed+(clockStart?Date.now()-clockStart:0))/1000));}
  function stopClock(){if(clockStart)elapsed+=Date.now()-clockStart;clockStart=0;clearInterval(clock);clock=null;}
  function updateMetric(){
    if(!game||!s)return;const id=game.id,parts=[];
    if(clockShown())parts.push(fmtTime(clockStart||elapsed?seconds():0));
    if(id==='solitaire')parts.push(s.moves+' moves');
    if(id==='snake')parts.push(s.score+' points',`best ${Math.max(s.score,bestScore)}`);
    // Tetris shows its numbers in the panel beside the well instead.
    if(id==='tetris'){const set=(k,v)=>{const e=$(k);if(e&&e.textContent!==v)e.textContent=v;};set('t-score',s.score.toLocaleString());set('t-lines',String(s.lines));set('t-level',String(1+Math.floor(s.lines/10)));set('t-best',Math.max(s.score,bestScore).toLocaleString());}
    $('metric').textContent=parts.join(' · ');
  }

  // ---- scoreboards (shared Worker, unchanged keys) -------------------------
  /* Only the original game of each kind has a board: Draw one, Classic Snake.
     New boards would need the Worker's allowlist changed and redeployed. */
  function board(){if(!game)return null;switch(game.id){case 'solitaire':return mode==='draw1'?'solitaire':mode==='daily'?'solitaire-daily-'+dailyDate:null;case 'sudoku':return mode==='daily'?'sudoku-daily-'+dailyDate:'sudoku-'+mode;case 'minesweeper':return 'mines-'+mode;case 'snake':return mode==='classic'?'snake':null;case 'tetris':return 'tetris';case 'wordle':return mode==='daily'?'wordle-'+dailyDate:'wordle-practice';default:return null;}}
  function scoreText(score,key=board()){return key?.startsWith('wordle-')?score+' / 6':key==='snake'||key==='tetris'?score.toLocaleString():fmtTime(score);}
  function sorted(rows,key){return rows.slice().sort((a,b)=>(key==='snake'||key==='tetris'?b.score-a.score:a.score-b.score)||(a.at||0)-(b.at||0)).slice(0,10);}
  async function request(path,options){if(!remote)throw Error('offline');const res=await fetch(remote+'/arcade/scores'+path,{...options,signal:AbortSignal.timeout(6000)});if(!res.ok)throw Error(res.status===429?'Please wait a minute before submitting again.':'Shared scoreboard is unavailable.');return res.json();}
  function showRows(rows,key){$('scores').replaceChildren();if(!rows.length){const li=document.createElement('li');li.className='empty';li.textContent='The board is open. Put your initials up here.';$('scores').append(li);return;}for(const row of sorted(rows,key)){const li=document.createElement('li'),name=document.createElement('strong'),score=document.createElement('span');name.textContent=row.initials;score.textContent=scoreText(row.score,key);li.append(name,score);$('scores').append(li);}}
  async function refreshScores(){const key=board(),version=++boardRefresh;$('score-panel').hidden=!key;if(!key)return;$('score-kind').textContent=key.startsWith('wordle-')?(mode==='daily'?'Today · '+dailyDate+' · fewest guesses':'Practice · fewest guesses'):key.includes('-daily-')?'Today · '+dailyDate+' · fastest wins':key==='snake'||key==='tetris'?'Top ten · highest score':'Top ten · fastest wins';$('score-source').textContent='Loading shared board…';try{const data=await request('?board='+encodeURIComponent(key));if(version!==boardRefresh)return;showRows(data.scores,key);$('score-source').textContent='Everyone · shared scoreboard';}catch{if(version!==boardRefresh)return;showRows(storage.get('scores:'+key,[]),key);$('score-source').textContent='This browser only · shared board unavailable';}}
  function saveDaily(){if(game?.id==='wordle'&&mode==='daily')storage.set('daily:'+dailyDate,{guesses:s.guesses,submitted:s.submitted||false,hard:!!s.hard});}

  // ---- your stats (this browser) ------------------------------------------
  function statsKey(){return 'stats:'+game.id+':'+(mode||'all');}
  function stats(){return storage.get(statsKey(),{})||{};}
  /* outcome: 'won' | 'lost' | 'drawn' against the computer or alone; a side name
     ('X', 'White', 'Light') or 'draw' with two players; null for Snake/Tetris.
     value: a time, guess count or score, for "best". */
  function record(outcome,value=null){
    const st=stats();st.played=(st.played||0)+1;
    if(mode==='two'){st.sides=st.sides||{};st.sides[outcome]=(st.sides[outcome]||0)+1;}
    else if(outcome){st[outcome]=(st[outcome]||0)+1;st.streak=outcome==='won'?(st.streak||0)+1:outcome==='drawn'?(st.streak||0):0;st.bestStreak=Math.max(st.bestStreak||0,st.streak);}
    if(value!==null){const higher=action();if(st.best==null||(higher?value>st.best:value<st.best))st.best=value;st.last=value;}
    if(game.id==='wordle'){st.dist=st.dist||[0,0,0,0,0,0];if(outcome==='won')st.dist[value-1]++;}
    storage.set(statsKey(),st);renderStats();
  }
  function renderStats(){
    let panel=$('stats-panel');
    if(!panel){panel=el('section','stats');panel.id='stats-panel';const rules=document.querySelector('.sidebar .rules');rules.parentNode.insertBefore(panel,rules);}
    const st=stats(),rows=[],id=game.id,p=st.played||0;bestScore=action()?st.best||0:0;
    if(mode==='two'&&id==='checkers'){const [a,b]=sides();rows.push([a+' wins',(st.sides?.w||0)+(st.sides?.Light||0)],[b+' wins',(st.sides?.b||0)+(st.sides?.Dark||0)]);rows.push(['Draws',st.sides?.draw||0]);}
    else if(mode==='two'){const names=id==='tictactoe'?['X','O']:['White','Black'];for(const n of names)rows.push([n+' wins',st.sides?.[n]||0]);rows.push(['Draws',st.sides?.draw||0]);}
    else if(action()){rows.push(['Games',p],['Best',(st.best||0).toLocaleString()],['Last',(st.last||0).toLocaleString()]);}
    else if(['chess','checkers','tictactoe'].includes(id)){rows.push(['You won',st.won||0],['Computer won',st.lost||0],['Draws',st.drawn||0],['Streak',st.streak||0]);}
    else{rows.push(['Played',p],['Won',p?`${st.won||0} · ${Math.round(100*(st.won||0)/p)}%`:'0'],['Streak',st.streak||0],['Best streak',st.bestStreak||0]);if(st.best!=null)rows.push([id==='wordle'?'Fewest guesses':'Fastest',id==='wordle'?st.best+' / 6':fmtTime(st.best)]);}
    panel.replaceChildren();
    const label=MODES[id].find(m=>m[0]===mode)?.[1];
    const dl=el('dl','stat-grid');for(const [k,v] of rows){const d=el('div');d.append(el('dt',null,k),el('dd',null,String(v)));dl.append(d);}
    panel.append(el('h2',null,'Your games'),el('p','muted',(label?label+' · ':'')+'kept on this browser'),dl);
    if(id==='wordle'&&st.dist){const max=Math.max(1,...st.dist),chart=el('div','dist');chart.setAttribute('aria-label','Wins by number of guesses');st.dist.forEach((n,i)=>{const row=el('div','dist-row'),bar=el('span','dist-bar',String(n));bar.style.width=Math.max(8,100*n/max)+'%';if(lastFinish?.guesses===i+1)bar.classList.add('now');row.append(el('b',null,String(i+1)),bar);chart.append(row);});panel.append(chart);}
  }

  // ---- saving a game in progress -----------------------------------------
  function persist(){
    if(!game||!s)return;
    if(game.id==='wordle'&&mode==='daily')return; // the daily word has its own record
    if(finished){storage.remove('save:'+game.id);return;}
    if(action()&&!s.started)return;
    storage.set('save:'+game.id,{v:1,mode,s,history:history.slice(-300),keys,elapsed:elapsed+(clockStart?Date.now()-clockStart:0),eligible,notes,lastMove,sanList,input,beforeReveal});
  }
  function restore(){
    const d=storage.get('save:'+game.id);
    if(!d||d.v!==1||!d.s||(d.mode||'')!==mode)return false;
    try{
      resetRun();
      s=d.s;history=d.history||[];keys=d.keys||[];elapsed=d.elapsed||0;eligible=d.eligible!==false;notes=d.notes||{};lastMove=d.lastMove||null;sanList=d.sanList||[];input=d.input||'';beforeReveal=d.beforeReveal||null;
      if(lastMove)lastMove.fresh=false;
      if(game.id==='wordle')dailyDate=new Date().toISOString().slice(0,10);
      if(game.id==='sudoku'&&!s.given)return false;
      if(isDaily()){dailyDate=new Date().toISOString().slice(0,10);if(s.day!==dailyDate){storage.remove('save:'+game.id);resetRun();return false;}}
      renderStats();
      if(action())renderAction(true);else render();
      if(clocked()&&elapsed)hint('Welcome back. Your game was saved; the clock picks up on your next move.');
      updateMetric();refreshScores();return true;
    }catch{storage.remove('save:'+game.id);return false;}
  }
  addEventListener('pagehide',()=>persist());

  // ---- result dialog -------------------------------------------------------
  function finish(title,description,score=null){
    if(finished)return;finished=true;running=false;$('pause').hidden=true;stopClock();cancelAnimationFrame(frame);clearInterval(autoTimer);autoTimer=null;updateMetric();status(title);persist();
    pending=score===null?null:{id:window.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),board:board(),score};
    $('result-title').textContent=title;$('result-description').textContent=description;$('initials-wrap').hidden=!pending;$('save-score').hidden=!pending;$('save-score').disabled=false;$('save-message').textContent='';$('initials').required=!!pending;$('initials').value=storage.get('initials','');$('result-eyebrow').textContent=pending?'Leave your mark.':'Good game.';
    dialogExtras();
    // Let the last move, the tile flip or the celebration be seen before the card covers it.
    const token=revision;setTimeout(()=>{if(token!==revision||$('result-dialog').open)return;$('result-dialog').showModal();if(pending)$('initials').focus();},reduced()?0:game.id==='wordle'?1400:500);
  }
  function dialogExtras(){
    const actions=document.querySelector('#result-dialog .dialog-actions');
    let again=$('play-again');if(!again){again=button('Play again',()=>{$('result-dialog').close();start();});again.id='play-again';actions.prepend(again);}
    let share=$('share-result');if(!share){share=button('Share',shareWordle);share.id='share-result';actions.prepend(share);}
    share.hidden=game.id!=='wordle';again.hidden=game.id==='wordle'&&mode==='daily';
  }
  $('score-form').onsubmit=async e=>{e.preventDefault();if(!pending)return;const initials=$('initials').value.trim().toUpperCase();if(!/^[A-Z]{1,3}$/.test(initials)){$('initials').reportValidity();return;}const row={...pending,initials},key=row.board,token=revision;boardRefresh++;$('save-score').disabled=true;storage.set('initials',initials);try{const data=await request('',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(row)});if(token!==revision)return;showRows(data.scores,key);$('score-source').textContent='Everyone · shared scoreboard';$('save-message').textContent='Your initials are on the board.';}catch(error){if(token!==revision)return;if(error.message.includes('wait a minute')){$('save-message').textContent=error.message;$('save-score').disabled=false;return;}const rows=storage.get('scores:'+key,[]).filter(r=>r.id!==row.id);rows.push({...row,at:Date.now()});const saved=storage.set('scores:'+key,sorted(rows,key));showRows(saved?sorted(rows,key):[],key);$('score-source').textContent='This browser only · shared board unavailable';$('save-message').textContent=saved?'Saved on this browser only. The shared board couldn’t be reached.':'Your browser couldn’t save this score. Please try again.';if(!saved){$('save-score').disabled=false;return;}}pending=null;$('save-score').hidden=true;$('initials-wrap').hidden=true;if(game.id==='wordle'){s.submitted=true;saveDaily();renderWord();}};
  $('close-result').onclick=()=>$('result-dialog').close();
  $('soundless').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
  $('refresh-scores').onclick=refreshScores;
  /* The top bar's "← The Arcade" is the one way back; a second "← All games" link under it came out 2026-11-14. */
  $('new-game').onclick=()=>start();
  $('mode').onchange=()=>{mode=$('mode').value;storage.set('mode:'+game.id,mode);start();};

  // ---- sound (off unless turned on) -----------------------------------------
  /* Small sounds made on the spot with Web Audio: no files to load. Off by
     default (2026-11-21 TODO: "Sound effects (off by default)"); the speaker
     button beside New game turns them on for every game, kept as classics:sound. */
  let audio=null,soundOn=!!storage.get('sound',false);
  const tone=(f,d,{type='sine',vol=.12,at=0,to=null}={})=>{const t0=audio.currentTime+at,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,t0);if(to)o.frequency.exponentialRampToValueAtTime(to,t0+d);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.008);g.gain.exponentialRampToValueAtTime(.0001,t0+d);o.connect(g).connect(audio.destination);o.start(t0);o.stop(t0+d+.02);};
  const SOUNDS={
    tap:()=>tone(660,.06,{type:'triangle',vol:.08}),
    card:()=>{tone(320,.05,{type:'triangle',vol:.09});tone(180,.07,{type:'sine',vol:.06,at:.01});},
    flip:()=>tone(520,.07,{type:'triangle',vol:.07,to:780}),
    capture:()=>{tone(300,.09,{type:'square',vol:.05});tone(200,.12,{type:'triangle',vol:.08,at:.03});},
    flag:()=>tone(880,.08,{type:'triangle',vol:.07,to:1200}),
    eat:()=>{tone(700,.06,{type:'square',vol:.04});tone(1050,.08,{type:'square',vol:.04,at:.05});},
    clear:()=>[523,659,784].forEach((f,i)=>tone(f,.12,{type:'triangle',vol:.08,at:i*.05})),
    error:()=>{tone(180,.09,{type:'square',vol:.05});tone(150,.12,{type:'square',vol:.05,at:.09});},
    boom:()=>tone(160,.5,{type:'sawtooth',vol:.09,to:40}),
    lose:()=>[392,330,262].forEach((f,i)=>tone(f,.22,{type:'triangle',vol:.08,at:i*.14})),
    win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.25,{type:'triangle',vol:.09,at:i*.09}))
  };
  function sfx(name){if(!soundOn)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();SOUNDS[name]?.();}catch{}}
  function soundButton(){const b=button('',()=>{soundOn=!soundOn;storage.set('sound',soundOn);paint();if(soundOn)sfx('flip');},'sound-toggle');b.id='sound-toggle';const paint=()=>{b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>'+(soundOn?'<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>':'<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>')+'</svg>';b.setAttribute('aria-label',soundOn?'Sound on':'Sound off');b.dataset.label=soundOn?'sound on':'sound off';b.setAttribute('aria-pressed',String(soundOn));b.title=soundOn?'Sound on':'Sound off';};paint();$('new-game').before(b);}

  // ---- celebration ---------------------------------------------------------
  function celebrate(){
    sfx('win');if(reduced())return;const c=document.createElement('canvas');c.className='confetti';c.width=innerWidth;c.height=innerHeight;document.body.append(c);const x=c.getContext('2d'),css=getComputedStyle(document.body);
    const colors=[css.getPropertyValue('--green'),'#f1c667','#e58276','#69cad2','#b293d5',css.getPropertyValue('--ink')].map(v=>v.trim()||'#f1c667');
    const bits=Array.from({length:120},()=>({x:innerWidth/2+(Math.random()-.5)*innerWidth*.3,y:innerHeight*.4,vx:(Math.random()-.5)*14,vy:-Math.random()*14-4,r:Math.random()*6,s:5+Math.random()*5,c:colors[Math.floor(Math.random()*colors.length)]}));
    const t0=performance.now();const step=t=>{const k=(t-t0)/1000;x.clearRect(0,0,c.width,c.height);for(const b of bits){b.vy+=.45;b.x+=b.vx;b.y+=b.vy;b.vx*=.99;b.r+=.15;x.save();x.globalAlpha=Math.max(0,1-k/1.8);x.translate(b.x,b.y);x.rotate(b.r);x.fillStyle=b.c;x.fillRect(-b.s/2,-b.s/4,b.s,b.s/2);x.restore();}if(k<1.8)requestAnimationFrame(step);else c.remove();};requestAnimationFrame(step);
  }

  // ---- game lifecycle ------------------------------------------------------
  function cleanup(){revision++;stopClock();cancelAnimationFrame(frame);clearInterval(ticker);clearInterval(autoTimer);autoTimer=null;running=false;paused=false;cpuBusy=false;pending=null;if($('result-dialog').open)$('result-dialog').close();}
  function modes(){const options=MODES[game.id];$('mode-wrap').hidden=!options.length;$('mode').replaceChildren();for(const [value,text]of options){const o=document.createElement('option');o.value=value;o.textContent=text;$('mode').append(o);}const saved=storage.get('mode:'+game.id);mode=options.some(o=>o[0]===saved)?saved:options[0]?.[0]||'';$('mode').value=mode;}
  /* A second select for the computer's strength, beside the mode. A change
     applies from the computer's next move; it never restarts a game. */
  function levelPicker(){
    if(!LEVELS[game.id])return;opts.level=opts.level||'medium';
    const label=el('label','level-picker');label.id='level-wrap';const sel=el('select');sel.id='level';
    for(const [v,t] of [['easy','Easy'],['medium','Medium'],['hard','Hard']]){const o=el('option',null,t);o.value=v;sel.append(o);}
    sel.value=opts.level;sel.onchange=()=>{opts.level=sel.value;saveOpts();};label.append(el('span','sr-only','Computer level'),sel);$('new-game').before(label);
  }
  function syncLevel(){const w=$('level-wrap');if(w)w.hidden=!vsCpu();}
  function route(){
    const id=document.body.dataset.game,next=GAMES.find(g=>g.id===id);cleanup();if(!next){location.replace('../../gaming.html');return;}
    game=next;opts=storage.get('opt:'+id,{})||{};$('playroom').hidden=false;$('game-title').textContent=game.name;$('game-subtitle').textContent=game.sub;$('rules').textContent=game.rules;document.title=game.name+' — RIC//NET';
    modes();levelPicker();soundButton();
    if(!restore())start();
    // No jump-scroll to the board: the header is compact enough that New game stays in view.
  }
  /* Main actions in one row; quieter toggles (timer, helpers) on a smaller second row. */
  function toolRow(main,minor=[]){tools.replaceChildren(...main);if(minor.length){tools.append(el('span','break'));for(const b of minor){b.classList.add('minor');tools.append(b);}}}
  function resetRun(){cleanup();stage.replaceChildren();tools.replaceChildren();stage.className='stage';selected=null;history=[];keys=[];elapsed=0;finished=false;eligible=true;flagMode=false;notesMode=false;notes={};input='';promotion=null;lastMove=null;sanList=[];hintMove=null;moved=new Set();flash=null;particles=[];lockAt=null;lockResets=0;revealRow=-1;revealUntil=0;shake=false;beforeReveal=null;face='🙂';lastFinish=null;hint('');$('pause').hidden=true;$('pause').textContent='Pause';status('');syncLevel();}
  function start(){
    resetRun();storage.remove('save:'+game.id);
    switch(game.id){
      case 'tictactoe':s=Array(9).fill('');break;
      case 'chess':s=E.Chess.create();keys=[E.Chess.key(s)];break;
      case 'checkers':s=E.Checkers.create();keys=[checkerKey()];break;
      case 'solitaire':s=mode==='daily'?E.Solitaire.create(dailyRandom()):E.Solitaire.create();s.draw=mode==='draw3'?3:1;break;
      case 'sudoku':s=mode==='daily'?E.Sudoku.create('medium',dailyRandom()):E.Sudoku.create(mode);s.given=s.b.slice();if(opts.mistakes)eligible=false;break;
      // Expert is 30 × 16; on a screen taller than it is wide it stands upright (16 across).
      case 'minesweeper':s=mode==='expert'?(innerWidth<innerHeight?E.Mines.create(30,99,16):E.Mines.create(16,99,30)):E.Mines.create(...({easy:[9,10],medium:[12,25],hard:[16,40]}[mode]));break;
      case 'wordle':initWord();break;
      case 'snake':s=E.Snake.create();s.wrap=mode==='walls';break;
      case 'tetris':s=E.Tetris.create();break;
    }
    if(isDaily()){s.day=dailyDate;const done=storage.get('dailydone:'+game.id+':'+dailyDate);if(done){eligible=false;}}
    renderStats();
    if(action())renderAction();else render();
    if(isDaily()&&!eligible)hint(`You already finished today’s ${game.id==='sudoku'?'puzzle':'deal'}. Replays stay off the board. A new one comes at midnight UTC.`);
    updateMetric();refreshScores();
  }
  /* Daily Sudoku and Solitaire (2026-11-21): one deal per UTC date, the same for
     everyone, from a random stream seeded by the game and the date. */
  function isDaily(){return mode==='daily'&&(game.id==='sudoku'||game.id==='solitaire');}
  function dailyRandom(){dailyDate=new Date().toISOString().slice(0,10);return E.seeded(game.id+':'+dailyDate);}
  function dailyDone(t){if(!isDaily())return;if(!storage.get('dailydone:'+game.id+':'+dailyDate))storage.set('dailydone:'+game.id+':'+dailyDate,{t});clearInterval(ticker);const tick=()=>hint('Next daily '+(game.id==='sudoku'?'puzzle':'deal')+' in '+untilNext()+'.');tick();ticker=setInterval(tick,1000);}
  function render(){({tictactoe:renderTic,chess:renderChess,checkers:renderCheckers,solitaire:renderSolitaire,sudoku:renderSudoku,minesweeper:renderMines,wordle:renderWord}[game.id]||drawAction)();}
  function grid(n,cls){const b=document.createElement('div');b.className='board '+cls;b.style.gridTemplateColumns=`repeat(${n},1fr)`;stage.replaceChildren(b);return b;}
  /* Computer moves wait a moment so "thinking…" paints first. */
  function cpu(fn){const token=revision;cpuBusy=true;setTimeout(()=>{if(token!==revision||finished)return;try{fn();}finally{cpuBusy=false;}},game.id==='tictactoe'?350:300);}

  // ---- Tic-tac-toe ---------------------------------------------------------
  function renderTic(){
    const turn=s.filter(Boolean).length%2?'O':'X',winner=E.Tic.winner(s),line=E.Tic.line(s);
    status(winner?winner==='draw'?'A draw.':(mode==='cpu'?(winner==='X'?'You win':'The computer wins'):'Player '+winner+' wins'):turn+' to play'+(mode==='cpu'&&turn==='O'?' · computer thinking…':''));
    const b=grid(3,'ttt');b.dataset.turn=!winner&&!(mode==='cpu'&&turn==='O')?turn:''; // hover shows a faint X or O
    s.forEach((v,i)=>{const sq=button(v,()=>{if(finished||cpuBusy||s[i]||(mode==='cpu'&&turn==='O'))return;history.push(s.slice());s[i]=turn;moved=new Set([i]);sfx('tap');renderTic();},'square '+(v==='O'?'o':'')+(moved.has(i)?' drop':'')+(line?.includes(i)?' win':''));sq.setAttribute('aria-label',`Row ${Math.floor(i/3)+1}, column ${i%3+1}: ${v||'empty'}`);sq.disabled=!!v||finished;b.append(sq);});
    if(line){const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('class','strike');svg.setAttribute('viewBox','0 0 3 3');svg.setAttribute('aria-hidden','true');const ln=document.createElementNS(NS,'line');const at=i=>[i%3+.5,Math.floor(i/3)+.5];const a=at(line[0]),z=at(line[2]),dx=(z[0]-a[0])*.2,dy=(z[1]-a[1])*.2;ln.setAttribute('x1',a[0]-dx);ln.setAttribute('y1',a[1]-dy);ln.setAttribute('x2',z[0]+dx);ln.setAttribute('y2',z[1]+dy);ln.setAttribute('pathLength','1');svg.append(ln);b.append(svg);}
    tools.replaceChildren(button('↶ Undo',()=>{if(cpuBusy||!history.length)return;finished=false;s=history.pop();moved=new Set();renderTic();}));
    const st=stats();hint(mode==='cpu'?`You ${st.won||0} · Computer ${st.lost||0} · Draws ${st.drawn||0}`:`X ${st.sides?.X||0} · O ${st.sides?.O||0} · Draws ${st.sides?.draw||0}`);moved=new Set();
    if(winner){
      if(mode==='cpu')record(winner==='draw'?'drawn':winner==='X'?'won':'lost');else record(winner==='draw'?'draw':winner);
      const t=stats();hint(mode==='cpu'?`You ${t.won||0} · Computer ${t.lost||0} · Draws ${t.drawn||0}`:`X ${t.sides?.X||0} · O ${t.sides?.O||0} · Draws ${t.sides?.draw||0}`);
      if((mode==='cpu'&&winner==='X')||(mode==='two'&&winner!=='draw'))celebrate();
      finish(winner==='draw'?'A good standoff.':mode==='cpu'?(winner==='X'?'You take it.':'The computer takes it.'):winner+' takes it.',winner==='draw'?'Nobody gave an inch. Another round?':'Three in a row. Time for the rematch.');return;
    }
    persist();
    if(mode==='cpu'&&turn==='O')cpu(()=>{const i=E.Tic.pick(s,LEVELS.tictactoe[opts.level||'medium']);s[i]='O';moved=new Set([i]);sfx('tap');renderTic();});
  }

  // ---- chess & checkers ----------------------------------------------------
  const pieceName={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
  const squareName=i=>'abcdefgh'[i%8]+(8-(i>>3));
  /* Drawn pieces (2026-11-21, Ric: "making the chess peices look better"): one
     original set on a 45-unit box, replacing the font's ♚♛ symbols, which
     looked different on every device. Fill and line colors come from the
     page's style through CSS; the inner details are drawn in currentColor. */
  const PIECES={
    base:'<path d="M10.5 39.5h24a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-24a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2z"/>',
    p:'<path d="M16 34.5c.8-5.6 3-9.6 4-12.6h5c1 3 3.2 7 4 12.6z"/><ellipse cx="22.5" cy="20.6" rx="6.2" ry="2"/><circle cx="22.5" cy="13" r="5.4"/>',
    r:'<path d="M14.5 34.5l1.4-16h13.2l1.4 16z"/><path d="M13 18.5v-8h4v2.6h3.5v-2.6h4v2.6h3.5v-2.6h4v8z"/><path fill="none" stroke="currentColor" d="M16.2 22h12.6M15.6 30.5h13.8"/>',
    b:'<path d="M18 34.5c1-2.8 2-4 2.6-4.8h3.8c.6.8 1.6 2 2.6 4.8z"/><ellipse cx="22.5" cy="29" rx="6.4" ry="1.9"/><path d="M22.5 10.4c-5.6 3.7-7.4 9-6.3 12.8.8 2.9 3.6 4.4 6.3 4.4s5.5-1.5 6.3-4.4c1.1-3.8-.7-9.1-6.3-12.8z"/><circle cx="22.5" cy="8" r="2.6"/><path fill="none" stroke="currentColor" d="M25.2 15.4l-4.6 5.4"/>',
    n:'<path d="M13.5 34.5c-.3-6.3 2.6-9.6 6-13.2-2.3.5-4.6 2-6.5 2.6-2 .6-3.8-.9-3.2-3.1.6-2.4 4.4-5.6 6.4-8.2 1-1.4 1.5-3.4 2-5.4l2 2.6 1.6-3.1 1.6 2.7c6.4.6 10.5 5.6 10.9 11.8.4 6.4-1.8 9.8-1.8 15.3z"/><circle fill="currentColor" stroke="none" cx="17.2" cy="14.2" r="1.2"/><path fill="none" stroke="currentColor" d="M11.6 20.4l1.3-.5M24 12.2c3 1.6 5.4 4.6 5.8 9"/>',
    q:'<path d="M14.6 30.5l-3.3-14.6 5.6 6.4-.2-10 4.3 9.3 1.5-10.2 1.5 10.2 4.3-9.3-.2 10 5.6-6.4-3.3 14.6z"/><path d="M13.6 34.5c1-1.4 1.2-2.6 1-4h15.8c-.2 1.4 0 2.6 1 4z"/><circle cx="11" cy="14.6" r="2.1"/><circle cx="16.6" cy="10.6" r="2.1"/><circle cx="22.5" cy="9" r="2.1"/><circle cx="28.4" cy="10.6" r="2.1"/><circle cx="34" cy="14.6" r="2.1"/>',
    k:'<path d="M21.1 4h2.8v3h3v2.8h-3v4.4h-2.8V9.8h-3V7h3z"/><path d="M14.6 30.5c-2.6-1.5-4.6-4-4.4-7.4.3-4.6 5.4-8.2 12.3-8.2s12 3.6 12.3 8.2c.2 3.4-1.8 5.9-4.4 7.4z"/><path d="M13.6 34.5c1-1.4 1.2-2.6 1-4h15.8c-.2 1.4 0 2.6 1 4z"/><path fill="none" stroke="currentColor" d="M22.5 15.4v14.6M14 23.4c5.6-2 11.4-2 17 0"/>'
  };
  function pieceSprites(){if($('piece-sprites'))return;const holder=document.createElement('div');holder.innerHTML=`<svg id="piece-sprites" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(PIECES).filter(([k])=>k!=='base').map(([k,v])=>`<symbol id="pc-${k}" viewBox="0 0 45 45">${PIECES.base}${v}</symbol>`).join('')}</defs></svg>`;document.body.prepend(holder.firstChild);}
  function pieceSvg(p){const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('class','pc '+(p===p.toUpperCase()?'w':'b'));svg.setAttribute('viewBox','0 0 45 45');svg.setAttribute('aria-hidden','true');const use=document.createElementNS(NS,'use');use.setAttribute('href','#pc-'+p.toLowerCase());svg.append(use);return svg;}
  const flipped=()=>game.id==='chess'&&mode==='cpu-black';
  const human=()=>game.id==='chess'&&mode==='cpu-black'?'b':'w';
  const cpuTurn=()=>vsCpu()&&s.turn!==human();
  function squareGrid(moves,onClick,checker=false){
    const b=grid(8,'chess'),flip=flipped(),checkAt=!checker&&E.Chess.check(s)?s.b.indexOf(s.turn==='w'?'K':'k'):-1;
    for(let d=0;d<64;d++){
      const i=flip?63-d:d,p=s.b[i],legal=moves.some(m=>m.from===selected&&m.to===i);
      const cls=['square',((i>>3)+i%8)%2?'dark':'light'];if(selected===i)cls.push('chosen');if(legal)cls.push('legal');if(p)cls.push('occupied');if(lastMove&&(lastMove.from===i||lastMove.to===i||lastMove.path?.includes(i)))cls.push('last');if(i===checkAt)cls.push('in-check');if(hintMove&&(hintMove.from===i||hintMove.to===i))cls.push('hinted');
      const sq=button('',()=>onClick(i),cls.join(' '));
      sq.setAttribute('aria-label',squareName(i)+(p?': '+(checker?(p.toLowerCase()==='w'?'Light':'Dark')+' '+(p===p.toUpperCase()?'king':'man'):(p===p.toUpperCase()?'White ':'Black ')+pieceName[p.toLowerCase()]):': empty')+(legal?', legal destination':''));
      if(p){
        const wrap=el('span','piece');
        if(checker){const k=el('span','checker'+(p.toLowerCase()==='b'?' black':'')+(p===p.toUpperCase()?' king':''));if(p===p.toUpperCase())k.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9-4.4 3.8L12 5.5 9 12.8 4.6 9z"/></svg>';wrap.append(k);}else wrap.append(pieceSvg(p));
        // The piece that just moved slides in from where it was.
        if(lastMove?.fresh&&lastMove.to===i&&!reduced()){const at=x=>{const dd=flip?63-x:x;return[dd%8,dd>>3];};const [fc,fr]=at(lastMove.from),[tc,tr]=at(i);wrap.style.setProperty('--dx',fc-tc);wrap.style.setProperty('--dy',fr-tr);wrap.classList.add('slide');sq.classList.add('moving');}
        sq.append(wrap);
      }
      if(d>=56)sq.append(el('small','coord','abcdefgh'[i%8]));
      if(d%8===0)sq.append(el('small','coord rank',String(8-(i>>3))));
      b.append(sq);
    }
    if(lastMove)lastMove.fresh=false;
  }
  function capturedLine(){
    const start={p:8,n:2,b:2,r:2,q:1},have={w:{},b:{}};for(const p of s.b)if(p){const t=p===p.toUpperCase()?'w':'b';have[t][p.toLowerCase()]=(have[t][p.toLowerCase()]||0)+1;}
    const val={p:1,n:3,b:3,r:5,q:9},wrap=el('div','captures'),score={w:0,b:0},rows={};
    for(const [taker,lost] of [['w','b'],['b','w']]){const row=el('div','cap-row');row.append(el('span','cap-label',taker==='w'?'White took':'Black took'));for(const k of ['q','r','b','n','p']){const n=Math.max(0,start[k]-(have[lost][k]||0));for(let j=0;j<n;j++){row.append(pieceSvg(lost==='w'?k.toUpperCase():k));score[taker]+=val[k];}}rows[taker]=row;wrap.append(row);}
    const diff=score.w-score.b;if(diff)rows[diff>0?'w':'b'].append(el('span','cap-adv','+'+Math.abs(diff)));
    return wrap;
  }
  function moveList(){const ol=el('ol','movelist');ol.setAttribute('aria-label','Moves');if(!sanList.length)ol.append(el('li','empty','Moves appear here.'));for(let i=0;i<sanList.length;i+=2){const li=el('li');li.append(el('span',null,sanList[i]));if(sanList[i+1])li.append(el('span',null,sanList[i+1]));ol.append(li);}requestAnimationFrame(()=>{ol.scrollLeft=ol.scrollWidth;});return ol;}
  function renderChess(){
    const moves=E.Chess.moves(s),result=E.Chess.result(s,keys),thinking=cpuTurn()&&!result;
    status(result||(s.turn==='w'?'White':'Black')+' to move'+(E.Chess.check(s)?' · check':'')+(thinking?' · computer thinking…':''));
    squareGrid(moves,i=>{
      if(finished||cpuBusy||promotion||cpuTurn())return;
      const options=moves.filter(m=>m.from===selected&&m.to===i);
      if(options.length){if(options.length>1){promotion=options;tools.replaceChildren(el('p',null,'Promote to:'));for(const m of options){const pb=button('',()=>{promotion=null;playChess(m);},'promo');pb.append(pieceSvg(s.turn==='w'?m.promote.toUpperCase():m.promote));pb.setAttribute('aria-label',pieceName[m.promote]);tools.append(pb);}hint('Choose your promotion piece.');return;}playChess(options[0]);return;}
      selected=moves.some(m=>m.from===i)?i:null;hintMove=null;renderChess();
    });
    const info=el('div','chess-info');info.append(capturedLine(),moveList());stage.append(info);
    tools.replaceChildren(button('↶ Undo',undoBoard),button('Hint',()=>{if(finished||cpuBusy||cpuTurn())return;hintMove=E.Chess.best(s,2);selected=hintMove?.from??null;renderChess();hint('Try this move.');}));
    if(!hintMove)hint(vsCpu()?`Tap a piece, then a marked square. You play ${human()==='w'?'White':'Black'}.`:'Tap a piece, then a marked square. Pass the screen after your move.');
    if(result){
      const winner=result.startsWith('White')?'White':result.startsWith('Black')?'Black':null;
      if(vsCpu())record(!winner?'drawn':(winner==='White')===(human()==='w')?'won':'lost');else record(winner||'draw');
      if(winner&&(!vsCpu()||(winner==='White')===(human()==='w')))celebrate();
      finish(result,'The board is settled. Play another whenever you like.');return;
    }
    persist();
    if(thinking&&!cpuBusy){if(opts.level==='hard'){const token=revision;cpuBusy=true;hardMove(E.copy(s),m=>{if(token!==revision||finished)return;cpuBusy=false;if(m)playChess(m,true);});}else cpu(()=>{const m=E.Chess.best(s,LEVELS.chess[opts.level||'medium']);if(m)playChess(m,true);});}
  }
  /* Hard thinks in chess-worker.js for up to ~2 s, deeper as time allows. Where a
     worker can't start (file:// pages) it falls back to a shorter search here. */
  let chessWorker=null,workerJob=0;
  function hardMove(state,done){
    if(chessWorker===null){try{chessWorker=new Worker('../arcade/chess-worker.js');chessWorker.onerror=()=>{chessWorker=false;};}catch{chessWorker=false;}}
    const local=()=>setTimeout(()=>done(E.Chess.think(state,700,3)),30);
    if(!chessWorker){local();return;}
    const id=++workerJob;let settled=false;const give=m=>{if(settled)return;settled=true;clearTimeout(guard);done(m);};
    const guard=setTimeout(()=>{chessWorker=false;give(E.Chess.best(state,2));},8000);
    chessWorker.onmessage=e=>{if(e.data.id===id)give(e.data.move);};
    chessWorker.onerror=()=>{chessWorker=false;give(E.Chess.best(state,2));};
    chessWorker.postMessage({id,state,ms:1800});
  }
  function playChess(m,ai=false){sfx(s.b[m.to]||m.enpassant?'capture':'tap');history.push({state:E.copy(s),keyCount:keys.length,san:sanList.length,last:lastMove});sanList.push(E.Chess.san(s,m));s=E.Chess.apply(s,m);keys.push(E.Chess.key(s));selected=null;hintMove=null;lastMove={from:m.from,to:m.to,fresh:true};if(ai)cpuBusy=false;renderChess();}
  function undoBoard(){
    if(cpuBusy||!history.length)return;finished=false;
    const mine=human();
    // Against the computer, step back to the start of your own last turn (all of a multi-jump).
    do{const last=history.pop();s=last.state;keys.length=last.keyCount;if(last.san!==undefined){sanList.length=last.san;if(last.sanText!==undefined&&last.san>0)sanList[last.san-1]=last.sanText;}lastMove=last.last||null;}while(history.length&&((vsCpu()&&s.turn!==mine)||(game.id==='checkers'&&s.chain>=0)));
    if(lastMove)lastMove.fresh=false;selected=null;promotion=null;hintMove=null;
    if(game.id==='chess')renderChess();else renderCheckers();
  }
  function checkerKey(){return s.b.join(',')+s.turn;}
  // ---- Checkers (round three, 2026-11-21: TODO.md "Checkers: what players want") ----
  /* The engine's 'w' side starts at the bottom and moves first. In American
     checkers the dark side moves first, so each style names and colors 'w' as
     its dark side: <option data-sides="Red,White"> = first mover, second. */
  const look=()=>document.body.dataset.look||'';
  const sides=()=>(document.querySelector('#style-switch option:checked')?.dataset.sides||'Red,White').split(',');
  const sideName=t=>sides()[t==='w'?0:1];
  /* Standard numbering: 1–32 over the playable squares, 1–4 on the first mover's
     back rank (seen from its side, right to left), so openings read 11-15, 22-18. */
  const checkerNum=i=>{const r=i>>3,c=i%8;return (r+c)%2===0?0:(7-r)*4+Math.floor((7-c)/2)+1;};
  let boardClick=null,noSlide=false,checkerNote=null;
  function checkerPiece(p){
    const king=p===p.toUpperCase(),k=el('span','checker side-'+(p.toLowerCase()==='w'?'a':'b')+(king?' king':''));
    const disc=()=>{const d=el('span','disc');d.append(el('span','face'));return d;};
    // A king is two checkers, one on top of the other, as on a real board.
    k.append(disc());if(king){const top=disc();top.classList.add('top');const crown=el('span','crown');crown.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9-4.4 3.8L12 5.5 9 12.8 4.6 9z"/></svg>';top.append(crown);k.append(top);}
    return k;
  }
  const checkerLabel=(i,legal,must)=>{const p=s.b[i],n=checkerNum(i);return (n?'Square '+n:'Light square')+(p?': '+sideName(p.toLowerCase())+' '+(p===p.toUpperCase()?'king':'man'):n?': empty':'')+(legal?', you can move here':'')+(must?', must jump':'');};
  function checkerBoard(moves,onClick,must){
    boardClick=onClick;
    if(look()==='terminal'){asciiCheckers(moves,onClick,must);return;}
    const b=grid(8,'chess checkerboard');
    for(let i=0;i<64;i++){
      const p=s.b[i],n=checkerNum(i),legal=moves.some(m=>m.from===selected&&m.to===i),cls=['square',n?'dark':'light'];
      if(selected===i)cls.push('chosen');if(legal)cls.push('legal');if(p)cls.push('occupied');if(must.has(i))cls.push('must');
      if(lastMove&&(lastMove.from===i||lastMove.to===i||lastMove.path?.includes(i)))cls.push('last');if(hintMove&&(hintMove.from===i||hintMove.to===i))cls.push('hinted');
      const sq=button('',()=>{if(!dragJustEnded)onClick(i);},cls.join(' '));sq.dataset.i=i;sq.setAttribute('aria-label',checkerLabel(i,legal,must.has(i)));if(!n){sq.tabIndex=-1;sq.setAttribute('aria-hidden','true');}
      if(n)sq.append(el('small','num',String(n)));
      if(p){const wrap=el('span','piece');wrap.append(checkerPiece(p));
        if(lastMove?.fresh&&lastMove.to===i&&!reduced()&&!noSlide){wrap.style.setProperty('--dx',lastMove.from%8-i%8);wrap.style.setProperty('--dy',(lastMove.from>>3)-(i>>3));wrap.classList.add('slide');sq.classList.add('moving');}
        sq.append(wrap);}
      b.append(sq);
    }
    if(lastMove)lastMove.fresh=false;noSlide=false;
  }
  /* Terminal style: the board is text. Each cell is a 3-character button inside
     a <pre>, between +---+ rules, so it reads (and copies) as an ASCII board. */
  function asciiCheckers(moves,onClick,must){
    const pre=el('pre','ascii-board');pre.setAttribute('role','group');pre.setAttribute('aria-label','Checkers board');
    const rule='+'+'---+'.repeat(8)+'\n';
    for(let r=0;r<8;r++){
      pre.append(rule,'|');
      for(let c=0;c<8;c++){
        const i=r*8+c,p=s.b[i],n=checkerNum(i),legal=moves.some(m=>m.from===selected&&m.to===i);
        let text=!n?'///':p?(' '+(p.toLowerCase()==='w'?'o':'x')+' '):legal?' * ':String(n).padStart(2,' ')+' ';
        if(p&&p===p.toUpperCase())text=' '+(p.toLowerCase()==='w'?'O':'X')+' ';
        if(p&&selected===i)text='['+text[1]+']';else if(p&&must.has(i))text='<'+text[1]+'>';
        const cls=['cell',n?'dark':'light'];if(p)cls.push(p.toLowerCase()==='w'?'side-a':'side-b');if(!p&&n&&!legal)cls.push('dim');if(legal)cls.push('legal');if(selected===i)cls.push('chosen');if(must.has(i))cls.push('must');if(lastMove&&(lastMove.from===i||lastMove.to===i||lastMove.path?.includes(i)))cls.push('last');if(hintMove&&(hintMove.from===i||hintMove.to===i))cls.push('hinted');
        if(!n){pre.append(el('span',cls.join(' '),text));}
        else{const cell=button(text,()=>onClick(i),cls.join(' '));cell.dataset.i=i;cell.setAttribute('aria-label',checkerLabel(i,legal,must.has(i)));pre.append(cell);}
        pre.append('|');
      }
      pre.append('\n');
    }
    pre.append(rule);
    stage.replaceChildren(pre);
    if(lastMove)lastMove.fresh=false;
  }
  /* Captured pieces sit in a tray on the side of whoever took them. */
  function checkerTrays(){
    const left={w:0,b:0};for(const p of s.b)if(p)left[p.toLowerCase()]++;
    const tray=(taker,lost)=>{const taken=12-left[lost],t=el('div','tray tray-'+(taker==='w'?'near':'far'));t.setAttribute('aria-label',`${sideName(taker)} has taken ${taken}`);
      if(look()==='terminal'){t.textContent=`${sideName(taker).toLowerCase()} took ${String(taken).padStart(2,' ')}  ${(lost==='w'?'o':'x').repeat(taken)}`;return t;}
      const pile=el('span','tray-pile');for(let k=0;k<taken;k++)pile.append(checkerPiece(lost));t.append(el('span','tray-label',sideName(taker)),pile,el('span','tray-count',String(taken)));return t;};
    return [tray('b','w'),tray('w','b')];
  }
  function renderCheckers(){
    const moves=E.Checkers.moves(s),winner=!moves.length?(s.turn==='w'?'b':'w'):null;
    const result=winner?sideName(winner)+' wins':s.quiet>=80?'Draw · no progress':keys.filter(k=>k===checkerKey()).length>=3?'Draw by repetition':null;
    const thinking=vsCpu()&&s.turn==='b'&&!result,capture=moves.some(m=>m.capture!==undefined);
    const must=new Set(!result&&!thinking&&capture?moves.map(m=>m.from):[]);
    status(result||sideName(s.turn)+' to move'+(s.chain>=0?' · keep jumping':capture?' · a jump is required':'')+(thinking?' · computer thinking…':''));
    if(s.chain>=0)selected=s.chain;
    const onClick=i=>{
      if(finished||cpuBusy||thinking)return;
      const m=moves.find(m=>m.from===selected&&m.to===i);if(m){playChecker(m);return;}
      if(moves.some(m=>m.from===i)){selected=i;hintMove=null;renderCheckers();return;}
      const own=s.b[i]&&s.b[i].toLowerCase()===s.turn;
      // Say why a tap did nothing, instead of silently ignoring it.
      if(s.chain>=0)checkerNote='Keep jumping: the same piece must take again.';
      else if(own&&capture)checkerNote='A jump is required. One of the glowing pieces has to take.';
      else if(own)checkerNote='That piece has nowhere to go.';
      else if(selected!==null&&!s.b[i]&&checkerNum(i))checkerNote='It can’t go there. The marked squares are its moves.';
      if(checkerNote)sfx('error');if(s.chain<0)selected=null;renderCheckers();
    };
    checkerBoard(moves,onClick,must);
    const [far,near]=checkerTrays();stage.prepend(far);stage.append(near);
    const sheet=moveList();sheet.classList.add('scoresheet');stage.append(sheet);
    tools.replaceChildren(button('↶ Undo',undoBoard),button('Hint',()=>{if(finished||cpuBusy||thinking||result)return;hintMove=E.Checkers.best(s,5);selected=hintMove?.from??null;renderCheckers();hint('Try this move.');}));
    hint(checkerNote||(s.chain>=0?'Keep jumping with the same piece.':must.size?'A jump is required. The glowing pieces can take.':'Tap or drag a piece to move it. Reach the far side to crown a king.'));checkerNote=null;
    if(result){
      if(!finished){if(vsCpu())record(!winner?'drawn':winner==='w'?'won':'lost');else record(winner||'draw');if(winner&&(winner==='w'||mode==='two'))celebrate();finish(result,winner?(vsCpu()?(winner==='w'?'Every one of their pieces, taken or trapped.':'The computer took this one. Rematch?'):sideName(winner)+' takes the game.'):'Nobody could break through.');}
      return;
    }
    persist();
    if(thinking&&!cpuBusy)cpu(()=>{const m=E.Checkers.best(s,LEVELS.checkers[opts.level||'medium']);if(m){cpuBusy=false;playChecker(m);}});
  }
  /* lastMove.path keeps the squares a multi-jump passed through, so the whole
     route stays highlighted; each hop slides from the square it just left. The
     scoresheet writes a multi-jump as one move: 9x18x27. */
  function playChecker(m){
    const chained=s.chain>=0&&lastMove&&lastMove.to===m.from;
    sfx(m.capture!==undefined?'capture':'tap');history.push({state:E.copy(s),keyCount:keys.length,last:lastMove,san:sanList.length,sanText:sanList.at(-1)});
    if(chained&&sanList.length)sanList[sanList.length-1]+='x'+checkerNum(m.to);else sanList.push(checkerNum(m.from)+(m.capture!==undefined?'x':'-')+checkerNum(m.to));
    s=E.Checkers.apply(s,m);if(s.chain<0)keys.push(checkerKey());
    lastMove={from:m.from,to:m.to,path:chained?[...(lastMove.path||[]),lastMove.from]:[],fresh:true};
    selected=s.chain>=0?s.chain:null;hintMove=null;renderCheckers();
  }
  /* Drag a checker: pick it up past a few pixels, drop it on a square. Uses the
     same click handler as tapping, so the rules are checked in one place. */
  let bdrag=null;
  stage.addEventListener('pointerdown',e=>{if(game?.id!=='checkers'||e.button>0||finished)return;const sq=e.target.closest('.board .square[data-i]');if(!sq||!sq.querySelector('.piece'))return;bdrag={from:+sq.dataset.i,x:e.clientX,y:e.clientY,id:e.pointerId,active:false};});
  addEventListener('pointermove',e=>{
    if(!bdrag||e.pointerId!==bdrag.id)return;const dx=e.clientX-bdrag.x,dy=e.clientY-bdrag.y;
    if(!bdrag.active){
      if(Math.hypot(dx,dy)<8)return;
      if(selected!==bdrag.from)boardClick?.(bdrag.from);
      const piece=selected===bdrag.from&&stage.querySelector(`.square[data-i="${bdrag.from}"] .piece`);if(!piece){bdrag=null;return;}
      const r=piece.getBoundingClientRect(),ghost=piece.cloneNode(true);ghost.classList.remove('slide');ghost.classList.add('drag-piece');Object.assign(ghost.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});document.body.append(ghost);piece.style.visibility='hidden';bdrag.ghost=ghost;bdrag.active=true;
    }
    bdrag.ghost.style.transform=`translate(${dx}px,${dy}px) scale(1.1)`;e.preventDefault();
  },{passive:false});
  addEventListener('pointerup',e=>{
    if(!bdrag||e.pointerId!==bdrag.id)return;const d=bdrag;bdrag=null;if(!d.active)return;d.ghost.remove();dragJustEnded=true;setTimeout(()=>{dragJustEnded=false;},0);
    const sq=document.elementFromPoint(e.clientX,e.clientY)?.closest('.board .square[data-i]'),to=sq?+sq.dataset.i:-1;
    if(to>=0&&to!==d.from){noSlide=true;boardClick?.(to);}else render();
  });
  addEventListener('pointercancel',()=>{if(bdrag?.ghost){bdrag.ghost.remove();render();}bdrag=null;});

  // ---- Solitaire -----------------------------------------------------------
  const suits=['♠','♥','♦','♣'];
  const cardId=c=>c.suit+'-'+c.rank;
  function cardElement(c,fn,idx){const e=button('',fn,'card'+(!c.up?' down':'')+(E.Solitaire.red(c)?' red':'')+(moved.has(cardId(c))&&c.up&&!reduced()?' land':''));e.style.setProperty('--i',idx||0);const rank={1:'A',11:'J',12:'Q',13:'K'}[c.rank]||c.rank;const corner=cls=>{const k=el('span','idx '+cls,String(rank));k.append(el('span','suit',suits[c.suit]));return k;};const mid=el('span','middle',c.rank>10?String(rank):suits[c.suit]);if(c.rank>10)mid.classList.add('face');e.append(corner('tl'),mid,corner('br'));e.setAttribute('aria-label',c.up?rank+' of '+['spades','hearts','diamonds','clubs'][c.suit]:'Face-down card');return e;}
  function solitaireMove(from,to){
    const pile=E.Solitaire.pile(s,from),stack=pile.slice(from.index??pile.length-1),old=E.copy(s);
    if(!E.Solitaire.move(s,from,to))return false;
    history.push(old);selected=null;hintMove=null;moved=new Set(stack.map(cardId));sfx('card');beginClock();renderSolitaire();afterSolitaire();return true;
  }
  /* Once the stock and waste are empty and every card is face up, the cards
     walk home on their own, one at a time. */
  function afterSolitaire(){
    if(E.Solitaire.won(s)){solitaireWon();return;}
    if(E.Solitaire.autoReady(s)&&!autoTimer){hint('Every card is showing. Carrying them home…');autoTimer=setInterval(()=>{const step=E.Solitaire.autoStep(s);if(!step){clearInterval(autoTimer);autoTimer=null;renderSolitaire();return;}moved=new Set([cardId(step.card)]);renderSolitaire();if(E.Solitaire.won(s)){clearInterval(autoTimer);autoTimer=null;solitaireWon();}},reduced()?10:110);}
  }
  function solitaireWon(){const t=seconds(),post=(mode==='draw1'||mode==='daily')&&eligible;record('won',mode!=='draw3'?t:null);celebrate();dailyDone(t);finish('A clean table.',`All four suits, home. ${s.moves} moves in ${fmtTime(t)}.`,post?t:null);}
  /* Tapping the selected card again sends it where it fits: home first, then
     the first column that takes it. A double-click does the same. */
  function sendAnywhere(p){const pile=E.Solitaire.pile(s,p),at=p.index??pile.length-1,c=pile[at];if(!c)return false;if(at===pile.length-1&&p.type!=='foundation'&&solitaireMove(p,{type:'foundation',col:c.suit}))return true;for(let col=0;col<7;col++)if(!(p.type==='tableau'&&p.col===col)&&E.Solitaire.copyTry(s,p,{type:'tableau',col}))return solitaireMove(p,{type:'tableau',col});return false;}
  function solitaireTap(p){
    if(finished||autoTimer||dragJustEnded)return;
    if(selected){
      const same=selected.type===p.type&&selected.col===p.col&&(p.type!=='tableau'||selected.index===p.index);
      if(same){if(!sendAnywhere(selected)){selected=null;renderSolitaire();hint('That card has nowhere to go yet.');}return;}
      if(solitaireMove(selected,p.type==='tableau'?{type:'tableau',col:p.col}:p))return;
    }
    const pile=E.Solitaire.pile(s,p),index=p.index??pile.length-1;selected=pile[index]?.up?{...p,index}:null;if(p.type!=='tableau'&&selected)delete selected.index;renderSolitaire();
  }
  function solitaireDraw(){if(finished||autoTimer)return;const old=E.copy(s);if(E.Solitaire.draw(s)){sfx('flip');history.push(old);selected=null;hintMove=null;moved=new Set(s.waste.slice(-(s.draw||1)).map(cardId));beginClock();renderSolitaire();}}
  function renderSolitaire(){
    stage.className='stage solitaire-stage';stage.replaceChildren();
    const top=el('div','solitaire-top');
    const stock=button(s.stock.length?'':'↻',solitaireDraw,(s.stock.length?'card down':'card-space')+(hintMove==='draw'?' hinted':''));stock.setAttribute('aria-label',s.stock.length?'Draw from stock, '+s.stock.length+' cards':'Recycle waste');top.append(stock);
    const wasteBox=el('div','waste'+(s.draw===3?' fan':'')),show=s.waste.slice(-(s.draw===3?3:1));
    if(!show.length)wasteBox.append(button('',()=>{},'card-space'));
    show.forEach((c,k)=>{const isTop=k===show.length-1,e=cardElement(c,isTop?()=>solitaireTap({type:'waste'}):()=>{},0);e.style.setProperty('--f',k);if(isTop){e.dataset.from='waste';if(selected?.type==='waste')e.classList.add('selected');if(hintMove?.from?.type==='waste')e.classList.add('hinted');}else{e.tabIndex=-1;e.setAttribute('aria-hidden','true');}wasteBox.append(e);});
    top.append(wasteBox,el('span'));
    s.foundation.forEach((pile,col)=>{const p={type:'foundation',col},e=pile.length?cardElement(pile.at(-1),()=>solitaireTap(p)):button(suits[col],()=>solitaireTap(p),'card-space');e.dataset.drop='foundation:'+col;e.setAttribute('aria-label','Foundation '+['spades','hearts','diamonds','clubs'][col]+(pile.length?', '+pile.length+' cards':', empty'));if(selected?.type==='foundation'&&selected.col===col)e.classList.add('selected');if(hintMove?.to?.type==='foundation'&&hintMove.to.col===col)e.classList.add('hinted');top.append(e);});
    stage.append(top);
    const table=el('div','tableau');
    s.tableau.forEach((pile,col)=>{
      const wrap=el('div','pile');wrap.dataset.drop='tableau:'+col;
      const empty=button('',()=>solitaireTap({type:'tableau',col}),'card-space'+(hintMove?.to?.type==='tableau'&&hintMove.to.col===col&&!pile.length?' hinted':''));empty.setAttribute('aria-label','Empty column '+(col+1)+', Kings only');wrap.append(empty);
      // Face-down cards stack tight, face-up ones far enough apart to read.
      let downs=0,ups=0;
      pile.forEach((c,index)=>{const e=cardElement(c,()=>solitaireTap({type:'tableau',col,index}),index);e.style.setProperty('--d',downs);e.style.setProperty('--u',ups);if(c.up)ups++;else downs++;if(c.up)e.dataset.from=`tableau:${col}:${index}`;if(selected?.type==='tableau'&&selected.col===col&&index>=selected.index)e.classList.add('selected');if(hintMove?.from?.type==='tableau'&&hintMove.from.col===col&&index>=hintMove.from.index)e.classList.add('hinted');if(hintMove?.to?.type==='tableau'&&hintMove.to.col===col&&index===pile.length-1)e.classList.add('hinted');wrap.append(e);});
      table.append(wrap);
    });
    stage.append(table);
    // The table is as tall as its longest column (cards are absolutely placed).
    let deepest=0;for(const c of table.querySelectorAll('.card'))deepest=Math.max(deepest,c.offsetTop+c.offsetHeight);const cardH=table.querySelector('.card-space')?.offsetHeight||100;table.style.height=Math.max(deepest,cardH*2.3)+'px';
    toolRow([
      button('↶ Undo',()=>{if(!history.length||finished||autoTimer)return;s=history.pop();selected=null;hintMove=null;moved=new Set();renderSolitaire();}),
      button('Hint',()=>{if(finished||autoTimer)return;const o=E.Solitaire.options(s)[0];hintMove=o||(E.Solitaire.stuck(s)?null:'draw');selected=null;renderSolitaire();hint(o?'Try the glowing cards.':hintMove==='draw'?'Nothing on the table. Draw from the deck.':'No moves left. Undo a few, or deal again.');})
    ],[button(opts.showTimer?'Hide timer':'Show timer',()=>{opts.showTimer=!opts.showTimer;saveOpts();renderSolitaire();})]);
    const stuck=!finished&&E.Solitaire.stuck(s);
    status(stuck?'No moves left · Undo or deal again':s.waste.length+' in waste · '+s.foundation.reduce((n,p)=>n+p.length,0)+'/52 home');
    if(!hintMove&&!autoTimer)hint('Drag a card or stack, or tap it then where it goes. Tap a card twice to send it where it fits.');
    hintMove=null;moved=new Set();updateMetric();persist();
  }
  /* Drag and drop: pointer events on face-up cards. A drag shows a floating
     copy of the stack; dropping finds the pile under the pointer. A plain tap
     still goes through the click handlers above. */
  let drag=null,dragJustEnded=false;
  stage.addEventListener('pointerdown',e=>{
    if(game?.id!=='solitaire'||finished||autoTimer||e.button>0)return;const card=e.target.closest('[data-from]');if(!card)return;
    const parts=card.dataset.from.split(':'),from=parts[0]==='waste'?{type:'waste'}:{type:'tableau',col:+parts[1],index:+parts[2]};
    drag={from,x:e.clientX,y:e.clientY,card,active:false,id:e.pointerId};
  });
  addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.active){
      if(Math.hypot(dx,dy)<7)return;drag.active=true;selected=null;
      const cards=drag.from.type==='waste'?[drag.card]:[...drag.card.parentNode.querySelectorAll('[data-from]')].filter(c=>+c.dataset.from.split(':')[2]>=drag.from.index);
      const ghost=el('div','drag-ghost'),r0=drag.card.getBoundingClientRect();ghost.style.left=r0.left+'px';ghost.style.top=r0.top+'px';
      for(const c of cards){const r=c.getBoundingClientRect(),copy=c.cloneNode(true);Object.assign(copy.style,{position:'absolute',left:(r.left-r0.left)+'px',top:(r.top-r0.top)+'px',width:r.width+'px',height:r.height+'px'});copy.classList.remove('land','selected','hinted');ghost.append(copy);c.style.visibility='hidden';}
      document.body.append(ghost);drag.ghost=ghost;drag.cards=cards;
    }
    drag.ghost.style.transform=`translate(${dx}px,${dy}px)`;e.preventDefault();
  },{passive:false});
  addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;if(!d.active)return;
    d.ghost.hidden=true;const under=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop]');d.ghost.remove();
    dragJustEnded=true;setTimeout(()=>{dragJustEnded=false;},0);
    let ok=false;if(under){const [type,col]=under.dataset.drop.split(':');ok=solitaireMove(d.from,{type,col:+col});}
    if(!ok)for(const c of d.cards)c.style.visibility='';
  });
  addEventListener('pointercancel',()=>{if(drag?.ghost){drag.ghost.remove();for(const c of drag.cards)c.style.visibility='';}drag=null;});

  // ---- Sudoku --------------------------------------------------------------
  const peersOf=i=>{const r=Math.floor(i/9),c=i%9,out=[];for(let j=0;j<81;j++){const rr=Math.floor(j/9),cc=j%9;if(j!==i&&(rr===r||cc===c||(Math.floor(rr/3)===Math.floor(r/3)&&Math.floor(cc/3)===Math.floor(c/3))))out.push(j);}return out;};
  function renderSudoku(){
    const b=grid(9,'sudoku'),sameN=selected!==null?s.b[selected]:0,peers=selected!==null?new Set(peersOf(selected)):new Set();
    s.b.forEach((n,i)=>{
      const r=Math.floor(i/9),c=i%9,conflict=n&&!E.Sudoku.candidates(s.b.map((v,j)=>j===i?0:v),i).includes(n),wrong=opts.mistakes&&n&&!s.given[i]&&n!==s.answer[i];
      const cls=['square'];if(s.given[i])cls.push('given');if(conflict)cls.push('conflict');if(wrong)cls.push('wrong');if(peers.has(i))cls.push('peer');if(sameN&&n===sameN&&i!==selected)cls.push('same');if(selected===i)cls.push('chosen');if(c===2||c===5)cls.push('box-right');if(r===2||r===5)cls.push('box-bottom');if(moved.has(i)&&!reduced())cls.push('drop');
      const sq=button(n?String(n):'',()=>{if(finished)return;selected=i;renderSudoku();},cls.join(' '));
      sq.setAttribute('aria-label',`Row ${r+1}, column ${c+1}, ${n||'empty'}${s.given[i]?', given':''}`);
      if(!n&&notes[i]?.length){const marks=el('span','notes-grid');for(let v=1;v<=9;v++)marks.append(el('span',sameN===v&&notes[i].includes(v)?'hot':'',notes[i].includes(v)?String(v):' '));sq.append(marks);}
      b.append(sq);
    });
    const count=Array(10).fill(0);for(const n of s.b)count[n]++;
    const pad=el('div','numpad');for(let n=1;n<=9;n++){const k=button('',()=>sudokuEntry(n),count[n]>=9?'done':'');k.append(el('span',null,String(n)),el('small',null,count[n]>=9?'✓':String(9-count[n])));k.setAttribute('aria-label',`${n}, ${Math.max(0,9-count[n])} left`);pad.append(k);}stage.append(pad);
    toolRow([
      button('↶ Undo',()=>{if(finished||!history.length)return;const h=history.pop();s.b=h.b;notes=h.notes;selected=h.selected;renderSudoku();}),
      button('Erase',()=>sudokuEntry(0)),
      button('✎ Notes '+(notesMode?'on':'off'),()=>{notesMode=!notesMode;renderSudoku();},notesMode?'on':'')
    ],[
      button('Fill notes',()=>{if(finished)return;sudokuHistory();for(let i=0;i<81;i++)if(!s.b[i])notes[i]=E.Sudoku.candidates(s.b,i);renderSudoku();}),
      button(opts.mistakes?'Mistakes: shown':'Show mistakes',()=>{opts.mistakes=!opts.mistakes;saveOpts();if(opts.mistakes&&!finished)eligible=false;renderSudoku();},opts.mistakes?'on':''),
      button('Reveal square',()=>{if(selected===null||s.given[selected]||finished){hint('Select an editable square first.');return;}sudokuHistory();eligible=false;s.b[selected]=s.answer[selected];delete notes[selected];beginClock();renderSudoku();sudokuFinish();}),
      button(opts.showTimer?'Hide timer':'Show timer',()=>{opts.showTimer=!opts.showTimer;saveOpts();updateMetric();renderSudoku();})
    ]);
    status(s.b.filter(Boolean).length+'/81 filled'+(!eligible?' · helped':''));
    hint('Choose a square, then 1–9. N for notes; Backspace to erase.');moved=new Set();persist();
  }
  function sudokuHistory(){history.push({b:s.b.slice(),notes:JSON.parse(JSON.stringify(notes)),selected});if(history.length>300)history.shift();}
  function sudokuEntry(n){
    if(finished||selected===null||s.given[selected])return;beginClock();
    if(notesMode&&n){if(s.b[selected])return;sudokuHistory();const a=notes[selected]||[];notes[selected]=a.includes(n)?a.filter(v=>v!==n):[...a,n];}
    else{if(s.b[selected]===n)return;sudokuHistory();s.b[selected]=n;delete notes[selected];if(n){for(const j of peersOf(selected))if(notes[j])notes[j]=notes[j].filter(v=>v!==n);moved=new Set([selected]);}}
    sfx('tap');renderSudoku();sudokuFinish();
  }
  function sudokuFinish(){if(E.Sudoku.valid(s.b)){const t=seconds();record('won',eligible?t:null);celebrate();dailyDone(t);finish('Everything in its place.',`Puzzle solved in ${fmtTime(t)}.`+(!eligible?' You had some help, so this one stays off the board.':''),eligible?t:null);}}

  // ---- Minesweeper (keeps its clock) ---------------------------------------
  let pressTimer=null,pressFired=0;
  const setFace=f=>{face=f;const b=$('mine-face');if(b)b.textContent=f;};
  function renderMines(){
    const {rows,cols}=E.Mines.size(s),b=grid(cols,'mines'+(rows!==cols?' wide':''));if(rows!==cols){b.style.aspectRatio=`${cols}/${rows}`;b.style.width=`min(100%,${cols*34}px)`;}
    s.b.forEach((v,i)=>{
      const revealed=s.open[i]||(s.over&&v===-1),wrongFlag=s.over&&!s.won&&s.flags[i]&&v!==-1;
      const sq=button(revealed?(v===-1?'✹':v||''):wrongFlag?'✕':s.flags[i]?'⚑':'',()=>mineTap(i),'square'+(revealed?' revealed v'+v:'')+(s.over&&v===-1?' bomb':'')+(s.flags[i]?' flag':'')+(wrongFlag?' wrong':'')+(moved.has(i)?' boom':''));
      sq.setAttribute('aria-label',`Row ${Math.floor(i/cols)+1}, column ${i%cols+1}: ${revealed?(v===-1?'mine':v+' neighboring mines'):s.flags[i]?'flag':'covered'}`);
      sq.oncontextmenu=e=>{e.preventDefault();if(Date.now()-pressFired<800)return;mineFlag(i);};
      // Press and hold flags a square, on a phone or with a mouse.
      sq.onpointerdown=e=>{if(finished||s.open[i]||e.button>0)return;setFace('😮');const x=e.clientX,y=e.clientY;clearTimeout(pressTimer);pressTimer=setTimeout(()=>{pressFired=Date.now();navigator.vibrate?.(15);setFace('🙂');mineFlag(i);},420);sq.onpointermove=m=>{if(Math.hypot(m.clientX-x,m.clientY-y)>10)clearTimeout(pressTimer);};};
      sq.onpointerup=sq.onpointerleave=()=>{clearTimeout(pressTimer);if(face==='😮'&&!finished)setFace('🙂');};
      b.append(sq);
    });
    const faceBtn=button(face,()=>start(),'mine-face');faceBtn.id='mine-face';faceBtn.setAttribute('aria-label','New field');
    const bits=[faceBtn,button(flagMode?'Flag mode: on':'Flag mode: off',()=>{flagMode=!flagMode;renderMines();},flagMode?'on':'')];
    if(finished&&!s.won&&beforeReveal)bits.push(button('Take back that click',()=>{s=beforeReveal;beforeReveal=null;finished=false;eligible=false;face='🙂';status('');renderMines();updateMetric();}));
    if(finished&&!s.won)bits.push(button('Same board again',()=>{const again=E.Mines.replay(s);resetRun();s=again;eligible=false;renderMines();updateMetric();hint('Same mines as last time. This one stays off the board.');}));
    tools.replaceChildren(...bits);
    if(!finished)status((s.mines-s.flags.filter(Boolean).length)+' mines left'+(!eligible?' · practice':''));
    hint(flagMode?'Tap a covered square to place or remove a flag.':'Tap to reveal. Right-click, press and hold, or Flag mode to mark a mine.');moved=new Set();persist();
  }
  function mineFlag(i){if(finished||s.open[i])return;s.flags[i]=!s.flags[i];sfx('flag');renderMines();}
  function mineTap(i){
    if(finished||Date.now()-pressFired<600)return;if(flagMode){mineFlag(i);return;}if(s.flags[i])return;
    beforeReveal=s.started?E.copy(s):null;beginClock();E.Mines.reveal(s,i);face=s.over?(s.won?'😎':'😵'):'🙂';if(!s.won)sfx(s.over?'boom':'tap');if(s.over&&!s.won)moved=new Set([i]);renderMines();
    if(s.over){const t=seconds();record(s.won?'won':'lost',s.won&&eligible?t:null);if(s.won)celebrate();finish(s.won?'A clean sweep.':'That was a mine.',s.won?`Every safe square, in ${fmtTime(t)}.`+(eligible?'':' A practice run, so it stays off the board.'):'Take that click back, try the same board again, or start a fresh field.',s.won&&eligible?t:null);renderMines();}
  }

  // ---- Wordle --------------------------------------------------------------
  function initWord(){dailyDate=new Date().toISOString().slice(0,10);const saved=mode==='daily'?storage.get('daily:'+dailyDate):null;s={answer:mode==='daily'?E.Word.daily(window.ArcadeWords.answers,dailyDate):window.ArcadeWords.answers[Math.floor(Math.random()*window.ArcadeWords.answers.length)],guesses:[],submitted:false,hard:!!opts.hard};if(saved&&Array.isArray(saved.guesses)&&saved.guesses.length<=6&&saved.guesses.every(w=>typeof w==='string'&&/^[a-z]{5}$/.test(w)&&window.ArcadeWords.allowed.has(w))){s.guesses=saved.guesses;s.submitted=!!saved.submitted;s.hard=!!saved.hard;}finished=s.guesses.includes(s.answer)||s.guesses.length===6;}
  function untilNext(){const now=new Date(),next=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1),t=Math.max(0,Math.floor((next-now)/1000));return `${Math.floor(t/3600)}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;}
  /* Hard mode: greens stay put and every found letter is used again. */
  function hardProblem(guess){
    for(const g of s.guesses){const colors=E.Word.feedback(g,s.answer);for(let i=0;i<5;i++)if(colors[i]==='correct'&&guess[i]!==g[i])return `Hard mode: letter ${i+1} must be ${g[i].toUpperCase()}.`;const need={};g.split('').forEach((ch,i)=>{if(colors[i]!=='absent')need[ch]=(need[ch]||0)+1;});for(const [ch,n] of Object.entries(need))if(guess.split(ch).length-1<n)return `Hard mode: the guess must use ${ch.toUpperCase()}.`;}
    return null;
  }
  function renderWord(){
    stage.replaceChildren();const b=el('div','word-board'),used={},flipping=revealRow;
    for(let r=0;r<6;r++){
      const guess=s.guesses[r],colors=guess?E.Word.feedback(guess,s.answer):null,row=r===flipping&&!reduced();
      for(let c=0;c<5;c++){
        const ch=guess?.[c]||(r===s.guesses.length?input[c]||'':''),t=el('div','letter'+(colors&&!row?' '+colors[c]:''),ch);
        // A new guess flips tile by tile; each tile takes its color halfway over.
        if(row){t.classList.add('flip');t.style.setProperty('--d',c*.25+'s');setTimeout(()=>t.classList.add(colors[c]),c*250+250);}
        if(r===s.guesses.length&&!guess){if(ch)t.classList.add('typed');if(shake)t.classList.add('shake');else if(c===input.length-1&&!reduced())t.classList.add('pop');}
        t.setAttribute('aria-label',guess?`${guess[c]}, ${colors[c]}`:ch||'Empty letter');b.append(t);
      }
      if(guess&&!row)for(let c=0;c<5;c++){const ranks={absent:1,present:2,correct:3};if((ranks[used[guess[c]]]||0)<ranks[colors[c]])used[guess[c]]=colors[c];}
    }
    stage.append(b);
    const keyboard=el('div','keyboard');for(const line of ['qwertyuiop','asdfghjkl','↵zxcvbnm⌫']){const keyrow=el('div','keyrow');for(const ch of line)keyrow.append(button(ch==='↵'?'ENTER':ch==='⌫'?'⌫':ch.toUpperCase(),()=>wordKey(ch),'key'+(ch==='↵'||ch==='⌫'?' wide':'')+(used[ch]?' '+used[ch]:'')));keyboard.append(keyrow);}stage.append(keyboard);
    if(flipping>=0){revealRow=-1;if(!reduced()){revealUntil=Date.now()+1350;const token=revision;setTimeout(()=>{if(token===revision)renderWord();},1400);}}
    shake=false;
    const won=s.guesses.includes(s.answer),bits=[];
    if(!s.guesses.length&&!finished)bits.push(button('Hard mode: '+(s.hard?'on':'off'),()=>{s.hard=opts.hard=!s.hard;saveOpts();saveDaily();renderWord();},s.hard?'on':''));
    if(finished)bits.push(button('Share',shareWordle));
    if(finished&&won&&!s.submitted)bits.push(button('Add your initials',()=>{if(pending){$('result-dialog').showModal();return;}finished=false;finish('You found it.',`The word was ${s.answer.toUpperCase()}. ${s.guesses.length} of 6 guesses.`,s.guesses.length);}));
    tools.replaceChildren(...bits);
    status(finished?(won?'Solved in '+s.guesses.length+'/6':'The word was '+s.answer.toUpperCase()):(mode==='daily'?'Daily word · '+dailyDate+' UTC':'Practice · guess '+(s.guesses.length+1)+' of 6')+(s.hard?' · hard mode':''));
    clearInterval(ticker);
    if(finished&&mode==='daily'){const tick=()=>hint('Next daily word in '+untilNext()+'. Practice is always open.');tick();ticker=setInterval(tick,1000);}
    else if(finished)hint('New game for another word.');
    else hint('Green: right spot · Gold: elsewhere · Gray: not this letter');
    persist();
  }
  function shareWordle(){
    const sq={correct:'🟩',present:'🟨',absent:'⬛'},won=s.guesses.includes(s.answer);
    const text=`RIC//NET Wordle ${mode==='daily'?dailyDate:'practice'} ${won?s.guesses.length:'X'}/6${s.hard?'*':''}\n\n`+s.guesses.map(g=>E.Word.feedback(g,s.answer).map(c=>sq[c]).join('')).join('\n');
    const done=()=>{hint('Copied. Paste it anywhere: no letters, no spoilers.');if($('result-dialog').open)$('save-message').textContent='Copied to your clipboard.';};
    const fallback=()=>{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();try{document.execCommand('copy');done();}catch{hint('Couldn’t copy here.');}t.remove();};
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
  }
  function wordKey(ch){
    if(finished||Date.now()<revealUntil)return;
    if(ch==='⌫'||ch==='Backspace'){input=input.slice(0,-1);renderWord();return;}
    if(ch==='↵'||ch==='Enter'){
      const nope=msg=>{sfx('error');shake=!reduced();renderWord();hint(msg);};
      if(input.length!==5){nope('Five letters before you guess.');return;}
      if(!window.ArcadeWords.allowed.has(input)){nope('That word isn’t in the word list. Try another.');return;}
      if(s.hard){const p=hardProblem(input);if(p){nope(p);return;}}
      s.guesses.push(input);input='';saveDaily();revealRow=s.guesses.length-1;sfx('flip');
      const won=s.guesses.at(-1)===s.answer,out=won||s.guesses.length===6;
      if(out){finished=true;lastFinish={guesses:won?s.guesses.length:null};record(won?'won':'lost',won?s.guesses.length:null);}
      renderWord();
      if(won){finished=false;setTimeout(celebrate,reduced()?0:1300);finish('You found it.',`The word was ${s.answer.toUpperCase()}. ${s.guesses.length} of 6 guesses.`,s.guesses.length);}
      else if(out){finished=false;setTimeout(()=>sfx('lose'),reduced()?0:1300);finish('One word got away.',`The word was ${s.answer.toUpperCase()}. ${mode==='daily'?'Another daily word arrives at midnight UTC.':'Try another whenever you like.'}`);}
      return;
    }
    if(/^[a-z]$/i.test(ch)&&input.length<5){input+=ch.toLowerCase();renderWord();}
  }

  // ---- Snake & Tetris (canvas) ---------------------------------------------
  let blockColors=['','#69cad2','#e5be54','#b293d5','#82bd72','#e58276','#799ad7','#dca45b'];
  function beginAction(){$('action-overlay')?.remove();if(running||finished)return;running=true;paused=false;s.started=true;$('pause').hidden=false;lastFrame=performance.now();accumulator=0;frame=requestAnimationFrame(tick);status('Good luck.');}
  function renderAction(resumed=false){
    stage.className='stage action-stage'+(game.id==='snake'?' snake-stage':' tetris-stage');stage.replaceChildren();
    const row=el('div','action-row'),wrap=el('div','canvas-wrap'+(game.id==='tetris'?' tetris':''));
    const c=document.createElement('canvas');c.width=game.id==='tetris'?300:500;c.height=game.id==='tetris'?600:500;c.id='game-canvas';c.className='game-canvas';c.setAttribute('role','img');c.setAttribute('aria-label',game.name+' game board. Use the controls below or your keyboard.');wrap.append(c);row.append(wrap);
    if(game.id==='tetris'){const side=el('div','tetris-side');for(const [label,id,h] of [['Hold','hold-canvas',60],['Next','next-canvas',170]]){const box=el('div','side-box');box.append(el('span',null,label));const cv=document.createElement('canvas');cv.width=100;cv.height=h;cv.id=id;box.append(cv);side.append(box);}const nums=el('dl','side-stats');for(const [k,id] of [['Score','t-score'],['Lines','t-lines'],['Level','t-level'],['Best','t-best']]){const d=el('div');const dd=el('dd');dd.id=id;d.append(el('dt',null,k),dd);nums.append(d);}side.append(nums);row.append(side);}
    stage.append(row);
    const overlay=el('div','start-overlay');overlay.id='action-overlay';
    const how=el('p','overlay-keys');
    // Static, trusted markup: keycaps for the controls.
    how.innerHTML=resumed?'Saved right where you left it.':game.id==='snake'?'<span class="key-only"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> steer · <kbd>P</kbd> pause</span><span class="touch-only">Swipe anywhere to steer</span>':'<span class="key-only"><kbd>←</kbd><kbd>→</kbd> move · <kbd>↑</kbd> turn · <kbd>Space</kbd> drop · <kbd>C</kbd> hold</span><span class="touch-only">Drag to move · tap to turn · flick down to drop</span>';
    overlay.append(el('strong','overlay-title',resumed?'Welcome back':game.name),button(resumed?'Resume':'Play',beginAction,'overlay-play'),how);
    wrap.append(overlay);
    if(game.id==='snake'){const pad=el('div','dpad');for(const [label,x,y,cls,name]of [['↑',0,-1,'up','Up'],['←',-1,0,'left','Left'],['↓',0,1,'down','Down'],['→',1,0,'right','Right']]){const k=button(label,()=>actionMove(x,y),cls);k.setAttribute('aria-label',name);pad.append(k);}stage.append(pad);}
    else{const pad=el('div','tetris-controls');for(const [label,fn,name]of [['←',()=>actionMove(-1,0),'Left'],['↻',()=>rotate(),'Rotate'],['→',()=>actionMove(1,0),'Right'],['↓',()=>softDrop(),'Soft drop'],['Drop',()=>hardDrop(),'Hard drop'],['Hold',()=>holdPiece(),'Hold']]){const k=button(label,fn);k.setAttribute('aria-label',name);pad.append(k);}stage.append(pad);tetrisTouch(c);}
    const touch=matchMedia('(any-pointer:coarse)').matches;hint(game.id==='snake'?(touch?'Swipe anywhere on the board to steer, or use the arrows.':'Arrows / WASD to steer · P to pause'):(touch?'Drag to move · tap to turn · flick down to drop':'← → move · ↑ / X rotate · Z reverse · ↓ soft · Space drop · C hold · P pause'));
    status(resumed?'Saved game · ready when you are.':'Ready when you are.');drawAction();updateMetric();
  }
  /* Snake on a phone (Ric, 2026-11-21: "swiping needs to be a way you can play
     too"): a swipe anywhere on the stage turns as soon as the finger has gone
     far enough, without waiting for it to lift, and one long drag can turn
     several times. The stage takes the touch (touch-action: none in
     style.css), so the page doesn't scroll under the game. */
  let swipe=null;
  stage.addEventListener('pointerdown',e=>{if(game?.id!=='snake'||e.target.closest('button'))return;swipe={x:e.clientX,y:e.clientY,id:e.pointerId};try{stage.setPointerCapture(e.pointerId);}catch{}if(!running&&!finished)beginAction();});
  /* Each swipe is measured from where that stroke began, never from the
     screen edge: after swiping right, a short flick up or down (from anywhere)
     turns again. Holding the finger down and changing direction works too. */
  stage.addEventListener('pointermove',e=>{
    if(!swipe||e.pointerId!==swipe.id)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
    const [x,y]=Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)];swipe.x=e.clientX;swipe.y=e.clientY;
    if(x===swipe.lx&&y===swipe.ly)return;swipe.lx=x;swipe.ly=y;
    const before=JSON.stringify([s.queued,s.queued2]);actionMove(x,y);
    if(JSON.stringify([s.queued,s.queued2])!==before){navigator.vibrate?.(8);const k=stage.querySelector('.dpad .'+(x>0?'right':x<0?'left':y<0?'up':'down'));if(k){k.classList.remove('pressed');void k.offsetWidth;k.classList.add('pressed');}}
  });
  const endSwipe=()=>{swipe=null;};stage.addEventListener('pointerup',endSwipe);stage.addEventListener('pointercancel',endSwipe);
  /* Tetris on a phone: drag sideways to move a column at a time, drag down to
     soft drop, flick down to hard drop, tap to rotate. */
  function tetrisTouch(c){
    let t=null;
    c.addEventListener('pointerdown',e=>{if(!running||paused)return;t={x:e.clientX,y:e.clientY,ax:e.clientX,ay:e.clientY,at:performance.now(),moved:false};c.setPointerCapture(e.pointerId);});
    c.addEventListener('pointermove',e=>{if(!t)return;const cell=c.getBoundingClientRect().width/10;while(e.clientX-t.ax>cell){actionMove(1,0);t.ax+=cell;t.moved=true;}while(t.ax-e.clientX>cell){actionMove(-1,0);t.ax-=cell;t.moved=true;}while(e.clientY-t.ay>cell*1.4){softDrop();t.ay+=cell*1.4;t.moved=true;}});
    c.addEventListener('pointerup',e=>{if(!t)return;const dt=performance.now()-t.at,dx=e.clientX-t.x,dy=e.clientY-t.y;if(dy>60&&dt<280&&Math.abs(dx)<dy)hardDrop();else if(!t.moved&&Math.hypot(dx,dy)<10)rotate();t=null;});
  }
  /* A landed piece waits half a second before it locks; moving or turning it
     restarts the wait, up to 15 times, so it can't hover forever. */
  function nudgeLock(){if(lockAt!==null&&lockResets<15){lockAt=performance.now();lockResets++;}}
  function lockPiece(){const rows=E.Tetris.fullRows(s);E.Tetris.lock(s);sfx(rows.length?'clear':'tap');lockAt=null;lockResets=0;if(rows.length&&!reduced())flash={rows,at:performance.now()};}
  function actionMove(x,y){if(!running&&!finished&&game.id==='snake'&&$('action-overlay'))beginAction();if(!running||paused||finished)return;if(game.id==='snake')E.Snake.turn(s,x,y);else if(E.Tetris.move(s,x,y))nudgeLock();drawAction();}
  function rotate(reverse=false){if(game.id!=='tetris'||!running||paused||finished)return;if(E.Tetris.rotate(s,reverse))nudgeLock();drawAction();}
  function holdPiece(){if(game.id!=='tetris'||!running||paused||finished)return;if(E.Tetris.hold(s)){lockAt=null;lockResets=0;sfx('flip');}drawAction();actionEnd();}
  function softDrop(){if(game.id!=='tetris'||!running||paused||finished)return;if(E.Tetris.move(s,0,1)){s.score++;lockAt=null;}else lockPiece();updateMetric();drawAction();actionEnd();}
  function hardDrop(){if(game.id!=='tetris'||!running||paused||finished)return;while(E.Tetris.move(s,0,1))s.score+=2;lockPiece();accumulator=0;updateMetric();drawAction();actionEnd();}
  function actionEnd(){if(!s.over||finished)return;const newBest=s.score>0&&s.score>bestScore;if(!newBest)sfx('lose');record(null,s.score);finish(game.id==='snake'?'That’s a wrap.':'Stacked to the rafters.',`${s.score.toLocaleString()} points. ${game.id==='tetris'?s.lines+' lines cleared.':'Another apple is waiting.'}${newBest?' A new personal best.':''}`,s.score>0&&board()?s.score:null);if(newBest)celebrate();}
  function tick(now){
    if(!running||paused||finished)return;accumulator+=Math.min(now-lastFrame,250);lastFrame=now;
    const delay=game.id==='snake'?(mode==='slow'?Math.max(110,240-Math.floor(s.score/10)*3):Math.max(65,160-Math.floor(s.score/10)*4)):Math.max(80,800*Math.pow(.82,Math.floor(s.lines/10)));
    while(accumulator>=delay&&!s.over){accumulator-=delay;if(game.id==='snake'){const food=s.food,score=s.score;E.Snake.step(s);if(s.score>score)sfx('eat');if(s.score>score&&!reduced())for(let k=0;k<12;k++){const a=Math.PI*2*k/12;particles.push({x:food.x,y:food.y,vx:Math.cos(a),vy:Math.sin(a),at:now});}}else if(E.Tetris.move(s,0,1))lockAt=null;else if(lockAt===null)lockAt=now;}
    if(game.id==='tetris'&&lockAt!==null){if(E.Tetris.fits(s,s.piece,s.x,s.y+1))lockAt=null;else if(now-lockAt>=500)lockPiece();}
    drawAction();updateMetric();actionEnd();if(running&&!finished)frame=requestAnimationFrame(tick);
  }
  function drawPiece(cv,piece,unit,ox,oy){const nx=cv.getContext('2d');piece.forEach((row,r)=>row.forEach((v,c)=>{if(v){nx.fillStyle=blockColors[v];nx.fillRect(ox+c*unit+1,oy+r*unit+1,unit-2,unit-2);}}));}
  function drawAction(){
    const c=$('game-canvas');if(!c||!s)return;const x=c.getContext('2d'),now=performance.now();x.fillStyle=paint.bg;x.fillRect(0,0,c.width,c.height);
    const box=(px,py,w,h,r)=>{x.beginPath();if(x.roundRect)x.roundRect(px,py,w,h,r);else x.rect(px,py,w,h);x.fill();};
    if(game.id==='snake'){
      const unit=25;for(let r=0;r<20;r++)for(let col=0;col<20;col++)if((r+col)%2){x.fillStyle=paint.grid;x.fillRect(col*unit,r*unit,unit,unit);}
      const pulse=reduced()||!running?0:Math.sin(now/180)*1.2;x.fillStyle=paint.food;x.beginPath();x.arc(s.food.x*unit+unit/2,s.food.y*unit+unit/2,8+pulse,0,Math.PI*2);x.fill();
      // One joined, rounded body reads better than separate squares.
      x.fillStyle=paint.body;
      s.body.forEach((p,i)=>{box(p.x*unit+3,p.y*unit+3,unit-6,unit-6,6);const q=s.body[i-1];if(q&&Math.abs(q.x-p.x)+Math.abs(q.y-p.y)===1)x.fillRect(Math.min(p.x,q.x)*unit+3,Math.min(p.y,q.y)*unit+3,(Math.abs(p.x-q.x)+1)*unit-6,(Math.abs(p.y-q.y)+1)*unit-6);});
      const h=s.body[0];x.fillStyle=paint.head;box(h.x*unit+2,h.y*unit+2,unit-4,unit-4,8);
      x.fillStyle=paint.eyes;for(const off of [-4,4]){const px=h.x*unit+12.5+(s.dir.x?5*s.dir.x:off),py=h.y*unit+12.5+(s.dir.y?5*s.dir.y:off);x.beginPath();x.arc(px,py,2,0,Math.PI*2);x.fill();}
      particles=particles.filter(p=>now-p.at<380);for(const p of particles){const k=(now-p.at)/380;x.globalAlpha=1-k;x.fillStyle=paint.food;x.beginPath();x.arc(p.x*unit+unit/2+p.vx*k*30,p.y*unit+unit/2+p.vy*k*30,3*(1-k)+1,0,Math.PI*2);x.fill();}x.globalAlpha=1;
      if(s.wrap){x.strokeStyle=paint.food;x.setLineDash([6,8]);x.lineWidth=2;x.strokeRect(1,1,c.width-2,c.height-2);x.setLineDash([]);x.lineWidth=1;}
    }else{
      const unit=30,tile=(v,col,r,alpha=1)=>{x.globalAlpha=alpha;x.fillStyle=blockColors[v];x.fillRect(col*unit+1,r*unit+1,unit-2,unit-2);x.fillStyle='#ffffff33';x.fillRect(col*unit+3,r*unit+3,unit-6,3);x.globalAlpha=1;};
      x.strokeStyle=paint.grid;for(let r=0;r<=20;r++){x.beginPath();x.moveTo(0,r*unit);x.lineTo(300,r*unit);x.stroke();}for(let col=0;col<=10;col++){x.beginPath();x.moveTo(col*unit,0);x.lineTo(col*unit,600);x.stroke();}
      s.b.forEach((row,r)=>row.forEach((v,col)=>{if(v)tile(v,col,r);}));
      if(flash){const k=(now-flash.at)/220;if(k>=1)flash=null;else{x.fillStyle=`rgba(255,255,255,${.85*(1-k)})`;for(const r of flash.rows)x.fillRect(0,r*unit,300,unit);}}
      let ghost=s.y;while(E.Tetris.fits(s,s.piece,s.x,ghost+1))ghost++;
      const settling=lockAt!==null?Math.min(1,(now-lockAt)/500):0;
      s.piece.forEach((row,r)=>row.forEach((v,col)=>{if(v){tile(v,s.x+col,ghost+r,.2);tile(v,s.x+col,s.y+r,1-settling*.3);}}));
      const hc=$('hold-canvas');if(hc){const hx=hc.getContext('2d');hx.clearRect(0,0,100,60);if(s.hold){const p=E.Tetris.shapes[s.hold-1];hx.globalAlpha=s.held?.35:1;drawPiece(hc,p,18,(100-p[0].length*18)/2,(60-p.length*18)/2);hx.globalAlpha=1;}}
      const nc=$('next-canvas');if(nc){nc.getContext('2d').clearRect(0,0,100,170);[s.next,...(s.queue||[])].slice(0,3).forEach((p,k)=>{if(!p)return;const u=k?14:18;drawPiece(nc,p,u,(100-p[0].length*u)/2,k?k*56+10:4);});}
    }
  }
  function togglePause(){
    if(!running||finished)return;paused=!paused;$('pause').textContent=paused?'Resume':'Pause';
    if(paused){cancelAnimationFrame(frame);const cover=el('div','paused-cover','Paused');cover.id='paused-cover';$('game-canvas').parentElement.append(cover);status('Paused. Your game is saved.');persist();}
    else{$('paused-cover')?.remove();status('Back at it.');lastFrame=performance.now();frame=requestAnimationFrame(tick);}
  }
  // Solitaire's table height is measured from the cards, so re-measure when the window changes.
  let resizeTimer=null;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(game?.id==='solitaire'&&s&&!drag)renderSolitaire();},150);});
  $('pause').onclick=togglePause;document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)togglePause();if(document.hidden)persist();});

  // ---- keyboard --------------------------------------------------------------
  document.addEventListener('keydown',e=>{
    if(!game||e.ctrlKey||e.metaKey||e.altKey||$('result-dialog').open||$('help-dialog').open||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
    if(game.id==='wordle'){if(/^[a-z]$/.test(k)||['enter','backspace'].includes(k)){e.preventDefault();wordKey(k==='enter'?'Enter':k==='backspace'?'Backspace':k);}return;}
    if(game.id==='sudoku'){if(/^[1-9]$/.test(k)){e.preventDefault();sudokuEntry(+k);}else if(['backspace','delete','0'].includes(k)){e.preventDefault();sudokuEntry(0);}else if(k==='n'){notesMode=!notesMode;renderSudoku();}else if(k.startsWith('arrow')){e.preventDefault();const offset={arrowleft:-1,arrowright:1,arrowup:-9,arrowdown:9}[k];selected=Math.min(80,Math.max(0,(selected??0)+offset));renderSudoku();}return;}
    if(!action())return;
    if(k==='p'){e.preventDefault();togglePause();return;}
    const dirs={arrowup:[0,-1],w:[0,-1],arrowleft:[-1,0],a:[-1,0],arrowdown:[0,1],s:[0,1],arrowright:[1,0],d:[1,0]};
    if(game.id==='snake'&&dirs[k]){e.preventDefault();actionMove(...dirs[k]);}
    if(game.id==='tetris'){if(['arrowleft','arrowright','arrowdown','arrowup','x','z',' ','c','shift'].includes(k))e.preventDefault();if(!running&&!finished&&!paused&&$('action-overlay')&&(k===' '||k==='enter')){beginAction();return;}if(k==='arrowleft')actionMove(-1,0);if(k==='arrowright')actionMove(1,0);if(k==='arrowdown')softDrop();if(k==='arrowup'||k==='x')rotate();if(k==='z')rotate(true);if((k==='c'||k==='shift')&&!e.repeat)holdPiece();if(k===' '&&!e.repeat)hardDrop();}
  });
  // Preserve the original score/daily keys so existing records survive the
  // move to individual pages. Style is a preference, never a game reset.
  let paint={};
  function applyStyle(){
    const value=$('style-switch').value;
    document.body.dataset.skin=value;
    document.body.dataset.look=$('style-switch').selectedOptions[0]?.dataset.look||'';
    storage.set('style:'+document.body.dataset.game,value);
    const css=getComputedStyle(document.body),read=(name,fallback)=>css.getPropertyValue(name).trim()||fallback;
    document.querySelector('meta[name="theme-color"]').setAttribute('content',css.backgroundColor);
    paint={bg:read('--canvas-bg','#102c24'),grid:read('--canvas-grid','#143428'),head:read('--snake-head','#f5da83'),body:read('--snake-body','#90bd81'),food:read('--snake-food','#edaa70'),eyes:read('--snake-eyes','#183425')};
    blockColors=['',...['#69cad2','#e5be54','#b293d5','#82bd72','#e58276','#799ad7','#dca45b'].map((v,i)=>read('--block-'+(i+1),v))];
    if(game&&['snake','tetris'].includes(game.id))drawAction();
    // Board games whose pieces are drawn differently per style redraw the same position.
    else if(game&&s&&game.id==='checkers'){render();renderStats();}
  }
  const savedStyle=storage.get('style:'+document.body.dataset.game,'0');
  $('style-switch').value=[...$('style-switch').options].some(o=>o.value===savedStyle)?savedStyle:'0';
  $('style-switch').onchange=applyStyle;
  if(document.body.dataset.game==='chess')pieceSprites();
  applyStyle();
  route();
})();
