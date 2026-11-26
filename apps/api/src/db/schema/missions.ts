import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pointColumn, polygonColumn } from '../geometry';
import { bytea, timestamps } from './columns';
import { lkpDecision, missionStatus, polygonStatus, sightingSource } from './enums';
import { users } from './auth';

export const missions = pgTable('missions', {
  id: uuid().primaryKey().defaultRandom(),
  /** The commander who created the mission and the only one who manages it (spec §3). */
  commanderId: uuid('commander_id')
    .notNull()
    .references(() => users.id),
  name: text().notNull(),
  status: missionStatus().notNull().default('active'),
  joinCode: text('join_code').notNull().unique(),
  missingPersonName: text('missing_person_name'),
  missingPersonAge: integer('missing_person_age'),
  disappearedAt: timestamp('disappeared_at', { withTimezone: true }),
  description: text(),
  additionalInfo: text('additional_info'),
  rallyPoint: pointColumn('rally_point').notNull(),
  ...timestamps,
});

/**
 * The missing person's photo (UC-C02), at most one per mission. The image is in the bucket (`missionPhotoKey`); the
 * row keeps its type and version. `data` holds the bytes only for a photo saved before the move to the bucket, until
 * `photos:move` copies it.
 */
export const missionPhotos = pgTable('mission_photos', {
  missionId: uuid('mission_id')
    .primaryKey()
    .references(() => missions.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(),
  data: bytea(),
  ...timestamps,
});

/**
 * A possible position of the missing person (UC-C04, UC-F10): place, time, short description and source (decision 61).
 * It never becomes the LKP by itself: when it is later than the current LKP the commander is asked (decisions 59, 63).
 */
export const sightings = pgTable(
  'sightings',
  {
    id: uuid().primaryKey().defaultRandom(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    /** Who reported it: the commander (UC-C04) or a searcher in the mission (UC-F10). */
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.id),
    source: sightingSource().notNull(),
    position: pointColumn().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    description: text(),
    /** The commander's answer to the LKP suggestion; null while undecided or never suggested. */
    lkpDecision: lkpDecision('lkp_decision'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('sightings_mission_idx').on(t.missionId, t.createdAt)],
);

/** Every LKP the commander set. The newest is the current one; older ones stay as history (UC-C04). */
export const lkpPoints = pgTable(
  'lkp_points',
  {
    id: uuid().primaryKey().defaultRandom(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    position: pointColumn().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    /** The sighting this LKP came from; null for the LKP set when the mission was created. */
    sightingId: uuid('sighting_id').references(() => sightings.id),
    /** Who set it; null for points saved before this was recorded. */
    setBy: uuid('set_by').references(() => users.id),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('lkp_points_mission_idx').on(t.missionId, t.createdAt)],
);

/**
 * Search polygons. Deleting only sets `deleted_at`: routes, reports and coverage that refer to the polygon stay in the
 * mission history (decision 36).
 */
export const polygons = pgTable(
  'polygons',
  {
    id: uuid().primaryKey().defaultRandom(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    status: polygonStatus().notNull().default('unassigned'),
    geometry: polygonColumn().notNull(),
    /** Coverage Estimate in whole percent (UC-S02); null until the first Searching point is counted. */
    coverage: integer(),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('polygons_geometry_idx').using('gist', t.geometry)],
);
