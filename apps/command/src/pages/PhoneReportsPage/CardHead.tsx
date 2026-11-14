import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS } from '@trace/domain';
import type { Report } from '@trace/schemas';
import { Button } from '../../components/Button';
import { CheckIcon, CloseIcon } from '../../components/icons';
import styles from './PhoneReportsPage.module.css';

interface CardHeadProps {
  report: Report;
  critical: boolean;
  onClose: () => void;
}

/** The card's title row: the kind of report, whether it is critical, its status and the close button. */
export function CardHead({ report, critical, onClose }: CardHeadProps) {
  return (
    <div className={styles.head}>
      {critical && <span className={`${styles.badge} ${styles.strong}`}>קריטי</span>}
      <h2 className={styles.cardTitle}>{REPORT_TYPE_LABELS[report.type]}</h2>
      <span className={styles.badge} data-status={report.status}>
        {report.status === 'handled' && <CheckIcon />}
        {REPORT_STATUS_LABELS[report.status]}
      </span>
      <Button variant="icon" aria-label="סגור" onPress={onClose}>
        <CloseIcon />
      </Button>
    </div>
  );
}
