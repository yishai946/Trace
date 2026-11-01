import { canChangePolygons, isActiveInPolygon, isMissionEnded } from '@trace/domain';
import { boundsOf, findOutside, isSimplePolygon, type LngLat, type Polygon } from '@trace/geo';
import { emptyMissionMapData, type MapProvider } from '@trace/map';
import {
  HealthResponse,
  PolygonGeometry,
  SearchersOutsideDetails,
  type Mission,
  type MissionPolygon,
  type Participant,
} from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import styles from './App.module.css';
import { ApiRequestError, apiRequest } from '../api';
import { Button } from '../components/Button';
import { MissionMap, type MapFocus } from '../map/MissionMap';
import { PlaceSearch } from '../map/PlaceSearch';
import { getMapProvider } from '../map/provider';
import { BoundaryEditBar, type OutsideSearcher } from '../mission/BoundaryEditBar';
import { errorMessage } from '../mission/errorMessage';
import { useMissions, useParticipants, usePolygonMutations, usePolygons } from '../mission/missionQueries';
import { PolygonInspector } from '../mission/PolygonInspector';
import { toMapData } from '../mission/toMapData';
import { useTheme } from '../theme/theme';

const provider = getMapProvider();
/** Where the map opens when there is no mission yet: Jerusalem. */
const DEFAULT_CENTER: LngLat = [35.2137, 31.7683];

interface BoundaryEdit {
  polygonId: string;
  original: PolygonGeometry;
  draft: PolygonGeometry;
  /** Searchers the server reported outside, when its data was newer than the map's. */
  serverOutside: OutsideSearcher[] | null;
}

/** The mission the console opens: the newest one that has not ended, else the newest. */
function currentMission(missions: Mission[] | undefined): Mission | undefined {
  return missions?.find((m) => !isMissionEnded(m.status)) ?? missions?.[0];
}

export function App() {
  const { theme, setTheme } = useTheme();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiRequest('/health', { schema: HealthResponse, signal }),
    retry: false,
  });
  const missions = useMissions();
  const mission = currentMission(missions.data);
  const polygons = usePolygons(mission?.id);
  const participants = useParticipants(mission?.id);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  if (!provider) {
    return (
      <main className={styles.screen}>
        <div className={styles.setup} role="alert">
          חסר מפתח מפה. העתיקו את <code>apps/command/.env.example</code> ל-<code>.env.local</code>, הוסיפו את מפתח
          MapTiler והפעילו מחדש את שרת הפיתוח.
        </div>
      </main>
    );
  }

  const apiStatus = health.isPending ? 'בודק חיבור…' : health.isError ? 'השרת לא זמין' : null;

  return (
    <main className={styles.screen}>
      {missions.isPending || (mission && polygons.isPending) ? (
        <p className={styles.setup}>טוען מסע…</p>
      ) : mission ? (
        <MissionWorkspace
          key={mission.id}
          provider={provider}
          focus={focus}
          mission={mission}
          polygons={polygons.data ?? []}
          participants={participants.data ?? []}
          themeId={theme}
        />
      ) : (
        <>
          <MissionMap
            provider={provider}
            themeId={theme}
            data={emptyMissionMapData}
            initialView={{ center: DEFAULT_CENTER, zoom: 12 }}
            focus={focus}
          />
          <p className={styles.notice} role="status">
            {missions.isError
              ? 'לא ניתן לטעון מסעות מהשרת.'
              : 'אין מסעות עדיין. בסביבת פיתוח: pnpm db:seed יוצר מסע לדוגמה.'}
          </p>
        </>
      )}

      <header className={styles.appbar}>
        <span className={styles.brand}>Trace</span>
        {mission && (
          <span className={styles.mission}>
            {mission.name}
            {mission.missingPerson.name && `, ${mission.missingPerson.name}`}
            <span className={styles.meta}>קוד {mission.joinCode}</span>
          </span>
        )}
        <div className={styles.search}>
          <PlaceSearch
            provider={provider}
            onSelect={(place) => setFocus({ center: place.center, bounds: place.bounds })}
          />
        </div>
        {apiStatus && (
          <span className={styles.status} data-state={health.isError ? 'error' : 'pending'}>
            {apiStatus}
          </span>
        )}
        <div className={styles.actions}>
          <Button onPress={() => setTheme(theme === 'night' ? 'day' : 'night')}>
            {theme === 'night' ? 'ערכת יום' : 'ערכת לילה'}
          </Button>
        </div>
      </header>
    </main>
  );
}

interface MissionWorkspaceProps {
  provider: MapProvider;
  focus: MapFocus | null;
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  themeId: ReturnType<typeof useTheme>['theme'];
}

/** The live map of one mission: polygons from the server, drawing, the polygon Inspector and boundary editing. */
function MissionWorkspace({ provider, focus, mission, polygons, participants, themeId }: MissionWorkspaceProps) {
  const mutations = usePolygonMutations(mission.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<BoundaryEdit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = canChangePolygons(mission.status);
  // The map opens on everything the mission has placed: polygons, rally point and LKP. Read once, at mount.
  const [initialView] = useState(() => {
    const points = [mission.rallyPoint, ...(mission.lkp ? [mission.lkp.position] : [])];
    const bounds = boundsOf({
      type: 'GeometryCollection',
      geometries: [...points, ...polygons.map((p) => p.geometry)],
    });
    return { center: mission.rallyPoint.coordinates as LngLat, zoom: 14, bounds };
  });
  const selected = polygons.find((p) => p.id === selectedId) ?? null;
  const busy = mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;

  const mapData = useMemo(
    () =>
      toMapData({
        mission,
        polygons,
        participants,
        selectedPolygonId: selectedId,
        editingPolygonId: edit?.polygonId ?? null,
      }),
    [mission, polygons, participants, selectedId, edit?.polygonId],
  );

  // The client warns as the boundary moves; the server checks again when saving.
  const outside = useMemo<OutsideSearcher[]>(() => {
    if (!edit) return [];
    if (edit.serverOutside) return edit.serverOutside;
    const located = participants.filter((p) => isActiveInPolygon(p, edit.polygonId) && p.position);
    return findOutside(
      located.map((p) => ({ id: p.id, position: p.position as LngLat })),
      edit.draft,
    ).flatMap(({ id, meters }) => {
      const p = located.find((l) => l.id === id);
      return p ? [{ callsign: p.callsign, name: p.name, meters }] : [];
    });
  }, [edit, participants]);

  const select = (polygonId: string | null) => {
    setSelectedId(polygonId);
    setError(null);
  };

  const create = (drawn: Polygon) => {
    const geometry = PolygonGeometry.safeParse(drawn);
    if (!geometry.success) {
      setError('הפוליגון שצויר אינו תקין. ציירו אותו שוב.');
      return;
    }
    setError(null);
    mutations.create.mutate(
      { geometry: geometry.data },
      { onSuccess: (created) => setSelectedId(created.id), onError: (e) => setError(errorMessage(e)) },
    );
  };

  const rename = (name: string) => {
    if (!selected) return;
    mutations.update.mutate(
      { polygonId: selected.id, name },
      { onSuccess: () => setError(null), onError: (e) => setError(errorMessage(e)) },
    );
  };

  const remove = () => {
    if (!selected) return;
    mutations.remove.mutate(selected.id, {
      onSuccess: () => select(null),
      onError: (e) => setError(errorMessage(e)),
    });
  };

  const saveBoundary = () => {
    if (!edit) return;
    mutations.update.mutate(
      { polygonId: edit.polygonId, geometry: edit.draft, confirmSearchersOutside: outside.length > 0 },
      {
        onSuccess: () => {
          setEdit(null);
          setError(null);
        },
        onError: (e) => {
          if (e instanceof ApiRequestError && e.code === 'SEARCHERS_OUTSIDE_POLYGON') {
            const details = SearchersOutsideDetails.safeParse(e.details);
            if (details.success) {
              setEdit({ ...edit, serverOutside: details.data.searchers });
              return;
            }
          }
          setError(errorMessage(e));
        },
      },
    );
  };

  return (
    <>
      <MissionMap
        provider={provider}
        themeId={themeId}
        data={mapData}
        initialView={initialView}
        focus={focus}
        onPolygonDrawn={canEdit ? create : undefined}
        onPolygonSelect={select}
        editing={edit ? { polygonId: edit.polygonId, geometry: edit.original } : null}
        onEditChange={(changed) => {
          const draft = PolygonGeometry.safeParse(changed);
          if (draft.success) setEdit((e) => (e ? { ...e, draft: draft.data, serverOutside: null } : e));
        }}
      />

      {selected && !edit && (
        <div className={styles.inspector}>
          <PolygonInspector
            key={selected.id}
            polygon={selected}
            assigned={participants.filter((p) => isActiveInPolygon(p, selected.id))}
            canEdit={canEdit}
            busy={busy}
            error={error}
            onClose={() => select(null)}
            onRename={rename}
            onEditBoundary={() => {
              setError(null);
              setEdit({
                polygonId: selected.id,
                original: selected.geometry,
                draft: selected.geometry,
                serverOutside: null,
              });
            }}
            onDelete={remove}
          />
        </div>
      )}

      {edit && selected && (
        <div className={styles.editBar}>
          <BoundaryEditBar
            letter={selected.letter}
            outside={outside}
            invalid={!isSimplePolygon(edit.draft)}
            busy={busy}
            error={error}
            onCancel={() => {
              setEdit(null);
              setError(null);
            }}
            onSave={saveBoundary}
          />
        </div>
      )}

      {!selected && error && (
        <p className={styles.notice} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
