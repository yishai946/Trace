/** Image formats accepted for a missing person's photo (UC-C02). Every browser and phone shows them. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

/** The largest photo accepted: enough for a phone photo, small enough to send to searchers on a weak network. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

/** The image format of a file from its first bytes, or null when it is none of PHOTO_TYPES. Ignores the file name. */
export function detectPhotoType(bytes: Uint8Array): PhotoType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

export function isPhotoType(type: string): type is PhotoType {
  return (PHOTO_TYPES as readonly string[]).includes(type);
}

/** The long side of a photo after shrinking: sharp on a phone screen, a few hundred KB as JPEG. */
export const PHOTO_MAX_SIDE = 1600;
/** The JPEG quality a shrunk photo is encoded with. */
export const PHOTO_JPEG_QUALITY = 0.85;

/** The size that fits `width`×`height` inside `maxSide` on its long side, keeping the ratio. Never enlarges. */
export function fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
