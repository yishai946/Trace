import type { ThemeId } from '@trace/design';
import { canChangeLkp, canChangePolygons } from '@trace/domain';
import type { MapProvider } from '@trace/map';
import type { LkpPoint, Mission, MissionPolygon, Participant, Report, Sighting, Sos } from '@trace/schemas';
import type { ReactNode } from 'react';
import styles from '../App.module.css';
import { MissionMap, type MapFocus } from '../../map/MissionMap';
import { RallyPointPanel } from '../../mission/RallyPointPanel';
import { usePolygonEdit } from './usePolygonEdit';
import { SearcherSlot } from './SearcherSlot';
import { useSlotSelection } from './useSlotSelection';
import { useRallyPointEdit } from './useRallyPointEdit';
import { useSearcherPanel } from './useSearcherPanel';
import { useSightingPanel } from './useSightingPanel';
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
  sightingsLoading: boolean;
  sightingsFailed: boolean;
  onRetrySightings: () => void;
  themeId: ThemeId;
  /** Without a connection, new operational actions are blocked (UC-C01). */
  online: boolean;
  /** The rally point panel is open. */
  rallyOpen: boolean;
  onRallyClose: () => void;
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
  sightingsLoading,
  sightingsFailed,
  onRetrySightings,
  themeId,
  online,
  rallyOpen,
  onRallyClose,
  onPlaceFound,
}: MissionWorkspaceProps) {
  const polygon = usePolygonEdit({ missionId: mission.id, polygons, participants });
  const sighting = useSightingPanel(mission.id);
  const rally = useRallyPointEdit(mission, online);
  const canEditPolygons = canChangePolygons(mission.status) && online;
  const canChangeSightings = canChangeLkp(mission.status) && online;
  const searcherPanel = useSearcherPanel({
    missionId: mission.id,
    searcherId: selectedSearcherId,
    participants,
    polygons,
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
    draftPosition: sighting.draftPosition,
    route: searcherPanel.searcher
      ? { participantId: searcherPanel.searcher.id, positions: searcherPanel.positions }
      : null,
  });

  const { selectPolygon, toggleAddSighting, selectPoint } = useSlotSelection({
    polygon,
    sighting,
    onOpenReport,
    onSelectSearcher,
  });
  // A click on the map moves the rally point while its panel asks for one, else it places the new sighting.
  const onMapClick = rallyOpen && rally.placesOnMap ? rally.change : sighting.adding ? sighting.place : undefined;
  const canToggleSighting = (canChangeSightings || !!sighting.adding) && !polygon.editing;

  return (
    <>
      <MissionMap
        provider={provider}
        themeId={themeId}
        data={map.data}
        initialView={map.initialView}
        focus={focus}
        onMapClick={onMapClick}
        onPolygonDrawn={canEditPolygons ? polygon.create : undefined}
        onPolygonSelect={selectPolygon}
        onPointSelect={selectPoint}
        onSighting={canToggleSighting ? toggleAddSighting : undefined}
        sightingActive={!!sighting.adding}
        editing={polygon.editing}
        onEditChange={polygon.changeBoundary}
      />

      {alerts}

      {rallyOpen && (
        <div className={styles.rallyPanel}>
          <RallyPointPanel
            provider={provider}
            point={mission.rallyPoint.coordinates}
            mode={rally.mode}
            onModeChange={rally.setMode}
            onChange={rally.change}
            onPlaceFound={(place) => onPlaceFound({ center: place.center, bounds: place.bounds })}
            busy={rally.busy}
            error={rally.error}
            saved={rally.saved}
            blocked={rally.blocked}
            onClose={onRallyClose}
          />
        </div>
      )}

      <SearcherSlot
        panel={searcherPanel}
        taken={!!polygon.selected || !!polygon.edit}
        onClose={() => onSelectSearcher(null)}
      />

      <WorkspacePanels
        mission={mission}
        participants={participants}
        polygon={polygon}
        sighting={sighting}
        sightings={sightings}
        lkps={lkps}
        sightingsLoading={sightingsLoading}
        sightingsFailed={sightingsFailed}
        onRetrySightings={onRetrySightings}
        canEditPolygons={canEditPolygons}
        canChangeSightings={canChangeSightings}
        offline={!online}
        onClosePolygon={() => selectPolygon(null)}
        onToggleAddSighting={toggleAddSighting}
      />
    </>
  );
}
