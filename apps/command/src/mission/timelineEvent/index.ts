import { STOP_REASON_LABELS } from '../stopReason';
import { detailChangesText } from '@trace/domain';
import type { TimelineEvent } from '@trace/schemas';
import { describePresence } from './presence';

export { CATEGORY_OF, TIMELINE_CATEGORIES, type TimelineCategory } from './categories';

/** A piece of an event's text: plain text, or a searcher's callsign shown as a chip. */
export type Segment = string | { callsign: number };

export interface EventView {
  badge: string;
  /** SOS: solid danger badge and a tinted row. */
  danger: boolean;
  /** A warning (UC-S04): an outlined warning badge (no row tint: there is no warning tint token), a step below the SOS. */
  warning: boolean;
  segments: Segment[];
  /** Where "מעבר אל" leads; null when the screen does not exist yet. */
  destination: 'map' | null;
}

// The time zone of the rest of Command (`timeLabel`): a time reads the same on every commander's screen.
const TIME_ZONE = 'Asia/Jerusalem';
const time = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TIME_ZONE,
});
const dayMonth = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', timeZone: TIME_ZONE });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

/** "16:58", or "03.10, 16:58" when the Timeline spans more than one day. */
export function formatEventTime(iso: string, withDate: boolean): string {
  const date = new Date(iso);
  return withDate ? `${dayMonth.format(date)}, ${time.format(date)}` : time.format(date);
}

/** Whether the first and last events fall on different days in Israel. Events are in either order. */
export function spansDays(events: TimelineEvent[]): boolean {
  const first = events[0];
  const last = events.at(-1);
  return !!first && !!last && dayKey.format(new Date(first.occurredAt)) !== dayKey.format(new Date(last.occurredAt));
}

const plain = (badge: string, text: string, destination: EventView['destination'] = null): EventView => ({
  badge,
  danger: false,
  warning: false,
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

function endedText({ details }: EventOf<'mission.ended'>): string {
  if (details.outcome === 'located') return 'המסע הסתיים, הנעדר אותר';
  return `המסע הסתיים, החיפוש הופסק${details.reason ? `: ${STOP_REASON_LABELS[details.reason]}` : ''}`;
}

function lkpText({ details: { observedAt, previousObservedAt } }: EventOf<'lkp.changed'>): string {
  if (previousObservedAt === null) return 'LKP נקבע ראשונית';
  return `LKP עודכן ל-${formatEventTime(observedAt, false)}, קודם ${formatEventTime(previousObservedAt, false)}`;
}

function reportSegments(event: EventOf<'report.submitted'>, label: string): Segment[] {
  const who = searcherOf(event);
  return who.length ? [`${label}, מ-`, ...who] : [label];
}

function contactSegments(event: EventOf<'contact.lost'> | EventOf<'contact.restored'>, label: string): Segment[] {
  const { callsign } = event.subject;
  const who = callsign === null ? [label] : [{ callsign }, ` ${label}`];
  return event.type === 'contact.lost' ? ['אבד קשר עם ', ...who] : ['הקשר עם ', ...who, ' חזר'];
}

function batterySegments(event: EventOf<'battery.low'>, label: string): Segment[] {
  const { callsign } = event.subject;
  const who = callsign === null ? [label] : [{ callsign }, ` ${label}`];
  return ['הסוללה של ', ...who, ` נמוכה, ${event.details.level}%`];
}

function noUpdatesSegments(event: EventOf<'contact.no_updates'>, label: string): Segment[] {
  const { callsign } = event.subject;
  const who = callsign === null ? [label] : [{ callsign }, ` ${label}`];
  return ['אין עדכונים מ-', ...who, ` מאז ${formatEventTime(event.details.lastUpdateAt, false)}`];
}

function gpsLostSegments(event: EventOf<'gps.lost_escalated'>, label: string): Segment[] {
  const { callsign } = event.subject;
  const who = callsign === null ? [label] : [{ callsign }, ` ${label}`];
  return ['אין GPS אצל ', ...who, ` מ-${formatEventTime(event.details.since, false)}`];
}

const sosSegments = (event: EventOf<'sos.activated'>, label: string): Segment[] => [
  ...bySearcher(event, 'הפעיל SOS'),
  ...(event.subject.label === null ? [] : [`, ${label}`]),
];

/** Whose SOS it was, by the SOS the event is about: a commander closed it, so the sender is named. */
export type SosSenderOf = (sosId: string) => { callsign: number; name: string } | undefined;

const sosClosedSegments = (event: EventOf<'sos.closed'>, label: string, senderOf?: SosSenderOf): Segment[] => {
  const sender = event.actor.kind === 'commander' ? senderOf?.(event.subject.id) : undefined;
  const closer = event.actor.kind === 'commander' ? [event.actor.name] : searcherOf(event);
  return [
    ...closer,
    ' סגר את ה-SOS',
    ...(sender ? [' של ', { callsign: sender.callsign }, ` ${sender.name}`] : []),
    ...(event.subject.label === null ? [] : [`, ${label}`]),
  ];
};

const segmented = (badge: string, segments: Segment[], danger = false): EventView => ({
  badge,
  danger,
  warning: false,
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

function describeAlert(
  event:
    | EventOf<'coverage.threshold_reached'>
    | EventOf<'contact.lost'>
    | EventOf<'contact.restored'>
    | EventOf<'battery.low'>,
  label: string,
): EventView {
  switch (event.type) {
    case 'coverage.threshold_reached':
      return plain('Coverage', `${label} הגיע ל-${event.details.threshold}% Coverage`);
    case 'battery.low':
      return segmented('סוללה', batterySegments(event, label));
    default:
      return segmented('קשר', contactSegments(event, label));
  }
}

/** A searcher leaving or re-entering their polygon (UC-S04), and the polygon events. */
const describeRest = (
  event:
    | EventOf<'searcher.left_polygon'>
    | EventOf<'searcher.returned_to_polygon'>
    | EventOf<'polygon.created'>
    | EventOf<'polygon.boundary_changed'>
    | EventOf<'polygon.deleted'>
    | EventOf<'gps.lost_escalated'>
    | EventOf<'contact.no_updates'>,
  label: string,
): EventView => {
  switch (event.type) {
    case 'searcher.left_polygon':
    case 'searcher.returned_to_polygon':
      return describePresence(event);
    case 'gps.lost_escalated':
      return segmented('GPS', gpsLostSegments(event, label));
    case 'contact.no_updates':
      return segmented('קשר', noUpdatesSegments(event, label));
    default:
      return describePolygon(event, label);
  }
};

const PAUSE_TEXT = { 'mission.paused': 'המסע הושהה', 'mission.resumed': 'המסע חודש' } as const;

const describeSos = (
  event: EventOf<'sos.activated'> | EventOf<'sos.closed'>,
  label: string,
  senderOf?: SosSenderOf,
): EventView =>
  event.type === 'sos.activated'
    ? segmented('SOS', sosSegments(event, label), true)
    : segmented('SOS', sosClosedSegments(event, label, senderOf));

function describeLifecycle(
  event:
    | EventOf<'mission.created'>
    | EventOf<'mission.paused'>
    | EventOf<'mission.resumed'>
    | EventOf<'mission.ended'>
    | EventOf<'mission.details_changed'>
    | EventOf<'lkp.changed'>,
  label: string,
): EventView {
  switch (event.type) {
    case 'mission.created':
      return plain('מסע', `המסע נוצר, ${label}`);
    case 'mission.ended':
      return plain('מסע', endedText(event));
    case 'mission.details_changed':
      return plain('פרטי מסע', detailChangesText(event.details.fields));
    case 'lkp.changed':
      return plain('LKP', lkpText(event), 'map');
    default:
      return plain('השהיה', PAUSE_TEXT[event.type]);
  }
}

const labelOf = (event: TimelineEvent): string => event.subject.label ?? '';

/**
 * How an event reads in the Timeline (wireframe Cd14): a badge, its text, and where "מעבר אל" leads. `senderOf` names
 * the sender of a closed SOS, which the event does not carry.
 */
export function describeEvent(event: TimelineEvent, senderOf?: SosSenderOf): EventView {
  const label = labelOf(event);
  switch (event.type) {
    case 'mission.created':
    case 'mission.paused':
    case 'mission.resumed':
    case 'mission.ended':
    case 'mission.details_changed':
    case 'lkp.changed':
      return describeLifecycle(event, label);
    case 'search.started':
      return segmented('חיפוש', bySearcher(event, `התחיל חיפוש ב${label}`));
    case 'report.submitted':
      return segmented('דיווח', reportSegments(event, label));
    case 'coverage.threshold_reached':
    case 'contact.lost':
    case 'contact.restored':
    case 'battery.low':
      return describeAlert(event, label);
    case 'sos.activated':
    case 'sos.closed':
      return describeSos(event, label, senderOf);
    default:
      return describeRest(event, label);
  }
}

/** Whether an event is a change worth showing in "שינויים אחרונים" (Cd05): a details change, or an LKP that moved. */
function isRecentChange(event: TimelineEvent): boolean {
  if (event.type === 'lkp.changed') return event.details.previousObservedAt !== null;
  return event.type === 'mission.details_changed';
}

/**
 * The recent changes, newest first, from the Timeline as the API orders it (oldest first). The first LKP is the
 * mission's creation, not a change.
 */
export function recentChanges(events: TimelineEvent[]): TimelineEvent[] {
  return events.filter(isRecentChange).reverse();
}
