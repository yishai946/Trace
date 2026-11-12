import { describe, expect, it } from 'vitest';
import { MAX_TRACK_POINTS, ParticipantTrack, TrackPointsBody } from '.';

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

describe('ParticipantTrack', () => {
  const id = '3f2b1c9e-8d4a-4b6e-9a1f-2c7d5e8f0a11';

  it('takes stored points with their accuracy and context', () => {
    const stored = { ...point, accuracy: null };
    expect(ParticipantTrack.parse({ participantId: id, points: [stored] }).points).toHaveLength(1);
    expect(ParticipantTrack.parse({ participantId: id, points: [] }).points).toEqual([]);
  });

  it('refuses a point without accuracy or with an unknown context', () => {
    expect(ParticipantTrack.safeParse({ participantId: id, points: [point] }).success).toBe(false);
    expect(
      ParticipantTrack.safeParse({ participantId: id, points: [{ ...point, accuracy: 1, context: 'driving' }] })
        .success,
    ).toBe(false);
  });
});
