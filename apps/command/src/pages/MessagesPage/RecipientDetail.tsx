import type { Message, MissionPolygon, Participant } from '@trace/schemas';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../../mission/timeLabel';
import styles from './MessagesPage.module.css';
import { UrgencyBadge } from './SentMessages';
import { byAttention, counts, isFinal, recipientsLabel, recipientStateLabel } from './messageView';

const BODY_PREVIEW = 40;

export interface RecipientDetailProps {
  message: Message;
  participants: Participant[];
  polygons: MissionPolygon[];
}

const stateOf = (r: Message['recipients'][number]) =>
  r.status === 'acknowledged' ? 'acknowledged' : r.status === 'read' ? 'read' : r.deliveredAt ? 'delivered' : 'pending';

/** The time of the latest step: acknowledged, else read, else delivered. */
const lastTime = (r: Message['recipients'][number]) => r.acknowledgedAt ?? r.readAt ?? r.deliveredAt;

/** Who got the selected message and where each one stands (wireframe Cd11 "פירוט לפי נמען"). */
export function RecipientDetail({ message, participants, polygons }: RecipientDetailProps) {
  const total = counts(message);
  const preview = message.body.length > BODY_PREVIEW ? `${message.body.slice(0, BODY_PREVIEW)}…` : message.body;
  const rows = [...message.recipients].sort(byAttention);

  return (
    <section className={`${styles.panel} ${styles.detail}`} aria-label="פירוט לפי נמען">
      <div className={styles.section}>
        <h2 className={`${styles.title} ${styles.grow}`}>פירוט לפי נמען</h2>
        <UrgencyBadge urgency={message.urgency} />
        <p className={`${styles.meta} ${styles.fullRow}`}>
          {recipientsLabel(message)}, <span className={styles.num}>{timeLabel(message.sentAt)}</span>, &quot;{preview}
          &quot;
        </p>
        <div className={`${styles.counts} ${styles.fullRow}`}>
          <span>
            נמסרה{' '}
            <b className={styles.num}>
              {total.delivered}/{total.total}
            </b>
          </span>
          <span>
            נקראה{' '}
            <b className={styles.num}>
              {total.read}/{total.total}
            </b>
          </span>
          {message.urgency === 'critical' && (
            <span>
              אושרה{' '}
              <b className={styles.num}>
                {total.acknowledged}/{total.total}
              </b>
            </span>
          )}
        </div>
      </div>
      <div className={styles.scroll}>
        <table className={`${styles.table} ${styles.fixed}`}>
          <thead>
            <tr>
              <th scope="col" className={styles.colSearcher}>
                מחפש
              </th>
              <th scope="col" className={styles.colPolygon}>
                פוליגון
              </th>
              <th scope="col" className={styles.colState}>
                מצב
              </th>
              <th scope="col" className={styles.colWhen}>
                שעה
              </th>
              <th scope="col" className={styles.colAction}>
                <span className={styles.visuallyHidden}>פעולות</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((recipient) => {
              const participant = participants.find((p) => p.id === recipient.participantId);
              const polygon = polygons.find((p) => p.id === participant?.polygonId);
              const time = lastTime(recipient);
              const state = stateOf(recipient);
              return (
                <tr key={recipient.participantId}>
                  <td>
                    <span className={styles.searcher}>
                      <CallsignChip
                        callsign={recipient.callsign}
                        state={participant?.status === 'available' ? 'waiting' : 'normal'}
                      />
                      <span className={styles.ell}>{recipient.name}</span>
                    </span>
                  </td>
                  <td>{polygon?.name ?? '—'}</td>
                  <td>
                    <span className={styles.state} data-state={state}>
                      {state === 'acknowledged' && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m5 12 5 5 9-10" />
                        </svg>
                      )}
                      {recipientStateLabel(recipient)}
                    </span>
                  </td>
                  <td>
                    {time ? (
                      <time dateTime={time} className={styles.num}>
                        {timeLabel(time)}
                      </time>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {participant && !isFinal(message, recipient) && (
                      <a
                        className={styles.callButton}
                        href={`tel:${participant.phone}`}
                        aria-label={`התקשר ל${recipient.name}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                        </svg>
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={`${styles.section} ${styles.footer}`}>
        <p className={styles.meta}>הודעה למחפש לא מקוון נשמרת ותימסר בחיבור. הודעות חד-כיווניות; אין מענה מהמחפשים.</p>
      </div>
    </section>
  );
}
