import { sql } from 'drizzle-orm';
import {
  bigserial,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { pointColumn } from '../geometry';
import { sosStatus, timelineEventType } from './enums';
import { users } from './auth';
import { missions, polygons } from './missions';
import { participations, searchers } from './participants';

/**
 * An SOS a searcher activated (UC-F13). It goes to the commander and to the searchers assigned to the sender's polygon
 * (decision 98), and the commander or the sender closes it (decision 99). The location is the sender's position when it
 * was sent (decision 24); it stays null when the phone gave none and no position was known. At most one SOS is active
 * per participation.
 */
export const sosAlerts = pgTable(
  'sos_alerts',
  {
    id: uuid().primaryKey().defaultRandom(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    participationId: uuid('participation_id')
      .notNull()
      .references(() => participations.id, { onDelete: 'cascade' }),
    /** The sender's polygon when it was sent; null for a searcher who had none. */
    polygonId: uuid('polygon_id').references(() => polygons.id),
    message: text(),
    position: pointColumn(),
    positionRecordedAt: timestamp('position_recorded_at', { withTimezone: true }),
    /** Meters, as the phone reported it. */
    positionAccuracy: doublePrecision('position_accuracy'),
    status: sosStatus().notNull().default('active'),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: uuid('closed_by').references(() => users.id),
  },
  (t) => [
    index('sos_alerts_mission_idx').on(t.missionId, t.activatedAt),
    uniqueIndex('sos_alerts_active_idx')
      .on(t.participationId)
      .where(sql`${t.status} = 'active'`),
  ],
);

/**
 * The searchers an SOS was sent to when it was activated. Fixed at that moment: closing the SOS sends the update to
 * the same searchers (decision 99), even if they were moved to another polygon since.
 */
export const sosAlertRecipients = pgTable(
  'sos_alert_recipients',
  {
    sosId: uuid('sos_id')
      .notNull()
      .references(() => sosAlerts.id, { onDelete: 'cascade' }),
    searcherId: uuid('searcher_id')
      .notNull()
      .references(() => searchers.id),
  },
  (t) => [
    primaryKey({ columns: [t.sosId, t.searcherId] }),
    index('sos_alert_recipients_searcher_idx').on(t.searcherId),
  ],
);

/**
 * The mission's operational Timeline (UC-C19): significant events only (decision 54), kept after the mission ends.
 * `actor`, `subject` and `details` are snapshots in the shape of `TimelineEvent` (@trace/schemas), validated on read.
 */
export const timelineEvents = pgTable(
  'timeline_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Recording order. Breaks ties between events of the same instant, such as two in one transaction. */
    seq: bigserial({ mode: 'number' }).notNull().unique(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    type: timelineEventType().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actor: jsonb().notNull(),
    subject: jsonb().notNull(),
    details: jsonb().notNull().default({}),
  },
  (t) => [index('timeline_events_mission_idx').on(t.missionId, t.occurredAt, t.seq)],
);
