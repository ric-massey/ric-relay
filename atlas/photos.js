/* ATLAS — turning a phone camera photo into something worth storing.
 *
 * A modern phone takes a 4 MB, 4000px photo. Nothing about a cave entrance
 * needs 4000px, and these get uploaded over cell data from a canyon rim on a
 * free storage tier, so every photo is re-encoded on the phone before it goes.
 *
 * Re-encoding through a canvas also strips EXIF, which matters twice. It drops
 * a few hundred KB of metadata, and it drops the GPS coordinates the camera
 * embedded in the file. The pin already records where the place is, under a
 * privacy rule the database enforces. A photo does not need to carry a second,
 * unmanaged copy of that around — especially not one that survives being
 * exported, forwarded or handed to someone.
 */

export const MAX_EDGE = 1600;   // reads a rock face; ~250-400 KB as JPEG
export const QUALITY  = 0.82;

/* Object names are {pin_id}/{uploader_id}/{photo_id}.jpg — the storage policies
 * read permissions straight out of that shape, so it is not cosmetic. */
export function photoPath(pinId, userId, photoId) {
  return `${pinId}/${userId}/${photoId}.jpg`;
}

export function pinIdFromPath(path) {
  return String(path).split('/')[0] || null;
}

/* Kept separate from the canvas work so the arithmetic can be tested without a
 * browser. Never upscales: a small photo stays the size it was. */
export function fitDims(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width:  Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function shrink(file, maxEdge = MAX_EDGE, quality = QUALITY) {
  // imageOrientation: 'from-image' applies the EXIF rotation during decode.
  // Without it, every photo shot in portrait on an iPhone arrives on its side.
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitDims(bmp.width, bmp.height, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('could not read that image');

  return { blob, width, height };
}

/* ── avatars ──────────────────────────────────────────────────────────────
 * A face on a byline. Same machinery as a pin photo and the same reasoning —
 * re-encode on the phone, strip EXIF on the way through — with two differences
 * that come from what an avatar is rather than from what it costs.
 *
 * It is SQUARE, cropped from the middle rather than letterboxed, because it is
 * drawn in a circle everywhere it appears and a 16:9 photo fitted into a circle
 * shows a horizontal slice of somebody's chin. And it is small: 256px is four
 * times the largest circle in the app, which leaves room for a retina screen
 * and stops well short of paying to store a portrait nobody will ever open.
 */
export const AVATAR_EDGE    = 256;
export const AVATAR_QUALITY = 0.85;

/* Object names are {user_id}/{avatar_id}.jpg — the storage policies read the
 * owner straight out of that first segment, so it is not cosmetic. The avatar
 * id is minted fresh for every picture rather than the object being written
 * over, which makes the path its own cache key: a phone holding the old face
 * cannot draw it under the new name. */
export function avatarPath(userId, avatarId) {
  return `${userId}/${avatarId}.jpg`;
}

export function avatarOwnerFromPath(path) {
  return String(path).split('/')[0] || null;
}

/* The biggest centred square the image contains, and how big to draw it.
 * Kept separate from the canvas work so it can be tested without a browser.
 * Never upscales: a 90px thumbnail stays 90px rather than being blown up into
 * a soft 256px one. */
export function squareCrop(width, height, edge = AVATAR_EDGE) {
  const side = Math.max(1, Math.min(width, height));
  return {
    sx:   Math.max(0, Math.round((width  - side) / 2)),
    sy:   Math.max(0, Math.round((height - side) / 2)),
    side,
    out:  Math.max(1, Math.min(edge, side)),
  };
}

export async function shrinkSquare(file, edge = AVATAR_EDGE, quality = AVATAR_QUALITY) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { sx, sy, side, out } = squareCrop(bmp.width, bmp.height, edge);

  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, out, out);
  bmp.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('could not read that image');

  return { blob, width: out, height: out };
}
