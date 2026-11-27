import type { OwnParticipation } from '@trace/schemas';

type TaskStatus = NonNullable<OwnParticipation['taskStatus']>;

interface Change {
  at: number;
  taskStatus: TaskStatus | null;
}

/** The searcher's task status changes seen on this phone, oldest first. Kept in memory: a fix is labelled soon after. */
let changes: Change[] = [];

/** Notes that the searcher's task status is `taskStatus` from `at` (milliseconds since the epoch, now by default). */
export function recordTaskStatus(taskStatus: TaskStatus | null, at: number = Date.now()): void {
  const last = changes[changes.length - 1];
  if (last && last.taskStatus === taskStatus) return;
  changes.push({ at: last ? Math.max(at, last.at) : at, taskStatus });
}

/**
 * The task status that held at `timestamp`, so a fix is labelled by when it was recorded and not by when it is
 * delivered (decision 71). Before the first known change it is the first known status; `undefined` when none is known.
 */
export function taskStatusAt(timestamp: number): TaskStatus | null | undefined {
  if (changes.length === 0) return undefined;
  let status = changes[0]?.taskStatus;
  for (const change of changes) {
    if (change.at > timestamp) break;
    status = change.taskStatus;
  }
  return status;
}

export function resetTaskIntervals(): void {
  changes = [];
}
