import type { ThemeId } from '@trace/design';
import { canChangeLkp, canChangePolygons, canChangeRallyPoint, isActiveInPolygon, isMissionEnded } from '@trace/domain';
import { boundsOf, findOutside, isValidPolygon, type LngLat, type Polygon } from '@trace/geo';
import { emptyMissionMapData, type MapProvider } from '@trace/map';
import {
  HealthResponse,
  PolygonGeometry,
  SearchersOutsideDetails,
  type CreateSightingBody,
  type LkpDecision,
  type LkpPoint,
  type Mission,
  type MissionPolygon,
  type Participant,
  type Sighting,
  type SessionUser,
} from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import styles from './App.module.css';
import { ApiRequestError, apiRequest } from '../api';
import { useSession, useSignOut } from '../auth';
import { ConnectionStatus, type Connection } from '../components/ConnectionStatus';
import { MissionSwitcher } from '../components/MissionSwitcher';
import { ProfileMenu } from '../components/ProfileMenu';
import { useOnline } from '../hooks/useOnline';
import { usePhoneLayout } from '../hooks/usePhoneLayout';
import { MissionMap, type MapFocus, type PointTarget } from '../map/MissionMap';
import { PlaceSearch } from '../map/PlaceSearch';
import type { PlaceMode } from '../map/PlacePicker';
import { getMapProvider } from '../map/provider';
import { BoundaryEditBar, type OutsideSearcher } from '../mission/BoundaryEditBar';
import { assignErrorMessage, endErrorMessage, errorMessage, sightingErrorMessage } from '../mission/errorMessage';
import { JoinCodePanel } from '../mission/JoinCodePanel';
import { LkpPanel } from '../mission/LkpPanel';
import { MissionLayout } from '../mission/MissionLayout';
import type { MissionView } from '../mission/MissionNav';
import {
  useLkps,
  useMissions,
  useAssign,
  useEndParticipation,
  useParticipants,
  usePolygonMutations,
  usePolygons,
  useSightingMutations,
  useSightings,
  useTimeline,
  useUpdateRallyPoint,
} from '../mission/missionQueries';
import { PhoneMissionScreen } from '../mission/PhoneMissionScreen';
import { PolygonInspector } from '../mission/PolygonInspector';
import { rallyErrorMessage } from '../mission/rallyErrorMessage';
import { RallyPointPanel } from '../mission/RallyPointPanel';
import { toMapData } from '../mission/toMapData';
import { LoginPage } from '../pages/LoginPage';
import { MissionDetailsPage } from '../pages/MissionDetailsPage';
import { MissionsPage } from '../pages/MissionsPage';
import { NewMissionPage } from '../pages/NewMissionPage';
import { SearchersPage } from '../pages/SearchersPage';
import { TimelinePage } from '../pages/TimelinePage';
import { useMissionLive } from '../realtime';
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
      <div className={styles.screen} data-login="">
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

/** The signed-in console: the mission list, a new mission, or the live map of the mission the commander opened. */
function Console({ provider, user }: { provider: MapProvider; user: SessionUser }) {
  const { theme } = useTheme();
  const online = useOnline();
  const phone = usePhoneLayout();
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
  const [creating, setCreating] = useState(false);
  /** The join code, QR and link panel; it opens by itself on a mission just created (UC-C02 step 4). */
  const [joinOpen, setJoinOpen] = useState(false);
  /** The rally point panel (UC-C05). It shares the panel corner with the join code, so only one is open. */
  const [rallyOpen, setRallyOpen] = useState(false);
  /** The mission details screen (UC-C03). It covers the map and the panels, so no other panel stays open with it. */
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsButton = useRef<HTMLButtonElement>(null);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);
  /** The live map or the Timeline. The Timeline is also open for an ended mission, read-only (UC-C19). */
  const [view, setView] = useState<MissionView>('map');
  const openMission = (id: string | null) => {
    setOpenId(id);
    setView('map');
    setJoinOpen(false);
    setRallyOpen(false);
    setDetailsOpen(false);
    setCreatedNotice(null);
  };
  const mission = missions.data?.find((m) => m.id === openId);
  const polygons = usePolygons(mission?.id);
  const participants = useParticipants(mission?.id);
  const assign = useAssign(mission?.id ?? '');
  const endParticipation = useEndParticipation(mission?.id ?? '');
  const sightings = useSightings(mission?.id);
  const lkps = useLkps(mission?.id);
  const timeline = useTimeline(mission && view === 'timeline' ? mission.id : undefined);
  const live = useMissionLive(mission?.id);
  /** With a mission open, its map must also be live: actions on data that stopped updating are blocked too. */
  const operational = connected && (!mission || live === 'live');
  const [focus, setFocus] = useState<MapFocus | null>(null);

  // Always on screen: a dot and one word. The reason and its effect are in the tooltip and the accessible name.
  const connection: Connection = !connected
    ? {
        state: 'down',
        label: 'לא זמין',
        detail: online ? 'אין חיבור לשרת. פעולות חדשות חסומות.' : 'אין אינטרנט. פעולות חדשות חסומות.',
      }
    : health.isPending || (mission && live === 'connecting')
      ? { state: 'checking', label: 'בודק…', detail: 'בודק חיבור לשרת.' }
      : mission && live === 'down'
        ? {
            state: 'down',
            label: 'לא זמין',
            detail: 'העדכונים החיים מהשרת נקטעו. מתחבר מחדש; פעולות חדשות חסומות.',
          }
        : { state: 'up', label: 'זמין', detail: mission ? 'מחובר לשרת. המפה מתעדכנת בזמן אמת.' : 'מחובר לשרת.' };

  const phoneList = phone && !mission && !creating;
  const profileMenu = (
    <ProfileMenu
      user={user}
      canSignOut={connected}
      signingOut={signOut.isPending}
      signOutFailed={signOut.isError}
      onSignOut={() => signOut.mutate()}
    />
  );

  const workspace =
    !mission || (view !== 'map' && !phone) ? null : polygons.isPending ? (
      <p className={styles.setup}>טוען מסע…</p>
    ) : (
      <MissionWorkspace
        key={mission.id}
        provider={provider}
        focus={focus}
        mission={mission}
        polygons={polygons.data ?? []}
        participants={participants.data ?? []}
        sightings={sightings.data}
        lkps={lkps.data}
        sightingsLoading={sightings.isPending || lkps.isPending}
        sightingsFailed={sightings.isError || lkps.isError}
        onRetrySightings={() => {
          void sightings.refetch();
          void lkps.refetch();
        }}
        themeId={theme}
        online={operational}
        rallyOpen={rallyOpen}
        onRallyClose={() => setRallyOpen(false)}
        onPlaceFound={setFocus}
      />
    );

  // The phone gets its own mission screen (Cm04). The mission list and login have their own phone screens;
  // new mission stays as on the desktop.
  if (phone && mission && !creating) {
    return (
      <main className={styles.screen}>
        <PhoneMissionScreen
          key={mission.id}
          mission={mission}
          missions={missions.data ?? []}
          connection={connection}
          onSelectMission={openMission}
          onShowAll={() => openMission(null)}
          joinOpen={joinOpen}
          onJoinOpenChange={setJoinOpen}
          notice={createdNotice}
          participants={participants.data}
          participantsFailed={participants.isError}
          polygons={polygons.data ?? []}
          workspace={workspace}
          renderSearch={(close) => (
            <PlaceSearch
              provider={provider}
              fullWidth
              autoFocus
              onSelect={(place) => {
                setFocus({ center: place.center, bounds: place.bounds });
                close();
              }}
            />
          )}
        />
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      {creating ? (
        <NewMissionPage
          provider={provider}
          themeId={theme}
          online={connected}
          onCancel={() => setCreating(false)}
          onCreated={(created, photoFailed) => {
            setCreating(false);
            setOpenId(created.id);
            setJoinOpen(true);
            setRallyOpen(false);
            setDetailsOpen(false);
            setCreatedNotice(photoFailed ? 'המסע נוצר, אבל התמונה לא נשמרה.' : null);
          }}
        />
      ) : !mission ? (
        <>
          {!phone && <Backdrop provider={provider} themeId={theme} veil="dense" />}
          <MissionsPage
            missions={missions.data}
            loadFailed={missions.isError}
            onOpen={openMission}
            onNew={() => setCreating(true)}
            canCreate={connected}
            phoneBar={
              <>
                <ConnectionStatus connection={connection} />
                {profileMenu}
              </>
            }
          />
        </>
      ) : (
        workspace
      )}

      {mission && !creating && detailsOpen && (
        <MissionDetailsPage
          key={`details-${mission.id}`}
          mission={mission}
          commanderName={user.name}
          searcherCount={(participants.data ?? []).filter((p) => p.status !== 'ended').length}
          online={operational}
          onClose={() => {
            setDetailsOpen(false);
            detailsButton.current?.focus();
          }}
        />
      )}

      {mission && !creating && (
        <MissionLayout
          missionName={mission.name}
          view={view}
          onNavigate={setView}
          joinPanel={joinOpen && <JoinCodePanel mission={mission} onClose={() => setJoinOpen(false)} />}
        >
          {view === 'searchers' && (
            <SearchersPage
              participants={participants.data}
              polygons={polygons.data ?? []}
              loadFailed={participants.isError}
              onRetry={() => void participants.refetch()}
              onAssign={
                operational && !isMissionEnded(mission.status)
                  ? (participantId, polygonId) => {
                      endParticipation.reset();
                      assign.mutate({ missionId: mission.id, participantId, polygonId });
                    }
                  : undefined
              }
              // Tracking continues after the mission ended until Finish Activity, so ending stays possible then.
              onEnd={
                operational
                  ? (participantId) => {
                      assign.reset();
                      endParticipation.mutate({ missionId: mission.id, participantId });
                    }
                  : undefined
              }
              assigning={assign.isPending || endParticipation.isPending}
              // The mutation outlives a switch of mission: show only this mission's failure.
              assignError={
                assign.isError && assign.variables?.missionId === mission.id
                  ? assignErrorMessage(assign.error)
                  : endParticipation.isError && endParticipation.variables?.missionId === mission.id
                    ? endErrorMessage(endParticipation.error)
                    : null
              }
            />
          )}
          {view === 'timeline' && (
            <TimelinePage
              events={timeline.data}
              loadFailed={timeline.isError}
              onRetry={() => void timeline.refetch()}
              onGoToMap={() => setView('map')}
            />
          )}
        </MissionLayout>
      )}

      {mission && !creating && createdNotice && (
        <p className={styles.notice} role="alert">
          {createdNotice}
        </p>
      )}

      {!phoneList && (
        <header className={styles.appbar}>
          <span className={styles.brand}>Trace</span>
          {mission && !creating && (
            <>
              <span className={styles.sep} aria-hidden="true" />
              <div className={styles.mission}>
                <MissionSwitcher
                  mission={mission}
                  missions={missions.data ?? []}
                  onSelect={openMission}
                  onShowAll={() => openMission(null)}
                />
              </div>
              <AriaButton
                className={styles.meta}
                aria-expanded={joinOpen}
                aria-label={`קוד הצטרפות ${mission.joinCode}`}
                onPress={() => {
                  setJoinOpen((open) => !open);
                  setRallyOpen(false);
                  setDetailsOpen(false);
                }}
              >
                קוד {mission.joinCode}
              </AriaButton>
              <AriaButton
                className={styles.meta}
                aria-expanded={rallyOpen}
                onPress={() => {
                  setRallyOpen((open) => !open);
                  setJoinOpen(false);
                  setDetailsOpen(false);
                }}
              >
                נקודת כינוס
              </AriaButton>
              <AriaButton
                ref={detailsButton}
                className={styles.meta}
                aria-expanded={detailsOpen}
                onPress={() => {
                  setDetailsOpen((open) => !open);
                  setJoinOpen(false);
                  setRallyOpen(false);
                }}
              >
                פרטי מסע
              </AriaButton>
            </>
          )}
          <div className={styles.search}>
            {mission && !creating && (
              <PlaceSearch
                provider={provider}
                onSelect={(place) => setFocus({ center: place.center, bounds: place.bounds })}
              />
            )}
          </div>
          <ConnectionStatus connection={connection} />
          {profileMenu}
        </header>
      )}
    </main>
  );
}

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

/** The live map of one mission: polygons from the server, drawing, the polygon Inspector and boundary editing. */
function MissionWorkspace({
  provider,
  focus,
  mission,
  polygons,
  participants,
  sightings,
  lkps,
  sightingsLoading,
  sightingsFailed,
  onRetrySightings,
  themeId,
  online,
  rallyOpen,
  onRallyClose,
  onPlaceFound,
}: MissionWorkspaceProps) {
  const mutations = usePolygonMutations(mission.id);
  const sightingMutations = useSightingMutations(mission.id);
  /** The LKP and sightings panel (UC-C04), in the end-side slot while no polygon is selected. */
  const [lkpOpen, setLkpOpen] = useState(false);
  /** The add-sighting form is open; its position comes from a click on the map. */
  const [adding, setAdding] = useState<{ position: LngLat | null } | null>(null);
  const [selectedSightingId, setSelectedSightingId] = useState<string | null>(null);
  const [sightingError, setSightingError] = useState<string | null>(null);
  const rallyUpdate = useUpdateRallyPoint(mission.id);
  const [rallyMode, setRallyMode] = useState<PlaceMode>('map');
  const [rallySaved, setRallySaved] = useState(false);
  const [rallyError, setRallyError] = useState<string | null>(null);
  const rallyBlocked = !canChangeRallyPoint(mission.status) ? 'ended' : !online ? 'offline' : null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<BoundaryEdit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = canChangePolygons(mission.status) && online;
  const canChangeSightings = canChangeLkp(mission.status) && online;
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
        sightings: sightings ?? [],
        lkps: lkps ?? [],
        selectedPolygonId: selectedId,
        editingPolygonId: edit?.polygonId ?? null,
      }),
    [mission, polygons, participants, sightings, lkps, selectedId, edit?.polygonId],
  );
  // The spot chosen for a new sighting shows on the map before it is saved.
  const draftPosition = adding?.position ?? null;
  const mapDataWithDraft = useMemo(
    () =>
      draftPosition
        ? {
            ...mapData,
            sightings: [...mapData.sightings, { id: 'draft', position: draftPosition, label: 'תצפית חדשה' }],
          }
        : mapData,
    [mapData, draftPosition],
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

  const changeRally = (point: LngLat) => {
    setRallySaved(false);
    setRallyError(null);
    rallyUpdate.mutate(point, {
      onSuccess: () => setRallySaved(true),
      onError: (e) => setRallyError(rallyErrorMessage(e)),
    });
  };

  const select = (polygonId: string | null) => {
    setSelectedId(polygonId);
    setError(null);
    // The end-side slot holds one panel: a polygon replaces the LKP panel and ends adding a sighting.
    if (polygonId) {
      setLkpOpen(false);
      setAdding(null);
    }
  };

  const openLkpPanel = (sightingId: string | null) => {
    setSelectedId(null);
    setError(null);
    setSightingError(null);
    setLkpOpen(true);
    setSelectedSightingId(sightingId);
  };

  const toggleAddSighting = () => {
    if (adding) {
      setAdding(null);
      return;
    }
    openLkpPanel(null);
    setAdding({ position: null });
  };

  // Escape leaves add-sighting mode, unless a field or the map already used it.
  useEffect(() => {
    if (!adding) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setAdding(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adding]);

  const selectPoint = (target: PointTarget) => openLkpPanel(target.kind === 'sighting' ? target.id : null);

  const submitSighting = (body: CreateSightingBody) => {
    sightingMutations.create(body, {
      onSuccess: (created) => {
        setAdding(null);
        setSelectedSightingId(created.id);
        setSightingError(null);
      },
      onError: (e) => setSightingError(sightingErrorMessage(e)),
    });
  };

  const decide = (sightingId: string, decision: LkpDecision) => {
    sightingMutations.decide(
      { sightingId, decision },
      { onSuccess: () => setSightingError(null), onError: (e) => setSightingError(sightingErrorMessage(e)) },
    );
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
        data={mapDataWithDraft}
        initialView={initialView}
        focus={focus}
        onMapClick={
          rallyOpen && rallyMode === 'map' && !rallyBlocked && !rallyUpdate.isPending
            ? changeRally
            : adding
              ? (position) => setAdding({ position })
              : undefined
        }
        onPolygonDrawn={canEdit ? create : undefined}
        onPolygonSelect={select}
        onPointSelect={selectPoint}
        onSighting={(canChangeSightings || adding) && !edit ? toggleAddSighting : undefined}
        sightingActive={!!adding}
        editing={edit ? { polygonId: edit.polygonId, geometry: edit.original } : null}
        onEditChange={(changed) => {
          const draft = PolygonGeometry.safeParse(changed);
          if (draft.success) setEdit((e) => (e ? { ...e, draft: draft.data, serverOutside: null } : e));
        }}
      />

      {rallyOpen && (
        <div className={styles.rallyPanel}>
          <RallyPointPanel
            provider={provider}
            point={mission.rallyPoint.coordinates}
            mode={rallyMode}
            onModeChange={setRallyMode}
            onChange={changeRally}
            onPlaceFound={(place) => onPlaceFound({ center: place.center, bounds: place.bounds })}
            busy={rallyUpdate.isPending}
            error={rallyError}
            saved={rallySaved}
            blocked={rallyBlocked}
            onClose={onRallyClose}
          />
        </div>
      )}

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

      {lkpOpen && !selected && !edit && (
        <div className={`${styles.inspector} ${styles.scrolling}`}>
          <LkpPanel
            mission={mission}
            lkps={lkps}
            sightings={sightings}
            loading={sightingsLoading}
            loadFailed={sightingsFailed}
            canChange={canChangeSightings}
            busy={sightingMutations.isPending}
            error={sightingError}
            selectedSightingId={selectedSightingId}
            adding={adding}
            onRetry={onRetrySightings}
            onStartAdd={toggleAddSighting}
            onCancelAdd={() => setAdding(null)}
            onEdit={() => setSightingError(null)}
            onSubmit={submitSighting}
            onDecide={decide}
            onClose={() => {
              setLkpOpen(false);
              setAdding(null);
              setSelectedSightingId(null);
            }}
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
