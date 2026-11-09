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

  it('labels sightings with their number and time, and past LKPs with theirs', () => {
    const sources = toMissionSources(sampleData);
    expect(sources[SOURCE.sightings].features.map((f) => f.properties)).toEqual([
      { id: 's1', label: '1 15:40', suggested: true },
      { id: 's2', label: '2 14:22', suggested: false },
    ]);
    expect(sources[SOURCE.lkpHistory].features[0]?.properties).toEqual({ id: 'old', label: 'LKP 12:10' });
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
