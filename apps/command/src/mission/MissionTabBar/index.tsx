import type { ReactNode } from 'react';
import { Link } from 'react-aria-components';
import styles from './MissionTabBar.module.css';
import { Icon } from './Icon';

export type MissionTab = 'board' | 'searchers' | 'reports' | 'messages' | 'sos';

interface MissionTabBarProps {
  current: MissionTab;
  onNavigate: (tab: MissionTab) => void;
  /** The count on an item: New reports on "דיווחים", active SOS on "SOS". Nothing shows for 0; null is "not known" and shows "?". */
  counts?: Partial<Record<MissionTab, number | null>>;
}

const ITEMS: { tab: MissionTab; label: string; icon: ReactNode }[] = [
  {
    tab: 'board',
    label: 'לוח',
    icon: (
      <Icon>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
      </Icon>
    ),
  },
  {
    tab: 'searchers',
    label: 'מחפשים',
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14a6 6 0 0 1 3.5 6" />
      </Icon>
    ),
  },
  {
    tab: 'reports',
    label: 'דיווחים',
    icon: (
      <Icon>
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </Icon>
    ),
  },
  {
    tab: 'messages',
    label: 'הודעות',
    icon: (
      <Icon>
        <path d="M4 5h16v11H9l-5 4z" />
      </Icon>
    ),
  },
  {
    tab: 'sos',
    label: 'SOS',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16h.01" />
      </Icon>
    ),
  },
];

/** What the number on an item counts, for screen readers. */
const COUNT_NOUN: Partial<Record<MissionTab, string>> = { sos: 'פעילות' };

/** The bottom tab bar of the phone mission screen (Console "Command בטלפון", wireframes Cm04 and Cm11): board, searchers, reports, messages and SOS. */
export function MissionTabBar({ current, onNavigate, counts }: MissionTabBarProps) {
  return (
    <nav className={styles.bar} aria-label="ניווט ראשי">
      {ITEMS.map(({ tab, label, icon }) => {
        const raw = counts?.[tab];
        const unknown = raw === null;
        const count = raw ?? 0;
        return (
          <Link
            key={tab}
            className={styles.item}
            aria-label={
              unknown
                ? `${label}, המצב לא ידוע`
                : count > 0
                  ? `${label}, ${count} ${COUNT_NOUN[tab] ?? 'חדשים'}`
                  : undefined
            }
            aria-current={current === tab ? 'page' : undefined}
            onPress={() => onNavigate(tab)}
          >
            {icon}
            {label}
            {(unknown || count > 0) && (
              <span className={styles.count} data-danger={tab === 'sos' || undefined} aria-hidden="true">
                {unknown ? '?' : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
