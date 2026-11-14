import { DateTimeField } from '../../components/DateTimeField';
import { PhotoPicker } from '../../components/PhotoPicker';
import { TextField } from '../../components/TextField';
import styles from './NewMissionPage.module.css';
import type { FormErrors, NewMissionForm } from './newMissionForm';

interface MissingPersonFieldsProps {
  form: NewMissionForm;
  errors: FormErrors;
  photo: File | null;
  onPhoto: (photo: File | null) => void;
  onChange: (changes: Partial<NewMissionForm>) => void;
}

/** The missing person's details: name, age, when they disappeared, a photo, a description and anything else relevant. */
export function MissingPersonFields({ form, errors, photo, onPhoto, onChange }: MissingPersonFieldsProps) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.sectionTitle}>פרטי הנעדר</legend>
      <div className={styles.nameAge}>
        <TextField
          label="שם הנעדר"
          value={form.personName}
          onChange={(personName) => onChange({ personName })}
          isInvalid={!!errors.personName}
          errorMessage={errors.personName}
        />
        <TextField
          label="גיל"
          ltr
          inputMode="numeric"
          value={form.age}
          onChange={(age) => onChange({ age })}
          isInvalid={!!errors.age}
          errorMessage={errors.age}
        />
      </div>
      <DateTimeField
        label="זמן היעלמות"
        value={form.disappearedAt}
        onChange={(disappearedAt) => onChange({ disappearedAt })}
      />
      <div className={styles.photoRow}>
        <PhotoPicker photo={photo} onChange={onPhoto} />
        <TextField
          className={styles.grow}
          label="תיאור / לבוש"
          rows={5}
          value={form.description}
          onChange={(description) => onChange({ description })}
        />
      </div>
      <TextField
        label="מידע רלוונטי נוסף"
        rows={4}
        value={form.additionalInfo}
        onChange={(additionalInfo) => onChange({ additionalInfo })}
      />
    </fieldset>
  );
}
