import { acceptsReports, canChangeReport, canSubmitReport, detectPhotoType, reportSummary } from '@trace/domain';
import type { CreateReportBody, Report, TimelineEvent, UpdateReportBody } from '@trace/schemas';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import type { Tx } from '../../db';
import { missions, participations, reportPhotos, reports } from '../../db/schema';
import { AppError, forbidden, notFound, missionEnded, participationEnded, unsupportedPhoto } from '../../errors';
import { logAndReport } from '../../monitoring';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';
import { findReport, isReportVisible, reportRecipients } from './reports.read';

interface CreateReportResult {
  report: Report;
  /** False when the id was already saved: the report is the one saved before and nothing was recorded. */
  created: boolean;
  /** The timeline event to publish after the commit; null for a repeated send. */
  event: TimelineEvent | null;
}

/**
 * Tells the mission a report was saved: the commander and, besides them, the searchers who may see it (decision 80),
 * read after the change is saved.
 */
async function publishSaved({ db, realtime, log }: ServiceDeps, missionId: string, report: Report) {
  let options: { searcherIds?: string[] } = {};
  try {
    options = { searcherIds: await reportRecipients(db, { reportId: report.id }) };
  } catch (error) {
    // The report is saved: a failed lookup must not fail the response. The commander still hears of it.
    logAndReport(log, error, { source: 'reports.recipients', message: 'Report recipients lookup failed' });
  }
  realtime.publish({ type: 'report.saved', missionId, report }, options);
}

/**
 * Saves a searcher's field report (UC-F09) as New, with the searcher's polygon at this moment. The id comes from the
 * phone, so a report sent again (a lost answer, an offline retry) returns the one already saved. The mission and the
 * participation are checked first, so a report that reaches the server after the mission ended is refused.
 */
export async function createReport(
  deps: ServiceDeps,
  {
    missionId,
    searcherId,
    actor,
    body,
  }: { missionId: string; searcherId: string; actor: Actor; body: z.output<typeof CreateReportBody> },
): Promise<{ report: Report; created: boolean }> {
  const { db, realtime } = deps;
  const result: CreateReportResult = await db.transaction(async (tx) => {
    const [participation] = await tx
      .select({ status: participations.status, polygonId: participations.polygonId })
      .from(participations)
      .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)))
      .for('update');
    if (!participation) throw notFound('Mission');
    const [mission] = await tx.select({ status: missions.status }).from(missions).where(eq(missions.id, missionId));
    if (!mission) throw notFound('Mission');
    if (!canSubmitReport(mission.status)) throw missionEnded('An ended mission takes no new reports');
    if (!acceptsReports(participation.status)) throw participationEnded();

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
  const { report, created, event } = result;
  if (created) {
    await publishSaved(deps, missionId, report);
    if (event) realtime.publish({ type: 'timeline.recorded', missionId, event });
  }
  return { report, created };
}

/**
 * Attaches or replaces a report's photo. Only the searcher who sent the report may, and another's report answers 404 so
 * its existence is not revealed. An ended mission is read-only.
 */
export async function setReportPhoto(
  deps: ServiceDeps,
  { missionId, reportId, userId, data }: { missionId: string; reportId: string; userId: string; data: Buffer },
): Promise<Report> {
  const { db } = deps;
  const [row] = await db
    .select({ missionId: reports.missionId, reportedBy: reports.reportedBy, missionStatus: missions.status })
    .from(reports)
    .innerJoin(missions, eq(missions.id, reports.missionId))
    .where(eq(reports.id, reportId));
  if (!row || row.missionId !== missionId || row.reportedBy !== userId) throw notFound('Report');
  if (!canSubmitReport(row.missionStatus)) {
    throw missionEnded('The photo of a report in an ended mission cannot be changed');
  }
  const contentType = detectPhotoType(data);
  if (!contentType) throw unsupportedPhoto();
  await db
    .insert(reportPhotos)
    .values({ reportId, contentType, data })
    .onConflictDoUpdate({ target: reportPhotos.reportId, set: { contentType, data, updatedAt: new Date() } });
  const report = await findReport(db, reportId);
  await publishSaved(deps, missionId, report);
  return report;
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

const reportsLocked = () => missionEnded('The reports of an ended mission cannot be changed');

/**
 * The commander marks a report Handled, one way (decision 17). Marking a handled report again returns it as it is;
 * the mission hears of it only when it changed.
 */
export async function markReportHandled(
  deps: ServiceDeps,
  { missionId, reportId }: { missionId: string; reportId: string },
): Promise<Report> {
  const { report, changed } = await deps.db.transaction(async (tx) => {
    const row = await lockReport(tx, missionId, reportId);
    if (!canChangeReport(row.missionStatus)) throw reportsLocked();
    const updated = await tx
      .update(reports)
      .set({ status: 'handled' })
      .where(and(eq(reports.id, reportId), eq(reports.status, 'new')))
      .returning({ id: reports.id });
    return { report: await findReport(tx, reportId), changed: updated.length > 0 };
  });
  if (changed) await publishSaved(deps, missionId, report);
  return report;
}

/**
 * The commander or the author edits the category or the text; there is no version history (decision 88). Another
 * searcher who may see the report gets 403; one who may not gets 404, so its existence is not revealed.
 */
export async function updateReport(
  deps: ServiceDeps,
  {
    missionId,
    reportId,
    actor,
    body,
  }: { missionId: string; reportId: string; actor: Actor; body: z.output<typeof UpdateReportBody> },
): Promise<Report> {
  const report = await deps.db.transaction(async (tx) => {
    const row = await lockReport(tx, missionId, reportId);
    if (actor.role !== 'commander' && row.reportedBy !== actor.userId) {
      throw (await isReportVisible(tx, { missionId, reportId, actor })) ? forbidden() : notFound('Report');
    }
    if (!canChangeReport(row.missionStatus)) throw reportsLocked();
    await tx
      .update(reports)
      .set({
        ...(body.type !== undefined && { type: body.type }),
        ...(body.text !== undefined && { text: body.text }),
      })
      .where(eq(reports.id, reportId));
    return findReport(tx, reportId);
  });
  await publishSaved(deps, missionId, report);
  return report;
}

/**
 * The commander deletes a report; its photo goes with it (decision 89). The searchers to tell are read before the
 * report is gone.
 */
export async function deleteReport(
  { db, realtime }: ServiceDeps,
  { missionId, reportId }: { missionId: string; reportId: string },
): Promise<void> {
  const searcherIds = await db.transaction(async (tx) => {
    const row = await lockReport(tx, missionId, reportId);
    if (!canChangeReport(row.missionStatus)) throw reportsLocked();
    const searcherIds = await reportRecipients(tx, { reportId });
    await tx.delete(reports).where(eq(reports.id, reportId));
    return searcherIds;
  });
  realtime.publish({ type: 'report.deleted', missionId, reportId }, { searcherIds });
}
