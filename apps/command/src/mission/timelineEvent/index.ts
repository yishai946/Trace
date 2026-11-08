import type { TimelineEventType } from '@trace/domain';
import type { TimelineEvent } from '@trace/schemas';

export type TimelineCategory = 'search' | 'reports' | 'sos' | 'coverage' | 'contact' | 'mission' | 'pause';

/** Filter chips in wireframe order (Cd14). A chip shows only when it has events. */
export const TIMELINE_CATEGORIES: { id: TimelineCategory; label: string }[] = [
  { id: 'search', label: 'התחלה וסיום חיפוש' },
  { id: 'reports', label: 'דיווחים ותצפיות' },
  { id: 'sos', label: 'SOS' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'contact', label: 'אובדן קשר' },
  { id: 'mission', label: 'שינויי מסע' },
  { id: 'pause', label: 'השהיה וחידוש' },
];

export const CATEGORY_OF: Record<TimelineEventType, TimelineCategory> = {
  'search.started': 'search',
  'report.submitted': 'reports',
  'sos.activated': 'sos',
  'coverage.threshold_reached': 'coverage',
  'contact.lost': 'contact',
  'mission.created': 'mission',
  'mission.ended': 'mission',
  'lkp.changed': 'mission',
  'polygon.created': 'mission',
  'polygon.boundary_changed': 'mission',
  'polygon.deleted': 'mission',
  'mission.paused': 'pause',
  'mission.resumed': 'pause',
};

/** A piece of an event's text: plain text, or a searcher's callsign shown as a chip. */
export type Segment = string | { callsign: number };

export interface EventView {
  badge: string;
  /** SOS: solid danger badge and a tinted row. */
  danger: boolean;
  segments: Segment[];
  /** Where "מעבר אל" leads; null when the screen does not exist yet. */
  destination: 'map' | null;
}

const time = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayMonth = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' });

/** "16:58", or "03.10, 16:58" when the Timeline spans more than one day. */
export function formatEventTime(iso: string, withDate: boolean): string {
  const date = new Date(iso);
  return withDate ? `${dayMonth.format(date)}, ${time.format(date)}` : time.format(date);
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Whether the first and last events fall on different local days. Events are in either order. */
export function spansDays(events: TimelineEvent[]): boolean {
  const first = events[0];
  const last = events.at(-1);
  return !!first && !!last && !sameDay(new Date(first.occurredAt), new Date(last.occurredAt));
}

const plain = (badge: string, text: string, destination: EventView['destination'] = null): EventView => ({
  badge,
  danger: false,
  segments: [text],
  destination,
});

function boundaryText(label: string, outside: number): string {
  if (outside === 0) return `הגבול של ${label} שונה`;
  if (outside === 1) return `הגבול של ${label} שונה, מחפש אחד מחוץ לגבול`;
  return `הגבול של ${label} שונה, ${outside} מחפשים מחוץ לגבול`;
}

/** The searcher who performed the event, as pieces of text: "[07] שם". Empty when someone else did. */
function searcherOf(event: TimelineEvent): Segment[] {
  return event.actor.kind === 'searcher' ? [{ callsign: event.actor.callsign }, ` ${event.actor.name}`] : [];
}

/** How an event reads in the Timeline (wireframe Cd14): a badge, its text, and where "מעבר אל" leads. */
export function describeEvent(event: TimelineEvent): EventView {
  const label = event.subject.label ?? '';
  switch (event.type) {
    case 'mission.created':
      return plain('מסע', `המסע נוצר, ${label}`);
    case 'mission.paused':
      return plain('השהיה', 'המסע הושהה');
    case 'mission.resumed':
      return plain('השהיה', 'המסע חודש');
    case 'mission.ended':
      return plain(
        'מסע',
        event.details.outcome === 'located' ? 'המסע הסתיים, הנעדר אותר' : 'המסע הסתיים, החיפוש הופסק',
      );
    case 'lkp.changed': {
      const { observedAt, previousObservedAt } = event.details;
      return plain(
        'LKP',
        previousObservedAt === null
          ? 'LKP נקבע ראשונית'
          : `LKP עודכן ל-${formatEventTime(observedAt, false)}, קודם ${formatEventTime(previousObservedAt, false)}`,
        'map',
      );
    }
    case 'polygon.created':
      return plain('פוליגון', `${label} נוצר`, 'map');
    case 'polygon.boundary_changed':
      return plain('פוליגון', boundaryText(label, event.details.searchersOutside), 'map');
    case 'polygon.deleted':
      return plain('פוליגון', `${label} נמחק מהמפה`);
    case 'search.started': {
      const who = searcherOf(event);
      return {
        badge: 'חיפוש',
        danger: false,
        segments: [...who, `${who.length ? ' ' : ''}התחיל חיפוש ב${label}`],
        destination: null,
      };
    }
    case 'report.submitted': {
      const who = searcherOf(event);
      return {
        badge: 'דיווח',
        danger: false,
        segments: who.length ? [`${label}, מ-`, ...who] : [label],
        destination: null,
      };
    }
    case 'coverage.threshold_reached':
      return plain('Coverage', `${label} הגיע ל-${event.details.threshold}% Coverage`);
    case 'contact.lost': {
      const { callsign } = event.subject;
      return {
        badge: 'קשר',
        danger: false,
        segments: ['אבד קשר עם ', ...(callsign === null ? [label] : [{ callsign }, ` ${label}`])],
        destination: null,
      };
    }
    case 'sos.activated': {
      const who = searcherOf(event);
      return {
        badge: 'SOS',
        danger: true,
        segments: [
          ...who,
          `${who.length ? ' ' : ''}הפעיל SOS`,
          ...(event.subject.label === null ? [] : [`, ${label}`]),
        ],
        destination: null,
      };
    }
  }
}
