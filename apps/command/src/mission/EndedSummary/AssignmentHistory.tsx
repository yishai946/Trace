import type { AssignmentRecord } from '@trace/schemas';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { formatEventTime } from '../timelineEvent';
import styles from './EndedSummary.module.css';

interface AssignmentHistoryProps {
  /** Undefined while the history loads or when it failed. */
  assignments: AssignmentRecord[] | undefined;
  /** Opens the searcher's panel, which draws their route on the map. */
  onOpenSearcher: (participantId: string) => void;
}

/** Who searched where and when (decision 53), with a way to see each searcher's GPS route. */
export function AssignmentHistory({ assignments, onOpenSearcher }: AssignmentHistoryProps) {
  const withDate = assignments?.some((a) => a.assignedAt.slice(0, 10) !== assignments[0]?.assignedAt.slice(0, 10));
  const range = (a: AssignmentRecord) =>
    `${formatEventTime(a.assignedAt, withDate ?? false)} – ${a.endedAt ? formatEventTime(a.endedAt, withDate ?? false) : 'עד סוף המסע'}`;
  return (
    <section className={styles.section} aria-label="היסטוריית שיבוץ">
      <p className={styles.label}>היסטוריית שיבוץ ומסלולים</p>
      {!assignments ? (
        <p className={styles.note}>הנתונים אינם זמינים כרגע.</p>
      ) : assignments.length === 0 ? (
        <p className={styles.note}>לא בוצעו שיבוצים במסע.</p>
      ) : (
        <ul className={styles.list}>
          {assignments.map((a) => (
            <li key={a.id} className={styles.assignment}>
              <CallsignChip callsign={a.callsign} state="normal" />
              <span>
                {a.name}, {a.polygonName}
                <bdi className={styles.range}>{range(a)}</bdi>
              </span>
              <Button
                variant="secondary"
                aria-label={`מסלול ${a.name}, ${a.polygonName}`}
                onPress={() => onOpenSearcher(a.participantId)}
              >
                מסלול
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
