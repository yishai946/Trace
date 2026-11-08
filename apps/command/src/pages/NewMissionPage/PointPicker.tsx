import type { LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import type { ReactNode } from 'react';
import type { Place } from '../../map/geocoding';
import { COORDS_ERROR, PlacePicker, type PlaceMode } from '../../map/PlacePicker';
import styles from './NewMissionPage.module.css';
import { formatCoordinate } from './newMissionForm';

export { COORDS_ERROR };
export type { PlaceMode };

interface PointPickerProps {
  provider: MapProvider;
  title: string;
  /** Names the point in labels, e.g. "LKP" or "נקודת כינוס". */
  pointName: string;
  point: LngLat | null;
  /** The status badge: set, missing and required, or missing and optional. */
  status: { label: string; tone: 'ok' | 'warn' | 'muted' };
  mode: PlaceMode;
  onModeChange: (mode: PlaceMode) => void;
  onChange: (point: LngLat) => void;
  /** A found place, so the map can move to it. */
  onPlaceFound: (place: Place) => void;
  /** Extra fields under the coordinates, such as the LKP hour. */
  children?: ReactNode;
  /** Shown while the point is missing and the commander tried to create the mission. */
  error?: string;
}

/** One point of the new mission, the LKP or the rally point, set on the map, by search or by coordinates. */
export function PointPicker({
  provider,
  title,
  pointName,
  point,
  status,
  mode,
  onModeChange,
  onChange,
  onPlaceFound,
  children,
  error,
}: PointPickerProps) {
  return (
    <section className={styles.pointSection} aria-label={title}>
      <div className={styles.pointHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.badge} data-tone={status.tone}>
          <span className={styles.badgeDot} aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <PlacePicker
        provider={provider}
        pointName={pointName}
        point={point}
        mode={mode}
        onModeChange={onModeChange}
        onChange={onChange}
        onPlaceFound={onPlaceFound}
      />

      {point && mode !== 'coords' && (
        <p className={styles.coordsRead} dir="ltr">
          {formatCoordinate(point[1])}, {formatCoordinate(point[0])}
        </p>
      )}
      {children}
      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
