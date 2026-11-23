import type { MapTool } from '../MapToolbar';
import styles from './MissionMap.module.css';

interface MapNoticesProps {
  tool: MapTool;
  /** A boundary is being reshaped. */
  editing: boolean;
  satelliteFailed: boolean;
}

/** Short messages over the map: how to draw a polygon, and that the satellite imagery did not load. */
export function MapNotices({ tool, editing, satelliteFailed }: MapNoticesProps) {
  return (
    <>
      {satelliteFailed && (
        <p className={styles.hint} role="status">
          תמונות הלוויין לא נטענו. המפה חזרה לתצוגת מפה.
        </p>
      )}
      {tool === 'polygon' && !editing && (
        <p className={styles.hint}>לחץ על המפה להוספת נקודות. לחץ על הנקודה הראשונה לסגירה.</p>
      )}
    </>
  );
}
