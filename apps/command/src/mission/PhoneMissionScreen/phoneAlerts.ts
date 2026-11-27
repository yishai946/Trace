import { isCriticalReport, isMissionEnded } from '@trace/domain';
import type { Mission, Report, Sos } from '@trace/schemas';
import type { SafetyWarning } from '../safetyWarnings';
import { statusCounts } from '../reportView';

/** What the phone's map stage warns about: whether a critical report waits, how many reports are new, how many SOS are active, and the stack height. */
export function phoneAlerts(input: {
  mission: Mission;
  reports: Report[] | undefined;
  sos: Sos[] | undefined;
  sosFailed: boolean;
  warnings: SafetyWarning[];
}) {
  // An ended mission is read-only: the alert would lead to a report that cannot be handled.
  const critical = !isMissionEnded(input.mission.status) && (input.reports ?? []).some(isCriticalReport);
  // Safety continues until Finish Activity, so an active SOS shows in an ended mission too.
  const activeSos = (input.sos ?? []).filter((s) => s.status === 'active').length;
  const count = [activeSos > 0, input.sosFailed, critical, input.warnings.length > 0].filter(Boolean).length;
  const newReports = input.reports ? statusCounts(input.reports).new : 0;
  return { critical, activeSos, newReports, count };
}
