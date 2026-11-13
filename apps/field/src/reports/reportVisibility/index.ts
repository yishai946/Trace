import { compareReportsNewestFirst } from '@trace/domain';
import type { OwnParticipation, Report } from '@trace/schemas';

/** My report: sent by a searcher with my callsign, which is unique in the mission. */
export function isMine(report: Pick<Report, 'reportedBy'>, participation: Pick<OwnParticipation, 'callsign'>): boolean {
  return report.reportedBy.role === 'searcher' && report.reportedBy.callsign === participation.callsign;
}

/** Sent from the polygon I am assigned to now (decision 80). Only an Assigned searcher has one. */
export function isInMyPolygon(
  report: Pick<Report, 'polygonId'>,
  participation: Pick<OwnParticipation, 'status' | 'polygonId'>,
): boolean {
  return (
    participation.status === 'assigned' && report.polygonId !== null && report.polygonId === participation.polygonId
  );
}

/**
 * What a searcher sees of a list of reports, the same rule the server applies (decision 80): the reports of the
 * polygon they are in and their own, newest first. A list cached before a move may hold others.
 */
export function visibleReports(reports: Report[], participation: OwnParticipation | null): Report[] {
  if (!participation) return [];
  return reports
    .filter((report) => isMine(report, participation) || isInMyPolygon(report, participation))
    .sort(compareReportsNewestFirst);
}
