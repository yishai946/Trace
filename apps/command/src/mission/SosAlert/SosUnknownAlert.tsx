import { Button } from '../../components/Button';
import styles from './SosAlert.module.css';

/** The SOS could not be loaded: whether one is active is not known, and "נסה שוב" asks again. */
export function SosUnknownAlert({ onRetry, compact }: { onRetry?: () => void; compact?: boolean }) {
  return (
    <section className={styles.alert} data-compact={compact || undefined} role="alert" aria-label="מצב SOS לא ידוע">
      <span className={styles.badge}>SOS</span>
      <div className={styles.text}>לא ניתן לטעון את מצב ה-SOS, ייתכן ש-SOS פעיל. מנסה שוב.</div>
      {onRetry && (
        <Button variant="danger" onPress={onRetry}>
          נסה שוב
        </Button>
      )}
    </section>
  );
}
