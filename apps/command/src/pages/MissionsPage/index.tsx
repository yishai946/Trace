import { isMissionEnded } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import { useMemo, useState } from 'react';
import { Input, SearchField, Tab, TabList, TabPanel, Tabs, type Key } from 'react-aria-components';
import styles from './MissionsPage.module.css';
import { MISSION_STATUS_LABELS, formatOpened } from './missionStatus';
import { Button } from '../../components/Button';

type Filter = 'all' | 'active' | 'paused' | 'ended';

const FILTERS: { id: Filter; label: string; matches: (m: Mission) => boolean }[] = [
  { id: 'all', label: 'הכול', matches: () => true },
  { id: 'active', label: 'פעיל', matches: (m) => m.status === 'active' },
  { id: 'paused', label: 'מושהה', matches: (m) => m.status === 'paused' },
  { id: 'ended', label: 'הסתיים', matches: (m) => isMissionEnded(m.status) },
];

export interface MissionsPageProps {
  /** The commander's missions, newest first. `undefined` while loading. */
  missions: Mission[] | undefined;
  loadFailed: boolean;
  onOpen: (missionId: string) => void;
}

/** The commander's missions (UC-C01 step 3, wireframe Cd02). Opening one shows its live map. */
export function MissionsPage({ missions, loadFailed, onOpen }: MissionsPageProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const all = useMemo(() => missions ?? [], [missions]);

  const visible = useMemo(() => {
    const matches = FILTERS.find((f) => f.id === filter)?.matches ?? (() => true);
    const text = query.trim().toLowerCase();
    return all.filter(
      (m) =>
        matches(m) &&
        (!text || [m.name, m.missingPerson.name ?? '', m.joinCode].some((v) => v.toLowerCase().includes(text))),
    );
  }, [all, filter, query]);

  return (
    <section className={styles.panel} aria-label="רשימת מסעות">
      <Tabs className={styles.tabsRoot} selectedKey={filter} onSelectionChange={(key: Key) => setFilter(key as Filter)}>
        <div className={styles.toolbar}>
          <h1 className={styles.title}>המסעות שלי</h1>
          <TabList className={styles.tabs} aria-label="סינון לפי מצב">
            {FILTERS.map((f) => (
              <Tab key={f.id} id={f.id} className={styles.tab}>
                {f.label} {all.filter(f.matches).length}
              </Tab>
            ))}
          </TabList>
          <SearchField className={styles.search} aria-label="חיפוש מסע" value={query} onChange={setQuery}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <Input placeholder="חפש לפי שם מסע, נעדר או קוד" />
          </SearchField>
        </div>

        <TabPanel id={filter} className={styles.body}>
          {missions === undefined ? (
            <p className={styles.empty}>{loadFailed ? 'לא ניתן לטעון מסעות מהשרת.' : 'טוען מסעות…'}</p>
          ) : visible.length === 0 ? (
            <p className={styles.empty}>
              {all.length === 0
                ? 'אין לך מסעות עדיין. בסביבת פיתוח: pnpm db:seed יוצר מסע לדוגמה.'
                : 'אין מסעות שמתאימים לסינון.'}
            </p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">מסע</th>
                  <th scope="col">נעדר</th>
                  <th scope="col">מצב</th>
                  <th scope="col">נפתח</th>
                  <th scope="col">קוד הצטרפות</th>
                  <th scope="col">
                    <span className={styles.hidden}>פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => {
                  const status = MISSION_STATUS_LABELS[m.status];
                  const person = [m.missingPerson.name, m.missingPerson.age].filter((v) => v !== null).join(', ');
                  return (
                    <tr key={m.id}>
                      <td className={styles.name}>{m.name}</td>
                      <td>{person || '—'}</td>
                      <td>
                        <span className={styles.status}>
                          <span className={styles.dot} data-tone={status.tone} aria-hidden="true" />
                          {status.label}
                        </span>
                      </td>
                      <td className={styles.muted}>{formatOpened(m.createdAt)}</td>
                      <td className={styles.code}>{m.joinCode}</td>
                      <td className={styles.action}>
                        <Button size="sm" aria-label={`פתח את ${m.name}`} onPress={() => onOpen(m.id)}>
                          פתח
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </TabPanel>
      </Tabs>
    </section>
  );
}
