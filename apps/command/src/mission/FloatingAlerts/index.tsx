import { isCriticalReport } from '@trace/domain';
import type { Report, Sos } from '@trace/schemas';
import { CriticalReportAlert } from '../CriticalReportAlert';
import { SafetyAlert } from '../SafetyAlert';
import type { SafetyWarning } from '../safetyWarnings';
import { SosAlert } from '../SosAlert';
import styles from './FloatingAlerts.module.css';

export interface FloatingAlertsProps {
  /** Newest first, as the API returns them. */
  reports: Report[];
  sos: Sos[];
  /** The SOS could not be loaded: whether one is active is not known. */
  sosFailed?: boolean;
  onRetrySos?: () => void;
  onOpenReport: (reportId: string) => void;
  /** Opens the mission control to end the mission as located (UC-C16); missing when it cannot be ended. */
  onFinish?: () => void;
  /** The safety and Coverage warnings that hold now (UC-S04), most urgent first. */
  warnings?: SafetyWarning[];
  onOpenSearcher?: (participantId: string) => void;
  onOpenSos: () => void;
}

/**
 * The alerts that float at the top centre of the live map, by severity: the SOS on top (UC-C14), the critical report
 * under it (UC-C11), the safety warnings last (UC-S04).
 */
export function FloatingAlerts({
  reports,
  sos,
  sosFailed,
  onRetrySos,
  warnings = [],
  onOpenSearcher,
  onOpenReport,
  onFinish,
  onOpenSos,
}: FloatingAlertsProps) {
  const quiet = !sosFailed && !sos.some((s) => s.status === 'active') && !reports.some(isCriticalReport);
  if (quiet && warnings.length === 0) return null;
  return (
    <div className={styles.stack}>
      <SosAlert sos={sos} failed={sosFailed} onRetry={onRetrySos} onOpen={onOpenSos} />
      <CriticalReportAlert reports={reports} onOpen={onOpenReport} onFinish={onFinish} />
      <SafetyAlert warnings={warnings} onOpen={(id) => onOpenSearcher?.(id)} />
    </div>
  );
}
