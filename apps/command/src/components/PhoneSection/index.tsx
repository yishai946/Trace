import { formatPhone, parsePhone } from '@trace/domain';
import { useState } from 'react';
import { ApiRequestError } from '../../api';
import { useSetOwnPhone } from '../../auth';
import { Button } from '../Button';
import { TextField } from '../TextField';
import styles from './PhoneSection.module.css';

export interface PhoneSectionProps {
  /** The saved number in E.164, if any. */
  phoneNumber: string | null | undefined;
}

const INVALID = 'המספר אינו תקין. למשל 052-340-1187.';

function failureMessage(error: unknown): string {
  return error instanceof ApiRequestError && error.code === 'PHONE_IN_USE'
    ? 'המספר כבר משויך לחשבון אחר.'
    : 'השמירה נכשלה. נסו שוב.';
}

/**
 * The commander's own phone number. Field shows "התקשר למנהל" to searchers only when it is set (UC-F14), so an
 * empty field removes it.
 */
export function PhoneSection({ phoneNumber }: PhoneSectionProps) {
  const [value, setValue] = useState(phoneNumber ? formatPhone(phoneNumber) : '');
  const [invalid, setInvalid] = useState(false);
  const save = useSetOwnPhone();

  const submit = () => {
    if (save.isPending) return;
    const typed = value.trim();
    if (typed !== '' && parsePhone(typed) === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    save.mutate(typed === '' ? null : typed);
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        label="מספר טלפון"
        description="מוצג למחפשים בכפתור ״התקשר למנהל״. ריק מסיר את המספר."
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        ltr
        value={value}
        onChange={(next) => {
          setValue(next);
          setInvalid(false);
          save.reset();
        }}
        isInvalid={invalid}
        errorMessage={INVALID}
      />
      <Button type="submit" variant="secondary" size="sm" isDisabled={save.isPending}>
        {save.isPending ? 'שומר…' : 'שמירה'}
      </Button>
      {save.isSuccess && (
        <p className={styles.note} role="status">
          המספר נשמר.
        </p>
      )}
      {save.isError && (
        <p className={styles.note} role="alert">
          {failureMessage(save.error)}
        </p>
      )}
    </form>
  );
}
