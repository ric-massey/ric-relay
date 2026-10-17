/* One-off probe for the scoring job. Branch only; deleted once the answers are in.
   No coordinates here: every point comes from IEM's station lists at run time. */
const show = (s, n = 500) => String(s).replace(/\s+/g, ' ').slice(0, n);
async function get(label, url, n = 500, ms = 60000) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'ricmassey.com weather probe' }, signal: AbortSignal.timeout(ms) });
    const text = await r.text();
    console.log(`\n### ${label} (${Date.now() - t0} ms, ${text.length} bytes)\n${r.status} ${r.headers.get('content-type')}\n${url.slice(0, 260)}\n${show(text, n)}`);
    return text;
  } catch (e) { console.log(`\n### ${label}\nERROR ${e.message}\n${url.slice(0, 260)}`); return ''; }
}
const IEM = 'https://mesonet.agron.iastate.edu';

/* station lists */
const tn = await get('network TN_ASOS geojson', `${IEM}/geojson/network.py?network=TN_ASOS`, 600);
let st = [];
try { st = JSON.parse(tn).features.map(f => ({ id: f.id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], p: f.properties })); } catch (e) {}
console.log('TN stations', st.length, 'props keys', st[0] && Object.keys(st[0].p).join(','));
console.log('sample', JSON.stringify(st.slice(0, 2).map(s => ({ id: s.id, online: s.p.online, archive_end: s.p.archive_end, network: s.p.network }))));
await get('api networks list', `${IEM}/api/1/networks.json`, 300);
await get('api network TN_ASOS', `${IEM}/api/1/network/TN_ASOS.json`, 400);

/* one day of observations for many stations at once */
const y = new Date(Date.now() - 86400e3); const d = y.toISOString().slice(0, 10);
const [Y, M, D] = d.split('-');
const ids = st.slice(0, 5).map(s => s.id).join('&station=');
await get('asos.py one day, 5 stations, csv', `${IEM}/cgi-bin/request/asos.py?station=${ids}&data=tmpf&data=dwpf&data=sknt&data=p01i&year1=${Y}&month1=${M}&day1=${D}&year2=${Y}&month2=${M}&day2=${D}&tz=Etc/UTC&format=onlycomma&latlon=no&missing=null&trace=0.0001&report_type=3`, 700);
await get('asos.py whole network one day', `${IEM}/cgi-bin/request/asos.py?network=TN_ASOS&data=tmpf&year1=${Y}&month1=${M}&day1=${D}&year2=${Y}&month2=${M}&day2=${D}&tz=Etc/UTC&format=onlycomma&latlon=no&missing=null&report_type=3`, 300);
await get('api obhistory', `${IEM}/api/1/obhistory.json?station=${st[0] && st[0].id}&network=TN_ASOS&date=${d}`, 600);
await get('api daily summary network', `${IEM}/api/1/daily.json?network=TN_ASOS&date=${d}`, 600);

/* every ASOS network: is there one list for the whole country? */
for (const n of ['AZOS', 'ASOS', 'US_ASOS']) await get(`network ${n}`, `${IEM}/geojson/network.py?network=${n}`, 200);

/* Open-Meteo: previous runs, several places at once, several models, NBM */
if (st.length >= 3) {
  const lat = st.slice(0, 3).map(s => s.lat.toFixed(2)).join(','), lon = st.slice(0, 3).map(s => s.lon.toFixed(2)).join(',');
  const prev = await get('previous runs, 3 places, 2 models', `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,temperature_2m_previous_day1,temperature_2m_previous_day2,precipitation_previous_day1&models=gfs_seamless,ecmwf_ifs025&past_days=2&forecast_days=0&timeformat=unixtime`, 900);
  try { const j = JSON.parse(prev); console.log('is array', Array.isArray(j), 'len', j.length, 'keys', Object.keys((Array.isArray(j) ? j[0] : j).hourly).join(',')); } catch (e) { console.log('parse', e.message); }
  for (const m of ['ncep_nbm_conus', 'ncep_hrrr_conus', 'gfs_global', 'best_match', 'ecmwf_aifs025_single', 'icon_seamless', 'gem_seamless']) {
    await get(`previous runs ${m}`, `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${st[0].lat.toFixed(2)}&longitude=${st[0].lon.toFixed(2)}&hourly=temperature_2m_previous_day1,wind_speed_10m_previous_day1,precipitation_previous_day1&models=${m}&past_days=1&forecast_days=0&timeformat=unixtime`, 300);
  }
  await get('forecast NBM now', `https://api.open-meteo.com/v1/forecast?latitude=${st[0].lat.toFixed(2)}&longitude=${st[0].lon.toFixed(2)}&hourly=temperature_2m,precipitation_probability,precipitation&models=ncep_nbm_conus&forecast_hours=6`, 400);
  await get('forecast multi-model one call', `https://api.open-meteo.com/v1/forecast?latitude=${st[0].lat.toFixed(2)}&longitude=${st[0].lon.toFixed(2)}&hourly=temperature_2m,precipitation&models=ncep_hrrr_conus,gfs_global,ecmwf_ifs025,ncep_nbm_conus&forecast_hours=3`, 600);
  /* how many places in one request? */
  const many = st.slice(0, 40);
  await get(`previous runs, ${many.length} places`, `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${many.map(s => s.lat.toFixed(2)).join(',')}&longitude=${many.map(s => s.lon.toFixed(2)).join(',')}&hourly=temperature_2m_previous_day1&models=gfs_seamless&past_days=1&forecast_days=0&timeformat=unixtime`, 200);
  await get('historical forecast api', `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${st[0].lat.toFixed(2)}&longitude=${st[0].lon.toFixed(2)}&hourly=temperature_2m&models=gfs_seamless&start_date=${d}&end_date=${d}`, 300);
}
console.log('\nDONE');
