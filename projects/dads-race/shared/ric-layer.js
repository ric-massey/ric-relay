/* Ric's layer — runs on top of Victoria's app, for Ric and Sydney when their "Ric's
 * race-day version" switch is on.
 *
 * Victoria's app (shared/original/, imported unchanged from her index.html) loads first
 * and is the whole app; shared/notes-layer.js (Ric's Notes, for everyone) loads on it next.
 * This file then adds Ric's race-day screens and replaces a handful of her functions with
 * Ric's versions. shared/bootstrap.js loads them in that order and holds her start-up until
 * they have run.
 *
 * The deal, so her changes keep reaching Ric without anyone asking:
 *  - Anything she ADDS — a new page, a new nav button, a new function — comes through
 *    untouched. Her nav buttons that Ric's bar doesn't carry are offered under "More".
 *  - Any of her functions NOT redefined here is hers, live, including her fixes.
 *  - A function redefined here is Ric's version and hides hers. Keep that list short: to
 *    reuse her behaviour, call HER.<name>() (her originals, captured before this file ran).
 *  - Top-level `let`/`const` in her file are shared globals; never redeclare one here.
 */
const HER = window.HERMISCUS_HER || {};

const PERSONAL_COLOR_KEY = 'hermesco_personal_colors_v1';

function personalColorMap(){
  try{ return JSON.parse(localStorage.getItem(PERSONAL_COLOR_KEY) || '{}'); }
  catch(e){ return {}; }
}

function getPersonalColorFor(profileId){ return personalColorMap()[profileId] || null; }

function activePersonColors(){
  const custom = ME ? getPersonalColorFor(ME.id) : null;
  return custom ? {primary:custom, secondary:null} : {primary:ME && ME.color, secondary:ME && ME.color2};
}

function updateHeaderAvatarColor(hex){
  const avatar = document.getElementById('me-avatar');
  if(!avatar || !hex) return;
  avatar.style.background = hex;
  avatar.style.color = contrastText(hex);
}

function applyActivePersonTheme(){
  if(!ME) return;
  const colors = activePersonColors();
  applyPersonTheme(colors.primary, colors.secondary);
  updateHeaderAvatarColor(colors.primary);
}

function renderPersonalColorControl(){
  if(!ME) return;
  const picker = document.getElementById('personal-color-picker');
  const value = document.getElementById('personal-color-value');
  const color = getPersonalColorFor(ME.id) || ME.color || '#5C6FE0';
  if(picker) picker.value = color;
  if(value) value.textContent = color;
}

function previewPersonalColor(hex){
  if(!ME || !/^#[0-9a-f]{6}$/i.test(hex)) return;
  applyPersonTheme(hex, null);
  updateHeaderAvatarColor(hex);
  const value = document.getElementById('personal-color-value');
  if(value) value.textContent = hex;
}

function savePersonalColor(hex){
  if(!ME || !/^#[0-9a-f]{6}$/i.test(hex)) return;
  const map = personalColorMap();
  map[ME.id] = hex.toUpperCase();
  localStorage.setItem(PERSONAL_COLOR_KEY, JSON.stringify(map));
  previewPersonalColor(hex);
  renderPersonalColorControl();
  toast('Your color is saved on this device');
}

function resetPersonalColor(){
  if(!ME) return;
  const map = personalColorMap();
  delete map[ME.id];
  localStorage.setItem(PERSONAL_COLOR_KEY, JSON.stringify(map));
  applyActivePersonTheme();
  renderPersonalColorControl();
  toast('Original color restored');
}

function setThemeMode(mode){
  THEME_MODE = mode;
  document.documentElement.setAttribute('data-theme', mode);
  if(ME){
    saveThemeModeFor(ME.id, mode);
    applyActivePersonTheme();
  }
  renderSettingsToggle();
  renderPersonalColorControl();
}

/* ================= APP SHELL ================= */
async function showApp(){
  document.getElementById('profile-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  THEME_MODE = getThemeModeFor(ME.id);
  document.documentElement.setAttribute('data-theme', THEME_MODE);
  applyActivePersonTheme();
  renderSettingsToggle();
  renderPersonalColorControl();
  document.getElementById('me-avatar').textContent = initials(ME.name);
  updateHeaderAvatarColor(activePersonColors().primary);
  document.getElementById('me-name').textContent = ME.name;
  configureProfileShell();
  // Show the app shell (nav, header) right away and load data separately — if the load fails
  // partway (dropped connection, most likely at the actual race with spotty service), the user
  // lands on a page with a clear retry, not a blank frozen screen with no explanation.
  goPage('home');
  if(USE_SUPABASE&&navigator.onLine&&getOfflineQueue().length) await flushOfflineQueue({quiet:true});
  await loadAppData();
  startLiveSync();
}

function configureProfileShell(){
  const mission = usesMissionShell();
  document.querySelectorAll('.standard-nav-btn').forEach(el=>el.classList.toggle('hidden',mission));
  document.querySelectorAll('.ric-nav-btn').forEach(el=>el.classList.toggle('hidden',!mission));
  document.querySelectorAll('.ric-settings-help').forEach(el=>el.classList.toggle('hidden',mission));
  const teamButton = document.getElementById('header-team-button');
  if(teamButton) teamButton.classList.toggle('hidden',mission);
  const resources = document.getElementById('notes-resources-wrap');
  const courseTitle = document.getElementById('notes-course-title');
  const courseHint = document.getElementById('notes-course-hint');
  const generalTitle = document.getElementById('notes-general-title');
  const generalWrap = document.getElementById('notes-general-wrap');
  if(resources) resources.classList.toggle('hidden',mission);
  if(courseHint) courseHint.classList.toggle('hidden',mission);
  if(courseTitle) courseTitle.textContent = mission ? 'Race Updates' : 'From The Course';
  if(generalTitle) generalTitle.textContent = mission ? 'Crew Messages' : 'Have To Remember / Notes';
  if(generalWrap) generalWrap.classList.remove('hidden');
  const noteInput = document.getElementById('note-input');
  if(noteInput) noteInput.placeholder = mission ? 'Message everyone…' : 'Add a note for the crew...';
  const noteTools = document.getElementById('ric-notes-tools');
  if(noteTools) noteTools.classList.toggle('hidden',!mission);
  const forMeFilter = document.querySelector('[data-ric-note-filter="for-ric"]');
  if(forMeFilter && ME) forMeFilter.textContent=`For ${ME.name}`;
  const connection = document.getElementById('ric-connection-status');
  if(connection) connection.classList.toggle('hidden',!mission);
  if(mission) updateRicConnectionStatus();
}

function updateRicConnectionStatus(forceOnline){
  const el = document.getElementById('ric-connection-status');
  if(!el) return;
  if(typeof forceOnline==='boolean') RIC_DB_CONNECTED=forceOnline;
  if(!navigator.onLine) RIC_DB_CONNECTED=false;
  const pending=getOfflineQueue().length;
  const checking=navigator.onLine && RIC_DB_CONNECTED==null;
  const online=navigator.onLine && RIC_DB_CONNECTED===true;
  const rehearsal=isRaceSimulationActive();
  el.classList.toggle('offline',!checking&&!online);
  el.classList.toggle('checking',checking);
  el.classList.toggle('queued',pending>0);
  el.innerHTML = pending
    ? `<i class="ti ti-device-mobile-check"></i> ${pending} saved on phone · ${_flushingOfflineQueue?'syncing':'waiting to sync'}`
    : checking
      ? '<i class="ti ti-loader-2"></i> Checking connection'
      : `<i class="ti ti-${rehearsal?'player-play-filled':online?'database-check':'wifi-off'}"></i> ${rehearsal?(online?'Rehearsal running · saves working':'Rehearsal running · saves will queue'):online?'Connected · saves working':'Offline · saves will queue'}`;
}

async function saveSharedPlanText(key,value){
  await dbSetConfig(key,value.trim());
  CONFIG[key]=value.trim();
  toast('Saved');
}

async function saveNightGearCheck(key,checked){
  const value = checked ? 'true' : 'false';
  await dbSetConfig(key,value);
  CONFIG[key]=value;
  toast(checked ? 'Headlamp checked' : 'Headlamp unchecked');
}

function showRicRenderError(pageId,error){
  console.error('Unable to render page',pageId,error);
  if(!usesMissionShell()) return;
  const targetId = {
    'page-home':'ric-overview',
    'page-ric-stop':'ric-crew-mission',
    'page-ric-pace':'ric-pacer-mission',
    'page-ric-before':'ric-before-body',
  }[pageId];
  const target = targetId && document.getElementById(targetId);
  if(target) target.innerHTML = `<div class="mission-card"><div class="mission-empty">This screen could not load.<br><button type="button" class="btn sm" style="margin-top:10px" onclick="loadAppData()"><i class="ti ti-refresh"></i> Try again</button></div></div>`;
}

// Her loader draws every one of her pages (whatever she has added since); then Ric's Prep.
async function loadAppData(){
  await HER.loadAppData();
  try{ await renderRicBeforeRace(); }catch(e){ showRicRenderError('page-ric-before',e); }
}

// Abingdon, VA on race weekend: sunset is about 7:00 PM Friday and sunrise is
// about 7:30 AM Saturday. Keep these configurable so the rule can be updated for
// a different race date without changing the screen code.
function isDarkAtElapsed(elapsedSec){
  return RIC_LOGIC.isDarkAtElapsed(
    raceStartDateTime().getTime(), elapsedSec,
    CONFIG.race_sunset_time||'19:00', CONFIG.race_sunrise_time||'07:30'
  );
}

function isDarkDuringLeg(startElapsed,endElapsed){
  return RIC_LOGIC.isDarkDuringLeg(
    raceStartDateTime().getTime(), startElapsed, endElapsed,
    CONFIG.race_sunset_time||'19:00', CONFIG.race_sunrise_time||'07:30'
  );
}

function headlampPeople(kind,startElapsed,endElapsed){
  return RIC_LOGIC.headlampPeople(
    kind, raceStartDateTime().getTime(), startElapsed, endElapsed,
    CONFIG.race_sunset_time||'19:00', CONFIG.race_sunrise_time||'07:30', ME&&ME.name||'Pacer'
  );
}

function nightGearHTML(key,people){
  return `<div class="night-gear-alert">
    <div class="night-gear-title"><i class="ti ti-moon-stars"></i><span><b>After dark</b><small>Headlamps required</small></span></div>
    <div class="night-gear-checks">${people.map(person=>{
      const owner = String(ME&&ME.name||'crew').toLowerCase().replace(/[^a-z0-9]+/g,'-');
      const checkKey = `mission_headlamp_${owner}_${key}_${person.toLowerCase()}`;
      return `<label><input type="checkbox" ${CONFIG[checkKey]==='true'?'checked':''} onchange="saveNightGearCheck('${checkKey}',this.checked)"> <span>${esc(person)} headlamp</span></label>`;
    }).join('')}</div>
  </div>`;
}

// "Arrived"/"Left" times are meant to show the real moment someone tapped the button. Deriving
// that from race-relative elapsed seconds only works once the race has actually started —
// before then, elapsed clamps to 0 (can't be negative) and every tap displays as "Fri 7:00 AM,"
// the race's official start, no matter what the real clock said. Whenever a genuine wall-clock
// timestamp was captured at tap time (loggedAtIso), show that instead — it's always correct,
// pre-race testing included. Manual H:MM backfills have no real tap moment, so they fall back
// to the race-relative calc, which is what you want once the race is actually underway.
function fmtLoggedClock(elapsedSec, loggedAtIso){
  if(isRaceSimulationActive()) return fmtClock(elapsedSec);
  if(loggedAtIso){
    const dt = new Date(loggedAtIso);
    const day = dt.toLocaleDateString('en-US',{weekday:'short'});
    const time = dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    return `${day} ${time}`;
  }
  return fmtClock(elapsedSec);
}

// Ric's three screens are drawn here; every other page — including any page Victoria adds
// later — goes to her own goPage, so it opens and draws exactly as it does in her app.
function goPage(name){
  const mine = { 'ric-stop': renderRicHomeDashboard, 'ric-pace': renderRicHomeDashboard,
                 'ric-before': renderRicBeforeRace }[name];
  if(!mine){
    HER.goPage(name);
    // Bottom tabs are separate screens: always enter one at its top.
    window.scrollTo({top:0,left:0,behavior:'auto'});
    return;
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===name));
  window.scrollTo({top:0,left:0,behavior:'auto'});
  if(!ME) return;
  Promise.resolve().then(mine).catch(e=>showRicRenderError(`page-${name}`,e));
}

/* ================= RUNNING TOTAL (shared: Home + Splits) ================= */
async function renderRunningTotal(elId){
  const el = document.getElementById(elId);
  if(!el) return;
  const rows = await dbList('splits', 'sort_order.asc');
  const sorted = [...rows].sort((a,b)=>(a.mile||0)-(b.mile||0));
  const startRow = sorted[0];
  const finishRow = sorted.length ? sorted[sorted.length-1] : null;
  let lastActual = null;
  rows.forEach(r=>{ if(r.actual_elapsed_seconds!=null && !r.skipped) lastActual = r; });
  const goalTotal = CONFIG.goal_finish_hours ? parseFloat(CONFIG.goal_finish_hours)*3600 : (finishRow ? finishRow.elapsed_seconds : 64800);

  // When the run actually began, in real wall-clock: the start line's logged tap moment, or —
  // if the start was never logged — the official gun time once the race clock has started.
  let startedMs = null;
  const startWall = startRow && (startRow.departed_logged_at || startRow.actual_logged_at);
  if(startWall) startedMs = new Date(startWall).getTime();
  else if(raceIsLive()) startedMs = raceSessionStartDateTime().getTime();

  const finished = !!(finishRow && finishRow.actual_elapsed_seconds!=null && !finishRow.skipped);
  const live = startedMs!=null && !finished;
  const fmt = s => { const t = Math.max(0, Math.round(s/60)); return `${Math.floor(t/60)}h ${String(t%60).padStart(2,'0')}m`; };

  let seconds, sub;
  if(finished){
    seconds = finishRow.actual_elapsed_seconds || (startedMs && finishRow.actual_logged_at ? (new Date(finishRow.actual_logged_at).getTime()-startedMs)/1000 : goalTotal);
    sub = `Finished ${fmtLoggedClock(finishRow.actual_elapsed_seconds, finishRow.actual_logged_at)}`;
  } else if(live){
    seconds = (Date.now()-startedMs)/1000;
    sub = lastActual ? `Last check-in: ${lastActual.station}, ${fmtLoggedClock(lastActual.actual_elapsed_seconds, lastActual.actual_logged_at)}` : 'Running — no check-ins logged yet';
  } else {
    seconds = goalTotal;
    sub = "Race hasn't started yet — showing goal time";
  }
  el.innerHTML = `
    <div class="runtime-lbl">Time On Course — ${finished ? 'Final' : live ? 'Live' : 'Goal Pace'}</div>
    <div class="runtime-val"${live ? ` data-course-since-ms="${Math.round(startedMs)}"` : ''}>${fmt(seconds)}</div>
    <div class="runtime-sub ${live||finished?'live':''}">${esc(sub)}</div>
  `;
}

function missionBringListHTML(stop){
  const items = stop && Array.isArray(stop.bring_items) ? stop.bring_items : [];
  if(!items.length) return '<div class="sd-empty">Nothing has been listed for this stop yet.</div>';
  return `<div class="mission-checklist">${items.map(it=>`
    <button type="button" class="mission-check ${it.checked?'done':''}" onclick="toggleBringItemAndRefresh('${stop.id}','${it.id}',${!it.checked})">
      <span class="box">${it.checked?'<i class="ti ti-check"></i>':''}</span>
      <span>${esc(it.label)}${it.checked && it.checked_by ? ` <small>— ${esc(it.checked_by)}</small>` : ''}</span>
    </button>`).join('')}</div>`;
}

function ricPaceLegData(engine, fromStop){
  const rows = engine.rows;
  const i = rows.findIndex(r=>r.id===fromStop.id);
  const to = i>=0 ? rows.slice(i+1).find(r=>!r.skipped) : null;
  if(!to || !to.goal_pace_sec_per_mi) return null;
  const plan = to.goal_pace_sec_per_mi;
  const raceIsLive = window.raceIsLive();
  const adjustment = RIC_LOGIC.paceTarget(plan,{
    raceIsLive,
    goalReachable:engine.goalReachable,
    catchUpRatio:engine.catchUpRatio,
    cutoffReachable:engine.cutoffReachable,
    cutoffRatio:engine.cutoffRatio,
  });
  const {ratio,target} = adjustment;
  return {
    from:fromStop, to, plan, target, ratio,
    miles:+(to.mile-fromStop.mile).toFixed(1),
    terrain:legTerrain(rows, fromStop.mile, to.mile),
    eta:raceIsLive ? to.projected_elapsed : to.goal_elapsed_sec
  };
}

function ricPaceDirectiveHTML(engine, fromStop){
  const leg = ricPaceLegData(engine, fromStop);
  if(!leg) return '<div class="sd-empty">No next leg.</div>';
  const liveFromCheckIn = raceIsLive() && !!engine.anchor;
  const delta = Math.round(Math.abs(leg.target-leg.plan));
  let cls='', icon='navigation', command='HOLD';
  if(leg.ratio < .995){
    cls='speed-up'; icon='arrow-up-right'; command=`FASTER · ${delta}s/mi`;
  } else if(leg.ratio > 1.005){
    cls='slow-down'; icon='arrow-down-right'; command=`SLOWER · ${delta}s/mi`;
  }
  return `<div class="pace-directive ${cls}">
    <i class="ti ti-${icon}"></i>
    <strong>${fmtPace(leg.target)}</strong>
    <span class="pace-command">${liveFromCheckIn?'LIVE · ':''}${command}</span>
    <small>${esc(fromStop.station)} → ${esc(leg.to.station)} · ${leg.miles} mi${liveFromCheckIn?` · from mi ${engine.anchor.mile} check-in`:''}</small>
    <small>${CONFIG.goal_finish_hours||18}hr pace: ${fmtPace(leg.plan)}</small>
  </div>`;
}

function isRicPacingStop(stop){
  const name=String(ME&&ME.name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(!name) return false;
  return new RegExp(`\\b${name}\\b.*\\bpac|\\bpac.*\\b${name}\\b`,'i').test(String(stop.official_note||''));
}

function ricPacingAssignments(engine){
  const rows = engine.rows;
  const groups = [];
  for(let i=0;i<rows.length;i++){
    if(!isRicPacingStop(rows[i]) || (i>0 && isRicPacingStop(rows[i-1]))) continue;
    let lastPacing = i;
    while(lastPacing+1<rows.length && isRicPacingStop(rows[lastPacing+1])) lastPacing++;
    const end = rows[Math.min(lastPacing+1, rows.length-1)];
    if(!end || end.id===rows[i].id) continue;
    groups.push({start:rows[i], end, startIndex:i, endIndex:lastPacing+1});
    i = lastPacing;
  }
  return groups;
}

function ricDirectCrewStops(splits){
  if(!ME) return [];
  return splits.filter(stop=>Number(stop.mile)>0 && RIC_LOGIC.isAssignedToStop(stop,ME.id) && !isRicPacingStop(stop));
}

let ricSelectedPaceStartId = null;

let RIC_OVERVIEW_SCOPE = 'mine';

function openRicPaceAssignment(startId){
  ricSelectedPaceStartId = startId || null;
  goPage('ric-pace');
}

function setRicOverviewScope(scope){
  RIC_OVERVIEW_SCOPE = scope==='all' ? 'all' : 'mine';
  renderRicHomeDashboard().catch(e=>showRicRenderError('page-home',e));
}

function ricStopPeopleHTML(stop){
  const people = RIC_LOGIC.stopPeople(stop,PROFILES);
  return `<small class="ric-timeline-people">
    <span><i class="ti ti-users"></i> Assigned: ${people.assignedNames.length?esc(people.assignedNames.join(', ')):'—'}</span>
    <span><i class="ti ti-run"></i> Pacing: ${people.pacerNames.length?esc(people.pacerNames.join(', ')):'—'}</span>
  </small>`;
}

function ricPacerMissionHTML(engine){
  const groups = ricPacingAssignments(engine);
  if(!groups.length){
    return `<div class="mission-card pacer-mission">
      <div class="mission-head"><div class="mission-job"><i class="ti ti-run"></i> Pace Dad</div></div>
      <div class="mission-empty">No pacing leg yet.</div>
    </div>`;
  }
  const raceIsLive = window.raceIsLive();
  const anchorMile = raceIsLive && engine.anchor ? engine.anchor.mile : -1;
  const selected = ricSelectedPaceStartId ? groups.find(g=>g.start.id===ricSelectedPaceStartId) : null;
  const group = selected || groups.find(g=>g.end.mile>anchorMile+0.001) || groups[groups.length-1];
  const groupStartElapsed = raceIsLive ? group.start.projected_elapsed : group.start.goal_elapsed_sec;
  const groupEndElapsed = raceIsLive ? group.end.projected_elapsed : group.end.goal_elapsed_sec;
  const requiredHeadlamps = headlampPeople('pace',groupStartElapsed,groupEndElapsed);
  const needsHeadlamps = requiredHeadlamps.length>0;
  const courseStopNo = RIC_LOGIC.courseStopNumber(engine.rows,group.start.id);
  const groupState = RIC_LOGIC.pacingState(anchorMile,group.start.mile,group.end.mile);
  const {active,done} = groupState;
  // Ignore old walkthrough taps before race morning. They remain in the audit data, but Ric's
  // real race screen must begin with a clean Arrived button instead of looking completed.
  const displayStart = raceIsLive ? group.start : {
    ...group.start,
    actual_elapsed_seconds:null, actual_logged_at:null, actual_logged_by:null,
    departed_elapsed_seconds:null, departed_logged_at:null, departed_logged_by:null,
    skipped:false,
  };
  const waitingAtStart = displayStart.actual_elapsed_seconds!=null && !displayStart.skipped && displayStart.departed_elapsed_seconds==null;
  const activelyPacing = active && !waitingAtStart;
  const legRows = engine.rows.slice(group.startIndex+1, group.endIndex+1);
  const legs = legRows.map((to,idx)=>{
    const from = engine.rows[group.startIndex+idx];
    const miles = +(to.mile-from.mile).toFixed(1);
    const liveLeg = ricPaceLegData(engine,from);
    const pace = liveLeg && liveLeg.to.id===to.id ? liveLeg.target : to.goal_pace_sec_per_mi;
    return `<div class="pacer-leg">
      <div class="pacer-leg-route">${esc(from.station)} → ${esc(to.station)}</div>
      <div class="pacer-leg-pace">${fmtPace(pace)}</div>
      <div class="pacer-leg-meta">${miles} mi · ${legTerrain(engine.rows, from.mile, to.mile)} · ETA ${fmtClock(raceIsLive?to.projected_elapsed:to.goal_elapsed_sec)}</div>
    </div>`;
  }).join('');
  const currentTo = engine.rows.slice(group.startIndex+1,group.endIndex+1).find(r=>r.mile>anchorMile+0.001) || group.end;
  const currentFrom = engine.rows[Math.max(group.startIndex, engine.rows.findIndex(r=>r.id===currentTo.id)-1)];
  const totalMiles = +(group.end.mile-group.start.mile).toFixed(1);
  const note = engine.rows.slice(group.startIndex,group.endIndex).map(r=>r.official_note).filter(Boolean).join(' · ');
  const parenthetical = note.match(/\(([^)]+)\)/);
  const shortNote = parenthetical ? parenthetical[1] : note.replace(/\bRIC\b\s*(?:CONT\.?\s*)?PACING\b/ig,'').replace(/^[\s·–—-]+|[\s·–—-]+$/g,'').trim();
  const startTime = fmtClock(raceIsLive?group.start.projected_elapsed:group.start.goal_elapsed_sec);
  const firstPaceLeg = ricPaceLegData(engine,group.start);
  const shownPace = firstPaceLeg ? firstPaceLeg.target : currentTo.goal_pace_sec_per_mi;
  const previousStop = group.startIndex>0 ? engine.rows[group.startIndex-1] : null;
  const carryHTML = previousStop && previousStop.flag_forward && previousStop.station_note
    ? `<div class="urgent-carry"><i class="ti ti-flag-3-filled"></i><div><b>From ${esc(previousStop.station)}</b><span>${esc(previousStop.station_note)}</span></div></div>` : '';
  if(activelyPacing){
    const liveLeg = ricPaceLegData(engine,currentFrom);
    const milesRemaining = RIC_LOGIC.activeMilesRemaining(anchorMile,currentFrom.mile,currentTo.mile);
    return `<div class="mission-card pacer-mission active-pacing">
      <div class="mission-head">
        <div class="mission-job"><i class="ti ti-run"></i> Pacing Now</div>
        <div class="mission-place">${esc(currentTo.station)}</div>
      </div>
      ${carryHTML?`<div style="padding:12px 12px 0">${carryHTML}</div>`:''}
      ${needsHeadlamps?`<div style="padding:12px 12px 0">${nightGearHTML(group.start.id,requiredHeadlamps)}</div>`:''}
      <div class="active-pace-grid">
        <div><span>Miles left</span><b>${milesRemaining}</b></div>
        <div><span>Live pace</span><b>${fmtPace(liveLeg?liveLeg.target:currentTo.goal_pace_sec_per_mi).replace('/mi','')}</b></div>
        <div><span>Destination</span><b>${esc(currentTo.station)}</b></div>
        <div><span>ETA</span><b>${fmtClock(currentTo.projected_elapsed)}</b></div>
      </div>
    </div>`;
  }
  const personKey = String(ME.name||'pacer').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const pickupKey = `${personKey}_pace_pickup_${group.start.id}`;
  const startMeet = CONFIG[`ric_meet_${group.start.id}`] || '';
  const exitMeet = CONFIG[`ric_meet_${group.end.id}`] || '';
  return `<div class="mission-card pacer-mission">
    <div class="mission-head">
      <div class="mission-job"><i class="ti ti-run"></i> Pace Dad</div>
      <div class="mission-place-row">
        <div class="mission-place">Stop ${courseStopNo||'—'} · Mi ${group.start.mile} → ${group.end.mile}</div>
        <div class="mission-eta">${startTime}</div>
      </div>
      <div class="mission-route">${esc(group.start.station)} → ${esc(group.end.station)}</div>
      <div class="mission-stage ${activelyPacing||waitingAtStart?'live':''}"><i class="ti ti-${done?'circle-check':activelyPacing?'activity-heartbeat':waitingAtStart?'hourglass':'clock'}"></i> ${done?'Done':activelyPacing?'Pacing now':waitingAtStart?'Dad here':'Upcoming'}</div>
    </div>
    <div class="mission-body">
      ${shortNote ? `<div class="rd-banner official" style="margin-bottom:12px"><i class="ti ti-backpack"></i> ${esc(shortNote)}</div>` : ''}
      ${carryHTML}
      <div class="mission-section mission-main-action">
        <div class="mission-section-title"><i class="ti ti-stopwatch"></i> Arrival & departure</div>
        <div class="planned-stop-time"><b>${Math.round(RIC_LOGIC.stopRestSeconds(group.start.mile)/60)} min stop</b><span>Countdown starts when Dad arrives</span></div>
        ${buildLoggingControlsHTML(displayStart,stopKind(group.start,engine.rows))}
      </div>
      <div class="pacer-summary">
        <div class="pacer-stat"><b>${totalMiles}</b><span>Miles</span></div>
        <div class="pacer-stat"><b>${fmtPace(shownPace).replace('/mi','')}</b><span>${raceIsLive&&engine.anchor?'Live pace':'Pace'}</span></div>
        <div class="pacer-stat"><b>${startTime}</b><span>Start</span></div>
      </div>
      <div class="mission-section">
        <div class="mission-section-title"><i class="ti ti-route"></i> Pacing logistics</div>
        <div class="pace-logistics">
          <div><span>Start</span><b>Mi ${group.start.mile} · ${esc(group.start.station)}</b>${group.start.address?addressBlock(group.start.address):''}<input type="text" class="split-note-input" placeholder="Start meeting details…" value="${esc(startMeet)}" onblur="saveSharedPlanText('ric_meet_${group.start.id}',this.value)"></div>
          <div><span>Exit</span><b>Mi ${group.end.mile} · ${esc(group.end.station)}</b>${group.end.address?addressBlock(group.end.address):''}<input type="text" class="split-note-input" placeholder="Exit meeting details…" value="${esc(exitMeet)}" onblur="saveSharedPlanText('ric_meet_${group.end.id}',this.value)"></div>
        </div>
        <input type="text" class="split-note-input" style="font-style:normal;color:var(--ink);width:100%;margin-top:9px" placeholder="Who retrieves ${esc(ME.name)} / pickup plan…" value="${esc(CONFIG[pickupKey]||'')}" onblur="saveSharedPlanText('${pickupKey}',this.value)">
      </div>
      <div class="mission-section">
        <div class="mission-section-title"><i class="ti ti-backpack"></i> Run gear for ${esc(ME.name)}</div>
        ${needsHeadlamps?nightGearHTML(group.start.id,requiredHeadlamps):''}
        ${missionBringListHTML(group.start)}
      </div>
      ${legRows.length>1 ? `<div class="mission-section">
        <div class="mission-section-title"><i class="ti ti-map-route"></i> Legs</div>
        ${legs}
      </div>` : ''}
    </div>
  </div>`;
}

function ricOverviewHTML(engine, nextUp, mine){
  const raceIsLive = window.raceIsLive();
  const isSydney = String(ME&&ME.name||'').toLowerCase()==='sydney';
  const activeStop = !!(nextUp && nextUp.actual_elapsed_seconds!=null && !nextUp.skipped && nextUp.departed_elapsed_seconds==null);
  const groups = ricPacingAssignments(engine);
  const activePaceGroup = raceIsLive ? groups.find(group=>group.start.actual_elapsed_seconds!=null && !group.start.skipped && group.start.departed_elapsed_seconds==null) : null;
  const timerStop = activeStop ? nextUp : (activePaceGroup ? activePaceGroup.start : null);
  const anchorMile = raceIsLive && engine.anchor ? Number(engine.anchor.mile) : -1;
  const nextDuty = RIC_LOGIC.selectNextDuty(nextUp,groups,anchorMile);
  const dutyStop = nextDuty ? nextDuty.stop : null;
  const actualRows = engine.rows.filter(r=>r.actual_elapsed_seconds!=null && !r.skipped);
  const useLiveData = raceIsLive || !!(nextDuty&&nextDuty.here);
  const lastStop = useLiveData ? actualRows[actualRows.length-1] : null;
  const nextProjection = dutyStop ? engine.rows.find(r=>r.id===dutyStop.id) : null;
  const nextStopStats = RIC_LOGIC.overviewNextStop(dutyStop,lastStop,nextProjection,useLiveData,!!(nextDuty&&nextDuty.here));
  const milesAway = nextStopStats.milesAway;
  const eta = !dutyStop ? '—' : nextStopStats.here ? 'Here now' : fmtClock(nextStopStats.etaElapsed);
  const lastStopNumber = lastStop ? RIC_LOGIC.courseStopNumber(engine.rows,lastStop.id) : null;
  const lastStopText = lastStop
    ? (isSydney ? (lastStopNumber ? `Stop ${lastStopNumber}` : 'Start') : `Mi ${lastStop.mile} · ${esc(lastStop.station)}`)
    : 'Not started';
  let nextJobHTML = '';
  if(nextDuty){
    const group = nextDuty.group;
    const jobStop = nextDuty.kind==='pace-active' && group ? group.start : dutyStop;
    const stopNo = RIC_LOGIC.courseStopNumber(engine.rows,jobStop.id);
    const jobLabel = nextDuty.kind==='crew' ? 'Crew Stop' : nextDuty.kind==='pace-active' ? 'Pacing Now' : 'Pace Dad';
    const place = nextDuty.kind==='pace-active' && group
      ? `To mi ${group.end.mile} · ${group.end.station}`
      : `Stop ${stopNo||'—'} · Mi ${dutyStop.mile} · ${dutyStop.station}`;
    const action = nextDuty.kind==='crew' ? "goPage('ric-stop')" : `openRicPaceAssignment('${group.start.id}')`;
    const stopSeconds = nextDuty.kind==='pace-active' ? null : RIC_LOGIC.stopRestSeconds(jobStop.mile);
    const arrivalBuffer=Math.max(0,Number(CONFIG.ric_arrival_buffer_minutes||15));
    const beThereBy=!nextDuty.here && nextStopStats.etaElapsed!=null && nextDuty.kind!=='pace-active'
      ? fmtClock(Math.max(0,nextStopStats.etaElapsed-arrivalBuffer*60)) : '';
    nextJobHTML = `<button type="button" class="ric-next-job" onclick="${action}">
      <span><i class="ti ti-${nextDuty.kind==='crew'?'map-pin-check':'run'}"></i> Next job</span>
      <strong>${esc(jobLabel)}</strong>
      ${beThereBy?`<div class="ric-be-there"><span>Be there by</span><b>${beThereBy}</b></div>`:''}
      <small>${esc(place)}${stopSeconds?` · ${Math.round(stopSeconds/60)} min stop`:''}</small>
      <i class="ti ti-chevron-right"></i>
    </button>`;
  }
  let timerHTML = '';
  if(timerStop){
    const timerAction = activePaceGroup && timerStop.id===activePaceGroup.start.id
      ? `openRicPaceAssignment('${activePaceGroup.start.id}')`
      : `goPage('ric-stop')`;
    timerHTML = `<button type="button" class="ric-live-timer" onclick="${timerAction}">
      <span><i class="ti ti-stopwatch"></i> Stop countdown</span>
      ${restCountdownHTML(timerStop,'compact')}
      <i class="ti ti-chevron-right"></i>
    </button>`;
  }

  const timeline = [];
  [...mine].sort((a,b)=>(a.sort_order??a.mile)-(b.sort_order??b.mile)).forEach(stop=>{
    const proj = engine.rows.find(r=>r.id===stop.id);
    const done = stop.skipped || stop.departed_elapsed_seconds!=null;
    const active = stop.actual_elapsed_seconds!=null && !done;
    const status = stop.skipped ? 'RAN THROUGH' : done ? 'LEFT' : active ? 'DAD HERE' : 'UPCOMING';
    const time = stop.skipped ? 'No stop' : done
      ? fmtLoggedClock(stop.departed_elapsed_seconds,stop.departed_logged_at)
      : active ? fmtLoggedClock(stop.actual_elapsed_seconds,stop.actual_logged_at)
      : fmtClock(raceIsLive && proj ? proj.projected_elapsed : (proj ? proj.goal_elapsed_sec : stop.elapsed_seconds));
    const stopElapsed = raceIsLive && proj ? proj.projected_elapsed : (proj ? proj.goal_elapsed_sec : stop.elapsed_seconds);
    const dark = isDarkAtElapsed(stopElapsed);
    timeline.push({stopId:stop.id,mile:stop.mile,order:stop.sort_order||0,stopNumber:RIC_LOGIC.courseStopNumber(engine.rows,stop.id),html:`
      <button type="button" class="ric-timeline-item crew ${done?'done':''} ${active?'live':''}" onclick="openStopDetail('${stop.id}')">
        <span class="ric-timeline-mile">${stop.mile}<small>MI</small></span>
        <span class="ric-timeline-copy">
          <span class="ric-timeline-kind"><i class="ti ti-map-pin"></i> Stop __STOP_NUMBER__ · Crew Stop</span>
          <strong>${esc(stop.station)}</strong>
          <small>${time}</small>
          __ASSIGNMENTS__
        </span>
        <span class="ric-timeline-side">${dark?'<i class="ti ti-moon-stars" title="Headlamp"></i>':''}${stop.station_note?'<i class="ti ti-note"></i>':''}<b>${status}</b><i class="ti ti-chevron-right"></i></span>
      </button>`});
  });
  groups.forEach((group,index)=>{
    const active = anchorMile>=group.start.mile-0.001 && anchorMile<group.end.mile-0.001;
    const done = anchorMile>=group.end.mile-0.001;
    const firstLeg = engine.rows[group.startIndex+1];
    const meta = `${+(group.end.mile-group.start.mile).toFixed(1)} mi · ${fmtPace(firstLeg&&firstLeg.goal_pace_sec_per_mi)}`;
    const startElapsed = raceIsLive ? group.start.projected_elapsed : group.start.goal_elapsed_sec;
    const endElapsed = raceIsLive ? group.end.projected_elapsed : group.end.goal_elapsed_sec;
    const dark = isDarkAtElapsed(startElapsed);
    timeline.push({stopId:group.start.id,mile:group.start.mile,order:group.start.sort_order||index,stopNumber:RIC_LOGIC.courseStopNumber(engine.rows,group.start.id),html:`
      <button type="button" class="ric-timeline-item pace ${done?'done':''} ${active?'live':''}" onclick="openRicPaceAssignment('${group.start.id}')">
        <span class="ric-timeline-mile">${group.start.mile}<small>MI</small></span>
        <span class="ric-timeline-copy">
          <span class="ric-timeline-kind"><i class="ti ti-run"></i> Stop __STOP_NUMBER__ · Pace Dad</span>
          <strong>${esc(group.start.station)} → ${esc(group.end.station)}</strong>
          <small>${meta}</small>
          __ASSIGNMENTS__
        </span>
        <span class="ric-timeline-side">${dark?'<i class="ti ti-moon-stars" title="Headlamps"></i>':''}<b>${done?'DONE':active?'NOW':'UPCOMING'}</b><i class="ti ti-chevron-right"></i></span>
      </button>`});
  });
  const numberedTimeline = RIC_LOGIC.overviewTimeline(engine.rows,timeline,RIC_OVERVIEW_SCOPE).map(item=>{
    if(item.html) return item;
    const stop = item.courseRow;
    const done = raceIsLive && (stop.skipped || stop.departed_elapsed_seconds!=null || (stop.mile>=100 && stop.actual_elapsed_seconds!=null));
    const active = raceIsLive && stop.actual_elapsed_seconds!=null && !stop.skipped && stop.departed_elapsed_seconds==null;
    const status = !raceIsLive ? 'UPCOMING' : stop.skipped ? 'RAN THROUGH' : done ? (stop.mile>=100?'FINISHED':'LEFT') : active ? 'DAD HERE' : 'UPCOMING';
    const time = !raceIsLive
      ? fmtClock(stop.goal_elapsed_sec)
      : stop.skipped ? 'No stop'
      : stop.departed_elapsed_seconds!=null ? fmtLoggedClock(stop.departed_elapsed_seconds,stop.departed_logged_at)
      : stop.actual_elapsed_seconds!=null ? fmtLoggedClock(stop.actual_elapsed_seconds,stop.actual_logged_at)
      : fmtClock(stop.projected_elapsed);
    const dark = isDarkAtElapsed(raceIsLive?stop.projected_elapsed:stop.goal_elapsed_sec);
    const kind = stop.mile>=100 ? 'Finish' : 'Course stop';
    return {...item,html:`
      <button type="button" class="ric-timeline-item course ${done?'done':''} ${active?'live':''}" onclick="openStopDetail('${stop.id}')">
        <span class="ric-timeline-mile">${stop.mile}<small>MI</small></span>
        <span class="ric-timeline-copy">
          <span class="ric-timeline-kind"><i class="ti ti-${stop.mile>=100?'flag-checkered':'map-pin'}"></i> Stop __STOP_NUMBER__ · ${kind}</span>
          <strong>${esc(stop.station)}</strong>
          <small>${time}</small>
          __ASSIGNMENTS__
        </span>
        <span class="ric-timeline-side">${dark?'<i class="ti ti-moon-stars" title="After dark"></i>':''}${stop.station_note?'<i class="ti ti-note"></i>':''}<b>${status}</b><i class="ti ti-chevron-right"></i></span>
      </button>`};
  });

  return `<div class="ric-overview-grid">
    ${timerHTML}
    ${nextJobHTML}
    <div class="ric-race-status ${isSydney?'sydney-status':''}">
      <div><span>Last stop</span><b>${lastStopText}</b></div>
      ${isSydney?'':`<div><span>Miles to next stop</span><b>${milesAway==null?'—':`${milesAway} mi`}</b></div>`}
      <button type="button" class="ric-eta-info" onclick="showRicEtaInfo()"><span>${useLiveData?'Live ETA to next stop':'ETA to next stop'} <i class="ti ti-info-circle"></i></span><b>${eta}</b></button>
    </div>
    <div class="ric-timeline">
      <div class="ric-timeline-heading">
        <div class="ric-timeline-title">Race Order</div>
        <div class="ric-scope-toggle" aria-label="Choose stops shown">
          <button type="button" class="${RIC_OVERVIEW_SCOPE==='mine'?'active':''}" title="${esc(ME.name)}'s crew and pacing jobs" onclick="setRicOverviewScope('mine')">Your jobs</button>
          <button type="button" class="${RIC_OVERVIEW_SCOPE==='all'?'active':''}" onclick="setRicOverviewScope('all')">All stops</button>
        </div>
      </div>
      ${numberedTimeline.map(item=>item.html
        .replace('__STOP_NUMBER__',String(item.stopNumber||'—'))
        .replace('__ASSIGNMENTS__',RIC_OVERVIEW_SCOPE==='all'&&item.courseRow?ricStopPeopleHTML(item.courseRow):'')
      ).join('') || '<div class="sd-empty">Nothing assigned yet.</div>'}
    </div>
  </div>`;
}

function showRicEtaInfo(){
  toast('ETA adjusts automatically when someone logs Dad arrived or Dad left.');
}

async function submitPrepNeed(){
  const input = document.getElementById('ric-prep-need');
  if(!input || !input.value.trim()) return;
  await dbInsert('notes',{author:ME.name,body:input.value.trim()});
  await renderRicBeforeRace();
  toast('Need added');
}

async function renderRicBeforeRace(){
  const el = document.getElementById('ric-before-body');
  if(!el || !usesMissionShell()) return;
  const isSydney = String(ME&&ME.name||'').toLowerCase()==='sydney';
  const [events,notes,splits] = await Promise.all([
    dbList('timeline_events','sort_order.asc'),
    dbList('notes','created_at.asc'),
    dbList('splits','sort_order.asc')
  ]);
  const raceStart = raceStartDateTime();
  const raceEnd = new Date((CONFIG.race_end||CONFIG.race_start||'2026-10-10')+'T00:00:00');
  const startTime = raceStart.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const videoUrls = new Set(['https://youtu.be/nxZaNrxT3hU']);
  notes.forEach(n=>{
    (String(n.body||'').match(/https?:\/\/(?:www\.)?(?:youtu\.be|youtube\.com)\/[^\s]+/gi)||[])
      .forEach(url=>videoUrls.add(url.replace(/[),.;]+$/,'')));
  });
  const videos = [...videoUrls];
  const generalNotes = notes.filter(n=>{
    const body=String(n.body||'');
    return !/(?:youtu\.be|youtube\.com)/i.test(body) && !/^random needs\b/i.test(body.trim());
  });
  const timelineItems = [];
  const onCourseEvent = /first crew stop|overnight crew stop|race starts|estimated finish|official .*cutoff/i;
  visibleEvents(events).filter(ev=>!onCourseEvent.test(String(ev.title||''))).forEach(ev=>{
    const meta=evMeta(ev), date=wkDateFor(ev.day_label);
    date.setHours(Math.floor(meta.s/60),meta.s%60,0,0);
    timelineItems.push({
      timestamp:date.getTime(), day:ev.day_label, date:`${date.getMonth()+1}/${date.getDate()}`,
      title:ev.title, time:`${fmtMin(meta.s)} – ${fmtMin(meta.e)}`, notes:ev.notes||'', address:meta.addr||''
    });
  });
  timelineItems.sort((a,b)=>a.timestamp-b.timestamp);
  const hotelAddress = String(CONFIG.lodging_address||'').trim();

  // Sydney's Prep page is a compact, read-only briefing. She is crew—not a manager or
  // pacer—so it intentionally omits planning gaps, pacing logistics, editable fields, and
  // general manager references. Keep this branch scoped to Sydney so other profiles retain
  // their existing Prep page.
  if(isSydney){
    const trackingUrl=String(CONFIG.tracking_url||'').trim();
    el.innerHTML = `
      <section class="before-section" data-sydney-prep="hotel">
        <div class="before-title"><i class="ti ti-home"></i> Hotel</div>
        <div class="before-card hotel">
          <strong>${esc(CONFIG.lodging_name||'Hotel not added yet')}</strong>
          ${hotelAddress ? addressBlock(hotelAddress) : '<small>Address not added yet</small>'}
          <div class="before-info-grid">
            <div><span>Check-in</span><b>${esc(CONFIG.lodging_checkin||'—')}</b></div>
            <div><span>Check-out</span><b>${esc(CONFIG.lodging_checkout||'—')}</b></div>
          </div>
          ${CONFIG.lodging_notes ? `<p>${esc(CONFIG.lodging_notes)}</p>` : ''}
        </div>
      </section>

      <section class="before-section" data-sydney-prep="timeline">
        <div class="before-title"><i class="ti ti-calendar-event"></i> Timeline</div>
        <div class="before-timeline">${timelineItems.map(item=>`
          <div class="before-event">
            <div class="before-day"><b>${esc(item.day)}</b><span>${esc(item.date)}</span></div>
            <div><strong>${esc(item.title)}</strong><small>${esc(item.time)}</small>${item.notes?`<p>${esc(item.notes)}</p>`:''}${item.address?addressBlock(item.address):''}</div>
          </div>`).join('') || '<div class="before-card"><small>Nothing scheduled yet.</small></div>'}</div>
      </section>

      <section class="before-section" data-sydney-prep="videos">
        <div class="before-title"><i class="ti ti-brand-youtube"></i> Videos to Watch</div>
        <div class="before-links">${videos.map((url,i)=>`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener"><i class="ti ti-player-play-filled"></i><span>${i===0?'Crewing 101':`Watch video ${i+1}`}</span><i class="ti ti-external-link"></i></a>`).join('')}</div>
      </section>

      <section class="before-section" data-sydney-prep="essentials">
        <div class="before-title"><i class="ti ti-shield-check"></i> Race-Day Essentials</div>
        <div class="before-card">
          <div class="before-info-grid general sydney-essentials-grid">
            <div><span>Bib</span><b>${esc(CONFIG.bib_number||'—')}</b></div>
            <div><span>Tracking</span>${trackingUrl?`<a class="before-essential-link" href="${esc(safeUrl(trackingUrl))}" target="_blank" rel="noopener">Open tracker <i class="ti ti-external-link"></i></a>`:'<b>—</b>'}</div>
            <div><span>Emergency contact</span><b>${esc(CONFIG.emergency_contact||'—')}</b></div>
            <div><span>Race director</span><b>${esc(CONFIG.race_director_phone||'—')}</b></div>
          </div>
          <p>For a medical emergency, call 911.</p>
        </div>
      </section>`;
    return;
  }

  const prepMissing=[];
  if(!String(CONFIG.lodging_name||'').trim()||!hotelAddress) prepMissing.push('Hotel name and address');
  if(!String(CONFIG.bib_number||'').trim()) prepMissing.push('Bib number');
  if(!String(CONFIG.tracking_url||'').trim()) prepMissing.push('Tracking link');
  if(!String(CONFIG.emergency_contact||'').trim()) prepMissing.push('Emergency contact');
  if(!String(CONFIG.race_director_phone||'').trim()) prepMissing.push('Race director phone');
  const prepEngine=computePaceEngine(splits);
  const prepPaceGroups=ricPacingAssignments(prepEngine);
  const personKey=String(ME.name||'pacer').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  if(prepPaceGroups.some(group=>!String(CONFIG[`ric_meet_${group.start.id}`]||'').trim()||!String(CONFIG[`ric_meet_${group.end.id}`]||'').trim()||!String(CONFIG[`${personKey}_pace_pickup_${group.start.id}`]||'').trim())){
    prepMissing.push('Pacing meeting and pickup details');
  }
  if(ricDirectCrewStops(splits).some(stop=>!String(CONFIG[`ric_meet_${stop.id}`]||'').trim())) prepMissing.push('Crew-stop meeting landmarks');
  el.innerHTML = `
    ${prepMissing.length?`<section class="before-section">
      <div class="before-title"><i class="ti ti-alert-triangle"></i> Still Needed</div>
      <div class="before-needed-list">${prepMissing.map(item=>`<div><i class="ti ti-circle-dashed"></i>${esc(item)}</div>`).join('')}<small>Add these as soon as the family confirms them.</small></div>
    </section>`:''}
    <section class="before-section">
      <div class="before-title"><i class="ti ti-home"></i> Hotel</div>
      <div class="before-card hotel">
        <strong>${esc(CONFIG.lodging_name||'Hotel not added yet')}</strong>
        ${hotelAddress ? addressBlock(hotelAddress) : '<small>Address not added yet</small>'}
        <div class="before-info-grid">
          <div><span>Check-in</span><b>${esc(CONFIG.lodging_checkin||'—')}</b></div>
          <div><span>Check-out</span><b>${esc(CONFIG.lodging_checkout||'—')}</b></div>
        </div>
        ${CONFIG.lodging_notes ? `<p>${esc(CONFIG.lodging_notes)}</p>` : ''}
      </div>
    </section>

    <section class="before-section">
      <div class="before-title"><i class="ti ti-brand-youtube"></i> Videos to Watch</div>
      <div class="before-links">${videos.map((url,i)=>`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener"><i class="ti ti-player-play-filled"></i><span>${i===0?'Crewing 101':`Watch video ${i+1}`}</span><i class="ti ti-external-link"></i></a>`).join('')}</div>
    </section>

    <section class="before-section">
      <div class="before-title"><i class="ti ti-notes"></i> Random Needs</div>
      <div class="before-card before-needs">
        ${generalNotes.length ? generalNotes.map(n=>`<div><i class="ti ti-point-filled"></i><span>${esc(n.body)}</span></div>`).join('') : '<small>Nothing added yet.</small>'}
        <div class="before-need-add"><input id="ric-prep-need" type="text" placeholder="Add a need…" onkeydown="if(event.key==='Enter'){submitPrepNeed();event.preventDefault()}"><button type="button" class="btn sm" onclick="submitPrepNeed()">Add</button></div>
      </div>
    </section>

    <section class="before-section">
      <div class="before-title"><i class="ti ti-calendar-event"></i> Timeline</div>
      <div class="before-timeline">${timelineItems.map(item=>{
        return `<div class="before-event">
          <div class="before-day"><b>${esc(item.day)}</b><span>${esc(item.date)}</span></div>
          <div><strong>${esc(item.title)}</strong><small>${esc(item.time)}</small>${item.notes?`<p>${esc(item.notes)}</p>`:''}${item.address?addressBlock(item.address):''}</div>
        </div>`;
      }).join('') || '<div class="before-card"><small>Nothing scheduled yet.</small></div>'}</div>
    </section>

    <section class="before-section">
      <div class="before-title"><i class="ti ti-info-circle"></i> General Info</div>
      <div class="before-card">
        <strong>${esc(CONFIG.race_name||'Yeti 100 Mile Endurance Run')}</strong>
        <small>${esc(CONFIG.race_location||'')}</small>
        ${CONFIG.race_description?`<p>${esc(CONFIG.race_description)}</p>`:''}
        <div class="before-info-grid">
          <div><span>Dates</span><b>${fmtRaceDates(raceStart,raceEnd)}</b></div>
          <div><span>Start</span><b>${startTime}</b></div>
        </div>
        <div class="before-resource-row">
          <a href="${esc(safeUrl(CONFIG.official_site_url))}" target="_blank" rel="noopener">Official Site</a>
          <a href="${esc(safeUrl(CONFIG.ultrapacer_url))}" target="_blank" rel="noopener">ultraPacer reference</a>
        </div>
      </div>
    </section>

    <section class="before-section">
      <div class="before-title"><i class="ti ti-shield-check"></i> Race-Day Essentials</div>
      <div class="before-card">
        <div class="before-info-grid general before-essentials-grid">
          <label><span>Bib</span><input type="text" value="${esc(CONFIG.bib_number||'')}" placeholder="Add bib" onblur="saveSharedPlanText('bib_number',this.value)"></label>
          <label><span>Tracking URL</span><input type="url" value="${esc(CONFIG.tracking_url||'')}" placeholder="Add link" onblur="saveSharedPlanText('tracking_url',this.value)"></label>
          <label><span>Emergency contact</span><input type="text" value="${esc(CONFIG.emergency_contact||'')}" placeholder="Name + phone" onblur="saveSharedPlanText('emergency_contact',this.value)"></label>
          <label><span>Race director</span><input type="tel" value="${esc(CONFIG.race_director_phone||'')}" placeholder="Phone" onblur="saveSharedPlanText('race_director_phone',this.value)"></label>
        </div>
        <p>For a medical emergency, call 911.</p>
      </div>
    </section>`;
}

async function renderRicHomeDashboard(prefetchedSplits){
  const overviewEl = document.getElementById('ric-overview');
  const crewEl = document.getElementById('ric-crew-mission');
  const pacerEl = document.getElementById('ric-pacer-mission');
  if(!overviewEl || !crewEl || !pacerEl || !usesMissionShell()) return;
  const rawSplits = prefetchedSplits || await dbList('splits','sort_order.asc');
  const splits = RIC_LOGIC.sanitizeRaceRows(rawSplits,raceSessionStartDateTime().getTime());
  const engine = computePaceEngine(splits);
  const mine = ricDirectCrewStops(splits);
  const paceGroups = ricPacingAssignments(engine);
  const paceNav = document.getElementById('mission-pace-nav');
  if(paceNav) paceNav.classList.toggle('hidden',paceGroups.length===0);
  let anchorSort = -1;
  splits.forEach(s=>{ if(s.actual_elapsed_seconds!=null && !s.skipped) anchorSort=s.sort_order; });
  const resolved = s=>RIC_LOGIC.crewStopState(s,departedWithinGrace(s)).resolved;
  let nextUp = RIC_LOGIC.selectNextAssignedStop(mine,anchorSort,resolved);
  // Old walkthrough taps should not make Ric's real race-day screen look finished before
  // race morning. A currently running test timer (or the brief just-left window) still shows.
  if(!raceIsLive()){
    const activeTest = mine.find(s=>s.actual_elapsed_seconds!=null && s.departed_elapsed_seconds==null && !s.skipped);
    const recentLeft = mine.find(s=>s.departed_elapsed_seconds!=null && departedWithinGrace(s));
    const fallback = nextUp || mine[0] || null;
    nextUp = activeTest || recentLeft || (fallback ? {
      ...fallback,
      actual_elapsed_seconds:null, actual_logged_at:null, actual_logged_by:null,
      departed_elapsed_seconds:null, departed_logged_at:null, departed_logged_by:null,
      skipped:false
    } : null);
  }
  overviewEl.innerHTML = ricOverviewHTML(engine,nextUp,mine);
  if(!nextUp){
    crewEl.innerHTML = `<div class="mission-card crew-mission">
      <div class="mission-head"><div class="mission-job"><i class="ti ti-map-pin-check"></i> Next Crew Stop</div></div>
      <div class="mission-empty">${mine.length?'All stops done.':'No stop assigned.'}</div>
    </div>`;
  } else {
    const grace = stopGraceMsLeft(nextUp)>0;
    const stopState = RIC_LOGIC.crewStopState(nextUp,grace);
    const {arrived,left} = stopState;
    const stage = stopState.label==='Just left'
      ? `Left at ${fmtLoggedClock(nextUp.departed_elapsed_seconds,nextUp.departed_logged_at)}`
      : stopState.label;
    const questions = getCrewQuestions();
    const crewable = (nextUp.mile??0)>=crewAccessMile()-0.001;
    const questionHTML = !crewable
      ? `<div class="sd-empty">Questions begin at mile ${crewAccessMile()}, when crew access starts.</div>`
      : questions.map(q=>buildQuestionAnswerHTML(nextUp,q)).join('');
    const proj = engine.rows.find(r=>r.id===nextUp.id);
    const raceIsLive = window.raceIsLive();
    const stopElapsed = raceIsLive && proj ? proj.projected_elapsed : (proj ? proj.goal_elapsed_sec : nextUp.elapsed_seconds);
    const requiredHeadlamps = headlampPeople('crew',stopElapsed,stopElapsed);
    const needsHeadlamp = requiredHeadlamps.length>0;
    const courseStopNo = RIC_LOGIC.courseStopNumber(engine.rows,nextUp.id);
    const stopTime = !raceIsLive && proj ? fmtClock(proj.goal_elapsed_sec) : mystopTimeDisplay(nextUp,proj&&proj.projected_elapsed,stopKind(nextUp,splits));
    const stopIndex = splits.findIndex(r=>r.id===nextUp.id);
    const previousStop = stopIndex>0 ? [...splits.slice(0,stopIndex)].reverse().find(row=>!row.skipped) : null;
    const carryNote = previousStop && previousStop.flag_forward && previousStop.station_note ? previousStop : null;
    const meetKey = `ric_meet_${nextUp.id}`;
    const isSydney = String(ME&&ME.name||'').toLowerCase()==='sydney';
    crewEl.innerHTML = `<div class="mission-card crew-mission">
      <div class="mission-head">
        <div class="mission-job"><i class="ti ti-map-pin-check"></i> Next Crew Stop</div>
        <div class="mission-place-row">
          <div class="mission-place">Stop ${courseStopNo||'—'} · Mi ${nextUp.mile} · ${esc(nextUp.station)}</div>
          <div class="mission-eta">${stopTime}</div>
        </div>
        ${stage==='Ready' ? '' : `<div class="mission-stage ${arrived&&!left?'live':''}"><i class="ti ti-${arrived&&!left?'clock-play':'route'}"></i> ${stage}</div>`}
      </div>
      <div class="mission-body">
        ${nextUp.official_note ? `<div class="rd-banner official" style="margin-bottom:12px"><i class="ti ti-speakerphone"></i> ${esc(nextUp.official_note)}</div>` : ''}
        ${carryNote ? `<div class="urgent-carry"><i class="ti ti-flag-3-filled"></i><div><b>From ${esc(carryNote.station)}</b><span>${esc(carryNote.station_note)}</span></div></div>` : ''}
        <div class="mission-section mission-main-action">
          <div class="mission-section-title"><i class="ti ti-stopwatch"></i> Arrival & departure</div>
          <div class="planned-stop-time"><b>${Math.round(RIC_LOGIC.stopRestSeconds(nextUp.mile)/60)} min stop</b><span>Countdown starts when Dad arrives</span></div>
          ${buildLoggingControlsHTML(nextUp,stopKind(nextUp,splits))}
        </div>
        <div class="mission-section"><div class="mission-section-title"><i class="ti ti-map-pin"></i> Meet here</div>
          ${nextUp.address ? addressBlock(nextUp.address) : '<div class="sd-empty">Map not added yet.</div>'}
          ${isSydney?'':`<textarea class="split-note-input meet-instructions" placeholder="Parking, trail side, landmark, where to stand…" onblur="saveSharedPlanText('${meetKey}',this.value)">${esc(CONFIG[meetKey]||'')}</textarea>`}
        </div>
        <div class="mission-section">
          <div class="mission-section-title"><i class="ti ti-backpack"></i> Bring</div>
          ${needsHeadlamp?nightGearHTML(nextUp.id,requiredHeadlamps):''}
          ${missionBringListHTML(nextUp)}
        </div>
        <div class="mission-section">
          <div class="mission-section-title"><i class="ti ti-message-question"></i> Ask</div>
          ${questionHTML || '<div class="sd-empty">No questions are set.</div>'}
        </div>
        <div class="mission-section">
          <div class="mission-section-title"><i class="ti ti-notes"></i> Note</div>
          <input type="text" class="split-note-input" style="font-style:normal;color:var(--ink);width:100%" placeholder="Quick note about Dad…" value="${esc(nextUp.station_note||'')}" onchange="editStationNoteAndRefresh('${nextUp.id}', this.value)" onkeydown="saveStationNoteOnEnter(event,'${nextUp.id}',this)">
          <small class="mission-note-hint">Press Enter to save to everyone's Notes. Flag only if the next station needs it.</small>
          <label class="rd-flag-lbl red"><input type="checkbox" ${nextUp.flag_forward?'checked':''} onchange="toggleFlagForwardAndRefresh('${nextUp.id}', this.checked)"> <i class="ti ti-flag-3"></i> Flag for next station</label>
        </div>
        <div class="mission-section">
          <div class="mission-section-title"><i class="ti ti-gauge"></i> Pace out</div>
          ${ricPaceDirectiveHTML(engine,nextUp)}
        </div>
      </div>
    </div>`;
  }
  pacerEl.innerHTML = ricPacerMissionHTML(engine);
}

async function renderHome(){
  const missionHome = usesMissionShell();
  document.getElementById('home-running-total').classList.toggle('hidden',missionHome);
  document.getElementById('ric-home-dashboard').classList.toggle('hidden',!missionHome);
  document.getElementById('standard-home-dashboard').classList.toggle('hidden',missionHome);
  if(missionHome){ renderCrewReference(); await renderRicHomeDashboard(); }
  else {
    await renderRunningTotal('home-running-total');
    await renderHomeNextStop();
  }
  document.getElementById('home-race-name').textContent = CONFIG.race_name || 'Yeti 100 Mile Endurance Run';
  document.getElementById('home-race-loc').textContent = CONFIG.race_location || '';
  document.getElementById('home-race-desc').textContent = CONFIG.race_description || '';

  const start = new Date((CONFIG.race_start || '2026-10-09') + 'T00:00:00');
  const days = Math.max(0, Math.ceil((start - new Date()) / 86400000));
  document.getElementById('home-days').textContent = days;
  const end = new Date((CONFIG.race_end || CONFIG.race_start || '2026-10-10') + 'T00:00:00');
  document.getElementById('home-race-dates').textContent = fmtRaceDates(start, end);

  const links = document.getElementById('home-links');
  const trackingHtml = CONFIG.tracking_url
    ? `<a class="qlink" href="${esc(safeUrl(CONFIG.tracking_url))}" target="_blank" rel="noopener"><i class="ti ti-map-pin"></i><b>Live Tracking</b><small>Bib #${esc(CONFIG.bib_number || '—')}</small></a>`
    : `<div class="qlink"><i class="ti ti-map-pin-off"></i><b>Live Tracking</b><small>Added once bib assigned</small></div>`;
  links.innerHTML = `
    <a class="qlink" href="${esc(safeUrl(CONFIG.official_site_url))}" target="_blank" rel="noopener"><i class="ti ti-world"></i><b>Official Site</b><small>Yeti Trail Runners</small></a>
    <a class="qlink" href="${esc(safeUrl(CONFIG.ultrapacer_url))}" target="_blank" rel="noopener"><i class="ti ti-route"></i><b>ultraPacer</b><small>Splits (login req.)</small></a>
    ${trackingHtml}
    <div class="qlink" onclick="goPage('crew')" style="cursor:pointer"><i class="ti ti-notebook"></i><b>Crew Sheet</b><small>Plan & pacing</small></div>
  `;

  const allItems = await dbList('checklist_items');
  const items = isManager() ? allItems : allItems.filter(i => (i.assigned_to_ids||[]).includes(ME.id));
  const total = items.length, done = items.filter(i=>i.checked).length;
  const pct = total ? Math.round(done/total*100) : 0;
  document.getElementById('home-ring').style.background = `conic-gradient(var(--accent) ${pct}%, var(--border) 0)`;
  document.getElementById('home-ring-pct').textContent = pct+'%';
  document.getElementById('home-ring-count').textContent = `${done} of ${total} packed`;
  document.getElementById('home-ring-sub').textContent = isManager() ? 'across every category' : 'assigned to you';

  const avatars = document.getElementById('home-avatars');
  avatars.innerHTML = PROFILES.map(p=>`<div class="avatar sm" style="background:${p.color||'var(--grad)'};color:${p.color?contrastText(p.color):'#fff'}" title="${esc(p.name)}">${initials(p.name)}</div>`).join('');
}

/* ================= CREW SHEET ================= */
// Whatever Victoria's editor (or anyone writing the list by hand) saves in crew_questions is
// shown exactly as written. A bare string or a {question:…} row is read as a question too, so
// a list typed up some other way still turns up rather than vanishing.
function getCrewQuestions(){
  if(!CONFIG.crew_questions) return DEFAULT_CREW_QUESTIONS.map(q=>({...q}));
  try{
    const parsed = JSON.parse(CONFIG.crew_questions);
    if(!Array.isArray(parsed)) return [];
    return parsed.map((q,i)=>{
      if(typeof q === 'string') q = {text:q};
      if(!q || typeof q !== 'object') return null;
      const text = String(q.text ?? q.question ?? q.q ?? q.label ?? '').trim();
      return text ? {...q, id:q.id || `q${i}-${text.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)}`, text} : null;
    }).filter(Boolean);
  }catch(e){ return []; }
}

let _restAudioContext = null;

const _restAlerted = new Set();

const _restRemainingByStop = new Map();

function stopRestSeconds(mile){ return RIC_LOGIC.stopRestSeconds(mile); }

function restTimerSinceMs(s){
  return s.actual_logged_at
    ? new Date(s.actual_logged_at).getTime()
    : raceSessionStartDateTime().getTime() + s.actual_elapsed_seconds*1000;
}

function fmtCountdownSeconds(sec){
  const s = Math.round(sec||0), a = Math.abs(s);
  return `${s<0?'-':''}${Math.floor(a/60)}:${String(a%60).padStart(2,'0')}`;
}

function restCountdownHTML(s,extraClass=''){
  const sinceMs = restTimerSinceMs(s);
  const durationSec = stopRestSeconds(s.mile);
  const state = RIC_LOGIC.restCountdown(sinceMs,durationSec);
  return `<div class="stop-countdown ${state.expired?'expired':''} ${extraClass}" data-stop-id="${s.id}" data-since-ms="${sinceMs}" data-duration-sec="${durationSec}">
    <span>${state.expired?'Time to go':'Time left'}</span>
    <strong>${fmtCountdownSeconds(state.remainingSec)}</strong>
    <small>${Math.round(durationSec/60)} minute stop</small>
  </div>`;
}

function primeRestAudio(){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return;
    if(!_restAudioContext) _restAudioContext = new AudioCtx();
    if(_restAudioContext.state==='suspended') _restAudioContext.resume();
  }catch(e){}
}

function playRestBeeps(count){
  if(!_restAudioContext || _restAudioContext.state!=='running') return;
  try{
    for(let i=0;i<count;i++){
      const start = _restAudioContext.currentTime + i*.2;
      const oscillator = _restAudioContext.createOscillator();
      const gain = _restAudioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880,start);
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(.22,start+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,start+.13);
      oscillator.connect(gain); gain.connect(_restAudioContext.destination);
      oscillator.start(start); oscillator.stop(start+.14);
    }
  }catch(e){}
}

function buildLoggingControlsHTML(s, kind){
  if(kind==='start' || kind==='finish') return buildStartFinishControls(s, kind);
  if(s.skipped){
    return `<div class="rd-actions" style="margin-top:8px">
      <div class="rd-ran-through"><i class="ti ti-player-track-next"></i> Ran through — no stop</div>
      <div class="rd-status-row">
        <button class="btn ghost sm" onclick="toggleSkipAndRefresh('${s.id}', false)"><i class="ti ti-arrow-back-up"></i> Undo</button>
        <button type="button" class="rd-clear-tiny" onclick="clearActualAndRefresh('${s.id}')">Clear station</button>
      </div>
    </div>`;
  }
  const editLink = `<button type="button" class="rd-edit-link" onclick="toggleEditTimesAndRefresh('${s.id}')">${editingTimesId===s.id ? 'Done' : 'Edit times'}</button>`;
  if(s.actual_elapsed_seconds==null){
    return `<div class="rd-actions race-stop-actions" style="margin-top:8px">
      <div class="rd-status-row race-stop-secondary">
        <button class="race-stop-primary arrived" onclick="primeRestAudio();logArrivalNowAndRefresh('${s.id}')"><i class="ti ti-map-pin-check"></i><span>Dad Arrived</span></button>
        <button class="btn ghost sm" onclick="toggleSkipAndRefresh('${s.id}', true)"><i class="ti ti-player-track-next"></i> Dad Ran Through</button>
      </div>
      ${editLink}
      ${buildEditTimesPanel(s)}
    </div>`;
  }
  if(s.departed_elapsed_seconds==null){
    // Prefer the real wall-clock tap moment (actual_logged_at) so the live timer works even
    // when testing before the official race start. Manual H:MM backfills have no real tap
    // moment to anchor to, so they fall back to the race-relative calc (usually fine since
    // that only happens once the race has actually started).
    return `<div class="rd-actions race-stop-actions" style="margin-top:8px">
      <div class="rd-status-row race-arrival-meta">
        <div class="rd-arrived-chip"><i class="ti ti-map-pin-check"></i> Arrived ${fmtLoggedClock(s.actual_elapsed_seconds, s.actual_logged_at)}${s.actual_logged_by ? ` <span class="rd-logged-by">by ${esc(s.actual_logged_by)}</span>` : ''}</div>
      </div>
      ${restCountdownHTML(s)}
      <button class="race-stop-primary left" onclick="logLeftNowAndRefresh('${s.id}')"><i class="ti ti-door-exit"></i><span>Dad Left</span></button>
      <div class="rd-status-row" style="margin-top:2px">
        <button type="button" class="rd-undo-link" onclick="undoLastLogAndRefresh('${s.id}')"><i class="ti ti-arrow-back-up"></i> Undo arrival</button>
        ${editLink}
      </div>
      ${buildEditTimesPanel(s)}
    </div>`;
  }
  // Prefer the real wall-clock tap moments — same reason as the live timer above: pre-race the
  // elapsed-seconds both clamp to 0, so their difference is a bogus 0m even for a real stop.
  const restSec = (s.actual_logged_at && s.departed_logged_at)
    ? Math.max(0, (new Date(s.departed_logged_at).getTime() - new Date(s.actual_logged_at).getTime())/1000)
    : Math.max(0, s.departed_elapsed_seconds - s.actual_elapsed_seconds);
  return `<div class="rd-actions" style="margin-top:8px">
    <div class="rd-status-row">
      <div class="rd-arrived-chip done"><i class="ti ti-map-pin-check"></i> Arrived ${fmtLoggedClock(s.actual_elapsed_seconds, s.actual_logged_at)}${s.actual_logged_by ? ` <span class="rd-logged-by">by ${esc(s.actual_logged_by)}</span>` : ''}</div>
      <div class="rd-left-chip"><i class="ti ti-door-exit"></i> Left ${fmtLoggedClock(s.departed_elapsed_seconds, s.departed_logged_at)}${s.departed_logged_by ? ` <span class="rd-logged-by">by ${esc(s.departed_logged_by)}</span>` : ''}</div>
    </div>
    <div class="rd-rest-took">Rested ${Math.round(restSec/60)}m</div>
    <div class="rd-status-row" style="margin-top:2px">
      <button type="button" class="rd-undo-link" onclick="undoLastLogAndRefresh('${s.id}')"><i class="ti ti-arrow-back-up"></i> Undo departure</button>
      ${editLink}
    </div>
    ${buildEditTimesPanel(s)}
  </div>`;
}

function buildStopDetailHTML(s, splits){
  const idx = splits.findIndex(r=>r.id===s.id);
  const prev = idx>0 ? splits[idx-1] : null;
  const carryNote = (prev && prev.flag_forward && prev.station_note) ? prev : null;
  const questions = getCrewQuestions();
  const loggingHTML = buildLoggingControlsHTML(s, stopKind(s, splits));
  // Before the crew can physically reach him, there's nothing to ask and no rest to time.
  const crewable = (s.mile ?? 0) >= crewAccessMile() - 0.001;
  // The plan's pace for the leg leaving THIS stop — what you tell him as he heads out. Baked
  // into the plan, so it's right regardless of what's been logged.
  let outHTML = '';
  try{
    const er = computePaceEngine(splits).rows;
    const here = er.findIndex(r=>r.id===s.id);
    const nextStop = here>=0 ? er.slice(here+1).find(r=>!r.skipped) : null;
    if(nextStop && nextStop.goal_pace_sec_per_mi){
      outHTML = `<div class="sd-section-title">Send Him Out At</div>
        <div class="sd-text" style="font-family:var(--font-mono);font-size:15px;font-weight:bold;color:var(--accent)">${fmtPace(nextStop.goal_pace_sec_per_mi)}<span style="font-weight:normal;font-size:12px;color:var(--ink-soft)"> &rarr; ${esc(nextStop.station)}</span></div>`;
    }
  }catch(e){}
  return `
    ${s.address ? `<div style="margin:-4px 0 12px">${addressBlock(s.address)}</div>` : ''}
    ${s.official_note ? `<div class="rd-banner official" style="margin-bottom:12px"><i class="ti ti-speakerphone"></i> ${esc(s.official_note)}</div>` : ''}
    ${loggingHTML}
    ${outHTML}
    <div class="sd-section-title">Plan Note</div>
    <div class="sd-text">${s.note ? esc(s.note) : '<span class="sd-empty">None.</span>'}</div>
    ${carryNote ? `<div class="rd-banner carry" style="margin-top:12px"><i class="ti ti-flag-3-filled"></i> From ${esc(carryNote.station)}: "${esc(carryNote.station_note)}"${carryNote.station_note_by ? ` — ${esc(carryNote.station_note_by)}` : ''}</div>` : ''}
    <div class="sd-section-title">What To Bring</div>
    ${(s.bring_items||[]).length ? `<div class="bring-list" style="margin-top:4px">${s.bring_items.map(it=>`
      <div class="bring-item">
        <div class="bring-chk ${it.checked?'on':''}" onclick="toggleBringItemAndRefresh('${s.id}','${it.id}', ${!it.checked})">${it.checked?'<i class="ti ti-check" style="font-size:11px"></i>':''}</div>
        <div class="bring-label ${it.checked?'on':''}">${esc(it.label)}${it.checked && it.checked_by ? ` <span style="color:var(--ink-faint);font-size:10px">✓ ${esc(it.checked_by)}</span>` : ''}</div>
      </div>`).join('')}</div>` : '<div class="sd-empty">Nothing listed.</div>'}
    ${crewable ? `
    <div class="sd-section-title">Questions To Ask</div>
    ${questions.length ? questions.map(q=>buildQuestionAnswerHTML(s, q)).join('') : '<div class="sd-empty">None set yet.</div>'}
    ` : `<div class="sd-empty" style="margin-top:14px">Crew can't reach Grady until mile ${crewAccessMile()} — questions start there.</div>`}
    <div class="sd-section-title">Race Day Note</div>
    <input type="text" class="split-note-input" style="font-style:normal;color:var(--ink);width:100%" placeholder="Note for this station (how he looked, what he needed...)" value="${esc(s.station_note||'')}" onchange="editStationNoteAndRefresh('${s.id}', this.value)" onkeydown="saveStationNoteOnEnter(event,'${s.id}',this)">
    ${s.station_note_by ? `<div class="rd-note-by">— ${esc(s.station_note_by)}</div>` : ''}
    <label class="rd-flag-lbl red"><input type="checkbox" ${s.flag_forward?'checked':''} onchange="toggleFlagForwardAndRefresh('${s.id}', this.checked)"> <i class="ti ti-flag-3"></i> Flag this note for the next stop</label>
  `;
}

async function refreshAfterStopAction(id){
  await renderMyStops();
  await renderHomeNextStop();
  if(usesMissionShell()) await renderRicHomeDashboard();
  const modal = document.getElementById('stop-detail-modal');
  if(!modal.classList.contains('hidden') && modal.dataset.stopId === id){
    await openStopDetail(id);
  }
}

function revealStopCountdown(id){
  requestAnimationFrame(()=>{
    const activePage=document.querySelector('#app .page.active');
    const timer=[...(activePage||document).querySelectorAll('.stop-countdown[data-stop-id]')]
      .find(el=>el.dataset.stopId===id);
    if(timer) timer.scrollIntoView({behavior:'smooth',block:'center'});
  });
}

async function logArrivalNowAndRefresh(id){ await logArrivalNow(id); await refreshAfterStopAction(id); revealStopCountdown(id); }

async function logArrivalManualAndRefresh(id, value){ await logArrivalManual(id, value); await refreshAfterStopAction(id); revealStopCountdown(id); }

function saveStationNoteOnEnter(event,id,input){
  if(event.key!=='Enter') return;
  event.preventDefault();
  editStationNoteAndRefresh(id,input.value);
}

// The collapsed "the plan" reference at the top of the Crew Sheet (and of Ric's and Sydney's
// Overview) — rest-time rule, the what-to-say-if-he-quits line, and the real reasons to stop.
// It's folded away so it doesn't crowd the screen mid-stop.
function renderCrewReference(){
  const sec = (title, val) => `<div class="sd-section-title">${title}</div>`
    + `<div class="sd-text">${val ? esc(val) : '<span class="sd-empty">Not set yet.</span>'}</div>`;
  const html = sec('Estimated Rest Time', CONFIG.sit_time_rule)
    + sec('If He Wants To Quit', CONFIG.quit_protocol)
    + sec('Reasons To Actually Stop', CONFIG.reasons_to_stop);
  ['crew-ref-body','ric-plan-ref-body'].forEach(id=>{
    const body = document.getElementById(id);
    if(body) body.innerHTML = html;
  });
}

function computePaceEngine(rows){
  const k = paceEngineConstants();
  const sorted = [...rows].sort((a,b)=>a.mile-b.mile);
  // Checkpoints are tied to the stop itself (is_checkpoint + checkpoint_cutoff_hours on that
  // split row), not derived by matching some row's mile against a separate config number —
  // so editing a checkpoint station's mile moves its cutoff with it instead of silently
  // breaking the whole "Room Before Cutoff" feature with no warning. Falls back to the old
  // CONFIG-based defaults only if no row has been marked yet (e.g. before the migration runs).
  const rowCheckpoints = sorted.filter(r=>r.is_checkpoint && r.checkpoint_cutoff_hours!=null && r.checkpoint_cutoff_hours!=='')
    .map(r=>({mile:r.mile, cutoffSec: parseFloat(r.checkpoint_cutoff_hours)*3600, station:r.station, id:r.id}));
  if(rowCheckpoints.length) k.checkpoints = rowCheckpoints;
  const goalMap = computeGoalPacing(sorted, k);
  const actual = computeActualPacing(sorted, k);
  const lapBounds = [0, ...k.checkpoints.map(c=>c.mile)];
  const lapOf = mile => { for(let i=1;i<lapBounds.length;i++){ if(mile<=lapBounds[i]+0.001) return i; } return lapBounds.length-1; };
  let anchorIdx = -1;
  sorted.forEach((r,i)=>{ if(r.actual_elapsed_seconds!=null && !r.skipped) anchorIdx = i; });
  const anchor = anchorIdx>=0 ? sorted[anchorIdx] : null;
  // If the anchor stop carries a real wall-clock stamp but its race-relative elapsed is pinned
  // to 0 (what happens when you test the crew flow before the race has actually started),
  // every downstream ETA would otherwise read as race morning. Shift projected clock times by
  // the gap between that real moment and where the race clock puts the anchor, so "next stop"
  // reads forward from when you actually logged him out. Zero during a real race.
  let wallOffsetSec = 0;
  if(anchor){
    const at = anchor.departed_logged_at || anchor.actual_logged_at;
    if(at){
      const anchorElapsed = anchor.departed_elapsed_seconds!=null ? anchor.departed_elapsed_seconds : anchor.actual_elapsed_seconds;
      wallOffsetSec = (new Date(at).getTime() - raceSessionStartDateTime().getTime())/1000 - anchorElapsed;
    }
  }
  const maxMile = sorted.length ? sorted[sorted.length-1].mile : 100;
  const currentLap = anchor ? lapOf(anchor.mile) : 1;
  // planRestOf: what the goal plan budgets at a stop — ALWAYS counted, because it's already
  // baked into goalMap's elapsed times (computeGoalPacing doesn't know about race-day skips).
  // hisRestOf: what he'll actually spend — zero if the stop is being skipped/run through.
  const planRestOf = s => (s.mile>0 && s.mile<maxMile-0.001) ? (s.is_big_stop ? k.restBigSec : k.restNormalSec) : 0;
  const hisRestOf  = s => s.skipped ? 0 : planRestOf(s);

  // ---- HOW IS HE RUNNING THE PLAN SO FAR? ----
  // rawRatio compares his running time (rests removed) to what the plan's leg targets called
  // for over the same ground — the plan targets already bake in grade + fade, so beating them
  // is genuine over-performance. `trust` ramps 0->1 across the first lap so one hot early leg
  // can't project a 14-hour finish; by ~lap 1 we fully believe his pace. perfRatio is what the
  // projection actually applies to every remaining leg's plan time.
  let rawRatio = 1, perfRatio = 1, trust = 0, recentLegPct = null;
  // catchUpRatio: re-run the spreadsheet's own per-leg budgeting from where he actually is —
  // (time left to hit the goal, aid stops removed) / (what the plan budgeted for the running
  // still ahead). >=1 when he's on/ahead of plan; <1 when behind, and multiplying a leg's plan
  // pace by it gives the pace that leg needs to be run at to get back on the 18h timeline —
  // still shaped by that leg's own elevation/fade. goalReachable=false means no time left.
  // cutoffRatio: the same re-fit, but measured against the hard 30h race cutoff instead of the
  // 18h goal — so once 18h is gone the banner can switch to "what he needs to just beat the
  // cutoff", still leg-by-leg elevation/fade aware.
  let catchUpRatio = 1, goalReachable = true, cutoffRatio = 1, cutoffReachable = true, cutoffGate = null;
  if(anchor && anchor.mile > 0){
    let planRestBefore = 0, hisRestBefore = 0;
    sorted.forEach(s=>{
      if(s.mile>0 && s.mile < anchor.mile - 0.001){
        planRestBefore += planRestOf(s);
        if(s.actual_elapsed_seconds!=null && s.departed_elapsed_seconds!=null)
          hisRestBefore += Math.max(0, s.departed_elapsed_seconds - s.actual_elapsed_seconds);
      }
    });
    const anchorGoal = goalMap.get(anchor.mile);
    const planRunToAnchor = (anchorGoal ? anchorGoal.goalElapsedSec : 0) - planRestBefore;
    const hisRunToAnchor = anchor.actual_elapsed_seconds - hisRestBefore;
    if(planRunToAnchor > 60 && hisRunToAnchor > 0){
      rawRatio = hisRunToAnchor / planRunToAnchor;
      const firstCp = (k.checkpoints[0] && k.checkpoints[0].mile) || 35.9;
      trust = Math.max(0, Math.min(1, anchor.mile / firstCp));
      perfRatio = 1 + (rawRatio - 1) * trust;
    }
    const lastAdj = actual[anchorIdx].adjPace, anchorGoalPace = anchorGoal ? anchorGoal.goalPaceSecPerMi : null;
    if(lastAdj && anchorGoalPace) recentLegPct = Math.round((lastAdj/anchorGoalPace - 1) * 100);

    let totalPlanRest = 0, hisRestAhead = 0;
    sorted.forEach(s=>{ totalPlanRest += planRestOf(s); if(s.mile > anchor.mile + 0.001) hisRestAhead += hisRestOf(s); });
    const anchorDeparted = anchor.departed_elapsed_seconds!=null ? anchor.departed_elapsed_seconds : anchor.actual_elapsed_seconds;
    const planRunRemaining = (k.goalFinishSec - totalPlanRest) - planRunToAnchor;
    const hisRunBudgetRemaining = k.goalFinishSec - anchorDeparted - hisRestAhead;
    if(planRunRemaining > 60){
      catchUpRatio = hisRunBudgetRemaining / planRunRemaining;
      // below ~0.80 the leg paces it demands aren't realistically holdable — the 18h is gone.
      goalReachable = hisRunBudgetRemaining > 0 && catchUpRatio >= 0.80;
      catchUpRatio = Math.max(0.80, catchUpRatio);
      // cutoffRatio: the tightest of every hard deadline still ahead — each intermediate
      // checkpoint cutoff AND the final race cutoff. Same per-leg budgeting as catchUpRatio,
      // just measured to that gate. Whichever gate needs the fastest pace wins; running that
      // pace clears it and — because it's the tightest — every looser gate after it too.
      // cutoffGate records which one so the banner can name it.
      const finalCutoffSec = (parseFloat(CONFIG.cutoff_hours) || 30) * 3600;
      const gates = k.checkpoints
        .filter(c => c.mile > anchor.mile + 0.001)
        .map(c => ({ mile: c.mile, sec: c.cutoffSec,
          station: c.station || (sorted.find(x => Math.abs(x.mile - c.mile) < 0.05) || {}).station || null,
          isFinal: c.mile >= maxMile - 0.001 }));
      if(!gates.some(g => g.isFinal)) gates.push({ mile: maxMile, sec: finalCutoffSec, station: null, isFinal: true });
      gates.sort((a, b) => a.mile - b.mile);
      let tightest = Infinity;
      for(const g of gates){
        const gm = goalMap.get(g.mile);
        if(!gm) continue;
        let planRestToGate = 0, hisRestToGate = 0;
        sorted.forEach(s => {
          if(s.mile > 0 && s.mile < g.mile - 0.001){
            planRestToGate += planRestOf(s);
            if(s.mile > anchor.mile + 0.001) hisRestToGate += hisRestOf(s);
          }
        });
        const planRunAnchorToGate = (gm.goalElapsedSec - planRestToGate) - planRunToAnchor;
        if(planRunAnchorToGate <= 60) continue;
        const budget = g.sec - anchorDeparted - hisRestToGate;
        if(budget <= 0){ cutoffReachable = false; cutoffRatio = 1; cutoffGate = g; break; }
        const r = budget / planRunAnchorToGate;
        if(r < tightest){ tightest = r; cutoffGate = g; }
      }
      if(cutoffReachable && isFinite(tightest)) cutoffRatio = Math.max(0.80, Math.min(tightest, 2.5));
    }
  }

  const projected = sorted.map((r,i)=>{
    const goal = goalMap.get(r.mile);
    const thisGoalElapsed = goal ? goal.goalElapsedSec : r.elapsed_seconds;
    let projElapsedSec, fromPace = false;
    if(r.actual_elapsed_seconds!=null && !r.skipped){
      projElapsedSec = r.actual_elapsed_seconds;
    } else if(anchor){
      const anchorDeparted = anchor.departed_elapsed_seconds!=null ? anchor.departed_elapsed_seconds : anchor.actual_elapsed_seconds;
      const anchorGoal = goalMap.get(anchor.mile);
      // back out of the goal-elapsed gap the plan rests it contains (anchor's own + every stop
      // strictly between), then add back only the rests he'll actually take going forward.
      let planRestSpan = planRestOf(anchor), hisRestFwd = 0;
      sorted.forEach(s=>{ if(s.mile > anchor.mile + 0.001 && s.mile < r.mile - 0.001){ planRestSpan += planRestOf(s); hisRestFwd += hisRestOf(s); } });
      const planRun = Math.max(0, thisGoalElapsed - (anchorGoal ? anchorGoal.goalElapsedSec : 0) - planRestSpan);
      projElapsedSec = anchorDeparted + planRun * (anchor.mile > 0 ? perfRatio : 1) + hisRestFwd;
      fromPace = anchor.mile > 0;
    } else {
      projElapsedSec = thisGoalElapsed;                  // nothing logged — goal time is all we have
    }
    const isActual = r.actual_elapsed_seconds!=null && !r.skipped;
    return {
      ...r,
      goal_elapsed_sec: thisGoalElapsed,
      goal_pace_sec_per_mi: goal ? goal.goalPaceSecPerMi : null,
      projected_elapsed: Math.round(projElapsedSec + (isActual ? 0 : wallOffsetSec)),
      projected_from_pace: fromPace,
      adj_pace: actual[i].adjPace,
      rest_took_sec: actual[i].restTookSec,
      is_anchor: r===anchor,
    };
  });
  const checkpointRooms = k.checkpoints.map(cp=>{
    const row = projected.find(r=>Math.abs(r.mile-cp.mile)<0.05);
    // Cutoff room is race-relative by definition, so back out the wall-clock display shift.
    const projArrivalSec = row ? row.projected_elapsed - ((row.actual_elapsed_seconds!=null && !row.skipped) ? 0 : wallOffsetSec) : null;
    return {mile:cp.mile, station: cp.station || (row?row.station:null), cutoffSec:cp.cutoffSec, projArrivalSec, roomSec: projArrivalSec!=null ? cp.cutoffSec-projArrivalSec : null};
  });
  return {rows:projected, anchor, checkpointRooms, k, rawRatio, perfRatio, trust, recentLegPct, currentLap, catchUpRatio, goalReachable, cutoffRatio, cutoffReachable, cutoffGate};
}

// The start line: one tap logs it as both arrival and departure (elapsed 0 pre-race, with the
// real wall-clock stamp) so it becomes the pace anchor without a phantom rest interval.
async function logStartNow(id){
  const now = new Date().toISOString();
  const secs = Math.max(0, Math.round((Date.now() - raceSessionStartDateTime().getTime())/1000));
  const won = await dbUpdateIfNull('splits', id, {
    actual_elapsed_seconds: secs, actual_logged_by: ME.name, actual_logged_at: now,
    departed_elapsed_seconds: secs, departed_logged_by: ME.name, departed_logged_at: now
  }, 'actual_logged_at', raceStartDateTime().toISOString());
  await renderSplits();
  if(won) toastUndo('Race start logged', () => undoLastLogAndRefresh(id));
  else toast('Already logged by someone else — kept their time', true);
}

// The wall-clock a hand-entered race-elapsed time corresponds to (gun time + elapsed). Keeps
// the "Arrived/Left" chips, the resting timer, and the grace window working for manual entries
// exactly as they do for button taps.
function raceFrameIso(secs){ return new Date(raceSessionStartDateTime().getTime() + (secs||0)*1000).toISOString(); }

async function editStationNote(id, value){
  await dbUpdate('splits', id, {station_note: value, station_note_by: value.trim() ? ME.name : null});
  await renderSplits();
  toast(value.trim() ? "Saved to everyone's Notes" : 'Removed from Notes');
}

async function logArrivalNow(id){
  const secs = Math.max(0, Math.round((Date.now() - raceSessionStartDateTime().getTime())/1000));
  // actual_logged_at is the real wall-clock moment of the tap — used only to drive the live
  // "resting for" timer, which needs to work even when testing before the official race start
  // (actual_elapsed_seconds clamps to 0 pre-race, so it can't be used for that on its own).
  const won = await dbUpdateIfNull('splits', id, {actual_elapsed_seconds: secs, actual_logged_by: ME.name, actual_logged_at: new Date().toISOString()}, 'actual_logged_at', raceStartDateTime().toISOString());
  await renderSplits();
  if(won) toastUndo('Arrival logged', () => undoLastLogAndRefresh(id));
  else toast('Already logged by someone else — kept their time. Use "Edit times" to change it.', true);
}

async function logLeftNow(id){
  const secs = Math.max(0, Math.round((Date.now() - raceSessionStartDateTime().getTime())/1000));
  const won = await dbUpdateIfNull('splits', id, {departed_elapsed_seconds: secs, departed_logged_by: ME.name, departed_logged_at: new Date().toISOString()}, 'departed_logged_at', raceStartDateTime().toISOString());
  await renderSplits();
  if(won) toastUndo('Departure logged', () => undoLastLogAndRefresh(id));
  else toast('Already logged by someone else — kept their time. Use "Edit times" to change it.', true);
}

// Her sync fetches, compares and redraws whichever of HER pages is open. Ric's adds two things:
// retrying the offline queue on its own clock, and redrawing his own screens when data changed.
async function liveSyncTick(){
  if(!USE_SUPABASE || document.hidden || !ME) return;
  const ae = document.activeElement;
  if(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return; // don't interrupt mid-edit
  if(getOfflineQueue().length && navigator.onLine && Date.now()-_lastOfflineFlushAttemptAt>15000){
    await flushOfflineQueue({quiet:true});
  }
  if(getOfflineQueue().length || !navigator.onLine) return;
  const before = _syncSnapshot;
  await HER.liveSyncTick();
  if(before === null || _syncSnapshot === before) return;          // baseline, or nothing new
  const id = (document.querySelector('#app .page.active') || {}).id || '';
  const y = window.scrollY;
  try{
    if(id==='page-ric-stop' || id==='page-ric-pace') await renderRicHomeDashboard();
    else if(id==='page-ric-before') await renderRicBeforeRace();
  }catch(e){}
  window.scrollTo(0, y);
}

/* ================= RIC'S SCREENS, ADDED TO HERS ================= */
// Her markup is the base. These add Ric's screens and controls to it by id, and skip
// quietly if she has moved something — her app still runs, Ric's extra is just missing.
function applyRicShell(){
  const $ = id => document.getElementById(id);
  const html = s => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content; };
  const main = document.querySelector('#app .main');
  const teamBtn = document.querySelector('.header-me[onclick*="goPage(\'team\')"]');
  if(teamBtn) teamBtn.id = 'header-team-button';
  const me = $('header-me');
  if(me){ me.setAttribute('role','button'); me.tabIndex = 0; }
  if(main && !$('ric-connection-status')) main.prepend(html('<div id="ric-connection-status" class="connection-chip hidden" aria-live="polite"></div>'));

  // Home: Ric's Overview on top; her home stays underneath, shown when not in mission mode.
  const home = $('page-home');
  if(home && !$('ric-home-dashboard')){
    const hers = document.createElement('div');
    hers.id = 'standard-home-dashboard';
    [...home.children].filter(el=>el.id!=='home-running-total').forEach(el=>hers.appendChild(el));
    home.append(html(`
      <div id="ric-home-dashboard" class="hidden">
        <details class="crew-ref" id="ric-plan-ref">
          <summary><i class="ti ti-clipboard-text"></i> The Plan — tap if you need it <i class="ti ti-chevron-down cr-chev"></i></summary>
          <div class="cr-body" id="ric-plan-ref-body"></div>
        </details>
        <div id="ric-overview"></div>
      </div>`), hers);
  }
  if(main && !$('page-ric-stop')) main.append(html(`
    <div class="page" id="page-ric-stop"><div id="ric-crew-mission"></div></div>
    <div class="page" id="page-ric-pace"><div id="ric-pacer-mission"></div></div>
    <div class="page" id="page-ric-before"><div id="ric-before-body"></div></div>`));

  // Settings: Ric's personal colour, after her appearance controls.
  const settings = $('page-settings');
  if(settings && !$('personal-color-picker')){
    settings.querySelectorAll(':scope > .save-hint').forEach(el=>el.classList.add('ric-settings-help'));
    settings.append(html(`
      <div class="sec-title settings-subtitle">Your Color</div>
      <div class="card personal-color-card">
        <label class="personal-color-control" for="personal-color-picker">
          <input type="color" id="personal-color-picker" aria-label="Choose your dashboard color" oninput="previewPersonalColor(this.value)" onchange="savePersonalColor(this.value)">
          <span><b>Dashboard accent</b><small id="personal-color-value"></small></span>
        </label>
        <button class="btn ghost sm" type="button" onclick="resetPersonalColor()">Use original</button>
      </div>
      <div class="save-hint ric-settings-help">Changes only your dashboard on this device. The crew sign-in page keeps its original colors.</div>`));
  }

  // Bottom bar: hers stays (hidden in mission mode); Ric's five go after it, then "More",
  // which lists whatever of hers Ric's bar doesn't carry — so a page she adds shows up there.
  const nav = document.querySelector('#app .bottom-nav');
  if(nav && !nav.querySelector('.ric-nav-btn')){
    nav.querySelectorAll('.nav-btn').forEach(b=>b.classList.add('standard-nav-btn'));
    nav.append(html(`
      <button class="nav-btn ric-nav-btn hidden active" data-page="home" onclick="goPage('home')"><i class="ti ti-layout-dashboard"></i>Overview</button>
      <button class="nav-btn ric-nav-btn hidden" data-page="ric-stop" onclick="goPage('ric-stop')"><i class="ti ti-map-pin"></i>Crew Stop</button>
      <button class="nav-btn ric-nav-btn hidden" id="mission-pace-nav" data-page="ric-pace" onclick="openRicPaceAssignment(null)"><i class="ti ti-run"></i>Pace Dad</button>
      <button class="nav-btn ric-nav-btn hidden" data-page="notes" onclick="goPage('notes')"><i class="ti ti-notes"></i>Notes</button>
      <button class="nav-btn ric-nav-btn hidden" data-page="ric-before" onclick="goPage('ric-before')"><i class="ti ti-calendar-event"></i>Prep</button>
      <button class="nav-btn ric-nav-btn hidden" id="ric-more-nav" type="button" aria-haspopup="true" aria-expanded="false" onclick="toggleRicMore()"><i class="ti ti-dots"></i>More</button>
      <div id="ric-more-menu" class="ric-more-menu hidden" role="menu"></div>`));
  }
}

// Her pages Ric's bar doesn't have: read off her own nav buttons each time it opens, so
// anything she adds appears without a change here.
function toggleRicMore(force){
  const menu = document.getElementById('ric-more-menu');
  const btn = document.getElementById('ric-more-nav');
  if(!menu || !btn) return;
  const open = typeof force === 'boolean' ? force : menu.classList.contains('hidden');
  if(open){
    const ricPages = new Set([...document.querySelectorAll('.ric-nav-btn[data-page]')].map(b=>b.dataset.page));
    const items = [...document.querySelectorAll('.standard-nav-btn[data-page]')]
      .filter(b=>!ricPages.has(b.dataset.page) && document.getElementById('page-'+b.dataset.page));
    menu.innerHTML = items.map(b=>`<button type="button" role="menuitem" class="ric-more-item" onclick="toggleRicMore(false);goPage('${b.dataset.page}');document.getElementById('ric-more-nav').classList.add('active')">${b.innerHTML}</button>`).join('')
      || '<div class="ric-more-empty">Nothing else yet.</div>';
  }
  menu.classList.toggle('hidden', !open);
  btn.setAttribute('aria-expanded', String(open));
}

document.addEventListener('click', e=>{
  if(!e.target.closest('#ric-more-menu, #ric-more-nav')) toggleRicMore(false);
});

applyRicShell();

window.addEventListener('online', ()=>{ RIC_DB_CONNECTED=null; updateRicConnectionStatus(); });

window.addEventListener('offline', ()=>updateRicConnectionStatus(false));

// Ric's stop countdown and its beeps. Her own once-a-second ticker keeps running alongside
// for her clocks (time on course, the post-"Dad Left" grace note).
setInterval(()=>{
  const nowMs = Date.now();
  const alertByStop = new Map();
  document.querySelectorAll('.stop-countdown[data-since-ms]').forEach(el=>{
    const sinceMs = parseInt(el.dataset.sinceMs,10);
    const durationSec = parseInt(el.dataset.durationSec,10);
    if(!sinceMs || !durationSec) return;
    const state = RIC_LOGIC.restCountdown(sinceMs,durationSec,nowMs);
    el.classList.toggle('expired',state.expired);
    const label = el.querySelector('span');
    const clock = el.querySelector('strong');
    if(label) label.textContent = state.expired ? 'Time to go' : 'Time left';
    if(clock) clock.textContent = fmtCountdownSeconds(state.remainingSec);
    if(el.dataset.stopId && !alertByStop.has(el.dataset.stopId)){
      alertByStop.set(el.dataset.stopId,{remainingSec:state.remainingSec,sinceMs});
    }
  });
  alertByStop.forEach(({remainingSec,sinceMs},stopId)=>{
    const previousSec=_restRemainingByStop.get(stopId);
    const beeps = RIC_LOGIC.restAlertBeepsBetween(previousSec,remainingSec);
    _restRemainingByStop.set(stopId,remainingSec);
    const alertKey = `${stopId}:${sinceMs}:${previousSec==null?'open':previousSec}->${remainingSec}`;
    if(beeps && !_restAlerted.has(alertKey)){
      _restAlerted.add(alertKey);
      playRestBeeps(beeps);
    }
  });
}, 1000);
