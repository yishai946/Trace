import type { ThemeId } from '@trace/design';
import type { MapProvider } from '@trace/map';
import type { LkpPoint, Mission, MissionPolygon, Participant, Report, Sighting, Sos } from '@trace/schemas';
import { isMissionEnded } from '@trace/domain';
import type { ReactNode } from 'react';
import { MissionMap, type MapFocus } from '../../map/MissionMap';
import { usePolygonEdit } from './usePolygonEdit';
import { RallyPointSlot } from './RallyPointSlot';
import { MissionControlSlot } from './MissionControlSlot';
import { SearcherSlot } from './SearcherSlot';
import { useSlotSelection } from './useSlotSelection';
import { useEndLocated } from './useEndLocated';
import { useMapClick } from './useMapClick';
import { useRallyPointEdit } from './useRallyPointEdit';
import { useSearcherPanel } from './useSearcherPanel';
import { useSightingPanel } from './useSightingPanel';
import { useWorkspaceAccess } from './useWorkspaceAccess';
import { useWorkspaceMapData } from './useWorkspaceMapData';
import { WorkspacePanels } from './WorkspacePanels';

interface MissionWorkspaceProps {
  provider: MapProvider;
  focus: MapFocus | null;
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  /** Undefined until loaded; the panel shows loading or the failure. */
  sightings: Sighting[] | undefined;
  /** The LKP history, newest first. */
  lkps: LkpPoint[] | undefined;
  /** Newest first. */
  reports: Report[];
  /** The mission's SOS, newest first. */
  sos: Sos[];
  /** Opens a report in the Reports page or screen. */
  onOpenReport: (id: string) => void;
  /** The searcher whose panel is open (UC-C10), or null; a click on a searcher symbol selects one. */
  selectedSearcherId: string | null;
  onSelectSearcher: (id: string | null) => void;
  /** The alerts floating over the map; the phone shows its own under the top bar. */
  alerts: ReactNode;
  /** The summary of an ended mission (Cd15); it shows while no other panel is open. */
  summary?: ReactNode;
  sightingsLoading: boolean;
  sightingsFailed: boolean;
  onRetrySightings: () => void;
  themeId: ThemeId;
  /** Without a connection, new operational actions are blocked (UC-C01). */
  online: boolean;
  /** The rally point panel is open. */
  rallyOpen: boolean;
  onRallyClose: () => void;
  /** The mission control panel is open (UC-C16). */
  controlOpen: boolean;
  onControlClose: () => void;
  /** The commander searched for a place for the rally point: the map moves there. */
  onPlaceFound: (focus: MapFocus) => void;
}

/** The live map of one mission: polygons from the server, drawing, the panels that float on it and boundary editing. */
export function MissionWorkspace({
  provider,
  focus,
  mission,
  polygons,
  participants,
  sightings,
  lkps,
  reports,
  sos,
  onOpenReport,
  selectedSearcherId,
  onSelectSearcher,
  alerts,
  summary,
  sightingsLoading,
  sightingsFailed,
  onRetrySightings,
  themeId,
  online,
  rallyOpen,
  onRallyClose,
  controlOpen,
  onControlClose,
  onPlaceFound,
}: MissionWorkspaceProps) {
  const polygon = usePolygonEdit({ missionId: mission.id, polygons, participants });
  const sighting = useSightingPanel(mission.id);
  const rally = useRallyPointEdit(mission, online);
  const control = useEndLocated(mission, online);
  const searcherPanel = useSearcherPanel({
    missionId: mission.id,
    searcherId: selectedSearcherId,
    participants,
    polygons,
    missionEnded: isMissionEnded(mission.status),
  });
  const map = useWorkspaceMapData({
    mission,
    polygons,
    participants,
    sightings,
    lkps,
    reports,
    sos,
    selectedPolygonId: polygon.selectedId,
    editingPolygonId: polygon.editing?.polygonId ?? null,
    draftPosition: sighting.draftPosition ?? (controlOpen ? control.point : null),
    route: searcherPanel.route,
  });

  const { selectPolygon, toggleAddSighting, selectPoint } = useSlotSelection({
    polygon,
    sighting,
    onOpenReport,
    onSelectSearcher,
  });
  const onMapClick = useMapClick({ rally, control, sighting, rallyOpen, controlOpen });
  const access = useWorkspaceAccess(mission.status, online, polygon, sighting);

  return (
    <>
      <MissionMap
        provider={provider}
        themeId={themeId}
        data={map.data}
        initialView={map.initialView}
        focus={focus}
        onMapClick={onMapClick}
        onPolygonDrawn={access.canEditPolygons ? polygon.create : undefined}
        onPolygonSelect={selectPolygon}
        onPointSelect={selectPoint}
        onSighting={access.canToggleSighting ? toggleAddSighting : undefined}
        sightingActive={!!sighting.adding}
        editing={polygon.editing}
        onEditChange={polygon.changeBoundary}
      />

      {alerts}

      {rallyOpen && (
        <RallyPointSlot
          mission={mission}
          provider={provider}
          rally={rally}
          onPlaceFound={onPlaceFound}
          onClose={onRallyClose}
        />
      )}

      {controlOpen && (
        <MissionControlSlot
          mission={mission}
          provider={provider}
          control={control}
          onPlaceFound={onPlaceFound}
          onClose={onControlClose}
        />
      )}

      <SearcherSlot
        panel={searcherPanel}
        taken={!!polygon.selected || !!polygon.edit}
        onClose={() => onSelectSearcher(null)}
      />

      <WorkspacePanels
        summary={summary}
        searcherOpen={!!searcherPanel.searcher}
        mission={mission}
        participants={participants}
        polygon={polygon}
        sighting={sighting}
        sightings={sightings}
        lkps={lkps}
        sightingsLoading={sightingsLoading}
        sightingsFailed={sightingsFailed}
        onRetrySightings={onRetrySightings}
        canEditPolygons={access.canEditPolygons}
        canChangeSightings={access.canChangeSightings}
        offline={!online}
        onClosePolygon={() => selectPolygon(null)}
        onToggleAddSighting={toggleAddSighting}
      />
    </>
  );
}
