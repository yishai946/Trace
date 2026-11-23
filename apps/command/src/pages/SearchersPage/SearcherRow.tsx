import { formatPhone } from '@trace/domain';
import type { MissionPolygon, Participant } from '@trace/schemas';
import styles from './SearchersPage.module.css';
import { Button } from '../../components/Button';
import { CallButton } from '../../components/CallButton';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../../mission/timeLabel';
import { statusLabel } from '../../mission/participantStatus';
import { AssignMenu } from './AssignMenu';
import { EndParticipation } from './EndParticipation';

interface SearcherRowProps {
  participant: Participant;
  /** The assigned polygon's name, or `—`. */
  polygonName: string;
  polygons: MissionPolygon[];
  onOpen?: (participantId: string) => void;
  onAssign?: (participantId: string, polygonId: string) => void;
  onEnd?: (participantId: string) => void;
}

/** One searcher in the pool table (wireframe Cd08). */
export function SearcherRow({ participant: p, polygonName, polygons, onOpen, onAssign, onEnd }: SearcherRowProps) {
  return (
    <tr>
      <td>
        <span className={styles.who}>
          <CallsignChip callsign={p.callsign} state={p.status === 'available' ? 'waiting' : 'normal'} />
          <span>{p.name}</span>
        </span>
      </td>
      <td>
        <a className={styles.num} href={`tel:${p.phone}`}>
          {formatPhone(p.phone)}
        </a>
      </td>
      <td>
        <span className={styles.badge}>{statusLabel(p)}</span>
      </td>
      <td>{p.status === 'assigned' ? polygonName : '—'}</td>
      <td className={p.offline ? styles.warn : styles.ok}>{p.offline ? 'לא מקוון' : 'מקוון'}</td>
      <td className={styles.num}>{p.battery ? `${p.battery.level}%` : '—'}</td>
      <td>
        {p.gpsUnavailableSince ? (
          <span className={styles.warning}>
            GPS לא זמין מ-
            <time dateTime={p.gpsUnavailableSince} className={styles.num}>
              {timeLabel(p.gpsUnavailableSince)}
            </time>{' '}
          </span>
        ) : null}
        {p.positionAt ? (
          <time dateTime={p.positionAt} className={styles.num}>
            {timeLabel(p.positionAt)}
          </time>
        ) : (
          <span className={styles.meta}>אין עדיין</span>
        )}
      </td>
      <td>
        <span className={styles.actions}>
          <CallButton phone={p.phone} name={p.name} display="icon" />
          <AssignMenu participant={p} polygons={polygons} onAssign={onAssign} />
          {onOpen && (
            <Button variant="icon" aria-label={`פרטי ${p.name}`} onPress={() => onOpen(p.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </Button>
          )}
          <EndParticipation participant={p} onEnd={onEnd} />
        </span>
      </td>
    </tr>
  );
}
