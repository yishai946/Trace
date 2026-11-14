import type { ThemeId } from '@trace/design';
import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import type { ReactNode } from 'react';
import type { Connection } from '../../components/ConnectionStatus';
import type { MapFocus } from '../../map/MissionMap';
import { PlaceSearch } from '../../map/PlaceSearch';
import { PhoneMissionScreen } from '../../mission/PhoneMissionScreen';
import { PhoneReportsPage } from '../../pages/PhoneReportsPage';
import type { ConsoleNav } from './useConsoleNav';
import type { ReportActions } from './useMissionActions';
import type { MissionData } from './useMissionData';

interface PhoneMissionProps {
  mission: Mission;
  missions: Mission[];
  data: MissionData;
  nav: ConsoleNav;
  connection: Connection;
  /** The map and what floats on it. */
  workspace: ReactNode;
  provider: MapProvider;
  themeId: ThemeId;
  reportActions: ReportActions;
  /** The commander searched for a place: the map moves there. */
  onPlaceFound: (focus: MapFocus) => void;
}

/** The open mission on a phone (wireframe Cm04): the map stage, or the Reports screen in its place. */
export function PhoneMission({
  mission,
  missions,
  data,
  nav,
  connection,
  workspace,
  provider,
  themeId,
  reportActions,
  onPlaceFound,
}: PhoneMissionProps) {
  const polygons = data.polygons.data ?? [];
  return (
    <PhoneMissionScreen
      key={mission.id}
      mission={mission}
      missions={missions}
      connection={connection}
      onSelectMission={nav.openMission}
      onShowAll={() => nav.openMission(null)}
      joinOpen={nav.panel === 'join'}
      onJoinOpenChange={(open) => nav.setPanelOpen('join', open)}
      notice={nav.createdNotice}
      participants={data.participants.data}
      participantsFailed={data.participants.isError}
      polygons={polygons}
      workspace={workspace}
      screen={nav.view === 'reports' ? 'reports' : 'map'}
      onScreenChange={nav.setView}
      reports={data.reports.data}
      reportsFailed={data.reports.isError}
      onOpenReport={nav.openReport}
      reportsScreen={
        <PhoneReportsPage
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
          connection={connection}
          selectedId={nav.selectedReportId}
          onSelect={nav.setSelectedReportId}
          {...reportActions}
        />
      }
      renderSearch={(close) => (
        <PlaceSearch
          provider={provider}
          fullWidth
          autoFocus
          onSelect={(place) => {
            onPlaceFound({ center: place.center, bounds: place.bounds });
            close();
          }}
        />
      )}
    />
  );
}
