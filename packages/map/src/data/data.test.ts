import { describe, expect, it } from 'vitest';
import { SOURCE, toMissionSources } from '.';
import { sampleData } from '../fixtures';

describe('mission sources', () => {
  it('labels polygons and formats callsigns', () => {
    const sources = toMissionSources(sampleData);
    expect(sources[SOURCE.polygons].features[0]?.properties?.label).toBe('A 82%');
    expect(sources[SOURCE.units].features[0]?.properties?.callsign).toBe('07');
    expect(sources[SOURCE.lkp].features[0]?.properties?.label).toBe('LKP 13:05');
  });
});
