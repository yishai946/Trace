import { COVERAGE_ALERT_THRESHOLDS, LOW_BATTERY_PERCENT } from '@trace/domain';
import type { MissionPolygon, Participant, TimelineEvent } from '@trace/schemas';
import { outsideSearchers } from '../outsideSearchers';

/** One thing the commander should look at now (UC-S04, UC-S02). */
export interface SafetyWarning {
  key: string;
  /** What kind of warning, in words: names the alert for a screen reader. */
  title: string;
  /** The searcher to open; null for a polygon's warning. */
  participantId: string | null;
  callsign: number | null;
  /** The searcher or the polygon. */
  name: string;
  message: string;
  /** Since when (ISO), when it is known. */
  since: string | null;
}

interface Sources {
  events: TimelineEvent[];
  participants: Participant[];
  polygons: MissionPolygon[];
}

type SearcherState = Pick<SafetyWarning, 'title' | 'message' | 'since'> & { kind: string };

function forSearcher(p: Participant, { kind, ...state }: SearcherState): SafetyWarning {
  return { key: `${kind}:${p.id}`, participantId: p.id, callsign: p.callsign, name: p.name, ...state };
}

function outsideWarnings({ events, participants }: Sources): SafetyWarning[] {
  return outsideSearchers(events, participants).map((s) => ({
    key: `outside:${s.participantId}`,
    title: 'מחפש מחוץ לפוליגון',
    participantId: s.participantId,
    callsign: s.callsign,
    name: s.name,
    message: `מחוץ ל${s.polygonName}, ${s.meters} מ׳ מהגבול`,
    since: s.since,
  }));
}

/** GPS lost long enough to be escalated (decision 42): gone once the GPS is back. */
function gpsWarnings({ events, participants }: Sources): SafetyWarning[] {
  return participants.flatMap((p) => {
    const since = p.gpsUnavailableSince;
    const escalated =
      since !== null &&
      events.some(
        (e) =>
          e.type === 'gps.lost_escalated' && e.subject.id === p.id && Date.parse(e.occurredAt) >= Date.parse(since),
      );
    return escalated ? [forSearcher(p, { kind: 'gps', title: 'GPS אבד', message: 'ללא GPS', since })] : [];
  });
}

/** No update since the one the "lost contact" event names (decision 44): a newer update clears it. */
function contactWarnings({ events, participants }: Sources): SafetyWarning[] {
  return participants.flatMap((p) => {
    const since = p.lastUpdateAt;
    const silent =
      since !== null &&
      events.some(
        (e) =>
          e.type === 'contact.no_updates' &&
          e.subject.id === p.id &&
          Date.parse(e.details.lastUpdateAt) === Date.parse(since),
      );
    return silent ? [forSearcher(p, { kind: 'contact', title: 'אבד קשר', message: 'אין עדכונים', since })] : [];
  });
}

function batteryWarnings({ participants }: Sources): SafetyWarning[] {
  return participants.flatMap((p) => {
    if (!p.battery || p.battery.level >= LOW_BATTERY_PERCENT) return [];
    const message = `סוללה נמוכה, ${p.battery.level}%`;
    return [forSearcher(p, { kind: 'battery', title: 'סוללה נמוכה', message, since: null })];
  });
}

/** A polygon that reached 80% or 90% (decision 55) and was not completed yet; the highest threshold reached. */
function coverageWarnings({ polygons }: Sources): SafetyWarning[] {
  return polygons.flatMap((polygon) => {
    const { coverage } = polygon;
    if (polygon.status === 'completed' || coverage === null) return [];
    const threshold = COVERAGE_ALERT_THRESHOLDS.filter((t) => coverage >= t).at(-1);
    if (threshold === undefined) return [];
    return [
      {
        key: `coverage:${polygon.id}:${threshold}`,
        title: 'כיסוי פוליגון',
        participantId: null,
        callsign: null,
        name: polygon.name,
        message: `הכיסוי עבר ${threshold}%`,
        since: null,
      },
    ];
  });
}

/** Everything to warn about now, most urgent first. A searcher whose activity ended is not warned about. */
export function safetyWarnings(sources: Sources): SafetyWarning[] {
  const active = { ...sources, participants: sources.participants.filter((p) => p.status !== 'ended') };
  return [outsideWarnings, gpsWarnings, contactWarnings, batteryWarnings, coverageWarnings].flatMap((rule) =>
    rule(active),
  );
}
