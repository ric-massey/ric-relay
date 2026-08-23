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
