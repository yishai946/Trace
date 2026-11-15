import type { LkpDecision, Sighting } from '@trace/schemas';
import { Button } from '../../components/Button';
import { timeLabel } from '../timeLabel';
import styles from './LkpPanel.module.css';
import { lkpWord, sourceLabel } from './lkpText';

interface LkpSuggestionProps {
  /** The newest candidate: accepting it makes the older ones stop being candidates. */
  sighting: Sighting;
  disabled: boolean;
  onDecide: (sightingId: string, decision: LkpDecision) => void;
}

/** TRACE's suggestion to make a later sighting the LKP, with accept and reject (UC-C04). */
export function LkpSuggestion({ sighting, disabled, onDecide }: LkpSuggestionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.card}>
        <span className={styles.badge} data-tone="accent">
          הצעת TRACE
        </span>
        <p className={styles.cardText}>
          תצפית {sighting.number} ({sourceLabel(sighting)}, {timeLabel(sighting.observedAt)}) מאוחרת מ{lkpWord('ה-')}{' '}
          הנוכחי. להפוך אותה {lkpWord('ל-')}?
        </p>
        <div className={styles.row}>
          <Button size="sm" variant="primary" isDisabled={disabled} onPress={() => onDecide(sighting.id, 'accepted')}>
            אשר
          </Button>
          <Button size="sm" isDisabled={disabled} onPress={() => onDecide(sighting.id, 'rejected')}>
            דחה
          </Button>
        </div>
      </div>
    </div>
  );
}
