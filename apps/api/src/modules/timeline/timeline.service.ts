import { TimelineEvent, type TimelineSubject } from '@trace/schemas';
import { asc, eq, and } from 'drizzle-orm';
import type { Actor } from '../../auth/auth.plugin';
import type { Db, Tx } from '../../db';
import { participations, searchers, timelineEvents, users } from '../../db/schema';

type EventBody =
  TimelineEvent extends infer E ? (E extends TimelineEvent ? Pick<E, 'type' | 'details'> : never) : never;

export type RecordEventInput = EventBody & {
  missionId: string;
  /** Who performed it. A searcher must take part in the mission. */
  actor: Actor | 'system';
  subject: Omit<TimelineSubject, 'callsign'> & { callsign?: number | null };
  /** When it happened. Defaults to now (the transaction's time). Offline reports later pass their own time. */
  occurredAt?: Date;
};

type ActorSnapshot = TimelineEvent['actor'];

async function snapshotOf(db: Db | Tx, missionId: string, actor: Actor | 'system'): Promise<ActorSnapshot> {
  if (actor === 'system') return { kind: 'system' };
  if (actor.role === 'commander') {
    const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, actor.userId));
    if (!user) throw new Error('Timeline actor not found');
    return { kind: 'commander', userId: actor.userId, name: user.name };
  }
  if (!actor.searcherId) throw new Error('Timeline actor not found');
  const [row] = await db
    .select({ participantId: participations.id, callsign: participations.callsign, name: searchers.name })
    .from(participations)
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, actor.searcherId)));
  if (!row) throw new Error('Timeline actor not found');
  return { kind: 'searcher', ...row };
}

type EventRow = typeof timelineEvents.$inferSelect;

/** Persisted data is validated before it leaves the service. */
function toEvent(row: EventRow): TimelineEvent {
  return TimelineEvent.parse({
    id: row.id,
    missionId: row.missionId,
    type: row.type,
    occurredAt: row.occurredAt.toISOString(),
    actor: row.actor,
    subject: row.subject,
    details: row.details,
  });
}

/**
 * Records one significant event on the mission's Timeline (UC-C19). Call it inside the transaction of the change it
 * records, so a rejected change records nothing; after the commit, the route publishes `timeline.recorded`.
 */
export async function recordEvent(db: Db | Tx, input: RecordEventInput): Promise<TimelineEvent> {
  const actor = await snapshotOf(db, input.missionId, input.actor);
  const [row] = await db
    .insert(timelineEvents)
    .values({
      missionId: input.missionId,
      type: input.type,
      actor,
      subject: { ...input.subject, callsign: input.subject.callsign ?? null },
      details: input.details,
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
    })
    .returning();
  if (!row) throw new Error('Timeline insert returned no row');
  return toEvent(row);
}

/** The mission's Timeline, oldest first (occurred_at, then recording order). Access was checked by the route. */
export async function listTimeline(db: Db, missionId: string): Promise<TimelineEvent[]> {
  const rows = await db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.missionId, missionId))
    .orderBy(asc(timelineEvents.occurredAt), asc(timelineEvents.seq));
  return rows.map(toEvent);
}
