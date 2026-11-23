import { describe, expect, it } from 'vitest';
import { maptilerProvider } from '.';

describe('maptiler provider', () => {
  it('limits place search to Israel and asks for Hebrew', () => {
    const url = maptilerProvider('k').geocodingUrl?.('נחל עמוד') ?? '';
    expect(url).toContain('language=he');
    expect(url).toContain('bbox=34.2,29.4,35.95,33.4');
    expect(url).toContain(encodeURIComponent('נחל עמוד'));
  });

  it('serves satellite imagery from the same key', () => {
    const provider = maptilerProvider('k y');
    expect(provider.satelliteTilesTemplate).toBe(
      'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=k%20y',
    );
    expect(provider.satelliteMaxZoom).toBeGreaterThan(0);
  });
});
