import type { Participant, ParticipantTrack } from '@trace/schemas';
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
  const move = (positionAt: string, change: object) => {
    const queryClient = new QueryClient();
    const searcher = { ...participants[0], offline: true, lastUpdateAt: null, ...change };
    queryClient.setQueryData(missionKeys.participants(missionId), [searcher]);
    applyEvent(queryClient, {
      type: 'participant.moved',
      missionId,
      participantId,
      searcherId: searcher.searcherId ?? '',
      position: [35.2, 31.8],
      positionAt,
    });
    return queryClient.getQueryData<Participant[]>(missionKeys.participants(missionId))?.[0];
  };

  it('moves the searcher, marks them online and stamps the update time', () => {
    const now = new Date().toISOString();
    expect(move(now, {})).toMatchObject({ position: [35.2, 31.8], positionAt: now, lastUpdateAt: now, offline: false });
  });

  it('keeps a newer battery time as the last update, and a late batch of old fixes offline', () => {
    const battery = new Date().toISOString();
    const result = move('2026-10-03T12:05:00.000Z', { lastUpdateAt: battery });
    expect(result).toMatchObject({ lastUpdateAt: battery, offline: true });
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
