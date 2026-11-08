import type { Mission, MissionPolygon, Participant } from '@trace/schemas';
import { useState, type ReactNode } from 'react';
import styles from './PhoneMissionScreen.module.css';
import { Button } from '../../components/Button';
import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import { MissionSwitcher } from '../../components/MissionSwitcher';
import { TraceMark } from '../../components/TraceMark';
import { JoinCodePanel } from '../JoinCodePanel';
import { MissionSheet, type SheetTab } from '../MissionSheet';
import { MissionTabBar, type MissionTab } from '../MissionTabBar';

interface PhoneMissionScreenProps {
  mission: Mission;
  missions: Mission[];
  connection: Connection;
  onSelectMission: (missionId: string) => void;
  onShowAll: () => void;
  joinOpen: boolean;
  onJoinOpenChange: (open: boolean) => void;
  notice: string | null;
  /** Undefined while they load. */
  participants: Participant[] | undefined;
  participantsFailed: boolean;
  polygons: MissionPolygon[];
  /** The map and what floats on it. */
  workspace: ReactNode;
  /** The place search, shown under the bar; `close` hides it. */
  renderSearch: (close: () => void) => ReactNode;
}

/** Icons from wireframe Cm04. */
const icon = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/**
 * Command on the phone, the mission screen (Console "Command בטלפון", wireframe Cm04): the map full screen, a compact
 * top bar, a bottom sheet with alerts, searchers and reports, and a bottom tab bar. Remount it per mission.
 */
export function PhoneMissionScreen({
  mission,
  missions,
  connection,
  onSelectMission,
  onShowAll,
  joinOpen,
  onJoinOpenChange,
  notice,
  participants,
  participantsFailed,
  polygons,
  workspace,
  renderSearch,
}: PhoneMissionScreenProps) {
  const [tab, setTab] = useState<SheetTab>('alerts');
  const [expanded, setExpanded] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const navigate = (next: MissionTab) => {
    setTab(next === 'board' ? 'alerts' : next);
    setExpanded(true);
  };

  return (
    <div className={styles.phone}>
      <div className={styles.stage} data-sheet={expanded ? 'expanded' : 'collapsed'}>
        {workspace}

        <MissionSheet
          tab={tab}
          onTabChange={setTab}
          expanded={expanded}
          onExpandedChange={setExpanded}
          participants={participants}
          participantsFailed={participantsFailed}
          polygons={polygons}
        />

        {(notice || joinOpen || searchOpen) && (
          <div className={styles.below}>
            {notice && (
              <p className={styles.notice} role="alert">
                {notice}
              </p>
            )}
            {joinOpen && <JoinCodePanel mission={mission} onClose={() => onJoinOpenChange(false)} />}
            {searchOpen && <div className={styles.search}>{renderSearch(() => setSearchOpen(false))}</div>}
          </div>
        )}

        <header className={styles.bar}>
          <span className={styles.brand}>
            <TraceMark size={18} />
          </span>
          <div className={styles.mission}>
            <MissionSwitcher mission={mission} missions={missions} onSelect={onSelectMission} onShowAll={onShowAll} />
          </div>
          <ConnectionStatus connection={connection} />
          <div className={styles.actions}>
            <Button
              variant="icon"
              aria-label={`קוד הצטרפות ${mission.joinCode}`}
              aria-expanded={joinOpen}
              onPress={() => {
                setSearchOpen(false);
                onJoinOpenChange(!joinOpen);
              }}
            >
              <svg {...icon}>
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4v-2M14 18h2" />
              </svg>
            </Button>
            <Button
              variant="icon"
              aria-label="חיפוש מקום"
              aria-expanded={searchOpen}
              onPress={() => {
                if (!searchOpen) onJoinOpenChange(false);
                setSearchOpen(!searchOpen);
              }}
            >
              <svg {...icon}>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
            </Button>
          </div>
        </header>
      </div>

      <MissionTabBar current={tab === 'alerts' ? 'board' : tab} onNavigate={navigate} />
    </div>
  );
}
