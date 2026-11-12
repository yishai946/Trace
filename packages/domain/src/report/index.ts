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
