import { PointGeometry, type Report } from '@trace/schemas';
import { and, desc, eq, or, type SQL } from 'drizzle-orm';
import type { Actor } from '../../auth/auth.plugin';
import type { Db, Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { participations, reportPhotos, reports, searchers, users } from '../../db/schema';
import { notFound } from '../../errors';

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
  photoUpdatedAt: reportPhotos.updatedAt,
  createdAt: reports.createdAt,
};

// A searcher's callsign is per mission, so the join to participations is on the report's mission.
const selectReports = (db: Db | Tx) =>
  db
    .select(reportColumns)
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reportedBy))
    .leftJoin(reportPhotos, eq(reportPhotos.reportId, reports.id))
    .leftJoin(searchers, eq(searchers.userId, reports.reportedBy))
    .leftJoin(
      participations,
      and(eq(participations.searcherId, searchers.id), eq(participations.missionId, reports.missionId)),
    )
    .$dynamic();
type ReportRow = Awaited<ReturnType<typeof selectReports>>[number];

/** The photo's address, with its version so a replaced photo is not served from a cache. */
const reportPhotoUrl = (missionId: string, reportId: string, updatedAt: Date) =>
  `/api/missions/${missionId}/reports/${reportId}/photo?v=${updatedAt.getTime()}`;

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
    hasPhoto: row.photoUpdatedAt !== null,
    photoUrl: row.photoUpdatedAt ? reportPhotoUrl(row.missionId, row.id, row.photoUpdatedAt) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findReport(db: Db | Tx, reportId: string): Promise<Report> {
  const [row] = await selectReports(db).where(eq(reports.id, reportId));
  if (!row) throw notFound('Report');
  return toReport(row);
}

/**
 * The extra filter that limits which of a mission's reports the actor may see (decision 80). The commander (checked by
 * the route) sees all of them. A searcher sees their own reports, and while Assigned also every report sent from the
 * polygon they are in now. An Available searcher, or one who finished, sees only their own.
 */
async function visibilityFilter(db: Db | Tx, missionId: string, actor: Actor): Promise<SQL | undefined> {
  if (actor.role === 'commander') return undefined;
  const own = eq(reports.reportedBy, actor.userId);
  if (!actor.searcherId) return own;
  const [participation] = await db
    .select({ status: participations.status, polygonId: participations.polygonId })
    .from(participations)
    .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, actor.searcherId)));
  if (participation?.status !== 'assigned' || !participation.polygonId) return own;
  return or(own, eq(reports.polygonId, participation.polygonId));
}

/**
 * The reports the actor may see, newest first (UC-C11, wireframe Cd10; UC-F11, wireframe Fm10, decision 80). Always
 * limited to this mission.
 */
export async function listReports(
  db: Db,
  { missionId, actor }: { missionId: string; actor: Actor },
): Promise<Report[]> {
  const visible = await visibilityFilter(db, missionId, actor);
  const rows = await selectReports(db)
    .where(and(eq(reports.missionId, missionId), visible))
    .orderBy(desc(reports.reportedAt), desc(reports.createdAt));
  return rows.map(toReport);
}

/**
 * The photo of a report, for whoever may see the report: its mission's commander, its author, or a searcher in its
 * polygon (decision 80). Anyone else gets 404, as the photo upload does.
 */
export async function getReportPhoto(
  db: Db,
  { missionId, reportId, actor }: { missionId: string; reportId: string; actor: Actor },
): Promise<{ contentType: string; data: Buffer; updatedAt: Date }> {
  const visible = await visibilityFilter(db, missionId, actor);
  const [row] = await db
    .select({
      contentType: reportPhotos.contentType,
      data: reportPhotos.data,
      updatedAt: reportPhotos.updatedAt,
    })
    .from(reports)
    .leftJoin(reportPhotos, eq(reportPhotos.reportId, reports.id))
    .where(and(eq(reports.id, reportId), eq(reports.missionId, missionId), visible));
  if (!row?.contentType || !row.data || !row.updatedAt) throw notFound('Photo');
  return { contentType: row.contentType, data: row.data, updatedAt: row.updatedAt };
}

/**
 * The searchers who get a report's realtime events besides the commander (decision 80): its author and the searchers
 * assigned to the report's polygon now. A report with no polygon reaches only its author. The realtime layer always
 * adds the commander.
 */
export async function reportRecipients(db: Db | Tx, { reportId }: { reportId: string }): Promise<string[]> {
  const [report] = await db
    .select({ missionId: reports.missionId, polygonId: reports.polygonId, authorId: searchers.id })
    .from(reports)
    .leftJoin(searchers, eq(searchers.userId, reports.reportedBy))
    .where(eq(reports.id, reportId));
  if (!report) return [];
  const recipients = new Set<string>();
  if (report.authorId) recipients.add(report.authorId);
  if (report.polygonId) {
    const assigned = await db
      .select({ searcherId: participations.searcherId })
      .from(participations)
      .where(
        and(
          eq(participations.missionId, report.missionId),
          eq(participations.status, 'assigned'),
          eq(participations.polygonId, report.polygonId),
        ),
      );
    for (const { searcherId } of assigned) recipients.add(searcherId);
  }
  return [...recipients];
}
