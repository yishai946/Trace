import type { Mission } from '@trace/schemas';
import { Form } from 'react-aria-components';
import { DateTimeField } from '../../components/DateTimeField';
import { PhotoPicker } from '../../components/PhotoPicker';
import { TextField } from '../../components/TextField';
import { JoinCodePanel } from '../../mission/JoinCodePanel';
import { DetailsHead } from './DetailsHead';
import { DetailsNotices } from './DetailsNotices';
import { MissionFacts } from './MissionFacts';
import { RecentChanges, type RecentChangesProps } from './RecentChanges';
import { useMissionDetailsForm } from './useMissionDetailsForm';
import styles from './MissionDetailsPage.module.css';

export interface MissionDetailsPageProps {
  mission: Mission;
  /** The signed-in commander: the only manager of their missions (spec §3). */
  commanderName: string;
  /** Searchers taking part now (participations not ended). */
  searcherCount: number;
  /** Without a connection, and a live map, nothing can be saved (UC-C03, decision 93). */
  online: boolean;
  onClose: () => void;
  /** The mission's Timeline, for "שינויים אחרונים". */
  changes: Omit<RecentChangesProps, 'onOpenTimeline'>;
  /** Closes the details and opens the Timeline view. */
  onOpenTimeline: () => void;
}

/** The mission and missing-person details, editable while the mission runs (UC-C03, wireframe Cd05). */
export function MissionDetailsPage({
  mission,
  commanderName,
  searcherCount,
  online,
  onClose,
  changes,
  onOpenTimeline,
}: MissionDetailsPageProps) {
  const {
    form,
    photo,
    errors,
    saved,
    photoFailed,
    notify,
    setNotify,
    save,
    readOnly,
    canSave,
    update,
    choosePhoto,
    submit,
  } = useMissionDetailsForm({ mission, online });

  return (
    <>
      <div className={styles.veil} aria-hidden="true" />
      <Form className={styles.panel} aria-label="פרטי מסע ונעדר" onSubmit={submit} validationBehavior="aria">
        <DetailsHead
          readOnly={readOnly}
          canSave={canSave}
          saving={save.isPending}
          notify={notify}
          onNotifyChange={setNotify}
          onClose={onClose}
        />

        <div className={styles.scroll}>
          <MissionFacts mission={mission} commanderName={commanderName} searcherCount={searcherCount} />

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
            description={
              readOnly
                ? undefined
                : 'מסתנכרן ל-TRACE Field בשמירה. עם "עדכן את המחפשים" נשלחת התראה למחפשים ורשומה בציר הזמן.'
            }
          />
        </div>

        <DetailsNotices
          readOnly={readOnly}
          online={online}
          saveError={save.error}
          photoFailed={photoFailed}
          saved={saved}
        />
      </Form>
      <div className={styles.side}>
        <JoinCodePanel mission={mission} />
        <RecentChanges {...changes} onOpenTimeline={onOpenTimeline} />
      </div>
    </>
  );
}
