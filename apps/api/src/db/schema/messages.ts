import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import { messageTargetKind, messageUrgency } from './enums';
import { sessions, users } from './auth';
import { missions } from './missions';
import { participations, searchers } from './participants';

/**
 * A commander's one-way message (UC-C12, decision 25). Kept after the mission ends. Its recipients are fixed when it
 * is sent (`message_recipients`); the target is kept to show who it was addressed to.
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    sentBy: uuid('sent_by')
      .notNull()
      .references(() => users.id),
    urgency: messageUrgency().notNull(),
    body: text().notNull(),
    targetKind: messageTargetKind('target_kind').notNull(),
    /** The polygons of a `polygons` target; null otherwise. Deleted polygons keep their row (decision 36). */
    targetPolygonIds: uuid('target_polygon_ids').array(),
    /** The participant of a `searcher` target; null otherwise. */
    targetParticipantId: uuid('target_participant_id').references(() => participations.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('messages_mission_idx').on(t.missionId, t.createdAt)],
);

/** Each recipient of a message and what their app reported (decision 77): delivered, read, acknowledged. */
export const messageRecipients = pgTable(
  'message_recipients',
  {
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    participationId: uuid('participation_id')
      .notNull()
      .references(() => participations.id, { onDelete: 'cascade' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.participationId] }),
    index('message_recipients_participation_idx').on(t.participationId),
  ],
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
