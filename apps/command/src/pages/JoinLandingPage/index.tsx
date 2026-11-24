import { joinLink } from '@trace/domain';
import styles from './JoinLandingPage.module.css';
import { LinkButton } from '../../components/Button';
import { TraceMark } from '../../components/TraceMark';

/** The app's own scheme: the page's button opens Field with it when the app is installed. */
const FIELD_SCHEME = 'trace-field://';

/**
 * What a searcher sees when a join link (`/j/<code>`) opens in a browser instead of in Field: on iOS, or on Android
 * without the app. It explains how to install the app and opens it with the code (UC-F02, decision 6).
 */
export function JoinLandingPage({ code }: { code: string }) {
  return (
    <main className={styles.screen}>
      <article className={styles.card}>
        <p className={styles.brand}>
          <TraceMark size={24} />
          <span>TRACE</span>
        </p>
        <h1 className={styles.title}>הצטרפות למסע חיפוש</h1>
        <p className={styles.label}>קוד המסע</p>
        <p className={styles.code} dir="ltr">
          {code}
        </p>
        <LinkButton variant="primary" size="lg" className={styles.open} href={joinLink(FIELD_SCHEME, code)}>
          פתיחה באפליקציה
        </LinkButton>
        <ol className={styles.steps}>
          <li>התקינו את אפליקציית TRACE Field אצל מנהל המסע.</li>
          <li>חזרו לקישור הזה ולחצו על "פתיחה באפליקציה", או הזינו את הקוד במסך ההצטרפות.</li>
        </ol>
      </article>
    </main>
  );
}
