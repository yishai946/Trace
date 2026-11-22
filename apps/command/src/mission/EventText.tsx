import { CallsignChip } from '../components/CallsignChip';
import type { Segment } from './timelineEvent';

/** An event's text: plain pieces, and a searcher's callsign as a chip. */
export function EventText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((segment, i) =>
        typeof segment === 'string' ? (
          <span key={i}>{segment}</span>
        ) : (
          <CallsignChip key={i} callsign={segment.callsign} />
        ),
      )}
    </>
  );
}
