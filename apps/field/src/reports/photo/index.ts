import { fitWithin, PHOTO_JPEG_QUALITY } from '@trace/domain';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchCameraAsync } from 'expo-image-picker';

/**
 * Opens the camera and gives the photo shrunk on the phone: the long side at most PHOTO_MAX_SIDE, as JPEG, like
 * Command (#6). Redrawing drops EXIF data. Null when the searcher cancels. The camera permission is asked by the caller.
 */
export async function takeReportPhoto(): Promise<{ uri: string; base64: string } | null> {
  const picked = await launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  // Resizing by one side keeps the ratio, so the width of the fitting size is enough.
  const { width } = fitWithin(asset.width, asset.height);
  const resized = await ImageManipulator.manipulate(asset.uri).resize({ width }).renderAsync();
  const saved = await resized.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_JPEG_QUALITY, base64: true });
  if (!saved.base64) throw new Error('The photo could not be encoded');
  return { uri: saved.uri, base64: saved.base64 };
}
