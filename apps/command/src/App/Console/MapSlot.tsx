import type { ThemeId } from '@trace/design';
import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import styles from '../App.module.css';
import type { MapFocus } from '../../map/MissionMap';
import { FloatingAlerts } from '../../mission/FloatingAlerts';
import { outsideSearchers } from '../../mission/outsideSearchers';
import { MissionWorkspace } from '../MissionWorkspace';
import type { ConsoleNav } from './useConsoleNav';
import type { MissionData } from './useMissionData';

interface MapSlotProps {
  mission: Mission;
  data: MissionData;
  nav: ConsoleNav;
  provider: MapProvider;
  themeId: ThemeId;
  focus: MapFocus | null;
  onPlaceFound: (focus: MapFocus) => void;
  /** New operational actions are allowed: there is a connection and the mission is live. */
  operational: boolean;
  /** The floating critical alerts; the phone shows its own under the top bar. */
  alertOnMap: boolean;
}

/** The open mission's map, once its polygons are loaded: the map opens on them, so it waits for them. */
export function MapSlot({
  mission,
  data,
  nav,
  provider,
  themeId,
  focus,
  onPlaceFound,
  operational,
  alertOnMap,
}: MapSlotProps) {
  const { sightings, lkps } = data;
  if (data.polygons.isPending) return <p className={styles.setup}>טוען מסע…</p>;
  return (
    <MissionWorkspace
      key={mission.id}
      provider={provider}
      focus={focus}
      mission={mission}
      polygons={data.polygons.data ?? []}
      participants={data.participants.data ?? []}
      sightings={sightings.data}
      lkps={lkps.data}
      reports={data.reports.data ?? []}
      sos={data.sos.data ?? []}
      onOpenReport={nav.openReport}
      selectedSearcherId={nav.selectedSearcherId}
      onSelectSearcher={nav.setSelectedSearcherId}
      alerts={
        alertOnMap && (
          <FloatingAlerts
            reports={data.reports.data ?? []}
            sos={data.sos.data ?? []}
            sosFailed={data.sos.isError}
            onRetrySos={() => void data.sos.refetch()}
            outside={outsideSearchers(data.timeline.data ?? [], data.participants.data ?? [])}
            onOpenSearcher={nav.setSelectedSearcherId}
            onOpenReport={nav.openReport}
            onOpenSos={nav.openSos}
          />
        )
      }
      sightingsLoading={sightings.isPending || lkps.isPending}
      sightingsFailed={sightings.isError || lkps.isError}
      onRetrySightings={() => {
        void sightings.refetch();
        void lkps.refetch();
      }}
      themeId={themeId}
      online={operational}
      rallyOpen={nav.panel === 'rally'}
      onRallyClose={() => nav.setPanelOpen('rally', false)}
      controlOpen={nav.panel === 'control'}
      onControlClose={() => nav.setPanelOpen('control', false)}
      onPlaceFound={onPlaceFound}
    />
  );
}
