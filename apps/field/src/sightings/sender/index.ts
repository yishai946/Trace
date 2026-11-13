import { CreateSightingBody, Sighting } from '@trace/schemas';
import { z } from 'zod';
import { ApiRequestError, apiBaseUrl, apiRequest } from '../../api';
import type { OutboxSender } from '../../outbox';
import { useSession } from '../../state/session';

/** A sighting as the outbox keeps it: the id is made on the phone, so a retry cannot add it twice (UC-F10). */
export const QueuedSighting = CreateSightingBody.extend({ id: z.uuid() });
export type QueuedSighting = z.infer<typeof QueuedSighting>;

/**
 * Sends a stored sighting to `POST /missions/:id/sightings` (UC-F10), one at a time. The server answers 200 for an id it
 * already has, so a send that was made but not confirmed is safe to repeat. The token is read when sending.
 * A final refusal drops the item: `SIGHTING_ID_TAKEN` or 400 only this sighting, 409, 404 or 403 (the mission or the
 * searcher's activity ended, or access is gone) all the mission's sightings. Network errors, 5xx and 401 keep it.
 */
export const sightingSender: OutboxSender = {
  batchSize: 1,
  async send(missionId, items) {
    const parsed = items.map((item) => QueuedSighting.safeParse(item.payload));
    // A stored sighting the schema rejects would be rejected by the server every time.
    if (parsed.some((result) => !result.success)) return 'drop-batch';
    const { token } = useSession.getState();
    if (!token) throw new Error('Not signed in');
    for (const result of parsed) {
      try {
        await apiRequest(`/missions/${missionId}/sightings`, {
          baseUrl: apiBaseUrl,
          token,
          method: 'POST',
          body: result.data,
          schema: Sighting,
        });
      } catch (error) {
        if (!(error instanceof ApiRequestError)) throw error;
        if (error.code === 'SIGHTING_ID_TAKEN' || error.status === 400) return 'drop-batch';
        if (error.status === 409 || error.status === 404 || error.status === 403) return 'drop-mission';
        throw error;
      }
    }
    return 'sent';
  },
};
