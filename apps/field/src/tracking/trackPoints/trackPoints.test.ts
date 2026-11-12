import { describe, expect, it } from 'vitest';
import { toTrackPoints, type Fix } from '.';

const fix = (minute: number, accuracy: number | null = 6): Fix => ({
  coords: { latitude: 31.78, longitude: [35.13, 35.131, 35.132][minute] ?? 35.13, accuracy },
  timestamp: Date.UTC(2026, 9, 3, 10, minute),
});

describe('toTrackPoints', () => {
  it('turns fixes into points in GeoJSON order, with their time and accuracy', () => {
    expect(toTrackPoints([fix(1), fix(2, null)], { taskStatus: 'searching' })).toEqual([
      { position: [35.131, 31.78], recordedAt: '2026-10-03T10:01:00.000Z', accuracy: 6, context: 'search' },
      { position: [35.132, 31.78], recordedAt: '2026-10-03T10:02:00.000Z', accuracy: null, context: 'search' },
    ]);
  });

  it('marks points by the task: search only while searching', () => {
    for (const taskStatus of ['paused', 'ready', 'finished', null] as const) {
      expect(toTrackPoints([fix(1)], { taskStatus })[0]?.context).toBe('safety');
    }
  });
});
