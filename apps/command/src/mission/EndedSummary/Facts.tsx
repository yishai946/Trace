import { STOP_REASON_LABELS } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import { coordinates } from '../LkpPanel/lkpText';
import { missionDuration } from '../endedSummary';
import { timeLabel } from '../timeLabel';
import styles from './EndedSummary.module.css';

/** How the mission ended: the result, where and when the missing person was found or why the search stopped. */
export function Outcome({ mission }: { mission: Mission }) {
  const { located, stopped } = mission;
  return (
    <section className={styles.section} aria-label="תוצאה">
      <p className={styles.label}>תוצאה</p>
      <p className={styles.result}>{located ? 'הנעדר אותר' : 'החיפוש הופסק'}</p>
      {stopped && <p className={styles.note}>{STOP_REASON_LABELS[stopped.reason]}</p>}
      {(located?.note ?? stopped?.note) && <p className={styles.note}>{located?.note ?? stopped?.note}</p>}
      <dl className={styles.facts}>
        {mission.missingPerson.name && (
          <>
            <dt>נעדר</dt>
            <dd>
              {mission.missingPerson.name}
              {mission.missingPerson.age !== null && `, ${mission.missingPerson.age}`}
            </dd>
          </>
        )}
        {located && (
          <>
            <dt>זמן איתור</dt>
            <dd>{timeLabel(located.locatedAt)}</dd>
            <dt>מיקום איתור</dt>
            <dd dir="ltr">{coordinates(located.position)}</dd>
          </>
        )}
        <dt>משך</dt>
        <dd dir="ltr">{missionDuration(mission)}</dd>
      </dl>
    </section>
  );
}
