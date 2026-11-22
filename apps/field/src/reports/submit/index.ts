import type { CreateReportBody } from '@trace/schemas';
import { getNetworkStateAsync } from 'expo-network';
import { droppedReason, enqueue, isPending, markDroppedSeen } from '../../outbox';
import { uuidv7 } from '../../outbox/uuidv7';
import { syncOutbox } from '../../tracking';

/**
 * `sent`: the server has the report. `pending`: there is no connection; it waits on the phone and goes out when the
 * connection is back. `retrying`: the phone is online but the send failed (server error, timeout); it waits and is sent
 * again. `rejected`: the server refused it for good because the mission or the searcher's activity ended. `invalid`:
 * the server refused this report itself (400, or its id is taken). The phone dropped both kinds of refusal.
 */
export type Delivery = 'sent' | 'pending' | 'retrying' | 'rejected' | 'invalid';

/** A new report's id: a UUIDv7 made on the phone, so a send repeated after a lost answer saves it once. */
export const newReportId = uuidv7;

/**
 * Keeps the report (and its photo) in the outbox first, so it is never lost, then sends it when the phone has a
 * connection (UC-F09, UC-S03). With no connection it returns at once without waiting for a send that cannot work.
 * Throws only when the report could not be saved on the phone.
 */
export async function submitReport({
  missionId,
  report,
  photo,
}: {
  missionId: string;
  report: CreateReportBody;
  /** The JPEG, shrunk on the phone, as base64. */
  photo: { base64: string } | null;
}): Promise<Delivery> {
  await enqueue({ kind: 'report', missionId, payloads: [report], ids: [report.id] });
  // After the report: the outbox sends in the order it was added.
  if (photo) {
    await enqueue({ kind: 'report-photo', missionId, payloads: [{ reportId: report.id, base64: photo.base64 }] });
  }
  const network = await getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) return 'pending';
  await syncOutbox();
  if (await isPending(report.id)) return 'retrying';
  const reason = droppedReason(report.id);
  // The form says it right now, so the list of reports need not say it again.
  if (reason) markDroppedSeen([report.id]);
  return reason === 'batch' ? 'invalid' : reason === 'mission' ? 'rejected' : 'sent';
}
