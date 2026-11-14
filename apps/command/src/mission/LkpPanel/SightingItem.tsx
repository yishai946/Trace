import type { LkpDecision, Sighting } from '@trace/schemas';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../timeLabel';
import styles from './LkpPanel.module.css';
import { lkpWord, sourceLabel } from './lkpText';

interface SightingItemProps {
  sighting: Sighting;
  selected: boolean;
  /** The mission accepts LKP changes: a candidate can be made the LKP from here. */
  writable: boolean;
  disabled: boolean;
  onDecide: (sightingId: string, decision: LkpDecision) => void;
}

/** One sighting in the list: its number, who saw it and when, and where it stands as an LKP. */
export function SightingItem({ sighting, selected, writable, disabled, onDecide }: SightingItemProps) {
  const { reportedBy } = sighting;
  return (
    <li className={styles.sighting} aria-current={selected ? 'true' : undefined}>
      <div className={styles.sightingHead}>
        <span className={styles.diamond} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 2l10 10-10 10L2 12z" />
          </svg>
          <span>{sighting.number}</span>
        </span>
        <span className={styles.badge} data-tone="neutral">
          {sourceLabel(sighting)}
        </span>
        {reportedBy.callsign !== null && (
          <>
            <CallsignChip callsign={reportedBy.callsign} />
            <span className={styles.meta}>{reportedBy.name}</span>
          </>
        )}
        <span className={`${styles.meta} ${styles.num}`}>{timeLabel(sighting.observedAt)}</span>
        {sighting.lkpCandidate && (
          <span className={styles.badge} data-tone="accent">
            מוצע {lkpWord('כ-')}
          </span>
        )}
        {sighting.lkpDecision === 'accepted' && (
          <span className={styles.badge} data-tone="neutral">
            LKP
          </span>
        )}
        {sighting.lkpDecision === 'rejected' && <span className={styles.meta}>נדחה</span>}
      </div>
      {sighting.description && <p className={styles.description}>{sighting.description}</p>}
      {sighting.lkpCandidate && writable && (
        <Button size="sm" isDisabled={disabled} onPress={() => onDecide(sighting.id, 'accepted')}>
          הפוך {lkpWord('ל-')}
        </Button>
      )}
    </li>
  );
}
