import type { Sos } from '@trace/schemas';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../timeLabel';
import styles from './SosAlert.module.css';

export interface SosAlertProps {
  /** Newest first, as the API returns them. */
  sos: Sos[];
  onOpen: () => void;
  /** Floats at the top centre of the live map instead of sitting in the page. */
  floating?: boolean;
  /** The phone: one line under the top bar. */
  compact?: boolean;
}

/**
 * The critical SOS alert (UC-C14, decision 24): identity, polygon, time and whether a location is known, shown while
 * at least one SOS is active, so it survives a reload and is gone once every SOS is closed. Several are counted and
 * the newest is described.
 */
export function SosAlert({ sos, onOpen, floating, compact }: SosAlertProps) {
  const active = sos.filter((s) => s.status === 'active');
  const latest = active[0];
  if (!latest) return null;
  const { callsign, name } = latest.sender;

  return (
    <section
      className={styles.alert}
      data-floating={floating || undefined}
      data-compact={compact || undefined}
      role="alert"
      aria-label="התראת SOS"
    >
      <span className={styles.badge}>{active.length > 1 ? `SOS · ${active.length}` : 'SOS'}</span>
      <div className={styles.text}>
        <CallsignChip callsign={callsign} state="sos" /> <b>{name}</b>
        {latest.polygon && <>, {latest.polygon.name}</>},{' '}
        <time className={styles.num} dateTime={latest.activatedAt}>
          {timeLabel(latest.activatedAt)}
        </time>
        <span className={styles.where}>{latest.location ? 'מיקום ידוע' : 'מיקום לא ידוע'}</span>
      </div>
      <Button variant="danger" onPress={onOpen}>
        פתח
      </Button>
    </section>
  );
}
