import type { MapProvider } from '@trace/map';
import type { SessionUser } from '@trace/schemas';
import { useState } from 'react';
import styles from '../App.module.css';
import { useSignOut } from '../../auth';
import { ProfileMenu } from '../../components/ProfileMenu';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import type { MapFocus } from '../../map/MissionMap';
import type { MissionView } from '../../mission/MissionNav';
import { useMissions } from '../../mission/missionQueries';
import { useMissionLive } from '../../realtime';
import { useTheme } from '../../theme/theme';
import { connectionOf, useNetwork } from './connection';
import { Desktop } from './Desktop';
import { MapSlot } from './MapSlot';
import { PhoneMission } from './PhoneMission';
import { useConsoleNav } from './useConsoleNav';
import { useMessageSending, useReportActions, useSearcherActions, useSosActions } from './useMissionActions';
import { useMissionData } from './useMissionData';

/** The phone views that replace the map. */
const PHONE_SCREENS: MissionView[] = ['reports', 'sos'];

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
  const sosActions = useSosActions(mission, operational);
  const messageSending = useMessageSending(mission, operational);
  const connection = connectionOf(network, mission ? live : null);
  /** The mission on screen: none on the mission list and while a new mission is created. */
  const shown = nav.creating ? undefined : mission;
  const shared = { nav, provider, themeId: theme, data, connection, reportActions, sosActions, onPlaceFound: setFocus };

  // The phone shows the map under everything but its Reports and SOS screens; the desktop only in the map view.
  const showMap = nav.view === 'map' || (phone && !PHONE_SCREENS.includes(nav.view));
  const workspace = shown && showMap && (
    <MapSlot
      nav={nav}
      provider={provider}
      themeId={theme}
      mission={shown}
      data={data}
      focus={focus}
      onPlaceFound={setFocus}
      operational={operational}
      alertOnMap={!phone}
    />
  );

  return (
    <main className={styles.screen}>
      {phone && shown ? (
        // The phone gets its own mission screen (Cm04). Its mission list and the new-mission screen use the desktop's.
        <PhoneMission {...shared} mission={shown} missions={missions.data ?? []} workspace={workspace} />
      ) : (
        <Desktop
          {...shared}
          user={user}
          mission={shown}
          missions={missions.data}
          missionsFailed={missions.isError}
          workspace={workspace}
          connected={connected}
          operational={operational}
          phone={phone}
          searcherActions={searcherActions}
          messageSending={messageSending}
          profileMenu={
            <ProfileMenu
              user={user}
              canSignOut={connected}
              signingOut={signOut.isPending}
              signOutFailed={signOut.isError}
              onSignOut={() => signOut.mutate()}
            />
          }
        />
      )}
    </main>
  );
}
