import type { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import styles from './PhoneTabBar.module.css';
import { BoardIcon, MoreIcon, ReportsIcon, SearchersIcon } from '../icons';

export type PhoneView = 'board' | 'searchers' | 'reports' | 'more';

const ITEMS: { id: PhoneView; label: string; icon: ReactNode }[] = [
  { id: 'board', label: 'לוח', icon: <BoardIcon /> },
  { id: 'searchers', label: 'מחפשים', icon: <SearchersIcon /> },
  { id: 'reports', label: 'דיווחים', icon: <ReportsIcon /> },
  { id: 'more', label: 'עוד', icon: <MoreIcon /> },
];

/**
 * The tab bar at the bottom of the mission screen on the phone (wireframe Cm04). It moves between screens, so its
 * items are buttons with `aria-current`, not tabs. "הודעות" joins when the messages use case is built.
 */
export function PhoneTabBar({ view, onChange }: { view: PhoneView; onChange: (view: PhoneView) => void }) {
  return (
    <nav className={styles.bar} aria-label="ניווט ראשי">
      {ITEMS.map((item) => (
        <AriaButton
          key={item.id}
          className={styles.item}
          aria-current={view === item.id ? 'page' : undefined}
          onPress={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </AriaButton>
      ))}
    </nav>
  );
}
