import { REPORT_STATUS_LABELS } from '@trace/domain';
import type { MissionPolygon, Report } from '@trace/schemas';
import { Link } from 'react-aria-components';
import { CheckIcon, ReportTypeIcon } from '../../components/icons';
import { listMeta, listTitle } from '../reportView';
import styles from './ReportRow.module.css';

export interface ReportRowProps {
  report: Report;
  polygons: MissionPolygon[];
  /** The row whose details are open. */
  current?: boolean;
  onSelect: (id: string) => void;
}

/** One report in a list (wireframes Cd10 and Cm10): its glyph, what was sent, who sent it and where, and its status. */
export function ReportRow({ report, polygons, current, onSelect }: ReportRowProps) {
  return (
    <Link className={styles.item} aria-current={current ? 'true' : undefined} onPress={() => onSelect(report.id)}>
      <span className={styles.glyph} data-type={report.type}>
        <ReportTypeIcon type={report.type} />
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemTitle}>{listTitle(report)}</span>
        <span className={styles.itemMeta}>{listMeta(report, polygons)}</span>
      </span>
      <span className={styles.badge} data-status={report.status}>
        {report.status === 'handled' && <CheckIcon />}
        {REPORT_STATUS_LABELS[report.status]}
      </span>
    </Link>
  );
}
