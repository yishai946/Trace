import type { Message } from '@trace/schemas';
import type { MessageUrgency } from '@trace/domain';
import { Link } from 'react-aria-components';
import { Button } from '../../components/Button';
import { timeLabel } from '../../mission/timeLabel';
import styles from './MessagesPage.module.css';
import { recipientsLabel, statusSummary, URGENCY_LABEL } from './messageView';

/** The urgency as a word on a badge: colour only adds to it (brand book). */
export function UrgencyBadge({ urgency }: { urgency: MessageUrgency }) {
  return (
    <span className={styles.badge} data-urgency={urgency}>
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

export interface SentMessagesProps {
  /** Newest first. `undefined` while loading. */
  messages: Message[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** What the commander sent (wireframe Cd11 "הודעות שנשלחו"): one row per message with its progress. */
export function SentMessages({ messages, loadFailed, onRetry, selectedId, onSelect }: SentMessagesProps) {
  return (
    <section className={`${styles.panel} ${styles.sent}`} aria-label="הודעות שנשלחו">
      <div className={styles.section}>
        <h2 className={`${styles.title} ${styles.grow}`}>הודעות שנשלחו</h2>
        <span className={styles.meta}>נשלחה ← נקראה ← אושרה (קריטית)</span>
      </div>
      {messages === undefined ? (
        loadFailed ? (
          <div className={styles.empty}>
            <p role="alert">לא ניתן לטעון את ההודעות מהשרת.</p>
            <Button onPress={onRetry}>נסה שוב</Button>
          </div>
        ) : (
          <p className={styles.empty}>טוען הודעות…</p>
        )
      ) : messages.length === 0 ? (
        <p className={styles.empty}>עוד לא נשלחו הודעות במסע הזה.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.fixed}`}>
            <thead>
              <tr>
                <th scope="col" className={styles.colMessage}>
                  הודעה
                </th>
                <th scope="col" className={styles.colTarget}>
                  נמענים
                </th>
                <th scope="col" className={styles.colUrgency}>
                  דחיפות
                </th>
                <th scope="col" className={styles.colTime}>
                  שעה
                </th>
                <th scope="col" className={styles.colStatus}>
                  מצב
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => {
                const selected = message.id === selectedId;
                return (
                  <tr key={message.id} data-selected={selected || undefined}>
                    <td>
                      <Link
                        className={styles.rowLink}
                        aria-current={selected ? 'true' : undefined}
                        onPress={() => onSelect(message.id)}
                      >
                        {message.body}
                      </Link>
                    </td>
                    <td>{recipientsLabel(message)}</td>
                    <td>
                      <UrgencyBadge urgency={message.urgency} />
                    </td>
                    <td>
                      <time dateTime={message.sentAt} className={styles.num}>
                        {timeLabel(message.sentAt)}
                      </time>
                    </td>
                    <td>{statusSummary(message)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
