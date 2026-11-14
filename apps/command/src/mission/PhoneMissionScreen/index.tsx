import { isCriticalReport, isMissionEnded } from '@trace/domain';
import type { Mission, MissionPolygon, Participant, Report } from '@trace/schemas';
import { useState, type ReactNode } from 'react';
import { Overlays } from './Overlays';
import { PhoneBar } from './PhoneBar';
import styles from './PhoneMissionScreen.module.css';
import type { Connection } from '../../components/ConnectionStatus';
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

          <Overlays
            mission={mission}
            critical={critical}
            reports={reports}
            notice={notice}
            joinOpen={joinOpen}
            onCloseJoin={() => onJoinOpenChange(false)}
            search={searchOpen ? renderSearch(() => setSearchOpen(false)) : null}
            onOpenReport={onOpenReport}
          />

          <PhoneBar
            mission={mission}
            missions={missions}
            connection={connection}
            onSelectMission={onSelectMission}
            onShowAll={onShowAll}
            joinOpen={joinOpen}
            searchOpen={searchOpen}
            onToggleJoin={() => {
              setSearchOpen(false);
              onJoinOpenChange(!joinOpen);
            }}
            onToggleSearch={() => {
              if (!searchOpen) onJoinOpenChange(false);
              setSearchOpen(!searchOpen);
            }}
          />
        </div>
      )}

      <MissionTabBar current={current} onNavigate={navigate} counts={{ reports: newReports }} />
    </div>
  );
}
