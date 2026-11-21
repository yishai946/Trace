import type { Message } from '@trace/schemas';
import { Link } from 'react-aria-components';
import { ListState } from '../../components/ListState';
import { recipientsLabel, SENT_MESSAGES_TEXT, statusSummary } from '../../mission/messageView';
import { timeLabel } from '../../mission/timeLabel';
import { UrgencyBadge } from '../../mission/UrgencyBadge';
import styles from './MessagesPage.module.css';

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
      <ListState
        items={messages}
        loadFailed={loadFailed}
        onRetry={onRetry}
        className={styles.empty}
        text={SENT_MESSAGES_TEXT}
      >
        {(messages) => (
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
      </ListState>
    </section>
  );
}
