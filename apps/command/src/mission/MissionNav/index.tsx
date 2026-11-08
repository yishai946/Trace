import { Link } from 'react-aria-components';
import styles from './MissionNav.module.css';

export type MissionView = 'map' | 'timeline';

interface MissionNavProps {
  missionName: string;
  view: MissionView;
  onNavigate: (view: MissionView) => void;
}

/** Icons of Trace Wireframes Cd14: 16px line icons in `currentColor`. */
const icons: Record<MissionView, React.ReactNode> = {
  map: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  timeline: (
    <>
      <path d="M12 3v18" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="12" cy="16" r="2" />
    </>
  ),
};

const items: { view: MissionView; label: string }[] = [
  { view: 'map', label: 'לוח מבצעי' },
  { view: 'timeline', label: 'ציר זמן' },
];

/** Mission navigation (Trace Wireframes Cd14 `tcx-nav`): the live map and the Timeline. More screens join as they are built. */
export function MissionNav({ missionName, view, onNavigate }: MissionNavProps) {
  return (
    <nav aria-label="ניווט מסע" className={styles.nav}>
      <div className={styles.label}>{missionName}</div>
      {items.map((item) => (
        <Link
          key={item.view}
          className={styles.item}
          aria-current={item.view === view ? 'page' : undefined}
          onPress={() => onNavigate(item.view)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {icons[item.view]}
          </svg>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
