import { Sighting } from '@trace/schemas';
import { apiBaseUrl, apiRequest } from '../api';
import type { QueuedSighting } from './sender';

/** `POST /missions/:id/sightings`: the saved sighting, also for a sighting id the server already has. */
export function postSighting(missionId: string, token: string, sighting: QueuedSighting) {
  return apiRequest(`/missions/${missionId}/sightings`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'POST',
    body: sighting,
    schema: Sighting,
  });
}
