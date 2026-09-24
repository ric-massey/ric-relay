/* ================= DATA LAYER =================
   Shared by both apps: Ric's (app.js) and the original crew app (original/app.js).
   Sign-in headers, the offline queue, the demo store and profile-colour cleaning all
   live here, so the original app's screens can stay exactly as they were written. */
const HERMISCUS_CONFIG = window.HERMISCUS_CONFIG || {};
const SUPABASE_URL = HERMISCUS_CONFIG.supabaseUrl || '';
const SUPABASE_KEY = HERMISCUS_CONFIG.publishableKey || '';
const USE_SUPABASE = /^https?:\/\//.test(SUPABASE_URL);
const RIC_LOGIC = window.RicDashboardLogic;
let RIC_DB_CONNECTED = USE_SUPABASE ? null : true;

function sbHeaders(){
  const session = window.HermiscusAuth && window.HermiscusAuth.readSession();
  return {'apikey':SUPABASE_KEY,'Authorization':'Bearer '+(session ? session.access_token : '')};
}

const OFFLINE_QUEUE_KEY = 'hermesco_offline_write_queue_v1';
const OFFLINE_CACHE_KEY = 'hermesco_offline_data_cache_v1';
let _flushingOfflineQueue = false;
let _lastOfflineFlushAttemptAt = 0;

function readStoredJson(key,fallback){
  try{ return JSON.parse(localStorage.getItem(key) || '') || fallback; }
  catch(e){ return fallback; }
}
function getOfflineQueue(){
  const queue=readStoredJson(OFFLINE_QUEUE_KEY,[]);
  return Array.isArray(queue)?queue:[];
}
function saveOfflineQueue(queue){
  try{ localStorage.setItem(OFFLINE_QUEUE_KEY,JSON.stringify(queue||[])); }catch(e){}
}
function getOfflineCache(){
  const cache=readStoredJson(OFFLINE_CACHE_KEY,{tables:{},config:{}});
  if(!cache.tables) cache.tables={};
  if(!cache.config) cache.config={};
  return cache;
}
function saveOfflineCache(cache){
  try{ localStorage.setItem(OFFLINE_CACHE_KEY,JSON.stringify(cache)); }catch(e){}
}
function cacheTableRows(table,rows){
  const cache=getOfflineCache();
  cache.tables[table]=(rows||[]).map(row=>({...row}));
  saveOfflineCache(cache);
}
function cachedTableRows(table){
  const rows=getOfflineCache().tables[table];
  return Array.isArray(rows)?rows.map(row=>({...row})):null;
}
function cacheConfig(config){
  const cache=getOfflineCache();
  cache.config={...(config||{})};
  saveOfflineCache(cache);
}
function cachedConfig(){ return {...getOfflineCache().config}; }
function sortDbRows(rows,order){
  const next=[...(rows||[])];
  if(!order) return next;
  const desc=order.endsWith('.desc');
  const col=order.split('.')[0];
  next.sort((a,b)=>a[col]===b[col]?0:(a[col]>b[col]?1:-1)*(desc?-1:1));
  return next;
}
function applyOfflineOperationToCache(operation){
  const cache=getOfflineCache();
  if(operation.kind==='config'){
    cache.config=RIC_LOGIC.applyOfflineQueueToConfig(cache.config,[operation]);
  }else{
    const rows=Array.isArray(cache.tables[operation.table])?cache.tables[operation.table]:[];
    cache.tables[operation.table]=RIC_LOGIC.applyOfflineQueueToRows(rows,[operation],operation.table);
  }
  saveOfflineCache(cache);
}
function enqueueOfflineWrite(operation){
  let queue=getOfflineQueue();
  const queued={queueId:crypto.randomUUID(),queuedAt:new Date().toISOString(),...operation};
  // Only the newest value for a shared config field matters; replacing it avoids replaying
  // every keystroke if someone edits meeting instructions while offline.
  if(queued.kind==='config') queue=queue.filter(op=>!(op.kind==='config'&&op.key===queued.key));
  queue.push(queued);
  saveOfflineQueue(queue);
  applyOfflineOperationToCache(queued);
  reportConnection(false);
  return queued;
}
function offlineDatabaseError(message="Can't reach the database — saved data is unavailable on this phone."){
  const error=new Error(message);
  error.offline=true;
  return error;
}

async function sendQueuedOperation(op){
  if(op.kind==='insert'){
    await sbFetch(`${SUPABASE_URL}/rest/v1/${op.table}`,{
      method:'POST',headers:{...sbHeaders(),'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(op.row)
    });
    return true;
  }
  if(op.kind==='update'){
    await sbFetch(`${SUPABASE_URL}/rest/v1/${op.table}?id=eq.${op.rowId}`,{
      method:'PATCH',headers:{...sbHeaders(),'Content-Type':'application/json'},body:JSON.stringify(op.patch)
    });
    return true;
  }
  if(op.kind==='updateIfNull'){
    const guardFilter=op.staleBeforeIso
      ? `&or=${encodeURIComponent(`(${op.guardCol}.is.null,${op.guardCol}.lt.${op.staleBeforeIso})`)}`
      : `&${op.guardCol}=is.null`;
    const res=await sbFetch(`${SUPABASE_URL}/rest/v1/${op.table}?id=eq.${op.rowId}${guardFilter}`,{
      method:'PATCH',headers:{...sbHeaders(),'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(op.patch)
    });
    let rows=[]; try{ rows=await res.json(); }catch(e){}
    return Array.isArray(rows)&&rows.length>0;
  }
  if(op.kind==='delete'){
    await sbFetch(`${SUPABASE_URL}/rest/v1/${op.table}?id=eq.${op.rowId}`,{method:'DELETE',headers:sbHeaders()});
    return true;
  }
  if(op.kind==='config'){
    await sbFetch(`${SUPABASE_URL}/rest/v1/config`,{
      method:'POST',headers:{...sbHeaders(),'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},body:JSON.stringify({key:op.key,value:op.value})
    });
    return true;
  }
  return true;
}

async function flushOfflineQueue(options={}){
  if(!USE_SUPABASE||_flushingOfflineQueue||!navigator.onLine||!getOfflineQueue().length) return false;
  _flushingOfflineQueue=true;
  _lastOfflineFlushAttemptAt=Date.now();
  const startedCount=getOfflineQueue().length;
  let conflicts=0;
  try{
    for(const op of getOfflineQueue()){
      try{
        const applied=await sendQueuedOperation(op);
        if(op.kind==='updateIfNull'&&!applied) conflicts++;
        const remaining=getOfflineQueue().filter(item=>item.queueId!==op.queueId);
        saveOfflineQueue(remaining);
        reportConnection(true);
      }catch(error){
        // Network errors stay queued. A server error also stays queued rather than silently
        // discarding race data; the connection chip keeps showing that work is waiting.
        reportConnection(false);
        break;
      }
    }
  }finally{
    _flushingOfflineQueue=false;
    reportConnection(getOfflineQueue().length?false:true);
  }
  const synced=startedCount-getOfflineQueue().length;
  if(synced&&!options.quiet){
    toast(conflicts?'Saved changes synced; another crew member logged one event first.':'Saved offline changes synced.');
  }
  return getOfflineQueue().length===0;
}

const LOCAL_KEY = 'hermesco_local_db_v1';
const CREW_PALETTE = ['#5C6FE0','#E0568C','#5FD6A8','#F0A868','#A484CC','#4FB8E0','#E0B85C','#7ED957','#E07B5C','#C77DFF'];
const DEFAULT_CREW_QUESTIONS = [
  {id:'q1', text:'Has he peed in the last 2–3 hours?'},
  {id:'q2', text:'How is he feeling — any pain, blisters, or chafing?'},
  {id:'q3', text:'Is he eating and drinking enough?'},
  {id:'q4', text:'Does he need anything from his drop bag?'},
  {id:'r1', text:'What would you like to eat? Figs, potatoes, chips, pizza, hamburger, ramen.', type:'reminder'},
  {id:'r2', text:'Do you need to stretch?', type:'reminder'},
  {id:'r3', text:'Relax your shoulders — drop them away from your ears and shake out your arms.', type:'reminder'}
];
// Everyone's personally-chosen favorite color. Auston picked two (white/black), so his
// theme gradient runs between them instead of an auto-computed shade.
const PERSONAL_COLORS = {
  'Victoria': {color:'#510400'},
  'Sydney':   {color:'#A47DAB'},
  'Michelle': {color:'#FFD700'},
  'Grady':    {color:'#6427E2'},
  'Silas':    {color:'#182D09'},
  'Aubrey':   {color:'#FF007F'},
  'Ric':      {color:'#420D09'},
  'Auston':   {color:'#FFFFFF', color2:'#000000'},
};
const CREW_SEED = [
  {name:'Victoria', role:'Manager'},
  {name:'Michelle', role:'Manager'},
  {name:'Auston', role:'Crew'},
  {name:'Grady', role:'Runner'},
  {name:'Silas', role:'Crew'},
  {name:'Ric', role:'Crew'},
  {name:'Sydney', role:'Crew'},
  {name:'Aubrey', role:'Crew'},
].map(c => ({...c, ...PERSONAL_COLORS[c.name]}));
function seedLocalDB(){
  // No database key means the demo (the public website) or local development.
  // Private race details belong in Supabase behind RLS, never in browser source;
  // demo-data.js is made up.
  if(window.HermiscusDemo) return window.HermiscusDemo.build(Date.now());
  return {
    profiles: [], checklist_items: [], splits: [], timeline_events: [], notes: [], config: {}
  };
}
function loadLocalDB(){
  let db = null;
  try{ db = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); }catch(e){}
  // The demo race is built around "now"; a day-old copy would show a finished race.
  if(!db || (window.HermiscusDemo && window.HermiscusDemo.isStale(db, Date.now()))){
    db = seedLocalDB();
    try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(db)); }catch(e){}
  }
  return db;
}
function saveLocalDB(db){ localStorage.setItem(LOCAL_KEY, JSON.stringify(db)); }

// Every Supabase read/write funnels through here so a failed save can never look like a
// success — without checking res.ok, a dropped connection or a blocked write used to fail
// silently while the calling code went right on to render a fresh screen and show "Saved."
// A throw here aborts whatever the caller was about to do next (including any false-success
// toast) and surfaces once via the global unhandledrejection handler below.
async function sbFetch(url, opts){
  const method = (opts && opts.method) || 'GET';
  // Reads retry freely (a dropped GET is safe to repeat). Writes retry only when the connection
  // never opened (fetch threw) — never on an HTTP status, since the write may have half-applied.
  const maxTries = method === 'GET' ? 3 : 2;
  let res = null, lastErr = null;
  for(let attempt = 0; attempt < maxTries; attempt++){
    if(attempt) await new Promise(r => setTimeout(r, 350 * attempt));
    // Hard timeout per attempt — otherwise one hung request on trail service freezes a whole
    // screen indefinitely (this was the "page loads blank until I refresh 3x" bug).
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const to = ctrl ? setTimeout(() => ctrl.abort(), 12000) : null;
    try{
      const authenticatedHeaders = await window.HermiscusAuth.authorizedHeaders((opts && opts.headers) || {});
      const requestOptions = {...(opts || {}), headers:authenticatedHeaders};
      res = await fetch(url, ctrl ? {...requestOptions, signal: ctrl.signal} : requestOptions);
    }catch(e){
      lastErr = e; res = null;
      continue;                                  // network throw / timeout — retry (GET and write)
    }finally{
      if(to) clearTimeout(to);
    }
    if(method === 'GET' && !res.ok && (res.status === 429 || res.status === 408 || res.status >= 500)){
      lastErr = new Error('status ' + res.status); res = null;
      continue;                                  // transient server/rate-limit — retry GET only
    }
    break;
  }
  if(!res){
    reportConnection(false);
    const error=new Error(`Can't reach the database — check your connection. (${lastErr ? lastErr.message : 'no response'})`);
    error.offline=true;
    throw error;
  }
  if(!res.ok){
    reportConnection(false);
    let detail = '';
    try{ detail = await res.text(); }catch(e){}
    throw new Error(`Save failed (${res.status}). ${detail.slice(0,180)}`);
  }
  reportConnection(true);
  // A write of ours — drop the read cache and let the live-sync poll re-baseline silently
  // instead of treating our own change as an incoming update and re-rendering a second time.
  if(method !== 'GET'){ _syncSnapshot = null; _readCache.clear(); }
  return res;
}
// Read coalescing: on load, ~7 render functions each ask for splits/config/etc. at the same
// instant. Without this that's a 15-request burst against the 6-connection browser limit and
// the page renders blank until it drains. This collapses identical concurrent GETs into one
// and holds the result ~2s so the burst shares it. Cleared on any write.
const _readCache = new Map();
async function sbGet(url, opts){
  const now = Date.now();
  const hit = _readCache.get(url);
  // fresh:true skips the ~2s cache — used right before a read-modify-write on a shared jsonb
  // column (bring-list, question answers, assignments) so two crew editing the same stop merge
  // onto each other's latest instead of clobbering.
  if(!(opts && opts.fresh) && hit && (hit.inflight || now - hit.t < 2000)) return hit.promise;
  const promise = sbFetch(url, {headers: sbHeaders()}).then(r => r.json());
  _readCache.set(url, {promise, t: now, inflight: true});
  promise.then(
    () => { const e = _readCache.get(url); if(e){ e.inflight = false; e.t = Date.now(); } },
    () => { _readCache.delete(url); }            // never cache a failure
  );
  return promise;
}
// Profile colors are spliced raw into style="" attributes all over the app, so anything that
// isn't a plain #hex is dropped here, once, rather than trusted at every one of those sites.
function safeHexColor(c){ return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c||'')) ? c : null; }
function cleanProfileRows(table, rows){
  if(table!=='profiles' || !Array.isArray(rows)) return rows;
  return rows.map(p=>({...p, color:safeHexColor(p.color), color2:safeHexColor(p.color2)}));
}
async function dbList(table, order, opts){
  return cleanProfileRows(table, await dbListRows(table, order, opts));
}
async function dbListRows(table, order, opts){
  if(USE_SUPABASE){
    const queue=getOfflineQueue();
    if(!navigator.onLine){
      reportConnection(false);
      const cached=cachedTableRows(table);
      if(cached) return sortDbRows(RIC_LOGIC.applyOfflineQueueToRows(cached,queue,table),order);
      throw offlineDatabaseError();
    }
    try{
      const rows = await sbGet(`${SUPABASE_URL}/rest/v1/${table}?select=*${order?`&order=${order}`:''}`, opts);
      const clean=Array.isArray(rows)?rows.map(r=>({...r})):rows;
      if(Array.isArray(clean)) cacheTableRows(table,clean);
      return Array.isArray(clean)?sortDbRows(RIC_LOGIC.applyOfflineQueueToRows(clean,queue,table),order):clean;
    }catch(error){
      const cached=cachedTableRows(table);
      if(error&&error.offline&&cached) return sortDbRows(RIC_LOGIC.applyOfflineQueueToRows(cached,queue,table),order);
      throw error;
    }
  }
  const db = loadLocalDB();
  let rows = [...db[table]];
  if(order){
    const desc = order.endsWith('.desc');
    const col = order.split('.')[0];
    rows.sort((a,b)=>{
      if(a[col] === b[col]) return 0;
      return (a[col] > b[col] ? 1 : -1) * (desc ? -1 : 1);
    });
  }
  return rows;
}
async function dbInsert(table, row){
  if(USE_SUPABASE){
    const newRow={...row,id:row.id||crypto.randomUUID()};
    if(['notes','profiles','checklist_items'].includes(table)&&!newRow.created_at) newRow.created_at=new Date().toISOString();
    try{
      const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method:'POST', headers:{...sbHeaders(),'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(newRow)
      });
      const data = await res.json();
      const saved=Array.isArray(data)?data[0]:data;
      applyOfflineOperationToCache({kind:'insert',table,row:saved||newRow});
      return saved||newRow;
    }catch(error){
      if(!error||!error.offline) throw error;
      enqueueOfflineWrite({kind:'insert',table,row:newRow});
      return newRow;
    }
  }
  const db = loadLocalDB();
  const newRow = {id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row};
  db[table].push(newRow); saveLocalDB(db);
  return newRow;
}
async function dbUpdate(table, id, patch){
  if(USE_SUPABASE){
    try{
      await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method:'PATCH', headers:{...sbHeaders(),'Content-Type':'application/json'}, body: JSON.stringify(patch)
      });
      applyOfflineOperationToCache({kind:'update',table,rowId:id,patch});
    }catch(error){
      if(!error||!error.offline) throw error;
      enqueueOfflineWrite({kind:'update',table,rowId:id,patch});
    }
    return;
  }
  const db = loadLocalDB();
  const row = db[table].find(r=>r.id===id);
  if(row) Object.assign(row, patch);
  saveLocalDB(db);
}
// Update only if a guard column is still empty — a first-writer-wins lock so two crew members
// tapping "Dad Arrived" at the same second can't clobber each other. Returns true if THIS call
// is the one that landed the write, false if someone else already had.
async function dbUpdateIfNull(table, id, patch, guardCol, staleBeforeIso=null){
  if(USE_SUPABASE){
    try{
      const guardFilter=staleBeforeIso
        ? `&or=${encodeURIComponent(`(${guardCol}.is.null,${guardCol}.lt.${staleBeforeIso})`)}`
        : `&${guardCol}=is.null`;
      const res = await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}${guardFilter}`, {
        method:'PATCH',
        headers:{...sbHeaders(),'Content-Type':'application/json','Prefer':'return=representation'},
        body: JSON.stringify(patch)
      });
      let rows = []; try{ rows = await res.json(); }catch(e){}
      const won=Array.isArray(rows)&&rows.length>0;
      if(won) applyOfflineOperationToCache({kind:'updateIfNull',table,rowId:id,patch,guardCol});
      return won;
    }catch(error){
      if(!error||!error.offline) throw error;
      const cached=(cachedTableRows(table)||[]).find(row=>row.id===id);
      if(cached&&!RIC_LOGIC.guardValueIsOpen(cached[guardCol],staleBeforeIso)) return false;
      enqueueOfflineWrite({kind:'updateIfNull',table,rowId:id,patch,guardCol,staleBeforeIso});
      return true;
    }
  }
  const db = loadLocalDB();
  const row = db[table].find(r=>r.id===id);
  if(!row) return false;
  if(!RIC_LOGIC.guardValueIsOpen(row[guardCol],staleBeforeIso)) return false;
  Object.assign(row, patch);
  saveLocalDB(db);
  return true;
}
async function dbDelete(table, id){
  if(USE_SUPABASE){
    try{
      await sbFetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {method:'DELETE', headers: sbHeaders()});
      applyOfflineOperationToCache({kind:'delete',table,rowId:id});
    }catch(error){
      if(!error||!error.offline) throw error;
      enqueueOfflineWrite({kind:'delete',table,rowId:id});
    }
    return;
  }
  const db = loadLocalDB();
  db[table] = db[table].filter(r=>r.id!==id);
  saveLocalDB(db);
}
async function dbGetConfig(){
  if(USE_SUPABASE){
    const queue=getOfflineQueue();
    if(!navigator.onLine){
      reportConnection(false);
      const cached=cachedConfig();
      if(Object.keys(cached).length) return RIC_LOGIC.applyOfflineQueueToConfig(cached,queue);
      throw offlineDatabaseError();
    }
    try{
      const rows = await sbGet(`${SUPABASE_URL}/rest/v1/config?select=*`);
      const obj = {}; (rows||[]).forEach(r=>obj[r.key]=r.value);
      cacheConfig(obj);
      return RIC_LOGIC.applyOfflineQueueToConfig(obj,queue);
    }catch(error){
      const cached=cachedConfig();
      if(error&&error.offline&&Object.keys(cached).length) return RIC_LOGIC.applyOfflineQueueToConfig(cached,queue);
      throw error;
    }
  }
  const db = loadLocalDB();
  return {...db.config};
}
async function dbSetConfig(key, value){
  if(USE_SUPABASE){
    try{
      await sbFetch(`${SUPABASE_URL}/rest/v1/config`, {
        method:'POST', headers:{...sbHeaders(),'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
        body: JSON.stringify({key, value})
      });
      applyOfflineOperationToCache({kind:'config',key,value});
    }catch(error){
      if(!error||!error.offline) throw error;
      enqueueOfflineWrite({kind:'config',key,value});
    }
    return;
  }
  const db = loadLocalDB(); db.config[key] = value; saveLocalDB(db);
}

// Only Ric's app draws a connection chip; the original app has nothing to update.
function reportConnection(online){
  if(typeof updateRicConnectionStatus==='function') updateRicConnectionStatus(online);
}

