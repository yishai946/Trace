import type { MapProvider } from '@trace/map';
import type { SessionUser } from '@trace/schemas';
import { useRef, useState } from 'react';
import styles from '../App.module.css';
import { useSignOut } from '../../auth';
import { ConnectionStatus } from '../../components/ConnectionStatus';
import { ProfileMenu } from '../../components/ProfileMenu';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import type { MapFocus } from '../../map/MissionMap';
import { useMissions } from '../../mission/missionQueries';
import { MissionDetailsPage } from '../../pages/MissionDetailsPage';
import { MissionsPage } from '../../pages/MissionsPage';
import { NewMissionPage } from '../../pages/NewMissionPage';
import { useMissionLive } from '../../realtime';
import { useTheme } from '../../theme/theme';
import { Backdrop } from '../Backdrop';
import { MissionWorkspace } from '../MissionWorkspace';
import { AppBar } from './AppBar';
import { connectionOf, useNetwork } from './connection';
import { MissionPages } from './MissionPages';
import { PhoneMission } from './PhoneMission';
import { useConsoleNav } from './useConsoleNav';
import { useMessageSending, useReportActions, useSearcherActions } from './useMissionActions';
import { useMissionData } from './useMissionData';

/** The signed-in console: the mission list, a new mission, or the live map of the mission the commander opened. */
export function Console({ provider, user }: { provider: MapProvider; user: SessionUser }) {
  const { theme } = useTheme();
  const phone = usePhoneLayout();
  const signOut = useSignOut();
  const network = useNetwork();
  const { connected } = network;
  const missions = useMissions();
  const nav = useConsoleNav();
  const mission = missions.data?.find((m) => m.id === nav.openId);
  const data = useMissionData(mission?.id, nav.view);
  const live = useMissionLive(mission?.id);
  /** With a mission open, its map must also be live: actions on data that stopped updating are blocked too. */
  const operational = connected && (!mission || live === 'live');
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const reportActions = useReportActions(mission, operational);
  const searcherActions = useSearcherActions(mission, operational);
  const messageSending = useMessageSending(mission, operational);
  const detailsButton = useRef<HTMLButtonElement>(null);
  const connection = connectionOf(network, mission ? live : null);
  /** The mission on screen: none on the mission list and while a new mission is created. */
  const shown = nav.creating ? undefined : mission;

  const profileMenu = (
    <ProfileMenu
      user={user}
      canSignOut={connected}
      signingOut={signOut.isPending}
      signOutFailed={signOut.isError}
      onSignOut={() => signOut.mutate()}
    />
  );

  // The phone shows the map under everything but its Reports screen; the desktop only in the map view.
  const showMap = nav.view === 'map' || (phone && nav.view !== 'reports');
  const workspace =
    !mission || !showMap ? null : data.polygons.isPending ? (
      <p className={styles.setup}>טוען מסע…</p>
    ) : (
      <MissionWorkspace
        key={mission.id}
        provider={provider}
        focus={focus}
        mission={mission}
        polygons={data.polygons.data ?? []}
        participants={data.participants.data ?? []}
        sightings={data.sightings.data}
        lkps={data.lkps.data}
        reports={data.reports.data ?? []}
        onOpenReport={nav.openReport}
        alertOnMap={!phone}
        sightingsLoading={data.sightings.isPending || data.lkps.isPending}
        sightingsFailed={data.sightings.isError || data.lkps.isError}
        onRetrySightings={() => {
          void data.sightings.refetch();
          void data.lkps.refetch();
        }}
        themeId={theme}
        online={operational}
        rallyOpen={nav.panel === 'rally'}
        onRallyClose={() => nav.setPanelOpen('rally', false)}
        onPlaceFound={setFocus}
      />
    );

  // The phone gets its own mission screen (Cm04). The mission list and login have their own phone screens;
  // new mission stays as on the desktop.
  if (phone && shown) {
    return (
      <main className={styles.screen}>
        <PhoneMission
          mission={shown}
          missions={missions.data ?? []}
          data={data}
          nav={nav}
          connection={connection}
          workspace={workspace}
          provider={provider}
          themeId={theme}
          reportActions={reportActions}
          onPlaceFound={setFocus}
        />
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      {nav.creating ? (
        <NewMissionPage
          provider={provider}
          themeId={theme}
          online={connected}
          onCancel={() => nav.setCreating(false)}
          onCreated={(created, photoFailed) =>
            nav.openCreated(created.id, photoFailed ? 'המסע נוצר, אבל התמונה לא נשמרה.' : null)
          }
        />
      ) : !mission ? (
        <>
          {!phone && <Backdrop provider={provider} themeId={theme} veil="dense" />}
          <MissionsPage
            missions={missions.data}
            loadFailed={missions.isError}
            onOpen={nav.openMission}
            onNew={() => nav.setCreating(true)}
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

      {shown && nav.panel === 'details' && (
        <MissionDetailsPage
          key={`details-${shown.id}`}
          mission={shown}
          commanderName={user.name}
          searcherCount={(data.participants.data ?? []).filter((p) => p.status !== 'ended').length}
          online={operational}
          onClose={() => {
            nav.setPanelOpen('details', false);
            detailsButton.current?.focus();
          }}
        />
      )}

      {shown && (
        <MissionPages
          mission={shown}
          data={data}
          nav={nav}
          provider={provider}
          themeId={theme}
          reportActions={reportActions}
          searcherActions={searcherActions}
          messageSending={messageSending}
        />
      )}

      {shown && nav.createdNotice && (
        <p className={styles.notice} role="alert">
          {nav.createdNotice}
        </p>
      )}

      {/* The phone's mission list has its own top bar. */}
      {(!phone || nav.creating) && (
        <AppBar
          mission={shown}
          missions={missions.data ?? []}
          nav={nav}
          provider={provider}
          onPlaceFound={setFocus}
          connection={connection}
          profileMenu={profileMenu}
          detailsButton={detailsButton}
        />
      )}
    </main>
  );
}
