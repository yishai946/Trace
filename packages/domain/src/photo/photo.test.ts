import { describe, expect, it } from 'vitest';
import { detectPhotoType, isPhotoType } from '.';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => Array.from(value, (c) => c.charCodeAt(0));

describe('detectPhotoType', () => {
  it('recognizes JPEG, PNG and WebP by their first bytes', () => {
    expect(detectPhotoType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe('image/jpeg');
    expect(detectPhotoType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
    expect(detectPhotoType(bytes(...text('RIFF'), 1, 2, 3, 4, ...text('WEBPVP8 ')))).toBe('image/webp');
  });

  it('rejects other files, including a RIFF file that is not WebP', () => {
    expect(detectPhotoType(bytes(...text('%PDF-1.7')))).toBeNull();
    expect(detectPhotoType(bytes(...text('RIFF'), 1, 2, 3, 4, ...text('WAVE')))).toBeNull();
    expect(detectPhotoType(bytes())).toBeNull();
  });
});

describe('isPhotoType', () => {
  it('accepts only the supported image types', () => {
    expect(isPhotoType('image/png')).toBe(true);
    expect(isPhotoType('image/gif')).toBe(false);
  });
});
