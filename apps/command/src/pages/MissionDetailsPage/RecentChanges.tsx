import type { TimelineEvent } from '@trace/schemas';
import { Link } from 'react-aria-components';
import { ListState } from '../../components/ListState';
import { EventText } from '../../mission/EventText';
import { describeEvent, formatEventTime, recentChanges, spansDays } from '../../mission/timelineEvent';
import styles from './MissionDetailsPage.module.css';

export interface RecentChangesProps {
  /** The mission's Timeline, oldest first. `undefined` while it loads, or after it failed to. */
  events: TimelineEvent[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  /** Closes the details and opens the Timeline view. */
  onOpenTimeline: () => void;
}

/** "שינויים אחרונים" (Cd05): the significant changes of the mission and its LKP, newest first. */
export function RecentChanges({ events, loadFailed, onRetry, onOpenTimeline }: RecentChangesProps) {
  const withDate = events ? spansDays(recentChanges(events)) : false;
  return (
    <section className={styles.changes} aria-label="שינויים אחרונים">
      <div className={styles.changesHead}>
        <h2 className={styles.changesTitle}>שינויים אחרונים</h2>
        <Link className={styles.changesLink} onPress={onOpenTimeline}>
          ציר זמן
        </Link>
      </div>
      <ListState
        items={events && recentChanges(events)}
        loadFailed={loadFailed}
        onRetry={onRetry}
        className={styles.changesState}
        text={{
          failed: 'לא ניתן לטעון את השינויים מהשרת.',
          loading: 'טוען שינויים…',
          empty: 'אין עדיין שינויים משמעותיים במסע.',
        }}
      >
        {(items) => (
          <ul className={styles.changesList}>
            {items.map((event) => (
              <li key={event.id}>
                <div className={styles.changeMeta}>
                  <time dateTime={event.occurredAt}>{formatEventTime(event.occurredAt, withDate)}</time>
                  <span className={styles.changeBadge}>שינוי משמעותי</span>
                </div>
                <span>
                  <EventText segments={describeEvent(event).segments} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </ListState>
    </section>
  );
}
