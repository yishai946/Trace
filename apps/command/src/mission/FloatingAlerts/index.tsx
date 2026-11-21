import { isCriticalReport } from '@trace/domain';
import type { Report, Sos } from '@trace/schemas';
import { CriticalReportAlert } from '../CriticalReportAlert';
import { SosAlert } from '../SosAlert';
import styles from './FloatingAlerts.module.css';

export interface FloatingAlertsProps {
  /** Newest first, as the API returns them. */
  reports: Report[];
  sos: Sos[];
  onOpenReport: (reportId: string) => void;
  onOpenSos: () => void;
}

/** The alerts that float at the top centre of the live map: the SOS on top (UC-C14), the critical report under it (UC-C11). */
export function FloatingAlerts({ reports, sos, onOpenReport, onOpenSos }: FloatingAlertsProps) {
  if (!sos.some((s) => s.status === 'active') && !reports.some(isCriticalReport)) return null;
  return (
    <div className={styles.stack}>
      <SosAlert sos={sos} onOpen={onOpenSos} />
      <CriticalReportAlert reports={reports} onOpen={onOpenReport} />
    </div>
  );
}
