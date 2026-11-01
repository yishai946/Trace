import type { ThemeId } from '@trace/design';
import { canChangePolygons, isActiveInPolygon } from '@trace/domain';
import { boundsOf, findOutside, isValidPolygon, type LngLat, type Polygon } from '@trace/geo';
import { emptyMissionMapData, type MapProvider } from '@trace/map';
import {
  HealthResponse,
  PolygonGeometry,
  SearchersOutsideDetails,
  type Mission,
  type MissionPolygon,
  type Participant,
  type SessionUser,
} from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import styles from './App.module.css';
import { ApiRequestError, apiRequest } from '../api';
import { useSession, useSignOut } from '../auth';
import { Button } from '../components/Button';
import { ProfileMenu } from '../components/ProfileMenu';
import { useOnline } from '../hooks/useOnline';
import { MissionMap, type MapFocus } from '../map/MissionMap';
import { PlaceSearch } from '../map/PlaceSearch';
import { getMapProvider } from '../map/provider';
import { BoundaryEditBar, type OutsideSearcher } from '../mission/BoundaryEditBar';
import { errorMessage } from '../mission/errorMessage';
import { useMissions, useParticipants, usePolygonMutations, usePolygons } from '../mission/missionQueries';
import { PolygonInspector } from '../mission/PolygonInspector';
import { toMapData } from '../mission/toMapData';
import { LoginPage } from '../pages/LoginPage';
import { MissionsPage } from '../pages/MissionsPage';
import { useTheme } from '../theme/theme';

const provider = getMapProvider();
/** Where the map opens when there is no mission yet: Jerusalem. */
const DEFAULT_CENTER: LngLat = [35.2137, 31.7683];
/** How often the console checks that the server is still reachable. */
const HEALTH_INTERVAL_MS = 10_000;

interface BoundaryEdit {
  polygonId: string;
  original: PolygonGeometry;
  draft: PolygonGeometry;
  /** Searchers the server reported outside, when its data was newer than the map's. */
  serverOutside: OutsideSearcher[] | null;
}

/** Signs the commander in (UC-C01), then shows their missions or the one they opened. */
export function App() {
  const { theme } = useTheme();
  const session = useSession();

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

  if (session.isPending) {
    return <p className={styles.setup}>טוען…</p>;
  }

  if (!session.data) {
    return (
      <div className={styles.screen}>
        <Backdrop provider={provider} themeId={theme} veil="light" />
        <LoginPage />
      </div>
    );
  }

  return <Console provider={provider} user={session.data.user} />;
}

/** The map behind the login and mission list screens, under a veil of the map ground colour. */
function Backdrop({ provider, themeId, veil }: { provider: MapProvider; themeId: ThemeId; veil: 'light' | 'dense' }) {
  return (
    <>
      <MissionMap
        provider={provider}
        themeId={themeId}
        data={emptyMissionMapData}
        initialView={{ center: DEFAULT_CENTER, zoom: 12 }}
        focus={null}
        controls={false}
      />
      <div className={styles.veil} data-veil={veil} aria-hidden="true" />
    </>
  );
}

/** The signed-in console: the mission list, or the live map of the mission the commander opened. */
function Console({ provider, user }: { provider: MapProvider; user: SessionUser }) {
  const { theme } = useTheme();
  const online = useOnline();
  const signOut = useSignOut();
  // The server is pinged regularly: navigator.onLine alone misses a lost server or a network with no way out.
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiRequest('/health', { schema: HealthResponse, signal }),
    retry: false,
    refetchInterval: HEALTH_INTERVAL_MS,
  });
  /** New operational actions need both a network and a reachable server (UC-C01). */
  const connected = online && !health.isError;
  const missions = useMissions();
  const [openId, setOpenId] = useState<string | null>(null);
  const mission = missions.data?.find((m) => m.id === openId);
  const polygons = usePolygons(mission?.id);
  const participants = useParticipants(mission?.id);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  // Always on screen: a dot and one word. The reason and its effect are in the tooltip and the accessible name.
  const connection = !connected
    ? {
        state: 'down',
        label: 'לא זמין',
        detail: online ? 'אין חיבור לשרת. פעולות חדשות חסומות.' : 'אין אינטרנט. פעולות חדשות חסומות.',
      }
    : health.isPending
      ? { state: 'checking', label: 'בודק…', detail: 'בודק חיבור לשרת.' }
      : { state: 'up', label: 'זמין', detail: 'מחובר לשרת.' };
  const person = mission?.missingPerson.name ?? mission?.name;

  return (
    <main className={styles.screen}>
      {!mission ? (
        <>
          <Backdrop provider={provider} themeId={theme} veil="dense" />
          <MissionsPage missions={missions.data} loadFailed={missions.isError} onOpen={setOpenId} />
        </>
      ) : polygons.isPending ? (
        <p className={styles.setup}>טוען מסע…</p>
      ) : (
        <MissionWorkspace
          key={mission.id}
          provider={provider}
          focus={focus}
          mission={mission}
          polygons={polygons.data ?? []}
          participants={participants.data ?? []}
          themeId={theme}
          online={connected}
        />
      )}

      <header className={styles.appbar}>
        <span className={styles.brand}>Trace</span>
        {mission && (
          <>
            <Button size="sm" onPress={() => setOpenId(null)}>
              המסעות שלי
            </Button>
            <span className={styles.mission}>
              <span className={styles.person}>{person}</span>
              <span className={styles.meta}>קוד {mission.joinCode}</span>
            </span>
          </>
        )}
        <div className={styles.search}>
          {mission && (
            <PlaceSearch
              provider={provider}
              onSelect={(place) => setFocus({ center: place.center, bounds: place.bounds })}
            />
          )}
        </div>
        <span
          className={styles.status}
          data-state={connection.state}
          role="status"
          title={connection.detail}
          aria-label={`${connection.label}. ${connection.detail}`}
        >
          <span className={styles.statusDot} aria-hidden="true" />
          {connection.label}
        </span>
        <ProfileMenu
          user={user}
          canSignOut={connected}
          signingOut={signOut.isPending}
          signOutFailed={signOut.isError}
          onSignOut={() => signOut.mutate()}
        />
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
  themeId: ThemeId;
  /** Without a connection, new operational actions are blocked (UC-C01). */
  online: boolean;
}

/** The live map of one mission: polygons from the server, drawing, the polygon Inspector and boundary editing. */
function MissionWorkspace({
  provider,
  focus,
  mission,
  polygons,
  participants,
  themeId,
  online,
}: MissionWorkspaceProps) {
  const mutations = usePolygonMutations(mission.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<BoundaryEdit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = canChangePolygons(mission.status) && online;
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
            name={selected.name}
            outside={outside}
            invalid={!isValidPolygon(edit.draft)}
            busy={busy}
            offline={!online}
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
