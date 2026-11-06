import type { LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import { useState, type ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs, type Key } from 'react-aria-components';
import { TextField } from '../../components/TextField';
import type { Place } from '../../map/geocoding';
import { PlaceSearch } from '../../map/PlaceSearch';
import styles from './NewMissionPage.module.css';
import { formatCoordinate, parseLatLng } from './newMissionForm';

export const COORDS_ERROR = 'קואורדינטות לא תקינות: קו רוחב בין ‎-90 ל-90, קו אורך בין ‎-180 ל-180.';

/** How a point is placed (decisions 2, 91): a click on the map, a place search or typed coordinates. */
export type PlaceMode = 'map' | 'search' | 'coords';

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
  const [lat, setLat] = useState(point ? formatCoordinate(point[1]) : '');
  const [lng, setLng] = useState(point ? formatCoordinate(point[0]) : '');
  const [typedError, setTypedError] = useState<string | null>(null);
  // A point set on the map or by search replaces what was typed.
  const [shown, setShown] = useState(point);
  if (point !== shown) {
    setShown(point);
    setTypedError(null);
    if (point && !samePoint(point, parseLatLng(lat, lng))) {
      setLat(formatCoordinate(point[1]));
      setLng(formatCoordinate(point[0]));
    }
  }

  // Typed coordinates apply when both are valid. Invalid ones are refused and the fields go back to the point
  // that is set, so the screen never shows coordinates other than the ones the mission will get.
  const commitTyped = (nextLat: string, nextLng: string) => {
    const typed = parseLatLng(nextLat, nextLng);
    if (typed) {
      setTypedError(null);
      if (!samePoint(typed, point)) onChange(typed);
      return;
    }
    if (!nextLat.trim() || !nextLng.trim()) return;
    setTypedError(COORDS_ERROR);
    if (point) {
      setLat(formatCoordinate(point[1]));
      setLng(formatCoordinate(point[0]));
    }
  };

  return (
    <section className={styles.pointSection} aria-label={title}>
      <div className={styles.pointHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.badge} data-tone={status.tone}>
          <span className={styles.badgeDot} aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <Tabs selectedKey={mode} onSelectionChange={(key: Key) => onModeChange(key as PlaceMode)}>
        <TabList className={styles.seg} aria-label={`אופן הגדרת ${pointName}`}>
          <Tab id="map" className={styles.segTab}>
            מפה
          </Tab>
          <Tab id="search" className={styles.segTab}>
            חיפוש
          </Tab>
          <Tab id="coords" className={styles.segTab}>
            קואורדינטות
          </Tab>
        </TabList>
        <TabPanel id="map" className={styles.tabPanel}>
          <p className={styles.hint}>{point ? 'לחצו על המפה להזזת הנקודה.' : `לחצו על המפה למיקום ${pointName}.`}</p>
        </TabPanel>
        <TabPanel id="search" className={styles.tabPanel}>
          <PlaceSearch
            provider={provider}
            label={`חיפוש מקום ל${pointName}`}
            placeholder="חפשו מקום או כתובת…"
            fullWidth
            onSelect={(place) => {
              onChange(place.center);
              onPlaceFound(place);
            }}
          />
        </TabPanel>
        <TabPanel id="coords" className={styles.tabPanel}>
          <div className={styles.coords}>
            <TextField
              label="קו רוחב"
              ltr
              inputMode="decimal"
              value={lat}
              onChange={setLat}
              onBlur={() => commitTyped(lat, lng)}
              onKeyDown={(e) => e.key === 'Enter' && commitTyped(lat, lng)}
            />
            <TextField
              label="קו אורך"
              ltr
              inputMode="decimal"
              value={lng}
              onChange={setLng}
              onBlur={() => commitTyped(lat, lng)}
              onKeyDown={(e) => e.key === 'Enter' && commitTyped(lat, lng)}
            />
          </div>
          {typedError && (
            <p className={styles.fieldError} role="alert">
              {typedError}
            </p>
          )}
        </TabPanel>
      </Tabs>

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

function samePoint(a: LngLat | null, b: LngLat | null): boolean {
  return (
    !!a && !!b && formatCoordinate(a[0]) === formatCoordinate(b[0]) && formatCoordinate(a[1]) === formatCoordinate(b[1])
  );
}
