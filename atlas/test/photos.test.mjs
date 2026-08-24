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
import {
  fitDims, photoPath, pinIdFromPath, MAX_EDGE,
  squareCrop, avatarPath, avatarOwnerFromPath, AVATAR_EDGE,
} from '../photos.js';

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

console.log('avatars');

const AVATAR = '77777777-6666-5555-4444-333333333333';

test('the path is owner / avatar, which is what the policies read', () => {
  assert.equal(avatarPath(USER, AVATAR), `${USER}/${AVATAR}.jpg`);
});

test('segment 1 is the owner, so nobody can write a face over yours', () => {
  // Mirrors public.uuid_segment(name, 1) in the avatars migration, which is the
  // only thing standing between "my picture" and "anyone's picture".
  assert.equal(avatarOwnerFromPath(avatarPath(USER, AVATAR)), USER);
});

test('a new picture is a new path, which is what makes the path a cache key', () => {
  const a = avatarPath(USER, '11111111-1111-1111-1111-111111111111');
  const b = avatarPath(USER, '22222222-2222-2222-2222-222222222222');
  assert.notEqual(a, b, 'two faces for one person share a path and one wins');
});

test('the crop is the biggest square in the middle, whichever way up it is', () => {
  // Landscape: the sides come off. Portrait: the top and bottom do. Getting
  // this backwards crops somebody's face out of their own avatar.
  assert.deepEqual(squareCrop(4000, 3000), { sx: 500, sy: 0, side: 3000, out: AVATAR_EDGE });
  assert.deepEqual(squareCrop(3000, 4000), { sx: 0, sy: 500, side: 3000, out: AVATAR_EDGE });
  assert.deepEqual(squareCrop(1000, 1000), { sx: 0, sy: 0, side: 1000, out: AVATAR_EDGE });
});

test('a small picture is cropped but never blown up', () => {
  assert.deepEqual(squareCrop(90, 90), { sx: 0, sy: 0, side: 90, out: 90 });
  assert.deepEqual(squareCrop(300, 120), { sx: 90, sy: 0, side: 120, out: 120 });
});

test('nothing rounds away to nothing, however odd the shape', () => {
  // A zero here is a canvas that throws rather than a face that looks wrong.
  for (const [w, h] of [[6000, 200], [200, 6000], [1, 9000], [9000, 1], [1, 1]]) {
    const c = squareCrop(w, h);
    assert.ok(c.side >= 1 && c.out >= 1, `${w}x${h} collapsed to nothing`);
    assert.ok(c.sx >= 0 && c.sy >= 0, `${w}x${h} crops from outside the image`);
    assert.ok(c.sx + c.side <= Math.max(w, c.side), `${w}x${h} crops past the edge`);
    assert.ok(c.out <= AVATAR_EDGE, `${w}x${h} came back bigger than the cap`);
  }
});

console.log(`\n${passed} passed`);
