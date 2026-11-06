import { describe, expect, it } from 'vitest';
import { encodeQr } from '.';

describe('encodeQr', () => {
  it('draws a square code whose size grows with the text', () => {
    const short = encodeQr('trace-field://j/K7-4Q2');
    const long = encodeQr(`https://trace.app/j/K7-4Q2?${'x'.repeat(200)}`);
    expect(short.path).toMatch(/^M\d+ \d+h1v1h-1z/);
    expect(long.size).toBeGreaterThan(short.size);
  });
});
