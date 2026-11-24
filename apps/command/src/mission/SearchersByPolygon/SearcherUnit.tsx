import type { Participant } from '@trace/schemas';
import { CallsignChip } from '../../components/CallsignChip';
import { statusLabel } from '../participantStatus';
import { timeLabel } from '../timeLabel';
import styles from './SearchersByPolygon.module.css';

interface SearcherUnitProps {
  searcher: Participant;
  sos: boolean;
  onOpen: (participantId: string) => void;
}

/** What the commander reads first: an active SOS, no connection, else the searcher's state. */
const stateText = (p: Participant, sos: boolean) => (sos ? 'SOS' : p.offline ? 'לא מקוון' : statusLabel(p));

/** One searcher in the Cd04 panel (Trace Console `tc-unit`): callsign, name, state with the last update, battery. */
export function SearcherUnit({ searcher: p, sos, onOpen }: SearcherUnitProps) {
  const updatedAt = p.lastUpdateAt ?? p.positionAt;
  const tone = sos ? 'sos' : p.offline ? 'offline' : undefined;
  return (
    <button type="button" className={styles.unit} data-tone={tone} onClick={() => onOpen(p.id)}>
      <CallsignChip
        callsign={p.callsign}
        state={sos ? 'sos' : p.offline ? 'offline' : p.status === 'available' ? 'waiting' : 'normal'}
      />
      <span className={styles.body}>
        <span className={styles.name}>{p.name}</span>
        <span className={styles.status}>
          {stateText(p, sos)}
          {updatedAt && (
            <>
              {', '}
              <time dateTime={updatedAt}>{timeLabel(updatedAt)}</time>
            </>
          )}
        </span>
      </span>
      {p.battery && <span className={styles.meta}>{p.battery.level}%</span>}
    </button>
  );
}
