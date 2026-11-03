import { describe, expect, it } from 'vitest';
import { SOURCE, toMissionSources } from '.';
import { sampleData } from '../fixtures';

describe('mission sources', () => {
  it('labels polygons and formats callsigns', () => {
    const sources = toMissionSources(sampleData);
    expect(sources[SOURCE.polygons].features[0]?.properties?.label).toBe('ואדי צפוני\n82%');
    expect(sources[SOURCE.units].features[0]?.properties?.callsign).toBe('07');
    expect(sources[SOURCE.lkp].features[0]?.properties?.label).toBe('LKP 13:05');
  });

  it('marks only the selected polygon', () => {
    const [polygon] = sampleData.polygons;
    if (!polygon) throw new Error('fixture has a polygon');
    const plain = toMissionSources(sampleData);
    const selected = toMissionSources({ ...sampleData, polygons: [{ ...polygon, selected: true }] });
    expect(plain[SOURCE.polygons].features[0]?.properties?.selected).toBe(false);
    expect(selected[SOURCE.polygons].features[0]?.properties?.selected).toBe(true);
  });
});
