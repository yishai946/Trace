import { canEditMissionDetails } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import { useState, type FormEvent } from 'react';
import { Form } from 'react-aria-components';
import { Button } from '../../components/Button';
import { DateTimeField } from '../../components/DateTimeField';
import { PhotoPicker } from '../../components/PhotoPicker';
import { TextField } from '../../components/TextField';
import { JoinCodePanel } from '../../mission/JoinCodePanel';
import { useUpdateMissionDetails } from '../../mission/missionQueries';
import { formatOpened, MISSION_STATUS_LABELS } from '../../mission/missionStatus';
import styles from './MissionDetailsPage.module.css';
import {
  fromMission,
  isChanged,
  PHOTO_SAVE_FAILED,
  saveErrorMessage,
  toUpdateBody,
  validate,
  type DetailsErrors,
  type MissionDetailsForm,
} from './missionDetailsForm';

export interface MissionDetailsPageProps {
  mission: Mission;
  /** The signed-in commander: the only manager of their missions (spec §3). */
  commanderName: string;
  /** Searchers taking part now (participations not ended). */
  searcherCount: number;
  /** Without a connection, and a live map, nothing can be saved (UC-C03, decision 93). */
  online: boolean;
  onClose: () => void;
}

/** The mission and missing-person details, editable while the mission runs (UC-C03, wireframe Cd05). */
export function MissionDetailsPage({
  mission,
  commanderName,
  searcherCount,
  online,
  onClose,
}: MissionDetailsPageProps) {
  // Read once at open: a change that arrives later does not overwrite what the commander is typing.
  const [form, setForm] = useState<MissionDetailsForm>(() => fromMission(mission));
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [saved, setSaved] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const save = useUpdateMissionDetails(mission.id);

  const readOnly = !canEditMissionDetails(mission.status);
  const changed = isChanged(form, mission) || photo !== null;
  const canSave = online && !readOnly && changed && !save.isPending;
  const { label, tone } = MISSION_STATUS_LABELS[mission.status];

  const update = (changes: Partial<MissionDetailsForm>) => {
    const next = { ...form, ...changes };
    setForm(next);
    setSaved(false);
    setPhotoFailed(false);
    // Once the commander has tried to save, the marks follow what they fix.
    if (Object.keys(errors).length > 0) setErrors(validate(next));
  };

  const choosePhoto = (file: File | null) => {
    setPhoto(file);
    setSaved(false);
    setPhotoFailed(false);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || !canSave) return;
    save.mutate(
      { body: toUpdateBody(form), photo },
      {
        onSuccess: (result) => {
          setSaved(!result.photoFailed);
          setPhotoFailed(result.photoFailed);
          if (!result.photoFailed) setPhoto(null);
        },
      },
    );
  };

  const notices = [
    readOnly && (
      <p key="ended" className={styles.meta}>
        המסע הסתיים. הפרטים לקריאה בלבד.
      </p>
    ),
    !readOnly && !online && (
      <p key="offline" className={styles.meta}>
        אין חיבור לשרת. אפשר לשמור כשהחיבור יחזור.
      </p>
    ),
    save.error && (
      <p key="error" className={styles.error} role="alert">
        {saveErrorMessage(save.error)}
      </p>
    ),
    photoFailed && (
      <p key="photo" className={styles.error} role="alert">
        {PHOTO_SAVE_FAILED}
      </p>
    ),
    saved && (
      <p key="saved" className={styles.meta} role="status">
        השינויים נשמרו.
      </p>
    ),
  ].filter(Boolean);

  return (
    <>
      <div className={styles.veil} aria-hidden="true" />
      <Form className={styles.panel} aria-label="פרטי מסע ונעדר" onSubmit={submit} validationBehavior="aria">
        <div className={styles.head}>
          <h2 className={styles.title}>פרטי מסע ונעדר</h2>
          <Button onPress={onClose}>בטל</Button>
          {!readOnly && (
            <Button type="submit" variant="primary" isDisabled={!canSave}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12 5 5 9-10" />
              </svg>
              {save.isPending ? 'שומר…' : 'שמור שינויים'}
            </Button>
          )}
        </div>

        <div className={styles.scroll}>
          <dl className={styles.facts}>
            <div>
              <dt>מצב</dt>
              <dd>
                <span className={styles.state} data-tone={tone}>
                  <span className={styles.stateDot} aria-hidden="true" />
                  {label}
                </span>
              </dd>
            </div>
            <div>
              <dt>נפתח</dt>
              <dd className={styles.num}>{formatOpened(mission.createdAt)}</dd>
            </div>
            <div>
              <dt>מנהל מסע</dt>
              <dd>{commanderName}</dd>
            </div>
            <div>
              <dt>מחפשים</dt>
              <dd className={styles.num}>{searcherCount}</dd>
            </div>
          </dl>

          <div className={styles.pair}>
            <TextField
              label="שם / מזהה מסע"
              autoFocus={!readOnly}
              isReadOnly={readOnly}
              value={form.name}
              onChange={(name) => update({ name })}
              isInvalid={!!errors.name}
              errorMessage={errors.name}
            />
            <TextField
              label="שם הנעדר"
              isReadOnly={readOnly}
              value={form.personName}
              onChange={(personName) => update({ personName })}
            />
          </div>

          <div className={styles.ageTime}>
            <TextField
              label="גיל"
              ltr
              inputMode="numeric"
              isReadOnly={readOnly}
              value={form.age}
              onChange={(age) => update({ age })}
              isInvalid={!!errors.age}
              errorMessage={errors.age}
            />
            <DateTimeField
              label="זמן היעלמות"
              isReadOnly={readOnly}
              value={form.disappearedAt}
              onChange={(disappearedAt) => update({ disappearedAt })}
            />
          </div>

          <div className={styles.photoRow}>
            <PhotoPicker
              photo={photo}
              onChange={choosePhoto}
              currentUrl={mission.missingPerson.photoUrl}
              readOnly={readOnly}
            />
            <TextField
              className={styles.grow}
              label="תיאור / לבוש"
              rows={5}
              isReadOnly={readOnly}
              value={form.description}
              onChange={(description) => update({ description })}
            />
          </div>

          <TextField
            label="מידע רלוונטי"
            rows={4}
            isReadOnly={readOnly}
            value={form.additionalInfo}
            onChange={(additionalInfo) => update({ additionalInfo })}
            description={readOnly ? undefined : 'מסתנכרן ל-TRACE Field בשמירה.'}
          />
        </div>

        {notices.length > 0 && <div className={styles.footer}>{notices}</div>}
      </Form>
      <div className={styles.side}>
        <JoinCodePanel mission={mission} />
      </div>
    </>
  );
}
