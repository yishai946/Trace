import { doublePrecision, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pointColumn } from '../geometry';
import { bytea, timestamps } from './columns';
import { reportStatus, reportType } from './enums';
import { users } from './auth';
import { missions, polygons } from './missions';

/**
 * A field report from a searcher (UC-F09, decisions 15, 16). The phone makes the id (UUIDv7), so sending a report again
 * saves it once. `polygon_id` is the searcher's polygon when the server received it: the lists that show reports to the
 * commander and to the searchers of a polygon filter on it (decision 80, UC-F11, UC-C11).
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid().primaryKey(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.id),
    polygonId: uuid('polygon_id').references(() => polygons.id),
    type: reportType().notNull(),
    status: reportStatus().notNull().default('new'),
    text: text().notNull(),
    position: pointColumn().notNull(),
    accuracy: doublePrecision(),
    /** When the searcher sent it on the phone. An offline report is created later (`created_at`). */
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('reports_mission_idx').on(t.missionId, t.createdAt), index('reports_polygon_idx').on(t.polygonId)],
);

/**
 * A report's photo, at most one. In the bucket (`reports/<id>/photo`) like `mission_photos`; `data` is only for a photo
 * saved before the move.
 */
export const reportPhotos = pgTable('report_photos', {
  reportId: uuid('report_id')
    .primaryKey()
    .references(() => reports.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(),
  data: bytea(),
  ...timestamps,
});
