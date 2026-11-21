import type { Message } from '@trace/schemas';
import { useEffect, useRef } from 'react';
import { ListState } from '../../components/ListState';
import { SENT_MESSAGES_TEXT } from '../../mission/messageView';
import { MessageCard } from './MessageCard';
import styles from './PhoneMessagesPage.module.css';

interface PhoneSentListProps {
  /** Newest first. `undefined` while loading. */
  messages: Message[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  onOpenDetail: (id: string) => void;
  /** The commander came back from a message's recipients: focus moves to the list. */
  autoFocus: boolean;
}

/** What was sent, newest first, one card each. */
export function PhoneSentList({ messages, loadFailed, onRetry, onOpenDetail, autoFocus }: PhoneSentListProps) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autoFocus) section.current?.focus();
  }, [autoFocus]);

  return (
    <section ref={section} tabIndex={-1} aria-label="הודעות שנשלחו" className={styles.list}>
      <ListState
        items={messages}
        loadFailed={loadFailed}
        onRetry={onRetry}
        className={styles.empty}
        text={SENT_MESSAGES_TEXT}
      >
        {(items) => (
          <ul className={styles.items}>
            {items.map((message) => (
              <li key={message.id}>
                <MessageCard message={message} onOpenDetail={onOpenDetail} />
              </li>
            ))}
          </ul>
        )}
      </ListState>
    </section>
  );
}
