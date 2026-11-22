import { Mission, MissionPolygonList } from '@trace/schemas';
import { apiBaseUrl, apiRequest } from '../../api';
import { fetchPhoto } from '../downloadPackage';
import { OFFLINE_STEPS } from '../progress';
import { useOfflineState } from '../state';
import { loadStep, packageEpoch, saveStep, savedSteps } from '../store';

export interface RefreshOptions {
  missionId: string;
  token: string | null;
  signal?: AbortSignal;
}

/**
 * Brings the saved offline package up to date with the commander's edits (UC-F03): the mission, its photo and its
 * polygons. A step is replaced
 * only after the new answer arrived, so a failure (usually the connection) leaves the old copy usable and the package
 * as ready as it was. A package that is not complete yet is left to the download, which fetches the latest itself (and
 * asks for a refresh when it ends), so a refresh and a download never write the same package. The photo is fetched again only when its versioned address changed. Failures are thrown.
 */
export async function refreshOfflinePackage({ missionId, token, signal }: RefreshOptions): Promise<void> {
  const epoch = packageEpoch();
  const saved = new Set(await savedSteps(missionId));
  if (!OFFLINE_STEPS.every((step) => saved.has(step))) return;
  const request = { baseUrl: apiBaseUrl, token, signal };
  const replace = async (step: 'mission' | 'photo' | 'polygons', content: Parameters<typeof saveStep>[2]) => {
    // A cleared package (sign-out, the mission ended) must not come back with a late answer.
    signal?.throwIfAborted();
    if (packageEpoch() !== epoch) throw new Error('The offline package was cleared');
    await saveStep(missionId, step, content);
  };

  if (saved.has('mission')) {
    const before = await loadStep(missionId, 'mission', Mission);
    const mission = await apiRequest(`/missions/${missionId}`, { ...request, schema: Mission });
    const photoUrl = mission.missingPerson.photoUrl;
    if (saved.has('photo') && photoUrl !== before?.missingPerson.photoUrl) {
      // The photo is saved before the mission, so a failure here is noticed again by the next refresh.
      const photo = photoUrl ? await fetchPhoto(photoUrl, request) : null;
      await replace('photo', photo ? { bytes: photo.bytes, contentType: photo.contentType } : {});
    }
    await replace('mission', { json: mission });
  }

  if (saved.has('polygons')) {
    const polygons = await apiRequest(`/missions/${missionId}/polygons`, { ...request, schema: MissionPolygonList });
    await replace('polygons', { json: polygons });
  }
  // Screens that show the saved copy read it again.
  useOfflineState.getState().refreshed(missionId);
}

let running: Promise<void> | null = null;
let latest: RefreshOptions | null = null;
let again = false;

/**
 * Asks for a refresh without caring about the outcome: one runs at a time, a request that comes meanwhile makes it run
 * once more, and a failure is left for the next event or reconnect. The returned promise settles when the work is done.
 */
export function requestOfflineRefresh(options: RefreshOptions): Promise<void> {
  latest = options;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        if (latest) await refreshOfflinePackage(latest).catch(() => undefined);
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}
