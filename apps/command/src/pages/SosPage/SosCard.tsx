import { formatLatLng } from '@trace/geo';
import type { Sos } from '@trace/schemas';
import { CallButton } from '../../components/CallButton';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../../mission/timeLabel';
import { CloseSos } from './CloseSos';
import styles from './SosPage.module.css';

interface SosCardProps {
  sos: Sos;
  /** The sender's number; undefined when they are no longer in the pool. */
  phone: string | undefined;
  onClose?: (sosId: string) => void;
  /** This SOS is being closed. */
  closing: boolean;
}

const accuracyText = (accuracy: number | null) => (accuracy === null ? '' : ` · דיוק ±${Math.round(accuracy)} מ׳`);

const recipientsText = (count: number) =>
  count === 0 ? 'נשלחה למנהל' : count === 1 ? 'נשלחה למנהל ולמחפש אחד' : `נשלחה למנהל ול-${count} מחפשים`;

/** An active SOS (wireframes Cd12, Cm12): who, where, what they wrote, and the two actions: call and close. */
export function SosCard({ sos, phone, onClose, closing }: SosCardProps) {
  const { callsign, name } = sos.sender;
  const { location } = sos;
  return (
    <article className={styles.card} aria-label={`SOS פעיל של ${name}`}>
      <header className={styles.cardHead}>
        <span className={styles.tag}>SOS</span>
        <b className={styles.grow}>SOS פעיל</b>
        <time className={styles.num} dateTime={sos.activatedAt}>
          {timeLabel(sos.activatedAt)}
        </time>
      </header>
      <div className={styles.who}>
        <CallsignChip callsign={callsign} state="sos" />
        <div>
          <div className={styles.name}>{name}</div>
          <div className={styles.meta}>{sos.polygon?.name ?? 'לא משובץ לפוליגון'}</div>
        </div>
      </div>
      {sos.message && (
        <div>
          <div className={styles.label}>הודעה קצרה מהמחפש</div>
          <blockquote className={styles.quote}>{sos.message}</blockquote>
        </div>
      )}
      <dl className={styles.facts}>
        <div>
          <dt>מיקום</dt>
          <dd>
            {location ? (
              <>
                <span className={styles.num}>{formatLatLng(location.position.coordinates)}</span>
                {accuracyText(location.accuracy)}
              </>
            ) : (
              'לא ידוע'
            )}
          </dd>
        </div>
        {location && (
          <div>
            <dt>עדכון מיקום</dt>
            <dd>
              <span className={styles.num}>{timeLabel(location.recordedAt)}</span>
            </dd>
          </div>
        )}
        <div>
          <dt>הופעלה</dt>
          <dd>
            <span className={styles.num}>{timeLabel(sos.activatedAt)}</span>, {recipientsText(sos.recipientCount)}
          </dd>
        </div>
      </dl>
      <div className={styles.actions}>
        {phone && <CallButton phone={phone} name={name} />}
        <CloseSos sos={sos} onClose={onClose} busy={closing} />
      </div>
    </article>
  );
}
