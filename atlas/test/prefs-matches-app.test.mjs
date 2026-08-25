/* prefs.test.mjs transcribes the sync rules out of app.js so they can be tested
 * without a browser. A transcription rots the moment somebody edits the
 * original, and a rotted one is worse than none — it goes green while the app
 * is broken. This checks the transcription still describes the app.
 *
 * It reads app.js as text on purpose: importing it needs a DOM, a map library
 * and a live Supabase client, none of which have anything to do with the four
 * lines being checked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app.js'), 'utf8');

test('the synced key list is the same in both places', () => {
  const m = app.match(/const SYNCED_PREFS = \[([\s\S]*?)\];/);
  assert.ok(m, 'app.js no longer declares SYNCED_PREFS');
  const inApp = [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]).sort();
  const inTest = ['theme', 'accent', 'glass', 'basemap', 'overlays',
                  'kindFilter', 'scope', 'sources', 'home', 'navApp'].sort();
  assert.deepEqual(inApp, inTest,
    'prefs.test.mjs is testing a different set of settings than the app syncs');
});

test('nothing that belongs to the device has crept into the synced list', () => {
  const m = app.match(/const SYNCED_PREFS = \[([\s\S]*?)\];/);
  const inApp = [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]);
  for (const deviceOnly of ['useLocation', 'lastView', 'me', 'people', 'lastSync']) {
    assert.equal(inApp.includes(deviceOnly), false,
      `${deviceOnly} is a fact about this device and must not follow the person`);
  }
});

test('the three rules that stop the sync going backwards are still there', () => {
  assert.match(app, /if \(restoring\) return;/,
    'savePref no longer skips the clock while restoring — every boot will look like a change');
  assert.match(app, /if \(mine > theirs\)/,
    'adoptPrefs no longer compares change times — an offline change can be overwritten');
  assert.match(app, /local\.set\('prefsAt', theirs\)/,
    'adoptPrefs no longer inherits the adopted time — two devices will ping-pong');
});

test('applyPrefs and reapplyToMap both release the restoring flag', () => {
  const guards = [...app.matchAll(/restoring = true;/g)].length;
  const releases = [...app.matchAll(/finally \{ restoring = false; \}/g)].length;
  assert.equal(guards, releases,
    'a restoring flag left set makes every later change stop saving, silently');
});
