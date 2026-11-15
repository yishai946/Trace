import type { Mission } from '@trace/schemas';
import { formatOpened, MISSION_STATUS_LABELS } from '../../mission/missionStatus';
import styles from './MissionDetailsPage.module.css';

interface MissionFactsProps {
  mission: Mission;
  commanderName: string;
  searcherCount: number;
}

/** The mission's state, when it opened, who commands it and how many searchers are in it. */
export function MissionFacts({ mission, commanderName, searcherCount }: MissionFactsProps) {
  const { label, tone } = MISSION_STATUS_LABELS[mission.status];
  return (
    <dl className={styles.facts}>
      <div>
        <dt>מצב</dt>
        <dd>
          <span className={styles.state} data-tone={tone}>
            <span className={styles.stateDot} aria-hidden="true" />
            {label}
          </span>
        </dd>
      </div>
      <div>
        <dt>נפתח</dt>
        <dd className={styles.num}>{formatOpened(mission.createdAt)}</dd>
      </div>
      <div>
        <dt>מנהל מסע</dt>
        <dd>{commanderName}</dd>
      </div>
      <div>
        <dt>מחפשים</dt>
        <dd className={styles.num}>{searcherCount}</dd>
      </div>
    </dl>
  );
}
