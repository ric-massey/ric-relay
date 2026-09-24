const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const logic = require('../shared/ric-dashboard-logic.js');
const raceStartMs = new Date(2026,9,9,7,0,0).getTime();

test('race-night boundaries use the Abingdon sunset and sunrise window', () => {
  assert.equal(logic.isDarkAtElapsed(raceStartMs,0),true,'7:00 AM is before sunrise');
  assert.equal(logic.isDarkAtElapsed(raceStartMs,30*60),false,'7:30 AM is daylight');
  assert.equal(logic.isDarkAtElapsed(raceStartMs,(11*60+59)*60),false,'6:59 PM is daylight');
  assert.equal(logic.isDarkAtElapsed(raceStartMs,12*60*60),true,'7:00 PM is after dark');
  assert.equal(logic.isDarkAtElapsed(raceStartMs,18*60*60),true,'1:00 AM is after dark');
});

test('daylight pacing does not ask for headlamps', () => {
  const people = logic.headlampPeople('pace',raceStartMs,9*60*60,10*60*60);
  assert.deepEqual(people,[]);
});

test('night pacing requires a headlamp for Ric and Dad', () => {
  const people = logic.headlampPeople('pace',raceStartMs,16*60*60,18*60*60);
  assert.deepEqual(people,['Ric','Dad']);
});

test('night pacing uses the assigned pacer name', () => {
  const people = logic.headlampPeople('pace',raceStartMs,16*60*60,18*60*60,'19:00','07:30','Sydney');
  assert.deepEqual(people,['Sydney','Dad']);
});

test('night crew stops require Dad headlamp check', () => {
  const people = logic.headlampPeople('crew',raceStartMs,15*60*60,15*60*60);
  assert.deepEqual(people,['Dad']);
});

test('a daylight stop does not require headlamps just because its leg crosses sunset', () => {
  const people = logic.headlampPeople('pace',raceStartMs,(11*60+50)*60,(12*60+20)*60);
  assert.deepEqual(people,[]);
});

test('assigned entries are ordered and numbered from Stop 1', () => {
  const numbered = logic.numberTimeline([
    {mile:90.5,order:18,id:'late'},
    {mile:52,order:10,id:'early'},
    {mile:84,order:16,id:'middle'},
  ]);
  assert.deepEqual(numbered.map(x=>[x.id,x.stopNumber]),[
    ['early',1],['middle',2],['late',3],
  ]);
});

test('course stop numbers come from the complete race order, not Ric assignments', () => {
  const miles = [0,3.8,9.5,16,20,26.5,32.2,35.9,39.7,45.4,52,58.5,64.2,68,71.7,77.4,84,90.5,96.3,100];
  const rows = miles.map((mile,sort_order)=>({id:`mi-${mile}`,mile,sort_order}));
  assert.equal(logic.courseStopNumber(rows,'mi-3.8'),1);
  assert.equal(logic.courseStopNumber(rows,'mi-52'),10);
  assert.equal(logic.courseStopNumber(rows,'mi-84'),16);
  assert.equal(logic.courseStopNumber(rows,'mi-90.5'),17);
  assert.equal(logic.courseStopNumber(rows,'mi-0'),null);
});

test('Overview switches between assigned stops and the full course', () => {
  const course = [
    {id:'start',mile:0,sort_order:0},
    {id:'one',mile:3.8,sort_order:1},
    {id:'ric',mile:52,sort_order:10},
    {id:'finish',mile:100,sort_order:19},
  ];
  const assigned = [{stopId:'ric',mile:52,order:10,stopNumber:2,html:'Ric assignment'}];
  assert.deepEqual(logic.overviewTimeline(course,assigned,'mine'),assigned);
  const all = logic.overviewTimeline(course,assigned,'all');
  assert.deepEqual(all.map(item=>item.stopId),['one','ric','finish']);
  assert.equal(all[1].html,'Ric assignment');
  assert.equal(all[0].stopNumber,1);
});

test('Overview distinguishes Ric lead jobs from broader stop assignments', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  assert.match(app,/>Your jobs<\/button>/);
  assert.match(app,/>All stops<\/button>/);
});

test('All-stops rows identify assigned people and pacers', () => {
  const profiles = [
    {id:'ric',name:'Ric'},
    {id:'michelle',name:'Michelle'},
    {id:'silas',name:'Silas'},
  ];
  assert.deepEqual(
    logic.stopPeople({assigned_to:['michelle','ric'],official_note:'SILAS PACING'},profiles),
    {assignedNames:['Michelle','Ric'],pacerNames:['Silas']}
  );
  assert.deepEqual(
    logic.stopPeople({assigned_to:['michelle'],official_note:'RIC CONT. PACING'},profiles),
    {assignedNames:['Michelle'],pacerNames:['Ric']}
  );
  assert.deepEqual(
    logic.stopPeople({assigned_to:[],official_note:'No crew'},profiles),
    {assignedNames:[],pacerNames:[]}
  );
});

test('pre-race overview uses goal ETA and distance from the start', () => {
  const stats = logic.overviewNextStop(
    {mile:84,elapsed_seconds:54000},
    null,
    {goal_elapsed_sec:53340,projected_elapsed:55000},
    false,
    false
  );
  assert.deepEqual(stats,{milesAway:84,etaElapsed:53340,here:false});
});

test('live overview uses the latest projected ETA and last check-in distance', () => {
  const stats = logic.overviewNextStop(
    {mile:84,elapsed_seconds:54000},
    {mile:77.4},
    {goal_elapsed_sec:53340,projected_elapsed:54800},
    true,
    false
  );
  assert.deepEqual(stats,{milesAway:6.6,etaElapsed:54800,here:false});
});

test('overview says Dad is here while the stop timer is active', () => {
  const stats = logic.overviewNextStop(
    {mile:84,elapsed_seconds:54000},
    {mile:84},
    {goal_elapsed_sec:53340,projected_elapsed:54800},
    true,
    true
  );
  assert.deepEqual(stats,{milesAway:0,etaElapsed:null,here:true});
});

test('Overview chooses Ric pacing before a later crew stop', () => {
  const pace = {start:{id:'mi-52',mile:52},end:{id:'mi-58.5',mile:58.5}};
  const duty = logic.selectNextDuty({id:'mi-84',mile:84},[pace],-1);
  assert.equal(duty.kind,'pace');
  assert.equal(duty.stop.id,'mi-52');
});

test('while Ric is pacing, the next duty target is the end of the leg', () => {
  const pace = {start:{id:'mi-52',mile:52,actual_elapsed_seconds:32000,departed_elapsed_seconds:32100},end:{id:'mi-58.5',mile:58.5}};
  const duty = logic.selectNextDuty({id:'mi-84',mile:84},[pace],52);
  assert.equal(duty.kind,'pace-active');
  assert.equal(duty.stop.id,'mi-58.5');
});

test('pre-race walkthrough data is removed from Ric race rows', () => {
  const raceStart = new Date('2026-10-09T07:00:00-04:00').getTime();
  const rows = logic.sanitizeRaceRows([{
    id:'stop', actual_elapsed_seconds:100, actual_logged_at:'2026-09-12T13:00:00Z',
    departed_elapsed_seconds:120, departed_logged_at:'2026-09-12T13:02:00Z', skipped:true,
    station_note:'Change shoes next stop', station_note_by:'Michelle', flag_forward:true,
    question_answers:{q1:{value:'Yes',at:'2026-09-12T13:01:00Z'}}
  }],raceStart,new Date('2026-10-09T08:00:00-04:00').getTime());
  assert.equal(rows[0].actual_elapsed_seconds,null);
  assert.equal(rows[0].departed_elapsed_seconds,null);
  assert.equal(rows[0].station_note,'');
  assert.equal(rows[0].flag_forward,false);
  assert.deepEqual(rows[0].question_answers,{});
});

test('race-day values logged after the start remain visible', () => {
  const raceStart = new Date('2026-10-09T07:00:00-04:00').getTime();
  const rows = logic.sanitizeRaceRows([{
    id:'stop', actual_elapsed_seconds:100, actual_logged_at:'2026-10-09T13:00:00Z',
    station_note:'Needs socks', station_note_by:'Ric', flag_forward:true,
    question_answers:{q1:{value:'Yes',at:'2026-10-09T13:01:00Z'}}
  }],raceStart,new Date('2026-10-09T09:00:00-04:00').getTime());
  assert.equal(rows[0].actual_elapsed_seconds,100);
  assert.equal(rows[0].station_note,'Needs socks');
  assert.equal(rows[0].flag_forward,true);
  assert.equal(rows[0].question_answers.q1.value,'Yes');
});

test('next-stop selection skips completed assignments', () => {
  const stops = [
    {id:'one',sort_order:10,done:true},
    {id:'two',sort_order:16,done:false},
    {id:'three',sort_order:18,done:false},
  ];
  assert.equal(logic.selectNextAssignedStop(stops,10,s=>s.done).id,'two');
  assert.equal(logic.selectNextAssignedStop(stops,18,s=>s.done).id,'three');
});

test('live pace speeds up or slows down from the latest check-in', () => {
  assert.deepEqual(
    logic.paceTarget(600,{raceIsLive:true,goalReachable:true,catchUpRatio:.95}),
    {ratio:.95,target:570}
  );
  assert.deepEqual(
    logic.paceTarget(600,{raceIsLive:true,goalReachable:true,catchUpRatio:1.05}),
    {ratio:1.05,target:630}
  );
  assert.deepEqual(
    logic.paceTarget(600,{raceIsLive:false,goalReachable:true,catchUpRatio:.95}),
    {ratio:1,target:600}
  );
});

test('pace adjustment is capped to a safe display range', () => {
  assert.deepEqual(
    logic.paceTarget(600,{raceIsLive:true,goalReachable:true,catchUpRatio:.5}),
    {ratio:.8,target:480}
  );
  assert.deepEqual(
    logic.paceTarget(600,{raceIsLive:true,goalReachable:true,catchUpRatio:1.5}),
    {ratio:1.2,target:720}
  );
});

test('active pacing state and miles remaining change with check-ins', () => {
  assert.deepEqual(logic.pacingState(90.5,90.5,100),{active:true,done:false});
  assert.equal(logic.activeMilesRemaining(92,90.5,96.3),4.3);
  assert.deepEqual(logic.pacingState(100,90.5,100),{active:false,done:true});
});

test('crew stop moves through ready, active, grace, and done states', () => {
  assert.equal(logic.crewStopState({actual_elapsed_seconds:null,departed_elapsed_seconds:null}).label,'Ready');
  assert.deepEqual(
    logic.crewStopState({actual_elapsed_seconds:50000,departed_elapsed_seconds:null}),
    {arrived:true,left:false,active:true,resolved:false,label:'Dad here'}
  );
  assert.equal(logic.crewStopState({actual_elapsed_seconds:50000,departed_elapsed_seconds:50300},true).label,'Just left');
  assert.equal(logic.crewStopState({actual_elapsed_seconds:50000,departed_elapsed_seconds:50300},false).resolved,true);
});

test('shared-stop notes are visible to Ric when her ID is assigned', () => {
  const stop = {assigned_to:['ric-id','silas-id','manager-id']};
  assert.equal(logic.isAssignedToStop(stop,'ric-id'),true);
  assert.equal(logic.isAssignedToStop(stop,'someone-else'),false);
});

test('a flagged note targets the person assigned to the next active stop', () => {
  const rows = [
    {id:'one',sort_order:1,assigned_to:['a'],flag_forward:true},
    {id:'two',sort_order:2,assigned_to:['other'],skipped:true},
    {id:'three',sort_order:3,assigned_to:['sydney-id']},
  ];
  assert.equal(logic.flaggedNoteTargetsPerson(rows,rows[0],'sydney-id'),true);
  assert.equal(logic.flaggedNoteTargetsPerson(rows,rows[0],'other'),false);
  assert.equal(logic.flaggedNoteTargetsPerson(rows,{...rows[0],flag_forward:false},'sydney-id'),false);
});

test('Overview treats every stop assigned to Ric as one of his jobs', () => {
  assert.equal(logic.isAssignedToStop({assigned_to:['ric-id','manager-id']},'ric-id'),true);
  assert.equal(logic.isAssignedToStop({assigned_to:['ric-id','silas-id','manager-id']},'ric-id'),true);
});

test('mile 52 gets ten minutes and every other stop gets two', () => {
  assert.equal(logic.stopRestSeconds(52),600);
  assert.equal(logic.stopRestSeconds(52.01),600);
  assert.equal(logic.stopRestSeconds(84),120);
  assert.equal(logic.stopRestSeconds(90.5),120);
});

test('rest countdown reaches zero without going negative', () => {
  const since = 1_000_000;
  assert.deepEqual(logic.restCountdown(since,120,since+30_000),{elapsedSec:30,remainingSec:90,expired:false});
  assert.deepEqual(logic.restCountdown(since,120,since+120_000),{elapsedSec:120,remainingSec:0,expired:true});
  assert.deepEqual(logic.restCountdown(since,120,since+180_000),{elapsedSec:180,remainingSec:0,expired:true});
});

test('rest alerts triple-beep at one minute and beep through the final ten seconds', () => {
  assert.equal(logic.restAlertBeeps(61),0);
  assert.equal(logic.restAlertBeeps(60),3);
  assert.equal(logic.restAlertBeeps(11),0);
  for(let second=10;second>=1;second--) assert.equal(logic.restAlertBeeps(second),1);
  assert.equal(logic.restAlertBeeps(0),0);
});

test('rest alerts survive timer ticks that skip over an alert second', () => {
  assert.equal(logic.restAlertBeepsBetween(61,59),3,'crossing one minute still gives three beeps');
  assert.equal(logic.restAlertBeepsBetween(11,9),2,'crossing 10 and 9 seconds does not lose either beep');
  assert.equal(logic.restAlertBeepsBetween(null,45),3,'opening the timer late still gives the one-minute warning');
  assert.equal(logic.restAlertBeepsBetween(9,9),0,'the same rendered second is not repeated');
});

test('old walkthrough timestamps do not block the real race-day check-in', () => {
  const cutoff='2026-10-09T11:00:00.000Z';
  assert.equal(logic.guardValueIsOpen(null,cutoff),true);
  assert.equal(logic.guardValueIsOpen('2026-09-12T13:00:00.000Z',cutoff),true);
  assert.equal(logic.guardValueIsOpen('2026-10-09T12:00:00.000Z',cutoff),false);
});

test('an old walkthrough answer cannot hide a live race-day note', () => {
  const raceStart=new Date('2026-10-09T07:00:00-04:00').getTime();
  const [row]=logic.sanitizeRaceRows([{
    actual_elapsed_seconds:3600,
    actual_logged_at:'2026-10-09T08:00:00-04:00',
    station_note:'Live: needs socks',
    flag_forward:true,
    question_answers:{old:{value:'Yes',at:'2026-09-12T13:00:00Z'}}
  }],raceStart,new Date('2026-10-09T08:01:00-04:00').getTime());
  assert.equal(row.station_note,'Live: needs socks');
  assert.equal(row.flag_forward,true);
  assert.deepEqual(row.question_answers,{});
});

test('Ric shell keeps the five intended tabs with Prep last', () => {
  const shell = fs.readFileSync(path.join(__dirname,'../shared/app-shell.html'),'utf8');
  const labels = [...shell.matchAll(/<button class="nav-btn ric-nav-btn[^>]*>.*?<\/button>/g)]
    .map(match=>match[0].replace(/<[^>]+>/g,'').trim());
  assert.deepEqual(labels,['Overview','Crew Stop','Pace Dad','Notes','Prep']);
});

test('Ric notes provide all three required filters', () => {
  const shell = fs.readFileSync(path.join(__dirname,'../shared/app-shell.html'),'utf8');
  assert.match(shell,/data-ric-note-filter="flagged"/);
  assert.match(shell,/data-ric-note-filter="for-ric"/);
  assert.match(shell,/data-ric-note-filter="all"/);
});

test('general note actions are limited to the author or a manager', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  assert.match(app,/isManager\(\) \|\| n\.author===ME\.name/);
  assert.match(app,/Only the author or a manager can delete this note/);
});

test('Crew Stop questions stay answerable before Dad arrives', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  assert.match(app,/questions\.map\(q=>buildQuestionAnswerHTML\(nextUp/);
  assert.doesNotMatch(app,/arrived\s*\?\s*questions\.map\(q=>buildQuestionAnswerHTML\(nextUp/);
});

test('Crew Stop shows the logged departure time instead of Just left', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  assert.match(app,/Left at \$\{fmtLoggedClock\(nextUp\.departed_elapsed_seconds,nextUp\.departed_logged_at\)\}/);
});

test('offline row operations remain visible in the order they were saved', () => {
  const rows=[{id:'a',value:1,arrived_at:null},{id:'b',value:2}];
  const operations=[
    {kind:'updateIfNull',table:'splits',rowId:'a',guardCol:'arrived_at',patch:{arrived_at:'now'}},
    {kind:'update',table:'splits',rowId:'a',patch:{value:3}},
    {kind:'insert',table:'splits',row:{id:'c',value:4}},
    {kind:'delete',table:'splits',rowId:'b'},
  ];
  assert.deepEqual(logic.applyOfflineQueueToRows(rows,operations,'splits'),[
    {id:'a',value:3,arrived_at:'now'},
    {id:'c',value:4},
  ]);
});

test('offline config uses the newest queued value', () => {
  const operations=[
    {kind:'config',key:'tracking_url',value:'old'},
    {kind:'config',key:'tracking_url',value:'new'},
  ];
  assert.deepEqual(logic.applyOfflineQueueToConfig({race_name:'Yeti'},operations),{
    race_name:'Yeti',tracking_url:'new',
  });
});

test('Ric usability upgrades include offline queueing, tappable note links, and a prominent arrival deadline', () => {
  const app = ['data.js','app.js'].map(f=>fs.readFileSync(path.join(__dirname,'../shared',f),'utf8')).join('\n');
  assert.match(app,/hermesco_offline_write_queue_v1/);
  assert.match(app,/flushOfflineQueue/);
  assert.match(app,/linkifyNoteText\(decoded\.body\)/);
  assert.match(app,/class="ric-be-there"/);
});

test('tab changes start at the top and arrival reveals the running countdown', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  assert.match(app,/window\.scrollTo\(\{top:0,left:0,behavior:'auto'\}\)/);
  assert.match(app,/function revealStopCountdown\(id\)/);
  assert.match(app,/timer\.scrollIntoView\(\{behavior:'smooth',block:'center'\}\)/);
  assert.match(app,/logArrivalNowAndRefresh\(id\).*revealStopCountdown\(id\)/s);
});

test('rehearsal start uses its own race clock without changing the official schedule', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  assert.match(app,/function simulationStartDateTime\(\)/);
  assert.match(app,/function raceSessionStartDateTime\(\)/);
  assert.match(app,/CONFIG\.simulation_started_at/);
  assert.match(app,/sanitizeRaceRows\(rawSplits,raceSessionStartDateTime\(\)\.getTime\(\)\)/);
  assert.match(app,/Rehearsal running · saves working/);
});

test('Ric notes keep shared-stop entries, flags, filters, links, and author permissions', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  assert.match(app,/splits\.filter\(s=>RIC_LOGIC\.isAssignedToStop\(s,ME\.id\)\)/);
  assert.match(app,/entries\.find\(e=>e\.flagged && e\.forRic\)/);
  assert.match(app,/RIC_NOTES_FILTER==='flagged'/);
  assert.match(app,/RIC_NOTES_FILTER==='for-ric'/);
  assert.match(app,/linkifyNoteText\(decoded\.body\)/);
  assert.match(app,/isManager\(\) \|\| note\.author===ME\.name/);
});

test('Sydney overview is compact and Enter saves a shared station note', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  const css = fs.readFileSync(path.join(__dirname,'../shared/styles.css'),'utf8');
  assert.match(app,/isSydney \? \(lastStopNumber \? `Stop \$\{lastStopNumber\}` : 'Start'\)/);
  assert.match(app,/isSydney\?'':`<div><span>Miles to next stop/);
  assert.match(app,/function saveStationNoteOnEnter\(event,id,input\)/);
  assert.match(app,/Saved to everyone's Notes/);
  assert.match(css,/\.ric-race-status\.sydney-status\{grid-template-columns:1fr 1fr\}/);
});

test('Sydney Meet Here is map-only and her personal notes are flagged handoffs for her stops', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  assert.match(app,/\$\{isSydney\?'':`<textarea class="split-note-input meet-instructions"/);
  assert.match(app,/isSydney\s*\? RIC_LOGIC\.flaggedNoteTargetsPerson\(splits,s,ME\.id\)/);
  assert.match(app,/forRic:isSydney\?false:/);
});

test('Sydney Prep is a read-only four-section crew briefing in the requested order', () => {
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  const start=app.indexOf('if(isSydney){',app.indexOf('async function renderRicBeforeRace'));
  const end=app.indexOf('\n    return;\n  }',start);
  const branch=app.slice(start,end);
  const sections=[...branch.matchAll(/data-sydney-prep="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(sections,['hotel','timeline','videos','essentials']);
  assert.doesNotMatch(branch,/submitPrepNeed|saveSharedPlanText|Pacing meeting|Random Needs|General Info|<input/);
  assert.match(branch,/Race-Day Essentials/);
  assert.match(branch,/Open tracker/);
});

test('shared messages preserve flag state without a database schema change', () => {
  const plain=logic.decodeSharedMessage(logic.encodeSharedMessage('Bring dry socks',false));
  assert.deepEqual(plain,{body:'Bring dry socks',flagged:false});
  const flagged=logic.decodeSharedMessage(logic.encodeSharedMessage('Meet on trail side',true));
  assert.deepEqual(flagged,{body:'Meet on trail side',flagged:true});
  assert.equal(logic.encodeSharedMessage(flagged.body,false),'Meet on trail side');
});

test('Notes is a sender-labelled message feed with yellow flags and red admin messages', () => {
  const shell = fs.readFileSync(path.join(__dirname,'../shared/app-shell.html'),'utf8');
  const app = fs.readFileSync(path.join(__dirname,'../shared/app.js'),'utf8');
  const css = fs.readFileSync(path.join(__dirname,'../shared/styles.css'),'utf8');
  assert.ok(shell.indexOf('notes-general-wrap') < shell.indexOf('notes-course-title'),'shared messages come before race updates');
  assert.match(shell,/id="note-flag-input"/);
  assert.match(shell,/onkeydown="submitNoteOnEnter\(event\)"/);
  assert.match(app,/message-author">From \$\{esc\(n\.author\)\}/);
  assert.match(app,/noteAuthorIsAdmin\(n\.author\)/);
  assert.match(app,/decodeSharedMessage\(n\.body\)/);
  assert.match(css,/\.crew-message\.flagged\{background:#FFF1A8/);
  assert.match(css,/\.crew-message\.admin\{background:#FFE2E2/);
  assert.match(css,/\.clog-item\.flagged\{background:#FFF1A8/);
  assert.match(css,/\.clog-item\.admin\{background:#FFE2E2/);
});
