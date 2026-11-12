import { describe, expect, it } from 'vitest';
import { MAX_TRACK_POINTS, TrackPointsBody } from '.';

const point = { position: [35.13, 31.78], recordedAt: '2026-10-03T13:05:00+03:00', context: 'search' };

describe('TrackPointsBody', () => {
  it('takes a batch of points and defaults the accuracy', () => {
    expect(TrackPointsBody.parse({ points: [point] }).points[0]?.accuracy).toBeNull();
  });

  it('refuses an empty batch, a batch too big and an unknown context', () => {
    expect(TrackPointsBody.safeParse({ points: [] }).success).toBe(false);
    expect(TrackPointsBody.safeParse({ points: Array(MAX_TRACK_POINTS + 1).fill(point) }).success).toBe(false);
    expect(TrackPointsBody.safeParse({ points: [{ ...point, context: 'driving' }] }).success).toBe(false);
  });
});
