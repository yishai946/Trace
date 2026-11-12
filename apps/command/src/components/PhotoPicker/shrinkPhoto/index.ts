import { fitWithin, PHOTO_JPEG_QUALITY } from '@trace/domain';

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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY));
    if (!blob) throw new Error('The photo could not be encoded');
    return new File([blob], file.name.replace(/\.[^.]*$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
