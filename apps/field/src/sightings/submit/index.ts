import type { QueuedSighting } from '../sender';
import { getNetworkStateAsync } from 'expo-network';
import { droppedReason, enqueue, isPending } from '../../outbox';
import { syncOutbox } from '../../tracking';

/**
 * `sent`: the server has the sighting. `pending`: there is no connection; it waits on the phone and goes out when the
 * connection is back. `retrying`: the phone is online but the send failed (server error, timeout); it waits and is sent
 * again. `rejected`: the server refused it for good because the mission or the searcher's activity ended. `invalid`:
 * the server refused this sighting itself (400, or its id is taken). The phone dropped both kinds of refusal.
 */
export type Delivery = 'sent' | 'pending' | 'retrying' | 'rejected' | 'invalid';

/**
 * Keeps the sighting in the outbox first, so it is never lost, then sends it when the phone has a connection (UC-F10).
 * With no connection it returns at once without waiting for a send that cannot work. Throws only when the sighting
 * could not be saved on the phone.
 */
export async function submitSighting({
  missionId,
  sighting,
}: {
  missionId: string;
  sighting: QueuedSighting;
}): Promise<Delivery> {
  await enqueue({ kind: 'sighting', missionId, payloads: [sighting], ids: [sighting.id] });
  const network = await getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) return 'pending';
  await syncOutbox();
  if (await isPending(sighting.id)) return 'retrying';
  const reason = droppedReason(sighting.id);
  return reason === 'batch' ? 'invalid' : reason === 'mission' ? 'rejected' : 'sent';
}
