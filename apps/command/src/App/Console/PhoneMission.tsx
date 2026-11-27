import type { ThemeId } from '@trace/design';
import { canEndMissionLocated } from '@trace/domain';
import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import type { ReactNode } from 'react';
import type { Connection } from '../../components/ConnectionStatus';
import type { MapFocus } from '../../map/MissionMap';
import { PlaceSearch } from '../../map/PlaceSearch';
import { outsideSearchers } from '../../mission/outsideSearchers';
import { PhoneMissionScreen } from '../../mission/PhoneMissionScreen';
import { phoneScreenOf } from '../../mission/phoneScreen';
import { PhoneMessagesPage } from '../../pages/PhoneMessagesPage';
import { PhoneReportsPage } from '../../pages/PhoneReportsPage';
import { SosPage } from '../../pages/SosPage';
import type { ConsoleNav } from './useConsoleNav';
import type { MessageSending, ReportActions, SosActions } from './useMissionActions';
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
  sosActions: SosActions;
  messageSending: MessageSending;
  /** The commander searched for a place: the map moves there. */
  onPlaceFound: (focus: MapFocus) => void;
}

/** The open mission on a phone (wireframe Cm04): the map stage with the mission control over it (Cm13), or the Reports, Messages or SOS screen in its place. */
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
  sosActions,
  messageSending,
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
      screen={phoneScreenOf(nav.view)}
      onScreenChange={nav.setView}
      reports={data.reports.data}
      reportsFailed={data.reports.isError}
      onOpenReport={nav.openReport}
      sos={data.sos.data}
      sosFailed={data.sos.isError}
      onRetrySos={() => void data.sos.refetch()}
      onOpenSos={nav.openSos}
      outside={outsideSearchers(data.timeline.data ?? [], data.participants.data ?? [])}
      onOpenSearcher={nav.setSelectedSearcherId}
      control={{
        open: nav.panel === 'control',
        onOpenChange: (open) => (open ? nav.openControl() : nav.setPanelOpen('control', false)),
        canEnd: canEndMissionLocated(mission.status),
      }}
      sosScreen={
        <SosPage
          phone
          sos={data.sos.data}
          loadFailed={data.sos.isError}
          onRetry={() => void data.sos.refetch()}
          participants={data.participants.data ?? []}
          {...sosActions}
        />
      }
      messagesScreen={
        <PhoneMessagesPage
          key={mission.id}
          messages={data.messages.data}
          loadFailed={data.messages.isError}
          onRetry={() => void data.messages.refetch()}
          participants={data.participants.data}
          participantsFailed={data.participants.isError}
          polygons={polygons}
          connection={connection}
          {...messageSending}
        />
      }
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
