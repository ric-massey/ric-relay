/* Run: node test/photos.test.mjs
 *
 * The canvas half of photos.js needs a browser, but the two things that can go
 * wrong quietly do not. Object paths ARE the permission model — the storage
 * policies read the pin and the uploader straight out of the name — so a path
 * built wrong is a photo the database refuses, or worse, one it shouldn't have
 * accepted. And the resize arithmetic decides what a photo costs on a free
 * tier, over cell data, from a canyon rim.
 */
import assert from 'node:assert/strict';
import { fitDims, photoPath, pinIdFromPath, MAX_EDGE } from '../photos.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

console.log('photo paths');

const PIN  = '11111111-2222-3333-4444-555555555555';
const USER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PHOTO = '99999999-8888-7777-6666-555555555555';

test('the path is pin / uploader / photo, which is what the policies read', () => {
  assert.equal(photoPath(PIN, USER, PHOTO), `${PIN}/${USER}/${PHOTO}.jpg`);
});

test('segment 1 is the pin, so a photo cannot be smuggled onto another one', () => {
  // Mirrors public.uuid_segment(name, 1) in the pin_photos migration: get this
  // wrong and every photo is filed against the wrong pin's privacy rule.
  assert.equal(pinIdFromPath(photoPath(PIN, USER, PHOTO)), PIN);
});

console.log('resizing');

test('a big photo is capped on its longest edge', () => {
  assert.deepEqual(fitDims(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(fitDims(3024, 4032), { width: 1200, height: 1600 });
});

test('a small photo is left alone rather than blown up', () => {
  assert.deepEqual(fitDims(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitDims(MAX_EDGE, MAX_EDGE), { width: MAX_EDGE, height: MAX_EDGE });
});

test('nothing ever rounds away to zero, however odd the shape', () => {
  // A panorama, and the degenerate slivers either side of it. A zero here is a
  // canvas that throws rather than a photo that looks wrong.
  for (const [w, h] of [[4032, 3024], [6000, 200], [200, 6000], [1, 9000], [9000, 1]]) {
    const out = fitDims(w, h);
    assert.ok(out.width >= 1 && out.height >= 1, `${w}x${h} collapsed to nothing`);
    assert.ok(Math.max(out.width, out.height) <= MAX_EDGE, `${w}x${h} exceeded the cap`);
  }
});

test('aspect ratio survives the rounding', () => {
  // Compared as a fraction of the ratio, not an absolute difference: a 30:1
  // panorama is allowed to drift thirty times as far as a 1:1 square before it
  // is distorted by the same amount. Slivers whose short edge rounds to a
  // single pixel are excluded — one pixel cannot carry a ratio, and the test
  // above is what guards those.
  for (const [w, h] of [[4032, 3024], [3024, 4032], [6000, 200], [200, 6000], [1920, 1080]]) {
    const out = fitDims(w, h);
    if (Math.min(out.width, out.height) < 2) continue;
    const want = w / h;
    const got = out.width / out.height;
    assert.ok(Math.abs(got - want) / want < 0.01,
      `${w}x${h} came back distorted as ${out.width}x${out.height}`);
  }
});

console.log(`\n${passed} passed`);
