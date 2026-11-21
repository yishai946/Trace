import type { ThemeId } from '@trace/design';
import type { LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import { Form } from 'react-aria-components';
import { Button } from '../../components/Button';
import { DateTimeField } from '../../components/DateTimeField';
import { BackIcon } from '../../components/icons';
import { MissionMap } from '../../map/MissionMap';
import styles from './NewMissionPage.module.css';
import { MESSAGES, missionName } from './newMissionForm';
import { MissingPersonFields } from './MissingPersonFields';
import { useNewMissionForm } from './useNewMissionForm';
import { MissionNameTitle } from './MissionNameTitle';
import { PointPicker } from './PointPicker';

/** Where the map opens for a new mission: Jerusalem, until the commander places a point. */

/** Where the map opens before a point is placed: Jerusalem. */
const DEFAULT_CENTER: LngLat = [35.2137, 31.7683];

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
  const {
    form,
    photo,
    setPhoto,
    errors,
    modes,
    focus,
    setFocus,
    placing,
    mapData,
    failure,
    creating,
    update,
    setMode,
    setPoint,
    submit,
  } = useNewMissionForm({ online, onCreated });
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
            <BackIcon />
          </Button>
          <MissionNameTitle
            name={missionName(form)}
            onRename={(name) => update({ name: name === form.personName.trim() ? '' : name })}
          />
        </div>

        <div className={styles.scroll}>
          <MissingPersonFields form={form} errors={errors} photo={photo} onPhoto={setPhoto} onChange={update} />
        </div>

        <div className={styles.footer}>
          {!form.lkp && <p className={styles.meta}>{MESSAGES.lkp}</p>}
          {!form.rally && <p className={styles.meta}>{MESSAGES.rally}</p>}
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
              isDisabled={!form.lkp || !form.rally || !online || creating}
            >
              {creating ? 'יוצר מסע…' : 'צור מסע'}
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
          status={form.lkp ? { label: 'הוגדר', tone: 'ok' } : { label: 'חובה, לא הוגדר', tone: 'warn' }}
          mode={modes.lkp}
          onModeChange={(mode) => setMode('lkp', mode)}
          onChange={(point) => setPoint('lkp', point)}
          onPlaceFound={(place) => setFocus({ center: place.center })}
          error={errors.lkp}
        >
          {form.lkp && (
            <DateTimeField
              label="תאריך ושעה שבהם נראה"
              value={form.lkpObservedAt}
              onChange={(lkpObservedAt) => update({ lkpObservedAt })}
              isInvalid={!!errors.lkpObservedAt}
              errorMessage={errors.lkpObservedAt}
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
