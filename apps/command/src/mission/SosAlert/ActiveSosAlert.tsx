import { formatLatLng } from '@trace/geo';
import type { Sos } from '@trace/schemas';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../timeLabel';
import styles from './SosAlert.module.css';

/** The newest active SOS, with the count when there are several. Nothing when none is active. */
export function ActiveSosAlert({ sos, onOpen, compact }: { sos: Sos[]; onOpen: () => void; compact?: boolean }) {
  const active = sos.filter((s) => s.status === 'active');
  const latest = active[0];
  if (!latest) return null;
  const { callsign, name } = latest.sender;

  return (
    <section className={styles.alert} data-compact={compact || undefined} role="alert" aria-label="התראת SOS">
      <span className={styles.badge}>{active.length > 1 ? `SOS · ${active.length}` : 'SOS'}</span>
      <div className={styles.text}>
        <CallsignChip callsign={callsign} state="sos" /> <b>{name}</b>
        {latest.polygon && <>, {latest.polygon.name}</>},{' '}
        <time className={styles.num} dateTime={latest.activatedAt}>
          {timeLabel(latest.activatedAt)}
        </time>
        <span className={styles.where}>
          {latest.location ? (
            <>
              <span className={styles.num}>{formatLatLng(latest.location.position.coordinates)}</span>
              {', עודכן '}
              <span className={styles.num}>{timeLabel(latest.location.recordedAt)}</span>
            </>
          ) : (
            'מיקום לא ידוע'
          )}
        </span>
      </div>
      <Button variant="danger" onPress={onOpen}>
        פתח
      </Button>
    </section>
  );
}
