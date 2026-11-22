import { sameDay } from '../sameDay';
import { detailChangesText, type TimelineEventType } from '@trace/domain';
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
  'sos.closed': 'sos',
  'coverage.threshold_reached': 'coverage',
  'contact.lost': 'contact',
  'mission.created': 'mission',
  'mission.ended': 'mission',
  'mission.details_changed': 'mission',
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

type EventOf<T extends TimelineEvent['type']> = Extract<TimelineEvent, { type: T }>;

/** "[07] שם " before the text, when a searcher performed the event. */
const bySearcher = (event: TimelineEvent, text: string): Segment[] => {
  const who = searcherOf(event);
  return [...who, `${who.length ? ' ' : ''}${text}`];
};

const endedText = (event: EventOf<'mission.ended'>) =>
  event.details.outcome === 'located' ? 'המסע הסתיים, הנעדר אותר' : 'המסע הסתיים, החיפוש הופסק';

function lkpText({ details: { observedAt, previousObservedAt } }: EventOf<'lkp.changed'>): string {
  if (previousObservedAt === null) return 'LKP נקבע ראשונית';
  return `LKP עודכן ל-${formatEventTime(observedAt, false)}, קודם ${formatEventTime(previousObservedAt, false)}`;
}

function reportSegments(event: EventOf<'report.submitted'>, label: string): Segment[] {
  const who = searcherOf(event);
  return who.length ? [`${label}, מ-`, ...who] : [label];
}

function contactSegments(event: EventOf<'contact.lost'>, label: string): Segment[] {
  const { callsign } = event.subject;
  return ['אבד קשר עם ', ...(callsign === null ? [label] : [{ callsign }, ` ${label}`])];
}

const sosSegments = (event: EventOf<'sos.activated'>, label: string): Segment[] => [
  ...bySearcher(event, 'הפעיל SOS'),
  ...(event.subject.label === null ? [] : [`, ${label}`]),
];

const sosClosedSegments = (event: EventOf<'sos.closed'>, label: string): Segment[] => {
  const closer = event.actor.kind === 'commander' ? [event.actor.name] : searcherOf(event);
  return [...closer, ' סגר את ה-SOS', ...(event.subject.label === null ? [] : [`, ${label}`])];
};

const segmented = (badge: string, segments: Segment[], danger = false): EventView => ({
  badge,
  danger,
  segments,
  destination: null,
});

function describePolygon(
  event: EventOf<'polygon.created'> | EventOf<'polygon.boundary_changed'> | EventOf<'polygon.deleted'>,
  label: string,
): EventView {
  switch (event.type) {
    case 'polygon.created':
      return plain('פוליגון', `${label} נוצר`, 'map');
    case 'polygon.boundary_changed':
      return plain('פוליגון', boundaryText(label, event.details.searchersOutside), 'map');
    case 'polygon.deleted':
      return plain('פוליגון', `${label} נמחק מהמפה`);
  }
}

const PAUSE_TEXT = { 'mission.paused': 'המסע הושהה', 'mission.resumed': 'המסע חודש' } as const;

const describeSos = (event: EventOf<'sos.activated'> | EventOf<'sos.closed'>, label: string): EventView =>
  event.type === 'sos.activated'
    ? segmented('SOS', sosSegments(event, label), true)
    : segmented('SOS', sosClosedSegments(event, label));

/** How an event reads in the Timeline (wireframe Cd14): a badge, its text, and where "מעבר אל" leads. */
export function describeEvent(event: TimelineEvent): EventView {
  const label = event.subject.label ?? '';
  switch (event.type) {
    case 'mission.created':
      return plain('מסע', `המסע נוצר, ${label}`);
    case 'mission.paused':
    case 'mission.resumed':
      return plain('השהיה', PAUSE_TEXT[event.type]);
    case 'mission.ended':
      return plain('מסע', endedText(event));
    case 'mission.details_changed':
      return plain('פרטי מסע', detailChangesText(event.details.fields));
    case 'lkp.changed':
      return plain('LKP', lkpText(event), 'map');
    case 'search.started':
      return segmented('חיפוש', bySearcher(event, `התחיל חיפוש ב${label}`));
    case 'report.submitted':
      return segmented('דיווח', reportSegments(event, label));
    case 'coverage.threshold_reached':
      return plain('Coverage', `${label} הגיע ל-${event.details.threshold}% Coverage`);
    case 'contact.lost':
      return segmented('קשר', contactSegments(event, label));
    case 'sos.activated':
    case 'sos.closed':
      return describeSos(event, label);
    default:
      return describePolygon(event, label);
  }
}

/** Events shown in "שינויים אחרונים" (Cd05): the mission's details and its LKP. */
export const RECENT_CHANGE_TYPES = [
  'mission.details_changed',
  'lkp.changed',
] as const satisfies readonly TimelineEventType[];

/** The recent changes, newest first, from the Timeline as the API orders it (oldest first). */
export function recentChanges(events: TimelineEvent[]): TimelineEvent[] {
  return events.filter((event) => RECENT_CHANGE_TYPES.some((type) => type === event.type)).reverse();
}
