import { describe, expect, it } from 'vitest';
import { maptilerProvider } from '.';

describe('maptiler provider', () => {
  it('limits place search to Israel and asks for Hebrew', () => {
    const url = maptilerProvider('k').geocodingUrl?.('נחל עמוד') ?? '';
    expect(url).toContain('language=he');
    expect(url).toContain('bbox=34.2,29.4,35.95,33.4');
    expect(url).toContain(encodeURIComponent('נחל עמוד'));
  });
});
