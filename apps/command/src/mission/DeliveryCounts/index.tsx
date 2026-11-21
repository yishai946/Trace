import type { Message } from '@trace/schemas';
import { counts } from '../messageView';
import styles from './DeliveryCounts.module.css';

interface DeliveryCountsProps {
  message: Message;
  className?: string;
}

/** How many recipients got, read and (for a critical message) acknowledged it. */
export function DeliveryCounts({ message, className }: DeliveryCountsProps) {
  const total = counts(message);
  const fraction = (n: number) => (
    <b className={styles.num}>
      {n}/{total.total}
    </b>
  );
  return (
    <div className={[styles.counts, className].filter(Boolean).join(' ')}>
      <span>נמסרה {fraction(total.delivered)}</span>
      <span>נקראה {fraction(total.read)}</span>
      {message.urgency === 'critical' && <span>אושרה {fraction(total.acknowledged)}</span>}
    </div>
  );
}
