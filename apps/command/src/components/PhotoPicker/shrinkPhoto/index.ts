/** The long side of a photo after shrinking: sharp on a phone screen, a few hundred KB as JPEG. */
export const PHOTO_MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/** The size that fits `width`×`height` inside `maxSide` on its long side, keeping the ratio. Never enlarges. */
export function fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * The photo shrunk to PHOTO_MAX_SIDE and re-encoded as JPEG before it is sent, so it uploads fast on a weak network
 * and stays small in storage. Redrawing also drops EXIF data, such as the phone's GPS position.
 * Throws when the browser cannot read the image.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('The photo could not be encoded');
    return new File([blob], file.name.replace(/\.[^.]*$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
