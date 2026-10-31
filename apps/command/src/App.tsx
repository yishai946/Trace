import { HealthResponse } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import styles from './App.module.css';
import { Button } from './components/Button';
import { CallsignChip } from './components/CallsignChip';
import { useTheme } from './theme/theme';

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return HealthResponse.parse(await res.json());
}

export function App() {
  const { theme, setTheme } = useTheme();
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });

  const apiStatus = health.isPending ? 'בודק חיבור…' : health.isError ? 'השרת לא זמין' : 'מחובר לשרת';

  return (
    <main className={styles.screen}>
      <header className={styles.appbar}>
        <span className={styles.brand}>Trace</span>
        <span className={styles.status} data-state={health.isError ? 'error' : health.isSuccess ? 'ok' : 'pending'}>
          {apiStatus}
        </span>
        <div className={styles.actions}>
          <Button onPress={() => setTheme(theme === 'night' ? 'day' : 'night')}>
            {theme === 'night' ? 'ערכת יום' : 'ערכת לילה'}
          </Button>
          <Button variant="primary">הנעדר אותר…</Button>
        </div>
      </header>

      <section className={styles.panel} aria-label="דוגמת רכיבים">
        <div className={styles.row}>
          <CallsignChip callsign={4} />
          <CallsignChip callsign={7} state="sos" />
          <CallsignChip callsign={21} state="waiting" />
          <CallsignChip callsign={9} state="offline" />
        </div>
      </section>
    </main>
  );
}
