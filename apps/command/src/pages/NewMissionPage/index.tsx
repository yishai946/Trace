import type { ThemeId } from '@trace/design';
import type { LngLat } from '@trace/geo';
import { emptyMissionMapData, type MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import { useMemo, useState, type FormEvent } from 'react';
import { Form } from 'react-aria-components';
import { ApiRequestError } from '../../api';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { MissionMap, type MapFocus } from '../../map/MissionMap';
import { useCreateMission } from '../../mission/missionQueries';
import styles from './NewMissionPage.module.css';
import { emptyForm, toCreateBody, validate, type FormErrors, type NewMissionForm } from './newMissionForm';
import { PhotoPicker } from './PhotoPicker';
import { PointPicker, type PlaceMode } from './PointPicker';

/** Where the map opens for a new mission: Jerusalem, until the commander places a point. */
const DEFAULT_CENTER: LngLat = [35.2137, 31.7683];

type PointKind = 'lkp' | 'rally';

export interface NewMissionPageProps {
  provider: MapProvider;
  themeId: ThemeId;
  /** Without a connection the mission cannot be created (UC-C01). */
  online: boolean;
  onCancel: () => void;
  /** The mission was created. `photoFailed` when it was created without the chosen photo. */
  onCreated: (mission: Mission, photoFailed: boolean) => void;
}

/** The new-mission screen (UC-C02, wireframe Cd03): mission and missing-person details, LKP and rally point. */
export function NewMissionPage({ provider, themeId, online, onCancel, onCreated }: NewMissionPageProps) {
  const [form, setForm] = useState<NewMissionForm>(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [modes, setModes] = useState<Record<PointKind, PlaceMode>>({ lkp: 'map', rally: 'search' });
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const create = useCreateMission();

  // Only one point follows map clicks: the one whose "map" tab is open.
  const placing: PointKind | null = modes.lkp === 'map' ? 'lkp' : modes.rally === 'map' ? 'rally' : null;

  const update = (changes: Partial<NewMissionForm>) => {
    const next = { ...form, ...changes };
    setForm(next);
    // Once the commander has tried to create, the marks follow what they fix.
    if (Object.keys(errors).length > 0) setErrors(validate(next));
  };

  const setMode = (kind: PointKind, mode: PlaceMode) => {
    const other: PointKind = kind === 'lkp' ? 'rally' : 'lkp';
    setModes(
      (current) =>
        ({
          [kind]: mode,
          [other]: mode === 'map' && current[other] === 'map' ? 'search' : current[other],
        }) as Record<PointKind, PlaceMode>,
    );
  };

  const setPoint = (kind: PointKind, point: LngLat) => update(kind === 'lkp' ? { lkp: point } : { rally: point });

  const mapData = useMemo(
    () => ({
      ...emptyMissionMapData,
      lkp: form.lkp ? { id: 'lkp', position: form.lkp, time: form.lkpTime } : null,
      rally: form.rally,
    }),
    [form.lkp, form.lkpTime, form.rally],
  );

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || !online) return;
    create.mutate(
      { body: toCreateBody(form), photo },
      { onSuccess: ({ mission, photoFailed }) => onCreated(mission, photoFailed) },
    );
  };

  const failure =
    create.error instanceof ApiRequestError && create.error.code === 'NETWORK_ERROR'
      ? 'אין חיבור לשרת. המסע לא נוצר.'
      : create.error
        ? 'המסע לא נוצר. בדקו את הפרטים ונסו שוב.'
        : null;

  return (
    <>
      <MissionMap
        provider={provider}
        themeId={themeId}
        data={mapData}
        initialView={{ center: DEFAULT_CENTER, zoom: 12 }}
        focus={focus}
        onMapClick={placing ? (point) => setPoint(placing, point) : undefined}
      />

      <Form className={styles.details} aria-label="פרטי מסע חדש" onSubmit={submit} validationBehavior="aria">
        <div className={styles.head}>
          <Button variant="icon" aria-label="חזרה לרשימת המסעות" onPress={onCancel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Button>
          <h1 className={styles.title}>מסע חדש</h1>
        </div>

        <div className={styles.scroll}>
          <fieldset className={styles.group}>
            <legend className={styles.sectionTitle}>פרטי מסע</legend>
            <TextField
              label="שם / מזהה מסע"
              description="יופיע ברשימת המסעות ובלוח המבצעי."
              isRequired
              value={form.name}
              onChange={(name) => update({ name })}
              isInvalid={!!errors.name}
              errorMessage={errors.name}
            />
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.sectionTitle}>פרטי הנעדר</legend>
            <div className={styles.nameAge}>
              <TextField label="שם הנעדר" value={form.personName} onChange={(personName) => update({ personName })} />
              <TextField
                label="גיל"
                ltr
                inputMode="numeric"
                value={form.age}
                onChange={(age) => update({ age })}
                isInvalid={!!errors.age}
                errorMessage={errors.age}
              />
            </div>
            <TextField
              label="זמן היעלמות"
              type="datetime-local"
              ltr
              value={form.disappearedAt}
              onChange={(disappearedAt) => update({ disappearedAt })}
            />
            <div className={styles.photoRow}>
              <PhotoPicker photo={photo} onChange={setPhoto} />
              <TextField
                className={styles.grow}
                label="תיאור / לבוש"
                rows={5}
                value={form.description}
                onChange={(description) => update({ description })}
              />
            </div>
            <TextField
              label="מידע רלוונטי נוסף"
              rows={4}
              value={form.additionalInfo}
              onChange={(additionalInfo) => update({ additionalInfo })}
            />
          </fieldset>
        </div>

        <div className={styles.footer}>
          {!form.rally && <p className={styles.meta}>חסרה נקודת כינוס — חובה לפני יצירת המסע.</p>}
          {!online && <p className={styles.meta}>אין חיבור לשרת. אפשר ליצור מסע כשהחיבור יחזור.</p>}
          {failure && (
            <p className={styles.fieldError} role="alert">
              {failure}
            </p>
          )}
          <div className={styles.actions}>
            <Button className={styles.cancel} onPress={onCancel}>
              ביטול
            </Button>
            <Button
              type="submit"
              variant="primary"
              className={styles.grow}
              isDisabled={!form.rally || !online || create.isPending}
            >
              {create.isPending ? 'יוצר מסע…' : 'צור מסע'}
            </Button>
          </div>
          <p className={styles.caption}>המסע נפתח מיד כפעיל, ונוצר קוד הצטרפות.</p>
        </div>
      </Form>

      <div className={styles.points} aria-label="LKP ונקודת כינוס" role="group">
        <PointPicker
          provider={provider}
          title="LKP, נקודה אחרונה שבה נראה"
          pointName="LKP"
          point={form.lkp}
          status={form.lkp ? { label: 'הוגדר', tone: 'ok' } : { label: 'רשות, לא הוגדר', tone: 'muted' }}
          mode={modes.lkp}
          onModeChange={(mode) => setMode('lkp', mode)}
          onChange={(point) => setPoint('lkp', point)}
          onPlaceFound={(place) => setFocus({ center: place.center })}
        >
          {form.lkp && (
            <TextField
              label="שעה שבה נראה"
              type="time"
              ltr
              value={form.lkpTime}
              onChange={(lkpTime) => update({ lkpTime })}
              isInvalid={!!errors.lkpTime}
              errorMessage={errors.lkpTime}
            />
          )}
        </PointPicker>
        <PointPicker
          provider={provider}
          title="נקודת כינוס"
          pointName="נקודת כינוס"
          point={form.rally}
          status={form.rally ? { label: 'הוגדרה', tone: 'ok' } : { label: 'חובה, לא הוגדרה', tone: 'warn' }}
          mode={modes.rally}
          onModeChange={(mode) => setMode('rally', mode)}
          onChange={(point) => setPoint('rally', point)}
          onPlaceFound={(place) => setFocus({ center: place.center })}
          error={errors.rally}
        />
      </div>
    </>
  );
}
