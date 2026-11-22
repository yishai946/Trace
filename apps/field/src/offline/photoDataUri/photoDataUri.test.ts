import { describe, expect, it } from 'vitest';
import { photoDataUri } from './index';

describe('photoDataUri', () => {
  it('encodes the bytes with their content type', () => {
    expect(photoDataUri({ bytes: new Uint8Array([104, 105]), contentType: 'image/jpeg' })).toBe(
      'data:image/jpeg;base64,aGk=',
    );
  });

  it('encodes a photo larger than one chunk without losing a byte', () => {
    const bytes = Uint8Array.from({ length: 0x8000 * 2 + 5 }, (_, i) => i % 256);
    const uri = photoDataUri({ bytes, contentType: 'image/png' });
    const decoded = Uint8Array.from(atob(uri.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});
