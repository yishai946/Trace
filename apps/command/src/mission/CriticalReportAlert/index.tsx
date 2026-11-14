import { isCriticalReport } from '@trace/domain';
import type { Report } from '@trace/schemas';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../timeLabel';
import styles from './CriticalReportAlert.module.css';

export interface CriticalReportAlertProps {
  /** Newest first, as the API returns them. */
  reports: Report[];
  onOpen: (reportId: string) => void;
  /** Floats at the top centre of the live map instead of sitting in the page. */
  floating?: boolean;
  /** The phone: one line under the top bar, without the note that the mission stays open. */
  compact?: boolean;
}

/**
 * The critical alert of a "located" report (UC-C11, decision 18): shown while it is New, so it survives a reload, and
 * gone once the commander marks it Handled. It never ends the mission. Several alerts are counted like the SOS banner.
 * The phone shows it compact under the top bar.
 */
export function CriticalReportAlert({ reports, onOpen, floating, compact }: CriticalReportAlertProps) {
  const critical = reports.filter(isCriticalReport);
  const report = critical[0];
  if (!report) return null;
  const { callsign, name } = report.reportedBy;

  return (
    <section
      className={styles.alert}
      data-floating={floating || undefined}
      data-compact={compact || undefined}
      role="alert"
      aria-label="התראה קריטית"
    >
      <span className={styles.badge}>{critical.length > 1 ? `קריטי · ${critical.length}` : 'קריטי'}</span>
      <div className={styles.text}>
        <b>דיווח &quot;הנעדר אותר&quot;</b> מ-{callsign !== null && <CallsignChip callsign={callsign} />} {name},{' '}
        <time className={styles.num} dateTime={report.reportedAt}>
          {timeLabel(report.reportedAt)}
        </time>
        , ממתין לאימות
        {!compact && <span className={styles.meta}>הדיווח אינו סוגר את המסע. רק המנהל מסיים אחרי אימות.</span>}
      </div>
      <Button onPress={() => onOpen(report.id)}>פתח</Button>
    </section>
  );
}
