import type { ReactNode } from 'react';
import styles from './MissionLayout.module.css';
import { MissionNav, type MissionView } from '../MissionNav';

interface MissionLayoutProps {
  missionName: string;
  view: MissionView;
  onNavigate: (view: MissionView) => void;
  /** Numbers after the navigation labels, e.g. the New reports. */
  counts?: Partial<Record<MissionView, number>>;
  /** The join code panel, under the navigation, when open. */
  joinPanel: ReactNode;
  /** The searchers, Reports, Messages or Timeline page; nothing on the map view. */
  children?: ReactNode;
}

/**
 * The start-side navigation of a mission, and beside it the searchers, Reports, Messages or Timeline page. One element serves both views, so the
 * navigation is not remounted when the view changes and keyboard focus stays on the link that was activated.
 */
export function MissionLayout({ missionName, view, onNavigate, counts, joinPanel, children }: MissionLayoutProps) {
  return (
    <div className={view === 'map' ? styles.start : styles.page}>
      <div className={styles.startColumn}>
        <MissionNav missionName={missionName} view={view} onNavigate={onNavigate} counts={counts} />
        {joinPanel}
      </div>
      {children}
    </div>
  );
}
