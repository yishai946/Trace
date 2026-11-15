import { formatCallsign } from '@trace/domain';
import { ltr } from '../../i18n/rtl';
import { formatDistance, type ReportItem } from '../../reports/reportItems';

const COORDINATE_DIGITS = 4;

/** What a report says about where it is, and what a screen reader says about the whole card. */
export function describeReport(item: ReportItem): { place: string; label: string } {
  const [lng, lat] = item.position;
  const place = [
    `${ltr(lat.toFixed(COORDINATE_DIGITS))}, ${ltr(lng.toFixed(COORDINATE_DIGITS))}`,
    item.polygonName ? `פוליגון ${item.polygonName}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const who = item.mine
    ? 'הדיווח שלי'
    : [item.callsign === null ? null : formatCallsign(item.callsign), item.name].filter(Boolean).join(' ');
  const label = [
    item.typeLabel,
    item.time,
    item.text,
    who,
    !item.mine && item.distanceMeters !== null ? formatDistance(item.distanceMeters) : null,
  ]
    .filter(Boolean)
    .join(', ');
  return { place, label };
}
