import { isCriticalReport, isMissionEnded } from '@trace/domain';
import type { Mission, MissionPolygon, Participant, Report } from '@trace/schemas';
import { useState, type ReactNode } from 'react';
import styles from './PhoneMissionScreen.module.css';
import { Button } from '../../components/Button';
import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import { MissionSwitcher } from '../../components/MissionSwitcher';
import { TraceMark } from '../../components/TraceMark';
import { CriticalReportAlert } from '../CriticalReportAlert';
import { JoinCodePanel } from '../JoinCodePanel';
import { MissionSheet, type SheetTab } from '../MissionSheet';
import { MissionTabBar, type MissionTab } from '../MissionTabBar';
import { statusCounts } from '../reportView';

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
  /** The map stage, or the Reports screen in its place. */
  screen: 'map' | 'reports';
  onScreenChange: (screen: 'map' | 'reports') => void;
  reportsScreen: ReactNode;
  /** Newest first. Undefined while they load. */
  reports: Report[] | undefined;
  reportsFailed: boolean;
  onOpenReport: (id: string) => void;
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
 * top bar, a bottom sheet with alerts, searchers and reports, and a bottom tab bar. The "דיווחים" item replaces the map
 * with the Reports screen (wireframe Cm10). Remount it per mission.
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
  screen,
  onScreenChange,
  reportsScreen,
  reports,
  reportsFailed,
  onOpenReport,
}: PhoneMissionScreenProps) {
  const [tab, setTab] = useState<SheetTab>('alerts');
  const [expanded, setExpanded] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const navigate = (next: MissionTab) => {
    if (next === 'reports') {
      onScreenChange('reports');
      return;
    }
    setTab(next === 'board' ? 'alerts' : next);
    setExpanded(true);
    onScreenChange('map');
  };
  // The sheet's own reports tab lists them in the sheet, so it keeps "לוח" marked.
  const current: MissionTab = screen === 'reports' ? 'reports' : tab === 'searchers' ? 'searchers' : 'board';
  const newReports = reports ? statusCounts(reports).new : 0;
  // An ended mission is read-only: the alert would lead to a report that cannot be handled.
  const critical = !isMissionEnded(mission.status) && (reports ?? []).some(isCriticalReport);

  return (
    <div className={styles.phone}>
      {screen === 'reports' ? (
        reportsScreen
      ) : (
        <div
          className={styles.stage}
          data-sheet={expanded ? 'expanded' : 'collapsed'}
          data-alert={critical || undefined}
        >
          {workspace}

          <MissionSheet
            tab={tab}
            onTabChange={setTab}
            expanded={expanded}
            onExpandedChange={setExpanded}
            participants={participants}
            participantsFailed={participantsFailed}
            polygons={polygons}
            reports={reports}
            reportsFailed={reportsFailed}
            onOpenReport={onOpenReport}
          />

          {(critical || notice || joinOpen || searchOpen) && (
            <div className={styles.below}>
              <CriticalReportAlert compact reports={reports ?? []} onOpen={onOpenReport} />
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
      )}

      <MissionTabBar current={current} onNavigate={navigate} counts={{ reports: newReports }} />
    </div>
  );
}
