import type { Mission } from '@trace/schemas';
import { Button } from '../../components/Button';
import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import { MissionSwitcher } from '../../components/MissionSwitcher';
import { TraceMark } from '../../components/TraceMark';
import styles from './PhoneMissionScreen.module.css';

interface PhoneBarProps {
  mission: Mission;
  missions: Mission[];
  connection: Connection;
  onSelectMission: (missionId: string) => void;
  onShowAll: () => void;
  joinOpen: boolean;
  searchOpen: boolean;
  onToggleJoin: () => void;
  onToggleSearch: () => void;
}

/** Icons from wireframe Cm04. */
const icon = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** The compact top bar of the phone mission screen: the mission, the connection, the join code and the place search. */
export function PhoneBar({
  mission,
  missions,
  connection,
  onSelectMission,
  onShowAll,
  joinOpen,
  searchOpen,
  onToggleJoin,
  onToggleSearch,
}: PhoneBarProps) {
  return (
    <header className={styles.bar}>
      <span className={styles.brand}>
        <TraceMark size={18} />
      </span>
      <div className={styles.mission}>
        <MissionSwitcher mission={mission} missions={missions} onSelect={onSelectMission} onShowAll={onShowAll} />
      </div>
      <ConnectionStatus connection={connection} />
      <div className={styles.actions}>
        <Button
          variant="icon"
          aria-label={`קוד הצטרפות ${mission.joinCode}`}
          aria-expanded={joinOpen}
          onPress={onToggleJoin}
        >
          <svg {...icon}>
            <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4v-2M14 18h2" />
          </svg>
        </Button>
        <Button variant="icon" aria-label="חיפוש מקום" aria-expanded={searchOpen} onPress={onToggleSearch}>
          <svg {...icon}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
        </Button>
      </div>
    </header>
  );
}
