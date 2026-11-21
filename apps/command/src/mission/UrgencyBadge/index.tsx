import type { MessageUrgency } from '@trace/domain';
import { URGENCY_LABEL } from '../messageView';
import styles from './UrgencyBadge.module.css';

/** The urgency as a word on a badge: colour only adds to it (brand book). */
export function UrgencyBadge({ urgency }: { urgency: MessageUrgency }) {
  return (
    <span className={styles.badge} data-urgency={urgency}>
      {URGENCY_LABEL[urgency]}
    </span>
  );
}
