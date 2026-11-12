import type { CreateReportBody } from '@trace/schemas';
import { getNetworkStateAsync } from 'expo-network';
import { enqueue, isPending } from '../../outbox';
import { uuidv7 } from '../../outbox/uuidv7';
import { syncOutbox } from '../../tracking';

/** `sent`: the server has the report. `pending`: it waits on the phone and goes out when the connection is back. */
export type Delivery = 'sent' | 'pending';

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
  return (await isPending(report.id)) ? 'pending' : 'sent';
}
