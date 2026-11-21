import type { Message } from '@trace/schemas';
import { Fragment, useId } from 'react';
import { Link } from 'react-aria-components';
import { readFractions, recipientsLabel } from '../../mission/messageView';
import { timeLabel } from '../../mission/timeLabel';
import { UrgencyBadge } from '../../mission/UrgencyBadge';
import styles from './PhoneMessagesPage.module.css';

interface MessageCardProps {
  message: Message;
  /** The card's name and title when it stands for the latest message; otherwise the recipients and time. */
  heading?: string;
  onOpenDetail: (id: string) => void;
}

/** A sent message (wireframe Cm11 "נשלחה לאחרונה"): who and when, its urgency, one line of text and how many read it. */
export function MessageCard({ message, heading, onOpenDetail }: MessageCardProps) {
  const bodyId = useId();
  const label = heading ?? recipientsLabel(message);
  return (
    <section className={styles.card} aria-label={heading ?? `${label}, ${timeLabel(message.sentAt)}`}>
      <div className={styles.cardHead}>
        <span className={`${styles.meta} ${styles.grow}`}>
          {label},{' '}
          <time dateTime={message.sentAt} className={styles.num}>
            {timeLabel(message.sentAt)}
          </time>
        </span>
        <UrgencyBadge urgency={message.urgency} />
      </div>
      <p id={bodyId} className={styles.ell}>
        {message.body}
      </p>
      <p className={styles.meta}>
        {readFractions(message).map(({ label: step, value }) => (
          <Fragment key={step}>
            {step} <span className={styles.num}>{value}</span>,{' '}
          </Fragment>
        ))}
        <Link className={styles.detailLink} aria-describedby={bodyId} onPress={() => onOpenDetail(message.id)}>
          פירוט לפי נמען
        </Link>
      </p>
    </section>
  );
}
