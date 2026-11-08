import { isMissionEnded } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Button as AriaButton,
  Input,
  SearchField,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type Key,
} from 'react-aria-components';
import styles from './MissionsPage.module.css';
import { MISSION_STATUS_LABELS, formatOpened } from '../../mission/missionStatus';
import { Button } from '../../components/Button';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';

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
  /** Opens the new-mission screen (UC-C02). */
  onNew: () => void;
  /** Without a connection, new missions cannot be created (UC-C01). */
  canCreate: boolean;
  /** The end of the phone top bar: the connection light and the avatar. Ignored on the desktop. */
  phoneBar?: ReactNode;
}

/** The commander's missions (UC-C01 step 3, wireframes Cd02 and, on the phone, Cm02). Opening one shows its live map. */
export function MissionsPage({ missions, loadFailed, onOpen, onNew, canCreate, phoneBar }: MissionsPageProps) {
  const phone = usePhoneLayout();
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

  const tabs = (
    <TabList className={phone ? `${styles.tabs} ${styles.phoneTabs}` : styles.tabs} aria-label="סינון לפי מצב">
      {FILTERS.map((f) => (
        <Tab key={f.id} id={f.id} className={phone ? `${styles.tab} ${styles.phoneTab}` : styles.tab}>
          {f.label} {all.filter(f.matches).length}
        </Tab>
      ))}
    </TabList>
  );
  const search = (
    <SearchField
      className={phone ? `${styles.search} ${styles.phoneSearch}` : styles.search}
      aria-label="חיפוש מסע"
      value={query}
      onChange={setQuery}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <Input placeholder="חיפוש לפי מסע, נעדר או קוד" />
    </SearchField>
  );
  const notice =
    missions === undefined ? (
      <p className={styles.empty}>{loadFailed ? 'לא ניתן לטעון מסעות מהשרת.' : 'טוען מסעות…'}</p>
    ) : visible.length === 0 ? (
      <p className={styles.empty}>
        {all.length === 0 ? 'אין לך מסעות עדיין. "מסע חדש" פותח מסע חיפוש.' : 'אין מסעות שמתאימים לסינון.'}
      </p>
    ) : null;

  if (phone) {
    return (
      <section className={styles.phonePanel} aria-label="רשימת מסעות">
        <header className={styles.bar}>
          <h1 className={styles.barTitle}>המסעות שלי</h1>
          <div className={styles.barEnd}>{phoneBar}</div>
        </header>
        <Tabs
          className={styles.tabsRoot}
          selectedKey={filter}
          onSelectionChange={(key: Key) => setFilter(key as Filter)}
        >
          <div className={styles.controls}>
            <Button variant="primary" size="lg" className={styles.newMission} onPress={onNew} isDisabled={!canCreate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              מסע חדש
            </Button>
            {search}
            {tabs}
          </div>
          <TabPanel id={filter} className={styles.phoneBody}>
            {notice ?? (
              <ul className={styles.cards}>
                {visible.map((m) => {
                  const status = MISSION_STATUS_LABELS[m.status];
                  const person = [m.missingPerson.name, m.missingPerson.age].filter((v) => v !== null).join(', ');
                  return (
                    <li key={m.id}>
                      <AriaButton className={styles.card} onPress={() => onOpen(m.id)}>
                        <span className={styles.cardHead}>
                          <span className={styles.cardTitle}>{m.name}</span>
                          <span className={styles.badge}>
                            <span className={styles.dot} data-tone={status.tone} aria-hidden="true" />
                            {status.label}
                          </span>
                        </span>
                        <span className={styles.cardPerson}>{person || '—'}</span>
                        <span className={styles.cardMeta}>
                          {`נפתח ${formatOpened(m.createdAt)}`}
                          {isMissionEnded(m.status) && ', קריאה בלבד'}
                        </span>
                      </AriaButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabPanel>
        </Tabs>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="רשימת מסעות">
      <Tabs className={styles.tabsRoot} selectedKey={filter} onSelectionChange={(key: Key) => setFilter(key as Filter)}>
        <div className={styles.toolbar}>
          <h1 className={styles.title}>המסעות שלי</h1>
          {tabs}
          {search}
          <Button variant="primary" onPress={onNew} isDisabled={!canCreate}>
            מסע חדש
          </Button>
        </div>

        <TabPanel id={filter} className={styles.body}>
          {notice ?? (
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
                    // The whole row opens the mission; the "פתח" button is the keyboard and screen reader path.
                    <tr key={m.id} className={styles.row} onClick={() => onOpen(m.id)}>
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
