import type { TimelineEvent } from '@trace/schemas';
import type { EventView, Segment } from '.';

type PresenceEvent = Extract<TimelineEvent, { type: 'searcher.left_polygon' | 'searcher.returned_to_polygon' }>;

/** "[07] שם" for the searcher the event is about, from its subject. */
function who({ subject }: PresenceEvent): Segment[] {
  return subject.callsign === null
    ? [subject.label ?? '']
    : [{ callsign: subject.callsign }, ` ${subject.label ?? ''}`];
}

/** A searcher leaving their polygon is a warning with the distance; coming back reads plainly (UC-S04, wireframe Cd09). */
export function describePresence(event: PresenceEvent): EventView {
  const { polygonName } = event.details;
  const left = event.type === 'searcher.left_polygon';
  return {
    badge: 'גבול',
    danger: false,
    warning: left,
    destination: null,
    segments: left
      ? [...who(event), ` יצא מהגבול של ${polygonName}, ${event.details.meters} מ׳ מחוץ לו`]
      : [...who(event), ` חזר לגבול של ${polygonName}`],
  };
}
