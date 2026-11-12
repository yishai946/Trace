import {
  LKP_DECISIONS,
  MISSION_STATUSES,
  PARTICIPATION_STATUSES,
  POLYGON_STATUSES,
  SIGHTING_SOURCES,
  TASK_STATUSES,
  TIMELINE_EVENT_TYPES,
  TRACK_CONTEXTS,
  USER_ROLES,
} from '@trace/domain';
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
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
export const sightingSource = pgEnum('sighting_source', SIGHTING_SOURCES);
export const lkpDecision = pgEnum('lkp_decision', LKP_DECISIONS);
export const timelineEventType = pgEnum('timeline_event_type', TIMELINE_EVENT_TYPES);
export const trackContext = pgEnum('track_context', TRACK_CONTEXTS);

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

/** Sign-in codes requested per phone number, to limit how often one number gets a code (UC-F01). */
export const otpRequests = pgTable(
  'otp_requests',
  {
    id: uuid().primaryKey().defaultRandom(),
    phone: text().notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('otp_requests_phone_requested_at_idx').on(t.phone, t.requestedAt)],
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

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/**
 * The missing person's photo (UC-C02), at most one per mission. Kept in Postgres so the server needs no other storage
 * until the infrastructure decision (TECH_STACK.md); the size limit keeps rows small.
 */
export const missionPhotos = pgTable('mission_photos', {
  missionId: uuid('mission_id')
    .primaryKey()
    .references(() => missions.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(),
  data: bytea().notNull(),
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
    /** Who reported it: the commander here, a searcher once UC-F10 exists. */
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
    /** Since when the searcher's phone reports no GPS (decision 42); null while it works. */
    gpsUnavailableSince: timestamp('gps_unavailable_since', { withTimezone: true }),
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

/** An Expo push token of a searcher's device, registered by the session signed in on it. Signing out deletes it. */
export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    token: text().notNull().unique(),
    searcherId: uuid('searcher_id')
      .notNull()
      .references(() => searchers.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .unique()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('push_tokens_searcher_idx').on(t.searcherId)],
);
