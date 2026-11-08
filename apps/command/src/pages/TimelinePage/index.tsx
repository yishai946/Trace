import { formatCallsign } from '@trace/domain';
import type { TimelineEvent } from '@trace/schemas';
import { useState } from 'react';
import { Link, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import styles from './TimelinePage.module.css';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import {
  CATEGORY_OF,
  TIMELINE_CATEGORIES,
  describeEvent,
  formatEventTime,
  spansDays,
  type TimelineCategory,
} from '../../mission/timelineEvent';

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
        {events === undefined ? (
          loadFailed ? (
            <div className={styles.empty}>
              <p role="alert">לא ניתן לטעון את ציר הזמן מהשרת.</p>
              <Button onPress={onRetry}>נסה שוב</Button>
            </div>
          ) : (
            <p className={styles.empty}>טוען ציר זמן…</p>
          )
        ) : events.length === 0 ? (
          <p className={styles.empty}>אין עדיין אירועים במסע הזה.</p>
        ) : (
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

function EventRow({ event, withDate, onGoToMap }: { event: TimelineEvent; withDate: boolean; onGoToMap: () => void }) {
  const view = describeEvent(event);
  // Every row's link says what it leads from, so links in a list are told apart.
  const plainText = view.segments
    .map((segment) => (typeof segment === 'string' ? segment : formatCallsign(segment.callsign)))
    .join('');
  return (
    <tr data-danger={view.danger || undefined}>
      <td>
        <time dateTime={event.occurredAt} className={styles.num}>
          {formatEventTime(event.occurredAt, withDate)}
        </time>
      </td>
      <td>
        <span className={styles.badge} data-danger={view.danger || undefined}>
          {view.badge}
        </span>
      </td>
      <td>
        {view.segments.map((segment, i) =>
          typeof segment === 'string' ? (
            <span key={i}>{segment}</span>
          ) : (
            <CallsignChip key={i} callsign={segment.callsign} />
          ),
        )}
      </td>
      <td>
        {view.destination === 'map' && (
          <Link className={styles.link} aria-label={`לוח מבצעי: ${plainText}`} onPress={onGoToMap}>
            לוח מבצעי
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>
        )}
      </td>
    </tr>
  );
}
