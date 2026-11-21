import { QueryClient } from '@tanstack/query-core';
import type { Mission, MissionEvent } from '@trace/schemas';
import { describe, expect, it, vi } from 'vitest';
import { applySharedEvent, type MissionCacheShape } from '.';
import { makeMission, makeReport, makeSos, MISSION_ID } from '../fixtures';
import { missionDataKeys } from '../keys';

function setup() {
  const queryClient = new QueryClient();
  const shape = { patchMission: vi.fn(), replaceMission: vi.fn() } satisfies MissionCacheShape;
  return { queryClient, shape, apply: (event: MissionEvent) => applySharedEvent(queryClient, shape, event) };
}

/** The mission the first call of `patchMission` would produce from `mission`. */
function patched(shape: { patchMission: { mock: { calls: unknown[][] } } }, mission: Mission): Mission | undefined {
  const change = shape.patchMission.mock.calls[0]?.[2];
  return typeof change === 'function' ? change(mission) : undefined;
}

describe('applySharedEvent', () => {
  it('patches the LKP of the mission', () => {
    const { queryClient, shape, apply } = setup();
    const lkp = {
      position: { type: 'Point' as const, coordinates: [35.2, 31.8] as [number, number] },
      observedAt: '2026-11-06T11:00:00.000Z',
    };
    apply({ type: 'lkp.changed', missionId: MISSION_ID, lkp });
    expect(shape.patchMission).toHaveBeenCalledOnce();
    expect(shape.patchMission).toHaveBeenCalledWith(queryClient, MISSION_ID, expect.any(Function));
    const mission = makeMission();
    expect(patched(shape, mission)).toEqual({ ...mission, lkp });
  });

  it('patches the rally point and the update time', () => {
    const { shape, apply } = setup();
    const rallyPoint = { type: 'Point' as const, coordinates: [35.3, 31.9] as [number, number] };
    apply({ type: 'rally.changed', missionId: MISSION_ID, rallyPoint, updatedAt: '2026-11-06T12:00:00.000Z' });
    expect(patched(shape, makeMission())).toEqual({
      ...makeMission(),
      rallyPoint,
      updatedAt: '2026-11-06T12:00:00.000Z',
    });
  });

  it('replaces the whole mission', () => {
    const { queryClient, shape, apply } = setup();
    const mission = makeMission({ name: 'שם חדש' });
    apply({ type: 'mission.updated', missionId: MISSION_ID, mission });
    expect(shape.replaceMission).toHaveBeenCalledWith(queryClient, MISSION_ID, mission);
    expect(shape.patchMission).not.toHaveBeenCalled();
  });

  it('adds a report newest first and removes a deleted one', () => {
    const { queryClient, apply } = setup();
    const key = missionDataKeys.reports(MISSION_ID);
    const older = makeReport({ reportedAt: '2026-10-03T16:00:00.000Z' });
    const newer = makeReport({ reportedAt: '2026-10-03T17:00:00.000Z' });
    queryClient.setQueryData(key, [older]);
    apply({ type: 'report.saved', missionId: MISSION_ID, report: newer });
    expect(queryClient.getQueryData(key)).toEqual([newer, older]);
    apply({ type: 'report.deleted', missionId: MISSION_ID, reportId: newer.id });
    expect(queryClient.getQueryData(key)).toEqual([older]);
  });

  it('puts an SOS in the cached list', () => {
    const { queryClient, apply } = setup();
    const key = missionDataKeys.sos(MISSION_ID);
    const active = makeSos();
    queryClient.setQueryData(key, [active]);
    const closed = makeSos({ status: 'closed', closedAt: '2026-10-03T17:10:00.000Z' });
    apply({ type: 'sos.saved', missionId: MISSION_ID, sos: closed });
    expect(queryClient.getQueryData(key)).toEqual([closed]);
  });

  it('leaves the events of the apps alone', () => {
    const { queryClient, shape, apply } = setup();
    const key = missionDataKeys.reports(MISSION_ID);
    queryClient.setQueryData(key, [makeReport()]);
    const before = queryClient.getQueryData(key);
    apply({ type: 'polygon.deleted', missionId: MISSION_ID, polygonId: '00000000-0000-4000-8000-0000000000a1' });
    expect(shape.patchMission).not.toHaveBeenCalled();
    expect(shape.replaceMission).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(key)).toBe(before);
  });
});
