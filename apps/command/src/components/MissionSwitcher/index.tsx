import type { Mission } from '@trace/schemas';
import { Button, Menu, MenuItem, MenuSection, MenuTrigger, Popover, Header, type Key } from 'react-aria-components';
import styles from './MissionSwitcher.module.css';
import { MISSION_STATUS_LABELS } from '../../mission/missionStatus';

const ALL_MISSIONS = '__all__';

export interface MissionSwitcherProps {
  /** The mission on screen. */
  mission: Mission;
  /** The commander's missions, newest first. */
  missions: Mission[];
  onSelect: (missionId: string) => void;
  /** Goes to the full mission list. */
  onShowAll: () => void;
}

/** A mission is named by its missing person; a mission without one falls back to its own name. */
const missionLabel = (mission: Mission) => mission.missingPerson.name ?? mission.name;

/**
 * The AppBar mission selector (Trace Console AppBar, wireframe Cd17): the missing person's name, which opens
 * "My missions" to switch mission or go to the full list.
 */
export function MissionSwitcher({ mission, missions, onSelect, onShowAll }: MissionSwitcherProps) {
  const status = MISSION_STATUS_LABELS[mission.status];

  const act = (key: Key) => {
    if (key === ALL_MISSIONS) onShowAll();
    else if (key !== mission.id) onSelect(String(key));
  };

  return (
    <MenuTrigger>
      <Button className={styles.trigger} aria-label={`מסע: ${missionLabel(mission)}, ${status.label}. החלפת מסע`}>
        <span className={styles.dot} data-tone={status.tone} aria-hidden="true" />
        <span className={styles.name}>{missionLabel(mission)}</span>
        <svg
          className={styles.chevron}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Button>
      <Popover className={styles.popover} placement="bottom start" offset={8}>
        <Menu className={styles.menu} aria-label="המסעות שלי" onAction={act}>
          <MenuSection className={styles.section}>
            <Header className={styles.header}>המסעות שלי</Header>
            {missions.map((m) => {
              const s = MISSION_STATUS_LABELS[m.status];
              return (
                <MenuItem
                  key={m.id}
                  id={m.id}
                  textValue={missionLabel(m)}
                  className={m.id === mission.id ? `${styles.item} ${styles.current}` : styles.item}
                >
                  <span className={styles.dot} data-tone={s.tone} aria-hidden="true" />
                  <span className={styles.name}>{missionLabel(m)}</span>
                  <span className={styles.sub}>{s.label}</span>
                </MenuItem>
              );
            })}
          </MenuSection>
          <MenuSection className={styles.section}>
            <MenuItem id={ALL_MISSIONS} className={styles.item}>
              כל המסעות
            </MenuItem>
          </MenuSection>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
