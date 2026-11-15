import styles from './App.module.css';
import { useSession } from '../auth';
import { getMapProvider } from '../map/provider';
import { LoginPage } from '../pages/LoginPage';
import { useTheme } from '../theme/theme';
import { Backdrop } from './Backdrop';
import { Console } from './Console';

const provider = getMapProvider();

/** Signs the commander in (UC-C01), then shows their missions or the one they opened. */
export function App() {
  const { theme } = useTheme();
  const session = useSession();

  if (!provider) {
    return (
      <main className={styles.screen}>
        <div className={styles.setup} role="alert">
          חסר מפתח מפה. העתיקו את <code>apps/command/.env.example</code> ל-<code>.env.local</code>, הוסיפו את מפתח
          MapTiler והפעילו מחדש את שרת הפיתוח.
        </div>
      </main>
    );
  }

  if (session.isPending) {
    return <p className={styles.setup}>טוען…</p>;
  }

  if (!session.data) {
    return (
      <div className={styles.screen} data-login="">
        <Backdrop provider={provider} themeId={theme} veil="light" />
        <LoginPage />
      </div>
    );
  }

  return <Console provider={provider} user={session.data.user} />;
}
