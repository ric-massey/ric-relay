(function(factory){
  const api = factory();
  if(typeof window !== 'undefined') window.RicDashboardLogic = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(function(){
  function parseClockMinutes(value,fallback){
    const match = String(value||'').match(/^(\d{1,2}):(\d{2})$/);
    if(!match) return fallback;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours>=0 && hours<24 && minutes>=0 && minutes<60 ? hours*60+minutes : fallback;
  }

  function clockMinutesAt(raceStartMs,elapsedSec){
    const dt = new Date(raceStartMs + (Number(elapsedSec)||0)*1000);
    return dt.getHours()*60 + dt.getMinutes();
  }

  function isDarkAtElapsed(raceStartMs,elapsedSec,sunsetTime='19:00',sunriseTime='07:30'){
    const minute = clockMinutesAt(raceStartMs,elapsedSec);
    const sunset = parseClockMinutes(sunsetTime,19*60);
    const sunrise = parseClockMinutes(sunriseTime,7*60+30);
    return minute>=sunset || minute<sunrise;
  }

  function isDarkDuringLeg(raceStartMs,startElapsed,endElapsed,sunsetTime='19:00',sunriseTime='07:30'){
    return isDarkAtElapsed(raceStartMs,startElapsed,sunsetTime,sunriseTime) ||
      isDarkAtElapsed(raceStartMs,endElapsed,sunsetTime,sunriseTime);
  }

  function headlampPeople(kind,raceStartMs,startElapsed,endElapsed,sunsetTime='19:00',sunriseTime='07:30',pacerName='Ric'){
    // Show the requirement at stops whose own ETA is after dark. A daylight stop does not
    // become a "headlamp stop" just because the following leg eventually crosses sunset.
    const dark = isDarkAtElapsed(raceStartMs,startElapsed,sunsetTime,sunriseTime);
    if(!dark) return [];
    return kind==='pace' ? [pacerName,'Dad'] : ['Dad'];
  }

  function numberTimeline(items){
    return [...items]
      .sort((a,b)=>Number(a.mile)-Number(b.mile) || Number(a.order||0)-Number(b.order||0))
      .map((item,index)=>({...item,stopNumber:index+1}));
  }

  function courseStopNumber(rows,stopId){
    const courseStops = [...(rows||[])]
      .filter(row=>Number(row.mile)>0)
      .sort((a,b)=>Number(a.sort_order??a.mile)-Number(b.sort_order??b.mile));
    const index = courseStops.findIndex(row=>row.id===stopId);
    return index>=0 ? index+1 : null;
  }

  function overviewTimeline(courseRows,assignedItems,scope='mine'){
    const assigned = [...(assignedItems||[])].sort((a,b)=>Number(a.mile)-Number(b.mile) || Number(a.order||0)-Number(b.order||0));
    if(scope!=='all') return assigned;
    const byStop = new Map(assigned.map(item=>[item.stopId,item]));
    return [...(courseRows||[])]
      .filter(row=>Number(row.mile)>0)
      .sort((a,b)=>Number(a.sort_order??a.mile)-Number(b.sort_order??b.mile))
      .map((row,index)=>{
        const assignedItem = byStop.get(row.id);
        return assignedItem ? {...assignedItem,courseRow:row} : {
          stopId:row.id,
          mile:Number(row.mile),
          order:Number(row.sort_order??index),
          stopNumber:index+1,
          courseRow:row,
        };
      });
  }

  function stopPeople(stop,profiles){
    const byId = new Map((profiles||[]).map(profile=>[profile.id,profile.name]));
    const assignedNames = (stop && Array.isArray(stop.assigned_to) ? stop.assigned_to : [])
      .map(id=>byId.get(id)).filter(Boolean);
    const note = String(stop&&stop.official_note||'');
    const pacingNote = /\bpacing\b/i.test(note);
    const pacerNames = pacingNote
      ? (profiles||[]).filter(profile=>new RegExp(`\\b${String(profile.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(note)).map(profile=>profile.name)
      : [];
    return {assignedNames,pacerNames};
  }

  function overviewNextStop(nextUp,lastStop,nextProjection,useLiveData,activeStop){
    if(!nextUp) return {milesAway:null,etaElapsed:null,here:false};
    const milesAway = Math.max(0, +(Number(nextUp.mile)-(lastStop ? Number(lastStop.mile) : 0)).toFixed(1));
    const etaElapsed = activeStop ? null
      : useLiveData && nextProjection ? nextProjection.projected_elapsed
      : nextProjection ? nextProjection.goal_elapsed_sec
      : nextUp.elapsed_seconds;
    return {milesAway,etaElapsed,here:!!activeStop};
  }

  // Walkthrough taps are useful while building the app, but they must never become live
  // race data on race morning. Keep the database audit trail and give Ric a clean view by
  // ignoring runtime values logged before the configured race start.
  function sanitizeRaceRows(rows,raceStartMs,nowMs=Date.now()){
    const beforeRace = Number(nowMs) < Number(raceStartMs);
    const staleTime = value => {
      const parsed = Date.parse(String(value||''));
      return Number.isFinite(parsed) && parsed < Number(raceStartMs);
    };
    return (rows||[]).map(row=>{
      const answers = row.question_answers || {};
      const staleAnswer = Object.values(answers).some(answer=>answer && staleTime(answer.at));
      const staleArrival = staleTime(row.actual_logged_at);
      const staleDeparture = staleTime(row.departed_logged_at);
      const staleRuntime = staleArrival || staleDeparture || staleAnswer;
      const freshRuntime = [row.actual_logged_at,row.departed_logged_at]
        .some(value=>value && !staleTime(value)) || Object.values(answers).some(answer=>answer&&answer.at&&!staleTime(answer.at));
      const cleanAnswers = beforeRace ? {} : Object.fromEntries(
        Object.entries(answers).filter(([,answer])=>!answer || !answer.at || !staleTime(answer.at))
      );
      const clean = {...row, question_answers:cleanAnswers};
      if(beforeRace || staleArrival){
        clean.actual_elapsed_seconds = null;
        clean.actual_logged_at = null;
        clean.actual_logged_by = null;
      }
      if(beforeRace || staleDeparture){
        clean.departed_elapsed_seconds = null;
        clean.departed_logged_at = null;
        clean.departed_logged_by = null;
      }
      // Before race day, keep walkthrough notes out of the live UI. Once the race has
      // started, never let an old answer erase a note entered during a real check-in.
      if(beforeRace || (staleRuntime && !freshRuntime)){
        clean.skipped = false;
        clean.station_note = '';
        clean.station_note_by = null;
        clean.flag_forward = false;
      }
      return clean;
    });
  }

  function selectNextDuty(crewStop,paceGroups,anchorMile=-1){
    const anchor = Number(anchorMile);
    const candidates = [];
    if(crewStop) candidates.push({kind:'crew',stop:crewStop,group:null,here:crewStop.actual_elapsed_seconds!=null && !crewStop.skipped && crewStop.departed_elapsed_seconds==null});
    (paceGroups||[]).forEach(group=>{
      const waiting = group.start.actual_elapsed_seconds!=null && !group.start.skipped && group.start.departed_elapsed_seconds==null;
      const state = pacingState(anchor,group.start.mile,group.end.mile);
      if(waiting){
        candidates.push({kind:'pace',stop:group.start,group,here:true});
      }else if(state.active){
        candidates.push({kind:'pace-active',stop:group.end,group,here:false});
      }else if(!state.done && Number(group.start.mile)>=anchor-.001){
        candidates.push({kind:'pace',stop:group.start,group,here:false});
      }
    });
    return candidates.sort((a,b)=>Number(a.stop.mile)-Number(b.stop.mile))[0] || null;
  }

  function selectNextAssignedStop(stops,anchorSort,resolved){
    return (stops||[]).find(stop=>!resolved(stop) && Number(stop.sort_order)>=Number(anchorSort)) || null;
  }

  function paceTarget(plan,options={}){
    let ratio = options.raceIsLive
      ? (options.goalReachable ? options.catchUpRatio : (options.cutoffReachable ? options.cutoffRatio : 1))
      : 1;
    ratio = Math.max(.8,Math.min(1.2,Number.isFinite(ratio) ? ratio : 1));
    return {ratio,target:Number(plan)*ratio};
  }

  function pacingState(anchorMile,startMile,endMile){
    const anchor = Number(anchorMile);
    const start = Number(startMile);
    const end = Number(endMile);
    return {
      active:anchor>=start-.001 && anchor<end-.001,
      done:anchor>=end-.001,
    };
  }

  function activeMilesRemaining(anchorMile,currentFromMile,currentToMile){
    return +(Math.max(0,Number(currentToMile)-Math.max(Number(anchorMile),Number(currentFromMile)))).toFixed(1);
  }

  function crewStopState(stop,inGrace=false){
    const skipped = !!stop.skipped;
    const arrived = stop.actual_elapsed_seconds!=null && !skipped;
    const left = stop.departed_elapsed_seconds!=null;
    return {
      arrived,
      left,
      active:arrived && !left,
      resolved:skipped || (arrived && left && !inGrace),
      label:skipped ? 'Ran through' : left ? (inGrace ? 'Just left' : 'Done') : arrived ? 'Dad here' : 'Ready',
    };
  }

  function isAssignedToStop(stop,personId){
    return Array.isArray(stop.assigned_to) && stop.assigned_to.includes(personId);
  }

  // A forward flag belongs to the next active course stop. This lets each crew member's
  // personal Notes filter show handoffs meant for a stop they are actually working.
  function flaggedNoteTargetsPerson(rows,sourceStop,personId){
    if(!sourceStop || !sourceStop.flag_forward || !personId) return false;
    const ordered = [...(rows||[])]
      .sort((a,b)=>Number(a.sort_order??a.mile)-Number(b.sort_order??b.mile));
    const sourceIndex = ordered.findIndex(row=>row.id===sourceStop.id);
    if(sourceIndex<0) return false;
    const receivingStop = ordered.slice(sourceIndex+1).find(row=>!row.skipped);
    return !!receivingStop && isAssignedToStop(receivingStop,personId);
  }

  function isPersonalCrewAssignment(stop,personId,managerIds=[],isPacingStop=false){
    if(isPacingStop || !isAssignedToStop(stop,personId)) return false;
    const managers = new Set(managerIds);
    const personallyAssigned = stop.assigned_to.filter(id=>!managers.has(id));
    return personallyAssigned.length===1 && personallyAssigned[0]===personId;
  }

  function stopRestSeconds(mile){
    return Math.abs(Number(mile)-52)<.05 ? 10*60 : 2*60;
  }

  function restCountdown(sinceMs,durationSec,nowMs=Date.now()){
    const elapsedSec = Math.max(0,Math.floor((Number(nowMs)-Number(sinceMs))/1000));
    // Keeps counting past zero (-0:45, -1:30…) so the crew can see how far over the stop ran.
    const remainingSec = Number(durationSec)-elapsedSec;
    return {elapsedSec,remainingSec,expired:remainingSec<=0};
  }

  function restAlertBeeps(remainingSec){
    if(Number(remainingSec)===60) return 3;
    if(Number(remainingSec)>=1 && Number(remainingSec)<=10) return 1;
    return 0;
  }

  function restAlertBeepsBetween(previousSec,remainingSec){
    const current=Math.max(0,Number(remainingSec));
    if(previousSec==null){
      if(current>=1&&current<=10) return 1;
      if(current>10&&current<=60) return 3;
      return 0;
    }
    const previous=Math.max(0,Number(previousSec));
    if(current>=previous) return 0;
    let count=(previous>60&&current<=60)?3:0;
    for(let second=10;second>=1;second--){
      if(previous>second&&current<=second) count++;
    }
    return count;
  }

  function guardValueIsOpen(value,staleBeforeIso){
    if(value==null) return true;
    if(!staleBeforeIso) return false;
    const valueMs=Date.parse(String(value));
    const cutoffMs=Date.parse(String(staleBeforeIso));
    return Number.isFinite(valueMs)&&Number.isFinite(cutoffMs)&&valueMs<cutoffMs;
  }

  // Rebuild the locally visible table while writes are waiting for a connection. Operations
  // are replayed in order so an arrival followed by a departure, or an insert followed by an
  // edit, looks exactly as it will after the queue reaches Supabase.
  function applyOfflineQueueToRows(rows,operations,table){
    let next = (rows||[]).map(row=>({...row}));
    (operations||[]).filter(op=>op.table===table).forEach(op=>{
      if(op.kind==='insert'){
        const index = next.findIndex(row=>row.id===op.row.id);
        if(index>=0) next[index]={...next[index],...op.row};
        else next.push({...op.row});
      }else if(op.kind==='update'){
        next=next.map(row=>row.id===op.rowId?{...row,...op.patch}:row);
      }else if(op.kind==='updateIfNull'){
        next=next.map(row=>row.id===op.rowId && guardValueIsOpen(row[op.guardCol],op.staleBeforeIso)?{...row,...op.patch}:row);
      }else if(op.kind==='delete'){
        next=next.filter(row=>row.id!==op.rowId);
      }
    });
    return next;
  }

  function applyOfflineQueueToConfig(config,operations){
    const next={...(config||{})};
    (operations||[]).filter(op=>op.kind==='config').forEach(op=>{ next[op.key]=op.value; });
    return next;
  }

  // Keep shared-message flags compatible with the existing notes table. The marker lives in
  // the body, so the feature requires no Supabase migration and older notes remain valid.
  const SHARED_MESSAGE_FLAG = '[[HERMESCO_FLAGGED]]';
  // A flagged message is stored as "[[HERMESCO_FLAGGED]]" on its own line, optionally followed
  // by "[[FOR_STOP:<split id>]]" — the stop the flag is for — then the message itself.
  const FOR_STOP = /^\[\[FOR_STOP:([^\]\s]+)\]\]\s*/;
  function encodeSharedMessage(body,flagged,stopId){
    const clean=decodeSharedMessage(body).body.trim();
    if(!flagged) return clean;
    return stopId ? `${SHARED_MESSAGE_FLAG}\n[[FOR_STOP:${stopId}]]\n${clean}` : `${SHARED_MESSAGE_FLAG}\n${clean}`;
  }

  function decodeSharedMessage(storedBody){
    const stored=String(storedBody==null?'':storedBody);
    const flagged=stored.startsWith(SHARED_MESSAGE_FLAG);
    let body = flagged ? stored.slice(SHARED_MESSAGE_FLAG.length).replace(/^\s+/,'') : stored;
    const forStop = flagged ? body.match(FOR_STOP) : null;
    if(forStop) body = body.slice(forStop[0].length);
    return { body, flagged, stopId: forStop ? forStop[1] : null };
  }

  return {
    parseClockMinutes,
    clockMinutesAt,
    isDarkAtElapsed,
    isDarkDuringLeg,
    headlampPeople,
    numberTimeline,
    courseStopNumber,
    overviewTimeline,
    stopPeople,
    overviewNextStop,
    sanitizeRaceRows,
    selectNextDuty,
    selectNextAssignedStop,
    paceTarget,
    pacingState,
    activeMilesRemaining,
    crewStopState,
    isAssignedToStop,
    flaggedNoteTargetsPerson,
    isPersonalCrewAssignment,
    stopRestSeconds,
    restCountdown,
    restAlertBeeps,
    restAlertBeepsBetween,
    guardValueIsOpen,
    applyOfflineQueueToRows,
    applyOfflineQueueToConfig,
    encodeSharedMessage,
    decodeSharedMessage,
  };
});
