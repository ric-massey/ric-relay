/* The settings sync, tested without a browser.
 *
 * The rule under test is the one that is easy to get wrong and impossible to
 * notice: which copy wins. "The server is always right" loses work made with no
 * signal, and "stamp the time on every write" makes every device look newest
 * because putting a saved setting back into a control goes through the same
 * setter a tap does. Both of those bugs were written and both are pinned here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SYNCED_PREFS = ['theme', 'accent', 'glass', 'basemap', 'overlays',
                      'kindFilter', 'scope', 'sources', 'home'];

/* A stand-in for the IndexedDB meta store, and for app.js's two module flags.
 * The logic below is a transcription of savePref/adoptPrefs — kept honest by
 * test/prefs-matches-app.test.mjs, which fails if app.js drifts from it. */
function makeDevice(clock) {
  const store = new Map();
  let restoring = false;
  let pushed = null;

  const savePref = (key, value) => {
    store.set(key, value);
    if (restoring) return;
    store.set('prefsAt', clock());
  };

  const pushPrefs = () => {
    const prefs = { at: store.get('prefsAt') ?? clock() };
    for (const k of SYNCED_PREFS) if (store.has(k)) prefs[k] = store.get(k);
    pushed = prefs;
    return prefs;
  };

  const adoptPrefs = (prefs) => {
    if (!prefs || typeof prefs !== 'object') return false;
    const keys = SYNCED_PREFS.filter((k) => prefs[k] !== undefined);
    if (!keys.length) return false;
    const mine = store.get('prefsAt') || 0;
    const theirs = Number(prefs.at) || 0;
    if (mine > theirs) { pushPrefs(); return false; }
    for (const k of keys) store.set(k, prefs[k]);
    store.set('prefsAt', theirs);
    return true;
  };

  return {
    store, savePref, pushPrefs, adoptPrefs,
    get pushed() { return pushed; },
    restore(fn) { restoring = true; try { fn(); } finally { restoring = false; } },
  };
}

test('the newer side wins, whichever side that is', () => {
  let now = 1000;
  const clock = () => now;
  const laptop = makeDevice(clock);
  const phone = makeDevice(clock);

  now = 1000; laptop.savePref('basemap', 'topo');
  const fromLaptop = laptop.pushPrefs();

  // Phone has never changed anything: it takes the laptop's.
  assert.equal(phone.adoptPrefs(fromLaptop), true);
  assert.equal(phone.store.get('basemap'), 'topo');
});

test('a change made with no signal is not overwritten by the older server copy', () => {
  let now = 1000;
  const clock = () => now;
  const laptop = makeDevice(clock);
  const phone = makeDevice(clock);

  now = 1000; laptop.savePref('basemap', 'topo');
  const stale = laptop.pushPrefs();

  // Phone, in a canyon, picks satellite. Nothing is sent.
  now = 2000; phone.savePref('basemap', 'sat');

  // Back in range, the server still holds the older answer.
  assert.equal(phone.adoptPrefs(stale), false, 'must not adopt an older copy');
  assert.equal(phone.store.get('basemap'), 'sat', 'the canyon choice survives');
  assert.equal(phone.pushed.basemap, 'sat', 'and is sent up instead');
});

test('restoring at boot is not a change', () => {
  let now = 1000;
  const clock = () => now;
  const phone = makeDevice(clock);

  now = 1000; phone.savePref('basemap', 'topo');
  assert.equal(phone.store.get('prefsAt'), 1000);

  // The app reopens much later and puts every saved setting back.
  now = 9999;
  phone.restore(() => {
    phone.savePref('basemap', 'topo');
    phone.savePref('theme', 'day');
  });
  assert.equal(phone.store.get('prefsAt'), 1000,
    'boot must not stamp the clock, or every device looks like the newest one');
});

test('adopting sets the clock to what was adopted, not to now', () => {
  let now = 5000;
  const clock = () => now;
  const phone = makeDevice(clock);
  assert.equal(phone.adoptPrefs({ at: 1000, basemap: 'topo' }), true);
  assert.equal(phone.store.get('prefsAt'), 1000,
    'or the next tick would look newer than it is and the two would ping-pong');
});

test('an empty or missing prefs blob changes nothing', () => {
  const phone = makeDevice(() => 1);
  phone.savePref('basemap', 'sat');
  for (const junk of [null, undefined, {}, { at: 9e9 }, 'nonsense', 42]) {
    assert.equal(phone.adoptPrefs(junk), false);
  }
  assert.equal(phone.store.get('basemap'), 'sat');
});

test('only synced keys travel — device facts stay put', () => {
  const phone = makeDevice(() => 1);
  phone.savePref('basemap', 'sat');
  phone.store.set('useLocation', false);
  phone.store.set('lastView', { center: [1, 2], zoom: 9 });
  const sent = phone.pushPrefs();
  assert.equal(sent.basemap, 'sat');
  assert.equal('useLocation' in sent, false, 'location consent is the phone’s, not the person’s');
  assert.equal('lastView' in sent, false, 'where this device was is not a setting');
});
