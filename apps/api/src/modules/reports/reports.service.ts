import { acceptsReports, canChangeReport, canSubmitReport, detectPhotoType, reportSummary } from '@trace/domain';
import {
  PointGeometry,
  type CreateReportBody,
  type Report,
  type TimelineEvent,
  type UpdateReportBody,
} from '@trace/schemas';
import { and, desc, eq, or, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import type { Db, Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { missions, participations, reportPhotos, reports, searchers, users } from '../../db/schema';
import { AppError, forbidden, notFound } from '../../errors';
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

/**
 * Locks the report of this mission, so two changes to it do not interleave. A report of another mission is not found.
 */
async function lockReport(tx: Tx, missionId: string, reportId: string) {
  const [row] = await tx
    .select({ reportedBy: reports.reportedBy, missionStatus: missions.status })
    .from(reports)
    .innerJoin(missions, eq(missions.id, reports.missionId))
    .where(and(eq(reports.id, reportId), eq(reports.missionId, missionId)))
    .for('update', { of: reports });
  if (!row) throw notFound('Report');
  return row;
}

const missionEnded = () => new AppError(409, 'MISSION_ENDED', 'The reports of an ended mission cannot be changed');

/**
 * The commander marks a report Handled, one way (decision 17). Marking a handled report again returns it as it is;
 * `changed` tells the route whether to publish.
 */
export async function markReportHandled(
  db: Db,
  { missionId, reportId }: { missionId: string; reportId: string },
): Promise<{ report: Report; changed: boolean }> {
  return db.transaction(async (tx) => {
    const row = await lockReport(tx, missionId, reportId);
    if (!canChangeReport(row.missionStatus)) throw missionEnded();
    const updated = await tx
      .update(reports)
      .set({ status: 'handled' })
      .where(and(eq(reports.id, reportId), eq(reports.status, 'new')))
      .returning({ id: reports.id });
    return { report: await findReport(tx, reportId), changed: updated.length > 0 };
  });
}

/** The commander or the author edits the category or the text; there is no version history (decision 88). */
export async function updateReport(
  db: Db,
  {
    missionId,
    reportId,
    actor,
    body,
  }: { missionId: string; reportId: string; actor: Actor; body: z.output<typeof UpdateReportBody> },
): Promise<Report> {
  return db.transaction(async (tx) => {
    const row = await lockReport(tx, missionId, reportId);
    if (actor.role !== 'commander' && row.reportedBy !== actor.userId) throw forbidden();
    if (!canChangeReport(row.missionStatus)) throw missionEnded();
    await tx
      .update(reports)
      .set({
        ...(body.type !== undefined && { type: body.type }),
        ...(body.text !== undefined && { text: body.text }),
      })
      .where(eq(reports.id, reportId));
    return findReport(tx, reportId);
  });
}

/**
 * The commander deletes a report; its photo goes with it (decision 89). Returns the searchers to tell, read before the
 * report is gone.
 */
export async function deleteReport(
  db: Db,
  { missionId, reportId }: { missionId: string; reportId: string },
): Promise<{ searcherIds: string[] }> {
  return db.transaction(async (tx) => {
    const row = await lockReport(tx, missionId, reportId);
    if (!canChangeReport(row.missionStatus)) throw missionEnded();
    const searcherIds = await reportRecipients(tx, { reportId });
    await tx.delete(reports).where(eq(reports.id, reportId));
    return { searcherIds };
  });
}
