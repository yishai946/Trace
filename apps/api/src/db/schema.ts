import { MISSION_STATUSES, PARTICIPATION_STATUSES, POLYGON_STATUSES, TASK_STATUSES, USER_ROLES } from '@trace/domain';
import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pointColumn, polygonColumn } from './geometry';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const missionStatus = pgEnum('mission_status', MISSION_STATUSES);
export const polygonStatus = pgEnum('polygon_status', POLYGON_STATUSES);
export const participationStatus = pgEnum('participation_status', PARTICIPATION_STATUSES);
export const taskStatus = pgEnum('task_status', TASK_STATUSES);
export const userRole = pgEnum('user_role', USER_ROLES);

/*
 * Sign-in tables owned by Better Auth (users, sessions, accounts, verifications). Their columns follow its core schema
 * and the phone-number plugin; `role` is ours. See src/auth.
 */

/** Anyone who signs in: a commander (email and password) or a searcher (phone and OTP). */
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: userRole().notNull().default('searcher'),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: boolean(),
  ...timestamps,
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    ...timestamps,
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** A way to sign in. Commanders have a `credential` account holding the password hash. */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
);

/** Short-lived codes, such as the OTP sent to a searcher's phone. */
export const verifications = pgTable(
  'verifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

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
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('polygons_geometry_idx').using('gist', t.geometry)],
);

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
