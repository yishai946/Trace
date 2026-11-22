import type { ThemeId } from '@trace/design';
import type { MapProvider } from '@trace/map';
import type { Mission, SessionUser } from '@trace/schemas';
import { useRef, type ReactNode } from 'react';
import styles from '../App.module.css';
import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import type { MapFocus } from '../../map/MissionMap';
import { MissionDetailsPage } from '../../pages/MissionDetailsPage';
import { AppBar } from './AppBar';
import { Lobby } from './Lobby';
import { MissionPages } from './MissionPages';
import type { ConsoleNav } from './useConsoleNav';
import type { MessageSending, ReportActions, SearcherActions, SosActions } from './useMissionActions';
import type { MissionData } from './useMissionData';

interface DesktopProps {
  nav: ConsoleNav;
  provider: MapProvider;
  themeId: ThemeId;
  user: SessionUser;
  /** The mission on screen: none on the mission list and while a new mission is created. */
  mission: Mission | undefined;
  /** The commander's missions, newest first. Undefined while loading. */
  missions: Mission[] | undefined;
  missionsFailed: boolean;
  data: MissionData;
  /** The open mission's map and what floats on it, in the map view. */
  workspace: ReactNode;
  /** A network and a reachable server: missions can be created and the commander can sign out (UC-C01). */
  connected: boolean;
  /** Connected, and the open mission is live: new operational actions are allowed. */
  operational: boolean;
  connection: Connection;
  profileMenu: ReactNode;
  phone: boolean;
  onPlaceFound: (focus: MapFocus) => void;
  reportActions: ReportActions;
  sosActions: SosActions;
  searcherActions: SearcherActions;
  messageSending: MessageSending;
}

/**
 * The console as the desktop lays it out: the map or a page under the app bar. A phone uses it only for the mission
 * list, which has its own top bar, and for the new-mission screen.
 */
export function Desktop({
  nav,
  provider,
  themeId,
  user,
  mission,
  missions,
  missionsFailed,
  data,
  workspace,
  connected,
  operational,
  connection,
  profileMenu,
  phone,
  onPlaceFound,
  ...actions
}: DesktopProps) {
  const detailsButton = useRef<HTMLButtonElement>(null);
  const shared = { nav, provider, themeId };

  return (
    <>
      {mission ? (
        workspace
      ) : (
        <Lobby
          {...shared}
          missions={missions}
          loadFailed={missionsFailed}
          connected={connected}
          phone={phone}
          phoneBar={
            <>
              <ConnectionStatus connection={connection} />
              {profileMenu}
            </>
          }
        />
      )}

      {mission && nav.panel === 'details' && (
        <MissionDetailsPage
          key={`details-${mission.id}`}
          mission={mission}
          commanderName={user.name}
          searcherCount={(data.participants.data ?? []).filter((p) => p.status !== 'ended').length}
          online={operational}
          changes={{
            events: data.timeline.data,
            loadFailed: data.timeline.isError,
            onRetry: () => void data.timeline.refetch(),
          }}
          onOpenTimeline={() => {
            nav.setPanelOpen('details', false);
            nav.setView('timeline');
          }}
          onClose={() => {
            nav.setPanelOpen('details', false);
            detailsButton.current?.focus();
          }}
        />
      )}

      {mission && <MissionPages {...shared} {...actions} mission={mission} data={data} />}

      {mission && nav.createdNotice && (
        <p className={styles.notice} role="alert">
          {nav.createdNotice}
        </p>
      )}

      {(!phone || nav.creating) && (
        <AppBar
          {...shared}
          mission={mission}
          missions={missions ?? []}
          onPlaceFound={onPlaceFound}
          connection={connection}
          profileMenu={profileMenu}
          detailsButton={detailsButton}
        />
      )}
    </>
  );
}
