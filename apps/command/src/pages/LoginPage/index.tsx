import { useState, type FormEvent } from 'react';
import { Form } from 'react-aria-components';
import styles from './LoginPage.module.css';
import { signInErrorMessage, useSignIn } from '../../auth';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useOnline } from '../../hooks/useOnline';
import { TraceMark } from '../../components/TraceMark';

/** Commander sign-in to TRACE Command (UC-C01, wireframe Cd01). */
export function LoginPage() {
  const signIn = useSignIn();
  const online = useOnline();
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

      <div className={styles.section}>
        <h1 className={styles.title}>כניסת מנהל</h1>
        {/* aria validation: marking the fields invalid after a failed attempt must not block the next submit. */}
        <Form className={styles.form} onSubmit={submit} validationBehavior="aria">
          <TextField
            label="אימייל"
            type="email"
            name="email"
            autoComplete="username"
            ltr
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
            isRequired
            value={password}
            onChange={setPassword}
            isInvalid={signIn.isError}
            aria-describedby={error ? 'login-error' : undefined}
          />
          {error && (
            <p className={styles.error} id="login-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className={styles.submit} isDisabled={!online || signIn.isPending}>
            {signIn.isPending ? 'נכנס…' : 'כניסה'}
          </Button>
        </Form>
      </div>

      <div className={styles.footer}>
        <span className={styles.meta}>מחפשים בשטח נכנסים ל-TRACE Field עם קוד הצטרפות.</span>
      </div>
    </main>
  );
}
