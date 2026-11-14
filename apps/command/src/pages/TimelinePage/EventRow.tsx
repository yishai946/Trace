import { formatCallsign } from '@trace/domain';
import type { TimelineEvent } from '@trace/schemas';
import { Link } from 'react-aria-components';
import styles from './TimelinePage.module.css';
import { CallsignChip } from '../../components/CallsignChip';
import { describeEvent, formatEventTime } from '../../mission/timelineEvent';

export function EventRow({
  event,
  withDate,
  onGoToMap,
}: {
  event: TimelineEvent;
  withDate: boolean;
  onGoToMap: () => void;
}) {
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
