import { formatLatLng, type LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import type { EndMissionLocatedBody } from '@trace/schemas';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { DateTimeField } from '../../components/DateTimeField';
import { TextField } from '../../components/TextField';
import type { Place } from '../../map/geocoding';
import { PlacePicker, type PlaceMode } from '../../map/PlacePicker';
import { ConfirmEnd } from './ConfirmEnd';
import { initialForm, toBody, validate, type EndLocatedErrors } from '../endLocatedForm';
import styles from './MissionControlPanel.module.css';

interface EndLocatedFormProps {
  provider: MapProvider;
  point: LngLat | null;
  mode: PlaceMode;
  onModeChange: (mode: PlaceMode) => void;
  onPoint: (point: LngLat) => void;
  onPlaceFound: (place: Place) => void;
  busy: boolean;
  error: string | null;
  offline: boolean;
  onEnd: (body: EndMissionLocatedBody) => void;
  onEdit: () => void;
}

/** "הנעדר אותר": where, when and an optional note; the end is confirmed in a popover first (UC-C16, decision 97). */
export function EndLocatedForm({
  provider,
  point,
  mode,
  onModeChange,
  onPoint,
  onPlaceFound,
  busy,
  error,
  offline,
  onEnd,
  onEdit,
}: EndLocatedFormProps) {
  const [locatedAt, setLocatedAt] = useState(() => initialForm().locatedAt);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<EndLocatedErrors>({});
  const form = { position: point, locatedAt, note };
  const found = validate(form);
  const ready = Object.keys(found).length === 0;

  return (
    <form
      className={styles.form}
      aria-label="הנעדר אותר"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setErrors(found);
      }}
    >
      <h3 className={styles.label}>מיקום האיתור</h3>
      <PlacePicker
        provider={provider}
        pointName="האיתור"
        point={point}
        mode={mode}
        onModeChange={onModeChange}
        onChange={(next) => {
          onEdit();
          onPoint(next);
        }}
        onPlaceFound={onPlaceFound}
      />
      {point && mode !== 'coords' && (
        <p className={styles.coords} dir="ltr">
          {formatLatLng(point)}
        </p>
      )}
      {errors.position && !point && (
        <p className={styles.error} role="alert">
          {errors.position}
        </p>
      )}
      <DateTimeField
        label="זמן האיתור"
        value={locatedAt}
        onChange={(value) => {
          onEdit();
          setLocatedAt(value);
        }}
        isInvalid={!!errors.locatedAt && !locatedAt}
        errorMessage={errors.locatedAt}
      />
      <TextField
        label="הערה (אופציונלי)"
        rows={3}
        value={note}
        onChange={(value) => {
          onEdit();
          setNote(value);
        }}
      />
      <p className={styles.hint}>
        המסע מסתיים כ"הנעדר אותר" ונשמר לקריאה בלבד. המעקב הבטיחותי נמשך עד סיום הפעילות של כל מחפש.
      </p>
      {offline && <p className={styles.notice}>אין חיבור לשרת. אפשר לסיים את המסע כשהחיבור יחזור.</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {ready ? (
        <ConfirmEnd
          label="הנעדר אותר…"
          question="לסיים את המסע: הנעדר אותר?"
          busy={busy}
          offline={offline}
          onConfirm={() => onEnd(toBody(form))}
        />
      ) : (
        <Button variant="primary" type="submit" isDisabled={busy || offline}>
          הנעדר אותר…
        </Button>
      )}
    </form>
  );
}
