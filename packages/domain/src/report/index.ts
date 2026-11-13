import { isMissionEnded, type MissionStatus } from '../mission';
import type { ParticipationStatus } from '../participation';

/** The five field report categories (decision 15, UC-F09). */
export const REPORT_TYPES = ['finding', 'hazard', 'inaccessible', 'general', 'located'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** A report starts New and the commander marks it Handled (decision 17). */
export const REPORT_STATUSES = ['new', 'handled'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** The Hebrew name of each category, as the searcher and the commander see it. */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  finding: 'ממצא / רמז',
  hazard: 'מפגע',
  inaccessible: 'לא נגיש',
  general: 'כללי',
  located: 'הנעדר אותר',
};

/** An active or paused mission takes reports. An ended mission is read-only (State and Rules §6). */
export function canSubmitReport(missionStatus: MissionStatus): boolean {
  return !isMissionEnded(missionStatus);
}

/** The precondition is "participates in the mission", so Available and Assigned searchers may report (UC-F09). */
export function acceptsReports(status: ParticipationStatus): boolean {
  return status !== 'ended';
}

/** The timeline label of a report: its category, then what the searcher wrote. */
export function reportSummary(report: { type: ReportType; text: string }): string {
  return `${REPORT_TYPE_LABELS[report.type]}, ${report.text}`;
}

/** The Hebrew status word (wireframe Cd10: "חדש", "טופל"). */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = { new: 'חדש', handled: 'טופל' };

/** An active or paused mission lets the commander and the author change its reports; an ended one is read-only (State and Rules §6). */
export function canChangeReport(missionStatus: MissionStatus): boolean {
  return !isMissionEnded(missionStatus);
}

/** A "located" report is a critical alert to the commander until it is marked Handled; it never ends the mission (decision 18). */
export function isCriticalReport(report: { type: ReportType; status: ReportStatus }): boolean {
  return report.type === 'located' && report.status === 'new';
}

/** Newest first by when it was sent, then by arrival (wireframe Cd10). Compares the instants, so offsets do not matter. */
export function compareReportsNewestFirst(
  a: { reportedAt: string; createdAt: string },
  b: { reportedAt: string; createdAt: string },
): number {
  return Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || Date.parse(b.createdAt) - Date.parse(a.createdAt);
}
