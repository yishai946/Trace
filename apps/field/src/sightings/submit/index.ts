import type { QueuedSighting } from '../sender';
import { getNetworkStateAsync } from 'expo-network';
import { enqueue, isPending, wasDropped } from '../../outbox';
import { syncOutbox } from '../../tracking';

/**
 * `sent`: the server has the sighting. `pending`: it waits on the phone and goes out when the connection is back.
 * `rejected`: the server refused it for good (the mission or the searcher's activity ended) and the phone dropped it.
 */
export type Delivery = 'sent' | 'pending' | 'rejected';

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
  if (await isPending(sighting.id)) return 'pending';
  return wasDropped(sighting.id) ? 'rejected' : 'sent';
}
