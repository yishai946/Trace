import type { ThemeId } from '@trace/design';
import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import { JoinCodePanel } from '../../mission/JoinCodePanel';
import { MissionLayout } from '../../mission/MissionLayout';
import { MessagesPage } from '../../pages/MessagesPage';
import { ReportsPage } from '../../pages/ReportsPage';
import { SearchersPage } from '../../pages/SearchersPage';
import { TimelinePage } from '../../pages/TimelinePage';
import type { ConsoleNav } from './useConsoleNav';
import type { MessageSending, ReportActions, SearcherActions } from './useMissionActions';
import type { MissionData } from './useMissionData';

interface MissionPagesProps {
  mission: Mission;
  data: MissionData;
  nav: ConsoleNav;
  provider: MapProvider;
  themeId: ThemeId;
  reportActions: ReportActions;
  searcherActions: SearcherActions;
  messageSending: MessageSending;
}

/** The mission's navigation and, beside it, the page of the open view. The map view has no page: the map shows. */
export function MissionPages({
  mission,
  data,
  nav,
  provider,
  themeId,
  reportActions,
  searcherActions,
  messageSending,
}: MissionPagesProps) {
  const { view } = nav;
  const polygons = data.polygons.data ?? [];
  return (
    <MissionLayout
      missionName={mission.name}
      view={view}
      onNavigate={nav.setView}
      counts={{ reports: data.reports.data?.filter((r) => r.status === 'new').length ?? 0 }}
      joinPanel={
        nav.panel === 'join' && <JoinCodePanel mission={mission} onClose={() => nav.setPanelOpen('join', false)} />
      }
    >
      {view === 'searchers' && (
        <SearchersPage
          participants={data.participants.data}
          polygons={polygons}
          loadFailed={data.participants.isError}
          onRetry={() => void data.participants.refetch()}
          {...searcherActions}
        />
      )}
      {view === 'reports' && (
        <ReportsPage
          key={mission.id}
          reports={data.reports.data}
          loadFailed={data.reports.isError}
          onRetry={() => void data.reports.refetch()}
          mission={mission}
          polygons={polygons}
          participants={data.participants.data ?? []}
          sightings={data.sightings.data}
          lkps={data.lkps.data}
          provider={provider}
          themeId={themeId}
          selectedId={nav.selectedReportId}
          onSelect={nav.setSelectedReportId}
          {...reportActions}
        />
      )}
      {view === 'messages' && (
        <MessagesPage
          key={mission.id}
          messages={data.messages.data}
          loadFailed={data.messages.isError}
          onRetry={() => void data.messages.refetch()}
          participants={data.participants.data}
          participantsFailed={data.participants.isError}
          polygons={polygons}
          {...messageSending}
        />
      )}
      {view === 'timeline' && (
        <TimelinePage
          events={data.timeline.data}
          loadFailed={data.timeline.isError}
          onRetry={() => void data.timeline.refetch()}
          onGoToMap={() => nav.setView('map')}
        />
      )}
    </MissionLayout>
  );
}
