/*
 * HERMISCUS demo race. Everything in this file is MADE UP.
 *
 * When the app has no database key (which is always the case on the public website),
 * it runs on this instead. Nothing here is the real plan: no real lodging, no real
 * addresses, no real notes. The course shape mirrors the public race course so the
 * screens read true, and the dates are built relative to "now" so the demo is always
 * the run-up to race day: the plan is set, nobody has checked in anywhere yet.
 *
 * Edits made in the demo live only in that visitor's browser (localStorage), and the
 * whole thing re-seeds itself after DEMO_MAX_AGE_MS so it never goes stale.
 *
 * Never paste anything from the real database into this file.
 */
(() => {
  'use strict';

  const DEMO_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const DAYS_TO_RACE = 16;
  // Bump when the demo's story changes, so a browser holding the old one re-seeds.
  const DEMO_VERSION = 2;

  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const P = {
    ric: id(1), silas: id(2), grady: id(3), auston: id(4),
    michelle: id(5), sydney: id(6), aubrey: id(7), victoria: id(8)
  };

  const profiles = [
    ['Victoria', 'Manager', '#510400', null, P.victoria],
    ['Michelle', 'Manager', '#FFD700', null, P.michelle],
    ['Auston', 'Crew', '#FFFFFF', '#000000', P.auston],
    ['Grady', 'Runner', '#6427E2', null, P.grady],
    ['Silas', 'Crew', '#182D09', null, P.silas],
    ['Ric', 'Crew', '#420D09', null, P.ric],
    ['Sydney', 'Crew', '#A47DAB', null, P.sydney],
    ['Aubrey', 'Crew', '#FF007F', null, P.aubrey],
  ];

  // [mile, station, planned elapsed sec, gain, loss, big stop, checkpoint cutoff h, crew note, assigned]
  const course = [
    [0.0, 'Start', 0, 0, 0, false, null, 'Start line', ['michelle', 'victoria', 'ric', 'grady', 'sydney', 'silas']],
    [3.8, 'Watauga', 2100, 41, 157, false, null, 'No crew', ['michelle', 'grady']],
    [9.5, 'Alvarado', 5400, 43, 211, false, null, 'No crew', ['michelle', 'victoria', 'grady']],
    [16.0, 'Damascus', 9300, 183, 16, true, null, 'Take vest / give 2 handhelds & 2 gels', ['ric', 'victoria', 'michelle', 'grady', 'sydney']],
    [20.0, 'Damascus', 11760, 127, 117, false, null, 'Vest and one handheld', ['victoria', 'ric', 'michelle', 'grady', 'sydney']],
    [26.5, 'Alvarado', 15660, 7, 184, false, null, 'Fill empty vest / no handheld', ['michelle', 'victoria', 'grady', 'sydney']],
    [32.2, 'Watauga', 19260, 215, 47, false, null, 'Swap bottles, sunscreen', ['michelle', 'ric', 'grady', 'sydney']],
    [35.9, 'Turnaround', 21660, 156, 40, true, 10.2, 'Full aid — vest only', ['michelle', 'victoria', 'grady']],
    [39.7, 'Watauga', 24000, 41, 157, false, null, 'Vest only', ['michelle', 'grady']],
    [45.4, 'Alvarado', 27600, 43, 211, false, null, 'Vest only', ['michelle', 'aubrey', 'grady']],
    [52.0, 'Damascus', 31860, 183, 16, true, null, 'RIC PACING (vest and handheld)', ['ric', 'michelle', 'grady']],
    [58.5, 'Alvarado', 36000, 17, 183, false, null, 'MICHELLE PACING', ['michelle', 'grady']],
    [64.2, 'Watauga', 39840, 215, 47, false, null, 'MICHELLE CONT. PACING', ['michelle', 'grady']],
    [68.0, 'Turnaround', 42420, 156, 40, true, 19.25, 'SILAS PACING', ['michelle', 'silas']],
    [71.7, 'Watauga', 44940, 41, 157, false, null, 'VICTORIA PACING', ['michelle']],
    [77.4, 'Alvarado', 48780, 43, 211, false, null, 'AUSTON PACING', ['michelle', 'auston']],
    [84.0, 'Damascus', 53340, 183, 16, true, null, 'SILAS PACING', ['michelle', 'ric']],
    [90.5, 'Alvarado', 57900, 17, 183, false, null, 'RIC PACING', ['ric', 'michelle']],
    [96.3, 'Watauga', 61980, 215, 47, false, null, 'RIC CONT PACING', ['michelle']],
    [100.0, 'Finish', 64800, 156, 40, false, 30, 'Finish!', ['michelle', 'victoria']],
  ];

  const pad2 = n => String(n).padStart(2, '0');
  const localDate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const bring = (stopNo, labels) => labels.map((label, i) => ({ id: id(5000 + stopNo * 10 + i), label, checked: false, checked_by: null }));

  function build(nowMs) {
    const official = new Date(nowMs + DAYS_TO_RACE * 24 * 3600 * 1000);
    const officialEnd = new Date(official.getTime() + 24 * 3600 * 1000);
    const at = sec => new Date(nowMs + sec * 1000).toISOString();
    const nameOf = key => profiles.find(p => p[4] === P[key])[0];

    const splits = course.map(([mile, station, planned, gain, loss, big, cutoff, note, crew], i) => {
      const prev = course[i - 1];
      const legMiles = prev ? +(mile - prev[0]).toFixed(1) : 0;
      const legSec = prev ? planned - prev[2] : 0;
      const pace = legMiles ? `${Math.floor(legSec / legMiles / 60)}:${pad2(Math.round(legSec / legMiles % 60))}/mi` : '';
      return {
        id: id(100 + i), sort_order: i, mile, station: i === 0 ? 'Start' : station,
        elapsed_seconds: planned, delay_seconds: i === course.length - 1 ? 0 : 120,
        sub: prev ? `${legMiles} mi · +${gain}/-${loss} ft · ${pace}` : '',
        note: '', is_custom: false, created_at: at(-86400),
        actual_elapsed_seconds: null, actual_logged_at: null, actual_logged_by: null,
        departed_elapsed_seconds: null, departed_logged_at: null, departed_logged_by: null,
        skipped: false, station_note: '', station_note_by: null, flag_forward: false,
        assigned_to: crew.map(k => P[k]), address: '',
        bring_items: i === 0 ? bring(i, ['6 gels', 'Vest', '2 handhelds'])
          : note === 'No crew' || i === course.length - 1 ? []
          : bring(i, big ? ['3 gels', 'Tailwind jug', 'Water'] : ['Tailwind', 'Gels ×3', 'Water']),
        elevation_gain_ft: gain, elevation_loss_ft: loss, is_big_stop: big,
        official_note: note, is_checkpoint: cutoff != null, checkpoint_cutoff_hours: cutoff,
        question_answers: {}
      };
    });

    const categories = {
      'Nutrition & Fuel': ['Gels', 'Potato chips', 'Ginger chews', 'PB&J squares', 'Salt tabs'],
      'Hydration': ['Tailwind', 'Ice-cold water', 'Spare soft flask'],
      'Footwear & Feet': ['Spare shoes (half size up)', 'Dry socks ×3', 'Blister kit'],
      'Clothing': ['Night layer', 'Dry shirt', 'Gloves'],
      'Electronics': ['Headlamps + spare batteries', 'Phone battery pack'],
      'Medical & Body Care': ['Sunscreen', 'Anti-chafe', 'Tums'],
      'Crew Camp Gear': ['Camp chair', 'Cooler', 'Trash bags'],
    };
    let order = 0;
    const checklist_items = Object.entries(categories).flatMap(([category, labels]) => labels.map(label => {
      const checked = order % 4 === 0;
      return {
        id: id(3000 + order), category, label, checked, checked_by: checked ? 'Victoria' : null,
        assigned_to: null, assigned_to_ids: [], is_custom: false, sort_order: order++, created_at: at(-86400)
      };
    }));

    const ev = (n, day, s, title, notes, att = []) => ({
      id: id(4000 + n), sort_order: n, day_label: day,
      time_text: JSON.stringify({ s, e: s + 60, v: 'public', by: null, att, addr: '' }),
      title, notes, created_at: at(-86400)
    });
    const timeline_events = [
      ev(0, 'Thu', 960, 'Arrive & check in (demo cabin)', 'Made-up lodging for the demo'),
      ev(1, 'Thu', 1080, 'Team dinner — go over the crew sheet', ''),
      ev(2, 'Fri', 330, 'Leave for the start line', 'Coffee on the way'),
      ev(3, 'Fri', 420, 'Race starts', ''),
      ev(4, 'Fri', 1080, 'First full-aid crew stop', 'First real restock'),
      ev(5, 'Sat', 0, 'Overnight crew stop', "Bring headlamps, it'll be cold"),
      ev(6, 'Sat', 60, 'Estimated finish — goal pace', ''),
      ev(7, 'Sun', 660, 'Checkout', ''),
    ];

    const note = (n, key, body, minutesAgo) => ({
      id: id(6000 + n), author: nameOf(key), body,
      created_at: new Date(nowMs - minutesAgo * 60000).toISOString()
    });
    const notes = [
      note(0, 'victoria', 'This is the demo — nothing here is real. Tap around!', 300),
      note(1, 'michelle', 'Everyone watch the crewing video before race weekend!', 2880),
      note(2, 'sydney', '[[HERMESCO_FLAGGED]]\nWho is bringing the camp chairs?', 180),
    ];

    const config = {
      race_name: 'Demo 100 Mile Endurance Run',
      race_location: 'Demo course',
      race_description: 'A made-up race so the crew app can be shown off. Nothing here is real.',
      race_start: localDate(official), race_end: localDate(officialEnd), race_start_time: '07:00',
      simulation_started_at: '',
      bib_number: '100', tracking_url: '', official_site_url: '', ultrapacer_url: '',
      goal_finish_hours: '18', cutoff_hours: '30', crew_access_mile: '0',
      checkpoint1_mile: '35.9', checkpoint1_cutoff_hours: '10.2',
      checkpoint2_mile: '68.0', checkpoint2_cutoff_hours: '19.25',
      checkpoint3_mile: '100.0', checkpoint3_cutoff_hours: '30',
      aid_delay_minutes: '2', rest_normal_min: '2', rest_big_min: '6',
      fade_factor: '0.18', gap_gain_weight: '1.2', gap_loss_weight: '-0.35',
      lodging_name: 'Demo Cabin', lodging_address: '123 Example Lane',
      lodging_checkin: 'Thu, 4:00 PM', lodging_checkout: 'Sun, 10:00 AM', lodging_notes: 'Not a real place.',
      dawn_time: 'Fri 6:55 AM', sunrise_time: 'Fri 7:20 AM', sunset_time: 'Fri 7:20 PM', dusk_time: 'Fri 7:46 PM',
      daylight_duration: '11:59:47 (68.7 mi)', twilight_duration: '0:46:21 (4.5 mi)', dark_duration: '5:13:52 (26.8 mi)',
      plan_average_pace: '10:09', plan_moving_pace: '10:26', plan_overall_pace: '10:48',
      plan_starting_pace: '9:08', plan_ending_pace: '11:10', plan_fatigue_pct: '+20.0%',
      plan_elev_gain_total: '+2,077 ft', plan_elev_loss_total: '-2,077 ft',
      plan_altitude_high: '2,066 ft', plan_altitude_low: '1,751 ft',
      plan_steepest_climb: '8.7% grade', plan_steepest_descent: '-5.9% grade', plan_terrain_factor: '+2.0%',
      sit_time_rule: 'Give him a 1-minute time check when he arrives, then updates every 30 seconds up to 2 minutes.',
      reasons_to_stop: 'A genuine injury, or a medic pulling him. Everything else: keep moving.',
      quit_protocol: 'Say "Hell no! You must go!" Then ask: are you hurt, or just tired?',
      pacing_instructions: 'Stay a step behind. Talk about anything but the miles left.',
      crew_questions: JSON.stringify([
        { id: 'q1', text: 'Has he peed in the last 2–3 hours?' },
        { id: 'q2', text: 'How is he feeling — any pain, blisters, or chafing?' },
        { id: 'q3', text: 'Is he eating and drinking enough?' },
        { id: 'r1', text: 'What would you like to eat? Chips, potatoes, pizza, ramen.', type: 'reminder' },
        { id: 'r2', text: 'Relax your shoulders.', type: 'reminder' }
      ]),
      target_splits: '',
    };

    return {
      demo_seeded_at: nowMs, demo_version: DEMO_VERSION,
      profiles: profiles.map(([name, role, color, color2, pid], i) => ({
        id: pid, name, role, color, color2, created_at: new Date(nowMs - 86400000 + i * 1000).toISOString()
      })),
      checklist_items, splits, timeline_events, notes, config
    };
  }

  function isStale(db, nowMs) {
    return !db || db.demo_version !== DEMO_VERSION || !Number.isFinite(db.demo_seeded_at) ||
      nowMs - db.demo_seeded_at > DEMO_MAX_AGE_MS;
  }

  window.HermiscusDemo = Object.freeze({ build, isStale });
})();
