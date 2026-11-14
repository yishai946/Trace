import type { ThemeId } from '@trace/design';
import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import type { ReactNode } from 'react';
import { MissionsPage } from '../../pages/MissionsPage';
import { NewMissionPage } from '../../pages/NewMissionPage';
import { Backdrop } from '../Backdrop';
import type { ConsoleNav } from './useConsoleNav';

interface LobbyProps {
  nav: ConsoleNav;
  /** The commander's missions, newest first. Undefined while loading. */
  missions: Mission[] | undefined;
  loadFailed: boolean;
  provider: MapProvider;
  themeId: ThemeId;
  /** Without a connection, new missions cannot be created (UC-C01). */
  connected: boolean;
  phone: boolean;
  /** The end of the phone top bar of the mission list. */
  phoneBar: ReactNode;
}

/** The console with no mission open: the mission list over the map, or the new-mission screen (UC-C02). */
export function Lobby({ nav, missions, loadFailed, provider, themeId, connected, phone, phoneBar }: LobbyProps) {
  if (nav.creating) {
    return (
      <NewMissionPage
        provider={provider}
        themeId={themeId}
        online={connected}
        onCancel={() => nav.setCreating(false)}
        onCreated={(created, photoFailed) =>
          nav.openCreated(created.id, photoFailed ? 'המסע נוצר, אבל התמונה לא נשמרה.' : null)
        }
      />
    );
  }
  return (
    <>
      {!phone && <Backdrop provider={provider} themeId={themeId} veil="dense" />}
      <MissionsPage
        missions={missions}
        loadFailed={loadFailed}
        onOpen={nav.openMission}
        onNew={() => nav.setCreating(true)}
        canCreate={connected}
        phoneBar={phoneBar}
      />
    </>
  );
}
