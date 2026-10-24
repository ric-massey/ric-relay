/* WATCHES — conditions a visitor asks the page to keep an eye on
   ────────────────────────────────────────────────────────────────────────────
   Built 2026-10-24 (an outside review Ric passed on: "Let someone define
   conditions they care about … Show confidence and timestamps, and don't
   position experimental forecasts as guaranteed safety alerts").

   A watch is a condition at the visitor's saved place; check() reads what
   the page already has and says whether it is met, when, and from what.
   It runs only while the page is open — there is no server sending these —
   and it is a reminder, never a warning service: an NWS warning is shown
   as the NWS issued it, and no watch says go or no-go (the room's rule).

   Kinds:   rain      the radar nowcast has rain here within `minutes`
            gust      a forecast gust of `mph` or more within `hours`
            cold      a forecast temperature at or below `f` within `hours`
            heat      a forecast temperature at or above `f` within `hours`
            warning   any NWS warning in force at the place
            lightning a GOES lightning flash within `miles` in the last `minutes`

   ctx: { now, hourly: [{ t (ms), temp (°C), gust (km/h) }], fcAt,
          nowcast: { kind, at (min after the radar picture) } | null, radarAt (when
          that picture was scanned, ms — its minutes are counted from now here), nowAt,
          alerts: [{ event, ends }] | null, flashes: [{ lat, lon, t }], ltgAt,
          place: { lat, lon } }
   Pure: no DOM, no network. */
(function (root) {
  'use strict';
  const C2F = (c) => c * 9 / 5 + 32, KMH2MPH = 1 / 1.609344;
  const KINDS = {
    rain: { label: 'Rain starting here', defaults: { minutes: 30 } },
    gust: { label: 'Wind gusts', defaults: { mph: 40, hours: 24 } },
    cold: { label: 'Cold — at or below', defaults: { f: 32, hours: 24 } },
    heat: { label: 'Heat — at or above', defaults: { f: 95, hours: 24 } },
    warning: { label: 'Any NWS warning here', defaults: {} },
    lightning: { label: 'Lightning nearby', defaults: { miles: 10, minutes: 15 } }
  };
  function distMi(a, b) {
    const R = 3958.8, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /* → { met: bool, known: bool, text, key, from } — `key` names the event, so one event reminds once */
  function check(w, ctx) {
    const now = ctx.now || Date.now();
    if (w.kind === 'rain') {
      const n = ctx.nowcast;
      if (!n) return { met: false, known: false, text: 'No radar nowcast for this place (it covers the lower 48).', from: 'radar nowcast' };
      if (n.kind === 'raining') return { met: true, known: true, text: 'Raining here now, on radar.', key: 'rain-now', from: 'radar nowcast' };
      /* the nowcast counts from its radar picture, which is minutes old: the lead is from now
         (2026-10-24 — a watch said "no rain in 30 min" beside a nowcast saying "in about 30 min") */
      const lead = n.at - (ctx.radarAt ? Math.max(0, (now - ctx.radarAt) / 60e3) : 0);
      if (n.kind === 'starting' && lead <= w.minutes) return { met: true, known: true, text: `Rain likely in about ${Math.max(1, Math.round(lead))} min, on radar.`, key: `rain-${Math.round((ctx.nowAt || now) / 1800e3)}`, from: 'radar nowcast' };
      return { met: false, known: true, text: n.kind === 'ending' ? 'Rain moving off.' : `No rain heading here in the next ${w.minutes} min on radar.`, from: 'radar nowcast' };
    }
    if (w.kind === 'gust' || w.kind === 'cold' || w.kind === 'heat') {
      const H = (ctx.hourly || []).filter((h) => h.t >= now - 1800e3 && h.t <= now + w.hours * 3600e3);
      if (!H.length) return { met: false, known: false, text: 'No forecast to read yet.', from: 'forecast' };
      const hit = H.find((h) => w.kind === 'gust' ? h.gust != null && h.gust * KMH2MPH >= w.mph : h.temp != null && (w.kind === 'cold' ? C2F(h.temp) <= w.f : C2F(h.temp) >= w.f));
      if (!hit) return { met: false, known: true, text: `None forecast in the next ${w.hours} h.`, from: 'forecast' };
      const v = w.kind === 'gust' ? `${Math.round(hit.gust * KMH2MPH)} mph gusts` : `${Math.round(C2F(hit.temp))} °F`;
      return { met: true, known: true, at: hit.t, text: `${v} forecast`, key: `${w.kind}-${hit.t}`, from: 'forecast' };   // the page adds when, in the place's own clock
    }
    if (w.kind === 'warning') {
      if (!ctx.alerts) return { met: false, known: false, text: 'The NWS has not answered yet.', from: 'NWS' };
      const W = ctx.alerts.filter((a) => /Warning/.test(a.event || ''));
      if (!W.length) return { met: false, known: true, text: 'No NWS warning in force here.', from: 'NWS' };
      return { met: true, known: true, text: W.map((a) => a.event).join(', ') + ' in force here, as the NWS issued it.', key: 'warn-' + W.map((a) => a.id || a.event).join('|'), from: 'NWS' };
    }
    if (w.kind === 'lightning') {
      if (!ctx.place || !ctx.flashes) return { met: false, known: false, text: 'No lightning data yet.', from: 'GOES lightning' };
      const near = ctx.flashes.filter((f) => f.t >= now - w.minutes * 60e3 && distMi(ctx.place, f) <= w.miles);
      if (!near.length) return { met: false, known: true, text: `No flash within ${w.miles} mi in the last ${w.minutes} min.`, from: 'GOES lightning' };
      const d = Math.min(...near.map((f) => distMi(ctx.place, f)));
      return { met: true, known: true, text: `${near.length} flash${near.length === 1 ? '' : 'es'} within ${w.miles} mi in the last ${w.minutes} min — the nearest about ${Math.max(1, Math.round(d))} mi away.`, key: `ltg-${Math.floor(now / (w.minutes * 60e3))}`, from: 'GOES lightning' };
    }
    return { met: false, known: false, text: 'Unknown watch.', from: '' };
  }
  function describe(w) {
    const k = KINDS[w.kind];
    if (!k) return '';
    return w.kind === 'rain' ? `Rain here within ${w.minutes} min` : w.kind === 'gust' ? `Gusts of ${w.mph} mph or more in the next ${w.hours} h`
      : w.kind === 'cold' ? `${w.f} °F or colder in the next ${w.hours} h` : w.kind === 'heat' ? `${w.f} °F or hotter in the next ${w.hours} h`
      : w.kind === 'warning' ? 'Any NWS warning here' : `Lightning within ${w.miles} mi in the last ${w.minutes} min`;
  }
  /* a stored watch, checked: only the kinds and the numbers in their ranges come back */
  function clean(w) {
    if (!w || !KINDS[w.kind]) return null;
    const n = (x, lo, hi, d) => { const v = Number(x); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d; };
    const D = KINDS[w.kind].defaults, out = { id: String(w.id || Math.random().toString(36).slice(2, 10)).slice(0, 12), kind: w.kind, on: w.on !== false };
    if ('minutes' in D) out.minutes = n(w.minutes, 5, w.kind === 'rain' ? 60 : 60, D.minutes);
    if ('hours' in D) out.hours = n(w.hours, 1, 72, D.hours);
    if ('mph' in D) out.mph = n(w.mph, 10, 150, D.mph);
    if ('f' in D) out.f = n(w.f, -60, 130, D.f);
    if ('miles' in D) out.miles = n(w.miles, 1, 100, D.miles);
    return out;
  }
  const api = { KINDS, check, describe, clean, distMi };
  root.WxWatches = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
