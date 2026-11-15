import type { TimelineEvent } from '@trace/schemas';
import { useState } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import styles from './TimelinePage.module.css';
import { Button } from '../../components/Button';
import {
  CATEGORY_OF,
  TIMELINE_CATEGORIES,
  formatEventTime,
  spansDays,
  type TimelineCategory,
} from '../../mission/timelineEvent';
import { EventRow } from './EventRow';
import { ListState } from '../../components/ListState';

/** How many events show at a time; "טען אירועים קודמים" shows this many more. */
export const PAGE_SIZE = 50;

export interface TimelinePageProps {
  /** Oldest first, as the API returns them. `undefined` while loading. */
  events: TimelineEvent[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  /** "מעבר אל" for events shown on the map. */
  onGoToMap: () => void;
}

type Filter = TimelineCategory | 'all';

/** The operational Timeline (UC-C19, wireframe Cd14): significant events newest first, filterable by kind. */
export function TimelinePage({ events, loadFailed, onRetry, onGoToMap }: TimelinePageProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE_SIZE);

  const newestFirst = events ? [...events].reverse() : [];
  const filtered = filter === 'all' ? newestFirst : newestFirst.filter((e) => CATEGORY_OF[e.type] === filter);
  const visible = filtered.slice(0, shown);
  const withDate = events ? spansDays(events) : false;
  const countOf = (category: TimelineCategory) => newestFirst.filter((e) => CATEGORY_OF[e.type] === category).length;
  const hasEvents = !!events && events.length > 0;

  const select = (next: Filter) => {
    setFilter(next);
    setShown(PAGE_SIZE);
  };

  const oldest = events?.[0];
  const newest = events?.at(-1);
  const num = (iso: string) => <span className={styles.num}>{formatEventTime(iso, withDate)}</span>;

  return (
    <section className={styles.panel} aria-label="ציר זמן מבצעי">
      <div className={styles.section}>
        <h1 className={styles.title}>ציר זמן מבצעי</h1>
        {oldest && newest && (
          <span className={styles.meta}>
            {events.length === 1 ? (
              <>אירוע משמעותי אחד, ב-{num(oldest.occurredAt)}</>
            ) : (
              <>
                {events.length} אירועים משמעותיים, מ-{num(oldest.occurredAt)} עד {num(newest.occurredAt)}, מהחדש לישן
              </>
            )}
          </span>
        )}
      </div>

      {hasEvents && (
        <div className={styles.section}>
          <ToggleButtonGroup
            className={styles.chips}
            aria-label="סינון לפי סוג אירוע"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[filter]}
            onSelectionChange={(keys) => select(([...keys][0] as Filter | undefined) ?? 'all')}
          >
            <ToggleButton id="all" className={styles.chip}>
              הכל <span className={styles.count}>{newestFirst.length}</span>
            </ToggleButton>
            {TIMELINE_CATEGORIES.filter((c) => countOf(c.id) > 0).map((c) => (
              <ToggleButton key={c.id} id={c.id} className={styles.chip}>
                {c.label} <span className={styles.count}>{countOf(c.id)}</span>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
      )}

      <div className={styles.body}>
        <ListState
          items={events}
          loadFailed={loadFailed}
          onRetry={onRetry}
          className={styles.empty}
          text={{
            failed: 'לא ניתן לטעון את ציר הזמן מהשרת.',
            loading: 'טוען ציר זמן…',
            empty: 'אין עדיין אירועים במסע הזה.',
          }}
        >
          {() => (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">שעה</th>
                  <th scope="col">סוג</th>
                  <th scope="col">אירוע</th>
                  <th scope="col">מעבר אל</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((event) => (
                  <EventRow key={event.id} event={event} withDate={withDate} onGoToMap={onGoToMap} />
                ))}
              </tbody>
            </table>
          )}
        </ListState>
      </div>

      {hasEvents && (
        <div className={`${styles.section} ${styles.footer}`}>
          <span className={styles.meta}>
            מוצגים {visible.length} מתוך {filtered.length}
          </span>
          {visible.length < filtered.length && (
            <Button size="sm" className={styles.more} onPress={() => setShown((n) => n + PAGE_SIZE)}>
              טען אירועים קודמים
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
