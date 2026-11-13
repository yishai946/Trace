import type { RegisterPushTokenBody } from '@trace/schemas';
import { and, eq, gt, inArray, ne, notInArray, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../../db';
import { participations, pushTokens, sessions } from '../../db/schema';
import type { PushMessage, PushSender } from './pushSender';

/**
 * Stores the device's token for the session that registered it. The session's previous token is replaced, and a token
 * already stored for another session or searcher (a shared device) moves to this one.
 */
export async function registerPushToken(
  db: Db,
  { searcherId, sessionId, token }: { searcherId: string; sessionId: string } & RegisterPushTokenBody,
) {
  await db.transaction(async (tx) => {
    await tx.delete(pushTokens).where(and(eq(pushTokens.sessionId, sessionId), ne(pushTokens.token, token)));
    await tx
      .insert(pushTokens)
      .values({ token, searcherId, sessionId })
      .onConflictDoUpdate({ target: pushTokens.token, set: { searcherId, sessionId, updatedAt: sql`now()` } });
  });
}

/** Deletes the token the session registered. Does nothing when it has none. */
export async function removePushToken(db: Db, sessionId: string) {
  await db.delete(pushTokens).where(eq(pushTokens.sessionId, sessionId));
}

export interface PushRecipients {
  missionId: string;
  /** Only searchers assigned to this polygon (SOS reaches the sender's polygon, decision 98). */
  polygonId?: string;
  /** Searchers who must not be notified, such as the one who raised the alarm. */
  excludeSearcherIds?: string[];
  /** Only these searchers, such as a message's recipients. */
  searcherIds?: string[];
}

/**
 * Tokens of the searchers who are active in the mission: not Activity Ended (UC-F15), whatever the mission's status,
 * with a session that has not expired. With a polygon, only those assigned to it, by any task status (decision 100).
 */
export async function pushTokensOfActiveSearchers(
  db: Db,
  { missionId, polygonId, excludeSearcherIds, searcherIds }: PushRecipients,
) {
  const rows = await db
    .selectDistinct({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(sessions, eq(sessions.id, pushTokens.sessionId))
    .innerJoin(participations, eq(participations.searcherId, pushTokens.searcherId))
    .where(
      and(
        gt(sessions.expiresAt, sql`now()`),
        eq(participations.missionId, missionId),
        polygonId
          ? and(eq(participations.status, 'assigned'), eq(participations.polygonId, polygonId))
          : ne(participations.status, 'ended'),
        excludeSearcherIds?.length ? notInArray(pushTokens.searcherId, excludeSearcherIds) : undefined,
        searcherIds ? inArray(pushTokens.searcherId, searcherIds) : undefined,
      ),
    );
  return rows.map((row) => row.token);
}

async function deletePushTokens(db: Db, tokens: string[]) {
  if (tokens.length > 0) await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
}

/**
 * Sends push notifications to the searchers of a mission. Push is best effort: a failure is logged and never thrown,
 * so the event that caused it (SOS, assignment) is not held up. Realtime stays the in-app channel.
 */
export function createPushNotifier({ db, sender, log }: { db: Db; sender: PushSender; log: FastifyBaseLogger }) {
  return {
    /** Resolves with how many devices were sent to and how many dead tokens were deleted. */
    async notifySearchers({
      message,
      ...recipients
    }: PushRecipients & { message: PushMessage }): Promise<{ sent: number; removed: number }> {
      if (recipients.searcherIds?.length === 0) return { sent: 0, removed: 0 };
      try {
        const tokens = await pushTokensOfActiveSearchers(db, recipients);
        if (tokens.length === 0) return { sent: 0, removed: 0 };
        const { invalidTokens, failedTokens } = await sender.send(tokens, message);
        await deletePushTokens(db, invalidTokens);
        if (failedTokens.length > 0) log.warn({ failed: failedTokens.length }, 'Some push notifications failed');
        return { sent: tokens.length, removed: invalidTokens.length };
      } catch (error) {
        log.error({ err: error, missionId: recipients.missionId }, 'Sending push notifications failed');
        return { sent: 0, removed: 0 };
      }
    },
  };
}

export type PushNotifier = ReturnType<typeof createPushNotifier>;
