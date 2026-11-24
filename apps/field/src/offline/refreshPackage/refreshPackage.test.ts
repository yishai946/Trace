import { Mission, MissionPolygonList } from '@trace/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadOfflinePackage } from '../downloadPackage';
import { MISSION_ID, mission, polygon } from '../downloadPackage/fixtures';
import { useOfflineState } from '../state';
import { clearOfflinePackages, loadPhoto, loadStep, saveStep } from '../store';
import { refreshOfflinePackage, requestOfflineRefresh } from './index';

const mapPack = vi.hoisted(() => ({ download: vi.fn(async (_options: unknown) => undefined) }));
vi.mock('../mapPack', () => ({
  downloadMapPack: (options: unknown) => mapPack.download(options),
  removeMapPacks: async () => undefined,
}));

const base = 'https://api.test';
const options = { missionId: MISSION_ID, token: 'tok' };
const edited = { ...mission, name: 'מסע 0412 (עודכן)' };
const newPhoto = {
  ...edited,
  missingPerson: { ...edited.missingPerson, photoUrl: `/api/missions/${MISSION_ID}/photo?v=2` },
};
const movedPolygon = {
  ...polygon,
  name: 'פוליגון 1 (הוזז)',
  geometry: {
    ...polygon.geometry,
    coordinates: [
      [
        [35.3, 31.9],
        [35.31, 31.9],
        [35.31, 31.91],
        [35.3, 31.9],
      ],
    ],
  },
};

interface Server {
  mission?: typeof mission;
  down?: boolean;
  photoBytes?: number[];
}

function serve({ mission: served = mission, down = false, photoBytes = [9, 8, 7] }: Server = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (down) throw new TypeError('offline');
    const url = String(input).replace(base, '');
    if (url === `/api/missions/${MISSION_ID}`) return Response.json(served);
    if (url.startsWith(`/api/missions/${MISSION_ID}/photo`)) {
      return new Response(new Uint8Array(photoBytes), { headers: { 'content-type': 'image/jpeg' } });
    }
    if (url === `/api/missions/${MISSION_ID}/polygons`) return Response.json([movedPolygon]);
    return new Response('?', { status: 500 });
  });
}

const urls = (fetch: ReturnType<typeof serve>) => fetch.mock.calls.map(([input]) => String(input).replace(base, ''));

async function saveFullPackage() {
  serve({ mission });
  await downloadOfflinePackage(options);
  vi.restoreAllMocks();
}

const savedName = async () => (await loadStep(MISSION_ID, 'mission', Mission))?.name;
const savedPolygonName = async () => (await loadStep(MISSION_ID, 'polygons', MissionPolygonList))?.[0]?.name;

describe('refreshOfflinePackage', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearOfflinePackages();
  });

  it('replaces the saved mission and polygons with the commander’s edits', async () => {
    await saveFullPackage();
    serve({ mission: edited });
    await refreshOfflinePackage(options);
    expect(await savedName()).toBe('מסע 0412 (עודכן)');
    expect(await savedPolygonName()).toBe('פוליגון 1 (הוזז)');
  });

  it('does not download the photo again when it did not change', async () => {
    await saveFullPackage();
    const fetch = serve({ mission: edited });
    await refreshOfflinePackage(options);
    expect(urls(fetch).some((url) => url.includes('/photo'))).toBe(false);
    expect(Array.from((await loadPhoto(MISSION_ID))?.bytes ?? [])).toEqual([9, 8, 7]);
  });

  it('downloads the photo again when the commander replaced it', async () => {
    await saveFullPackage();
    serve({ mission: newPhoto, photoBytes: [1, 2] });
    await refreshOfflinePackage(options);
    expect(Array.from((await loadPhoto(MISSION_ID))?.bytes ?? [])).toEqual([1, 2]);
    expect((await loadStep(MISSION_ID, 'mission', Mission))?.missingPerson.photoUrl).toContain('v=2');
  });

  it('retries a failed new photo on the next refresh instead of keeping the old one', async () => {
    await saveFullPackage();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input).replace(base, '');
      if (url.includes('/photo')) throw new TypeError('offline');
      return Response.json(url.endsWith('/polygons') ? [movedPolygon] : newPhoto);
    });
    await expect(refreshOfflinePackage(options)).rejects.toBeDefined();
    vi.restoreAllMocks();
    serve({ mission: newPhoto, photoBytes: [1, 2] });
    await refreshOfflinePackage(options);
    expect(Array.from((await loadPhoto(MISSION_ID))?.bytes ?? [])).toEqual([1, 2]);
  });

  it('leaves an incomplete package to the download', async () => {
    serve();
    await saveStep(MISSION_ID, 'mission', { json: mission });
    vi.restoreAllMocks();
    const fetch = serve({ mission: edited });
    await refreshOfflinePackage(options);
    expect(fetch).not.toHaveBeenCalled();
    expect(await savedName()).toBe('מסע 0412');
  });

  it('makes the screens read the replaced copy again', async () => {
    await saveFullPackage();
    useOfflineState.getState().start(MISSION_ID);
    const before = useOfflineState.getState().revision;
    serve({ mission: edited });
    await refreshOfflinePackage(options);
    expect(useOfflineState.getState().revision).toBe(before + 1);
  });

  it('does not bring a package back that was cleared while the answer was on its way', async () => {
    await saveFullPackage();
    let release = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      await new Promise<void>((resolve) => (release = resolve));
      const url = String(input);
      return Response.json(url.endsWith('/polygons') ? [movedPolygon] : edited);
    });
    const refreshing = refreshOfflinePackage(options);
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await clearOfflinePackages();
    release();
    await expect(refreshing).rejects.toBeDefined();
    expect(await savedName()).toBeUndefined();
  });

  it('keeps the old copy, and the readiness, when the connection is down', async () => {
    await saveFullPackage();
    useOfflineState.getState().start(MISSION_ID);
    useOfflineState.getState().setSaved(['mission', 'photo', 'polygons', 'map']);
    serve({ down: true });
    await expect(refreshOfflinePackage(options)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(await savedName()).toBe('מסע 0412');
    expect(useOfflineState.getState()).toMatchObject({ saved: ['mission', 'photo', 'polygons', 'map'], failed: false });
  });

  it('does not write after the package was cleared', async () => {
    await saveFullPackage();
    const controller = new AbortController();
    serve({ mission: edited });
    const refreshing = refreshOfflinePackage({ ...options, signal: controller.signal });
    controller.abort();
    await expect(refreshing).rejects.toBeDefined();
    expect(await savedName()).toBe('מסע 0412');
  });
});

describe('refreshOfflinePackage and the base map', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    mapPack.download.mockReset();
    await clearOfflinePackages();
  });

  it('asks for the map of the new area after the polygons moved', async () => {
    await saveFullPackage();
    mapPack.download.mockClear();
    serve({ mission: edited });
    await refreshOfflinePackage(options);
    expect(mapPack.download).toHaveBeenCalledTimes(1);
    const [request] = mapPack.download.mock.calls[0] ?? [];
    const [west, south, east, north] = (request as { bounds: number[] }).bounds;
    expect(request).toMatchObject({ missionId: MISSION_ID });
    expect([west, south, east, north]).toEqual([35.13, 31.769, 35.31, 31.91].map((n) => expect.closeTo(n, 5)));
  });

  it('keeps the new polygons and rejects, for the next refresh to retry, when the map fails', async () => {
    await saveFullPackage();
    mapPack.download.mockRejectedValueOnce(new Error('tiles unreachable'));
    serve({ mission: edited });
    await expect(refreshOfflinePackage(options)).rejects.toThrow('tiles unreachable');
    expect(await savedPolygonName()).toBe('פוליגון 1 (הוזז)');
    mapPack.download.mockClear();
    serve({ mission: edited });
    await refreshOfflinePackage(options);
    expect(mapPack.download).toHaveBeenCalledTimes(1);
  });

  it('does not ask for a map when the package is not complete', async () => {
    serve();
    await saveStep(MISSION_ID, 'mission', { json: mission });
    vi.restoreAllMocks();
    mapPack.download.mockClear();
    serve({ mission: edited });
    await refreshOfflinePackage(options);
    expect(mapPack.download).not.toHaveBeenCalled();
  });
});

describe('requestOfflineRefresh', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearOfflinePackages();
  });

  it('refreshes after a reconnect an edit that was made while the phone was offline', async () => {
    await saveFullPackage();
    serve({ down: true });
    await requestOfflineRefresh(options);
    expect(await savedName()).toBe('מסע 0412');
    vi.restoreAllMocks();
    serve({ mission: edited });
    await requestOfflineRefresh(options);
    expect(await savedName()).toBe('מסע 0412 (עודכן)');
  });

  it('runs one refresh at a time and once more for requests that came meanwhile', async () => {
    await saveFullPackage();
    const fetch = serve({ mission: edited });
    await Promise.all([requestOfflineRefresh(options), requestOfflineRefresh(options), requestOfflineRefresh(options)]);
    const missionCalls = urls(fetch).filter((url) => url === `/api/missions/${MISSION_ID}`);
    expect(missionCalls).toHaveLength(2);
  });
});
