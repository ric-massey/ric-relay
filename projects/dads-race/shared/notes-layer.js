/* Ric's Notes — for EVERYONE, on top of Victoria's app.
 *
 * Victoria liked the Notes screen from Ric's version and wanted it on every profile, so it
 * lives here rather than in ric-layer.js: shared/bootstrap.js (and her open-site build)
 * loads this after her app for every person, and ric-layer.js on top of it only for Ric
 * and Sydney when their race-day switch is on. Styles are shared/notes.css.
 *
 * Like the Ric layer: functions here replace hers of the same name; never redeclare one of
 * her top-level let/const names. The "For Ric" filters and pinned note only appear on Ric's
 * and Sydney's race-day dashboard (usesMissionShell).
 */

// Notes are plain text, but race links should still be one-tap usable on a phone. Escape every
// non-link character first and only turn explicit http(s) text into a safe external anchor.
function linkifyNoteText(value){
  const text=String(value==null?'':value);
  const urlPattern=/https?:\/\/[^\s<>"']+/gi;
  let html='',lastIndex=0,match;
  while((match=urlPattern.exec(text))){
    html+=esc(text.slice(lastIndex,match.index));
    let url=match[0],trailing='';
    while(/[.,!?;:)]$/.test(url)){ trailing=url.slice(-1)+trailing; url=url.slice(0,-1); }
    html+=`<a class="note-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>${esc(trailing)}`;
    lastIndex=match.index+match[0].length;
  }
  return html+esc(text.slice(lastIndex));
}

// Only Ric and Sydney run this app. Everyone else gets the original crew app
// (shared/original/), so nothing here should reach them — see bootstrap.js.
const MISSION_PROFILES = ['ric','sydney'];

// Ric's race-day dashboard is on only when his layer is actually running — Ric and Sydney
// can be on Victoria's version (the Settings switch), and then this must say no.
function usesMissionShell(){ return !!(window.HERMISCUS_LAYER && ME && MISSION_PROFILES.includes(String(ME.name||'').toLowerCase())); }

function simulationStartDateTime(){
  const official=raceStartDateTime();
  const simulated=new Date(CONFIG.simulation_started_at||'');
  if(Date.now()>=official.getTime() || !Number.isFinite(simulated.getTime()) || simulated.getTime()>Date.now()) return null;
  return simulated;
}

function raceSessionStartDateTime(){ return simulationStartDateTime() || raceStartDateTime(); }

function raceIsLive(){ return Date.now()>=raceSessionStartDateTime().getTime(); }

function isRaceSimulationActive(){ return !!simulationStartDateTime(); }

let RIC_NOTES_FILTER = 'for-ric';

function setRicNotesFilter(filter){
  RIC_NOTES_FILTER = ['flagged','for-ric','all'].includes(filter) ? filter : 'for-ric';
  document.querySelectorAll('[data-ric-note-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.ricNoteFilter===RIC_NOTES_FILTER));
  renderCourseLog();
}

function noteAuthorIsAdmin(authorName){
  const profile=PROFILES.find(pr=>pr.name===authorName);
  return !!(profile && profile.role==='Manager');
}

// Roll up everything logged out on the course — the per-stop race-day notes and every
// answered crew question — so they live in one place instead of hiding inside each stop.
async function renderCourseLog(){
  const el = document.getElementById('course-log');
  if(!el) return;
  const rawSplits = await dbList('splits', 'sort_order.asc');
  const splits = RIC_LOGIC.sanitizeRaceRows(rawSplits,raceSessionStartDateTime().getTime());
  const ric = usesMissionShell();
  const isSydney = ric && String(ME&&ME.name||'').toLowerCase()==='sydney';
  const missionIds = new Set();
  if(ric){
    // Notes follow direct membership, even at a shared location. The Overview remains a
    // compact job list, while Notes can still collect everything relevant to this person.
    splits.filter(s=>RIC_LOGIC.isAssignedToStop(s,ME.id)).forEach(s=>missionIds.add(s.id));
    ricDirectCrewStops(splits).forEach(s=>missionIds.add(s.id));
    const paceEngine = computePaceEngine(splits);
    ricPacingAssignments(paceEngine).forEach(g=>paceEngine.rows.slice(g.startIndex,g.endIndex+1).forEach(s=>missionIds.add(s.id)));
  }
  const qText = {};
  getCrewQuestions().forEach(q => { qText[q.id] = q.text; });
  const entries = [];
  splits.forEach(s => {
    const where = `${s.station} · mi ${s.mile}`;
    const forRic = missionIds.has(s.id);
    const ans = s.question_answers || {};
    Object.entries(ans).forEach(([qid, a]) => {
      if(!a || a.value == null || a.value === '') return;
      entries.push({ id:`${s.id}:${qid}`,stopId:s.id,mile:s.mile,sort:s.sort_order,where,label:qText[qid]||a.q||'Question',value:a.value,by:a.by||'',flagged:false,forRic:isSydney?false:forRic||a.by===ME.name });
    });
    if(s.station_note && s.station_note.trim()){
      const ownName = new RegExp(`\\b${String(ME.name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i');
      const forPerson = isSydney
        ? RIC_LOGIC.flaggedNoteTargetsPerson(splits,s,ME.id)
        : forRic||s.station_note_by===ME.name||ownName.test(s.station_note);
      entries.push({ id:`${s.id}:note`,stopId:s.id,mile:s.mile,sort:s.sort_order,where,label:'Note',value:s.station_note.trim(),by:s.station_note_by||'',flagged:!!s.flag_forward,forRic:forPerson });
    }
  });
  entries.sort((a,b)=>b.sort-a.sort);
  const pinned = ric ? entries.find(e=>e.flagged && e.forRic) : null;
  const pinnedEl = document.getElementById('ric-pinned-note');
  if(pinnedEl) pinnedEl.innerHTML = pinned ? `<button type="button" class="ric-pinned-alert" onclick="openStopDetail('${pinned.stopId}')"><i class="ti ti-flag-3-filled"></i><span><b>${esc(pinned.where)}</b>${esc(pinned.value)}</span><i class="ti ti-chevron-right"></i></button>` : '';
  let shown = entries;
  if(ric){
    document.querySelectorAll('[data-ric-note-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.ricNoteFilter===RIC_NOTES_FILTER));
    if(RIC_NOTES_FILTER==='flagged') shown=entries.filter(e=>e.flagged);
    else if(RIC_NOTES_FILTER==='for-ric') shown=entries.filter(e=>e.forRic);
    if(pinned) shown=shown.filter(e=>e.id!==pinned.id);
  }
  if(!shown.length){
    el.innerHTML = !raceIsLive()
      ? '<div class="profile-empty">Race-day notes will appear here when the race starts.</div>'
      : '<div class="profile-empty">Nothing logged from the aid stations yet — race-day notes and answered questions collect here.</div>';
    return;
  }
  el.innerHTML = shown.map(e => {
    const admin=noteAuthorIsAdmin(e.by);
    return `
    <div class="clog-item${e.flagged?' flagged':''}${admin?' admin':''}">
      <div class="clog-where">${e.flagged?'<i class="ti ti-flag-3-filled"></i> ':''}${esc(e.where)}</div>
      <div class="clog-q">${esc(e.label)}</div>
      <div class="clog-a">${esc(e.value)}</div>
      ${e.by ? `<div class="clog-by">${admin?'<span class="message-admin-label">ADMIN</span> ':''}— ${esc(e.by)}</div>` : ''}
    </div>`;
  }).join('');
}

async function renderNotes(){
  document.getElementById('notes-official').href = safeUrl(CONFIG.official_site_url);
  document.getElementById('notes-ultrapacer').href = safeUrl(CONFIG.ultrapacer_url);
  await renderCourseLog();
  const notes = await dbList('notes', 'created_at.asc');
  const list = document.getElementById('notes-list');
  if(!notes.length){ list.innerHTML = '<div class="profile-empty">No messages yet. Send the first one above.</div>'; return; }
  list.innerHTML = [...notes].reverse().map((n,i)=>{
    const decoded=RIC_LOGIC.decodeSharedMessage(n.body);
    const admin=noteAuthorIsAdmin(n.author);
    const mine=n.author===ME.name;
    const dateStr = new Date(n.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    const isEditing = n.id === editingNoteId;
    const canManage = isManager() || n.author===ME.name;
    const body = isEditing
      ? `<textarea class="note-edit-area" id="note-edit-${n.id}">${esc(decoded.body)}</textarea>
         <div class="modal-actions" style="margin-top:0">
           <button class="btn ghost sm" style="flex:1" onclick="cancelEditNote()">Cancel</button>
           <button class="btn sm" style="flex:1" onclick="saveEditNote('${n.id}', document.getElementById('note-edit-${n.id}').value)">Save</button>
         </div>`
      : `<div class="message-head">
           <span class="message-author">From ${esc(n.author)}</span>
           <span class="message-time">${esc(dateStr)}</span>
         </div>
         ${(decoded.flagged||admin)?`<div class="message-badges">${decoded.flagged?'<span class="message-flag-label"><i class="ti ti-flag-3-filled"></i> FLAGGED</span>':''}${admin?'<span class="message-admin-label">ADMIN</span>':''}</div>`:''}
         <div class="note-body">${linkifyNoteText(decoded.body)}</div>
         <div class="note-footer">
           <div class="note-actions">
             ${canManage?`<button onclick="toggleNoteFlag('${n.id}')" title="${decoded.flagged?'Remove flag':'Flag message'}" aria-label="${decoded.flagged?'Remove flag':'Flag message'}"><i class="ti ti-flag${decoded.flagged?'-3-filled':'-3'}"></i></button>`:''}
             ${canManage?`<button onclick="startEditNote('${n.id}')" title="Edit"><i class="ti ti-pencil"></i></button>
             <button onclick="deleteNote('${n.id}')" title="Delete"><i class="ti ti-trash"></i></button>`:''}
           </div>
         </div>`;
    return `<div class="crew-message${mine?' mine':''}${decoded.flagged?' flagged':''}${admin?' admin':''}${isEditing?' editing':''}">${body}</div>`;
  }).join('');
}

function submitNoteOnEnter(event){
  if(event.key!=='Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  submitNote();
}

async function submitNote(){
  const el = document.getElementById('note-input');
  const body = el.value.trim();
  if(!body) return;
  const flagInput=document.getElementById('note-flag-input');
  await dbInsert('notes', {author: ME.name, body:RIC_LOGIC.encodeSharedMessage(body,!!(flagInput&&flagInput.checked))});
  el.value = '';
  if(flagInput) flagInput.checked=false;
  await renderNotes();
  toast('Message sent');
}

async function noteCanBeManaged(id){
  const notes=await dbList('notes',null,{fresh:true});
  const note=notes.find(n=>n.id===id);
  return !!(note && (isManager() || note.author===ME.name));
}

async function startEditNote(id){
  if(!await noteCanBeManaged(id)){ toast('Only the author or a manager can edit this note',true); return; }
  editingNoteId = id; renderNotes();
}

async function saveEditNote(id, value){
  if(!await noteCanBeManaged(id)){ toast('Only the author or a manager can edit this note',true); return; }
  const body = value.trim();
  if(!body) return;
  const notes=await dbList('notes',null,{fresh:true});
  const note=notes.find(n=>n.id===id);
  if(!note) return;
  const flagged=RIC_LOGIC.decodeSharedMessage(note.body).flagged;
  await dbUpdate('notes', id, {body:RIC_LOGIC.encodeSharedMessage(body,flagged)});
  editingNoteId = null;
  await renderNotes();
  toast('Message updated');
}

async function toggleNoteFlag(id){
  if(!await noteCanBeManaged(id)){ toast('Only the author or a manager can flag this message',true); return; }
  const notes=await dbList('notes',null,{fresh:true});
  const note=notes.find(n=>n.id===id);
  if(!note) return;
  const decoded=RIC_LOGIC.decodeSharedMessage(note.body);
  await dbUpdate('notes',id,{body:RIC_LOGIC.encodeSharedMessage(decoded.body,!decoded.flagged)});
  await renderNotes();
  toast(decoded.flagged?'Flag removed':'Message flagged');
}

async function deleteNote(id){
  if(!await noteCanBeManaged(id)){ toast('Only the author or a manager can delete this note',true); return; }
  if(!confirm("Delete this message? This can't be undone.")) return;
  await dbDelete('notes', id);
  await renderNotes();
  toast('Message deleted');
}

/* ================= THE NOTES SCREEN ================= */
// Her Notes page, replaced by the message feed + race-update log. Skips quietly if she
// has removed the page.
function applyNotesShell(){
  const notes = document.getElementById('page-notes');
  if(notes) notes.innerHTML = `
      <div id="notes-resources-wrap">
        <div class="sec-title">Resources</div>
        <div class="card" style="margin-bottom:20px">
          <div class="link-row"><i class="ti ti-brand-youtube"></i><a href="https://youtu.be/nxZaNrxT3hU" target="_blank" rel="noopener">Crewing 101 — watch before race weekend</a></div>
          <div class="link-row"><i class="ti ti-world"></i><a id="notes-official" href="#" target="_blank" rel="noopener">Official Yeti 100 site</a></div>
          <div class="link-row"><i class="ti ti-map-pin"></i><a id="notes-ultrapacer" href="#" target="_blank" rel="noopener">ultraPacer splits (login required)</a></div>
        </div>
      </div>
      <div id="notes-general-wrap">
        <div class="sec-title" id="notes-general-title">Have To Remember / Notes</div>
        <div class="card message-composer">
          <textarea id="note-input" placeholder="Message everyone..." rows="2" onkeydown="submitNoteOnEnter(event)"></textarea>
          <div class="message-compose-row">
            <label class="message-flag-toggle" for="note-flag-input">
              <input type="checkbox" id="note-flag-input">
              <i class="ti ti-flag-3"></i> Flag
            </label>
            <span class="message-enter-hint">Enter to send · Shift+Enter for a new line</span>
            <button class="btn sm" onclick="submitNote()"><i class="ti ti-send"></i> Send</button>
          </div>
        </div>
        <div id="notes-list" class="message-feed"></div>
      </div>
      <div class="notes-race-updates">
        <div class="sec-title" id="notes-course-title">From The Course</div>
        <div class="save-hint" id="notes-course-hint" style="margin:-4px 0 10px">Every race-day note and answered question, newest stop first — you don't have to open each stop to find them.</div>
        <div id="ric-notes-tools" class="hidden">
          <div id="ric-pinned-note"></div>
          <div class="seg-toggle ric-note-filters">
            <button class="seg-btn" data-ric-note-filter="flagged" onclick="setRicNotesFilter('flagged')">Flagged</button>
            <button class="seg-btn active" data-ric-note-filter="for-ric" onclick="setRicNotesFilter('for-ric')">For Ric</button>
            <button class="seg-btn" data-ric-note-filter="all" onclick="setRicNotesFilter('all')">All</button>
          </div>
        </div>
        <div id="course-log" style="margin-bottom:20px"></div>
      </div>`;

}
applyNotesShell();
