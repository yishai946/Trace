import { Link } from 'react-aria-components';
import styles from './MissionNav.module.css';

export type MissionView = 'map' | 'searchers' | 'messages' | 'timeline';

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
  searchers: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" />
    </>
  ),
  messages: <path d="M4 5h16v11H9l-5 4z" />,
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
  { view: 'searchers', label: 'מחפשים' },
  { view: 'messages', label: 'הודעות' },
  { view: 'timeline', label: 'ציר זמן' },
];

/** Mission navigation (Trace Wireframes Cd14 `tcx-nav`): the live map, the searcher pool, messages and the Timeline. More screens join as they are built. */
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
