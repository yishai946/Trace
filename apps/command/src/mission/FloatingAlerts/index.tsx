import { isCriticalReport } from '@trace/domain';
import type { Report, Sos } from '@trace/schemas';
import { CriticalReportAlert } from '../CriticalReportAlert';
import { OutsidePolygonAlert } from '../OutsidePolygonAlert';
import type { OutsideSearcher } from '../outsideSearchers';
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
  /** Searchers outside their polygon now (UC-S04), outside the longest first. */
  outside?: OutsideSearcher[];
  onOpenSearcher?: (participantId: string) => void;
  onOpenSos: () => void;
}

/**
 * The alerts that float at the top centre of the live map, by severity: the SOS on top (UC-C14), the critical report
 * under it (UC-C11), the out-of-polygon warning last (UC-S04).
 */
export function FloatingAlerts({
  reports,
  sos,
  sosFailed,
  onRetrySos,
  outside = [],
  onOpenSearcher,
  onOpenReport,
  onFinish,
  onOpenSos,
}: FloatingAlertsProps) {
  const quiet = !sosFailed && !sos.some((s) => s.status === 'active') && !reports.some(isCriticalReport);
  if (quiet && outside.length === 0) return null;
  return (
    <div className={styles.stack}>
      <SosAlert sos={sos} failed={sosFailed} onRetry={onRetrySos} onOpen={onOpenSos} />
      <CriticalReportAlert reports={reports} onOpen={onOpenReport} onFinish={onFinish} />
      <OutsidePolygonAlert searchers={outside} onOpen={(id) => onOpenSearcher?.(id)} />
    </div>
  );
}
