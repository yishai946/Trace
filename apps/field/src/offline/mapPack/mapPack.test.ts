import type { Bounds } from '@trace/geo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadMapPack, removeMapPacks } from './index';

const mocks = vi.hoisted(() => ({ library: null as unknown, provider: {} as unknown }));
vi.mock('../../map/provider', () => ({
  loadMapLibre: () => mocks.library,
  get mapProvider() {
    return mocks.provider;
  },
  mapTerrain: { hillshade: false, contours: false, terrain3d: false },
}));
const files = vi.hoisted(() => ({ written: [] as string[] }));
vi.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents/' },
  File: class {
    uri = 'file:///documents/trace-offline-map-style.json';
    create = vi.fn();
    write = (content: string) => files.written.push(content);
  },
}));
vi.mock('@trace/map', () => ({ buildMapStyle: () => ({ version: 8 }), emptyMissionMapData: {} }));

type Progress = (pack: unknown, status: { state: string }) => void;
type Failure = (pack: unknown, error: { message: string }) => void;

const bounds: Bounds = [35, 31.7, 35.1, 31.8];
const A = 'mission-a';

interface FakePack {
  id: string;
  metadata: { missionId: string; area?: Bounds };
  bounds?: Bounds;
  state?: string;
}

function fakeManager(packs: FakePack[] = []) {
  const handlers: { progress?: Progress; error?: Failure } = {};
  const live = packs.map((pack) => ({
    ...pack,
    status: vi.fn(async () => ({ state: pack.state ?? 'active' })),
    resume: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
  }));
  const manager = {
    getPacks: vi.fn(async () => live),
    getPack: vi.fn(async (id: string) => live.find((pack) => pack.id === id)),
    createPack: vi.fn(async (_options: unknown, progress: Progress, error: Failure) => {
      handlers.progress = progress;
      handlers.error = error;
      return { id: 'new' };
    }),
    addListener: vi.fn(async (_id: string, progress: Progress, error: Failure) => {
      handlers.progress = progress;
      handlers.error = error;
    }),
    removeListener: vi.fn(),
    deletePack: vi.fn(async () => undefined),
  };
  mocks.library = { OfflineManager: manager };
  return { manager, handlers, live };
}

describe('downloadMapPack', () => {
  beforeEach(() => {
    mocks.provider = {};
  });
  afterEach(() => {
    mocks.library = null;
  });

  it('does nothing where there is no native map or no tile key', async () => {
    await expect(downloadMapPack({ missionId: A, bounds })).resolves.toBeUndefined();
    const { manager } = fakeManager();
    mocks.provider = null;
    await downloadMapPack({ missionId: A, bounds });
    expect(manager.createPack).not.toHaveBeenCalled();
  });

  it('creates a pack for the area with a margin, and resolves once it is complete', async () => {
    const { manager, handlers } = fakeManager();
    const done = downloadMapPack({ missionId: A, bounds });
    await vi.waitFor(() => expect(handlers.progress).toBeDefined());
    handlers.progress?.({}, { state: 'active' });
    handlers.progress?.({}, { state: 'complete' });
    await done;
    const [options] = manager.createPack.mock.calls[0] ?? [];
    expect(options).toMatchObject({ metadata: { missionId: A }, minZoom: 10, maxZoom: 16 });
    expect(options).toMatchObject({ mapStyle: 'file:///documents/trace-offline-map-style.json' });
    expect(files.written).toEqual([JSON.stringify({ version: 8 })]);
    expect((options as { bounds: Bounds }).bounds).toEqual(
      [34.99, 31.69, 35.11, 31.81].map((n) => expect.closeTo(n, 5)),
    );
    expect(manager.removeListener).toHaveBeenCalledWith('new');
  });

  it('rejects when the download fails, for the caller to retry', async () => {
    const { handlers } = fakeManager();
    const done = downloadMapPack({ missionId: A, bounds });
    await vi.waitFor(() => expect(handlers.error).toBeDefined());
    handlers.error?.({}, { message: 'network lost' });
    await expect(done).rejects.toThrow('network lost');
  });

  it('keeps a complete pack without downloading it again', async () => {
    const { manager } = fakeManager([{ id: 'p1', metadata: { missionId: A }, state: 'complete' }]);
    await downloadMapPack({ missionId: A, bounds });
    expect(manager.createPack).not.toHaveBeenCalled();
  });

  it('resumes a cut-off pack of the mission instead of creating a second one', async () => {
    const { manager, handlers, live } = fakeManager([{ id: 'p1', metadata: { missionId: A } }]);
    const done = downloadMapPack({ missionId: A, bounds });
    await vi.waitFor(() => expect(live[0]?.resume).toHaveBeenCalled());
    handlers.progress?.({}, { state: 'complete' });
    await done;
    expect(manager.createPack).not.toHaveBeenCalled();
  });

  it('creates nothing when stopped while the packs were being listed', async () => {
    const { manager } = fakeManager();
    const controller = new AbortController();
    manager.getPacks.mockImplementation(async () => {
      controller.abort(new Error('stopped'));
      return [];
    });
    await expect(downloadMapPack({ missionId: A, bounds, signal: controller.signal })).rejects.toThrow('stopped');
    expect(manager.createPack).not.toHaveBeenCalled();
  });

  it('pauses the pack and rejects when aborted', async () => {
    const { live } = fakeManager([{ id: 'p1', metadata: { missionId: A } }]);
    const controller = new AbortController();
    const done = downloadMapPack({ missionId: A, bounds, signal: controller.signal });
    await vi.waitFor(() => expect(live[0]?.resume).toHaveBeenCalled());
    controller.abort(new Error('stopped'));
    await expect(done).rejects.toThrow('stopped');
    await vi.waitFor(() => expect(live[0]?.pause).toHaveBeenCalled());
  });
});

describe('downloadMapPack when the mission area changes', () => {
  beforeEach(() => {
    mocks.provider = {};
  });
  afterEach(() => {
    mocks.library = null;
  });

  const oldArea: Bounds = [34.99, 31.69, 35.11, 31.81];
  const moved: Bounds = [35.2, 31.7, 35.3, 31.8];
  const oldPack = { id: 'p1', metadata: { missionId: A, area: oldArea }, state: 'complete' };

  it('keeps a complete pack whose saved area holds the new area', async () => {
    const { manager } = fakeManager([oldPack]);
    await downloadMapPack({ missionId: A, bounds: [35, 31.7, 35.05, 31.75] });
    expect(manager.createPack).not.toHaveBeenCalled();
    expect(manager.deletePack).not.toHaveBeenCalled();
  });

  it('reads the area from the native pack when its metadata has none', async () => {
    const { manager } = fakeManager([{ id: 'p1', metadata: { missionId: A }, bounds: oldArea, state: 'complete' }]);
    await downloadMapPack({ missionId: A, bounds: [35, 31.7, 35.05, 31.75] });
    expect(manager.createPack).not.toHaveBeenCalled();
    const done = downloadMapPack({ missionId: A, bounds: moved });
    await vi.waitFor(() => expect(manager.createPack).toHaveBeenCalled());
    void done.catch(() => undefined);
  });

  it('downloads the new area and drops the old pack only once the new one is complete', async () => {
    const { manager, handlers } = fakeManager([oldPack]);
    const done = downloadMapPack({ missionId: A, bounds: moved });
    await vi.waitFor(() => expect(handlers.progress).toBeDefined());
    const [options] = manager.createPack.mock.calls[0] ?? [];
    const area = [35.19, 31.69, 35.31, 31.81].map((n) => expect.closeTo(n, 5));
    expect(options).toMatchObject({ bounds: area, metadata: { missionId: A, area } });
    handlers.progress?.({}, { state: 'active' });
    expect(manager.deletePack).not.toHaveBeenCalled();
    handlers.progress?.({}, { state: 'complete' });
    await done;
    expect(manager.deletePack.mock.calls).toEqual([['p1']]);
  });

  it('never drops the new pack, even when it reports complete before it is created', async () => {
    const { manager } = fakeManager([oldPack]);
    manager.createPack.mockImplementation(async (_options: unknown, progress: Progress) => {
      progress({}, { state: 'complete' });
      return { id: 'new' };
    });
    await downloadMapPack({ missionId: A, bounds: moved });
    expect(manager.deletePack.mock.calls).toEqual([['p1']]);
  });

  it('keeps the old pack when the extension fails', async () => {
    const { manager, handlers } = fakeManager([oldPack]);
    const done = downloadMapPack({ missionId: A, bounds: moved });
    await vi.waitFor(() => expect(handlers.error).toBeDefined());
    handlers.error?.({}, { message: 'network lost' });
    await expect(done).rejects.toThrow('network lost');
    expect(manager.deletePack).not.toHaveBeenCalled();
  });

  it('resumes the cut-off extension on the next try instead of starting a third pack', async () => {
    const partial = { id: 'p2', metadata: { missionId: A, area: [35.19, 31.69, 35.31, 31.81] as Bounds } };
    const { manager, handlers, live } = fakeManager([oldPack, partial]);
    const done = downloadMapPack({ missionId: A, bounds: moved });
    await vi.waitFor(() => expect(live[1]?.resume).toHaveBeenCalled());
    handlers.progress?.({}, { state: 'complete' });
    await done;
    expect(manager.createPack).not.toHaveBeenCalled();
    expect(manager.deletePack.mock.calls).toEqual([['p1']]);
  });

  it('leaves the packs of other missions alone', async () => {
    const other = { id: 'p9', metadata: { missionId: 'mission-b', area: oldArea }, state: 'complete' };
    const { manager, handlers } = fakeManager([oldPack, other]);
    const done = downloadMapPack({ missionId: A, bounds: moved });
    await vi.waitFor(() => expect(handlers.progress).toBeDefined());
    handlers.progress?.({}, { state: 'complete' });
    await done;
    expect(manager.deletePack.mock.calls).toEqual([['p1']]);
  });
});

describe('removeMapPacks', () => {
  afterEach(() => {
    mocks.library = null;
  });

  it('drops the packs of other missions and keeps the given one', async () => {
    const { manager } = fakeManager([
      { id: 'p1', metadata: { missionId: A } },
      { id: 'p2', metadata: { missionId: 'mission-b' } },
    ]);
    await removeMapPacks(A);
    expect(manager.deletePack.mock.calls).toEqual([['p2']]);
  });

  it('drops every pack when no mission is kept, and does nothing without the native map', async () => {
    const { manager } = fakeManager([{ id: 'p1', metadata: { missionId: A } }]);
    await removeMapPacks();
    expect(manager.deletePack).toHaveBeenCalledWith('p1');
    mocks.library = null;
    await expect(removeMapPacks()).resolves.toBeUndefined();
  });
});
