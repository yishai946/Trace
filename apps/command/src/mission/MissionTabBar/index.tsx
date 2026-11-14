import type { ReactNode } from 'react';
import { Link } from 'react-aria-components';
import styles from './MissionTabBar.module.css';

export type MissionTab = 'board' | 'searchers' | 'reports';

interface MissionTabBarProps {
  current: MissionTab;
  onNavigate: (tab: MissionTab) => void;
  /** The count on an item: New reports on "דיווחים". Nothing shows for 0. */
  counts?: Partial<Record<MissionTab, number>>;
}

/** Icons from wireframe Cm04: 24 viewBox, 1.8 stroke, shown at 20px. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
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
];

/** The bottom tab bar of the phone mission screen (Console "Command בטלפון", wireframe Cm04). */
export function MissionTabBar({ current, onNavigate, counts }: MissionTabBarProps) {
  return (
    <nav className={styles.bar} aria-label="ניווט ראשי">
      {ITEMS.map(({ tab, label, icon }) => {
        const count = counts?.[tab] ?? 0;
        return (
          <Link
            key={tab}
            className={styles.item}
            aria-label={count > 0 ? `${label}, ${count} חדשים` : undefined}
            aria-current={current === tab ? 'page' : undefined}
            onPress={() => onNavigate(tab)}
          >
            {icon}
            {label}
            {count > 0 && (
              <span className={styles.count} aria-hidden="true">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
