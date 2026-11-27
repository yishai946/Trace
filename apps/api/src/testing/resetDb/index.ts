import { sql } from 'drizzle-orm';
import type { Db } from '../../db';

const DEADLOCK_DETECTED = '40P01';
const MAX_ATTEMPTS = 5;

/** Whether the error, or one of its causes, is Postgres's "deadlock detected". */
function isDeadlock(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ('code' in current && current.code === DEADLOCK_DETECTED) return true;
  }
  return false;
}

/**
 * Empties every table between tests. A late write from the previous test (a queued job, a push) can hold a lock
 * the truncate needs and make Postgres pick it as the deadlock victim, so it tries again a few times.
 */
export async function resetDb(db: Db) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await db.execute(
        sql`truncate missions, lkp_points, sightings, messages, message_recipients, sos_alerts, sos_alert_recipients, timeline_events, track_points, assignments, polygons, searchers, participations, push_tokens, users, sessions, accounts, verifications, otp_requests restart identity cascade`,
      );
      return;
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isDeadlock(error)) throw error;
    }
  }
}
