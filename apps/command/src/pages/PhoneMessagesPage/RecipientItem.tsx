import type { Message, MessageRecipient, MissionPolygon, Participant } from '@trace/schemas';
import { CallButton } from '../../components/CallButton';
import { CallsignChip } from '../../components/CallsignChip';
import { CheckIcon } from '../../components/icons';
import { isFinal, lastStepTime, recipientState, recipientStateLabel } from '../../mission/messageView';
import { timeLabel } from '../../mission/timeLabel';
import styles from './PhoneMessagesPage.module.css';

interface RecipientItemProps {
  message: Message;
  recipient: MessageRecipient;
  participants: Participant[];
  polygons: MissionPolygon[];
}

/** One recipient of a message: who, where, how far it got and when, and a call while it is not final. */
export function RecipientItem({ message, recipient, participants, polygons }: RecipientItemProps) {
  const participant = participants.find((p) => p.id === recipient.participantId);
  const polygon = polygons.find((p) => p.id === participant?.polygonId);
  const time = lastStepTime(recipient);
  const state = recipientState(recipient);
  return (
    <li className={styles.recipient}>
      <CallsignChip callsign={recipient.callsign} state={participant?.status === 'available' ? 'waiting' : 'normal'} />
      <div className={styles.who}>
        <span className={styles.ell}>{recipient.name}</span>
        <span className={styles.meta}>{polygon?.name ?? '—'}</span>
      </div>
      <div className={styles.where}>
        <span className={styles.state} data-state={state}>
          {state === 'acknowledged' && <CheckIcon />}
          {recipientStateLabel(recipient)}
        </span>
        {time && (
          <time dateTime={time} className={`${styles.meta} ${styles.num}`}>
            {timeLabel(time)}
          </time>
        )}
      </div>
      {participant && !isFinal(message, recipient) && (
        <CallButton phone={participant.phone} name={recipient.name} display="icon" />
      )}
    </li>
  );
}
