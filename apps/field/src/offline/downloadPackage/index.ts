import { Mission, MissionPolygonList } from '@trace/schemas';
import { apiBaseUrl, apiBytes, apiRequest, ApiRequestError } from '../../api';
import { loadStep, saveStep, savedSteps, type OfflineStep } from '../store';

export interface DownloadOptions {
  missionId: string;
  token: string | null;
  signal?: AbortSignal;
  /** Called after each step is saved, so the screens can show the progress. */
  onStepSaved?: (step: OfflineStep) => void;
}

/**
 * Downloads what the searcher's phone needs to work without a connection (UC-F03, decision 84): the mission with the
 * missing person's details, LKP and rally point, the photo, and the polygons. Each step is saved before the next
 * starts, so a failure (usually the connection) leaves a partial package, and calling this again downloads only what
 * is missing. Failures are thrown for the caller to retry. Base-map tiles are not part of it yet.
 */
export async function downloadOfflinePackage({
  missionId,
  token,
  signal,
  onStepSaved,
}: DownloadOptions): Promise<void> {
  const saved = new Set(await savedSteps(missionId));
  const request = { baseUrl: apiBaseUrl, token, signal };
  const done = async (step: OfflineStep, content: Parameters<typeof saveStep>[2]) => {
    signal?.throwIfAborted();
    await saveStep(missionId, step, content);
    onStepSaved?.(step);
  };

  let mission = saved.has('mission') ? await loadStep(missionId, 'mission', Mission) : null;
  if (!mission) {
    mission = await apiRequest(`/missions/${missionId}`, { ...request, schema: Mission });
    await done('mission', { json: mission });
  }

  if (!saved.has('photo')) {
    const photoUrl = mission.missingPerson.photoUrl;
    const photo = photoUrl ? await fetchPhoto(photoUrl, request) : null;
    await done('photo', photo ? { bytes: photo.bytes, contentType: photo.contentType } : {});
  }

  if (!saved.has('polygons')) {
    const polygons = await apiRequest(`/missions/${missionId}/polygons`, { ...request, schema: MissionPolygonList });
    await done('polygons', { json: polygons });
  }
}

/** The photo, or null when the server no longer has one: that is a mission without a photo, not a failed download. */
export async function fetchPhoto(
  url: string,
  request: { baseUrl: string | undefined; token: string | null; signal?: AbortSignal },
) {
  try {
    return await apiBytes(url, request);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}
