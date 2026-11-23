/**
 * How long a searcher without a live connection still counts as online after their last update (a GPS point or a
 * battery report). Decision 44 leaves the threshold TBD in the spec; the owner set 2 minutes for the POC (#157).
 */
export const OFFLINE_AFTER_MS = 2 * 60 * 1000;

/**
 * Whether a searcher is Offline for the commander (UC-C10, decision 13): they are online while their phone holds the
 * mission's live connection, or when its last update is no older than {@link OFFLINE_AFTER_MS}. A phone in the iOS
 * background may drop the connection while its GPS points keep arriving, so the update time keeps it online.
 */
export function isSearcherOffline({
  connected,
  lastUpdateAt,
  now,
}: {
  connected: boolean;
  lastUpdateAt: Date | null;
  now: Date;
}): boolean {
  if (connected) return false;
  if (!lastUpdateAt) return true;
  return now.getTime() - lastUpdateAt.getTime() > OFFLINE_AFTER_MS;
}

/** The newest of the times a phone last reported something, or null when it never did. */
export function latestUpdateAt(times: readonly (Date | null)[]): Date | null {
  let latest: Date | null = null;
  for (const time of times) {
    if (time && (!latest || time.getTime() > latest.getTime())) latest = time;
  }
  return latest;
}
