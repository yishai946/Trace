import { sql } from 'drizzle-orm';
import {
  bigserial,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { pointColumn } from '../geometry';
import { timestamps } from './columns';
import { participationStatus, taskStatus, trackContext } from './enums';
import { users } from './auth';
import { missions, polygons } from './missions';

/** A field searcher's profile, identified by phone number (UC-F01). One per searcher user. */
export const searchers = pgTable('searchers', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  phone: text().notNull().unique(),
  name: text().notNull(),
  createdAt: timestamps.createdAt,
});

/** A searcher's participation in one mission: callsign, assignment, search task and last position. */
export const participations = pgTable(
  'participations',
  {
    id: uuid().primaryKey().defaultRandom(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    searcherId: uuid('searcher_id')
      .notNull()
      .references(() => searchers.id),
    callsign: integer().notNull(),
    status: participationStatus().notNull().default('available'),
    polygonId: uuid('polygon_id').references(() => polygons.id),
    taskStatus: taskStatus('task_status'),
    lastPosition: pointColumn('last_position'),
    lastPositionAt: timestamp('last_position_at', { withTimezone: true }),
    /** Since when the searcher's phone reports no GPS (decision 42); null while it works. */
    gpsUnavailableSince: timestamp('gps_unavailable_since', { withTimezone: true }),
    /** The phone's last reported battery level, in percent (decision 13); null before the first report. */
    batteryLevel: integer('battery_level'),
    /** When the phone measured `batteryLevel`: the newest reading wins, whatever order uploads arrive in. */
    batteryMeasuredAt: timestamp('battery_measured_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('participations_mission_searcher_idx').on(t.missionId, t.searcherId),
    uniqueIndex('participations_mission_callsign_idx').on(t.missionId, t.callsign),
    index('participations_polygon_idx')
      .on(t.polygonId)
      .where(sql`${t.status} = 'assigned'`),
  ],
);

/**
 * Every assignment a searcher had (UC-C09, decision 53). The open one (`ended_at` null) is the participation's current
 * polygon; moving the searcher ends it and opens another, so the history of who searched where stays.
 */
export const assignments = pgTable(
  'assignments',
  {
    id: uuid().primaryKey().defaultRandom(),
    participationId: uuid('participation_id')
      .notNull()
      .references(() => participations.id, { onDelete: 'cascade' }),
    polygonId: uuid('polygon_id')
      .notNull()
      .references(() => polygons.id),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    index('assignments_participation_idx').on(t.participationId, t.assignedAt),
    uniqueIndex('assignments_open_idx')
      .on(t.participationId)
      .where(sql`${t.endedAt} is null`),
  ],
);

/**
 * A searcher's GPS route (UC-S01): every fix their phone recorded, with what it was for. Kept after the mission ends
 * (mission history, UC-C20). The phone may send a batch again after a lost connection: one point per recording time.
 */
export const trackPoints = pgTable(
  'track_points',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    participationId: uuid('participation_id')
      .notNull()
      .references(() => participations.id, { onDelete: 'cascade' }),
    position: pointColumn().notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    /** Meters, as the phone reported it. */
    accuracy: doublePrecision(),
    context: trackContext().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('track_points_participation_recorded_idx').on(t.participationId, t.recordedAt)],
);
