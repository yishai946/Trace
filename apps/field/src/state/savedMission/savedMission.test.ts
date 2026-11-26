import { describe, expect, it } from 'vitest';
import { clearSavedMission, loadSavedMission, saveMission } from '.';

const participation = {
  id: '6f1c5b3e-8d0a-4e57-9a43-0b0f5a1a2c11',
  callsign: 7,
  status: 'assigned' as const,
  polygonId: '0a3b9a6e-1c1f-4b6e-8f1b-2f6a1d4c7e90',
  taskStatus: 'searching' as const,
};

describe('savedMission', () => {
  it('has nothing saved at first', async () => {
    expect(await loadSavedMission()).toBeNull();
  });

  it('gives back the mission and the participation that were saved', async () => {
    await saveMission('m1', participation);
    expect(await loadSavedMission()).toEqual({ missionId: 'm1', participation });
  });

  it('keeps only the last mission: a searcher is in one mission at a time', async () => {
    await saveMission('m1', participation);
    await saveMission('m2', { ...participation, status: 'available', polygonId: null, taskStatus: null });
    expect(await loadSavedMission()).toMatchObject({ missionId: 'm2', participation: { status: 'available' } });
  });

  it('keeps the newest write when saves overlap', async () => {
    void saveMission('m1', { ...participation, taskStatus: 'ready' });
    await saveMission('m1', { ...participation, taskStatus: 'paused' });
    expect((await loadSavedMission())?.participation.taskStatus).toBe('paused');
  });

  it('forgets the mission when cleared, also when a save is still running', async () => {
    void saveMission('m1', participation);
    await clearSavedMission();
    expect(await loadSavedMission()).toBeNull();
  });
});
