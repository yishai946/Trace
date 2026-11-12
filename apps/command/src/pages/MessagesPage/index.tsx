import type { Message, MissionPolygon, Participant, SendMessageBody } from '@trace/schemas';
import { useState } from 'react';
import { ComposeMessage } from './ComposeMessage';
import styles from './MessagesPage.module.css';
import { RecipientDetail } from './RecipientDetail';
import { SentMessages } from './SentMessages';

export interface MessagesPageProps {
  /** Newest first, as the API returns them. `undefined` while loading. */
  messages: Message[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  participants: Participant[] | undefined;
  participantsFailed: boolean;
  polygons: MissionPolygon[];
  /** The mission ended: the history stays, sending is closed. */
  ended: boolean;
  /** Undefined while sending is blocked (no connection, or the mission ended). `onSent` runs after the server saved it. */
  onSend?: (body: SendMessageBody, onSent: (message: Message) => void) => void;
  sending: boolean;
  sendError: string | null;
}

/** Operational messages (UC-C12, wireframe Cd11): compose one, follow what was sent and who read it. */
export function MessagesPage({
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
}: MessagesPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The newest is selected until the commander picks another, as the top row is in the wireframe.
  const shown = messages?.find((m) => m.id === selectedId) ?? messages?.[0];

  return (
    <div className={styles.page}>
      <ComposeMessage
        participants={participants}
        participantsFailed={participantsFailed}
        polygons={polygons}
        ended={ended}
        onSend={onSend}
        sending={sending}
        sendError={sendError}
        onSent={(message) => setSelectedId(message.id)}
      />
      <div className={styles.column}>
        <SentMessages
          messages={messages}
          loadFailed={loadFailed}
          onRetry={onRetry}
          selectedId={shown?.id ?? null}
          onSelect={setSelectedId}
        />
        {shown && <RecipientDetail message={shown} participants={participants ?? []} polygons={polygons} />}
      </div>
    </div>
  );
}
