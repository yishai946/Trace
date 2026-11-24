import type { MissionPolygon, Participant } from '@trace/schemas';
import { ListState } from '../../components/ListState';
import { groupSearchers } from './groupSearchers';
import { SearcherUnit } from './SearcherUnit';
import styles from './SearchersByPolygon.module.css';

interface SearchersByPolygonProps {
  /** `undefined` while loading. */
  participants: Participant[] | undefined;
  polygons: MissionPolygon[];
  loadFailed: boolean;
  onRetry: () => void;
  /** Participants with an active SOS. */
  activeSosParticipantIds: string[];
  /** Opens a searcher's panel over the map (wireframe Cd09). */
  onOpen: (participantId: string) => void;
}

/**
 * The searchers panel of the live map (UC-C10, wireframe Cd04): everyone in the mission grouped by the polygon they are
 * assigned to, those waiting last. The pool comes from the participants query, which realtime events keep current.
 */
export function SearchersByPolygon({
  participants,
  polygons,
  loadFailed,
  onRetry,
  activeSosParticipantIds,
  onOpen,
}: SearchersByPolygonProps) {
  const groups = participants && groupSearchers(participants, polygons);
  const total = groups?.reduce((sum, g) => sum + g.searchers.length, 0);
  return (
    <section className={styles.panel} aria-label="מחפשים">
      <h2 className={styles.title}>מחפשים {total !== undefined && <span className={styles.count}>{total}</span>}</h2>
      <div className={styles.scroll}>
        <ListState
          items={groups}
          loadFailed={loadFailed}
          onRetry={onRetry}
          className={styles.message}
          text={{
            failed: 'לא ניתן לטעון מחפשים מהשרת.',
            loading: 'טוען מחפשים…',
            empty: 'עוד לא הצטרפו מחפשים.',
          }}
        >
          {(groups) =>
            groups.map(({ polygon, searchers }) => (
              <div key={polygon?.id ?? 'waiting'} className={styles.group}>
                <div className={styles.groupHead}>
                  <h3 className={styles.groupTitle}>{polygon?.name ?? 'ממתינים לשיבוץ'}</h3>
                  <span className={styles.meta}>{searchers.length}</span>
                  {polygon?.coverage != null && <span className={styles.meta}>{Math.round(polygon.coverage)}%</span>}
                </div>
                <ul className={styles.list}>
                  {searchers.map((p) => (
                    <li key={p.id}>
                      <SearcherUnit searcher={p} sos={activeSosParticipantIds.includes(p.id)} onOpen={onOpen} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          }
        </ListState>
      </div>
    </section>
  );
}
