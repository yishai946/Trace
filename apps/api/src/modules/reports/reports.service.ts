import { acceptsReports, canSubmitReport, detectPhotoType, reportSummary } from '@trace/domain';
import { PointGeometry, type CreateReportBody, type Report, type TimelineEvent } from '@trace/schemas';
import { and, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import type { Db, Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { missions, participations, reportPhotos, reports, searchers, users } from '../../db/schema';
import { AppError, notFound } from '../../errors';
import { recordEvent } from '../timeline/timeline.service';

const reportColumns = {
  id: reports.id,
  missionId: reports.missionId,
  polygonId: reports.polygonId,
  type: reports.type,
  status: reports.status,
  text: reports.text,
  position: asGeoJson(reports.position),
  accuracy: reports.accuracy,
  reportedAt: reports.reportedAt,
  reporterRole: users.role,
  reporterName: users.name,
  callsign: participations.callsign,
  hasPhoto: sql<boolean>`exists (select 1 from ${reportPhotos} where ${reportPhotos.reportId} = ${reports.id})`,
  createdAt: reports.createdAt,
};

// A searcher's callsign is per mission, so the join to participations is on the report's mission.
const selectReports = (db: Db | Tx) =>
  db
    .select(reportColumns)
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reportedBy))
    .leftJoin(searchers, eq(searchers.userId, reports.reportedBy))
    .leftJoin(
      participations,
      and(eq(participations.searcherId, searchers.id), eq(participations.missionId, reports.missionId)),
    )
    .$dynamic();
type ReportRow = Awaited<ReturnType<typeof selectReports>>[number];

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    missionId: row.missionId,
    polygonId: row.polygonId,
    type: row.type,
    status: row.status,
    text: row.text,
    position: PointGeometry.parse(JSON.parse(row.position)),
    accuracy: row.accuracy,
    reportedAt: row.reportedAt.toISOString(),
    reportedBy: { role: row.reporterRole, name: row.reporterName, callsign: row.callsign },
    hasPhoto: row.hasPhoto,
    createdAt: row.createdAt.toISOString(),
  };
}

async function findReport(db: Db | Tx, reportId: string): Promise<Report> {
  const [row] = await selectReports(db).where(eq(reports.id, reportId));
  if (!row) throw notFound('Report');
  return toReport(row);
}

export interface CreateReportResult {
  report: Report;
  /** False when the id was already saved: the report is the one saved before and nothing was recorded. */
  created: boolean;
  /** The timeline event to publish after the commit; null for a repeated send. */
  event: TimelineEvent | null;
}

/**
 * Saves a searcher's field report (UC-F09) as New, with the searcher's polygon at this moment. The id comes from the
 * phone, so a report sent again (a lost answer, an offline retry) returns the one already saved. The mission and the
 * participation are checked first, so a report that reaches the server after the mission ended is refused.
 */
export async function createReport(
  db: Db,
  {
    missionId,
    searcherId,
    actor,
    body,
  }: { missionId: string; searcherId: string; actor: Actor; body: z.output<typeof CreateReportBody> },
): Promise<CreateReportResult> {
  return db.transaction(async (tx) => {
    const [participation] = await tx
      .select({ status: participations.status, polygonId: participations.polygonId })
      .from(participations)
      .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)))
      .for('update');
    if (!participation) throw notFound('Mission');
    const [mission] = await tx.select({ status: missions.status }).from(missions).where(eq(missions.id, missionId));
    if (!mission) throw notFound('Mission');
    if (!canSubmitReport(mission.status)) {
      throw new AppError(409, 'MISSION_ENDED', 'An ended mission takes no new reports');
    }
    if (!acceptsReports(participation.status)) {
      throw new AppError(409, 'PARTICIPATION_ENDED', 'The activity in this mission has ended');
    }

    const inserted = await tx
      .insert(reports)
      .values({
        id: body.id,
        missionId,
        reportedBy: actor.userId,
        polygonId: participation.status === 'assigned' ? participation.polygonId : null,
        type: body.type,
        text: body.text,
        position: body.position,
        accuracy: body.accuracy,
        reportedAt: new Date(body.reportedAt),
      })
      .onConflictDoNothing({ target: reports.id })
      .returning({ id: reports.id });

    if (inserted.length === 0) {
      const existing = await findReport(tx, body.id);
      const [owner] = await tx.select({ reportedBy: reports.reportedBy }).from(reports).where(eq(reports.id, body.id));
      if (existing.missionId !== missionId || owner?.reportedBy !== actor.userId) {
        throw new AppError(409, 'REPORT_ID_TAKEN', 'This report id is already used');
      }
      return { report: existing, created: false, event: null };
    }

    const event = await recordEvent(tx, {
      missionId,
      actor,
      type: 'report.submitted',
      subject: { kind: 'report', id: body.id, label: reportSummary(body) },
      details: {},
      occurredAt: new Date(body.reportedAt),
    });
    return { report: await findReport(tx, body.id), created: true, event };
  });
}

/**
 * Attaches or replaces a report's photo. Only the searcher who sent the report may, and another's report answers 404 so
 * its existence is not revealed. An ended mission is read-only.
 */
export async function setReportPhoto(
  db: Db,
  { missionId, reportId, userId, data }: { missionId: string; reportId: string; userId: string; data: Buffer },
): Promise<Report> {
  const [row] = await db
    .select({ missionId: reports.missionId, reportedBy: reports.reportedBy, missionStatus: missions.status })
    .from(reports)
    .innerJoin(missions, eq(missions.id, reports.missionId))
    .where(eq(reports.id, reportId));
  if (!row || row.missionId !== missionId || row.reportedBy !== userId) throw notFound('Report');
  if (!canSubmitReport(row.missionStatus)) {
    throw new AppError(409, 'MISSION_ENDED', 'The photo of a report in an ended mission cannot be changed');
  }
  const contentType = detectPhotoType(data);
  if (!contentType) throw new AppError(415, 'UNSUPPORTED_PHOTO', 'The photo must be a JPEG, PNG or WebP image');
  await db
    .insert(reportPhotos)
    .values({ reportId, contentType, data })
    .onConflictDoUpdate({ target: reportPhotos.reportId, set: { contentType, data, updatedAt: new Date() } });
  return findReport(db, reportId);
}
