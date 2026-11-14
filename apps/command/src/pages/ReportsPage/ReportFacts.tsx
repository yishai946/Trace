import { REPORT_STATUS_LABELS } from '@trace/domain';
import type { MissionPolygon, Report } from '@trace/schemas';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../../mission/timeLabel';
import styles from './ReportsPage.module.css';
import { polygonLabel, positionLabel } from '../../mission/reportView';

export interface ReportFactsProps {
  report: Report;
  polygons: MissionPolygon[];
}

/** Who sent the report, from which polygon, when, in what status and where. */
export function ReportFacts({ report, polygons }: ReportFactsProps) {
  const { callsign, name } = report.reportedBy;
  return (
    <dl className={styles.facts}>
      <div>
        <dt>מדווח</dt>
        <dd className={styles.reporter}>
          {callsign !== null && <CallsignChip callsign={callsign} />}
          {name}
        </dd>
      </div>
      <div>
        <dt>פוליגון</dt>
        <dd>{polygonLabel(report, polygons)}</dd>
      </div>
      <div>
        <dt>זמן</dt>
        <dd>
          <time className={styles.num} dateTime={report.reportedAt}>
            {timeLabel(report.reportedAt)}
          </time>
        </dd>
      </div>
      <div>
        <dt>סטטוס</dt>
        <dd>{REPORT_STATUS_LABELS[report.status]}</dd>
      </div>
      <div className={styles.wide}>
        <dt>מיקום GPS</dt>
        <dd>
          <span dir="ltr" className={styles.num}>
            {positionLabel(report)}
          </span>
        </dd>
      </div>
    </dl>
  );
}
