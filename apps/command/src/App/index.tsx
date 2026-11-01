import { HealthResponse } from '@trace/schemas';
import type { MapPolygon } from '@trace/map';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './App.module.css';
import { Button } from '../components/Button';
import { MissionMap, type MapFocus } from '../map/MissionMap';
import { PlaceSearch } from '../map/PlaceSearch';
import { getMapProvider } from '../map/provider';
import { SAMPLE_CENTER, sampleMission } from '../map/sample-mission';
import { useTheme } from '../theme/theme';

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return HealthResponse.parse(await res.json());
}

const provider = getMapProvider();

export function App() {
  const { theme, setTheme } = useTheme();
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });
  const [mission, setMission] = useState(sampleMission);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const apiStatus = health.isPending ? 'בודק חיבור…' : health.isError ? 'השרת לא זמין' : 'מחובר לשרת';

  const addPolygon = (geometry: MapPolygon['geometry']) =>
    setMission((m) => {
      const letter = String.fromCharCode('A'.charCodeAt(0) + m.polygons.length);
      return {
        ...m,
        polygons: [...m.polygons, { id: letter, letter, status: 'unassigned', coverage: null, geometry }],
      };
    });

  return (
    <main className={styles.screen}>
      {provider ? (
        <MissionMap
          provider={provider}
          themeId={theme}
          data={mission}
          initialView={{ center: SAMPLE_CENTER, zoom: 14 }}
          focus={focus}
          onPolygonDrawn={addPolygon}
        />
      ) : (
        <div className={styles.setup} role="alert">
          חסר מפתח מפה. העתיקו את <code>apps/command/.env.example</code> ל-<code>.env.local</code>, הוסיפו את מפתח
          MapTiler והפעילו מחדש את שרת הפיתוח.
        </div>
      )}

      <header className={styles.appbar}>
        <span className={styles.brand}>Trace</span>
        <span className={styles.status} data-state={health.isError ? 'error' : health.isSuccess ? 'ok' : 'pending'}>
          {apiStatus}
        </span>
        {provider && (
          <div className={styles.search}>
            <PlaceSearch
              provider={provider}
              onSelect={(place) => setFocus({ center: place.center, bounds: place.bounds })}
            />
          </div>
        )}
        <div className={styles.actions}>
          <Button onPress={() => setTheme(theme === 'night' ? 'day' : 'night')}>
            {theme === 'night' ? 'ערכת יום' : 'ערכת לילה'}
          </Button>
          <Button variant="primary">הנעדר אותר…</Button>
        </div>
      </header>
    </main>
  );
}
