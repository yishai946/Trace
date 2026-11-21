import type { Message, MissionPolygon, Participant } from '@trace/schemas';
import { useEffect, useId, useRef } from 'react';
import { Button } from '../../components/Button';
import { BackIcon } from '../../components/icons';
import { DeliveryCounts } from '../../mission/DeliveryCounts';
import { byAttention, OFFLINE_NOTE, recipientsLabel } from '../../mission/messageView';
import { timeLabel } from '../../mission/timeLabel';
import { UrgencyBadge } from '../../mission/UrgencyBadge';
import styles from './PhoneMessagesPage.module.css';
import { RecipientItem } from './RecipientItem';

interface PhoneRecipientDetailProps {
  message: Message;
  participants: Participant[];
  polygons: MissionPolygon[];
  onBack: () => void;
}

/** Who got a message and where each one stands (wireframe Cd11 "פירוט לפי נמען", as a list for the phone). */
export function PhoneRecipientDetail({ message, participants, polygons, onBack }: PhoneRecipientDetailProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section aria-labelledby={headingId} className={styles.detail}>
      <div className={styles.cardHead}>
        <Button variant="icon" aria-label="חזרה להודעות שנשלחו" onPress={onBack}>
          <BackIcon />
        </Button>
        <h2 id={headingId} ref={heading} tabIndex={-1} className={`${styles.title} ${styles.grow}`}>
          פירוט לפי נמען
        </h2>
        <UrgencyBadge urgency={message.urgency} />
      </div>
      <p className={styles.meta}>
        {recipientsLabel(message)},{' '}
        <time className={styles.num} dateTime={message.sentAt}>
          {timeLabel(message.sentAt)}
        </time>
      </p>
      <p className={styles.body}>{message.body}</p>
      <div>
        <DeliveryCounts message={message} />
      </div>
      <ul className={styles.recipients} aria-label="נמענים">
        {[...message.recipients].sort(byAttention).map((recipient) => (
          <RecipientItem
            key={recipient.participantId}
            message={message}
            recipient={recipient}
            participants={participants}
            polygons={polygons}
          />
        ))}
      </ul>
      <p className={styles.meta}>{OFFLINE_NOTE}</p>
    </section>
  );
}
