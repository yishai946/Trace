import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPhoto, loadStep, savedSteps } from '../store';
import { Mission } from '@trace/schemas';
import { downloadOfflinePackage } from './index';
import { MISSION_ID, mission, polygon } from './fixtures';

const base = `https://api.test`;
const options = { missionId: MISSION_ID, token: 'tok' };

interface Server {
  photo?: 'ok' | 'missing' | 'down';
  polygons?: 'ok' | 'down';
  mission?: typeof mission;
}

function serve({ photo = 'ok', polygons = 'ok', mission: served = mission }: Server = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === `${base}/api/missions/${MISSION_ID}`) return Response.json(served);
    if (url.startsWith(`${base}/api/missions/${MISSION_ID}/photo`)) {
      if (photo === 'down') throw new TypeError('offline');
      if (photo === 'missing') return Response.json({ error: { code: 'NOT_FOUND', message: 'none' } }, { status: 404 });
      return new Response(new Uint8Array([9, 8, 7]), { headers: { 'content-type': 'image/jpeg' } });
    }
    if (url === `${base}/api/missions/${MISSION_ID}/polygons`) {
      if (polygons === 'down') throw new TypeError('offline');
      return Response.json([polygon]);
    }
    return new Response('?', { status: 500 });
  });
}

const urls = (fetch: ReturnType<typeof serve>) => fetch.mock.calls.map(([input]) => String(input).replace(base, ''));

describe('downloadOfflinePackage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves the mission, the photo and the polygons', async () => {
    serve();
    await downloadOfflinePackage(options);
    expect((await savedSteps(MISSION_ID)).sort()).toEqual(['mission', 'photo', 'polygons']);
    expect((await loadStep(MISSION_ID, 'mission', Mission))?.name).toBe('מסע 0412');
    const photo = await loadPhoto(MISSION_ID);
    expect(photo && Array.from(photo.bytes)).toEqual([9, 8, 7]);
  });

  it('reports each step as it is saved', async () => {
    serve();
    const saved: string[] = [];
    await downloadOfflinePackage({ ...options, onStepSaved: (step) => saved.push(step) });
    expect(saved).toEqual(['mission', 'photo', 'polygons']);
  });

  it('counts a mission without a photo as saved, without asking for one', async () => {
    const fetch = serve({ mission: { ...mission, missingPerson: { ...mission.missingPerson, photoUrl: null } } });
    await downloadOfflinePackage(options);
    expect(await savedSteps(MISSION_ID)).toContain('photo');
    expect(await loadPhoto(MISSION_ID)).toBeNull();
    expect(urls(fetch).some((url) => url.includes('/photo'))).toBe(false);
  });

  it('counts a photo that is gone from the server as no photo', async () => {
    serve({ photo: 'missing' });
    await downloadOfflinePackage(options);
    expect((await savedSteps(MISSION_ID)).sort()).toEqual(['mission', 'photo', 'polygons']);
  });

  it('saves a mission without polygons yet', async () => {
    serve();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/polygons')
        ? Response.json([])
        : String(input).endsWith(`/missions/${MISSION_ID}`)
          ? Response.json(mission)
          : new Response(new Uint8Array([1])),
    );
    await downloadOfflinePackage(options);
    expect(await savedSteps(MISSION_ID)).toContain('polygons');
  });

  it('keeps what is saved when the connection drops in the middle, and fails', async () => {
    serve({ polygons: 'down' });
    await expect(downloadOfflinePackage(options)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect((await savedSteps(MISSION_ID)).sort()).toEqual(['mission', 'photo']);
  });

  it('resumes with the missing steps only', async () => {
    serve({ polygons: 'down' });
    await downloadOfflinePackage(options).catch(() => undefined);
    vi.restoreAllMocks();
    const fetch = serve();
    await downloadOfflinePackage(options);
    expect(urls(fetch)).toEqual([`/api/missions/${MISSION_ID}/polygons`]);
    expect((await savedSteps(MISSION_ID)).sort()).toEqual(['mission', 'photo', 'polygons']);
  });

  it('resumes the photo from the saved mission without fetching the mission again', async () => {
    serve({ photo: 'down' });
    await downloadOfflinePackage(options).catch(() => undefined);
    vi.restoreAllMocks();
    const fetch = serve();
    await downloadOfflinePackage(options);
    expect(urls(fetch)).not.toContain(`/api/missions/${MISSION_ID}`);
    expect(await loadPhoto(MISSION_ID)).not.toBeNull();
  });

  it('does nothing when the package is already saved', async () => {
    serve();
    await downloadOfflinePackage(options);
    vi.restoreAllMocks();
    const fetch = serve();
    await downloadOfflinePackage(options);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stops when the caller aborts', async () => {
    serve();
    const controller = new AbortController();
    controller.abort();
    await expect(downloadOfflinePackage({ ...options, signal: controller.signal })).rejects.toBeDefined();
    expect(await savedSteps(MISSION_ID)).toEqual([]);
  });
});
