import type { Mission } from '@trace/schemas';
import { Button as AriaButton } from 'react-aria-components';
import { isMissionEnded } from '@trace/domain';
import styles from './MissionsPage.module.css';
import { MISSION_STATUS_LABELS, formatOpened } from '../../mission/missionStatus';

interface Props {
  missions: Mission[];
  onOpen: (missionId: string) => void;
}

/** The missions as cards, for the phone (wireframe Cm02). */
export function MissionCards({ missions, onOpen }: Props) {
  return (
    <ul className={styles.cards}>
      {missions.map((m) => {
        const status = MISSION_STATUS_LABELS[m.status];
        const person = [m.missingPerson.name, m.missingPerson.age].filter((v) => v !== null).join(', ');
        return (
          <li key={m.id}>
            <AriaButton className={styles.card} onPress={() => onOpen(m.id)}>
              <span className={styles.cardHead}>
                <span className={styles.cardTitle}>{m.name}</span>
                <span className={styles.badge}>
                  <span className={styles.dot} data-tone={status.tone} aria-hidden="true" />
                  {status.label}
                </span>
              </span>
              <span className={styles.cardPerson}>{person || '—'}</span>
              <span className={styles.cardMeta}>
                {`נפתח ${formatOpened(m.createdAt)}`}
                {isMissionEnded(m.status) && ', קריאה בלבד'}
              </span>
            </AriaButton>
          </li>
        );
      })}
    </ul>
  );
}
