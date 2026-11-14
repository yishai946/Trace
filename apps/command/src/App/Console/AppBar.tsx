import type { MapProvider } from '@trace/map';
import type { Mission } from '@trace/schemas';
import type { ReactNode, RefObject } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import styles from '../App.module.css';
import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import { MissionSwitcher } from '../../components/MissionSwitcher';
import type { MapFocus } from '../../map/MissionMap';
import { PlaceSearch } from '../../map/PlaceSearch';
import type { ConsoleNav, ConsolePanel } from './useConsoleNav';

interface AppBarProps {
  /** The open mission; undefined on the mission list and while creating a mission. */
  mission: Mission | undefined;
  missions: Mission[];
  nav: ConsoleNav;
  provider: MapProvider;
  /** The commander searched for a place: the map moves there. */
  onPlaceFound: (focus: MapFocus) => void;
  connection: Connection;
  profileMenu: ReactNode;
  /** Focus returns to this button when the mission details close. */
  detailsButton: RefObject<HTMLButtonElement | null>;
}

const PANEL_LABELS: Record<Exclude<ConsolePanel, 'join'>, string> = { rally: 'נקודת כינוס', details: 'פרטי מסע' };

/** The desktop top bar: the open mission and its panels, the place search, the connection and the profile. */
export function AppBar({
  mission,
  missions,
  nav,
  provider,
  onPlaceFound,
  connection,
  profileMenu,
  detailsButton,
}: AppBarProps) {
  return (
    <header className={styles.appbar}>
      <span className={styles.brand}>Trace</span>
      {mission && (
        <>
          <span className={styles.sep} aria-hidden="true" />
          <div className={styles.mission}>
            <MissionSwitcher
              mission={mission}
              missions={missions}
              onSelect={nav.openMission}
              onShowAll={() => nav.openMission(null)}
            />
          </div>
          <AriaButton
            className={styles.meta}
            aria-expanded={nav.panel === 'join'}
            aria-label={`קוד הצטרפות ${mission.joinCode}`}
            onPress={() => nav.togglePanel('join')}
          >
            קוד {mission.joinCode}
          </AriaButton>
          {(['rally', 'details'] as const).map((panel) => (
            <AriaButton
              key={panel}
              ref={panel === 'details' ? detailsButton : undefined}
              className={styles.meta}
              aria-expanded={nav.panel === panel}
              onPress={() => nav.togglePanel(panel)}
            >
              {PANEL_LABELS[panel]}
            </AriaButton>
          ))}
        </>
      )}
      <div className={styles.search}>
        {mission && (
          <PlaceSearch
            provider={provider}
            onSelect={(place) => onPlaceFound({ center: place.center, bounds: place.bounds })}
          />
        )}
      </div>
      <ConnectionStatus connection={connection} />
      {profileMenu}
    </header>
  );
}
