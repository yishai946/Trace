import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMapView, readMapView, saveMapView } from '.';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('parseMapView', () => {
  it('defaults to the black and white map', () => {
    expect(parseMapView(null)).toEqual({ base: 'map', color: 'bw' });
  });

  it('reads a saved choice', () => {
    expect(parseMapView('{"base":"satellite","color":"color"}')).toEqual({ base: 'satellite', color: 'color' });
  });

  it('ignores damaged or unknown values field by field', () => {
    expect(parseMapView('not json')).toEqual({ base: 'map', color: 'bw' });
    expect(parseMapView('{"base":"terrain","color":"color"}')).toEqual({ base: 'map', color: 'color' });
    expect(parseMapView('[1]')).toEqual({ base: 'map', color: 'bw' });
  });
});

describe('saved map view', () => {
  it('survives a reload', () => {
    saveMapView({ base: 'satellite', color: 'color' });
    expect(readMapView()).toEqual({ base: 'satellite', color: 'color' });
  });

  it('falls back to the default when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readMapView()).toEqual({ base: 'map', color: 'bw' });
    expect(() => saveMapView({ base: 'satellite', color: 'bw' })).not.toThrow();
  });
});
