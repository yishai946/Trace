import type { ThemeId } from '@trace/design';
import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import { JoinCodePanel } from '../../mission/JoinCodePanel';
import { MissionLayout } from '../../mission/MissionLayout';
import { MessagesPage } from '../../pages/MessagesPage';
import { ReportsPage } from '../../pages/ReportsPage';
import { SearchersByPolygon } from '../../mission/SearchersByPolygon';
import { SearchersPage } from '../../pages/SearchersPage';
import { SosPage } from '../../pages/SosPage';
import { TimelinePage } from '../../pages/TimelinePage';
import { PageSosAlert } from './PageSosAlert';
import type { ConsoleNav } from './useConsoleNav';
import type { MessageSending, ReportActions, SearcherActions, SosActions } from './useMissionActions';
import type { MissionData } from './useMissionData';

interface MissionPagesProps {
  mission: Mission;
  data: MissionData;
  nav: ConsoleNav;
  provider: MapProvider;
  themeId: ThemeId;
  reportActions: ReportActions;
  sosActions: SosActions;
  searcherActions: SearcherActions;
  messageSending: MessageSending;
}

/** The number on the SOS item: the active ones, or null (shown as "?") when the SOS could not be loaded. */
const sosCount = (sos: MissionData['sos']) =>
  sos.isError ? null : (sos.data?.filter((s) => s.status === 'active').length ?? 0);

/** The searchers whose SOS is active. */
const activeSosParticipantIds = (sos: MissionData['sos']['data']) =>
  sos?.filter((s) => s.status === 'active').map((s) => s.sender.participantId) ?? [];

/** The mission's navigation and, beside it, the page of the open view. The map view has no page: the map shows. */
export function MissionPages({
  mission,
  data,
  nav,
  provider,
  themeId,
  reportActions,
  sosActions,
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
      counts={{
        reports: data.reports.data?.filter((r) => r.status === 'new').length ?? 0,
        sos: sosCount(data.sos),
      }}
      alert={<PageSosAlert view={view} sos={data.sos} onOpenSos={nav.openSos} />}
      sidePanel={
        <SearchersByPolygon
          participants={data.participants.data}
          polygons={polygons}
          loadFailed={data.participants.isError}
          onRetry={() => void data.participants.refetch()}
          activeSosParticipantIds={activeSosParticipantIds(data.sos.data)}
          onOpen={nav.openSearcher}
        />
      }
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
          onOpen={nav.openSearcher}
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
      {view === 'sos' && (
        <SosPage
          sos={data.sos.data}
          loadFailed={data.sos.isError}
          onRetry={() => void data.sos.refetch()}
          participants={data.participants.data ?? []}
          {...sosActions}
        />
      )}
      {view === 'timeline' && (
        <TimelinePage
          events={data.timeline.data}
          loadFailed={data.timeline.isError}
          onRetry={() => void data.timeline.refetch()}
          onGoToMap={() => nav.setView('map')}
          sos={data.sos.data}
        />
      )}
    </MissionLayout>
  );
}
