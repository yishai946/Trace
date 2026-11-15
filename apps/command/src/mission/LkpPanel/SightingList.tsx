import type { LkpDecision, Sighting } from '@trace/schemas';
import { Button } from '../../components/Button';
import styles from './LkpPanel.module.css';
import { SightingItem } from './SightingItem';

interface SightingListProps {
  sightings: Sighting[] | undefined;
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  selectedSightingId: string | null;
  writable: boolean;
  disabled: boolean;
  onDecide: (sightingId: string, decision: LkpDecision) => void;
}

/** The mission's sightings, or what stands in their place while they load or after they failed to. */
export function SightingList({
  sightings,
  loading,
  loadFailed,
  onRetry,
  selectedSightingId,
  ...item
}: SightingListProps) {
  if (loadFailed) {
    return (
      <div role="alert" className={styles.loadError}>
        <p className={styles.error}>התצפיות לא נטענו.</p>
        <Button size="sm" onPress={onRetry}>
          נסה שוב
        </Button>
      </div>
    );
  }
  if (loading || !sightings) return <p className={styles.hint}>טוען תצפיות…</p>;
  if (sightings.length === 0) return <p className={styles.hint}>אין תצפיות עדיין.</p>;
  return (
    <ul className={styles.list} aria-label="תצפיות">
      {sightings.map((sighting) => (
        <SightingItem key={sighting.id} {...item} sighting={sighting} selected={sighting.id === selectedSightingId} />
      ))}
    </ul>
  );
}
