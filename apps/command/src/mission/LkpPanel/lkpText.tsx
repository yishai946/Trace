import { formatLatLng, type LngLat } from '@trace/geo';
import type { Sighting } from '@trace/schemas';
import styles from './LkpPanel.module.css';

export const coordinates = (point: { coordinates: number[] }) => formatLatLng(point.coordinates as LngLat);

/** "LKP" is Latin inside Hebrew text: isolated, and kept on the line with its Hebrew prefix (wireframe tcx-nw). */
export const lkpWord = (prefix: string) => (
  <span className={styles.nowrap}>
    {prefix}
    <bdi>LKP</bdi>
  </span>
);

/** Who saw the missing person, as the list says it: a commander's own sighting is "מנהל" (decision 61). */
export function sourceLabel(sighting: Sighting): string {
  if (sighting.source === 'witness') return 'עד ראייה';
  return sighting.reportedBy.role === 'commander' ? 'מנהל' : 'מחפש';
}
