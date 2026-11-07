import type { LngLat } from '@trace/geo';
import { formatLatLng } from '@trace/geo';
import { SIGHTING_SOURCES } from '@trace/domain';
import type { CreateSightingBody, SightingSource } from '@trace/schemas';
import { useState } from 'react';
import { Radio, RadioGroup, Label } from 'react-aria-components';
import { Button } from '../../components/Button';
import { DateTimeField } from '../../components/DateTimeField';
import { TextField } from '../../components/TextField';
import styles from './LkpPanel.module.css';
import { emptyForm, nowLocal, toCreateBody, validate, type SightingFormErrors } from './sightingForm';

export const SOURCE_FIELD_LABEL: Record<SightingSource, string> = { self: 'אני', witness: 'עד ראייה' };

interface AddSightingFormProps {
  /** The spot the commander clicked on the map; null until they do. */
  position: LngLat | null;
  busy: boolean;
  onSubmit: (body: CreateSightingBody) => void;
  onCancel: () => void;
}

/** The add-sighting form (decision 61): source, location from the map, time and a short description. */
export function AddSightingForm({ position, busy, onSubmit, onCancel }: AddSightingFormProps) {
  const [source, setSource] = useState<SightingSource | null>(null);
  const [observedAt, setObservedAt] = useState(nowLocal);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<SightingFormErrors>({});

  const submit = () => {
    const form = { ...emptyForm, source, position, observedAt, description };
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(toCreateBody(form));
  };

  return (
    <form
      className={styles.form}
      aria-label="תצפית חדשה"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <RadioGroup
        className={styles.formField}
        orientation="horizontal"
        value={source}
        onChange={(value) => setSource(value as SightingSource)}
        isInvalid={!!errors.source && !source}
      >
        <Label className={styles.label}>מקור</Label>
        <div className={styles.seg}>
          {SIGHTING_SOURCES.map((value) => (
            <Radio key={value} value={value} className={styles.segOption}>
              {SOURCE_FIELD_LABEL[value]}
            </Radio>
          ))}
        </div>
      </RadioGroup>
      {errors.source && !source && (
        <p role="alert" className={styles.error}>
          {errors.source}
        </p>
      )}

      <div className={styles.formField}>
        <span className={styles.label}>מיקום התצפית</span>
        {position ? (
          <>
            <span className={styles.coordinates} dir="ltr">
              {formatLatLng(position)}
            </span>
            <p className={styles.hint}>לחצו שוב להזזה.</p>
          </>
        ) : (
          <p className={styles.hint}>לחצו על המפה למיקום התצפית.</p>
        )}
      </div>
      {errors.position && !position && (
        <p role="alert" className={styles.error}>
          {errors.position}
        </p>
      )}

      <DateTimeField label="זמן התצפית" value={observedAt} onChange={setObservedAt} isInvalid={!!errors.observedAt} />
      {errors.observedAt && !observedAt && (
        <p role="alert" className={styles.error}>
          {errors.observedAt}
        </p>
      )}

      <TextField label="תיאור קצר" value={description} onChange={setDescription} rows={3} maxLength={2000} />

      <div className={styles.row}>
        <Button type="submit" variant="primary" isDisabled={busy}>
          שמור תצפית
        </Button>
        <Button onPress={onCancel} isDisabled={busy}>
          בטל
        </Button>
      </div>
    </form>
  );
}
