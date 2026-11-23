import type { ParticipantTrack } from '@trace/schemas';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { mission, participants } from '../mission/fixtures';
import { missionKeys } from '../mission/missionQueries';
import { applyEvent } from './applyEvent';

const [dana] = participants;
const missionId = mission.id;
const participantId = dana?.id ?? '';

const point = (n: number) => ({
  position: [35.1 + n / 1000, 31.7] as [number, number],
  recordedAt: `2026-10-03T12:0${n}:00.000Z`,
  accuracy: null,
  context: 'search' as const,
});

describe('applyEvent: searchers', () => {
  it('moves the searcher, marks them online and stamps the update time', () => {
    const queryClient = new QueryClient();
    const offline = { ...participants[0], offline: true, lastUpdateAt: null };
    queryClient.setQueryData(missionKeys.participants(missionId), [offline]);

    applyEvent(queryClient, {
      type: 'participant.moved',
      missionId,
      participantId,
      searcherId: offline.searcherId ?? '',
      position: [35.2, 31.8],
      positionAt: '2026-10-03T12:05:00.000Z',
    });

    expect(queryClient.getQueryData(missionKeys.participants(missionId))).toEqual([
      {
        ...offline,
        position: [35.2, 31.8],
        positionAt: '2026-10-03T12:05:00.000Z',
        lastUpdateAt: '2026-10-03T12:05:00.000Z',
        offline: false,
      },
    ]);
  });

  it('appends the new route points to a route that is open', () => {
    const queryClient = new QueryClient();
    const key = missionKeys.track(missionId, participantId);
    queryClient.setQueryData<ParticipantTrack>(key, { participantId, points: [point(1)] });

    applyEvent(queryClient, { type: 'participant.tracked', missionId, participantId, points: [point(2), point(3)] });

    expect(queryClient.getQueryData<ParticipantTrack>(key)?.points).toEqual([point(1), point(2), point(3)]);
  });

  it('does not duplicate a point that arrives twice', () => {
    const queryClient = new QueryClient();
    const key = missionKeys.track(missionId, participantId);
    queryClient.setQueryData<ParticipantTrack>(key, { participantId, points: [point(1), point(2)] });

    applyEvent(queryClient, { type: 'participant.tracked', missionId, participantId, points: [point(2), point(3)] });

    expect(queryClient.getQueryData<ParticipantTrack>(key)?.points).toEqual([point(1), point(2), point(3)]);
  });

  it('leaves a route that was never opened alone', () => {
    const queryClient = new QueryClient();
    applyEvent(queryClient, { type: 'participant.tracked', missionId, participantId, points: [point(1)] });
    expect(queryClient.getQueryData(missionKeys.track(missionId, participantId))).toBeUndefined();
  });
});
