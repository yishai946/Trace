import type { Mission, MissionPolygon, Participant, Report, Sos } from '@trace/schemas';
import type { ReactNode } from 'react';
import { Overlays } from './Overlays';
import { PhoneBar } from './PhoneBar';
import { phoneAlerts } from './phoneAlerts';
import styles from './PhoneMissionScreen.module.css';
import type { Connection } from '../../components/ConnectionStatus';
import { MissionSheet } from '../MissionSheet';
import { useOpenWarnings } from '../SafetyAlert/useOpenWarnings';
import type { OutsideSearcher } from '../outsideSearchers';
import type { SafetyWarning } from '../safetyWarnings';
import { SosStrip } from './SosStrip';
import { useBarToggles, type PhoneControl } from './useBarToggles';
import { useSheetTabs } from './useSheetTabs';
import { MissionTabBar } from '../MissionTabBar';
import type { PhoneScreen } from '../phoneScreen';

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
  /** The map stage, or the Reports, Messages or SOS screen in its place. */
  screen: PhoneScreen;
  onScreenChange: (screen: PhoneScreen) => void;
  reportsScreen: ReactNode;
  messagesScreen: ReactNode;
  sosScreen: ReactNode;
  /** The mission's SOS, newest first. Undefined while they load. */
  sos: Sos[] | undefined;
  /** The SOS could not be loaded: the alert says the state is unknown. */
  sosFailed: boolean;
  onRetrySos: () => void;
  onOpenSos: () => void;
  /** Newest first. Undefined while they load. */
  reports: Report[] | undefined;
  reportsFailed: boolean;
  onOpenReport: (id: string) => void;
  /** Searchers outside their polygon now (UC-S04), outside the longest first. */
  outside?: OutsideSearcher[];
  onOpenSearcher?: (participantId: string) => void;
  /** The safety and Coverage warnings that hold now (UC-S04), most urgent first. */
  warnings?: SafetyWarning[];
  /** The mission control (wireframe Cm13), opened from the bar; it floats over the map and shares it with the join code and the search. */
  control?: PhoneControl;
}

/**
 * Command on the phone, the mission screen (Console "Command בטלפון", wireframe Cm04): the map full screen, a compact
 * top bar, a bottom sheet with alerts, searchers and reports, and a bottom tab bar. The "דיווחים" item replaces the map
 * with the Reports screen (wireframe Cm10), the "הודעות" item with the Messages screen (Cm11), and the "SOS" item with
 * the SOS screen (Cm12). Remount it per mission.
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
  messagesScreen,
  sosScreen,
  sos,
  sosFailed,
  onRetrySos,
  onOpenSos,
  reports,
  reportsFailed,
  onOpenReport,
  outside = [],
  onOpenSearcher,
  warnings = [],
  control,
}: PhoneMissionScreenProps) {
  const { tab, setTab, expanded, setExpanded, navigate, current } = useSheetTabs(screen, onScreenChange);
  const openWarnings = useOpenWarnings(warnings);
  const bar = useBarToggles(joinOpen, onJoinOpenChange, control);
  const {
    critical,
    activeSos,
    newReports,
    count: alerts,
  } = phoneAlerts({ mission, reports, sos, sosFailed, warnings: openWarnings });

  return (
    <div className={styles.phone}>
      {screen === 'map' ? (
        <div
          className={styles.stage}
          data-sheet={expanded ? 'expanded' : 'collapsed'}
          data-alerts={alerts || undefined}
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
            outside={outside}
          />

          <Overlays
            mission={mission}
            critical={critical}
            sos={sos}
            sosFailed={sosFailed}
            onRetrySos={onRetrySos}
            reports={reports}
            notice={notice}
            joinOpen={joinOpen}
            onCloseJoin={() => onJoinOpenChange(false)}
            search={bar.searchOpen ? renderSearch(bar.closeSearch) : null}
            onOpenReport={onOpenReport}
            onOpenSos={onOpenSos}
            warnings={warnings}
            onOpenSearcher={(id) => onOpenSearcher?.(id)}
            onFinish={control?.canEnd ? () => control.onOpenChange(true) : undefined}
          />

          <PhoneBar
            mission={mission}
            missions={missions}
            connection={connection}
            onSelectMission={onSelectMission}
            onShowAll={onShowAll}
            joinOpen={joinOpen}
            searchOpen={bar.searchOpen}
            onToggleJoin={bar.toggleJoin}
            onToggleSearch={bar.toggleSearch}
            control={bar.control}
          />
        </div>
      ) : (
        <>
          <SosStrip
            screen={screen}
            sos={sos}
            failed={sosFailed}
            onRetry={onRetrySos}
            onOpen={() => onScreenChange('sos')}
          />
          {{ reports: reportsScreen, messages: messagesScreen, sos: sosScreen }[screen]}
        </>
      )}

      <MissionTabBar
        current={current}
        onNavigate={navigate}
        counts={{ reports: newReports, sos: sosFailed ? null : activeSos }}
      />
    </div>
  );
}
