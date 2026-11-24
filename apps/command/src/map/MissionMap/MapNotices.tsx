import type { MapTool } from '../MapToolbar';
import styles from './MissionMap.module.css';

interface MapNoticesProps {
  tool: MapTool;
  /** A boundary is being reshaped. */
  editing: boolean;
  satelliteFailed: boolean;
  /** The browser could not give the commander's position. */
  locationFailed: boolean;
}

/** Short messages over the map: how to draw a polygon, and that the satellite imagery did not load. */
export function MapNotices({ tool, editing, satelliteFailed, locationFailed }: MapNoticesProps) {
  return (
    <>
      {satelliteFailed && (
        <p className={styles.hint} role="status">
          תמונות הלוויין לא נטענו. המפה חזרה לתצוגת מפה.
        </p>
      )}
      {locationFailed && (
        <p className={styles.hint} role="status">
          לא ניתן לקבל את המיקום שלך. בדוק שהדפדפן מורשה לגשת למיקום.
        </p>
      )}
      {tool === 'polygon' && !editing && (
        <p className={styles.hint}>לחץ על המפה להוספת נקודות. לחץ על הנקודה הראשונה לסגירה.</p>
      )}
    </>
  );
}
