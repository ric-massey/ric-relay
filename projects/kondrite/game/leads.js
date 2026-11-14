"use strict";

/* KONDRITE - SURVEY - LEADS
   -----------------------------------------------------------------
   Two things you pick up during the opening that are not yours to finish
   yet: a tracker that is not one of your six, and a signal that answers
   the beacon. Each is a bearing to a real place, kept until you find it.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them - see README.md, "Where it lives". */

/* === LEADS ===============================================================
   WORLD-IDEAS.md: "Leave a lead before the opening ends ... so completing the
   opening leaves them with somewhere they already want to go", and
   "Exploration could leave unfinished business". No lead had been chosen;
   Ric, 2026-11-14, shown two, chose both.

   A lead is a pointer at a landmark that already stands in the sector - it
   makes nothing. If that landmark is already logged, or this sector was dealt
   without it, there is no lead and nothing is said.

   It keeps the rule this mode's navigation has never broken: nothing hands
   you a position. A lead is a bearing from your own station and a word for
   how far, on COMMS, on the missions page, and as a line across the chart. */

const LEADS = [
  /* **How far each one is, is the sector's business.** Which landmark stands
     on which rung of the ladder is dealt per world: measured over four seeds,
     the last transmission stood 27,000 units out in one and six million in
     another, and the vault 49,000 and 1,900,000. So neither lead is "the near
     one" - the words below claim nothing about distance (and are short: the
     missions page gives them twenty-eight characters), the page prints the
     range it really is, and the arrow takes whichever a tank can reach. */
  // Aboard with the first part, at the wreck field.
  { key: "tracker", at: "vault", colour: "#ffcb42",
    name: "A TRACKER THAT IS NOT YOURS",
    text: "found beside the drive spar" },
  // When the beacon is lit.
  { key: "answer", at: "last-transmission", colour: "#87d8ff",
    name: "SOMETHING ANSWERED THE BEACON",
    text: "one reply, on a dead band" }
];

const leadBook = () => (surv.leads || (surv.leads = []));
const leadMark = key => surv.landmarks.find(l => l.key === key);

function giveLead(key) {
  if (!surv || LEV_ONLY) return false;
  const spec = LEADS.find(l => l.key === key);
  if (!spec || leadBook().indexOf(key) >= 0) return false;
  const lm = leadMark(spec.at);
  if (!lm || lm.found) return false;
  leadBook().push(key);
  /* Unconfirmed, and with no place on it: the transmission says which way
     from home and nothing more. */
  transmit({ kind: "news", source: "unconfirmed", colour: spec.colour,
             text: spec.name + " — BEARING " +
                   String(bearingTo(HOME_STATION, lm)).padStart(3, "0") +
                   " FROM HOME" });
  saveSurveyBook();
  return true;
}

// The ones still open: given, standing, and not yet logged.
function openLeads() {
  if (!surv || !surv.leads) return [];
  const out = [];
  for (const key of surv.leads) {
    const spec = LEADS.find(l => l.key === key);
    const lm = spec && leadMark(spec.at);
    if (lm && !lm.found) out.push({ spec, lm });
  }
  return out;
}

/* The lead the arrow takes once the station is whole: the nearest one a tank
   can reach. One past your range stays on the page and off the arrow - the
   arrow does not send you somewhere you cannot come back from. */
function leadInReach() {
  const reach = surveyReach();
  let best = null, bd = Infinity;
  for (const l of openLeads()) {
    const d = fromHome(l.lm);
    if (d <= reach && d < bd) { bd = d; best = l; }
  }
  return best;
}

function leadsState() {
  const reach = surveyReach();
  return openLeads().map(l => {
    const d = fromHome(l.lm);
    return { key: l.spec.key, name: l.spec.name, text: l.spec.text,
             colour: l.spec.colour,
             bearing: bearingTo(HOME_STATION, l.lm),
             range: d > reach ? "past your range" : rangeBand(d),
             // For the chart's line: where it starts and which way it runs.
             hx: HOME_STATION.x, hy: HOME_STATION.y,
             ang: Math.atan2(l.lm.y - HOME_STATION.y, l.lm.x - HOME_STATION.x) };
  });
}

const leadsToBook = () => leadBook().slice();
const leadsFromBook = saved =>
  (Array.isArray(saved) ? saved : [])
    .filter((k, i, a) => LEADS.some(l => l.key === k) && a.indexOf(k) === i);
