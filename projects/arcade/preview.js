/* Small front-door views, using the same rules as the playable pages. These
   never load a page, a dictionary, a video, or somebody's saved game. */
(function () {
  'use strict';
  const E = window.ArcadeGames;
  const pieces={K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
  const colors=['','#68d6ef','#f7d962','#c48cf1','#a1d871','#f585a6','#7eaaed','#f1aa66'];
  function init(id, st) {
    const random=st.r||Math.random;
    st.tick=-1;
    if(id==='solitaire')st.game=E.Solitaire.create(random);
    if(id==='chess')st.game=E.Chess.create();
    if(id==='checkers')st.game=E.Checkers.create();
    if(id==='tictactoe')st.game=Array(9).fill('');
    if(id==='sudoku')st.game=E.Sudoku.create('easy',random);
    if(id==='minesweeper'){st.game=E.Mines.create();E.Mines.reveal(st.game,40,random);}
    if(id==='snake')st.game=E.Snake.create();
    if(id==='tetris')st.game=E.Tetris.create(random);
    if(id==='wordle')st.game={answer:'crane',guesses:['slate','crane']};
  }
  function draw(id,x,w,h,time,st) {
    if(!E)return;
    if(!st.game)init(id,st);
    const random=st.r||Math.random;
    const tick=Math.floor(time/(id==='snake'?.17:id==='tetris'?.7:3));
    if(tick!==st.tick){
      st.tick=tick;
      if(id==='solitaire')E.Solitaire.draw(st.game);
      if(id==='chess'){const m=E.Chess.moves(st.game);if(m.length)st.game=E.Chess.apply(st.game,m[Math.floor(random()*m.length)]);else init(id,st);}
      if(id==='checkers'){const m=E.Checkers.moves(st.game);if(m.length)st.game=E.Checkers.apply(st.game,m[Math.floor(random()*m.length)]);else init(id,st);}
      if(id==='tictactoe'){if(E.Tic.winner(st.game))init(id,st);else{const turn=st.game.filter(Boolean).length%2?'O':'X';st.game[E.Tic.best(st.game,turn).index]=turn;}}
      if(id==='snake'){const s=st.game,head=s.body[0];if(head.x>=18&&s.dir.x===1)E.Snake.turn(s,0,1);else if(head.y>=18&&s.dir.y===1)E.Snake.turn(s,-1,0);else if(head.x<=1&&s.dir.x===-1)E.Snake.turn(s,0,-1);else if(head.y<=1&&s.dir.y===-1)E.Snake.turn(s,1,0);E.Snake.step(s,random);if(s.over)init(id,st);}
      if(id==='tetris'){const s=st.game;if(!E.Tetris.move(s,0,1)){E.Tetris.lock(s,random);if(s.over)init(id,st);}if(random()<.12)E.Tetris.move(s,random()<.5?-1:1,0);}
    }
    const s=st.game;
    const backgrounds={solitaire:'#174b36',chess:'#30271f',checkers:'#ead5ba',wordle:'#fff',sudoku:'#faf9f4',minesweeper:'#c2c5c7',tictactoe:'#faf8ef',snake:'#a7b980',tetris:'#100a20'};
    x.fillStyle=backgrounds[id];x.fillRect(0,0,w,h);
    x.save();
    const scale=Math.min(w/440,h/380);x.translate((w-440*scale)/2,(h-380*scale)/2);x.scale(scale,scale);
    const square=(c,r,size,color,ox=0,oy=0)=>{x.fillStyle=color;x.fillRect(ox+c*size+1,oy+r*size+1,size-2,size-2);};
    if(id==='chess'||id==='checkers'){
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        square(c,r,43,(r+c)%2?(id==='chess'?'#8b5e3c':'#b8473e'):'#e6cb96',48,18);
        const p=s.b[r*8+c];if(!p)continue;
        if(id==='chess'){x.font='37px Segoe UI Symbol';x.textAlign='center';x.fillStyle=p===p.toUpperCase()?'#fff8e6':'#151413';x.strokeStyle='#302017';x.lineWidth=.7;x.fillText(pieces[p],69.5+c*43,54+r*43);x.strokeText(pieces[p],69.5+c*43,54+r*43);}
        else{x.fillStyle=p.toLowerCase()==='w'?'#fff0cf':'#382b27';x.beginPath();x.arc(69.5+c*43,39.5+r*43,15,0,7);x.fill();if(p===p.toUpperCase()){x.fillStyle='#baa159';x.font='17px Georgia';x.textAlign='center';x.fillText('♛',69.5+c*43,46+r*43);}}
      }
    }else if(id==='solitaire'){
      const card=(v,c,y)=>{const left=14+c*59;x.fillStyle=v.up?'#fff9e9':'#37677b';x.fillRect(left,y,52,75);x.strokeStyle='#d8dcc0';x.strokeRect(left,y,52,75);if(v.up){x.fillStyle=E.Solitaire.red(v)?'#ae3039':'#193d2e';x.font='bold 17px Georgia';x.textAlign='left';x.fillText(({1:'A',11:'J',12:'Q',13:'K'}[v.rank]||v.rank)+['♠','♥','♦','♣'][v.suit],left+4,y+20);}};
      card({up:false},0,18);if(s.waste.length)card(s.waste.at(-1),1,18);
      s.tableau.forEach((pile,col)=>pile.forEach((v,i)=>card(v,col,113+i*25)));
    }else if(id==='sudoku'){
      for(let r=0;r<9;r++)for(let c=0;c<9;c++){square(c,r,35,'#fffef8',62,32);const n=s.b[r*9+c];if(n){x.font='23px Georgia';x.fillStyle='#26372b';x.textAlign='center';x.fillText(n,80+c*35,59+r*35);}}
      x.strokeStyle='#53604d';for(let i=0;i<=9;i+=3){x.lineWidth=2;x.beginPath();x.moveTo(62+i*35,32);x.lineTo(62+i*35,347);x.stroke();x.beginPath();x.moveTo(62,32+i*35);x.lineTo(377,32+i*35);x.stroke();}
    }else if(id==='minesweeper'){
      for(let r=0;r<9;r++)for(let c=0;c<9;c++){const i=r*9+c;square(c,r,35,s.open[i]?'#e0e2dc':'#aeb5b7',62,32);if(s.open[i]&&s.b[i]){x.font='bold 22px monospace';x.textAlign='center';x.fillStyle='#173674';x.fillText(s.b[i],80+c*35,59+r*35);}}
    }else if(id==='tictactoe'){
      x.strokeStyle='#7b95b9';x.lineWidth=3;for(let i=1;i<3;i++){x.beginPath();x.moveTo(70+i*100,40);x.lineTo(70+i*100,340);x.stroke();x.beginPath();x.moveTo(70,40+i*100);x.lineTo(370,40+i*100);x.stroke();}
      s.forEach((p,i)=>{if(p){x.font='70px Comic Sans MS';x.textAlign='center';x.fillStyle=p==='X'?'#275586':'#b33c48';x.fillText(p,120+i%3*100,113+Math.floor(i/3)*100);}});
    }else if(id==='wordle'){
      s.guesses.forEach((word,r)=>{const feedback=E.Word.feedback(word,s.answer);[...word].forEach((ch,c)=>{square(c,r,58,{correct:'#356b44',present:'#8c6b18',absent:'#5d665b'}[feedback[c]],73,100);x.font='bold 28px monospace';x.fillStyle='#fff';x.textAlign='center';x.fillText(ch.toUpperCase(),102+c*58,138+r*58);});});
    }else if(id==='snake'){
      const unit=17;for(let r=0;r<20;r++)for(let c=0;c<20;c++)if((r+c)%2)square(c,r,unit,'#a0b178',50,20);
      square(s.food.x,s.food.y,unit,'#283d26',50,20);s.body.forEach((p,i)=>square(p.x,p.y,unit,i?'#405932':'#243b25',50,20));
    }else if(id==='tetris'){
      const unit=17;s.b.forEach((row,r)=>row.forEach((v,c)=>{if(v)square(c,r,unit,colors[v],135,20);}));s.piece.forEach((row,r)=>row.forEach((v,c)=>{if(v)square(s.x+c,s.y+r,unit,colors[v],135,20);}));
      x.strokeStyle='#785294';x.strokeRect(135,20,170,340);
    }
    x.restore();
  }
  window.ArcadePreview={draw};
})();
