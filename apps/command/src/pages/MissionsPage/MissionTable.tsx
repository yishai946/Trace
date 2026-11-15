import type { Mission } from '@trace/schemas';
import { Button } from '../../components/Button';
import styles from './MissionsPage.module.css';
import { MISSION_STATUS_LABELS, formatOpened } from '../../mission/missionStatus';

interface Props {
  missions: Mission[];
  onOpen: (missionId: string) => void;
}

/** The missions as a table, for the desktop (wireframe Cd02). Opening one is a click on its row. */
export function MissionTable({ missions, onOpen }: Props) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">מסע</th>
          <th scope="col">נעדר</th>
          <th scope="col">מצב</th>
          <th scope="col">נפתח</th>
          <th scope="col">קוד הצטרפות</th>
          <th scope="col">
            <span className={styles.hidden}>פעולות</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {missions.map((m) => {
          const status = MISSION_STATUS_LABELS[m.status];
          const person = [m.missingPerson.name, m.missingPerson.age].filter((v) => v !== null).join(', ');
          return (
            // The whole row opens the mission; the "פתח" button is the keyboard and screen reader path.
            <tr key={m.id} className={styles.row} onClick={() => onOpen(m.id)}>
              <td className={styles.name}>{m.name}</td>
              <td>{person || '—'}</td>
              <td>
                <span className={styles.status}>
                  <span className={styles.dot} data-tone={status.tone} aria-hidden="true" />
                  {status.label}
                </span>
              </td>
              <td className={styles.muted}>{formatOpened(m.createdAt)}</td>
              <td className={styles.code}>{m.joinCode}</td>
              <td className={styles.action}>
                <Button size="sm" aria-label={`פתח את ${m.name}`} onPress={() => onOpen(m.id)}>
                  פתח
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
