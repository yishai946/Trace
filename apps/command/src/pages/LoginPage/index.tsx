import { useState, type FormEvent } from 'react';
import { Form } from 'react-aria-components';
import styles from './LoginPage.module.css';
import { signInErrorMessage, useSignIn } from '../../auth';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useOnline } from '../../hooks/useOnline';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { TraceMark } from '../../components/TraceMark';

/** Commander sign-in to TRACE Command (UC-C01, wireframes Cd01 and, on the phone, Cm01). */
export function LoginPage() {
  const signIn = useSignIn();
  const online = useOnline();
  const phone = usePhoneLayout();
  const size = phone ? 'lg' : 'md';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online || signIn.isPending) return;
    signIn.mutate({ email: email.trim(), password });
  };

  const error = !online
    ? 'אין חיבור לאינטרנט. אפשר להיכנס כשהחיבור יחזור.'
    : signIn.isError
      ? signInErrorMessage(signIn.error)
      : null;

  const form = (
    <>
      <h1 className={styles.title}>כניסת מנהל</h1>
      {/* aria validation: marking the fields invalid after a failed attempt must not block the next submit. */}
      <Form className={styles.form} onSubmit={submit} validationBehavior="aria">
        <TextField
          label="אימייל"
          type="email"
          name="email"
          autoComplete="username"
          ltr
          size={size}
          isRequired
          value={email}
          onChange={setEmail}
          isInvalid={signIn.isError}
          aria-describedby={error ? 'login-error' : undefined}
        />
        <TextField
          label="סיסמה"
          type="password"
          name="password"
          autoComplete="current-password"
          ltr
          size={size}
          isRequired
          value={password}
          onChange={setPassword}
          isInvalid={signIn.isError}
          aria-describedby={error ? 'login-error' : undefined}
        />
        {error && (
          <p
            className={[styles.error, phone && styles.phoneError].filter(Boolean).join(' ')}
            id="login-error"
            role="alert"
          >
            {phone && (
              <svg
                className={styles.errorIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6M12 16h.01" />
              </svg>
            )}
            <span>{error}</span>
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size={size}
          className={styles.submit}
          isDisabled={!online || signIn.isPending}
        >
          {signIn.isPending ? 'נכנס…' : 'כניסה'}
        </Button>
      </Form>
    </>
  );

  if (phone) {
    return (
      <div className={styles.phoneScreen}>
        <div className={styles.hero}>
          <span className={styles.mark}>
            <TraceMark size={28} />
          </span>
          <div className={styles.heroProduct}>TRACE Command</div>
          <div className={styles.heroMeta}>ניהול מסע חיפוש והצלה</div>
        </div>
        <main className={styles.sheet} aria-label="כניסת מנהל">
          {form}
        </main>
      </div>
    );
  }

  return (
    <main className={styles.panel} aria-label="כניסת מנהל">
      <div className={styles.section}>
        <div className={styles.brand}>
          <TraceMark />
          <div>
            <div className={styles.product}>TRACE Command</div>
            <div className={styles.meta}>ניהול מסע חיפוש והצלה</div>
          </div>
        </div>
      </div>

      <div className={styles.section}>{form}</div>
    </main>
  );
}
