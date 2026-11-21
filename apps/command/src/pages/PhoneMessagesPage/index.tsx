import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import type { Connection } from '../../components/ConnectionStatus';
import { ComposeMessage } from '../../mission/ComposeMessage';
import { PhoneScreenBar } from '../../mission/PhoneScreenBar';
import type { MessagesPageProps } from '../MessagesPage';
import { MessageCard } from './MessageCard';
import styles from './PhoneMessagesPage.module.css';
import { PhoneRecipientDetail } from './PhoneRecipientDetail';
import { PhoneSentList } from './PhoneSentList';
import { usePhoneMessages } from './usePhoneMessages';

export interface PhoneMessagesPageProps extends MessagesPageProps {
  connection: Connection;
}

/** Command on the phone, operational messages (UC-C12, wireframe Cm11): a new message, or what was sent and who read it. */
export function PhoneMessagesPage({
  messages,
  loadFailed,
  onRetry,
  participants,
  participantsFailed,
  polygons,
  ended,
  onSend,
  sending,
  sendError,
  connection,
}: PhoneMessagesPageProps) {
  const { tab, selectTab, detail, openDetail, closeDetail, returning } = usePhoneMessages(messages);
  const latest = messages?.[0];

  return (
    <div className={styles.page}>
      <PhoneScreenBar title="הודעות" connection={connection} />
      <Tabs selectedKey={tab} onSelectionChange={selectTab} className={styles.tabs}>
        <div className={styles.scroll}>
          <TabList aria-label="תצוגה" className={styles.seg}>
            <Tab id="new" className={styles.segTab}>
              חדשה
            </Tab>
            <Tab id="sent" className={styles.segTab}>
              נשלחו
            </Tab>
          </TabList>
          <TabPanel id="new" className={styles.panel}>
            <ComposeMessage
              phone
              participants={participants}
              participantsFailed={participantsFailed}
              polygons={polygons}
              ended={ended}
              onSend={onSend}
              sending={sending}
              sendError={sendError}
            />
            {latest && <MessageCard message={latest} heading="נשלחה לאחרונה" onOpenDetail={openDetail} />}
          </TabPanel>
          <TabPanel id="sent" className={styles.panel}>
            {detail ? (
              <PhoneRecipientDetail
                message={detail}
                participants={participants ?? []}
                polygons={polygons}
                onBack={closeDetail}
              />
            ) : (
              <PhoneSentList
                messages={messages}
                loadFailed={loadFailed}
                onRetry={onRetry}
                onOpenDetail={openDetail}
                autoFocus={returning}
              />
            )}
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}
