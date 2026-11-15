import type { Message } from '@trace/schemas';
import styles from './MessagesPage.module.css';
import { counts } from './messageView';

/** How many recipients got, read and (for a critical message) acknowledged it. */
export function DeliveryCounts({ message }: { message: Message }) {
  const total = counts(message);
  const fraction = (n: number) => (
    <b className={styles.num}>
      {n}/{total.total}
    </b>
  );
  return (
    <div className={`${styles.counts} ${styles.fullRow}`}>
      <span>נמסרה {fraction(total.delivered)}</span>
      <span>נקראה {fraction(total.read)}</span>
      {message.urgency === 'critical' && <span>אושרה {fraction(total.acknowledged)}</span>}
    </div>
  );
}
